# Webcam Capture and Runtime Performance - Research

**Wave**: First
**Researcher**: Web research specialist subagent
**Date**: 2026-04-14
**Status**: Complete

---

## Summary

For a live hand-tracking canvas app, the sweet spot is `640x480` at `ideal: 30fps` — enough signal for MediaPipe's 21-landmark model while keeping per-frame decode time well under the 33ms budget. The inference loop and render loop should run at different rates (tracker ~15-20fps via a web worker, renderer at 60fps with interpolated landmark positions on the main thread), connected through a `VideoFrame` + `postMessage` transfer. Mirror mode is best implemented as a CSS `scaleX(-1)` on the display canvas only, with landmark coordinates read from the unmirrored video source so no coordinate math is needed.

---

## Key Findings

### 1. getUserMedia Constraints: Resolution and Framerate

**Recommended constraint object for this app:**

```javascript
const constraints = {
  video: {
    width:     { ideal: 640 },
    height:    { ideal: 480 },
    frameRate: { ideal: 30, min: 15 },
    facingMode: 'user'          // front camera on mobile
  }
};
```

**Why 640x480, not 720p?**

MediaPipe Hand Landmarker internally resizes its input to a fixed inference resolution (224x224 or similar). Feeding it 1280x720 does not improve landmark accuracy but does cost extra per-frame work on the main thread to decode and copy a larger bitmap. 640x480 (307 kpx) vs 1280x720 (922 kpx) is a 3x pixel count difference with no meaningful ML benefit. The mosaic/grid visual effect is drawn on a separate canvas layer and can be sized independently of the capture resolution.

**When 720p is justified:** If the parameter panel exposes a "show raw video" mode or the user needs high-fidelity video display beneath the effect. In that case, request 1280x720 but downsample before sending to the inference worker (see Section 5).

**Constraint strategy:**

- Use `ideal` (not `exact`) for resolution and framerate. `exact` causes `OverconstrainedError` on devices that do not hit the target precisely, killing the app on many webcams.
- Firefox only supports fixed pre-defined resolutions; passing non-standard sizes causes `OverconstrainedError`. Stick to standard VGA (640x480) or 720p (1280x720).
- Do not use `min` for resolution — some browsers will select the lowest satisfying device, not the closest to `ideal`.

