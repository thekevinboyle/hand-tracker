/**
 * Modulation evaluator (Task 4.1).
 *
 * Pure TS module — no DOM, no React, no import-time side effects. Maps
 * modulation sources (hand landmarks, pinch, centroid) through
 * `ModulationRoute[]` into a fresh `ParamState`. The render loop calls this
 * every frame; correctness + allocation discipline are both required.
 *
 * Contract (D13/D14/D15/D18/D20):
 *   - `applyModulation(routes, sources, params)` returns the INPUT `params`
 *     reference unchanged when nothing modulated — lets the caller do a
 *     cheap `if (next !== params) paramStore.replace(next)` frame-pass.
 *   - Disabled or unresolved routes short-circuit.
 *   - Integer-typed params (detected against the CURRENT value via
 *     `Number.isInteger`) are rounded post-curve.
 *   - Bezier curves are memoized per control-point tuple in a module-scoped
 *     cache — one allocation per unique curve over the session.
 *
 * Non-contract: this module never touches `modulationStore` or
 * `paramStore` directly. The caller owns both.
 */

import BezierEasing from 'bezier-easing';
import type { ParamState } from './paramStore';

/** MediaPipe-compatible landmark subset — we only read `x`/`y` (normalized
 *  0..1, unmirrored per D27). `z` carried for future depth-based sources. */
export type Landmark = { x: number; y: number; z: number };

/** D15 — union of every modulation source. Landmark indices run 0..20
 *  (MediaPipe HandLandmarker). `pinch` = |landmark[4] − landmark[8]| in
 *  normalized units. `centroid.x`/`.y` = mean of all 21 landmarks. */
export type ModulationSourceId =
  | `landmark[${number}].x`
  | `landmark[${number}].y`
  | 'pinch'
  | 'centroid.x'
  | 'centroid.y';

/** D14 — one route = one source → one target param, with input/output
 *  ranges and an optional easing curve. `bezierControlPoints` is only
 *  honored when `curve === 'cubicBezier'`. Route `id` is stable across
 *  reorders so `modulationStore` can key React lists against it. */
export type ModulationRoute = {
  id: string;
  enabled: boolean;
  source: ModulationSourceId;
  targetParam: string;
  inputRange: [number, number];
  outputRange: [number, number];
  curve: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'cubicBezier';
  bezierControlPoints?: [number, number, number, number];
};

// ---------------------------------------------------------------------------
// Bezier cache
// ---------------------------------------------------------------------------

const bezierCache = new Map<string, (t: number) => number>();

function cacheKey(cp: readonly [number, number, number, number]): string {
  return `${cp[0]},${cp[1]},${cp[2]},${cp[3]}`;
}

function getBezierFn(cp: readonly [number, number, number, number]): (t: number) => number {
  const key = cacheKey(cp);
  const hit = bezierCache.get(key);
  if (hit) return hit;
  const fn = BezierEasing(cp[0], cp[1], cp[2], cp[3]);
  bezierCache.set(key, fn);
  return fn;
}

// ---------------------------------------------------------------------------
// Curves
// ---------------------------------------------------------------------------

function applyCurve(
  t: number,
  curve: ModulationRoute['curve'],
  cp?: readonly [number, number, number, number],
): number {
  switch (curve) {
    case 'linear':
      return t;
    case 'easeIn':
      return t * t;
    case 'easeOut':
      return 1 - (1 - t) * (1 - t);
    case 'easeInOut':
      return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) * (-2 * t + 2)) / 2;
    case 'cubicBezier':
      if (!cp) return t;
      return getBezierFn(cp)(t);
  }
}

// ---------------------------------------------------------------------------
// Source resolver
// ---------------------------------------------------------------------------

/**
 * Build the per-frame source map from the latest landmark array. `null`
 * input (no hand / model still loading) → empty Map, not a throw — the
 * render loop sees null frames constantly during warmup.
 *
 * Source coverage: every landmark[i].x/.y for i ∈ [0, 20], plus
 * `pinch` = |p4 − p8|, `centroid.x` / `centroid.y` = arithmetic mean of
 * all 21 landmarks. Other aggregated sources can be added later without
 * breaking this contract.
 */
