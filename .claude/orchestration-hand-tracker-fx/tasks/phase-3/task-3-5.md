# Task 3.5: Harden Context-Loss Recovery and Teardown

**Phase**: 3 — Mosaic Shader
**Branch**: `task/3-5-webgl-context-loss-recovery`
**Commit prefix**: `Task 3.5:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Attach `webglcontextlost` / `webglcontextrestored` listeners to the WebGL canvas so that a lost GPU context (from driver reset, tab backgrounding, device sleep, or explicit `WEBGL_lose_context.loseContext()`) cancels the rVFC loop cleanly and, on restore, fully re-initializes the renderer, video texture, effect Program, Mesh, and rVFC registration — with no memory leak and idempotent cleanup under React StrictMode.

**Deliverable**: Adds to `src/engine/renderer.ts`: `attachContextLossHandlers(canvas, onLost, onRestored)` and a `disposeRenderer(bundle)` helper that calls `program.remove()` on the effect, `gl.deleteTexture(texture.texture)` on the video texture, disconnects `ResizeObserver`, removes the context-loss listeners, and optionally `loseContext()` to release the canvas. `src/engine/contextLoss.test.ts` (new) drives `WEBGL_lose_context` in a real WebGL2 context (Playwright-side or happy-dom+jsdom with real-canvas) and verifies the listeners fire and `gl.deleteTexture` is called.

**Success Definition**: `pnpm vitest run src/engine/contextLoss.test.ts` exits 0; `pnpm test:e2e -- --grep "Task 3.5:"` exits 0 — a Playwright test forces context loss via the `WEBGL_lose_context` extension, waits 50ms, force-restores, and asserts the mosaic resumes rendering (region count > 0 again with a fake landmark payload); `pnpm tsc --noEmit` exits 0.

---

## User Persona

**Target User**: Creative technologist whose laptop goes to sleep, switches to another app that grabs the GPU, or whose driver is updated mid-session.

**Use Case**: User is mid-recording or mid-demo when the OS suspends the GPU. Without this task, the WebGL canvas goes black permanently until a full page reload. With this task, the renderer transparently recovers within ~100ms of resume.

**User Journey**:
1. User is actively using the app — mosaic effect rendering at 30 fps
2. GPU resets (driver update, tab switch, or `webgl.force-context-loss`)
3. `webglcontextlost` fires → `e.preventDefault()` (required for restore); rVFC cancelled; "recovering" hint optional
4. `webglcontextrestored` fires → renderer / texture / program re-created; rVFC restarts
5. User sees mosaic resume with no state loss

**Pain Points Addressed**: Without context-loss handlers, any GPU reset permanently blacks out the canvas. The CSP/COOP hardening in `vite-vercel-coop-coep` makes this more likely in the real world (cross-origin isolation interacts with GPU process lifetime).

---

## Why

- Satisfies D18 — ogl bootstrap must survive context loss in a real browser
- Satisfies D25 — cleanup idempotent under StrictMode; `track.stop()` (camera) and `gl.deleteTexture` (GPU) every unmount
- Satisfies D37 — `FrameContext.videoTexture` is re-acquired cleanly after loss
- Unlocks Task 3.R (the regression gate asserts no console errors after a forced context-loss cycle)

---

## What

- `attachContextLossHandlers(canvas, onLost, onRestored)` attaches two listeners and returns a detach function
- `onLost` callback: cancel rVFC handle (caller provides), clear any dev hooks, log a warning
- `onRestored` callback: caller re-runs `createOglRenderer` + `createVideoTexture` + `initMosaicEffect` + restart rVFC
- `disposeRenderer({ renderer, texture, mesh, ro, detachCtxLoss, rVFCHandle, videoEl })`:
  - Cancel rVFC via `videoEl.cancelVideoFrameCallback(rVFCHandle)`
  - Disconnect `ResizeObserver`
  - Call `detachCtxLoss()`
  - `mesh.program.remove()`
  - `renderer.gl.deleteTexture(texture.texture)`
  - Optional `ext = renderer.gl.getExtension('WEBGL_lose_context'); ext?.loseContext()`
- Integration in `src/ui/Stage.tsx`: wire the handlers to the lifecycle of the Stage's useEffect; on `webglcontextrestored`, call a re-init function that reconstructs the full pipeline

### NOT Building (scope boundary)

- The initial renderer construction (Task 3.1)
- The shader (Task 3.2)
- The region math (Task 3.3)
- The effect wiring (Task 3.4)
- UI "recovering" toast (not required — the gap is typically < 100ms and user-invisible; D23's MODEL_LOAD_FAIL / NO_WEBGL states handle permanent failures)
- Service-worker offline (Phase 5)

### Success Criteria

- [ ] `attachContextLossHandlers` and `disposeRenderer` are exported from `src/engine/renderer.ts`
- [ ] `pnpm biome check src/engine/` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `pnpm vitest run src/engine/contextLoss.test.ts` exits 0
- [ ] `pnpm build` exits 0
- [ ] `pnpm test:e2e -- --grep "Task 3.5:"` exits 0 — forces context loss, then restore, then asserts mosaic resumes
- [ ] Manual: open DevTools console; run `document.querySelector('canvas[data-testid="webgl-canvas"]').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()`; 100ms later call `.restoreContext()`; visually confirm mosaic resumes; console shows one warn + one info log, no errors

---

## All Needed Context

```yaml
files:
  - path: src/engine/renderer.ts
    why: Task 3.1 owner; this task adds attachContextLossHandlers + disposeRenderer to the same module
    gotcha: Do not create module-level state; all handles are passed in by the caller (Stage.tsx)

  - path: src/ui/Stage.tsx
    why: The React component whose useEffect owns the renderer lifetime — this task modifies its cleanup to call disposeRenderer and its context-loss listener to call a re-init closure
    gotcha: StrictMode runs the effect twice; the first cleanup must fully dispose before the second mount allocates anew. Guard with an isCancelled ref if the re-init is async

  - path: src/effects/handTrackingMosaic/manifest.ts
    why: EffectInstance.dispose() is called as part of re-init. Task 3.4 already calls program.remove(); confirm it is idempotent
    gotcha: Calling program.remove() twice is a no-op on ogl 1.0.11 but calling gl.deleteProgram on an already-deleted program is silent in WebGL2

  - path: src/engine/renderLoop.ts
    why: Task 1.5 — owns the rVFC handle. disposeRenderer receives the handle as an argument; renderLoop must expose a cancel() or return the handle from start()
    gotcha: Do not call cancelAnimationFrame on the rVFC handle — it's a different namespace; use videoEl.cancelVideoFrameCallback

  - path: src/tracking/errors.ts
    why: Task 1.4 — WebGLUnavailableError. If context restore fails (e.g., GPU blacklisted), map the failure to NO_WEBGL state via this error class
    gotcha: Do not create a new error class for context-loss permanent failure; reuse WebGLUnavailableError

