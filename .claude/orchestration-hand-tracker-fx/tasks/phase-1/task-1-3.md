# Task 1.3: Render 8 error-state cards + pre-prompt card

**Phase**: 1 — Foundation
**Branch**: `task/1-3-error-state-ui`
**Commit prefix**: `Task 1.3:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Render one dedicated full-screen card per `CameraState` (plus a pre-prompt explanation card for `PROMPT`) with state-specific copy, a retry affordance where applicable, reduced-motion honored, and `aria-live` updates for screen readers.

**Deliverable**: `src/ui/ErrorStates.tsx`, `src/ui/PrePromptCard.tsx`, `src/ui/errorCopy.ts`, `src/ui/ErrorStates.test.tsx`, and a minimal integration in `App.tsx` that switches the UI on the `CameraState` returned from Task 1.2's hook.

**Success Definition**: `pnpm vitest run src/ui/ErrorStates.test.tsx` exits 0 with each of the 8 states rendering its dedicated copy; `pnpm test:e2e -- --grep "Task 1.3:"` verifies the PROMPT card renders on first load under a synthetic `permissions.query='prompt'` context.

---

## User Persona

**Target User**: Creative technologist who has just denied camera access (or whose camera is busy in Zoom) and is looking at a broken-looking app.

**Use Case**: Instead of a blank page or raw DOMException, the user sees a clear card explaining what went wrong, what to do, and — where meaningful — a Retry button that re-triggers `getUserMedia`.

**User Journey**:
1. User denies camera → `USER_DENIED` card shows "Camera access blocked" + browser-specific site-settings instructions + Retry button.
2. User has Zoom open → `DEVICE_CONFLICT` card "Camera busy. Close Zoom/FaceTime and retry." + Retry.
3. User has no webcam → `NOT_FOUND` card "No camera detected. Plug one in." + Retry.
4. User is on a browser without WebGL2 → `NO_WEBGL` terminal card (no Retry).
5. On first load with `permissionStatus='prompt'` → `PrePromptCard` shows "This app needs your camera to track your hand. Video stays on your device." + "Enable Camera" button that invokes `retry()`.

**Pain Points Addressed**: Without these cards the app simply fails to render video and provides no recovery path.

---

## Why

- Required by D23 (8 full-screen state cards with dedicated copy + Retry where applicable) and D26 (reduced-motion honored).
- Consumes Task 1.2's hook (`state`, `retry`) and emits the user-visible UI for every error branch.
- Centralizes all camera error copy in one place (`errorCopy.ts`) — prevents duplication across 8 cards.
- `aria-live="polite"` + keyboard focus on primary action fulfill accessibility expectations for a creative-tool audience that may use screen readers.

---

## What

- `<ErrorStates state={state} onRetry={retry} />` — switch-driven component rendering one card per non-`GRANTED` state; returns `null` on `GRANTED`.
- `<PrePromptCard onAllow={retry} />` — shown for `PROMPT` state; contains the "Enable Camera" button.
- `errorCopy.ts` — string table keyed by `CameraState`, returning `{ title, body, retryLabel?: string }`.
- `aria-live="polite"` on the card region; keyboard focus lands on the primary button when the card appears (via `useEffect` + `ref.focus()`).
- Reduced-motion: no animation on the cards when `prefers-reduced-motion: reduce` is set (no fade-in, no pulse).
- Minimal integration in `App.tsx`: if `state !== 'GRANTED'`, render `<ErrorStates>` (or `<PrePromptCard>` for `PROMPT`); else render the scaffold heading (Task 1.6 replaces this with the Stage).

### NOT Building (scope boundary)

- Actual video/canvas rendering for `GRANTED` — Task 1.6 (Stage).
- Params panel UI — Phase 2.
- Retry logic itself — already in Task 1.2's `retry()`.
- Localization / i18n — MVP is English-only.
- Mobile layout or light theme.

### Success Criteria

- [ ] `src/ui/errorCopy.ts` exports `errorCopy: Record<CameraState, { title: string; body: string; retryLabel?: string }>`.
- [ ] `src/ui/PrePromptCard.tsx` exports `PrePromptCard({ onAllow })` component.
- [ ] `src/ui/ErrorStates.tsx` exports `ErrorStates({ state, onRetry })` component.
- [ ] `src/ui/ErrorStates.test.tsx` asserts each of the 7 non-`GRANTED` states renders the corresponding title text; `GRANTED` renders `null`.
- [ ] `aria-live="polite"` present on the card container.
- [ ] Each rendered card exposes `data-testid="error-state-card-<STATE>"` where `<STATE>` is the uppercase CameraState value. `PrePromptCard` exposes `data-testid="error-state-card-PROMPT"`. `ErrorStates` returns null for GRANTED/PROMPT — no card renders for those.
- [ ] `NO_WEBGL` card has NO retry button; all others do (except `GRANTED`/`PROMPT` which route to PrePromptCard's Allow button).
- [ ] `App.tsx` switches based on state — `GRANTED` keeps scaffold (for now), `PROMPT` shows PrePromptCard, everything else shows ErrorStates.
- [ ] `pnpm vitest run src/ui` passes.
- [ ] `pnpm test:e2e -- --grep "Task 1.3:"` passes (visibility of PrePrompt or GRANTED transition).

---

## All Needed Context

```yaml
files:
  - path: src/camera/cameraState.ts
    why: Source of `CameraState` type + `CAMERA_STATES` tuple — ErrorStates switches on this
    gotcha: MODEL_LOAD_FAIL and NO_WEBGL are defined but transitioned by later tasks; still get cards

  - path: src/camera/useCamera.ts
    why: Source of `retry` and `state`; understand the return shape
    gotcha: `retry()` is idempotent — safe to call from any button click

  - path: src/App.tsx
    why: Integration point — switch UI on state
    gotcha: Task 1.2 added a `data-testid="camera-state"` element; keep it (E2E relies on it)

  - path: src/index.css
    why: Scaffold global styles — card CSS can live alongside or in a new `ErrorStates.css` import
    gotcha: No CSS modules configured; use plain CSS imports or className conventions

  - path: tests/e2e/smoke.spec.ts
    why: Playwright spec template; describe prefix convention
    gotcha: Describe MUST be `Task 1.3: error states` for --grep

