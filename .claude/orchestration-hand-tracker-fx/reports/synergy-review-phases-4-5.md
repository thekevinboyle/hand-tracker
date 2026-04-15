# Synergy Review — Phases 4 & 5 (+ cross-graph coherence)

**Reviewer**: cross-task synergy audit
**Date**: 2026-04-14
**Scope**: Phases 4 (7 tasks) + 5 (6 tasks), cross-phase contracts with Phases 1–3, DISCOVERY.md §12, skill coverage, PRP format.
**Mode**: Advisory only. No task files modified.

---

## Executive Summary

The Phase 4/5 plan is **mostly coherent and executable**, but there are **three CRITICAL contract breaks** between phases that will manifest as test failures on first execution:

1. Task 4.5's `canvas.captureStream()` target canvas is architecturally wrong — it captures the top Canvas 2D overlay, which is transparent over the WebGL canvas and therefore omits the mosaic effect.
2. Task 5.4 asserts `data-testid="error-state-card-<STATE>"` selectors that Task 1.3 never adds (Task 1.3 uses `role="alert"` only).
3. Task 5.4's `Task 5.4: GRANTED` case asserts `data-testid="render-canvas"` which does not exist anywhere in Phase 1 (Phase 1.6 ships `webgl-canvas` + `overlay-canvas`).

Everything else is either HIGH/MEDIUM polish issues or small documentation drift. The plan is NOT ready to merge as-is; two hotfix tickets (one on Task 1.3, one on Task 4.5) should be opened before Ralph executes Phase 5.

---

## Section 1 — Phase 4 Internal Coherence

### 1.1 — ModulationRoute ↔ Preset ↔ CubicBezier ↔ Record

| Concept | Defined in | Consumed by | Status |
|---|---|---|---|
| `ModulationRoute` type | 4.1 (`src/engine/modulation.ts`) | 4.2 (panel UI), 4.3 (preset schema) | ✅ Coherent — 4.2 and 4.3 both import via `import type` |
| `bezierControlPoints?: [number,number,number,number]` | 4.1 | 4.2 CubicBezier blade (reads + writes) | ✅ Coherent — both files use the same 4-tuple shape |
| `DEFAULT_MODULATION_ROUTES` | 4.1 | 4.3 (seeds `DEFAULT_PRESET`) | ✅ Coherent — 4.3 uses `structuredClone(DEFAULT_MODULATION_ROUTES)` |
| Preset schema (D29) | 4.3 | 4.4 (cycler reads list), 4.R (regression) | ✅ Coherent — `version: 1` enforced in both |
| Record canvas source | 4.5 | Phase 1.6 / 3.1 | ❌ **CRITICAL contract break — see §1.3** |

### 1.2 — DEFAULT_PRESET ↔ DEFAULT_MODULATION_ROUTES cross-reference

✅ **PASS**. Task 4.3 line 244 states `DEFAULT_PRESET uses structuredClone of DEFAULT_PARAM_STATE and DEFAULT_MODULATION_ROUTES and a stable ISO timestamp`. Task 4.1 line 217 exports `DEFAULT_MODULATION_ROUTES`. The two deterministically compose.

**Minor note (LOW)**: 4.3's test #13 asserts `DEFAULT_PRESET has version:1 and effectId 'handTrackingMosaic'` but does NOT assert the two `modulationRoutes` ids (`default-x-tileSize`, `default-y-columnCount`). Recommend adding `expect(DEFAULT_PRESET.modulationRoutes.map(r => r.id)).toEqual(['default-x-tileSize','default-y-columnCount'])` to lock the cross-file contract.

### 1.3 — Reduced-motion single-point-of-integration

✅ **PASS**. Task 4.6 correctly puts the branch at the render-loop call site (`renderer.ts`) and keeps `applyModulation` pure:

```ts
const modulated = reducedMotion.getIsReduced()
  ? paramStore.snapshot
  : applyModulation(routes, sources, paramStore.snapshot)
```

Task 4.1's "Anti-Patterns" explicitly forbids a `paused` flag on the evaluator. Task 4.6's "Anti-Patterns" mirrors that. Contract is tight.

