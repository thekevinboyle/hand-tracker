/**
 * Unit tests for `src/engine/renderer.ts` — Task 3.1.
 *
 * ogl is mocked so the suite runs in jsdom without WebGL. The real WebGL
 * stack is exercised in the Playwright L4 (`tests/e2e/task-3-1.spec.ts`).
 * Assertions focus on the contract this module owns: flag shape passed to
 * `new Renderer(...)`, texture option defaults, upload guard semantics,
 * resize returning physical (post-DPR) pixels.
 */

import type { Renderer as RendererType, Texture as TextureType } from 'ogl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture constructor-arg snapshots for assertions. Each Mock instance writes
// through to `rendererCalls` / `textureCalls` on construction so the tests can
// introspect what ogl received without touching the real library.
const rendererCalls: Array<Record<string, unknown>> = [];
const textureCalls: Array<{ gl: unknown; opts: Record<string, unknown> }> = [];

vi.mock('ogl', () => {
  class Renderer {
    gl: WebGL2RenderingContext;
    constructor(opts: Record<string, unknown>) {
      rendererCalls.push(opts);
      const canvas = opts.canvas as HTMLCanvasElement;
      // Minimal WebGL2-shaped stub that satisfies `gl instanceof
      // WebGL2RenderingContext` when the real constructor is in globalThis
      // (jsdom provides it). Fallback to a POJO when not — tests that need the
      // instanceof check opt in by tweaking the mock.
      this.gl = {
        canvas,
        LINEAR: 9729,
        CLAMP_TO_EDGE: 33071,
      } as unknown as WebGL2RenderingContext;
    }
    setSize(w: number, h: number): void {
      const c = this.gl.canvas as HTMLCanvasElement;
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      c.width = Math.max(1, Math.floor(w * dpr));
      c.height = Math.max(1, Math.floor(h * dpr));
    }
  }
  class Texture {
    image: unknown = null;
    needsUpdate = false;
    texture: object = {};
    constructor(gl: unknown, opts: Record<string, unknown>) {
      textureCalls.push({ gl, opts });
      Object.assign(this, opts);
    }
  }
  return { Renderer, Texture };
});

// Import AFTER the mock so the module resolution picks up the stub.
import {
  createOglRenderer,
  createVideoTexture,
  resizeRenderer,
  uploadVideoFrame,
} from './renderer';

function fakeCanvas(cssW = 640, cssH = 480): HTMLCanvasElement {
  const c = document.createElement('canvas');
  Object.defineProperty(c, 'clientWidth', { value: cssW, configurable: true });
  Object.defineProperty(c, 'clientHeight', { value: cssH, configurable: true });
  return c;
}

function fakeVideo(readyState: number): HTMLVideoElement {
  const v = document.createElement('video');
  Object.defineProperty(v, 'readyState', { value: readyState, configurable: true });
  return v;
}

beforeEach(() => {
  rendererCalls.length = 0;
  textureCalls.length = 0;
});

describe('createOglRenderer', () => {
  it('constructs the ogl Renderer with webgl: 2 (integer) and preserveDrawingBuffer: true', () => {
    createOglRenderer(fakeCanvas());
    expect(rendererCalls).toHaveLength(1);
    const opts = rendererCalls[0] as Record<string, unknown>;
    expect(opts.webgl).toBe(2);
    expect(opts.preserveDrawingBuffer).toBe(true);
    expect(opts.alpha).toBe(false);
    expect(opts.antialias).toBe(false);
    expect(opts.premultipliedAlpha).toBe(false);
  });

  it('returns { renderer, gl } with gl.canvas === passed canvas', () => {
    const canvas = fakeCanvas();
    const bundle = createOglRenderer(canvas);
    expect(bundle.gl.canvas).toBe(canvas);
  });

  it('initial setSize uses the canvas CSS client box', () => {
    const canvas = fakeCanvas(800, 600);
    const dpr = window.devicePixelRatio || 1;
    createOglRenderer(canvas);
    expect(canvas.width).toBe(Math.floor(800 * dpr));
    expect(canvas.height).toBe(Math.floor(600 * dpr));
  });
});

describe('createVideoTexture', () => {
  it('passes flipY: true, generateMipmaps: false, linear + CLAMP_TO_EDGE', () => {
    const { gl } = createOglRenderer(fakeCanvas());
    createVideoTexture(gl);
    expect(textureCalls).toHaveLength(1);
    const { opts } = textureCalls[0] as { opts: Record<string, unknown> };
    expect(opts.flipY).toBe(true);
    expect(opts.generateMipmaps).toBe(false);
    expect(opts.minFilter).toBe(gl.LINEAR);
    expect(opts.magFilter).toBe(gl.LINEAR);
    expect(opts.wrapS).toBe(gl.CLAMP_TO_EDGE);
    expect(opts.wrapT).toBe(gl.CLAMP_TO_EDGE);
  });
});

describe('uploadVideoFrame', () => {
  it('returns false when readyState < HAVE_ENOUGH_DATA (4)', () => {
    const { gl } = createOglRenderer(fakeCanvas());
    const tex = createVideoTexture(gl) as unknown as TextureType & {
      image: unknown;
      needsUpdate: boolean;
    };
    const video = fakeVideo(2);
    expect(uploadVideoFrame(tex, video)).toBe(false);
    expect(tex.needsUpdate).toBe(false);
    expect(tex.image).toBeNull();
  });

  it('assigns image + needsUpdate and returns true at readyState === 4', () => {
    const { gl } = createOglRenderer(fakeCanvas());
    const tex = createVideoTexture(gl) as unknown as TextureType & {
      image: unknown;
      needsUpdate: boolean;
    };
    const video = fakeVideo(4);
    expect(uploadVideoFrame(tex, video)).toBe(true);
    expect(tex.image).toBe(video);
    expect(tex.needsUpdate).toBe(true);
  });
});

describe('resizeRenderer', () => {
  it('returns physical (post-DPR) pixel dimensions, not CSS', () => {
    const canvas = fakeCanvas(800, 600);
    const bundle = createOglRenderer(canvas);
    const size = resizeRenderer(bundle.renderer as unknown as RendererType, canvas);
    const dpr = window.devicePixelRatio || 1;
    expect(size[0]).toBe(Math.floor(800 * dpr));
    expect(size[1]).toBe(Math.floor(600 * dpr));
  });

  it('calls setSize when the CSS box changes', () => {
    const canvas = fakeCanvas(640, 480);
    const bundle = createOglRenderer(canvas);
    const r = bundle.renderer as unknown as RendererType;
    const spy = vi.spyOn(r, 'setSize');
    Object.defineProperty(canvas, 'clientWidth', { value: 1280, configurable: true });
    Object.defineProperty(canvas, 'clientHeight', { value: 720, configurable: true });
    resizeRenderer(r, canvas);
    expect(spy).toHaveBeenCalledWith(1280, 720);
  });

  it('skips setSize when the box did not change', () => {
    const canvas = fakeCanvas(640, 480);
    const bundle = createOglRenderer(canvas);
    const r = bundle.renderer as unknown as RendererType;
    const spy = vi.spyOn(r, 'setSize');
    resizeRenderer(r, canvas);
    expect(spy).not.toHaveBeenCalled();
  });
});
