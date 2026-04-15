# MediaPipe HandLandmarker Implementation - Research

**Wave**: Second
**Researcher**: Web research specialist subagent
**Date**: 2026-04-14
**Status**: Complete

---

## Summary

This document covers the exact implementation details for self-hosting MediaPipe `@mediapipe/tasks-vision` v0.10.34 in the Hand Tracker FX Vite + React + TS project, filtered through the DISCOVERY.md decisions (D5, D8, D17, D22, D31, D33, D44). It documents the complete 6-file WASM bundle, download commands, full `HandLandmarker` init with GPU delegate, the `requestVideoFrameCallback` loop pattern, cleanup/dispose behavior, error taxonomy for `MODEL_LOAD_FAIL` vs `NO_WEBGL`, GPU delegate verification, and long-session memory risks.

---

## Key Findings

### 1. WASM File Set — Complete List (v0.10.34)

The `/wasm/` subdirectory of `@mediapipe/tasks-vision@0.10.34` contains exactly **6 files**. All confirmed present at jsDelivr v0.10.34 (HTTP 200, `x-jsd-version: 0.10.34`):

| File | Role |
|------|------|
| `vision_wasm_internal.js` | SIMD variant — Emscripten module factory (~316 KB) |
| `vision_wasm_internal.wasm` | SIMD variant — compiled WASM binary (~10.98 MB) |
| `vision_wasm_module_internal.js` | SIMD ES-module variant — Emscripten module factory (~315.93 KB) |
| `vision_wasm_module_internal.wasm` | SIMD ES-module variant — compiled WASM binary (~10.98 MB) |
| `vision_wasm_nosimd_internal.js` | No-SIMD fallback — Emscripten module factory (~315.8 KB) |
| `vision_wasm_nosimd_internal.wasm` | No-SIMD fallback — compiled WASM binary (~10.21 MB) |

Total uncompressed: ~22 MB. The library selects SIMD vs. no-SIMD at runtime based on `WebAssembly.validate(simdBytes)`. The `_module_` variant is selected when `FilesetResolver` is called with `useModule: true` (the default is `false`; omit this parameter).

**There is no `vision_wasm_nosimd_module_internal.*` pair** — only 6 files total, not 8.

---

### 2. Download Commands — public/wasm/

Pin to the exact version in use (`0.10.34`) rather than `@latest` so downloads are reproducible. Run from the project root:

```bash
mkdir -p public/wasm public/models

# SIMD pair
curl -L "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm/vision_wasm_internal.js" \
  -o public/wasm/vision_wasm_internal.js

curl -L "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm/vision_wasm_internal.wasm" \
  -o public/wasm/vision_wasm_internal.wasm

# SIMD module pair
curl -L "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm/vision_wasm_module_internal.js" \
  -o public/wasm/vision_wasm_module_internal.js

curl -L "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm/vision_wasm_module_internal.wasm" \
  -o public/wasm/vision_wasm_module_internal.wasm

# No-SIMD fallback pair
curl -L "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm/vision_wasm_nosimd_internal.js" \
  -o public/wasm/vision_wasm_nosimd_internal.js

curl -L "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm/vision_wasm_nosimd_internal.wasm" \
  -o public/wasm/vision_wasm_nosimd_internal.wasm

# Model file (D33)
curl -L "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task" \
  -o public/models/hand_landmarker.task
```

wget equivalent (replace each `curl -L ... -o` with `wget -O`):

```bash
wget -O public/wasm/vision_wasm_internal.js \
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm/vision_wasm_internal.js"
# ... repeat pattern for each file above
```

**Gotcha**: jsDelivr compresses responses with gzip/br when the `Accept-Encoding` header is sent (as browsers do). `curl` without `-L --compressed` may download a compressed file with a `.js` extension. Using `-L` alone is sufficient for curl ≥ 7.21 (macOS default handles this correctly). Verify: `file public/wasm/vision_wasm_internal.wasm` should report `WebAssembly binary`, not `gzip compressed data`.

**Vite note**: Files placed in `public/` are served verbatim at the root path. `public/wasm/vision_wasm_internal.js` is served as `/wasm/vision_wasm_internal.js`. Do NOT import these files directly in TS source — that would trigger Vite's bundler and break the WASM loading. `FilesetResolver` fetches them at runtime via XHR/fetch; they must live in `public/`, not `src/`.

