/**
 * Dev/test-only window.__handTracker hook — FPS + landmark-count fields added
 * by Task 1.5. Merged onto any existing `__handTracker` shape (Task 1.4 adds
 * `isReady` / `isUsingGpu`). Task 2.1 adds `__engine.listEffects`. Task 2.2
 * adds `__engine.getParam` and `__engine.setParam` so E2E can read/write the
 * paramStore through the browser hook without importing engine internals.
 * Task 2.5 adds `__engine.getLandmarkBlobCount` and `__engine.lastGridLayout`.
 * Gated by `import.meta.env.DEV` or `import.meta.env.MODE === 'test'` so the
 * block tree-shakes in production.
 */

import { __getLastBlobCount, __getLastGridLayout } from '../effects/handTrackingMosaic/manifest';
import { paramStore } from './paramStore';
import { listEffects } from './registry';

const FPS_SAMPLE_MS = 3000;
const samples: number[] = [];
let lastLandmarkCount = 0;

/** Record a frame timestamp and prune anything older than `FPS_SAMPLE_MS`. */
export function updateFpsSample(nowMs: number): void {
  samples.push(nowMs);
  const cutoff = nowMs - FPS_SAMPLE_MS;
  while (samples.length > 0) {
    const head = samples[0];
    if (head === undefined || head >= cutoff) break;
    samples.shift();
  }
}

/** Record the landmark count observed for the current frame. */
export function updateLandmarkCount(n: number): void {
  lastLandmarkCount = n;
}

/** Rolling average FPS over the last ~3s window. Returns 0 when insufficient samples. */
export function getFPS(): number {
  if (samples.length < 2) return 0;
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (first === undefined || last === undefined) return 0;
  const dt = last - first;
  if (dt <= 0) return 0;
  return ((samples.length - 1) / dt) * 1000;
}

/** Last observed landmark count. */
export function getLandmarkCount(): number {
  return lastLandmarkCount;
}

/** Test-only reset (not part of the public dev-hook contract). */
export function __resetDevHookState(): void {
  samples.length = 0;
  lastLandmarkCount = 0;
}

const SHOULD_EXPOSE =
  import.meta.env.DEV ||
  import.meta.env.MODE === 'test' ||
  import.meta.env.VITE_EXPOSE_DEV_HOOK === '1';

/**
 * Read a dot-pathed param value from the paramStore snapshot
 * (e.g. `getParam('grid.columnCount')`). Returns `undefined` for
 * missing sections/keys so callers can probe without throwing.
 */
function getParam(dotPath: string): unknown {
  const idx = dotPath.indexOf('.');
  if (idx < 0) return undefined;
  const section = dotPath.slice(0, idx);
  const leaf = dotPath.slice(idx + 1);
  const snap = paramStore.snapshot as Record<string, Record<string, unknown> | undefined>;
  const sectionObj = snap[section];
  if (!sectionObj) return undefined;
  return sectionObj[leaf];
}

/**
 * Write a dot-pathed param value through the paramStore (mirrors
 * `paramStore.set`). Exposed on the dev hook so Playwright fake-webcam E2E
 * can drive parameters without reaching into engine internals.
 */
function setParam(dotPath: string, value: unknown): void {
  paramStore.set(dotPath, value);
}

if (SHOULD_EXPOSE && typeof window !== 'undefined') {
  const w = window as unknown as { __handTracker?: Record<string, unknown> };
  const existing = (w.__handTracker ?? {}) as Record<string, unknown>;
  const existingEngine = (existing.__engine ?? {}) as Record<string, unknown>;
  w.__handTracker = {
    ...existing,
    getFPS,
    getLandmarkCount,
    __engine: {
      ...existingEngine,
      listEffects,
      getParam,
      setParam,
      getLandmarkBlobCount: __getLastBlobCount,
      lastGridLayout: __getLastGridLayout,
    },
  };
}
