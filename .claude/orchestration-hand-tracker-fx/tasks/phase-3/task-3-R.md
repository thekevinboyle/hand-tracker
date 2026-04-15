# Task 3.R: Phase 3 Regression — Visual Fidelity Gate vs Reference Screenshot

**Phase**: 3 — Mosaic Shader
**Branch**: `task/3-R-phase-3-regression`
**Commit prefix**: `Task 3.R:`
**Estimated complexity**: High
**Max Ralph iterations**: 30

---

## Goal

**Feature Goal**: Verify the combined Phase 3 pipeline (Tasks 3.1–3.5) by running all four validation levels against a fresh `pnpm build && pnpm preview` production build, then driving a Playwright MCP session that captures a live screenshot and produces a side-by-side composite against `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png` with an explicit visual-fidelity checklist.

**Deliverable**: All four validation levels passing on the `pnpm preview` build. `reports/phase-3-visual-01-app.png`, `reports/phase-3-visual-02-reference.png`, `reports/phase-3-visual-composite.png` (side-by-side), and `reports/phase-3-regression.md` (a report covering visual checklist, FPS, console state, and a "ship / fix" decision). `tests/e2e/phase-3-regression.spec.ts` (new) — an automated spec that runs against the preview URL and asserts the 8-point checklist where programmatically possible.

**Success Definition**: `pnpm check && pnpm build && pnpm preview` (in background) + `PLAYWRIGHT_BASE_URL=http://localhost:4173 pnpm test:e2e --grep "Task 3.R:"` all exit 0; every checklist item in `reports/phase-3-regression.md` is ticked; the human visually agrees with the side-by-side composite (captured at `reports/phase-3-visual-composite.png`).

---

## User Persona

**Target User**: Project maintainer (the human) approving Phase 3 before Phase 4 begins.

**Use Case**: Phase 3 is the single largest visual milestone. Before committing to the Phase 4 modulation / preset / record work, the maintainer needs confidence that what ships to `pnpm preview` matches the TouchDesigner reference screenshot.

**User Journey**:
1. Maintainer runs the Ralph loop for Task 3.R
2. Ralph runs all 4 validation levels on a fresh preview build
3. Ralph spawns a Playwright MCP session that navigates to the preview URL with a fake-webcam stream containing a detectable hand (or injects fake landmarks via dev hook)
4. Ralph captures three PNGs: live app, reference, side-by-side composite
5. Ralph writes `reports/phase-3-regression.md` enumerating the checklist status
6. Maintainer reviews the composite and report
7. If the checklist passes, Phase 3 is complete and Phase 4 may begin

**Pain Points Addressed**: Without this regression gate, Phase 4 could start on a subtly broken Phase 3 and the regressions compound. This task enforces a visual-alignment checkpoint.

---

## Why

- Satisfies the "last task of every phase is a regression pass" requirement from the PRP methodology and PHASES.md §Task Execution Protocol
- Closes out D5 / D9 / D18 / D27 / D37 — all visual DISCOVERY decisions are tested against the reference screenshot
- Produces persistent artifacts (`reports/phase-3-*.png` + `.md`) that later phases can diff against for regression detection
- Reference: `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png` is the visual contract

---

## What

- All four validation levels green on a fresh `pnpm build && pnpm preview` production build (NOT `pnpm dev`)
- Playwright MCP session:
  - Navigate to `http://localhost:4173` (Vite preview default) or `PLAYWRIGHT_BASE_URL`
  - Grant camera via `--use-fake-device-for-media-stream`
  - Inject deterministic fake landmarks via `window.__handTracker.setFakeLandmarks([...])` OR load a real-hand y4m if available
  - Wait 2s for warmup (model load + first detection)
  - Capture `browser_take_screenshot` → `reports/phase-3-visual-01-app.png`
  - Copy `reference-assets/touchdesigner-reference.png` → `reports/phase-3-visual-02-reference.png`
  - Build a 2-up composite (left: app, right: reference) → `reports/phase-3-visual-composite.png` (Playwright MCP can use `browser_run_code` with a simple canvas-based compositor, OR spawn a tiny Node + sharp script)
- Write `reports/phase-3-regression.md` with the explicit 8-point visual checklist (below), FPS measurement, console log summary, and a ship/fix decision
- `tests/e2e/phase-3-regression.spec.ts` spec: automates the parts of the checklist that can be asserted programmatically (grid-line presence, blob count, non-black mosaic region pixels, FPS floor)

