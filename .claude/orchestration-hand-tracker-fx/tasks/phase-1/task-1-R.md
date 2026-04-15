# Task 1.R: Phase 1 Regression — L1-L4 on `pnpm preview` + manual MCP walkthrough

**Phase**: 1 — Foundation
**Branch**: `task/1-R-phase-1-regression`
**Commit prefix**: `Task 1.R:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Prove that the cumulative output of Tasks 1.1 through 1.6 runs end-to-end against a fresh production build served by `pnpm preview` — with all four validation levels green, the COOP/COEP/CSP headers intact, the full `Task 1.N:` Playwright suite passing, and a manual Playwright MCP walkthrough confirming the `PROMPT → GRANTED` transition produces landmarks inside 3 seconds with zero console errors or unhandled rejections.

**Deliverable**: A regression report committed to `.claude/orchestration-hand-tracker-fx/reports/phase-1-regression.md` that captures (a) timestamps and exit codes for L1-L4 commands, (b) the `curl -sI` header payload from `http://localhost:4173/`, (c) the MCP walkthrough trace (DOM snapshot + console messages at PROMPT, at GRANTED, and after 3 s warmup), and (d) a screenshot `reports/phase-1-regression-granted.png` showing the unmirrored webcam bytes feeding the hidden `<video>` and the mirrored stacked canvases. No new runtime code ships in this task — only a report, the optional header-check script, and any *fixes* the agent discovers along the way (backported to the originating task's files).

**Success Definition**: `pnpm check` exits 0, `pnpm build` exits 0, `pnpm preview` stays up, `curl -sI http://localhost:4173/` emits `cross-origin-opener-policy: same-origin` + `cross-origin-embedder-policy: require-corp`, `pnpm test:e2e --grep "Task 1\\."` passes every Phase 1 spec (1.1 smoke, 1.2 usecamera, 1.3 error-states, 1.4 handlandmarker, 1.5 renderloop, 1.6 stage), and the Playwright MCP manual walkthrough reports `state === "GRANTED"` + `window.__handTracker.getLandmarkCount() >= 0` + `getFPS() > 0` within 3 s of the camera grant, with zero `pageerror` events and zero unhandled promise rejections.

---

## User Persona

**Target User**: Any future Ralph agent (or human) about to start Phase 2 work — they need a proof that Phase 1 is a green baseline before layering the effect registry, paramStore, and overlay renderers on top.

**Use Case**: Before Phase 2 branches off `main`, the agent runs this task to confirm that the integrated Phase 1 foundation (scaffold → useCamera → error UI → MediaPipe → rVFC loop → Stage) works against a production build (not just dev), so any regression seen in Phase 2 is attributable to Phase 2's changes rather than inherited drift.

**User Journey**:
1. Agent runs `pnpm check`. Expected: 0 errors.
2. Agent runs `pnpm build`. Expected: `dist/` populated, 0 errors.
3. Agent runs `pnpm preview` in the background on :4173.
4. Agent runs `scripts/check-headers.sh http://localhost:4173` (or the inline `curl -sI` one-liner). Expected: both COOP + COEP headers visible with the correct values.
5. Agent runs the full `Task 1.N:` Playwright suite against the running preview. Expected: every spec passes.
6. Agent drives Playwright MCP against the preview URL: navigates, waits for `GRANTED`, polls `window.__handTracker` for FPS + landmark count, screenshots the composed stage, verifies the console log has no errors.
7. Agent writes the regression report and — if any step failed — backports a fix into the originating task file (e.g., Task 1.2 gotcha addendum) and reruns from step 1.

**Pain Points Addressed**: Without a phase regression, every subsequent phase inherits latent misconfiguration (e.g., a header drift between `vite.config.ts` and `vercel.json`, a CSP that worked in dev but not preview, a StrictMode double-mount leak that only appears after `pnpm build`). D42 makes this mandatory.

---

## Why

- D42 requires the last task of every phase to run all four validation levels against the closest-to-live build (`pnpm build && pnpm preview`).
- D31 (Vercel headers) and D32 (dev-server headers) must be asserted at runtime on the preview server — the preview config is the last pre-deploy gate before Phase 5 pushes to Vercel.
- D41 (PRP task-file format) mandates 4 validation levels per task; the phase-regression variant runs all 4 over the *cumulative* Phase 1 surface so integration regressions are caught before they ship.
- Unlocks Phase 2 — the effect registry and paramStore can only begin on a proven-green foundation. A silent regression here costs an order of magnitude more Ralph iterations downstream.
- The Playwright MCP manual walkthrough is the only coverage that exercises a *real* browser's `navigator.permissions` + `navigator.mediaDevices` flow without the `--use-fake-device-for-media-stream` override; it catches missing Permissions-Policy or CSP headers that the fake-device flag would mask.

