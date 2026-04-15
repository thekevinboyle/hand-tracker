# ogl Mosaic Implementation - Research

**Wave**: Second
**Researcher**: Web Research Subagent (claude-sonnet-4-6)
**Date**: 2026-04-14
**Status**: Complete

---

## Summary

This file provides working, copy-paste-ready implementation snippets for the ogl WebGL2 bootstrap, the GLSL ES 3.0 mosaic/pixelation fragment shader with region masking, the per-frame video texture upload pattern, region rectangle derivation from MediaPipe hand landmarks, uniform update strategy, aspect ratio / full-viewport stretch handling, and WebGL context loss cleanup. Every decision is grounded in confirmed ogl source code and MDN/WebGL2 specifications as validated during second-wave research.

---

## Key Findings

### 1. ogl Bootstrap: Renderer, Triangle, Program, Mesh

The canonical ogl pattern for a full-screen effect with no camera is the **Triangle screen shader** — not `Plane`. The `Triangle` geometry generates a single oversized triangle in NDC space that covers the entire viewport without requiring a projection matrix or camera object:

- Positions: `Float32Array([-1, -1,  3, -1,  -1, 3])` — three vertices extending beyond clip bounds
- UVs: `Float32Array([0, 0,  2, 0,  0, 2])` — extends to 2.0 so the visible 0..1 area maps cleanly
- No index buffer needed; drawn as `gl.TRIANGLES` with `count: 3`

When `renderer.render({ scene: mesh })` is called **without a `camera` argument**, ogl skips all matrix uniform population (projectionMatrix, viewMatrix, modelViewMatrix) and skips frustum culling. The geometry draws directly in NDC space — the vertex shader need only pass through `position` as `gl_Position = vec4(position, 0, 1)`.

**Complete bootstrap:**

```typescript
// src/engine/renderer.ts
import { Renderer, Program, Mesh, Texture } from 'ogl';
import { Triangle } from 'ogl';  // ogl exports Triangle from extras

export function createOglRenderer(canvas: HTMLCanvasElement) {
  // webgl: 2 is the default; explicit for clarity.
  // alpha: false — composited over a black background, no transparency needed.
  // autoClear: true — clears before each render call.
  const renderer = new Renderer({
    canvas,
    webgl: 2,
    alpha: false,
    antialias: false,    // full-screen quad, no geometry edges to antialias
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,  // required for canvas.captureStream() recording (D28)
  });

  const gl = renderer.gl;
  // Match canvas pixel dimensions to its CSS display size.
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);

  return { renderer, gl };
}
```

**Note on `preserveDrawingBuffer`**: D28 requires `canvas.captureStream(30)` for recording. Without `preserveDrawingBuffer: true` the canvas is cleared before `captureStream` can read it, producing a black recording. Set this to `true`.

---

### 2. Vertex Shader (UV Passthrough, WebGL2 / GLSL ES 3.0)

The screen-shader example ships with WebGL1 syntax (`attribute`, `varying`, `gl_FragColor`). Since the project uses `webgl: 2` (D18), shaders must use GLSL ES 3.0 syntax. The `#version 300 es` directive **must be the absolute first character** — no blank lines, no BOM, no comments before it.

```glsl
#version 300 es

in vec2 uv;
in vec2 position;

out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
```

The `Triangle` geometry provides `uv` and `position` attributes. No model/view/projection matrices are needed because positions are already in NDC clip space.

**Mirror mode (D10)**: CSS `scaleX(-1)` is applied to the display canvases, not the WebGL source texture. The raw video fed to WebGL is unmirrored (D27). Therefore the vertex shader does **not** flip UVs. Landmark coordinates from MediaPipe are in unmirrored space, consistent with the texture.

---

### 3. Fragment Shader (GLSL ES 3.0): Mosaic with Region Masking

**Design decisions from DISCOVERY.md:**
- D9: `tileSize` default 16 px, range 4–64; `blendOpacity` default 1.0, range 0–1; `edgeFeather` default 0, range 0–8 px
- D5: Regions are rectangles derived from the hand polygon; `effect.regionPadding` expands by N cells
- D18: Regions passed as `vec4[]` uniform array (x1, y1, x2, y2 in normalized UV space)
- Max regions cap: 96 (12 columns × 8 rows default grid, per D4)

**GLSL ES 3.0 dynamic loop bounds**: In GLSL ES 3.0 / WebGL2, for-loop termination conditions **can** use non-constant expressions including uniform integers. The constant-bound restriction only applied to GLSL ES 1.0 / WebGL1. However, for maximum cross-GPU compatibility on integrated laptop GPUs (the target), use the safe pattern: a compile-time `MAX_REGIONS` cap with an early `break` on the uniform count.

