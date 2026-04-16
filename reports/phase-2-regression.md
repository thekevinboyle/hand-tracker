# Phase 2 Regression Report

**Date**: 2026-04-15
**Branch**: `task/2-R-phase-2-regression`
**Build**: `pnpm build --mode test && pnpm preview` (http://localhost:4173 via Playwright webServer)
**Iterations used**: 1 (one diagnostic + fix cycle for grid-layout shape drift)

---

## Validation Levels

| Level | Command | Result | Notes |
| --- | --- | --- | --- |
| L1 | `pnpm biome check .` | PASS | 58 files, 18 ms |
| L1 | `pnpm tsc --noEmit` (via `tsc -b`) | PASS | 0 errors |
| L2 | `pnpm vitest run` | PASS | 160 / 160 tests (14 files, 1.5 s) |
| L3 | `pnpm build --mode test` | PASS | tsc -b + vite build 157 ms, 42 modules, 6 chunks |
| L3 | `curl -I http://localhost:4173/` | PASS | COOP=same-origin, COEP=require-corp, CSP, PP=camera=(self) all present |
| L4 | `pnpm test:e2e --grep "Task"` | PASS | 23 / 23 specs (Phase 1 + Phase 2 aggregate, 1 m 54 s) |
| L4 | `pnpm test:e2e --grep "Task 2.R:"` | PASS | 11 / 11 specs (1 m 04 s) |

---

## Phase 2 Task Status

| Task | Title | L1 | L2 | L3 | L4 | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2.1 | Effect manifest + registry types | PASS | PASS | PASS | PASS | Re-verified via `engine-registry.spec.ts` |
| 2.2 | paramStore + buildPaneFromManifest | PASS | PASS | PASS | PASS | `panel.spec.ts` + default-snapshot assertion |
| 2.3 | Seeded grid generator + 2D overlay | PASS | PASS | PASS | PASS | `grid-overlay.spec.ts` + regression cols[12].length |
| 2.4 | Dotted-circle blobs + xy labels | PASS | PASS | PASS | PASS | `blob-overlay.spec.ts` + injected-landmark blob=5 snap |
| 2.5 | handTrackingMosaic manifest + registration | PASS | PASS | PASS | PASS | `manifest-registration.spec.ts` + full default-param tuple |
| 2.R | (this task) | PASS | PASS | PASS | PASS | 11 / 11 regression specs green |

---

## Regression Checklist

| # | Item | D-numbers | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Panel mounted (3 tabs Grid/Effect/Input) | D19, D36 | PASS | `params-panel` testid visible, `.tp-rotv` visible; step-01 snap shows all 3 tabs |
| 2 | All D4/D9 params bound | D4, D9, D36 | PASS | Default-snapshot assertion verifies seed/columnCount/rowCount/widthVariance/tileSize/blendOpacity/edgeFeather/regionPadding/mirrorMode/showLandmarks |
| 3 | Grid visible over webcam | D4, D18 | PASS | step-01/02 show 12 green columns + 8 rows |
| 4 | Grid non-uniform (variance=0.6) | D4 | PASS | Δ-breakpoint set cardinality > 1 (4-decimal resolution) |
| 5 | Grid live-edit 12→20 re-renders < 2 s | D4, D20 | PASS | `setParam('grid.columnCount', 20)` → `columns.length === 20` within 2 s timeout; step-03 snap confirms |
| 6 | Blob count = 0 on testsrc2 Y4M | D6, D8 | PASS | 1.5 s settle after first tick; `getLandmarkBlobCount() === 0`; step-04 snap |
| 7 | Blob count = 5 on injected landmarks | D6, D8 | PASS | `setFakeLandmarks(21-array)` → `getLandmarkBlobCount() === 5` within 5 s; step-05 snap shows 5 dotted circles + labels |
| 8 | Label format `x: 0.xxx  y: 0.xxx` | D7 | PASS | step-05 shows `x: 0.300  y: 0.400`, `x: 0.370  y: 0.290`, `x: 0.500  y: 0.250`, `x: 0.620  y: 0.290`, `x: 0.700  y: 0.400` — two-space separator + 3-decimal padding |
| 9 | WebGL canvas clears to black (no mosaic) | Phase 2 scope | PASS | center pixel readPixels → `{r:0, g:0, b:0}`; step-06 snap |
| 10 | Mirror default ON (CSS scaleX(-1)) | D10, D27 | PASS | `getComputedStyle('[data-testid=webgl-canvas]').transform` matches `matrix(-1, …)` |
| 11 | `listEffects()` === `['handTrackingMosaic']` | D36 | PASS | Single-effect registry verified via `__engine.listEffects()` |

---

## Non-Visual Assertions

| Assertion | Target | Measured | Result |
| --- | --- | --- | --- |
| `crossOriginIsolated` | `true` | `true` | PASS |
| Console errors (5 s window) | 0 | 0 | PASS |
| Grid re-render latency (12 → 20) | < 2000 ms | < 2000 ms (waitForFunction inside timeout) | PASS |
| Blob inject → count = 5 latency | < 5000 ms | < 5000 ms | PASS |
| COOP / COEP headers on `/` | both present | `same-origin` / `require-corp` | PASS |
| CSP header on `/` | present | default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; … | PASS |

---

## Artifacts

All screenshots captured by `tests/e2e/phase-2-regression.spec.ts`, gitignored
(`reports/**/*.png`). Regenerate with
`pnpm test:e2e --grep "Task 2.R:"`.

- `reports/phase-2-walkthrough/step-01-initial-load.png` (23 KB)
- `reports/phase-2-walkthrough/step-02-grid-cols-before.png` (23 KB)
- `reports/phase-2-walkthrough/step-03-grid-cols-after.png` (25 KB)
- `reports/phase-2-walkthrough/step-04-blobs-testsrc2.png` (23 KB)
- `reports/phase-2-walkthrough/step-05-blobs-injected.png` (29 KB)
- `reports/phase-2-walkthrough/step-06-webgl-black.png` (23 KB)

---

## Decision

- [x] **SHIP** — proceed to Phase 3
- [ ] FIX — open hotfix task 2.N and re-run regression

Every D-number gated by Phase 2 (D4, D6, D7, D8, D9, D10, D13, D19, D20, D27, D31, D36, D37, D38) is green. The engine + overlay contract is stable and safe for Phase 3 to extend with the WebGL mosaic shader.

---

## Deviations from Plan

Three drifts between `task-2-R.md` (written before Tasks 2.1–2.5 landed) and
the as-implemented codebase required adaptation. All deviations are spec-only
(or one-commit scaffold hotfixes); no Phase 2 source module had its contract
changed.

1. **Dev-hook shape is nested, not flat.** Task file assumed
   `window.__handTracker.{getParam, setParam, getLandmarkBlobCount,
   lastGridLayout, listRegisteredEffects}`; the actual shape is
   `window.__handTracker.__engine.{getParam, setParam, getLandmarkBlobCount,
   lastGridLayout, listEffects}` — built up incrementally across Tasks 2.1,
   2.2, 2.5. The regression spec queries the real shape. Also
   `lastGridLayout` is a function (`__getLastGridLayout`), not a property —
   spec calls it with `lastGridLayout?.()`.

2. **`setFakeLandmarks` was not yet wired.** Architecture skill scopes it to
   Task 3.3, but Task 2.R's "blob count = 5 on injected landmarks" checklist
   row depends on it. Committed as a focused hotfix earlier on this branch
   (see `ca8ab8c — Task 2.R (hotfix): Add setFakeLandmarks dev hook +
   render-loop override`). The hotfix introduces
   `src/engine/landmarkOverride.ts` as a shared broker and wires a
   test-gated override into `startRenderLoop`; detection still runs every
   frame so MediaPipe's monotonic-timestamp invariant is preserved.

3. **`VITE_DEV_HOOKS=1` env var does not exist.** The synergy review
   (findings #14 / #27 in
   `.claude/orchestration-hand-tracker-fx/reports/synergy-review-phases-1-3.md`)
   pre-identified this drift — resolution was to standardise on
   `import.meta.env.MODE === 'test'`. The Playwright webServer already runs
   `pnpm build --mode test && pnpm preview`, so dev hooks materialise
   automatically when the suite runs. The regression commands were adapted:
   `pnpm test:e2e --grep "Task"` / `pnpm test:e2e --grep "Task 2.R:"`,
   bypassing the stale `PLAYWRIGHT_BASE_URL=http://localhost:4173
   VITE_DEV_HOOKS=1` incantation in the task file.

4. **`GridLayout` shape.** Task file assumed `{columnCount, rowCount, widths,
   heights}`; actual is `{columns: Breakpoints, rows: Breakpoints}` (see
   `src/effects/handTrackingMosaic/grid.ts`). Regression spec uses
   `.columns.length` / `.rows.length` for count, and breakpoint-deltas for
   the non-uniformity check.

5. **Panel testid.** Task file referenced `tweakpane-root`; actual testid on
   the panel container is `params-panel` (Task 2.2's
   `src/ui/Panel.tsx:40`). Spec queries the real testid and additionally
   asserts `.tp-rotv` visibility for belt-and-braces.

6. **Mirror assertion target.** Task file queried
   `[data-testid="render-canvas"]` for the `scaleX(-1)` transform — but
   `render-canvas` is a transparent bounding-box `<div>` added by Task 1.6
   for screenshot framing. The CSS `scaleX(-1)` actually applies to
   `.stage-canvas` (i.e. the WebGL + overlay canvases) via
   `.stage[data-mirror="true"] .stage-canvas { transform: scaleX(-1) }`.
   Spec queries `canvas[data-testid="webgl-canvas"]`.