### Issues found in Phase 4 (internal)

**ISSUE 4.A — MEDIUM — "Where does 4.6 modify renderer.ts?"**
Task 4.6 modifies `src/engine/renderer.ts`. But Phase 3.1 also creates/owns `src/engine/renderer.ts`, and Phase 3.4 also edits it (effect render wire-up). Phase 4.6 inheriting it is fine in dependency order (4.6 comes after 3.R), but the task file never says "the render loop that calls `applyModulation` was introduced in Phase X." Adding a one-line forward reference — "The `applyModulation(...)` call landed in `renderer.ts` at Task X.Y" — would remove ambiguity.
**Fix**: Task 4.6 All Needed Context `files:` block → add `gotcha: The exact line this task modifies is the applyModulation call introduced by Task 3.4 (or earliest task that imports applyModulation).`

**ISSUE 4.B — LOW — Preset JSON field order not specified**
Task 4.3 line 78 says "Export produces downloadable .json with stable field order" but the blueprint never pins the order. If two independent agents produce different key orders, diffs in PRs become noisy.
**Fix**: Task 4.3 Data Models section → add an implementation note: `JSON.stringify produces keys in insertion order; construct the object with literal order version → name → effectId → params → modulationRoutes → createdAt before serialization.`

---

## Section 2 — Phase 5 Internal Coherence

### 2.1 — Service worker (5.1) vs `vite-vercel-coop-coep` skill on CORP/COEP

✅ **PASS**. Task 5.1 uses `public/sw.js` at root scope with pass-through for cross-origin and non-GET requests. The SW responses inherit COOP/COEP from Vercel's catch-all header rule (verified by 5.1 line 94–97). The skill's working example is cited verbatim; CACHE_NAME is overridden to the spec-correct `hand-tracker-fx-models-v1`.

**Caveat (LOW)**: Task 5.1 line 62 has an awkward trailing sentence ("we just never ship `sw.js` in dev…") that is actually incorrect — `public/sw.js` IS served in dev too (Vite publicDir pass-through). Only the `register()` call is gated. This is harmless because registration is the controlling gate, but the prose is confusing.
**Fix**: 5.1 paragraph starting at line 60 → simplify to: "Dev does not call `register()`. `public/sw.js` is still served statically by Vite, but with no active registration the browser ignores it."

### 2.2 — 5.2 human/agent split on deploy

✅ **PASS**. Task 5.2 is explicit about `HUMAN:` vs `AGENT:` steps. Every browser-flow auth (`gh auth login`, `vercel login`, `vercel link`, `vercel --prod`) is correctly gated. All header verification, curl, MCP navigation, and commit steps are AGENT.

### 2.3 — 5.3 CI config coverage for 5.4 E2E

✅ **PASS on ffmpeg + Playwright + model**. Task 5.3 `ci.yml` installs ffmpeg (line 268), runs `pnpm test:setup` (line 312) which generates the Y4M, and caches both Playwright browsers and MediaPipe assets.

**ISSUE 5.A — MEDIUM — 5.3 ci.yml does NOT install `chromium-no-camera` / `chromium-no-webgl` projects**
Task 5.4 requires two additional Playwright projects with different launch flags. Task 5.3's `pnpm test:e2e` step has no project filter — it runs every project by default, which IS desired. But 5.3's workflow file was written before 5.4 introduced the projects, so there is no verification that the launch flags (e.g., `--use-file-for-fake-video-capture=/tmp/does-not-exist.y4m`) resolve inside the Ubuntu runner. If the Y4M path or disable-webgl flag is invalid on the CI runner, 5.4 specs silently skip or hang.
**Fix**: 5.3 → add a validation step after `pnpm test:setup`: `pnpm exec playwright test --list --grep "Task 5.4:"` to verify all 8 describe blocks enumerate across the three projects.