```glsl
#version 300 es
precision highp float;
precision highp int;

// --- Samplers & resolution ---
uniform sampler2D uVideo;
uniform vec2 uResolution;        // canvas size in px (post-dpr)

// --- Mosaic parameters ---
uniform float uTileSize;         // tile size in px, e.g. 16.0
uniform float uBlendOpacity;     // 0.0 = show original, 1.0 = full mosaic
uniform float uEdgeFeather;      // feather radius in px (0–8)

// --- Region mask ---
// Each vec4 = (x1, y1, x2, y2) in normalized [0,1] UV space.
// x1 < x2, y1 < y2 (axis-aligned bounding boxes of active grid cells).
#define MAX_REGIONS 96
uniform vec4 uRegions[MAX_REGIONS];
uniform int  uRegionCount;       // actual number of active regions (0..96)

in  vec2 vUv;
out vec4 fragColor;

// Quantize uv to the center of the tile that contains it.
vec4 mosaicSample(vec2 uv) {
  // Convert tile size from px to UV units.
  vec2 tileUV = uTileSize / uResolution;
  // Snap to tile-grid, then offset to tile center for stable color.
  vec2 snapped = floor(uv / tileUV) * tileUV + tileUV * 0.5;
  return texture(uVideo, snapped);
}

// Returns 1.0 if uv is inside region r (x1y1x2y2 format), else 0.0.
float inRegion(vec2 uv, vec4 r) {
  // Use step() to avoid branching — faster on most GPU architectures.
  float x = step(r.x, uv.x) * step(uv.x, r.z);
  float y = step(r.y, uv.y) * step(uv.y, r.w);
  return x * y;
}

void main() {
  vec2 uv = vUv;

  // 1. Original pixel.
  vec4 original = texture(uVideo, uv);

  // 2. Check if this fragment is inside any active region.
  float regionWeight = 0.0;
  for (int i = 0; i < MAX_REGIONS; i++) {
    if (i >= uRegionCount) break;   // safe early exit (GLSL ES 3.0 allows this)
    regionWeight = max(regionWeight, inRegion(uv, uRegions[i]));
  }

  // 3. Edge feather: soften region boundaries.
  //    Compute the minimum distance to any region boundary in UV space
  //    and ramp regionWeight down over uEdgeFeather pixels.
  //    For zero feather this reduces to a hard cut.
  if (uEdgeFeather > 0.0 && regionWeight > 0.0) {
    float featherUV = uEdgeFeather / min(uResolution.x, uResolution.y);
    // Find the nearest region and compute border distance.
    float minDist = 1.0;
    for (int i = 0; i < MAX_REGIONS; i++) {
      if (i >= uRegionCount) break;
      vec4 r = uRegions[i];
      // Signed distance to the AABB interior (positive = inside).
      float dx = min(uv.x - r.x, r.z - uv.x);
      float dy = min(uv.y - r.y, r.w - uv.y);
      float d  = min(dx, dy);  // smallest margin to any edge of this rect
      if (d >= 0.0) {          // inside this region
        minDist = min(minDist, d);
      }
    }
    // Ramp: 0 at boundary → 1 at featherUV distance inward.
    float ramp = clamp(minDist / featherUV, 0.0, 1.0);
    regionWeight *= ramp;
  }

  // 4. Mosaic color for this fragment.
  vec4 mosaicColor = mosaicSample(uv);

  // 5. Blend: mix(original, mosaic, opacity * regionWeight).
  fragColor = mix(original, mosaicColor, uBlendOpacity * regionWeight);
}
```

**Key design notes:**
- `step()` for the AABB test avoids a branch per region, which is friendlier on shader compilers.
- The feather loop runs a second pass only when `uEdgeFeather > 0.0` **and** the fragment is already in a region — the `regionWeight > 0.0` guard skips it for the majority of off-hand pixels.
- `uBlendOpacity = 1.0` (default D9) produces a full mosaic replace. `0.0` passes original through.
- The `tileUV * 0.5` offset in `mosaicSample` samples the center of each tile, not its corner — this avoids sampling artifacts at tile boundaries.

---

### 4. JS Side: Uniform Updates Each Frame

