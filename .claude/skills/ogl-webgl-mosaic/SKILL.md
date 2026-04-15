---
name: ogl-webgl-mosaic
description: Use when implementing or debugging the WebGL mosaic shader or the ogl render loop for Hand Tracker FX. Full-screen video quad, region-masked mosaic fragment shader (MAX_REGIONS 96), cell-center-in-polygon region derivation, context-loss recovery.
---

# ogl WebGL Mosaic

Implementation reference for the Hand Tracker FX WebGL bottom layer: an `ogl` 1.0.11 renderer that uploads the webcam `HTMLVideoElement` as a texture each frame and applies a region-masked mosaic fragment shader. Region rectangles are derived per frame from the MediaPipe hand polygon via a cell-center-in-polygon test. Authority: DISCOVERY.md D5, D9, D18, D27, D37.

## Scope

- `src/engine/renderer.ts` — ogl bootstrap, render loop, resize, context loss
- `src/effects/handTrackingMosaic/shader.glsl.ts` — vertex + fragment GLSL
- `src/effects/handTrackingMosaic/render.ts` — uniform packing, per-frame updates
- `src/effects/handTrackingMosaic/region.ts` — landmark-polygon → UV rects

The grid RNG (`grid.ts`), landmark acquisition (`tracking/handLandmarker.ts`), and Canvas 2D overlay are owned by other skills. This skill ends at the WebGL canvas.

## Library

`ogl@1.0.11` (zero-dep, ~29 kb minzipped). Imports used:

```ts
import { Renderer, Program, Mesh, Texture, Triangle } from 'ogl';
```

`Triangle` (from `ogl/extras`, re-exported from top-level) is the correct geometry for a full-screen effect — a single oversized triangle in NDC with UVs extending to 2.0. **Do not use `Plane`** for this: `Plane` requires a `Camera` and projection matrix, which are unnecessary overhead here.

## Renderer bootstrap

```ts
// src/engine/renderer.ts
import { Renderer } from 'ogl';

export function createOglRenderer(canvas: HTMLCanvasElement) {
  const renderer = new Renderer({
    canvas,
    webgl: 2,                     // INTEGER (not boolean) — ogl reads `webgl === 2`
    alpha: false,
    antialias: false,             // full-screen quad; nothing to AA
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,  // REQUIRED for canvas.captureStream() recording (D28)
  });

  const gl = renderer.gl;
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  return { renderer, gl };
}
```

Critical flags:

| Flag | Value | Why |
|---|---|---|
| `webgl` | `2` | ogl checks `webgl === 2`; passing `true` falls back to WebGL1 |
| `preserveDrawingBuffer` | `true` | Required by `canvas.captureStream(30)` per D28; ~10% throughput cost acceptable at 30 fps |
| `antialias` | `false` | Single full-screen quad has no geometry edges |
| `alpha` | `false` | Video is opaque; composited over black |

When `renderer.render({ scene: mesh })` is called **without a `camera` argument**, ogl skips all projection/view/model matrix uniforms. The vertex shader writes `gl_Position` directly from NDC positions.

## Shaders (GLSL ES 3.0 / WebGL 2)

**Critical**: `#version 300 es` must be byte 0 of the shader string. No leading whitespace, no BOM, no comment. The template literal pattern `` `\n#version 300 es\n...` `` fails at compile time with `INVALID_OPERATION: no GLSL ES version directive`.

### Vertex

```ts
// src/effects/handTrackingMosaic/shader.glsl.ts
export const VERTEX_SHADER = `#version 300 es
in vec2 uv;
in vec2 position;

out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;
```

No mirror flip here. Per D27, the raw unmirrored video is the WebGL texture source and MediaPipe landmarks are in unmirrored space — CSS `scaleX(-1)` on the display canvas is the only mirror applied.

### Fragment

```ts
export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uVideo;
uniform vec2  uResolution;    // physical pixels (post-dpr)

uniform float uTileSize;      // px, D9 default 16, range 4..64
uniform float uBlendOpacity;  // D9 default 1.0, range 0..1
uniform float uEdgeFeather;   // px, D9 default 0, range 0..8

