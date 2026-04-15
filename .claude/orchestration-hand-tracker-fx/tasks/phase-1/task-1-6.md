# Task 1.6: Stage — video mount + mirror-aware stacked canvases

**Phase**: 1 — Foundation
**Branch**: `task/1-6-stage-mirror-canvas`
**Commit prefix**: `Task 1.6:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Compose the visible stage — a hidden `<video>` element feeding the WebGL texture, and two stacked canvases (WebGL bottom, 2D top) covering the full viewport, with CSS `scaleX(-1)` applied to the display canvases (never the `<video>`) so landmark coordinates remain unmirrored per D27.

**Deliverable**: `src/ui/Stage.tsx`, `src/ui/Stage.css`, `src/ui/Stage.test.tsx`, and an integration in `App.tsx` that renders `<Stage>` in the `GRANTED` branch and passes refs up to the render loop wiring added in Task 1.5.

**Success Definition**: `pnpm vitest run src/ui/Stage.test.tsx` passes; `pnpm test:e2e -- --grep "Task 1.6:"` verifies both canvases are present, the video is ARIA-hidden, and the mirror transform toggles correctly.

---

## User Persona

**Target User**: End user viewing the app with the camera granted — expects a mirrored self-view (like a mirror or Zoom) covering the full viewport, with overlay graphics (grid + blobs in Phase 2; mosaic in Phase 3) drawn on top.

**Use Case**: User is on a 1920×1080 monitor; the Stage fills the entire viewport; their video feed is mirrored for intuitive "raise your right hand to move the cursor right" mapping, while MediaPipe still receives the unmirrored frames so landmark coordinate math stays simple.

**User Journey**:
1. State reaches GRANTED.
2. `<Stage>` mounts — hidden offscreen `<video>` gets `srcObject` from `useCamera`'s stream.
3. Two canvases (WebGL + 2D) are stacked absolute-positioned at 100vw × 100vh.
4. When `params.input.mirror === true` (default true), display canvases get `transform: scaleX(-1)`.
5. Task 1.5's render loop runs; Phase 2 grid + blobs render to the 2D canvas; Phase 3 mosaic renders to the WebGL canvas.

**Pain Points Addressed**: Without this component, there is no stable DOM target for the render loop to attach to; without CSS mirroring (vs. pixel mirroring), MediaPipe would see mirrored frames and every landmark x would need a `1 - x` correction that's easy to forget.

---

## Why

- Required by D10 (mirror mode ON by default), D27 (CSS mirror only on display, never on inference pixels), D18 (stacked canvas compositing).
- Provides the DOM target for Task 1.5's rVFC loop to drive.
- `preserveDrawingBuffer: true` on the WebGL context is mandatory for Phase 4's `canvas.captureStream()` — set here.
- The 2D overlay canvas is the target for Phase 2's grid + dotted-blob renderers.

---

## What

- `<Stage>` component: one `<video>`, one `<canvas data-testid="webgl-canvas">`, one `<canvas data-testid="overlay-canvas">`.
- `<video>` is position: absolute, 1×1 px, opacity 0 (kept in-DOM for rVFC to attach to, not visually rendered).
- `<video>` attributes: `playsInline muted autoPlay aria-hidden="true"`; `srcObject` set via `useEffect` from a passed-in `MediaStream`.
- Both canvases position: absolute, inset 0, 100vw × 100vh; z-index layered (WebGL = 0, overlay = 1).
- Mirror transform: applied to a wrapper `<div className="stage">` so both canvases inherit; toggled via a `data-mirror="true|false"` attribute.
- Canvas DPR scaling: on mount + window resize, set `canvas.width = clientWidth * devicePixelRatio`, `canvas.height = clientHeight * devicePixelRatio`, keep CSS size at 100%.
- `preserveDrawingBuffer: true` on WebGL context getter — exposed via a ref callback so the Phase 3 renderer consumes an already-prepared context.
- Refs for video/webgl/overlay canvases are lifted to parent (via `ref` props or `useImperativeHandle`) so Task 1.5's `startRenderLoop` can consume them.

### NOT Building (scope boundary)

- OGL renderer setup — Phase 3 Task 3.1.
- Any drawing on the canvases — Phase 2 (overlay) / Phase 3 (WebGL).
- Params panel / Tweakpane — Phase 2.
- Mirror toggle UI — Phase 2 params panel; for Phase 1 mirror is hardcoded ON via prop.
- Responsive breakpoints below 1024px — out of scope (desktop-only).

### Success Criteria

- [ ] `src/ui/Stage.tsx` exports `<Stage>` component accepting `{ stream: MediaStream | null, mirror?: boolean }` + a ref API exposing `{ videoEl, webglCanvas, overlayCanvas }`.
- [ ] `<video>` is ARIA-hidden, has `playsInline muted autoPlay`, and receives `srcObject` via effect.
- [ ] Both canvases are full-viewport (position fixed, inset 0); DPR scaling applied on mount + on resize.
- [ ] `data-mirror="true"` sets `transform: scaleX(-1)` on the canvas wrapper; `data-mirror="false"` removes it.
- [ ] App.tsx renders `<Stage stream={streamRef.current} mirror />` in the GRANTED branch and wires refs through to Task 1.5's `startRenderLoop` (replacing the inline hidden `<video>` from Task 1.5).
- [ ] Unit test verifies DOM structure (video + 2 canvases), ARIA attributes, mirror transform toggle.
- [ ] E2E asserts both `data-testid="webgl-canvas"` and `data-testid="overlay-canvas"` are visible and have non-zero size.
- [ ] The `<div className="stage">` wrapper carries TWO test-ids: `data-testid="stage"` AND `data-testid="render-canvas"` (alias — used by Task 2.R + Task 5.4 to target the composited display). Both IDs resolve to the same element.

---

## All Needed Context

```yaml
files:
  - path: src/camera/useCamera.ts
    why: Source of stream (streamRef.current via return.stream) — Stage consumes it
    gotcha: stream may be null before GRANTED; Stage handles null gracefully (no srcObject assignment)

  - path: src/engine/renderLoop.ts
    why: Consumer — startRenderLoop requires a live <video> element with readyState >= 2
    gotcha: After setting srcObject, the video element emits 'loadedmetadata' + 'canplay'; don't start the loop until video.videoWidth > 0

  - path: src/App.tsx
    why: Integration point — replaces the inline hidden <video> from Task 1.5 with <Stage> and the three refs
    gotcha: Task 1.5 added a useEffect that starts the render loop; that effect must now consume Stage's refs

  - path: src/ui/PrePromptCard.tsx
    why: Sibling component; z-index planning — Stage is below cards (z-index 0) so a card can overlay on PROMPT/error states
    gotcha: When state !== GRANTED, Stage is NOT rendered (saves GPU); on transition to GRANTED it mounts fresh

  - path: src/index.css
    why: Scaffold global CSS (body margin, html height)
    gotcha: body { margin: 0 } is already set; Stage assumes it

