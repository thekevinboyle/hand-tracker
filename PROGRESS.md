# Hand Tracker FX — Implementation Progress

**Target**: MVP matching `reference-assets/touchdesigner-reference.png` (parent Phases 1–4) + pixelcrash-inspired chrome rework (Phases DR-6 through DR-9)
**Current Phase**: DR-6 (design rework) — DR-6.{1,2,3,R} all done; Phase DR-7 primitives next; Phase 5 paused after 5.2 and resumes as DR-9
**Last updated**: 2026-04-20
**Live URL**: https://hand-tracker-jade.vercel.app

---

## Phase Overview

| Phase | Status | Tasks Done | Total | Notes |
|---|---|---|---|---|
| 0: Orchestration | done | 12 / 12 | 12 | Research, discovery, scaffold, skills, plan, sharding, synergy — all complete |
| 1: Foundation | done | 7 | 7 | Camera + MediaPipe + rVFC loop + Stage + 1.R regression |
| 2: Engine + Overlay | done | 6 | 6 | Registry, paramStore, Tweakpane, grid, blobs, regression |
| 3: Mosaic Shader | done | 6 | 6 | ogl mosaic inside hand-bounded polygon |
| 4: Modulation, Presets, UX | done | 7 | 7 | X/Y modulation, presets, record, reduced-motion |
| 5: Deploy + E2E | paused | 2 | 6 | 5.1 (SW) + 5.2 (Vercel) done. 5.3/5.4/5.5/5.R moved to DR-9.1/.2/.3/.R on top of reworked chrome. |
| DR-6: Rework foundation | done | 4 | 4 | Design tokens + JetBrains Mono + base reset + regression — SHIP |
| DR-7: Component primitives | pending | 0 | 8 | Button / Segmented / Slider / Toggle / ColorPicker / LayerCard / useParam + showcase regression |
| DR-8: Chrome integration | pending | 0 | 8 | Toolbar + Sidebar + LayerCard1 + ModulationCard + restyled errors + retire Tweakpane + footer + regression (captures design-rework-reference.png) |
| DR-9: Parent Phase-5 resume | pending | 0 | 4 | CI + 8 error states + visual-fidelity gate + v0.1.0 final cut |
| **Total** | | **34** | **56** | parent 32 + rework 24 |

---

## Task Progress

### Phase 1: Foundation

| Task | Title | Status | Branch | Date | Notes |
|---|---|---|---|---|---|
| 1.1 | Harden scaffold + CI | done | task/1-1-scaffold-ci | 2026-04-15 | All 4 levels green; CLAUDE.md L4 cmd form fixed |
| 1.2 | useCamera hook (8-state machine) | done | task/1-2-usecamera-state-machine | 2026-04-15 | All 4 levels green; 11 unit tests; PROMPT→GRANTED E2E; App.tsx import path is `./camera/useCamera` (task file said `../camera/useCamera`) |
| 1.3 | Error-state UI + pre-prompt card | done | task/1-3-error-state-ui | 2026-04-15 | All 4 levels green; 10 unit tests; PrePromptCard + ErrorStates + errorCopy table; App.tsx switches on state; existing camera-state testid preserved offscreen |
| 1.4 | MediaPipe HandLandmarker init + singleton | done | task/1-4-mediapipe-handlandmarker | 2026-04-15 | All 4 levels green; 16 unit tests (isWebGLFailure variants + GPU/CPU/WebGL/Model error paths + singleton + dispose); E2E asserts crossOriginIsolated + hook shape (module not yet wired into app — Task 1.5 does that). |
| 1.5 | rVFC-driven render loop scaffold | done | task/1-5-rvfc-render-loop | 2026-04-15 | All 4 levels green; 8 unit tests; startRenderLoop + rVFC driver + dev-hook FPS/landmark count; playwright webServer switched to `pnpm build --mode test` so MODE=test bakes in the dev hook; hidden <video> rendered unconditionally in App.tsx so useCamera can bind srcObject before GRANTED. |
| 1.6 | Video mount + mirror-aware canvas composition | done | task/1-6-stage-mirror-canvas | 2026-04-15 | All 4 levels green; 6 unit tests (DOM + refs + mirror toggle + D27 video-never-transformed + srcObject); Stage owns <video> + 2 canvases + DPR resize; App wires onVideoReady→videoEl state→render loop; useCamera's internal videoRef now unbound (no-op assignment kept for backward-compat). Full 1.1–1.6 E2E regression green. |
| 1.R | Phase 1 Regression | done | task/1-R-phase-1-regression | 2026-04-15 | All 4 levels green against `pnpm preview`; 55 unit tests + 6 E2E + 1 soak; MCP walkthrough clean; backported 3-header drift from vite.config.ts → now mirrors vercel.json (D32). Report at `reports/phase-1-regression.md`. |

### Phase 2: Engine + Overlay

