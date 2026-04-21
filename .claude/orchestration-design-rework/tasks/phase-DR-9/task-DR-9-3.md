# Task DR-9.3: Parent 5.5 — Visual-fidelity gate against the new design-rework reference

**Phase**: DR-9 — Parent Phase-5 Resume
**Parent task**: 5.5 (visual-fidelity gate — reference-screenshot comparison)
**Branch**: `task/DR-9-3-visual-fidelity`
**Commit prefix**: `Task DR-9.3:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Objective

Add an automated visual-fidelity E2E spec that captures the app at the canonical 1440×900 viewport on the default preset and compares it against `reports/DR-8-regression/design-rework-reference.png`. Pass threshold: ≤ **2%** pixel diff (`maxDiffPixelRatio: 0.02`). Spec runs on the **live Vercel preview URL** via `PLAYWRIGHT_BASE_URL` and is wired into DR-9.1's `e2e-preview.yml` so every deploy triggers it.

This is parent task 5.5 re-executed on the reworked chrome. Parent 5.5 used a qualitative 5-item checklist against the TouchDesigner reference (archived in DR-9.R to `_historical/`). DR-9.3 replaces that qualitative gate with a quantitative Playwright `toHaveScreenshot()` diff against the new pixelcrash-inspired reference. The TouchDesigner reference is no longer consulted for visual fidelity — DR4 locks the new reference as authoritative.

---

## Context

DR-8.R captured `reports/DR-8-regression/design-rework-reference.png` on the final reworked chrome (headless Chromium + fake-webcam Y4M + default preset + 1440×900 viewport). That PNG is the diff target. DR-9.3 automates the comparison so every subsequent Vercel deploy must visually match — any accidental token drift, font-weight regression, spacing bug, or palette bleed fails the gate.

The spec runs against the **live URL** rather than local preview because:
1. Vercel can serve subtly different responses (CDN caching, header transforms) from `vite preview`; DR-9.3 validates what users actually see.
2. `e2e-preview.yml` already provides `PLAYWRIGHT_BASE_URL` from `deployment_status.target_url`; DR-9.3 lands on the same trigger.
3. Live deploys exercise the service worker from parent 5.1 — font + model caching paths matter for first-paint timing, which affects capture stability.

**Authority**: DR DISCOVERY §DR4 (new reference supersedes TouchDesigner) + DR PHASES.md §DR-9.3 (≤ 2% pixel diff, 1440×900, live URL).

---

## Dependencies

- **DR-8.R** — `reports/DR-8-regression/design-rework-reference.png` committed at 1440×900 resolution (canonical viewport).
- **DR-9.1** — `e2e-preview.yml` exists; `PLAYWRIGHT_BASE_URL` wiring proven.
- **DR-9.2** — error-state specs green; ensures PROMPT card doesn't accidentally capture on first paint.
- Parent 5.1 — service worker registered; model + wasm + fonts cached after first visit.
- Parent 5.2 — `hand-tracker-jade.vercel.app` live + alias stable.

## Blocked By

- DR-8.R merged; reference PNG present.
- DR-9.1 + DR-9.2 merged; CI scaffolding + error-state specs landed.

---

## Research Findings

- **Parent task 5.5** (`.claude/orchestration-hand-tracker-fx/tasks/phase-5/task-5-5.md`) — used a qualitative 5-item checklist via Playwright MCP + sharp compositing. DR-9.3 supersedes: quantitative pixel-diff via `toHaveScreenshot()`.
- **DR DISCOVERY §DR4** — "Visual-fidelity gate (5.5 in the parent orchestration) adopts the new reference screenshot at `.claude/orchestration-design-rework/reference-assets/pixelcrash-reference.png` instead of `touchdesigner-reference.png`." Note: DR-8.R captured `reports/DR-8-regression/design-rework-reference.png` from the actual implementation — the live-app rendering — which is the correct diff target for an automated pixel gate (the pixelcrash screenshot is a stylistic reference, not a rendered artifact of OUR app).
- **DR PHASES.md §DR-9.3** — "Runs in CI on live preview deploy. Fails on > 2% diff; produces diff artifact."
- **Playwright `toHaveScreenshot()` docs** — `maxDiffPixelRatio: 0.02` gives 2% tolerance. First run with `--update-snapshots` writes the snapshot; subsequent runs compare. Our snapshot IS `reports/DR-8-regression/design-rework-reference.png` — we bypass the default `__screenshots__/` convention and compare against an explicit file via `expect(buf).toMatchSnapshot(…)` with path override.
- **`playwright-e2e-webcam` skill** — crossOriginIsolated bake-in check, `__handTracker` dev hook, Vercel preview target via `PLAYWRIGHT_BASE_URL`. Live URL does NOT have `__handTracker` (it is tree-shaken in PROD builds). DR-9.3 therefore cannot use `setFakeLandmarks` on the live URL — the capture runs against whatever the fake webcam yields (testsrc2 behind the mosaic) with the default preset.
- **Viewport lock** — 1440×900 is the DR design canvas width. `page.setViewportSize({ width: 1440, height: 900 })` at test start.
- **Reference PNG location** — DR-8.R writes to `reports/DR-8-regression/design-rework-reference.png` (repo-relative). Size 1440×900, 24-bit PNG, ~200–400 KB.

---

## Implementation Plan

### Step 1: Confirm reference asset is present

```bash
test -f reports/DR-8-regression/design-rework-reference.png && file reports/DR-8-regression/design-rework-reference.png
# Expect: PNG image data, 1440 x 900, 8-bit/color RGB(A), non-interlaced
```

If missing, STOP — DR-8.R did not capture the reference. Re-run DR-8.R first.

### Step 2: Create `tests/e2e/visual-fidelity.spec.ts`

Single file, single describe, single test. Runs at 1440×900, captures after the mosaic has warmed up, diffs against the committed reference PNG with `maxDiffPixelRatio: 0.02`.

```ts
// tests/e2e/visual-fidelity.spec.ts
//
// Task DR-9.3 — Automated visual-fidelity gate against the DR-8.R reference.
//
// Runs against the Vercel preview URL (PLAYWRIGHT_BASE_URL from DR-9.1's
// e2e-preview.yml). Fails on > 2% pixel diff. Produces a diff artifact in
// test-results/ which CI uploads on failure.

