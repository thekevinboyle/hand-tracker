# Hand Tracker FX — Implementation Phases

**Created**: 2026-04-14
**Target**: MVP that visually matches `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png`
**Execution**: Sequential phases, autonomous subagent execution via Ralph loop (PRP methodology)
**Authority**: `DISCOVERY.md` overrides everything. If any task contradicts DISCOVERY.md, DISCOVERY.md wins.

---

## Scope Constraints (from DISCOVERY.md §12)

Do NOT implement:
- Mobile layout / responsive below 1024px
- Light theme
- Mic audio / audio-reactive effects
- More than 1 tracked hand
- Face detection / face-tracking effects
- 3D or three.js
- Pre-recorded video or image input
- Cloud processing / servers / user accounts / auth
- Analytics / telemetry / error-reporting SaaS
- Privacy badge UI, pause-animation UI, mobile "desktop recommended" notice (explicitly declined)
- Service-worker PWA beyond model/wasm caching
- MIDI / keyboard-mapped parameters (architecture supports later)
- FPS overlay UI (dev hook only)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 6 strict (`noUncheckedIndexedAccess`, `noImplicitOverride`) |
| Framework | React 19.2 |
| Build | Vite 8.0 (ESM, rolldown) |
| Package mgr | pnpm 10 |
| Linter/formatter | Biome 2.4 |
| Unit tests | Vitest 4.1 + jsdom 25 + vitest-canvas-mock + @testing-library/react |
| E2E | Playwright 1.59 + Chromium w/ fake Y4M webcam |
| Hand tracking | `@mediapipe/tasks-vision` 0.10.34 (HandLandmarker, main-thread, GPU delegate) |
| WebGL | ogl 1.0 (mosaic fragment shader, full-screen quad) |
| 2D overlay | Canvas 2D (grid + dotted blobs + coord labels) |
| Params UI | Tweakpane 4.0 + @tweakpane/plugin-essentials 0.2 |
| Modulation | bezier-easing 2.1 |
| Deploy | Vercel (`vercel.json` w/ COOP `same-origin` + COEP `require-corp` + CSP) |
| Assets | MediaPipe model (7.5 MB) + 6 wasm files (~52 MB) self-hosted under `public/` |

Full scaffold verified in Phase 6 report: `.claude/orchestration-hand-tracker-fx/reports/tool-verification.md`.

---

## Skills Reference

All at `.claude/skills/<name>/SKILL.md`. Execution agents MUST read the relevant skills before starting a task.

| Skill | Read for tasks involving |
|---|---|
| `hand-tracker-fx-architecture` | Any task — top-level orientation, folder structure, data flow |
| `prp-task-ralph-loop` | Any task — task file format, 4-level validation, Ralph loop protocol |
| `mediapipe-hand-landmarker` | Camera/tracking integration, landmark schema, error mapping |
| `webcam-permissions-state-machine` | `useCamera` hook, 8-state error UI, device selection |
| `ogl-webgl-mosaic` | Render loop, mosaic shader, region masking, video texture |
| `tweakpane-params-presets` | Params panel, modulation, preset persistence, chevron cycler |
| `vite-vercel-coop-coep` | Vite/Vercel config, security headers, CSP, service worker |
| `playwright-e2e-webcam` | Any Level-4 E2E work, fake webcam, CI wiring |
| `vitest-unit-testing-patterns` | Any Level-2 unit test |

---

## Tools Reference

| Tool | Purpose | Key operations |
|---|---|---|
| **Playwright MCP** | Manual visual verification vs reference screenshot; Vercel dashboard automation (deploy linking); E2E tests | `browser_navigate`, `browser_snapshot`, `browser_take_screenshot`, `browser_evaluate` |
| **context7 MCP** | Live library docs lookup (MediaPipe, ogl, Tweakpane, Vite) | `resolve-library-id`, `query-docs` |
| Biome | Lint + format + organize imports | `pnpm lint`, `pnpm lint:fix` |
| Vitest | Unit tests (L2) | `pnpm test`, `pnpm test:watch` |
| Playwright CLI | E2E (L4) | `pnpm test:e2e --grep "Task N.M:"` |
| pnpm | Package + script runner | `pnpm install`, `pnpm <script>` |
| ffmpeg | Y4M fake-webcam synthesis for E2E | `pnpm test:setup` |
| Vercel CLI (future) | Deploy + link | `vercel link`, `vercel --prod` |
| gh CLI | GitHub remote, release tagging | `gh repo create`, `gh release create` |

---

## Testing Methods (PRP 4-level Validation)

Every task file MUST include all four levels. The Ralph loop runs them in order and self-heals failures.

