# Task 3.1: Bootstrap ogl Renderer and Upload Video Texture

**Phase**: 3 — Mosaic Shader
**Branch**: `task/3-1-ogl-renderer-bootstrap`
**Commit prefix**: `Task 3.1:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Stand up the ogl 1.0.11 `Renderer` against the WebGL canvas that was mounted in Task 1.6, create the shared video `Texture`, and expose `createOglRenderer(canvas)` and `createVideoTexture(gl)` factories — so Task 3.2 can compile a `Program` against `gl` and Task 3.4 can upload `videoEl` into the texture every frame.

**Deliverable**: `src/engine/renderer.ts` (new) + `src/engine/renderer.test.ts` (new). Exported API: `createOglRenderer(canvas)`, `createVideoTexture(gl)`, `uploadVideoFrame(texture, videoEl)`, `resizeRenderer(renderer, canvas)`.

**Success Definition**: `pnpm vitest run src/engine/renderer.test.ts` exits 0; `pnpm tsc --noEmit` exits 0; after manual wire-up in `main.tsx`, opening `pnpm preview` in Chrome shows the live webcam frame stretched across the full WebGL canvas (no shader yet — the default ogl clear is visible until Task 3.4 binds the mesh).

---

## User Persona

**Target User**: Creative technologist who has just granted camera access on Chrome 120+.

**Use Case**: User opens the app, permission transitions PROMPT → GRANTED, the video element becomes a live stream. They expect to see their webcam feed rendered by the WebGL layer (not just the `<video>` element, which is hidden offscreen per D18).

**User Journey**:
1. User lands on app → PROMPT card
2. User clicks "Enable Camera" → GRANTED
3. Phase 1 `Stage.tsx` mounts the hidden `<video>` + WebGL `<canvas>` + 2D `<canvas>`
4. Task 3.1 renderer boots, creates the texture, and the per-frame loop (already present from Task 1.5) begins uploading video frames
5. The WebGL canvas clears to transparent black and stays ready to receive the mosaic program (Task 3.4)

**Pain Points Addressed**: Without this task, the `FrameContext.videoTexture` field is `null` and Task 3.4's effect `render()` cannot sample the webcam. This task produces the `WebGLTexture` handle that every downstream task consumes.

---

## Why

- Satisfies D18 — ogl renderer with `webgl: 2`, `preserveDrawingBuffer: true`, full-viewport stretch
- Satisfies D37 — `FrameContext.videoTexture: WebGLTexture` is produced here
- Satisfies D27 — texture is uploaded from the unmirrored `<video>` element (display mirror is CSS-only)
- Unlocks Task 3.2 (shader compilation needs `gl`), Task 3.4 (uniform upload needs `Program`), and Task 3.5 (context loss needs the renderer reference)
- Satisfies D28 (record feature) — `preserveDrawingBuffer: true` must be set at renderer construction time; it cannot be toggled later

---

## What

- `createOglRenderer(canvas)` returns `{ renderer, gl }` with the ogl `Renderer` configured per the skill
- `createVideoTexture(gl)` returns an ogl `Texture` ready to accept an `HTMLVideoElement` as `.image`
- `uploadVideoFrame(texture, videoEl)` — assigns `texture.image = videoEl; texture.needsUpdate = true;` only when `videoEl.readyState >= HAVE_ENOUGH_DATA` (4)
- `resizeRenderer(renderer, canvas)` — DPR-aware; calls `renderer.setSize(clientWidth, clientHeight)`; returns the new physical `[w, h]` tuple for `uResolution` consumers
- Integration anchor in `src/main.tsx` (or the engine init module) — a single `renderer` lifetime tied to the Stage component

### NOT Building (scope boundary)

- Fragment/vertex shader (Task 3.2)
- `Program`, `Mesh`, or any uniform wiring (Task 3.4)
- Region computation (Task 3.3)
- `webglcontextlost` / `webglcontextrestored` handlers (Task 3.5)
- Record / `canvas.captureStream()` logic (Phase 4)
- Any canvas clear-color animation — the ogl default is fine

### Success Criteria

- [ ] `src/engine/renderer.ts` exports `createOglRenderer`, `createVideoTexture`, `uploadVideoFrame`, `resizeRenderer`
- [ ] `pnpm biome check src/engine/renderer.ts src/engine/renderer.test.ts` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `pnpm vitest run src/engine/renderer.test.ts` exits 0 (covers: DPR resize math, `uploadVideoFrame` guards on `readyState < 4`, `preserveDrawingBuffer` flag presence)
- [ ] `pnpm build` exits 0
- [ ] `pnpm test:e2e --grep "Task 3.1:"` exits 0 — asserts the WebGL canvas has non-zero physical size and `renderer.gl instanceof WebGL2RenderingContext`
- [ ] Manual verification: open `pnpm preview` in Chrome 120+, grant camera, `window.__handTracker.getVideoTextureHandle()` returns a `WebGLTexture`

---

## All Needed Context

```yaml
files:
  - path: src/engine/paramStore.ts
    why: MIRROR plain-TS module shape — named exports, no default, JSDoc on the public API, no classes
    gotcha: This file uses a closure factory; the renderer is a pair of factory functions (no hidden state beyond what is returned) — keep the same no-singleton discipline

  - path: src/engine/renderLoop.ts
    why: The caller. Understand how `FrameContext.videoTexture` is populated and what the loop expects from this module
    gotcha: renderLoop owns the rVFC handle; renderer.ts is a pure factory — do NOT start an rVFC loop in this file

  - path: src/ui/Stage.tsx
    why: Owns the `<canvas ref>` that createOglRenderer receives. Understand the ref lifecycle and the StrictMode double-mount behavior
    gotcha: StrictMode runs useEffect twice — the renderer must be torn down and re-created cleanly on the first invocation; do not leak WebGL contexts

  - path: src/effects/handTrackingMosaic/manifest.ts
    why: The no-op render() that Task 3.4 will replace. Understand the EffectInstance contract so renderer.ts produces the right gl/texture handoff shape
    gotcha: manifest.create(gl) receives WebGL2RenderingContext directly — NOT the ogl Renderer. Expose `renderer.gl` for the caller

