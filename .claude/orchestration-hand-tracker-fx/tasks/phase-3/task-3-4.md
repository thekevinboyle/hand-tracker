# Task 3.4: Wire the Effect render() — Uniform Upload + Mesh Draw

**Phase**: 3 — Mosaic Shader
**Branch**: `task/3-4-effect-render-wire-up`
**Commit prefix**: `Task 3.4:`
**Estimated complexity**: High
**Max Ralph iterations**: 30

---

## Goal

**Feature Goal**: Replace the Phase 2 no-op `handTrackingMosaicManifest.create(gl).render(ctx)` with a real `EffectInstance` that links the shaders from Task 3.2 into an ogl `Program`, binds the video `Texture` from Task 3.1, calls `computeActiveRegions` from Task 3.3 each frame, packs the active rects into the `uRegions` `vec4[]` with ogl-cache-friendly view rewrapping, and draws the full-screen Triangle mesh — producing the visible mosaic inside the hand polygon.

**Deliverable**: `src/effects/handTrackingMosaic/render.ts` (new) exporting `initMosaicEffect(gl, texture)`, `updateMosaicUniforms`, `packRegions`. `src/effects/handTrackingMosaic/render.test.ts` (new) with tests for `packRegions` buffer-view semantics and `updateMosaicUniforms` with a stubbed `Program`. `src/effects/handTrackingMosaic/manifest.ts` (modified) — `create()` returns a real `EffectInstance`.

**Success Definition**: `pnpm vitest run src/effects/handTrackingMosaic/render.test.ts` exits 0; `pnpm build` exits 0; `pnpm test:e2e --grep "Task 3.4:"` passes the "mosaic visible inside polygon" pixel-sample assertion; manual `pnpm preview` with a real hand in frame shows the reference-screenshot mosaic effect.

---

## User Persona

**Target User**: Creative technologist using Hand Tracker FX for the first time.

**Use Case**: User grants camera, lifts a hand, expects to see the pixelated mosaic snap onto their hand — exactly as shown in `reference-assets/touchdesigner-reference.png`.

**User Journey**:
1. User opens app and grants camera
2. Phase 1 renders the raw video via `<video>` + WebGL canvas
3. Task 3.4 wires the effect → the WebGL canvas now shows the video through the mosaic shader
4. When a hand is visible → `computeActiveRegions` produces rects → shader mosaics those cells
5. When no hand is visible → `rects === []` → `uRegionCount === 0` → shader returns `original` for every pixel → raw webcam passes through

**Pain Points Addressed**: The entire Phase 3 visual promise hinges on this task. Without it, Tasks 3.1–3.3 are dormant capability.

---

## Why

- Satisfies D5, D9, D18, D27, D37 — this is the integration point for every Phase 3 decision
- Unlocks Task 3.5 (context loss needs a real Program / Mesh / Texture to tear down) and Task 3.R (visual fidelity gate)
- Satisfies D28 precondition — the `canvas.captureStream(30)` recording in Phase 4 needs a rendered mosaic to capture

---

## What

- `initMosaicEffect(gl, texture)` → `{ mesh, program }`:
  - Creates `Triangle` geometry
  - Creates `Program` with `VERTEX_SHADER`, `FRAGMENT_SHADER`, `depthTest: false`, initial uniforms
  - Creates `Mesh(gl, { geometry, program })`
- `packRegions(rects)` → `Float32Array`:
  - Mutates a module-scoped `Float32Array(MAX_REGIONS * 4)` in place
  - Returns a FRESH `Float32Array` view over the same `ArrayBuffer` (new reference → ogl cache invalidated, zero allocation of underlying memory)
- `updateMosaicUniforms(program, rects, params, physicalW, physicalH)` → void:
  - Sets `uResolution`, `uTileSize`, `uBlendOpacity`, `uEdgeFeather`, `uRegionCount`, `uRegions`
  - Uses physical pixels (post-DPR)