| Level | Method | Command template | Purpose |
|---|---|---|---|
| **L1 Syntax & Style** | Biome + tsc | `pnpm lint && pnpm typecheck` | Zero errors before any other check |
| **L2 Unit** | Vitest | `pnpm vitest run <paths>` | Pure logic correctness — geometry, modulation, preset (de)serialization, error reducer |
| **L3 Integration** | Vite build / component test / node script | Task-specific (`pnpm build`, `pnpm test path/to/integration.test.ts`) | Cross-module wiring, build-time checks |
| **L4 E2E** | Playwright + fake webcam | `pnpm test:e2e --grep "Task N.M:"` | User-emulating flows, `crossOriginIsolated` check, FPS floor, visual elements |

Phase-regression tasks (Task N.R) run **all four levels** on a fresh `pnpm preview` build, plus manual visual verification against the reference screenshot via Playwright MCP.
Final-phase tasks run **all four levels** against the Vercel preview URL (`PLAYWRIGHT_BASE_URL` env var).

---

## Phase Overview

| Phase | Goal | Tasks |
|---|---|---|
| **1: Foundation** | Scaffold hardened; webcam + MediaPipe + rVFC loop rendering raw video | 7 |
| **2: Engine + Overlay** | Effect registry, paramStore, Tweakpane panel, grid + dotted blobs | 6 |
| **3: Mosaic Shader** | ogl WebGL mosaic inside hand-bounded region, visually matches reference | 6 |
| **4: Modulation, Presets, UX** | X/Y modulation live, presets + chevron cycler, record→webm, reduced-motion | 7 |
| **5: Deploy + Comprehensive E2E** | Vercel live, CI green, all 8 error states covered, final visual-fidelity gate | 6 |
| | | **Total: 32** |

---

## Phase 1: Foundation

**Goal**: Scaffold is production-grade (lint, typecheck, unit, E2E, CI all passing); webcam captured; MediaPipe initialized; rVFC loop renders raw video into a canvas; landmarks arrive.

### Task 1.1: Harden scaffold + CI
- **Objective**: Finalize CI (GitHub Actions), lock in the `pnpm check` gate, add the `.github/workflows/ci.yml`. Scaffold itself is already in place from Phase 5 of orchestration.
- **Dependencies**: None
- **Blocked by**: None
- **Files**:
  - `.github/workflows/ci.yml` (new)
  - `tests/e2e/smoke.spec.ts` (new — boot + crossOriginIsolated assertion only)
  - `CLAUDE.md` at repo root (new — orchestration section per m2c1 template)
- **Contracts**:
  - CI job runs on push + PR; matrix: `ubuntu-latest` chromium only
  - `pnpm check` exits 0 blocks the gate
  - `Task N.M:` E2E describe naming convention locked in
- **Acceptance Criteria**:
  - [ ] `pnpm check` passes locally
  - [ ] CI workflow passes on first push (or dry-run via `act` if remote not wired)
  - [ ] `tests/e2e/smoke.spec.ts` asserts `crossOriginIsolated === true`
- **Testing (L1–L4)**:
  - L1: `pnpm lint && pnpm typecheck`
  - L2: existing `src/App.test.tsx` passes
  - L3: `pnpm build` exits 0
  - L4: `pnpm test:e2e --grep "Task 1.1:"`
- **Skills**: `hand-tracker-fx-architecture`, `prp-task-ralph-loop`, `vite-vercel-coop-coep`, `playwright-e2e-webcam`

### Task 1.2: useCamera hook (8-state machine)
- **Objective**: React hook managing permission + stream lifecycle with the full 8-state machine from D23.
- **Dependencies**: 1.1
- **Blocked by**: 1.1
- **Files**:
  - `src/camera/useCamera.ts` (new)
  - `src/camera/cameraState.ts` (new — state/event enums)
  - `src/camera/mapError.ts` (new — pure error→state fn)
  - `src/camera/useCamera.test.ts` (new — covers PROMPT, GRANTED, USER_DENIED, DEVICE_CONFLICT, NOT_FOUND, OverconstrainedError relaxed-retry)
- **Contracts**:
  - Returns: `{ state: CameraState, videoEl: HTMLVideoElement | null, stream, devices, retry(), setDeviceId(id) }`
  - Landmarks coordinate space is ALWAYS unmirrored (D27); CSS mirroring only on display
  - `localStorage` key: `hand-tracker-fx:cameraDeviceId`
- **Acceptance Criteria**:
  - [ ] All 6 gUM error types mapped to correct state
  - [ ] `track.stop()` called on every unmount (idempotent)
  - [ ] StrictMode double-mount doesn't double-open camera
  - [ ] `permissionStatus.onchange` + `devicechange` listeners wired and cleaned up
- **Testing (L1–L4)**:
  - L1: `pnpm lint src/camera src/camera/*.ts && pnpm typecheck`
  - L2: `pnpm vitest run src/camera` (mock `navigator.mediaDevices`)
  - L3: N/A (no build-time check beyond L1)
  - L4: `pnpm test:e2e --grep "Task 1.2:"` (PROMPT → GRANTED happy path)
- **Skills**: `webcam-permissions-state-machine`, `vitest-unit-testing-patterns`, `prp-task-ralph-loop`