import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REFERENCE_PATH = path.resolve(
  process.cwd(),
  'reports/DR-8-regression/design-rework-reference.png'
);

test.describe('Task DR-9.3: Visual-fidelity gate', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(REFERENCE_PATH)) {
      throw new Error(
        `Reference image missing at ${REFERENCE_PATH}. ` +
          `DR-8.R must capture it before DR-9.3 can run.`
      );
    }
  });

  test('live deploy matches DR-8.R reference within 2% pixel diff', async ({
    page,
    context,
    baseURL,
  }) => {
    test.setTimeout(90_000);

    // Canonical viewport for the rework.
    await page.setViewportSize({ width: 1440, height: 900 });

    // Grant camera so PROMPT card doesn't capture instead of the app.
    await context.clearPermissions();
    await context.grantPermissions(['camera'], { origin: baseURL! });

    await page.goto('/');

    // Wait for the render loop to stabilize. In PROD the __handTracker dev
    // hook is absent, so we fall back to the render-canvas being visible
    // plus a bounded wait for MediaPipe initialization + first mosaic frame.
    await expect(page.locator('[data-testid="render-canvas"]')).toBeVisible({
      timeout: 30_000,
    });

    // Give the first few MediaPipe frames time to settle. The mosaic is a
    // full-screen quad so pixelation appears within 2-3 frames of landmark
    // availability. 2s matches what DR-8.R's reference-capture spec used.
    await page.waitForTimeout(2000);

    // Capture viewport (NOT full-page — the app is a fixed-viewport SPA).
    const captured = await page.screenshot({
      fullPage: false,
      type: 'png',
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });

    // Compare against the DR-8.R reference. Playwright's toHaveScreenshot
    // is the official pixel-diff tool; invoked via expect(buffer) with
    // maxDiffPixelRatio: 0.02 (2%) and the reference path pinned as the
    // snapshot.
    expect(captured).toMatchSnapshot('design-rework-reference.png', {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2, // per-pixel color sensitivity (default 0.2 — keep)
    });
  });
});
```

**Note on `toMatchSnapshot` vs `toHaveScreenshot`**: Playwright's `toHaveScreenshot()` auto-captures AND auto-snapshots — it writes `<test-name>.png` next to the spec in `__screenshots__/` on first run. That convention does not map cleanly to "compare against a file already committed under `reports/`." DR-9.3 uses `toMatchSnapshot(<name>, <options>)` with the snapshot file resolved via `playwright.config.ts`'s `snapshotPathTemplate` pointing into `reports/DR-8-regression/`. See Step 3 for the config wiring.

### Step 3: Wire `snapshotPathTemplate` in `playwright.config.ts`

Currently `playwright.config.ts` uses the default snapshot path (`<testfile>-snapshots/<name>-<project>-<platform>.png`). DR-9.3's reference lives at `reports/DR-8-regression/design-rework-reference.png`, committed by DR-8.R. We want `toMatchSnapshot('design-rework-reference.png')` to resolve to that exact file — not to write a new file next to the test.

Add to `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // … existing config …

  // DR-9.3: visual-fidelity snapshot lives under reports/DR-8-regression/.
  // The {arg} placeholder resolves to the name passed to toMatchSnapshot(),
  // so calling toMatchSnapshot('design-rework-reference.png') reads the
  // reference at reports/DR-8-regression/design-rework-reference.png.
  snapshotPathTemplate:
    '{testDir}/../reports/DR-8-regression/{arg}{ext}',

  // … rest …
});
```

`{testDir}` resolves to `tests/e2e/`; `{testDir}/..` is the repo root; `reports/DR-8-regression/{arg}{ext}` resolves to the reference. `{arg}` is `design-rework-reference`, `{ext}` is `.png` (Playwright supplies both automatically).

If `playwright.config.ts` already uses a template for other reasons, confirm this override doesn't collide with existing snapshot files. If it does, scope the template override via a project name: add a dedicated `visual-fidelity` project with its own `snapshotPathTemplate`.

### Step 4: Run locally against the live URL

```bash
PLAYWRIGHT_BASE_URL=https://hand-tracker-jade.vercel.app \
  pnpm test:e2e --grep "Task DR-9.3:"
