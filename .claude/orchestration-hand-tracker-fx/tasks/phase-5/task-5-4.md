# Task 5.4: Force-drive Playwright E2E coverage for all 8 D23 error states

**Phase**: 5 — Deploy + Comprehensive E2E
**Branch**: `task/5-4-error-states-e2e`
**Commit prefix**: `Task 5.4:`
**Estimated complexity**: High
**Max Ralph iterations**: 30

---

## Goal

**Feature Goal** — Provide one Playwright spec per D23 state card, with each spec forcing the app into that state via a deterministic mechanism (URL param, route hijack, launch-flag project, or permission-API call) and asserting the matching error card is visible with its expected `data-testid`.

**Deliverable** — `tests/e2e/error-states.spec.ts` containing 8 describe blocks under the shared prefix `Task 5.4:`, plus any Playwright project definitions in `playwright.config.ts` needed for launch-flag-level scenarios (e.g., `--disable-webgl`).

**Success Definition** — `pnpm test:e2e --grep "Task 5.4:"` runs all 8 state specs; each passes. No state card is skipped by `test.skip` or `test.fixme`. `PLAYWRIGHT_BASE_URL` override honored where possible (some states are forced via launch flags and cannot run against a remote URL — see table below — those skip with `test.skip(condition, …)` and the Progress Log documents the limitation).

---

## User Persona

**Target User** — Release manager auditing that every error path renders correctly before `v0.1.0`.

**Use Case** — Smoke-test every recoverable and terminal error surface without relying on a real broken camera / OS permission denial.

**User Journey**:

1. Developer opens the PR for 5.4.
2. CI runs the error-state suite; all 8 green.
3. Failure on any state card → upload Playwright HAR + video → debug.
4. Merge → CHANGELOG lists "all 8 D23 states covered by forced-failure E2E."

**Pain Points Addressed** — Silent regressions in error UI that only surface when real users hit the error; cost of manually reproducing each error scenario on a dev machine.

---

## Why

- D23: eight distinct state cards (PROMPT, GRANTED, USER_DENIED, SYSTEM_DENIED, DEVICE_CONFLICT, NOT_FOUND, MODEL_LOAD_FAIL, NO_WEBGL) — every one must be covered.
- D41: 4-level validation is the contract; Level 4 is the only level that catches UI regressions.
- D42: These specs run against Vercel preview on every deploy via `e2e-preview.yml` (Task 5.3).
- Unblocks Phase 5's final checklist: "all 8 error states covered with forced-failure tests" (PHASES.md §Phase 5).

---

## What

User-visible behavior: none (tests only).

Technical requirements:

- Single spec file `tests/e2e/error-states.spec.ts`.
- One `test.describe('Task 5.4: <STATE_NAME>', …)` per state.
- Each describe contains exactly one test case with a clearly named scenario.
- Forcing mechanism per state is **exact** — defined in the table below and reproduced in each `test.beforeEach` or test body.
- Every spec asserts:
  - The matching error card is visible by `[data-testid="error-state-card-<STATE>"]`.
  - No other error card is visible.
  - Where applicable: the retry button has correct text, `aria-live="polite"` on the card region, keyboard focus lands on primary action.
- Playwright projects (separate Chromium instances with different launch flags) used where a single test context cannot toggle the required flag.

### NOT Building (scope boundary)

- Re-implementation of `ErrorStates.tsx` — already exists from Task 1.3.
- New `data-testid` attributes on error cards — added in Task 1.3; if missing, FILE A BUG and pause.
- Visual regression snapshots per state — Task 5.5 covers visual fidelity for the happy path only.
- Fuzz-testing MediaStream APIs — out of scope; D23 mapping is unit-tested in Task 1.2.
- Real-device testing — Playwright fake device only.

### Success Criteria

