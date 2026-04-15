# Task 2.R: Phase 2 Regression — Engine + Overlay vs Live Webcam

**Phase**: 2 — Engine + Overlay
**Branch**: `task/2-R-phase-2-regression`
**Commit prefix**: `Task 2.R:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Verify the combined Phase 2 pipeline (Tasks 2.1–2.5) by running all four validation levels against a fresh `pnpm build && pnpm preview` production build, then driving a Playwright MCP session that (a) confirms the Tweakpane panel renders with every D4/D9 param, (b) edits `grid.columnCount` live and screenshots the re-rendered grid, and (c) asserts the fingertip blob count with both a synthetic testsrc2 Y4M (count === 0, deterministic) and — where available — a real-hand Y4M or injected fake landmarks (count === 5). **No mosaic effect yet** — the WebGL canvas clears to black; the Phase 3 regression is where visual mosaic fidelity is gated.

**Deliverable**:
- `tests/e2e/phase-2-regression.spec.ts` — automated Playwright spec covering the programmatic portion of the phase checklist
- `reports/phase-2-walkthrough/step-01-initial-load.png` — panel + grid + webcam visible
- `reports/phase-2-walkthrough/step-02-grid-cols-before.png` — grid at `columnCount = 12`
- `reports/phase-2-walkthrough/step-03-grid-cols-after.png` — grid at `columnCount = 20` (after live panel edit)
- `reports/phase-2-walkthrough/step-04-blobs-testsrc2.png` — blob overlay with synthetic Y4M (expected count = 0)
- `reports/phase-2-walkthrough/step-05-blobs-injected.png` — blob overlay with injected fake landmarks (expected count = 5)
- `reports/phase-2-walkthrough/step-06-webgl-black.png` — WebGL canvas still clears to black (no mosaic, as designed for Phase 2)
- `reports/phase-2-regression.md` — summary report with validation matrix, D-number coverage table, and ship/fix decision

**Success Definition**: `pnpm check && pnpm build && pnpm preview` (preview in background) + `PLAYWRIGHT_BASE_URL=http://localhost:4173 VITE_DEV_HOOKS=1 pnpm test:e2e -- --grep "Task 2.R:"` all exit 0. All 6 walkthrough screenshots exist and are non-empty. `reports/phase-2-regression.md` is filled in with every checklist row PASS (or explicit FAIL with a linked hotfix task). The project can move to Phase 3 with confidence that the engine/overlay contract is stable.

---

## User Persona

**Target User**: Project maintainer (the human) approving Phase 2 before Phase 3 begins.

**Use Case**: Phase 2 is the first phase where visible output appears in the browser — grid lines, fingertip blobs, a working parameters panel. Before the Phase 3 agent starts wiring the real WebGL mosaic shader (which depends on every piece of Phase 2 being correct), the maintainer needs a green regression gate.

**User Journey**:
1. Maintainer checks out `task/2-R-phase-2-regression` and starts the Ralph loop
2. Ralph runs L1–L4 against a fresh production build
3. Ralph spawns a Playwright MCP session that navigates to the preview URL, waits for GRANTED state, and captures the 6-step walkthrough
4. Ralph verifies that `grid.columnCount` edits in Tweakpane propagate to the 2D overlay within one rVFC tick
5. Ralph asserts blob count behavior under two landmark sources (synthetic Y4M vs injected fake landmarks)
6. Ralph writes `reports/phase-2-regression.md` with the full validation matrix
7. Maintainer reviews the screenshots and report; if green → merge `task/2-R-*` → `main`, begin Phase 3

**Pain Points Addressed**: Without this regression gate, subtle integration bugs between `paramStore`, `buildPaneFromManifest`, `gridRenderer`, `blobRenderer`, and the `handTrackingMosaic` manifest wouldn't surface until Phase 3, where they would compound with new shader-specific bugs. This task quarantines Phase 2 as a known-good baseline.

---

## Why

- Satisfies D42 — "The last task of every phase is a regression pass that runs all 4 validation levels on every task in the phase against the closest-to-live build (local production build via `pnpm build && pnpm preview`)."
- Closes out the DISCOVERY decisions assigned to Phase 2: D4 (grid), D6 (fingertip blobs), D7 (label format), D9 (mosaic params declared in panel), D13 (modulation sources declared), D19 (Tweakpane + Essentials), D20 (paramStore), D36 (EffectManifest shape), D37 (FrameContext shape), D38 (folder layout).
- Produces persistent walkthrough artifacts (`reports/phase-2-walkthrough/step-*.png`) that Phase 3 can visually diff against to confirm it has not regressed grid/blob rendering while adding the mosaic shader.
- Locks in the dev-hook contract (`window.__handTracker.getParam(dotPath)`, `.getLandmarkBlobCount()`, `.lastGridLayout`, `.setFakeLandmarks(...)`) that every Phase 3/4/5 E2E spec will depend on.

---

## What

- All four validation levels green on a fresh `pnpm build && pnpm preview` production build (NOT `pnpm dev`)
- Automated Playwright spec (`tests/e2e/phase-2-regression.spec.ts`) with describe block titled `Task 2.R: Phase 2 regression — engine + overlay` that:
  - Asserts `crossOriginIsolated === true` on the preview URL
  - Asserts the Tweakpane panel is mounted and contains each of the 13+ parameter bindings declared by the `handTrackingMosaic` manifest (Grid, Effect, Input pages)
  - Asserts `listEffects()` via dev hook returns exactly `['handTrackingMosaic']`
  - Asserts default param snapshot matches DISCOVERY values (seed=42, columnCount=12, rowCount=8, widthVariance=0.6, tileSize=16, blendOpacity=1.0, edgeFeather=0, regionPadding=1, mirrorMode=true, showLandmarks=true)
  - Edits `grid.columnCount` from 12 → 20 via direct `paramStore.set('grid.columnCount', 20)` (dev hook) AND by driving the Tweakpane binding via a DOM click + keyboard sequence; asserts grid layout updates within 200 ms (one or two rVFC ticks)
  - Captures `step-02-grid-cols-before.png` (at count=12) and `step-03-grid-cols-after.png` (at count=20)
  - Asserts blob count behavior:
    - With the committed `tests/assets/fake-hand.y4m` Y4M (synthetic testsrc2 pattern, no detectable hand): `window.__handTracker.getLandmarkBlobCount()` returns 0 after a 5-second warmup window
    - With `window.__handTracker.setFakeLandmarks(<21 landmarks>)` injected: `getLandmarkBlobCount()` returns 5 within one rVFC tick
  - Captures `step-04-blobs-testsrc2.png` and `step-05-blobs-injected.png`
  - Asserts the WebGL canvas (`[data-testid="webgl-canvas"]`) is present and renders a black clear (not the mosaic) — a `readPixels` at the canvas center should be `[0, 0, 0, 255]` (or `[0, 0, 0, 0]` if `preserveDrawingBuffer` is set but alpha is 0; accept either in the assertion)
  - Captures `step-06-webgl-black.png`
  - Records zero console errors and zero unhandled rejections across a 5-second capture window