urls:
  - url: https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia
    why: `window.matchMedia('(prefers-reduced-motion: reduce)')` for D26
    critical: Must attach `change` listener and remove on cleanup

  - url: https://react.dev/reference/react/useEffect
    why: Focus management — `useEffect(() => ref.current?.focus(), [state])`
    critical: Focus MUST move only when the state changes INTO a non-GRANTED card, not on every render

  - url: https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/
    why: aria-live="polite" semantics for non-interrupting announcements
    critical: Use polite, not assertive, to avoid cutting off the user's screen reader flow

  - url: https://testing-library.com/docs/queries/about/#priority
    why: Query priority — use getByRole for buttons, getByText for title strings
    critical: Never query by className; mirror the a11y tree

skills:
  - webcam-permissions-state-machine
  - vitest-unit-testing-patterns
  - prp-task-ralph-loop
  - hand-tracker-fx-architecture

discovery:
  - D23: 8 permission states with dedicated full-screen cards + Retry where applicable
  - D26: Reduced-motion honored — no animation on cards
  - D35: Privacy communication — short "All processing happens on your device" copy in the PrePromptCard
  - D34: No analytics / telemetry — no click-tracking on retry
```

### Current Codebase Tree (relevant subset)

```
src/
  App.tsx                  # consumes useCamera, renders data-testid="camera-state"
  camera/
    cameraState.ts         # CameraState union
    useCamera.ts           # hook with state + retry
  ui/                      # EMPTY — this task creates it
  test/setup.ts
tests/
  e2e/
    smoke.spec.ts
    useCamera.spec.ts
```

### Desired Codebase Tree (this task adds)

```
src/
  ui/
    errorCopy.ts                 # string table (new)
    ErrorStates.tsx              # switch component (new)
    ErrorStates.test.tsx         # 7+ test cases (new)
    PrePromptCard.tsx            # pre-prompt explanation (new)
    cards.css                    # minimal shared card CSS (new; imported by both components)