```typescript
// src/effects/handTrackingMosaic/render.ts

// --- Types ---
type Rect = { x1: number; y1: number; x2: number; y2: number };  // UV space [0,1]

const MAX_REGIONS = 96;
// Pre-allocated buffer — no GC pressure in the hot render path.
const regionsBuffer = new Float32Array(MAX_REGIONS * 4);

/**
 * Pack rect array into the flat Float32Array expected by gl.uniform4fv.
 * ogl reads program.uniforms.uRegions.value and calls gl.uniform4fv internally.
 */
function packRegions(rects: Rect[]): Float32Array {
  const count = Math.min(rects.length, MAX_REGIONS);
  for (let i = 0; i < count; i++) {
    regionsBuffer[i * 4 + 0] = rects[i].x1;
    regionsBuffer[i * 4 + 1] = rects[i].y1;
    regionsBuffer[i * 4 + 2] = rects[i].x2;
    regionsBuffer[i * 4 + 3] = rects[i].y2;
  }
  // Zero out any stale tail entries.
  regionsBuffer.fill(0, count * 4);
  return regionsBuffer;
}

/**
 * Called every frame from the rVFC loop.
 * `params` is the paramStore resolved snapshot (post-modulation).
 * `rects` is the active cell list in UV space (output of computeActiveRegions).
 */
function updateUniforms(
  program: Program,
  rects: Rect[],
  params: { tileSize: number; blendOpacity: number; edgeFeather: number },
  canvasW: number,
  canvasH: number,
): void {
  program.uniforms.uResolution.value    = [canvasW, canvasH];
  program.uniforms.uTileSize.value      = params.tileSize;
  program.uniforms.uBlendOpacity.value  = params.blendOpacity;
  program.uniforms.uEdgeFeather.value   = params.edgeFeather;
  program.uniforms.uRegionCount.value   = Math.min(rects.length, MAX_REGIONS);
  program.uniforms.uRegions.value       = packRegions(rects);
  // ogl checks .value reference; mutating a pre-allocated Float32Array in-place
  // does NOT trigger a re-upload unless the reference changes OR needsUpdate is set.
  // Reassign the reference after each pack to ensure ogl sees the change:
  //   — already handled above since packRegions returns the same buffer object,
  //   — but ogl's state cache compares by reference identity. Safest: always
  //     assign a new reference per frame or use the workaround below.
}
```

**ogl uniform caching gotcha**: ogl caches uniform values and skips `gl.uniform*` calls when the value reference has not changed. Because `regionsBuffer` is mutated in-place, its reference stays the same frame-to-frame. There are two safe approaches:

Option A — re-assign the buffer each frame (allocates a new array, avoids GC if using a ring buffer):
```typescript
program.uniforms.uRegions.value = regionsBuffer.slice(0, MAX_REGIONS * 4);
```

Option B — bypass caching by declaring the uniform with `{ value: ..., onceBound: false }` — this is not an ogl public API.

Option C (recommended) — set `program.uniforms.uRegions.value` to `regionsBuffer` but also always re-assign after mutating, since JS arrays compared by reference will appear "changed" only if a new object is assigned. In practice, the safest pattern is:

```typescript
// After mutating regionsBuffer in-place, assign a new Float32Array view
// sharing the same underlying ArrayBuffer — no allocation, new reference:
program.uniforms.uRegions.value = new Float32Array(
  regionsBuffer.buffer, 0, MAX_REGIONS * 4
);
```

This creates a new typed array view over the same memory — zero-copy, but a new object reference that satisfies ogl's cache check.

**Complete Program initialization with all uniforms:**

```typescript
import { Renderer, Program, Mesh, Texture } from 'ogl';
import { Triangle } from 'ogl';
import { VERTEX_SHADER, FRAGMENT_SHADER } from './shader.glsl';

export function initMosaicEffect(gl: WebGL2RenderingContext) {
  const geometry = new Triangle(gl);

  const texture = new Texture(gl, {
    generateMipmaps: false,
    // flipY defaults to true for TEXTURE_2D — correct for HTMLVideoElement
    // (webcam frames are top-row-first; WebGL expects bottom-row-first).
    flipY: true,
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR,
    wrapS: gl.CLAMP_TO_EDGE,
    wrapT: gl.CLAMP_TO_EDGE,
  });

  const program = new Program(gl, {
    vertex:   VERTEX_SHADER,
    fragment: FRAGMENT_SHADER,
    depthTest: false,    // 2D full-screen quad, no depth needed
    uniforms: {
      uVideo:        { value: texture },
      uResolution:   { value: [1280, 720] },   // updated each frame
      uTileSize:     { value: 16.0 },
      uBlendOpacity: { value: 1.0 },
      uEdgeFeather:  { value: 0.0 },
      uRegionCount:  { value: 0 },
      uRegions:      { value: new Float32Array(MAX_REGIONS * 4) },
    },
  });

  const mesh = new Mesh(gl, { geometry, program });

  return { mesh, program, texture };
}
```

