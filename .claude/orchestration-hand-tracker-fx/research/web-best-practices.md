# Web Best Practices (2026) - Research

**Wave**: First
**Researcher**: Web research specialist subagent
**Date**: 2026-04-14
**Status**: Complete

---

## Summary

A creative webcam app in 2026 requires careful attention to 10 cross-cutting concerns that are orthogonal to the feature work: permission UX, security headers, accessibility for visual-first experiences, error resilience, graceful rendering degradation, HTTPS in dev, privacy communication, performance budgets, PWA offline behavior, and analytics posture. Research across MDN, web.dev, Google AI Edge, and community sources yields concrete patterns for each. The most critical surprises are: (1) COOP + COEP headers are required for MediaPipe's multi-threaded WASM, not just a nice-to-have; (2) canvas accessibility requires explicit ARIA attributes since canvas content is invisible to the DOM; and (3) INP replaces FID as the key responsiveness metric in 2025, and heavy main-thread animation loops directly threaten it.

---

## Key Findings

### 1. Webcam Permissions UX

#### Pre-Prompt Pattern (Highly Recommended)
Do not call `getUserMedia()` on page load. The browser permission prompt is generic and provides no context. The recommended pattern is:

1. Show an in-app "Allow camera" screen first that explains *why* the camera is needed.
2. Only on explicit user action (button click) call `getUserMedia()`.
3. Use the Permissions API to check current state before prompting:

```javascript
const status = await navigator.permissions.query({ name: 'camera' });
// status.state: 'granted' | 'denied' | 'prompt'
status.addEventListener('change', () => { /* re-evaluate UI */ });
```

The Permissions API does **not** trigger a browser prompt — it only reads state. Only `getUserMedia()` triggers the prompt. This lets you skip the pre-prompt screen if permission is already `'granted'`.

#### Error Names (Canonical Cross-Browser List)
`getUserMedia()` rejects with a `DOMException`. The `name` property is the discrimination key:

| Error Name | Cause | Recovery Action |
|---|---|---|
| `NotAllowedError` | User denied, or HTTP context, or Permissions-Policy blocked | Show "enable camera in browser settings" with browser-specific screenshot |
| `NotFoundError` | No camera device found | Show "no camera detected" message |
| `NotReadableError` | Camera in use by another app (hardware error) | Ask user to close other apps, retry button |
| `OverconstrainedError` | Requested resolution/constraints unsupported | Retry with relaxed constraints |
| `AbortError` | Hardware exists but unspecified OS error | Generic retry |
| `TypeError` | Called from HTTP (not HTTPS), or empty constraints | Dev-time guard; enforce HTTPS |
| `SecurityError` | `getUserMedia` disabled on Document | Inform user; no recovery possible |

**Cross-browser note**: Chrome/Edge use `NotAllowedError` consistently. Safari's permissions are less persistent — they expire per session by default, unlike Chrome which persists per domain.

#### Permission Denied Recovery Flow
When `name === 'NotAllowedError'`:
1. Render a dedicated error state (not a modal — replace the whole camera preview area).
2. Show browser-specific instructions: "In Chrome: click the camera icon in the address bar → Allow."
3. Provide a "Try again" button that re-calls `getUserMedia()`.
4. Monitor `permissionStatus.onchange` to automatically recover when the user unblocks in settings.

#### Device Disconnection / Mid-Session Loss
Handle the `MediaStreamTrack` `'ended'` event:
```javascript
stream.getVideoTracks()[0].addEventListener('ended', handleCameraLost);
```
This fires when the user physically disconnects a webcam mid-session.

---

### 2. Security Headers

#### Required Headers for a Webcam App

**Cross-Origin Isolation (COOP + COEP) — Critical for MediaPipe**

MediaPipe's WASM runtime uses `SharedArrayBuffer` for multi-threading. `SharedArrayBuffer` requires cross-origin isolation. Without these headers, MediaPipe may silently fall back to single-threaded mode or fail.

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Detection in code:
```javascript
if (!crossOriginIsolated) {
  console.warn('SharedArrayBuffer not available — MediaPipe may run slower');
}
```