- [ ] 8 describes under `Task 5.4:` prefix
- [ ] All 8 pass locally (`pnpm test:e2e --grep "Task 5.4:"`)
- [ ] All 8 pass in CI `ci.yml`
- [ ] SYSTEM_DENIED and DEVICE_CONFLICT limitations documented (Chromium fake-device cannot reproduce) — fall back to asserting the state reducer unit test (from Task 1.2) covers them + a shallow E2E that force-sets URL param to transition into the state via a test-only hook, if architecturally permitted. See per-state section below.
- [ ] No `test.skip` or `test.fixme` outside of the two documented limitations
- [ ] `data-testid` assertions use the exact format `error-state-card-<STATE>` (uppercase state)

---

## All Needed Context

```yaml
files:
  - path: src/ui/ErrorStates.tsx
    why: Asserts render the data-testids this spec queries. MIRROR the exact data-testid string per state.
    gotcha: If the attribute is not present, this task blocks on a hotfix to Task 1.3. Do not inline-fix here.

  - path: src/camera/useCamera.ts
    why: State machine source; defines the transitions this task forces. The `?forceState=<STATE>` URL-param short-circuit is a PREREQUISITE introduced in Task 1.2 (not a modification here). If missing on the branch, STOP and hotfix 1.2 before executing this task.
    gotcha: Do NOT add `?forceState=` support in this task — it belongs in Task 1.2 so Phase 2/3/4 E2Es can also consume it. This task only depends on the hook existing.

  - path: tests/e2e/smoke.spec.ts
    why: Existing describe naming pattern (Task 1.1:), global setup, permission grants. Mirror the imports.
    gotcha: Uses the default Chromium project — error-states spec will use additional named projects for NO_WEBGL.

  - path: playwright.config.ts
    why: Where new projects are registered. Add named projects for the two launch-flag scenarios.
    gotcha: Adding projects without a `grep` filter causes every project to run every test → slow, wasteful. Use `testMatch` to constrain projects to their dedicated specs.

  - path: .claude/skills/playwright-e2e-webcam/SKILL.md
    why: §"The 8 D23 error states — how to force each" (lines 221-236) is the authoritative forcing table.
    gotcha: The skill allows SYSTEM_DENIED / DEVICE_CONFLICT to be covered by unit tests of the reducer; this task nevertheless adds a shallow E2E that uses a URL param to force the state for card-rendering assertion.

  - path: .claude/skills/webcam-permissions-state-machine/SKILL.md
    why: Error → state mapping. Any new state transition must route through mapGetUserMediaError / mapTrackerInitError.
    gotcha: Do not add ad-hoc state setters in components — always go through the mapper.

urls:
  - url: https://playwright.dev/docs/network#abort-requests
    why: `page.route('**/pattern', r => r.abort())` pattern for MODEL_LOAD_FAIL.
    critical: Route registration MUST happen BEFORE `page.goto(…)`. Otherwise the first request slips through before routing attaches.

  - url: https://playwright.dev/docs/api/class-browsercontext#browser-context-clear-permissions
    why: `context.clearPermissions()` for USER_DENIED.
    critical: Combined with overriding the context's `permissions` option to `[]` at creation.

  - url: https://playwright.dev/docs/test-projects
    why: Project pattern for NO_WEBGL (separate launch flags).
    critical: Projects inherit `use.launchOptions.args` — DISABLE_WEBGL requires a dedicated project so the default project keeps WebGL enabled.

skills:
  - prp-task-ralph-loop
  - hand-tracker-fx-architecture
  - playwright-e2e-webcam
  - webcam-permissions-state-machine
  - mediapipe-hand-landmarker

discovery:
  - D23: Eight states. Each has a dedicated full-screen card. This task tests every one.
  - D22: gUM constraints (ideal only). USER_DENIED and SYSTEM_DENIED use the same gUM call path.
  - D21: Chromium-only; Ubuntu CI; fake device. NO real hardware tests.
  - D41: Level-4 validation is the only level that catches UI regressions.
```