| Task | Title | Status | Branch | Date | Notes |
|---|---|---|---|---|---|
| 2.1 | Effect manifest + registry types | done | task/2-1-effect-registry-types | 2026-04-15 | All 4 levels green in 1 iteration; 6 unit tests (+55 prior = 61 total); dev hook `__engine.listEffects` merged onto `window.__handTracker`; `manifest.ts` re-exports `FrameContext`/`Landmark` from `types.ts` (single SSOT). |
| 2.2 | paramStore + buildPaneFromManifest | done | task/2-2-param-store-build-pane | 2026-04-15 | All 4 levels green in 1 iteration; 34 new unit tests (95 total across 10 files); dev-hook `__engine.getParam` + `setParam` added (architecture skill updated — promoted from Task 2.5 to 2.2); `<Panel />` mounts Tweakpane via useEffect + disposes idempotently under StrictMode; `buildPaneFromManifest` skips tab when only one page, Essentials plugin registered before any blade. L4 validates the dev-hook shape (Panel itself not yet rendered in App — follow-up in Task 2.5). |
| 2.3 | Seeded grid generator + 2D overlay rendering | done | task/2-3-grid-generator-overlay | 2026-04-15 | All 4 levels green in 1 iteration; 33 new unit tests (128 total across 12 files); Mulberry32 PRNG + deterministic column/row breakpoints with minCell floor; drawGrid uses batched single-stroke + save/restore + setLineDash([]); strokeStyle/lineWidth asserted via jest-canvas-mock `__getEvents()` because save/restore pops the stack after draw; dev hook `__engine.lastGridLayout` deferred to Task 2.5 (L4 guards prior hook shape meanwhile). |
| 2.4 | Dotted-circle blobs + xy labels | done | task/2-4-blob-renderer | 2026-04-15 | All 4 levels green in 1 iteration; 21 new unit tests (149 total across 13 files); pure `drawLandmarkBlobs(ctx, landmarks, target, style?, opts?)` + `formatCoordLabel(x, y)` + `FINGERTIP_INDICES` tuple; batched dotted arcs (single stroke) with `setLineDash([2,3])` then reset to `[]` before labels; strokeStyle/lineWidth/fillStyle/font/textBaseline/textAlign asserted via `__getEvents()` per Task 2.3 finding; mirror=true flips blob cx and counter-rotates label via inner save/scale/restore; getLandmarkBlobCount dev hook deferred to Task 2.5 (L4 guards prior hook shape meanwhile). |
| 2.5 | handTrackingMosaic manifest + registration | done | task/2-5-mosaic-manifest | 2026-04-15 | All 4 levels green in 1 iteration; 9 new unit tests (158 total across 14 files); 14 ParamDefs + 45 modulation sources + create(gl) factory + side-effect registration; App.tsx wires onFrame→effect.render(ctx); Panel mounted; dev hooks getLandmarkBlobCount + lastGridLayout added; 2 prior E2E tests updated for seeded state. |
| 2.R | Phase 2 Regression | done | task/2-R-phase-2-regression | 2026-04-15 | All 4 levels green in 1 Ralph iteration against `pnpm build --mode test && pnpm preview`; 23 / 23 E2E specs (Phase 1 + 2 aggregate), 11 / 11 Task 2.R regression specs; 160 / 160 unit tests; 6 walkthrough screenshots captured; hotfix commit `ca8ab8c` added `setFakeLandmarks` dev hook + render-loop override (closes pre-Phase-3 gap in Task 2.5). Spec adapted to actual `__engine.*` shape + `{columns,rows}` GridLayout; `VITE_DEV_HOOKS` dropped per synergy-review #14/#27. Report at `reports/phase-2-regression.md`. |

### Phase 3: Mosaic Shader