### Explicit Visual Fidelity Checklist (from PHASES.md Task 3.R + D-number contracts)

The report MUST enumerate every item below with PASS / FAIL / N-A:

1. **Grid visible** — 12 columns × 8 rows of grid lines are drawn over the video (D4)
2. **Grid non-uniform** — column widths are visibly non-uniform (seeded RNG, variance 0.6 default; D4)
3. **Fingertip blobs — count** — exactly 5 dotted-circle landmark blobs are rendered when one hand is detected (D6)
4. **Fingertip blobs — labels** — each blob has an adjacent `x: 0.xxx  y: 0.xxx` label with exactly 3 decimal places (D7)
5. **Mosaic — placement** — pixelation is visible ONLY inside the hand-bounded polygon; no mosaic outside the hand (D5)
6. **Mosaic — snapping to cells** — mosaic regions are quantized to grid-cell AABBs (rectangular boundaries visible, not organic) (D5)
7. **Dark theme** — overall background dark; no light-theme artifacts (D12)
8. **Full-viewport** — canvas fills 100vw × 100vh; no letterboxing; mirror mode ON by default (CSS `scaleX(-1)` on display canvases; D10, D18, D27)

Additionally, non-visual assertions:

- **FPS ≥ 20** — dev hook `window.__handTracker.getFPS()` returns ≥ 20 over a 3-second measurement window (D21 success-criteria)
- **Zero console errors** — no `error` or `unhandledrejection` in the 5s capture window
- **Context loss survivable** — forcing loss → restore via `WEBGL_lose_context` resumes rendering (Task 3.5 check re-exercised here)
- **crossOriginIsolated === true** — Vite preview serves correct COOP/COEP headers (D31)

### NOT Building (scope boundary)

- Any Phase 4 feature (modulation live, presets, record, reduced-motion)
- Any Phase 5 feature (service worker, Vercel deploy, 8-state forced-failure E2E)
- A pixel-exact diff between app and reference — impossible given webcam variance; the checklist is structural
- Any visual change to the app itself — this task is test-only (modifications are limited to reports and the regression spec)

### Success Criteria

- [ ] `pnpm check` (alias: `pnpm biome check . && pnpm tsc --noEmit`) exits 0
- [ ] `pnpm vitest run` exits 0 (all Phase 1–3 unit tests)
- [ ] `pnpm build` exits 0
- [ ] `pnpm preview` served build boots without console errors
- [ ] `PLAYWRIGHT_BASE_URL=http://localhost:4173 pnpm test:e2e --grep "Task"` exits 0 (every Phase 1–3 E2E spec passes against the preview build)
- [ ] `PLAYWRIGHT_BASE_URL=http://localhost:4173 pnpm test:e2e --grep "Task 3.R:"` exits 0
- [ ] `reports/phase-3-visual-01-app.png`, `reports/phase-3-visual-02-reference.png`, `reports/phase-3-visual-composite.png` all exist and are non-empty
- [ ] `reports/phase-3-regression.md` exists with every checklist item marked PASS or explicit FAIL-with-reason

---

## All Needed Context

