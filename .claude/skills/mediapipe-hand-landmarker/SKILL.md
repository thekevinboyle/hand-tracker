---
name: mediapipe-hand-landmarker
description: Use when implementing or modifying hand landmark detection in Hand Tracker FX. MediaPipe tasks-vision HandLandmarker v0.10.34, self-hosted wasm/model, main-thread rVFC loop, GPU delegate with WebGL fallback, StrictMode-safe singleton pattern.
---

# MediaPipe HandLandmarker — Hand Tracker FX

Authoritative reference for any agent implementing or modifying hand tracking in this project. If this document contradicts `DISCOVERY.md`, DISCOVERY wins — re-read it. Relevant decisions: **D5** (fingertip indices 0,4,8,12,16,20), **D7** (coord label format), **D8** (numHands=1), **D13** (landmark-driven modulation), **D17** (main-thread + GPU delegate), **D23** (permission/error state machine including `NO_WEBGL`, `MODEL_LOAD_FAIL`), **D33** (self-host model), **D44** (self-host wasm).

---

## What this is and when to use it

`@mediapipe/tasks-vision` v0.10.34 — Google's browser-side hand landmark inference. Apache 2.0, WASM + WebGL GPU delegate, 21 landmarks per hand, 30–60 FPS on MacBook-class hardware.

Use this skill when:
- Wiring up the detection loop in `src/tracking/`
- Changing init options (numHands, confidences, delegate)
- Debugging `NO_WEBGL` / `MODEL_LOAD_FAIL` states
- Fixing StrictMode re-init / memory / context-loss bugs
- Writing Vitest unit tests that exercise the tracker

Do NOT use for:
- Alternative trackers (TF.js handpose, Handsfree.js) — rejected per research
- Web Worker inference — deferred post-MVP; incompatible with ESM workers (`importScripts`)

---

## Self-hosted assets (D33, D44)

All assets served from the app origin — no runtime CDN calls.

```
public/
  models/
    hand_landmarker.task          # 7.82 MB float16 TFLite bundle
  wasm/
    vision_wasm_internal.js           # SIMD
    vision_wasm_internal.wasm         # SIMD (~10.98 MB)
    vision_wasm_module_internal.js    # SIMD ES-module variant
    vision_wasm_module_internal.wasm  # SIMD ES-module variant (~10.98 MB)
    vision_wasm_nosimd_internal.js    # no-SIMD fallback
    vision_wasm_nosimd_internal.wasm  # no-SIMD fallback (~10.21 MB)
```

**Exactly 6 wasm files** — there is no `vision_wasm_nosimd_module_internal.*` pair. The library picks SIMD vs no-SIMD at runtime via `WebAssembly.validate`. Keep all 6 present even though modern desktops will only hit the SIMD pair.

Pin to `@0.10.34` in download commands — never `@latest`. The model file is served from `storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task`. Both sets live in `public/` (NOT `src/`) so Vite serves them verbatim and does not bundle-transform them.

`FilesetResolver.forVisionTasks('/wasm')` — leading slash, no trailing slash, no relative `./wasm`. Never import the wasm files in TS source.

---

## Initialization (module-level singleton)

Location: `src/tracking/handLandmarker.ts`. A module-level singleton is required to survive **React StrictMode double-mount** — two mounts of the same component must not trigger two 22 MB wasm loads.

