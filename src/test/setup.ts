import '@testing-library/jest-dom/vitest';
import 'vitest-canvas-mock';
import { vi } from 'vitest';

// Minimal `ogl` stub so components that mount a Stage (which creates a
// Renderer + Texture in a useEffect) don't crash in jsdom — the real WebGL
// stack is exercised in Playwright E2E. Tests that need to introspect ogl
// constructor calls (`src/engine/renderer.test.ts`) supply their own
// per-file `vi.mock('ogl', ...)` which Vitest prioritises over this shared
// one; for everyone else the shapes below are enough to satisfy `new
// Renderer({...})`, `new Texture(gl, {...})`, `texture.texture`,
// `renderer.setSize(...)`, and the teardown path's `gl.deleteTexture` +
// `gl.getExtension('WEBGL_lose_context')` calls.
vi.mock('ogl', () => {
  class StubRenderer {
    gl: {
      canvas: HTMLCanvasElement;
      LINEAR: number;
      CLAMP_TO_EDGE: number;
      deleteTexture: (t: unknown) => void;
      getExtension: (name: string) => null;
    };
    constructor(opts: { canvas: HTMLCanvasElement }) {
      this.gl = {
        canvas: opts.canvas,
        LINEAR: 9729,
        CLAMP_TO_EDGE: 33071,
        deleteTexture: () => {},
        getExtension: () => null,
      };
    }
    setSize(w: number, h: number): void {
      const c = this.gl.canvas;
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      c.width = Math.max(1, Math.floor(w * dpr));
      c.height = Math.max(1, Math.floor(h * dpr));
    }
  }
  class StubTexture {
    image: unknown = null;
    needsUpdate = false;
    texture: object = {};
    constructor(_gl: unknown, opts: Record<string, unknown>) {
      Object.assign(this, opts);
    }
  }
  return { Renderer: StubRenderer, Texture: StubTexture };
});
