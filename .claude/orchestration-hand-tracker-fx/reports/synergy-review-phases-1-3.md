# Synergy Review — Phases 1, 2, 3

**Date**: 2026-04-14
**Scope**: `tasks/phase-{1,2,3}/*.md` plus `PHASES.md`, `DISCOVERY.md`, skill cross-checks.
**Mode**: Advisory only — no task files were modified.

This review checks data-contract alignment, file-path consistency, dependency graphs,
validation-loop correctness, DISCOVERY alignment, skill coverage, gotcha consistency,
and regression-task coverage across Phases 1–3.

---

## Findings

### 1. CRITICAL — `FrameContext` type is declared in two places

- **Phase/Tasks**: Phase 1 / Task 1.5 vs Phase 2 / Task 2.1 (and downstream 2.5, 3.1, 3.3, 3.4, 3.5)
- **Problem**: Task 1.5 (`task-1-5.md` line ~146, Data Models) creates
  `src/engine/types.ts` exporting `FrameContext`. Task 2.1 (`task-2-1.md` line ~227
  and §Success Criteria) ALSO exports `FrameContext` (and `Landmark`) from
  `src/engine/manifest.ts`. Both task files claim their module is the canonical
  export. Downstream tasks are inconsistent:
  - Task 2.5 (line ~307) imports `FrameContext` from `'../../engine/manifest'`.
  - Task 2.5 (line ~151, 359) says “MODIFY src/engine/types.ts (if exists) OR
    src/engine/manifest.ts” — acknowledges the duplication but doesn't resolve it.
  - Task 3.4 (line ~160) states `types.ts # FrameContext`.
  - Task 1.5 (line ~209) imports `NormalizedLandmark` from `@mediapipe/tasks-vision`
    as `Landmark`'s source; Task 2.1 declares its own standalone `Landmark` type
    `{ x, y, z, visibility? }` — which will *structurally* match but be a
    *nominally different type* from the renderLoop's `NormalizedLandmark[]`.
- **Fix**:
  - Pick ONE canonical location. Recommend `src/engine/types.ts` (created first in
    1.5). Have Task 2.1 `export type { FrameContext, Landmark } from './types'`
    rather than redeclaring.
  - Update Task 2.1 Success Criteria + Data Models + `src/engine/manifest.ts`
    contents to *re-export* instead of redeclare.
  - Add an explicit gotcha in Task 2.1 and Task 1.5 stating the single source of
    truth.
  - Unify `Landmark` as `NormalizedLandmark` from `@mediapipe/tasks-vision` to
    match Task 1.5 and Task 3.3 (which imports `NormalizedLandmark` directly).

### 2. CRITICAL — Grid-function naming mismatch (Phase 2 vs Phase 3)

- **Phase/Tasks**: Task 2.3 (producer) vs Task 3.3, Task 3.4, Phase 3 README (consumers)
- **Problem**:
  - Task 2.3 (`task-2-3.md` lines 16, 54, 75, 163, 290, 297, 311–317) defines
    **`generateColumnWidths(seed, count, variance)`**, **`generateRowWidths(...)`**,
    and **`buildGridLayout(input)`** returning `GridLayout = { columns, rows }`.
    `columns`/`rows` are normalized cumulative breakpoints `[0,1]`.
  - Task 3.3 (`task-3-3.md` line 131) describes `grid.ts` as exporting
    **`computeColumnEdges(seed, count, variance)`**. Task 3.4 (`task-3-4.md`
    lines 105, 165, 318–319) calls **`computeColumnEdges(...)`** and
    **`computeRowEdges(rowCount)`**.
  - Phase 3 README line 10 names `computeColumnEdges`/`computeRowEdges`.
  - Task 2.5 (line 403) calls `buildGridLayout(snap.grid)` producing
    `layout.columns` and `layout.rows`.
  - **Net**: Task 3.3/3.4 will fail `pnpm tsc` — the imports don't exist.
- **Fix**: Task 3.3 and Task 3.4 (and Phase 3 README line 10) must be rewritten
  to import `generateColumnWidths`/`generateRowWidths` (or, better, just consume
  `buildGridLayout({ seed, columnCount, rowCount, widthVariance }).columns/rows`).
  OR: rename in Task 2.3 to `computeColumnEdges`/`computeRowEdges`. Pick one and
  propagate. Current state is a guaranteed L1 failure at Task 3.3 execution.

### 3. CRITICAL — WebGL canvas test-id / selector mismatch across three tasks

