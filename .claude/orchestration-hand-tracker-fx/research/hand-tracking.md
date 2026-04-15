# In-Browser Hand Tracking - Research

**Wave**: First
**Researcher**: Web research specialist subagent
**Date**: 2026-04-14
**Status**: Complete

---

## Summary

MediaPipe Tasks Vision `HandLandmarker` (package `@mediapipe/tasks-vision`, latest v0.10.34) is the clear choice for this project: it is actively maintained by Google, runs entirely in the browser via WebAssembly + WebGL GPU delegation, detects up to 2 hands with 21 normalized landmarks each at 30-60 FPS on MacBook-class hardware, and is Apache 2.0 licensed. All serious alternatives are either unmaintained (Handsfree.js archived February 2022), dormant (TF.js hand-pose-detection v2.0.1 last published 2023), or off-topic (WebXR hand tracking, 8th Wall paid). The main practical pitfall is that running MediaPipe in a true Web Worker requires non-trivial hacks (classic worker + patched bundle); for a creative canvas app, main-thread inference via `requestAnimationFrame` is the pragmatic path.

---

## Key Findings

### 1. MediaPipe Tasks Vision HandLandmarker

#### Package

| Field | Value |
|-------|-------|
| npm package | `@mediapipe/tasks-vision` |
| Latest npm version | **0.10.34** (as of April 2026; jsDelivr confirms) |
| Last npm publish | Active — released March 2025 per GitHub releases |
| License | Apache 2.0 (code) / CC BY 4.0 (documentation) |
| Install | `npm install @mediapipe/tasks-vision` |