### Current Codebase Tree

```
tests/
└── e2e/
    └── smoke.spec.ts
playwright.config.ts
src/
├── camera/useCamera.ts
└── ui/ErrorStates.tsx
```

### Desired Codebase Tree

```
tests/
└── e2e/
    ├── smoke.spec.ts
    └── error-states.spec.ts       NEW — 8 describes
playwright.config.ts                MODIFIED — add `no-webgl` project
```

### Known Gotchas

```typescript
// CRITICAL: page.route() MUST be called BEFORE page.goto().
// If registration is after navigation, the first request is not intercepted.
// For MODEL_LOAD_FAIL this matters — register the route immediately after context creation.

// CRITICAL: --disable-webgl on Chromium removes getContext('webgl'/'webgl2').
// The app's NO_WEBGL detection runs at MediaPipe init; test must wait for that
// pipeline to attempt initialization.

// CRITICAL: Clearing permissions via context.clearPermissions() does NOT
// dismiss the native prompt — it just clears the grant state. To simulate
// USER_DENIED we also drop `--use-fake-ui-for-media-stream` for that project
// OR use a URL param `?forceState=USER_DENIED` that shortcuts state machine.

// CRITICAL: SYSTEM_DENIED and DEVICE_CONFLICT cannot be reproduced with a
// fake device in Chromium. Use `?forceState=SYSTEM_DENIED` / `?forceState=DEVICE_CONFLICT`
// URL params that useCamera honors (dev + test only — guarded by
// import.meta.env.MODE === 'test' OR import.meta.env.DEV).

// CRITICAL: A stale service worker from Task 5.1 can cache model 404s.
// Force-bypass with `await context.addInitScript(() => { if ('serviceWorker' in navigator)
// navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())); });`
// BEFORE navigation.

// CRITICAL: data-testid strings must match ErrorStates.tsx exactly.
// Pattern: `error-state-card-<STATE>` where STATE is uppercase as defined in cameraState.ts.

// CRITICAL: Deny the temptation to `test.skip` SYSTEM_DENIED / DEVICE_CONFLICT
// without a URL-param fallback. Every state card must have an E2E that proves
// it renders when the state is reached.
```

---

## Implementation Blueprint

### Per-state forcing mechanism

| # | State | Forcing mechanism | Project | Notes |
|---|---|---|---|---|
| 1 | `PROMPT` | `?forceState=PROMPT` URL param (PINNED — consistent with SYSTEM_DENIED / DEVICE_CONFLICT). The dropped-fake-UI-project alternative is OUT OF SCOPE. | default | Uses `?forceState=PROMPT`; assert `[data-testid="error-state-card-PROMPT"]` visible. |
| 2 | `GRANTED` | Default path with all three fake flags + `permissions: ['camera']`. Already covered by Task 1.1 smoke. This task includes a tiny duplicate assertion under `Task 5.4: GRANTED` describe to keep the 8-state table complete. | default | N/A |
| 3 | `USER_DENIED` | `?forceState=USER_DENIED` URL param. Alt path: `await context.clearPermissions(); await context.grantPermissions([], { origin: baseURL });` before navigation. | default | Primary: URL param. Secondary assertion: retry button visible. |
| 4 | `SYSTEM_DENIED` | `?forceState=SYSTEM_DENIED` URL param (fake-device cannot reproduce the OS-level block). | default | Document limitation in spec header comment. |
| 5 | `DEVICE_CONFLICT` | `?forceState=DEVICE_CONFLICT` URL param (NotReadableError cannot be triggered with fake device). | default | Same limitation. |
| 6 | `NOT_FOUND` | Launch flag: `--use-file-for-fake-video-capture=/tmp/does-not-exist.y4m`. OR `?forceState=NOT_FOUND` URL param. | `chromium-no-camera` | Prefer the launch flag — it exercises the real rejection path. |
| 7 | `MODEL_LOAD_FAIL` | `await page.route('**/models/hand_landmarker.task', r => r.abort('failed'))` BEFORE `page.goto(…)`. Also unregister any SW in `addInitScript`. | default | SW must be bypassed — see Known Gotchas. |
| 8 | `NO_WEBGL` | Project-level `launchOptions.args: ['--disable-webgl', '--disable-webgl2', '--use-gl=swiftshader-webgl' false]`. Dedicated `chromium-no-webgl` project. | `chromium-no-webgl` | Assert the NO_WEBGL card. This is a terminal state (no retry). |

### Implementation Tasks

```yaml
Task 1: VERIFY `?forceState=` prerequisite from Task 1.2 (no code changes here)
  - VERIFY: `src/camera/useCamera.ts` already honors `?forceState=<STATE>` URL param when `(import.meta.env.DEV || import.meta.env.MODE === 'test')` — introduced in Task 1.2's implementation blueprint.
  - IF MISSING: STOP and hotfix Task 1.2 (this task does not modify useCamera.ts).
  - VALIDATE: `pnpm vitest run src/camera/useCamera` passes; the URL-param branch unit test is present.

Task 2: MODIFY playwright.config.ts — add projects
  - IMPLEMENT: Add two named projects — `chromium-no-camera` and `chromium-no-webgl`. Each uses its own `use.launchOptions.args`. Do NOT add a `chromium-no-ui-fake` project — PROMPT is forced via `?forceState=PROMPT` URL param (see Task 3 below).
  - MIRROR: Existing `projects: [{ name: 'chromium', use: … }]` in config.
  - NAMING: Project names exactly as above.
  - GOTCHA: Playwright's `test.use({ ...devices['Desktop Chrome'] })` inside a file overrides the project — prefer project-scoped definitions and `test.describe.configure({ project: 'chromium-no-webgl' })` if your Playwright version supports it. Otherwise split into multiple spec files (one per launch-flag project).
  - VALIDATE: `pnpm exec playwright test --list` enumerates every test under the right project.

Task 3: CREATE tests/e2e/error-states.spec.ts
  - IMPLEMENT: 8 describes, one test per describe, each with the forcing mechanism table-above.
  - MIRROR: tests/e2e/smoke.spec.ts header/imports/naming.
  - NAMING: `Task 5.4: <STATE_NAME> error card renders`
  - GOTCHA: Per-case cleanup resets SW unregistration + permission state to avoid bleed across tests.
  - VALIDATE: `pnpm test:e2e --grep "Task 5.4:"` — all 8 green.

Task 4: Document limitations
  - IMPLEMENT: Add a top-of-file comment listing SYSTEM_DENIED and DEVICE_CONFLICT as URL-param-forced due to Chromium limitations, plus a pointer to the unit tests that cover the reducer path.
  - NAMING: N/A
  - VALIDATE: Comment present; CR-review ready.
```

### error-states.spec.ts skeleton (per-state body)

```ts
// tests/e2e/error-states.spec.ts
//
// Task 5.4 — D23 state coverage.
// Notes:
//   SYSTEM_DENIED and DEVICE_CONFLICT are unreachable with Chromium's fake-device
//   pipeline. They are forced via ?forceState=<STATE> URL params honored by
//   useCamera when MODE === 'test' or DEV. The reducer path itself is
//   unit-tested in src/camera/useCamera.test.ts (Task 1.2).
//
//   NO_WEBGL and NOT_FOUND use dedicated Playwright projects because their
//   forcing mechanism is launch-flag-level.

import { test, expect, type Page } from '@playwright/test';

async function unregisterSW(page: Page) {
  await page.addInitScript(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((rs) => rs.forEach((r) => r.unregister()));
    }
  });
}

