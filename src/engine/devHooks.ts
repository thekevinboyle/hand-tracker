/**
 * Dev/test-only window.__handTracker hook — FPS + landmark-count fields added
 * by Task 1.5. Merged onto any existing `__handTracker` shape (Task 1.4 adds
 * `isReady` / `isUsingGpu`). Gated by `import.meta.env.DEV` or
 * `import.meta.env.MODE === 'test'` so the block tree-shakes in production.
 */

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

if (SHOULD_EXPOSE && typeof window !== 'undefined') {
  const w = window as unknown as { __handTracker?: Record<string, unknown> };
  const existing = (w.__handTracker ?? {}) as Record<string, unknown>;
  w.__handTracker = {
    ...existing,
    getFPS,
    getLandmarkCount,
  };
}