```yaml
files:
  - path: .claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png
    why: THE visual contract. Open this first. Every checklist item ties back to a specific element of this screenshot
    gotcha: The reference is a single frame of a specific hand pose; your live app capture will differ in hand pose / lighting. Compare STRUCTURE (grid, blobs, mosaic placement), not pixel-exact content

  - path: src/ui/Stage.tsx
    why: The entry point that composites the WebGL + 2D canvases. Stability of this file is the regression target
    gotcha: Any modification here must preserve existing Phase 1/2/3 behavior — this task is read-only with respect to Stage.tsx

  - path: src/engine/devHooks.ts
    why: Provides window.__handTracker.getFPS, .getLandmarkCount, .setFakeLandmarks, .getLastRegionCount — the E2E spec relies on these
    gotcha: All dev hooks are guarded by import.meta.env.DEV || MODE === 'test'. The preview build is production mode by default — the Playwright spec must either (a) run against `pnpm dev` OR (b) Vite's preview build must whitelist MODE === 'test' via a .env.test file. Prefer (b) — `.env.test` sets VITE_DEV_HOOKS=1 and devHooks.ts checks that flag as a final gate

  - path: tests/e2e/smoke.spec.ts
    why: MIRROR — existing Playwright spec structure (describe, fake-webcam launchOptions, beforeAll patterns)
    gotcha: The spec title MUST start with `Task 3.R:` so `--grep "Task 3.R:"` resolves correctly

  - path: playwright.config.ts
    why: Understand launchOptions.args and the baseURL resolution (PLAYWRIGHT_BASE_URL override)
    gotcha: --use-fake-device-for-media-stream must be present in launchOptions.args for every project

urls:
  - url: https://playwright.dev/docs/screenshots
    why: page.screenshot({ path, fullPage: true }) API
    critical: "Use fullPage: false for viewport-only; use clip: { x,y,width,height } if you need to crop to the canvas"

  - url: https://playwright.dev/docs/test-cli
    why: --grep and test.describe filtering
    critical: "The grep pattern matches the full concatenated test title (describe > test). 'Task 3.R:' is placed at the top-level describe"

  - url: https://vite.dev/config/server-options.html#server-headers
    why: vite preview serves the same COOP/COEP headers as vite dev when vite.config.ts sets them — this task assumes Task 1.1 already configured them
    critical: "If crossOriginIsolated === false on preview, the hardening config is broken and ALL Phase 3 downstream assumptions fail"

skills:
  - prp-task-ralph-loop
  - hand-tracker-fx-architecture
  - ogl-webgl-mosaic
  - playwright-e2e-webcam
  - vite-vercel-coop-coep

discovery:
  - D4: Grid generation params
  - D5: Hand polygon regions
  - D6: Fingertip blobs (5 per hand)
  - D7: Label format (3 decimal normalized)
  - D9: Mosaic defaults
  - D10: Mirror ON by default
  - D12: Dark theme only
  - D18: Full-viewport stretch, ogl renderer
  - D21: Testing scope — render FPS ≥ 20
  - D27: Mirror at display, not at shader
  - D31: COOP/COEP/CSP headers
  - D37: FrameContext shape
```

### Current Codebase Tree (relevant subset)

```
src/                               # All of Phase 1–3 implementation
public/
  models/hand_landmarker.task
  wasm/
tests/
  e2e/
    smoke.spec.ts
    task-1-*.spec.ts
    task-2-*.spec.ts
    task-3-1.spec.ts               # from Task 3.1
    task-3-2.spec.ts
    task-3-3.spec.ts
    task-3-4.spec.ts
    task-3-5.spec.ts
reports/                           # may or may not exist; create if missing
```

### Desired Codebase Tree

```
tests/
  e2e/
    phase-3-regression.spec.ts     # NEW — Task 3.R: describe block
reports/
  phase-3-visual-01-app.png        # NEW — live app screenshot
  phase-3-visual-02-reference.png  # NEW — copy of reference
  phase-3-visual-composite.png     # NEW — 2-up side-by-side
  phase-3-regression.md            # NEW — checklist + decision
```

### Known Gotchas

```typescript
// CRITICAL: Run against `pnpm preview`, NOT `pnpm dev`. The preview build exercises
// the production bundle (tree-shaking, minification, correct COOP/COEP) — this is
// where most "works in dev, broken in prod" bugs surface.

// CRITICAL: Dev hooks are guarded by import.meta.env.DEV. For the preview build
// (production mode), enable them via a .env.test file or `VITE_DEV_HOOKS=1`.
// Add a final gate in devHooks.ts: `if (import.meta.env.DEV || import.meta.env.VITE_DEV_HOOKS === '1')`
// The regression spec runs with `VITE_DEV_HOOKS=1 pnpm build && pnpm preview`.

// CRITICAL: The reference screenshot is NOT a pixel-exact target. The app capture
// will differ in hand pose, lighting, and color balance. Compare STRUCTURE only.

// CRITICAL: The fake webcam y4m for Chromium does not contain a detectable hand
// by default. Use --use-file-for-fake-video-capture with a pre-recorded hand y4m
// OR inject deterministic landmarks via setFakeLandmarks dev hook.
// Prefer the dev-hook injection — deterministic, fast, no large asset.

// CRITICAL: Playwright MCP (via the Claude Code browser_* tools) is used for the
// interactive screenshot capture. The automated spec uses `page.screenshot(...)`.
// Both produce PNGs; store both under reports/ with stable names.

// CRITICAL: crossOriginIsolated === false means SharedArrayBuffer + Chrome's
// high-precision timer are disabled, and MediaPipe GPU delegate may silently
// downgrade to CPU — visual output can still look correct but FPS will drop
// below 20. Always assert `await page.evaluate(() => self.crossOriginIsolated)`
// returns true BEFORE running the rest of the regression.

// CRITICAL: FPS measurement window. Do not measure during the first 2s after
// mount — the model load + first detection dominate. Start the FPS window at
// t=2000ms and measure for 3000ms (3s) before asserting ≥ 20.

// CRITICAL: Do not commit reports/phase-3-*.png files to git unless specifically
// requested — they are large binaries. Add reports/*.png to .gitignore or leave
// them untracked. The regression report .md does get committed.

// CRITICAL: Running all Phase 1–3 E2E specs against the preview build is the
// true regression — do NOT only run the Task 3.R spec. The grep is `"Task"` or
// `"Task [123]\\."` to scope to Phase 1–3.
```