tests/
  e2e/
    errorStates.spec.ts          # Task 1.3: PrePrompt or GRANTED visibility (new)
```

### Known Gotchas

```typescript
// CRITICAL: React StrictMode runs effects twice. Focus-on-mount with
// useEffect(() => ref.current?.focus(), [state]) will run twice in dev —
// harmless because focus() is idempotent on the same element.

// CRITICAL: Reduced motion:
//   const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
//   mq.addEventListener('change', onChange);
//   return () => mq.removeEventListener('change', onChange);
// Do not use `prefers-reduced-motion` in a naive useState(() => mq.matches)
// without also listening for runtime changes.

// CRITICAL: Biome v2 flags noUnusedVariables. MODEL_LOAD_FAIL and NO_WEBGL are
// defined but only TRANSITIONED by later tasks — reference them in the
// errorCopy table AND the ErrorStates switch so they are "used".

// CRITICAL: The NO_WEBGL card is terminal — no retry button. All other
// non-PROMPT/non-GRANTED states have a retry. The errorCopy entry for
// NO_WEBGL must have `retryLabel: undefined` (or omitted).

// CRITICAL: The <main> element's children switch based on state. Keep
// data-testid="camera-state" in the DOM for the Task 1.2 E2E to still find it.
// Render it inside both the ErrorStates wrapper and the PrePromptCard wrapper
// (or at the App level above the switch) so it is always present.

// CRITICAL: No 'use client' directive — Vite SPA, no RSC.

// CRITICAL: @testing-library/react 16 + React 19 — use render(<App />) from
// '@testing-library/react' not 'react-dom/client'. The existing
// App.test.tsx mirrors the correct pattern.
```

---

## Implementation Blueprint

### Data Models

```typescript
// src/ui/errorCopy.ts
import type { CameraState } from '../camera/cameraState';

export interface CardCopy {
  title: string;
  body: string;
  retryLabel?: string; // absent means no retry button (e.g., NO_WEBGL, GRANTED)
}