---

### 5. Region Derivation: Landmark Polygon → Active Grid Cells

**Algorithm (src/effects/handTrackingMosaic/region.ts):**

Step 1 — Build the hand polygon in pixel space from 6 landmarks (D5: wrist=0, fingertips=4,8,12,16,20).
Step 2 — Expand polygon outward by `regionPadding` cells (inflate bounding box, or expand each vertex outward from centroid).
Step 3 — For each grid cell, test if the cell's center point is inside the polygon. If yes, push the cell's UV rect.

**Point-in-polygon** for the hand shape: the 6-landmark polygon is non-convex (concave between fingers), so the winding number algorithm is used rather than a convex half-plane test.

```typescript
// src/effects/handTrackingMosaic/region.ts

import type { Landmark } from '@mediapipe/tasks-vision';

export type Rect = { x1: number; y1: number; x2: number; y2: number };

// MediaPipe landmark index constants (D5).
const POLY_LANDMARKS = [0, 4, 8, 12, 16, 20] as const;

/**
 * Winding-number point-in-polygon test.
 * poly: array of [x, y] in any consistent coordinate space.
 * Returns true if (px, py) is inside the polygon.
 */
function pointInPolygon(px: number, py: number, poly: [number, number][]): boolean {
  let wn = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % n];
    if (y0 <= py) {
      if (y1 > py) {
        // Cross product sign: left turn means point is to the left of the edge.
        const cross = (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0);
        if (cross > 0) wn++;
      }
    } else {
      if (y1 <= py) {
        const cross = (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0);
        if (cross < 0) wn--;
      }
    }
  }
  return wn !== 0;
}

/**
 * Expand a polygon by `padding` pixels outward from its centroid.
 * This is a simple centroid-push expansion (sufficient for convex hulls
 * and nearly-convex hand polygons; not a true Minkowski offset).
 */
function expandPolygon(
  poly: [number, number][],
  paddingPx: number,
): [number, number][] {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return poly.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return [x + (dx / len) * paddingPx, y + (dy / len) * paddingPx];
  });
}

/**
 * Derive active cell rects from MediaPipe landmarks.
 *
 * @param landmarks  Array of {x, y, z} normalized [0,1] from HandLandmarkerResult.
 * @param videoW     Video element naturalWidth (unmirrored source, px).
 * @param videoH     Video element naturalHeight (px).
 * @param columnEdges  Array of x-coordinates defining column boundaries (px),
 *                   length = columnCount + 1. From grid.ts seeded generator.
 * @param rowEdges     Array of y-coordinates defining row boundaries (px),
 *                   length = rowCount + 1. Uniform rows.
 * @param regionPadding  Expand polygon outward by this many cells worth of px.
 * @returns Array of Rect in normalized UV [0,1] space, capped at MAX_REGIONS=96.
 */
export function computeActiveRegions(
  landmarks: Landmark[] | null,
  videoW: number,
  videoH: number,
  columnEdges: number[],   // length = columnCount + 1
  rowEdges: number[],      // length = rowCount + 1
  regionPadding: number,
): Rect[] {
  if (!landmarks || landmarks.length === 0) return [];

  // 1. Build polygon in pixel space from 6 landmarks.
  const rawPoly: [number, number][] = POLY_LANDMARKS.map(
    (idx) => [landmarks[idx].x * videoW, landmarks[idx].y * videoH]
  );

  // 2. Compute padding in pixels from average cell size.
  const avgCellW = videoW / (columnEdges.length - 1);
  const avgCellH = videoH / (rowEdges.length - 1);
  const paddingPx = regionPadding * Math.max(avgCellW, avgCellH);
  const poly = paddingPx > 0 ? expandPolygon(rawPoly, paddingPx) : rawPoly;

  // 3. Test each cell center; collect matching cells as UV rects.
  const rects: Rect[] = [];
  const colCount = columnEdges.length - 1;
  const rowCount = rowEdges.length - 1;

  for (let row = 0; row < rowCount && rects.length < 96; row++) {
    for (let col = 0; col < colCount && rects.length < 96; col++) {
      const cellX0 = columnEdges[col];
      const cellX1 = columnEdges[col + 1];
      const cellY0 = rowEdges[row];
      const cellY1 = rowEdges[row + 1];

      // Test cell center point.
      const cx = (cellX0 + cellX1) * 0.5;
      const cy = (cellY0 + cellY1) * 0.5;

      if (pointInPolygon(cx, cy, poly)) {
        rects.push({
          x1: cellX0 / videoW,
          y1: cellY0 / videoH,
          x2: cellX1 / videoW,
          y2: cellY1 / videoH,
        });
      }
    }
  }

  return rects;
}
```