---

## Implementation Blueprint

### Data Models

No new types. This task modifies tests and produces reports.

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE tests/e2e/phase-3-regression.spec.ts
  - IMPLEMENT: Playwright test file:
      import { test, expect } from '@playwright/test';
      import { promises as fs } from 'node:fs';
      import path from 'node:path';

      test.describe('Task 3.R: Phase 3 regression — visual fidelity gate', () => {
        test.beforeEach(async ({ page }) => {
          await page.goto('/');
          // Wait for GRANTED state
          await expect(page.getByTestId('stage-ready')).toBeVisible({ timeout: 10_000 });
        });

        test('crossOriginIsolated is true', async ({ page }) => {
          const isolated = await page.evaluate(() => self.crossOriginIsolated);
          expect(isolated).toBe(true);
        });

        test('grid has 12 columns and 8 rows with non-uniform widths', async ({ page }) => {
          const widths = await page.evaluate(
            () => (window as unknown as { __handTracker: { getGridWidths: () => number[] } })
              .__handTracker.getGridWidths(),
          );
          expect(widths).toHaveLength(12);
          const unique = new Set(widths.map(w => w.toFixed(4)));
          expect(unique.size).toBeGreaterThan(1);  // non-uniform
        });

        test('5 fingertip blobs render when fake landmarks injected', async ({ page }) => {
          await page.evaluate(() => {
            (window as unknown as { __handTracker: { setFakeLandmarks: (lms: unknown[]) => void } })
              .__handTracker.setFakeLandmarks(/* 21 sample landmarks */ [...]);
          });
          await page.waitForTimeout(200);
          const blobs = await page.locator('[data-testid="landmark-blob"]').count();
          expect(blobs).toBe(5);
        });

        test('blob labels use 3-decimal normalized format', async ({ page }) => {
          const label = await page.locator('[data-testid="landmark-label"]').first().textContent();
          expect(label).toMatch(/^x: \d\.\d{3}\s+y: \d\.\d{3}$/);
        });

        test('mosaic active when hand polygon present — region count > 0', async ({ page }) => {
          await page.evaluate(() => { /* inject landmarks */ });
          await page.waitForTimeout(200);
          const count = await page.evaluate(
            () => (window as unknown as { __handTracker: { getLastRegionCount: () => number } })
              .__handTracker.getLastRegionCount(),
          );
          expect(count).toBeGreaterThan(0);
        });

        test('FPS ≥ 20 over a 3-second window after warmup', async ({ page }) => {
          await page.waitForTimeout(2000);  // warmup
          const fps = await page.evaluate(
            () => (window as unknown as { __handTracker: { measureFPS: (ms: number) => Promise<number> } })
              .__handTracker.measureFPS(3000),
          );
          expect(fps).toBeGreaterThanOrEqual(20);
        });

        test('no console errors during a 5-second capture window', async ({ page }) => {
          const errors: string[] = [];
          page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
          page.on('pageerror', err => errors.push(err.message));
          await page.waitForTimeout(5000);
          expect(errors).toEqual([]);
        });

        test('captures screenshot and writes side-by-side composite', async ({ page }) => {
          await page.evaluate(() => { /* inject landmarks */ });
          await page.waitForTimeout(500);
          const reportsDir = path.resolve(process.cwd(), 'reports');
          await fs.mkdir(reportsDir, { recursive: true });
          const appPath = path.join(reportsDir, 'phase-3-visual-01-app.png');
          const refPath = path.join(reportsDir, 'phase-3-visual-02-reference.png');
          const compPath = path.join(reportsDir, 'phase-3-visual-composite.png');
          await page.screenshot({ path: appPath, fullPage: false });
          await fs.copyFile(
            path.resolve('.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png'),
            refPath,
          );
          // Composite via page.evaluate with two Image elements and a canvas:
          await page.goto(`data:text/html,<canvas id="c"></canvas>`);
          await page.evaluate(async ({ appB64, refB64 }) => {
            const load = (src: string): Promise<HTMLImageElement> => new Promise((res, rej) => {
              const img = new Image();
              img.onload = () => res(img);
              img.onerror = rej;
              img.src = src;
            });
            const [appImg, refImg] = await Promise.all([load(appB64), load(refB64)]);
            const c = document.getElementById('c') as HTMLCanvasElement;
            const w = Math.max(appImg.width, refImg.width);
            const h = appImg.height + refImg.height;
            c.width = w * 2; c.height = Math.max(appImg.height, refImg.height);
            const ctx = c.getContext('2d')!;
            ctx.fillStyle = '#111'; ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(appImg, 0, 0);
            ctx.drawImage(refImg, w, 0);
            return c.toDataURL('image/png');
          }, {
            appB64: `data:image/png;base64,${(await fs.readFile(appPath)).toString('base64')}`,
            refB64: `data:image/png;base64,${(await fs.readFile(refPath)).toString('base64')}`,
          }).then(async (dataUrl) => {
            const base64 = dataUrl.split(',')[1]!;
            await fs.writeFile(compPath, Buffer.from(base64, 'base64'));
          });
          await expect(fs.stat(compPath)).resolves.toBeDefined();
        });

        test('context loss → restore resumes rendering', async ({ page }) => {
          // Task 3.5 smoke: loseContext then restoreContext, assert region count returns
          await page.evaluate(() => {
            const c = document.querySelector('canvas[data-testid="webgl-canvas"]') as HTMLCanvasElement;
            const gl = c.getContext('webgl2') as WebGL2RenderingContext;
            gl.getExtension('WEBGL_lose_context')?.loseContext();
          });
          await page.waitForTimeout(150);
          await page.evaluate(() => {
            const c = document.querySelector('canvas[data-testid="webgl-canvas"]') as HTMLCanvasElement;
            const gl = c.getContext('webgl2') as WebGL2RenderingContext;
            gl.getExtension('WEBGL_lose_context')?.restoreContext();
          });
          await page.waitForTimeout(500);
          await page.evaluate(() => { /* re-inject fake landmarks */ });
          await page.waitForTimeout(200);
          const count = await page.evaluate(
            () => (window as unknown as { __handTracker: { getLastRegionCount: () => number } })
              .__handTracker.getLastRegionCount(),
          );
          expect(count).toBeGreaterThan(0);
        });
      });
  - MIRROR: tests/e2e/smoke.spec.ts (describe / beforeEach / fake-webcam launchOptions)
  - NAMING: describe block starts with `Task 3.R:` so --grep resolves
  - GOTCHA: Composite-image generation via page.evaluate is convenient but fragile; alternative = spawn a small Node + sharp script. Either is acceptable; start with the page.evaluate approach for zero new dependencies
  - VALIDATE: pnpm test:e2e --grep "Task 3.R:"

