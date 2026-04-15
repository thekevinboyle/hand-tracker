# Task 1.5: rVFC-driven render loop scaffold

**Phase**: 1 — Foundation
**Branch**: `task/1-5-rvfc-render-loop`
**Commit prefix**: `Task 1.5:`
**Estimated complexity**: High
**Max Ralph iterations**: 30

---

## Goal

**Feature Goal**: Implement a `requestVideoFrameCallback`-driven render loop that ticks exactly once per decoded video frame, calls `HandLandmarker.detectForVideo(video, nowMs)` with a monotonic ms timestamp, composes a `FrameContext` per D37, and invokes an injected `onFrame(ctx)` callback — with clean start/stop lifecycle, StrictMode-safe cancellation, and a dev-only `window.__handTracker` hook exposing `getFPS()` + `getLandmarkCount()`.

**Deliverable**: `src/engine/renderLoop.ts`, `src/engine/types.ts`, `src/engine/devHooks.ts`, `src/engine/renderLoop.test.ts`, and an E2E test asserting `__handTracker.getFPS() > 0` under fake-device playback.

**Success Definition**: `pnpm vitest run src/engine` exits 0 with fake-video + fake-rVFC shim tests; `pnpm test:e2e --grep "Task 1.5:"` shows `getFPS()` > 0 within 5s warmup.

---

## User Persona

**Target User**: Every consumer of the render pipeline — Phase 2 overlay, Phase 3 mosaic, Phase 4 recorder. Each needs a `FrameContext` per D37 delivered at video frame rate with timestamps suitable for `detectForVideo`.

**Use Case**: After `useCamera` grants a stream and `initHandLandmarker()` resolves, the render loop takes over: each video frame triggers detection, resolves params (Phase 2+), and calls the current effect's `render(ctx)`.

**User Journey**:
1. App mounts; `useCamera` reaches GRANTED; `initHandLandmarker()` resolves.
2. `startRenderLoop({ video, onFrame, onError })` is called with the live `<video>` element.
3. Every decoded video frame: rVFC fires → `nowMs` is captured → `detectForVideo(video, nowMs)` runs → `onFrame({ videoTexture: null, videoSize, landmarks, params, timeMs: nowMs })` fires.
4. Dev hook updates rolling FPS + last landmark count.
5. On unmount, `stop()` cancels the pending rVFC id — idempotent under StrictMode.

**Pain Points Addressed**: Without rVFC we would use `requestAnimationFrame`, which double-fires on duplicate video frames and fails D21's FPS metric. Without monotonic timestamps, MediaPipe silently no-ops.

---

## Why

- Required by D17 (main-thread loop), D18 (rVFC, not rAF), D37 (FrameContext shape).
- Unlocks all of Phase 2 (effect registry consumes onFrame), Phase 3 (mosaic shader rendered each frame), Phase 4 (MediaRecorder captures from the canvas), Phase 5 (E2E FPS assertion).
- The dev-hook `getFPS()` is the ONLY way Playwright can read render rate (MediaPipe runs in wasm, invisible to page.evaluate).

---

## What

- `startRenderLoop({ video, onFrame, onError })` returns a `stop()` function.
- Each rVFC tick:
  1. Guard `video.readyState >= HAVE_CURRENT_DATA` (2).
  2. Call `landmarker.detectForVideo(video, nowMs)` where `nowMs` is the rVFC `now` parameter (DOMHighResTimeStamp).
  3. Build `FrameContext` per D37 (`videoTexture: null` for now — Phase 3 wires the OGL texture; `videoSize: { w: video.videoWidth, h: video.videoHeight }`; `landmarks`; `params: {}` for now — Phase 2 wires paramStore; `timeMs: nowMs`).
  4. Invoke `onFrame(ctx)`.
  5. Re-register via `video.requestVideoFrameCallback(loop)`.
- Errors (including detectForVideo throws) are routed to `onError(err)` and the loop continues (swallow + report; callers decide whether to stop).
- Monotonic timestamp: always pass the rVFC `now` parameter; never `Date.now()` / `video.currentTime`.
- Dev hook: `window.__handTracker = { getFPS, getLandmarkCount, isReady, isUsingGpu }` behind `import.meta.env.DEV || MODE === 'test'`; FPS rolling average over last ~3s.
- `stop()` cancels the pending rVFC id via `video.cancelVideoFrameCallback(id)`, nulls it, and is idempotent.

