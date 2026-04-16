/**
 * Mosaic effect render wiring (Task 3.4).
 *
 * Three narrowly-scoped helpers consumed by `manifest.create()`:
 *   - `initMosaicEffect(gl, texture)` — compiles VERTEX + FRAGMENT into an
 *     ogl `Program`, binds the video Texture on `uVideo`, builds a
 *     full-screen `Triangle` Mesh. Returned `{ mesh, program }` are disposed
 *     by the caller via `program.remove()` on unmount.
 *   - `packRegions(rects)` — flattens `Rect[]` into the module-scoped
 *     `Float32Array(MAX_REGIONS * 4)`, zero-fills unused slots, and returns
 *     a FRESH `Float32Array` view over the SAME ArrayBuffer. The new view
 *     invalidates ogl's reference-identity uniform cache so the regions
 *     actually upload; the zero-copy rewrap avoids per-frame allocation.
 *   - `updateMosaicUniforms(program, rects, params, physicalW, physicalH)` —
 *     writes every fragment-shader uniform from the caller-supplied
 *     frame state. `uResolution` is physical pixels (post-DPR); tile size
 *     is authored in physical px, so CSS pixels would halve tiles on
 *     Retina. `uRegionCount` is clamped to MAX_REGIONS defensively.
 *
 * Pure module — no React, no paramStore, no MediaPipe runtime imports. The
 * manifest wires state + grid recomputation + region derivation; this file
 * is only the ogl call shape.
 *
 * References: DISCOVERY.md D9 (uniforms), D18 (full-screen quad), D27 (no
 * mirror in shader); `.claude/skills/ogl-webgl-mosaic/SKILL.md`.
 */

import type { OGLRenderingContext } from 'ogl';
import { Mesh, Program, type Texture, Triangle } from 'ogl';
import type { Rect } from './region';
import { FRAGMENT_SHADER, MAX_REGIONS, VERTEX_SHADER } from './shader';

export type MosaicEffectBundle = {
  mesh: Mesh;
  program: Program;
};

export type MosaicUniformParams = {
  tileSize: number;
  blendOpacity: number;
  edgeFeather: number;
};

/** Pre-allocated at module scope — rewrapped (zero-copy) per frame. `MAX_REGIONS`
 *  × 4 floats packs (x1, y1, x2, y2) for every region with zero GC pressure. */
const regionsBuffer = new Float32Array(MAX_REGIONS * 4);

/**
 * Flatten `rects` into a `vec4[MAX_REGIONS]` memory layout, zero-fill the
 * trailing slots, and return a fresh view over the shared ArrayBuffer. The
 * new reference invalidates ogl's uniform cache so `gl.uniform4fv(...)`
 * actually runs; the underlying memory is never reallocated.
 */
export function packRegions(rects: readonly Rect[]): Float32Array {
  const count = Math.min(rects.length, MAX_REGIONS);
  for (let i = 0; i < count; i++) {
    const r = rects[i];
    if (!r) continue;
    const base = i * 4;
    regionsBuffer[base] = r.x1;
    regionsBuffer[base + 1] = r.y1;
    regionsBuffer[base + 2] = r.x2;
    regionsBuffer[base + 3] = r.y2;
  }
  // Zero-fill unused slots so stale data from prior frames doesn't leak.
  regionsBuffer.fill(0, count * 4);
  return new Float32Array(regionsBuffer.buffer, 0, MAX_REGIONS * 4);
}

/**
 * Compile the mosaic Program against the supplied WebGL2 context, bind the
 * video texture on `uVideo`, and build the full-screen `Triangle` Mesh.
 * Caller disposes via `program.remove()` (the renderer owns the texture
 * lifetime — Task 3.5 handles cleanup there).
 */
export function initMosaicEffect(gl: WebGL2RenderingContext, texture: Texture): MosaicEffectBundle {
  // ogl's Geometry / Program / Mesh constructors accept the branded
  // OGLRenderingContext; cast once at the boundary. Task 3.1's Renderer has
  // already attached `renderer` + `canvas` to the raw gl object.
  const oglGl = gl as OGLRenderingContext;
  const geometry = new Triangle(oglGl);

  const program = new Program(oglGl, {
    vertex: VERTEX_SHADER,
    fragment: FRAGMENT_SHADER,
    depthTest: false,
    uniforms: {
      uVideo: { value: texture },
      uResolution: { value: [1280, 720] },
      uTileSize: { value: 16.0 },
      uBlendOpacity: { value: 1.0 },
      uEdgeFeather: { value: 0.0 },
      uRegionCount: { value: 0 },
      uRegions: { value: new Float32Array(MAX_REGIONS * 4) },
    },
  });

  const mesh = new Mesh(oglGl, { geometry, program });
  return { mesh, program };
}

/**
 * Push one frame's state into every mosaic uniform. `physicalW`/`physicalH`
 * must be post-DPR pixel dimensions (read `renderer.gl.canvas.width /
 * .height`, NOT `.clientWidth`). `rects.length > MAX_REGIONS` is defensively
 * clamped.
 */
interface MosaicUniformsShape {
  uResolution: { value: number[] };
  uTileSize: { value: number };
  uBlendOpacity: { value: number };
  uEdgeFeather: { value: number };
  uRegionCount: { value: number };
  uRegions: { value: Float32Array };
  [key: string]: { value: unknown };
}

export function updateMosaicUniforms(
  program: Program,
  rects: readonly Rect[],
  params: MosaicUniformParams,
  physicalW: number,
  physicalH: number,
): void {
  // The Program is constructed by `initMosaicEffect` with all 6 of these
  // uniforms present. Cast once to the concrete shape — safer than
  // `Record<string, T>` which trips `noUncheckedIndexedAccess`.
  const u = program.uniforms as unknown as MosaicUniformsShape;
  u.uResolution.value = [physicalW, physicalH];
  u.uTileSize.value = params.tileSize;
  u.uBlendOpacity.value = params.blendOpacity;
  u.uEdgeFeather.value = params.edgeFeather;
  u.uRegionCount.value = Math.min(rects.length, MAX_REGIONS);
  u.uRegions.value = packRegions(rects);
}
