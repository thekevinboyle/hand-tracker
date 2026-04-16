/**
 * Mosaic effect shaders — GLSL ES 3.0 for WebGL 2 (Task 3.2).
 *
 * Two raw string constants plus a region cap integer. No runtime. Task 3.4
 * imports these verbatim, hands them to ogl's `Program`, and links against
 * the `Renderer` from Task 3.1. Task 3.3 imports `MAX_REGIONS` as the cap in
 * `computeActiveRegions()`.
 *
 * Authoritative references:
 *   - DISCOVERY.md D5 (regions in UV), D9 (tile / blend / feather defaults +
 *     ranges), D18 (full-screen Triangle; no camera matrices), D27 (no mirror
 *     in shader — CSS scaleX(-1) on the display canvas is the only flip)
 *   - .claude/skills/ogl-webgl-mosaic/SKILL.md (full walkthrough + anti-patterns)
 *
 * CRITICAL: `#version 300 es` MUST be byte 0 of each string. A leading
 * newline, BOM, or comment makes the driver reject the shader with
 * `INVALID_OPERATION: no GLSL ES version directive`. The template literals
 * below open with a backtick directly followed by the directive.
 */

/** Hard cap on the number of `vec4(x1,y1,x2,y2)` region AABBs uploaded per
 *  frame. Mirrored by the `#define MAX_REGIONS 96` in the fragment shader
 *  — if you change one, change both. See
 *  `src/effects/handTrackingMosaic/region.ts` (Task 3.3) for the cell-
 *  center-in-polygon derivation that produces rects under this cap. */
export const MAX_REGIONS = 96 as const;

export const VERTEX_SHADER = `#version 300 es
in vec2 uv;
in vec2 position;

out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

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
