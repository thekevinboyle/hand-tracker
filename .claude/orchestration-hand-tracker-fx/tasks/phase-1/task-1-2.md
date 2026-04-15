# Task 1.2: Implement useCamera 8-state permission hook

**Phase**: 1 — Foundation
**Branch**: `task/1-2-usecamera-state-machine`
**Commit prefix**: `Task 1.2:`
**Estimated complexity**: High
**Max Ralph iterations**: 30

---

## Goal

**Feature Goal**: Implement `useCamera` — a React 19 hook managing the entire `getUserMedia` permission + stream lifecycle as a deterministic 8-state machine, plus a pure error-mapping function and a shared camera-state enum module.

**Deliverable**: `src/camera/useCamera.ts`, `src/camera/cameraState.ts`, `src/camera/mapError.ts`, and `src/camera/useCamera.test.ts` covering PROMPT, GRANTED, USER_DENIED, SYSTEM_DENIED, DEVICE_CONFLICT, NOT_FOUND, and OverconstrainedError relaxed-retry.

**Success Definition**: `pnpm vitest run src/camera` exits 0 with all state transitions covered; `pnpm tsc --noEmit` + `pnpm biome check src/camera` exit 0; `pnpm test:e2e -- --grep "Task 1.2:"` shows PROMPT → GRANTED via Chromium's fake-device stream.

---

## User Persona

**Target User**: Creative technologist landing on Hand Tracker FX for the first time in Chrome 120+ on macOS.

**Use Case**: User opens the app, sees a pre-prompt explanation (Task 1.3 UI), clicks "Enable Camera", grants or denies, and the app routes to the correct state — live video when granted, a state-specific error card otherwise.

**User Journey**:
1. User opens preview URL; hook mounts in `PROMPT` state (no `getUserMedia` call yet).
2. User clicks "Enable Camera" in the pre-prompt card (Task 1.3).
3. `retry()` is invoked → hook calls `navigator.mediaDevices.getUserMedia` with D22 constraints.
4a. Success → `GRANTED`; stream ref populated; `videoEl.srcObject` attached.
4b. `NotAllowedError` + `permissionStatus.state === 'denied'` → `USER_DENIED`.
4c. `NotAllowedError` + other → `SYSTEM_DENIED`.
4d. `NotReadableError` → `DEVICE_CONFLICT`.
4e. `NotFoundError` → `NOT_FOUND`.
4f. `OverconstrainedError` → auto-retry once with `{ video: true, audio: false }`.
5. On unmount, `track.stop()` is called; idempotent under StrictMode double-mount.
6. On `devicechange` or `permissionStatus` change, state transitions live.

**Pain Points Addressed**: Without this hook, the app would crash with raw `DOMException` messages on denial, providing no recovery path. Raw `getUserMedia` calls on mount (a common mistake) skip the pre-prompt card and violate D23.

---

## Why

- Required by D22 (getUserMedia constraints shape), D23 (8 permission states with dedicated UI), D24 (device persistence), D25 (StrictMode-safe cleanup), D27 (unmirrored source of truth for landmarks).
- Unlocks Task 1.3 (error-state UI consumes `state`), Task 1.4 (HandLandmarker needs the stream attached to a `<video>`), Task 1.5 (render loop consumes `videoEl`).
- The 8-state machine is the single chokepoint for ALL camera-related error copy and retry affordances — consolidating it here prevents duplication across the 8 error cards.

---

## What

- Hook returns `{ state: CameraState, videoEl: RefObject<HTMLVideoElement>, stream: MediaStream | null, devices: MediaDeviceInfo[], retry(), setDeviceId(id) }`.
- `CameraState` union: `'PROMPT' | 'GRANTED' | 'USER_DENIED' | 'SYSTEM_DENIED' | 'DEVICE_CONFLICT' | 'NOT_FOUND' | 'MODEL_LOAD_FAIL' | 'NO_WEBGL'`.
- `getUserMedia()` is NEVER called on mount — only from `retry()` or when `permissionStatus.state === 'granted'` at load (auto-resume).
- `OverconstrainedError` triggers one relaxed retry (`{ video: true, audio: false }`) before mapping to a state.
- `track.stop()` called in cleanup on every stream track; double-open guarded via `openingRef`.
- `permissionStatus.onchange` and `devicechange` listeners attached on mount, removed in cleanup.
- `deviceId` persisted to `localStorage` under `hand-tracker-fx:cameraDeviceId`; re-validated against live devices on load.
- Safari Permissions-API fallback: try/catch around `navigator.permissions.query({ name: 'camera' })`; on throw, fall through to `PROMPT`.
- Landmarks coordinate space is ALWAYS unmirrored (D27) — this hook does NOT apply any mirror transform.