#define MAX_REGIONS 96
uniform vec4 uRegions[MAX_REGIONS];  // (x1, y1, x2, y2) in UV space
uniform int  uRegionCount;

in  vec2 vUv;
out vec4 fragColor;

vec4 mosaicSample(vec2 uv) {
  vec2 tileUV = uTileSize / uResolution;
  vec2 snapped = floor(uv / tileUV) * tileUV + tileUV * 0.5;
  return texture(uVideo, snapped);
}

float inRegion(vec2 uv, vec4 r) {
  // step() avoids a branch; r is packed (x1, y1, x2, y2)
  float x = step(r.x, uv.x) * step(uv.x, r.z);
  float y = step(r.y, uv.y) * step(uv.y, r.w);
  return x * y;
}

void main() {
  vec2 uv = vUv;
  vec4 original = texture(uVideo, uv);

  float regionWeight = 0.0;
  for (int i = 0; i < MAX_REGIONS; i++) {
    if (i >= uRegionCount) break;
    regionWeight = max(regionWeight, inRegion(uv, uRegions[i]));
  }

  // Edge feather: guarded second loop only for fragments already inside a region.
  if (uEdgeFeather > 0.0 && regionWeight > 0.0) {
    float featherUV = uEdgeFeather / min(uResolution.x, uResolution.y);
    float minDist = 1.0;
    for (int i = 0; i < MAX_REGIONS; i++) {
      if (i >= uRegionCount) break;
      vec4 r = uRegions[i];
      float dx = min(uv.x - r.x, r.z - uv.x);
      float dy = min(uv.y - r.y, r.w - uv.y);
      float d  = min(dx, dy);
      if (d >= 0.0) minDist = min(minDist, d);
    }
    float ramp = clamp(minDist / featherUV, 0.0, 1.0);
    regionWeight *= ramp;
  }

  vec4 mosaicColor = mosaicSample(uv);
  fragColor = mix(original, mosaicColor, uBlendOpacity * regionWeight);
}
`;
```

**Why this shape**:

- **`step()` for AABB test** — avoids branching per region; friendlier to shader compilers.
- **`MAX_REGIONS 96` + `break`** — GLSL ES 3.0 permits dynamic loop bounds, but a compile-time cap with early exit is the most portable pattern for integrated laptop GPUs.
- **Region format `vec4(x1, y1, x2, y2)`** — packed pairs, not `(x, y, w, h)`. Keep this consistent on the JS side.
- **Feather guarded by `regionWeight > 0.0`** — the second loop is skipped for the ~90% of off-hand pixels.
- **`tileUV * 0.5` offset** — samples the center of each tile, not its corner; avoids artifacts at tile boundaries.

## Texture (video source)

```ts
// src/engine/renderer.ts
import { Texture } from 'ogl';

const texture = new Texture(gl, {
  generateMipmaps: false,       // non-POT video would fail mipmap completeness
  flipY: true,                  // default for TEXTURE_2D; HTMLVideoElement is top-row-first
  minFilter: gl.LINEAR,         // no mipmap filter (mipmaps disabled)
  magFilter: gl.LINEAR,
  wrapS: gl.CLAMP_TO_EDGE,      // prevents wrap artifacts at UV edges
  wrapT: gl.CLAMP_TO_EDGE,
});
```

Settings rationale:

| Option | Value | Reason |
|---|---|---|
| `generateMipmaps` | `false` | Video frames are non-POT (640×480 / 1280×720); mipmap generation errors without it |
| `flipY` | `true` (default) | Video is top-row-first; WebGL expects bottom-row-first |
| `minFilter` / `magFilter` | `gl.LINEAR` | Mipmap filters invalid with mipmaps disabled |
| `wrapS` / `wrapT` | `gl.CLAMP_TO_EDGE` | UV 0..1 strictly bounded; no wrap |

## Program + Mesh setup