**ISSUE 5.B — LOW — 5.3 runs FULL E2E on every PR, not just "Task" matched**
Line 315 runs `pnpm test:e2e` with no grep. On Phase 5, suite is ~40 specs; some need a live preview URL. The preview-URL specs will fail on PR CI where `PLAYWRIGHT_BASE_URL` is unset and localhost build is used. 5.3's wording says "Vercel preview triggers E2E job on `deployment_status: success`" — that's `e2e-preview.yml`. The PR `ci.yml` job should exclude deploy-only specs (5.2's header-verification, 5.5's live capture).
**Fix**: 5.3 ci.yml E2E step → add `run: pnpm test:e2e --grep-invert "live-only|visual-capture"` (and tag any live-only specs accordingly) OR split the spec directory structure.

### 2.4 — 5.4's 8 error states — forcing mechanism soundness

This is the riskiest section. Three issues:

**ISSUE 5.C — CRITICAL — Task 5.4 queries data-testid Task 1.3 never creates**
Task 5.4 lines 270–340 query `[data-testid="error-state-card-<STATE>"]` for every state. Task 1.3 `ErrorStates.tsx` (line 310) renders `<div className="card" role="alert" aria-live="polite" aria-labelledby="err-title">` — NO `data-testid`. Every 5.4 spec will FAIL on first run.

Additionally, 5.4 asserts `error-state-card-PROMPT` visible (line 270), but 1.3 `ErrorStates.tsx` explicitly returns `null` for `PROMPT` (line 307) — the `PrePromptCard` handles PROMPT with a different DOM shape. 5.4 also asserts `error-state-card-GRANTED` in the happy-path (line 271) — but 1.3 returns null for GRANTED. Neither card exists.

**Fix options** (pick one):
- **Option A (preferred)**: Hotfix Task 1.3 to add `data-testid={\`error-state-card-${state}\`}` to the ErrorStates card `<div>` and add `data-testid="error-state-card-PROMPT"` to the PrePromptCard. Update 5.4's GRANTED assertion to use `not.toBeVisible()` (which is already correct on line 280 via the prefix selector).
- **Option B**: Rewrite 5.4's selectors to use `role="alert"` + `getByText(copy.title)`. More brittle but avoids a Phase 1 patch.

Recommend Option A + a note in 5.4's "All Needed Context" listing the Task 1.3 hotfix prerequisite.

**ISSUE 5.D — HIGH — PROMPT forcing mechanism is double-booked**
Task 5.4 line 201 offers two options for PROMPT: "drop `--use-fake-ui-for-media-stream` via dedicated project OR `?forceState=PROMPT` URL param". It then says "pick one; document in-file". That's not a contract — that's kicking the can to the executing agent. For reproducibility the task should pin one mechanism.
**Fix**: 5.4 table row 1 → "PROMPT: use `?forceState=PROMPT` URL param (consistent with SYSTEM_DENIED / DEVICE_CONFLICT). The dropped-fake-UI-project alternative is out of scope."

**ISSUE 5.E — MEDIUM — `chromium-no-ui-fake` project mentioned but never defined**
Task 5.4 line 222 mentions `chromium-no-ui-fake` but the Integration Points block at line 350 only defines `chromium-no-camera` and `chromium-no-webgl`. Either define the third project or remove the reference.
**Fix**: delete `chromium-no-ui-fake` from 5.4 (PROMPT via URL param per 5.D).

**ISSUE 5.F — MEDIUM — SW unregistration pattern assumes SW controls model fetch on first load**
Task 5.4 MODEL_LOAD_FAIL (line 321–330) calls `context.route('**/models/hand_landmarker.task', r => r.abort())` AFTER `unregisterSW(page)`. That is correct sequencing. But 5.1's `skipWaiting()` + `clients.claim()` means the SW takes control on first navigation. If unregistration fires in `addInitScript` (which runs AFTER `navigator.serviceWorker` is defined but BEFORE the SW has claimed clients), there is a TOCTOU window where the SW MAY have already returned a cached model that was seeded by a prior E2E test in the same project.
**Fix**: 5.4 MODEL_LOAD_FAIL test → add `await context.clearCookies(); await page.evaluate(() => caches.delete('hand-tracker-fx-models-v1'))` as the first statement, BEFORE `unregisterSW`.

### 2.5 — 5.5 visual-fidelity gate criteria match PHASES.md