test.describe('Task 5.4: PROMPT state card', () => {
  test('pre-prompt card renders when permissionState is prompt', async ({ page }) => {
    await page.goto('/?forceState=PROMPT');
    await expect(page.locator('[data-testid="error-state-card-PROMPT"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-state-card-GRANTED"]')).not.toBeVisible();
  });
});

test.describe('Task 5.4: GRANTED state', () => {
  test('no error card visible on default happy path', async ({ page }) => {
    // GRANTED: ErrorStates returns null AND PrePromptCard is not rendered.
    // The prefix selector `[data-testid^="error-state-card-"]` therefore matches
    // NO visible element. This is the single canonical happy-path assertion —
    // it does NOT query a specific card id (there is none for GRANTED).
    await page.goto('/');
    await expect(page.locator('[data-testid="render-canvas"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid^="error-state-card-"]')).not.toBeVisible();
  });
});

test.describe('Task 5.4: USER_DENIED state card', () => {
  test('renders with retry button when user denies permission', async ({ page }) => {
    await page.goto('/?forceState=USER_DENIED');
    const card = page.locator('[data-testid="error-state-card-USER_DENIED"]');
    await expect(card).toBeVisible();
    await expect(card.getByRole('button', { name: /retry/i })).toBeVisible();
  });
});