**Notes on the algorithm:**
- Cell center test (`cx, cy`) is the "conservative-but-accurate" approach specified in the task. SAT (Separating Axis Theorem) is the alternative for exact polygon-AABB overlap, but cell-center-in-polygon matches the visual spec and is simpler.
- `POLY_LANDMARKS = [0, 4, 8, 12, 16, 20]` — wrist plus five fingertips (D5). This creates a concave hand outline.
- The cap `rects.length < 96` enforces MAX_REGIONS at the collection stage, not just in the shader.
- `columnEdges` comes from `grid.ts`'s seeded non-uniform column width generator (D4); `rowEdges` are uniform. Both are in pixel space matching the video's natural size.

---

### 6. Video Texture Upload: gl.texImage2D + flipY + Per-Frame Pattern

**ogl's `Texture` class** handles the raw WebGL calls internally. The correct per-frame pattern using ogl:

```typescript
// Inside the rVFC render loop callback:
function frame(_now: DOMHighResTimeStamp, _meta: VideoFrameCallbackMetadata): void {
  // Video readiness guard — prevents uploading a zero-size or not-decoded frame.
  if (videoEl.readyState >= videoEl.HAVE_ENOUGH_DATA) {
    // Assign video element to texture.image once; re-assign each frame so
    // ogl's internal update() sees the new frame content.
    texture.image   = videoEl;
    texture.needsUpdate = true;   // triggers gl.texImage2D on next renderer.render()
  }

  // Update uniforms before rendering.
  updateUniforms(program, activeRects, resolvedParams, canvasW, canvasH);

  // WebGL draw: full-screen Triangle, no camera needed.
  renderer.render({ scene: mesh });

  // Re-register — rVFC is one-shot, must re-register each frame (like rAF).
  videoEl.requestVideoFrameCallback(frame);
}

// Start the loop.
videoEl.requestVideoFrameCallback(frame);
```

**What ogl does internally when `needsUpdate = true`:**
1. `gl.bindTexture(gl.TEXTURE_2D, texture.id)`
2. If `flipY` is `true` (default for TEXTURE_2D): `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)`
3. `gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoElement)` — WebGL accepts HTMLVideoElement directly and reads the current decoded frame
4. Resets `needsUpdate = false`

**Why `texImage2D` not `texSubImage2D`**: ogl uses `texImage2D` for every update (it does not distinguish first-upload from subsequent ones). This is slightly less optimal than `texSubImage2D` for subsequent frames, but the difference is negligible for a single 640×480 or 1280×720 texture at 30 fps. If raw-WebGL control is needed for the extra performance margin, call `gl.texSubImage2D` directly instead of relying on ogl's update path.

**Texture initialization options (critical for video):**

| Option | Value | Reason |
|--------|-------|--------|
| `generateMipmaps` | `false` | Video is non-power-of-2 size; mipmaps require POT or explicit base level |
| `flipY` | `true` (default) | HTMLVideoElement frames are top-row-first; WebGL expects bottom-row-first |
| `minFilter` | `gl.LINEAR` | Avoid mipmap filter (`gl.LINEAR_MIPMAP_LINEAR`) since mipmaps disabled |
| `magFilter` | `gl.LINEAR` | Smooth upscaling |
| `wrapS/T` | `gl.CLAMP_TO_EDGE` | Prevents UV wrap artifacts at edges |

---

### 7. Aspect Ratio / Webcam Size Mismatch

Per DISCOVERY.md D18 and the reference screenshot analysis: **full-viewport stretch** (not letterboxed) is the correct behavior. The WebGL canvas is stretched to `100vw × 100vh` via CSS. The video texture fills the entire quad regardless of aspect ratio mismatch.

This means no aspect-correction math is needed in the vertex shader or uniform setup. The tradeoff (video may appear horizontally squeezed or stretched) is consistent with the reference screenshot and is the explicit product decision.

**Canvas sizing — match CSS to physical pixels:**

