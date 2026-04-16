/**
 * Unit tests for render.ts (Task 3.4).
 *
 * `packRegions` + `updateMosaicUniforms` are pure over an ogl `Program`
 * stub — the test runs in jsdom with the shared ogl mock from
 * `src/test/setup.ts` (upgraded here with a `Program` stub that records
 * `uniforms` so the assertions can introspect what was written). The real
 * shader compile + draw is exercised in Playwright E2E
 * (`tests/e2e/task-3-2.spec.ts` + Task 3.4's spec).
 */

import { describe, expect, it, vi } from 'vitest';
import type { Rect } from './region';
import { MAX_REGIONS } from './shader';

// Extend the shared ogl stub (src/test/setup.ts) with a Program constructor
// that preserves its `uniforms` argument on the instance, so the tests can
// read what `updateMosaicUniforms` wrote. The Renderer/Texture stubs from
// the shared setup still apply for any code path that touches them.
vi.mock('ogl', async () => {
  const existing = await vi.importActual<Record<string, unknown>>('ogl');
  class StubProgram {
    uniforms: Record<string, { value: unknown }>;
    removed = false;
    constructor(_gl: unknown, opts: { uniforms: Record<string, { value: unknown }> }) {
      this.uniforms = opts.uniforms;
    }
    remove(): void {
      this.removed = true;
    }
  }
  class StubMesh {}
  class StubTriangle {}
  return { ...existing, Program: StubProgram, Mesh: StubMesh, Triangle: StubTriangle };
});

// Import AFTER the mock so the module picks up the stubs.
import { initMosaicEffect, packRegions, updateMosaicUniforms } from './render';

function sampleRect(i: number): Rect {
  const u = i / 1000;
  return { x1: u, y1: u, x2: u + 0.01, y2: u + 0.01 };
}

interface FakeProgramUniforms {
  uVideo: { value: unknown };
  uResolution: { value: number[] };
  uTileSize: { value: number };
  uBlendOpacity: { value: number };
  uEdgeFeather: { value: number };
  uRegionCount: { value: number };
  uRegions: { value: Float32Array };
}

function fakeProgram(): { uniforms: FakeProgramUniforms } {
  return {
    uniforms: {
      uVideo: { value: null },
      uResolution: { value: [0, 0] },
      uTileSize: { value: 0 },
      uBlendOpacity: { value: 0 },
      uEdgeFeather: { value: 0 },
      uRegionCount: { value: 0 },
      uRegions: { value: new Float32Array(MAX_REGIONS * 4) },
    },
  };
}

describe('packRegions', () => {
  it('returns a Float32Array with length MAX_REGIONS * 4', () => {
    const out = packRegions([sampleRect(0), sampleRect(1)]);
    expect(out).toBeInstanceOf(Float32Array);
    expect(out.length).toBe(MAX_REGIONS * 4);
  });

  it('copies rects in (x1, y1, x2, y2) order', () => {
    const rects: Rect[] = [
      { x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.4 },
      { x1: 0.5, y1: 0.6, x2: 0.7, y2: 0.8 },
    ];
    const out = packRegions(rects);
    expect(out[0]).toBeCloseTo(0.1);
    expect(out[1]).toBeCloseTo(0.2);
    expect(out[2]).toBeCloseTo(0.3);
    expect(out[3]).toBeCloseTo(0.4);
    expect(out[4]).toBeCloseTo(0.5);
    expect(out[5]).toBeCloseTo(0.6);
    expect(out[6]).toBeCloseTo(0.7);
    expect(out[7]).toBeCloseTo(0.8);
  });

  it('zero-fills trailing slots beyond the rect count', () => {
    // Seed the buffer with non-zero data, then pack a small rect list.
    packRegions(Array.from({ length: MAX_REGIONS }, (_, i) => sampleRect(i)));
    const out = packRegions([sampleRect(0)]);
    // First rect stored at slots 0..3; slots 4..end must be zero.
    for (let i = 4; i < MAX_REGIONS * 4; i++) {
      expect(out[i]).toBe(0);
    }
  });

  it('returns a fresh Float32Array view over the same ArrayBuffer each call (ogl cache invalidation)', () => {
    const a = packRegions([sampleRect(0)]);
    const b = packRegions([sampleRect(1)]);
    expect(a.buffer).toBe(b.buffer); // Same underlying memory — zero alloc.
    expect(a).not.toBe(b); // Different TypedArray reference — forces ogl upload.
  });

  it('caps at MAX_REGIONS when given more rects', () => {
    const many = Array.from({ length: MAX_REGIONS + 20 }, (_, i) => sampleRect(i));
    const out = packRegions(many);
    // Last MAX_REGIONS entry (index MAX_REGIONS - 1) should be sampleRect(MAX_REGIONS - 1);
    // the index MAX_REGIONS entry should NOT be sampleRect(MAX_REGIONS) — it should be 0
    // (because we zero-fill from count*4 onward, and count = MAX_REGIONS).
    expect(out[(MAX_REGIONS - 1) * 4]).toBeCloseTo((MAX_REGIONS - 1) / 1000);
    // Slots beyond count * 4 stay zero.
    // count = MAX_REGIONS, so zero-fill starts at MAX_REGIONS * 4 — which is the end of the view.
    // No tail to check past MAX_REGIONS * 4; the cap is enforced by the view length.
    expect(out.length).toBe(MAX_REGIONS * 4);
  });
});