- **Phase/Tasks**: Task 1.6 (producer) vs Task 2.3, 2.4, 2.R, 3.1, 3.5, 3.R (consumers)
- **Problem**: three incompatible conventions coexist.
  - Task 1.6 (lines 49, 74, 312, 317) ships the canvases with:
    - `data-testid="webgl-canvas"`
    - `data-testid="overlay-canvas"`
    - `data-testid="stage-video"`
    - `data-testid="stage"`
  - Task 3.1 (line 265), Task 3.5 (lines 78, 340, 348), Task 3.R (lines 364, 370,
    482, 562), and Task 2.R (lines 71, 540, 725) all use
    `document.querySelector('canvas[data-role="webgl"]')` — an attribute Task 1.6
    never adds.
  - Task 2.3 (line 437) and Task 2.4 (line 232) reference
    `data-testid="stage-2d-canvas"` — never produced by Task 1.6.
- **Fix**: Add `data-role="webgl"` + `data-testid="stage-2d-canvas"` to Task 1.6's
  Stage.tsx JSX (alongside the existing `data-testid="webgl-canvas"` /
  `data-testid="overlay-canvas"`). Decide on a single selector convention and
  update ALL downstream tasks (2.R, 2.3, 2.4, 3.1, 3.5, 3.R) to use it.
  Recommend: keep `data-testid="webgl-canvas"` + `data-testid="overlay-canvas"`
  (already in Task 1.6 implementation blueprint), retire `data-role="webgl"` and
  `stage-2d-canvas`. Update all 6 downstream specs accordingly.

### 4. CRITICAL — `EffectManifest.create()` signature changes mid-plan

- **Phase/Tasks**: Task 2.1 (types) / Task 2.5 (consumer) / Task 3.4 (mutator)
- **Problem**:
  - Task 2.1 (lines 312–329) defines
    `create(gl: WebGL2RenderingContext): EffectInstance`.
  - Task 2.5 (line 391) matches: `create(gl): EffectInstance`.
  - Task 3.4 (lines 303–356) silently changes to
    `create(gl: WebGL2RenderingContext, deps: MosaicRenderDeps): EffectInstance`
    where `MosaicRenderDeps = { renderer: Renderer; texture: Texture }`. Task 3.4
    Task 4 says "MODIFY src/engine/manifest.ts" to change the generic signature
    — but Task 2.1 (the authority) does NOT anticipate this, and Task 2.5's
    `satisfies EffectManifest<HandTrackingMosaicParams>` literal will break the
    moment Task 3.4 adds the mandatory `deps` parameter to the interface.
- **Fix**: Either:
  - (a) Land the `RenderDeps` parameter in Task 2.1 up front (add to manifest.ts
    types now, stub it in Task 2.5's `create`), or
  - (b) Make `deps` optional and source the renderer/texture through a
    `FrameContext.videoTexture` + a module ref for the Renderer (preferred — keeps
    D36 accurate and avoids a breaking change).
  - Update Task 2.1 Data Models and Task 3.4 Task 4 to be consistent.

### 5. HIGH — `main.tsx` path ambiguity (`src/main.tsx` vs `src/app/main.tsx`)

- **Phase/Tasks**: Phase 1 (1.1, 1.2, 1.5, 1.R), Phase 2 (2.2, 2.5), Phase 3
  (3.1), Phase 4 / 5 also affected.
- **Problem**:
  - Phase 1 task files universally reference `src/main.tsx` (1.1 line 147,
    1.2 lines 92/149/456, 1.5 line 137, 1.R line 162).
  - Phase 2 Task 2.5 is split: line 146 says "src/main.tsx (or src/app/main.tsx
    if scaffold differs)"; lines 19, 104, 605 say `src/app/main.tsx`. Task 2.5
    Task 5 (line 545) says "MODIFY src/main.tsx" — inconsistent within the same
    file.
  - Phase 3 Task 3.1 (line 132) says `app/ main.tsx`; Phase 4 Task 4.3 and 4.R
    use `src/app/main.tsx`.
- **Fix**: Confirm the actual scaffold layout (Phase 5 tool-verification report
  likely pinned it). Replace every task-file reference with the correct single
  path. Given git status shows no `src/app/`, the true path is almost certainly
  `src/main.tsx`; update Phase 2/3/4/5 task files to match. Add a one-line
  gotcha in each: "Scaffold uses `src/main.tsx` (flat, no `app/` subfolder)."

### 6. HIGH — Task 1.5 adds `<video>` in App.tsx, Task 1.6 replaces; but Task 1.5's render-loop useEffect has no cleanup path for Task 1.6 re-wiring

- **Phase/Tasks**: Task 1.5 → Task 1.6
- **Problem**: Task 1.5 Task 6 (line 456–461) says to render a hidden `<video>`
  inline in `App.tsx` and start `startRenderLoop` via `useEffect`. Task 1.6 then
  tells the agent to REPLACE that with `<Stage>` — but Task 1.6 Task 4 (line 376)
  says to "update the useEffect to read videoEl from `stageRef.current?.videoEl`"
  and notes: "The render-loop useEffect now depends on stageRef.current?.videoEl
  being present — use a useState or polling or onVideoReady callback". This
  guidance is vague enough to produce a race: Stage mounts, render loop useEffect
  fires before `stageRef.current.videoEl` is populated (StrictMode or not).