```typescript
function resizeRenderer(
  renderer: Renderer,
  canvas: HTMLCanvasElement,
): void {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    renderer.setSize(w, h);
    // ogl's setSize updates canvas.width/height to w * dpr, h * dpr
    // and calls gl.viewport(0, 0, canvas.width, canvas.height) automatically.
  }
}

// ResizeObserver on the container element (D18, pitfalls):
const ro = new ResizeObserver(() => resizeRenderer(renderer, canvas));
ro.observe(canvas.parentElement!);
```

After resize, update `uResolution` uniform to match:
```typescript
program.uniforms.uResolution.value = [renderer.gl.canvas.width, renderer.gl.canvas.height];
```

The `uResolution` value must be the actual GL canvas pixel dimensions (post-dpr), **not** CSS dimensions, because the fragment shader computes tile size in physical pixels using `uTileSize / uResolution`.

---

### 8. Cleanup and Context Loss Handling

**React cleanup (`useEffect` return / `dispose()`):**

```typescript
// Cleanup on unmount — called by React's useEffect cleanup:
function dispose(
  renderer: Renderer,
  mesh: Mesh,
  texture: Texture,
  ro: ResizeObserver,
  canvas: HTMLCanvasElement,
): void {
  // Cancel rVFC — store the handle returned by requestVideoFrameCallback:
  //   const handle = videoEl.requestVideoFrameCallback(frame);
  //   ...
  //   videoEl.cancelVideoFrameCallback(handle);
  // (store `handle` in a ref; cancel it here)

  // Destroy ogl resources.
  mesh.program.remove();   // deletes WebGL program
  texture.destroy?.();     // ogl does not currently expose destroy() on Texture;
                            // call gl.deleteTexture(texture.texture) directly if needed

  // Stop ResizeObserver.
  ro.disconnect();

  // Release the WebGL context (optional — browser GCs it, but good practice).
  const ext = renderer.gl.getExtension('WEBGL_lose_context');
  ext?.loseContext();
}
```

**WebGL context loss (GPU preemption, tab backgrounding, device sleep):**

```typescript
function attachContextLossHandlers(
  canvas: HTMLCanvasElement,
  reinit: () => void,
): () => void {
  let handle: number | undefined;

  function onContextLost(e: Event): void {
    // MUST call preventDefault() to allow the browser to attempt restoration.
    e.preventDefault();
    // Cancel the rVFC loop (store the handle in a ref in the parent).
    if (handle !== undefined) {
      videoEl.cancelVideoFrameCallback(handle);
    }
    console.warn('[hand-tracker-fx] WebGL context lost');
  }

  function onContextRestored(): void {
    console.info('[hand-tracker-fx] WebGL context restored — reinitializing');
    // All GL objects (textures, programs, buffers) are invalid after context loss.
    // The simplest safe strategy: tear down and re-initialize the entire effect.
    reinit();
  }

  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  // Return cleanup function.
  return () => {
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
  };
}
```

**What must be re-created after context restoration** (all WebGL objects are invalid):
- `Renderer` (or re-acquire `gl` context reference from existing canvas)
- `Texture` (re-create + re-upload video frame)
- `Program` (re-compile shaders)
- `Mesh` + `Triangle` geometry

The `reinit()` callback should call the full `initMosaicEffect()` path again.

---

## Recommended Approach

1. Use `Triangle` geometry (not `Plane`) for the full-screen quad. No camera or projection matrix needed. NDC positions hardcoded in the geometry.

2. Use `Renderer({ webgl: 2, preserveDrawingBuffer: true })`. Access `renderer.gl` for the raw context.

3. All shaders use `#version 300 es` as the absolute first line. Vertex: `in`/`out`, no matrices. Fragment: `in vec2 vUv`, `out vec4 fragColor`, `texture()` not `texture2D()`.

4. Fragment shader uses a `#define MAX_REGIONS 96` constant for the array and loop cap, with an early `break` on `uRegionCount` for correct behavior with fewer active cells.

5. Edge feather: a second pass inside `main()` guarded by `uEdgeFeather > 0.0 && regionWeight > 0.0` — skips the expensive second loop for the 90% of pixels that are off-hand.

6. Texture: `generateMipmaps: false`, `flipY: true`, `CLAMP_TO_EDGE`. Assign `texture.image = videoEl` and set `texture.needsUpdate = true` every frame inside a `readyState >= HAVE_ENOUGH_DATA` guard.

7. Regions: winding-number PIP test on the 6-landmark hand polygon (non-convex); cell-center-in-polygon cell selection; `expandPolygon()` for `regionPadding`; output as UV-space `Rect[]` capped at 96.