---

## What

- Run L1-L4 against the produced `pnpm preview` build (not dev) and capture exit codes.
- Add a small `scripts/check-headers.sh` (if not already added by Task 1.1) that `curl -sI`s `/`, `/models/hand_landmarker.task`, and `/wasm/vision_wasm_internal.wasm`, greps for the 5 required headers (`cross-origin-opener-policy`, `cross-origin-embedder-policy`, `content-security-policy`, `permissions-policy`, `referrer-policy`), and exits non-zero on any miss.
- Run the cumulative Playwright suite: `pnpm test:e2e --grep "Task 1\\."` (regex escapes the dot) — expected 6 specs pass.
- Perform a manual Playwright MCP walkthrough on the preview URL and record the trace inside the regression report.
- Verify the devtools console is empty of errors and `page.on('pageerror')` / `unhandledrejection` events yield zero occurrences during the 10-second capture window.
- Write `.claude/orchestration-hand-tracker-fx/reports/phase-1-regression.md` with a structured pass/fail table, header dump, console snapshot, and the `reports/phase-1-regression-granted.png` attached.
- If any failure surfaces, the agent BACKPORTS the fix into the originating task file (updating gotchas / acceptance criteria) and re-runs the regression from L1. Never fix a broken task only in 1.R — the original task file must inherit the lesson.

### NOT Building (scope boundary)

- No Vercel deploy — Phase 5. The regression is strictly local preview.
- No visual-diff screenshot tolerance — Phase 5.6 ships the visual-regression gate. This task stores one reference screenshot but does not diff it.
- No Firefox / WebKit runs — Chromium-only per Phase 1 scope (D13).
- No new feature code. If a bug is found, the fix lands in the ORIGINATING task's files (e.g., `src/camera/useCamera.ts` for a Task 1.2 bug) — not in 1.R.
- No modifications to `vite.config.ts` / `vercel.json` unless a regression proves a header is wrong; a drift fix is allowed and must be mirrored across both files.
- No new unit tests — L2 is the union of existing tests from 1.1-1.6.

### Success Criteria

- [ ] `pnpm check` exits 0 on `main`-style clean checkout (no Vitest red, no tsc error, no Biome error).
- [ ] `pnpm build` exits 0 and produces `dist/index.html`, `dist/assets/*`, plus the MediaPipe/OGL/Tweakpane manual chunks.
- [ ] `pnpm preview` serves :4173 and responds 200 on `/`, `/models/hand_landmarker.task`, `/wasm/vision_wasm_internal.wasm`.
- [ ] `scripts/check-headers.sh http://localhost:4173` exits 0 with all five header families present.
- [ ] `pnpm test:e2e --grep "Task 1\\."` passes 6/6 specs (1.1, 1.2, 1.3, 1.4, 1.5, 1.6) with zero skips.
- [ ] Playwright MCP walkthrough: camera grant flow completes, `data-testid="camera-state"` reaches `GRANTED` within 10 s, `window.__handTracker.getFPS() > 0` after 3 s warmup, landmark count is observable (≥ 0 under synthetic Y4M; documented).
- [ ] Zero `pageerror` events, zero unhandled promise rejections during the 10-second capture window post-GRANTED.
- [ ] Screenshot `reports/phase-1-regression-granted.png` committed.
- [ ] Regression report `reports/phase-1-regression.md` committed with the pass/fail table, timestamps, exit codes, header dump, console snapshot summary.

---

## All Needed Context

