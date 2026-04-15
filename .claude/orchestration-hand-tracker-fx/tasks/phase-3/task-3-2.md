# Task 3.2: Author Mosaic Fragment Shader (GLSL ES 3.0)

**Phase**: 3 — Mosaic Shader
**Branch**: `task/3-2-mosaic-fragment-shader`
**Commit prefix**: `Task 3.2:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Export the vertex and fragment shader source strings for the Hand Tracker FX mosaic effect — a GLSL ES 3.0 fragment shader that samples a video texture, quantizes it to tiles inside up to 96 UV-space region AABBs, and mixes between the original and the mosaic sample via `uBlendOpacity` and `uEdgeFeather`.

**Deliverable**: `src/effects/handTrackingMosaic/shader.ts` (new) exporting `VERTEX_SHADER` and `FRAGMENT_SHADER` string constants, plus `MAX_REGIONS` numeric constant. `src/effects/handTrackingMosaic/shader.test.ts` (new) asserts `#version 300 es` at byte 0, verifies the string contains the expected uniforms, and — when `WebGL2RenderingContext` is available in the test env — compiles both shaders.

**Success Definition**: `pnpm vitest run src/effects/handTrackingMosaic/shader.test.ts` exits 0 with golden-string assertions and (when a real GL2 context can be acquired) compile-time assertions; `pnpm tsc --noEmit` exits 0; Task 3.4 (downstream) can `import { VERTEX_SHADER, FRAGMENT_SHADER, MAX_REGIONS } from './shader'` and link a Program without error.

---

## User Persona

**Target User**: Creative technologist (end user, indirect) — they do not see this file but they see its output as the pixelated mosaic inside their hand region.

**Use Case**: The shader is the visual core of the MVP effect. Its correctness is the single largest determinant of whether the Phase 3 regression visual-fidelity gate (Task 3.R) passes.

**User Journey**: Fragment shader runs once per pixel per frame. For fragments inside any active region rect, it returns the tile-quantized sample; otherwise it returns the original video sample.

**Pain Points Addressed**: Without this shader, the WebGL canvas has no program and the video never appears through the GL layer — the downstream user sees a clear/black canvas.

---

## Why

- Satisfies D5 — regions are in UV space; shader treats them as `vec4(x1, y1, x2, y2)` AABBs (packed) with hard cap 96
- Satisfies D9 — `uTileSize` default 16 (range 4–64), `uBlendOpacity` default 1.0 (range 0–1), `uEdgeFeather` default 0 (range 0–8 px)
- Satisfies D18 — full-screen single-Triangle quad vertex shader; no camera / model / view matrices
- Satisfies D27 — NO mirror flip inside the shader; mirroring is CSS-only on the display canvas
- Unlocks Task 3.4 (Program link), Task 3.R (visual fidelity gate)

---

## What

- Vertex shader: passes `uv` attribute to fragment; writes `gl_Position` directly from `position` attribute in NDC
- Fragment shader:
  - Samples `uVideo` sampler2D for the original pixel
  - Computes the mosaic sample as `texture(uVideo, floor(uv / tileUV) * tileUV + tileUV * 0.5)`
  - Loops `MAX_REGIONS` (96) with `if (i >= uRegionCount) break;` to compute `regionWeight = max over rects of inRegion(uv, r)`
  - When `uEdgeFeather > 0.0 && regionWeight > 0.0`, runs a second guarded loop to ramp the weight near the region edges
  - Final `fragColor = mix(original, mosaicColor, uBlendOpacity * regionWeight)`
- `MAX_REGIONS` exported as a TypeScript constant (used by Task 3.3 + 3.4 uniform buffer sizing)
- Test suite:
  - Asserts `#version 300 es` is literal bytes 0..13 of both shader strings (no leading whitespace, no BOM, no comment before it)
  - Asserts presence of each named uniform (`uVideo`, `uResolution`, `uTileSize`, `uBlendOpacity`, `uEdgeFeather`, `uRegions`, `uRegionCount`)
  - Conditionally: acquires a WebGL2 context (via `canvas.getContext('webgl2')` if available in happy-dom — or skips with `it.skipIf`), compiles both shaders, asserts `gl.getShaderParameter(..., gl.COMPILE_STATUS) === true`

### NOT Building (scope boundary)

- `Program` / `Mesh` / uniform upload (Task 3.4)
- Region derivation (Task 3.3)
- Renderer bootstrap (Task 3.1)
- Context-loss handlers (Task 3.5)
- Any per-frame JavaScript — this file is TWO string constants

### Success Criteria