export const errorCopy: Record<CameraState, CardCopy> = {
  PROMPT: {
    title: 'Enable your camera',
    body: 'Hand Tracker FX needs your camera to track your hand. Video stays on your device — nothing is uploaded.',
    retryLabel: 'Enable Camera',
  },
  GRANTED: { title: '', body: '' }, // never rendered
  USER_DENIED: {
    title: 'Camera access blocked',
    body: 'You denied camera access. Open your browser site settings for this page, switch Camera to Allow, and click Retry.',
    retryLabel: 'Retry',
  },
  SYSTEM_DENIED: {
    title: 'Your OS or browser blocked camera access',
    body: 'A system-level setting or Permissions-Policy prevented camera access. Check System Settings > Privacy > Camera, or open this page in a browser where the camera is not restricted.',
    retryLabel: 'Retry',
  },
  DEVICE_CONFLICT: {
    title: 'Camera is busy',
    body: 'Another app is using your camera. Close Zoom, FaceTime, Google Meet, or any other tool holding the camera, then click Retry.',
    retryLabel: 'Retry',
  },
  NOT_FOUND: {
    title: 'No camera detected',
    body: 'No video input device was found. Plug in a webcam and click Retry.',
    retryLabel: 'Retry',
  },
  MODEL_LOAD_FAIL: {
    title: 'Hand tracking failed to load',
    body: 'The hand tracking model could not be loaded. Check your network connection and reload the page.',
    retryLabel: 'Retry',
  },
  NO_WEBGL: {
    title: "Your browser can't run the effect",
    body: 'WebGL2 is unavailable. Try another browser (Chrome 120+, Firefox 132+, Safari 17+) or enable hardware acceleration.',
    // no retryLabel — terminal
  },
};
```

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE src/ui/errorCopy.ts
  - IMPLEMENT: CardCopy interface + errorCopy Record<CameraState, CardCopy> as above
  - MIRROR: None — new module
  - NAMING: PascalCase type, camelCase export
  - GOTCHA: Record type enforces every CameraState has a copy entry; adding a new state without copy breaks the build
  - VALIDATE: pnpm biome check src/ui/errorCopy.ts && pnpm tsc --noEmit

Task 2: CREATE src/ui/cards.css
  - IMPLEMENT: .card { full viewport centered flex column, gap 16px, max-width 480px, text-align left, padding 32px }; .card h2 {...}; .card button {...}; @media (prefers-reduced-motion: reduce) { .card { animation: none } }
  - MIRROR: src/index.css (plain global CSS style)
  - NAMING: kebab-case class names
  - GOTCHA: No CSS modules — use global classNames `card`, `card-title`, `card-body`, `card-retry`; prefix with `card-` to avoid collisions with Tweakpane in Phase 2
  - VALIDATE: import succeeds in ErrorStates.tsx; biome does not lint CSS

Task 3: CREATE src/ui/PrePromptCard.tsx
  - IMPLEMENT:
      import { useEffect, useRef } from 'react';
      import { errorCopy } from './errorCopy';
      import './cards.css';

      export function PrePromptCard({ onAllow }: { onAllow: () => void }) {
        const btnRef = useRef<HTMLButtonElement | null>(null);
        useEffect(() => { btnRef.current?.focus(); }, []);
        const copy = errorCopy.PROMPT;
        return (
          <div
            className="card"
            role="dialog"
            aria-live="polite"
            aria-labelledby="prp-title"
            data-testid="error-state-card-PROMPT"
          >
            <h2 id="prp-title" className="card-title">{copy.title}</h2>
            <p className="card-body">{copy.body}</p>
            <button ref={btnRef} className="card-retry" type="button" onClick={onAllow}>
              {copy.retryLabel ?? 'Enable Camera'}
            </button>
          </div>
        );
      }
  - MIRROR: None (first UI component). Future components in this dir mirror THIS shape.
  - NAMING: PascalCase component, colocated CSS, default-less (named export only)
  - GOTCHA: Focus moves to the primary button on mount; in StrictMode this fires twice — harmless (focus is idempotent)
  - VALIDATE: pnpm biome check src/ui/PrePromptCard.tsx && pnpm tsc --noEmit

Task 4: CREATE src/ui/ErrorStates.tsx
  - IMPLEMENT:
      import { useEffect, useRef } from 'react';
      import type { CameraState } from '../camera/cameraState';
      import { errorCopy } from './errorCopy';
      import './cards.css';

      interface Props { state: CameraState; onRetry: () => void }

      export function ErrorStates({ state, onRetry }: Props) {
        const btnRef = useRef<HTMLButtonElement | null>(null);
        useEffect(() => { btnRef.current?.focus(); }, [state]);
        if (state === 'GRANTED' || state === 'PROMPT') return null;
        const copy = errorCopy[state];
        return (
          <div
            className="card"
            role="alert"
            aria-live="polite"
            aria-labelledby="err-title"
            data-testid={`error-state-card-${state}`}
          >
            <h2 id="err-title" className="card-title">{copy.title}</h2>
            <p className="card-body">{copy.body}</p>
            {copy.retryLabel && (
              <button ref={btnRef} className="card-retry" type="button" onClick={onRetry}>
                {copy.retryLabel}
              </button>
            )}
          </div>
        );
      }
  - MIRROR: src/ui/PrePromptCard.tsx (same shape, different switch logic)
  - NAMING: PascalCase component, Props interface inline
  - GOTCHA: Returns null for GRANTED (handled by App) AND PROMPT (handled by PrePromptCard); all other states render
  - VALIDATE: pnpm biome check src/ui/ErrorStates.tsx && pnpm tsc --noEmit

Task 5: CREATE src/ui/ErrorStates.test.tsx
  - IMPLEMENT:
      import { render, screen } from '@testing-library/react';
      import { describe, expect, it, vi } from 'vitest';
      import { ErrorStates } from './ErrorStates';
      import { CAMERA_STATES } from '../camera/cameraState';
      import { errorCopy } from './errorCopy';

      describe('ErrorStates', () => {
        it('renders null for GRANTED', () => {
          const { container } = render(<ErrorStates state="GRANTED" onRetry={() => {}} />);
          expect(container).toBeEmptyDOMElement();
        });
        it('renders null for PROMPT (PrePromptCard owns that state)', () => {
          const { container } = render(<ErrorStates state="PROMPT" onRetry={() => {}} />);
          expect(container).toBeEmptyDOMElement();
        });
        for (const state of CAMERA_STATES) {
          if (state === 'GRANTED' || state === 'PROMPT') continue;
          it(`renders ${state} card with its title`, () => {
            render(<ErrorStates state={state} onRetry={() => {}} />);
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText(errorCopy[state].title)).toBeInTheDocument();
          });
        }
        it('NO_WEBGL has no retry button (terminal)', () => {
          render(<ErrorStates state="NO_WEBGL" onRetry={() => {}} />);
          expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });
        it('USER_DENIED retry button invokes onRetry', async () => {
          const spy = vi.fn();
          render(<ErrorStates state="USER_DENIED" onRetry={spy} />);
          screen.getByRole('button', { name: /retry/i }).click();
          expect(spy).toHaveBeenCalledTimes(1);
        });
      });
  - MIRROR: src/App.test.tsx (render + screen + testing-library pattern)
  - NAMING: colocated `.test.tsx`
  - GOTCHA: Iterating CAMERA_STATES in a for loop requires excluding GRANTED + PROMPT (they render null)
  - VALIDATE: pnpm vitest run src/ui/ErrorStates.test.tsx

Task 6: MODIFY src/App.tsx
  - FIND: the body returning the <main> with the h1 + scaffolding p + camera-state p from Task 1.2
  - ADD:
      import { ErrorStates } from './ui/ErrorStates';
      import { PrePromptCard } from './ui/PrePromptCard';
      (within App component, after useCamera call)
      return (
        <main className="app-shell">
          <p data-testid="camera-state" style={{ position: 'absolute', left: -9999 }}>{state}</p>
          {state === 'PROMPT' && <PrePromptCard onAllow={retry} />}
          {state !== 'PROMPT' && state !== 'GRANTED' && <ErrorStates state={state} onRetry={retry} />}
          {state === 'GRANTED' && (
            <>
              <h1>Hand Tracker FX</h1>
              <p>Scaffolding ready. Webcam pipeline lands in Phase 1 of the implementation plan.</p>
            </>
          )}
        </main>
      );
  - PRESERVE: `data-testid="camera-state"` for Task 1.2 E2E (moved offscreen but still in DOM)
  - NAMING: keep `App` named export
  - GOTCHA: The existing App.test.tsx checks for the scaffold heading — that only renders on GRANTED; but in Vitest jsdom there is no camera and useCamera resolves to PROMPT (depending on mocking). UPDATE App.test.tsx to either mock useCamera OR assert the PrePromptCard title renders instead.
  - VALIDATE: pnpm biome check src/App.tsx && pnpm tsc --noEmit

Task 7: MODIFY src/App.test.tsx
  - FIND: existing test asserting the scaffold heading renders
  - REPLACE with a test that mocks useCamera (vi.mock) to return state='GRANTED' and asserts the scaffold heading; add a second test mocking state='PROMPT' and asserting PrePromptCard title is in the document
  - GOTCHA: vi.mock('./camera/useCamera', () => ({ useCamera: () => ({ state: 'GRANTED', videoEl: { current: null }, stream: null, devices: [], retry: () => {}, setDeviceId: () => {} }) }))
  - VALIDATE: pnpm vitest run src/App.test.tsx

Task 8: CREATE tests/e2e/errorStates.spec.ts
  - IMPLEMENT:
      import { test, expect } from '@playwright/test';
      test.describe('Task 1.3: error states', () => {
        test('reaches GRANTED under fake-device flags; card region is absent', async ({ page }) => {
          await page.goto('/');
          await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 10_000 });
          // ErrorStates render null on GRANTED; no alert role present
          await expect(page.locator('[role="alert"]')).toHaveCount(0);
        });
      });
    NOTE: A PROMPT-path E2E is hard to force in Chromium fake mode (which auto-grants). Unit tests cover PROMPT; E2E only covers the GRANTED branch + ErrorStates-null correctness.
  - MIRROR: tests/e2e/smoke.spec.ts
  - NAMING: describe EXACTLY `Task 1.3: error states`
  - VALIDATE: pnpm test:e2e -- --grep "Task 1.3:"
```