### NOT Building (scope boundary)

- The OGL renderer + video texture — Phase 3 (Task 3.1).
- paramStore integration (Phase 2 Task 2.2) — for now `params: {}`.
- Effect registry `render()` call chain — Phase 2 Task 2.5.
- Reduced-motion param suppression — Phase 4.
- MediaRecorder integration — Phase 4.
- Worker offloading — out of scope.

### Success Criteria

- [ ] `src/engine/types.ts` exports `FrameContext` matching D37.
- [ ] `src/engine/renderLoop.ts` exports `startRenderLoop` and the `StartRenderLoopParams` / `RenderLoopHandle` types.
- [ ] `src/engine/devHooks.ts` exports `updateFpsSample(nowMs)`, `updateLandmarkCount(n)`, and registers the `window.__handTracker` API in dev/test.
- [ ] FPS rolling average over last 3s computed from stored timestamps (bounded buffer).
- [ ] `stop()` cancels a pending rVFC id; double-stop is a no-op.
- [ ] Unit tests pass with a fake `<video>` + fake rVFC shim (verify 3 ticks → onFrame called 3 times; stop prevents a 4th).
- [ ] E2E: `await page.evaluate(() => (window as any).__handTracker.getFPS())` returns a number > 0 after 5s warmup.

---

## All Needed Context

```yaml
files:
  - path: src/tracking/handLandmarker.ts
    why: Source of initHandLandmarker() + the HandLandmarker instance; render loop awaits it before starting detection
    gotcha: detectForVideo requires monotonic nowMs; DO NOT use Date.now() or video.currentTime

  - path: src/camera/useCamera.ts
    why: Source of videoEl (React RefObject<HTMLVideoElement|null>); the loop consumes videoEl.current
    gotcha: videoEl.current may be null during the first render; guard before startRenderLoop

  - path: src/App.tsx
    why: Integration point — when state becomes GRANTED, App calls startRenderLoop via a useEffect
    gotcha: Add a useEffect that runs when state transitions from !GRANTED → GRANTED; cleanup calls stop(); StrictMode double-invokes — the stop() idempotency handles it

  - path: src/test/setup.ts
    why: jsdom does not implement requestVideoFrameCallback — tests MUST shim it
    gotcha: The test file provides its own shim; do not add it globally in setup.ts (would pollute other tests)

urls:
  - url: https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback
    why: rVFC API — callback receives (now: DOMHighResTimeStamp, metadata: VideoFrameMetadata)
    critical: rVFC is one-shot; must re-register every frame. `now` is already performance.now()-domain — pass it directly to detectForVideo

  - url: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/readyState
    why: readyState >= HAVE_CURRENT_DATA (2) is required before detectForVideo
    critical: HAVE_CURRENT_DATA = 2; HAVE_FUTURE_DATA = 3; HAVE_ENOUGH_DATA = 4 — we accept any of 2/3/4

  - url: https://developers.google.com/mediapipe/solutions/vision/hand_landmarker/web_js
    why: detectForVideo(video, timestamp) — returns HandLandmarkerResult with landmarks array
    critical: Timestamps must strictly increase; duplicate or smaller → silent empty result

skills:
  - mediapipe-hand-landmarker
  - vitest-unit-testing-patterns
  - playwright-e2e-webcam
  - hand-tracker-fx-architecture
  - prp-task-ralph-loop

discovery:
  - D17: MediaPipe tasks-vision main-thread + GPU delegate
  - D18: rVFC (requestVideoFrameCallback) — not rAF
  - D21: Testing — Vitest for pure utilities, Playwright for FPS + render
  - D25: Cleanup must cancel rVFC registrations on unmount (StrictMode-safe)
  - D37: FrameContext shape — { videoTexture, videoSize, landmarks, params, timeMs }
```

### Current Codebase Tree (relevant subset)

```
src/
  camera/ useCamera.ts, cameraState.ts, mapError.ts
  tracking/ handLandmarker.ts, errors.ts
  engine/                       # EMPTY — this task creates it
  App.tsx
  main.tsx
  test/setup.ts
```

### Desired Codebase Tree (this task adds)