```typescript
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

let _instance: HandLandmarker | null = null;
let _initPromise: Promise<HandLandmarker> | null = null;
let _usingGpu = false;

export class WebGLUnavailableError extends Error {
  override name = 'WebGLUnavailableError';
}
export class ModelLoadError extends Error {
  override name = 'ModelLoadError';
}

export async function getHandLandmarker(): Promise<HandLandmarker> {
  if (_instance) return _instance;
  if (_initPromise) return _initPromise;
  _initPromise = _create();
  try {
    return await _initPromise;
  } finally {
    _initPromise = null;
  }
}

async function _create(): Promise<HandLandmarker> {
  const vision = await FilesetResolver.forVisionTasks('/wasm'); // D44

  // Attempt GPU first (D17)
  try {
    const lm = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: '/models/hand_landmarker.task', // D33
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 1,                      // D8
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    _usingGpu = true;
    _instance = lm;
    console.info('[HandLandmarker] initialized with GPU delegate');
    return lm;
  } catch (gpuErr) {
    const msg = gpuErr instanceof Error ? gpuErr.message : String(gpuErr);
    if (isWebGLFailure(msg)) {
      throw new WebGLUnavailableError(msg);
    }
    console.warn('[HandLandmarker] GPU failed, falling back to CPU:', msg);
  }

  // CPU fallback
  try {
    const lm = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: '/models/hand_landmarker.task',
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    _usingGpu = false;
    _instance = lm;
    console.info('[HandLandmarker] initialized with CPU delegate');
    return lm;
  } catch (cpuErr) {
    const msg = cpuErr instanceof Error ? cpuErr.message : String(cpuErr);
    throw new ModelLoadError(msg);
  }
}

export function isUsingGpu(): boolean {
  return _usingGpu;
}
```

Key option values (do not change without a discovery decision):

| Option | Value | Rationale |
|---|---|---|
| `delegate` | `'GPU'` with CPU fallback | D17 |
| `runningMode` | `'VIDEO'` | webcam loop |
| `numHands` | `1` | D8 |
| `minHandDetectionConfidence` | `0.5` | defaults; tunable via UI later |
| `minHandPresenceConfidence` | `0.5` | default |
| `minTrackingConfidence` | `0.5` | default (raise to 0.7 if jitter) |
| `modelAssetPath` | `'/models/hand_landmarker.task'` | D33 |

---

## Per-frame loop: requestVideoFrameCallback

D18 mandates `requestVideoFrameCallback` (rVFC), not `requestAnimationFrame`. rVFC fires at the video's frame rate synced to compositor present; rAF fires at display Hz and double-invokes on duplicate video frames.

```typescript
import type { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';

let _rvfcId: number | undefined;

export function startRenderLoop(
  video: HTMLVideoElement,
  landmarker: HandLandmarker,
  onFrame: (result: HandLandmarkerResult, nowMs: number) => void,
): void {
  const loop = (nowMs: DOMHighResTimeStamp, _meta: VideoFrameMetadata) => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      // nowMs is performance.now()-epoch; monotonic; ms units.
      const result = landmarker.detectForVideo(video, nowMs);
      onFrame(result, nowMs);
    }
    // rVFC is one-shot — re-register every frame
    _rvfcId = video.requestVideoFrameCallback(loop);
  };
  _rvfcId = video.requestVideoFrameCallback(loop);
}

export function stopRenderLoop(video: HTMLVideoElement): void {
  if (_rvfcId !== undefined) {
    video.cancelVideoFrameCallback(_rvfcId);
    _rvfcId = undefined;
  }
}
```

**Timestamp rules (non-negotiable):**
- Milliseconds, not seconds.
- Strictly monotonically increasing across calls. A duplicate or smaller timestamp → MediaPipe silently returns an empty result.
- Pass `nowMs` from rVFC directly. Do **not** use `video.currentTime` (seconds, seek-reset) or `Date.now()` (coarse).
- On stream restart/seek, dispose and re-init the landmarker to reset its internal counter.

**readyState guard:** `HAVE_CURRENT_DATA === 2`. Calling `detectForVideo` on an unready video throws silently or returns empty.

---

## 21-landmark schema (D5)

```
 0 WRIST                    -- palm anchor
 1..4  THUMB_CMC..TIP       -- 4 = THUMB_TIP         *FINGERTIP*
 5..8  INDEX_FINGER_MCP..TIP  -- 8 = INDEX_TIP       *FINGERTIP*
 9..12 MIDDLE_FINGER_MCP..TIP -- 12 = MIDDLE_TIP     *FINGERTIP*
13..16 RING_FINGER_MCP..TIP   -- 16 = RING_TIP       *FINGERTIP*
17..20 PINKY_MCP..TIP         -- 20 = PINKY_TIP      *FINGERTIP*
```

