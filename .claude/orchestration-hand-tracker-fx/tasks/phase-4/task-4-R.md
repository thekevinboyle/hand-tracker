# Task 4.R: Phase 4 Regression

**Phase**: 4 — Modulation, Presets, Record, A11y
**Branch**: `task/4-R-phase-4-regression`
**Commit prefix**: `Task 4.R:`
**Estimated complexity**: High
**Max Ralph iterations**: 30

---

## Goal

**Feature Goal**: End-to-end verify every Phase 4 deliverable against a locally-built production bundle: default preset loads, modulation drives params live, Save/Save-As/Delete/Export/Import work, chevron + Arrow keys cycle presets, Record produces a playable .webm, and `prefers-reduced-motion` pauses modulation — all against `pnpm build && pnpm preview` (D42 rule).

**Deliverable**:
- `e2e/phase-4-regression.spec.ts` — Playwright spec covering the full Phase 4 user flow
- `reports/phase-4-walkthrough.png` sequence (≥6 screenshots captured by the spec via `browser_take_screenshot`)
- `reports/phase-4-regression.md` — summary report (iteration count, validation matrix, any deviations)

**Success Definition**: `pnpm test:e2e -- --grep "Task 4.R:"` exits 0 against the production preview build; all L1–L4 green; screenshots attached; no skipped assertions.

---

## User Persona

**Target User**: The full MVP creative-technologist user flow — touch every Phase 4 surface in one run.

**Use Case**: A regression gate before merging Phase 4 to main. One Playwright run proves that 4.1–4.6 haven't drifted against each other.

**User Journey** (matches the E2E spec):
1. Launch preview build at `http://localhost:4173`.
2. Wait for GRANTED state with fake device media stream.
3. Confirm default preset loaded — `mosaic.tileSize === 16`, `grid.columnCount === 12` (reference screenshot values).
4. Fake-inject landmarks via `page.evaluate` — `landmark[8].x = 0.9, y = 0.1`.
5. Assert modulation fired — `paramStore.snapshot.mosaic.tileSize` > 48 (near upper bound).
6. Click Save As → type "Phase4-Test" → verify listed.
7. Click next chevron → preset cycles to "Phase4-Test".
8. Press ArrowLeft → returns to "Default".
9. Click Record → wait 3 seconds → click Record → verify download event fired with `.webm` filename.
10. Call `page.emulateMedia({ reducedMotion: 'reduce' })`.
11. Fake-inject new landmarks → assert `tileSize` does NOT change (modulation paused).
12. Open CubicBezier curve in Modulation panel → drag a handle → verify `modulationStore.getSnapshot().routes[0].bezierControlPoints` updated.

**Pain Points Addressed**: Integration bugs that only surface when two or more Phase 4 deliverables interact (cycler + refresh, recording while modulating, preset load with CubicBezier curve).

---

## Why

- D42 mandates a regression pass at the end of every phase using the closest-to-live build.
- The individual Task 4.N files each have focused unit tests; this task proves they compose correctly.
- Gate for merging `task/4-*` branches to `main`.
- Screenshot sequence becomes the Phase 4 acceptance artifact for the Phase 5 deploy gate.

---

## What

- Single Playwright spec file exercising the full flow above.
- Uses `pnpm build && pnpm preview` — NOT the dev server.
- Fake-device media stream via Chromium `--use-fake-device-for-media-stream` launch arg (Phase 1 config).
- Landmark injection helper: `page.evaluate((lms) => window.__test__.injectLandmarks(lms), ...)` — requires the app to expose a `window.__test__` namespace guarded by `import.meta.env.MODE === 'test'` or a dedicated Playwright build flag.
- Download capture via `page.on('download', ...)`.
- Reduced-motion emulation via `page.emulateMedia({ reducedMotion: 'reduce' })`.
- Screenshot at each major step, saved to `reports/phase-4-walkthrough/step-N-{label}.png`.

### NOT Building (scope boundary)