- **Fix**: Specify one concrete pattern. Recommend: make `Stage` accept an
  `onVideoReady?: (el: HTMLVideoElement) => void` prop invoked in its
  `useEffect` after `video.play()` succeeds; wire `startRenderLoop` from App.tsx
  inside that callback. Document in Task 1.6 Known Gotchas.

### 7. HIGH — `ctx2d` in `FrameContext` is added in Task 2.5 but never populated by the render loop

- **Phase/Tasks**: Task 1.5 (FrameContext producer), Task 2.5 (consumer)
- **Problem**: Task 2.5 (lines 253, 398, 409, 587) extends `FrameContext` with
  `ctx2d?: CanvasRenderingContext2D | null` and its `create(gl).render(ctx)` does
  `const ctx2d = frameCtx.ctx2d ?? null; if (!ctx2d) return`. But Task 1.5's
  `renderLoop.ts` constructs the `FrameContext` with
  `{ videoTexture: null, videoSize, landmarks, params: {}, timeMs }` — no
  `ctx2d` field ever assigned. No task wires the overlay canvas's `getContext('2d')`
  output into the per-frame context, so Task 2.5's render() will early-return on
  every frame and the grid/blob overlay will never draw, making Task 2.R fail.
- **Fix**: Task 2.5 must include a step that modifies `startRenderLoop` (or
  adds a new param) to accept the overlay canvas's 2D ctx and include it in the
  `FrameContext`. OR: redesign so the effect reads the overlay ctx via a
  module-scoped ref populated by `Stage.tsx`. Either way, document it
  explicitly — currently nobody populates the field.

### 8. HIGH — Task 3.4 assumes `preserveDrawingBuffer` is set on the ogl Renderer; Task 1.6's `<canvas>` doesn't use the ogl Renderer yet

- **Phase/Tasks**: Task 1.6 → Task 3.1 → Task 3.4
- **Problem**: Task 1.6 Acceptance Criteria mention "WebGL context
  `preserveDrawingBuffer: true` (needed for MediaRecorder in Phase 4)" but the
  Stage.tsx implementation blueprint in Task 1.6 (Task 2, line ~242) never
  actually creates a WebGL context — it just renders an empty `<canvas>`. The
  "preserveDrawingBuffer" promise is therefore carried forward to Task 3.1's
  `createOglRenderer`, which DOES set it (line 231). Fine in practice, but the
  Task 1.6 Final Validation Checklist bullet "preserveDrawingBuffer: true ready
  for Phase 3" is testable only once Phase 3 lands — an agent executing 1.6 in
  isolation cannot verify it and may waste iterations.
- **Fix**: Remove the `preserveDrawingBuffer` bullet from Task 1.6 validation
  (defer to Task 3.1). Keep the anticipatory comment in the Task 1.6 "Why"
  section only.

### 9. HIGH — `grid.randomize` button: `ParamDef` variant vs onClick signature drift

- **Phase/Tasks**: Task 2.1 (types) / Task 2.5 (consumer)
- **Problem**: Task 2.1 (line 290–293) defines the `button` variant as
  `onClick: (allParams: Record<string, unknown>) => void`. Task 2.5 (line 242,
  430, 507) demonstrates `onClick: () => { paramStore.set('grid.seed', rand) }`
  — no args; closure-over-paramStore instead. Test in 2.5 (line 508) calls
  `rand.onClick(paramStore.snapshot as any)`. The signature still lines up
  (caller passes a snapshot, onClick ignores it), but Task 2.5 Known Gotcha (line
  237) says: "it cannot take snapshot as an argument and mutate — that produces
  no-op because snapshot is read-only". Confusing: the type does accept a
  snapshot, the onClick just shouldn't mutate it.
- **Fix**: Clarify the contract in Task 2.1 JSDoc: "`allParams` is a read-only
  snapshot; mutation is a no-op — use `paramStore.set()` to write." Then clean
  up Task 2.5's gotcha language.

### 10. HIGH — Dev hook `window.__handTracker` surface is defined across 6+ tasks with inconsistent API names

- **Phase/Tasks**: 1.4, 1.5, 2.1 (proposed), 2.2, 2.3, 2.4, 2.5, 3.1, 3.3, 3.4,
  3.5, 2.R, 3.R