urls:
  - url: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#handling_context_loss
    why: Canonical pattern for webglcontextlost/restored
    critical: "e.preventDefault() MUST be called synchronously in the handler body. Without it, the browser will not fire webglcontextrestored"

  - url: https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_lose_context
    why: The testable extension — loseContext() and restoreContext() methods
    critical: "Available in Chromium, Firefox, Safari; events fire on the next task tick, not synchronously. Tests must `await` a microtask."

  - url: https://github.com/oframe/ogl/blob/master/src/core/Program.js
    why: Program.remove() semantics — deletes WebGL program + shader objects
    critical: "program.remove() is safe to call multiple times (internal null-guard on the WebGLProgram handle)"

skills:
  - prp-task-ralph-loop
  - hand-tracker-fx-architecture
  - ogl-webgl-mosaic
  - vitest-unit-testing-patterns
  - playwright-e2e-webcam

discovery:
  - D18: ogl renderer
  - D23: NO_WEBGL error state — used only if restore permanently fails
  - D25: Cleanup idempotent under StrictMode; track.stop() for camera, gl.deleteTexture for GPU
  - D37: FrameContext.videoTexture re-acquired after restore
```

### Current Codebase Tree (relevant subset)

```
src/
  engine/
    renderer.ts                     # Task 3.1 — add exports here
    renderLoop.ts                   # Task 1.5 — rVFC owner
  effects/
    handTrackingMosaic/
      manifest.ts                   # Task 3.4 — EffectInstance.dispose()
  ui/
    Stage.tsx                       # Task 1.6 — useEffect owner
  tracking/
    errors.ts                       # Task 1.4 — WebGLUnavailableError
```

### Desired Codebase Tree

```
src/
  engine/
    renderer.ts                     # MODIFIED — add attachContextLossHandlers + disposeRenderer
    contextLoss.test.ts             # NEW — drives WEBGL_lose_context
  ui/
    Stage.tsx                       # MODIFIED — wire context-loss listeners
```

### Known Gotchas

```typescript
// CRITICAL: e.preventDefault() must be called SYNCHRONOUSLY in the webglcontextlost
// handler. If called from inside an async callback, the browser gives up on
// restoration and webglcontextrestored NEVER fires.