```
src/
  engine/
    types.ts                    # FrameContext, Landmark type aliases (new)
    renderLoop.ts               # startRenderLoop + stop; rVFC driver (new)
    devHooks.ts                 # window.__handTracker registration (new)
    renderLoop.test.ts          # fake-video + fake-rVFC shim tests (new)
tests/
  e2e/
    renderLoop.spec.ts          # Task 1.5: getFPS() > 0 after warmup (new)
```

### Known Gotchas

```typescript
// CRITICAL: rVFC is one-shot. Must re-register EVERY frame from INSIDE the
// callback; otherwise the loop dies after the first tick.

// CRITICAL: MediaPipe detectForVideo() requires monotonic, strictly
// increasing ms timestamps. The `now` argument from rVFC is already in the
// performance.now() domain — pass it directly. NEVER use Date.now() or
// video.currentTime.

// CRITICAL: React StrictMode runs effects twice. Your useEffect must call
// the stop() returned by startRenderLoop in its cleanup. stop() MUST be
// idempotent (check _rvfcId !== undefined before calling cancelVideoFrameCallback).

// CRITICAL: jsdom has no requestVideoFrameCallback. Tests shim it by
// assigning HTMLVideoElement.prototype.requestVideoFrameCallback = fn.
// The shim records callbacks and advances them manually.

// CRITICAL: Dev hook is guarded by import.meta.env.DEV OR MODE === 'test'.
// The production Vercel build tree-shakes the hook — so E2E MUST run against
// `pnpm build && pnpm preview` with `--mode test` if production hides it.
// ALTERNATIVELY: vite.config.ts's default `vite preview` uses the production
// build; the DEV flag is false. We rely on MODE === 'test' being true in
// test runs. Playwright's webServer runs `pnpm build && pnpm preview` —
// this does NOT set MODE=test. Solution: update playwright.config.ts
// webServer command to `pnpm build --mode test && pnpm preview` OR ensure
// the dev hook branch uses a different predicate. Simplest: use a
// dedicated build flag `import.meta.env.VITE_EXPOSE_DEV_HOOK` set by
// `vite build --mode test`. See Implementation Task 2.

// CRITICAL: detectForVideo can throw if the landmarker closed mid-frame.
// Wrap the call in try/catch; route errors to onError; do not re-throw
// (the loop continues so a transient error doesn't kill the app).

// CRITICAL: FrameContext.videoTexture is typed `WebGLTexture | null`. In
// Phase 1 it is always null — Phase 3 (Task 3.1) wires the OGL texture.
// Do NOT remove the field from the type — Phase 3 depends on it.

// CRITICAL: `src/engine/types.ts` is the SINGLE SOURCE OF TRUTH for cross-module
// types (`FrameContext`, `Landmark`). Task 2.1 re-exports these from here via
// `export type { FrameContext, Landmark } from './types'` — it does NOT redeclare.
// `Landmark` is aliased to `NormalizedLandmark` from '@mediapipe/tasks-vision'
// (no custom `{x,y,z,visibility?}` type). This guarantees structural AND nominal
// identity across every downstream module (render loop, effects, region math).

// CRITICAL: FPS calculation: keep a rolling array of the last ~180 nowMs
// samples (6s at 30fps). FPS = samples.length / (lastMs - firstMs) * 1000.
// Use a ring buffer or shift-on-overflow; don't keep an unbounded list.

// CRITICAL: Biome flags unused `_meta` param — prefix with `_` or use
// `onFrame` directly without destructuring it.
```

---

## Implementation Blueprint

### Data Models

