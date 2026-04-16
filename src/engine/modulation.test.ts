/**
 * Unit tests for the modulation evaluator (Task 4.1).
 *
 * Strategy:
 *   - `bezier-easing` is mocked so cache-hit assertions can spy on the
 *     default export and not care about the real curve shape.
 *   - The pure-function surface (resolveModulationSources, applyModulation,
 *     DEFAULT_MODULATION_ROUTES) is exercised directly — no DOM, no async.
 *   - Every test is independent; the bezier cache intentionally persists
 *     across cases (module-scoped), so the "cache hit" assertion uses an
 *     isolated unique control-point tuple.
 */

// `vi.mock` is hoisted above imports; the mock factory needs access to a
// spy that outlives `applyModulation` calls. `vi.hoisted` guarantees the
// spy is initialised before `vi.mock` runs, working around the temporal
// dead zone that a plain `const bezierFactory = vi.fn(...)` would hit.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParamState } from './paramStore';

const { bezierFactory } = vi.hoisted(() => ({
  bezierFactory: vi.fn((_x1: number, _y1: number, _x2: number, _y2: number) => {
    return (t: number) => t; // identity curve — shape-sensitive tests use
    // the built-in `linear` / `easeIn` / `easeOut` / `easeInOut` paths.
  }),
}));

vi.mock('bezier-easing', () => ({
  __esModule: true,
  default: bezierFactory,
}));

// Import AFTER the mock.
import {
  applyModulation,
  DEFAULT_MODULATION_ROUTES,
  type Landmark,
  type ModulationRoute,
  type ModulationSourceId,
  resolveModulationSources,
} from './modulation';

function makeLandmarks(overrides: Partial<Record<number, Partial<Landmark>>> = {}): Landmark[] {
  const base: Landmark = { x: 0.5, y: 0.5, z: 0 };
  return Array.from({ length: 21 }, (_, i) => ({ ...base, ...(overrides[i] ?? {}) }));
}

const emptyParams: ParamState = {};

/** Test params seeded with a clearly-non-integer `blendOpacity` so the
 *  `Number.isInteger(current)` rounding branch doesn't accidentally treat
 *  a default of `1.0` as an integer-typed param. Spec-mandated detection
 *  per Task 4.1's Known Gotcha: "Detect with `Number.isInteger(currentValue)`
 *  against the CURRENT value." Production code sources integer-typed params
 *  from the manifest, which declares `mosaic.tileSize` / `grid.columnCount`
 *  as integers; this fixture stays agnostic. */
const paramsWithDefaults = (): ParamState => ({
  grid: { columnCount: 12, rowCount: 8, seed: 42, widthVariance: 0.6 },
  mosaic: { tileSize: 16, blendOpacity: 0.5, edgeFeather: 0 },
});

describe('DEFAULT_MODULATION_ROUTES', () => {
  it('defines exactly two routes matching D13', () => {
    expect(DEFAULT_MODULATION_ROUTES).toHaveLength(2);
    const [tile, cols] = DEFAULT_MODULATION_ROUTES;
    expect(tile?.source).toBe('landmark[8].x');
    expect(tile?.targetParam).toBe('mosaic.tileSize');
    expect(tile?.outputRange).toEqual([4, 64]);
    expect(cols?.source).toBe('landmark[8].y');
    expect(cols?.targetParam).toBe('grid.columnCount');
    expect(cols?.outputRange).toEqual([4, 20]);
  });

  it('both default routes are enabled + linear by default', () => {
    for (const r of DEFAULT_MODULATION_ROUTES) {
      expect(r.enabled).toBe(true);
      expect(r.curve).toBe('linear');
    }
  });
});