Task 2: CREATE reports/phase-3-regression.md (Ralph generates this after the spec passes)
  - TEMPLATE:
      # Phase 3 Regression Report

      **Date**: <ISO>
      **Branch**: task/3-R-phase-3-regression
      **Build**: pnpm build && pnpm preview (http://localhost:4173)

      ## Validation Levels
      | Level | Command | Result |
      | --- | --- | --- |
      | L1 | pnpm biome check . | PASS |
      | L1 | pnpm tsc --noEmit | PASS |
      | L2 | pnpm vitest run | PASS (N/N) |
      | L3 | pnpm build | PASS |
      | L4 | pnpm test:e2e --grep "Task" | PASS (N specs) |
      | L4 | pnpm test:e2e --grep "Task 3.R:" | PASS |

      ## Visual Fidelity Checklist
      | # | Item | D-numbers | Status | Notes |
      | --- | --- | --- | --- | --- |
      | 1 | Grid visible — 12×8 | D4 | PASS/FAIL | <notes> |
      | 2 | Grid non-uniform | D4 | PASS/FAIL | <notes> |
      | 3 | 5 fingertip blobs | D6 | PASS/FAIL | <notes> |
      | 4 | Blob labels — 3 decimals | D7 | PASS/FAIL | <notes> |
      | 5 | Mosaic inside polygon only | D5 | PASS/FAIL | <notes> |
      | 6 | Mosaic snapped to cells | D5 | PASS/FAIL | <notes> |
      | 7 | Dark theme | D12 | PASS/FAIL | <notes> |
      | 8 | Full-viewport + mirror ON | D10, D18, D27 | PASS/FAIL | <notes> |

      ## Non-Visual Assertions
      | Assertion | Target | Measured | Result |
      | --- | --- | --- | --- |
      | FPS | ≥ 20 | <N> | PASS/FAIL |
      | Console errors | 0 | <N> | PASS/FAIL |
      | crossOriginIsolated | true | <bool> | PASS/FAIL |
      | Context loss → restore | mosaic resumes | <observed> | PASS/FAIL |

      ## Artifacts
      - reports/phase-3-visual-01-app.png
      - reports/phase-3-visual-02-reference.png
      - reports/phase-3-visual-composite.png

      ## Decision
      - [ ] SHIP — proceed to Phase 4
      - [ ] FIX — open hotfix task <3.N> and re-run regression
  - VALIDATE: the file exists, all checklist rows are PASS or an explicit FAIL entry with a linked hotfix task

Task 3: Playwright MCP interactive capture (human-reviewed path)
  - RUN: The Ralph agent invokes the Playwright MCP server (see MCP Server Instructions in the environment) with these steps:
      * browser_navigate to http://localhost:4173 (preview URL)
      * browser_evaluate to inject fake landmarks via window.__handTracker.setFakeLandmarks(...)
      * browser_wait_for 1000ms
      * browser_take_screenshot → save as reports/phase-3-visual-01-app.png
      * Copy .claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png → reports/phase-3-visual-02-reference.png
      * browser_run_code to compose the 2-up composite and download → reports/phase-3-visual-composite.png
  - NOTES:
      * This path is complementary to Task 1's automated spec. Task 1 captures programmatic assertions; this path captures the side-by-side image for human review.
      * Save screenshots EXACTLY to the listed paths; the regression report template references them by name.
      * If Playwright MCP is unavailable, the automated spec in Task 1 covers screenshot capture; the composite-image step is the only MCP-specific nicety.
  - VALIDATE: All three PNGs exist under reports/ and are non-empty (ls -la reports/phase-3-visual-*.png)

Task 4: Regression run orchestration
  - RUN (in order):
      1. pnpm biome check .
      2. pnpm tsc --noEmit
      3. pnpm vitest run
      4. pnpm build
      5. pnpm preview &     # background, port 4173
         (use Bash run_in_background)
      6. PLAYWRIGHT_BASE_URL=http://localhost:4173 VITE_DEV_HOOKS=1 pnpm test:e2e --grep "Task"
      7. PLAYWRIGHT_BASE_URL=http://localhost:4173 VITE_DEV_HOOKS=1 pnpm test:e2e --grep "Task 3.R:"
      8. Kill preview process
      9. Fill in reports/phase-3-regression.md with the results
  - VALIDATE: Each step exits 0; on failure, stop and diagnose (do NOT continue to later steps)
```

### Integration Points

```yaml
DEV_HOOKS:
  - Add `getGridWidths(): number[]` and `measureFPS(ms): Promise<number>` to src/engine/devHooks.ts
  - Gate final check: `if (import.meta.env.DEV || import.meta.env.VITE_DEV_HOOKS === '1')`
  - Preview build opts in via `VITE_DEV_HOOKS=1 pnpm build && pnpm preview`

VITE_CONFIG:
  - Ensure vite.config.ts has `preview: { headers: { COOP/COEP... } }` mirroring the dev config
  - If missing, this task must add it — the crossOriginIsolated assertion depends on it

TEST_IDS:
  - data-testid="stage-ready" on the Stage root once the canvases have mounted and the first rVFC tick has fired
  - data-testid="landmark-blob" on each rendered fingertip blob (5 per hand)
  - data-testid="landmark-label" on each coordinate label
  - data-testid="webgl-canvas" attribute on the WebGL canvas for readPixels / context-loss targeting
```

---

## Validation Loop

### Level 1 — Syntax and Style

```bash
pnpm biome check .
pnpm tsc --noEmit
```

### Level 2 — Unit Tests

```bash
pnpm vitest run
```

### Level 3 — Integration (production build + preview)

```bash
pnpm build
# Start preview in background (port 4173):
VITE_DEV_HOOKS=1 pnpm preview
# The preview server stays up while L4 runs; kill after L4 completes.
```

### Level 4 — E2E against preview

```bash
# Full Phase 1–3 regression
PLAYWRIGHT_BASE_URL=http://localhost:4173 pnpm test:e2e --grep "Task"

# Task 3.R specifically
PLAYWRIGHT_BASE_URL=http://localhost:4173 pnpm test:e2e --grep "Task 3.R:"
```

### Playwright MCP screenshot capture (complementary to L4)

```
1. browser_navigate http://localhost:4173
2. browser_evaluate window.__handTracker.setFakeLandmarks([...])
3. browser_wait_for 1000ms
4. browser_take_screenshot → reports/phase-3-visual-01-app.png
5. Copy reference asset → reports/phase-3-visual-02-reference.png
6. browser_run_code (canvas 2-up composite) → reports/phase-3-visual-composite.png
7. Close browser
```

---

## Final Validation Checklist

### Technical

- [ ] All 4 levels exit 0 against the preview build (not dev)
- [ ] `pnpm biome check .` — zero errors
- [ ] `pnpm tsc --noEmit` — zero errors
- [ ] `pnpm vitest run` — all tests pass
- [ ] `pnpm build` — production build succeeds
- [ ] `pnpm test:e2e --grep "Task"` — all Phase 1–3 specs pass against preview
- [ ] `pnpm test:e2e --grep "Task 3.R:"` — regression spec passes

### Feature

- [ ] All 8 visual checklist items in `reports/phase-3-regression.md` marked PASS (or FAIL with a linked hotfix task)
- [ ] `reports/phase-3-visual-01-app.png` exists and shows a recognizable mosaic-on-hand composition
- [ ] `reports/phase-3-visual-02-reference.png` exists (copy of touchdesigner-reference.png)
- [ ] `reports/phase-3-visual-composite.png` exists as a side-by-side 2-up
- [ ] FPS ≥ 20 over a 3-second window (measured on the maintainer's dev hardware)
- [ ] Zero console errors in a 5-second capture window
- [ ] crossOriginIsolated === true on the preview URL
- [ ] Context-loss → restore cycle leaves the mosaic rendering

### Code Quality

- [ ] No `any` types introduced in the regression spec
- [ ] Regression spec uses real Playwright assertions (`expect(...).toBe(...)`), not bare `if` + `throw`
- [ ] Test IDs (`stage-ready`, `landmark-blob`, `landmark-label`, `data-testid="webgl-canvas"`) present in the Phase 1/2 components (add if missing)
- [ ] `VITE_DEV_HOOKS=1` flag documented in the regression report

---

## Anti-Patterns

- Do not run the regression against `pnpm dev` — must be `pnpm build && pnpm preview`
- Do not ship if any checklist item is FAIL without a linked hotfix
- Do not pixel-compare app vs reference — compare structure only
- Do not commit `reports/*.png` to git unless explicitly requested (large binaries)
- Do not hardcode `localhost:4173` — use `PLAYWRIGHT_BASE_URL` env var
- Do not enable dev hooks unconditionally in production — gate with `VITE_DEV_HOOKS === '1'`
- Do not modify any Phase 1–3 source to make the regression pass — fix the regression finding as a hotfix task, not an in-place edit in this file
- Do not emit `<promise>COMPLETE</promise>` unless ALL four validation levels AND the visual checklist are green
- Do not skip the context-loss spec on the assumption Task 3.5 already covered it — the regression re-exercises every task in the phase

---

## No Prior Knowledge Test

- [ ] Every file path in `All Needed Context` exists (Stage.tsx, devHooks.ts, smoke.spec.ts, reference PNG)
- [ ] Every URL in `urls:` is reachable
- [ ] Every D-number cited exists in DISCOVERY.md (D4, D5, D6, D7, D9, D10, D12, D18, D21, D27, D31, D37)
- [ ] All prior Phase 3 tasks (3.1–3.5) are complete and their E2E specs exist under `tests/e2e/task-3-*.spec.ts`
- [ ] Validation Loop commands are copy-paste runnable with no placeholders
- [ ] The reference screenshot exists at the cited path
- [ ] The task is atomic — does not require any Phase 4 feature

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/ogl-webgl-mosaic/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
.claude/skills/vite-vercel-coop-coep/SKILL.md
```