- No new library dependencies.
- No changes to Phase 1–3 infrastructure (Playwright config is assumed correct from Phase 1.6).
- No Vercel preview test — that is Phase 5.R.
- No coverage gate beyond the manual assertion list.
- No visual-diff tooling (reference screenshot compare is Phase 5).

### Success Criteria

- [ ] `pnpm build` succeeds
- [ ] `pnpm preview` serves on localhost:4173
- [ ] `pnpm test:e2e -- --grep "Task 4.R:"` exits 0 with the preview URL as base
- [ ] `reports/phase-4-walkthrough/*.png` contains ≥6 screenshots with readable UI
- [ ] `reports/phase-4-regression.md` lists every Phase 4 task + pass/fail
- [ ] Full `pnpm vitest run`, `pnpm biome check .`, `pnpm tsc --noEmit` green (L1/L2 regression)

---

## All Needed Context

```yaml
files:
  - path: e2e/
    why: Playwright specs directory (created Phase 1.6); this task adds one more spec
    gotcha: Spec files match `e2e/**/*.spec.ts` — do not put it in tests/

  - path: playwright.config.ts
    why: Confirms baseURL and launch args; regression run needs baseURL = preview (localhost:4173)
    gotcha: If baseURL is localhost:5173 (dev), override via PLAYWRIGHT_BASE_URL env var in the regression command

  - path: src/main.tsx
    why: May need a test-only `window.__test__` namespace for landmark injection
    gotcha: Gate behind `if (import.meta.env.MODE === 'test' || import.meta.env.DEV)` so production does not ship the hook

  - path: src/engine/paramStore.ts
    why: Reading paramStore.snapshot via page.evaluate requires paramStore be reachable — expose via window.__test__
    gotcha: Do NOT expose paramStore in production

  - path: .claude/orchestration-hand-tracker-fx/tasks/phase-4/task-4-1.md — task-4-6.md
    why: Each task's Success Criteria is a checklist to re-verify here
    gotcha: Any failure reruns the individual task's Ralph loop, not this one

urls:
  - url: https://playwright.dev/docs/emulation#color-scheme-and-media
    why: page.emulateMedia({ reducedMotion: 'reduce' }) API
    critical: Emulation applies at the page level — matchMedia listeners in the app fire on emulateMedia() call

  - url: https://playwright.dev/docs/downloads
    why: page.on('download', ...) and download.suggestedFilename()
    critical: Downloads fire at MediaRecorder stop time; wait for the event before asserting

skills:
  - playwright-e2e-webcam
  - vite-vercel-coop-coep
  - hand-tracker-fx-architecture

discovery:
  - D42: Phase regression — run against production preview build (pnpm build && pnpm preview)
  - D21: Playwright E2E uses --use-fake-device-for-media-stream
  - D26: Reduced-motion — runtime toggle supported (tested here via emulateMedia)
  - D28: Record spec — .webm download
  - D29/D30: Preset schema + UI
```

### Current Codebase Tree

```
e2e/
  (existing Phase 1.6 spec)
playwright.config.ts
reports/
  (tool-verification.md already exists)
```

### Desired Codebase Tree

```
e2e/
  phase-4-regression.spec.ts           # CREATE
reports/
  phase-4-walkthrough/                 # CREATE (dir)
    step-01-initial-load.png
    step-02-modulation-live.png
    step-03-preset-saved.png
    step-04-preset-cycled.png
    step-05-recording.png
    step-06-reduced-motion.png
  phase-4-regression.md                # CREATE — summary report
src/main.tsx                       # MODIFY — add guarded window.__test__ hook
```

### Known Gotchas