describe('updateMosaicUniforms', () => {
  it('writes uResolution in physical pixels (not CSS)', () => {
    const program = fakeProgram();
    updateMosaicUniforms(
      program as unknown as import('ogl').Program,
      [],
      { tileSize: 16, blendOpacity: 1, edgeFeather: 0 },
      2560,
      1440,
    );
    expect(program.uniforms.uResolution.value).toEqual([2560, 1440]);
  });

  it('writes tileSize, blendOpacity, edgeFeather', () => {
    const program = fakeProgram();
    updateMosaicUniforms(
      program as unknown as import('ogl').Program,
      [],
      { tileSize: 24, blendOpacity: 0.5, edgeFeather: 4 },
      640,
      480,
    );
    expect(program.uniforms.uTileSize.value).toBe(24);
    expect(program.uniforms.uBlendOpacity.value).toBe(0.5);
    expect(program.uniforms.uEdgeFeather.value).toBe(4);
  });

  it('writes uRegionCount = Math.min(rects.length, MAX_REGIONS)', () => {
    const program = fakeProgram();
    updateMosaicUniforms(
      program as unknown as import('ogl').Program,
      [sampleRect(0), sampleRect(1), sampleRect(2)],
      { tileSize: 16, blendOpacity: 1, edgeFeather: 0 },
      640,
      480,
    );
    expect(program.uniforms.uRegionCount.value).toBe(3);

    const many = Array.from({ length: MAX_REGIONS + 5 }, (_, i) => sampleRect(i));
    updateMosaicUniforms(
      program as unknown as import('ogl').Program,
      many,
      { tileSize: 16, blendOpacity: 1, edgeFeather: 0 },
      640,
      480,
    );
    expect(program.uniforms.uRegionCount.value).toBe(MAX_REGIONS);
  });

  it('swaps uRegions.value to a fresh Float32Array view each call', () => {
    const program = fakeProgram();
    const original = program.uniforms.uRegions.value;
    updateMosaicUniforms(
      program as unknown as import('ogl').Program,
      [sampleRect(0)],
      { tileSize: 16, blendOpacity: 1, edgeFeather: 0 },
      640,
      480,
    );
    const afterFirst = program.uniforms.uRegions.value;
    expect(afterFirst).not.toBe(original);
    expect(afterFirst).toBeInstanceOf(Float32Array);

    updateMosaicUniforms(
      program as unknown as import('ogl').Program,
      [sampleRect(1)],
      { tileSize: 16, blendOpacity: 1, edgeFeather: 0 },
      640,
      480,
    );
    const afterSecond = program.uniforms.uRegions.value;
    expect(afterSecond).not.toBe(afterFirst); // Fresh view every call.
  });
});

describe('initMosaicEffect', () => {
  it('constructs Triangle geometry + Program + Mesh and exposes them', () => {
    const fakeGl = {} as unknown as WebGL2RenderingContext;
    const fakeTexture = { texture: {} } as unknown as import('ogl').Texture;
    const bundle = initMosaicEffect(fakeGl, fakeTexture);
    expect(bundle.mesh).toBeDefined();
    expect(bundle.program).toBeDefined();
    // The stub exposes `uniforms` as the constructor-supplied shape. Cast to
    // the concrete shape so `noUncheckedIndexedAccess` doesn't widen access.
    interface Uniforms {
      uVideo: { value: unknown };
      uRegionCount: { value: unknown };
      uRegions: { value: unknown };
    }
    const u = (bundle.program as unknown as { uniforms: Uniforms }).uniforms;
    expect(u.uVideo.value).toBe(fakeTexture);
    expect(u.uRegionCount.value).toBe(0);
    expect(u.uRegions.value).toBeInstanceOf(Float32Array);
    expect((u.uRegions.value as Float32Array).length).toBe(MAX_REGIONS * 4);
  });
});