```yaml
files:
  - path: package.json
    why: Provides `check`, `build`, `preview`, `test:setup`, `test:e2e` scripts — the regression ONLY composes these
    gotcha: `pnpm preview` does NOT run build; always run `pnpm build && pnpm preview` together. The preview host is `localhost:4173` per `playwright.config.ts`.

  - path: vite.config.ts
    why: `SECURITY_HEADERS` is the source of truth for preview-mode COOP/COEP/CSP; the header script + MCP runtime check both verify this
    gotcha: Preview headers include the full CSP (dev omits it); `pnpm preview` is the only local surface that produces production-parity headers

  - path: vercel.json
    why: Phase 5 will deploy against these headers; the preview config must match. Any drift discovered here should be fixed in BOTH files in the same commit.
    gotcha: `vercel.json` uses `"source": "/(.*)"` glob; `vite.config.ts` sets `preview.headers` — keep the header values character-identical

  - path: playwright.config.ts
    why: The `webServer` definition runs `pnpm build && pnpm preview` automatically when `PLAYWRIGHT_BASE_URL` is unset; DO NOT set that env var for this task
    gotcha: Chromium-only; `--use-fake-device-for-media-stream` + `--use-file-for-fake-video-capture=${FAKE_VIDEO}` are wired via launchOptions; the Y4M must be present via `pnpm test:setup`

  - path: tests/e2e/
    why: Contains smoke.spec.ts (1.1), usecamera.spec.ts (1.2), errorstates.spec.ts (1.3), handlandmarker.spec.ts (1.4), renderloop.spec.ts (1.5), stage.spec.ts (1.6) — the full Phase 1 E2E set
    gotcha: Each describe EXACTLY starts with `Task 1.N:`; the grep regex MUST be `"Task 1\\."` (escaped dot) to match all six without grabbing Phase 2+ later

  - path: src/engine/devHooks.ts
    why: Defines `window.__handTracker.getFPS()` and `.getLandmarkCount()` under `import.meta.env.DEV || MODE === 'test'`; MCP evaluates both
    gotcha: Preview build runs with `mode: 'production'` by default; `pnpm build --mode test` is the variant the Playwright webServer uses. The MCP walkthrough runs against the test-mode preview so dev hooks are exposed.

  - path: scripts/gen-fake-webcam.mjs
    why: `pnpm test:setup` idempotently generates `tests/assets/fake-hand.y4m`; regression reruns this before L4
    gotcha: If the Y4M is missing at MCP walkthrough time, Chromium produces a black frame and HandLandmarker reports `landmarks.length === 0` — the walkthrough should ACCEPT that for synthetic Y4M (real-hand Y4M is optional future work)

  - path: .claude/orchestration-hand-tracker-fx/reports/
    why: Phase regression reports live here; this task creates `phase-1-regression.md` + `phase-1-regression-granted.png`
    gotcha: Directory exists (created in Phase 6); do NOT recreate .gitignore rules

urls:
  - url: https://developer.mozilla.org/en-US/docs/Web/API/crossOriginIsolated
    why: Runtime source of truth for COI; MCP walkthrough asserts `window.crossOriginIsolated === true` on preview
    critical: Response headers are necessary but not sufficient — the runtime flag is the final gate

  - url: https://playwright.dev/docs/test-cli#reference
    why: `--grep` regex semantics; escape the dot to avoid matching `Task 11:` (if a Phase 11 ever existed)
    critical: Use `"Task 1\\."` — the backslash escapes the shell, leaving the Playwright regex as `Task 1\.`

  - url: https://developer.chrome.com/docs/chromedriver/capabilities#using-fake-devices-in-chrome
    why: `--use-fake-device-for-media-stream` + `--use-file-for-fake-video-capture` flags; MCP walkthrough runs WITHOUT these flags to exercise the real permission prompt (the 6 E2E specs run WITH them)
    critical: MCP walkthrough uses the preview's actual `navigator.permissions.query` behavior; allow the prompt via MCP's `browser_handle_dialog` equivalent or manually click Allow

skills:
  - playwright-e2e-webcam
  - vite-vercel-coop-coep
  - prp-task-ralph-loop
  - hand-tracker-fx-architecture

discovery:
  - D21: Vitest (utilities) + one Playwright E2E with fake device; 4-level Validation Loop per task
  - D23: 8 permission states — walkthrough exercises PROMPT → GRANTED
  - D27: Webcam unmirrored at source, CSS mirror on display — MCP screenshot verifies the hidden <video> is unmirrored pixel-space
  - D31: Vercel headers — regression asserts preview matches
  - D32: Dev-server headers mirror production — preview is the pre-deploy gate
  - D41: PRP task format, 4-level validation
  - D42: Phase-regression task runs all 4 levels against `pnpm preview`
  - D45: Reference screenshot for visual gates — NOT used in Phase 1 regression (Phase 5.6 is the visual gate); regression only captures a granted-state screenshot for the archive
```

### Current Codebase Tree (relevant subset after Task 1.6)