✅ **PASS**. PHASES.md Task 5.5 enumerates exactly 5 checklist items (grid non-uniformity, 5 dotted blobs, mosaic in hand region, chevrons at edges, dark theme). Task 5.5 lines 69–74 reproduce them verbatim.

**ISSUE 5.G — LOW — 5.5 Playwright MCP capture path is not deterministic**
Task 5.5 line 200 suggests `mcp__playwright__browser_take_screenshot({ filename: "reports/phase-5-visual-fidelity.png" })`. MCP default Chromium has no fake-webcam flag, so the capture will likely show the PROMPT card instead of the mosaic. The task offers a fallback (line 202: use a dedicated Playwright spec via `pnpm exec playwright test`) but never picks one. Like ISSUE 5.D, this kicks the can.
**Fix**: 5.5 → commit to the fallback (dedicated spec file `tests/e2e/visual-capture.spec.ts` grepped by `Task 5.5:`, invoked with `PLAYWRIGHT_BASE_URL`). The MCP path is fine for manual human re-verification but should not be the task's validating L4.

### 2.6 — 5.R final cut loose ends

✅ **PASS**. Task 5.R covers: archive state, CHANGELOG, README polish, tag, release. CHANGELOG lists all D-numbers and phases. README links the live demo and reference screenshot.

**ISSUE 5.H — LOW — 5.R has no regression E2E against the tagged commit**
Task 5.R L4 runs only `pnpm test:e2e --grep "Task 1.1:"` — the smoke test. If a late-landing Phase 5 merge regresses Task 4.5 (record) or 4.4 (cycler), 5.R will not catch it. CHANGELOG says "All 8 D23 states covered" but 5.R doesn't re-run 5.4's specs.
**Fix**: 5.R L4 → expand to `pnpm test:e2e --grep "Task 1\\.|Task 4\\.|Task 5\\."`.

---

## Section 3 — Cross-Phase Contracts (MOST IMPORTANT)

### 3.1 — Does 5.4's error-state forcing work given 1.2's state machine?

**Partially**. Task 1.2 introduces the `CameraState` enum and the 6-error mapper (line 150: "covers PROMPT, GRANTED, USER_DENIED, DEVICE_CONFLICT, NOT_FOUND, OverconstrainedError relaxed-retry"). But Task 1.2 NEVER adds a URL-param short-circuit (`?forceState=`). Task 5.4 line 213 says:

> "MODIFY src/camera/useCamera.ts (if not already): Honor `?forceState=<STATE>` URL param when (import.meta.env.DEV || MODE === 'test')"

The parenthetical "if not already" is false; it is never added in Phase 1. So 5.4 itself must add this — and it does. But the addition changes a Phase 1 file that should already be stable on `main` by Phase 5. Treating Phase-1 files as closed is a worthwhile discipline here.

**ISSUE 3.A — HIGH — `?forceState=` hook belongs in Phase 1.2 retroactively, not Phase 5.4**
`?forceState=` is a test-surface concern, not an error-states concern; it unblocks every phase's E2E that wants to land on a specific state card. If it lives in 5.4, Phase 2 / 3 / 4 E2Es cannot use it (wrong dependency direction).
**Fix**: Add a micro-task (call it 1.2.1 or fold into 1.R backlog) that introduces `?forceState=` honoring. Then 5.4 references it as pre-existing.

### 3.2 — Does 5.1's service worker break 1.4's MediaPipe model path?

✅ **PASS**. 1.4 uses `modelAssetPath: '/models/hand_landmarker.task'` and `FilesetResolver.forVisionTasks('/wasm')`. 5.1's SW caches both prefixes cache-first, which is exactly what D33 mandates. Same-origin model requests pass through the SW transparently on first fetch; subsequent loads hit the cache.

The only edge is ISSUE 5.F (SW shadowing the forced MODEL_LOAD_FAIL test).

### 3.3 — Does 4.5's `canvas.captureStream()` work with 1.6's `preserveDrawingBuffer: true` + 3.1's renderer config?

❌ **CRITICAL BREAK**. This is the biggest issue in the plan.