Note: There was a known lag between GitHub releases and npm publishes (issue #6098, closed). As of 0.10.34 this was resolved.

#### CDN / WASM URLs

```
# ES module bundle
https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs

# CJS bundle
https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js

# WASM directory (used in FilesetResolver)
https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm
```

#### WASM Bundle Contents (v0.10.34)

The `/wasm/` directory ships six files (~22 MB total uncompressed):

| File | Size |
|------|------|
| `vision_wasm_internal.js` | 316 KB |
| `vision_wasm_internal.wasm` | 10.98 MB (SIMD) |
| `vision_wasm_module_internal.js` | 315.93 KB |
| `vision_wasm_module_internal.wasm` | 10.98 MB (SIMD module variant) |
| `vision_wasm_nosimd_internal.js` | 315.8 KB |
| `vision_wasm_nosimd_internal.wasm` | 10.21 MB (no-SIMD fallback) |

The library auto-selects SIMD vs. no-SIMD based on browser capability.

#### Model File

| Field | Value |
|-------|-------|
| Download URL | `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task` |
| File size | **7.82 MB** (content-length from HTTP headers: 7,819,105 bytes) |
| Format | float16 TFLite task bundle (palm detector + hand landmark model) |
| Last modified | April 26, 2023 (the model itself is stable; no new float16 bundle since) |

#### TypeScript API Shape

```typescript
// Main factory
HandLandmarker.createFromOptions(
  wasmFileset: WasmFileset,
  options: HandLandmarkerOptions
): Promise<HandLandmarker>

// Options
interface HandLandmarkerOptions extends VisionTaskOptions {
  numHands?: number;                    // default: 1
  minHandDetectionConfidence?: number;  // default: 0.5, range [0,1]
  minHandPresenceConfidence?: number;   // default: 0.5, range [0,1]
  minTrackingConfidence?: number;       // default: 0.5, range [0,1]
  // baseOptions.delegate: "GPU" | "CPU"
  // baseOptions.modelAssetPath: string
  // runningMode: "IMAGE" | "VIDEO"
}

// Single-frame inference (static images)
handLandmarker.detect(image: ImageSource): HandLandmarkerResult

// Video/webcam inference (requires monotonic timestamps)
handLandmarker.detectForVideo(
  videoFrame: ImageSource,
  timestamp: number,          // performance.now()
  imageProcessingOptions?: ImageProcessingOptions
): HandLandmarkerResult

// Result shape
interface HandLandmarkerResult {
  landmarks: NormalizedLandmark[][];   // [handIndex][landmarkIndex]
  worldLandmarks: Landmark[][];        // [handIndex][landmarkIndex]
  handednesses: Category[][];          // [handIndex][categoryIndex]
}

interface NormalizedLandmark {
  x: number;   // normalized [0,1] by image width
  y: number;   // normalized [0,1] by image height
  z: number;   // normalized depth, relative to wrist; smaller = closer to camera
  visibility?: number;
}

interface Landmark {
  x: number;   // real-world meters, origin = hand geometric center
  y: number;
  z: number;
}

interface Category {
  score: number;        // confidence [0,1]
  categoryName: string; // "Left" | "Right"
  index: number;
  displayName: string;
}

// Static utility
HandLandmarker.HAND_CONNECTIONS: Connection[]  // 21 connections for drawConnectors
```

`ImageSource` accepts `HTMLVideoElement`, `HTMLImageElement`, `HTMLCanvasElement`, `ImageBitmap`, `ImageData`.

---

### 2. Landmark Schema — All 21 Points

The 21 hand keypoints are consistent across all MediaPipe hand tracking APIs:

```
Index  Name                   Anatomy
-----  ---------------------  ----------------------------------
  0    WRIST                  Wrist base
  1    THUMB_CMC              Thumb carpometacarpal joint
  2    THUMB_MCP              Thumb metacarpophalangeal joint
  3    THUMB_IP               Thumb interphalangeal joint
  4    THUMB_TIP              Thumb fingertip         *FINGERTIP*
  5    INDEX_FINGER_MCP       Index knuckle (base)
  6    INDEX_FINGER_PIP       Index proximal joint
  7    INDEX_FINGER_DIP       Index distal joint
  8    INDEX_FINGER_TIP       Index fingertip          *FINGERTIP*
  9    MIDDLE_FINGER_MCP      Middle knuckle (base)
 10    MIDDLE_FINGER_PIP      Middle proximal joint
 11    MIDDLE_FINGER_DIP      Middle distal joint
 12    MIDDLE_FINGER_TIP      Middle fingertip         *FINGERTIP*
 13    RING_FINGER_MCP        Ring knuckle (base)
 14    RING_FINGER_PIP        Ring proximal joint
 15    RING_FINGER_DIP        Ring distal joint
 16    RING_FINGER_TIP        Ring fingertip           *FINGERTIP*
 17    PINKY_MCP              Pinky knuckle (base)
 18    PINKY_PIP              Pinky proximal joint
 19    PINKY_DIP              Pinky distal joint
 20    PINKY_TIP              Pinky fingertip          *FINGERTIP*
```

**Fingertip indices: 4, 8, 12, 16, 20**

**Coordinate space:**
- `landmarks` (NormalizedLandmark): `x` and `y` are normalized to `[0.0, 1.0]` by image width/height. `(0,0)` is top-left, `(1,1)` is bottom-right. `z` is normalized depth with the wrist depth as reference — negative = closer to camera than wrist.
- `worldLandmarks` (Landmark): metric 3D coordinates in meters. Origin is the hand's geometric center (not the wrist). Useful for computing hand scale or 3D rotation; less useful for 2D screen mapping.

For this project (overlaying landmarks on video canvas), use `landmarks` exclusively.

---

### 3. Performance and FPS

**Official benchmark (Pixel 6, Google)**:

| Metric | CPU | GPU |
|--------|-----|-----|
| Inference latency | 17.12 ms | 12.27 ms |

**Real-world browser observations (community reports)**:

| Hardware | Conditions | FPS |
|----------|------------|-----|
| 2017 Toshiba i7 laptop (GPU delegation) | 2 hands, browser | ~25 FPS |
| 2019 Pixel 3 smartphone | 2 hands, browser | ~20 FPS |
| Modern MacBook (GPU delegation, 1 hand) | 30 FPS webcam, standard resolution | 30-60 FPS |
| Any browser, CPU-only fallback | | 10-15 FPS |

**Resolution notes**: MediaPipe internally resizes input to 256×256 px for the palm detector stage, so 640×480 vs. 720p makes no material difference to model accuracy or speed. 720p is the sweet spot for webcam quality without wasteful upscaling.

**Key insight**: GPU delegation (`delegate: "GPU"` in `baseOptions`) is essential for smooth performance. With GPU: 12 ms latency (~83 FPS ceiling). Without GPU: 17 ms (~59 FPS ceiling), but real-world is 10-15 FPS on many machines due to WebGL overhead. Always set `delegate: "GPU"` and degrade to `"CPU"` only on error.

---

### 4. Number of Hands and Confidence Tuning

- `numHands`: any integer > 0; practical max is 2 (diminishing returns + latency cost per additional hand)
- Detection pipeline: two-stage — palm detector runs at full speed on every frame; landmark model only runs inside detected palm ROI. This is why tracking is fast once detected.
- `minHandDetectionConfidence` (0.5 default): affects palm detection stage. Lower = more sensitivity, more false positives.
- `minHandPresenceConfidence` (0.5 default): filters per-frame hand presence within a tracked region.
- `minTrackingConfidence` (0.5 default): if tracking score drops below this, detector re-runs from scratch (slower). Raise to 0.7-0.8 for stable tracked hands; lower for fast-moving hands.

For this project: `numHands: 2`, defaults on confidence, `delegate: "GPU"`.

---

### 5. Running Off Main Thread (Web Worker)

**Status: Technically possible, practically painful.**

MediaPipe `@mediapipe/tasks-vision` uses `importScripts()` internally, which is incompatible with ES module workers (`type: "module"`). This is a known open issue with no official fix as of April 2026 (issues #4694, #5257, #5479, #5527 on google-ai-edge/mediapipe).

**Workaround that works** (from ankdev.me):
1. Download the tasks-vision bundle
2. Replace ES6 export statements with a single CommonJS-compatible global object assignment
3. Serve the patched file locally (e.g., `/public/mediapipe.js`)
4. Use a **classic** worker (`new Worker("/worker.js")` with no `{ type: "module" }`)
5. Call `importScripts('/mediapipe.js')` inside the worker
6. Pass video frames as `ImageBitmap` via `createImageBitmap(videoEl)` + `postMessage`

**Additional constraint**: If the result includes WebGL textures (e.g., from segmentation tasks), those cannot be `postMessage`-cloned. For HandLandmarker specifically, the `landmarks` result is plain JS arrays — those CAN be transferred safely.

**Recommendation for this project**: Start on main thread with `requestAnimationFrame`. The inference loop at 30 FPS costs ~12-17 ms per frame, leaving ~17 ms for rendering in a 30 FPS budget (33 ms/frame). This is sufficient for the canvas overlay use case. Move to a worker only if jank is observed in practice.

---

### 6. TensorFlow.js `@tensorflow-models/hand-pose-detection`

- **Package**: `@tensorflow-models/hand-pose-detection`
- **Latest version**: 2.0.1
- **Last published**: 2023 (approximately 2+ years ago as of April 2026)
- **Status**: No official deprecation notice, but no active maintenance. The underlying MediaPipe Hands backend it wraps is the same model, but the wrapper adds TFJS overhead. No updates in 2+ years.
- **Landmark schema**: Same 21-point schema, but coordinates differ by backend:
  - `MediaPipeHandsMediaPipeEstimationConfig`: returns landmarks in normalized `[0,1]` and world coordinates in meters
  - `MediaPipeHandsTfjsEstimationConfig`: returns pixel-space coordinates
- **Verdict**: Do not use. It wraps the same model as `@mediapipe/tasks-vision` but with more overhead and no maintenance. The legacy `@tensorflow-models/handpose` (single hand only, 21 points) is even older.

---

### 7. Handsfree.js

- **Package**: `handsfree`
- **Latest version**: 8.5.1
- **Status**: **Archived February 28, 2022.** The creator explicitly archived the repository to focus on employment. Direct quote from the repository: *"I'm archiving this project because I would like to try and find a job and use it on my portfolio, but I don't want people to use it without realizing that there is no more support."*
- **Verdict**: Do not use. Dead project, no security updates, no compatibility fixes.

---

### 8. Other Alternatives Considered

**WebAR.rocks.hand** (github.com/WebAR-rocks/WebAR.rocks.hand)
- Lightweight WebGL-based neural network hand detector
- Not based on MediaPipe; uses a custom AR-focused model
- Fewer landmarks (not the standard 21-point schema)
- Primarily marketed for AR overlays (rings, bracelets, etc.)
- Smaller ecosystem, less documentation
- Verdict: Rejected — non-standard schema, AR-focused, not suited for the full 21-point tracking needed for this project

**8th Wall Hand Tracking**
- Commercial/paid platform for WebAR
- 36 attachment points (more than MediaPipe's 21)
- Requires 8th Wall subscription
- Verdict: Rejected — paid, vendor lock-in

**WebXR Hand Tracking API** (native browser API)
- Only available when running in a WebXR session (VR/AR headset required)
- Not available for desktop webcam use
- Verdict: Rejected — wrong use case

**Fingerpose** (github.com/andypotato/fingerpose)
- Not a tracker — a gesture classifier that operates on top of MediaPipe hand landmarks
- Single-hand only (v0.1.0)
- Useful as a layer on top of MediaPipe if gesture classification is needed later
- Verdict: Out of scope for MVP, but worth noting as a potential addition

**handtrack.js** (github.com/victordibia/handtrack.js)
- Bounding-box-only detection (no landmarks)
- Based on older SSD MobileNet
- Verdict: Rejected — no landmark data, bounding box only

---

## Recommended Approach

1. **Use `@mediapipe/tasks-vision` v0.10.34** as the sole hand tracking library. No other library meets the requirements.
2. **Run on main thread** using `requestAnimationFrame` for the inference loop. Do not attempt web worker integration unless profiling shows actual jank.
3. **Enable GPU delegation** (`baseOptions: { delegate: "GPU" }`) and catch errors to fall back to CPU silently.
4. **Set `numHands: 2`** with default confidence thresholds (0.5 each); expose these in the parameters panel as documented in the PRD.
5. **Load WASM from CDN** (`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm`) during development; consider bundling model + WASM locally for production to avoid CDN dependency.
6. **Use `runningMode: "VIDEO"`** with `detectForVideo(videoEl, performance.now())` for webcam input.
7. **Use `landmarks` (NormalizedLandmark), not `worldLandmarks`**, for 2D canvas overlay. Coordinates are already in `[0,1]` screen space — multiply by canvas width/height to get pixel positions.

---

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| `@mediapipe/tasks-vision` HandLandmarker | Maintained by Google, 21 landmarks, GPU WASM, Apache 2.0, 30-60 FPS, 2-hand support | 7.8 MB model + ~11 MB WASM bundle | **Recommended** |
| `@tensorflow-models/hand-pose-detection` | Same 21-point model underneath, familiar TFJS API | No updates since 2023, extra TFJS overhead, pixel-space coords require conversion | Rejected |
| Handsfree.js | Multi-modal (hand + face + pose), beginner-friendly | Archived Feb 2022, no support | Rejected |
| WebAR.rocks.hand | Lightweight, WebGL-native | Non-standard landmarks, AR-focused, small ecosystem | Rejected |
| 8th Wall | 36 attachment points, commercial-grade | Paid subscription required | Rejected |
| WebXR Hand Tracking | Native browser API, no library needed | Requires VR/AR headset, not webcam-compatible | Rejected |

---

## Code Examples

### Initialization

```typescript
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let handLandmarker: HandLandmarker;

async function initHandLandmarker(): Promise<void> {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}
```

### Single-Frame Inference Call

```typescript
// Called inside a requestAnimationFrame loop
function detectFrame(videoEl: HTMLVideoElement): void {
  if (videoEl.readyState < 2) return; // HAVE_CURRENT_DATA not yet available

  const result = handLandmarker.detectForVideo(videoEl, performance.now());

  // result.landmarks: NormalizedLandmark[][]  — one array per detected hand
  // result.handednesses: Category[][]         — one Category per hand
  // result.worldLandmarks: Landmark[][]       — metric 3D, rarely needed for 2D overlay
}
```

### Extracting Normalized (x, y) Fingertip Coordinates

```typescript
const FINGERTIP_INDICES = [4, 8, 12, 16, 20]; // thumb, index, middle, ring, pinky

interface FingertipPoint {
  handIndex: number;
  landmarkIndex: number;
  label: string;
  x: number; // normalized [0,1], 0 = left edge of video frame
  y: number; // normalized [0,1], 0 = top edge of video frame
  z: number; // normalized depth (negative = closer to camera)
}

const FINGERTIP_LABELS = ["THUMB_TIP", "INDEX_TIP", "MIDDLE_TIP", "RING_TIP", "PINKY_TIP"];

function extractFingertips(
  result: HandLandmarkerResult
): FingertipPoint[] {
  const points: FingertipPoint[] = [];

  result.landmarks.forEach((handLandmarks, handIndex) => {
    FINGERTIP_INDICES.forEach((landmarkIndex, i) => {
      const lm = handLandmarks[landmarkIndex];
      points.push({
        handIndex,
        landmarkIndex,
        label: FINGERTIP_LABELS[i],
        x: lm.x,   // already normalized [0,1]
        y: lm.y,   // already normalized [0,1]
        z: lm.z,
      });
    });
  });

  return points;
}

// Usage — convert to canvas pixel coordinates:
function drawFingertips(
  ctx: CanvasRenderingContext2D,
  fingertips: FingertipPoint[],
  canvasWidth: number,
  canvasHeight: number
): void {
  fingertips.forEach(({ x, y, label }) => {
    const px = x * canvasWidth;
    const py = y * canvasHeight;

    // Dotted circle (matching PRD reference)
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = "white";
    ctx.stroke();
    ctx.setLineDash([]);

    // Coordinate label
    ctx.fillStyle = "white";
    ctx.font = "10px monospace";
    ctx.fillText(
      `(${x.toFixed(3)}, ${y.toFixed(3)})`,
      px + 10,
      py - 4
    );
  });
}
```

### Full RAF Loop (Main Thread Pattern)

```typescript
let rafId: number;

function startTrackingLoop(
  videoEl: HTMLVideoElement,
  canvasEl: HTMLCanvasElement
): void {
  const ctx = canvasEl.getContext("2d")!;

  function loop(): void {
    if (videoEl.readyState >= 2) {
      const result = handLandmarker.detectForVideo(videoEl, performance.now());
      const fingertips = extractFingertips(result);

      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      drawFingertips(ctx, fingertips, canvasEl.width, canvasEl.height);
    }
    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame(loop);
}

function stopTrackingLoop(): void {
  cancelAnimationFrame(rafId);
}
```

### Mirror Mode Correction

When the video is mirrored (selfie mode via `transform: scaleX(-1)` on the video element), the raw landmark `x` is flipped. To draw correctly on a mirrored canvas:

```typescript
// Option A: mirror the canvas element via CSS (no coordinate change needed)
// canvas { transform: scaleX(-1); }

// Option B: flip x in code
const mirroredX = 1 - lm.x;
```

---

## Pitfalls and Edge Cases

- **WASM cold-start latency**: The first `FilesetResolver.forVisionTasks()` call fetches ~11 MB of WASM. Show a loading indicator. Cache the landmarker instance across component re-renders (module-level or ref).

- **`runningMode` mismatch**: If you initialize with `runningMode: "IMAGE"` and call `detectForVideo`, or vice versa, MediaPipe throws. Use `"VIDEO"` for webcam input throughout.

- **Monotonically increasing timestamps**: `detectForVideo` requires each call's timestamp to be greater than the previous one. Always use `performance.now()` — never `Date.now()` or a frame counter.

- **Video `readyState`**: Always check `videoEl.readyState >= 2` (HAVE_CURRENT_DATA) before calling `detectForVideo`. Calling it on an unloaded video throws silently or returns empty results.

- **Multiple hands index stability**: With `numHands: 2`, the `result.landmarks[0]` and `[1]` hand indices can swap between frames if hands cross. Use `result.handednesses[i][0].categoryName` ("Left"/"Right") to stabilize assignment.

- **Mirror mode coordinates**: MediaPipe reports coordinates in the raw camera frame. If the video element is CSS-mirrored (common for selfie-style webcam), the x-axis is reversed. Either flip x in code (`1 - lm.x`) or mirror the overlay canvas via CSS. Do not do both.

- **Vite + WASM setup**: Vite handles WASM files well without special config. Avoid importing the `.wasm` file directly — always let `FilesetResolver` fetch it from CDN or `/public/`. Direct imports would require `?url` suffix and Vite plugin configuration.

- **Web Worker (ESM incompatibility)**: `@mediapipe/tasks-vision` uses `importScripts` internally. Module workers (`{ type: "module" }`) fail. If you must use a worker: use a classic worker with a locally patched bundle (see Web Worker section above). This is not recommended for MVP.

- **GPU delegate fallback**: On some systems (older iGPUs, certain mobile browsers), GPU delegation throws or silently produces no results. Wrap `createFromOptions` in a try/catch and retry with `delegate: "CPU"`.

- **CORS for model file**: If self-hosting the `.task` model file, ensure the server sends `Access-Control-Allow-Origin: *`. The Google Storage CDN URL has CORS open; the jsDelivr WASM URL also has CORS open.

- **iOS Safari**: Web Workers + MediaPipe have additional issues on iOS 17 (issue #5292). For desktop-only deployment this is not a concern.

---

## References

- [MediaPipe HandLandmarker Web Guide (Google AI Edge)](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
- [HandLandmarker API Reference (JS)](https://ai.google.dev/edge/api/mediapipe/js/tasks-vision.handlandmarker)
- [HandLandmarker Overview + Benchmarks](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
- [@mediapipe/tasks-vision on npm](https://www.npmjs.com/package/@mediapipe/tasks-vision)
- [@mediapipe/tasks-vision on jsDelivr (v0.10.34)](https://www.jsdelivr.com/package/npm/@mediapipe/tasks-vision)
- [google-ai-edge/mediapipe GitHub Releases](https://github.com/google-ai-edge/mediapipe/releases)
- [How to run @mediapipe/tasks-vision in a web worker (ankdev.me)](https://ankdev.me/blog/how-to-run-mediapipe-task-vision-in-a-web-worker)
- [Web Worker + module incompatibility issue #4694](https://github.com/google-ai-edge/mediapipe/issues/4694)
- [Web Worker module worker issue #5257](https://github.com/google-ai-edge/mediapipe/issues/5257)
- [NPM releases lag issue #6098](https://github.com/google-ai-edge/mediapipe/issues/6098)
- [MediaPipe HandLandmarker in React (DEV.to)](https://dev.to/kiyo/integrating-mediapipetasks-vision-for-hand-landmark-detection-in-react-2lbg)
- [Official HandLandmarker web CodePen demo](https://codepen.io/mediapipe-preview/pen/gOKBGPN)
- [MediaPipe Gist (yyunkuo) - full vanilla JS example](https://gist.github.com/yyunkuo/f024e5ef38cceb7a35ae7b99d46557d2)
- [Creating a 3D Hand Controller with MediaPipe + Three.js (Codrops, Oct 2024)](https://tympanus.net/codrops/2024/10/24/creating-a-3d-hand-controller-using-a-webcam-with-mediapipe-and-three-js/)
- [Hand tracking in browser with MediaPipe (Towards Data Science)](https://towardsdatascience.com/exquisite-hand-and-finger-tracking-in-web-browsers-with-mediapipes-machine-learning-models-2c4c2beee5df/)
- [Best Gesture Recognition Libraries JS 2025 (portalZINE)](https://portalzine.de/best-gesture-recognition-libraries-in-javascript-2025/)
- [Handsfree.js archived notice (GitHub - CreativeInquiry/handsfree)](https://github.com/CreativeInquiry/handsfree)
- [@tensorflow-models/hand-pose-detection (npm)](https://www.npmjs.com/package/@tensorflow-models/hand-pose-detection)
- [MediaPipe Hand Landmark Enums (andrewallbright.com)](https://andrewallbright.com/possibly-useful-enums-for-mediapipe-hand-and-pose-landmarker-model/)
- [worldLandmarks coordinate system clarification (Google AI Developers Forum)](https://discuss.ai.google.dev/t/clarification-on-the-world-landmark-coordinates-of-the-mediapipe-hand-landmarker/86489)
- [Model file size verification via HTTP headers](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task)

---

## Second Wave Additions (if applicable)

### Implementation Details

_Not yet filtered by DISCOVERY.md — populate after Discovery phase._

Key implementation questions still open:
- Vite vs. Next.js: affects how to import WASM (Vite handles well; Next.js needs `next.config.js` WASM plugin or CDN-only approach to avoid SSR issues)
- Should the model `.task` file be vendored in `/public/` or always fetched from Google Storage CDN? (CDN = simpler, vendor = offline + no CORS risk)
- Canvas 2D vs. WebGL for the mosaic: MediaPipe only touches the landmark inference loop; rendering is separate. No coupling issue.

### Tool and MCP Configuration

| Tool/Service | Purpose | Setup Required | Agent Can Self-Configure? |
|-------------|---------|----------------|---------------------------|
| `@mediapipe/tasks-vision` npm | Hand tracking inference | `npm install` | Yes |
| Google Storage CDN | `hand_landmarker.task` model file | None (public URL) | Yes |
| jsDelivr CDN | WASM bundle delivery | None (public URL) | Yes |

### Testing Strategy

- Test assets needed: short pre-recorded video clip with visible hand(s), or use webcam in test environment
- Simulated inputs: `HTMLVideoElement` with `srcObject` from `getUserMedia`, or `HTMLImageElement` with a test hand photo
- User flows to verify:
  1. Load app → WASM initializes → no console errors
  2. Point hand at webcam → 21 landmark dots appear on overlay canvas
  3. Move fingers → coordinates update in real time at ≥24 FPS
  4. Two hands in frame → both tracked simultaneously
  5. Remove hand from frame → overlay clears (no stale landmarks)
  6. `minHandDetectionConfidence` slider change → detection sensitivity responds

### Human Actions Required

| Action | Who | How | Status |
|--------|-----|-----|--------|
| Grant webcam permission in browser | User | Browser prompt on first load | Pending |
| None — all libraries are public CDN / npm | — | — | N/A |
