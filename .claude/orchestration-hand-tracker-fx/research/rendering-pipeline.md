# Rendering Pipeline - Research

**Wave**: First
**Researcher**: Web Research Subagent (claude-sonnet-4-6)
**Date**: 2026-04-14
**Status**: Complete

---

## Summary

For a webcam video + grid overlay + per-cell mosaic effect at 30 fps on a laptop, the right stack in 2026 is a **hybrid WebGL + Canvas 2D composition**: raw WebGL (or a thin wrapper like `ogl`) handles video-as-texture and the mosaic GLSL shader, while a transparent Canvas 2D canvas layered on top via absolute CSS positioning handles the grid lines and dotted landmark blobs. This avoids pulling in a heavyweight scene graph, sidesteps the known PixiJS v8 WebGPU webcam bug, keeps the bundle small, and gives full shader control. The render loop is driven by `requestVideoFrameCallback` for perfect video-frame sync. An effect registry is modelled as a plain JS object map of named effect descriptors, each owning its own GLSL programs and uniform setters — a minimal but extensible pattern inspired by Hydra and TouchDesigner's operator model.

---

## Key Findings

### 1. Canvas 2D vs WebGL vs WebGPU for This Workload

**Canvas 2D is insufficient for the mosaic shader.** Pixel-manipulation via `getImageData` / `putImageData` runs on the CPU and takes 3.5–3.6 ms per frame just for a read, well before any processing. It cannot sustain 30 fps while also running MediaPipe on the main thread. Canvas 2D is appropriate only for vector overlay work (grid lines, text, dotted circles) where no per-pixel shader is needed.

**WebGL (WebGL 2 / WebGL 1) is the correct choice for the shader work.** GPU-parallel fragment shaders process every pixel simultaneously; at 1280×720 the mosaic effect runs in under 1 ms. WebGL has universal support across all browsers and all hardware shipping today. The approach of uploading a webcam `HTMLVideoElement` directly via `gl.texSubImage2D` each frame is well-established and fast.

**WebGPU is promising but not yet a safe baseline for 2026.** As of April 2026, WebGPU ships in Chrome (Windows, macOS, Android with caveats), Firefox 145 (macOS Apple Silicon only, Windows without Linux/Android), and Safari 26 (requires macOS Tahoe 26 / iOS 26). Mobile and Linux remain fragmented. For a creative tool targeting "any modern laptop", WebGL 2 still has broader reach. The performance uplift WebGPU provides — dramatic CPU-thread savings — is most relevant for scenes with thousands of draw calls, not for a single full-screen quad with one shader. Additionally, there is a known open bug in PixiJS v8 where the WebGPU renderer fails to use webcam streams as textures in Chrome (`copyExternalImageToTexture` error). **Verdict: target WebGL 2, design to swap to WebGPU later when PixiJS or a raw adapter is stable.**

**Recommended split:**
- WebGL 2 canvas (bottom layer): video texture + mosaic shader on targeted cells
- Canvas 2D canvas (top layer, `position: absolute`, `z-index: 10`, `pointer-events: none`): grid lines, landmark blobs, coordinate labels

---

### 2. Library Comparison

#### PixiJS v8