```typescript
// CRITICAL: The regression MUST target the preview build, not dev.
// Launch it in a background process and run Playwright with its URL:
//
//   pnpm build
//   pnpm preview &   # serves on 4173
//   PLAYWRIGHT_BASE_URL=http://localhost:4173 pnpm test:e2e -- --grep "Task 4.R:"
//
// Dev-server regressions are silently wrong because COOP/COEP/CSP differ.

// CRITICAL: window.__test__ is a test-only hook. Gate it in main.tsx:
//
//   if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
//     ;(window as Window & { __test__?: unknown }).__test__ = {
//       paramStore,
//       modulationStore,
//       injectLandmarks: (lms: Landmark[]) => { /* push into handLandmarker buffer */ },
//     }
//   }
//
// The `build` used by `pnpm preview` defaults to MODE=production, so this hook is
// absent in preview unless you build with `MODE=test`. Easiest fix: a dedicated
// `pnpm build:test` script that sets MODE=test, and use that for the regression.
// If that pattern is already established (Phase 1.6), use it; otherwise document
// and add to package.json scripts.

// CRITICAL: Playwright downloads require `page.waitForEvent('download', { timeout })`
// BEFORE the trigger click, or a Promise.all race. Missing this races and fails flakily.

// CRITICAL: emulateMedia({ reducedMotion: 'reduce' }) synchronously updates matchMedia.matches
// AND fires the change event the next tick. Add `await page.waitForTimeout(100)` after
// emulateMedia before asserting modulated behavior.

// CRITICAL: Screenshots via `page.screenshot({ path, fullPage: true })` or via
// Playwright MCP browser_take_screenshot. Either way, create the target dir first
// (Node's fs.mkdir recursive) — Playwright does not auto-create parents.

// CRITICAL: Do NOT commit any screenshots that contain a real webcam feed. The fake
// device stream is a solid color pattern; this is safe. If running locally against
// a real webcam, the test will fail the assertion on landmark-injection anyway.

// CRITICAL: Biome v2, pnpm, no 'use client'. Standard rules.
```

---

## Implementation Blueprint

### Data Models

No new types — consumes Phase 4 types via the app under test.

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: MODIFY src/main.tsx
  - FIND: bootstrap block (before createRoot().render())
  - ADD: |
      if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
        (window as unknown as { __test__: unknown }).__test__ = {
          paramStore,
          modulationStore,
          presetCycler: () => import('../ui/PresetCycler').then(m => m.presetCycler),
          injectLandmarks: (lms: Landmark[]) => handLandmarker.setMockLandmarks(lms),
        }
      }
  - PRESERVE: existing initializePresetsIfEmpty() call + root render
  - GOTCHA: handLandmarker.setMockLandmarks may not exist; if so, add it in a minimal mod to tracking/handLandmarker.ts guarded by MODE === 'test'
  - VALIDATE: pnpm build (should not emit the test hook in a prod build because MODE==='production')