Task 4.5 line 13: "captures the composited top canvas at 30fps via `canvas.captureStream(30)` → MediaRecorder".
Task 4.5 line 88: "The top canvas (Canvas 2D) is the one that carries grid + blobs + labels on top of the WebGL layer — capturing the WebGL canvas alone would miss the overlay".

But `canvas.captureStream()` only captures the pixel buffer of the canvas it is called on. There is no DOM-level compositing-to-MediaStream mechanism. Task 1.6 stacks two canvases with `position: absolute` (WebGL bottom, 2D top). The 2D canvas's pixel buffer is transparent where grid/blobs/labels are NOT drawn — the WebGL layer beneath is only visible to the human eye via DOM compositing, not to `captureStream`.

Consequence: 4.5's recording will contain ONLY grid lines, dotted blobs, and labels on a transparent (or black, depending on 2D canvas `globalCompositeOperation`) background. The mosaic effect — the entire raison d'être of the app — will be absent from recordings.

`preserveDrawingBuffer: true` on the WebGL canvas (1.6/3.1) is correct FOR capturing the WebGL canvas itself. But 4.5 doesn't capture the WebGL canvas. The research doc (`research/webcam-performance.md` line 613) even warns: "the recording canvas must apply `ctx.scale(-1,1)` explicitly since CSS transforms do not affect `canvas.captureStream()` output" — confirming that the Canvas 2D is the assumed source, which means the WebGL layer never makes it into the recording.

Additionally, the mirror mode (D10) is CSS-only. Recording from either canvas produces unmirrored pixels; the downloaded .webm will appear "flipped" relative to what the user sees on screen.

**Fix (required before Phase 4 ships)**:

Pick one of three architectures:

- **Option A — WebGL is the composited canvas**: Draw grid/blobs/labels into the WebGL layer via a second pass (texture + shader, or glDrawElements for lines). Capture the WebGL canvas. Keep `preserveDrawingBuffer: true`. Apply `gl.uniform2f(uMirror, -1.0, 1.0)` when `params.input.mirror === true`.
- **Option B — Offscreen compositor canvas**: Add a third `<canvas>` that is never displayed. Each frame, after WebGL + 2D draw, call `compositor.drawImage(webglCanvas, 0, 0); compositor.drawImage(overlayCanvas, 0, 0);` + apply mirror transform. Call `captureStream` on the compositor.
- **Option C — 2D draws WebGL as a background layer**: Each frame, call `overlay2dCtx.drawImage(webglCanvas, 0, 0)` BEFORE drawing grid/blobs/labels. Keep `preserveDrawingBuffer: true`. Capture the 2D canvas. Mirror via `ctx.save(); ctx.scale(-1,1); ctx.translate(-w,0); …; ctx.restore()`.

Option C is the smallest delta from the current plan (modify the 2D draw order; no new canvas). Recommend C.