- **What it is**: Full 2D rendering engine — sprites, containers, scene graph, filters, WebGL/WebGPU backends.
- **Video texture**: `VideoSource` wraps an `HTMLVideoElement` and auto-uploads to GPU each frame.
- **Custom shaders**: `Filter.from({ glProgram: new GlProgram({ fragment, vertex }), resources: {...} })`. Filters attach to any `Container` and auto-scope to that container's bounding box — this is the clean path to per-region mosaic.
- **GLSL version**: v8 uses GLSL ES 3.0 style (`in`/`out`, `texture()` instead of `texture2D()`). Variable names differ from standard (`aPosition` instead of `aVertexPosition`, `uOutputFrame`/`uOutputTexture` instead of standard projection matrices) — documented but causes friction porting shaders from other sources.
- **WebGPU webcam bug**: Open as of March 2024 (issue #10362). The WebGPU renderer fails in Chrome with `getUserMedia` streams. The WebGL renderer is unaffected, but the bug is a risk if you rely on auto-renderer selection.
- **Bundle size**: ~300–400 kb minified (v6 was ~370 kb; v8 has better tree-shaking so practical size depends on imports, but it is still the heaviest option here).
- **Verdict**: Powerful, but overkill for one full-screen quad effect. The scene-graph abstraction adds weight and the v8 shader naming quirks add friction. The webcam/WebGPU bug is a concrete risk. **Rejected as primary renderer; acceptable if team already knows it.**

#### three.js

- **What it is**: 3D scene graph with a `VideoTexture` helper, `ShaderMaterial` for custom GLSL, large ecosystem.
- **Bundle size**: ~600+ kb minified (full import); tree-shaking with ES modules reduces this to ~150–250 kb for a minimal scene.
- **For this use case**: Requires setting up a camera, scene, and a `PlaneGeometry` quad just to render a 2D video frame. `ShaderMaterial` gives clean GLSL access. `VideoTexture` handles webcam streams reliably. Community examples exist (Codrops 2024 MediaPipe + Three.js hand controller tutorial).
- **Verdict**: Works, is proven, but carries conceptual overhead (3D abstractions for a 2D effect) and a heavier bundle. **Acceptable fallback; not the leanest choice.**

#### regl

- **What it is**: Functional, stateless WebGL wrapper. Each draw call is a self-contained command object `{ vert, frag, uniforms, attributes, count }`.
- **Bundle size**: ~46 kb gzipped (application including regl); the library itself is minimal with zero dependencies.
- **For this use case**: Excellent fit for "one full-screen quad with a custom shader". Render loop is explicit and transparent. Video texture upload is straightforward with raw WebGL calls (regl wraps them cleanly). No scene graph, no magic.
- **Weakness**: Last npm publish was January 2025; development activity has slowed. No WebGPU path. The functional style is excellent for data viz but slightly unconventional for a "creative tool" codebase.
- **Verdict**: Strong option. Lean, explicit, fast. Slightly limited ecosystem and reduced maintenance velocity. **Recommended if minimal deps and full shader transparency are the priority.**

#### ogl

- **What it is**: Minimal WebGL library, zero dependencies, ES module native. API deliberately mirrors three.js concepts (`Mesh`, `Texture`, `Program`, `Renderer`) but much smaller.
- **Bundle size**: **29 kb minzipped** (core 8 kb, math 6 kb, extras 15 kb). Best-in-class for this comparison.
- **Features relevant here**: `Texture` (accepts `HTMLVideoElement`), `RenderTarget` (framebuffer / render-to-texture), `Program` (custom GLSL), `Post` (post-processing chain). WebGL only — no WebGPU.
- **GLSL**: Standard WebGL 2 GLSL, no proprietary naming conventions.
- **Verdict**: **Recommended primary WebGL layer.** Smallest bundle, most transparent API, full shader control, standard GLSL, active enough (last release January 2025). The three.js-like API keeps it learnable.

#### p5.js

- **What it is**: Creative coding environment for beginners/artists. Canvas 2D by default; a WebGL mode exists but is limited.
- **For this use case**: `createCapture()` for webcam works, pixel manipulation via `.pixels[]` is CPU-bound. The WebGL mode does support custom shaders via `p5.Shader`, but the programming model (`setup()` / `draw()`) is a poor match for a component-based React app. Bundle is ~1.5 MB.
- **Verdict**: **Rejected.** Pedagogical tool, not a production rendering engine.

#### two.js

- **What it is**: 2D vector drawing API (SVG, Canvas, WebGL backends).
- **For this use case**: Has no native concept of video textures or custom fragment shaders. Its WebGL backend is for accelerated vector rendering, not image/video processing. Cannot run a mosaic GLSL pass.
- **Verdict**: **Rejected.** Not designed for image/video shader effects.

---

### 3. Composition Strategy: WebGL + Canvas 2D Hybrid

The recommended composition uses **two `<canvas>` elements inside a shared `position: relative` container**:

```
┌─────────────────────────────────┐
│  <div style="position:relative">│
│  ┌───────────────────────────┐  │
│  │ WebGL canvas (z-index: 0) │  │  ← video texture + mosaic shader
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 2D canvas  (z-index: 10)  │  │  ← grid, blobs, labels
│  │ pointer-events: none      │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

This is the canonical pattern described in WebGL Fundamentals ("WebGL Text - Canvas 2D") and avoids the complexity of rendering text/vector in GLSL. Both canvases are the same pixel dimensions; coordinate spaces align trivially.

**Alternatively**, everything can run on a single WebGL canvas with the grid and blobs drawn as WebGL geometry (lines, points). This is viable but requires more GL boilerplate for text labels (either a texture atlas or a separate technique). For an MVP where annotation quality matters (dotted circles with coordinate labels rendered with `fillText`), the hybrid approach is easier and performs identically at 30 fps.

---

### 4. Mosaic / Pixelation GLSL Shader

The core technique: **quantize the texture coordinate** by dividing by the tile size, flooring, then multiplying back. This snaps each output fragment to its "tile center" sample.

**Full fragment shader (GLSL ES 3.0 / WebGL 2):**

```glsl
#version 300 es
precision mediump float;

uniform sampler2D uVideo;        // webcam frame
uniform vec2  uResolution;       // canvas width, height in pixels
uniform float uTileSize;         // mosaic tile size in pixels (e.g. 16.0)

// Per-cell mask: array of vec4(x, y, w, h) in normalized [0,1] coords.
// For MVP pass a single active region via uniforms.
uniform vec4  uRegion;           // (x, y, width, height) in [0,1] UV space
uniform float uApplyEffect;      // 1.0 = yes, 0.0 = passthrough

in  vec2 vTexCoord;
out vec4 fragColor;

vec4 mosaic(vec2 uv) {
    // Tile size in UV space
    vec2 tileUV = uTileSize / uResolution;
    vec2 quantized = floor(uv / tileUV) * tileUV + tileUV * 0.5;
    return texture(uVideo, quantized);
}

bool inRegion(vec2 uv, vec4 r) {
    return uv.x >= r.x && uv.x <= (r.x + r.z)
        && uv.y >= r.y && uv.y <= (r.y + r.w);
}

void main() {
    vec2 uv = vTexCoord;
    
    if (uApplyEffect > 0.5 && inRegion(uv, uRegion)) {
        fragColor = mosaic(uv);
    } else {
        fragColor = texture(uVideo, uv);
    }
}
```

**For multiple active cells**, pass a uniform array:
```glsl
uniform int   uRegionCount;
uniform vec4  uRegions[32];       // up to 32 grid cells

// in main():
bool active = false;
for (int i = 0; i < uRegionCount; i++) {
    if (inRegion(uv, uRegions[i])) { active = true; break; }
}
```

GLSL loops over small constant-max arrays compile efficiently on all GPU hardware.

**Alternative (framebuffer approach)** for more complex effects: render the full video frame to a low-resolution `RenderTarget` with `NEAREST` filtering, then blit that texture only over the targeted cells. This is more expensive (two-pass) but enables true nearest-neighbor blocky pixels at any scale.

---

### 5. requestAnimationFrame vs requestVideoFrameCallback

`requestVideoFrameCallback` (rVFC) is the correct choice for video-driven render loops.

| | `requestAnimationFrame` | `requestVideoFrameCallback` |
|---|---|---|
| Fires at | Display refresh rate (~60 Hz) | Lesser of video fps and display rate |
| For 30 fps webcam | Doubles rendering work (every other frame is a duplicate) | Fires exactly at video cadence |
| Metadata | None video-specific | Includes `presentedFrames`, `mediaTime`, `expectedDisplayTime` |
| Browser support | Universal | All major browsers as of 2025 |
| Main thread | Yes | Yes (compositor thread does video; callback is best-effort ±1 vsync) |

**Recommended loop pattern:**

```javascript
function renderFrame(now, metadata) {
    // 1. Upload new video frame to GPU texture
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, videoEl);

    // 2. Draw WebGL pass (video + mosaic)
    drawWebGL();

    // 3. Draw Canvas 2D overlay (grid + blobs)
    drawOverlay();

    // 4. Queue next frame
    videoEl.requestVideoFrameCallback(renderFrame);
}
videoEl.requestVideoFrameCallback(renderFrame);
```

`rVFC` is recursive (re-register each call), identical to `rAF`. For the MediaPipe inference call, `detectForVideo(videoEl, now)` is called synchronously inside the same callback. MediaPipe runs synchronously on the main thread (~17 ms CPU) unless offloaded to a Web Worker with `OffscreenCanvas` — an optimization worth noting but out of scope for MVP.

---

### 6. Effect Registry / Node Graph Abstraction

Inspiration: TouchDesigner (operators connected in a graph), Hydra (JavaScript-compiled-to-WebGL chain), Isadora (patch-based, node connections).

**Hydra's approach** is the most relevant web precedent. It chains operations as method calls on a "source" object (`src(o0).pixelate(16).out()`), each node compiling its GLSL snippet into a combined shader. This is elegant but complex to implement from scratch.

**For an MVP with one effect and an eye toward extension**, the pragmatic abstraction is a **registry pattern** — a plain object that maps effect names to descriptor objects:

```javascript
// effectRegistry.js
export const effectRegistry = {
    "mosaic": {
        id: "mosaic",
        label: "Mosaic / Pixelation",
        defaultParams: {
            tileSize: 16,
            opacity: 1.0,
            targetMode: "hand-proximity", // | "manual" | "face-overlap"
        },
        // Factory: returns { program, setUniforms(gl, params, landmarks) }
        create(gl) {
            const program = buildProgram(gl, VERT_SRC, FRAG_SRC);
            return {
                program,
                setUniforms(params, landmarks, canvasSize) {
                    // compute active cell regions from landmarks + params
                    // upload as uniform arrays
                }
            };
        }
    }
    // Future effects added here as siblings
};
```

**The render engine** then does:
```javascript
const activeEffect = effectRegistry["mosaic"].create(gl);
// each frame:
activeEffect.setUniforms(params, landmarks, canvasSize);
drawQuad(gl, activeEffect.program);
```

This is not a full node graph (no visual wiring), but it achieves the TouchDesigner goal of "one module, easily swappable siblings." A full DAG with typed ports (as Hydra or nodes.io implement) would be Phase N+2 work.

---

### 7. MediaPipe Integration Notes (Render Pipeline Perspective)

- **Package**: `@mediapipe/tasks-vision` (npm)
- **Mode for webcam**: `VIDEO` mode with `detectForVideo(videoElement, timestampMs)` called inside `rVFC` callback. (The documentation previously called the live mode `LIVE_STREAM`; the current tasks API unifies it as `VIDEO` mode with the timestamp serving as the sync signal.)
- **Result shape**: `HandLandmarkerResult.landmarks[handIndex][landmarkIndex]` = `{ x, y, z }` all in `[0, 1]` normalized image space.
- **CPU budget**: ~17 ms on Pixel 6; on a modern laptop expect ~10–15 ms. This eats ~half the 33 ms frame budget at 30 fps. Running on the main thread means it competes directly with the render loop — viable for MVP but a Web Worker offload is the recommended production path.
- **GPU delegate in browser**: Available via WebGL delegate on supported hardware; reduces to ~12 ms.

---

## Recommended Approach

1. **Renderer**: `ogl` (29 kb minzipped) as the WebGL abstraction for the bottom canvas. One `Mesh` — a full-screen quad. One `Program` with the mosaic fragment shader. One `Texture` backed by the webcam `HTMLVideoElement`.

2. **Overlay**: A separate `<canvas>` element, `position: absolute`, driven by the Canvas 2D API. Draws: grid lines (stroked `Path2D` or individual `moveTo`/`lineTo`), dotted landmark circles (`setLineDash`), coordinate labels (`fillText`).

3. **Render loop**: `requestVideoFrameCallback` on the `<video>` element. Inside each callback: upload video frame to ogl texture → run WebGL draw → run Canvas 2D overlay draw → re-register callback.

4. **Mosaic shader**: Single-pass quantization shader (GLSL ES 3.0). Active regions passed as a `vec4[]` uniform. Uniform updated each frame based on current landmark positions and the active cell selection mode.

5. **Hand tracking**: `@mediapipe/tasks-vision` `HandLandmarker` in `VIDEO` mode, called synchronously in the rVFC callback. Landmark results fed into the effect's `setUniforms` call and the Canvas 2D overlay draw.

6. **Effect registry**: Plain JS object map. One entry for "mosaic" today; additional effects added as sibling entries without touching the engine.

7. **Framework**: React + Vite. The WebGL canvas and 2D overlay canvas live in a single `<EffectCanvas>` component that owns refs to both canvases and manages the rVFC loop in a `useEffect`.

---

### Concrete Render Loop Code Sketch

```typescript
// effectCanvas.tsx (simplified sketch — not production code)
import { Renderer, Program, Mesh, Plane, Texture } from 'ogl';