### NOT Building (scope boundary)

- `ErrorStates.tsx` / `PrePromptCard.tsx` UI components — Task 1.3.
- `deviceSelect.ts` dropdown UI — Task 2.x / Phase 4.
- `MODEL_LOAD_FAIL` and `NO_WEBGL` transitions — Tasks 1.4 and 3.5 respectively (states are defined here but transitioned externally).
- Reduced-motion behavior — Tasks 4.x.
- Recording / `MediaRecorder` — Phase 4.
- Mobile layout, light theme, audio.

### Success Criteria

- [ ] `src/camera/cameraState.ts` exports `CameraState` type + `CAMERA_STATES` tuple constant.
- [ ] `src/camera/mapError.ts` exports `mapGetUserMediaError(err, permState) => CameraState` — pure, no side effects.
- [ ] `src/camera/useCamera.ts` exports `useCamera()` hook matching the return shape in "What".
- [ ] `src/camera/useCamera.test.ts` covers: initial PROMPT, retry happy path → GRANTED, NotAllowed (denied perms) → USER_DENIED, NotAllowed (prompt perms) → SYSTEM_DENIED, NotReadable → DEVICE_CONFLICT, NotFound → NOT_FOUND, OverconstrainedError → relaxed retry → GRANTED, cleanup calls track.stop().
- [ ] `pnpm vitest run src/camera` — 8+ tests pass.
- [ ] `pnpm test:e2e -- --grep "Task 1.2:"` — PROMPT→GRANTED transition observed via Chromium fake device.

---

## All Needed Context

```yaml
files:
  - path: src/App.tsx
    why: Will consume the hook in a minimal way during L4 (add a `data-testid="camera-state"` element for the E2E to read); keep scaffold behavior intact
    gotcha: Do NOT render error-state UI here — Task 1.3 owns that; just expose the raw state string for E2E introspection

  - path: src/main.tsx
    why: React StrictMode is enabled — every useEffect in useCamera must be idempotent
    gotcha: Do NOT remove StrictMode; this is the canary that catches double-open bugs in dev

  - path: src/test/setup.ts
    why: Global Vitest setup — loads `@testing-library/jest-dom/vitest` and `vitest-canvas-mock`
    gotcha: jsdom does NOT implement navigator.mediaDevices — the test file must vi.stubGlobal it

  - path: playwright.config.ts
    why: Already sets `permissions: ['camera']` + `--use-fake-device-for-media-stream` so `getUserMedia` auto-succeeds in E2E
    gotcha: The fake device bypasses the prompt — PROMPT state is skipped if permissionStatus returns 'granted' on load; E2E asserts GRANTED after a retry click

  - path: tests/e2e/smoke.spec.ts
    why: Template for the L4 spec structure — describe block prefixed `Task 1.N: <feature>`
    gotcha: The describe must be EXACTLY `Task 1.2: useCamera` so `--grep "Task 1.2:"` matches

urls:
  - url: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    why: DOMException names: NotAllowedError, NotFoundError, NotReadableError, OverconstrainedError, AbortError, SecurityError, TypeError
    critical: NotAllowedError covers BOTH user denial AND Permissions-Policy block — distinguish via navigator.permissions.query

  - url: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/permissions
    why: permissions.query({ name: 'camera' }) returns PermissionStatus with .state and .addEventListener('change')
    critical: Firefox < 135 and Safari throw on `{ name: 'camera' }` — always try/catch

  - url: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/devicechange_event
    why: Fires when cameras are plugged/unplugged; trigger re-enumerateDevices + re-validate active deviceId
    critical: Must removeEventListener in cleanup; fires even when no stream is active

  - url: https://vitest.dev/api/vi.html#vi-stubglobal
    why: vi.stubGlobal('navigator', {...}) lets tests mock mediaDevices + permissions without touching the real global
    critical: Must vi.unstubAllGlobals() in afterEach or mocks leak between tests

  - url: https://testing-library.com/docs/react-testing-library/api/#renderhook
    why: renderHook + act + waitFor for async state transitions
    critical: Wrap state-triggering calls in `act()`; await `waitFor(() => expect(...).toBe(...))` for async transitions

skills:
  - webcam-permissions-state-machine
  - vitest-unit-testing-patterns
  - prp-task-ralph-loop
  - hand-tracker-fx-architecture

discovery:
  - D22: getUserMedia constraints — { video: { width: {ideal:640}, height: {ideal:480}, frameRate: {ideal:30, min:15} }, audio: false }
  - D23: 8 permission states — PROMPT, GRANTED, USER_DENIED, SYSTEM_DENIED, DEVICE_CONFLICT, NOT_FOUND, MODEL_LOAD_FAIL, NO_WEBGL
  - D24: Device selection — enumerateDevices() after first grant, deviceId → localStorage, re-validated on load
  - D25: Cleanup — track.stop() on unmount, StrictMode-safe cancellation of rVFC/rAF registrations
  - D27: Webcam source truth — raw <video> unmirrored; CSS scaleX(-1) applied only to display canvases
```