- **Problem**: The `window.__handTracker` namespace accumulates ad-hoc fields
  across phases and the names don't all match:
  - Task 1.4: `isReady()`, `isUsingGpu()`
  - Task 1.5: `getFPS()`, `getLandmarkCount()`
  - Task 2.1: proposes `__engine.listEffects()` (line 455)
  - Task 2.4: `getLandmarkBlobCount()`
  - Task 2.5: `__engine.{listEffects, getParam, getLandmarkBlobCount, lastGridLayout}`
  - Task 3.1: `getVideoTextureHandle()`
  - Task 3.3: `setFakeLandmarks(lms)`, `computeActiveRegions()`
  - Task 3.4: `getLastRegionCount()`
  - Task 3.5: `forceContextLoss()`, `forceContextRestore()`
  - Task 2.R: `setParam(dotPath, value)` (not defined in any Phase 2 task)
  - Task 3.R: "test IDs ... `stage-ready`, `landmark-blob`, `landmark-label` —
    present in the Phase 1/2 components (add if missing)" — none exist yet.
- **Fix**: Add a dedicated subsection to the `hand-tracker-fx-architecture` skill
  (or PHASES.md) enumerating the full dev-hook contract with signatures. Each
  task adding a hook references it there. Task 2.2's note about "a dev hook"
  should be resolved before 2.R runs (2.R expects `setParam` but no task adds
  it). Add `setParam` to Task 2.5 Task 7 devHooks modification.

### 11. HIGH — Task 1.6 Stage `forwardRef` + Task 3.1 / 3.5 Stage.tsx modifications: ownership of renderer lifecycle

- **Phase/Tasks**: Task 1.6 (Stage shape) → Task 3.1 / 3.4 / 3.5 (Stage modifications)
- **Problem**: Task 1.6 Stage exposes `StageHandle = { videoEl, webglCanvas,
  overlayCanvas }`. Task 3.1 Task 4 says "MODIFY src/ui/Stage.tsx" to call
  `createOglRenderer(canvasRef.current) + createVideoTexture(gl)` inside
  Stage's useEffect. Task 3.5 then piles on more Stage.tsx modifications
  (bootstrap closure, context-loss handlers, disposeRenderer). But Task 1.6's
  component is minimal — it has a DPR-resize effect but no renderer ownership
  hook. Each subsequent task's "FIND: useEffect inside Stage" instruction
  relies on surgery that the previous task specified informally. The cumulative
  Stage.tsx is underspecified — agents will diverge.
- **Fix**: Add a "Stage.tsx evolution" section to the Phase 3 README or the
  `hand-tracker-fx-architecture` skill showing the final file after 1.6 / 3.1 /
  3.4 / 3.5, so each task's "FIND" anchors are stable. Alternatively, have
  Stage.tsx expose an `onWebGLReady(canvas) => () => void` callback prop so the
  renderer lifetime lives in App.tsx, not inside Stage.

### 12. HIGH — Task 3.3's `MAX_REGIONS` imported from `./shader` → hard dep on Task 3.2 but Task 3.3's "Blocked by" claims atomic

- **Phase/Tasks**: Task 3.3
- **Problem**: Task 3.3 Data Models (line 202) does
  `import { MAX_REGIONS } from './shader'`, Gotcha (line 190) explicitly forbids
  hard-coding 96. But Task 3.3 "No Prior Knowledge Test" (line 537) says "task is
  atomic — does not require renderer (3.1), render wire-up (3.4), or context
  loss (3.5)" — silent on 3.2. PHASES.md shows 3.3 depends on 3.2 (3.3 says
  "Dependencies: 3.2, 2.3"). The task file itself should mention 3.2 explicitly
  as a Blocked-by.
- **Fix**: Add 3.2 to Task 3.3's Dependencies/Blocked-by. Low-impact but
  eliminates confusion for parallel execution.

### 13. MEDIUM — Task 1.2 E2E describe mismatch with Task 1.1's convention

- **Phase/Tasks**: Task 1.2
- **Problem**: Task 1.1 (line 290) establishes `describe('Task 1.1: smoke', ...)`
  as the canonical describe. Task 1.2 (line 334) uses
  `describe('Task 1.2: useCamera', ...)`. Task 1.2 filename (line 167) is
  `tests/e2e/useCamera.spec.ts` but Task 1.R (line 104) asserts file names
  `usecamera.spec.ts` (lowercase). Minor, but the regression grep should still
  pick it up since Playwright matches by describe title not filename.
- **Fix**: Pick a single filename casing convention and update Task 1.R. Not
  execution-blocking.

### 14. MEDIUM — Task 1.5's `--mode test` vite hack vs Task 1.R/2.R's `VITE_DEV_HOOKS=1` env var