**Permissions-Policy — Camera**

Since this app *requires* camera, restrict all other powerful features:
```
Permissions-Policy: camera=(self), microphone=(), geolocation=(), fullscreen=(self)
```

This tells the browser only `self` origin can request camera. A secondary benefit: if an XSS attacker injects script, they cannot activate camera/microphone for other origins.

**Content Security Policy**

For a fully client-side static app:
```
Content-Security-Policy: default-src 'self'; 
  script-src 'self' 'wasm-unsafe-eval'; 
  style-src 'self' 'unsafe-inline'; 
  connect-src 'self' https://storage.googleapis.com https://cdn.jsdelivr.net;
  worker-src 'self' blob:;
  img-src 'self' data: blob:
```

Key notes:
- `'wasm-unsafe-eval'` is required for WebAssembly execution (replaces `'unsafe-eval'` for WASM in modern CSP).
- `worker-src blob:` allows WASM workers spawned by MediaPipe.
- `connect-src` must include CDN origins if loading the model from CDN on first use.
- If self-hosting the model file (recommended for offline), remove the CDN `connect-src` entries.

**Additional Headers (Static Host)**
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
```

---

### 3. Accessibility

#### Canvas is a Black Box to the DOM
The `<canvas>` element renders pixels — nothing inside it is accessible by default. Explicit ARIA work is mandatory.

**Minimum viable pattern:**
```html
<canvas
  id="fx-canvas"
  role="img"
  aria-label="Live hand tracking effect — grid overlay with pixelation on detected hand regions"
  aria-live="polite"
  tabindex="0"
>
  <!-- Fallback for no-canvas browsers -->
  <p>Live hand tracking visual effect. Enable a modern browser with canvas support to view.</p>
</canvas>
```

`role="img"` + `aria-label` makes the canvas accessible via screen reader image navigation. Using `role="img"` on the element itself (not just fallback content) is preferred because it creates a larger accessible focus area.

**Keyboard Controls**
Every interactive control in the parameters panel must be keyboard operable:
- Sliders: standard `<input type="range">` is natively keyboard accessible.
- Custom buttons: ensure `tabindex="0"` and keydown handlers for Enter/Space.
- Focus ring must remain visible during canvas animation — the moving visual can obscure or cover the focus indicator on nearby elements.

**WCAG 2.2 Criterion 2.2.2 — Pause, Stop, Hide**
Any blinking, flashing, or moving content that runs for more than 5 seconds must have a pause/stop control. This applies to the live canvas effect.

Minimum implementation: a "Pause" button that stops the rendering loop. This also serves as a fallback for users on low-power devices.

#### prefers-reduced-motion

The OS accessibility setting "reduce motion" maps to this media query. Users who enable it may experience dizziness or disorientation from animated content.

**CSS:**
```css
@media (prefers-reduced-motion: reduce) {
  /* Hide or freeze non-essential animations */
  .animated-ui-element { animation: none; transition: none; }
}
```

**JavaScript (for canvas rendering loop):**
```javascript
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReduced) {
  // Freeze grid animation; still render static frame
  cancelAnimationFrame(rafId);
}
// Also listen for runtime changes
window.matchMedia('(prefers-reduced-motion: reduce)')
  .addEventListener('change', e => { if (e.matches) pauseEffect(); });
```

Recommended approach: **default to reduced animation unless the user explicitly opts in** — particularly for the mosaic flicker/animation component.

#### Screen Reader Live Region for Coordinate Readouts
The normalized (x, y) coordinate labels update every frame. If rendered only on canvas they are invisible to AT. A visually-hidden live region can announce updates at a reasonable rate:

```html
<div aria-live="polite" aria-atomic="true" class="sr-only">
  Hand detected at position 0.421, 0.318