```typescript
// src/engine/types.ts
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Canonical landmark type for the project — aliased to MediaPipe's NormalizedLandmark.
 * Do NOT declare a custom `{ x, y, z, visibility? }` structural copy anywhere else.
 * Task 2.1's `src/engine/manifest.ts` re-exports `Landmark` via `export type { Landmark } from './types'`.
 */
export type Landmark = NormalizedLandmark;

/** Per-frame context passed to effect renders. Matches D37. */
export interface FrameContext {
  /** Populated by Phase 3 (Task 3.1) — OGL video texture. Null in Phase 1. */
  videoTexture: WebGLTexture | null;
  videoSize: { w: number; h: number };
  /** Landmarks for the first hand in the frame (numHands=1 per D8), or null. */
  landmarks: Landmark[] | null;
  /**
   * 2D overlay canvas context. Populated by `startRenderLoop` when called with
   * an `overlayCtx2d` argument (Phase 2 Task 2.5 wires this up). Null in Phase 1
   * only if `startRenderLoop` is invoked without it; once populated it is
   * pre-populated by the render loop so effects never early-return on missing ctx.
   */
  ctx2d: CanvasRenderingContext2D | null;
  /** Resolved params (post-modulation). Empty record in Phase 1; populated in Phase 2. */
  params: Record<string, unknown>;
  /** Monotonic ms from rVFC `now`. Pass directly to detectForVideo. */
  timeMs: number;
}

// src/engine/renderLoop.ts
import type { HandLandmarker } from '@mediapipe/tasks-vision';

export interface StartRenderLoopParams {
  video: HTMLVideoElement;
  landmarker: HandLandmarker;
  onFrame: (ctx: FrameContext) => void;
  /**
   * 2D overlay canvas context — threaded into every per-frame FrameContext.
   * Optional for Phase 1 (pre-Stage); once Task 1.6 mounts the overlay canvas,
   * App.tsx supplies it so Phase 2's effect render() can draw grid + blobs
   * WITHOUT needing to early-return on missing ctx.
   */
  overlayCtx2d?: CanvasRenderingContext2D | null;
  onError?: (err: unknown) => void;
}

export interface RenderLoopHandle {
  stop: () => void;
}
```

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE src/engine/types.ts
  - IMPLEMENT: FrameContext interface per D37 exactly
  - MIRROR: None (new module)
  - NAMING: PascalCase interface; export only types
  - GOTCHA: Import `NormalizedLandmark` as a type-only import (`import type { NormalizedLandmark }`); otherwise biome flags unused-value import
  - VALIDATE: pnpm biome check src/engine/types.ts && pnpm tsc --noEmit

Task 2: CREATE src/engine/devHooks.ts
  - IMPLEMENT:
      const FPS_SAMPLE_MS = 3000;
      const samples: number[] = [];
      let lastLandmarkCount = 0;

      export function updateFpsSample(nowMs: number): void {
        samples.push(nowMs);
        const cutoff = nowMs - FPS_SAMPLE_MS;
        while (samples.length > 0 && samples[0]! < cutoff) samples.shift();
      }

      export function updateLandmarkCount(n: number): void { lastLandmarkCount = n; }

      export function getFPS(): number {
        if (samples.length < 2) return 0;
        const first = samples[0]!;
        const last = samples[samples.length - 1]!;
        const dt = last - first;
        return dt > 0 ? ((samples.length - 1) / dt) * 1000 : 0;
      }

      export function getLandmarkCount(): number { return lastLandmarkCount; }

      const SHOULD_EXPOSE =
        import.meta.env.DEV || import.meta.env.MODE === 'test' || import.meta.env.VITE_EXPOSE_DEV_HOOK === '1';

      if (SHOULD_EXPOSE && typeof window !== 'undefined') {
        const w = window as unknown as { __handTracker?: Record<string, unknown> };
        w.__handTracker = {
          ...(w.__handTracker ?? {}),
          getFPS,
          getLandmarkCount,
        };
      }
  - MIRROR: .claude/skills/playwright-e2e-webcam/SKILL.md §window.__handTracker (lines 142–161)
  - NAMING: camelCase function exports
  - GOTCHA: `samples[0]!` non-null assertion is safe since we check length first; biome's noNonNullAssertion may flag — use `if (samples.length === 0) return 0` guard and a local const to avoid it if needed
  - VALIDATE: pnpm biome check src/engine/devHooks.ts && pnpm tsc --noEmit

Task 3: UPDATE playwright.config.ts (tiny change)
  - FIND: `command: 'pnpm build && pnpm preview',`
  - REPLACE WITH: `command: 'pnpm build --mode test && pnpm preview',`
  - RATIONALE: sets import.meta.env.MODE to 'test' in the production bundle so devHooks registers window.__handTracker in the preview build used by E2E
  - PRESERVE: all other playwright.config.ts options
  - GOTCHA: `vite build --mode test` honors .env.test if present; none exists so nothing else changes
  - VALIDATE: pnpm build --mode test  (must exit 0)

