# Task DR-9.2: Parent 5.4 — Error-state E2E for all 8 camera states on the new chrome

**Phase**: DR-9 — Parent Phase-5 Resume
**Parent task**: 5.4 (forced-failure E2E coverage of all 8 D23 states)
**Branch**: `task/DR-9-2-error-states-e2e`
**Commit prefix**: `Task DR-9.2:`
**Estimated complexity**: High
**Max Ralph iterations**: 30

---

## Objective

Re-execute parent task 5.4 against the reworked chrome. Produce one Playwright spec per camera state from the D23 8-state machine, each forcing the state via the **exact mechanism specified below** (not a URL-param shortcut — DR-9.2 tightens parent 5.4 by using real forcing mechanisms wherever Chromium permits). Every spec asserts the matching restyled error card (DR-8.4 tokens + JetBrains Mono + hairline divider) renders with its preserved `error-state-card-<STATE>` testid.

Parent 5.4 allowed `?forceState=<STATE>` URL params as a fallback for SYSTEM_DENIED / DEVICE_CONFLICT because Chromium's fake-device pipeline cannot reproduce those OS-level conditions. DR-9.2 replaces the URL-param fallbacks with **JS-level stubs** (`navigator.permissions.query` override, `getUserMedia` throw, `enumerateDevices` empty, fetch intercept for model-load, `HTMLCanvasElement.getContext` null) — more faithful to the real rejection paths and not dependent on a test-only build mode. The GRANTED state is verified by the default happy-path smoke.

---

## Context

Parent task 5.4 blocked on the new chrome — the testids it asserts (`error-state-card-<STATE>`) must survive the Phase DR-8.4 restyle (DR14 lock: "restyle, keep structure; existing `role`, `aria-live`, testids preserved exactly"). DR-8.R verified 45 aggregate Phase 1–4 E2E still pass against the new UI. DR-9.2 adds the 8 state-card specs on top.

The spec file lives at `tests/e2e/error-states.spec.ts` (same path as parent 5.4 planned — if it was ever created under the old chrome, DR-9.2 rewrites it). Describe blocks MUST start with `Task DR-9.2:` so `--grep "Task DR-9.2:"` matches.

**Authority**: DR DISCOVERY DR14 (error cards restyled, structure preserved) + parent DISCOVERY D23 (the 8-state contract).

---

## Dependencies

- **DR-8.4** — error + pre-prompt cards restyled; all 8 `error-state-card-<STATE>` testids intact; hairline divider + JetBrains Mono + new palette applied.
- **DR-8.R** — phase regression green; 45 Phase 1–4 E2E specs pass against the new chrome.
- **DR-9.1** — CI pipeline exists so these new specs get run on every PR.
- `src/camera/useCamera.ts` — 8-state machine with `mapGetUserMediaError`, `mapTrackerInitError`, `mapPermissionsQuery` helpers from parent Task 1.2.
- `src/ui/ErrorStates.tsx` + `src/ui/PrePromptCard.tsx` — render the cards; restyled in DR-8.4 but keep the testid contract.
- `public/models/hand_landmarker.task` + `public/wasm/vision_wasm_*.{js,wasm}` — loaded at MediaPipe init; stub-target for MODEL_LOAD_FAIL.
- `playwright.config.ts` — existing Chromium project with fake-webcam launch flags; DR-9.2 adds NO project changes (every state forced via `addInitScript` / `route` / `grantPermissions` in-test).

## Blocked By