const FRAG = /* glsl */`#version 300 es
precision mediump float;
uniform sampler2D uVideo;
uniform vec2  uResolution;
uniform float uTileSize;
uniform int   uRegionCount;
uniform vec4  uRegions[32];
in  vec2 vUv;
out vec4 color;

vec4 mosaic(vec2 uv) {
    vec2 t = uTileSize / uResolution;
    return texture(uVideo, floor(uv / t) * t + t * 0.5);
}

void main() {
    bool active = false;
    for (int i = 0; i < uRegionCount; i++) {
        vec4 r = uRegions[i];
        if (vUv.x >= r.x && vUv.x <= r.x+r.z && vUv.y >= r.y && vUv.y <= r.y+r.w) {
            active = true; break;
        }
    }
    color = active ? mosaic(vUv) : texture(uVideo, vUv);
}`;

export function EffectCanvas({ params, landmarks }) {
    const glCanvasRef  = useRef<HTMLCanvasElement>(null);
    const ovCanvasRef  = useRef<HTMLCanvasElement>(null);
    const engineRef    = useRef<{ renderer, mesh, texture, program } | null>(null);

    useEffect(() => {
        const gl = glCanvasRef.current;
        const ov = ovCanvasRef.current;
        const video = document.querySelector('video#webcam') as HTMLVideoElement;

        // -- ogl setup --
        const renderer = new Renderer({ canvas: gl, webgl2: true });
        const { gl: glCtx } = renderer;

        const texture  = new Texture(glCtx);                           // will receive video frames
        const program  = new Program(glCtx, { fragment: FRAG, uniforms: {
            uVideo:       { value: texture },
            uResolution:  { value: [gl.width, gl.height] },
            uTileSize:    { value: params.tileSize },
            uRegionCount: { value: 0 },
            uRegions:     { value: new Float32Array(32 * 4) },
        }});
        const mesh = new Mesh(glCtx, { geometry: new Plane(glCtx, 2, 2), program });
        engineRef.current = { renderer, mesh, texture, program };

        // -- render loop --
        function frame(_now: number, _meta: VideoFrameCallbackMetadata) {
            const { renderer, mesh, texture, program } = engineRef.current!;

            // 1. Upload video frame
            texture.image = video;
            texture.needsUpdate = true;

            // 2. Compute active regions from landmarks + params
            const regions = computeActiveRegions(landmarks, params);
            program.uniforms.uTileSize.value    = params.tileSize;
            program.uniforms.uRegionCount.value = regions.length;
            program.uniforms.uRegions.value     = flattenRegions(regions);

            // 3. WebGL draw
            renderer.render({ scene: mesh });

            // 4. Canvas 2D overlay
            const ctx = ov.getContext('2d')!;
            ctx.clearRect(0, 0, ov.width, ov.height);
            drawGrid(ctx, params.grid);
            drawLandmarkBlobs(ctx, landmarks, ov.width, ov.height);

            // 5. Next frame
            video.requestVideoFrameCallback(frame);
        }

        video.requestVideoFrameCallback(frame);

        return () => { /* cleanup: cancel rVFC, delete GL objects */ };
    }, []);  // params/landmarks fed via refs to avoid re-init

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <canvas ref={glCanvasRef} style={{ position: 'absolute', inset: 0 }} />
            <canvas ref={ovCanvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        </div>
    );
}
```

---

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **ogl + Canvas 2D overlay** | 29 kb, standard GLSL, explicit, no scene graph overhead | WebGL only (no future WebGPU path without rewrite) | **Recommended** |
| **Raw WebGL 2 + Canvas 2D** | Zero dependencies, max control | Significant boilerplate (VAO, texture setup, shader compilation) | Acceptable; use if ogl proves limiting |
| **PixiJS v8 + Canvas 2D** | Filter system scopes to regions cleanly, good docs | WebGPU webcam bug (Chrome), heavy bundle (~350+ kb), proprietary GLSL naming | Rejected (bug risk + weight) |
| **regl + Canvas 2D** | Functional style, lean, great for data viz | Slower maintenance cadence, no WebGPU path | Acceptable fallback |
| **three.js + Canvas 2D** | Large ecosystem, VideoTexture proven, familiar | 600+ kb (even tree-shaken), 3D abstractions for 2D work | Acceptable fallback |
| **Pure Canvas 2D** | Simplest | CPU-only, cannot sustain 30 fps mosaic shader | Rejected (performance) |
| **p5.js** | Friendly API | 1.5 MB bundle, CPU pixel access, poor React integration | Rejected |
| **two.js** | Clean vector API | No video texture / shader support | Rejected |
| **WebGPU (2026)** | CPU thread savings, compute shaders | Incomplete browser coverage, PixiJS webcam bug, no ROI for single-quad | Defer to future phase |

---

## Pitfalls and Edge Cases

- **PixiJS v8 WebGPU + webcam**: `copyExternalImageToTexture` fails in Chrome with `getUserMedia` streams. If PixiJS is chosen, force `preference: 'webgl'` in renderer init and never allow auto-upgrade to WebGPU until this bug resolves.

- **`texSubImage2D` vs `texImage2D`**: Always use `texSubImage2D` for per-frame video updates once the texture is allocated. `texImage2D` reallocates GPU memory each call and will cause stutters.

- **rVFC is best-effort**: The spec notes the callback may fire one vsync late relative to actual compositor display. This is imperceptible at 30 fps. Do not use `metadata.expectedDisplayTime` for anything timing-critical; use it for frame-drop detection only.

- **GLSL uniform array size**: GLSL uniform arrays must have a compile-time constant max size. Declaring `uniform vec4 uRegions[32]` is fine; uploading fewer regions by setting `uRegionCount < 32` and ignoring the remainder is the correct pattern. Avoid dynamically sized arrays.

- **Mirror mode**: The webcam feed from `getUserMedia` is typically mirrored (selfie view). Flip the texture horizontally in the vertex shader with `vUv.x = 1.0 - aUv.x` when mirror mode is on. Landmark coordinates from MediaPipe are reported in the same mirrored space, so grid alignment stays consistent.

- **Canvas resize**: On window resize or resolution change, both canvases and the GL viewport must be resized together. A `ResizeObserver` on the container element is the clean pattern.

- **MediaPipe main-thread blocking**: At ~17 ms, `detectForVideo()` inside the rVFC callback means the frame takes ~17 ms + ~1 ms GPU + ~overhead = frequently over the 16.6 ms vsync budget. At 30 fps the budget is 33 ms, which is comfortable. But if parameters later push to 60 fps, a Web Worker with `OffscreenCanvas` becomes required.

- **ogl `Texture` auto-update with video**: ogl's `Texture` does not automatically poll video elements — you must set `texture.needsUpdate = true` each frame after assigning `texture.image = videoElement`. Forgetting this is a common freeze bug.

- **GLSL ES version mismatch**: ogl uses WebGL 2 by default (`webgl2: true`). Ensure GLSL shaders declare `#version 300 es` and use `in`/`out`/`texture()` not `attribute`/`varying`/`texture2D()`. WebGL 1 fallback requires GLSL 100 — not worth maintaining for a modern creative tool.