- `manifest.create(gl)` replacement (signature UNCHANGED from Task 2.1 — `create(gl: WebGL2RenderingContext): EffectInstance`):
  - Acquires the shared `Renderer` and video `Texture` via module-scoped getters from `src/engine/renderer.ts` (`getRenderer()` and `getVideoTexture()`, populated by Task 3.1 when Stage boots the renderer). NO `deps` parameter is added to the manifest signature.
  - Builds `mesh` + `program` via `initMosaicEffect(gl, getVideoTexture())`
  - Returns `EffectInstance` with `render(ctx)` and `dispose()`
  - `render(ctx)` reads `ctx.landmarks`, `ctx.params`, `ctx.videoSize`, calls `computeActiveRegions`, calls `updateMosaicUniforms`, calls `getRenderer().render({ scene: mesh })`
  - `dispose()` calls `program.remove()` (leaves texture deletion to Task 3.5)

### NOT Building (scope boundary)

- Shader source (Task 3.2)
- Region math (Task 3.3)
- Renderer bootstrap and video texture (Task 3.1)
- `webglcontextlost` / `webglcontextrestored` handlers (Task 3.5)
- Record / `captureStream` (Phase 4)
- Modulation (Phase 4) — params are read directly from `ctx.params`

### Success Criteria

- [ ] `src/effects/handTrackingMosaic/render.ts` exports `initMosaicEffect`, `updateMosaicUniforms`, `packRegions`
- [ ] `src/effects/handTrackingMosaic/manifest.ts` updated: `create()` returns a real `EffectInstance` whose `render()` mosaics inside the hand polygon
- [ ] `pnpm biome check src/effects/handTrackingMosaic/` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `pnpm vitest run src/effects/handTrackingMosaic/render.test.ts` exits 0
- [ ] `pnpm build` exits 0
- [ ] `pnpm test:e2e --grep "Task 3.4:"` exits 0 — asserts a non-original pixel in the expected mosaic region when a fake landmark payload is injected
- [ ] Manual `pnpm preview`: holding a real hand in front of the webcam shows the mosaic snapping onto the hand region, mosaic tile size changing with `mosaic.tileSize` slider in Tweakpane
- [ ] `window.__handTracker.getLastRegionCount()` returns > 0 when a hand is detected

---

## All Needed Context