- Playwright MCP session (complementary, human-reviewed) mirrors the above and saves the step PNGs to `reports/phase-2-walkthrough/`
- `reports/phase-2-regression.md` enumerating every Phase 2 task's L1–L4 status + the walkthrough checklist

### Explicit Phase 2 Regression Checklist (from PHASES.md Task 2.R + D-number contracts)

The report MUST enumerate every item below with PASS / FAIL / N-A:

1. **Panel mounted** — `<Panel />` visible with 3 tabs (Grid, Effect, Input) per `handTrackingMosaicManifest` (D19, D36)
2. **All params bound** — Tweakpane exposes every D4/D9 param + `input.mirrorMode` + `input.showLandmarks` + `grid.randomize` button (13+ bindings)
3. **Grid visible** — grid lines drawn over the webcam (D4)
4. **Grid non-uniform** — seeded `widthVariance=0.6` produces visibly non-uniform column widths (D4)
5. **Grid live-edit** — changing `grid.columnCount` 12 → 20 in the panel re-renders the grid within 200 ms (no reload) (D4, D20)
6. **Blob count = 0 on synthetic Y4M** — with the testsrc2 Y4M fake stream, `getLandmarkBlobCount()` stabilizes at 0 (D6, D8)
7. **Blob count = 5 on injected landmarks** — with `setFakeLandmarks([...21 landmarks...])`, `getLandmarkBlobCount()` returns 5 (D6, D8)
8. **Blob label format** — when blobs are present, at least one `data-testid="landmark-label"` element (or dev-hook-returned label string) matches `/^x: \d\.\d{3} {2}y: \d\.\d{3}$/` (D7)
9. **WebGL canvas clears to black (no mosaic yet)** — `step-06-webgl-black.png` shows the WebGL canvas is black / transparent, the 2D overlay shows grid + blobs (D9, and Phase 2 scope note — mosaic is Phase 3)
10. **Mirror default** — `paramStore.snapshot.input.mirrorMode === true`; the display canvases carry the CSS `scaleX(-1)` transform (D10, D27)
11. **Effect registered** — `listEffects()` returns exactly one entry whose `id === 'handTrackingMosaic'` (D36)

Non-visual assertions:

- **crossOriginIsolated === true** on the preview URL (D31, prerequisite for MediaPipe SharedArrayBuffer)
- **Zero console errors** in a 5-second capture window
- **No StrictMode stream leak** — after mount + unmount via navigation, `navigator.mediaDevices.enumerateDevices()` returns without any stuck `active` track (sanity check)

### NOT Building (scope boundary)

- Any Phase 3 feature (ogl renderer, fragment shader, polygon region math, mosaic visual fidelity)
- Any Phase 4 feature (modulation live, presets, record, reduced-motion)
- Any Phase 5 feature (Vercel deploy, CSP forced-failure E2E, service-worker offline)
- A pixel-exact diff between the app and the TouchDesigner reference — that is Phase 3.R
- Any visual change to the app itself — this task is test-only (changes are limited to reports, the regression spec, and — if missing — dev-hook exposures that landed in prior Phase 2 tasks)
- Real-hand Y4M E2E coverage — the synthetic testsrc2 Y4M + injected-landmarks path is sufficient for Phase 2 scope (real-hand Y4M is optional and explicitly deferred)

### Success Criteria

- [ ] `pnpm check` (alias: `pnpm biome check . && pnpm tsc --noEmit`) exits 0
- [ ] `pnpm vitest run` exits 0 (all Phase 1–2 unit tests)
- [ ] `pnpm build` exits 0
- [ ] `pnpm preview` serves the production build with correct COOP/COEP headers
- [ ] `PLAYWRIGHT_BASE_URL=http://localhost:4173 VITE_DEV_HOOKS=1 pnpm test:e2e -- --grep "Task"` exits 0 (every Phase 1–2 E2E spec passes against the preview build)
- [ ] `PLAYWRIGHT_BASE_URL=http://localhost:4173 VITE_DEV_HOOKS=1 pnpm test:e2e -- --grep "Task 2.R:"` exits 0
- [ ] All 6 `reports/phase-2-walkthrough/step-*.png` files exist and are non-empty
- [ ] `reports/phase-2-regression.md` exists with every checklist row marked PASS or explicit FAIL-with-hotfix-link
- [ ] `listEffects()` returns `['handTrackingMosaic']` — verified via dev hook in the spec
- [ ] No `any` introduced in the regression spec; real `expect(...)` assertions (not bare `if / throw`)

---

## All Needed Context

> **Context Completeness Check**: An agent with zero prior knowledge of this codebase must be able to implement this task using only this file. Every file path, every D-number, every dev-hook name and signature is spelled out below. If something is missing on your branch, STOP and verify Phase 2 Tasks 2.1–2.5 actually completed before starting this regression.

