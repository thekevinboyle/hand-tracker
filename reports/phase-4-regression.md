# Phase 4 Regression Report

**Date**: 2026-04-16
**Branch**: `task/4-R-phase-4-regression`
**Preview**: `pnpm build --mode test && pnpm preview` (http://localhost:4173, via the committed Playwright webServer)
**Iterations**: 3 (1 ordering fix for presetCycler seed + 2 z-index tweaks for PresetActions / RecordButton to stay above Tweakpane)

---

## Validation Levels

| Level | Command | Result | Notes |
| --- | --- | --- | --- |
| L1 | `pnpm biome check .` | PASS | 92 files |
| L1 | `pnpm tsc --noEmit` | PASS | 0 errors |
| L2 | `pnpm vitest run` | PASS | 330 / 330 tests across 25 files (1.6 s) |
| L3 | `pnpm build --mode test` | PASS | 105 ms |
| L4 | `pnpm test:e2e --grep "Task 4.R:"` | PASS | 1 / 1 spec (11.0 s) |
| L4 | `pnpm test:e2e --grep "Task"` | PASS | 45 / 45 specs (3 m 30 s) |

---

## Phase 4 Task Status

| Task | Title | L1 | L2 | L3 | L4 | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 4.1 | ModulationRoute evaluator + defaults | PASS | PASS | PASS | PASS (via 4.R) | 25 unit tests; render-loop integration completed in 4.6 |
| 4.2 | CubicBezier blade + modulation panel UI | PASS | PASS | PASS | PASS (via 4.R) | modulationStore + ModulationPanel; `interval` is an INPUT plugin, not a blade (corrected) |
| 4.3 | Preset schema + localStorage + import/export | PASS | PASS | PASS | PASS (via 4.R) | 27 unit tests; Node-25 localStorage polyfill in setup.ts |
| 4.4 | Preset chevron cycler + Arrow keys | PASS | PASS | PASS | PASS | 13 unit tests; Task 4.R exercises both chevrons + ArrowLeft |
| 4.5 | Record → MediaRecorder → .webm | PASS | PASS | PASS | PASS | 13 unit + 2 E2E tests; Task 4.R re-exercises the full record cycle |
| 4.6 | `prefers-reduced-motion` handling | PASS | PASS | PASS | PASS (via 4.R) | 9 unit tests; Task 4.R runs `emulateMedia({ reducedMotion: 'reduce' })` |
| 4.R | (this task) | PASS | PASS | PASS | PASS | 6 walkthrough PNG artifacts captured |

---

## Walkthrough Artifacts

All gitignored via `reports/**/*.png` — regenerate with `pnpm test:e2e --grep "Task 4.R:"`.

| # | File | Size | Covers |
| --- | --- | --- | --- |
| 1 | `step-01-initial-load.png` | 33 KB | GRANTED state + Default preset visible |
| 2 | `step-02-modulation-live.png` | 91 KB | Injected `landmark[8].x=0.9` → `mosaic.tileSize` jumps to ~58 |
| 3 | `step-03-preset-saved.png` | 95 KB | `Save As` prompt accepted → current preset input reads "Phase4-Test" |
| 4 | `step-04-preset-cycled.png` | 98 KB | Next chevron → PresetBar no longer shows "Default" |
| 5 | `step-05-recording.png` | 101 KB | Record button flipped to "Stop recording" state |
| 6 | `step-06-reduced-motion.png` | 94 KB | After `emulateMedia({ reducedMotion: 'reduce' })`, tileSize held stable despite new landmark inject |

---

## User Journey Coverage

| # | Step | D-numbers | Result |
| --- | --- | --- | --- |
| 1 | App boots, `camera-state === 'GRANTED'` | D21 | PASS |
| 2 | PresetBar renders "Default" | D30 | PASS |
| 3 | `setFakeLandmarks({landmark[8].x=0.9})` drives `mosaic.tileSize > 48` | D13 | PASS |
| 4 | `Save As` accepts the "Phase4-Test" prompt + persists | D29, D30 | PASS |
| 5 | Right chevron advances the cycler | D11, D30 | PASS |
| 6 | ArrowLeft returns to the prior preset | D30 | PASS |
| 7 | Record → Stop → `.webm` download with timestamped filename | D28 | PASS |
| 8 | `emulateMedia({ reducedMotion: 'reduce' })` freezes modulation | D26 | PASS |
| 9 | Zero console errors across the run | — | PASS |

---

## Decision

- [x] **SHIP** — proceed to Phase 5 (deploy)
- [ ] FIX — open hotfix task 4.N and re-run regression

Every Phase 4 D-number (D11, D13, D14, D15, D19, D20, D26, D28, D29, D30) is green. The full `save preset → cycle → record → pause modulation` flow works end-to-end in the production preview build.

---

## Deviations from Plan

Four adaptations vs `task-4-R.md`, all resolved in-spec or via targeted fixes — no new library deps, no API surface changes.

1. **Dev-hook surface.** Task file expected a new `window.__test__` namespace; the existing
   `window.__handTracker.__engine.{setFakeLandmarks, getParam, setParam}` already covers
   every probe point, so the regression spec uses the established shape. Same adaptation
   pattern as 2.R / 3.R.

2. **Spec directory.** Task file referenced `e2e/`; this project's Playwright specs live in
   `tests/e2e/` (Task 1.1 decision). Spec placed accordingly.

3. **Preview orchestration.** Task file called for manual
   `pnpm preview & … PLAYWRIGHT_BASE_URL=http://localhost:4173 …` ceremony. Playwright's
   committed `webServer` already runs `pnpm build --mode test && pnpm preview` on port
   4173 with `MODE=test` baking in the dev hooks. No env-var incantation needed.

4. **PresetBar initial empty state.** The `presetCycler` module singleton constructed
   via the `App → PresetBar → PresetCycler` import chain BEFORE `main.tsx` called
   `initializePresetsIfEmpty()`, so the cycler's first snapshot was empty and the
   bar showed "—" instead of "Default". Fixed by calling `presetCycler.refresh()`
   at the end of `main.tsx` bootstrap — one-line, tests-unchanged.

Two z-index tweaks on top of that:

- **`PresetActions`** was behind Tweakpane's default-fixed panel; made it
  `position: fixed; top: 0; zIndex: 100` so the Save / Save As / Delete / Export /
  Import buttons are always clickable.
- **`RecordButton`** then collided with the PresetActions bar; moved it to
  `top: 50; zIndex: 110` so both float above Tweakpane without overlapping.