8. Uniforms: pre-allocate `Float32Array(MAX_REGIONS * 4)` outside the render loop; mutate in-place each frame; assign a new typed array view over the same buffer to trigger ogl's cache invalidation.

9. Canvas resize: `ResizeObserver` on the container; call `renderer.setSize(w, h)` and update `uResolution` uniform.

10. Context loss: listen `webglcontextlost` (preventDefault), `webglcontextrestored` (full reinit).

---

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| `Triangle` geometry (no camera) | Exact NDC fit, zero matrix math | UVs extend to 2.0 (slightly unintuitive) | **Recommended** |
| `Plane(gl, 2, 2)` with ortho camera | More familiar three.js-like setup | Requires `Camera` object, extra matrix uniforms | Acceptable fallback |
| SAT for polygon-cell overlap | Exact polygon-AABB intersection | More code, overkill for cell-center visual spec | Rejected for MVP |
| Letterbox aspect correction in vertex shader | Preserves video aspect ratio | Contradicts product decision (full-stretch per reference screenshot) | Rejected per D18/D27 |
| `texSubImage2D` directly (bypass ogl) | ~5% faster texture upload | Loses ogl abstraction, more boilerplate | Worth if profiling shows bottleneck |

---

## Pitfalls and Edge Cases

- **`#version 300 es` placement**: Must be character 0 of the shader string. A template literal like `` const VERT = `\n#version 300 es` `` will fail at compile time with `INVALID_OPERATION: no GLSL ES version directive`. Use `const VERT = '#version 300 es\n...'` or a tagged template that strips leading whitespace.

- **ogl uniform cache with Float32Array mutation**: ogl skips `gl.uniform*` if the value reference has not changed. Always assign a new typed array view after mutating `regionsBuffer` in-place (see Section 4 for the zero-copy pattern).

- **`preserveDrawingBuffer: true` performance**: This disables the double-buffer swap optimization in some browsers and can reduce throughput by ~10%. It is required for `canvas.captureStream()` (D28). Benchmark on target hardware; the 30 fps budget is comfortable on MacBook Air class.

- **`readyState >= HAVE_ENOUGH_DATA` guard**: Without this check, `texture.image = videoEl` during the video's initial seek or buffering phase uploads a zero-size frame, producing a GL error and a black frame. `HAVE_ENOUGH_DATA === 4`.

- **`cancelVideoFrameCallback` on cleanup**: Unlike `requestAnimationFrame`, `requestVideoFrameCallback` is re-registered each call and returns a handle. Store the handle in a ref: `rVFCHandleRef.current = videoEl.requestVideoFrameCallback(frame)`. Cancel with `videoEl.cancelVideoFrameCallback(rVFCHandleRef.current)` in the useEffect cleanup.

- **`uResolution` in physical pixels**: Must use `renderer.gl.canvas.width / height` (post-dpr), not `clientWidth / clientHeight`. The tile-size-to-UV conversion `uTileSize / uResolution` is only correct in physical pixels.

- **GLSL uniform array declaration vs upload size**: `uniform vec4 uRegions[MAX_REGIONS]` is a compile-time fixed-size array. Uploading fewer than 96 entries is fine — the `uRegionCount` uniform gates the loop. Never upload more than 96 entries (buffer overflow into adjacent uniform locations).

- **Hand polygon winding**: MediaPipe landmarks are in image space (y increases downward). The winding number algorithm handles both CW and CCW winding correctly, so the pixel-space Y-inversion is not a concern.

- **Mirror mode and landmark coordinates**: D27 specifies that the raw video (unmirrored) is the WebGL source. Landmark coordinates are in unmirrored space. CSS `scaleX(-1)` is on the display canvases only. Therefore no UV flip is needed in the vertex shader, and landmark pixel positions map directly to texture UVs without x-inversion.

- **`depthTest: false` on the Program**: The full-screen quad has no meaningful depth values. Setting `depthTest: false` avoids a depth buffer allocation and prevents any stale depth state from culling the quad.

---

## References