urls:
  - url: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video
    why: playsInline, muted, autoPlay attributes — required on iOS Safari for offscreen video
    critical: `muted` MUST be set for autoPlay to work without user gesture; audio is off anyway per D22

  - url: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/srcObject
    why: Assigning a MediaStream via .srcObject (not .src); React doesn't have a `srcObject` prop — use useEffect
    critical: srcObject must be assigned in an effect, not JSX attribute

  - url: https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
    why: Canvas backing-store DPR scaling: canvas.width = clientWidth * dpr
    critical: Only multiply the backing-store dimensions; CSS size stays 100%. Otherwise the canvas scales blurry on Retina displays.

  - url: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
    why: getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false })
    critical: preserveDrawingBuffer is REQUIRED for Phase 4 MediaRecorder captureStream to produce non-blank frames

skills:
  - webcam-permissions-state-machine
  - hand-tracker-fx-architecture
  - vitest-unit-testing-patterns
  - prp-task-ralph-loop

discovery:
  - D10: Mirror mode default ON
  - D18: Rendering stack — ogl WebGL bottom + Canvas 2D top + rVFC loop
  - D27: Webcam source truth — raw <video> unmirrored; CSS scaleX(-1) only on display canvases
  - D22: audio: false on getUserMedia; video element is muted accordingly
```

### Current Codebase Tree (relevant subset)

```
src/
  App.tsx              # renders PrePromptCard / ErrorStates / (Task 1.5 inline <video>)
  camera/
    useCamera.ts
  engine/
    renderLoop.ts
    types.ts
    devHooks.ts
  tracking/
    handLandmarker.ts
    errors.ts
  ui/
    PrePromptCard.tsx
    ErrorStates.tsx
    errorCopy.ts
    cards.css
```

### Desired Codebase Tree (this task adds)

```
src/
  ui/
    Stage.tsx               # video + 2 canvases + mirror wrapper (new)
    Stage.css               # full-viewport layout (new)
    Stage.test.tsx          # structure + mirror + ARIA (new)
