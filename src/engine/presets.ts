/**
 * Preset persistence (Task 4.3).
 *
 * Versioned `version: 1` preset schema per D29:
 *   { version, name, effectId: 'handTrackingMosaic', params, modulationRoutes, createdAt }.
 *
 * Backed by `localStorage` under `hand-tracker-fx:presets:v1`; file I/O is
 * a single-preset JSON blob (not a preset array). `isValidPreset` is a
 * manual type guard — no zod, no ajv, no io-ts (D29).
 *
 * Ownership:
 *   - `savePreset(name)` snapshots `paramStore.snapshot` + `modulationStore
 *     .getSnapshot().routes` via `structuredClone`.
 *   - `loadPreset(name)` writes via `paramStore.replace(params)` +
 *     `modulationStore.replaceRoutes(routes)`. Callers (the UI) are
 *     responsible for `pane.refresh()` afterwards — this module stays
 *     UI-free.
 *   - `importPresetFile(file, opts)` validates, writes, and — when
 *     `opts.loadImmediately` is true — also calls `loadPreset`.
 *
 * Forward-compat: any payload whose `version` is not `1` is REJECTED, not
 * upgraded. Schema migration lands in a future phase if ever needed.
 */

import type { ModulationRoute } from './modulation';
import { DEFAULT_MODULATION_ROUTES } from './modulation';
import { modulationStore } from './modulationStore';
import type { ParamState } from './paramStore';
import { paramStore } from './paramStore';

const STORAGE_KEY = 'hand-tracker-fx:presets:v1';
const EFFECT_ID = 'handTrackingMosaic';

export type Preset = {
  version: 1;
  name: string;
  effectId: 'handTrackingMosaic';
  params: ParamState;
  modulationRoutes: ModulationRoute[];
  /** ISO-8601 UTC timestamp; purely informational. */
  createdAt: string;
};

/**
 * Manual runtime guard per D29. Rejects on the first bad field so the
 * caller gets a definite "yes / no" answer without partial-shape
 * surprises. Callers that need to explain WHY a payload is invalid can
 * compose their own narrower checks; this guard is the gate.
 */
export function isValidPreset(p: unknown): p is Preset {
  if (typeof p !== 'object' || p === null) return false;
  const o = p as Record<string, unknown>;
  if (o.version !== 1) return false;
  if (typeof o.name !== 'string') return false;
  if (o.effectId !== EFFECT_ID) return false;
  if (typeof o.params !== 'object' || o.params === null) return false;
  if (Array.isArray(o.params)) return false;
  if (!Array.isArray(o.modulationRoutes)) return false;
  if (typeof o.createdAt !== 'string') return false;
  return true;
}

// ---------------------------------------------------------------------------
// Storage I/O — safe against missing, malformed, or quota-exceeded writes.
// ---------------------------------------------------------------------------

function readStorage(): Preset[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidPreset);
  } catch {
    console.warn(`[presets] Malformed JSON at ${STORAGE_KEY} — ignoring and starting empty`);
    return [];
  }
}

function writeStorage(presets: readonly Preset[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch (err) {
    // Safari private mode / quota exceeded. Surface the failure in the
    // console so developers notice in DevTools, but don't throw — the
    // live in-memory list remains functional until reload.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[presets] localStorage write failed: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function listPresets(): Preset[] {
  return readStorage();
}

export function getPreset(name: string): Preset | undefined {
  return readStorage().find((p) => p.name === name);
}

/**
 * Snapshot the current param + modulation state as a new Preset, replacing
 * any existing preset with the same name (save-as-overwrite semantics
 * common in TouchDesigner / creative tooling). Returns the freshly-built
 * preset so the caller can surface it in the UI immediately.
 */
export function savePreset(name: string): Preset {
  const preset: Preset = {
    version: 1,
    name,
    effectId: EFFECT_ID,
    params: structuredClone(paramStore.snapshot),
    modulationRoutes: structuredClone(modulationStore.getSnapshot().routes as ModulationRoute[]),
    createdAt: new Date().toISOString(),
  };
  const current = readStorage();
  const idx = current.findIndex((p) => p.name === name);
  const next = idx >= 0 ? current.slice() : [...current, preset];
  if (idx >= 0) next[idx] = preset;
  writeStorage(next);
  return preset;
}

/**
 * Restore a preset into both stores. Returns `false` when no preset
 * matches the name so UI callers can short-circuit their `pane.refresh()`
 * when the name is stale.
 */
export function loadPreset(name: string): boolean {
  const preset = getPreset(name);
  if (!preset) return false;
  paramStore.replace(structuredClone(preset.params));
  modulationStore.replaceRoutes(structuredClone(preset.modulationRoutes));
  return true;
}

export function deletePreset(name: string): void {
  const current = readStorage();
  const idx = current.findIndex((p) => p.name === name);
  if (idx < 0) return;
  const next = current.slice();
  next.splice(idx, 1);
  writeStorage(next);
}

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '_');
}

