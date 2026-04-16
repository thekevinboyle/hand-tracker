/**
 * ogl Renderer bootstrap + video texture + per-frame upload (Task 3.1).
 *
 * Pure factory module — no React, no classes, no hidden module-scoped state.
 * Stage.tsx owns a renderer + texture pair for the lifetime of a WebGL canvas
 * mount; App.tsx threads `texture.texture` (the raw WebGLTexture handle) into
 * `FrameContext.videoTexture` and calls `uploadVideoFrame()` before each
 * effect.render(). Task 3.2 compiles the fragment shader against `bundle.gl`;
 * Task 3.4 binds a Program + Mesh and the canvas displays the live mosaic.
 * Until then, the WebGL canvas clears to (0, 0, 0, 0) each frame.
 *
 * Mirrors the no-singleton discipline of `src/engine/paramStore.ts` — every
 * exported function either returns new state or mutates its arguments in place.
 * StrictMode double-mount is handled by the callers re-calling the factories
 * after disposal.
 */

import { type OGLRenderingContext, Renderer, Texture } from 'ogl';
import { WebGLUnavailableError } from '../tracking/errors';

/** Pair returned by `createOglRenderer`. `gl` is ogl's branded
 *  `OGLRenderingContext` — a `WebGL2RenderingContext` with `.renderer` +
 *  `.canvas` attached by the Renderer constructor. Consumers that only need
 *  WebGL APIs can use it directly; Texture / Program constructors require
 *  the branded form, which this type provides. Do NOT call
 *  `canvas.getContext` separately — WebGL forbids re-acquiring a context,
 *  and the gl here is what ogl binds when it draws. */
export type OglBundle = {
  renderer: Renderer;
  gl: OGLRenderingContext;
};

/** Physical (post-DPR) backing-store dimensions in pixels. Shaders consuming
 *  `uResolution` (Task 3.2) must receive this tuple, NOT CSS clientWidth —
 *  per the ogl-webgl-mosaic skill + D9 tile-size semantics. */
export type PhysicalSize = readonly [width: number, height: number];

const HAVE_ENOUGH_DATA = 4;

/**
 * Create an ogl `Renderer` against a mounted `<canvas>` element, configured
 * for the hand-tracker mosaic stack: WebGL 2 (integer flag — required for
 * GLSL ES 3.0 shaders), `preserveDrawingBuffer: true` (D28 — record feature
 * cannot be toggled post-construction), and opaque composition. Throws
 * `WebGLUnavailableError` if the browser fails to provide a WebGL2 context —
 * surfaces through the 8-state useCamera machine as `NO_WEBGL`.
 */
export function createOglRenderer(canvas: HTMLCanvasElement): OglBundle {
  let renderer: Renderer;
  try {
    renderer = new Renderer({
      canvas,
      webgl: 2,
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
  } catch (err) {
    throw new WebGLUnavailableError(
      `Failed to create ogl Renderer: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const gl = renderer.gl;
  if (typeof WebGL2RenderingContext !== 'undefined' && !(gl instanceof WebGL2RenderingContext)) {
    throw new WebGLUnavailableError(
      'ogl Renderer returned a non-WebGL2 context — check browser support and that `webgl: 2` was honored',
    );
  }

  // Initial sizing: use the current CSS client box. `setSize` multiplies by
  // devicePixelRatio, updates `canvas.width` / `canvas.height`, and calls
  // `gl.viewport(0, 0, physW, physH)`. Subsequent resizes go through
  // `resizeRenderer` below.
  renderer.setSize(canvas.clientWidth || 1, canvas.clientHeight || 1);

  return { renderer, gl };
}

/**
 * Create the webcam `Texture`. Per ogl-webgl-mosaic skill defaults:
 * `generateMipmaps: false` (video is non-POT so mipmap completeness would
 * fail), `flipY: true` (HTMLVideoElement is top-row-first but WebGL expects
 * bottom-row-first), linear filtering (mipmap filters would be invalid), and
 * `CLAMP_TO_EDGE` on both axes (UV 0..1 strictly bounded; no wrap artifacts).
 *
 * Returns the ogl `Texture` wrapper — not the raw `WebGLTexture`. Consumers
 * that need the raw handle (FrameContext.videoTexture, dev hook) read
 * `texture.texture`.
 */
export function createVideoTexture(gl: OGLRenderingContext): Texture {
  return new Texture(gl, {
    generateMipmaps: false,
    flipY: true,
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR,
    wrapS: gl.CLAMP_TO_EDGE,
    wrapT: gl.CLAMP_TO_EDGE,
  });
}

/**
 * Per-frame upload. Guards on `readyState >= HAVE_ENOUGH_DATA (4)` — uploading
 * a half-decoded video frame produces `GL_INVALID_VALUE` and a zero-size
 * texture. Setting `needsUpdate = true` is mandatory every frame: ogl does
 * NOT auto-poll `HTMLVideoElement`, so omitting this pin freezes the image at
 * the first successful upload.
 *
 * Returns `true` when the texture was marked for upload, `false` when the
 * video isn't ready yet (caller should skip the frame's draw).
 */
export function uploadVideoFrame(texture: Texture, videoEl: HTMLVideoElement): boolean {
  if (videoEl.readyState < HAVE_ENOUGH_DATA) return false;
  // ogl's Texture.image is typed `ImageRepresentation` which includes
  // HTMLVideoElement. Assigning + setting needsUpdate is the documented path.
  texture.image = videoEl;
  texture.needsUpdate = true;
  return true;
}

/**
 * DPR-aware resize. Compares the current backing-store size to the new CSS
 * box; calls `renderer.setSize(clientW, clientH)` only when they drift
 * (prevents redundant gl.viewport calls + state thrash). Returns the new
 * physical `[width, height]` tuple that shader consumers of `uResolution`
 * must receive — NOT the CSS size, which is DPR-wrong on Retina displays.
 */
export function resizeRenderer(renderer: Renderer, canvas: HTMLCanvasElement): PhysicalSize {
  const cssW = canvas.clientWidth || 1;
  const cssH = canvas.clientHeight || 1;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const targetPhysW = Math.max(1, Math.floor(cssW * dpr));
  const targetPhysH = Math.max(1, Math.floor(cssH * dpr));
  const currentCanvas = renderer.gl.canvas as HTMLCanvasElement;
  if (currentCanvas.width !== targetPhysW || currentCanvas.height !== targetPhysH) {
    renderer.setSize(cssW, cssH);
  }
  return [currentCanvas.width, currentCanvas.height] as const;
}