### Current Codebase Tree (relevant subset)

```
src/
  App.tsx                   # scaffold heading (will be minimally amended in L4)
  App.test.tsx
  main.tsx                  # StrictMode wrapper
  test/setup.ts             # Vitest globals
  camera/                   # EMPTY — this task creates it
tests/
  e2e/
    smoke.spec.ts           # Task 1.1 template
```

### Desired Codebase Tree (this task adds)

```
src/
  camera/
    cameraState.ts          # CameraState union + CAMERA_STATES tuple (new)
    mapError.ts             # pure error → state function (new)
    useCamera.ts            # the hook (new)
    useCamera.test.ts       # 8+ test cases (new)
tests/
  e2e/
    useCamera.spec.ts       # Task 1.2 PROMPT→GRANTED fake-device flow (new)
```

### Known Gotchas

```typescript
// CRITICAL: React StrictMode runs useEffect twice in dev.
// Use an `openingRef` to guard concurrent getUserMedia calls and a `mountedRef`
// to drop late-resolving streams from a torn-down effect.

// CRITICAL: Never store MediaStream in React state — use a ref.
// Storing in state triggers re-render + cleanup + restart loop.

// CRITICAL: getUserMedia() must NOT be called on mount.
// Initial state is PROMPT unless permissions.query returns 'granted'.
// Only a user-triggered retry() (or the auto-resume on 'granted' load) calls gUM.

// CRITICAL: Safari + Firefox<135 throw on permissions.query({ name: 'camera' }).
// Always wrap in try/catch and fall through to PROMPT.

// CRITICAL: NotAllowedError from gUM can mean USER denial OR system/OS policy block.
// Distinguish via permissions.query result (denied → USER_DENIED, otherwise SYSTEM_DENIED).

// CRITICAL: OverconstrainedError is NOT mapped to a state — it triggers a single
// relaxed retry with { video: true, audio: false }. Only after the retry fails
// does it fall through to the mapper (where it becomes SYSTEM_DENIED via default).

// CRITICAL: jsdom does not implement navigator.mediaDevices. Tests MUST use
// vi.stubGlobal('navigator', { mediaDevices: {...}, permissions: {...} }).
// Call vi.unstubAllGlobals() in afterEach.

// CRITICAL: MediaPipe detectForVideo timestamps aren't relevant here but the
// project-wide rule is monotonic perf.now(), never Date.now().

// CRITICAL: Biome v2 enforces `noExplicitAny` as an error. Use DOMException
// narrowing + `unknown` / `err instanceof DOMException` instead.

// CRITICAL: pnpm + Biome only. No eslint/prettier/npm.

// CRITICAL: Landmarks coordinate space is UNMIRRORED (D27).
// CSS scaleX(-1) on display canvases is done in Task 1.6, not here.

// CRITICAL: React 19 RefObject — `useRef<HTMLVideoElement>(null)` is fine;
// the return type is RefObject<HTMLVideoElement | null> in React 19.
// The hook's return shape uses the React 19 nullable RefObject exactly.
```

---

## Implementation Blueprint

### Data Models