Task 4: CREATE src/engine/renderLoop.ts
  - IMPLEMENT:
      import type { HandLandmarker } from '@mediapipe/tasks-vision';
      import type { FrameContext, Landmark } from './types';
      import { updateFpsSample, updateLandmarkCount } from './devHooks';

      export interface StartRenderLoopParams {
        video: HTMLVideoElement;
        landmarker: HandLandmarker;
        onFrame: (ctx: FrameContext) => void;
        /** 2D overlay ctx — propagated into FrameContext.ctx2d each frame (see types.ts). */
        overlayCtx2d?: CanvasRenderingContext2D | null;
        onError?: (err: unknown) => void;
      }
      export interface RenderLoopHandle { stop: () => void; }

      export function startRenderLoop(params: StartRenderLoopParams): RenderLoopHandle {
        const { video, landmarker, onFrame, overlayCtx2d = null, onError } = params;
        let rvfcId: number | undefined;
        let stopped = false;

        const tick = (nowMs: DOMHighResTimeStamp /*, _meta: VideoFrameMetadata */) => {
          if (stopped) return;
          try {
            if (video.readyState >= 2 /* HAVE_CURRENT_DATA */) {
              const result = landmarker.detectForVideo(video, nowMs);
              const landmarks: Landmark[] | null = result.landmarks[0] ?? null;
              updateFpsSample(nowMs);
              updateLandmarkCount(landmarks ? landmarks.length : 0);
              const ctx: FrameContext = {
                videoTexture: null,
                videoSize: { w: video.videoWidth, h: video.videoHeight },
                landmarks,
                ctx2d: overlayCtx2d,
                params: {},
                timeMs: nowMs,
              };
              onFrame(ctx);
            }
          } catch (err) {
            onError?.(err);
          }
          if (!stopped) rvfcId = video.requestVideoFrameCallback(tick);
        };

        rvfcId = video.requestVideoFrameCallback(tick);

        return {
          stop() {
            stopped = true;
            if (rvfcId !== undefined) {
              video.cancelVideoFrameCallback(rvfcId);
              rvfcId = undefined;
            }
          },
        };
      }
  - MIRROR: .claude/skills/mediapipe-hand-landmarker/SKILL.md §rVFC loop (lines 157–185)
  - NAMING: camelCase fn, PascalCase interfaces
  - GOTCHA: rVFC passes (now, metadata); we ignore metadata. `_meta` param prefix appeases biome noUnusedFunctionParameters — commented out here since we don't declare it; rVFC still passes it.
  - VALIDATE: pnpm biome check src/engine/renderLoop.ts && pnpm tsc --noEmit