```yaml
files:
  - path: src/engine/renderer.ts
    why: Created by Task 3.1 — exports createOglRenderer, createVideoTexture. manifest.create() receives gl + texture from here
    gotcha: Texture is an ogl Texture, NOT a raw WebGLTexture. The raw handle is texture.texture. Pass the ogl Texture object, not the raw handle

  - path: src/effects/handTrackingMosaic/shader.ts
    why: Created by Task 3.2 — exports VERTEX_SHADER, FRAGMENT_SHADER, MAX_REGIONS
    gotcha: Do not redeclare MAX_REGIONS locally — always import from './shader'

  - path: src/effects/handTrackingMosaic/region.ts
    why: Created by Task 3.3 — exports computeActiveRegions, Rect type
    gotcha: computeActiveRegions expects columnEdges/rowEdges in PIXEL space; grid.ts produces normalized edges — multiply by videoW/videoH at the call site

  - path: src/effects/handTrackingMosaic/grid.ts
    why: Task 2.3 — exports `generateColumnWidths(seed, count, variance)` / `generateRowWidths(seed, count, variance)` / `buildGridLayout(input)` returning NORMALIZED cumulative breakpoints in [0,1] of length `count` (last=1.0). Do NOT import `computeColumnEdges` / `computeRowEdges` — those names were never exported.
    gotcha: Grid edges are computed from paramStore (seed, columnCount, rowCount, widthVariance); re-compute only when those params change, not every frame. `computeActiveRegions` expects edges of length `count + 1` with a leading 0 — prepend 0 at the call site before multiplying by videoW/videoH.

  - path: src/effects/handTrackingMosaic/manifest.ts
    why: Phase 2 no-op manifest — this task replaces create() and leaves the param schema untouched
    gotcha: Param schema (defaultParams) stays exactly as Task 2.5 authored it; only create() changes

  - path: src/engine/renderLoop.ts
    why: Caller — dispatches `EffectInstance.render(FrameContext)` every rVFC tick. Understand the FrameContext shape
    gotcha: The loop owns renderer.render() — OR — the effect owns renderer.render()? Decision: effect owns renderer.render() via a ref passed in create(). Document the contract.

  - path: src/engine/manifest.ts
    why: Types for EffectManifest, EffectInstance, ParamDef per D36
    gotcha: EffectInstance.render signature is `(ctx: FrameContext) => void` — do NOT return a value or throw; surface errors via a renderer-level onError callback

urls:
  - url: https://github.com/oframe/ogl/blob/master/src/core/Program.js
    why: Program uniform handling — ogl uses reference identity to detect changes to uniform `.value`
    critical: "ogl compares `program.uniforms.uRegions.value` by reference — mutating the same Float32Array in place does NOT trigger re-upload. Rewrap via `new Float32Array(buf.buffer, 0, n * 4)` to force invalidation with zero allocation"

  - url: https://github.com/oframe/ogl/blob/master/src/core/Mesh.js
    why: Mesh draw path
    critical: "renderer.render({ scene: mesh }) with no camera argument skips projection/view uniforms — correct for a full-screen Triangle"

  - url: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/uniform
    why: uniform4fv dispatch pattern
    critical: "Float32Array memory layout for `uniform vec4 uRegions[96]` must be strictly (x1,y1,x2,y2, x1,y1,x2,y2, ...) — matches GLSL std140-ish tight packing for `vec4[]`"

skills:
  - prp-task-ralph-loop
  - hand-tracker-fx-architecture
  - ogl-webgl-mosaic
  - mediapipe-hand-landmarker
  - vitest-unit-testing-patterns

discovery:
  - D5: Hand polygon + regionPadding
  - D9: tileSize / blendOpacity / edgeFeather defaults + ranges
  - D18: ogl + full-viewport stretch
  - D27: No mirror flip in shader or region code
  - D28: preserveDrawingBuffer: true precondition (set in Task 3.1)
  - D36: EffectManifest / EffectInstance contract
  - D37: FrameContext shape
```

### Current Codebase Tree (relevant subset)

```
src/
  engine/
    renderer.ts                     # Task 3.1 — createOglRenderer, createVideoTexture
    renderLoop.ts                   # Task 1.5 — rVFC loop, dispatches EffectInstance.render
    manifest.ts                     # EffectManifest, EffectInstance, ParamDef
    registry.ts
    paramStore.ts
    types.ts                        # FrameContext
  effects/
    handTrackingMosaic/
      shader.ts                     # Task 3.2 — VERTEX_SHADER, FRAGMENT_SHADER, MAX_REGIONS
      region.ts                     # Task 3.3 — computeActiveRegions, Rect
      grid.ts                       # Task 2.3 — generateColumnWidths, generateRowWidths, buildGridLayout
      gridRenderer.ts               # Task 2.3
      blobRenderer.ts               # Task 2.4
      manifest.ts                   # Task 2.5 — MODIFY here
      index.ts                      # registerEffect(manifest)
```

### Desired Codebase Tree

```
src/
  effects/
    handTrackingMosaic/
      render.ts                     # NEW — initMosaicEffect, updateMosaicUniforms, packRegions
      render.test.ts                # NEW — unit tests with stubbed Program
      manifest.ts                   # MODIFIED — create() returns real EffectInstance
```

### Known Gotchas