```typescript
// src/camera/cameraState.ts
export const CAMERA_STATES = [
  'PROMPT',
  'GRANTED',
  'USER_DENIED',
  'SYSTEM_DENIED',
  'DEVICE_CONFLICT',
  'NOT_FOUND',
  'MODEL_LOAD_FAIL',  // transitioned by Task 1.4
  'NO_WEBGL',         // transitioned by Task 3.5
] as const;

export type CameraState = typeof CAMERA_STATES[number];

// src/camera/useCamera.ts
export interface UseCameraResult {
  state: CameraState;
  videoEl: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  devices: MediaDeviceInfo[];
  retry: () => void;
  setDeviceId: (id: string) => void;
}
```

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE src/camera/cameraState.ts
  - IMPLEMENT: CAMERA_STATES as `readonly [...]` tuple; CameraState = typeof CAMERA_STATES[number]
  - MIRROR: None (new module). Use plain-TS module pattern — named exports only, no default export.
  - NAMING: PascalCase type, SCREAMING_SNAKE tuple const
  - GOTCHA: Use `as const` so the tuple is not widened to `string[]`
  - VALIDATE: pnpm biome check src/camera/cameraState.ts && pnpm tsc --noEmit

Task 2: CREATE src/camera/mapError.ts
  - IMPLEMENT:
      import type { CameraState } from './cameraState';
      export function mapGetUserMediaError(
        err: unknown,
        permissionState: PermissionState | 'unknown'
      ): CameraState {
        if (!(err instanceof DOMException)) return 'SYSTEM_DENIED';
        switch (err.name) {
          case 'NotAllowedError':
            return permissionState === 'denied' ? 'USER_DENIED' : 'SYSTEM_DENIED';
          case 'NotFoundError':
          case 'DevicesNotFoundError':
            return 'NOT_FOUND';
          case 'NotReadableError':
          case 'TrackStartError':
            return 'DEVICE_CONFLICT';
          default:
            return 'SYSTEM_DENIED';
        }
      }
  - MIRROR: Matches webcam-permissions-state-machine skill §"Error → State Mapping"
  - NAMING: camelCase function
  - GOTCHA: OverconstrainedError is NOT handled here — the hook retries before invoking this mapper
  - VALIDATE: pnpm biome check src/camera/mapError.ts && pnpm tsc --noEmit

Task 3: CREATE src/camera/useCamera.ts
  - IMPLEMENT: Full hook per skill §"useCamera Hook Skeleton" — see webcam-permissions-state-machine SKILL.md lines 207–354. Key points:
      - URL-param short-circuit (test-surface hook, consumed by Phase 2/3/4/5 E2Es):
          When `(import.meta.env.DEV || import.meta.env.MODE === 'test')` AND the current URL has
          `?forceState=<STATE>` where `<STATE>` is a valid CameraState, skip `getUserMedia` entirely
          and set state directly to `<STATE>` on mount. Parse via
          `new URLSearchParams(window.location.search).get('forceState')` and validate against
          `CAMERA_STATES` (guard against arbitrary string injection).
          PRODUCTION builds MUST NOT honor this param — the gate is strict on DEV || MODE==='test'.
          This is a prerequisite for Phase 5 Task 5.4's 8-error-state E2E suite (do NOT defer).
      - Constants: LS_KEY = 'hand-tracker-fx:cameraDeviceId'
      - buildConstraints(deviceId?: string): MediaStreamConstraints — video always ideal, audio:false
      - useState<CameraState>('PROMPT'), useState<MediaDeviceInfo[]>([]), useState<string|undefined>(() => localStorage...)
      - useRef: videoEl (RefObject<HTMLVideoElement|null>), streamRef, openingRef, mountedRef, permStatusRef
      - closeStream(): stops all tracks, nulls streamRef
      - startCapture(): opens gUM with D22 constraints; on OverconstrainedError retry once with {video:true, audio:false}; on success → set state GRANTED, attach srcObject, enumerateDevices; attach 'ended' listener for unplug
      - retry(): closeStream → state=PROMPT → startCapture
      - setDeviceId(id): persist to LS, close, restart
      - useEffect (mount): query permissions in try/catch; if 'granted' auto-startCapture; attach permissionStatus.change + devicechange listeners; cleanup removes them and closes stream
  - MIRROR: .claude/skills/webcam-permissions-state-machine/SKILL.md §useCamera Hook Skeleton (lines 205–354)
  - NAMING: useCamera (camelCase hook), UseCameraResult (PascalCase type)
  - GOTCHA: streamRef is the source of truth — `stream: streamRef.current` is returned; any consumer reading it will see the latest ref value on every render
  - VALIDATE: pnpm biome check src/camera/useCamera.ts && pnpm tsc --noEmit