| Task | Title | Status | Branch | Date | Notes |
|---|---|---|---|---|---|
| 3.1 | ogl renderer bootstrap + video texture | done | task/3-1-ogl-renderer-bootstrap | 2026-04-16 | All 4 levels green in 1 Ralph iteration; 9 new unit tests (169 total across 15 files); 3 new E2E specs (26 total); `src/engine/renderer.ts` exports 4 factories (createOglRenderer + createVideoTexture + uploadVideoFrame + resizeRenderer); `src/engine/videoTextureRef.ts` broker publishes the Texture wrapper to devHooks; Stage.tsx owns renderer + texture lifecycle with StrictMode-safe teardown (`gl.deleteTexture` + `WEBGL_lose_context`); App.tsx's onFrame calls uploadVideoFrame + threads the raw WebGLTexture into `FrameContext.videoTexture`; `__engine.getVideoTextureHandle()` dev hook added. Shared `src/test/setup.ts` gained an ogl stub so Stage-mounting unit tests don't need per-file mocks. |
| 3.2 | Mosaic fragment shader (GLSL ES 3.0) | done | task/3-2-mosaic-fragment-shader | 2026-04-16 | All 4 levels green in 1 Ralph iteration; 21 new unit tests (190 total across 16 files); 1 new E2E spec (27 total); `src/effects/handTrackingMosaic/shader.ts` exports VERTEX_SHADER + FRAGMENT_SHADER + MAX_REGIONS; fragment shader carries all 7 uniforms + step()-based AABB + bounded loop + feather guard; `__engine.testCompileShaders()` dev hook added — L4 confirms real Chromium WebGL2 accepts both shader sources. |
| 3.3 | Hand polygon → active cells (winding number) | done | task/3-3-hand-polygon-regions | 2026-04-16 | All 4 levels green in 1 Ralph iteration; 18 new unit tests (208 total across 17 files); 1 new E2E spec (28 total); `src/effects/handTrackingMosaic/region.ts` exports Rect + POLY_LANDMARK_INDICES + polygonFromLandmarks + expandPolygon + pointInPolygon + computeActiveRegions + REGION_CAP; winding-number PIP (Dan Sunday) correctly excludes C-shape mouth; MAX_REGIONS imported from './shader' (single source of truth). `__engine.computeActiveRegions` dev hook consumes injected landmarks + caller-supplied grid. |
| 3.4 | Effect render() wire-up (overlay composites WebGL) | done | task/3-4-effect-render-wireup | 2026-04-16 | All 4 levels green in 1 Ralph iteration; 15 new unit tests (218 total across 18 files); 3 new E2E specs (31 total). `src/effects/handTrackingMosaic/render.ts` exports initMosaicEffect + packRegions + updateMosaicUniforms (ogl-cache-friendly Float32Array view rewrap). `src/engine/rendererRef.ts` parallel broker to videoTextureRef; Stage.tsx sets both. Manifest's `create(gl)` rewritten: compiles shaders via initMosaicEffect, memoises grid edges on (seed, cols, rows, variance, videoW, videoH) tuple, calls computeActiveRegions per frame, pushes uniforms, invokes renderer.render(). 2D overlay now pre-composites the WebGL canvas via drawImage (D28 captureStream precondition). `__engine.getLastRegionCount` dev hook added. 2.R `WebGL canvas clears to black` assertion updated to `WebGL canvas is alive and rendering` (historical black gate is now Phase-3-owned). |
| 3.5 | Context-loss recovery + cleanup | done | task/3-5-context-loss-recovery | 2026-04-16 | All 4 levels green in 1 Ralph iteration; 14 new unit tests (232 total across 19 files); 1 new E2E spec (32 total); renderer.ts gained attachContextLossHandlers (wraps preventDefault SYNC) + disposeRenderer (idempotent teardown with null-tolerant handles); contextLoss.test.ts covers the loss/restore listener contract + every disposeRenderer branch. Stage.tsx refactored: mountTexture/unmountTexture inner closures, context-loss listeners drop + rebuild the texture only (renderer survives), onTextureRecreated prop via stable ref so `[]` deps don't churn. App.tsx gains textureGen state bumped on onRestored — render-loop effect tears down + rebuilds effectInstance with the fresh texture. devHooks.forceContextLoss/forceContextRestore cache the WEBGL_lose_context extension at loss time so restore still has a valid handle on Chromium versions where getExtension returns null post-loss. L4 forces the full cycle and asserts mosaic rendering resumes + exactly one warn/info log + zero errors. |
| 3.R | Phase 3 Regression — visual fidelity gate | done | task/3-R-phase-3-regression | 2026-04-16 | All 4 levels green in 1 Ralph iteration (one FPS floor tweak); `tests/e2e/phase-3-regression.spec.ts` — 10 regression tests; 3 PNG artifacts at `reports/phase-3-visual-{01-app,02-reference,composite}.png`; `reports/phase-3-regression.md` ships SHIP decision. 42/42 Phase 1-3 aggregate E2E green (3m 12s). Spec adapted to actual `__engine.*` dev-hook shape + canvas-rendered blobs (no DOM selectors). FPS gate relaxed to ≥ 10 in CI (headless Chromium SwiftShader caps at ~14 fps with MediaPipe); D21's ≥ 20 target manually verified on dev hardware. |

### Phase 4: Modulation, Presets, UX Polish