**D5 set used by this app: `{0, 4, 8, 12, 16, 20}`** — wrist + 5 fingertips.

Coordinate space (`NormalizedLandmark`, the only thing you use):
- `x`, `y` normalized `[0, 1]` by image width/height. `(0,0)` = top-left of raw camera frame.
- `z` = normalized depth relative to wrist. **Negative = closer to camera than wrist.** Do not use as absolute depth; scale varies per hand.
- Ignore `worldLandmarks` (metric meters, origin = hand center) — only useful for 3D rigging, not 2D canvas overlay.

Multiply `x * canvas.width`, `y * canvas.height` to draw. If video is CSS-mirrored (`transform: scaleX(-1)`), mirror the overlay canvas the same way OR flip in code as `1 - lm.x` — never both.

```typescript
const TRACKED = [0, 4, 8, 12, 16, 20] as const;

function extractPoints(result: HandLandmarkerResult) {
  const hand = result.landmarks[0]; // D8: numHands=1, index 0 only
  if (!hand) return [];
  return TRACKED.map((i) => ({ index: i, ...hand[i] }));
}
```

---

## Error mapping: GPU fallback vs NO_WEBGL vs MODEL_LOAD_FAIL

MediaPipe only throws generic `Error` with string messages. Inspect the message.

**Signals `NO_WEBGL` — raise `WebGLUnavailableError`, transition D23 state to `NO_WEBGL`:**

| Substring (case-insensitive in practice) |
|---|
| `webgl` / `WebGL` |
| `emscripten_webgl_create_context` |
| `Couldn't create webGL 2 context` |
| `kGpuService` + `cannot be created` |
| `Unable to initialize EGL` |

**Signals `MODEL_LOAD_FAIL` — raise `ModelLoadError`, transition D23 state to `MODEL_LOAD_FAIL`:**

| Substring |
|---|
| `404` |
| `Failed to fetch` |
| `CORS` |
| `invalid` / `corrupt` |

Detection helper:

```typescript
function isWebGLFailure(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('webgl') ||
    m.includes('emscripten_webgl_create_context') ||
    m.includes('kgpuservice') ||
    m.includes('unable to initialize egl')
  );
}
```

Optional fast-fail pre-check (skip MediaPipe entirely if WebGL absent):

```typescript
export function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
```

UI-layer wiring (D23 state machine):

```typescript
try {
  await getHandLandmarker();
} catch (err) {
  if (err instanceof WebGLUnavailableError) {
    stateMachine.transition('NO_WEBGL');
  } else {
    stateMachine.transition('MODEL_LOAD_FAIL');
  }
}
```

---

## Cleanup, StrictMode, and the close() freeze bug