Task 4: CREATE src/camera/useCamera.test.ts
  - IMPLEMENT: Vitest suite using @testing-library/react renderHook + act + waitFor. Test cases:
      1. "initial state is PROMPT when permissions.query returns 'prompt'"
      2. "auto-starts capture when permissions.query returns 'granted' on mount"
      3. "retry() transitions to GRANTED on happy path"
      4. "NotAllowedError + permissions denied → USER_DENIED"
      5. "NotAllowedError + permissions prompt → SYSTEM_DENIED"
      6. "NotReadableError → DEVICE_CONFLICT"
      7. "NotFoundError → NOT_FOUND"
      8. "OverconstrainedError triggers relaxed retry, then GRANTED; gUM called twice with different constraints"
      9. "cleanup calls track.stop() on all tracks"
      10. "StrictMode-like double-mount does NOT call gUM twice" — simulate by invoking renderHook twice with same mocks

      Shared mock helpers:
        function mockStream(): MediaStream { /* fake tracks with stop() spy */ }
        function mockNavigator(overrides?: Partial<...>): void { vi.stubGlobal('navigator', { mediaDevices: {...}, permissions: {...} }) }

      afterEach(() => vi.unstubAllGlobals())
  - MIRROR: webcam-permissions-state-machine §Testing (lines 407–484)
  - NAMING: useCamera.test.ts colocation
  - GOTCHA: fake MediaStream must have .getTracks() AND .getVideoTracks(); the 'ended' listener attach uses getVideoTracks()[0].addEventListener — include an addEventListener spy on the fake track
  - VALIDATE: pnpm vitest run src/camera/useCamera.test.ts

Task 5: MODIFY src/App.tsx
  - FIND: `export function App() {`
  - ADD: import useCamera from '../camera/useCamera' (adjust relative path); call `const { state } = useCamera();`; render `<p data-testid="camera-state">{state}</p>` inside <main> after the existing <p>. KEEP the existing heading + scaffolding paragraph.
  - PRESERVE: existing <h1> and scaffolding <p>
  - NAMING: keep existing named export `App`
  - GOTCHA: This is a minimal integration for the E2E test. Do NOT add retry UI or error cards — Task 1.3 owns that.
  - VALIDATE: pnpm biome check src/App.tsx && pnpm tsc --noEmit && pnpm vitest run src/App.test.tsx (scaffold heading test must still pass — it does, since we only add, not replace)

Task 6: CREATE tests/e2e/useCamera.spec.ts
  - IMPLEMENT:
      import { test, expect } from '@playwright/test';

      test.describe('Task 1.2: useCamera', () => {
        test('reaches GRANTED with Chromium fake device after auto-prompt grant', async ({ page }) => {
          await page.goto('/');
          // permissions: ['camera'] + --use-fake-device-for-media-stream already set in config;
          // the hook should either auto-grant (if permissions.query returns 'granted')
          // or remain PROMPT until a user gesture. In Chromium fake mode, the browser
          // emulates an already-granted permission, so permissions.query resolves 'granted'
          // and the hook auto-starts capture.
          const stateEl = page.getByTestId('camera-state');
          await expect(stateEl).toBeVisible();
          await expect(stateEl).toHaveText(/GRANTED|PROMPT/);
          // If still PROMPT, the hook never auto-resumed — force retry via window.__camera
          // (not exposed in this task, so we only assert GRANTED eventually).
          await expect(stateEl).toHaveText('GRANTED', { timeout: 10_000 });
        });
      });
  - MIRROR: tests/e2e/smoke.spec.ts (Task 1.1)
  - NAMING: describe EXACTLY `Task 1.2: useCamera`
  - GOTCHA: The Chromium fake-device flag auto-grants without showing the UI prompt; permissionStatus.state === 'granted' on load, so the hook's useEffect auto-calls startCapture
  - VALIDATE: pnpm test:e2e -- --grep "Task 1.2:"
```

### Integration Points

```yaml
CONSUMED_BY:
  - src/App.tsx (Task 5 above): const { state } = useCamera(); renders data-testid="camera-state"
  - src/ui/ErrorStates.tsx (Task 1.3): receives state; renders matching card
  - src/tracking/handLandmarker.ts (Task 1.4): consumes videoEl (must be attached to a stream)
  - src/engine/renderLoop.ts (Task 1.5): consumes videoEl for rVFC