### Task 1.3: Error-state UI + pre-prompt card
- **Objective**: Render the 8 full-screen state cards with dedicated copy + Retry affordances.
- **Dependencies**: 1.2
- **Blocked by**: 1.2
- **Files**:
  - `src/ui/ErrorStates.tsx` (new — one component per state, switch-driven)
  - `src/ui/PrePromptCard.tsx` (new — shown when `permissionStatus.state === 'prompt'`)
  - `src/ui/ErrorStates.test.tsx` (new)
  - `src/ui/errorCopy.ts` (new — string table keyed by state)
- **Contracts**:
  - `<ErrorStates state={...} onRetry={...} />` single-responsibility component
  - Reduced-motion honored: no animation on state cards when `prefers-reduced-motion: reduce`
- **Acceptance Criteria**:
  - [ ] All 8 states render their dedicated card
  - [ ] Retry button wired for states where retry applies
  - [ ] `aria-live="polite"` on the state card region for SR updates
  - [ ] Keyboard focus lands on primary action when card appears
- **Testing**:
  - L1/L2: unit test every state renders; a11y role checks
  - L4: `Task 1.3:` spec forces `NOT_FOUND` via launchOption tweak (optional; can rely on unit coverage + manual)
- **Skills**: `webcam-permissions-state-machine`, `vitest-unit-testing-patterns`, `prp-task-ralph-loop`

### Task 1.4: MediaPipe HandLandmarker init + singleton
- **Objective**: Module-level HandLandmarker singleton; GPU-first with CPU fallback; error mapping (`WebGLUnavailableError` vs `ModelLoadError`).
- **Dependencies**: 1.2 (needs a live `videoEl` for detection)
- **Blocked by**: 1.2
- **Files**:
  - `src/tracking/handLandmarker.ts` (new — `initHandLandmarker()`, `disposeHandLandmarker()`, singleton ref)
  - `src/tracking/errors.ts` (new — error classes + `isWebGLFailure`)
  - `src/tracking/handLandmarker.test.ts` (new — `vi.mock('@mediapipe/tasks-vision')`)
- **Contracts**:
  - `initHandLandmarker()` returns a `HandLandmarker`; throws `WebGLUnavailableError` or `ModelLoadError`
  - `runningMode: 'VIDEO'`, `numHands: 1`, all confidences `0.5`
  - Asset paths: `/wasm/` + `/models/hand_landmarker.task`