- **Phase/Tasks**: Task 1.5 → Task 2.R
- **Problem**: Task 1.5 Task 3 (line 290) modifies `playwright.config.ts`
  webServer command to `pnpm build --mode test && pnpm preview` so
  `import.meta.env.MODE === 'test'` exposes the dev hook. Task 2.R (lines 155,
  293) assumes a different mechanism: `VITE_DEV_HOOKS=1` env var gated inside
  `devHooks.ts`. These are two independent mechanisms; whichever is implemented
  first wins and the other task's assumption breaks.
- **Fix**: Standardize on one. Recommend: keep `import.meta.env.MODE === 'test'`
  as Task 1.5 set up, drop `VITE_DEV_HOOKS` from Task 2.R (update its env var
  reference and the `devHooks.ts` gotcha). Backport the clarification to
  Task 2.5 Task 7 (devHooks modification).

### 15. MEDIUM — `Landmark[]` vs `NormalizedLandmark[]` naming drift

- **Phase/Tasks**: Task 2.1 / Task 2.4 / Task 3.3 / Task 1.5
- **Problem**:
  - Task 2.1 exports a local `Landmark = { x, y, z, visibility? }` (line 216).
  - Task 2.4 (line 246) imports `Landmark` from `'../../engine/manifest'`.
  - Task 1.5 (line 210) uses `NormalizedLandmark` from `@mediapipe/tasks-vision`
    and declares `landmarks: NormalizedLandmark[] | null`.
  - Task 3.3 (line 201) uses `NormalizedLandmark` too.
  - Structurally identical but nominally different types — `Landmark[]` and
    `NormalizedLandmark[]` will be assignable via structural typing in strict
    TS, but the two names confuse readers and will break if MediaPipe adds a
    required field.
- **Fix**: Pick one. Recommend: `type Landmark = NormalizedLandmark` (re-export)
  in `src/engine/types.ts`, and use `Landmark` everywhere. Update Task 2.1 to
  import from MediaPipe rather than redeclare. Also resolves Finding #1.

### 16. MEDIUM — `buildGridLayout` produces cumulative breakpoints of length `count`; Task 3.3 expects edges of length `count + 1`

- **Phase/Tasks**: Task 2.3 / Task 3.3 / Task 3.4
- **Problem**:
  - Task 2.3 (line 225–230) says `GridLayout.columns` is length
    `= columnCount`, with last element `=== 1.0`. Breakpoints are the *right
    edge* of each cell, cumulative.
  - Task 3.3 (line 346) documents `columnEdges: readonly number[]` with
    "`length = columnCount + 1` (monotonically increasing)". So Task 3.3 expects
    `[0, x1, x2, …, 1]` — includes the LEFT edge at 0.
  - Task 3.4 (line 324) does `gridCache.colEdgesNorm.map(v => v * videoW)` and
    passes to `computeActiveRegions` — but if `colEdgesNorm` is Task 2.3's
    length-`count` breakpoints, `computeActiveRegions` will treat the first
    entry as `colA=breakpoint[0]` (≈ 1/count, not 0) and misclassify the first
    column.
- **Fix**: Either (a) change Task 2.3's output to include the leading 0, or
  (b) document in Task 3.4 that the caller must prepend 0 before passing edges
  to `computeActiveRegions`. Recommend (a) — it's the more intuitive shape and
  downstream code cleans up.

### 17. MEDIUM — Task 2.3 `gridRenderer` expects `target.width/height` in LOGICAL pixels but Task 2.5 passes `frameCtx.videoSize.w/h`

- **Phase/Tasks**: Task 2.3 / Task 2.5
- **Problem**: Task 2.3 Known Gotcha (line 205) says the renderer consumes
  "logical pixel dimensions (width/height), not physical — Stage has already
  applied the transform". Task 2.5 render() (line 405) calls
  `drawGrid(ctx2d, layout, { width: w, height: h }, ...)` where `w`/`h` come
  from `frameCtx.videoSize.w/h` — the *video* pixel dimensions (e.g.
  640×480), not the canvas dimensions. Those are different coordinates.
- **Fix**: Either pass the canvas's DPR-less client dimensions, or change
  Task 2.3's contract to "video space". Document explicitly in Task 2.3 which
  space the params are in and align Task 2.5's call site. Also applies to
  Task 2.4 blobRenderer's `BlobRenderTarget`.

### 18. MEDIUM — Task 2.5 `create(gl)` clears WebGL canvas but never resizes the gl viewport

- **Phase/Tasks**: Task 2.5
- **Problem**: Task 2.5 render (line 395–397) calls
  `gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT)` without first calling
  `gl.viewport(...)`. In Phase 2, Stage.tsx resizes the canvas via CSS + DPR
  (Task 1.6 resize effect), but no one calls `gl.viewport` on the raw WebGL
  context. The clear will succeed but only cover the default 300×150 viewport
  until Phase 3 wires OGL. Cosmetic for Phase 2 (the 2D overlay hides it), but
  worth noting.