EXPORTS:
  - `useCamera` — default import target: `import { useCamera } from './camera/useCamera'`
  - `CameraState`, `CAMERA_STATES` — `import { type CameraState } from './camera/cameraState'`
  - `mapGetUserMediaError` — consumed by useCamera only; could be internal but exported for tests
```

---

## Validation Loop

### Level 1 — Syntax and Style

```bash
pnpm biome check src/camera src/App.tsx tests/e2e/useCamera.spec.ts
pnpm tsc --noEmit
```

Expected: zero errors.

### Level 2 — Unit Tests

```bash
pnpm vitest run src/camera
```

Expected: all 9–10 test cases pass. Fixing requires reading full output — a `NotAllowedError` being mapped to `SYSTEM_DENIED` when the test expected `USER_DENIED` means the test's mock `permissions.query` resolution is wrong, not the mapper.

### Level 3 — Integration (production build)

```bash
pnpm build
```

Expected: exits 0. The hook is tree-shaken if unused, but `App.tsx` now imports it — the module graph must resolve.

### Level 4 — E2E

```bash
pnpm test:setup        # ensure tests/assets/fake-hand.y4m exists
pnpm test:e2e -- --grep "Task 1.2:"
```

Expected: one test passes; `data-testid="camera-state"` transitions to `GRANTED` within 10s under the fake-device flag.

---

## Final Validation Checklist

### Technical

- [ ] L1 zero errors across `src/camera`, `src/App.tsx`, `tests/e2e/useCamera.spec.ts`
- [ ] L2 — all camera test cases pass (`pnpm vitest run src/camera`)
- [ ] L3 — `pnpm build` exits 0
- [ ] L4 — `pnpm test:e2e -- --grep "Task 1.2:"` passes
- [ ] Full `pnpm check` + full `pnpm test:e2e` green

### Feature

- [ ] All 8 `CameraState` values are defined in `cameraState.ts`
- [ ] `getUserMedia()` is NOT called on mount unless permissions.query returns `'granted'`
- [ ] OverconstrainedError triggers one relaxed retry before state mapping
- [ ] `track.stop()` is called in cleanup — `vi.spyOn` test verifies
- [ ] Safari `permissions.query` throw fallthrough lands in PROMPT (test covers)
- [ ] StrictMode double-mount does not leak a stream — tested via openingRef guard

### Code Quality

- [ ] No `any` types — `unknown` + narrowing
- [ ] `MediaStream` stored in ref, not state
- [ ] Named exports only; no default exports
- [ ] Hook file mirrors skill skeleton exactly (deviations documented in progress log)

---

## Anti-Patterns

- Do not call `getUserMedia()` inside `useEffect` on mount unless permissions.query resolved `'granted'`.
- Do not store `MediaStream` in `useState` — stale closure restarts the stream on re-render.
- Do not assume `navigator.permissions` exists — always try/catch (Safari/older Firefox).
- Do not use `any` for `DOMException` — narrow via `err instanceof DOMException`.
- Do not leave `devicechange` / `permissionStatus.change` listeners attached after unmount.
- Do not map `OverconstrainedError` to a state — retry with `{ video: true, audio: false }` first.
- Do not mirror pixels on the inference path — D27 mandates unmirrored source truth.
- Do not use `exact` for width/height/frameRate (D22 says `ideal` only; `deviceId` is the sole `exact` allowed).
- Do not use `// @ts-expect-error` — fix the type.
- Do not skip `vi.unstubAllGlobals()` in afterEach — mocks leak between tests.

---

## No Prior Knowledge Test

- [x] `src/App.tsx`, `src/main.tsx`, `src/test/setup.ts`, `playwright.config.ts`, `tests/e2e/smoke.spec.ts` all exist
- [x] D22, D23, D24, D25, D27 all exist in DISCOVERY.md
- [x] Every URL cited is public and stable
- [x] Implementation Tasks are dependency-ordered: enum → mapper → hook → tests → App integration → E2E
- [x] Validation commands have no placeholders
- [x] MIRROR source (webcam-permissions-state-machine skill §useCamera Hook Skeleton) exists at `.claude/skills/webcam-permissions-state-machine/SKILL.md`
- [x] Task is atomic — does not depend on 1.3/1.4/1.5 outputs

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/webcam-permissions-state-machine/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