export function resolveModulationSources(
  landmarks: readonly Landmark[] | null,
): Map<ModulationSourceId, number> {
  const sources = new Map<ModulationSourceId, number>();
  if (!landmarks || landmarks.length < 21) return sources;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    if (!lm) continue;
    sources.set(`landmark[${i}].x`, lm.x);
    sources.set(`landmark[${i}].y`, lm.y);
    sumX += lm.x;
    sumY += lm.y;
  }

  const p4 = landmarks[4];
  const p8 = landmarks[8];
  if (p4 && p8) {
    const dx = p4.x - p8.x;
    const dy = p4.y - p8.y;
    sources.set('pinch', Math.sqrt(dx * dx + dy * dy));
  }

  sources.set('centroid.x', sumX / landmarks.length);
  sources.set('centroid.y', sumY / landmarks.length);

  return sources;
}

// ---------------------------------------------------------------------------
// applyModulation
// ---------------------------------------------------------------------------

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * Evaluate every enabled route and produce a new `ParamState` containing
 * any overrides. If no route fires OR every write matches the current value,
 * the input `params` reference is returned unchanged so the caller can do
 * an identity-compare fast-path.
 *
 * Allocation profile:
 *   - zero new objects in the "no route fires" path
 *   - one new top-level object + one new section object per mutated section
 *     in the "at least one write" path (section-level structural sharing)
 */
export function applyModulation(
  routes: readonly ModulationRoute[],
  sources: ReadonlyMap<ModulationSourceId, number>,
  params: ParamState,
): ParamState {
  if (routes.length === 0) return params;

  // Lazily cloned section buckets keyed by section name. `null` entry means
  // "no mutation yet in this section".
  let mutated: Record<string, Record<string, unknown>> | null = null;

  for (const route of routes) {
    if (!route.enabled) continue;
    const raw = sources.get(route.source);
    if (raw === undefined) continue;

    const [inMin, inMax] = route.inputRange;
    const span = inMax - inMin;
    if (span === 0) continue;
    // Clamp t AFTER division so inverted ranges (e.g. [1, 0]) still map.
    const t = clamp01((raw - inMin) / span);
    const shaped = applyCurve(t, route.curve, route.bezierControlPoints);
    const [outMin, outMax] = route.outputRange;
    let outValue = outMin + shaped * (outMax - outMin);

    // Dot-path split — supports 'section.key' only (no nested paths in D14).
    const dotIdx = route.targetParam.indexOf('.');
    if (dotIdx < 0) continue;
    const section = route.targetParam.slice(0, dotIdx);
    const key = route.targetParam.slice(dotIdx + 1);

    const src = (mutated?.[section] ??
      (params as Record<string, Record<string, unknown>>)[section]) as
      | Record<string, unknown>
      | undefined;
    if (!src) continue;
    const current = src[key];
    if (typeof current !== 'number') continue;

    if (Number.isInteger(current)) {
      outValue = Math.round(outValue);
    }

    // Skip writes that would produce the same value — preserves identity.
    // Use a tiny epsilon for float jitter; integers short-circuit via ===.
    if (Number.isInteger(current)) {
      if (current === outValue) continue;
    } else if (Math.abs(current - outValue) < 1e-9) {
      continue;
    }

    if (!mutated) mutated = {};
    if (!mutated[section]) {
      // Clone the section the first time we touch it so `params` stays pure.
      mutated[section] = { ...src };
    }
    mutated[section][key] = outValue;
  }

  if (!mutated) return params;

  // Shallow-merge the mutated sections back onto a fresh top-level.
  const next: Record<string, unknown> = { ...(params as Record<string, unknown>) };
  for (const section of Object.keys(mutated)) {
    next[section] = mutated[section];
  }
  return next as ParamState;
}

// ---------------------------------------------------------------------------
// Default routes (D13)
// ---------------------------------------------------------------------------

/** D13 — two default routes. Index-finger X drives mosaic tile size;
 *  index-finger Y drives grid column count. Both linear, both enabled,
 *  both with `id` = their target-param slug for stable React keys. */
export const DEFAULT_MODULATION_ROUTES: ModulationRoute[] = [
  {
    id: 'mosaic-tileSize',
    enabled: true,
    source: 'landmark[8].x',
    targetParam: 'mosaic.tileSize',
    inputRange: [0, 1],
    outputRange: [4, 64],
    curve: 'linear',
  },
  {
    id: 'grid-columnCount',
    enabled: true,
    source: 'landmark[8].y',
    targetParam: 'grid.columnCount',
    inputRange: [0, 1],
    outputRange: [4, 20],
    curve: 'linear',
  },
];
