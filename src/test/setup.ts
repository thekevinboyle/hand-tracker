import '@testing-library/jest-dom/vitest';
import 'vitest-canvas-mock';
import { beforeEach, vi } from 'vitest';

// Node 25+ ships a stub `globalThis.localStorage` that shadows jsdom's real
// `Storage` implementation — `typeof localStorage === 'object'` but none of
// the Storage methods are present. Replace it with a live Map-backed
// implementation that matches the Web Storage contract so unit tests that
// round-trip presets / prefs through localStorage behave like a browser.
// Cleared in beforeEach so tests stay order-independent.
class InMemoryStorage implements Storage {
  private readonly data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) ?? null) : null;
  }
  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}
const memoryLocalStorage = new InMemoryStorage();
Object.defineProperty(globalThis, 'localStorage', {
  value: memoryLocalStorage,
  writable: true,
  configurable: true,
});
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: memoryLocalStorage,
    writable: true,
    configurable: true,
  });
}
beforeEach(() => {
  memoryLocalStorage.clear();
});

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
  class StubTriangle {}
  class StubProgram {
    uniforms: Record<string, { value: unknown }>;
    removed = false;
    constructor(_gl: unknown, opts: { uniforms?: Record<string, { value: unknown }> }) {
      this.uniforms = opts.uniforms ?? {};
    }
    remove(): void {
      this.removed = true;
    }
  }
  class StubMesh {}
  // Augment StubRenderer with a no-op `render()` so effect.render() can
  // invoke it without extra test scaffolding.
  (StubRenderer.prototype as unknown as { render: (opts: unknown) => void }).render = () => {};
  return {
    Renderer: StubRenderer,
    Texture: StubTexture,
    Triangle: StubTriangle,
    Program: StubProgram,
    Mesh: StubMesh,
  };
});