Task 2: CREATE e2e/phase-4-regression.spec.ts
  - IMPLEMENT: single describe block with one test matching /Task 4\.R:/ that runs all 12 journey steps
  - STRUCTURE: |
      import { test, expect } from '@playwright/test'
      import fs from 'node:fs/promises'
      import path from 'node:path'

      const SHOT_DIR = 'reports/phase-4-walkthrough'

      async function snap(page, label: string, n: number) {
        await fs.mkdir(SHOT_DIR, { recursive: true })
        await page.screenshot({
          path: path.join(SHOT_DIR, `step-${String(n).padStart(2, '0')}-${label}.png`),
          fullPage: true,
        })
      }

      test('Task 4.R: Phase 4 full regression', async ({ page }) => {
        // Step 1: Load + GRANTED
        await page.goto('/')
        await expect(page.locator('[data-state="GRANTED"]')).toBeVisible({ timeout: 10000 })
        await snap(page, 'initial-load', 1)

        // Step 2: Default preset loaded
        await expect(page.locator('.preset-name')).toHaveText('Default')

        // Step 3: Modulation drives params
        await page.evaluate(() => {
          const t = (window as any).__test__
          t.injectLandmarks(Array.from({ length: 21 }, (_, i) => ({ x: i === 8 ? 0.9 : 0.5, y: i === 8 ? 0.1 : 0.5, z: 0 })))
        })
        await page.waitForTimeout(100)
        const tileSize = await page.evaluate(() => (window as any).__test__.paramStore.snapshot.mosaic.tileSize)
        expect(tileSize).toBeGreaterThan(48)
        await snap(page, 'modulation-live', 2)

        // Step 4: Save As → "Phase4-Test"
        page.on('dialog', (d) => d.accept('Phase4-Test'))
        await page.getByRole('button', { name: /save as/i }).click()
        await snap(page, 'preset-saved', 3)

        // Step 5: Cycle to the new preset
        await page.keyboard.press('ArrowRight')
        await expect(page.locator('.preset-name')).toHaveText('Phase4-Test')
        await snap(page, 'preset-cycled', 4)

        // Step 6: Back to Default
        await page.keyboard.press('ArrowLeft')
        await expect(page.locator('.preset-name')).toHaveText('Default')

        // Step 7: Record 3 seconds
        await page.getByRole('button', { name: /^rec/i }).click()
        await snap(page, 'recording', 5)
        await page.waitForTimeout(3000)
        const downloadPromise = page.waitForEvent('download')
        await page.getByRole('button', { name: /^rec/i }).click()
        const download = await downloadPromise
        expect(download.suggestedFilename()).toMatch(/^hand-tracker-fx-.*\.webm$/)

        // Step 8: Reduced motion
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.waitForTimeout(200)
        const tsBefore = await page.evaluate(() => (window as any).__test__.paramStore.snapshot.mosaic.tileSize)
        await page.evaluate(() => {
          const t = (window as any).__test__
          t.injectLandmarks(Array.from({ length: 21 }, (_, i) => ({ x: i === 8 ? 0.1 : 0.5, y: i === 8 ? 0.9 : 0.5, z: 0 })))
        })
        await page.waitForTimeout(200)
        const tsAfter = await page.evaluate(() => (window as any).__test__.paramStore.snapshot.mosaic.tileSize)
        expect(tsAfter).toBe(tsBefore)
        await snap(page, 'reduced-motion', 6)
      })
  - MIRROR: existing Phase 1.6 e2e spec (for config + import order)
  - VALIDATE: pnpm build && pnpm preview & sleep 3 && PLAYWRIGHT_BASE_URL=http://localhost:4173 pnpm test:e2e -- --grep "Task 4.R:"

Task 3: CREATE reports/phase-4-regression.md
  - IMPLEMENT: |
      # Phase 4 Regression Report

      **Date**: {ISO}
      **Preview URL**: http://localhost:4173
      **Build**: `pnpm build` (production mode with MODE=test flag for window.__test__ hook)

      ## Task Status
      | Task | Title | L1 | L2 | L3 | L4 |
      |------|-------|----|----|----|----|
      | 4.1  | ModulationRoute evaluator + defaults | PASS | PASS | PASS | N/A |
      | 4.2  | CubicBezier blade + modulation UI    | PASS | PASS | PASS | N/A |
      | 4.3  | Preset schema + persistence           | PASS | PASS | PASS | N/A |
      | 4.4  | Preset chevron cycler + ArrowKeys     | PASS | PASS | PASS | PASS |
      | 4.5  | Record → MediaRecorder → .webm        | PASS | PASS | PASS | PASS |
      | 4.6  | prefers-reduced-motion                | PASS | PASS | PASS | PASS |
      | 4.R  | (this task)                           | PASS | PASS | PASS | PASS |

      ## Walkthrough Screenshots
      See `reports/phase-4-walkthrough/step-*.png`.

      ## Deviations from Plan
      (fill at completion — "None" if clean)

      ## Iterations used
      {N}
  - VALIDATE: file exists with real content (no placeholders after completion)
```

### Integration Points

```yaml
PREVIEW_BUILD:
  - Sequence: pnpm build && pnpm preview (background) → Playwright → kill preview
  - Port: 4173 (Vite default for preview)