// CRITICAL: All GL objects are invalid after context loss. Textures, Programs,
// Buffers, VAOs — all of them. Do NOT try to reuse any handle across the
// loss → restore boundary. Re-create everything from scratch on restore.

// CRITICAL: The WebGLRenderingContext itself is NOT recreated — only its
// internal GPU resources. You can continue using the same `gl` reference,
// but any object created against it pre-loss is dead.

// CRITICAL: rVFC handle is a separate namespace from rAF. Use
// `videoEl.cancelVideoFrameCallback(handle)`, not `cancelAnimationFrame(handle)`.

// CRITICAL: React StrictMode runs effects twice. The cleanup path MUST be
// idempotent. Use a ref-flag `isCancelled = true` to guard re-init closures
// that run async after cleanup.

// CRITICAL: ogl Texture has no destroy() method. Use gl.deleteTexture(texture.texture).
// The `.texture` property is the WebGLTexture handle; it becomes invalid after
// context loss, so disposing is a no-op then — but calling deleteTexture(null)
// is also fine; WebGL silently ignores it.

// CRITICAL: WEBGL_lose_context.loseContext() fires the event asynchronously —
// NOT synchronously. Tests must await a microtask / small setTimeout.

// CRITICAL: If getExtension('WEBGL_lose_context') returns null (very rare on
// modern hardware), skip the test. Do NOT throw — feature is optional for prod.

// CRITICAL: Do not call e.preventDefault() on webglcontextrestored — only on lost.

// CRITICAL: ResizeObserver persists across context loss (it's a DOM thing, not GL).
// Do not re-create it on restore — only in the full-dispose path.

// CRITICAL: On restore, the ORDER matters:
//   1. createOglRenderer(canvas) — but wait, the canvas already has a context...
//      ACTUALLY: we reuse the existing canvas + existing gl. We re-create the
//      Texture, Program, Mesh, and restart rVFC. We do NOT call `new Renderer`
//      because the canvas still owns its WebGL2 context (ogl just loses track
//      of which program is bound).
//   2. createVideoTexture(gl)
//   3. initMosaicEffect(gl, texture)
//   4. attachContextLossHandlers again (listeners survive; handlers don't)  <- WRONG
//      ACTUALLY: DOM event listeners survive context loss. Do NOT detach/re-attach.
//   5. Restart rVFC

// CRITICAL: The cleanup order in disposeRenderer matters:
//   1. Cancel rVFC FIRST (stop any in-flight frame callback)
//   2. Disconnect ResizeObserver (stop resize-driven uniform updates)
//   3. Detach context-loss listeners (stop handling loss during teardown)
//   4. mesh.program.remove() (delete GL program + shader objects)
//   5. gl.deleteTexture(texture.texture) (delete the video texture)
//   6. Optionally gl.getExtension('WEBGL_lose_context').loseContext() to
//      force the canvas to release the underlying WebGL resources
```

---

## Implementation Blueprint

### Data Models

```typescript
// src/engine/renderer.ts — added to Task 3.1's file
import type { Renderer, Texture, Mesh } from 'ogl';

export type ContextLossHandlers = {
  /** Called synchronously inside webglcontextlost — MUST call e.preventDefault() */
  onLost: (event: Event) => void;
  /** Called when webglcontextrestored fires — re-create GL objects here */
  onRestored: () => void;
};

