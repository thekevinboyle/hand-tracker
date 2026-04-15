# Synergy Review — MEDIUM/LOW Backlog

Source reports:
- `reports/synergy-review-phases-1-3.md`
- `reports/synergy-review-phases-4-5.md`

Status: these items are NOT applied in the first-pass CRITICAL+HIGH sweep. First-pass agents should surface and catch these at execution time. Each row is a candidate follow-up.

| # | Severity | Phase/Task | Problem | Proposed fix |
|---|----------|------------|---------|--------------|
| 1 | MEDIUM | Phase 1-3 #13 / Task 1.2 + 1.R | Task 1.2 describe is `Task 1.2: useCamera`; file named `tests/e2e/useCamera.spec.ts` but Task 1.R asserts `usecamera.spec.ts` lowercase | Pick a single casing convention and update Task 1.R's filename assertion |
| 2 | MEDIUM | Phase 1-3 #14 / Task 1.5 + 2.R | Task 1.5 uses `--mode test` via playwright webServer command; Task 2.R assumes a `VITE_DEV_HOOKS=1` env var gating the dev hook. Two independent mechanisms, whichever wins first breaks the other | Standardize on `import.meta.env.MODE === 'test'`; drop `VITE_DEV_HOOKS` from Task 2.R and devHooks.ts |
| 3 | MEDIUM | Phase 1-3 #16 / Task 2.3 vs 3.3/3.4 | Task 2.3 returns cumulative breakpoints length=count (no leading 0); Task 3.3 expects length=count+1 with leading 0. Task 3.4 currently prepends 0 at call site (FIX APPLIED in CRITICAL pass). Long-term: choose one shape at Task 2.3 to avoid call-site surgery | Change `generateColumnWidths` / `generateRowWidths` to emit `[0, x1, ..., 1]` (length = count+1) and drop the call-site prepend |
| 4 | MEDIUM | Phase 1-3 #17 / Task 2.3 vs 2.5 | `gridRenderer` consumes `target.width/height` in LOGICAL pixels (Stage applies DPR transform); Task 2.5's call passes `frameCtx.videoSize.w/h` (video pixel dims). Different coordinate spaces | Document the contract at Task 2.3 ("video space"), align Task 2.5 call site; also applies to `blobRenderer`'s `BlobRenderTarget` |
| 5 | MEDIUM | Phase 1-3 #18 / Task 2.5 | `create(gl)` clears WebGL canvas but never calls `gl.viewport(0, 0, drawingBufferWidth, drawingBufferHeight)` before clear — default 300×150 viewport until Phase 3 | Add a one-liner `gl.viewport(...)` in Task 2.5 render OR defer the WebGL clear to Phase 3 |
| 6 | MEDIUM | Phase 1-3 #19 / Task 1.R | `--grep "Task 1\\."` matches any describe starting `Task 1.` including hypothetical future 11.x | Non-blocking; optionally tighten to `^Task 1\\.[1-6R]` |
| 7 | MEDIUM | Phase 1-3 #20 / Task 2.4 vs 2.R / 3.R | Task 2.4 draws blobs to Canvas (no per-blob DOM), but 2.R/3.R assert `data-testid="landmark-label"` element existence | Drop the data-testid expectations from 2.R/3.R and add `__handTracker.getLastBlobLabels(): string[]` dev hook in Task 2.5 |
| 8 | MEDIUM | Phase 1-3 #22 / Task 1.6 + 2.R/3.R | `stage-ready` testid referenced but never created | Add `data-testid="stage-ready"` attribute to Stage root that flips once video srcObject attaches and `play()` resolves |
| 9 | MEDIUM | Phase 4-5 #4.A / Task 4.6 + 4.1 | Task 4.6 modifies `renderer.ts` but never says which task introduced the `applyModulation` call site | Add a one-line forward-reference in Task 4.6 All-Needed-Context: "The `applyModulation(...)` call landed in `renderer.ts` at Task X.Y" |
| 10 | MEDIUM | Phase 4-5 #5.A / Task 5.3 | `ci.yml` does not verify the new Playwright projects (`chromium-no-camera`, `chromium-no-webgl`) launch flags resolve on Ubuntu runner | Add `pnpm exec playwright test --list --grep "Task 5.4:"` validation step after `pnpm test:setup` |
| 11 | MEDIUM | Phase 4-5 #5.F / Task 5.4 MODEL_LOAD_FAIL | Service worker from 5.1 may serve a cached model before `unregisterSW` + `route.abort` take effect — TOCTOU | Pre-clear caches: `await context.clearCookies(); await page.evaluate(() => caches.delete('hand-tracker-fx-models-v1'))` BEFORE `unregisterSW` |
| 12 | MEDIUM | Phase 4-5 #5.I / Task 4.5 | Needs `ogl-webgl-mosaic` skill in "Skills to Read" (captureStream compositing understanding) | Add `.claude/skills/ogl-webgl-mosaic/SKILL.md` to Task 4.5 Skills list |
| 13 | MEDIUM | Phase 4-5 #6.A / Task 5.5 | L4 marked "optional, if a visual-capture spec was added" — kicks the can | Commit to `tests/e2e/visual-capture.spec.ts` and promote L4 to required |
| 14 | LOW | Phase 1-3 #21 / Task 1.6 | Stage.css mirror-transform target gotcha wording is verbose; could point to Task 2.4's counter-transform explanation | Non-blocking clarification |
| 15 | LOW | Phase 1-3 #23 / Task 1.3 + 1.4 | `data-testid="camera-state"` moves offscreen in Task 1.3; Task 1.4's E2E uses `toHaveText` which is safe on offscreen | Documentation only, no change needed |
| 16 | LOW | Phase 1-3 #24 / Task 1.1 | Task 1.1 CLAUDE.md references `START.md` which does not exist | Drop `START.md` row or replace with PHASES.md / PRD.md |
| 17 | LOW | Phase 1-3 #25 / Task 1.3 + 1.4 | `playwright-e2e-webcam` skill missing from 1.3 and 1.4's "Skills to Read" despite both shipping L4 specs | Add skill reference |
| 18 | LOW | Phase 1-3 #26 / Task 2.1 | Integration note claims Landmark matches `NormalizedLandmark` only structurally — same as #15 | Resolved by CRITICAL fix #1 (Landmark = NormalizedLandmark) |
| 19 | LOW | Phase 1-3 #28 / Task 2.3 | L4 uses `test.describe.skip` if dev hook missing; spec exits 0 with skipped test — looks green | Rewrite L4 as a true unit test of `gridRenderer` via `toDataURL` diff OR require dev hook to be present |
| 20 | LOW | Phase 1-3 #29 / Task 1.2 | `stream: MediaStream \| null` returned from a ref — won't trigger React re-renders | Document: consumers should key off `state`, not `stream` identity |
| 21 | LOW | Phase 1-3 #30 / Task 3.1 | `WebGLUnavailableError` throw path: who catches and transitions to NO_WEBGL is unspecified | Add paragraph in Task 3.1 OR `webcam-permissions-state-machine` skill documenting Stage.tsx's catch → `setWebGLError()` → NO_WEBGL transition |
| 22 | LOW | Phase 4-5 #4.B / Task 4.3 | Preset JSON field order not specified | Add note: construct preset object with literal order `version → name → effectId → params → modulationRoutes → createdAt` before `JSON.stringify` |
| 23 | LOW | Phase 4-5 #5.B / Task 5.3 | PR `ci.yml` runs full E2E including live-only specs that require preview URL | Add `--grep-invert "live-only\|visual-capture"` OR split spec dirs |
| 24 | LOW | Phase 4-5 #5.1 prose / Task 5.1 | Paragraph "we just never ship sw.js in dev…" is incorrect (public/sw.js IS served in dev; only `register()` is gated) | Rewrite: "Dev does not call `register()`. `public/sw.js` is still served statically by Vite, but with no active registration the browser ignores it." |
| 25 | LOW | Phase 4-5 #5.G / Task 5.5 | MCP screenshot capture will likely show PROMPT card, not mosaic — needs dedicated spec with fake-webcam launch | Commit to `tests/e2e/visual-capture.spec.ts` + `PLAYWRIGHT_BASE_URL` |
| 26 | LOW | Phase 4-5 #5.H / Task 5.R | L4 only runs Task 1.1 smoke; will miss Phase 4/5 regressions | Expand to `pnpm test:e2e --grep "Task 1\\.\|Task 4\\.\|Task 5\\."` |
| 27 | LOW | Phase 4-5 #3.C / Task 3.R | References `landmark-label` testid not produced by Task 2.4 | Either add to Task 2.4 or drop from 3.R — related to #7 above |