```yaml
files:
  - path: .claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png
    why: Structural comparison anchor. For Phase 2 we do NOT do a pixel diff (that's Phase 3.R) — but the maintainer will eyeball the grid/blob screenshots against this for obvious mismatches (wrong column count, wrong label format, etc.)
    gotcha: Do NOT fail the regression on pixel-exact mismatch — Phase 2 only owns structure (grid drawn, 5 blobs, panel mounted). Mosaic placement is Phase 3 owned.

  - path: .claude/orchestration-hand-tracker-fx/tasks/phase-2/task-2-1.md
    why: Defines the registry + manifest types this regression exercises via listEffects()
    gotcha: listEffects() returns []EffectManifest — .id is the stable identifier, not .displayName

  - path: .claude/orchestration-hand-tracker-fx/tasks/phase-2/task-2-2.md
    why: paramStore + buildPaneFromManifest — every panel assertion in this spec depends on the binding shape established there
    gotcha: paramStore.snapshot is a read-only reference. Use paramStore.set(dotPath, value) to mutate (via dev hook). Do NOT mutate snapshot in place.

  - path: .claude/orchestration-hand-tracker-fx/tasks/phase-2/task-2-3.md
    why: Grid generator contract — generateColumnWidths(seed, count, variance) is deterministic for a given seed; the regression's "non-uniform" assertion depends on variance=0.6 producing unique widths
    gotcha: With widthVariance=0, widths are uniform — the regression MUST exercise the default (0.6), not override it

  - path: .claude/orchestration-hand-tracker-fx/tasks/phase-2/task-2-4.md
    why: blobRenderer — defines FINGERTIP_INDICES = [4, 8, 12, 16, 20] and the label format; regression assertions pull from here
    gotcha: blobs are drawn to a canvas (no per-blob DOM element). Count via window.__handTracker.getLandmarkBlobCount() — not via DOM query.

  - path: .claude/orchestration-hand-tracker-fx/tasks/phase-2/task-2-5.md
    why: manifest + registration + dev hooks the spec calls (getParam, getLandmarkBlobCount, lastGridLayout, setFakeLandmarks)
    gotcha: Task 2.5 is the one that adds `import './effects/handTrackingMosaic'` to main.tsx — if missing, listEffects() will return []

  - path: src/engine/devHooks.ts
    why: window.__handTracker namespace — regression spec's entry point for all programmatic assertions
    gotcha: Dev hooks are gated by import.meta.env.DEV. For the preview build (MODE=production), the gate must also accept VITE_DEV_HOOKS === '1'. The regression spec runs with VITE_DEV_HOOKS=1 in its env. If devHooks.ts currently only checks import.meta.env.DEV, extend it: `if (import.meta.env.DEV || import.meta.env.VITE_DEV_HOOKS === '1')`

  - path: tests/e2e/smoke.spec.ts
    why: MIRROR — existing Playwright describe / beforeEach / waitForSelector / waitForFunction patterns; same import style; same declare-global for window.__handTracker
    gotcha: Spec title MUST start with `Task 2.R:` so `--grep "Task 2.R:"` resolves correctly. A grep typo silently reports "0 tests found, exit 0" — a false green.

  - path: tests/assets/fake-hand.y4m
    why: The committed synthetic testsrc2 Y4M used by --use-file-for-fake-video-capture. Chromium streams this as the fake webcam. Does NOT contain a detectable hand — so MediaPipe returns zero landmarks; blob count = 0.
    gotcha: This file may be .gitignored and generated via `pnpm test:setup` (ffmpeg). If missing, run `pnpm test:setup` before the regression. If the file is missing AND ffmpeg is unavailable, the test will NOT enter GRANTED state at all — it will fall through to NOT_FOUND.

  - path: playwright.config.ts
    why: Launch flags (--use-fake-device-for-media-stream, --use-file-for-fake-video-capture, --use-fake-ui-for-media-stream), permissions: ['camera'], webServer config, PLAYWRIGHT_BASE_URL override
    gotcha: webServer is skipped when PLAYWRIGHT_BASE_URL is set — the regression command MUST set it to http://localhost:4173 AND start preview separately in background, OR rely on the committed webServer config (which already runs `pnpm build && pnpm preview`). This task uses the explicit background-preview approach for clarity.

  - path: vite.config.ts
    why: preview.headers block — serves COOP/COEP on `pnpm preview`; the crossOriginIsolated assertion depends on these
    gotcha: If vite preview lacks the headers block (config drift), crossOriginIsolated === false, SharedArrayBuffer is disabled, MediaPipe silently downgrades, and blobs never appear. Verify headers FIRST; fail fast.

  - path: package.json
    why: Scripts — check, build, preview, test:setup, test:e2e, lint, typecheck, vitest
    gotcha: pnpm only — no npm / npx / bun. `pnpm preview` defaults to port 4173.

urls:
  - url: https://playwright.dev/docs/test-cli
    why: --grep pattern matching + --reporter usage
    critical: "The grep pattern matches the concatenated test title (describe > test). 'Task 2.R:' MUST appear on the top-level describe — not a nested describe, or the grep flake risk is high."

  - url: https://playwright.dev/docs/screenshots
    why: page.screenshot({ path, fullPage }) API
    critical: "Use fullPage: false for viewport-only (our canvas fills the viewport). Create the output dir with fs.mkdir({ recursive: true }) before the first screenshot — Playwright does not auto-create parents."

  - url: https://playwright.dev/docs/api/class-page#page-wait-for-function
    why: page.waitForFunction((()) => window.__handTracker?.getLandmarkBlobCount() === 5) pattern
    critical: "Do NOT sleep with waitForTimeout — use waitForFunction with a real condition. Timeout 10_000 is sufficient for injected landmarks (no model cold-start involved)."

  - url: https://vite.dev/config/preview-options.html#preview-headers
    why: preview.headers config ensures COOP/COEP are served from `pnpm preview`, mirroring `pnpm dev`
    critical: "If preview.headers is absent, crossOriginIsolated === false on the preview URL. Task 1.1 should have added this; verify."

  - url: https://tweakpane.github.io/docs/
    why: Tweakpane Pane/Tab/Folder/Binding API — the regression spec queries the panel structure programmatically via dev hook, not DOM selectors, to avoid Tweakpane internals coupling
    critical: "Do NOT hand-author Tweakpane DOM selectors. Use window.__handTracker.getParam(dotPath) to read values and window.__handTracker.setParam(dotPath, value) to write them."

skills:
  - prp-task-ralph-loop
  - hand-tracker-fx-architecture
  - playwright-e2e-webcam
  - tweakpane-params-presets
  - vite-vercel-coop-coep
  - vitest-unit-testing-patterns

discovery:
  - D4: Procedural grid with seed/columnCount/rowCount/widthVariance + Randomize
  - D6: Fingertip landmarks 4, 8, 12, 16, 20 render as dotted-circle blobs (5 per hand)
  - D7: Coord label format "x: 0.xxx  y: 0.xxx" (3 decimals, normalized, two-space separator)
  - D8: One hand; numHands=1
  - D9: Mosaic defaults + ranges (declared in manifest; not yet rendered — Phase 3)
  - D10: Mirror ON by default; CSS scaleX(-1) on display
  - D13: Default modulation sources (declared in manifest; not yet wired — Phase 4)
  - D19: Tweakpane 4 + Essentials plugin
  - D20: paramStore is a plain object; React only for UI chrome
  - D21: Playwright E2E uses --use-fake-device-for-media-stream; FPS ≥ 20 acceptance criterion
  - D27: Landmarks are unmirrored in coord space; mirror applied at display only
  - D31: COOP/COEP/CSP headers — crossOriginIsolated === true on preview
  - D36: EffectManifest / registerEffect contract
  - D37: FrameContext shape passed to render() per frame
  - D38: Folder layout — src/engine, src/effects/handTrackingMosaic, src/ui
  - D41: 4-level validation + Ralph loop
  - D42: Phase regression MUST run against `pnpm build && pnpm preview` (closest-to-live build)
```

### Current Codebase Tree (relevant subset, post Phase 2 Tasks 2.1–2.5)

```
src/
  engine/
    manifest.ts             # Task 2.1 types
    registry.ts             # Task 2.1 registry + listEffects()
    paramStore.ts           # Task 2.2
    buildPaneFromManifest.ts  # Task 2.2
    devHooks.ts             # Phase 1.5 + extended by 2.3/2.4/2.5
  effects/handTrackingMosaic/
    grid.ts                 # Task 2.3
    gridRenderer.ts         # Task 2.3
    blobRenderer.ts         # Task 2.4
    manifest.ts             # Task 2.5
    index.ts                # Task 2.5 — calls registerEffect(...)
  ui/
    Panel.tsx               # Task 2.2
    Stage.tsx               # Phase 1.6
  app/
    main.tsx                # imports ./effects/handTrackingMosaic (Task 2.5)
tests/
  e2e/
    smoke.spec.ts           # Task 1.1
    task-1-*.spec.ts        # Phase 1 specs
    task-2-1.spec.ts .. task-2-5.spec.ts   # if any; some may be describe.skip stubs
  assets/
    fake-hand.y4m           # generated by pnpm test:setup; gitignored
reports/                    # may exist (Phase 6 tool-verification.md); otherwise new
playwright.config.ts
vite.config.ts
package.json
```

### Desired Codebase Tree (files this task adds or may touch)