### Integration Points

```yaml
CONSUMED_BY:
  - App.tsx switches on useCamera().state; passes retry fn to both cards
  - Future Phase 3 NO_WEBGL transition (Task 3.5) sets state → ErrorStates shows terminal card
  - Future Phase 1 MODEL_LOAD_FAIL (Task 1.4) sets state → ErrorStates shows retry card

EXPORTS:
  - { ErrorStates } — consumed by App
  - { PrePromptCard } — consumed by App
  - { errorCopy, type CardCopy } — consumed by tests and potentially Phase 5 localization
```

---

## Validation Loop

### Level 1 — Syntax and Style

```bash
pnpm biome check src/ui src/App.tsx src/App.test.tsx tests/e2e/errorStates.spec.ts
pnpm tsc --noEmit
```

Expected: zero errors.

### Level 2 — Unit Tests

```bash
pnpm vitest run src/ui src/App.test.tsx
```

Expected: ErrorStates tests cover 6 error states + GRANTED+PROMPT null cases + NO_WEBGL terminal + retry click; App.test.tsx covers GRANTED branch + PROMPT branch.

### Level 3 — Integration (production build)

```bash
pnpm build
```

Expected: exits 0.

### Level 4 — E2E

```bash
pnpm test:setup
pnpm test:e2e -- --grep "Task 1.3:"
```