urls:
  - url: https://github.com/oframe/ogl/blob/master/src/core/Renderer.js
    why: ogl Renderer constructor options and gl-context resolution
    critical: "`webgl` must be the INTEGER 2, not `true`. `webgl: true` silently falls back to WebGL1 — `#version 300 es` shaders will not compile"

  - url: https://github.com/oframe/ogl/blob/master/src/core/Texture.js
    why: ogl Texture options — generateMipmaps, flipY, minFilter/magFilter/wrapS/wrapT semantics, and the `.texture` WebGLTexture handle
    critical: "Texture has NO destroy() method. Use gl.deleteTexture(texture.texture) in Task 3.5 teardown"

  - url: https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/readyState
    why: readyState values; HAVE_ENOUGH_DATA === 4 is the only safe upload threshold
    critical: "Uploading a video at readyState < 4 produces GL_INVALID_VALUE and a zero-size texture"

  - url: https://registry.khronos.org/webgl/specs/latest/2.0/#5.14
    why: WebGL 2 context creation attributes (preserveDrawingBuffer, antialias, alpha, premultipliedAlpha)
    critical: "preserveDrawingBuffer cannot be toggled post-construction; must be set at Renderer creation"

skills:
  - prp-task-ralph-loop
  - hand-tracker-fx-architecture
  - ogl-webgl-mosaic
  - vitest-unit-testing-patterns

discovery:
  - D18: Rendering stack — ogl WebGL bottom layer + Canvas 2D top layer, rVFC loop
  - D27: Mirror only at display (CSS scaleX(-1)); texture source is unmirrored video
  - D28: Record requires preserveDrawingBuffer: true at renderer construction
  - D37: FrameContext.videoTexture: WebGLTexture is produced by this module
```

### Current Codebase Tree (relevant subset)

```
src/
  main.tsx                # app entry; StrictMode on (flat src/ layout — no src/app/ subfolder)
  engine/
    manifest.ts           # EffectManifest, EffectInstance types
    registry.ts           # registerEffect / getEffect / listEffects
    paramStore.ts         # MIRROR target
    renderLoop.ts         # rVFC loop; calls EffectInstance.render(ctx)
    types.ts              # FrameContext per D37
  effects/
    handTrackingMosaic/
      manifest.ts         # no-op render() — Task 3.4 replaces
      grid.ts
      gridRenderer.ts
      blobRenderer.ts
  ui/
    Stage.tsx             # mounts <video>, WebGL <canvas>, 2D <canvas>
public/
  models/hand_landmarker.task
  wasm/
```

### Desired Codebase Tree

```
src/
  engine/
    renderer.ts           # NEW — createOglRenderer + createVideoTexture + uploadVideoFrame + resizeRenderer
    renderer.test.ts      # NEW — unit tests with a stubbed WebGL2 context
```

### Known Gotchas

```typescript
// CRITICAL: ogl Renderer `webgl` option is INTEGER 2, not boolean true.
// Passing `true` falls back to WebGL1 → GLSL ES 3.0 shaders fail to compile in Task 3.2.
new Renderer({ canvas, webgl: 2, /* ... */ });

// CRITICAL: preserveDrawingBuffer: true is required at construction for D28 record.
// Cannot be toggled later.

// CRITICAL: Texture has no .destroy() method in ogl 1.0.11.
// Task 3.5 teardown will call gl.deleteTexture(texture.texture).
// Expose the ogl `Texture` (not just the raw WebGLTexture) so the cleanup path
// has access to `.texture` and `.image`.