- **Acceptance Criteria**:
  - [ ] GPU-delegate init succeeds on capable HW; falls back to CPU otherwise
  - [ ] Error message pattern `emscripten_webgl|webgl|kGpuService|Unable to initialize EGL` → `WebGLUnavailableError`
  - [ ] Does NOT call `close()` on every unmount (GPU freeze bug #5718)
- **Testing**:
  - L1/L2: `pnpm vitest run src/tracking`
  - L4: `Task 1.4:` spec asserts at least one landmark via `window.__handTracker.getLandmarkCount()` against a Y4M that includes a detectable hand (fall back to asserting count === 0 for synthetic testsrc2; real-hand Y4M optional later)
- **Skills**: `mediapipe-hand-landmarker`, `vitest-unit-testing-patterns`, `prp-task-ralph-loop`

### Task 1.5: rVFC-driven render loop scaffold
- **Objective**: `requestVideoFrameCallback` on the `<video>` element drives the full pipeline: frame → detectForVideo → paramStore snapshot read → render (placeholder). Decoupled per-frame timing.
- **Dependencies**: 1.4
- **Blocked by**: 1.4
- **Files**:
  - `src/engine/renderLoop.ts` (new — `startRenderLoop({ video, onFrame, onError })`, returns `stop()`)
  - `src/engine/types.ts` (new — `FrameContext` type per D37)
  - `src/engine/renderLoop.test.ts` (new — fake video + fake rVFC shim)
  - `src/engine/devHooks.ts` (new — `window.__handTracker` dev-only hook)
- **Contracts**:
  - `FrameContext` per D37: `{ videoTexture: WebGLTexture | null, videoSize, landmarks, params, timeMs }`
  - `onFrame(ctx)` called every video frame; errors bubble via `onError`
  - Dev hook: `window.__handTracker.getFPS()`, `.getLandmarkCount()` behind `import.meta.env.DEV || MODE === 'test'`
- **Acceptance Criteria**:
  - [ ] Uses `requestVideoFrameCallback` (not rAF) on the `<video>`
  - [ ] Guarded by `readyState >= HAVE_ENOUGH_DATA`
  - [ ] `timeMs` is the `nowMs` from rVFC (monotonic, passed to `detectForVideo`)
  - [ ] `stop()` cancels the pending rVFC id
- **Testing**: L1/L2/L4 as usual; L4 asserts `getFPS() > 0` after mount
- **Skills**: `mediapipe-hand-landmarker`, `hand-tracker-fx-architecture`, `prp-task-ralph-loop`

### Task 1.6: Video mount + mirror-aware canvas composition
- **Objective**: `<video>` element hooked up to the stream; two stacked canvases (WebGL + 2D) mount above it; CSS `scaleX(-1)` applied only to the displayed canvases (not `<video>`); landmarks remain unmirrored.
- **Dependencies**: 1.5
- **Blocked by**: 1.5
- **Files**:
  - `src/ui/Stage.tsx` (new — video + WebGL canvas + 2D canvas stacked; refs lifted for engine wiring)
  - `src/ui/Stage.css` (new — 100vw × 100vh, full-viewport stretch, mirror transform)
  - `src/ui/Stage.test.tsx` (new — structure + mirror class)
- **Contracts**:
  - `<video>` is hidden offscreen, only used as texture source
  - Display canvases inherit `transform: scaleX(-1)` when `params.input.mirror === true`
  - WebGL context `preserveDrawingBuffer: true` (needed for MediaRecorder in Phase 4)
- **Acceptance Criteria**:
  - [ ] Stacked canvases visible, aspect ratio = 100% viewport
  - [ ] Mirror toggles transform correctly
  - [ ] `<video>` is ARIA-hidden (`aria-hidden="true"`)
- **Testing**: L1/L2/L4 boot check
- **Skills**: `webcam-permissions-state-machine`, `hand-tracker-fx-architecture`

### Task 1.R: Phase 1 Regression
- **Objective**: Full Phase 1 regression against `pnpm preview`.
- **Dependencies**: 1.1–1.6
- **Testing**:
  - [ ] `pnpm check` green
  - [ ] `pnpm build && pnpm preview` serves with correct headers (`curl -I` script)
  - [ ] All Phase 1 `Task 1.N:` Playwright tests pass
  - [ ] Manual Playwright MCP walkthrough: PROMPT → GRANTED; landmark count > 0 after ~3s warmup
  - [ ] No console errors, no unhandled rejections
- **Skills**: `playwright-e2e-webcam`, `vite-vercel-coop-coep`

---

## Phase 2: Engine + Overlay (no effect yet)

**Goal**: Effect registry + paramStore + Tweakpane panel live. Grid and dotted-blob overlay rendering on top of raw webcam. No mosaic yet.

### Task 2.1: Effect manifest + registry types
- **Objective**: TypeScript types + empty registry per D36.
- **Files**:
  - `src/engine/registry.ts` (new — `registerEffect`, `getEffect`, `listEffects`)
  - `src/engine/manifest.ts` (new — `EffectManifest`, `ParamDef`, `ModulationSourceDef`)
  - `src/engine/registry.test.ts` (new)
- **Acceptance**:
  - [ ] Generic `EffectManifest<TParams>` typed against a param shape
  - [ ] Register/get/list all pure functions
- **Testing**: L1/L2
- **Skills**: `hand-tracker-fx-architecture`, `tweakpane-params-presets`

### Task 2.2: paramStore + buildPaneFromManifest
- **Objective**: Plain-object store + Tweakpane pane construction from manifest.
- **Dependencies**: 2.1
- **Files**:
  - `src/engine/paramStore.ts`
  - `src/ui/Panel.tsx` (React component that mounts Tweakpane into a ref)
  - `src/engine/buildPaneFromManifest.ts`
  - `src/engine/paramStore.test.ts`
- **Acceptance**:
  - [ ] `store.getSnapshot()` stable ref until `set`
  - [ ] `useSyncExternalStore` integration works in `<Panel />`
  - [ ] Panel bindings update store on change; `pane.refresh()` NEVER called per frame
- **Testing**: L1/L2
- **Skills**: `tweakpane-params-presets`, `vitest-unit-testing-patterns`

### Task 2.3: Seeded grid generator + 2D-overlay rendering
- **Objective**: Deterministic seeded column-width RNG; 2D canvas overlay drawing grid lines per D4.
- **Dependencies**: 2.2
- **Files**:
  - `src/effects/handTrackingMosaic/grid.ts` (pure — `generateColumnWidths(seed, count, variance)` returns normalized `[0,1]` breakpoints)
  - `src/effects/handTrackingMosaic/gridRenderer.ts` (draws grid lines into a 2D context)
  - `src/effects/handTrackingMosaic/grid.test.ts` (deterministic fixtures for seed `0x1A2B3C4D`)
- **Acceptance**:
  - [ ] Same seed → identical widths every call
  - [ ] `variance=0` → uniform; `variance=1` → maximum non-uniformity
  - [ ] Grid renders with params-panel–driven color + line weight
- **Testing**: L1/L2
- **Skills**: `ogl-webgl-mosaic` (for coordinate system), `vitest-unit-testing-patterns`

### Task 2.4: Dotted-circle blobs + xy coordinate labels
- **Objective**: 2D overlay draws dotted circles for fingertips (landmarks 4,8,12,16,20) with 3-decimal normalized xy labels alongside (D7).
- **Dependencies**: 2.3, 1.4
- **Files**:
  - `src/effects/handTrackingMosaic/blobRenderer.ts` (uses `setLineDash`, `fillText`)
  - `src/effects/handTrackingMosaic/blobRenderer.test.ts`
- **Acceptance**:
  - [ ] 5 blobs max per frame (D6); skipped if no hand
  - [ ] Coords rendered as `x: 0.xxx  y: 0.xxx`
  - [ ] `data-testid="landmark-blob"` element(s) exposed for E2E count assertions
- **Testing**: L1/L2; L4 via blob count
- **Skills**: `ogl-webgl-mosaic`, `hand-tracker-fx-architecture`

### Task 2.5: `handTrackingMosaic` manifest (no effect logic yet)
- **Objective**: The effect manifest object; register it in the engine. `create()` returns a noop `render()` that only clears the WebGL canvas; the Phase 3 tasks replace it.
- **Dependencies**: 2.1, 2.3, 2.4
- **Files**:
  - `src/effects/handTrackingMosaic/manifest.ts` (exports `handTrackingMosaicManifest`)
  - `src/effects/handTrackingMosaic/index.ts` (re-export + `registerEffect(manifest)`)
- **Acceptance**:
  - [ ] Manifest defines all params from D4/D9 (grid seed/count/variance, mosaic tile/blend/feather, effect.regionPadding, input.mirror)
  - [ ] `defaultParams` matches DEFAULT_PRESET reference-screenshot values
  - [ ] Effect appears in `listEffects()`
- **Testing**: L1/L2
- **Skills**: `tweakpane-params-presets`, `hand-tracker-fx-architecture`

### Task 2.R: Phase 2 Regression
- **Objective**: Grid + 5 dotted blobs visible over live webcam; Tweakpane panel drives the params live.
- **Testing**:
  - [ ] Manual Playwright MCP: change `grid.columnCount` in panel → grid re-renders live
  - [ ] `data-testid="landmark-blob"` count == 5 when a hand is visible (Y4M with testsrc2 → 0 is acceptable; use real hand for manual)
  - [ ] Visual diff note: no mosaic yet expected

---

## Phase 3: Mosaic Shader

**Goal**: WebGL mosaic inside the hand-bounded polygon, visually matching the reference screenshot.

### Task 3.1: ogl renderer bootstrap + video texture
- **Objective**: ogl `Renderer({ webgl: 2, preserveDrawingBuffer: true })`, full-screen `Triangle` geometry, video texture upload each frame with `flipY: true`, no mipmaps, CLAMP_TO_EDGE, LINEAR filters.
- **Dependencies**: 2.5, 1.6
- **Files**:
  - `src/engine/renderer.ts`
  - `src/engine/renderer.test.ts` (mock WebGL via a stub; full test in E2E)
- **Acceptance**:
  - [ ] `renderer.gl.canvas` sized with DPR
  - [ ] `texture.needsUpdate = true` every frame; `readyState >= HAVE_ENOUGH_DATA` guarded
  - [ ] `webglcontextlost` → `preventDefault()`, cancel rVFC; `webglcontextrestored` → reinit and resume
- **Testing**: L1/L2/L4
- **Skills**: `ogl-webgl-mosaic`

### Task 3.2: Mosaic fragment shader
- **Objective**: GLSL ES 3.0 fragment shader with `#define MAX_REGIONS 96`, tile quantization inside the region AABB loop, `uBlendOpacity` + `uEdgeFeather` mixing.
- **Dependencies**: 3.1
- **Files**:
  - `src/effects/handTrackingMosaic/shader.ts` (exports vertex + fragment as string constants)
  - `src/effects/handTrackingMosaic/shader.test.ts` (golden-string assertions + `#version 300 es` at byte 0)
- **Acceptance**:
  - [ ] `#version 300 es` is literally byte 0 (no leading whitespace)
  - [ ] Fragment uses `if (i >= uRegionCount) break;` inside the MAX_REGIONS loop
  - [ ] Compiles in a headless WebGL context in unit tests (via `happy-dom`/stub OR deferred to L4)
- **Testing**: L1/L2 golden string; L4 renders an expected pixel inside a region
- **Skills**: `ogl-webgl-mosaic`

### Task 3.3: Hand polygon → active cells (winding number)
- **Objective**: Pure functions: `polygonFromLandmarks(landmarks, padding)`, `computeActiveCells(polygon, grid, cap=96)` using cell-center winding-number point-in-polygon.
- **Dependencies**: 3.2, 2.3
- **Files**:
  - `src/effects/handTrackingMosaic/region.ts`
  - `src/effects/handTrackingMosaic/region.test.ts` (fixtures for concave-finger polygon → assert specific cells selected)
- **Acceptance**:
  - [ ] Uses landmarks {0, 4, 8, 12, 16, 20} (D5)
  - [ ] Handles non-convex polygon (winding number, not cross product)
  - [ ] Pads polygon by `effect.regionPadding` cells
  - [ ] Hard cap of 96 cells; deterministic ordering
- **Testing**: L1/L2 with concrete fixtures
- **Skills**: `ogl-webgl-mosaic`, `vitest-unit-testing-patterns`

### Task 3.4: Effect `render()` wire-up
- **Objective**: `handTrackingMosaic.create(gl)` returns a real `EffectInstance` whose `render(frameCtx)` uploads uniforms (active regions, tileSize, blend, feather) and draws the mesh.
- **Dependencies**: 3.1, 3.2, 3.3, 2.5
- **Files**:
  - `src/effects/handTrackingMosaic/render.ts`
- **Acceptance**:
  - [ ] Uses `new Float32Array(uniformBuf, 0, n * 4)` view pattern to force uniform cache invalidation without per-frame alloc
  - [ ] `uResolution` uses physical pixels (post-DPR)
  - [ ] When `landmarks === null`, no regions → original video passes through
- **Testing**: L1/L2 (unit test `render()` with a fake gl); L4 visual assert
- **Skills**: `ogl-webgl-mosaic`, `mediapipe-hand-landmarker`

### Task 3.5: Context-loss recovery + cleanup
- **Objective**: Hook `webglcontextlost`/`webglcontextrestored`; dispose via `gl.deleteTexture(texture.texture)` (no `destroy()` on ogl Texture).
- **Dependencies**: 3.4
- **Files**:
  - Adds to `src/engine/renderer.ts` + a new `src/engine/contextLoss.test.ts` driving `WEBGL_lose_context`
- **Acceptance**:
  - [ ] Losing context cancels rVFC; restore reinstates the full pipeline
  - [ ] No memory leak — tests verify `deleteTexture` called on cleanup
- **Testing**: L1/L2 via `WEBGL_lose_context` extension
- **Skills**: `ogl-webgl-mosaic`

### Task 3.R: Phase 3 Regression — visual fidelity gate
- **Objective**: The effect visibly matches the reference screenshot: grid, 5 dotted blobs, mosaic inside the hand-bounded region, labels.
- **Dependencies**: 3.1–3.5
- **Testing**:
  - [ ] All L1–L4 pass
  - [ ] Playwright MCP manual: open `pnpm preview`, hold hand up to webcam (or load real-hand Y4M), screenshot compared side-by-side with `reference-assets/touchdesigner-reference.png`
  - [ ] Agent emits a side-by-side PNG to `reports/phase-3-visual.png` for review
- **Skills**: `ogl-webgl-mosaic`, `playwright-e2e-webcam`

---

## Phase 4: Modulation, Presets, UX Polish

**Goal**: X/Y modulation drives params live; presets + chevron cycler work; Record → webm download; reduced-motion honored.

### Task 4.1: ModulationRoute evaluator + defaults
- **Objective**: `applyModulation(routes, sources, params) → params'` with bezier-easing cache; `DEFAULT_MODULATION_ROUTES` match D13.
- **Files**: `src/engine/modulation.ts`, `src/engine/modulation.test.ts`
- **Acceptance**:
  - [ ] `landmark[8].x` → `mosaic.tileSize` in `[4, 64]` (linear)
  - [ ] `landmark[8].y` → `grid.columnCount` in `[4, 20]` (linear, rounded to int)
  - [ ] Bezier cache prevents per-frame allocation
- **Testing**: L1/L2
- **Skills**: `tweakpane-params-presets`, `vitest-unit-testing-patterns`

### Task 4.2: CubicBezier blade + modulation UI
- **Objective**: Per-route controls in the Tweakpane "Modulation" page using Essentials CubicBezier + Interval blades.
- **Dependencies**: 4.1, 2.2
- **Files**: `src/ui/ModulationPanel.ts`
- **Acceptance**:
  - [ ] Adding/removing routes via UI persists to modulationStore
  - [ ] Edge cases: invalid source name → store warns, falls back to no-op
- **Testing**: L1/L2 (blade change events); L4 optional
- **Skills**: `tweakpane-params-presets`

### Task 4.3: Preset schema + persistence + import/export
- **Objective**: Preset CRUD (save/load/delete/list/export-json/import-json); `hand-tracker-fx:presets:v1` localStorage key; versioned schema per D29.
- **Dependencies**: 4.1
- **Files**: `src/engine/presets.ts`, `src/engine/presets.test.ts`, `src/ui/PresetActions.tsx`
- **Acceptance**:
  - [ ] `DEFAULT` preset seeded on first load
  - [ ] Import rejects mismatched `version`
  - [ ] Export produces downloadable `.json` with stable field order
- **Testing**: L1/L2 (round-trip, invalid inputs)
- **Skills**: `tweakpane-params-presets`

### Task 4.4: Preset chevron cycler + ArrowLeft/Right
- **Objective**: `< >` buttons + ArrowLeft/Right key bindings wrap through preset list.
- **Dependencies**: 4.3
- **Files**: `src/ui/PresetBar.tsx`, `src/ui/PresetCycler.ts`, `src/ui/PresetBar.test.tsx`
- **Acceptance**:
  - [ ] Keyboard wraps; input-focus guard (doesn't trigger while typing)
  - [ ] `pane.refresh()` called exactly once per cycle
- **Testing**: L1/L2/L4 (arrow key cycles, snapshot of visible preset name)
- **Skills**: `tweakpane-params-presets`

### Task 4.5: Record → MediaRecorder → webm
- **Objective**: Record button captures the composited canvas to `video/webm;codecs=vp9` (fallback vp8); no audio, no cap; blob download.
- **Dependencies**: 3.R (effect visible)
- **Files**: `src/ui/RecordButton.tsx`, `src/ui/useRecorder.ts`, `src/ui/useRecorder.test.ts`
- **Acceptance**:
  - [ ] `canvas.captureStream(30)` + vp9 default; vp8 fallback
  - [ ] REC indicator + elapsed timer while recording
  - [ ] Download filename `hand-tracker-fx-<ISO>.webm`
- **Testing**: L1/L2; L4 verifies download triggers
- **Skills**: `vite-vercel-coop-coep` (CSP media-src blob:), `hand-tracker-fx-architecture`

### Task 4.6: Reduced-motion handling
- **Objective**: `prefers-reduced-motion: reduce` → pause modulation (params snap to neutral); render continues; both init-time and runtime listener per D26.
- **Dependencies**: 4.1
- **Files**: `src/engine/reducedMotion.ts`, `src/engine/reducedMotion.test.ts`
- **Acceptance**:
  - [ ] `matchMedia` listener reflects runtime toggles
  - [ ] Neutral params == DEFAULT_PRESET params (not modulated)
- **Testing**: L1/L2
- **Skills**: `tweakpane-params-presets`

### Task 4.R: Phase 4 Regression
- **Objective**: End-to-end user flow — load default preset, move hand around (modulation live), save preset, cycle via chevron, record 5s clip, verify download, toggle reduced-motion, confirm modulation pauses.
- **Testing**:
  - [ ] All L1–L4 green
  - [ ] Playwright MCP walks the entire flow
  - [ ] Attach `reports/phase-4-walkthrough.png` sequence

---

## Phase 5: Deploy + Comprehensive E2E

**Goal**: Vercel live, CI green on preview URL, all 8 error states covered with forced-failure tests, final visual-fidelity gate against the reference.

### Task 5.1: Service worker for /models/* and /wasm/* cache
- **Objective**: Cache-first SW (`public/sw.js`) covering `/models/*` and `/wasm/*`; registered only in `import.meta.env.PROD`.
- **Files**: `public/sw.js` (new), `src/app/registerSW.ts` (new)
- **Acceptance**:
  - [ ] Cache name versioned: `hand-tracker-fx-models-v1`
  - [ ] Misses fall through to network; errors surface to the 8-state machine (MODEL_LOAD_FAIL if model 404s)
  - [ ] Disabled in dev to avoid stale caches
- **Testing**: L1/L2/L4 (offline reload serves model from cache)
- **Skills**: `vite-vercel-coop-coep`

### Task 5.2: GitHub remote + Vercel link + first deploy
- **Objective**: Create `gh repo create thekevinboyle/hand-tracker-fx` (public), push `main`, link Vercel project via CLI, first production deploy.
- **Files**: None (infra task). Documented in `reports/phase-5-deploy.md`.
- **Acceptance**:
  - [ ] `https://hand-tracker-fx.vercel.app` (or subdomain) serves the app
  - [ ] `curl -I` confirms COOP/COEP/CSP/Permissions-Policy on the live URL
  - [ ] `crossOriginIsolated === true` in the live app
- **Testing**: L1/L2/L3/L4 using `PLAYWRIGHT_BASE_URL` set to the preview URL
- **Skills**: `vite-vercel-coop-coep`

### Task 5.3: CI: full pipeline in GitHub Actions
- **Objective**: `.github/workflows/ci.yml` extended: typecheck + lint + unit + build + Playwright E2E (Ubuntu + Chromium). Optional: scheduled E2E against Vercel preview on `deployment_status`.
- **Dependencies**: 5.2
- **Files**: `.github/workflows/ci.yml` (extend), `.github/workflows/e2e-preview.yml` (new)
- **Acceptance**:
  - [ ] PR gate runs full `pnpm check` + E2E smoke
  - [ ] Vercel preview triggers E2E job on `deployment_status: success`
  - [ ] Failed E2E uploads video + HAR artifact
- **Testing**: L4 visible in GitHub UI
- **Skills**: `playwright-e2e-webcam`, `vite-vercel-coop-coep`

### Task 5.4: E2E for all 8 error states (forced failures)
- **Objective**: Dedicated Playwright specs force each of: USER_DENIED, SYSTEM_DENIED, DEVICE_CONFLICT, NOT_FOUND, MODEL_LOAD_FAIL, NO_WEBGL, plus PROMPT → GRANTED happy path (already in 1.1 smoke).
- **Dependencies**: 5.3
- **Files**: `tests/e2e/error-states.spec.ts`
- **Acceptance**:
  - [ ] Each state has a dedicated `Task 5.4:` describe block
  - [ ] Forcing mechanisms per skill (routing model path to 404, removing camera flags, etc.)
  - [ ] Each spec asserts the matching error card via `data-testid`
- **Testing**: L4 the only relevant level (full suite runs via L3)
- **Skills**: `playwright-e2e-webcam`, `webcam-permissions-state-machine`

### Task 5.5: Visual-fidelity gate against reference screenshot
- **Objective**: Playwright MCP session loads the live URL, loads a real-hand fixture Y4M (or uses user's webcam in manual mode), captures a screenshot, and produces a side-by-side against `reference-assets/touchdesigner-reference.png`. Not pixel-identical (impossible); must tick the checklist:
  - [ ] Grid: seeded non-uniform columns visible
  - [ ] Blobs: 5 dotted circles with xy labels
  - [ ] Mosaic: cells inside hand region show pixelation
  - [ ] Chevrons: render at screen edges
  - [ ] Overall dark theme
- **Files**: `reports/phase-5-visual-fidelity.md` + artifacts
- **Testing**: L4 + Playwright MCP
- **Skills**: `playwright-e2e-webcam`, `hand-tracker-fx-architecture`

### Task 5.R: Final cut
- **Objective**: Tag `v0.1.0`, finalize README, close any remaining Known Issues, archive orchestration state.
- **Files**: `README.md` (polish), `CHANGELOG.md` (new), `.claude/prp-ralph.state.md` (archive to `reports/prp-ralph-final.md`)
- **Acceptance**:
  - [ ] `gh release create v0.1.0`
  - [ ] CI green on `main`
  - [ ] All Phase 5 acceptance ticks complete
- **Skills**: `hand-tracker-fx-architecture`

---

## Dependency Graph

```
1.1 ──┬─> 1.2 ──> 1.3
      │    │
      │    └──> 1.4 ──> 1.5 ──> 1.6 ──> 1.R
      │
      └───────────────────────────────────┐
                                          │
                                          v
2.1 ──> 2.2 ──> 2.3 ──> 2.4 ──> 2.5 ──> 2.R
                  │
                  v
3.1 ──> 3.2 ──> 3.3 ──> 3.4 ──> 3.5 ──> 3.R
                                          │
                                          v
4.1 ──> 4.2
  │
  └──> 4.3 ──> 4.4
              │
              v
4.5 ──> 4.6 ──> 4.R
                │
                v
5.1 ──> 5.2 ──> 5.3 ──> 5.4 ──> 5.5 ──> 5.R
```

---

## Task Execution Protocol

### For each regular task (1.x–5.x except regression + 5.R):
1. **Orient**: Read task file, all Skills listed, DISCOVERY.md, PROGRESS.md
2. **Plan**: Cross-check Current Tree vs Desired Tree; spot dependencies; review contracts
3. **Branch**: `git checkout -b task/<N>-<M>-<slug>` from `main`
4. **Implement**: Follow Implementation Blueprint; write tests first where reasonable
5. **Validate (Ralph loop)**: L1 → L2 → L3 → L4 in order; fix-root-cause on any failure; update `.claude/prp-ralph.state.md` every iteration
6. **Complete**: All four levels exit 0 → update PROGRESS.md → commit per D40 → fast-forward merge to `main` → emit `<promise>COMPLETE</promise>`

### For regression tasks (1.R, 2.R, 3.R, 4.R):
1. All tasks in the phase complete and merged
2. Clean `pnpm preview` build
3. Run ALL L1–L4 on the fresh preview
4. Manual Playwright MCP walkthrough with screenshot artifacts in `reports/phase-N-*.png`
5. Any failure → hotfix task within the same phase → re-run
6. All green → merge phase branch OR leave on `main` (trunk-based)

### For final phase tasks (5.1–5.R):
1. Use `PLAYWRIGHT_BASE_URL` to target the Vercel preview (not localhost)
2. All testing is on the live deployment
3. All 8 error states covered by forced-failure specs
4. Visual fidelity gate against `reference-assets/touchdesigner-reference.png`
5. Tag `v0.1.0` only after all green

---

## Notes on Scope Discipline

Every task agent MUST refuse to implement anything outside DISCOVERY.md. When in doubt:
1. Re-read DISCOVERY.md §12 (explicit non-goals)
2. Ask the human via state-file note; do NOT silently expand scope

Known temptations to resist:
- Adding a second effect "for testing the registry" — `listEffects()` + unit tests cover that
- Adding a mobile layout "just in case" — deferred explicitly in D3
- Adding a light theme — D12 says dark only
- Running MediaPipe in a worker — D17 says main thread for MVP
- Adding analytics "just for metrics" — D34 says zero telemetry

Ship the reference. Expand later.