tests/
  e2e/
    stage.spec.ts           # Task 1.6: canvases visible + mirror + ARIA (new)
```

### Known Gotchas

```typescript
// CRITICAL: The <video> element is the UNMIRRORED source of pixels.
// Never apply transform: scaleX(-1) to it. Mirror is CSS on the canvas
// wrapper only. Landmark coordinates stay in unmirrored space (D27).

// CRITICAL: srcObject cannot be a React JSX attribute. Use useEffect:
//   useEffect(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, [stream]);

// CRITICAL: iOS Safari requires playsInline AND muted for offscreen <video>
// to autoplay without fullscreen takeover. Both are set as JSX attributes.

// CRITICAL: autoPlay (React prop, camelCase) — not autoplay. React warns on
// lowercase.

// CRITICAL: Canvas DPR scaling — set backing-store dims on mount + window
// resize. Failing to do this produces blurry output on Retina displays.
// The WebGL context needs gl.viewport(0, 0, width, height) after each resize
// — that's Phase 3's job; here we just size the canvas elements correctly.

// CRITICAL: preserveDrawingBuffer: true is required for Phase 4's
// canvas.captureStream → MediaRecorder path to produce non-blank frames.
// Set it in this task so Phase 3 inherits it.

// CRITICAL: React 19 ref-forwarding — useImperativeHandle works, but a
// cleaner pattern for a multi-ref API is to pass callback refs or return
// { videoRef, webglRef, overlayRef } from a render-prop. For this task:
// forwardRef + useImperativeHandle exposing { videoEl, webglCanvas,
// overlayCanvas } keeps the parent API tight.

// CRITICAL: StrictMode double-invokes the srcObject effect. That is fine —
// assigning the same stream twice is a no-op at the browser level.

// CRITICAL: When state !== GRANTED, do NOT render <Stage>. It prevents
// GPU/camera churn during error states. App.tsx switches on state.

// CRITICAL: jsdom doesn't fully implement <canvas> WebGL context.
// Stage.test.tsx MUST test DOM structure only — never call getContext('webgl2').
```

---

## Implementation Blueprint

### Data Models

```typescript
// src/ui/Stage.tsx
export interface StageHandle {
  videoEl: HTMLVideoElement | null;
  webglCanvas: HTMLCanvasElement | null;
  overlayCanvas: HTMLCanvasElement | null;
}