---

### 3. HandLandmarker Initialization — Full Code

Aligned with D17 (main-thread, GPU delegate), D8 (numHands=1), D33 (self-hosted model), D44 (self-hosted wasm):

```typescript
// src/tracking/handLandmarker.ts
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// Module-level singleton — survives React StrictMode double-mount
let _instance: HandLandmarker | null = null;
let _initPromise: Promise<HandLandmarker> | null = null;
let _usingGpu = false;

export async function getHandLandmarker(): Promise<HandLandmarker> {
  if (_instance) return _instance;
  if (_initPromise) return _initPromise;
  _initPromise = _createHandLandmarker();
  return _initPromise;
}

async function _createHandLandmarker(): Promise<HandLandmarker> {
  // D44: self-hosted wasm at /wasm/ (Vite serves public/ at root)
  const vision = await FilesetResolver.forVisionTasks('/wasm');

  // Attempt GPU first (D17)
  try {
    const lm = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: '/models/hand_landmarker.task', // D33
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 1,                      // D8
      minHandDetectionConfidence: 0.5,  // default
      minHandPresenceConfidence: 0.5,   // default
      minTrackingConfidence: 0.5,       // default
    });
    _usingGpu = true;
    console.info('[HandLandmarker] initialized with GPU delegate');
    _instance = lm;
    return lm;
  } catch (gpuErr) {
    // GPU init failed — map to appropriate error state (see §6)
    const msg = gpuErr instanceof Error ? gpuErr.message : String(gpuErr);
    const isWebGlFail =
      msg.includes('webgl') ||
      msg.includes('WebGL') ||
      msg.includes('kGpuService') ||
      msg.includes('emscripten_webgl_create_context');

    if (isWebGlFail) {
      // NO_WEBGL: WebGL itself is unavailable — do not retry with CPU,
      // surface NO_WEBGL state to the UI state machine
      throw new WebGLUnavailableError(msg);
    }

    // Non-WebGL GPU failure — fall back to CPU
    console.warn('[HandLandmarker] GPU delegate failed, falling back to CPU:', msg);
  }

  // CPU fallback
  const vision2 = await FilesetResolver.forVisionTasks('/wasm');
  const lm = await HandLandmarker.createFromOptions(vision2, {
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
  console.info('[HandLandmarker] initialized with CPU delegate (GPU unavailable)');
  _instance = lm;
  return lm;
}

export function isUsingGpu(): boolean {
  return _usingGpu;
}

export function disposeHandLandmarker(): void {
  if (_instance) {
    try {
      _instance.close();
    } catch {
      // close() has a known browser-freeze bug on some versions;
      // swallow and let GC handle it rather than crashing cleanup
    }
    _instance = null;
  }
  _initPromise = null;
  _usingGpu = false;
}

// Custom error classes for D23 state machine
export class WebGLUnavailableError extends Error {
  override name = 'WebGLUnavailableError';
}
export class ModelLoadError extends Error {
  override name = 'ModelLoadError';
}
```

**Key options:**

| Option | Value | Source |
|--------|-------|--------|
| `delegate` | `'GPU'` with `'CPU'` fallback | D17 |
| `runningMode` | `'VIDEO'` | webcam use case |
| `numHands` | `1` | D8 |
| `minHandDetectionConfidence` | `0.5` | default, suitable for MVP |
| `minHandPresenceConfidence` | `0.5` | default |
| `minTrackingConfidence` | `0.5` | default; raise to 0.7 if jitter observed |
| `modelAssetPath` | `'/models/hand_landmarker.task'` | D33 |

`FilesetResolver.forVisionTasks(basePath?)` — the `basePath` parameter is optional; omitting it causes the library to load from the host root. Passing `'/wasm'` directs it to `https://yourdomain/wasm/` in production and `http://localhost:5173/wasm/` in dev.

---

### 4. detectForVideo() Per Frame — rVFC Loop

D18 specifies `requestVideoFrameCallback` (rVFC) as the render loop trigger, not `requestAnimationFrame`. The difference: rVFC fires at the video's frame rate (up to 30fps for a 30fps webcam), synchronized with when a new frame is presented to the compositor. `rAF` fires at the display refresh rate (60/120Hz), causing redundant inference calls on duplicate video frames.