</div>
```

Update this element at ~1fps (throttled), not 30fps, to avoid overwhelming screen reader users.

---

### 4. Error Boundaries + Unhandled Rejection Handling

#### React Error Boundaries with `react-error-boundary`

The `react-error-boundary` library (npm: `react-error-boundary`) is the de facto standard. It provides the `ErrorBoundary` component plus `useErrorBoundary` hook for async bridging.

**Placement strategy for this app:**
```
<AppErrorBoundary>          ← catches total app crash
  <PermissionErrorBoundary> ← catches camera/permission failures
  <CanvasErrorBoundary>     ← catches render loop / WebGL failures
    <Canvas />
  </CanvasErrorBoundary>
  <TrackingErrorBoundary>   ← catches MediaPipe model load failures
    <HandTracker />
  </TrackingErrorBoundary>
  <ParametersPanel />       ← low risk; no boundary needed
</AppErrorBoundary>
```

**`resetKeys` pattern for retrying camera:**
```jsx
const [retryKey, setRetryKey] = useState(0);
<ErrorBoundary
  FallbackComponent={CameraErrorFallback}
  resetKeys={[retryKey]}
  onReset={() => setRetryKey(k => k + 1)}
>
  <CameraCapture />
</ErrorBoundary>
```

#### What Error Boundaries CANNOT Catch
Error boundaries do not catch:
- Async errors (Promise rejections, setTimeout, event handlers)
- Errors in the error boundary component itself

**Global handler for unhandled Promise rejections:**
```javascript
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
  // Optionally push into React state to trigger a boundary
  event.preventDefault(); // Suppress browser console noise
});

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});
```

**Bridging async to boundary via `useErrorBoundary`:**
```javascript
const { showBoundary } = useErrorBoundary();

useEffect(() => {
  loadMediaPipeModel()
    .catch(showBoundary); // Any rejection triggers the nearest boundary
}, []);
```

---

### 5. Graceful Degradation

#### WebGL Unavailable
Detect before committing to a WebGL rendering path:

```javascript
function detectWebGL(): 'webgl2' | 'webgl' | 'none' {
  const canvas = document.createElement('canvas');
  if (canvas.getContext('webgl2')) return 'webgl2';
  if (canvas.getContext('webgl')) return 'webgl';
  return 'none';
}
```

**Fallback hierarchy:**
1. `webgl2` → Full mosaic shader (preferred)
2. `webgl` → Mosaic shader (WebGL1 compatible)
3. Canvas 2D → Software mosaic (pixelate by sampling + blitting large rectangles) — slower but functional
4. No canvas support → Static error page (extremely rare in 2026)

Libraries like PixiJS ship a `pixi.js-legacy` bundle that automatically falls back to Canvas 2D when WebGL is unavailable. If using PixiJS, prefer the legacy bundle for safety.

**The `failIfMajorPerformanceCaveat` gotcha:**
`getContext('webgl', { failIfMajorPerformanceCaveat: true })` rejects software-rendered WebGL (e.g., SwiftShader on GPU-less VMs). This is a valid option for performance-sensitive effects — but you must handle the `null` result gracefully.

#### Model Fails to Load
MediaPipe model download/parse can fail (network error, CORS, corrupted cache). Design a loading state machine:

```
IDLE → LOADING_MODEL → MODEL_READY → TRACKING
                ↓
          MODEL_FAILED → show fallback UI
```

Fallback when model fails: render the webcam feed without tracking (grid overlay still works, no landmark blobs). Inform the user with a non-blocking toast: "Hand tracking unavailable — showing raw video."

The `.task` model file is ~9MB. Show a loading progress indicator during first fetch.

---

### 6. HTTPS for Local Dev (getUserMedia Requirement)

`getUserMedia()` is only available in secure contexts. In practice:
- `localhost` is a secure context — plain Vite `npm run dev` works.
- Any LAN IP (`192.168.x.x`) is **not** a secure context and will fail.

For cross-device testing (phone on LAN), HTTPS is required.

#### Option A: `vite-plugin-mkcert` (Recommended)
The simplest approach — automatically handles mkcert installation and certificate generation:

```bash
npm install --save-dev vite-plugin-mkcert
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  plugins: [react(), mkcert()],
  server: { port: 5173 },
});
```

Running `npm run dev` now serves `https://localhost:5173` with a trusted cert.