export type DisposeRendererArgs = {
  renderer: Renderer;
  texture: Texture;
  mesh: Mesh;
  ro: ResizeObserver;
  detachCtxLoss: () => void;
  rVFCHandle: number | undefined;
  videoEl: HTMLVideoElement;
};
```

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: MODIFY src/engine/renderer.ts
  - ADD: attachContextLossHandlers(canvas, { onLost, onRestored }): () => void
      * Inside the function, wrap the user's onLost to call `e.preventDefault()` FIRST, then invoke onLost(e)
      * Attach both listeners via canvas.addEventListener
      * Return a detach function that calls removeEventListener for both
  - ADD: disposeRenderer(args: DisposeRendererArgs): void
      * cancel rVFC (if handle defined) on args.videoEl
      * args.ro.disconnect()
      * args.detachCtxLoss()
      * args.mesh.program.remove()
      * args.renderer.gl.deleteTexture(args.texture.texture)
      * Optional: args.renderer.gl.getExtension('WEBGL_lose_context')?.loseContext()
  - MIRROR: existing createOglRenderer / createVideoTexture structure in the same file
  - GOTCHA: The e.preventDefault() wrapping is load-bearing — forgetting it means webglcontextrestored never fires
  - VALIDATE: pnpm biome check src/engine/renderer.ts && pnpm tsc --noEmit

Task 2: CREATE src/engine/contextLoss.test.ts
  - IMPLEMENT: Vitest tests:
      * it('attachContextLossHandlers wraps onLost to call preventDefault')
          Create a spy event with preventDefault = vi.fn()
          Attach, dispatch a `new Event('webglcontextlost')` with defaultPrevented check
          Assert preventDefault was called
      * it('attachContextLossHandlers returns a detach fn that removes both listeners')
          Attach, call detach, dispatch both events, assert user onLost/onRestored not called
      * it('disposeRenderer cancels rVFC when handle is defined')
          fakeVideo.cancelVideoFrameCallback = vi.fn()
          call disposeRenderer({ ..., rVFCHandle: 42, videoEl: fakeVideo })
          expect(fakeVideo.cancelVideoFrameCallback).toHaveBeenCalledWith(42)
      * it('disposeRenderer skips rVFC cancel when handle is undefined')
      * it('disposeRenderer disconnects ResizeObserver')
      * it('disposeRenderer detaches context-loss listeners')
      * it('disposeRenderer calls mesh.program.remove()')
      * it('disposeRenderer calls gl.deleteTexture on texture.texture')
          Stub gl.deleteTexture; provide texture.texture = Symbol('glTex')
          expect(gl.deleteTexture).toHaveBeenCalledWith(texture.texture)
      * it('disposeRenderer is idempotent under double-invocation (StrictMode safety)')
          Call disposeRenderer twice with same args; no throw; each spy called 1 or 2 times (documented)
      * it.skipIf(!realWebGL2())('WEBGL_lose_context integration — full loss → restore cycle', async () => {
          acquire real gl2, attach handlers, loseContext(), await tick, assert onLost ran,
          restoreContext(), await tick, assert onRestored ran
        })
  - MIRROR: src/engine/renderer.test.ts (Vitest conventions; stub pattern)
  - GOTCHA: happy-dom may not support WEBGL_lose_context; use `it.skipIf` gate
  - GOTCHA: For the integration case, the events fire on the next tick; await a setTimeout(0) or queueMicrotask before asserting
  - VALIDATE: pnpm vitest run src/engine/contextLoss.test.ts

Task 3: MODIFY src/ui/Stage.tsx
  - FIND: the useEffect that mounts the renderer + texture + effect (added in Tasks 3.1 + 3.4)
  - ADD:
      const rVFCHandleRef = { current: undefined as number | undefined };
      let bundle = bootstrap();  // closure building renderer, texture, effect, rVFC
      const detachCtxLoss = attachContextLossHandlers(canvasRef.current, {
        onLost: () => {
          if (rVFCHandleRef.current !== undefined) {
            videoElRef.current?.cancelVideoFrameCallback(rVFCHandleRef.current);
            rVFCHandleRef.current = undefined;
          }
          console.warn('[hand-tracker-fx] WebGL context lost');
          bundle.effect.dispose();
          // keep renderer & texture handles — both are invalidated by the loss but
          // need to be re-acquired cleanly; full re-create on restore:
        },
        onRestored: () => {
          console.info('[hand-tracker-fx] WebGL context restored — reinitializing');
          bundle = bootstrap();
        },
      });
      // return cleanup:
      return () => {
        disposeRenderer({
          renderer: bundle.renderer,
          texture: bundle.texture,
          mesh: bundle.mesh,
          ro: bundle.ro,
          detachCtxLoss,
          rVFCHandle: rVFCHandleRef.current,
          videoEl: videoElRef.current!,
        });
      };
  - PRESERVE: all Phase 1 / Phase 2 / Task 3.1 / Task 3.4 behavior
  - GOTCHA: The `bootstrap()` closure is not a new module — it's a local function in the useEffect that encapsulates renderer + texture + mesh + rVFC start. Extract it for readability.
  - VALIDATE: pnpm biome check src/ui/Stage.tsx && pnpm tsc --noEmit && pnpm build

Task 4: CREATE tests/e2e/task-3-5.spec.ts
  - IMPLEMENT: describe('Task 3.5: webgl context loss recovery', ...):
      * Launch with --use-fake-device-for-media-stream; grant camera
      * Inject fake landmarks; assert getLastRegionCount() > 0
      * Force loss:
          await page.evaluate(() => {
            const c = document.querySelector('canvas[data-testid="webgl-canvas"]') as HTMLCanvasElement;
            const gl = c.getContext('webgl2') as WebGL2RenderingContext;
            const ext = gl.getExtension('WEBGL_lose_context');
            ext!.loseContext();
          });
      * Wait 200ms
      * Force restore:
          await page.evaluate(() => {
            const c = document.querySelector('canvas[data-testid="webgl-canvas"]') as HTMLCanvasElement;
            const gl = c.getContext('webgl2') as WebGL2RenderingContext;
            const ext = gl.getExtension('WEBGL_lose_context');
            ext!.restoreContext();
          });
      * Wait 500ms for re-init
      * Assert getLastRegionCount() > 0 again (rendering resumed)
      * Assert console shows one 'WebGL context lost' warn + one 'WebGL context restored' info, zero errors
  - NAMING: `Task 3.5:` prefix
  - GOTCHA: restoreContext may not be available on all hardware; tolerate by skipping the spec in that case via `test.skip`
  - VALIDATE: pnpm test:e2e -- --grep "Task 3.5:"
```