```typescript
// CRITICAL: ogl Program uniform cache invalidation.
// `program.uniforms.uRegions.value = existingFloat32Array;` // <- same reference, no re-upload
// `program.uniforms.uRegions.value = new Float32Array(buf.buffer, 0, n*4);` // <- new view, ogl uploads
// The second form allocates the `Float32Array` object itself (small) but NOT the underlying memory.

// CRITICAL: uResolution MUST be physical pixels (renderer.gl.canvas.width/height),
// not clientWidth/clientHeight. On a 2x-DPR display, using CSS pixels makes
// uTileSize (in physical px) visually half its intended size.

// CRITICAL: Grid edges are normalized [0..1] in grid.ts. computeActiveRegions
// expects PIXEL-space edges. Multiply by videoW/videoH at the call site.

// CRITICAL: renderer.render() ownership. Decision: the effect.render() calls
// `rendererRef.render({ scene: mesh })` AFTER uniform upload. The renderLoop
// does NOT call renderer.render() separately. Document this in a code comment.

// CRITICAL: When ctx.landmarks === null (no hand detected), computeActiveRegions
// returns []. uRegionCount = 0. The shader loop executes 0 iterations and fragColor
// === original. Do NOT early-return from render() in this case — the video must
// still render through the program. Draw the mesh unconditionally.

// CRITICAL: Tweakpane params object is read directly by reference. Never clone it
// per frame. Read `ctx.params.mosaic.tileSize` etc. in the hot path.

// CRITICAL: Grid edges recomputation. Only recompute when seed, columnCount,
// rowCount, or widthVariance changes. Use a memoization cache keyed on the tuple.
// Recomputing every frame wastes ~0.3ms but is CORRECT — the optimization is
// optional; ship correctness first, memoize later if needed.

// CRITICAL: EffectInstance.dispose() is called on unmount. Call program.remove()
// here (deletes WebGL program + shader objects). Do NOT delete the texture —
// the renderer owns the texture lifetime (see Task 3.5).

// CRITICAL (compositing for captureStream — Phase 4 precondition): The 2D overlay
// canvas is the single composited surface that Phase 4's `canvas.captureStream()`
// targets. Per-frame 2D draw order (owned by this task's render()):
//   1. overlayCtx2d.drawImage(webglCanvas, 0, 0, target.width, target.height)  // pre-composite
//   2. drawGrid(overlayCtx2d, ...)
//   3. drawLandmarkBlobs(overlayCtx2d, ...)
// This guarantees the 2D canvas's pixel buffer carries the full mosaic + overlay
// — so `canvas.captureStream()` on the overlay produces a recording WITH the
// mosaic visible (Phase 4 Task 4.5 relies on this).
//
// Mirror: CSS `scaleX(-1)` on the stage wrapper does NOT affect `captureStream()`
// output. If `params.input.mirror === true`, apply the flip inside this draw:
//   ctx.save();
//   ctx.scale(-1, 1);
//   ctx.translate(-target.width, 0);
//   ctx.drawImage(webglCanvas, 0, 0, target.width, target.height);
//   ctx.restore();
// …then draw grid + blobs WITHOUT the flip (they already run in the un-flipped
// target space; labels' un-mirror counter-transform is separate, per Task 2.4).

// CRITICAL: React StrictMode double-mount → create() can be called twice.
// Each call must produce an independent Program/Mesh pair. Dispose the first
// on the StrictMode re-invocation. This works naturally if the Stage.tsx
// cleanup path invokes instance.dispose() then calls manifest.create() again.

// CRITICAL: TypeScript strict. ctx.params is typed as Record<string, unknown>
// per D37. Narrow with a schema: `const p = ctx.params as MosaicParams;` only
// AFTER runtime validation in paramStore — or import the concrete param type
// from the manifest and cast once at the entry of render().
```

---

## Implementation Blueprint

### Data Models