```typescript
// src/engine/renderer.ts (relevant loop section)
import type { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';

let _rvcId: number | undefined;

export function startRenderLoop(
  videoEl: HTMLVideoElement,
  handLandmarker: HandLandmarker,
  onFrame: (result: HandLandmarkerResult, nowMs: number) => void
): void {
  const loop = (nowMs: DOMHighResTimeStamp, _meta: VideoFrameMetadata) => {
    // Guard: video must have a current frame (readyState >= HAVE_CURRENT_DATA)
    if (videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      // detectForVideo requires a monotonically increasing timestamp in ms.
      // 'nowMs' from rVFC is a DOMHighResTimeStamp — same epoch as performance.now().
      // Using nowMs directly avoids a separate performance.now() call.
      const result = handLandmarker.detectForVideo(videoEl, nowMs);
      onFrame(result, nowMs);
    }

    // Re-register for next frame (rVFC is one-shot, must re-register each call)
    _rvcId = videoEl.requestVideoFrameCallback(loop);
  };

  _rvcId = videoEl.requestVideoFrameCallback(loop);
}

export function stopRenderLoop(videoEl: HTMLVideoElement): void {
  if (_rvcId !== undefined) {
    videoEl.cancelVideoFrameCallback(_rvcId);
    _rvcId = undefined;
  }
}
```

**Timestamp rules for `detectForVideo`:**
- Must be a number in **milliseconds** (not seconds).
- Must be **strictly monotonically increasing** across calls. Passing the same timestamp twice or a smaller value causes MediaPipe to silently skip processing and return an empty result.
- `performance.now()` is the canonical source. The `nowMs` from `rVFC` is already a `DOMHighResTimeStamp` from the same clock — use it directly.
- **Never use `video.currentTime`** (it is in seconds and resets on seek) or `Date.now()` (coarser, not monotonic in all edge cases).

**readyState guard:** `HTMLMediaElement.HAVE_CURRENT_DATA` is `2`. Always check before calling `detectForVideo`; calling it on an unready element throws silently or returns empty results.

**rVFC re-registration:** `requestVideoFrameCallback` is one-shot. You must re-register inside the callback for each new frame, identical to the `rAF` pattern.

---

### 5. Cleanup and Dispose

```typescript
// In React useEffect cleanup (src/tracking/useHandTracker.ts)
import { disposeHandLandmarker } from './handLandmarker';
import { stopRenderLoop } from '../engine/renderer';

useEffect(() => {
  let mounted = true;

  const init = async () => {
    try {
      const lm = await getHandLandmarker();
      if (!mounted) {
        // StrictMode double-mount: component unmounted before init completed
        disposeHandLandmarker();
        return;
      }
      startRenderLoop(videoEl, lm, handleFrame);
    } catch (err) {
      // map to D23 error states — see §6
    }
  };

  init();

  return () => {
    mounted = false;
    stopRenderLoop(videoEl);
    // Do NOT call disposeHandLandmarker() here unless the component is fully
    // unmounting for the last time. The singleton lives at module scope.
    // React StrictMode will double-invoke this cleanup — guard with `mounted`.
  };
}, []);

// Only call disposeHandLandmarker() on true application teardown, e.g.:
// window.addEventListener('beforeunload', disposeHandLandmarker);
```

**close() behavior warning:** `HandLandmarker.close()` is documented to release WASM heap memory. However, issue #5718 reports that calling `close()` with the GPU delegate causes the browser process to freeze on some versions. Mitigation: wrap in try/catch and allow GC to reclaim if close() throws. The freeze appears correlated with GPU delegate; CPU delegate close() is generally safe.

**React StrictMode double-mount:** StrictMode mounts → unmounts → re-mounts every component in dev mode. The module-level singleton pattern (`_instance`, `_initPromise`) prevents re-initialization on the second mount. The `mounted` flag in the effect prevents calling `startRenderLoop` if the component unmounted before `createFromOptions` resolved.

---

### 6. Error Modes — MODEL_LOAD_FAIL vs NO_WEBGL

MediaPipe does not throw typed error classes. All failures surface as generic `Error` with a string `message`. Map to D23 states by inspecting the message string:

**Errors that signal `NO_WEBGL` (WebGL entirely unavailable):**

These throw from `createFromOptions()` with GPU delegate. The error message contains one or more of:

| Substring | Context |
|-----------|---------|
| `emscripten_webgl_create_context() returned error 0` | iOS WKWebView, headless Chrome |
| `Couldn't create webGL 2 context` | Same — logged before the throw |
| `Couldn't create webGL 1 context` | Fallback also failed |
| `kGpuService` + `cannot be created` | GPU service init failure, EGL init failure |
| `Unable to initialize EGL` | Linux/headless |

These indicate the device cannot run WebGL at all. Retrying with `delegate: 'CPU'` may succeed (CPU delegate does not use WebGL). However, if WebGL is entirely absent, the WASM runtime itself may fail regardless. Surface `NO_WEBGL` state and inform the user.

**Errors that signal `MODEL_LOAD_FAIL` (model file couldn't be fetched/parsed):**

These throw from `createFromOptions()` on any delegate when the `.task` file is inaccessible or corrupt:

| Substring | Context |
|-----------|---------|
| `404` | Model file not found at `modelAssetPath` |
| `Failed to fetch` | Network error fetching model file |
| `CORS` | CORS policy blocked model fetch (shouldn't happen for self-hosted files in same origin) |
| `invalid` or `corrupt` | Partial download or wrong file served |

**Detection pattern in practice:**

```typescript
async function initWithErrorMapping(): Promise<void> {
  try {
    await getHandLandmarker();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    const isNoWebGL =
      err instanceof WebGLUnavailableError ||
      msg.includes('webgl') ||
      msg.includes('WebGL') ||
      msg.includes('kGpuService') ||
      msg.includes('emscripten_webgl_create_context');

    if (isNoWebGL) {
      uiStateMachine.transition('NO_WEBGL');
      return;
    }

    // Everything else: model load failure, network issue, corrupt file
    uiStateMachine.transition('MODEL_LOAD_FAIL');
  }
}
```

**Pre-check for WebGL before attempting init (optional fast-fail):**

```typescript
function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}

if (!isWebGLAvailable()) {
  uiStateMachine.transition('NO_WEBGL');
  return; // skip MediaPipe init entirely
}
```

This check is fast and avoids a 3-30 second wait for MediaPipe to fail internally.

---

### 7. Verifying GPU Delegate Is Actually Being Used

MediaPipe does not expose a public API that returns which delegate is active. The `_usingGpu` flag in the wrapper above (§3) tracks whether `createFromOptions` with `delegate: 'GPU'` succeeded — that is the most reliable signal available from JS.

**Console log approach (implemented in §3):**
```
[HandLandmarker] initialized with GPU delegate
```
vs
```
[HandLandmarker] initialized with CPU delegate (GPU unavailable)
```

**Performance timing approach (runtime verification):**

```typescript
function benchmarkInference(lm: HandLandmarker, videoEl: HTMLVideoElement): void {
  if (videoEl.readyState < 2) return;
  const t0 = performance.now();
  lm.detectForVideo(videoEl, t0);
  const dt = performance.now() - t0;
  console.info(`[HandLandmarker] inference latency: ${dt.toFixed(1)}ms`);
  // GPU target: ~12ms. CPU target: ~17ms on modern hardware.
  // <15ms strongly suggests GPU; >20ms suggests CPU.
  // These are approximate — hardware varies widely.
}
```

**Chrome DevTools — WebGL activity:**
With GPU delegate active, the DevTools Performance timeline shows WebGL shader compilation events and GPU rasterization activity during the first few inference calls. Under CPU delegate, these are absent.

**Fallback behavior when GPU is requested but silently degrades:**
As of v0.10.34 there is no confirmed case where `delegate: 'GPU'` is accepted without error but silently runs on CPU. If `createFromOptions` resolves without throwing, GPU is active. If GPU is unavailable, `createFromOptions` throws (see §6 error strings).

**Known quirk (issue #5447):** On Mac M2/M3 with some configurations, the default (no `delegate` specified) runs CPU, not GPU. Always specify `delegate: 'GPU'` explicitly — do not rely on the default.

---

### 8. Memory and Leak Risks — Long Sessions

**WASM heap accumulation:**
MediaPipe Tasks Vision runs C++ via WASM. C++ requires manual memory management. If detection result objects accumulate without being freed, the WASM heap grows unboundedly. In `VIDEO` mode with `detectForVideo`, each call returns a new `HandLandmarkerResult`. The JS object is garbage-collected eventually, but the underlying C++ buffer may not be freed until `close()` is called on the result.

**`HandLandmarkerResult` has no `.close()` method in the v0.10.34 TypeScript types.** The Google blog post states "Some tasks also have close methods for returned results — consult API documentation." For `HandLandmarkerResult` specifically, there is no documented per-result close. The `HandLandmarker` instance's `close()` frees all resources at once.

**Observed memory issue (#5626):** Extreme memory growth (30 GB/min) was reported in a Python context with explicit frame buffer accumulation (`pd.concat`). For the browser JS case running `detectForVideo` at 30fps, the pattern does not accumulate result objects — each call overwrites the previous result reference. Browser GC handles the JS-side cleanup. The WASM heap does not grow indefinitely in VIDEO mode under normal use.

**Practical risks for a long-session browser app:**

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| WASM heap leak from result accumulation | Low (VIDEO mode, no result caching) | Do not store results in arrays; re-read landmarks each frame |
| WebGL context loss after extended GPU use | Medium (GPU driver reclaims context) | Listen for `webglcontextlost` on document; re-init landmarker |
| `close()` freeze with GPU delegate | Medium (issue #5718, unresolved) | Wrap in try/catch; only call on true unmount, not on every re-render |
| Texture upload overhead | Low at 640x480 | MediaPipe resizes to 256x256 internally; input size has minimal impact |
| Tab memory growth over hours | Low-Medium | Avoid caching `HandLandmarkerResult` objects; process landmarks and discard |

**WebGL context loss recovery:**

MediaPipe has no built-in recovery from `webglcontextlost`. The only confirmed recovery path is page reload. Implement a listener to detect and prompt:

```typescript
// One-time listener set up after init
document.addEventListener('webglcontextlost', () => {
  console.error('[HandLandmarker] WebGL context lost — reinitializing');
  disposeHandLandmarker();
  // Re-trigger init; second attempt often succeeds after context restore
  setTimeout(() => getHandLandmarker(), 500);
}, { once: false });
```

**Do not call `detectForVideo` when video is paused or hidden** (e.g. tab backgrounded). `requestVideoFrameCallback` stops firing when the video is paused, so this is naturally handled.

---

### 9. Vite Dev Server — COOP/COEP Headers

Required per D31/D32 for WASM and webcam to work in the dev server:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
```

Verify in the browser console: `window.crossOriginIsolated` should return `true`.

The Vite `server.headers` option (available since Vite 5.4.0) is the cleanest approach. The middleware plugin pattern also works for older Vite versions (shown in Recommended Approach below).

---

## Recommended Approach

1. **Download all 6 WASM files + model to `public/`** using the pinned v0.10.34 curl commands above. Never import them from `node_modules` directly — Vite would bundle/transform them incorrectly.

2. **Use `FilesetResolver.forVisionTasks('/wasm')`** (leading slash, no trailing slash). This resolves to `<origin>/wasm/` in both dev and production.

3. **Initialize as a module-level singleton** to survive React StrictMode double-mounts and prevent re-initialization on route changes.

4. **Try GPU first, catch + inspect error string, fall back to CPU** for non-WebGL GPU failures; surface `NO_WEBGL` state for WebGL-absent environments.

5. **Use `requestVideoFrameCallback`** on the `<video>` element for the detection loop. Pass `nowMs` directly to `detectForVideo` as the timestamp.

6. **Guard `readyState >= 2`** before every `detectForVideo` call.

7. **Track `_usingGpu` flag at init time** for console logging; use inference latency benchmarking for runtime confirmation.

8. **Wrap `close()` in try/catch** on unmount; avoid calling it on every render cycle.

9. **Do not cache `HandLandmarkerResult` objects** across frames — extract the landmark arrays and discard the result reference immediately.

---

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| CDN wasm (jsDelivr at runtime) | Zero setup | CDN dependency, CORS headers needed for model, fails offline | Rejected per D44 |
| Import wasm from node_modules in Vite | Single source of truth | Breaks WASM loading (Vite transforms break Emscripten module pattern); issue #5961 open, no stable API | Rejected |
| Web Worker for inference | Off main thread | `importScripts` incompatibility with ESM workers, requires patched bundle per first-wave research; D17 defers this | Deferred post-MVP |
| `delegate: 'CPU'` only | No GPU failure mode | ~17ms latency vs ~12ms; 30fps target still achievable but with less headroom | Fallback only, not primary |

---

## Pitfalls and Edge Cases

- **`/wasm` path (no trailing slash):** `FilesetResolver.forVisionTasks('/wasm')` works. `'/wasm/'` with trailing slash also works. Never use a relative path like `'./wasm'` — it breaks in production when the base URL is not `/`.
- **Version pinning in curl commands:** Use `@0.10.34` not `@latest` in download URLs. `@latest` redirects and the downloaded files may lag behind the npm version.
- **SIMD browser support:** All modern desktop browsers (Chrome 91+, Firefox 89+, Safari 16.4+) support WASM SIMD. The nosimd fallback is only needed for older browsers. Desktop-only target means the nosimd pair is rarely invoked but must be present (the library checks at runtime, not build time).
- **Model CORS:** Self-hosting the `.task` file at `/models/` on the same origin eliminates all CORS concerns. If you ever move it to a CDN, ensure `Access-Control-Allow-Origin: *` is set.
- **`runningMode` mismatch:** Initializing with `VIDEO` and calling `detect()` (the image-mode method) throws: `"Task is not initialized with image mode."` Use `detectForVideo()` exclusively for the webcam loop.
- **Monotonic timestamp violation:** If `nowMs` from rVFC ever decreases (video seek, stream restart), `detectForVideo` returns an empty result silently. On stream restart, reinitialize the landmarker instance to reset the internal timestamp counter.
- **`close()` browser freeze (issue #5718):** Reported with GPU delegate. Mitigation: swallow in try/catch, only call on true app teardown. Do not call `close()` in rVFC loop cancellation — only stop the loop (cancel the rVFC callback) and leave the landmarker instance alive for reuse.
- **GPU init latency:** On first load with GPU delegate, shader compilation can take 2-30 seconds. Show a loading indicator during `getHandLandmarker()`. The service worker caching `/wasm/*` and `/models/*` (D33) reduces subsequent load to near-instant.

---

## References

- [MediaPipe HandLandmarker Web Guide — Google AI Edge](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
- [HandLandmarker TypeScript API — unpkg vision.d.ts v0.10.34](https://app.unpkg.com/@mediapipe/tasks-vision@0.10.34/files/vision.d.ts)
- [FilesetResolver API — Google AI Edge](https://ai.google.dev/edge/api/mediapipe/js/tasks-text.filesetresolver)
- [7 dos and don'ts of using ML on the web with MediaPipe — Google Developers Blog](https://developers.googleblog.com/7-dos-and-donts-of-using-ml-on-the-web-with-mediapipe/)
- [requestVideoFrameCallback() explainer — web.dev](https://web.dev/articles/requestvideoframecallback-rvfc)
- [Issue #5718: close() causes browser freeze — google-ai-edge/mediapipe](https://github.com/google-ai-edge/mediapipe/issues/5718)
- [Issue #5626: extensive memory usage — google-ai-edge/mediapipe](https://github.com/google-ai-edge/mediapipe/issues/5626)
- [Issue #5447: How to use CPU and GPU delegate — google-ai-edge/mediapipe](https://github.com/google-ai-edge/mediapipe/issues/5447)
- [Issue #4499: WebGL context creation error string — google-ai-edge/mediapipe](https://github.com/google-ai-edge/mediapipe/issues/4499)
- [Issue #4720: WebGL context loss recovery — google-ai-edge/mediapipe](https://github.com/google-ai-edge/mediapipe/issues/4720)
- [Issue #5961: Stable method of bundling WASM (open) — google-ai-edge/mediapipe](https://github.com/google-ai-edge/mediapipe/issues/5961)
- [Issue #5377: MediaPipe Web performance / glReadPixels — google-ai-edge/mediapipe](https://github.com/google-ai-edge/mediapipe/issues/5377)
- [Vite COOP/COEP headers gist — mizchi](https://gist.github.com/mizchi/afcc5cf233c9e6943720fde4b4579a2b)
- [HandLandmarker vanilla JS example — yyunkuo gist](https://gist.github.com/yyunkuo/f024e5ef38cceb7a35ae7b99d46557d2)
- [Integrating @mediapipe/tasks-vision in React — DEV.to / Kathan Chaudhari](https://dev.to/kiyo/integrating-mediapipetasks-vision-for-hand-landmark-detection-in-react-2lbg)

---

## Second Wave Additions

### Implementation Details (filtered by DISCOVERY.md)

**D17 — main thread, GPU delegate:**
The wrapper in §3 implements exactly this: GPU attempted first, non-WebGL GPU failures fall back to CPU, WebGL-absent environments surface `NO_WEBGL`. The singleton pattern means the main-thread performance cost is paid once at startup, not per render.

**D33 — self-host model at `/models/hand_landmarker.task`:**
`modelAssetPath: '/models/hand_landmarker.task'` in `createFromOptions`. No CDN call at inference time.

**D44 — self-host wasm at `/wasm/`:**
`FilesetResolver.forVisionTasks('/wasm')` routes all 6 WASM files to the self-hosted copies in `public/wasm/`.

**D22 — getUserMedia 640x480 ideal, 30fps:**
MediaPipe internally downscales to 256x256 for palm detection regardless of input resolution. 640x480 at 30fps is optimal — lower resolution than 720p means faster WASM texture upload with no model accuracy penalty.

**D5 — landmarks {0, 4, 8, 12, 16, 20}:**
Extract from `result.landmarks[0]` (index 0 = first/only hand, per D8 numHands=1). Landmark 0 is wrist; 4, 8, 12, 16, 20 are fingertips. The `result.landmarks` array is `NormalizedLandmark[][]` — `result.landmarks[handIndex][landmarkIndex]`.

**D8 — maxNumHands=1:**
`numHands: 1` in `createFromOptions`. When `numHands: 1`, `result.landmarks` has at most 1 element. No hand index stability issues (no swapping between [0] and [1]).

**D31 — COOP/COEP headers:**
The Vite dev server config in §9 matches D32. For production (Vercel), these headers are set in `vercel.json` per D31.

### Tool and MCP Configuration

| Tool/Service | Purpose | Setup Required | Agent Can Self-Configure? |
|-------------|---------|----------------|---------------------------|
| `@mediapipe/tasks-vision` npm | JS import of HandLandmarker | `pnpm add @mediapipe/tasks-vision` | Yes |
| jsDelivr CDN | Source for curl download of wasm files | None (public URL) | Yes (curl commands above) |
| Google Storage | Source for `hand_landmarker.task` model | None (public URL) | Yes (curl command above) |
| `public/wasm/` | Self-hosted WASM at dev + prod | `mkdir public/wasm` + 6 curl downloads | Yes |
| `public/models/` | Self-hosted model at dev + prod | `mkdir public/models` + 1 curl download | Yes |

### Testing Strategy

- **Unit test (Vitest):** Mock `FilesetResolver` and `HandLandmarker.createFromOptions` to verify the GPU → CPU fallback logic and error classification strings.
- **Integration smoke:** Start dev server with COOP/COEP headers; verify `window.crossOriginIsolated === true` in Playwright.
- **E2E (Playwright):** Use `--use-fake-device-for-media-stream` flag; assert that `getHandLandmarker()` resolves without throwing; assert `isUsingGpu()` returns a boolean (not throw); assert inference produces `result.landmarks` array.
- **Memory test:** Run detection loop for 60 seconds in a Playwright session; capture `performance.memory.usedJSHeapSize` at t=0 and t=60; assert growth < 50 MB (no runaway leak).

Test assets needed:
- No hand photo required for unit tests (mock the MediaPipe API)
- Playwright fake webcam stream is sufficient for E2E (no real hand needed — empty result with no landmarks is valid)

### Human Actions Required

| Action | Who | How | Status |
|--------|-----|-----|--------|
| Run curl download commands for wasm + model | Agent | Commands in §2 above, run during Phase 1 scaffold | Pending |
| Grant webcam permission in browser for manual testing | User | Browser prompt on first load | Pending |