```
tests/
  e2e/
    phase-2-regression.spec.ts           # NEW — describe('Task 2.R: …')
reports/
  phase-2-walkthrough/                   # NEW (dir)
    step-01-initial-load.png
    step-02-grid-cols-before.png
    step-03-grid-cols-after.png
    step-04-blobs-testsrc2.png
    step-05-blobs-injected.png
    step-06-webgl-black.png
  phase-2-regression.md                  # NEW — validation matrix + checklist + decision
src/engine/devHooks.ts                   # MAY MODIFY — only to extend the gate:
                                         # if (import.meta.env.DEV || import.meta.env.VITE_DEV_HOOKS === '1')
                                         # (only if the gate currently only accepts DEV)
```

No other files are modified. If additional dev-hook methods (`getParam`, `setParam`, `getLandmarkBlobCount`, `lastGridLayout`, `setFakeLandmarks`, `listRegisteredEffects`) are missing from `devHooks.ts`, that is a gap in Tasks 2.2–2.5 — open a hotfix task, do NOT add them inline here.

### Known Gotchas

```typescript
// CRITICAL: Run against `pnpm preview`, NOT `pnpm dev`. D42 mandates the closest-to-live
// build for phase regressions. Dev-only behavior (e.g. tree-shaken dev hooks, different
// header defaults, React StrictMode double-invoke) masks production bugs otherwise.

// CRITICAL: Dev hooks are gated. The preview build runs in MODE=production by default,
// which trees-shakes `import.meta.env.DEV` branches out. Opt the hooks back in with a
// `VITE_DEV_HOOKS=1` env var and a gate like:
//   if (import.meta.env.DEV || import.meta.env.VITE_DEV_HOOKS === '1') { ... }
// Run: `VITE_DEV_HOOKS=1 pnpm build && pnpm preview` so the env is baked into the bundle
// via Vite's define mechanism. If devHooks.ts currently checks only DEV, extend it — this
// is the ONE source modification allowed in this task (see Desired Codebase Tree note).

// CRITICAL: crossOriginIsolated === false silently downgrades MediaPipe to CPU and kills
// SharedArrayBuffer. Assert `await page.evaluate(() => self.crossOriginIsolated)` returns
// true FIRST, before waiting on landmarks. If it's false, vite.config.ts preview.headers
// is misconfigured — escalate, don't work around.

// CRITICAL: The synthetic testsrc2 Y4M does NOT contain a detectable hand.
// HandLandmarker will return an empty landmark array or null; blob count = 0 is the
// CORRECT expected value for the fake stream. Do not "fix" the renderer to produce 5 blobs
// without a hand — that would be a real bug. The injected-landmark path
// (setFakeLandmarks) is what validates the count-5 path.

// CRITICAL: setFakeLandmarks signature — takes a 21-landmark array of
// { x: 0..1, y: 0..1, z: number, visibility?: number }.
// Must populate indices 4, 8, 12, 16, 20 with plausible values (x/y in [0, 1]) — other
// indices can be filler (e.g. { x: 0.5, y: 0.5, z: 0 }). After injection, the render loop
// will pick up the override on the next rVFC tick (< 50 ms typically, < 200 ms worst case).

// CRITICAL: Tweakpane panel DOM is implementation-dependent and has changed between minor
// versions. Do NOT query '.tp-fldv_t', '.tp-sglv_i', etc. — those are internal selectors.
// Instead, use the dev-hook API:
//   window.__handTracker.setParam('grid.columnCount', 20)
//   window.__handTracker.getParam('grid.columnCount')
// These update paramStore + pane.refresh() (or equivalent) so the overlay re-renders.
// Leave the Tweakpane DOM verification to a single "panel root visible" assertion via
// a data-testid applied in Panel.tsx (data-testid="tweakpane-root").

// CRITICAL: WebGL canvas is expected to clear to BLACK in Phase 2 — no mosaic yet.
// handTrackingMosaic.create() in Task 2.5 ships a noop render() that issues
// gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT). If step-06-webgl-black.png
// shows a rendered mosaic, Task 2.5 contract has drifted — escalate, don't mask.

// CRITICAL: Grid live-edit timing. After paramStore.set('grid.columnCount', 20), the 2D
// overlay re-renders on the next rVFC tick. Wait with page.waitForFunction polling
// window.__handTracker.lastGridLayout.columnCount === 20, timeout 2000. Do NOT
// waitForTimeout(100) — that's race-prone and banned by the playwright-e2e-webcam skill.

// CRITICAL: Spec `describe` title MUST start with `Task 2.R:` literally. A typo (e.g.
// `Task 2.r:` or `Task2.R:`) makes `--grep "Task 2.R:"` match zero tests and report
// exit 0 — a silent false green that breaks the Ralph trust contract.

// CRITICAL: Do NOT commit reports/phase-2-walkthrough/*.png to git unless explicitly
// requested — large binaries. Add `reports/**/*.png` to .gitignore if not already. The
// regression .md report DOES get committed; reference the PNGs by relative path.

// CRITICAL: React StrictMode runs effects twice in dev — the preview build is NOT dev,
// so StrictMode double-invoke doesn't apply here. But the regression spec still should
// not assume a single mount — it should assert `navigator.mediaDevices` has no stuck
// active tracks after a soft navigation. If StrictMode is leaking in dev, that's a
// Task 1.2 bug to fix separately.

// CRITICAL: No Phase 3 assertions. The Phase 3 mosaic shader and hand-polygon region
// math are NOT exercised here. If a failure suggests "mosaic should render," stop —
// that's a Phase 3 contract. Phase 2 contract is black WebGL + visible 2D overlay.
```

---

## Implementation Blueprint

### Data Models

No new data types. This task only produces test code + markdown reports and (optionally) extends the existing `devHooks.ts` env-gate expression — no type changes.

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: VERIFY prior-phase artifacts exist
  - IMPLEMENT: a shell preflight (can be a comment-only step; Ralph runs these in Step a):
      ls src/engine/manifest.ts
      ls src/engine/registry.ts
      ls src/engine/paramStore.ts
      ls src/engine/buildPaneFromManifest.ts
      ls src/engine/devHooks.ts
      ls src/effects/handTrackingMosaic/manifest.ts
      ls src/effects/handTrackingMosaic/index.ts
      ls src/effects/handTrackingMosaic/grid.ts
      ls src/effects/handTrackingMosaic/gridRenderer.ts
      ls src/effects/handTrackingMosaic/blobRenderer.ts
      ls src/ui/Panel.tsx
      ls src/ui/Stage.tsx
      ls tests/e2e/smoke.spec.ts
      ls playwright.config.ts
      ls vite.config.ts
      ls tests/assets/fake-hand.y4m || pnpm test:setup
  - GOTCHA: Any missing file ⇒ the corresponding Phase 2 task did not complete. Escalate, do NOT forge ahead.
  - VALIDATE: every `ls` exits 0 (or `pnpm test:setup` regenerates the Y4M)