// CRITICAL: uploadVideoFrame must guard on readyState >= 4 (HAVE_ENOUGH_DATA).
// Uploading during initial decode produces GL_INVALID_VALUE and a black frame.
if (videoEl.readyState >= videoEl.HAVE_ENOUGH_DATA) {
  texture.image = videoEl;
  texture.needsUpdate = true;
}

// CRITICAL: texture.needsUpdate = true MUST be set every frame.
// ogl does not auto-poll HTMLVideoElement. Missing this pin the first-frame image.

// CRITICAL: resizeRenderer must use PHYSICAL pixels for any downstream uResolution
// consumer. renderer.setSize(w, h) multiplies by devicePixelRatio internally.
// Return `[renderer.gl.canvas.width, renderer.gl.canvas.height]`, NOT clientWidth.

// CRITICAL: React StrictMode runs effects twice in dev.
// The Stage.tsx effect must be able to tear down and re-create the renderer.
// Do NOT rely on a module-scoped singleton — the factory pattern enables clean teardown.

// CRITICAL: Do NOT import from '@mediapipe/tasks-vision' in this file.
// This module is pure WebGL; MediaPipe types live in Task 3.3 (region.ts).

// CRITICAL: TypeScript strict mode. No `any`. The ogl Renderer.gl is typed as
// WebGL2RenderingContext when webgl: 2. Import the `Renderer` and `Texture`
// types from 'ogl' directly.
```

---

## Implementation Blueprint

### Data Models

```typescript
// In src/engine/renderer.ts — public API types
import type { Renderer, Texture } from 'ogl';

export type OglBundle = {
  renderer: Renderer;
  gl: WebGL2RenderingContext;
};