```ts
// src/effects/handTrackingMosaic/render.ts
import { Program, Mesh, Triangle, type Texture } from 'ogl';
import { VERTEX_SHADER, FRAGMENT_SHADER } from './shader.glsl';

export const MAX_REGIONS = 96;

export function initMosaicEffect(gl: WebGL2RenderingContext, texture: Texture) {
  const geometry = new Triangle(gl);

  const program = new Program(gl, {
    vertex:   VERTEX_SHADER,
    fragment: FRAGMENT_SHADER,
    depthTest: false,
    uniforms: {
      uVideo:        { value: texture },
      uResolution:   { value: [1280, 720] },              // updated on resize
      uTileSize:     { value: 16.0 },
      uBlendOpacity: { value: 1.0 },
      uEdgeFeather:  { value: 0.0 },
      uRegionCount:  { value: 0 },
      uRegions:      { value: new Float32Array(MAX_REGIONS * 4) },
    },
  });

  const mesh = new Mesh(gl, { geometry, program });
  return { mesh, program };
}
```

`depthTest: false` — the full-screen quad has no meaningful depth; avoids stale depth state culling the quad.

## Per-frame uniform upload (ogl cache invalidation)

ogl caches uniform values by reference identity. Mutating a pre-allocated `Float32Array` in place does not trigger a re-upload because the reference is unchanged. The zero-copy fix: wrap the same `ArrayBuffer` in a fresh `Float32Array` view each frame.

```ts
// src/effects/handTrackingMosaic/render.ts
export type Rect = { x1: number; y1: number; x2: number; y2: number };

// Pre-allocated ONCE at module scope — zero GC pressure in the hot path.
const regionsBuffer = new Float32Array(MAX_REGIONS * 4);

function packRegions(rects: Rect[]): Float32Array {
  const count = Math.min(rects.length, MAX_REGIONS);
  for (let i = 0; i < count; i++) {
    regionsBuffer[i * 4 + 0] = rects[i].x1;
    regionsBuffer[i * 4 + 1] = rects[i].y1;
    regionsBuffer[i * 4 + 2] = rects[i].x2;
    regionsBuffer[i * 4 + 3] = rects[i].y2;
  }
  regionsBuffer.fill(0, count * 4);
  // Return a NEW Float32Array VIEW over the SAME ArrayBuffer.
  // New reference -> ogl cache invalidated. No allocation of the underlying memory.
  return new Float32Array(regionsBuffer.buffer, 0, MAX_REGIONS * 4);
}

export function updateMosaicUniforms(
  program: Program,
  rects: Rect[],
  params: { tileSize: number; blendOpacity: number; edgeFeather: number },
  physicalW: number,   // renderer.gl.canvas.width  (post-dpr)
  physicalH: number,   // renderer.gl.canvas.height (post-dpr)
): void {
  program.uniforms.uResolution.value   = [physicalW, physicalH];
  program.uniforms.uTileSize.value     = params.tileSize;
  program.uniforms.uBlendOpacity.value = params.blendOpacity;
  program.uniforms.uEdgeFeather.value  = params.edgeFeather;
  program.uniforms.uRegionCount.value  = Math.min(rects.length, MAX_REGIONS);
  program.uniforms.uRegions.value      = packRegions(rects);
}
```

ogl inspects the uniform TYPE (`FLOAT_VEC4`) at program link and dispatches `gl.uniform4fv(location, Float32Array)` for the array — the packed flat layout (`x1,y1,x2,y2, x1,y1,x2,y2, ...`) matches GLSL's expected memory order for `vec4[]`.

## Render loop (rVFC)

```ts
// src/engine/renderer.ts
let rVFCHandle: number | undefined;

function frame(_now: DOMHighResTimeStamp, _meta: VideoFrameCallbackMetadata) {
  // 1. Guard against pre-decode / seeking frames.
  if (videoEl.readyState >= videoEl.HAVE_ENOUGH_DATA /* === 4 */) {
    texture.image = videoEl;
    texture.needsUpdate = true;   // MUST set each frame — ogl does not auto-poll video
  }

  // 2. Derive regions from landmarks (region.ts).
  const rects = computeActiveRegions(
    landmarks, videoEl.videoWidth, videoEl.videoHeight,
    columnEdges, rowEdges, params.regionPadding,
  );

  // 3. Push uniforms (PHYSICAL pixel resolution — post-dpr).
  updateMosaicUniforms(
    program, rects, params,
    renderer.gl.canvas.width, renderer.gl.canvas.height,
  );

  // 4. Draw. No camera -> ogl skips projection matrix uniforms.
  renderer.render({ scene: mesh });

  // 5. Re-register — rVFC is one-shot.
  rVFCHandle = videoEl.requestVideoFrameCallback(frame);
}

rVFCHandle = videoEl.requestVideoFrameCallback(frame);
```