Task 2 (conditional): MODIFY src/engine/devHooks.ts to accept VITE_DEV_HOOKS flag
  - ONLY IF the current gate is:
      if (import.meta.env.DEV) { ... }
    EXTEND to:
      if (import.meta.env.DEV || import.meta.env.VITE_DEV_HOOKS === '1') { ... }
  - RATIONALE: `pnpm build && pnpm preview` runs in MODE=production, where DEV is false. The
    regression needs the dev hooks to stay in the bundle. The env variable is consumed at
    build time by Vite's `define` machinery — see https://vite.dev/guide/env-and-mode.html.
  - GOTCHA: If the gate already accepts VITE_DEV_HOOKS, skip this task entirely. Do not touch
    any other part of devHooks.ts — the hook surface (getParam, setParam, getLandmarkBlobCount,
    lastGridLayout, setFakeLandmarks, listRegisteredEffects, getFPS, getLandmarkCount) is
    owned by earlier tasks.
  - VALIDATE: `VITE_DEV_HOOKS=1 pnpm build` succeeds AND a dev-hook call works in the preview

Task 3: CREATE tests/e2e/phase-2-regression.spec.ts
  - IMPLEMENT:
      import { test, expect } from '@playwright/test';
      import fs from 'node:fs/promises';
      import path from 'node:path';

      const SHOT_DIR = 'reports/phase-2-walkthrough';

      async function snap(page: import('@playwright/test').Page, step: number, label: string) {
        await fs.mkdir(SHOT_DIR, { recursive: true });
        await page.screenshot({
          path: path.join(SHOT_DIR, `step-${String(step).padStart(2, '0')}-${label}.png`),
          fullPage: false,
        });
      }

      declare global {
        interface Window {
          __handTracker: {
            getFPS(): number;
            getLandmarkCount(): number;
            getLandmarkBlobCount(): number;
            getParam(dotPath: string): unknown;
            setParam(dotPath: string, value: unknown): void;
            setFakeLandmarks(lms: Array<{ x: number; y: number; z: number; visibility?: number }> | null): void;
            listRegisteredEffects(): string[];
            lastGridLayout: { columnCount: number; rowCount: number; widths: number[]; heights: number[] };
          };
        }
      }

      function fakeLandmarks(): Array<{ x: number; y: number; z: number }> {
        return Array.from({ length: 21 }, (_, i) => {
          if (i === 4)  return { x: 0.30, y: 0.40, z: 0 };
          if (i === 8)  return { x: 0.37, y: 0.29, z: 0 };
          if (i === 12) return { x: 0.50, y: 0.25, z: 0 };
          if (i === 16) return { x: 0.62, y: 0.29, z: 0 };
          if (i === 20) return { x: 0.70, y: 0.40, z: 0 };
          return { x: 0.5, y: 0.5, z: 0 };
        });
      }

      test.describe('Task 2.R: Phase 2 regression — engine + overlay', () => {
        test.beforeEach(async ({ page }) => {
          const errors: string[] = [];
          page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
          page.on('pageerror', (e) => errors.push(e.message));
          await page.goto('/');
          await expect(page.locator('[data-testid="render-canvas"]')).toBeVisible({ timeout: 30_000 });
          // expose errors to the individual test via a shared reference
          (page as unknown as { __errors: string[] }).__errors = errors;
        });

        test('crossOriginIsolated is true (COOP/COEP serve correctly from preview)', async ({ page }) => {
          const isolated = await page.evaluate(() => self.crossOriginIsolated);
          expect(isolated, 'crossOriginIsolated must be true on preview build').toBe(true);
        });

        test('effect registry exposes handTrackingMosaic only', async ({ page }) => {
          const ids = await page.evaluate(() => window.__handTracker.listRegisteredEffects());
          expect(ids).toEqual(['handTrackingMosaic']);
        });

        test('default param snapshot matches DISCOVERY values', async ({ page }) => {
          const snap = await page.evaluate(() => ({
            seed:           window.__handTracker.getParam('grid.seed'),
            columnCount:    window.__handTracker.getParam('grid.columnCount'),
            rowCount:       window.__handTracker.getParam('grid.rowCount'),
            widthVariance:  window.__handTracker.getParam('grid.widthVariance'),
            tileSize:       window.__handTracker.getParam('mosaic.tileSize'),
            blendOpacity:   window.__handTracker.getParam('mosaic.blendOpacity'),
            edgeFeather:    window.__handTracker.getParam('mosaic.edgeFeather'),
            regionPadding:  window.__handTracker.getParam('effect.regionPadding'),
            mirrorMode:     window.__handTracker.getParam('input.mirrorMode'),
            showLandmarks:  window.__handTracker.getParam('input.showLandmarks'),
          }));
          expect(snap).toEqual({
            seed: 42,
            columnCount: 12,
            rowCount: 8,
            widthVariance: 0.6,
            tileSize: 16,
            blendOpacity: 1.0,
            edgeFeather: 0,
            regionPadding: 1,
            mirrorMode: true,
            showLandmarks: true,
          });
        });

        test('panel root mounted (tweakpane-root data-testid visible)', async ({ page }) => {
          await expect(page.locator('[data-testid="tweakpane-root"]')).toBeVisible();
        });

        test('grid layout columnCount=12 by default; non-uniform widths', async ({ page }) => {
          await page.waitForFunction(() => window.__handTracker.lastGridLayout?.columnCount === 12, undefined, { timeout: 10_000 });
          const widths = await page.evaluate(() => window.__handTracker.lastGridLayout.widths);
          expect(widths).toHaveLength(12);
          const unique = new Set(widths.map((w) => w.toFixed(4)));
          expect(unique.size, 'widthVariance=0.6 should produce non-uniform widths').toBeGreaterThan(1);
          await snap(page, 1, 'initial-load');
          await snap(page, 2, 'grid-cols-before');
        });

        test('grid live-edit: setParam(grid.columnCount, 20) re-renders within 2s', async ({ page }) => {
          await page.evaluate(() => window.__handTracker.setParam('grid.columnCount', 20));
          await page.waitForFunction(() => window.__handTracker.lastGridLayout?.columnCount === 20, undefined, { timeout: 2_000 });
          const widths = await page.evaluate(() => window.__handTracker.lastGridLayout.widths);
          expect(widths).toHaveLength(20);
          await snap(page, 3, 'grid-cols-after');
          // Reset so downstream tests aren't polluted
          await page.evaluate(() => window.__handTracker.setParam('grid.columnCount', 12));
          await page.waitForFunction(() => window.__handTracker.lastGridLayout?.columnCount === 12, undefined, { timeout: 2_000 });
        });

        test('blob count = 0 with synthetic testsrc2 Y4M stream', async ({ page }) => {
          // Give MediaPipe up to 60s to confirm "no hand" on the fake stream (cold-start model load).
          await page.waitForFunction(
            () => window.__handTracker.getFPS() > 0,
            undefined,
            { timeout: 60_000 },
          );
          // After warmup, a testsrc2 frame has no hand → blob count stays 0.
          await page.waitForTimeout(1500); // brief settle (one exception to the no-sleep rule; justified for a stability sample)
          const count = await page.evaluate(() => window.__handTracker.getLandmarkBlobCount());
          expect(count, 'synthetic Y4M should produce 0 blobs (no hand)').toBe(0);
          await snap(page, 4, 'blobs-testsrc2');
        });

        test('blob count = 5 with injected fake landmarks', async ({ page }) => {
          await page.evaluate((lms) => window.__handTracker.setFakeLandmarks(lms), fakeLandmarks());
          await page.waitForFunction(() => window.__handTracker.getLandmarkBlobCount() === 5, undefined, { timeout: 5_000 });
          const count = await page.evaluate(() => window.__handTracker.getLandmarkBlobCount());
          expect(count).toBe(5);
          await snap(page, 5, 'blobs-injected');
          // Clean up so the next test sees no injected landmarks
          await page.evaluate(() => window.__handTracker.setFakeLandmarks(null));
        });

        test('WebGL canvas clears to black (mosaic deferred to Phase 3)', async ({ page }) => {
          await snap(page, 6, 'webgl-black');
          const centerPixel = await page.evaluate(() => {
            const canvas = document.querySelector('canvas[data-testid="webgl-canvas"]') as HTMLCanvasElement | null;
            if (!canvas) return null;
            const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
            if (!gl) return null;
            const x = Math.floor(gl.drawingBufferWidth / 2);
            const y = Math.floor(gl.drawingBufferHeight / 2);
            const px = new Uint8Array(4);
            gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
            return Array.from(px);
          });
          expect(centerPixel, 'WebGL canvas must be present').not.toBeNull();
          // Accept [0,0,0,255] OR [0,0,0,0] (clear color black, alpha may be 0 or 1 depending on preserveDrawingBuffer config).
          const [r, g, b] = centerPixel as number[];
          expect({ r, g, b }).toEqual({ r: 0, g: 0, b: 0 });
        });

        test('mirror is ON by default — display canvas carries scaleX(-1) transform', async ({ page }) => {
          const transform = await page.evaluate(() => {
            const el = document.querySelector('[data-testid="render-canvas"]') as HTMLElement | null;
            if (!el) return null;
            return getComputedStyle(el).transform;
          });
          expect(transform).not.toBeNull();
          // matrix(-1, 0, 0, 1, 0, 0) OR matrix3d(...) with scaleX = -1
          expect(transform as string).toMatch(/matrix\(\s*-1|matrix3d\(\s*-1/);
        });

        test('zero console errors in a 5-second capture window', async ({ page }) => {
          await page.waitForTimeout(5_000);
          const errs = (page as unknown as { __errors: string[] }).__errors;
          expect(errs, `console errors: ${errs.join(' | ')}`).toEqual([]);
        });
      });
  - MIRROR: tests/e2e/smoke.spec.ts — import pattern, declare global, describe/test/expect
  - NAMING: file phase-2-regression.spec.ts; top-level describe starts with `Task 2.R:`
  - GOTCHA: Keep the "0 blobs on synthetic Y4M" test separate from "5 blobs on injected landmarks"
    so a single failure points at the right cause. Clean up injected landmarks after each test
    that sets them (setFakeLandmarks(null)).
  - GOTCHA: Composite-image generation is OUT of scope for Phase 2 — the 6 individual PNGs
    are sufficient. Phase 3.R adds the side-by-side composite.
  - VALIDATE: pnpm biome check tests/e2e/phase-2-regression.spec.ts && pnpm tsc --noEmit

Task 4: CREATE reports/phase-2-regression.md (Ralph fills this in AFTER L1–L4 all exit 0)
  - TEMPLATE:
      # Phase 2 Regression Report

      **Date**: <ISO timestamp>
      **Branch**: task/2-R-phase-2-regression
      **Build**: `VITE_DEV_HOOKS=1 pnpm build && pnpm preview` (http://localhost:4173)
      **Iterations used**: <N>

      ## Validation Levels
      | Level | Command | Result |
      | --- | --- | --- |
      | L1 | pnpm biome check . | PASS |
      | L1 | pnpm tsc --noEmit | PASS |
      | L2 | pnpm vitest run | PASS (M/M tests) |
      | L3 | pnpm build | PASS |
      | L4 | PLAYWRIGHT_BASE_URL=http://localhost:4173 VITE_DEV_HOOKS=1 pnpm test:e2e -- --grep "Task" | PASS (N specs, Phase 1–2 aggregate) |
      | L4 | PLAYWRIGHT_BASE_URL=http://localhost:4173 VITE_DEV_HOOKS=1 pnpm test:e2e -- --grep "Task 2.R:" | PASS (K specs) |

      ## Phase 2 Task Status
      | Task | Title | L1 | L2 | L3 | L4 |
      | --- | --- | --- | --- | --- | --- |
      | 2.1 | Effect manifest + registry types | PASS | PASS | PASS | PASS |
      | 2.2 | paramStore + buildPaneFromManifest | PASS | PASS | PASS | PASS |
      | 2.3 | Seeded grid generator + 2D overlay rendering | PASS | PASS | PASS | PASS |
      | 2.4 | Dotted-circle blobs + xy labels | PASS | PASS | PASS | PASS |
      | 2.5 | handTrackingMosaic manifest + registration | PASS | PASS | PASS | PASS |
      | 2.R | (this task) | PASS | PASS | PASS | PASS |

      ## Regression Checklist
      | # | Item | D-numbers | Status | Notes |
      | --- | --- | --- | --- | --- |
      | 1 | Panel mounted (3 tabs) | D19, D36 | PASS/FAIL | <notes> |
      | 2 | All D4/D9 params bound | D4, D9, D36 | PASS/FAIL | <notes> |
      | 3 | Grid visible over webcam | D4, D18 | PASS/FAIL | <notes> |
      | 4 | Grid non-uniform (variance=0.6) | D4 | PASS/FAIL | <notes> |
      | 5 | Grid live-edit 12→20 re-renders | D4, D20 | PASS/FAIL | <notes> |
      | 6 | Blob count = 0 on testsrc2 Y4M | D6, D8 | PASS/FAIL | <notes> |
      | 7 | Blob count = 5 on injected landmarks | D6, D8 | PASS/FAIL | <notes> |
      | 8 | Label format /^x: \d\.\d{3} {2}y: \d\.\d{3}$/ | D7 | PASS/FAIL | <notes> |
      | 9 | WebGL canvas clears to black (no mosaic) | Phase 2 scope | PASS/FAIL | <notes> |
      | 10 | Mirror default ON (CSS scaleX(-1)) | D10, D27 | PASS/FAIL | <notes> |
      | 11 | listEffects() === ['handTrackingMosaic'] | D36 | PASS/FAIL | <notes> |

      ## Non-Visual Assertions
      | Assertion | Target | Measured | Result |
      | --- | --- | --- | --- |
      | crossOriginIsolated | true | <bool> | PASS/FAIL |
      | Console errors (5s window) | 0 | <N> | PASS/FAIL |
      | Grid re-render latency | < 2000 ms | <ms> | PASS/FAIL |
      | Blob inject → count=5 latency | < 5000 ms | <ms> | PASS/FAIL |

      ## Artifacts
      - reports/phase-2-walkthrough/step-01-initial-load.png
      - reports/phase-2-walkthrough/step-02-grid-cols-before.png
      - reports/phase-2-walkthrough/step-03-grid-cols-after.png
      - reports/phase-2-walkthrough/step-04-blobs-testsrc2.png
      - reports/phase-2-walkthrough/step-05-blobs-injected.png
      - reports/phase-2-walkthrough/step-06-webgl-black.png

      ## Decision
      - [ ] SHIP — proceed to Phase 3
      - [ ] FIX — open hotfix task 2.<N> and re-run regression

      ## Deviations from Plan
      (fill at completion — "None" if clean)
  - GOTCHA: Do NOT pre-fill PASS before running — the file is written AFTER L1–L4 all exit 0
  - VALIDATE: the file exists AND every checklist row is marked PASS or explicit FAIL-with-hotfix-link

Task 5: Playwright MCP interactive capture (complementary to Task 3's spec)
  - RUN: With preview running, drive the Playwright MCP server:
      1. browser_navigate http://localhost:4173
      2. browser_wait_for [data-testid="render-canvas"] visible
      3. browser_take_screenshot → reports/phase-2-walkthrough/step-01-initial-load.png
      4. browser_evaluate `window.__handTracker.setParam('grid.columnCount', 12)` (ensure baseline)
      5. browser_wait_for window.__handTracker.lastGridLayout.columnCount === 12
      6. browser_take_screenshot → step-02-grid-cols-before.png
      7. browser_evaluate `window.__handTracker.setParam('grid.columnCount', 20)`
      8. browser_wait_for window.__handTracker.lastGridLayout.columnCount === 20
      9. browser_take_screenshot → step-03-grid-cols-after.png
     10. browser_evaluate `window.__handTracker.setFakeLandmarks(null)` + wait 1000
     11. browser_take_screenshot → step-04-blobs-testsrc2.png
     12. browser_evaluate `window.__handTracker.setFakeLandmarks([/* 21 landmarks */])`
     13. browser_wait_for window.__handTracker.getLandmarkBlobCount() === 5
     14. browser_take_screenshot → step-05-blobs-injected.png
     15. browser_take_screenshot (WebGL canvas area) → step-06-webgl-black.png
     16. browser_close
  - NOTES:
      * If Task 3's automated spec already produced the 6 PNGs, this MCP path is redundant —
        still run it for human-review quality (the MCP screenshots may differ slightly in
        framing / DPR from the programmatic ones; either source is acceptable as long as the
        files exist with the exact names listed in the report).
      * If Playwright MCP is unavailable, rely solely on Task 3's `page.screenshot(...)` output.
  - VALIDATE: `ls -la reports/phase-2-walkthrough/step-*.png` shows 6 non-empty files

Task 6: Regression run orchestration (this is the Ralph loop's run order)
  - RUN (in order; stop at first failure and diagnose):
      1. pnpm install   (idempotent; skip if lockfile unchanged)
      2. pnpm biome check .
      3. pnpm tsc --noEmit
      4. pnpm vitest run
      5. VITE_DEV_HOOKS=1 pnpm build
      6. pnpm test:setup   # regenerates tests/assets/fake-hand.y4m if missing
      7. VITE_DEV_HOOKS=1 pnpm preview &   # background, port 4173
         (Ralph uses Bash run_in_background for this step; sleep 3 before L4)
      8. PLAYWRIGHT_BASE_URL=http://localhost:4173 VITE_DEV_HOOKS=1 pnpm test:e2e -- --grep "Task"
      9. PLAYWRIGHT_BASE_URL=http://localhost:4173 VITE_DEV_HOOKS=1 pnpm test:e2e -- --grep "Task 2.R:"
     10. (optional) Playwright MCP walkthrough per Task 5
     11. Kill preview process
     12. Fill in reports/phase-2-regression.md
  - GOTCHA: Always kill the preview process on exit (trap EXIT). Leaving port 4173 bound
    breaks subsequent local dev sessions.
  - VALIDATE: each step exits 0; the walkthrough dir has 6 non-empty PNGs; the .md has no
    PASS/FAIL placeholder left unchecked.
```

### Integration Points

```yaml
DEV_HOOKS (consumed by the regression spec — already provided by Phase 2 Tasks 2.2–2.5):
  - window.__handTracker.getParam(dotPath: string): unknown
  - window.__handTracker.setParam(dotPath: string, value: unknown): void
  - window.__handTracker.getLandmarkBlobCount(): number
  - window.__handTracker.lastGridLayout: { columnCount, rowCount, widths, heights }
  - window.__handTracker.setFakeLandmarks(lms | null): void
  - window.__handTracker.listRegisteredEffects(): string[]
  - window.__handTracker.getFPS(): number
  - window.__handTracker.getLandmarkCount(): number
  - Gate: if (import.meta.env.DEV || import.meta.env.VITE_DEV_HOOKS === '1')

VITE_CONFIG (verified, not modified by this task):
  - preview.headers carries COOP: same-origin + COEP: require-corp
  - vite `define` / `envPrefix` covers VITE_DEV_HOOKS

PLAYWRIGHT_CONFIG (verified, not modified):
  - launchOptions.args includes --use-fake-ui-for-media-stream, --use-fake-device-for-media-stream,
    --use-file-for-fake-video-capture=<absolute path to tests/assets/fake-hand.y4m>
  - permissions: ['camera']
  - baseURL reads PLAYWRIGHT_BASE_URL when set; otherwise relies on webServer

TEST_IDS (verified on Phase 1.6 + Phase 2 components; add missing ones as tiny hotfixes, not here):
  - data-testid="render-canvas" on the display canvas wrapper (Phase 1.6)
  - data-testid="tweakpane-root" on the panel container (Task 2.2)
  - data-testid="webgl-canvas" attribute on the WebGL canvas element (Phase 1.6)
```

---

## Validation Loop

### Level 1 — Syntax and Style

```bash
pnpm biome check .
pnpm tsc --noEmit
```

Expected: zero errors.

### Level 2 — Unit Tests (full Phase 1–2 regression)

```bash
pnpm vitest run
```

Expected: every unit suite from Phase 1 + Phase 2 Tasks 2.1–2.5 passes. If any fail, do not proceed — diagnose at source.

### Level 3 — Production Build + Preview

```bash
VITE_DEV_HOOKS=1 pnpm build
pnpm test:setup   # ensures tests/assets/fake-hand.y4m exists
VITE_DEV_HOOKS=1 pnpm preview
# ↑ run this in the background (Bash run_in_background=true) — the preview server stays up
#   while L4 runs. Kill it after L4 completes. Default port: 4173.
```

Expected: the production build exits 0, `pnpm preview` prints `Local: http://localhost:4173/` and serves pages with COOP/COEP headers (verify via `curl -I http://localhost:4173/` shows both headers).

### Level 4 — E2E against the Preview build

```bash
# Full Phase 1–2 aggregate regression against the preview
PLAYWRIGHT_BASE_URL=http://localhost:4173 VITE_DEV_HOOKS=1 pnpm test:e2e -- --grep "Task"

# Task 2.R specifically
PLAYWRIGHT_BASE_URL=http://localhost:4173 VITE_DEV_HOOKS=1 pnpm test:e2e -- --grep "Task 2.R:"
```

Expected: both invocations exit 0. Phase 1 + Phase 2 specs are covered by the first (broad `--grep "Task"`), the Task 2.R spec is the narrow gate.

### Playwright MCP screenshot capture (complementary to L4)

```
1. browser_navigate http://localhost:4173
2. browser_wait_for [data-testid="render-canvas"] visible
3. browser_take_screenshot → reports/phase-2-walkthrough/step-01-initial-load.png
4. browser_evaluate setParam('grid.columnCount', 12)  → step-02-grid-cols-before.png
5. browser_evaluate setParam('grid.columnCount', 20)  → step-03-grid-cols-after.png
6. browser_evaluate setFakeLandmarks(null)            → step-04-blobs-testsrc2.png
7. browser_evaluate setFakeLandmarks([21 landmarks])  → step-05-blobs-injected.png
8. browser_take_screenshot (framed around WebGL)      → step-06-webgl-black.png
9. browser_close
```

---

## Final Validation Checklist

### Technical

- [ ] All 4 levels exit 0 against the `pnpm preview` production build (not dev)
- [ ] `pnpm biome check .` — zero errors
- [ ] `pnpm tsc --noEmit` — zero errors
- [ ] `pnpm vitest run` — all tests pass (Phase 1 + Phase 2 aggregate)
- [ ] `VITE_DEV_HOOKS=1 pnpm build` — production build succeeds
- [ ] `curl -I http://localhost:4173/` returns `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`
- [ ] `pnpm test:e2e -- --grep "Task"` — all Phase 1–2 specs pass against preview
- [ ] `pnpm test:e2e -- --grep "Task 2.R:"` — regression spec passes

### Feature

- [ ] Panel mounted with 3 tabs and every D4/D9 + input param + randomize button
- [ ] `listEffects()` via dev hook returns `['handTrackingMosaic']`
- [ ] Default param snapshot equals DISCOVERY values (see spec test for the exact tuple)
- [ ] Grid draws over webcam with 12 non-uniform columns (seed=42, variance=0.6 default)
- [ ] Changing `grid.columnCount` 12 → 20 via `setParam` re-renders within 2 s
- [ ] Blob count stabilizes at 0 on the testsrc2 Y4M fake stream
- [ ] Blob count reaches 5 within 5 s after `setFakeLandmarks(...)` with 21-landmark fake data
- [ ] WebGL canvas clears to black (no mosaic) — center pixel `[0, 0, 0, {0|255}]`
- [ ] Mirror default ON — display canvas has CSS `matrix(-1, 0, 0, 1, 0, 0)` transform
- [ ] All 6 walkthrough PNGs exist in `reports/phase-2-walkthrough/`
- [ ] `reports/phase-2-regression.md` every row filled in PASS (or FAIL with linked hotfix)

### Code Quality

- [ ] No `any` types introduced in `tests/e2e/phase-2-regression.spec.ts`
- [ ] No DOM selectors target Tweakpane internal classes (`.tp-*`) — only the `data-testid` contract
- [ ] Regression spec uses `expect(...)` assertions — no bare `if / throw`
- [ ] `describe` title starts with literal `Task 2.R:`
- [ ] `setFakeLandmarks(null)` cleanup after each test that injected landmarks
- [ ] Preview process killed on exit (no stuck port 4173)
- [ ] `reports/phase-2-walkthrough/` paths match the names referenced in `phase-2-regression.md`

---

## Anti-Patterns

- Do NOT run the regression against `pnpm dev` — D42 requires the `pnpm build && pnpm preview` production bundle
- Do NOT ship the report with any checklist row left as FAIL without a linked hotfix task (2.N)
- Do NOT pixel-compare the app against the TouchDesigner reference screenshot in this task — Phase 3.R owns that
- Do NOT commit `reports/phase-2-walkthrough/*.png` to git unless explicitly requested (large binaries)
- Do NOT hardcode `http://localhost:4173` in the spec — read `PLAYWRIGHT_BASE_URL` via the existing playwright.config
- Do NOT enable dev hooks unconditionally in production — gate with `VITE_DEV_HOOKS === '1'`
- Do NOT modify Phase 2 source files (manifest.ts, paramStore.ts, gridRenderer.ts, blobRenderer.ts) to make the regression pass — failures there are hotfix tasks (2.N), not in-place edits in this regression file
- Do NOT expect the mosaic to render — Phase 2 ships a noop `render()` on the WebGL side; a rendered mosaic here would be a Task 2.5 contract drift, escalate
- Do NOT use `waitForTimeout` except for the single, justified 1500 ms "stability settle" sample on the testsrc2 test — every other wait uses `waitForFunction` or `toBeVisible`
- Do NOT query Tweakpane internal DOM (`.tp-fldv_t`, `.tp-sglv_i`, etc.) — use the `setParam` / `getParam` dev-hook surface
- Do NOT set `fullyParallel: true` or bump `workers` to speed up this spec — the fake webcam is a shared Chromium resource (see playwright-e2e-webcam skill)
- Do NOT add `// biome-ignore` or `// @ts-expect-error` to silence lint/type errors in the spec — fix them
- Do NOT emit `<promise>COMPLETE</promise>` unless ALL four validation levels exit 0 AND every report row is filled in
- Do NOT skip killing the preview server after L4 — leaves port 4173 bound and breaks the next run

---

## No Prior Knowledge Test

- [ ] Every file path cited in `All Needed Context` exists on the current branch (Phase 1.1–1.6 + Phase 2 Tasks 2.1–2.5 outputs)
- [ ] Every URL in `urls:` is reachable and points to the correct section
- [ ] Every D-number cited (D4, D6, D7, D8, D9, D10, D13, D19, D20, D21, D27, D31, D36, D37, D38, D41, D42) exists in DISCOVERY.md
- [ ] All prior Phase 2 tasks (2.1–2.5) are complete and their unit tests pass under `pnpm vitest run`
- [ ] `tests/assets/fake-hand.y4m` exists (or `pnpm test:setup` regenerates it from ffmpeg)
- [ ] `window.__handTracker` dev-hook surface (`getParam`, `setParam`, `getLandmarkBlobCount`, `lastGridLayout`, `setFakeLandmarks`, `listRegisteredEffects`, `getFPS`, `getLandmarkCount`) is available when built with `VITE_DEV_HOOKS=1`
- [ ] The validation-loop commands are copy-paste runnable with no placeholders
- [ ] The MIRROR file (`tests/e2e/smoke.spec.ts`) exists (created in Task 1.1)
- [ ] The task is atomic — depends only on completed Phase 1 + Phase 2 Tasks 2.1–2.5; does NOT require any Phase 3/4/5 feature
- [ ] Spec `describe` title starts with literal `Task 2.R:` (not `task 2.r:`, not `Task 2.r:`, not `Task2.R:`)

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
.claude/skills/tweakpane-params-presets/SKILL.md
.claude/skills/vite-vercel-coop-coep/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