```typescript
// src/effects/handTrackingMosaic/render.ts
import type { Program, Mesh, Texture } from 'ogl';

import type { Rect } from './region';
import type { MosaicParams } from './manifest'; // param schema exported from manifest

export type MosaicEffectBundle = {
  mesh: Mesh;
  program: Program;
};
// NOTE: `MosaicRenderDeps` has been REMOVED. The manifest signature is pinned to
// `create(gl: WebGL2RenderingContext): EffectInstance` (Task 2.1). The Renderer
// and Texture are sourced via module-scoped getters exported from
// `src/engine/renderer.ts`: `getRenderer()` and `getVideoTexture()`.
```

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE src/effects/handTrackingMosaic/render.ts
  - IMPLEMENT:
      const regionsBuffer = new Float32Array(MAX_REGIONS * 4);  // module scope
      export function packRegions(rects: readonly Rect[]): Float32Array
      export function initMosaicEffect(gl: WebGL2RenderingContext, texture: Texture): MosaicEffectBundle
      export function updateMosaicUniforms(
        program: Program,
        rects: readonly Rect[],
        params: { tileSize: number; blendOpacity: number; edgeFeather: number },
        physicalW: number,
        physicalH: number,
      ): void
  - MIRROR: src/engine/paramStore.ts (module shape); skill `ogl-webgl-mosaic` source blocks
  - NAMING: camelCase functions; PascalCase types
  - GOTCHA: packRegions mutates the module-scoped buffer in place then returns `new Float32Array(regionsBuffer.buffer, 0, MAX_REGIONS * 4)` — fresh view, no memory allocation
  - GOTCHA: Zero-fill unused slots: `regionsBuffer.fill(0, count * 4)` so stale data from prior frames doesn't leak
  - GOTCHA: uRegionCount must be set to Math.min(rects.length, MAX_REGIONS) — defensive
  - VALIDATE: pnpm biome check src/effects/handTrackingMosaic/render.ts && pnpm tsc --noEmit

Task 2: CREATE src/effects/handTrackingMosaic/render.test.ts
  - IMPLEMENT: Vitest tests:
      * it('packRegions returns a Float32Array with length MAX_REGIONS * 4')
      * it('packRegions copies rects in (x1,y1,x2,y2) order')
      * it('packRegions zero-fills trailing slots beyond count')
      * it('packRegions returns a NEW view over the same ArrayBuffer on each call')
          const a = packRegions([...]);
          const b = packRegions([...]);
          expect(a.buffer).toBe(b.buffer);     // same underlying memory
          expect(a === b).toBe(false);          // different TypedArray reference
      * it('packRegions caps at MAX_REGIONS')
          const many = Array.from({ length: 200 }, () => sampleRect());
          const out = packRegions(many);
          // trailing slots (97..) may contain rect[97]... only if we didn't cap — assert cap:
          // We only USE Math.min(rects.length, MAX_REGIONS) in updateMosaicUniforms;
          // but packRegions itself must also loop only up to MAX_REGIONS, not beyond.
      * it('updateMosaicUniforms writes uResolution in physical pixels')
          pass program = fakeProgram({ uniforms: {...} }); physicalW=2560 (2x DPR of 1280)
          expect(program.uniforms.uResolution.value).toEqual([2560, ...])
      * it('updateMosaicUniforms writes uTileSize/uBlendOpacity/uEdgeFeather')
      * it('updateMosaicUniforms writes uRegionCount === Math.min(rects.length, MAX_REGIONS)')
      * it('updateMosaicUniforms rewraps the uRegions Float32Array on each call (cache invalidation)')
  - MIRROR: src/engine/renderer.test.ts (stubbed-ogl pattern)
  - MOCK: `vi.mock('ogl', ...)` — stub Program as a plain object with a `uniforms` record
  - GOTCHA: Do not hit real WebGL in L2; the ogl Program stub is a plain object with `uniforms: Record<string, { value: unknown }>`
  - VALIDATE: pnpm vitest run src/effects/handTrackingMosaic/render.test.ts