describe('resolveModulationSources', () => {
  it('returns an empty Map for null landmarks', () => {
    expect(resolveModulationSources(null).size).toBe(0);
  });

  it('returns an empty Map for fewer than 21 landmarks', () => {
    const partial = Array.from({ length: 5 }, () => ({ x: 0, y: 0, z: 0 }));
    expect(resolveModulationSources(partial).size).toBe(0);
  });

  it('exposes landmark[0..20].x|y + pinch + centroid', () => {
    const lms = makeLandmarks({
      4: { x: 0.2, y: 0.3 },
      8: { x: 0.5, y: 0.7 },
    });
    const sources = resolveModulationSources(lms);
    expect(sources.get('landmark[4].x')).toBe(0.2);
    expect(sources.get('landmark[4].y')).toBe(0.3);
    expect(sources.get('landmark[8].x')).toBe(0.5);
    expect(sources.get('landmark[8].y')).toBe(0.7);
    expect(sources.get('landmark[20].x')).toBe(0.5);
    expect(sources.has('pinch')).toBe(true);
    expect(sources.has('centroid.x')).toBe(true);
    expect(sources.has('centroid.y')).toBe(true);
  });

  it('pinch equals |p4 − p8| euclidean distance', () => {
    const lms = makeLandmarks({
      4: { x: 0.1, y: 0.2 },
      8: { x: 0.4, y: 0.6 },
    });
    const sources = resolveModulationSources(lms);
    // sqrt(0.3^2 + 0.4^2) = 0.5
    expect(sources.get('pinch')).toBeCloseTo(0.5, 5);
  });

  it('centroid is the arithmetic mean of all 21 landmark coords', () => {
    const lms = makeLandmarks({ 0: { x: 0, y: 0 }, 1: { x: 1, y: 1 } });
    const sources = resolveModulationSources(lms);
    // 19 filler landmarks at 0.5 + 0 + 1 = 20; /21 = 0.9523...
    const expected = (0 + 1 + 0.5 * 19) / 21;
    expect(sources.get('centroid.x')).toBeCloseTo(expected, 5);
    expect(sources.get('centroid.y')).toBeCloseTo(expected, 5);
  });
});