- **Fix**: Add a one-liner in Task 2.5 render: `gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)` before clear. Or defer the WebGL
  clear to Phase 3 (remove from 2.5).

### 19. MEDIUM — `--grep "Task 1\\."` doesn't match Task 1.R's describe `"Task 1.R:"`

- **Phase/Tasks**: Task 1.R
- **Problem**: Task 1.R (line 17) runs `--grep "Task 1\\."` which matches
  describes starting with `Task 1.` (dot literal). `Task 1.R:` matches. But
  Task 1.R Success Criteria (line 75) says "passes 6/6 specs (1.1, 1.2, 1.3,
  1.4, 1.5, 1.6) with zero skips" — doesn't mention running 1.R itself, which
  is fine. However, the grep regex will also include any future Phase 11.x spec
  (if the project ever grew beyond 10 phases). Low risk.
- **Fix**: Non-blocking. Could tighten to `^Task 1\.[1-6R]` if desired.

### 20. MEDIUM — Task 2.R references `landmark-label` / `landmark-blob` data-testids that Task 2.4 doesn't produce

- **Phase/Tasks**: Task 2.4 vs Task 2.R / Task 3.R
- **Problem**:
  - Task 2.4 Known Gotchas (line 230–234) explicitly says: "Since blobs are
    drawn to a Canvas (no DOM elements per blob), the test-id lives on the
    CANVAS element".
  - Task 2.R checklist #8 (line 88) says "at least one `data-testid="landmark-label"`
    element (or dev-hook-returned label string) matches `/^x: \d\.\d{3} {2}y:
    \d\.\d{3}$/`".
  - Task 3.R (line 562) lists `landmark-blob` and `landmark-label` as "Test IDs
    present in the Phase 1/2 components (add if missing)".
- **Fix**: Reconcile. Either drop the data-testid expectations from 2.R/3.R
  and rely on a dev hook (`__handTracker.getLandmarkLabels()`), OR add a step
  in Task 2.4 to maintain a parallel DOM list. Recommend: dev hook —
  `__handTracker.getLastBlobLabels(): string[]` — add to Task 2.5 Task 7.

### 21. MEDIUM — `Stage.css` mirror-transform target inconsistent with Task 1.6 Data Models

- **Phase/Tasks**: Task 1.6
- **Problem**: Task 1.6 Task 1 (line 231–238) CSS puts the mirror transform
  on `.stage[data-mirror="true"] .stage-canvas` (both canvases). "Feature Goal"
  (line 13) says "CSS `scaleX(-1)` applied to the display canvases". Fine.
  But Known Gotcha (line 239) then says: "transform must apply to the canvases,
  not the wrapper itself (otherwise the video's hidden pixel also mirrors,
  irrelevant but messy)". This is contradicted by the User Journey (line 31):
  "display canvases get `transform: scaleX(-1)`" and the Task 2.4 blobRenderer
  gotcha (line 198–209) which says labels must be un-mirrored inside the
  canvas when `opts.mirror=true`. The un-mirror counter-transform is necessary
  ONLY IF the 2D canvas itself inherits `scaleX(-1)`. Confirmed consistent, but
  verbose.
- **Fix**: Non-blocking. Small clarification in Task 2.4's gotcha pointing to
  Task 1.6 Stage.css as the exact CSS rule would help.

### 22. MEDIUM — Task 3.R and 2.R reference `stage-ready` testid that no task creates

- **Phase/Tasks**: Task 2.R / Task 3.R
- **Problem**: Task 3.R line 562 lists `stage-ready` as a test-id expected to
  be "present in the Phase 1/2 components". Task 1.6 Stage.tsx produces only
  `data-testid="stage"`, `stage-video`, `webgl-canvas`, `overlay-canvas`.
  `stage-ready` is never created.
- **Fix**: Either add to Task 1.6 (a boolean attribute that flips once video
  srcObject is attached and play() resolves), or drop the expectation from the
  regression tasks. Recommend adding — Task 2.R's waitForFunction-style waits
  will be sturdier.

### 23. LOW — Task 1.3 changes App.tsx structure; Task 1.4's E2E still checks `camera-state` testid

- **Phase/Tasks**: Task 1.3 / Task 1.4
- **Problem**: Task 1.3 Task 6 moves the `data-testid="camera-state"` to
  `style={{ position: 'absolute', left: -9999 }}`. Task 1.4 E2E (line 420)
  does `page.getByTestId('camera-state')`. Should still work (off-screen not
  removed), but `toHaveText` may trigger visibility checks in some Playwright
  versions. Minor risk.