/**
 * Trigger a browser download for the named preset as a single-object
 * JSON file. No-ops (with a `console.warn`) when the name is unknown —
 * this path runs from a button click, and failing loudly would be worse
 * UX than a quiet warn. Creates + clicks + revokes an anchor; no DOM
 * residue left behind.
 */
export function exportPresetFile(name: string): void {
  const preset = getPreset(name);
  if (!preset) {
    console.warn(`[presets] exportPresetFile: preset "${name}" not found — skipping`);
    return;
  }
  const json = JSON.stringify(preset, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(name)}.hand-tracker-fx.json`;
  // Chromium requires the anchor be in the DOM for programmatic .click()
  // to trigger a download in some contexts; append + remove in one
  // microtask so the filesystem picker fires but the tree stays clean.
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the browser has already begun streaming
  // the blob before the URL becomes invalid.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Parse + validate + persist an imported preset file. Throws on any of
 * three failures:
 *   - not valid JSON
 *   - schema validation failed (isValidPreset === false)
 *   - (indirectly) localStorage write errors surface via the storage
 *     wrapper's console.warn — this function itself doesn't throw on
 *     write failure because the parsed preset is still returned.
 *
 * With `opts.loadImmediately === true`, calls `loadPreset(name)` after
 * write so the UI reflects the import instantly (caller still owns
 * `pane.refresh()`).
 */
export async function importPresetFile(
  file: File,
  opts?: { loadImmediately?: boolean },
): Promise<Preset> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Preset import failed: not valid JSON');
  }
  if (!isValidPreset(parsed)) {
    throw new Error('Preset import failed: failed validation (wrong version, shape, or effectId)');
  }
  const preset = parsed;
  const current = readStorage();
  const idx = current.findIndex((p) => p.name === preset.name);
  const next = idx >= 0 ? current.slice() : [...current, preset];
  if (idx >= 0) next[idx] = preset;
  writeStorage(next);
  if (opts?.loadImmediately) {
    loadPreset(preset.name);
  }
  return preset;
}

// ---------------------------------------------------------------------------
// Default preset + initial seeding
// ---------------------------------------------------------------------------

/**
 * Ships with the app — seeded on first launch so the Presets panel isn't
 * empty. Uses a stable ISO timestamp so snapshot tests don't drift on the
 * build clock. `params` is intentionally cloned from the paramStore
 * default (loaded by Task 2.5's manifest registration).
 */
export const DEFAULT_PRESET: Preset = {
  version: 1,
  name: 'Default',
  effectId: EFFECT_ID,
  params: {},
  modulationRoutes: structuredClone(DEFAULT_MODULATION_ROUTES),
  createdAt: '2026-04-14T00:00:00.000Z',
};

/**
 * Run at app bootstrap (main.tsx). If no presets exist, write
 * DEFAULT_PRESET into storage AND snapshot the live paramStore into its
 * `params` field — so the user's first save-as-overwrite of "Default"
 * starts from whatever the manifest seeded, not from an empty object.
 *
 * Caller invokes this AFTER the effect manifest has run its side-effect
 * registration (which seeds paramStore from DEFAULT_PARAM_STATE).
 */
export function initializePresetsIfEmpty(): void {
  const current = readStorage();
  if (current.length > 0) return;
  const seeded: Preset = {
    ...DEFAULT_PRESET,
    params: structuredClone(paramStore.snapshot),
    modulationRoutes: structuredClone(DEFAULT_MODULATION_ROUTES),
  };
  writeStorage([seeded]);
}