- DR-8.R marked `done` in PROGRESS.md (testids confirmed preserved by the regression walkthrough).
- DR-9.1 merged (CI will run these specs on this task's PR).

---

## Research Findings

- **Parent task 5.4** (`.claude/orchestration-hand-tracker-fx/tasks/phase-5/task-5-4.md`) — original 8-state forcing table. DR-9.2 supersedes the URL-param fallback for SYSTEM_DENIED / DEVICE_CONFLICT with `addInitScript` stubs.
- **`webcam-permissions-state-machine` skill** — authoritative error → state mapping. `mapGetUserMediaError`:
  - `NotAllowedError` + permissions.query === 'denied' → USER_DENIED
  - `NotAllowedError` + permissions.query === 'prompt' → SYSTEM_DENIED (OS blocked before prompt reached user)
  - `NotReadableError` or `TrackStartError` → DEVICE_CONFLICT
  - `NotFoundError` or `OverconstrainedError` with no devices → NOT_FOUND
- **`playwright-e2e-webcam` skill §"The 8 D23 error states — how to force each"** — canonical forcing table:
  - Route-intercept before navigate for MODEL_LOAD_FAIL.
  - `addInitScript` (runs before every document in the context) is the primary stub hook for everything else.
  - Must unregister the service worker from parent task 5.1 before running any test that relies on network interception — cached model masks a 500.
- **DR-8.4** — card structure preserved: `role="alertdialog"` on card root, `aria-live="polite"` on status region, `aria-labelledby` on title, `data-testid="error-state-card-<STATE>"` on root element.
- **DR PHASES.md §DR-9.2** — "Each spec forces the failure, asserts the right `error-state-card-*` testid visible, the title text, the retry button where applicable."

---

## Implementation Plan

### Step 1: Confirm testid contract post-DR-8.4

Before writing any spec, verify the 8 testids survived DR-8.4:

```bash
grep -Rn 'error-state-card-' src/ui/ErrorStates.tsx src/ui/PrePromptCard.tsx
# Expect 8 instances (or a single loop rendering them from a table).
```

If any are missing, STOP and file a hotfix task against DR-8.4. Do not patch them inline here.

### Step 2: Author `tests/e2e/error-states.spec.ts`

The pre-existing spec lives at `tests/e2e/errorStates.spec.ts` (camelCase, parent Task 1.2 vintage). Rename with git so history is preserved:

```bash
git mv tests/e2e/errorStates.spec.ts tests/e2e/error-states.spec.ts
```

Then rewrite the file contents per the template below. All new describe blocks start with `Task DR-9.2:` (not `errorStates`) so the Ralph loop's `--grep "Task DR-9.2:"` matches.

Single file, 8 `describe` blocks. Every describe starts `Task DR-9.2:`. One test per describe.

```ts
// tests/e2e/error-states.spec.ts
//
// Task DR-9.2 — D23 eight-state coverage on the reworked chrome.
//
// Forcing mechanisms (JS-level stubs via addInitScript / context APIs / route
// intercept). No URL-param shortcuts — every state exercises a real rejection
// path. GRANTED is verified implicitly by the default happy-path smoke in
// tests/e2e/smoke.spec.ts (Task 1.1) and re-asserted here for completeness.

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// Helper — always unregister the Task-5.1 service worker before any stub,
// else the SW may replay a cached successful model load and mask MODEL_LOAD_FAIL.
async function unregisterSW(page: Page) {
  await page.addInitScript(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((rs) => rs.forEach((r) => r.unregister()));
    }
  });
}

async function waitForCard(page: Page, state: string) {
  const card = page.locator(`[data-testid="error-state-card-${state}"]`);
  await expect(card).toBeVisible({ timeout: 30_000 });
  return card;
}

// ─── 1. PROMPT ─────────────────────────────────────────────────────────────
// Default state before any permission grant. We force this by clearing any
// prior grants and NOT granting camera permission; useCamera observes
// permissions.query === 'prompt' on mount and renders PrePromptCard.
test.describe('Task DR-9.2: PROMPT state card', () => {
  test('pre-prompt card renders when permissionState is prompt', async ({ page, context }) => {
    await context.clearPermissions();
    await unregisterSW(page);
    await page.goto('/');
    const card = await waitForCard(page, 'PROMPT');
    await expect(card).toHaveAttribute('role', /alertdialog|dialog|region/);
    // Primary action button (grants camera)
    await expect(card.getByRole('button', { name: /grant|allow|enable/i })).toBeVisible();
  });
});

// ─── 2. USER_DENIED ────────────────────────────────────────────────────────
// User explicitly denied. Achieved via context.grantPermissions([]) scope-narrow
// to the app origin, then forcing getUserMedia to throw NotAllowedError while
// permissions.query returns 'denied' (parent useCamera mapper reads BOTH signals).
test.describe('Task DR-9.2: USER_DENIED state card', () => {
  test('renders with retry button when user denies permission', async ({ page, context, baseURL }) => {
    await context.clearPermissions();
    await context.grantPermissions([], { origin: baseURL! });
    await unregisterSW(page);
    await page.addInitScript(() => {
      // Override permissions.query to report 'denied' so the mapper sees
      // NotAllowedError + denied → USER_DENIED (not SYSTEM_DENIED).
      const origQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = async (desc: PermissionDescriptor) => {
        if (desc.name === 'camera') {
          return { state: 'denied', name: 'camera', onchange: null } as PermissionStatus;
        }
        return origQuery(desc);
      };
      const origGum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException('Permission denied by user', 'NotAllowedError');
      };
    });
    await page.goto('/');
    const card = await waitForCard(page, 'USER_DENIED');
    await expect(card.getByRole('button', { name: /retry|try again/i })).toBeVisible();
  });
});

// ─── 3. SYSTEM_DENIED ─────────────────────────────────────────────────────
// OS- or policy-level block. The user NEVER saw a prompt. Signature: gUM throws
// NotAllowedError but permissions.query still reports 'prompt' (mapper:
// NotAllowedError + prompt → SYSTEM_DENIED).
test.describe('Task DR-9.2: SYSTEM_DENIED state card', () => {
  test('renders with OS-block copy', async ({ page, context }) => {
    await context.clearPermissions();
    await unregisterSW(page);
    await page.addInitScript(() => {
      navigator.permissions.query = async (desc: PermissionDescriptor) => {
        if (desc.name === 'camera') {
          return { state: 'prompt', name: 'camera', onchange: null } as PermissionStatus;
        }
        // Fall through for other permissions — avoid breaking the page.
        return { state: 'prompt', name: desc.name, onchange: null } as PermissionStatus;
      };
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException('OS-level block', 'NotAllowedError');
      };
    });
    await page.goto('/');
    const card = await waitForCard(page, 'SYSTEM_DENIED');
    await expect(card).toContainText(/blocked|OS|settings|system/i);
  });
});

// ─── 4. DEVICE_CONFLICT ───────────────────────────────────────────────────
// Camera in use by another app (Zoom, FaceTime, …). Signature: gUM throws
// NotReadableError → mapper → DEVICE_CONFLICT.
test.describe('Task DR-9.2: DEVICE_CONFLICT state card', () => {
  test('renders when camera is already in use', async ({ page, context, baseURL }) => {
    await context.clearPermissions();
    await context.grantPermissions(['camera'], { origin: baseURL! });
    await unregisterSW(page);
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException('Device is in use', 'NotReadableError');
      };
    });
    await page.goto('/');
    const card = await waitForCard(page, 'DEVICE_CONFLICT');
    await expect(card).toContainText(/in use|another|Zoom|FaceTime|close/i);
    await expect(card.getByRole('button', { name: /retry|try again/i })).toBeVisible();
  });
});

// ─── 5. NOT_FOUND ─────────────────────────────────────────────────────────
// No camera devices. Signature: enumerateDevices returns no videoinput →
// useCamera short-circuits to NOT_FOUND without ever calling gUM. Also: gUM
// throws NotFoundError if called (belt + suspenders).
test.describe('Task DR-9.2: NOT_FOUND state card', () => {
  test('renders when no camera device is found', async ({ page, context, baseURL }) => {
    await context.clearPermissions();
    await context.grantPermissions(['camera'], { origin: baseURL! });
    await unregisterSW(page);
    await page.addInitScript(() => {
      navigator.mediaDevices.enumerateDevices = async () => [];
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException('No camera', 'NotFoundError');
      };
    });
    await page.goto('/');
    const card = await waitForCard(page, 'NOT_FOUND');
    await expect(card).toContainText(/camera|no device|connect/i);
  });
});

// ─── 6. MODEL_LOAD_FAIL ───────────────────────────────────────────────────
// MediaPipe model fetch returns 500 (or network error). Route-intercept BEFORE
// goto. Also unregister SW so no cached response masks the failure.
test.describe('Task DR-9.2: MODEL_LOAD_FAIL state card', () => {
  test('renders when /models/hand_landmarker.task returns 500', async ({ page, context, baseURL }) => {
    await context.clearPermissions();
    await context.grantPermissions(['camera'], { origin: baseURL! });
    await unregisterSW(page);
    await context.route('**/models/hand_landmarker.task', (route) =>
      route.fulfill({ status: 500, body: 'simulated server error' })
    );
    await page.goto('/');
    const card = await waitForCard(page, 'MODEL_LOAD_FAIL');
    await expect(card.getByRole('button', { name: /retry|try again/i })).toBeVisible();
  });
});

// ─── 7. NO_WEBGL ──────────────────────────────────────────────────────────
// WebGL2 unavailable. Stub HTMLCanvasElement.getContext to return null for
// 'webgl2' (and 'webgl' — mediapipe/ogl may probe both). Terminal state —
// no retry button.
test.describe('Task DR-9.2: NO_WEBGL state card', () => {
  test('renders terminal no-webgl card', async ({ page, context, baseURL }) => {
    await context.clearPermissions();
    await context.grantPermissions(['camera'], { origin: baseURL! });
    await unregisterSW(page);
    await page.addInitScript(() => {
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        kind: string,
        ...rest: unknown[]
      ) {
        if (kind === 'webgl' || kind === 'webgl2' || kind === 'experimental-webgl') {
          return null;
        }
        // eslint-disable-next-line prefer-rest-params
        return (origGetContext as (...a: unknown[]) => unknown).apply(this, [kind, ...rest]);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
    await page.goto('/');
    const card = await waitForCard(page, 'NO_WEBGL');
    // Terminal — NO retry button
    await expect(card.getByRole('button', { name: /retry|try again/i })).toHaveCount(0);
  });
});

// ─── 8. GRANTED ───────────────────────────────────────────────────────────
// Default success path. No stubs. GRANTED doesn't render an error card; we
// assert NO card matches the `error-state-card-*` prefix AND the render
// canvas is visible.
test.describe('Task DR-9.2: GRANTED state (happy path)', () => {
  test('no error card visible on default happy path', async ({ page, context, baseURL }) => {
    await context.clearPermissions();
    await context.grantPermissions(['camera'], { origin: baseURL! });
    await page.goto('/');
    await expect(page.locator('[data-testid="render-canvas"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid^="error-state-card-"]')).toHaveCount(0);
  });
});
```

### Step 3: Per-state cleanup hygiene

Every test is independent. Playwright creates a fresh `BrowserContext` per test (per `playwright.config.ts` default), so `clearPermissions` + `addInitScript` stubs + `route` registrations live exactly one test. No shared-state bleed.

### Step 4: Run specs locally

```bash
pnpm test:setup                                                    # regenerate Y4M (ffmpeg)
pnpm test:e2e --grep "Task DR-9.2:"                                # all 8 specs
pnpm test:e2e --grep "Task DR-9.2: SYSTEM_DENIED"                  # single-state debug
```

On failure, Playwright auto-captures trace + screenshot + video (per `playwright.config.ts` defaults). Open via:

```bash
pnpm exec playwright show-trace playwright-report/trace.zip
```

### Step 5: Wire into CI automatically

No CI file edit needed — DR-9.1's `ci.yml` already runs `pnpm test:e2e` with no `--grep` filter, so all 8 DR-9.2 specs run on every PR. Confirm by pushing this branch and watching the CI run.

### Step 6: Commit + merge

```bash
git checkout -b task/DR-9-2-error-states-e2e
git add tests/e2e/error-states.spec.ts
git commit -m "$(cat <<'EOF'
Task DR-9.2: Force-drive E2E coverage for all 8 D23 error states on the reworked chrome

PROMPT / USER_DENIED / SYSTEM_DENIED / DEVICE_CONFLICT / NOT_FOUND / MODEL_LOAD_FAIL / NO_WEBGL / GRANTED — one describe each, JS-level stubs via addInitScript + context.grantPermissions + context.route, SW unregister guard on every stubbed case. Testids `error-state-card-<STATE>` preserved by DR-8.4 restyle. No URL-param fallbacks.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin task/DR-9-2-error-states-e2e
gh pr create --fill --title "Task DR-9.2: Error-state E2E (all 8 states) on reworked chrome"
```

---

## Files to Create

- `tests/e2e/error-states.spec.ts` — single file, 8 describes, one test each.

## Files to Modify

- `PROGRESS.md` — after merge, mark DR-9.2 done + parent 5.4 done (via DR-9.x mapping row).

No source changes. No `playwright.config.ts` project additions (DR-9.2 uses `addInitScript` stubs instead of the `chromium-no-camera` / `chromium-no-webgl` projects parent 5.4 proposed).

---

## Contracts

### Provides (for downstream tasks)

- **8 passing specs under `Task DR-9.2:` prefix** — DR-9.R CHANGELOG bullet: "All 8 D23 states covered by forced-failure E2E on the reworked chrome."
- **`unregisterSW` + `waitForCard` helpers** — in-file helpers; if DR-9.3 or later tasks need them, extract to `tests/e2e/helpers.ts` (not this task's scope).

### Consumes (from upstream tasks)

- **DR-8.4** — the 8 `error-state-card-<STATE>` testids on restyled cards. If a testid drifted, this task discovers it (test fails) and files a hotfix against DR-8.4.
- **Parent 1.2 state machine** — `mapGetUserMediaError`, `mapTrackerInitError`, `mapPermissionsQuery`; the stubs in this task drive those mappers via real code paths.
- **Parent 5.1 service worker** — must be unregistered per-test or MODEL_LOAD_FAIL silently passes.

---

## Acceptance Criteria

- [ ] `tests/e2e/error-states.spec.ts` exists; 8 `describe` blocks all prefixed `Task DR-9.2:`.
- [ ] Each spec has exactly ONE `test(…)` call.
- [ ] `pnpm test:e2e --grep "Task DR-9.2:"` — all 8 pass locally (Chromium default project).
- [ ] No `test.skip`, no `test.fixme`, no `page.waitForTimeout()` anywhere.
- [ ] Every spec that stubs anything also calls `unregisterSW(page)` BEFORE stubbing (SW-miss-orderings fail the test deterministically).
- [ ] Every `context.route(…)` registers BEFORE `page.goto(…)`.
- [ ] Every `addInitScript(…)` registers BEFORE `page.goto(…)`.
- [ ] USER_DENIED + SYSTEM_DENIED + DEVICE_CONFLICT + NOT_FOUND + MODEL_LOAD_FAIL specs assert retry button visible.
- [ ] NO_WEBGL spec asserts retry button is absent (terminal).
- [ ] PROMPT spec asserts primary grant button visible.
- [ ] GRANTED spec asserts `[data-testid="render-canvas"]` visible AND `[data-testid^="error-state-card-"]` count 0.
- [ ] All 8 pass in CI via DR-9.1's `ci.yml`.
- [ ] All 8 pass on Vercel preview via DR-9.1's `e2e-preview.yml` after first deploy.

---

## Testing Protocol

### L1 — Syntax + Style + Types

```bash
pnpm lint                                                          # biome — spec file included
pnpm typecheck                                                     # tsc --noEmit — uses @playwright/test types
```

### L2 — Unit (no new unit coverage; re-run for safety)

```bash
pnpm vitest run
# Confirms state-machine mappers (parent 1.2 tests) still pass —
# DR-9.2's stubs drive the same code paths; if a mapper drifted in
# DR-8.4, unit tests catch it too.
```

### L3 — Integration

```bash
# Enumerate specs to catch naming mistakes BEFORE running the full suite.
pnpm exec playwright test --list --grep "Task DR-9.2:"
# Expect 8 tests enumerated, each exactly one describe.
```

### L4 — E2E

```bash
pnpm test:setup                                                    # regenerate Y4M
pnpm test:e2e --grep "Task DR-9.2:"                                # all 8 specs
```

Per-state debug:

```bash
pnpm test:e2e --grep "Task DR-9.2: MODEL_LOAD_FAIL" --headed --debug
```

### Browser Testing (manual visual sanity)

For each state, manually navigate in a headed Chromium and confirm the card renders in the new DR-8.4 palette:

```bash
pnpm dev
# Visit http://localhost:5173/?...  (use DevTools Conditions / Permissions
# to reproduce each state manually if desired)
```

Not a required gate — the 8 specs above ARE the gate — but useful when writing the task.

---

## Known Gotchas

```typescript
// CRITICAL: addInitScript runs BEFORE EVERY document, including the page's
// own scripts. If you addInitScript the navigator overrides, they are already
// installed when React hydrates and useCamera calls the APIs.

// CRITICAL: context.route('**/pattern', handler) — registration MUST precede
// page.goto(). Otherwise the first fetch slips through before routing
// attaches. This bites MODEL_LOAD_FAIL if you flip the order.

// CRITICAL: Unregistering the Task-5.1 service worker is MANDATORY for any
// test that relies on a fetch interception. The SW caches /models/* and
// /wasm/* aggressively — a cached 200 replays even when your route returns
// 500. unregisterSW() adds an initScript that runs BEFORE the page's own
// SW registration, canceling any existing registration from a prior run.

// CRITICAL: permissions.query override — the spec must return an object
// shaped like PermissionStatus, not just { state }. Some consumers listen
// for state changes via onchange — return onchange: null to avoid a crash.

// CRITICAL: USER_DENIED vs SYSTEM_DENIED differ ONLY in what
// permissions.query returns when getUserMedia throws NotAllowedError.
//   denied  → USER_DENIED
//   prompt  → SYSTEM_DENIED
// If the mapper treats both identically, the state split fails and both
// tests hit the same card. Confirm against webcam-permissions-state-machine
// skill's mapGetUserMediaError before debugging spec-side issues.

// CRITICAL: enumerateDevices returning [] short-circuits useCamera BEFORE
// gUM is called. In that path the NotFoundError gUM stub never fires. That
// is fine — both code paths land on NOT_FOUND. The stub is "belt and
// suspenders."

// CRITICAL: NO_WEBGL stub must cover 'webgl', 'webgl2', AND
// 'experimental-webgl'. MediaPipe + ogl may each probe a different name;
// missing one lets the app initialize a single context and skip the card.

// CRITICAL: Do NOT use `?forceState=<STATE>` URL params. Parent 5.4 allowed
// them as a fallback; DR-9.2 eliminates them. JS stubs exercise the real
// rejection paths and do not require a test-only build mode.

// CRITICAL: `context.grantPermissions([])` needs an `origin` option OR it
// applies to the default origin ('http://localhost'). Always pass
// `{ origin: baseURL! }` — baseURL comes from playwright.config.ts and
// matches either the dev preview or the Vercel URL.

// CRITICAL: The retry button text must match a regex. Parent 5.4 used
// /retry/i; DR-8.4 may have tweaked copy to "Try again" — the specs use
// /retry|try again/i to tolerate both.
```

---

## Anti-Patterns

- Do NOT add a `chromium-no-camera` or `chromium-no-webgl` project to `playwright.config.ts`. Parent 5.4 planned them; DR-9.2 uses `addInitScript` stubs instead (simpler, no matrix).
- Do NOT rely on `page.waitForTimeout()` — every wait is a `waitFor` on a concrete condition. 30s timeout on `waitForCard` is intentional (MediaPipe init can stall the first frame).
- Do NOT add `?forceState=<STATE>` URL params. Real rejection paths only.
- Do NOT skip `unregisterSW` — it IS the fix for the MODEL_LOAD_FAIL false-pass bug.
- Do NOT forget `context.clearPermissions()` at the top of every test — Playwright inherits permissions from the browser's cookie jar across tests; forgetting this bleeds state.
- Do NOT add more than one `test()` per describe — keeps `--grep` output readable (one line per state).
- Do NOT file a bug against DR-8.4 without confirming the grep in Step 1 actually fails — the testid contract is preserved.
- Do NOT assert visual styles (colors, fonts) here — DR-9.3 is the visual-fidelity gate. DR-9.2 asserts structure + behavior only.

Universal anti-patterns apply (`.claude/skills/prp-task-ralph-loop/SKILL.md` §6).

---

## Skills to Read

- `prp-task-ralph-loop` — Task anatomy + Ralph protocol.
- `hand-tracker-fx-architecture` — Orientation to the state-machine flow (camera → permission-query → gUM → tracker-init → MediaPipe error → mapper → state).
- `webcam-permissions-state-machine` — **MANDATORY.** 8-state contract, mappers, edge-case matrix for USER vs SYSTEM denied.
- `playwright-e2e-webcam` — Fake-webcam harness, `addInitScript` patterns, `PLAYWRIGHT_BASE_URL` wiring.
- `vite-vercel-coop-coep` — Service worker registration + unregistration quirks; COI bake-in check.

## Research / Reference Files

- `.claude/orchestration-hand-tracker-fx/tasks/phase-5/task-5-4.md` — Parent task; this one inherits the 8-state table, replaces URL-param fallbacks with stubs.
- `.claude/orchestration-hand-tracker-fx/DISCOVERY.md` §D23 — the 8 states.
- `.claude/orchestration-design-rework/DISCOVERY.md` §DR14 — card structure preserved.
- `.claude/orchestration-design-rework/PHASES.md` §DR-9.2 — scope row.
- `reports/DR-8-regression.md` — confirms the 45 aggregate Phase 1–4 E2E still pass; DR-9.2 builds on top.

---

## Git

- Branch: `task/DR-9-2-error-states-e2e`
- Commit prefix: `Task DR-9.2:`
- E2E describe prefix: `Task DR-9.2: <STATE> …` for all 8 describes.
- Every commit ends with `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>` trailer.
- Fast-forward merge to `main` after `CI / check` is green and DR-9.2 specs visible in the CI run log (8 entries under `Task DR-9.2:`).
- Mark `5.4` in parent PROGRESS.md mapping row (done via DR-9.2) after merge.

---

## No-Prior-Knowledge Test

- [ ] `tests/e2e/smoke.spec.ts` exists (Task 1.1) as the describe-naming template.
- [ ] `src/camera/useCamera.ts` + `src/ui/ErrorStates.tsx` + `src/ui/PrePromptCard.tsx` all exist; testids `error-state-card-<STATE>` survive DR-8.4.
- [ ] DR-8.R merged; card-structure preserved per DR14.
- [ ] DR-9.1 merged; `ci.yml` runs `pnpm test:e2e` on every PR.
- [ ] Parent 5.1 service worker exists at `public/sw.js` and registers in main.tsx.
- [ ] `.claude/skills/webcam-permissions-state-machine/SKILL.md` documents the mapper contract.
- [ ] `.claude/skills/playwright-e2e-webcam/SKILL.md` documents `addInitScript` + `context.route` patterns.
- [ ] All 4 validation levels runnable from a fresh clone after `pnpm install`.
- [ ] Task is atomic; only DR-9.R is downstream.