- **Fix**: Use `.toHaveText()` (doesn't require visibility) instead of
  `expect(el).toBeVisible()`. Already uses `.toHaveText`, so OK. No change
  needed; documentation only.

### 24. LOW — Task 1.1 CLAUDE.md creation references "START.md" which does not exist in orchestration

- **Phase/Tasks**: Task 1.1
- **Problem**: Task 1.1 Task 1 (line 223) says the root CLAUDE.md's
  "Quick Reference" table should list `START.md`. No `START.md` exists under
  `.claude/orchestration-hand-tracker-fx/` (check: only DISCOVERY.md, PHASES.md,
  PRD.md, tasks/, reports/, reference-assets/, research/, skills/).
- **Fix**: Drop the `START.md` row or replace with PHASES.md / PRD.md.

### 25. LOW — Skills listed in Task 1.3, 1.4, 1.5 don't include `playwright-e2e-webcam` even though they ship L4 specs

- **Phase/Tasks**: 1.3, 1.4, 1.5
- **Problem**: Each ships an L4 Playwright spec but "Skills to Read Before
  Starting" omits `playwright-e2e-webcam` on 1.3 (it's listed on 1.4, 1.5, so
  the pattern is inconsistent).
  - 1.3: lists `webcam-permissions-state-machine`, `vitest-unit-testing-patterns`,
    `prp-task-ralph-loop`, `hand-tracker-fx-architecture` — no playwright skill.
  - 1.4: lists `prp-task-ralph-loop`, `hand-tracker-fx-architecture`,
    `mediapipe-hand-landmarker`, `vitest-unit-testing-patterns` — no playwright.
  - 1.5: lists `prp-task-ralph-loop`, `hand-tracker-fx-architecture`,
    `mediapipe-hand-landmarker`, `playwright-e2e-webcam`, `vitest-…` — has it.
- **Fix**: Add `playwright-e2e-webcam` to 1.3 and 1.4 Skills-to-Read blocks.

### 26. LOW — Task 2.1 Data Models comment imports `NormalizedLandmark` but the module declares its own `Landmark`

- **Phase/Tasks**: Task 2.1
- **Problem**: Task 2.1 line 216 declares `Landmark` locally. Nothing in the
  file actually imports MediaPipe. But "Integration" claims the type "matches
  what `tracking/handLandmarker.ts` produces" (line 46). It matches structurally
  only if MediaPipe's shape doesn't evolve.
- **Fix**: Same as Finding #15 — resolve by re-exporting `NormalizedLandmark`.

### 27. LOW — Task 2.R's `VITE_DEV_HOOKS=1` env-var gate is undefined anywhere; conflicts with Finding #14

- **Phase/Tasks**: 2.R
- **Fix**: See Finding #14.

### 28. LOW — Task 2.3 L4 E2E expects `window.__handTracker?.__engine?.lastGridLayout` but spec is marked `describe.skip` if absent

- **Phase/Tasks**: 2.3
- **Problem**: Task 2.3 L4 (line 439) wraps its grep-sensitive spec in
  `test.describe.skip` when the hook is missing. Running with
  `--grep "Task 2.3:"` will exit 0 with a skipped test, which looks identical
  to green. A Ralph agent will happily emit COMPLETE.
- **Fix**: Reword L4 to assert the hook exists at least (dev hook registration
  is Task 2.5's responsibility and lands before Task 2.3 cannot exit). OR
  rewrite Task 2.3 L4 to be a true unit test of gridRenderer output via a
  canvas snapshot / `toDataURL` diff.

### 29. LOW — Task 1.2 `useCamera.ts` return type `stream: MediaStream | null` in "What" but JSDoc in hook says "streamRef.current is the source of truth"

- **Phase/Tasks**: Task 1.2
- **Problem**: Task 1.2 line 243 declares `stream: MediaStream | null` in
  `UseCameraResult`. But the implementation (line 288–296) keeps the stream in
  a ref. Returning `streamRef.current` on every render is fine but won't
  trigger React re-renders when the stream becomes available (because the
  return value comes from a ref, not state). Consumers (Task 1.6 Stage) that
  render conditionally on `stream !== null` will not re-render when the stream
  appears.
- **Fix**: Either mirror the stream into a `useState<MediaStream | null>` (the
  known-bad pattern warned against in gotchas) OR have consumers subscribe to
  the `state === 'GRANTED'` transition instead of the stream identity. Task 1.6
  (line 381) does `streamRef.current` — same issue. Clarify in Task 1.2 that
  consumers should key off `state`, not `stream`.

### 30. LOW — `createOglRenderer` throws `WebGLUnavailableError` but `NO_WEBGL` transition path is unspecified

- **Phase/Tasks**: Task 3.1
- **Problem**: Task 3.1 Anti-Patterns (line 360) says "throw `WebGLUnavailableError`
  (reuse from `src/tracking/errors.ts`)". Task 1.4 defines the error class.
  Task 3.1 doesn't specify who catches it or how `cameraState` transitions to
  `NO_WEBGL`. The 8-state machine only maps getUserMedia errors.
- **Fix**: Add a paragraph in Task 3.1 (or the webcam-permissions-state-machine
  skill) explaining: Stage.tsx catches the throw in its useEffect, calls a
  new `setWebGLError()` prop from useCamera, which transitions state to
  `NO_WEBGL`. Or bake a `useTracker` hook in Task 1.4 that owns the transition.

---

## What Passes

Despite the above, many high-risk boundaries ARE correctly aligned:

- DISCOVERY.md D-number coverage in each task is thorough; every task cites the
  D-numbers it implements.
- `FINGERTIP_INDICES = [4, 8, 12, 16, 20]` is consistent between Task 2.4 and
  Task 3.3's `POLY_LANDMARK_INDICES = [0, 4, 8, 12, 16, 20]` (the latter adds
  wrist, as per D5). No drift.