Expected: one test passes — state reaches GRANTED under fake device; no `[role="alert"]` element present.

---

## Final Validation Checklist

### Technical

- [ ] L1 + L2 + L3 + L4 all exit 0
- [ ] `pnpm check` green
- [ ] `pnpm test:e2e` (full suite) green — Tasks 1.1, 1.2, 1.3 all pass

### Feature

- [ ] Each of the 8 CameraState values has a `CardCopy` entry in `errorCopy.ts`
- [ ] `NO_WEBGL` card has no retry button
- [ ] `aria-live="polite"` + `role="alert"` (or `role="dialog"` for PrePrompt) present
- [ ] Focus lands on primary action button when a card mounts
- [ ] `prefers-reduced-motion: reduce` disables any card animation (CSS media query)
- [ ] `data-testid="camera-state"` still present in DOM for Task 1.2 E2E compatibility

### Code Quality

- [ ] No `any` types
- [ ] Named exports only (no default exports)
- [ ] Switch logic exhaustiveness — Record<CameraState, ...> enforces it
- [ ] No duplicated copy strings between ErrorStates and PrePromptCard — both read from errorCopy

---

## Anti-Patterns

- Do not inline copy strings in components — use `errorCopy`.
- Do not add animations that ignore `prefers-reduced-motion`.
- Do not use `role="alertdialog"` on non-modal dialogs — use `role="dialog"` or `role="alert"`.
- Do not use `autoFocus` attribute — React warns against it; use `ref.current?.focus()` in `useEffect`.
- Do not render ErrorStates AND PrePromptCard simultaneously — switch logic is exclusive.
- Do not remove `data-testid="camera-state"` — Task 1.2's E2E depends on it.
- Do not add telemetry/click-tracking on retry (D34).

---

## No Prior Knowledge Test

- [x] `src/camera/cameraState.ts` and `src/camera/useCamera.ts` exist (created by Task 1.2)
- [x] `src/App.tsx` exists and consumes useCamera (created/amended by Task 1.2)
- [x] `tests/e2e/smoke.spec.ts` exists as MIRROR for the new E2E
- [x] D23, D26, D34, D35 all exist in DISCOVERY.md
- [x] Every URL cited is public
- [x] Implementation Tasks are dependency-ordered: copy → CSS → PrePromptCard → ErrorStates → tests → App → App.test → E2E
- [x] Validation commands have no placeholders
- [x] Task is atomic — does not depend on 1.4/1.5/1.6

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/webcam-permissions-state-machine/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