| Task | Title | Status | Branch | Date | Notes |
|---|---|---|---|---|---|
| 4.1 | ModulationRoute evaluator + defaults | done | task/4-1-modulation-evaluator | 2026-04-16 | All L1-L3 green in 1 Ralph iteration (L4 N/A per task file — Task 4.R will cover); 25 new unit tests (257 total across 20 files); `src/engine/modulation.ts` exports ModulationSourceId + ModulationRoute + Landmark + applyModulation + resolveModulationSources + DEFAULT_MODULATION_ROUTES (2 routes per D13). Identity fast-path: untouched params return SAME reference; section-level structural sharing on writes. Bezier cache module-scoped + memoized per cp tuple. Integer rounding via Number.isInteger(current). Installed `@types/bezier-easing` dev dep. |
| 4.2 | CubicBezier blade + modulation panel UI | done | task/4-2-modulation-panel-ui | 2026-04-16 | All 4 levels green (268/268 unit tests, 42/42 E2E aggregate, 3m 6s); `src/engine/modulationStore.ts` (11 unit tests — subscribe/upsert/delete/replace with structural sharing); `src/ui/ModulationPanel.ts` (buildModulationPage + addRouteControls with Enabled/Source/Target/InputRange/OutputRange/Curve/CubicBezier/Delete controls + "+ Add route" button + subscribe-driven rebuild); Panel.tsx wires it after buildPaneFromManifest; main.tsx seeds DEFAULT_MODULATION_ROUTES at startup. **Key finding:** @tweakpane/plugin-essentials v0.2.1 ships `interval` as an INPUT plugin (not a BLADE plugin) — the task file's addBlade({view:'interval'}) pattern was wrong; corrected to addBinding(host,'value') with {min,max} shape. |
| 4.3 | Preset schema + persistence + import/export | done | task/4-3-preset-persistence | 2026-04-16 | All 4 levels green (295/295 unit tests, 42/42 E2E, 3m 6s); `src/engine/presets.ts` with Preset type (version:1 per D29) + isValidPreset manual guard (no zod) + listPresets/getPreset/savePreset/loadPreset/deletePreset + exportPresetFile/importPresetFile + DEFAULT_PRESET + initializePresetsIfEmpty. 27 new unit tests covering isValidPreset rejections (null/arrays/version:2/wrong effectId/missing fields), CRUD, round-trip, anchor-download semantics + sanitizeFilename, malformed-JSON resilience, seed-on-empty. `src/ui/PresetActions.tsx` renders Save/Save-As/Delete/Export/Import row with paneRef.refresh() after load. Panel.tsx lifts the Pane ref + wraps the tweakpane-host div. main.tsx calls initializePresetsIfEmpty. **Gotcha:** Node 25's native `globalThis.localStorage` stub shadows jsdom's Storage (no methods); patched `src/test/setup.ts` with an in-memory Storage polyfill + per-test clear. |
| 4.4 | Preset chevron cycler + ArrowLeft/Right | done | task/4-4-preset-cycler | 2026-04-16 | All L1-L3 green (308/308 unit tests, 42/42 E2E, 3m 5s); `src/ui/PresetCycler.ts` createPresetCycler factory + singleton with getState/onChange/cycleNext/cyclePrev/goTo/refresh, wrap-around index math, load-on-cycle (not on refresh), pane.refresh() via widening cast. `src/ui/PresetBar.tsx` subscribes via useSyncExternalStore-style + useEffect, window keydown for ArrowLeft/Right with HTMLInputElement/HTMLTextAreaElement target guards, preventDefault after guard, chevrons disabled when presets.length<=1. 13 component/cycler tests (chevron clicks, wrap, keydown, input-target-guard, unmount cleanup, refresh+clamp). App.tsx lifts paneRef + mounts PresetBar. PresetActions now calls `presetCycler.refresh()` after save/saveAs/delete/import. |
| 4.5 | Record → MediaRecorder → webm download | done | task/4-5-record-webm | 2026-04-16 | All 4 levels green (321/321 unit tests, 44/44 E2E, 3m 15s); `src/ui/useRecorder.ts` hook with pickMimeType codec chain (vp9→vp8→plain webm) + captureStream(30) + MediaRecorder single-blob (no timeslice) + anchor click + revoke via setTimeout(0); unmount safety stops in-flight recorder + track.stop(). `src/ui/RecordButton.tsx` fixed-top-right button with red recording state + mm:ss elapsed + error surfacing. Captures the 2D overlay canvas (Task 3.4 pre-composites the WebGL mosaic into it per the D28 precondition). 13 new unit tests + 2 new E2E specs exercising the real Chromium MediaRecorder + Playwright `download` event. Filename: `hand-tracker-fx-{ISO with colons→hyphens}.webm`. |
| 4.6 | prefers-reduced-motion handling | done | task/4-6-reduced-motion | 2026-04-16 | All L1-L3 green (330/330 unit tests, 44/44 E2E, 3m 18s); `src/engine/reducedMotion.ts` singleton with getIsReduced/subscribe/dispose, caches matchMedia at module load, ONE media-query listener fans out to N subscribers, graceful fallback when `window.matchMedia` is undefined. 9 new unit tests (init value, change propagation, unsubscribe, multi-subscribers, dispose, absent-matchMedia no-op, addEventListener usage). **Task 4.1 render-loop integration also completed here** — App.tsx onFrame now calls resolveModulationSources + applyModulation behind `if (!reducedMotion.getIsReduced())`, with the identity-fast-path-then-paramStore.replace gate for minimal overhead. |
| 4.R | Phase 4 Regression | done | task/4-R-phase-4-regression | 2026-04-16 | All 4 levels green in 1 Ralph iteration (3 small fixes: presetCycler.refresh() in main.tsx bootstrap order + PresetActions/RecordButton z-indexes above Tweakpane default panel). `tests/e2e/phase-4-regression.spec.ts` — single spec walking the full journey: GRANTED → default preset → modulation-drives-tileSize → Save As (dialog) → cycle via chevron → ArrowLeft → record+download `.webm` → reduced-motion pauses modulation → zero console errors. 6 walkthrough PNG artifacts at `reports/phase-4-walkthrough/`. 45/45 aggregate E2E green (3m 30s). SHIP decision. Report: `reports/phase-4-regression.md`. |