- [ ] `src/effects/handTrackingMosaic/shader.ts` exports `VERTEX_SHADER`, `FRAGMENT_SHADER`, `MAX_REGIONS`
- [ ] `pnpm biome check src/effects/handTrackingMosaic/shader.ts` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `pnpm vitest run src/effects/handTrackingMosaic/shader.test.ts` exits 0
- [ ] `FRAGMENT_SHADER.charCodeAt(0) === '#'.charCodeAt(0)` (no leading whitespace — byte 0 check)
- [ ] `FRAGMENT_SHADER.startsWith('#version 300 es')` and `VERTEX_SHADER.startsWith('#version 300 es')`
- [ ] `MAX_REGIONS === 96`
- [ ] `pnpm build` exits 0 (tree-shaking picks up the constants; string literals stay inline)

---

## All Needed Context

```yaml
files:
  - path: src/engine/paramStore.ts
    why: MIRROR module shape — named exports only, no default export, JSDoc
    gotcha: This file has no runtime side effects; shader.ts must also be pure module-level constants

  - path: src/engine/renderer.ts
    why: Consumer of the shaders in Task 3.4 — understand how gl will be passed to Program()
    gotcha: renderer.ts exports createOglRenderer; this file does not import it — shader.ts is string-only

  - path: src/effects/handTrackingMosaic/manifest.ts
    why: The no-op render() that Task 3.4 will replace. Understand the EffectInstance contract
    gotcha: manifest.ts will import from shader.ts in Task 3.4 — keep exports stable

urls:
  - url: https://registry.khronos.org/OpenGL-Refpages/es3.0/html/
    why: GLSL ES 3.0 reference (functions, qualifiers, built-in types)
    critical: "#version 300 es requires `in`/`out` instead of `varying`, `texture()` instead of `texture2D()`, explicit `fragColor` out variable"

  - url: https://www.khronos.org/opengl/wiki/GLSL_:_common_mistakes
    why: Common ES 3.0 pitfalls
    critical: "Loop bounds must be compile-time constants in some WebGL 2 drivers; use `for (int i = 0; i < MAX_REGIONS; i++) { if (i >= uRegionCount) break; ... }` pattern"

  - url: https://github.com/oframe/ogl/blob/master/src/core/Program.js
    why: How ogl compiles shader strings (Task 3.4 caller)
    critical: "ogl throws on compile failure with the exact driver error message — the byte-0 #version check catches the most common failure mode"

skills:
  - prp-task-ralph-loop
  - hand-tracker-fx-architecture
  - ogl-webgl-mosaic
  - vitest-unit-testing-patterns

discovery:
  - D5: Hand polygon → regions in UV space
  - D9: Mosaic defaults/ranges — tileSize 16 (4..64), blendOpacity 1 (0..1), edgeFeather 0 (0..8)
  - D18: Full-screen single-Triangle quad; no camera
  - D27: No mirror in the shader; CSS-only
```

### Current Codebase Tree (relevant subset)

```
src/
  effects/
    handTrackingMosaic/
      manifest.ts
      grid.ts
      gridRenderer.ts
      blobRenderer.ts
  engine/
    renderer.ts           # created by Task 3.1
    paramStore.ts         # MIRROR target
```

### Desired Codebase Tree

```
src/
  effects/
    handTrackingMosaic/
      shader.ts           # NEW — VERTEX_SHADER, FRAGMENT_SHADER, MAX_REGIONS
      shader.test.ts      # NEW — golden-string + optional compile check
```

### Known Gotchas

```typescript
// CRITICAL: #version 300 es MUST be at byte 0 of the shader string.
// A template literal starting with `\n#version 300 es` puts a newline first
// and the driver reports INVALID_OPERATION: "no GLSL ES version directive".
// Use a backtick-opened template literal with NO newline before the directive:
//   export const FRAGMENT_SHADER = `#version 300 es
//   precision highp float;
//   ...`;

// CRITICAL: Uniform array declaration must be `uniform vec4 uRegions[MAX_REGIONS];`
// with MAX_REGIONS expanded to a literal integer (96). GLSL ES 3.0 does not
// allow `const int` qualifier on array sizes in some drivers. Use `#define`.

// CRITICAL: Do NOT use `varying` — GLSL ES 3.0 uses `in`/`out`.
// Do NOT use `texture2D()` — use `texture()`.
// Fragment shader needs an explicit `out vec4 fragColor;` — there is no `gl_FragColor`
// in ES 3.0.

// CRITICAL: `precision highp float;` and `precision highp int;` must both appear
// before any uniform declaration. Some mobile drivers default to mediump int
// and the MAX_REGIONS loop index then wraps silently. Desktop is OK; be explicit.