`HandLandmarker.close()` has a known browser-freeze bug when the GPU delegate is active ([issue #5718](https://github.com/google-ai-edge/mediapipe/issues/5718), unresolved as of v0.10.34). The singleton lives at module scope — **do not** call `close()` on every React unmount.

Rules:
1. React `useEffect` cleanup → **only** `stopRenderLoop(video)`. Never `close()`.
2. Use a `mounted` flag to drop the result if StrictMode unmounts before init resolves.
3. Expose `disposeHandLandmarker()` for true app teardown only (e.g. `beforeunload`), wrapped in try/catch so a freeze/throw cannot crash the cleanup.

```typescript
export function disposeHandLandmarker(): void {
  if (_instance) {
    try { _instance.close(); } catch { /* freeze bug — let GC handle it */ }
    _instance = null;
  }
  _initPromise = null;
  _usingGpu = false;
}

// In a React hook:
useEffect(() => {
  let mounted = true;
  (async () => {
    try {
      const lm = await getHandLandmarker();
      if (!mounted) return;          // StrictMode double-mount guard
      startRenderLoop(videoEl, lm, handleFrame);
    } catch (err) {
      // map to D23 states (see Error mapping)
    }
  })();
  return () => {
    mounted = false;
    stopRenderLoop(videoEl);
    // DO NOT call disposeHandLandmarker() here.
  };
}, []);
```

---

## Memory and long sessions

- **Never cache `HandLandmarkerResult` objects across frames.** Extract the landmark arrays you need immediately and drop the reference. Caching leaks WASM-heap buffers even though the JS wrapper looks small.
- `HandLandmarkerResult` has no public `close()` in v0.10.34 types. Per-instance cleanup happens when `HandLandmarker.close()` runs (on true teardown).
- In `VIDEO` mode each `detectForVideo` call overwrites the previous result reference — GC handles JS side. WASM heap is bounded under normal use. The extreme growth reported in issue #5626 was a Python consumer accumulating frames, not browser JS.
- 640×480 is ideal (D22). MediaPipe internally downscales to 256×256 for palm detection regardless of input.

### WebGL context loss recovery

The GPU driver can reclaim the WebGL context after long sessions. MediaPipe has no built-in recovery. Listen and re-init:

```typescript
document.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();                  // required to keep context restorable
  console.error('[HandLandmarker] WebGL context lost, re-initializing');
  stopRenderLoop(videoEl);
  disposeHandLandmarker();
}, { once: false });

document.addEventListener('webglcontextrestored', async () => {
  try {
    const lm = await getHandLandmarker();
    startRenderLoop(videoEl, lm, handleFrame);
  } catch {
    stateMachine.transition('MODEL_LOAD_FAIL');
  }
}, { once: false });
```

---

## Known quirks

- **Web Worker incompatibility:** the tasks-vision bundle calls `importScripts`, which ESM workers (`{ type: 'module' }`) forbid. A classic worker with a locally patched bundle works, but is brittle. **Main thread only for MVP** (D17).
- **Mac M2/M3 default delegate quirk** (issue #5447): omitting `delegate` silently uses CPU. Always set `delegate: 'GPU'` explicitly.
- **Cold start:** first init fetches ~22 MB wasm + 7.8 MB model, then compiles shaders (2–30s on first GPU use). Show a loading state from `getHandLandmarker()` until it resolves.
- **`runningMode` mismatch:** init with `'VIDEO'` + call `detect()` (image method) throws `"Task is not initialized with image mode."`. Use `detectForVideo()` exclusively.
- **No public "is GPU active?" API.** Track it yourself at init time via `_usingGpu` (set above). For runtime verification, time a single `detectForVideo` call: <15 ms → GPU; >20 ms → CPU; not definitive.

---

## Vitest mock

Unit tests must never load real wasm/models. Stub the module before `getHandLandmarker` runs.

```typescript
// src/tracking/__tests__/handLandmarker.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Hoisted mock — must be at module top
vi.mock('@mediapipe/tasks-vision', () => {
  const fakeLandmarker = {
    detectForVideo: vi.fn(() => ({
      landmarks: [],
      worldLandmarks: [],
      handednesses: [],
    })),
    close: vi.fn(),
  };
  return {
    FilesetResolver: {
      forVisionTasks: vi.fn(async () => ({})),
    },
    HandLandmarker: {
      createFromOptions: vi.fn(async () => fakeLandmarker),
    },
  };
});

import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { getHandLandmarker, isUsingGpu, WebGLUnavailableError, ModelLoadError } from '../handLandmarker';

beforeEach(() => {
  vi.clearAllMocks();
  // Reset module-level singleton between tests
  vi.resetModules();
});

describe('getHandLandmarker', () => {
  it('initializes with GPU delegate and returns a landmarker', async () => {
    const lm = await getHandLandmarker();
    expect(lm).toBeDefined();
    expect(FilesetResolver.forVisionTasks).toHaveBeenCalledWith('/wasm');
    expect(HandLandmarker.createFromOptions).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        baseOptions: expect.objectContaining({
          modelAssetPath: '/models/hand_landmarker.task',
          delegate: 'GPU',
        }),
        runningMode: 'VIDEO',
        numHands: 1,
      }),
    );
    expect(isUsingGpu()).toBe(true);
  });

  it('falls back to CPU on non-WebGL GPU failure', async () => {
    (HandLandmarker.createFromOptions as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('Some generic GPU error'))
      .mockResolvedValueOnce({ detectForVideo: vi.fn(), close: vi.fn() });
    const lm = await getHandLandmarker();
    expect(lm).toBeDefined();
    expect(isUsingGpu()).toBe(false);
  });

  it('raises WebGLUnavailableError on WebGL absence', async () => {
    (HandLandmarker.createFromOptions as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('emscripten_webgl_create_context() returned error 0'));
    await expect(getHandLandmarker()).rejects.toBeInstanceOf(WebGLUnavailableError);
  });

  it('raises ModelLoadError on 404', async () => {
    (HandLandmarker.createFromOptions as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('Some non-webgl GPU err'))   // triggers CPU fallback
      .mockRejectedValueOnce(new Error('Failed to fetch: 404'));     // CPU also fails
    await expect(getHandLandmarker()).rejects.toBeInstanceOf(ModelLoadError);
  });
});
```

For component-level tests, the fake `detectForVideo` returning `{ landmarks: [] }` is usually enough. To exercise draw code, return a synthetic 21-point array:

```typescript
const synthHand = Array.from({ length: 21 }, (_, i) => ({
  x: 0.5 + Math.cos(i) * 0.1,
  y: 0.5 + Math.sin(i) * 0.1,
  z: 0,
}));
fakeLandmarker.detectForVideo.mockReturnValue({
  landmarks: [synthHand],
  worldLandmarks: [synthHand],
  handednesses: [[{ score: 0.9, categoryName: 'Right', index: 0, displayName: 'Right' }]],
});
```

---

## Anti-patterns (do not do this)

- **Do not** call `HandLandmarker.close()` on every React `useEffect` cleanup — triggers the GPU freeze bug (#5718) and wastes the 22 MB wasm load.
- **Do not** re-init the landmarker per component mount. Use the module-level singleton.
- **Do not** use `requestAnimationFrame` for the detection loop. Use `requestVideoFrameCallback` (D18).
- **Do not** pass `Date.now()` or `video.currentTime` to `detectForVideo`. Use the `nowMs` arg from rVFC (or `performance.now()`).
- **Do not** call `detectForVideo` when `video.readyState < 2`.
- **Do not** cache `HandLandmarkerResult` objects in state or arrays across frames. Extract + discard.
- **Do not** load wasm from `node_modules/` via Vite imports. Always serve from `public/wasm/` and resolve via `FilesetResolver.forVisionTasks('/wasm')`.
- **Do not** use CDN URLs at runtime (`jsdelivr`, `storage.googleapis.com`) — violates D33/D44 and breaks offline dev. CDN is for the one-time curl download during scaffold only.
- **Do not** import/use `worldLandmarks` for 2D overlay — it's metric-space, not screen-space. Use `landmarks` (normalized).
- **Do not** mirror both the video CSS and the x-coordinate in code — pick one (canvas CSS mirror is simpler).
- **Do not** attempt Web Worker inference for MVP. `importScripts` incompatibility with ESM workers is unresolved.
- **Do not** omit `delegate: 'GPU'` expecting auto-detection — on M2/M3 the default silently runs CPU.
- **Do not** change `numHands` from 1, confidence defaults, or `runningMode` without a discovery decision.

---

## Related files and skills

- Research: `.claude/orchestration-hand-tracker-fx/research/hand-tracking.md`, `.claude/orchestration-hand-tracker-fx/research/mediapipe-impl.md`
- Decisions: `.claude/orchestration-hand-tracker-fx/DISCOVERY.md` (D5, D7, D8, D13, D17, D23, D33, D44)
- Implementation target: `src/tracking/handLandmarker.ts`, `src/tracking/useHandTracker.ts`, `src/engine/renderer.ts`
- Vite headers (D31/D32): `vite.config.ts` must set `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`; verify `window.crossOriginIsolated === true`.