test.describe('Task 5.4: SYSTEM_DENIED state card', () => {
  test('renders with OS-block copy', async ({ page }) => {
    await page.goto('/?forceState=SYSTEM_DENIED');
    const card = page.locator('[data-testid="error-state-card-SYSTEM_DENIED"]');
    await expect(card).toBeVisible();
    await expect(card).toContainText(/blocked|OS|policy/i);
  });
});

test.describe('Task 5.4: DEVICE_CONFLICT state card', () => {
  test('renders when camera is in use elsewhere', async ({ page }) => {
    await page.goto('/?forceState=DEVICE_CONFLICT');
    const card = page.locator('[data-testid="error-state-card-DEVICE_CONFLICT"]');
    await expect(card).toBeVisible();
    await expect(card).toContainText(/use|Zoom|FaceTime/i);
  });
});

test.describe('Task 5.4: NOT_FOUND state card', () => {
  // Uses chromium-no-camera project with a non-existent Y4M path
  test.describe.configure({ project: 'chromium-no-camera' });
  test('renders when no camera device is found', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-testid="error-state-card-NOT_FOUND"]');
    await expect(card).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('Task 5.4: MODEL_LOAD_FAIL state card', () => {
  test('renders when model fetch fails', async ({ page, context }) => {
    await unregisterSW(page);
    // Abort model fetch for both document-origin and relative requests
    await context.route('**/models/hand_landmarker.task', (route) => route.abort('failed'));
    await page.goto('/');
    const card = page.locator('[data-testid="error-state-card-MODEL_LOAD_FAIL"]');
    await expect(card).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('Task 5.4: NO_WEBGL state card', () => {
  // Uses chromium-no-webgl project (launchOptions.args: ['--disable-webgl','--disable-webgl2'])
  test.describe.configure({ project: 'chromium-no-webgl' });
  test('renders terminal no-webgl card', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-testid="error-state-card-NO_WEBGL"]');
    await expect(card).toBeVisible({ timeout: 30_000 });
    // NO_WEBGL is terminal — no retry button
    await expect(card.getByRole('button', { name: /retry/i })).toHaveCount(0);
  });
});
```

### Integration Points

```yaml
playwright.config.ts:
  - Add projects array entries:
      { name: 'chromium', use: { ...devices['Desktop Chrome'], permissions: ['camera'], launchOptions: { args: [...three fake flags] } } }
      { name: 'chromium-no-camera', use: { ... , launchOptions: { args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-video-capture=/tmp/does-not-exist.y4m'] } } }
      { name: 'chromium-no-webgl',  use: { ... , launchOptions: { args: ['--disable-webgl','--disable-webgl2', ...three fake flags] } } }

useCamera.ts:
  - The `?forceState=<STATE>` URL param short-circuit is a PREREQUISITE landed by Task 1.2 (NOT this task). When MODE === 'test' or DEV, useCamera reads the param once on mount and short-circuits dispatch.

Downstream tasks:
  - 5.5 uses the GRANTED happy path; no overlap.
  - 5.R CHANGELOG bullet "All 8 D23 states covered by forced-failure E2E".
```

---

## Validation Loop

```bash
# Level 1 — Syntax & Style
pnpm lint
pnpm typecheck

# Level 2 — Unit
pnpm vitest run src/camera
# The URL-param branch adds a new unit test; include it.

# Level 3 — Integration: Playwright test list (catches typos in project names)
pnpm exec playwright test --list --grep "Task 5.4:"

# Level 4 — E2E
pnpm test:e2e --grep "Task 5.4:"
```

---

## Final Validation Checklist

### Technical

- [ ] `pnpm lint` exits 0
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm vitest run src/camera` covers the URL-param branch
- [ ] `pnpm exec playwright test --list --grep "Task 5.4:"` enumerates all 8
- [ ] `pnpm test:e2e --grep "Task 5.4:"` exits 0 locally
- [ ] Same in CI via `ci.yml`

### Feature

- [ ] Each of 8 state cards renders with its `data-testid`
- [ ] Retry button present on 5 recoverable states (USER_DENIED, SYSTEM_DENIED, DEVICE_CONFLICT, NOT_FOUND, MODEL_LOAD_FAIL)
- [ ] Retry button absent on terminal NO_WEBGL
- [ ] Pre-prompt card visible before any gUM call in PROMPT
- [ ] `aria-live="polite"` and role attributes correct on each card (verified by `getByRole` queries)

### Code Quality

- [ ] No `test.skip` / `test.fixme` used
- [ ] `?forceState=` URL param guarded by `import.meta.env.DEV || import.meta.env.MODE === 'test'`
- [ ] No hardcoded sleeps — every wait is `waitFor*` on a concrete condition
- [ ] Per-case cleanup (unregister SW; unroute) prevents bleed

---

## Anti-Patterns

- Do NOT add a `?forceState=…` shortcut in production builds — it becomes an XSS-style surface. Gate strictly on `DEV || MODE === 'test'`.
- Do NOT use `page.waitForTimeout()` — always a concrete waitFor.
- Do NOT stub `navigator.mediaDevices.getUserMedia` via `addInitScript` — the launch flags are the production path.
- Do NOT add more than one `test()` per describe — keeps `--grep "Task 5.4:"` output readable.
- Do NOT introduce new state IDs here. Every state must exist in `cameraState.ts` and have a card in `ErrorStates.tsx`.
- Do NOT forget to unregister the service worker in the MODEL_LOAD_FAIL test — a cached model silently passes the test even though the state is never entered.
- Do NOT rely on test ordering — each test must be independent.

Universal anti-patterns apply (`.claude/skills/prp-task-ralph-loop/SKILL.md` §6).

---

## No Prior Knowledge Test

- [ ] `tests/e2e/smoke.spec.ts` exists as MIRROR
- [ ] `src/camera/useCamera.ts` and `src/ui/ErrorStates.tsx` exist (from Tasks 1.2 and 1.3)
- [ ] D23 enumerates 8 states
- [ ] `.claude/skills/playwright-e2e-webcam/SKILL.md` §"The 8 D23 error states" (lines 221-236) is the forcing-mechanism source
- [ ] `.claude/skills/webcam-permissions-state-machine/SKILL.md` documents error → state mapping
- [ ] Task 5.1's service worker exists and needs to be unregistered in MODEL_LOAD_FAIL test
- [ ] No future tasks are referenced

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
.claude/skills/webcam-permissions-state-machine/SKILL.md
.claude/skills/mediapipe-hand-landmarker/SKILL.md
```