```

Expected first run: PASS with 0% diff (the reference was captured from the same deploy). Subsequent runs after a token change, font bump, or palette drift: FAIL with a diff ratio > 0.02, producing `test-results/visual-fidelity-*/diff.png`.

### Step 5: Extend `e2e-preview.yml` to surface the diff artifact

DR-9.1's `e2e-preview.yml` already runs `pnpm test:e2e` without a `--grep` filter, so DR-9.3's spec runs on every deploy. Confirm the `Upload test results on failure` step uploads `test-results/` — it does; `test-results/visual-fidelity-<run>/diff.png` is automatic.

Optional: add a dedicated `name` for the visual-fidelity artifact to help triage. Not required for this task — the default upload is sufficient.

### Step 6: Commit + merge

```bash
git checkout -b task/DR-9-3-visual-fidelity
git add tests/e2e/visual-fidelity.spec.ts playwright.config.ts
git commit -m "$(cat <<'EOF'
Task DR-9.3: Automated visual-fidelity gate vs DR-8.R reference (2% pixel diff on live URL)

- tests/e2e/visual-fidelity.spec.ts — 1440x900 viewport capture, toMatchSnapshot with maxDiffPixelRatio: 0.02 against reports/DR-8-regression/design-rework-reference.png.
- playwright.config.ts — snapshotPathTemplate routed to reports/DR-8-regression/ so the committed reference is the snapshot target.
- Runs via DR-9.1's e2e-preview.yml against PLAYWRIGHT_BASE_URL on every Vercel deploy. Diff artifact uploaded on failure via the existing upload-artifact step.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin task/DR-9-3-visual-fidelity
gh pr create --fill --title "Task DR-9.3: Visual-fidelity gate vs DR-8.R reference"
```

---

## Files to Create

- `tests/e2e/visual-fidelity.spec.ts` — single spec, single describe, single test.

## Files to Modify

- `playwright.config.ts` — add `snapshotPathTemplate` pointing at `reports/DR-8-regression/`.
- `PROGRESS.md` — after merge, mark DR-9.3 done + parent 5.5 done.

No changes to application code. No changes to `reports/DR-8-regression/design-rework-reference.png` (it is the snapshot).

---

## Contracts

### Provides (for downstream tasks)

- **Automated visual regression gate** on every Vercel deploy. Any future chrome change that drifts > 2% from the DR-8.R baseline fails this spec and blocks merge (after DR-9.3 merges the status check is automatic via `e2e-preview.yml`).
- **Diff artifact convention** — `test-results/visual-fidelity-chromium/*-diff.png` uploaded on failure for human triage.
- **Reference update protocol** — when the team intentionally redesigns a component, re-run with `pnpm test:e2e --update-snapshots --grep "Task DR-9.3:"` to regenerate `reports/DR-8-regression/design-rework-reference.png`. Commit the updated PNG in the same PR that changes the design.

### Consumes (from upstream tasks)

- **DR-8.R** — reference PNG at `reports/DR-8-regression/design-rework-reference.png`.
- **DR-9.1** — `e2e-preview.yml` runs this spec against `PLAYWRIGHT_BASE_URL` on every deploy.
- **DR-9.2** — GRANTED happy-path stability confirmed (spec relies on no error card rendering).
- **Parent 5.1** — service worker ensures font + model cached for stable first-paint.
- **Parent 5.2** — live URL stable.

---

## Acceptance Criteria

- [ ] `tests/e2e/visual-fidelity.spec.ts` exists; single describe prefixed `Task DR-9.3:`.
- [ ] `playwright.config.ts` includes `snapshotPathTemplate` pointing into `reports/DR-8-regression/`.
- [ ] `PLAYWRIGHT_BASE_URL=https://hand-tracker-jade.vercel.app pnpm test:e2e --grep "Task DR-9.3:"` passes locally (0% diff expected immediately after DR-8.R).
- [ ] `pnpm test:e2e --grep "Task DR-9.3:"` without `PLAYWRIGHT_BASE_URL` runs against local `pnpm preview` and also passes (confirms local-vs-live headers produce near-identical paint).
- [ ] First Vercel deploy after this PR merges triggers `e2e-preview.yml`; visual-fidelity spec runs and passes.
- [ ] Artifact upload verified on an intentional-failure test: temporarily introduce a 1px shift in a component, watch `test-results/` artifact appear in the Actions run, revert the change before merge.
- [ ] Viewport locked to 1440×900 (explicit `page.setViewportSize`).
- [ ] `maxDiffPixelRatio: 0.02` — 2% tolerance; if the reference ever requires > 2% tolerance to pass, re-capture the reference instead of loosening the threshold.
- [ ] No test.skip, no `page.waitForTimeout()` > 2s (the 2s settle is the only timed wait and is justified by first-frame stability).

---

## Testing Protocol

### L1 — Syntax + Style + Types

```bash
pnpm lint
pnpm typecheck
```

### L2 — Unit

```bash
pnpm vitest run                                                    # no new unit coverage — sanity re-run
```

### L3 — Integration

```bash
# Enumerate the new spec to confirm grep works
pnpm exec playwright test --list --grep "Task DR-9.3:"
# Expect exactly 1 test.

# Validate snapshotPathTemplate by running locally and confirming it reads the
# committed reference rather than writing a new one under __screenshots__/.
# If the config is wrong, Playwright writes a NEW file next to the test on
# first run instead of comparing — a freshly-written file would appear under
# tests/e2e/visual-fidelity.spec.ts-snapshots/. Verify AFTER the first run:
ls tests/e2e/visual-fidelity.spec.ts-snapshots/ 2>/dev/null && echo "BAD — template misrouted" || echo "OK — template honors reports/"
```

### L4 — E2E

```bash
# Against live URL
PLAYWRIGHT_BASE_URL=https://hand-tracker-jade.vercel.app \
  pnpm test:e2e --grep "Task DR-9.3:"

# Against local preview
pnpm build --mode test && pnpm preview &
PREVIEW_PID=$!
sleep 5
pnpm test:e2e --grep "Task DR-9.3:"
kill $PREVIEW_PID
```

Debug with trace:

```bash
pnpm test:e2e --grep "Task DR-9.3:" --trace on
pnpm exec playwright show-trace test-results/visual-fidelity-chromium/trace.zip
```

### Re-capture protocol (when the team INTENTIONALLY redesigns)

```bash
PLAYWRIGHT_BASE_URL=https://hand-tracker-jade.vercel.app \
  pnpm test:e2e --update-snapshots --grep "Task DR-9.3:"

# Inspect the updated reference
open reports/DR-8-regression/design-rework-reference.png

# Commit on the same PR that changes the design
git add reports/DR-8-regression/design-rework-reference.png
git commit -m "Task DR-X.Y: Update visual-fidelity reference (reason: <design change>)"
```

---

## Known Gotchas

```typescript
// CRITICAL: PROD builds tree-shake the __handTracker dev hook. The spec must
// NOT assume setFakeLandmarks is callable on the live URL. The capture is
// whatever the fake-webcam (or real camera on dev hardware) yields — in
// Vercel's runner-headless-Chromium case that is testsrc2 / blank frame with
// the mosaic grid visible but no hand region. The reference PNG was captured
// under the SAME conditions, so comparison is apples-to-apples.

// CRITICAL: Viewport must be locked to 1440x900 EXPLICITLY. Playwright's
// default Desktop Chrome profile is 1280x720. A mismatched viewport produces
// a different layout and the diff fails at 100%.

// CRITICAL: snapshotPathTemplate placeholders:
//   {testDir}  = tests/e2e
//   {arg}      = 'design-rework-reference' (passed to toMatchSnapshot)
//   {ext}      = '.png' (appended automatically)
// The template `{testDir}/../reports/DR-8-regression/{arg}{ext}` resolves to
// `reports/DR-8-regression/design-rework-reference.png` — the committed
// reference. Any other resolution points Playwright at a non-existent file
// and the first run WRITES the current capture instead of comparing —
// silent false pass.

// CRITICAL: `animations: 'disabled'` on page.screenshot disables CSS
// transitions + Web Animations for the capture only. Our square→pill hover
// (DR11) uses transitions; without this flag, if the hover state ever kicks
// in mid-capture, pixel diff spikes.

// CRITICAL: `scale: 'css'` ensures HiDPI displays don't capture at 2x
// resolution. The reference is 1440x900 physical pixels; capture must match.

// CRITICAL: 2% threshold is absolute — 0.02 * 1440 * 900 ≈ 25,920 differing
// pixels. Font rendering micro-jitter (sub-pixel positioning across Chromium
// point releases) can eat 0.5-1%; 2% leaves margin for that WITHOUT letting
// structural drift through. If a Chromium version bump blows past 2%,
// FIRST investigate whether the drift is real; only then re-capture.

// CRITICAL: The 2-second waitForTimeout after 'render-canvas is visible' is
// the ONLY hard-coded timing. It exists because PROD strips the dev hook we
// use in dev specs to wait on the first frame. Keep it bounded and noted.

// CRITICAL: --update-snapshots only works when the env permits writes. CI
// runners are read-only for the repo; the human reviewer re-captures on a
// local machine and commits. Do NOT add a workflow that auto-updates
// snapshots on main — that defeats the gate.

// CRITICAL: Do NOT compare against reference-assets/pixelcrash-reference.png.
// That is a pixelcrash.xyz screenshot — a stylistic target, not a rendered
// artifact of our app. DR4 clarifies: the authoritative diff target is the
// one captured from our own deploy (DR-8.R).

// CRITICAL: Live URL can surface stale SW cache after a deploy. If a diff
// fires on a known-good deploy, force-bypass by adding ?nocache=<ts> in the
// page.goto — but only when debugging; remove before commit.
```

---

## Anti-Patterns

- Do NOT compare against `touchdesigner-reference.png` (archived by DR-9.R to `_historical/`).
- Do NOT compare against `pixelcrash-reference.png` — it is a stylistic reference, not a rendered artifact of this app.
- Do NOT use `fullPage: true` — the app is a fixed-viewport SPA; `fullPage` captures identically but incurs extra scroll composition on some Chromium versions.
- Do NOT loosen `maxDiffPixelRatio` beyond 0.02 to "make CI green." If the gate fires on a legitimate change, re-capture the reference and commit it with the design PR.
- Do NOT auto-update snapshots in CI (`--update-snapshots` in a workflow). The reference is a committed artifact that requires human approval.
- Do NOT add more `waitForTimeout` anywhere in the spec — the 2-second first-frame settle is the ONLY permitted timed wait.
- Do NOT compare at a non-1440×900 viewport.
- Do NOT forget `animations: 'disabled'` — transitions mid-capture destabilize the diff.
- Do NOT compare without `scale: 'css'` — HiDPI runners double the resolution and fail.
- Do NOT add unit tests for the diff ratio logic — that is Playwright's responsibility, already unit-tested upstream.

Universal anti-patterns apply (`.claude/skills/prp-task-ralph-loop/SKILL.md` §6).

---

## Skills to Read

- `prp-task-ralph-loop` — Task anatomy + Ralph protocol.
- `hand-tracker-fx-architecture` — Understand what's on screen at default preset (toolbar + sidebar + stage with mosaic grid).
- `playwright-e2e-webcam` — `PLAYWRIGHT_BASE_URL` wiring, COI bake-in check, snapshot pattern, `e2e-preview.yml` integration.
- `vite-vercel-coop-coep` — Service worker + Vercel header quirks that affect first-paint timing.
- `design-tokens-dark-palette` — What the reference looks like; token changes are the #1 source of diff failures.

## Research / Reference Files

- `.claude/orchestration-hand-tracker-fx/tasks/phase-5/task-5-5.md` — Parent task; DR-9.3 supersedes its qualitative 5-item checklist with a quantitative Playwright diff.
- `.claude/orchestration-design-rework/DISCOVERY.md` §DR4 — New reference supersedes TouchDesigner.
- `.claude/orchestration-design-rework/PHASES.md` §DR-9.3 — scope row.
- `reports/DR-8-regression/design-rework-reference.png` — the diff target.
- `reports/DR-8-regression.md` — documents the capture conditions (viewport, preset, flags).

---

## Git

- Branch: `task/DR-9-3-visual-fidelity`
- Commit prefix: `Task DR-9.3:`
- E2E describe prefix: `Task DR-9.3: Visual-fidelity gate`
- Every commit ends with `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>` trailer.
- Fast-forward merge to `main` after `CI / check` is green AND the first `e2e-preview` run after merge is green.
- Mark `5.5` in parent PROGRESS.md mapping row (done via DR-9.3) after merge.

---

## No-Prior-Knowledge Test

- [ ] `reports/DR-8-regression/design-rework-reference.png` exists (1440×900 PNG).
- [ ] `playwright.config.ts` exists; honors `PLAYWRIGHT_BASE_URL`.
- [ ] DR-8.R merged; reference captured.
- [ ] DR-9.1 merged; `e2e-preview.yml` wires `PLAYWRIGHT_BASE_URL` from `deployment_status.target_url`.
- [ ] DR-9.2 merged; PROMPT card doesn't accidentally capture on default navigation.
- [ ] `hand-tracker-jade.vercel.app` is live and returns `crossOriginIsolated: true`.
- [ ] DR4 in DR DISCOVERY.md exists and names the new reference as authoritative.
- [ ] All 4 validation levels runnable from a fresh clone after `pnpm install`.
- [ ] Task is atomic; only DR-9.R is downstream.