- **Grid cell to UV mapping**: Grid cells are defined in pixel/screen space; the shader needs regions in UV `[0,1]` space. Convert: `uvX = cellPixelX / canvasWidth`, etc. Apply mirror compensation if mirror mode is active.

---

## References

- [WebGL Fundamentals: Pixelization Effect](https://webglfundamentals.org/webgl/lessons/webgl-qna-how-to-get-pixelize-effect-in-webgl-.html)
- [Geeks3D: Pixelation Post-Processing GLSL Shader](https://www.geeks3d.com/20101029/shader-library-pixelation-post-processing-effect-glsl/)
- [MDN: requestVideoFrameCallback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback)
- [web.dev: Perform efficient per-video-frame operations](https://web.dev/articles/requestvideoframecallback-rvfc)
- [WebGL Fundamentals: WebGL Text - Canvas 2D overlay](https://webglfundamentals.org/webgl/lessons/webgl-text-canvas2d.html)
- [ogl GitHub: Minimal WebGL Library](https://github.com/oframe/ogl)
- [PixiJS v8 Launch Post](https://pixijs.com/blog/pixi-v8-launches)
- [PixiJS v8 Filters Guide](https://pixijs.com/8.x/guides/components/filters)
- [PixiJS v8 GLSL Syntax Discussion](https://github.com/pixijs/pixijs/discussions/11027)
- [PixiJS v8 WebGPU Webcam Bug](https://github.com/pixijs/pixijs/issues/10362)
- [MediaPipe Hand Landmarker Docs](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
- [MediaPipe Hand Landmarker: Web Guide](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
- [Real-time Video Processing with WebGL](https://dev.to/learosema/realtime-video-processing-with-webgl-5653)
- [WebGL Video Manipulation (Byborg Engineering)](https://medium.com/byborg-engineering/webgl-video-manipulation-8d0892b565b6)
- [Codrops: MediaPipe + Three.js Hand Controller (2024)](https://tympanus.net/codrops/2024/10/24/creating-a-3d-hand-controller-using-a-webcam-with-mediapipe-and-three-js/)
- [WebGPU browser support status](https://caniuse.com/webgpu)
- [WebGPU hits critical mass: all major browsers](https://www.webgpu.com/news/webgpu-hits-critical-mass-all-major-browsers/)
- [SVG vs Canvas vs WebGL performance 2025](https://www.svggenie.com/blog/svg-vs-canvas-vs-webgl-performance-2025)
- [Hydra: browser-based video synth (JS to WebGL)](https://hydra.ojack.xyz/)
- [Fuser: The Graph Will Set You Free (node graph patterns)](https://fuser.studio/blog/the-graph-will-set-you-free-why-every)

---

## Gaps or Conflicts

- **ogl video texture auto-update behavior**: The ogl README does not explicitly document whether `Texture` polling a video element requires `needsUpdate = true` on every frame or if there's a flag to enable auto-polling. This should be verified against ogl source or examples before coding the frame loop.

- **PixiJS WebGPU webcam bug resolution**: Issue #10362 was open as of the last data available (2024). Status in April 2026 is unconfirmed. If PixiJS is selected, verify the bug is resolved before committing to the WebGPU renderer.

- **MediaPipe LIVE_STREAM vs VIDEO mode naming**: Google's documentation uses both `LIVE_STREAM` and `VIDEO` in different places. The actual enum value in `@mediapipe/tasks-vision` should be confirmed against the current npm package source — do not rely on tutorial naming.

- **ogl WebGL 2 support on older integrated GPUs**: While WebGL 2 has >97% browser support, some older budget laptops ship with Intel HD 4000 era drivers that have partial WebGL 2 support. For the creative tool target audience (modern laptop) this is not a practical concern, but worth noting.

- **Bundle size for ogl in practice**: The 29 kb figure is for the full package minzipped. Tree-shaking of ES modules in Vite should reduce this further for the subset used (`Renderer`, `Program`, `Mesh`, `Plane`, `Texture`, `RenderTarget`). Actual shipped size should be benchmarked during implementation.