### Integration Points

```yaml
STAGE_LIFECYCLE:
  - Stage.tsx useEffect wraps bootstrap() in a re-invocable closure
  - Context-loss listeners call dispose() + re-bootstrap() on restore
  - Cleanup calls disposeRenderer

EFFECT_DISPOSE:
  - manifest.create().dispose() is called during context loss (cleanup)
  - Also called during full unmount

DEV_HOOK:
  - window.__handTracker.forceContextLoss() (dev-only) — convenience for manual testing
  - window.__handTracker.forceContextRestore() (dev-only)
```

---

## Validation Loop

### Level 1 — Syntax and Style

```bash
pnpm biome check src/engine/renderer.ts src/engine/contextLoss.test.ts src/ui/Stage.tsx
pnpm tsc --noEmit
```

### Level 2 — Unit Tests

```bash
pnpm vitest run src/engine/contextLoss.test.ts
pnpm vitest run
```

### Level 3 — Integration

```bash
pnpm build
```

### Level 4 — E2E

```bash
pnpm test:e2e -- --grep "Task 3.5:"
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

- [ ] Manual: forcing `loseContext()` in DevTools shows exactly one `WebGL context lost` warn log; subsequent `restoreContext()` shows exactly one `WebGL context restored` info log
- [ ] After restore, `window.__handTracker.getLastRegionCount() > 0` with a hand in frame
- [ ] No unhandled promise rejections during the loss → restore cycle
- [ ] StrictMode: double-mount → each mount's cleanup runs disposeRenderer exactly once; no `gl.deleteTexture called with already-deleted texture` errors
- [ ] No WebGL-Object-Zombie-Leak (GL resources from the lost context are not referenced after restore)

### Code Quality

- [ ] No `any` types
- [ ] `e.preventDefault()` is inside a synchronous wrapper, not after an await
- [ ] `gl.deleteTexture(texture.texture)` used — not `texture.destroy()`
- [ ] ResizeObserver disconnect is in disposeRenderer
- [ ] MIRROR: new exports live in the same `renderer.ts` module as Task 3.1

---

## Anti-Patterns

- Do not call `e.preventDefault()` asynchronously — must be synchronous
- Do not try to reuse WebGL handles across a loss → restore boundary
- Do not use `cancelAnimationFrame` on an rVFC handle
- Do not call `texture.destroy()` — use `gl.deleteTexture(texture.texture)`
- Do not call `loseContext()` in production render loops — it's an opt-in test-only tool
- Do not add a `'use client'` directive
- Do not throw on missing `WEBGL_lose_context` extension — treat as absent
- Do not create a new `Renderer` in `onRestored` without first disposing the old one
- Do not forget that StrictMode double-mount will dispose twice in dev — idempotency is mandatory

---

## No Prior Knowledge Test

- [ ] Every file path in `All Needed Context` exists (renderer.ts from 3.1, manifest.ts from 3.4, renderLoop.ts, Stage.tsx, errors.ts)
- [ ] Every URL in `urls:` is reachable
- [ ] Every D-number cited exists in DISCOVERY.md (D18, D23, D25, D37)
- [ ] Implementation tasks topologically sorted — renderer.ts additions → unit tests → Stage.tsx wiring → e2e
- [ ] Validation Loop commands are copy-paste runnable
- [ ] Upstream modules exist: Task 3.1 renderer.ts, Task 3.4 manifest.ts, Task 1.5 renderLoop.ts, Task 1.6 Stage.tsx
- [ ] The task is atomic — does not require the Phase 3 regression (3.R)

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/ogl-webgl-mosaic/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
```