Why rVFC over rAF: fires at the **lesser of video fps and display rate** — no wasted duplicate frames at 60 Hz when the webcam runs at 30 fps. Returns a numeric handle that must be canceled via `videoEl.cancelVideoFrameCallback(handle)` on unmount.

What ogl does internally when `needsUpdate = true`:

1. `gl.bindTexture(gl.TEXTURE_2D, texture.texture)`
2. `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)` (because `flipY: true`)
3. `gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoEl)` — WebGL accepts `HTMLVideoElement` directly
4. Resets `needsUpdate = false`

## Region derivation (cell-center-in-polygon)

Per D5, the hand polygon uses landmarks `[0, 4, 8, 12, 16, 20]` (wrist + 5 fingertips). This polygon is **non-convex** (concave between fingers), so use the **winding-number** point-in-polygon test rather than a half-plane/convex test.

```ts
// src/effects/handTrackingMosaic/region.ts
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export type Rect = { x1: number; y1: number; x2: number; y2: number };
const POLY_LANDMARKS = [0, 4, 8, 12, 16, 20] as const;

/** Winding-number PIP. Works for concave polygons. */
function pointInPolygon(px: number, py: number, poly: [number, number][]): boolean {
  let wn = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % n];
    if (y0 <= py) {
      if (y1 > py) {
        const cross = (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0);
        if (cross > 0) wn++;
      }
    } else if (y1 <= py) {
      const cross = (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0);
      if (cross < 0) wn--;
    }
  }
  return wn !== 0;
}

/** Centroid-push polygon inflation (sufficient for near-convex hand shape). */
function expandPolygon(poly: [number, number][], paddingPx: number): [number, number][] {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return poly.map(([x, y]) => {
    const dx = x - cx, dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return [x + (dx / len) * paddingPx, y + (dy / len) * paddingPx];
  });
}

/**
 * Active cell rects in UV space. Landmark coords MUST be in unmirrored
 * pixel space (D27) — do NOT apply the display mirror flip here.
 */
export function computeActiveRegions(
  landmarks: NormalizedLandmark[] | null,
  videoW: number, videoH: number,
  columnEdges: number[],   // length = columnCount + 1
  rowEdges: number[],      // length = rowCount + 1
  regionPadding: number,   // D5: cells of padding
): Rect[] {
  if (!landmarks || landmarks.length === 0) return [];

  const rawPoly: [number, number][] = POLY_LANDMARKS.map(
    (idx) => [landmarks[idx].x * videoW, landmarks[idx].y * videoH],
  );

  const avgCellW = videoW / (columnEdges.length - 1);
  const avgCellH = videoH / (rowEdges.length - 1);
  const paddingPx = regionPadding * Math.max(avgCellW, avgCellH);
  const poly = paddingPx > 0 ? expandPolygon(rawPoly, paddingPx) : rawPoly;

  const rects: Rect[] = [];
  const colCount = columnEdges.length - 1;
  const rowCount = rowEdges.length - 1;

  for (let row = 0; row < rowCount && rects.length < 96; row++) {
    for (let col = 0; col < colCount && rects.length < 96; col++) {
      const cx = (columnEdges[col] + columnEdges[col + 1]) * 0.5;
      const cy = (rowEdges[row]    + rowEdges[row + 1])    * 0.5;
      if (pointInPolygon(cx, cy, poly)) {
        rects.push({
          x1: columnEdges[col]     / videoW,
          y1: rowEdges[row]        / videoH,
          x2: columnEdges[col + 1] / videoW,
          y2: rowEdges[row + 1]    / videoH,
        });
      }
    }
  }
  return rects;
}
```

**Design decisions**:

- **Cell-center test** (not SAT polygon-AABB) — matches the reference screenshot's visual spec and is fast.
- **Winding number** — handles the concave between-finger geometry correctly.
- **Cap at 96** enforced at collection time (not just in the shader) — prevents wasted work when a maximum-size hand covers the entire grid.
- **MediaPipe Y increases downward** — winding number is orientation-agnostic, so no Y-flip needed.

## Aspect ratio (D18: full-viewport stretch)

**No letterboxing.** The canvas is stretched to `100vw × 100vh` via CSS and the Triangle quad fills NDC. Video aspect ratio mismatch (640×480 video in a 16:9 window) is accepted — horizontal stretch is the explicit product choice, consistent with the TouchDesigner reference screenshot.

No aspect-correction math in vertex shader or uniforms. Do not add letterbox bars.

## Resize

```ts
function resizeRenderer(renderer: Renderer, canvas: HTMLCanvasElement, program: Program) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    renderer.setSize(w, h);  // multiplies by dpr, updates canvas.width/height, calls gl.viewport
    // uResolution MUST be physical pixels (post-dpr), not CSS:
    program.uniforms.uResolution.value = [renderer.gl.canvas.width, renderer.gl.canvas.height];
  }
}

const ro = new ResizeObserver(() => resizeRenderer(renderer, canvas, program));
ro.observe(canvas.parentElement!);
```

**`uResolution` must be physical pixels.** `uTileSize` is authored in physical px (D9 default 16 px). The conversion `uTileSize / uResolution` is only correct when both are in the same pixel space. Using `clientWidth` on a 2x-dpr display would make tiles visually doubled.

## Context loss recovery

The WebGL context can be lost on GPU preemption, tab backgrounding, device sleep, or driver reset. All GL objects (textures, programs, buffers) become invalid and must be re-created.

```ts
function attachContextLossHandlers(
  canvas: HTMLCanvasElement,
  videoEl: HTMLVideoElement,
  rVFCHandleRef: { current: number | undefined },
  reinit: () => void,
): () => void {
  function onContextLost(e: Event) {
    e.preventDefault();  // REQUIRED — without this, the browser won't attempt restoration
    if (rVFCHandleRef.current !== undefined) {
      videoEl.cancelVideoFrameCallback(rVFCHandleRef.current);
      rVFCHandleRef.current = undefined;
    }
    console.warn('[hand-tracker-fx] WebGL context lost');
  }
  function onContextRestored() {
    console.info('[hand-tracker-fx] WebGL context restored — reinitializing');
    reinit();  // full teardown + initMosaicEffect() again
  }
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  return () => {
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
  };
}
```

`reinit()` must re-run `initMosaicEffect()` (new Texture, new Program, new Mesh) and restart the rVFC loop. The `Renderer` may or may not need re-creation depending on browser behavior — safest to tear everything down.

## Cleanup (useEffect return)

```ts
function dispose(opts: {
  renderer: Renderer;
  mesh: Mesh;
  texture: Texture;
  videoEl: HTMLVideoElement;
  rVFCHandle: number | undefined;
  ro: ResizeObserver;
  detachCtxLoss: () => void;
}) {
  // 1. Cancel rVFC (not rAF).
  if (opts.rVFCHandle !== undefined) {
    opts.videoEl.cancelVideoFrameCallback(opts.rVFCHandle);
  }

  // 2. Stop ResizeObserver.
  opts.ro.disconnect();

  // 3. Detach context-loss listeners.
  opts.detachCtxLoss();

  // 4. Delete GPU objects.
  opts.mesh.program.remove();  // deletes WebGL program + shaders
  // ogl Texture has NO destroy() method — go direct to gl:
  opts.renderer.gl.deleteTexture(opts.texture.texture);

  // 5. Optional: force context release so the canvas can be reused.
  const ext = opts.renderer.gl.getExtension('WEBGL_lose_context');
  ext?.loseContext();
}
```

Notes:

- `texture.destroy()` **does not exist** on ogl's `Texture` class (1.0.11). Use `gl.deleteTexture(texture.texture)` — the internal `WebGLTexture` handle is exposed as `.texture`.
- `mesh.program.remove()` is the canonical ogl teardown for a Program (deletes the WebGL program object).
- Under React StrictMode, `useEffect` runs its cleanup once in dev mounts, so cleanup must be idempotent.