**Fix** (in Task 4.5 and Task 3.4):
- Task 3.4 or 1.6 → "The 2D overlay's per-frame draw begins with `ctx.drawImage(webglCanvasRef.current, 0, 0)` so the overlay canvas carries the full composited image. Mirror transform applies to this draw if `params.input.mirror`."
- Task 4.5 All Needed Context → add explicit note: "The 2D overlay canvas IS the composited surface after Task 3.4's drawImage step. captureStream on the 2D canvas captures WebGL+overlay."
- Task 4.5 Acceptance Criteria → add: "Downloaded .webm plays back WITH the mosaic visible" (currently says "plays back the full effect" but doesn't nail the compositing).

### 3.4 — Are Playwright E2E describe-block names unique across all 32 `Task N.M:` grep strings?

Grep'd across all task files for describe patterns. Each task describes with its unique `Task N.M:` prefix. No collisions detected among 1.1, 1.2, …, 4.4, 4.5, 4.R, 5.1, 5.4, 5.R. Tasks without L4 (4.1, 4.2, 4.3, 4.6, 5.2, 5.5) explicitly mark L4 as N/A.

✅ **PASS**. The convention is respected.

One gotcha: Task 5.4 uses 8 describe blocks all prefixed `Task 5.4:`. This is correct and the `--grep "Task 5.4:"` matches all of them. But a stray typo in any one (e.g., `Task 5.4 :` with a space before the colon) would silently exclude it. Recommend a unit-test or lint rule: grep for `describe.*Task \d+\.\d+[A-Z]?:` in `tests/e2e/*.spec.ts` and assert 32 matches.

### 3.5 — `data-testid` consistency across phases

Inventory of test IDs introduced / referenced:

| data-testid | Introduced in | Referenced in | Status |
|---|---|---|---|
| `camera-state` | 1.2 | 1.3, 1.6, 5.4 | ✅ Consistent |
| `stage` | 1.6 | — | Orphan (ok — internal to 1.6) |
| `stage-video` | 1.6 | — | Orphan (ok) |
| `webgl-canvas` | 1.6 | 1.6 tests | ✅ Consistent |
| `overlay-canvas` | 1.6 | 1.6 tests | ✅ Consistent |
| `render-canvas` | **never defined** | 5.4, 2.R, research | ❌ **CRITICAL — see §3.E** |
| `landmark-blob` | 2.4 | 2.R, 3.R, 5.5 | ✅ Consistent |
| `landmark-label` | never defined | 3.R only | ⚠ Orphan reference — LOW |
| `stage-ready` | never defined | 3.R only | ⚠ Orphan reference — LOW |
| `error-state-card-<STATE>` | **never defined** | 5.4 | ❌ **CRITICAL — see §5.C** |
| `error-card` (generic) | never defined | reviewer prompt | n/a |

**ISSUE 3.B — CRITICAL — `render-canvas` referenced but not defined**
Task 5.4 line 278 (`await expect(page.locator('[data-testid="render-canvas"]')).toBeVisible`) and Task 2.R line 446 both query `render-canvas`. Phase 1.6 ships `webgl-canvas` + `overlay-canvas`, not `render-canvas`. Research file (`research/playwright-e2e-impl.md` line 502) describes `render-canvas` as "The WebGL or top Canvas 2D element". It appears to be an intended alias that was never implemented.

**Fix**: either
- Add `data-testid="render-canvas"` to the `<div className="stage">` wrapper in Task 1.6 (it wraps both canvases). Update 1.6 acceptance criteria. Or
- Replace all `render-canvas` selectors with `overlay-canvas` or `stage` (1.6 already has the wrapper's test-id).

Recommend adding `render-canvas` on the stage wrapper (minimal change; backward-compatible alias).

**ISSUE 3.C — LOW — `landmark-label` and `stage-ready` referenced only in 3.R**
Phase 2.4 says `data-testid="landmark-blob"` (line 318) but makes no mention of a `landmark-label`. Task 3.R line 562 lists `landmark-label` in its acceptance list. Either add it in Task 2.4 (label `<text>` or sibling div) or drop from 3.R.

---

## Section 4 — DISCOVERY.md §12 Alignment (explicit non-goals)

Cross-checked every Phase 4/5 task against DISCOVERY.md §12:

| Non-goal | Any task implement? |
|---|---|
| Mobile layout / responsive | No |
| Light theme | No |
| Audio | No |
| >1 hand | No |
| Face detection | No |
| 3D / three.js | No |
| Pre-recorded video/image input | No |
| Cloud processing | No |
| Auth / accounts | No |
| Analytics / telemetry | No |
| Privacy badge / pause / mobile-only notice | No |
| PWA beyond model/wasm caching | 5.1 is within scope (model+wasm only). ✅ |
| MIDI / keyboard params | Task 4.4's ArrowLeft/Right cycle presets only — NOT params. 4.4 explicitly forbids per-param keyboard (line 60 "No MIDI program change mapping"). ✅ |
| FPS overlay UI | Dev-hook only via `window.__handTracker.getFPS()`. ✅ |

✅ **PASS**. No §12 violations.

---

## Section 5 — Skill Coverage

### Referenced skills — all exist

| Skill | Path verified | Referenced by |
|---|---|---|
| `hand-tracker-fx-architecture` | ✅ | All tasks |
| `prp-task-ralph-loop` | ✅ | All tasks |
| `mediapipe-hand-landmarker` | ✅ | 1.4, 1.5, 5.4 |
| `webcam-permissions-state-machine` | ✅ | 1.2, 1.3, 5.4 |
| `ogl-webgl-mosaic` | ✅ | 2.3, 2.4, 3.1–3.5, 5.5 |
| `tweakpane-params-presets` | ✅ | 4.1, 4.2, 4.3, 4.4, 4.6 |
| `vite-vercel-coop-coep` | ✅ | 1.1, 4.5, 5.1, 5.2, 5.3 |
| `playwright-e2e-webcam` | ✅ | 1.1–1.R, 3.R, 4.4, 4.5, 4.R, 5.3, 5.4, 5.5 |
| `vitest-unit-testing-patterns` | ✅ | all unit-test-owning tasks |

### Unreferenced / under-referenced skills — flagged for consideration

| Skill | Used by tasks (Phase 4–5) | Flag |
|---|---|---|
| `ogl-webgl-mosaic` | 5.5 only (in Phase 4–5). 4.5 SHOULD reference it given the captureStream compositing issue. | **MEDIUM** — add to 4.5 after fixing the captureStream architecture. |
| `mediapipe-hand-landmarker` | None in Phase 4. | **LOW** — 4.1 touches landmark types; could justify a skill read for `Landmark` + coordinate-space invariants. |

**ISSUE 5.I — MEDIUM — Task 4.5 needs `ogl-webgl-mosaic` skill added**
After the captureStream-architecture fix (§3.3), 4.5 must understand the compositing layer order. The ogl skill covers canvas composition and mirror semantics.
**Fix**: 4.5 "Skills to Read" → add `.claude/skills/ogl-webgl-mosaic/SKILL.md`.

---

## Section 6 — PRP Format Consistency

Audited every Phase 4 + 5 task file (13 files) for:

- [x] 4-level Validation Loop with runnable commands (not placeholders)
- [x] "No Prior Knowledge Test" section at end
- [x] "Skills to Read Before Starting" list

| Task | L1 | L2 | L3 | L4 | NPK | Skills | Notes |
|---|---|---|---|---|---|---|---|
| 4.1 | ✅ | ✅ | ✅ | ⚠ N/A noted | ✅ | ✅ | L4 correctly deferred to 4.R |
| 4.2 | ✅ | ✅ | ✅ | ⚠ N/A noted | ✅ | ✅ | |
| 4.3 | ✅ | ✅ | ✅ | ⚠ N/A noted | ✅ | ✅ | |
| 4.4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| 4.5 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Add `ogl-webgl-mosaic` per 5.I |
| 4.6 | ✅ | ✅ | ✅ | ⚠ N/A noted | ✅ | ✅ | |
| 4.R | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| 5.1 | ✅ | ⚠ no-ops | ✅ | ✅ | ✅ | ✅ | L2 explicitly notes no units — OK |
| 5.2 | ⚠ safety-net | ⚠ safety-net | ✅ | ✅ | ✅ | ✅ | Acceptable — deploy task |
| 5.3 | ✅ | ✅ | ✅ | ✅ (gh watch) | ✅ | ✅ | |
| 5.4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| 5.5 | ⚠ safety-net | ⚠ safety-net | ✅ | ✅ (optional) | ✅ | ✅ | L4 should be required (see 5.G) |
| 5.R | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | L4 scope should expand (5.H) |

**ISSUE 6.A — LOW — 5.5 L4 is marked "optional"**
Task 5.5 line 298 says `(optional, if a visual-capture spec was added)`. Every other task's L4 is required when specs exist. 5.5 benefits from a forced spec.
**Fix** (also in 5.G): commit to a dedicated `tests/e2e/visual-capture.spec.ts` and promote L4 to required.

✅ **Overall format compliance: PASS**. No placeholders, no missing sections.

---

## Summary Table — Issues by Severity

| Severity | Count | IDs |
|---|---|---|
| CRITICAL | 3 | 5.C (error-state-card testids missing), 3.B (render-canvas testid missing), 3.3 (captureStream architectural wrong canvas) |
| HIGH | 2 | 5.D (PROMPT forcing not pinned), 3.A (?forceState= misplaced in 5.4) |
| MEDIUM | 6 | 4.A, 5.A, 5.E, 5.F, 5.I, 6.A |
| LOW | 6 | 4.B, 5.B, 5.G, 5.H, 3.C, prose in 5.1 |
| **Total** | **17** | |

---

## Top-5 Most Impactful Fixes (priority order)

1. **Fix 4.5 captureStream compositing (§3.3)** — CRITICAL. The single biggest functional bug in the plan. Without this, recordings have no mosaic. Recommend Option C: overlay canvas draws WebGL via `drawImage()` before its own grid/blobs/labels. Update Task 3.4 + 4.5 with explicit compositing order and acceptance criterion "downloaded .webm contains the mosaic effect, not just overlay".

2. **Hotfix Task 1.3 to add `data-testid="error-state-card-<STATE>"` (§5.C)** — CRITICAL. Without this, every 5.4 spec fails on selector miss. Also add `data-testid="error-state-card-PROMPT"` to PrePromptCard (5.4 asserts it visible in the PROMPT case). Then 5.4's happy-path GRANTED check works via the prefix selector already on line 280.

3. **Add `data-testid="render-canvas"` to the `<Stage>` wrapper in Task 1.6 (§3.B)** — CRITICAL. Unblocks 2.R + 5.4's GRANTED assertion.

4. **Move `?forceState=` URL-param support into Phase 1.2 (§3.A)** — HIGH. Phase-1 files should not be modified by Phase 5. Creating a backlog micro-task 1.2.1 (or retcon into 1.R) keeps the dependency graph clean and unblocks Phase 2–4 tests that could use the same hook.

5. **Pin single forcing mechanism for PROMPT + remove `chromium-no-ui-fake` (§5.D + 5.E)** — HIGH+MEDIUM. Eliminates the double-booked decision and a dangling project reference.

---

## Cross-Graph Final Assessment

**Is the plan internally consistent and executable end-to-end? NO (with two addressable hotfixes).**

**Rationale**:

The Phase 4/5 plan is well-structured, DISCOVERY-compliant, and observably more detailed than typical PRP task sets. Phase 4's internal coherence (modulation ↔ preset ↔ record ↔ reduced-motion) is airtight. Phase 5's workflow sequencing (SW → deploy → CI → E2E → visual gate → release) mirrors the PHASES.md dependency graph exactly.

However, three cross-phase contract breaks block execution as-is:

1. **Task 4.5's captureStream target canvas is architecturally mis-specified.** The top Canvas 2D is NOT a composited surface in the current Phase 1.6 / 3.1 architecture. Recordings will ship without the mosaic effect — the app's reason for existing. This is not a bug the Ralph loop self-heals; it is a design error embedded in the blueprint.

2. **Task 5.4's data-testid selectors reference DOM attributes Task 1.3 never adds.** Every one of the 8 error-state E2E specs fails on first run. Hotfixing 1.3 retroactively is straightforward but requires explicit acknowledgement in the PROGRESS log and a patch to the Phase 1.R regression.

3. **`data-testid="render-canvas"`** is referenced by 2.R and 5.4 but never defined anywhere. Adding it to 1.6's stage wrapper is a one-line change.

All three are surface-level fixes to clearly identified files. None require re-architecting the dependency graph. If the three hotfixes (one Phase 1.3 patch, one Phase 1.6 patch, one Phase 3.4/4.5 compositing redesign) are merged as prerequisites, the plan becomes executable end-to-end.

The remaining MEDIUM/LOW issues are polish: prose ambiguity in 5.1, unpinned forcing mechanism for PROMPT, under-scoped L4 in 5.5 and 5.R, missing cross-references on 4.6/4.3/4.5. They would not block execution but would cause Ralph-loop drift and noisy PRs.

**Recommendation**: Block the Phase 4→5 handoff on fixes 1–3. Address fixes 4–17 as a batched "Pre-Phase-5 cleanup" PR before running the Phase 5 Ralph.