Task 3: MODIFY src/engine/renderer.ts (ADD module-scoped ref getters — Task 3.1 already owns this file)
  - ADD: two module-scoped refs populated by Task 3.1's bootstrap closure AND two getter exports:
      let _renderer: Renderer | null = null;
      let _videoTexture: Texture | null = null;
      export function _setRenderer(r: Renderer | null): void { _renderer = r; }
      export function _setVideoTexture(t: Texture | null): void { _videoTexture = t; }
      export function getRenderer(): Renderer {
        if (!_renderer) throw new Error('Renderer not initialized — call createOglRenderer first');
        return _renderer;
      }
      export function getVideoTexture(): Texture {
        if (!_videoTexture) throw new Error('Video texture not initialized — call createVideoTexture first');
        return _videoTexture;
      }
  - ENSURE: Task 3.1's Stage.tsx bootstrap effect calls `_setRenderer(renderer)` and `_setVideoTexture(texture)` after construction, and sets BOTH to null in cleanup
  - PRESERVE: All Task 3.1 exports (createOglRenderer, createVideoTexture, uploadVideoFrame, resizeRenderer)
  - VALIDATE: pnpm biome check src/engine/renderer.ts && pnpm tsc --noEmit

Task 4: MODIFY src/effects/handTrackingMosaic/manifest.ts
  - FIND: `create(gl: WebGL2RenderingContext): EffectInstance {`  (Task 2.5 no-op body)
  - PRESERVE: signature EXACTLY `create(gl: WebGL2RenderingContext): EffectInstance` — do NOT add a `deps` parameter
  - PRESERVE: params schema, defaultParams, modulationSources
  - IMPLEMENT inside create() (sources renderer + texture via module getters from Task 3):
      import { getRenderer, getVideoTexture } from '../../engine/renderer';
      const renderer = getRenderer();
      const texture = getVideoTexture();
      const { mesh, program } = initMosaicEffect(gl, texture);
      let gridCache: { seed: number; cols: number; rows: number; variance: number; colEdgesNorm: number[]; rowEdgesNorm: number[] } | null = null;
      return {
        render(ctx) {
          const p = ctx.params as MosaicParams;
          // (re)compute grid edges if any of seed/cols/rows/variance changed
          if (!gridCache || gridCache.seed !== p.grid.seed || gridCache.cols !== p.grid.columnCount || gridCache.rows !== p.grid.rowCount || gridCache.variance !== p.grid.widthVariance) {
            gridCache = {
              seed: p.grid.seed, cols: p.grid.columnCount, rows: p.grid.rowCount, variance: p.grid.widthVariance,
              colEdgesNorm: generateColumnWidths(p.grid.seed, p.grid.columnCount, p.grid.widthVariance),
              rowEdgesNorm: generateRowWidths(p.grid.seed, p.grid.rowCount, p.grid.widthVariance),
            };
          }
          const videoW = ctx.videoSize.w;
          const videoH = ctx.videoSize.h;
          // computeActiveRegions expects edges of length = count + 1 (includes leading 0).
          // generateColumnWidths returns cumulative breakpoints of length = count (last=1.0, no leading 0).
          // Prepend 0 once per param-change (cached in gridCache) OR inline here:
          const colEdgesPx = [0, ...gridCache.colEdgesNorm].map(v => v * videoW);
          const rowEdgesPx = [0, ...gridCache.rowEdgesNorm].map(v => v * videoH);
          const rects = computeActiveRegions(
            ctx.landmarks, videoW, videoH, colEdgesPx, rowEdgesPx, p.effect.regionPadding,
          );
          const canvasW = renderer.gl.canvas.width;
          const canvasH = renderer.gl.canvas.height;
          updateMosaicUniforms(program, rects, {
            tileSize: p.mosaic.tileSize,
            blendOpacity: p.mosaic.blendOpacity,
            edgeFeather: p.mosaic.edgeFeather,
          }, canvasW, canvasH);
          renderer.render({ scene: mesh });
          // Per-frame 2D overlay pre-composite (see Known Gotchas — captureStream precondition):
          if (ctx.ctx2d) {
            const ov = ctx.ctx2d;
            const webglCanvas = renderer.gl.canvas as HTMLCanvasElement;
            const mirror = p.input.mirrorMode === true;
            if (mirror) {
              ov.save();
              ov.scale(-1, 1);
              ov.translate(-canvasW, 0);
              ov.drawImage(webglCanvas, 0, 0, canvasW, canvasH);
              ov.restore();
            } else {
              ov.drawImage(webglCanvas, 0, 0, canvasW, canvasH);
            }
            // Grid + blobs draw on top via the effect's existing 2D paths (Task 2.5).
          }
          // Dev hook — last region count for E2E assertions:
          if (import.meta.env.DEV) {
            (window as unknown as { __handTracker?: Record<string, unknown> }).__handTracker ??= {};
            (window as unknown as { __handTracker: { getLastRegionCount?: () => number } }).__handTracker.getLastRegionCount = () => rects.length;
          }
        },
        dispose() {
          program.remove();
        },
      };
  - GOTCHA: The manifest signature `create(gl): EffectInstance` stays exactly as Task 2.1 published it. `getRenderer()` and `getVideoTexture()` throw if called before Task 3.1's bootstrap runs — Stage.tsx orders initialization so they're populated before any render().
  - GOTCHA: gridCache.colEdgesNorm + prepending 0 allocates per param-change; cache the prepended-and-scaled pixel edges too if you want zero allocation per frame — optional optimization.
  - VALIDATE: pnpm biome check src/effects/handTrackingMosaic/manifest.ts && pnpm tsc --noEmit