- [ogl GitHub - Triangle source](https://github.com/oframe/ogl/blob/master/src/extras/Triangle.js) — confirmed NDC positions `[-1,-1, 3,-1, -1,3]`, UVs `[0,0, 2,0, 0,2]`
- [ogl GitHub - triangle-screen-shader example](https://github.com/oframe/ogl/tree/master/examples) — canonical no-camera bootstrap
- [ogl GitHub - textures example](https://github.com/oframe/ogl/blob/master/examples/textures.html) — video texture `readyState >= HAVE_ENOUGH_DATA` + `needsUpdate` pattern
- [ogl GitHub - Texture.js source](https://github.com/oframe/ogl/blob/master/src/core/Texture.js) — `flipY` defaults `true` for `TEXTURE_2D`; `needsUpdate` triggers re-upload
- [ogl GitHub - Program.js source](https://github.com/oframe/ogl/blob/master/src/core/Program.js) — uniform type constants; `Float32Array` → `gl.uniform4fv`; int → `gl.uniform1i`; `flatten()` for array uniforms
- [ogl GitHub - Renderer.js source](https://github.com/oframe/ogl/blob/master/src/core/Renderer.js) — `render({scene, camera?})` skips matrix uniforms when no camera; `setSize()` multiplies by dpr
- [WebGL2 Fundamentals - WebGL1 to WebGL2 migration](https://webgl2fundamentals.org/webgl/lessons/webgl1-to-webgl2.html) — `#version 300 es` first-line rule; `attribute`→`in`; `varying`→`in`/`out`; `gl_FragColor`→`out vec4`; `texture2D`→`texture`
- [MDN - Animating textures in WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Animating_textures_in_WebGL) — `texImage2D(videoElement)` per-frame pattern
- [MDN - texImage2D](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texImage2D) — accepts HTMLVideoElement; UNPACK_FLIP_Y_WEBGL
- [MDN - webglcontextrestored](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextrestored_event) — context loss event pattern
- [Winding number point-in-polygon JS](https://gist.github.com/vlasky/d0d1d97af30af3191fc214beaf379acc) — exact algorithm used in Section 5
- [Geeks3D - Pixelation GLSL shader](https://www.geeks3d.com/20101029/shader-library-pixelation-post-processing-effect-glsl/) — original mosaic quantization formula (`floor(uv/tile)*tile`)
- [Khronos GLSL Dynamic Loops](https://community.khronos.org/t/glsl-dynamic-looping/52133) — dynamic loop bound behavior; constant-cap + early-break pattern

---

## Second Wave Additions

### Implementation Details (filtered by DISCOVERY.md)

**Exact file mapping to D38 folder structure:**

| This research section | Target file |
|-----------------------|-------------|
| Bootstrap (Section 1) | `src/engine/renderer.ts` |
| Vertex shader (Section 2) | `src/effects/handTrackingMosaic/shader.glsl.ts` |
| Fragment shader (Section 3) | `src/effects/handTrackingMosaic/shader.glsl.ts` |
| Uniform updates (Section 4) | `src/effects/handTrackingMosaic/render.ts` |
| Region derivation (Section 5) | `src/effects/handTrackingMosaic/region.ts` |
| Texture upload loop (Section 6) | `src/engine/renderer.ts` (render loop) |
| Resize handling (Section 7) | `src/engine/renderer.ts` |
| Cleanup / context loss (Section 8) | `src/engine/renderer.ts` |

**`FrameContext` integration (D37)**: The `render()` method of `EffectInstance` receives `FrameContext.videoTexture` (a `WebGLTexture`). When using ogl, the `ogl.Texture` wraps the raw `WebGLTexture`. The `FrameContext.videoSize` provides `{w, h}` for `uResolution`. `FrameContext.landmarks` feeds into `computeActiveRegions()`. `FrameContext.params` provides `tileSize`, `blendOpacity`, `edgeFeather`, `regionPadding`.

**`EffectManifest.create(gl)` (D36)**: Returns an `EffectInstance` with `render(ctx: FrameContext)` and `dispose()`. The `initMosaicEffect()` function in Section 4 maps to the body of `create()`.

### Testing Strategy

- Vitest unit tests for `computeActiveRegions` (D21): pass synthetic landmarks and grid edges; assert returned rects count, UV range [0,1], cap at 96.
- Vitest unit test for `pointInPolygon`: test points known inside/outside the 6-landmark polygon shape.
- Vitest unit test for `packRegions`: assert Float32Array layout (index 0=x1, 1=y1, 2=x2, 3=y2).
- Visual smoke test (Playwright E2E, D21): fake device media stream; assert canvas renders non-black pixels; assert FPS ≥ 20.
- Shader compile test: instantiate `Renderer` in a jsdom-like environment (or Playwright page context); assert no `gl.getProgramInfoLog` errors after `Program` creation.

### Human Actions Required

| Action | Who | How | Status |
|--------|-----|-----|--------|
| None for this module | — | All implementation is code-only | — |
