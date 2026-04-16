/**
 * Dev/test-only window.__handTracker hook — FPS + landmark-count fields added
 * by Task 1.5. Merged onto any existing `__handTracker` shape (Task 1.4 adds
 * `isReady` / `isUsingGpu`). Task 2.1 adds `__engine.listEffects`. Task 2.2
 * adds `__engine.getParam` and `__engine.setParam` so E2E can read/write the
 * paramStore through the browser hook without importing engine internals.
 * Task 2.5 adds `__engine.getLandmarkBlobCount` and `__engine.lastGridLayout`.
 * Task 2.R hotfix adds `__engine.setFakeLandmarks` wired through
 * `landmarkOverride.ts` — the render loop consults this each frame so E2E can
 * force a specific landmark payload for deterministic blob/region tests.
 * Task 3.1 adds `__engine.getVideoTextureHandle` — returns the raw
 * `WebGLTexture` created by Stage's ogl renderer, or `null` pre-mount.
 * Task 3.2 adds `__engine.testCompileShaders` — compiles the mosaic
 * VERTEX/FRAGMENT strings in a throwaway WebGL2 context and returns a
 * `{ vertex, fragment, log }` report so Playwright E2E can gate the real
 * driver's acceptance of the shader source.
 * Task 3.3 adds `__engine.computeActiveRegions` — invokes the hand-polygon
 * region derivation with a caller-supplied grid + padding and the currently
 * injected/detected landmarks, so Playwright E2E can assert deterministic
 * UV rects without reaching into the render loop's private timing.
 * Gated by `import.meta.env.DEV` or `import.meta.env.MODE === 'test'` so the
 * block tree-shakes in production.
 */

import {
  __getLastBlobCount,
  __getLastGridLayout,
  __getLastRegionCount,
} from '../effects/handTrackingMosaic/manifest';
import {
  computeActiveRegions as computeActiveRegionsImpl,
  type Rect,
} from '../effects/handTrackingMosaic/region';
import { FRAGMENT_SHADER, VERTEX_SHADER } from '../effects/handTrackingMosaic/shader';
import { getLandmarkOverride, setLandmarkOverride } from './landmarkOverride';
import { paramStore } from './paramStore';
import { listEffects } from './registry';
import { getVideoTextureHandle } from './videoTextureRef';

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

/**
 * Compile the mosaic VERTEX + FRAGMENT strings in a throwaway WebGL2 context
 * and return per-shader COMPILE_STATUS + the driver info log. Used by the
 * Task 3.2 L4 spec to gate that the real Chromium driver accepts the source
 * before Task 3.4 links a Program against them. Returns
 * `{ vertex: false, fragment: false, log: '<reason>' }` if the browser can't
 * provide WebGL2 at all.
 */
function testCompileShaders(): { vertex: boolean; fragment: boolean; log: string } {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
  if (!gl) return { vertex: false, fragment: false, log: 'webgl2 unavailable' };

  const report = { vertex: false, fragment: false, log: '' };
  const sources: Array<[number, string, 'vertex' | 'fragment']> = [
    [gl.VERTEX_SHADER, VERTEX_SHADER, 'vertex'],
    [gl.FRAGMENT_SHADER, FRAGMENT_SHADER, 'fragment'],
  ];
  for (const [type, src, field] of sources) {
    const shader = gl.createShader(type);
    if (!shader) {
      report.log += `[${field}] createShader returned null; `;
      continue;
    }
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS) === true;
    report[field] = ok;
    if (!ok) {
      const info = gl.getShaderInfoLog(shader) ?? '(no info log)';
      report.log += `[${field}] ${info.trim()}; `;
    }
    gl.deleteShader(shader);
  }
  // Release the throwaway context so we don't leak a GL slot.
  const lose = gl.getExtension('WEBGL_lose_context');
  lose?.loseContext();
  return report;
}

/**
 * Compute the current frame's active mosaic regions using the injected /
 * detected landmarks (whichever the render loop would have seen this tick).
 * The caller passes grid geometry + padding so the test can exercise a
 * variety of fixtures without depending on the live paramStore.
 *
 * Returns `[]` when landmarks are null/short-form — matching the region
 * module's own graceful-degradation contract. Callers should NOT rely on
 * the array being mutable beyond the current call; each invocation
 * allocates a fresh `Rect[]`.
 */
function computeActiveRegionsHook(opts: {
  videoW: number;
  videoH: number;
  columnEdges: readonly number[];
  rowEdges: readonly number[];
  regionPadding: number;
}): Rect[] {
  return computeActiveRegionsImpl(
    getLandmarkOverride(),
    opts.videoW,
    opts.videoH,
    opts.columnEdges,
    opts.rowEdges,
    opts.regionPadding,
  );
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
      getLastRegionCount: __getLastRegionCount,
      setFakeLandmarks: setLandmarkOverride,
      getVideoTextureHandle,
      testCompileShaders,
      computeActiveRegions: computeActiveRegionsHook,
    },
  };
}