export interface StageProps {
  stream: MediaStream | null;
  mirror?: boolean;
  /**
   * Invoked inside Stage's srcObject effect AFTER `video.play()` resolves (or
   * rejects via the muted-autoplay fallback). App.tsx uses this to own the
   * render-loop lifecycle — renderer ownership does NOT live inside Stage.tsx.
   * See `.claude/skills/hand-tracker-fx-architecture/SKILL.md` §"Stage.tsx
   * evolution" for the final shape after Phase 3 modifications.
   */
  onVideoReady?: (videoEl: HTMLVideoElement) => void;
}
```

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE src/ui/Stage.css
  - IMPLEMENT:
      .stage { position: fixed; inset: 0; width: 100vw; height: 100vh; overflow: hidden; background: #000; }
      .stage[data-mirror="true"] .stage-canvas { transform: scaleX(-1); transform-origin: center; }
      .stage-video { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
      .stage-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
      .stage-webgl { z-index: 0; }
      .stage-overlay { z-index: 1; pointer-events: none; }
  - NAMING: kebab-case classes, stage- prefix
  - GOTCHA: transform must apply to the canvases, not the wrapper itself (otherwise the video's hidden pixel also mirrors, irrelevant but messy)
  - VALIDATE: import succeeds from Stage.tsx

Task 2: CREATE src/ui/Stage.tsx
  - IMPLEMENT:
      import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
      import './Stage.css';

      export interface StageHandle {
        videoEl: HTMLVideoElement | null;
        webglCanvas: HTMLCanvasElement | null;
        overlayCanvas: HTMLCanvasElement | null;
      }
      export interface StageProps {
        stream: MediaStream | null;
        mirror?: boolean;
        onVideoReady?: (videoEl: HTMLVideoElement) => void;
      }

      export const Stage = forwardRef<StageHandle, StageProps>(function Stage(
        { stream, mirror = true, onVideoReady }, ref,
      ) {
        const videoRef = useRef<HTMLVideoElement | null>(null);
        const webglRef = useRef<HTMLCanvasElement | null>(null);
        const overlayRef = useRef<HTMLCanvasElement | null>(null);

        useImperativeHandle(ref, () => ({
          videoEl: videoRef.current,
          webglCanvas: webglRef.current,
          overlayCanvas: overlayRef.current,
        }), []);

        // Assign srcObject when stream changes
        useEffect(() => {
          const v = videoRef.current;
          if (v && stream) {
            v.srcObject = stream;
            void v.play()
              .then(() => { onVideoReady?.(v); })
              .catch(() => {
                // muted autoplay path — videoEl still becomes usable once metadata loads
                onVideoReady?.(v);
              });
          }
          return () => {
            if (v) v.srcObject = null;
          };
        }, [stream, onVideoReady]);

        // DPR-aware canvas sizing
        useEffect(() => {
          const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            for (const c of [webglRef.current, overlayRef.current]) {
              if (!c) continue;
              const r = c.getBoundingClientRect();
              c.width = Math.max(1, Math.floor(r.width * dpr));
              c.height = Math.max(1, Math.floor(r.height * dpr));
            }
          };
          resize();
          window.addEventListener('resize', resize);
          return () => window.removeEventListener('resize', resize);
        }, []);

        return (
          // The wrapper carries the PRIMARY `data-testid="stage"`. Because
          // `data-testid` must be unique per element (Playwright's `getByTestId`
          // matches the last value), we expose the `render-canvas` alias as a
          // sibling attribute combination — the easiest cross-compatible pattern:
          // emit the `data-testid` whose value matches BOTH via a list-of-values
          // query `[data-testid~="stage"][data-testid~="render-canvas"]` is NOT
          // standard. Instead, the idiomatic fix is:
          //   (a) keep the primary `data-testid="stage"` on the wrapper
          //   (b) Playwright locator `[data-testid="render-canvas"]` is ALSO
          //       satisfied by setting that attribute on the SAME element via
          //       React's known quirk: the LAST occurrence wins, so we can't
          //       set two. Real solution: use `getByTestId("stage")` internally
          //       and let downstream selectors query `[data-testid="render-canvas"]`
          //       against a PROXY attribute. Downstream tests (Task 2.R, Task 5.4)
          //       use `page.locator('[data-testid="render-canvas"]')`, so the
          //       attribute MUST literally appear in the DOM under that name.
          //
          // Concrete implementation: the wrapper carries `data-testid="stage"` AND
          // a second attribute via a spread object literal — NO, that still only
          // produces one `data-testid`. So we instead emit a ZERO-SIZE sibling
          // stub element with `data-testid="render-canvas"` that lives inside the
          // stage's bounding box. Playwright's `toBeVisible()` on a 0-size node
          // rejects; make the stub `position: absolute; inset: 0; pointer-events: none`
          // so it occupies the full stage frame and is thus "visible" the same
          // way `.stage` is visible.
          <div
            className="stage"
            data-mirror={mirror ? 'true' : 'false'}
            data-testid="stage"
          >
            {/* render-canvas alias — zero-cost overlay covering the stage.
                Used by Task 2.R and Task 5.4 via `[data-testid="render-canvas"]`. */}
            <div
              data-testid="render-canvas"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              aria-hidden="true"
            />
            <video
              ref={videoRef}
              className="stage-video"
              playsInline
              muted
              autoPlay
              aria-hidden="true"
              data-testid="stage-video"
            />
            <canvas
              ref={webglRef}
              className="stage-canvas stage-webgl"
              data-testid="webgl-canvas"
            />
            <canvas
              ref={overlayRef}
              className="stage-canvas stage-overlay"
              data-testid="overlay-canvas"
            />
          </div>
        );
      });
  - MIRROR: src/ui/PrePromptCard.tsx (functional component + forwardRef pattern adapted)
  - NAMING: PascalCase component, camelCase refs, StageHandle type
  - GOTCHA: React 19's forwardRef is still supported though the plain-function ref prop pattern exists; use forwardRef here for backward-compat and clearer imperative handle
  - VALIDATE: pnpm biome check src/ui/Stage.tsx src/ui/Stage.css && pnpm tsc --noEmit

Task 3: CREATE src/ui/Stage.test.tsx
  - IMPLEMENT:
      import { render, screen } from '@testing-library/react';
      import { describe, expect, it } from 'vitest';
      import { createRef } from 'react';
      import { Stage, type StageHandle } from './Stage';

      describe('Stage', () => {
        it('renders a hidden video and two canvases', () => {
          render(<Stage stream={null} />);
          const video = screen.getByTestId('stage-video') as HTMLVideoElement;
          expect(video).toBeInTheDocument();
          expect(video.getAttribute('aria-hidden')).toBe('true');
          expect(video.getAttribute('playsInline')).not.toBeNull();
          expect(video.muted).toBe(true);
          expect(screen.getByTestId('webgl-canvas')).toBeInTheDocument();
          expect(screen.getByTestId('overlay-canvas')).toBeInTheDocument();
        });

        it('exposes refs via imperative handle', () => {
          const ref = createRef<StageHandle>();
          render(<Stage stream={null} ref={ref} />);
          expect(ref.current?.videoEl).toBeInstanceOf(HTMLVideoElement);
          expect(ref.current?.webglCanvas).toBeInstanceOf(HTMLCanvasElement);
          expect(ref.current?.overlayCanvas).toBeInstanceOf(HTMLCanvasElement);
        });

        it('sets data-mirror="true" by default', () => {
          render(<Stage stream={null} />);
          expect(screen.getByTestId('stage').getAttribute('data-mirror')).toBe('true');
        });

        it('sets data-mirror="false" when mirror={false}', () => {
          render(<Stage stream={null} mirror={false} />);
          expect(screen.getByTestId('stage').getAttribute('data-mirror')).toBe('false');
        });

        it('assigns srcObject when a stream is provided', () => {
          const fake = { getTracks: () => [] } as unknown as MediaStream;
          render(<Stage stream={fake} />);
          const video = screen.getByTestId('stage-video') as HTMLVideoElement;
          expect(video.srcObject).toBe(fake);
        });
      });
  - MIRROR: src/ui/ErrorStates.test.tsx + src/App.test.tsx
  - NAMING: colocated .test.tsx
  - GOTCHA: jsdom assigns srcObject but doesn't actually play; `video.play()` rejection is swallowed in Stage. Tests DON'T need to await play.
  - VALIDATE: pnpm vitest run src/ui/Stage.test.tsx

Task 4: MODIFY src/App.tsx
  - FIND: the GRANTED branch from Task 1.5 (the inline hidden <video> + scaffold <h1> + <p> + useEffect that starts the render loop)
  - REPLACE: inline hidden <video> with `<Stage ref={stageRef} stream={streamRef.current} mirror onVideoReady={(el) => setVideoEl(el)} />`; remove the scaffold <h1>/<p> in favor of letting the canvases fill the viewport; keep the offscreen `<p data-testid="camera-state">`
  - NEW STATE: `const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);` — the render-loop useEffect keys on this state. App.tsx owns the render-loop lifecycle; Stage.tsx only exposes the video element via `onVideoReady`.
  - NEW REF: `const stageRef = useRef<StageHandle | null>(null);`
  - PRESERVE: ErrorStates / PrePromptCard / camera-state testid handling
  - GOTCHA: `streamRef.current` is the stream from useCamera (the hook returns `stream: streamRef.current`); pass it directly as the `stream` prop. If null, Stage renders without srcObject assignment.
  - GOTCHA: The render-loop useEffect depends on `videoEl` state (populated by Stage's `onVideoReady` callback AFTER `video.play()` resolves). This avoids a ref-polling race and works cleanly under StrictMode (double-mount invokes the callback twice; the cleanup in the effect handles it).
  - GOTCHA: When `params.input.mirror === true`, App.tsx reads the 2D overlay canvas ctx and passes it to `startRenderLoop` via the `overlayCtx2d` parameter (Task 1.5 updated to accept this) so Phase 2's effect render() has a populated `FrameContext.ctx2d`.
  - VALIDATE: pnpm biome check src/App.tsx && pnpm tsc --noEmit && pnpm vitest run src/App.test.tsx

Task 5: CREATE tests/e2e/stage.spec.ts
  - IMPLEMENT:
      import { test, expect } from '@playwright/test';
      test.describe('Task 1.6: Stage', () => {
        test('renders video + two canvases with mirror on GRANTED', async ({ page }) => {
          await page.goto('/');
          await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 15_000 });
          const stage = page.getByTestId('stage');
          await expect(stage).toBeVisible();
          await expect(stage).toHaveAttribute('data-mirror', 'true');
          // Canvases must be present and non-zero-sized
          const webgl = page.getByTestId('webgl-canvas');
          const overlay = page.getByTestId('overlay-canvas');
          await expect(webgl).toBeAttached();
          await expect(overlay).toBeAttached();
          const webglSize = await webgl.evaluate((el: HTMLCanvasElement) => ({ w: el.width, h: el.height }));
          expect(webglSize.w).toBeGreaterThan(0);
          expect(webglSize.h).toBeGreaterThan(0);
          // Video is ARIA-hidden and has a MediaStream attached
          const video = page.getByTestId('stage-video');
          await expect(video).toHaveAttribute('aria-hidden', 'true');
          const hasStream = await video.evaluate((el: HTMLVideoElement) => el.srcObject !== null);
          expect(hasStream).toBe(true);
        });
      });
  - MIRROR: tests/e2e/renderLoop.spec.ts (Task 1.5)
  - NAMING: describe EXACTLY `Task 1.6: Stage`
  - GOTCHA: `toBeVisible()` on the stage works because the wrapper has non-zero size; canvases inherit `display: block` + full size
  - VALIDATE: pnpm test:e2e -- --grep "Task 1.6:"
```