#### Option B: Manual mkcert
```bash
brew install mkcert         # macOS
mkcert -install             # Installs root CA to system trust store
mkcert localhost            # Generates localhost.pem + localhost-key.pem
```

```typescript
// vite.config.ts
import fs from 'fs';
export default defineConfig({
  server: {
    https: {
      key: fs.readFileSync('localhost-key.pem'),
      cert: fs.readFileSync('localhost.pem'),
    },
  },
});
```

**Do not commit** `*.pem` files. Add to `.gitignore`:
```
*.pem
*.key
```

#### Why localhost Works Without Certs
Chrome, Firefox, and Safari all treat `localhost` as a "potentially trustworthy origin" per the Secure Contexts spec. So for solo development, no cert setup is needed. Certs are only necessary when testing on a physical device over LAN.

---

### 7. Privacy: Data Never Leaves the Device

#### Technical Reality
MediaPipe Hand Landmarker runs entirely in-browser via WASM. Once the model file is loaded, all inference happens locally:
- No webcam frames are uploaded.
- No landmark data is sent to any server.
- This is verifiable by users via browser DevTools Network tab.

#### How to Communicate This

**Persistent, subtle badge (recommended):**
Place a small indicator near the camera preview — visible but not obtrusive. Example text: "Camera processed on-device. Nothing is uploaded."

Use a lock icon or a shield icon from the design system. Color: muted/secondary (not red — red implies danger).

**First-run explanation (inline, not a modal):**
In the pre-prompt permission screen, include a one-liner: "Your camera feed never leaves your browser. All tracking runs locally."

**Footer / about section:**
Longer explanation available on demand: "This app uses MediaPipe, a technology that runs hand-tracking AI directly in your browser using WebAssembly. No video frames or tracking data are transmitted to any server."

#### UX Research Signal
Studies from on-device AI UX research show that users who see explicit "processed locally" messaging show significantly higher feature adoption rates versus users who receive no privacy communication. The message is a trust accelerator, not just legal coverage.

#### Verifiability
Since the app is a static client-side deploy, users can open DevTools → Network, start the tracking, and see zero outbound requests containing camera data. This is worth documenting in a "Privacy" section.

---

### 8. Lighthouse / Performance Budgets for a Canvas-Heavy App

#### Why Standard Lighthouse Scores Are Misleading for This App
Lighthouse measures load-time metrics (LCP, CLS, FID/INP at load). A canvas app's real performance challenge is runtime: maintaining 30fps in the render loop while MediaPipe inference runs. Standard Lighthouse won't measure this.

#### Relevant Metrics to Track

| Metric | Target | Tool |
|---|---|---|
| INP (Interaction to Next Paint) | < 200ms | CrUX / DevTools |
| LCP (Largest Contentful Paint) | < 2.5s | Lighthouse |
| CLS (Cumulative Layout Shift) | < 0.1 | Lighthouse |
| JS Main Thread Blocking | < 50ms per task | Performance profiler |
| Canvas frame time | < 33ms at 30fps | `performance.now()` delta in rAF |
| MediaPipe inference time | < 20ms per frame | `Date.now()` around `detect()` |

**INP and canvas animation:**
The render loop runs via `requestAnimationFrame`. Long-running rAF callbacks (> 50ms) block the main thread and directly cause poor INP — parameter panel sliders become unresponsive. Keep rAF callbacks lean.

If MediaPipe inference is synchronous on main thread, it can easily blow the 50ms budget. Use the `LIVE_STREAM` mode for HandLandmarker which calls back asynchronously and does not block the main thread.

#### Practical Performance Budget
```json
// .lighthouserc.json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["warn", { "minScore": 0.8 }],
        "first-contentful-paint": ["warn", { "maxNumericValue": 2000 }],
        "largest-contentful-paint": ["warn", { "maxNumericValue": 3000 }],
        "total-blocking-time": ["error", { "maxNumericValue": 300 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    }
  }
}
```