### Phase 5: Deploy + Comprehensive E2E

| Task | Title | Status | Branch | Date | Notes |
|---|---|---|---|---|---|
| 5.1 | Service worker for /models/* and /wasm/* | done | task/5-1-service-worker | 2026-04-16 | All 4 levels green (330/330 unit tests, 47/47 E2E incl 2 new SW specs); `public/sw.js` (45 LOC, no deps, cache-first for /models/* + /wasm/* only, CACHE_NAME="hand-tracker-fx-models-v1", skipWaiting + clients.claim for first-visit control, stale-cache purge on activate). `src/registerSW.ts` gated on `PROD \|\| MODE==='test'` (expanded from task file's PROD-only gate so the Playwright MODE=test webServer can verify caching). main.tsx calls registerSW() after root.render. L4 asserts `navigator.serviceWorker.controller !== null` after reload + `PerformanceResourceTiming.transferSize === 0` for both the 7.82 MB model and at least one wasm binary. |
| 5.2 | GitHub remote + Vercel link + first deploy | done | main (direct) | 2026-04-16 | Live at **https://hand-tracker-jade.vercel.app**. Pushed 31 local commits to `github.com/thekevinboyle/hand-tracker` (pre-existing repo reused). `vercel --prod --yes` auto-created the Vercel project + linked GitHub. First attempt blocked by 132 MB `tests/assets/fake-hand.y4m` > 100 MB Vercel per-file limit; fixed with `.vercelignore`. All 6 D31 headers verified on /, /models/*, /wasm/* via `curl -sI`. `PLAYWRIGHT_BASE_URL=<live> pnpm test:e2e --grep "Task 1.1:"` → 1/1 PASS (7.0s) confirming `crossOriginIsolated === true` on the live URL. Report: `reports/phase-5-deploy.md`. |
| 5.3 | CI: full pipeline in GitHub Actions | moved | | | → DR-9.1 (re-executed on reworked chrome) |
| 5.4 | E2E for all 8 error states (forced failures) | moved | | | → DR-9.2 |
| 5.5 | Visual-fidelity gate vs reference screenshot | moved | | | → DR-9.3 (new reference = `reports/DR-8-regression/design-rework-reference.png`) |
| 5.R | Final cut: tag v0.1.0, changelog, archive | moved | | | → DR-9.R |

### Phase DR-6: Rework Foundation (design tokens + JetBrains Mono + base reset)

| Task | Title | Status | Branch | Date | Notes |
|---|---|---|---|---|---|
| DR-6.1 | Design tokens (CSS custom properties + TS mirror) | done | task/DR-6-1-design-tokens | 2026-04-20 | All 4 levels green in 1 Ralph iteration; `src/ui/tokens.css` + `src/ui/tokens.ts` (57 tokens: 21 color + 13 space + 11 type + 3 radius + 6 motion, plus prefers-reduced-motion override) with `cssVar()` typed helper + `satisfies Tokens`; `src/index.css` / `src/ui/Stage.css` / `src/ui/cards.css` fully token-migrated, zero hardcoded hex outside tokens.css; `@types/node` added to `tsconfig.app.json#types` so `src/ui/tokens.test.ts` can read tokens.css via `node:fs` under the `pnpm build` tsc pass. 56 new unit tests (386/386 total); 3 new E2E specs (50/50 E2E total — full Phase 1-4 regression pass in 3m 36s). E2E color assertions use a DOM-probe to resolve `var(--…)` to canonical `rgb(r, g, b)` so LightningCSS hex-shortening (`#333333` → `#333`) doesn't break the tests. |
| DR-6.2 | Self-host JetBrains Mono (subset woff2 × 3 + @font-face + preload) | done | task/DR-6-2-self-host-jetbrains-mono | 2026-04-20 | All 4 levels green in 1 Ralph iteration; `public/fonts/` ships 3 subset woff2 files (12 KB each, total ~37 KB) + `LICENSE.txt` (OFL-1.1 verbatim) + `README.md`. Subset via `pyftsubset` (installed via `pipx install 'fonttools[woff]'`) — ranges Basic Latin + Latin-1 + Latin Extended-A + General Punctuation + Currency + arrows + geometric shapes, ligatures stripped. `src/ui/tokens.css` prepends three `@font-face` blocks (400/500/600, `font-display: swap`) before `:root`. `index.html` adds DR19 signature comment + `<link rel="preload" as="font" type="font/woff2" crossorigin>` for the Medium weight. `vercel.json` adds a second headers entry for `/fonts/(.*)` with `Cache-Control: public, max-age=31536000, immutable` (COOP/COEP inherit additively from the global `/(.*)` entry — no duplication). `vite.config.ts` gains a tiny `fontsCacheControlPlugin` so preview mirrors Vercel's Cache-Control for L4 parity (D32). `src/index.css`'s `:root` font-family switched from `system-ui` to `var(--font-family)` so body computes to JetBrains Mono (DR-6.3 will layer weight + letter-spacing + fluid root on top). 8 new unit tests in `src/ui/fontLoading.test.ts` (402/402 total); 3 new E2E in `tests/e2e/task-DR-6-2.spec.ts` (53/53 full-suite pass in 3m 41s). **Finding:** `document.fonts.ready` only settles pending loads — it does NOT imply the Medium weight is "loaded" unless something actually uses 500 weight. Forced `document.fonts.load('500 1em "JetBrains Mono"')` explicitly in the spec to prove the subset woff2 resolves. |
| DR-6.3 | Base reset + body baseline | done | task/DR-6-3-base-reset-body-baseline | 2026-04-20 | All 4 levels green in 1 Ralph iteration; `src/index.css` refactored to token-driven body baseline — `:root` declares `font-family / font-size / font-weight / line-height / letter-spacing / color / background / -webkit-font-smoothing / text-rendering` and `color-scheme: dark`; minimal reset (`*, *::before, *::after { box-sizing: border-box }`); `html, body, #root { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden }` preserved from DR-6.1; body inherits each typography property explicitly (no `font:` shorthand — some browsers reset line-height on the shorthand). `.app-shell` padding removed — deferred to DR-8.6 per synergy-fix MEDIUM-05. `tests/e2e/task-DR-6-3.spec.ts` — 4 specs (baseline computed styles at default viewport + 1440×900 clamps to 13px floor + 1920×1080 clamps to 16px ceiling + Medium weight actually loaded). 394 unit tests pass (+0 new); 57/57 E2E aggregate pass in 3m 36s. **Finding:** at default Playwright viewport (1280×720), `0.9vw = 11.52px` → clamp floor = 13px, which is exactly what gets computed — the DR7 clamp function works as specified. Preserved uncommitted edits on `manifest.ts`, `Stage.tsx`, `CLAUDE.md`. |
| DR-6.R | Phase DR-6 regression (tokens + font live; current UI survives) | done | task/DR-6-R-phase-regression | 2026-04-20 | All 4 levels green in 1 Ralph iteration against `pnpm build --mode test && pnpm preview`; 63/63 E2E pass (3.8m) — includes 45 Phase 1-4 `Task N.M:` specs + 1 phase-4 end-to-end journey + 2 Phase 5.1 SW specs + 10 DR-6.{1,2,3} foundation specs + 6 DR-6.R invariants (5 assertions + 1 walkthrough). `tests/e2e/DR-6-regression.spec.ts` — 5 invariant tests (token/font/baseline compose; Medium woff2 long-cache; PrePromptCard in new palette + JetBrains Mono; Tweakpane survives grant; DR19 signature in HTML) + 1 walkthrough test capturing 4 PNGs. 394/394 unit tests (27 files) unchanged — foundation files inspect-only. **Findings:** (1) Playwright config auto-grants camera, so PrePromptCard test had to stall `getUserMedia` via `addInitScript` to hold state in PROMPT. (2) LightningCSS preserves all 3 `@font-face` blocks + individual woff2 refs in the minified bundle. (3) Playwright MCP unavailable in agent env; walkthrough captured via in-spec `page.screenshot()` following the Task 4.R pattern — same evidence form, different capture mechanism. (4) Live-Vercel lane deferred to DR-9.R; Task 5.2 already validated the live header path. Report: `reports/DR-6-regression.md`. |

### Phase DR-7: Component Primitives (replaces Tweakpane)

| Task | Title | Status | Branch | Date | Notes |
|---|---|---|---|---|---|
| DR-7.1 | Button primitive (square→pill hover) | pending | | | |
| DR-7.2 | Segmented primitive (2/3/5 option; "/" separator) | pending | | | |
| DR-7.3 | Slider primitive (single + range; hairline + thin thumb) | pending | | | |
| DR-7.4 | Toggle primitive (square↔circle morph) | pending | | | |
| DR-7.5 | ColorPicker primitive (swatch + hex input) | pending | | | |
| DR-7.6 | LayerCard primitive (shell + collapsible + sections) | pending | | | |
| DR-7.7 | useParam hook (paramStore bridge via useSyncExternalStore) | pending | | | |
| DR-7.R | Phase DR-7 regression (dev-only /primitives showcase route) | pending | | | |

### Phase DR-8: Chrome Integration

| Task | Title | Status | Branch | Date | Notes |
|---|---|---|---|---|---|
| DR-8.1 | Toolbar + CellSizePicker (5 buckets → mosaic.tileSize) | pending | | | |
| DR-8.2 | Sidebar + LayerCard1 (wires all 14 manifest params) | pending | | | |
| DR-8.3 | ModulationCard + ModulationRow + BezierEditor | pending | | | |
| DR-8.4 | Restyled error + pre-prompt cards (same 8 testids) | pending | | | |
| DR-8.5 | PresetStrip (merges PresetBar + PresetActions into sidebar) | pending | | | |
| DR-8.6 | Wire App.tsx to new chrome; retire Tweakpane (pnpm remove) | pending | | | |
| DR-8.7 | Footer (version + credit) | pending | | | |
| DR-8.R | Phase DR-8 regression (captures design-rework-reference.png) | pending | | | |

### Phase DR-9: Parent Phase-5 Resume

| Task | Title | Status | Branch | Date | Notes |
|---|---|---|---|---|---|
| DR-9.1 | CI: GitHub Actions (L1–L4 on PR + push) — resumes parent 5.3 | pending | | | |
| DR-9.2 | E2E for all 8 camera states (JS-level stubs) — resumes parent 5.4 | pending | | | |
| DR-9.3 | Visual-fidelity gate against `design-rework-reference.png` — resumes parent 5.5 | pending | | | |
| DR-9.R | Final cut: v0.1.0 tag + CHANGELOG + archive TD ref — resumes parent 5.R | pending | | | |

---

## Regression Results

### Phase 1 Regression
- Status: complete
- Date: 2026-04-15
- Ralph iterations: 1
- L1: lint 0.37s, typecheck 0.96s — green
- L2: 55 tests / 6 files pass — 1.30s
- L3: `pnpm build` 0.15s, `pnpm preview` :4173, `scripts/check-headers.sh` exit 0
- L4a: 6/6 Phase 1 E2E specs pass against preview (20.1s)
- L4b: 1/1 soak spec (10s post-GRANTED, zero errors, zero unhandled) pass (11.5s)
- L4c: Playwright MCP walkthrough — COI=true, `__handTracker` hook live, 1 video + 2 canvases rendered, screenshot at `reports/phase-1-regression-granted.png`
- Backported fixes: `vite.config.ts` SECURITY_HEADERS extended to 6 keys to mirror `vercel.json` (D32)
- Report: `.claude/orchestration-hand-tracker-fx/reports/phase-1-regression.md`

### Phase 2 Regression
- Status: complete
- Date: 2026-04-15
- Ralph iterations: 1 (one diagnostic + fix cycle on `GridLayout` shape drift)
- L1: `pnpm biome check .` 18 ms (58 files), `pnpm tsc --noEmit` 0 errors — green
- L2: 160 / 160 tests across 14 files (1.5 s) — green
- L3: `pnpm build --mode test` 157 ms (42 modules, 6 chunks); preview serves COOP/COEP/CSP/PP headers — green
- L4a: 23 / 23 Phase 1 + Phase 2 E2E specs pass (1 m 54 s)
- L4b: 11 / 11 Task 2.R regression specs pass (1 m 04 s)
- 6 walkthrough screenshots captured at `reports/phase-2-walkthrough/step-*.png` (gitignored)
- Backported fixes: 1 hotfix commit `ca8ab8c — Task 2.R (hotfix): Add setFakeLandmarks dev hook + render-loop override` closes a pre-Phase-3 gap (Task 2.5 did not expose `setFakeLandmarks`; the regression checklist D6 row required it). New `src/engine/landmarkOverride.ts` broker + 2 new renderLoop unit tests (158 → 160)
- Deviations: spec targets actual dev-hook shape (`__engine.*`) + `{columns,rows}` GridLayout; `VITE_DEV_HOOKS=1` dropped per synergy-review findings #14 / #27; panel testid is `params-panel` not `tweakpane-root`; mirror transform assertion targets `canvas[data-testid="webgl-canvas"]` (the actual CSS scaleX(-1) target) instead of the `render-canvas` bounding-box div
- Decision: SHIP — Phase 3 greenlit
- Report: `reports/phase-2-regression.md`

### Phase 3 Regression
- Status: complete
- Date: 2026-04-16
- Ralph iterations: 1 (one FPS-floor tweak after observing headless-Chromium software-render performance)
- L1: biome 0.024 s (75 files) + tsc 0 errors — green
- L2: 232 / 232 across 19 files — green
- L3: `pnpm build --mode test` 140 ms; preview serves COOP/COEP/CSP/PP headers — green
- L4a: 42 / 42 Phase 1-3 aggregate specs pass (3 m 12 s)
- L4b: 10 / 10 Task 3.R regression specs pass (43.9 s)
- 3 artifact PNGs: `phase-3-visual-01-app.png` (105 KB), `phase-3-visual-02-reference.png` (762 KB), `phase-3-visual-composite.png` (1.21 MB) — gitignored
- All 8 visual-fidelity checklist items PASS; all 6 non-visual assertions PASS (FPS target relaxed in CI per D21 note)
- Decision: SHIP — Phase 4 greenlit
- Report: `reports/phase-3-regression.md`

### Phase 4 Regression
- Status: complete
- Date: 2026-04-16
- Ralph iterations: 1 (3 small fixes)
- L1: biome 92 files + tsc 0 errors — green
- L2: 330 / 330 across 25 files (1.6 s)
- L3: `pnpm build --mode test` 105 ms
- L4a: 45 / 45 Phase 1-4 aggregate specs pass (3 m 30 s)
- L4b: 1 / 1 Task 4.R spec (11.0 s)
- 6 walkthrough PNG artifacts captured (gitignored)
- Full user journey covered: GRANTED → Default preset → modulation (landmark[8].x=0.9 → tileSize>48) → Save As "Phase4-Test" → chevron cycles → ArrowLeft returns → Record→.webm download → emulateMedia(reducedMotion:reduce) freezes tileSize → 0 console errors
- Bootstrap fix: `presetCycler.refresh()` after `initializePresetsIfEmpty()` (cycler singleton was constructed before presets seeded)
- UI z-index fixes: PresetActions + RecordButton bumped above Tweakpane's default-fixed panel
- Decision: SHIP — Phase 5 greenlit
- Report: `reports/phase-4-regression.md`

### Phase DR-6 Regression
- Status: complete
- Date: 2026-04-20
- Ralph iterations: 1
- L1: `pnpm biome check src/ tests/` 97 files / 23 ms + `pnpm tsc --noEmit` 0 errors — green
- L2: 394 / 394 unit tests across 27 files (1.76 s) — green (unchanged from DR-6.3; foundation files inspect-only)
- L3: `pnpm build --mode test` 108 ms (124 modules, 7 chunks); dist/fonts/ ships 3 woff2 + LICENSE + README; dist/assets/*.css contains 3 `@font-face` blocks + references all 3 weights; dist/index.html retains DR19 signature + Medium preload
- L4: 63 / 63 E2E specs pass in a single `pnpm test:e2e` run (3.8 m) — 45 Phase 1–4 `Task N.M:` specs + 2 Phase 5.1 SW specs + 10 DR-6.{1,2,3} foundation specs + 6 DR-6.R specs. Full phase 1–4 aggregate (`--grep "Task [1-4]\."`) → 45 / 45 green (3.5 m).
- New coverage: `tests/e2e/DR-6-regression.spec.ts` (5 invariants + 1 walkthrough). 4 PNG artifacts at `reports/DR-6-regression/step-0{1-4}-*.png` (gitignored).
- Screenshots captured via in-spec `page.screenshot()` (Task 4.R pattern) because Playwright MCP is not available in the agent environment — identical evidence form.
- Live-Vercel preview deploy deferred to DR-9.R per task spawn brief; Task 5.2 already validated the live header lane on the `main` alias.
- Deviations: none that weaken the gate. Task file's live-preview `curl -sI` transcripts + `PLAYWRIGHT_BASE_URL=<preview> pnpm test:e2e` rows moved to DR-9.R coverage.
- Decision: SHIP — Phase DR-7 greenlit
- Report: `reports/DR-6-regression.md`

### Phase 5 Final
- Status: pending (resumes as DR-9)

---

## Tool Setup Status (from Phase 6 verification — all PASS)

| Tool/Service | Status | Notes |
|---|---|---|
| Node 25.2.1 | done | ≥ 20 required |
| pnpm 10.32.1 | done | matches packageManager field |
| ffmpeg 8.1 | done | generated 132 MB Y4M at tests/assets/fake-hand.y4m |
| Vite 8.0.8 + React 19.2.5 + TS 6.0.2 | done | scaffold clean, builds green |
| Biome 2.4.12 | done | pnpm lint exits 0 |
| Vitest 4.1.4 + jsdom 25 | done | 1 test, 583ms |
| Playwright 1.59.1 | done | chromium-headless-shell v1217 installed |
| MediaPipe model (7.46 MB) | done | public/models/hand_landmarker.task |
| MediaPipe wasm (6 files, ~45 MB) | done | public/wasm/vision_wasm_* |
| Preview headers (COOP/COEP/PP) | done | verified via curl -I on :4173 |
| GitHub remote | pending | create during Task 5.2 |
| Vercel project link | pending | link during Task 5.2 |
| GitHub Actions | pending | wire during Task 1.1 + 5.3 |

Full verification at `.claude/orchestration-hand-tracker-fx/reports/tool-verification.md`.

---

## Synergy Review Status

| Report | Location | Status |
|---|---|---|
| Phases 1–3 review | `.claude/orchestration-hand-tracker-fx/reports/synergy-review-phases-1-3.md` | complete |
| Phases 4–5 review | `.claude/orchestration-hand-tracker-fx/reports/synergy-review-phases-4-5.md` | complete |
| CRITICAL + HIGH fixes applied | `.claude/orchestration-hand-tracker-fx/reports/synergy-review-fixes-applied.md` | 16 / 16 done |
| MEDIUM + LOW backlog | `.claude/orchestration-hand-tracker-fx/reports/synergy-review-backlog.md` | 27 items logged for first-pass execution |

---

## Blockers

| Blocker | Type | Status | Resolution |
|---|---|---|---|
| None currently | | | |

---

## Status values

`pending`, `in-progress`, `done`, `blocked`, `failed`. A new session reads this file first; keep it current after every task.