### Integration Points

```yaml
CONSUMED_BY:
  - Task 1.5 renderLoop: uses stageRef.current.videoEl as the rVFC target
  - Phase 3 Task 3.1: uses stageRef.current.webglCanvas for OGL Renderer initialization
  - Phase 2 Task 2.3/2.4: uses stageRef.current.overlayCanvas for 2D grid + blob rendering
  - Phase 4 RecordButton: uses the composited top canvas (overlay) for captureStream

EXPORTS:
  - Stage (default-less named export)
  - StageHandle, StageProps types
```

---

## Validation Loop

### Level 1 — Syntax and Style

```bash
pnpm biome check src/ui/Stage.tsx src/ui/Stage.css src/ui/Stage.test.tsx src/App.tsx tests/e2e/stage.spec.ts
pnpm tsc --noEmit
```

### Level 2 — Unit Tests

```bash
pnpm vitest run src/ui/Stage.test.tsx src/App.test.tsx
```

Expected: 5 Stage tests + updated App tests pass.

### Level 3 — Integration (production build)

```bash
pnpm build --mode test
```

Expected: exits 0; `dist/assets/index-*.css` contains the `.stage` rules.

### Level 4 — E2E

```bash
pnpm test:setup
pnpm test:e2e -- --grep "Task 1.6:"
```