WINDOW_TEST_HOOK:
  - Gate behind import.meta.env.DEV || MODE === 'test'
  - Exposes paramStore, modulationStore, injectLandmarks

PLAYWRIGHT_CONFIG:
  - baseURL override via PLAYWRIGHT_BASE_URL env var
  - --use-fake-device-for-media-stream already in Phase 1.6 launch args
```

---

## Validation Loop

### Level 1 — Syntax & Style

```bash
pnpm biome check e2e/phase-4-regression.spec.ts src/main.tsx
pnpm tsc --noEmit
```

### Level 2 — Unit Tests (Phase 4 regression)

```bash
pnpm vitest run
```

Must include all Phase 4 unit suites green (4.1 modulation, 4.3 presets, 4.4 PresetBar, 4.5 useRecorder, 4.6 reducedMotion).

### Level 3 — Production Build

```bash
pnpm build
```

### Level 4 — E2E against Preview

```bash
# Start preview in the background
pnpm preview &
PREVIEW_PID=$!
sleep 3

# Run regression
PLAYWRIGHT_BASE_URL=http://localhost:4173 pnpm test:e2e -- --grep "Task 4.R:"
E2E_STATUS=$?

# Cleanup
kill $PREVIEW_PID
exit $E2E_STATUS
```

All 6+ screenshots must exist under `reports/phase-4-walkthrough/` after the run.

---

## Final Validation Checklist

### Technical

- [ ] All 4 levels exit 0 against the preview build
- [ ] `pnpm biome check .` — zero errors
- [ ] `pnpm tsc --noEmit` — zero errors
- [ ] `pnpm vitest run` — all tests pass (Phase 1–4 aggregated)
- [ ] `pnpm build` — success
- [ ] Preview E2E — success

### Feature

- [ ] Default preset loads on fresh launch
- [ ] Modulation drives params live via injected landmarks
- [ ] Save As → preset persists and cycles
- [ ] ArrowLeft/ArrowRight cycle works at the window level
- [ ] Record produces a `.webm` download with correct filename pattern
- [ ] `emulateMedia({ reducedMotion: 'reduce' })` pauses modulation (tileSize unchanged)
- [ ] CubicBezier blade drag updates modulationStore (manual via Playwright MCP if needed)
- [ ] Screenshots cover all 6 steps and are legible

### Code Quality

- [ ] `window.__test__` gated behind MODE check (not in production bundle)
- [ ] No `any` leaked into production code (test-only casts allowed in spec file)
- [ ] Regression report lists every Phase 4 task
- [ ] No new package dependencies added

---

## Anti-Patterns

- Do not run the regression against `pnpm dev` — D42 requires the preview build.
- Do not expose `window.__test__` unconditionally — must be gated or prod bundle leaks internals.
- Do not assert exact `tileSize` values under modulation — use ranges to tolerate rounding.
- Do not skip the reduced-motion step because it's the last one — it's the D26 gate.
- Do not forget to kill the preview server after E2E — leaves port 4173 bound.
- Do not run L4 before L1/L2/L3 — if units regressed, fix them first.
- Do not accept a flaky run as "PASS" — flake indicates a race (likely around `page.waitForTimeout`); fix it.

---

## No Prior Knowledge Test

- [ ] All Phase 4 task files (4.1–4.6) exist and reference the same Phase 4 paths as this task
- [ ] Playwright config from Phase 1.6 supports `--use-fake-device-for-media-stream`
- [ ] `pnpm preview` is a valid script in package.json (Vite default)
- [ ] D42 cited; its language about "closest-to-live build" matches the preview-build approach here
- [ ] Screenshot directory path matches PHASES.md line `reports/phase-4-walkthrough.png sequence`

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
.claude/skills/vite-vercel-coop-coep/SKILL.md
.claude/skills/tweakpane-params-presets/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
.claude/skills/webcam-permissions-state-machine/SKILL.md
```