```
hand-tracker/
  .github/workflows/ci.yml             # Task 1.1
  CLAUDE.md                            # Task 1.1
  package.json
  vite.config.ts
  vercel.json
  playwright.config.ts
  src/
    App.tsx                            # Task 1.6 (consumes <Stage/>)
    App.test.tsx
    main.tsx
    camera/
      useCamera.ts                     # Task 1.2
      cameraState.ts
      mapError.ts
      useCamera.test.ts
    ui/
      ErrorStates.tsx                  # Task 1.3
      PrePromptCard.tsx
      errorCopy.ts
      cards.css
      ErrorStates.test.tsx
      Stage.tsx                        # Task 1.6
      Stage.css
      Stage.test.tsx
    tracking/
      handLandmarker.ts                # Task 1.4
      errors.ts
      handLandmarker.test.ts
    engine/
      renderLoop.ts                    # Task 1.5
      types.ts
      devHooks.ts
      renderLoop.test.ts
  scripts/
    fetch-mediapipe-assets.mjs
    gen-fake-webcam.mjs
  tests/
    assets/                            # fake-hand.y4m generated
    e2e/
      smoke.spec.ts                    # Task 1.1
      usecamera.spec.ts                # Task 1.2
      errorstates.spec.ts              # Task 1.3
      handlandmarker.spec.ts           # Task 1.4
      renderloop.spec.ts               # Task 1.5
      stage.spec.ts                    # Task 1.6
  public/
    models/hand_landmarker.task
    wasm/
  .claude/orchestration-hand-tracker-fx/
    reports/                           # existing directory
```

### Desired Codebase Tree (this task adds)

```
hand-tracker/
  scripts/
    check-headers.sh                                        # optional helper (new unless Task 1.1 added it)
  .claude/orchestration-hand-tracker-fx/
    reports/
      phase-1-regression.md                                 # this task's structured report (new)
      phase-1-regression-granted.png                        # MCP screenshot at GRANTED (new)
```

No other source files change UNLESS a regression surfaces a bug — in which case the fix lands in the originating task's file(s) (e.g., `src/camera/useCamera.ts`) and is documented in the regression report's "Backported Fixes" section.

### Known Gotchas