Expected: one test passes — stage visible, canvases non-zero, video ARIA-hidden, srcObject attached.

---

## Final Validation Checklist

### Technical

- [ ] L1–L4 green
- [ ] `pnpm check` green
- [ ] Full E2E suite (1.1–1.6) green

### Feature

- [ ] `<video>` has `aria-hidden="true"`, `playsInline`, `muted`, `autoPlay`
- [ ] `data-mirror` toggles between `"true"` and `"false"`
- [ ] DPR scaling applied to both canvases
- [ ] Offscreen camera-state testid preserved
- [ ] `preserveDrawingBuffer` verification is DEFERRED to Task 3.1 (Stage does not create the WebGL context here; the anticipatory note lives in the "Why" section only)

### Code Quality

- [ ] No `any` types
- [ ] No React state for MediaStream (passed via prop)
- [ ] Refs via `useImperativeHandle` — clean parent API
- [ ] `srcObject` assigned in effect, not JSX

---

## Anti-Patterns

- Do not apply `transform: scaleX(-1)` to the `<video>` element.
- Do not assign `srcObject` via JSX (`<video srcObject={...}>` — it's silently ignored).
- Do not scale the canvas CSS dimensions — only backing-store via `.width`/`.height`.
- Do not omit `playsInline` / `muted` — iOS breaks otherwise.
- Do not render Stage on error/prompt states — it's GRANTED-only (saves GPU/memory).
- Do not remove `data-testid="camera-state"` — upstream E2Es depend on it.
- Do not forget to release the ResizeObserver / resize listener on unmount.

---

## No Prior Knowledge Test

- [x] `src/camera/useCamera.ts`, `src/engine/renderLoop.ts`, `src/ui/PrePromptCard.tsx` all exist
- [x] D10, D18, D22, D27 all exist in DISCOVERY.md
- [x] Every URL is public
- [x] Implementation Tasks are dependency-ordered: CSS → component → tests → App integration → E2E
- [x] Validation commands have no placeholders
- [x] Task is atomic — no Phase 2/3 code required

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/webcam-permissions-state-machine/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
