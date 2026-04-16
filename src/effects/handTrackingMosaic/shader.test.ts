/**
 * Golden-string tests for the mosaic shader sources (Task 3.2).
 *
 * jsdom + vitest-canvas-mock do NOT provide a real WebGL2 compile path, so
 * the real driver round-trip is gated to L4 (`tests/e2e/task-3-2.spec.ts`).
 * Here we guard the most common compile-failure modes at the string level
 * — byte-0 `#version 300 es`, presence of every required uniform, the
 * bounded-loop-with-break pattern, and the region cap.
 */

import { describe, expect, it } from 'vitest';
import { FRAGMENT_SHADER, MAX_REGIONS, VERTEX_SHADER } from './shader';

describe('VERTEX_SHADER', () => {
  it('has `#` at byte 0 (no leading whitespace, BOM, or comment)', () => {
    expect(VERTEX_SHADER.charCodeAt(0)).toBe('#'.charCodeAt(0));
  });

  it('starts with the exact `#version 300 es` directive', () => {
    expect(VERTEX_SHADER.startsWith('#version 300 es')).toBe(true);
  });

  it('uses GLSL ES 3.0 qualifiers (in / out) and no legacy `varying`', () => {
    expect(VERTEX_SHADER).not.toMatch(/\bvarying\b/);
    expect(VERTEX_SHADER).toMatch(/\bin\s+vec2\s+uv\b/);
    expect(VERTEX_SHADER).toMatch(/\bin\s+vec2\s+position\b/);
    expect(VERTEX_SHADER).toMatch(/\bout\s+vec2\s+vUv\b/);
  });

  it('writes gl_Position directly from NDC position (no camera matrix)', () => {
    expect(VERTEX_SHADER).toMatch(/gl_Position\s*=\s*vec4\(position,\s*0\.0,\s*1\.0\)/);
  });
});

describe('FRAGMENT_SHADER', () => {
  it('has `#` at byte 0 (no leading whitespace, BOM, or comment)', () => {
    expect(FRAGMENT_SHADER.charCodeAt(0)).toBe('#'.charCodeAt(0));
  });

  it('starts with the exact `#version 300 es` directive', () => {
    expect(FRAGMENT_SHADER.startsWith('#version 300 es')).toBe(true);
  });

  it('declares explicit `highp` precision for both float and int', () => {
    expect(FRAGMENT_SHADER).toMatch(/precision\s+highp\s+float\s*;/);
    expect(FRAGMENT_SHADER).toMatch(/precision\s+highp\s+int\s*;/);
  });

  it.each([
    'uVideo',
    'uResolution',
    'uTileSize',
    'uBlendOpacity',
    'uEdgeFeather',
    'uRegions',
    'uRegionCount',
  ])('declares uniform `%s`', (name) => {
    // Allow any type/qualifier between `uniform` and the name; array form
    // (`uRegions[MAX_REGIONS]`) is permitted.
    expect(FRAGMENT_SHADER).toMatch(new RegExp(`uniform\\s+\\S+\\s+${name}\\b`));
  });

  it('caps the region loop with `if (i >= uRegionCount) break;`', () => {
    expect(FRAGMENT_SHADER).toMatch(/for\s*\(\s*int\s+i\s*=\s*0\s*;\s*i\s*<\s*MAX_REGIONS/);
    expect(FRAGMENT_SHADER).toMatch(/if\s*\(\s*i\s*>=\s*uRegionCount\s*\)\s*break;/);
  });

  it('guards the edge-feather loop with both uEdgeFeather>0 and regionWeight>0', () => {
    // Single-line `&&` guard — whitespace within the condition is flexible.
    expect(FRAGMENT_SHADER).toMatch(
      /if\s*\(\s*uEdgeFeather\s*>\s*0\.0\s*&&\s*regionWeight\s*>\s*0\.0\s*\)/,
    );
  });

  it('uses GLSL ES 3.0 APIs (texture, explicit fragColor out — no gl_FragColor)', () => {
    expect(FRAGMENT_SHADER).not.toMatch(/\btexture2D\b/);
    expect(FRAGMENT_SHADER).not.toMatch(/\bgl_FragColor\b/);
    expect(FRAGMENT_SHADER).toMatch(/\bout\s+vec4\s+fragColor\b/);
    expect(FRAGMENT_SHADER).toMatch(/\btexture\(\s*uVideo/);
  });

  it('does NOT flip mirror in-shader (D27 — CSS scaleX(-1) is the only mirror)', () => {
    // Any `1.0 - uv.x` / `1.0 - vUv.x` would indicate an in-shader mirror.
    expect(FRAGMENT_SHADER).not.toMatch(/1\.0\s*-\s*u?v?Uv?\.x/);
    expect(FRAGMENT_SHADER).not.toMatch(/1\.0\s*-\s*vUv\.x/);
  });

  it('uniform array size matches MAX_REGIONS via #define', () => {
    expect(FRAGMENT_SHADER).toMatch(/#define\s+MAX_REGIONS\s+96\b/);
    expect(FRAGMENT_SHADER).toMatch(/uniform\s+vec4\s+uRegions\[MAX_REGIONS\]/);
  });
});

describe('MAX_REGIONS', () => {
  it('exports the literal 96', () => {
    expect(MAX_REGIONS).toBe(96);
  });

  it('matches the #define in the fragment shader source', () => {
    const match = FRAGMENT_SHADER.match(/#define\s+MAX_REGIONS\s+(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBe(MAX_REGIONS);
  });
});