export type PhysicalSize = readonly [width: number, height: number];
```

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE src/engine/renderer.ts
  - IMPLEMENT:
      export function createOglRenderer(canvas: HTMLCanvasElement): OglBundle
      export function createVideoTexture(gl: WebGL2RenderingContext): Texture
      export function uploadVideoFrame(texture: Texture, videoEl: HTMLVideoElement): boolean
      export function resizeRenderer(renderer: Renderer, canvas: HTMLCanvasElement): PhysicalSize
  - MIRROR: src/engine/paramStore.ts (module shape — named exports, JSDoc, no default export)
  - NAMING: camelCase factories; PascalCase types (OglBundle, PhysicalSize)
  - GOTCHA: Pass `webgl: 2` (integer), `preserveDrawingBuffer: true`, `antialias: false`, `alpha: false`, `premultipliedAlpha: false`
  - GOTCHA: Texture options: `generateMipmaps: false`, `flipY: true`, `minFilter: gl.LINEAR`, `magFilter: gl.LINEAR`, `wrapS: gl.CLAMP_TO_EDGE`, `wrapT: gl.CLAMP_TO_EDGE`
  - GOTCHA: uploadVideoFrame returns `false` when readyState < 4 (caller skips frame); returns `true` on success
  - VALIDATE: pnpm biome check src/engine/renderer.ts && pnpm tsc --noEmit

Task 2: CREATE src/engine/renderer.test.ts
  - IMPLEMENT: Vitest unit tests covering:
      * createOglRenderer calls Renderer constructor with webgl: 2, preserveDrawingBuffer: true
      * createVideoTexture returns a Texture configured with flipY: true, generateMipmaps: false
      * uploadVideoFrame returns false when readyState < HAVE_ENOUGH_DATA (mock videoEl { readyState: 2 })
      * uploadVideoFrame sets texture.image and texture.needsUpdate when readyState === 4
      * resizeRenderer returns [renderer.gl.canvas.width, renderer.gl.canvas.height] (physical, not CSS)
  - MIRROR: src/engine/paramStore.test.ts (Vitest conventions; mock strategy)
  - MOCK: vi.mock('ogl', () => ({ Renderer: vi.fn(...), Texture: vi.fn(...) }))
  - GOTCHA: Do not hit a real WebGL context in L2. The L4 Playwright test exercises the real stack.
  - VALIDATE: pnpm vitest run src/engine/renderer.test.ts

Task 3: MODIFY src/engine/types.ts
  - FIND: `export type FrameContext = {`
  - PRESERVE: all existing fields
  - ENSURE: `videoTexture: WebGLTexture | null` is present (per D37 — null before first upload)
  - VALIDATE: pnpm tsc --noEmit

Task 4: MODIFY src/ui/Stage.tsx (integration anchor)
  - FIND: `useEffect(() => {` inside Stage
  - ADD: call `createOglRenderer(canvasRef.current)` + `createVideoTexture(gl)` inside the effect; store refs; tear down in cleanup (idempotent)
  - PRESERVE: all existing video / 2D-canvas mounting
  - GOTCHA: Set `window.__handTracker.getVideoTextureHandle = () => texture.texture` when `import.meta.env.DEV`
  - VALIDATE: pnpm biome check src/ui/Stage.tsx && pnpm tsc --noEmit && pnpm build

Task 5: CREATE tests/e2e/task-3-1.spec.ts
  - IMPLEMENT: Playwright test describe('Task 3.1: ogl renderer bootstrap', ...) with:
      * Launch with --use-fake-device-for-media-stream
      * Grant camera, wait for GRANTED
      * Evaluate: document.querySelector('canvas[data-testid="webgl-canvas"]').width > 0
      * Evaluate: window.__handTracker.getVideoTextureHandle() instanceof WebGLTexture
  - MIRROR: tests/e2e/task-1-5.spec.ts (fake-webcam launch + window.__handTracker pattern)
  - GOTCHA: `--grep "Task 3.1:"` — the describe block string must start with exactly `Task 3.1:`
  - VALIDATE: pnpm test:e2e --grep "Task 3.1:"
```

### Integration Points

```yaml
RENDER_LOOP:
  - pattern: renderLoop consumes `{ texture, renderer }` via `FrameContext.videoTexture = texture.texture`
  - file: src/engine/renderLoop.ts
  - change: Stage.tsx passes the texture ref into the renderLoop start call (existing API)

FRAME_CONTEXT:
  - pattern: `ctx.videoTexture` per D37 — populated by uploadVideoFrame before each render
  - null when `readyState < 4` — effect.render() must handle this case (already in the no-op manifest)

DEV_HOOK:
  - pattern: window.__handTracker extended with `getVideoTextureHandle(): WebGLTexture | null`
  - file: src/engine/devHooks.ts
  - guard: `if (import.meta.env.DEV || import.meta.env.MODE === 'test')`
```

---

## Validation Loop

### Level 1 — Syntax and Style (after every file write)

```bash
pnpm biome check src/engine/renderer.ts src/engine/renderer.test.ts src/ui/Stage.tsx
pnpm tsc --noEmit
```

### Level 2 — Unit Tests

```bash
pnpm vitest run src/engine/renderer.test.ts
# Regression guard:
pnpm vitest run
```

### Level 3 — Integration (production build)

```bash
pnpm build
```

### Level 4 — E2E

```bash
pnpm test:e2e --grep "Task 3.1:"
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

- [ ] `createOglRenderer(canvas).gl instanceof WebGL2RenderingContext`
- [ ] `createVideoTexture(gl)` returns a Texture with `flipY === true`, `generateMipmaps === false`
- [ ] `uploadVideoFrame` short-circuits when readyState < 4 (verified in unit test)
- [ ] `resizeRenderer` returns physical pixels (post-DPR), not CSS pixels
- [ ] StrictMode double-mount does not leak WebGL contexts (verified manually in Chrome DevTools `about:gpu` / console `__handTracker` hook)

### Code Quality

- [ ] No `any` types introduced
- [ ] No React state in the hot path (this file has no React at all — pure WebGL factory)
- [ ] `gl.deleteTexture` not needed here (lives in Task 3.5)
- [ ] MIRROR pattern followed — module shape matches `paramStore.ts`

---

## Anti-Patterns

- Do not pass `webgl: true` — always the integer `2`
- Do not set `preserveDrawingBuffer: false` — record feature (D28) depends on it
- Do not upload the video without the `readyState >= 4` guard
- Do not forget `texture.needsUpdate = true` — frame will freeze
- Do not use `clientWidth` / `clientHeight` for `uResolution` — must be physical pixels
- Do not instantiate a module-level singleton — Stage.tsx owns the renderer lifecycle
- Do not start an rVFC loop here — renderLoop.ts owns the loop
- Do not call `texture.destroy()` — does not exist on ogl 1.0.11 Texture
- Do not swallow context-creation failures silently — throw `WebGLUnavailableError` (reuse from `src/tracking/errors.ts`) so the 8-state machine can surface `NO_WEBGL`

---

## No Prior Knowledge Test

- [ ] Every file path in `All Needed Context` exists in the codebase (paramStore.ts, Stage.tsx, renderLoop.ts, manifest.ts) or is created by this task
- [ ] Every URL in `urls:` is reachable and points to the correct section
- [ ] Every D-number cited exists in DISCOVERY.md (D18, D27, D28, D37)
- [ ] The Implementation Tasks list is topologically sorted — types → impl → test → integration → e2e
- [ ] All Validation Loop commands are copy-paste runnable with no placeholders
- [ ] The MIRROR file (`src/engine/paramStore.ts`) exists (created in Task 2.2)
- [ ] The task is atomic — does not require shader (3.2), regions (3.3), render wire-up (3.4), or context loss (3.5)

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/ogl-webgl-mosaic/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