```typescript
// CRITICAL: `pnpm preview` by default runs the production build. The Playwright
// webServer in playwright.config.ts runs `pnpm build --mode test` so dev hooks
// (__handTracker) are exposed. The MCP walkthrough MUST use the same build mode.
// Run: pnpm build --mode test && pnpm preview  (NOT pnpm preview alone against a
// fresh prod build — the dev hooks will not be defined).

// CRITICAL: The Playwright grep `--grep "Task 1\\."` — the escaped dot — MUST be
// used. `"Task 1:"` would match Phase 1 specs but miss a spec whose describe was
// `Task 1.6: Stage`. `"Task 1"` would over-match Phase 10+ if it ever exists.
// The exact regex to type in the shell is:   --grep "Task 1\\."

// CRITICAL: `pnpm preview` keeps the terminal blocked. Run it via
// `pnpm preview &` in a subshell or a separate tmux pane; remember to `kill %1`
// (or the PID) when done. The Playwright runner's webServer block handles this
// automatically for the L4 run, but the manual MCP walkthrough needs a
// long-lived preview the agent starts and tears down by hand.

// CRITICAL: Playwright MCP (the browser_* tools) drives a REAL Chromium without
// the fake-device flags. The camera prompt WILL appear. Use
// browser_handle_dialog or grant permissions via the page context's
// `grantPermissions(['camera'])` call before `browser_navigate`. The regression
// report must note which mechanism was used.

// CRITICAL: MediaPipe + synthetic Y4M: the fake-hand.y4m is a static test card
// (ffmpeg testsrc2 with a colored rectangle). HandLandmarker returns
// `landmarks.length === 0` against this input. The walkthrough's acceptance
// criterion is `getLandmarkCount() >= 0` (non-negative, no crash) — NOT `> 0`.
// A real-hand Y4M is a Phase 5.6 nice-to-have.

// CRITICAL: Zero console errors. `page.on('pageerror')` and
// `page.on('console')` filtered to `msg.type() === 'error'` must both yield
// zero events during a 10-second post-GRANTED capture. MediaPipe emits a
// `console.warn` about WASM threading on some hardware; warnings are ALLOWED,
// errors are NOT.

// CRITICAL: unhandledrejection is a `window`-level event, not a Playwright
// event. Listen via `await page.evaluate(() => { window.__unhandled = []; window.addEventListener('unhandledrejection', e => window.__unhandled.push(e.reason?.message ?? String(e.reason))); })`
// then read `window.__unhandled` after the capture window.

// CRITICAL: If a bug is found, the fix lands in the ORIGINATING task's files.
// DO NOT patch a regression by modifying 1.R artifacts — the next agent
// running the originating task's Ralph loop must inherit the fix.

// CRITICAL: `curl -sI` on `/wasm/*.wasm` must return `content-type: application/wasm`
// (not `application/octet-stream`). A wrong MIME type can make some browsers
// refuse streaming instantiation. The Vite preview server sets this correctly
// via the built-in asset middleware; the header script just confirms it.

// CRITICAL: The regression is RUN ON THE CURRENT BRANCH (`task/1-R-phase-1-regression`),
// which is itself forked from main AFTER 1.1-1.6 have merged. Do not run 1.R
// on a branch that lacks any of 1.1-1.6 — the grep will fail to find specs.
```

---

## Implementation Blueprint

### Data Models

No new types. Regression is pure orchestration + a report.

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE scripts/check-headers.sh (unless Task 1.1 already provided one)
  - IMPLEMENT:
      #!/usr/bin/env bash
      set -euo pipefail
      BASE="${1:-http://localhost:4173}"
      fail=0
      check() {
        local path="$1"; shift
        local headers; headers=$(curl -sI "${BASE}${path}")
        for h in "$@"; do
          if ! grep -iq "^${h}" <<< "$headers"; then
            echo "MISSING: ${path} → ${h}" >&2
            fail=1
          else
            echo "OK:      ${path} → ${h}"
          fi
        done
      }
      check "/" \
        "cross-origin-opener-policy: same-origin" \
        "cross-origin-embedder-policy: require-corp" \
        "content-security-policy:" \
        "permissions-policy:" \
        "referrer-policy:"
      check "/models/hand_landmarker.task" "content-type:" "cross-origin-opener-policy:"
      check "/wasm/vision_wasm_internal.wasm" "content-type: application/wasm"
      exit $fail
  - NAMING: kebab-case .sh, executable bit set (`chmod +x`)
  - GOTCHA: `curl -sI` is idempotent and does not follow redirects; the preview server emits final-URL headers on index
  - VALIDATE: `bash scripts/check-headers.sh http://localhost:4173` exits 0 while preview is running

Task 2: RUN L1 — Syntax & Style
  - COMMAND: pnpm lint && pnpm typecheck
  - CAPTURE: exit code, stdout tail, wall-clock duration → report
  - GOTCHA: `pnpm lint` aliases `pnpm biome check .` per package.json
  - ON FAIL: backport the lint fix to the originating file; DO NOT fix in place under reports/

Task 3: RUN L2 — Unit Tests
  - COMMAND: pnpm vitest run
  - CAPTURE: test count, failed count, duration
  - EXPECTED: union of tests from 1.1-1.6 — at minimum App.test.tsx, useCamera.test.ts, ErrorStates.test.tsx, handLandmarker.test.ts, renderLoop.test.ts, Stage.test.tsx (+ any colocated helpers)
  - GOTCHA: vitest runs in jsdom; canvas/WebGL paths are mocked via vitest-canvas-mock

Task 4: RUN L3 — Production Build
  - COMMAND: pnpm build
  - CAPTURE: exit code, final size of dist/ via `du -sh dist/`, manual chunk breakdown from build log
  - EXPECTED: MediaPipe chunk ≈ 110 KB gz, ogl chunk ≈ 25 KB gz, tweakpane chunk ≈ 20 KB gz (magnitude — not asserted exactly)
  - GOTCHA: Build runs `tsc -b && vite build`; if tsc fails here but L1 passed, it is a project-references issue — check tsconfig.app.json vs tsconfig.node.json

Task 5: START pnpm preview (background)
  - COMMAND: (cd hand-tracker && nohup pnpm preview > /tmp/preview.log 2>&1 &)
            PREVIEW_PID=$!
  - WAIT:   until curl -s http://localhost:4173/ > /dev/null; do sleep 0.5; done  (max 10 s)
  - GOTCHA: the preview server binds :4173 per vite.config.ts; if :4173 is in use (dev server still running), the regression fails FAST. Kill any existing dev server first.

Task 6: RUN header script
  - COMMAND: bash scripts/check-headers.sh http://localhost:4173
  - CAPTURE: full stdout → report, exit code
  - ON FAIL: the drift is between vite.config.ts and vercel.json; fix both files in the originating task (Task 1.1 if it's the scaffold set).

Task 7: RUN L4 — Phase 1 E2E Suite
  - COMMAND: pnpm test:setup && pnpm test:e2e --grep "Task 1\\."
  - CAPTURE: which specs ran, pass count, fail count, duration, any skipped
  - EXPECTED: 6/6 passing (smoke, usecamera, errorstates, handlandmarker, renderloop, stage); zero skipped
  - GOTCHA: playwright.config.ts's webServer will ALSO try to run `pnpm build && pnpm preview` — since preview is already up on :4173, Playwright detects it and reuses; if it instead errors "port in use", set `reuseExistingServer: true` in webServer (already set per Task 1.1 config)

Task 8: RUN Playwright MCP manual walkthrough
  - SEQUENCE (MCP tools):
      1. mcp__playwright__browser_navigate  url=http://localhost:4173/
      2. mcp__playwright__browser_snapshot  (capture initial PROMPT card + camera-state=PROMPT)
      3. mcp__playwright__browser_console_messages  → expect zero errors so far
      4. Grant camera permission:
         mcp__playwright__browser_run_code  code="await page.context().grantPermissions(['camera'])"
         (or the MCP equivalent; alternative is `browser_handle_dialog` with accept)
      5. Click Retry on PrePromptCard (if present):
         mcp__playwright__browser_click  role=button name=/retry|allow|continue/i
      6. Wait for GRANTED:
         mcp__playwright__browser_wait_for  text="GRANTED"  (or via evaluate on data-testid="camera-state")
      7. Wait 3 s for MediaPipe warmup (use mcp__playwright__browser_wait_for time option)
      8. Probe dev hook:
         mcp__playwright__browser_evaluate  function="() => ({ fps: window.__handTracker?.getFPS?.(), lm: window.__handTracker?.getLandmarkCount?.(), coi: crossOriginIsolated })"
         → expect { fps > 0, lm >= 0, coi === true }
      9. Capture screenshot:
         mcp__playwright__browser_take_screenshot  filename=.claude/orchestration-hand-tracker-fx/reports/phase-1-regression-granted.png  fullPage=true
     10. Dump console + unhandled rejections:
         mcp__playwright__browser_console_messages
         mcp__playwright__browser_evaluate  function="() => window.__unhandled ?? []"
         → expect both arrays (errors only + unhandled) to be empty
     11. Stop preview:
         kill $PREVIEW_PID
  - CAPTURE: paste the JSON return of step 8 + step 10 into the regression report
  - GOTCHA: MCP's grantPermissions varies by wrapper — if unavailable, run with `--use-fake-ui-for-media-stream` by restarting the browser through MCP with launch options; document the workaround in the report

Task 9: RUN console + unhandled-rejection 10-second capture
  - RATIONALE: separate from Task 8's point-in-time snapshot; lets the app run for 10 s with no user interaction and asserts the console stays clean
  - METHOD (inline Playwright script is acceptable if MCP capture is noisy):
      // tests/e2e/phase-1-regression.spec.ts (optional; can live in this task's branch only)
      import { test, expect } from '@playwright/test';
      test.describe('Task 1.R: regression soak', () => {
        test('10s post-GRANTED: no errors, no unhandled', async ({ page }) => {
          const errors: string[] = [];
          const unhandled: string[] = [];
          page.on('pageerror', (e) => errors.push(e.message));
          page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
          await page.addInitScript(() => {
            (window as unknown as { __unh: string[] }).__unh = [];
            window.addEventListener('unhandledrejection', (e) => {
              (window as unknown as { __unh: string[] }).__unh.push(String(e.reason));
            });
          });
          await page.goto('/');
          await page.context().grantPermissions(['camera'], { origin: 'http://localhost:4173' });
          await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 15_000 });
          await page.waitForTimeout(10_000);
          const pageUnhandled = await page.evaluate(() => (window as unknown as { __unh: string[] }).__unh);
          unhandled.push(...pageUnhandled);
          expect(errors, `console errors: ${errors.join('\n')}`).toEqual([]);
          expect(unhandled, `unhandled rejections: ${unhandled.join('\n')}`).toEqual([]);
        });
      });
  - NAMING: describe `Task 1.R: regression soak`
  - GOTCHA: this spec is ONLY committed on the regression branch and is not part of the Phase 1 union; it runs via `pnpm test:e2e --grep "Task 1.R:"`
  - VALIDATE: pnpm test:e2e --grep "Task 1.R:" exits 0

Task 10: WRITE .claude/orchestration-hand-tracker-fx/reports/phase-1-regression.md
  - STRUCTURE (markdown):
      # Phase 1 Regression Report
      **Run date**: <ISO>
      **Branch**: task/1-R-phase-1-regression
      **Commit**: <git rev-parse HEAD>

      ## Validation matrix
      | Level | Command | Exit | Duration | Notes |
      |---|---|---|---|---|
      | L1 | pnpm lint && pnpm typecheck | ... | ... | ... |
      | L2 | pnpm vitest run | ... | ... | <N> tests |
      | L3 | pnpm build | ... | ... | dist=<size> |
      | Headers | scripts/check-headers.sh | ... | ... | all 5 present |
      | L4 | pnpm test:e2e --grep "Task 1\\." | ... | ... | 6/6 pass |
      | L4 soak | pnpm test:e2e --grep "Task 1.R:" | ... | ... | 10s clean |

      ## curl -sI header dump
      ```
      <paste from scripts/check-headers.sh verbose run>
      ```

      ## MCP walkthrough
      - step 2 snapshot: <aria-ish tree>
      - step 8 return: { fps: ..., lm: ..., coi: true }
      - step 10 console errors: []
      - step 10 unhandled rejections: []
      - screenshot: ![granted](./phase-1-regression-granted.png)

      ## Backported fixes
      - <bullet per fix, cite originating task file + commit hash>
      - (empty bullet if zero)

      ## Exit criteria for Phase 2
      - [x] All boxes in § Success Criteria above ticked
      - [x] Report + screenshot committed
      - Proceed → Phase 2 Task 2.1
  - NAMING: phase-1-regression.md lowercase, .md extension
  - GOTCHA: do not inline the full screenshot bytes; commit the .png alongside and reference relatively
  - VALIDATE: markdown renders in VS Code preview; `git ls-files` shows both files added

Task 11: COMMIT
  - BRANCH: task/1-R-phase-1-regression (already checked out per task convention)
  - MESSAGE: "Task 1.R: Phase 1 regression — L1-L4 green, MCP walkthrough clean"
  - TRAILER: Co-Authored-By: Claude <noreply@anthropic.com>
  - FILES: scripts/check-headers.sh (if new), .claude/orchestration-hand-tracker-fx/reports/phase-1-regression.md, .claude/orchestration-hand-tracker-fx/reports/phase-1-regression-granted.png, tests/e2e/phase-1-regression.spec.ts (if Task 9 spec committed), + any backported fix files
  - GOTCHA: the granted.png is binary; git lfs is NOT configured — keep it under 1 MB (a screenshot at 1920×1080 PNG should compress below this)
```

### Integration Points

```yaml
CONSUMED_BY:
  - Phase 2 Ralph loop: reads reports/phase-1-regression.md as the green-baseline proof before Task 2.1 begins
  - Phase 5 Task 5.5 (Vercel deploy): reuses scripts/check-headers.sh against the live preview URL
  - PROGRESS.md (if present): updated to mark Phase 1 complete when this task emits COMPLETE

EXPORTS:
  - scripts/check-headers.sh — reusable for every later phase regression + the Vercel deploy task
  - reports/phase-1-regression.md — the phase-closure artifact; pattern for 2.R / 3.R / 4.R / 5.R
```

---

## Validation Loop

### Level 1 — Syntax and Style

```bash
pnpm lint
pnpm typecheck
```

Expected: both exit 0 with zero Biome errors and zero tsc errors. This is the *cumulative* state of Phase 1 — the regression does not allow "0 new errors" — it requires ZERO errors.

### Level 2 — Unit Tests

```bash
pnpm vitest run
```

Expected: every test added by 1.1-1.6 passes. Count must match the sum declared by each task file's success criteria. No `.skip`, no `.only`.

### Level 3 — Integration (production build + preview + header script)

```bash
pnpm build
pnpm preview &
PREVIEW_PID=$!
until curl -s http://localhost:4173/ > /dev/null; do sleep 0.5; done
bash scripts/check-headers.sh http://localhost:4173
kill $PREVIEW_PID
```

Expected: `pnpm build` exits 0, preview binds :4173, header script exits 0, preview is cleanly killed.

### Level 4 — E2E (Phase 1 union + 10-second soak + MCP walkthrough)

```bash
# 4a — full Phase 1 union
pnpm test:setup
pnpm test:e2e --grep "Task 1\\."

# 4b — regression soak spec (this task)
pnpm test:e2e --grep "Task 1.R:"

# 4c — MCP walkthrough (manual, documented in the report)
# Use the Playwright MCP tool calls from Implementation Task 8
```

Expected: 4a passes 6/6. 4b passes 1/1. 4c produces the screenshot + the `{ fps>0, lm>=0, coi:true }` probe with zero console errors / unhandled rejections.

---

## Final Validation Checklist

### Technical

- [ ] L1: `pnpm lint && pnpm typecheck` exits 0
- [ ] L2: `pnpm vitest run` exits 0 with the expected test count
- [ ] L3: `pnpm build` exits 0; `pnpm preview` serves :4173; `scripts/check-headers.sh` exits 0
- [ ] L4a: `pnpm test:e2e --grep "Task 1\\."` passes 6/6
- [ ] L4b: `pnpm test:e2e --grep "Task 1.R:"` passes 1/1
- [ ] L4c: MCP walkthrough produces the screenshot + the probe return + empty error arrays
- [ ] `curl -sI http://localhost:4173/` shows COOP `same-origin`, COEP `require-corp`, CSP present, Permissions-Policy present, Referrer-Policy present

### Feature

- [ ] `reports/phase-1-regression.md` committed with the full validation matrix filled in
- [ ] `reports/phase-1-regression-granted.png` committed, under 1 MB, shows the mirrored stacked canvases
- [ ] `scripts/check-headers.sh` (if new) is executable and parameterized on a BASE argument
- [ ] Zero `pageerror` events and zero unhandled promise rejections during the 10-second capture
- [ ] `window.crossOriginIsolated === true` on the preview URL (runtime assertion, not just headers)
- [ ] Any backported fixes are listed in the report with originating task + commit hash

### Code Quality

- [ ] No new runtime `src/` code added in this task (regression is orchestration-only unless a fix was required)
- [ ] `tests/e2e/phase-1-regression.spec.ts` (if committed) uses `test.describe('Task 1.R: regression soak', ...)` exactly
- [ ] No `any` types in the soak spec — narrow via `as unknown as { __unh: string[] }` or a typed initScript helper
- [ ] `scripts/check-headers.sh` has `set -euo pipefail` and a non-zero exit on any missing header
- [ ] Report markdown uses relative path for the screenshot (`./phase-1-regression-granted.png`)

---

## Anti-Patterns

- Do not fix a regression bug inside a 1.R-only file. Every fix MUST land in the originating task's files (e.g., `src/camera/useCamera.ts` for a Task 1.2 bug) and be listed under "Backported Fixes" in the report.
- Do not run the regression against `pnpm dev`. D42 mandates `pnpm build && pnpm preview` — the preview server is the pre-deploy gate.
- Do not use `--grep "Task 1"` (no dot). That regex over-matches Phase 10+ if it ever exists. The correct shell invocation is `--grep "Task 1\\."`.
- Do not skip Task 9 (the 10-second soak). A green smoke test at t=0 is not proof that the render loop is stable; the soak catches memory leaks, rVFC stalls, and late-arriving console errors.
- Do not rely on `page.on('console')` alone for unhandled rejections — they are a `window`-level event that Playwright does not surface automatically. Use `addInitScript` + `window.addEventListener('unhandledrejection', ...)`.
- Do not commit the screenshot via `git lfs` — no LFS is configured. Keep the PNG under 1 MB by screenshotting at the viewport size (not fullPage at retina DPR for this archival shot).
- Do not delete `reports/phase-1-regression.md` when Phase 2 starts — it is the permanent proof of the green baseline; future agents `git log`-trace back to it if Phase 2 starts regressing.
- Do not fix a header drift only in `vite.config.ts` — `vercel.json` must be updated in the SAME commit so Phase 5 does not re-introduce the drift.
- Do not assume the dev hooks are present in a vanilla `pnpm build`. Use `pnpm build --mode test` (the variant the Playwright webServer uses) for the MCP walkthrough so `window.__handTracker` is defined.

---

## No Prior Knowledge Test

- [x] Tasks 1.1-1.6 are complete (their acceptance criteria ticked in their own files)
- [x] `package.json` has `check`, `build`, `preview`, `test:setup`, `test:e2e`, `lint`, `typecheck` scripts (verified in repo)
- [x] `playwright.config.ts` webServer points at `:4173` with `reuseExistingServer: true`
- [x] `.claude/orchestration-hand-tracker-fx/reports/` directory exists
- [x] D-numbers D21, D23, D27, D31, D32, D41, D42, D45 all exist in DISCOVERY.md
- [x] Every URL is public and stable
- [x] Implementation Tasks are dependency-ordered: header script → L1 → L2 → L3 → preview → headers → L4 → MCP → soak → report → commit
- [x] Validation commands have no placeholders (every `<N>` in the report template is filled in by the agent, not left as a literal)
- [x] Task is self-contained — no Phase 2 code required, no external services
- [x] The fix-backport rule is explicit (both in Anti-Patterns and Known Gotchas)

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
.claude/skills/vite-vercel-coop-coep/SKILL.md
```