// CRITICAL: The second (feather) loop MUST be guarded by `regionWeight > 0.0`.
// Without the guard, 90% of off-hand pixels pay the full 96-iteration cost.

// CRITICAL: tileUV uses physical pixels (post-DPR). Task 3.4 passes
// uResolution = [gl.canvas.width, gl.canvas.height]. Do NOT author the shader
// as if uResolution were CSS pixels — tile size would double on Retina.

// CRITICAL: This file has NO runtime logic. Do not add any JavaScript beyond
// string literals and the MAX_REGIONS constant. Biome will flag unused imports.

// CRITICAL: TypeScript strict mode. `as const` on the string literals is not
// required but is allowed. Do NOT export a default.
```

---

## Implementation Blueprint

### Data Models

```typescript
// In src/effects/handTrackingMosaic/shader.ts — no types, just constants.
export const MAX_REGIONS: 96;
export const VERTEX_SHADER: string;
export const FRAGMENT_SHADER: string;
```

### Full Shader Source — copy-paste ready

Paste these verbatim into `src/effects/handTrackingMosaic/shader.ts`.

```typescript
// src/effects/handTrackingMosaic/shader.ts

/**
 * Mosaic effect shaders — GLSL ES 3.0 for WebGL 2.
 *
 * Authoritative references:
 * - DISCOVERY.md D5 (regions), D9 (tile/blend/feather), D18 (full-screen quad), D27 (no mirror)
 * - .claude/skills/ogl-webgl-mosaic/SKILL.md
 *
 * CRITICAL: #version 300 es MUST be at byte 0 of each string (no leading whitespace).
 */

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
```

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE src/effects/handTrackingMosaic/shader.ts
  - IMPLEMENT: VERTEX_SHADER, FRAGMENT_SHADER, MAX_REGIONS exactly as in "Full Shader Source"
  - MIRROR: src/engine/paramStore.ts (module shape)
  - NAMING: SCREAMING_SNAKE for constants; file name camelCase.ts (repo convention)
  - GOTCHA: Template literal MUST open with backtick directly followed by `#version 300 es` — no leading newline
  - GOTCHA: `#define MAX_REGIONS 96` inside the fragment shader; the TypeScript MAX_REGIONS export must equal 96
  - VALIDATE: pnpm biome check src/effects/handTrackingMosaic/shader.ts && pnpm tsc --noEmit

Task 2: CREATE src/effects/handTrackingMosaic/shader.test.ts
  - IMPLEMENT: Vitest tests:
      * it('VERTEX_SHADER starts with `#version 300 es` at byte 0')
        expect(VERTEX_SHADER.charCodeAt(0)).toBe('#'.charCodeAt(0))
        expect(VERTEX_SHADER.startsWith('#version 300 es')).toBe(true)
      * it('FRAGMENT_SHADER starts with `#version 300 es` at byte 0')
        (same as above for FRAGMENT_SHADER)
      * it('FRAGMENT_SHADER declares all required uniforms')
        for each of ['uVideo', 'uResolution', 'uTileSize', 'uBlendOpacity',
                     'uEdgeFeather', 'uRegions', 'uRegionCount']:
          expect(FRAGMENT_SHADER).toMatch(new RegExp(`uniform\\s+\\S+\\s+${name}`))
      * it('FRAGMENT_SHADER caps region loop with `if (i >= uRegionCount) break;`')
      * it('MAX_REGIONS === 96')
      * it.skipIf(!canAcquireWebGL2())('both shaders compile in a real WebGL2 context', () => {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
          if (!gl) return;
          for (const [type, src] of [
            [gl.VERTEX_SHADER, VERTEX_SHADER],
            [gl.FRAGMENT_SHADER, FRAGMENT_SHADER],
          ] as const) {
            const s = gl.createShader(type)!;
            gl.shaderSource(s, src);
            gl.compileShader(s);
            const ok = gl.getShaderParameter(s, gl.COMPILE_STATUS);
            if (!ok) throw new Error(gl.getShaderInfoLog(s) ?? 'compile failed');
            expect(ok).toBe(true);
          }
        })
  - MIRROR: src/effects/handTrackingMosaic/grid.test.ts (Vitest describe/it shape)
  - GOTCHA: happy-dom and jsdom do not support WebGL — the compile test must use `it.skipIf`
  - GOTCHA: If running under vitest-canvas-mock, real compile is still unavailable; golden-string checks are the load-bearing L2 gate; L4 exercises the real compile
  - VALIDATE: pnpm vitest run src/effects/handTrackingMosaic/shader.test.ts