describe('applyModulation', () => {
  beforeEach(() => {
    bezierFactory.mockClear();
  });

  it('returns the SAME reference with empty routes', () => {
    const params = paramsWithDefaults();
    const sources = new Map<ModulationSourceId, number>();
    expect(applyModulation([], sources, params)).toBe(params);
  });

  it('returns the SAME reference when every route is disabled', () => {
    const params = paramsWithDefaults();
    const sources = new Map<ModulationSourceId, number>([['landmark[8].x', 0.5]]);
    const disabled = DEFAULT_MODULATION_ROUTES.map((r) => ({ ...r, enabled: false }));
    expect(applyModulation(disabled, sources, params)).toBe(params);
  });

  it('returns the SAME reference when no source resolves', () => {
    const params = paramsWithDefaults();
    const sources = new Map<ModulationSourceId, number>();
    expect(applyModulation(DEFAULT_MODULATION_ROUTES, sources, params)).toBe(params);
  });

  it('landmark[8].x=0.5 with default routes → mosaic.tileSize = 34', () => {
    const params = paramsWithDefaults();
    const sources = new Map<ModulationSourceId, number>([['landmark[8].x', 0.5]]);
    const next = applyModulation(DEFAULT_MODULATION_ROUTES, sources, params);
    // 4 + 0.5 * (64 - 4) = 34 (integer round-to-34)
    expect((next.mosaic as { tileSize: number }).tileSize).toBe(34);
    // Identity preserved on untouched sections.
    expect(next.grid).toBe(params.grid);
  });

  it('landmark[8].y=0.5 with default routes → grid.columnCount = 12 (integer)', () => {
    const params = paramsWithDefaults();
    const sources = new Map<ModulationSourceId, number>([['landmark[8].y', 0.5]]);
    const next = applyModulation(DEFAULT_MODULATION_ROUTES, sources, params);
    // 4 + 0.5 * (20 - 4) = 12, integer
    expect((next.grid as { columnCount: number }).columnCount).toBe(12);
  });

  it('landmark[8].x=0.0 → tileSize clamped at lower bound 4', () => {
    const params = paramsWithDefaults();
    const sources = new Map<ModulationSourceId, number>([['landmark[8].x', 0.0]]);
    const next = applyModulation(DEFAULT_MODULATION_ROUTES, sources, params);
    expect((next.mosaic as { tileSize: number }).tileSize).toBe(4);
  });

  it('landmark[8].x=1.0 → tileSize clamped at upper bound 64', () => {
    const params = paramsWithDefaults();
    const sources = new Map<ModulationSourceId, number>([['landmark[8].x', 1.0]]);
    const next = applyModulation(DEFAULT_MODULATION_ROUTES, sources, params);
    expect((next.mosaic as { tileSize: number }).tileSize).toBe(64);
  });

  it('raw value below inputRange clamps to outMin', () => {
    const params = paramsWithDefaults();
    const sources = new Map<ModulationSourceId, number>([['landmark[8].x', -0.5]]);
    const next = applyModulation(DEFAULT_MODULATION_ROUTES, sources, params);
    expect((next.mosaic as { tileSize: number }).tileSize).toBe(4);
  });

  it('raw value above inputRange clamps to outMax', () => {
    const params = paramsWithDefaults();
    const sources = new Map<ModulationSourceId, number>([['landmark[8].x', 1.5]]);
    const next = applyModulation(DEFAULT_MODULATION_ROUTES, sources, params);
    expect((next.mosaic as { tileSize: number }).tileSize).toBe(64);
  });

  it('easeIn curve at t=0.5 produces 0.25 shaped value', () => {
    const route: ModulationRoute = {
      id: 'easein-test',
      enabled: true,
      source: 'landmark[0].x',
      targetParam: 'mosaic.blendOpacity',
      inputRange: [0, 1],
      outputRange: [0, 1],
      curve: 'easeIn',
    };
    const params = paramsWithDefaults();
    const sources = new Map<ModulationSourceId, number>([['landmark[0].x', 0.5]]);
    const next = applyModulation([route], sources, params);
    // blendOpacity is a float 1.0; eased 0.5 → 0.25
    expect((next.mosaic as { blendOpacity: number }).blendOpacity).toBeCloseTo(0.25, 5);
  });

  it('cubicBezier cache: same control points hit the cache (BezierEasing called once)', () => {
    // Unique cp so prior test runs can't seed the cache.
    const cp: [number, number, number, number] = [0.11, 0.22, 0.33, 0.88];
    const route: ModulationRoute = {
      id: 'bezier-cache-test',
      enabled: true,
      source: 'landmark[0].x',
      targetParam: 'mosaic.blendOpacity',
      inputRange: [0, 1],
      outputRange: [0, 1],
      curve: 'cubicBezier',
      bezierControlPoints: cp,
    };
    const params = paramsWithDefaults();
    const sources = new Map<ModulationSourceId, number>([['landmark[0].x', 0.5]]);
    applyModulation([route], sources, params);
    applyModulation([route], sources, params);
    applyModulation([route], sources, params);
    expect(bezierFactory).toHaveBeenCalledTimes(1);
    expect(bezierFactory).toHaveBeenCalledWith(cp[0], cp[1], cp[2], cp[3]);
  });

  it('identity return when the evaluated value equals the current param', () => {
    // mosaic.blendOpacity = 0.5 currently; a route that maps to exactly 0.5
    // must NOT produce a new params object.
    const route: ModulationRoute = {
      id: 'noop',
      enabled: true,
      source: 'landmark[0].x',
      targetParam: 'mosaic.blendOpacity',
      inputRange: [0, 1],
      outputRange: [0.5, 0.5],
      curve: 'linear',
    };
    const params = paramsWithDefaults();
    const sources = new Map<ModulationSourceId, number>([['landmark[0].x', 0.5]]);
    expect(applyModulation([route], sources, params)).toBe(params);
  });

  it('ignores routes targeting non-number params (e.g. strings / booleans)', () => {
    const params: ParamState = {
      input: { mirrorMode: true, deviceId: '' },
    };
    const route: ModulationRoute = {
      id: 'bad-target',
      enabled: true,
      source: 'landmark[0].x',
      targetParam: 'input.mirrorMode',
      inputRange: [0, 1],
      outputRange: [0, 1],
      curve: 'linear',
    };
    const sources = new Map<ModulationSourceId, number>([['landmark[0].x', 0.5]]);
    expect(applyModulation([route], sources, params)).toBe(params);
  });

  it('silently skips routes with malformed targetParam (no dot)', () => {
    const params = paramsWithDefaults();
    const route: ModulationRoute = {
      id: 'bad-path',
      enabled: true,
      source: 'landmark[0].x',
      targetParam: 'noDotHere',
      inputRange: [0, 1],
      outputRange: [0, 1],
      curve: 'linear',
    };
    const sources = new Map<ModulationSourceId, number>([['landmark[0].x', 0.5]]);
    expect(applyModulation([route], sources, params)).toBe(params);
  });

  it('ignores routes whose section does not exist on params', () => {
    const params = paramsWithDefaults();
    const route: ModulationRoute = {
      id: 'missing-section',
      enabled: true,
      source: 'landmark[0].x',
      targetParam: 'nonexistent.field',
      inputRange: [0, 1],
      outputRange: [0, 1],
      curve: 'linear',
    };
    const sources = new Map<ModulationSourceId, number>([['landmark[0].x', 0.5]]);
    expect(applyModulation([route], sources, params)).toBe(params);
  });

  it('inverted inputRange still maps linearly (clamp AFTER division)', () => {
    // [1, 0] means 1 → t=0, 0 → t=1.
    const route: ModulationRoute = {
      id: 'inverted',
      enabled: true,
      source: 'landmark[0].x',
      targetParam: 'mosaic.blendOpacity',
      inputRange: [1, 0],
      outputRange: [0, 1],
      curve: 'linear',
    };
    const params = paramsWithDefaults();
    const sourcesAtZero = new Map<ModulationSourceId, number>([['landmark[0].x', 0]]);
    const nextZero = applyModulation([route], sourcesAtZero, params);
    expect((nextZero.mosaic as { blendOpacity: number }).blendOpacity).toBeCloseTo(1, 5);

    const sourcesAtOne = new Map<ModulationSourceId, number>([['landmark[0].x', 1]]);
    const nextOne = applyModulation([route], sourcesAtOne, params);
    // [1, 0] → at raw=1, t=(1-1)/(0-1) = 0 → outValue = 0.
    expect((nextOne.mosaic as { blendOpacity: number }).blendOpacity).toBeCloseTo(0, 5);
  });

  it('multiple routes on different sections produce one new top-level + one new section each', () => {
    // Both defaults fire: one writes mosaic, one writes grid.
    const params = paramsWithDefaults();
    const sources = new Map<ModulationSourceId, number>([
      ['landmark[8].x', 0.5],
      ['landmark[8].y', 1.0],
    ]);
    const next = applyModulation(DEFAULT_MODULATION_ROUTES, sources, params);
    expect(next).not.toBe(params);
    expect(next.mosaic).not.toBe(params.mosaic);
    expect(next.grid).not.toBe(params.grid);
    expect((next.mosaic as { tileSize: number }).tileSize).toBe(34);
    expect((next.grid as { columnCount: number }).columnCount).toBe(20);
    // Untouched top-level keys on `params` are carried forward.
    expect(next).toMatchObject({ mosaic: { blendOpacity: 0.5 } });
  });
});

describe('applyModulation with empty params', () => {
  it('returns the SAME empty-params reference when every route targets a missing section', () => {
    const sources = new Map<ModulationSourceId, number>([['landmark[8].x', 0.5]]);
    expect(applyModulation(DEFAULT_MODULATION_ROUTES, sources, emptyParams)).toBe(emptyParams);
  });
});