## FrameContext integration (D37)

The effect engine dispatches `EffectInstance.render(ctx: FrameContext)`:

```ts
type FrameContext = {
  videoTexture: WebGLTexture;            // raw handle; ogl.Texture.texture
  videoSize:    { w: number; h: number };
  landmarks:    NormalizedLandmark[] | null;
  params:       Record<string, unknown>; // post-modulation resolved values
  timeMs:       number;
};
```

The mosaic `EffectInstance` reads `params.tileSize`, `params.blendOpacity`, `params.edgeFeather`, `params.regionPadding`, computes rects via `computeActiveRegions()`, and calls `updateMosaicUniforms()` + `renderer.render()`.

## Anti-patterns

1. **Don't feed mirrored (CSS-flipped) coordinates into landmark math.** Landmarks are in unmirrored video space (D27). The `scaleX(-1)` is purely CSS on the display canvases. If you flip landmark x before `computeActiveRegions`, active cells will land on the wrong side of the hand.

2. **Don't `new Float32Array(n * 4)` inside the frame callback.** At 30 fps that's 30 allocations/sec of a 1.5 KB buffer — churns GC. Pre-allocate once at module scope; rewrap with `new Float32Array(buf.buffer, 0, n * 4)` to get a fresh reference with zero allocation.

3. **Don't omit `texture.needsUpdate = true`.** ogl does not auto-poll video elements. Assigning `texture.image = videoEl` alone uploads only once; the next frame stays frozen. This is the most common "the video froze" bug.

4. **Don't pass `webgl: true` to Renderer.** It falls back to WebGL 1. The GLSL ES 3.0 shaders with `#version 300 es` will fail to compile. Pass the integer `2`.

5. **Don't put whitespace or comments before `#version 300 es`.** The directive must be at byte 0. `` `\n#version 300 es` `` will throw at shader compile.

6. **Don't use `clientWidth/clientHeight` for `uResolution`.** Must be `renderer.gl.canvas.width/height` (post-dpr physical pixels). On Retina, tiles would otherwise render at half the intended physical size.

7. **Don't use `Plane` + `Camera` for this.** The Triangle screen shader pattern is simpler and faster. `renderer.render({ scene: mesh })` with no camera argument skips all matrix uniforms.

8. **Don't rely on `texture.destroy()`.** Not present in ogl 1.0.11. Use `gl.deleteTexture(texture.texture)`.

9. **Don't forget `preserveDrawingBuffer: true`.** `canvas.captureStream(30)` (D28 record feature) returns black frames without it. Must be set at Renderer construction; cannot be toggled later.

10. **Don't skip the `readyState >= HAVE_ENOUGH_DATA` (4) guard.** Uploading a video element during initial decode produces a zero-size texture and a `GL_INVALID_VALUE` error, then a black frame.

11. **Don't use SAT or polygon-AABB exact intersection.** D5 specifies the cell-center-in-polygon test. SAT is more code and doesn't match the reference screenshot's visual behavior (cells either fully mosaic or fully pass through; no fractional activation).

12. **Don't send more than `MAX_REGIONS` (96) vec4s.** Uploading 97+ overruns the uniform array into adjacent uniform locations. Enforce the cap in `computeActiveRegions` (`rects.length < 96` breakout), not just in the shader.

13. **Don't call `e.preventDefault()` lazily on `webglcontextlost`.** Must be synchronous in the handler body; skipping it means the browser will not fire `webglcontextrestored`.

14. **Don't cancel rVFC with `cancelAnimationFrame`.** Different handle namespace. Use `videoEl.cancelVideoFrameCallback(handle)`.

## Cross-references

- DISCOVERY.md D5 (hand polygon landmarks), D9 (mosaic defaults/ranges), D18 (ogl + full-stretch), D27 (mirror-at-display-only), D37 (FrameContext shape)
- `.claude/orchestration-hand-tracker-fx/research/rendering-pipeline.md` — first-wave library comparison and overall render architecture
- `.claude/orchestration-hand-tracker-fx/research/ogl-mosaic-impl.md` — second-wave ogl 1.0.11 source confirmations
- `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png` — visual target; view during any shader tuning task