Task 5: CREATE src/engine/renderLoop.test.ts
  - IMPLEMENT:
      import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
      import { startRenderLoop } from './renderLoop';
      import type { HandLandmarker } from '@mediapipe/tasks-vision';

      function fakeVideo() {
        const callbacks: Array<(now: number, meta: object) => void> = [];
        let nextId = 1;
        const video = {
          readyState: 4,
          videoWidth: 640,
          videoHeight: 480,
          requestVideoFrameCallback: vi.fn((cb) => { callbacks.push(cb); return nextId++; }),
          cancelVideoFrameCallback: vi.fn(),
        } as unknown as HTMLVideoElement & {
          _tick: (nowMs: number) => void;
          _cancelled: number[];
        };
        (video as unknown as { _tick: (ms: number) => void })._tick = (ms: number) => {
          const cb = callbacks.shift();
          if (cb) cb(ms, {});
        };
        return video;
      }

      function fakeLandmarker(result = { landmarks: [[{ x: 0, y: 0, z: 0 }]] }) {
        return { detectForVideo: vi.fn().mockReturnValue(result) } as unknown as HandLandmarker;
      }

      describe('startRenderLoop', () => {
        beforeEach(() => { vi.useFakeTimers(); });
        afterEach(() => { vi.useRealTimers(); });

        it('invokes onFrame each tick with monotonic timeMs', () => {
          const video = fakeVideo();
          const lm = fakeLandmarker();
          const frames: number[] = [];
          const handle = startRenderLoop({
            video, landmarker: lm, onFrame: (ctx) => frames.push(ctx.timeMs),
          });
          (video as unknown as { _tick: (ms: number) => void })._tick(100);
          (video as unknown as { _tick: (ms: number) => void })._tick(200);
          (video as unknown as { _tick: (ms: number) => void })._tick(300);
          handle.stop();
          expect(frames).toEqual([100, 200, 300]);
          expect(lm.detectForVideo).toHaveBeenCalledTimes(3);
        });

        it('stop() cancels the pending rVFC id idempotently', () => {
          const video = fakeVideo();
          const lm = fakeLandmarker();
          const handle = startRenderLoop({ video, landmarker: lm, onFrame: () => {} });
          handle.stop();
          handle.stop(); // idempotent
          expect(video.cancelVideoFrameCallback).toHaveBeenCalledTimes(1);
        });

        it('skips detectForVideo when readyState < 2', () => {
          const video = fakeVideo();
          (video as unknown as { readyState: number }).readyState = 1;
          const lm = fakeLandmarker();
          const frames: number[] = [];
          const handle = startRenderLoop({
            video, landmarker: lm, onFrame: (ctx) => frames.push(ctx.timeMs),
          });
          (video as unknown as { _tick: (ms: number) => void })._tick(100);
          expect(frames).toEqual([]);
          expect(lm.detectForVideo).not.toHaveBeenCalled();
          handle.stop();
        });

        it('routes detectForVideo errors to onError and keeps looping', () => {
          const video = fakeVideo();
          const lm = { detectForVideo: vi.fn().mockImplementation(() => { throw new Error('boom'); }) } as unknown as HandLandmarker;
          const errs: unknown[] = [];
          const handle = startRenderLoop({ video, landmarker: lm, onFrame: () => {}, onError: (e) => errs.push(e) });
          (video as unknown as { _tick: (ms: number) => void })._tick(100);
          (video as unknown as { _tick: (ms: number) => void })._tick(200);
          expect(errs).toHaveLength(2);
          handle.stop();
        });

        it('passes nowMs monotonically to detectForVideo', () => {
          const video = fakeVideo();
          const lm = fakeLandmarker();
          const handle = startRenderLoop({ video, landmarker: lm, onFrame: () => {} });
          (video as unknown as { _tick: (ms: number) => void })._tick(100);
          (video as unknown as { _tick: (ms: number) => void })._tick(200);
          expect(lm.detectForVideo).toHaveBeenNthCalledWith(1, video, 100);
          expect(lm.detectForVideo).toHaveBeenNthCalledWith(2, video, 200);
          handle.stop();
        });
      });
  - MIRROR: .claude/skills/vitest-unit-testing-patterns/SKILL.md (mock patterns)
  - NAMING: colocated .test.ts
  - GOTCHA: We don't need a real rVFC shim on HTMLVideoElement.prototype — the fake video stubs the methods directly
  - VALIDATE: pnpm vitest run src/engine/renderLoop.test.ts

Task 6: MODIFY src/App.tsx
  - FIND: the block in App that renders GRANTED state (added by Task 1.3 — the <h1> + scaffolding <p>)
  - ADD: useEffect that when state === 'GRANTED' and videoEl.current is present, awaits initHandLandmarker() and calls startRenderLoop; cleanup calls handle.stop() AND does NOT call disposeHandLandmarker (per Task 1.4 GPU freeze note); route any thrown init error via setState (for now, log; Phase 3 adds NO_WEBGL/MODEL_LOAD_FAIL transitions)
  - PRESERVE: existing render logic (ErrorStates, PrePromptCard, data-testid="camera-state")
  - GOTCHA: The video element needs to exist in the DOM for the loop to attach. This is currently not the case — Task 1.6 adds the Stage with the hidden <video>. For Task 1.5, render a hidden <video ref={videoEl} playsInline muted autoPlay style={{ display: 'none' }} /> inside the GRANTED branch. Task 1.6 replaces this with the Stage.
  - VALIDATE: pnpm biome check src/App.tsx && pnpm tsc --noEmit

Task 7: CREATE tests/e2e/renderLoop.spec.ts
  - IMPLEMENT:
      import { test, expect } from '@playwright/test';
      test.describe('Task 1.5: renderLoop', () => {
        test('window.__handTracker.getFPS() > 0 after warmup', async ({ page }) => {
          await page.goto('/');
          await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 15_000 });
          // Wait for at least one successful detect (landmark count set) — up to 60s for cold model load
          await page.waitForFunction(
            () => typeof (window as unknown as { __handTracker?: { getFPS?: () => number } }).__handTracker?.getFPS === 'function',
            undefined,
            { timeout: 60_000 }
          );
          // Sample FPS over 3s
          const fps = await page.evaluate(async () => {
            await new Promise<void>((r) => setTimeout(r, 3000));
            return (window as unknown as { __handTracker: { getFPS: () => number } }).__handTracker.getFPS();
          });
          expect(fps).toBeGreaterThan(0);
        });
      });
  - MIRROR: .claude/skills/playwright-e2e-webcam/SKILL.md §FPS assertion (lines 192–200)
  - NAMING: describe EXACTLY `Task 1.5: renderLoop`
  - GOTCHA: First model load on cold CI can be 20–35s; generous timeout on the waitForFunction
  - VALIDATE: pnpm test:e2e --grep "Task 1.5:"