**Sources:**
- [getUserMedia Video Constraints — addpipe.com](https://blog.addpipe.com/getusermedia-video-constraints/)
- [getUserMedia Resolutions III — webrtcHacks](https://webrtchacks.com/getusermedia-resolutions-3/)
- [MDN: MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

---

### 2. Device Selection UX and Persisting deviceId

**Enumerate devices:**

```javascript
async function listVideoInputs() {
  // Must call getUserMedia first — labels are empty string until permission granted
  await navigator.mediaDevices.getUserMedia({ video: true });
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d => d.kind === 'videoinput');
}
```

**Device labels are hidden until permission is granted.** Call `getUserMedia` (even with basic constraints) before `enumerateDevices`, otherwise `label` is an empty string and you cannot show a meaningful dropdown.

**Persisting the selected device:**

```javascript
// Save on user selection
localStorage.setItem('preferredCameraDeviceId', selectedDeviceId);

// Restore on load
const saved = localStorage.getItem('preferredCameraDeviceId');
const constraints = {
  video: {
    deviceId: saved ? { exact: saved } : undefined,
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 30, min: 15 }
  }
};
// Falls back gracefully: if exact deviceId is not found, browser picks default
```

**Device change handling:**

```javascript
navigator.mediaDevices.addEventListener('devicechange', async () => {
  const fresh = await navigator.mediaDevices.enumerateDevices();
  const cameras = fresh.filter(d => d.kind === 'videoinput');
  // Rebuild dropdown; if current stream's device disappeared, restart with default
  updateCameraDropdown(cameras);
});
```

**Caveats:**
- `deviceId` values are origin-scoped and reset when the user clears cookies/site data.
- In private/incognito browsing, a different ephemeral `deviceId` is used; do not assume localStorage restoration will work in that context.
- Safari (WebKit bug 179220): `deviceId` values may change on page refresh in some older WebKit versions. Validate on load by re-enumerating and cross-checking the label.

**Sources:**
- [Chrome for Developers: Choose cameras, microphones, and speakers](https://developer.chrome.com/blog/media-devices)
- [MDN: MediaDevices.enumerateDevices()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices)
- [WebRTC.org: Getting started with media devices](https://webrtc.org/getting-started/media-devices)

---

### 3. Permissions Lifecycle: Prompt, Denied, Changed

**Permission states via Permissions API:**

```javascript
async function checkCameraPermission() {
  try {
    const status = await navigator.permissions.query({ name: 'camera' });
    // status.state: 'prompt' | 'granted' | 'denied'
    status.addEventListener('change', () => handlePermissionChange(status.state));
    return status.state;
  } catch {
    // Firefox <135 does not support camera permission query
    return 'unknown';
  }
}
```

**Error types and recovery flows:**

| Error name | Cause | Recovery |
|---|---|---|
| `NotAllowedError` | User clicked Deny, or previously denied | Show inline instructions to re-enable in browser site settings. Cannot re-prompt automatically. |
| `NotFoundError` | No camera hardware present | Show "No camera detected" UI state |
| `NotReadableError` | Camera in use by another app/tab | Suggest closing other apps; offer a Retry button |
| `OverconstrainedError` | Requested resolution/FPS not supported | Fall back: retry with looser constraints (remove exact/min) |
| `TypeError` | Empty constraints object | Code bug — ensure `video: true` minimum |
| `AbortError` | Some hardware/OS error | Retry with a delay |

**Recommended getUserMedia wrapper:**

```javascript
async function startCapture(deviceId = null) {
  const constraints = {
    video: {
      ...(deviceId && { deviceId: { exact: deviceId } }),
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30, min: 15 }
    }
  };
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    if (err.name === 'OverconstrainedError') {
      // Retry without device-specific constraints
      return navigator.mediaDevices.getUserMedia({ video: true });
    }
    throw err; // re-throw for UI to handle
  }
}
```

**Key lifecycle note:** Once a user denies permission, the browser will not show the prompt again for that origin until the user manually changes it in browser settings. The Permissions API `change` event fires if the user later grants permission from browser settings while the page is open — your app should listen and attempt `getUserMedia` again when this fires.

**Sources:**
- [Common getUserMedia() Errors — addpipe.com](https://blog.addpipe.com/common-getusermedia-errors/)
- [MDN: MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

---

### 4. Mirror Mode: CSS Transform vs Canvas Flip

**Option A — CSS `scaleX(-1)` on the display canvas (recommended):**

```css
.video-display {
  transform: scaleX(-1);
}
```

- Zero CPU cost — handled by the compositor.
- The underlying `<video>` element and the inference canvas remain unmirrored.
- **MediaPipe receives the original, unmirrored pixel data.** Landmarks come back in the coordinate space of the unmirrored source, so no coordinate correction is needed.
- The display canvas (grid + blob layer) also gets `scaleX(-1)` applied — all blobs and grid lines appear correctly mirrored to the user.

**Option B — Canvas `ctx.scale(-1, 1)` during draw (avoid for inference path):**

```javascript
// Only use this if you NEED mirrored pixels (e.g., recording output)
ctx.save();
ctx.translate(canvas.width, 0);
ctx.scale(-1, 1);
ctx.drawImage(video, 0, 0);
ctx.restore();
```

- If you feed mirrored pixels to MediaPipe, landmarks will have `x` coordinates flipped (a landmark at `x=0.2` on screen appears at `x=0.8` in normalized space). You must then correct with `correctedX = 1.0 - landmark.x` before using coordinates for any logic.
- Only use canvas flipping if the output stream needs mirrored pixels (e.g., recording).

**Recommendation for this app:** Use CSS `scaleX(-1)` on the outermost canvas/video wrapper. The inference worker always receives unmirrored `VideoFrame` data — no coordinate correction needed.

**Sources:**
- [Horizontally Flipping getUserMedia Stream — xjavascript.com](https://www.xjavascript.com/blog/horizontally-flipping-getusermedia-s-webcam-image-stream/)
- [HTML5 Canvas Mirror Transform Tutorial](https://www.html5canvastutorials.com/advanced/html5-canvas-mirror-transform-tutorial/)

---

### 5. requestVideoFrameCallback (rVFC) for Video-Driven Loops

`requestVideoFrameCallback` fires exactly when a new decoded video frame arrives at the compositor — not at the display refresh rate. This is the correct primitive for driving inference: there is no point running the detector when the video frame has not advanced.

**Full support table (2026):**
- Chrome/Edge: 83+
- Firefox: 132+
- Safari: 15.4+ (including iOS)

**Basic rVFC loop:**

```javascript
let lastMediaTime = -1;

function onVideoFrame(now, metadata) {
  // Guard: skip if same frame was already processed
  if (metadata.mediaTime !== lastMediaTime) {
    lastMediaTime = metadata.mediaTime;
    sendFrameToWorker(videoEl);  // see Section 6
  }
  videoEl.requestVideoFrameCallback(onVideoFrame);
}

videoEl.requestVideoFrameCallback(onVideoFrame);
```

**Key metadata fields:**
- `metadata.mediaTime` — presentation timestamp of this frame (seconds). Use this as a unique frame ID.
- `metadata.presentedFrames` — cumulative count; diff between calls tells you how many frames were dropped.
- `metadata.processingDuration` — decode time in seconds.

**rVFC vs rAF comparison:**

| | `rAF` | `rVFC` |
|---|---|---|
| Fires at | Display refresh rate (60-144Hz) | Video frame rate (e.g., 30fps) |
| Frame metadata | None | presentationTime, mediaTime, width, height, etc. |
| Wasted calls | Yes — fires even when video hasn't advanced | No — only fires on new frame |
| Best for | Animation loops unrelated to video | Video processing, inference, canvas sync |

**Feature detection fallback:**

```javascript
const scheduleFrame = 'requestVideoFrameCallback' in HTMLVideoElement.prototype
  ? (cb) => videoEl.requestVideoFrameCallback(cb)
  : (cb) => requestAnimationFrame(cb);
```

**Sources:**
- [Perform efficient per-video-frame operations — web.dev](https://web.dev/articles/requestvideoframecallback-rvfc)
- [MDN: HTMLVideoElement.requestVideoFrameCallback()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback)
- [WICG Spec: video-rvfc](https://wicg.github.io/video-rvfc/)

---

### 6. OffscreenCanvas + Web Workers: Moving Inference Off Main Thread

**Why this matters:** MediaPipe's `detectForVideo()` is synchronous and blocks the calling thread. On a mid-range laptop it takes 20-50ms per frame. Running this on the main thread at 30fps produces 600-1500ms/s of JS blocking — enough to drop render frames and freeze the parameter panel UI.

**Architecture: transferable `VideoFrame` pattern (best approach):**

The `VideoFrame` API (part of WebCodecs) is a transferable object that can be sent zero-copy to a worker. This is more efficient than `createImageBitmap` (which makes a copy) or sending raw pixel data.

```
Main thread                          Worker (tracker.worker.js)
-----------                          --------------------------
rVFC fires
  |
  v
new VideoFrame(videoEl)              onmessage({ data: { frame } })
  |                                    |
  +--postMessage({frame}, [frame])---> landmarker.detectForVideo(frame, frame.timestamp)
                                       frame.close()  // MUST release GPU memory
                                       |
                                       postMessage({ landmarks, timestamp })
                                         |
Main thread                   <----------+
onmessage({ data: result })
  latestLandmarks = result.landmarks
  (render loop uses latestLandmarks each rAF tick)
```

**Tracker worker (tracker.worker.js):**

```javascript
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let landmarker = null;

async function init() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
  );
  landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU'   // falls back to CPU automatically if GPU unavailable
    },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  postMessage({ type: 'ready' });
}

self.onmessage = ({ data }) => {
  if (data.type === 'init') { init(); return; }
  if (data.type === 'frame' && landmarker) {
    const { frame } = data;
    const result = landmarker.detectForVideo(frame, frame.timestamp / 1000); // µs -> ms
    frame.close(); // critical — releases GPU/CPU memory
    postMessage({ type: 'landmarks', landmarks: result.landmarks, timestamp: frame.timestamp });
  }
};
```

**Main thread (capture side):**

```javascript
const worker = new Worker(new URL('./tracker.worker.js', import.meta.url), { type: 'module' });
let latestLandmarks = [];

worker.onmessage = ({ data }) => {
  if (data.type === 'landmarks') {
    latestLandmarks = data.landmarks;
  }
};

worker.postMessage({ type: 'init' });

// rVFC drives frame dispatch
videoEl.requestVideoFrameCallback(function onFrame(now, metadata) {
  const frame = new VideoFrame(videoEl);
  worker.postMessage({ type: 'frame', frame }, [frame]); // transfer, not copy
  videoEl.requestVideoFrameCallback(onFrame);
});
```

**Important constraints:**

- `VideoFrame` requires the page to be **cross-origin isolated** (see Section 8) because it uses `SharedArrayBuffer` internally in some browsers. You must serve with COOP + COEP headers.
- Fallback if `VideoFrame` is unavailable: `createImageBitmap(videoEl)` — this copies pixels but works without cross-origin isolation.
- The worker cannot access the DOM; it cannot call `document.createElement('canvas')`. Use `new OffscreenCanvas(w, h)` for any canvas operations inside the worker.
- `landmarker.detectForVideo()` requires the model to be fully initialized. The worker should not accept `frame` messages until `postMessage({ type: 'ready' })` has been sent.

**Sources:**
- [How to run @mediapipe/tasks-vision in a web worker — ankdev.me](https://ankdev.me/blog/how-to-run-mediapipe-task-vision-in-a-web-worker)
- [Hand landmarks detection guide for Web — Google AI Edge](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
- [OffscreenCanvas — speed up your canvas operations — web.dev](https://web.dev/articles/offscreen-canvas)
- [Real-Time Gesture Recognition in Videoconferencing — fishjam.io](https://fishjam.swmansion.com/blog/real-time-gesture-recognition-in-videoconferencing-4711855a1a53)

---

### 7. Decoupled Tracker/Renderer: Preventing Inference from Starving the Renderer

The key insight: inference runs at ~15-20fps (dictated by `rVFC` + model latency), rendering runs at 60fps (dictated by `rAF`). These are independent loops. The render loop always has a "latest known" set of landmarks and interpolates toward them each frame.

**Architecture sketch:**

```
VideoFrame dispatch (rVFC @ 30fps)
  |
  v
Worker inference @ ~15-20fps (async, fire-and-forget from main thread's perspective)
  |
  v
latestLandmarks updated (whenever worker responds)
  |
  v
rAF render loop @ 60fps:
  - drawVideoFrame to canvas
  - drawGrid(params)
  - for each landmark: interpolate position toward latestLandmarks[i]
  - drawBlob(interpolatedPos)
  - applyMosaicEffect(targetCells, interpolatedPos)
```

**Interpolation approach (lerp toward latest known position):**

```javascript
// Stored per landmark
const smoothed = landmarks.map(lm => ({ x: lm.x, y: lm.y }));

function renderLoop() {
  if (latestLandmarks.length > 0) {
    for (let i = 0; i < latestLandmarks.length; i++) {
      // lerp factor: higher = snappier, lower = smoother
      smoothed[i].x += (latestLandmarks[i].x - smoothed[i].x) * 0.35;
      smoothed[i].y += (latestLandmarks[i].y - smoothed[i].y) * 0.35;
    }
  }
  // draw using smoothed positions
  requestAnimationFrame(renderLoop);
}
```

**Rate management — throttling rVFC dispatch:**

If the worker is still processing a previous frame, do not queue up another:

```javascript
let workerBusy = false;

videoEl.requestVideoFrameCallback(function onFrame(now, metadata) {
  if (!workerBusy) {
    workerBusy = true;
    const frame = new VideoFrame(videoEl);
    worker.postMessage({ type: 'frame', frame }, [frame]);
  }
  videoEl.requestVideoFrameCallback(onFrame);
});

// In worker response handler:
worker.onmessage = ({ data }) => {
  if (data.type === 'landmarks') {
    latestLandmarks = data.landmarks;
    workerBusy = false; // allow next dispatch
  }
};
```

This naturally caps the inference rate to whatever the worker can sustain (typically 15-25fps on a modern laptop) while the renderer continues at 60fps.

**Sources:**
- [Achieving Sub-Frame Interpolation with GSAP and Web Workers — DEV Community](https://dev.to/hexshift/achieving-sub-frame-interpolation-with-gsap-and-web-workers-4a50)
- [Web Workers and Rendering Performance — Medium](https://medium.com/launch-school/what-are-web-workers-4a0e1ded7a67)

---

### 8. FPS Monitoring / Performance Overlay

**Lightweight rolling-average FPS counter:**

```javascript
class FpsMonitor {
  constructor(sampleWindow = 60) {
    this.times = [];
    this.sampleWindow = sampleWindow;
    this.fps = 0;
  }
  tick() {
    const now = performance.now();
    this.times.push(now);
    while (this.times.length > this.sampleWindow) this.times.shift();
    if (this.times.length < 2) return;
    const elapsed = this.times[this.times.length - 1] - this.times[0];
    this.fps = Math.round(((this.times.length - 1) / elapsed) * 1000);
  }
}

const renderFps = new FpsMonitor(30); // 30-frame rolling average
const trackerFps = new FpsMonitor(10);

// In rAF loop:
renderFps.tick();

// In worker response handler:
trackerFps.tick();
```

**On-canvas overlay (draw in rAF after all other layers):**

```javascript
function drawPerfOverlay(ctx) {
  ctx.save();
  ctx.font = '12px monospace';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(8, 8, 160, 36);
  ctx.fillStyle = '#00ff88';
  ctx.fillText(`Render: ${renderFps.fps} fps`, 14, 22);
  ctx.fillStyle = '#ffaa00';
  ctx.fillText(`Tracker: ${trackerFps.fps} fps`, 14, 38);
  ctx.restore();
}
```

Track both rates separately — seeing `Render: 60 | Tracker: 18` is normal and healthy. `Render: 28 | Tracker: 18` indicates main-thread pressure.

---

### 9. Browser Quirks: Safari, Chrome, Firefox

#### Chrome / Edge

- Full `VideoFrame` API support.
- `SharedArrayBuffer` available with COOP + COEP headers (Chrome 92+).
- `requestVideoFrameCallback` since Chrome 83.
- OffscreenCanvas since Chrome 69.
- Best WebAssembly performance; GPU delegate via WebGL works well.
- `navigator.mediaDevices.enumerateDevices()` returns labels only after permission granted.

#### Firefox

- `requestVideoFrameCallback` added in Firefox 132 (late 2024).
- Supports only fixed predefined resolutions in getUserMedia — avoid non-standard sizes.
- `SharedArrayBuffer` available with COOP + COEP.
- `VideoFrame` API available but less battle-tested for MediaPipe than Chrome.
- OffscreenCanvas since Firefox 105.
- GPU delegate for MediaPipe may fall back to CPU silently.

#### Safari / iOS Safari

- `requestVideoFrameCallback` since Safari 15.4 (March 2022) — safe to use.
- **`SharedArrayBuffer` requires COOP + COEP on Safari as well.** This gates multi-threaded WASM — MediaPipe's GPU delegate may be unavailable without these headers.
- `<video>` element requires `playsinline` attribute on iOS, otherwise the video opens fullscreen and cannot be drawn to canvas.
- getUserMedia available on iOS 14.3+ in WKWebView (required for Chrome/Firefox on iOS since they use WKWebView).
- OffscreenCanvas since Safari 16.4.
- Periodic re-prompt for camera permission is a known Safari iOS bug (even when permission was granted); handle `NotAllowedError` gracefully with a retry button.
- `deviceId` instability in some WebKit versions (bug 179220) — store label as fallback key.

**COOP + COEP headers — required for `VideoFrame` and multi-threaded WASM:**

For a Vite dev server, add to `vite.config.ts`:

```typescript
export default {
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
};
```

For Vercel (`vercel.json`):

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

**Note:** COEP `require-corp` blocks cross-origin resources that do not send `Cross-Origin-Resource-Policy` headers. The MediaPipe CDN (`cdn.jsdelivr.net`, `storage.googleapis.com`) does send these headers, so it is safe. Third-party scripts or fonts loaded without CORP headers will be blocked — audit all cross-origin resources if enabling these headers.

**Sources:**
- [SharedArrayBuffer updates — Chrome for Developers](https://developer.chrome.com/blog/enabling-shared-array-buffer)
- [COOP and COEP — web.dev](https://web.dev/articles/coop-coep)
- [The State of WebAssembly 2025-2026 — platform.uno](https://platform.uno/blog/the-state-of-webassembly-2025-2026/)
- [WebRTC Browser Support 2026 — antmedia.io](https://antmedia.io/webrtc-browser-support/)
- [GetUserMedia on iOS — copyprogramming.com](https://copyprogramming.com/howto/navigator-mediadevices-getusermedia-not-working-on-ios-12-safari)

---

## Recommended Approach

1. **Capture at 640x480, `ideal` framerate 30fps.** Use `ideal` for all constraints to avoid `OverconstrainedError` on Firefox or unconventional webcams.

2. **Persist `deviceId` in `localStorage`.** Re-enumerate on each load; validate that the saved device still exists before applying `{ exact: deviceId }`.

3. **Implement mirror mode as CSS `scaleX(-1)` on the display layer only.** Pass unmirrored `VideoFrame` to the inference worker — zero coordinate correction required.

4. **Use `requestVideoFrameCallback` to drive frame dispatch.** Only send a frame to the worker when the video has advanced and the worker is not busy (`workerBusy` flag). Fall back to `rAF` if rVFC is absent.

5. **Run MediaPipe `detectForVideo` in a dedicated Web Worker.** Transfer frames via `new VideoFrame(videoEl)` + `postMessage(..., [frame])`. Always call `frame.close()` in the worker after inference.

6. **Decouple render loop from inference.** `rAF` at 60fps reads `latestLandmarks` and lerps toward them each frame. Inference runs at whatever rate the worker can sustain (~15-20fps on modern hardware). This keeps the UI smooth even when the tracker is slow.

7. **Serve with COOP + COEP headers.** Required for `VideoFrame` transferable semantics and multi-threaded WASM across all browsers. Configure in `vite.config.ts` for dev and `vercel.json` / `netlify.toml` for production.

8. **Show a dual FPS overlay in dev mode** (render fps + tracker fps) to catch regressions early.

---

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| 1280x720 capture | Better visual quality for display | 3x pixel count vs 640x480, no ML accuracy gain, heavier per-frame work | Rejected for default; expose as option |
| `exact` constraints | Guarantees exact resolution | `OverconstrainedError` on Firefox + many webcams | Rejected |
| `rAF` instead of `rVFC` | No feature detection needed | Fires at display rate even when video hasn't advanced; wastes cycles | Rejected |
| Canvas `ctx.scale(-1,1)` mirror | Mirrored pixels available for recording | Landmarks need x-coordinate inversion (`1 - x`); adds complexity | Rejected for primary path |
| `createImageBitmap` for worker frames | No COOP/COEP required | Copies pixels (slower); `VideoFrame` is zero-copy | Use as fallback only |
| Inference on main thread | Simpler code | Blocks rAF; produces jank at >20ms inference time | Rejected |
| Synchronized tracker + render rate | Simple loop | Renderer blocked waiting for inference; caps at tracker fps | Rejected |

---

## Pitfalls and Edge Cases

- **`frame.close()` omission in worker** — `VideoFrame` holds GPU memory; forgetting to close causes memory leaks that crash the tab within minutes of operation.

- **Worker not ready when first frame arrives** — rVFC may fire before the worker finishes loading the MediaPipe WASM model (~1-3s). Guard with an `isReady` flag; discard frames until the worker sends `{ type: 'ready' }`.

- **iOS `<video>` fullscreen takeover** — Always set `playsinline` and `muted` attributes. In React: `<video playsInline muted autoPlay ref={videoRef} />`.

- **Firefox resolution rejection** — If requesting an unusual aspect ratio (e.g., 640x360), Firefox throws `OverconstrainedError`. Stick to 640x480 or 1280x720.

- **COEP blocks CDN resources** — After enabling COOP/COEP, test that MediaPipe WASM files, model files, and any fonts load correctly. CDN resources without `Cross-Origin-Resource-Policy: cross-origin` will be blocked.

- **Safari camera re-prompt bug** — Handle `NotAllowedError` with a Retry button; do not assume permission is permanent on iOS.

- **`enumerateDevices()` empty labels** — Always call `getUserMedia` (even with minimal constraints to trigger the permission prompt) before calling `enumerateDevices()`.

- **`deviceId` gone after cookie clear** — The app must gracefully fall back to default camera if `localStorage` contains a stale `deviceId` that no longer matches any device.

- **Mirror mode with canvas recording** — If a "record output" feature is added later, the recording canvas must apply `ctx.scale(-1,1)` explicitly since CSS transforms do not affect `canvas.captureStream()` output.

- **WASM thread count on Safari** — Even with COOP/COEP, Safari may limit WebAssembly thread counts. MediaPipe automatically falls back to single-threaded mode; no action required but may be slower.

---

## References

- [MDN: MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN: HTMLVideoElement.requestVideoFrameCallback()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback)
- [MDN: MediaDevices.enumerateDevices()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices)
- [web.dev: requestVideoFrameCallback — per-video-frame operations](https://web.dev/articles/requestvideoframecallback-rvfc)
- [web.dev: OffscreenCanvas — speed up canvas with Web Workers](https://web.dev/articles/offscreen-canvas)
- [web.dev: Making your site cross-origin isolated (COOP/COEP)](https://web.dev/articles/coop-coep)
- [Chrome for Developers: SharedArrayBuffer updates (COOP/COEP requirement)](https://developer.chrome.com/blog/enabling-shared-array-buffer)
- [Chrome for Developers: Choose cameras, microphones, and speakers](https://developer.chrome.com/blog/media-devices)
- [Google AI Edge: Hand Landmarker for Web JS](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
- [ankdev.me: How to run @mediapipe/tasks-vision in a Web Worker](https://ankdev.me/blog/how-to-run-mediapipe-task-vision-in-a-web-worker)
- [fishjam.io: Real-Time Gesture Recognition in Videoconferencing](https://fishjam.swmansion.com/blog/real-time-gesture-recognition-in-videoconferencing-4711855a1a53)
- [addpipe.com: getUserMedia Video Constraints](https://blog.addpipe.com/getusermedia-video-constraints/)
- [addpipe.com: Common getUserMedia() Errors](https://blog.addpipe.com/common-getusermedia-errors/)
- [addpipe.com: Getting Started With getUserMedia in 2026](https://blog.addpipe.com/getusermedia-getting-started/)
- [webrtcHacks: getUserMedia Resolutions III](https://webrtchacks.com/getusermedia-resolutions-3/)
- [xjavascript.com: Horizontally Flipping getUserMedia Webcam Stream](https://www.xjavascript.com/blog/horizontally-flipping-getusermedia-s-webcam-image-stream/)
- [WICG: video.requestVideoFrameCallback() spec](https://wicg.github.io/video-rvfc/)
- [platform.uno: The State of WebAssembly 2025-2026](https://platform.uno/blog/the-state-of-webassembly-2025-2026/)

---

## Gaps or Conflicts

- **Exact MediaPipe inference latency at 640x480 on modern laptop** — No measured benchmark found; the "15-20fps" figure is an estimate from practitioner reports. Should be profiled during development with the perf overlay.

- **`VideoFrame` transferable vs `createImageBitmap` performance delta** — No rigorous benchmark comparing the two approaches for this specific use case found in 2025/2026 sources. `VideoFrame` is theoretically zero-copy but the practical difference may be small at 640x480.

- **MediaPipe GPU delegate stability in workers** — Some GitHub issues report instability with the GPU delegate inside workers on Firefox. May need to test and potentially force CPU delegate on Firefox.

- **iOS Safari COOP/COEP + camera interaction** — Reports of camera permission becoming unreliable after COOP/COEP headers are added on iOS. Needs explicit testing on an iOS device during development.