#### Canvas-Specific Performance Tips
- **Offscreen canvas**: Consider `OffscreenCanvas` + `Worker` for the mosaic effect rendering to remove it from main thread.
- **Avoid reading pixels from GPU**: `ctx.getImageData()` is expensive — triggers GPU-CPU sync. If needed, read once per frame and cache.
- **Request device pixel ratio responsibly**: `canvas.width = container.clientWidth * devicePixelRatio` on Retina screens quadruples pixel count. Cap at `Math.min(devicePixelRatio, 2)`.
- **Profile with** `performance.mark()` / `performance.measure()` around the rAF callback.

---

### 9. PWA Basics: Installability and Offline Behavior

#### Installability (2026 State)
A PWA web manifest is sufficient for install prompts in Chrome/Edge. Service workers are no longer required for installability (as of 2025). Firefox added PWA install support in version 143 (Windows only).

Minimum manifest:
```json
{
  "name": "Hand Tracker FX",
  "short_name": "HandFX",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

#### Offline Strategy for a Model-Based App

The app has two large, cacheable assets:
1. **WASM runtime** (~2–3MB): `@mediapipe/tasks-vision/wasm/` files from CDN
2. **Model file** (~9MB): `hand_landmarker.task` from Google Storage or self-hosted

**Recommended strategy: self-host both assets and use cache-first service worker.**

```javascript
// service-worker.js (using Workbox or manual)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/assets/hand_landmarker.task',   // bundled with app
  '/assets/vision_wasm_internal.js',
  '/assets/vision_wasm_internal.wasm',
  '/assets/vision_wasm_nosimd_internal.js',
  '/assets/vision_wasm_nosimd_internal.wasm',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('hand-fx-v1').then(cache => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached ?? fetch(event.request))
  );
});
```

**Self-hosting the model via `modelAssetPath`:**
```javascript
const handLandmarker = await HandLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: '/assets/hand_landmarker.task',  // served from own origin
    delegate: 'GPU',
  },
  // ...
});
```

**Alternative: `modelAssetBuffer` for runtime caching via IndexedDB:**
Load the model once, store the `ArrayBuffer` in IndexedDB, and on subsequent loads pass it directly:
```javascript
baseOptions: { modelAssetBuffer: await getModelFromIndexedDB() }
```
Google's official guidance recommends using IndexedDB for caching after first load to accelerate future page loads.

#### COOP/COEP and Service Workers
COOP + COEP headers must be set on responses from the service worker too (not just the origin server). When using a static host (Vercel, Netlify), configure the headers in `vercel.json` or `netlify.toml` — they apply to all served files including service worker responses.

---

### 10. Analytics and Telemetry

#### Recommendation: No Analytics for MVP

This app's core promise is "everything on-device, no data leaves the browser." Adding any analytics SDK fundamentally contradicts that promise and requires a consent banner under GDPR/CCPA — which adds friction to a creative tool.

For MVP: **zero analytics, zero telemetry.**

#### If Analytics Are Desired Post-MVP

| Tool | Hosting | Cookie-Free | Data Sent | Verdict |
|---|---|---|---|---|
| **Plausible** | Cloud or self-host | Yes | Aggregated page stats only | Best fit |
| **Umami** | Self-host | Yes | Aggregated + custom events | Good |
| **Fathom** | Cloud | Yes | Aggregated | Good |
| **Google Analytics 4** | Cloud | No | User-level, cross-site | Reject |
| **PostHog** | Self-host | Optional | Session replay possible | Overkill |

If analytics are added, scope them to **page loads and error counts only** — no tracking of hand movements, parameter values, or session recordings. No personal data.

**Minimal self-hosted Plausible** requires a separate server (contradicts "static only" architecture). **Plausible Cloud** free tier is the least-friction option if analytics ever become needed.

#### Error Telemetry (Separate from Analytics)
Error telemetry (Sentry-style) is lower-stakes than behavioral analytics but still sends data. For a creative tool, the most privacy-respecting approach is:
- Log errors to browser console only.
- Optionally add a "Report this bug" button that opens a pre-filled GitHub Issue URL with the error message — no automatic data transmission.

---

## Recommended Approach

Based on the research, the recommended approach for this app is:

1. **Permissions UX**: Show an in-app pre-prompt screen explaining camera use before calling `getUserMedia()`. Use the Permissions API to skip the screen when already granted. Handle all 7 DOMException names with specific recovery UI for each.
2. **Security headers**: Ship COOP + COEP headers from day one (required for MediaPipe multi-threading). Set Permissions-Policy to `camera=(self)`. Add minimal CSP with `'wasm-unsafe-eval'`.
3. **Accessibility**: Apply `role="img"` + descriptive `aria-label` on the canvas. Implement `prefers-reduced-motion` check in the rAF loop. Add a Pause button for WCAG 2.2.2 compliance.
4. **Error handling**: Use `react-error-boundary` with granular boundaries around the camera capture component and the tracking/canvas component. Bridge async errors via `useErrorBoundary().showBoundary`.
5. **Graceful degradation**: Detect WebGL availability before init; fall back to Canvas 2D mosaic. Show "tracking unavailable" state when model load fails without crashing the whole app.
6. **Dev HTTPS**: Use `vite-plugin-mkcert` for zero-friction local HTTPS. Document that plain `localhost` works without certs for solo dev.
7. **Privacy messaging**: Show a persistent "on-device" badge near the camera preview. Include one line in the pre-prompt screen. Omit any analytics from MVP.
8. **Performance**: Use HandLandmarker in `LIVE_STREAM` mode (async callback, non-blocking). Cap canvas pixel ratio at 2x. Monitor rAF frame time and MediaPipe inference time. Target < 33ms per frame.
9. **PWA + offline**: Self-host the WASM runtime and model file. Implement a simple cache-first service worker. Provide a web manifest for installability.
10. **Analytics**: Zero analytics for MVP. If added later, Plausible (cloud) is the best fit for a privacy-first tool.

---

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| `vite-plugin-mkcert` for HTTPS | Automatic, zero config | npm dependency | Recommended |
| Manual mkcert | No build dependency | Extra setup steps, pem files to manage | Fallback |
| `react-error-boundary` library | Battle-tested, hooks API | Small dependency | Recommended |
| Custom error boundary class | No dependency | Verbose, misses async use cases | Rejected |
| GA4 analytics | Free, full-featured | Contradicts privacy promise, GDPR concerns | Rejected |
| Plausible Cloud | Cookie-free, GDPR-compliant | Data leaves device (aggregated) | Acceptable post-MVP only |
| WebGL only rendering | Best mosaic quality | Fails on GPU-less environments | Use with Canvas 2D fallback |
| `OffscreenCanvas` + Worker | Main thread free for INP | Adds complexity, limited browser support | Phase 2 optimization |
| CDN-hosted model | Easiest setup | Requires network on first use, CORS headers, no offline | Self-host instead |

---

## Pitfalls and Edge Cases

- **COOP/COEP blocks cross-origin iframes**: If the app is ever embedded in an iframe, COEP will break it. Document this constraint. Since the app is standalone, this is acceptable.
- **Safari permission expiry**: Safari clears camera permission on session end (closing tab/browser). The Permissions API `status.state` will show `'prompt'` on next session. The pre-prompt screen must always be possible to re-trigger.
- **`NotReadableError` on Mac**: On macOS, if another app (Zoom, FaceTime) has exclusive camera access, Chrome throws `NotReadableError`. The error message in Chrome differs from Firefox. Test on macOS specifically.
- **`crossOriginIsolated` = false on GitHub Pages**: GitHub Pages does not support setting COOP/COEP headers. This means MediaPipe may run in single-threaded mode only on GitHub Pages. Vercel or Netlify (both support custom headers) are required for full multi-threading.
- **WASM files have multiple variants**: MediaPipe ships `_wasm_internal.wasm` (SIMD) and `_wasm_nosimd_internal.wasm` (fallback). Both must be precached. The runtime auto-selects based on CPU capability.
- **`devicePixelRatio` on Retina + resize**: If the user resizes the browser window, the canvas must be resized. Use a `ResizeObserver` — not `window.resize` — and re-initialize canvas dimensions. Failing to do this causes blurry rendering on Retina screens.
- **`prefers-reduced-motion` state can change at runtime**: The user can toggle it in System Preferences while the app is open. Listen for the `change` event, not just read it at init time.
- **IndexedDB quota**: On iOS Safari, IndexedDB storage is capped at ~50MB per origin in some scenarios. The model (~9MB) + WASM (~5MB) fits, but be aware. Eviction can happen on low-storage devices. Always handle `null` returns from IndexedDB reads.
- **Service worker update lifecycle**: When the model or WASM version updates, the service worker cache key must change. Use versioned cache names (`hand-fx-v2`) and clean up old caches in the `activate` event.

---

## References

- [MDN: MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [addpipe.com: Getting Started With getUserMedia in 2026](https://blog.addpipe.com/getusermedia-getting-started/)
- [MDN: Permissions-Policy camera directive](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/camera)
- [web.dev: Making your website cross-origin isolated (COOP/COEP)](https://web.dev/articles/coop-coep)
- [web.dev: Why you need cross-origin isolated for powerful features](https://web.dev/articles/why-coop-coep)
- [web.dev: Animation and motion accessibility](https://web.dev/learn/accessibility/motion)
- [Paul J Adam: HTML Canvas Accessibility demos](https://pauljadam.com/demos/canvas.html)
- [DEV: How to set up local HTTPS with mkcert (2025)](https://dev.to/_d7eb1c1703182e3ce1782/how-to-set-up-a-local-https-development-environment-in-2025-mkcert-guide-1h8c)
- [npm: vite-plugin-mkcert](https://www.npmjs.com/package/vite-plugin-mkcert)
- [LogRocket: React error handling with react-error-boundary](https://blog.logrocket.com/react-error-handling-react-error-boundary/)
- [web.dev: PWA Caching strategies](https://web.dev/learn/pwa/caching)
- [Google Developers Blog: 7 dos and don'ts of using ML on the web with MediaPipe](https://developers.googleblog.com/7-dos-and-donts-of-using-ml-on-the-web-with-mediapipe/)
- [npm: @mediapipe/tasks-vision](https://www.npmjs.com/package/@mediapipe/tasks-vision)
- [web.dev: Interaction to Next Paint (INP)](https://web.dev/articles/inp)
- [CSS-Tricks: prefers-reduced-motion](https://css-tricks.com/almanac/rules/m/media/prefers-reduced-motion/)
- [Plausible Analytics: Privacy-focused web analytics](https://plausible.io/privacy-focused-web-analytics)
- [AI UX Design Guide: Privacy-First Design patterns](https://www.aiuxdesign.guide/patterns/privacy-first-design)
- [Google AI Edge: HandLandmarker JS API](https://ai.google.dev/edge/api/mediapipe/js/tasks-vision.handlandmarker)
- [HTTP Archive Web Almanac: PWA 2025](https://almanac.httparchive.org/en/2025/pwa)

---

## Apply These in PHASES.md

The following items should be assigned to specific phases and tracked as implementation tasks:

### Phase 1 — Scaffold / Project Setup
- [ ] Configure `vite-plugin-mkcert` so `npm run dev` serves HTTPS from day one
- [ ] Add COOP + COEP response headers to dev server (`vite.config.ts` `headers` option) and document they must also be set on the production static host
- [ ] Add `.gitignore` entries for `*.pem` / `*.key`
- [ ] Add `Content-Security-Policy` with `'wasm-unsafe-eval'` to Vite dev server headers (fail-fast before production deploy)
- [ ] Add `Permissions-Policy: camera=(self)` to dev server headers

### Phase 2 — Camera Capture
- [ ] Implement pre-prompt permission screen — do not call `getUserMedia()` on mount
- [ ] Use Permissions API `navigator.permissions.query({ name: 'camera' })` to skip pre-prompt if already granted
- [ ] Handle all 7 `DOMException` names from `getUserMedia()` with distinct error UI per error type
- [ ] Implement `permissionStatus.onchange` listener for automatic recovery when user grants permission from browser settings
- [ ] Listen to `MediaStreamTrack 'ended'` event for mid-session camera disconnection
- [ ] Wrap camera component in `<ErrorBoundary>` from `react-error-boundary`
- [ ] Add global `window.addEventListener('unhandledrejection', ...)` handler

### Phase 3 — Hand Tracking
- [ ] Use HandLandmarker in `LIVE_STREAM` mode (async callbacks) — never synchronous mode on main thread
- [ ] Implement model loading state machine: `IDLE → LOADING → READY → FAILED`
- [ ] Show progress indicator during first model fetch (model is ~9MB)
- [ ] Handle model load failure gracefully: fall back to raw video + grid without tracking, non-blocking toast notification
- [ ] Wrap tracking component in `<ErrorBoundary>` with `resetKeys` retry pattern
- [ ] Self-host `hand_landmarker.task` and WASM files in `/public/assets/` (do not rely on CDN at runtime)
- [ ] Implement `crossOriginIsolated` check at startup; warn in console if false

### Phase 4 — Canvas Rendering
- [ ] Detect WebGL support before init; implement Canvas 2D mosaic fallback
- [ ] Apply `role="img"` + descriptive `aria-label` to the canvas element
- [ ] Add plain-text fallback content between `<canvas>` tags
- [ ] Check `window.matchMedia('(prefers-reduced-motion: reduce)')` in rAF loop; pause animation if true
- [ ] Listen for runtime `prefers-reduced-motion` change events
- [ ] Add a "Pause" toggle button for WCAG 2.2.2 compliance (pause/resume the render loop)
- [ ] Cap canvas `devicePixelRatio` at 2 to avoid 4x pixel overdraw on Retina screens
- [ ] Use `ResizeObserver` (not `window.resize`) for canvas resize handling
- [ ] Instrument rAF callback with `performance.mark()` to track frame time; log warning if > 33ms

### Phase 5 — Parameters Panel
- [ ] Use native `<input type="range">` for sliders — natively keyboard accessible
- [ ] Ensure all custom interactive elements have `tabindex="0"` and Enter/Space keydown handlers
- [ ] Ensure focus ring remains visible when canvas animation is running (check for z-index / clip conflicts)

### Phase 6 — UI Polish / Accessibility Sweep
- [ ] Add visually-hidden `aria-live="polite"` region for hand coordinate readouts (throttled to ~1fps)
- [ ] Add persistent "on-device" privacy badge near camera preview
- [ ] Add privacy explanation line to pre-prompt screen: "Your camera feed never leaves your browser"
- [ ] Audit keyboard navigation end-to-end (Tab through all controls)

### Phase 7 — PWA + Production Hardening
- [ ] Add `manifest.json` with name, short_name, icons, display standalone
- [ ] Implement cache-first service worker that precaches: HTML, JS bundles, WASM files, model file
- [ ] Use versioned cache names (`hand-fx-v1`) with old cache cleanup in `activate` event
- [ ] Set COOP + COEP headers on production host (Vercel: `vercel.json`, Netlify: `netlify.toml`)
- [ ] Set `Permissions-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` in production headers
- [ ] Run Lighthouse audit; target: Performance >= 80, no TBT > 300ms
- [ ] Verify `crossOriginIsolated === true` in production
- [ ] Confirm zero outbound network requests after initial model + WASM cache (DevTools Network audit)
- [ ] Decision checkpoint: analytics yes/no — if yes, add Plausible Cloud snippet scoped to page loads only