Task 3: CREATE tests/e2e/task-3-2.spec.ts
  - IMPLEMENT: Playwright test describe('Task 3.2: mosaic fragment shader', ...):
      * Launch with --use-fake-device-for-media-stream
      * Grant camera
      * Evaluate in page context: a helper that creates a canvas, gets webgl2, compiles both shader strings from the loaded module (via a dev hook or a dynamically imported script), and asserts COMPILE_STATUS === true for each
      * Alternative (simpler): wait for Task 3.4 integration — but Task 3.4 depends on 3.2; for 3.2 alone, use the dev hook `window.__handTracker.testCompileShaders()` which returns true/false
  - NAMING: `Task 3.2:` prefix on the describe block (grep depends on this)
  - GOTCHA: If adding a dev hook, guard with `import.meta.env.DEV || MODE === 'test'`
  - VALIDATE: pnpm test:e2e --grep "Task 3.2:"
```

### Integration Points

```yaml
CONSUMERS:
  - Task 3.4 imports: `import { VERTEX_SHADER, FRAGMENT_SHADER, MAX_REGIONS } from './shader'`
  - Task 3.3 imports: `import { MAX_REGIONS } from './shader'` (used as the cap in computeActiveRegions)
  - No other file imports this module

DEV_HOOK:
  - Optional: src/engine/devHooks.ts adds `testCompileShaders()` that returns boolean
  - Used by Task 3.2's L4 spec to verify the real driver accepts the shader strings
```

---

## Validation Loop

### Level 1 — Syntax and Style

```bash
pnpm biome check src/effects/handTrackingMosaic/shader.ts src/effects/handTrackingMosaic/shader.test.ts
pnpm tsc --noEmit
```

### Level 2 — Unit Tests

```bash
pnpm vitest run src/effects/handTrackingMosaic/shader.test.ts
pnpm vitest run
```

### Level 3 — Integration

```bash
pnpm build
```

### Level 4 — E2E

```bash
pnpm test:e2e --grep "Task 3.2:"
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

- [ ] `FRAGMENT_SHADER.charCodeAt(0) === 35 /* '#' */`
- [ ] `VERTEX_SHADER.charCodeAt(0) === 35`
- [ ] `MAX_REGIONS === 96`
- [ ] All seven uniforms present: `uVideo`, `uResolution`, `uTileSize`, `uBlendOpacity`, `uEdgeFeather`, `uRegions`, `uRegionCount`
- [ ] Region loop uses `if (i >= uRegionCount) break;` not unbounded iteration
- [ ] Edge-feather second loop is guarded by `uEdgeFeather > 0.0 && regionWeight > 0.0`
- [ ] L4 spec confirms both shaders compile in a real Chromium WebGL2 context

### Code Quality

- [ ] No `any` types
- [ ] No runtime logic — file is string constants only
- [ ] No default export
- [ ] `as const` on `MAX_REGIONS` permitted but not required

---

## Anti-Patterns

- Do not put a newline, BOM, or comment before `#version 300 es` — byte 0 is sacred
- Do not use `varying` — GLSL ES 3.0 requires `in` / `out`
- Do not use `texture2D()` — ES 3.0 uses `texture()`
- Do not use `gl_FragColor` — declare an explicit `out vec4 fragColor`
- Do not author uniform array size as a GLSL `const int` — use `#define MAX_REGIONS 96`
- Do not remove the `if (i >= uRegionCount) break;` guard — some drivers require compile-time loop bounds
- Do not remove the `uEdgeFeather > 0.0 && regionWeight > 0.0` guard — 90% perf regression on off-hand pixels
- Do not compute mirror inside the shader — mirroring is CSS per D27
- Do not use CSS pixels for `uResolution` — physical pixels post-DPR
- Do not add a default export
- Do not add runtime assertions inside the module (it runs at import time — zero-overhead constants only)

---

## No Prior Knowledge Test

- [ ] Every file path in `All Needed Context` exists (paramStore.ts, manifest.ts, renderer.ts from Task 3.1)
- [ ] Every URL in `urls:` is reachable
- [ ] Every D-number cited exists in DISCOVERY.md (D5, D9, D18, D27)
- [ ] Implementation tasks are topologically sorted — impl → test → e2e
- [ ] Validation Loop commands are copy-paste runnable with no placeholders
- [ ] The MIRROR file (`paramStore.ts`) exists from Task 2.2
- [ ] The task is atomic — does not require regions (3.3), Program wire-up (3.4), or context loss (3.5)

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/ogl-webgl-mosaic/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