- `MAX_REGIONS = 96` is a single source of truth in Task 3.2 and consumed
  correctly by 3.3 and 3.4.
- Mirror semantics (D27): consistently stated across 1.2 / 1.6 / 2.4 / 3.3 /
  every shader-related task. The un-mirror counter-transform in Task 2.4 for
  labels is correctly motivated.
- Each task's `describe` prefix follows `Task N.M:` (`^Task \d+\.(\d+|R):`).
- Every task's "Skills to Read" references skills that actually exist at
  `.claude/skills/<name>/SKILL.md` (cross-checked against `ls .claude/skills/`:
  all 9 referenced skills are present; no phantom skill).
- Mulberry32 + `Math.imul` requirement (Task 2.3), rVFC + monotonic timestamps
  (Task 1.5), `preserveDrawingBuffer: true` (Task 3.1 → Phase 4 recording),
  `#version 300 es` at byte 0 (Task 3.2) — all gotchas are consistent across
  places they're cited.
- Preset schema (D29) is untouched by Phases 1–3 (Phase 4 territory) — no
  leakage.
- Phase-regression tasks (1.R, 2.R, 3.R) cover:
  - 1.R: all L1–L4 for tasks 1.1–1.6 + MCP walkthrough + headers + zero console
    errors. Comprehensive.
  - 2.R: panel, grid, blobs, effect registration, defaults — covers 2.1–2.5.
    Light on **what happens when dev hooks aren't in place** (see #14).
  - 3.R: visual fidelity gate against reference screenshot; covers 3.1–3.5.
    Assumes dev hooks from 2.5 / 3.4 / 3.5 are wired (`getLastRegionCount`,
    `setFakeLandmarks`, etc.) — if Finding #10 is fixed this is fine.

---

## Summary

### Severity Counts

| Severity | Count |
|---|---|
| CRITICAL | 4 |
| HIGH | 7 |
| MEDIUM | 11 |
| LOW | 8 |
| **TOTAL** | **30** |

### Top-5 Most Impactful Fixes

1. **Resolve `FrameContext` and `Landmark` duplication (Finding #1, #15).**
   Pick `src/engine/types.ts` as the single canonical location. Have Task 2.1
   re-export from there. Use `NormalizedLandmark` as the canonical landmark
   type. Prevents a first-hour L1 failure on Task 2.1.

2. **Rename grid functions so Task 2.3's output matches Task 3.3/3.4's imports
   (Finding #2).** Either rename in 2.3 or update 3.3/3.4 — but without a fix,
   Task 3.3 and 3.4 fail `pnpm tsc` on first run. Also resolve the edge-count
   discrepancy (Finding #16).

3. **Standardize WebGL/overlay canvas selectors (Finding #3).** Add
   `data-role="webgl"` (or remove it everywhere) and `data-testid="stage-2d-canvas"`
   to Task 1.6. Without this, Task 2.R / 2.3 / 2.4 / 3.1 / 3.5 / 3.R all fail
   their L4 assertions.

4. **Commit to one `create(gl[, deps])` signature up front (Finding #4).**
   Either add `deps` to `EffectManifest` in Task 2.1, or redesign via
   `FrameContext` and a renderer singleton. The current plan has Task 3.4
   silently change a type that Task 2.5's `satisfies` clause locks in — breaking
   change mid-plan.

5. **Populate `FrameContext.ctx2d` in the render loop (Finding #7) and
   consolidate the dev-hook surface (Finding #10).** Task 2.5's render
   early-returns on every frame today, making 2.R's blob/grid assertions fail.
   Simultaneously, document the full `window.__handTracker` contract in
   `hand-tracker-fx-architecture/SKILL.md` so every task mentions the same
   hook names (`setParam`, `getLastRegionCount`, `setFakeLandmarks`, etc.).

---

End of advisory report.