Task 5: (removed — renderLoop.ts requires NO changes; manifest's `create(gl)` signature is unchanged)

Task 6: CREATE tests/e2e/task-3-4.spec.ts
  - IMPLEMENT: describe('Task 3.4: effect render wire-up', ...):
      * Launch with --use-fake-device-for-media-stream; grant camera
      * Inject a fake landmark payload via window.__handTracker.setFakeLandmarks([...]) placing the hand over the top-left quadrant
      * Wait 3 frames (await page.waitForTimeout(100))
      * Assert window.__handTracker.getLastRegionCount() > 0
      * Sample a pixel at center of the WebGL canvas (or a known mosaic region) via page.evaluate and a readPixels helper; assert the pixel is NOT identical to the raw video pixel at the same position
      * Change `mosaic.tileSize` via the paramStore dev hook; assert the rendered pixel differs between tileSize=4 and tileSize=64
  - NAMING: `Task 3.4:` prefix
  - GOTCHA: readPixels requires preserveDrawingBuffer: true (set in Task 3.1)
  - GOTCHA: Use a deterministic fake landmark payload — the bundled testsrc2 y4m doesn't contain a detectable hand by default
  - VALIDATE: pnpm test:e2e --grep "Task 3.4:"
```

### Integration Points

```yaml
PARAM_STORE:
  - effect.render() reads ctx.params directly (no subscribe, no React state)
  - params shape: { grid: {...}, mosaic: {...}, effect: { regionPadding } }

EFFECT_REGISTRY:
  - registerEffect(handTrackingMosaicManifest) still happens in index.ts (unchanged)
  - The only change is create()'s return value

FRAME_CONTEXT:
  - ctx.landmarks null-safe; ctx.videoSize always present; ctx.params post-modulation (Phase 4 later)

RENDERER:
  - renderer.gl used for Program compilation; renderer.render({ scene: mesh }) called by effect.render()
  - renderer.gl.canvas.width/height supplies physical-pixel uResolution

TEXTURE:
  - The video Texture is uploaded per-frame by renderLoop (via Task 3.1's uploadVideoFrame)
  - The effect Program binds to that same Texture via `program.uniforms.uVideo.value = texture`
```

---

## Validation Loop

### Level 1 — Syntax and Style

```bash
pnpm biome check src/effects/handTrackingMosaic/ src/engine/manifest.ts src/engine/renderLoop.ts
pnpm tsc --noEmit
```

### Level 2 — Unit Tests

```bash
pnpm vitest run src/effects/handTrackingMosaic/render.test.ts
pnpm vitest run
```

### Level 3 — Integration

```bash
pnpm build
```

### Level 4 — E2E

```bash
pnpm test:e2e --grep "Task 3.4:"
```

---

## Final Validation Checklist

### Technical

- [ ] All 4 levels exit 0
- [ ] `pnpm biome check .` — zero errors
- [ ] `pnpm tsc --noEmit` — zero errors
- [ ] `pnpm vitest run` — all tests pass
- [ ] `pnpm build` — production build succeeds

### Feature

- [ ] Raw webcam visible when no hand detected (rects.length === 0, uRegionCount === 0)
- [ ] Mosaic visible inside hand polygon when a hand is detected
- [ ] `mosaic.tileSize` slider in Tweakpane changes the visible tile size live
- [ ] `mosaic.blendOpacity = 0` → mosaic invisible (identity render)
- [ ] `mosaic.blendOpacity = 1` → full replacement within regions
- [ ] No allocation in hot path beyond: result Rect[] (3.3) + expandPolygon array (3.3) + small primitives here — verified via Chrome Perf allocation sampling (optional — L2 tests enforce the zero-memory-alloc of packRegions)
- [ ] StrictMode: create() called twice → second call's render() works; first call's dispose() ran cleanly

### Code Quality

- [ ] No `any` types — MosaicParams imported from manifest
- [ ] MAX_REGIONS imported from `./shader` (single source of truth)
- [ ] No React state in render path
- [ ] `program.remove()` in dispose()
- [ ] Texture deletion deferred to Task 3.5 (renderer-owned)

---

## Anti-Patterns

- Do not mutate a Float32Array in place and reassign the same reference — ogl will not re-upload
- Do not use CSS pixels for `uResolution` — physical only
- Do not early-return from render() when landmarks === null — the video must still render
- Do not recompute grid edges every frame — cache on the seed/count/variance tuple
- Do not clone `ctx.params` per frame — read directly
- Do not delete the texture in `dispose()` — renderer owns it (Task 3.5)
- Do not call `detectForVideo()` here — that's renderLoop's job
- Do not introduce React state to signal region changes — the param update path is the renderLoop itself
- Do not swallow program compile failures — throw `ShaderCompileError` with the driver message so the 8-state machine (or at least a console error) surfaces it
- Do not call `renderer.render()` from both renderLoop and effect.render() — document which owner dispatches the draw (decision: effect.render() dispatches)
- Do not add a `'use client'` directive — Vite SPA

---

## No Prior Knowledge Test

- [ ] Every file path in `All Needed Context` exists (or is created by this task / a prior Phase 3 task)
- [ ] Every URL in `urls:` is reachable
- [ ] Every D-number cited exists in DISCOVERY.md (D5, D9, D18, D27, D28, D36, D37)
- [ ] Implementation tasks topologically sorted — render.ts → render.test.ts → manifest.ts → types → renderLoop → e2e
- [ ] Validation Loop commands are copy-paste runnable
- [ ] All upstream modules exist: Task 3.1 renderer.ts, Task 3.2 shader.ts, Task 3.3 region.ts, Task 2.3 grid.ts, Task 2.5 manifest.ts
- [ ] The task is atomic — does not require context loss handlers (3.5) or the final regression (3.R)

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/ogl-webgl-mosaic/SKILL.md
.claude/skills/mediapipe-hand-landmarker/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