```

### Integration Points

```yaml
CONSUMED_BY:
  - Phase 2 Task 2.5: onFrame becomes the effect registry dispatch
  - Phase 3 Task 3.1: FrameContext.videoTexture populated
  - Phase 4 MediaRecorder: captures from the canvas driven by this loop

EXPORTS:
  - startRenderLoop, StartRenderLoopParams, RenderLoopHandle
  - updateFpsSample, updateLandmarkCount, getFPS, getLandmarkCount (dev hook internals)

DEV_HOOK:
  - window.__handTracker in dev + test mode only
  - { getFPS, getLandmarkCount, isReady, isUsingGpu }
```

---

## Validation Loop

### Level 1 — Syntax and Style

```bash
pnpm biome check src/engine src/App.tsx tests/e2e/renderLoop.spec.ts playwright.config.ts
pnpm tsc --noEmit
```

### Level 2 — Unit Tests

```bash
pnpm vitest run src/engine
```

Expected: 5 renderLoop tests pass (onFrame called per tick, stop idempotent, readyState guard, error routing, monotonic timestamps).

### Level 3 — Integration (production build with test mode)

```bash
pnpm build --mode test
```

Expected: exits 0; `dist/assets/index-*.js` contains the dev-hook registration (MODE === 'test' is true at build time).

### Level 4 — E2E

```bash
pnpm test:setup
pnpm test:e2e --grep "Task 1.5:"
```

Expected: one test passes — `getFPS() > 0` after 3s sample. Cold runs may take up to 60s for the first landmark due to model fetch + wasm compile.

---

## Final Validation Checklist

### Technical

- [ ] L1–L4 all green
- [ ] `pnpm check` green
- [ ] Full E2E suite (Tasks 1.1, 1.2, 1.3, 1.4, 1.5) green

### Feature

- [ ] `FrameContext` matches D37 shape exactly
- [ ] `startRenderLoop` re-registers rVFC every tick
- [ ] `stop()` idempotent under double-call
- [ ] `detectForVideo` receives monotonic `nowMs`
- [ ] `window.__handTracker.getFPS()` + `getLandmarkCount()` available in dev/test builds
- [ ] `readyState < HAVE_CURRENT_DATA` branch skips detection

### Code Quality

- [ ] No `any` types (use `as unknown as` narrowings in tests only, not runtime)
- [ ] No `MediaStream` in React state
- [ ] No Date.now()
- [ ] Named exports only

---

## Anti-Patterns

- Do not use `requestAnimationFrame` — rVFC is mandatory (D18).
- Do not use `Date.now()` or `video.currentTime` for the detectForVideo timestamp.
- Do not re-register rVFC BEFORE invoking `onFrame` — order matters only for cancellation semantics; current order (invoke, then re-register if not stopped) is correct.
- Do not omit the `readyState >= 2` guard.
- Do not let detectForVideo errors kill the loop — route to `onError` and continue.
- Do not expose `window.__handTracker` in production (gate on DEV || MODE==='test').
- Do not store rAF/rVFC ids in React state — use closure variables.
- Do not forget to update `playwright.config.ts` to build with `--mode test` (otherwise the dev hook tree-shakes away and L4 fails to find `__handTracker`).

---

## No Prior Knowledge Test

- [x] `src/tracking/handLandmarker.ts` exists (Task 1.4)
- [x] `src/camera/useCamera.ts` exists (Task 1.2)
- [x] `@mediapipe/tasks-vision@0.10.34` in package.json
- [x] playwright.config.ts is writeable for the --mode test change
- [x] D17, D18, D21, D25, D37 all exist in DISCOVERY.md
- [x] Every URL is public
- [x] Implementation Tasks are dependency-ordered: types → devHooks → config → renderLoop → tests → App integration → E2E
- [x] Validation commands have no placeholders
- [x] Task is atomic — Task 1.6 will replace the inline hidden `<video>` with the Stage

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/mediapipe-hand-landmarker/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
