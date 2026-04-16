---
iteration: 1
max_iterations: 20
plan_path: ".claude/orchestration-hand-tracker-fx/tasks/phase-2/task-2-R.md"
input_type: "plan"
started_at: "2026-04-15T16:00:00.000Z"
---

# PRP Ralph Loop State — Task 2.R

## Codebase Patterns

- Dev hooks live on `window.__handTracker.__engine.*` (nested), NOT flat. Shape: `{ listEffects, getParam, setParam, getLandmarkBlobCount, lastGridLayout }`. Flat on `__handTracker`: `{ getFPS, getLandmarkCount, isReady, isUsingGpu }`. When writing an E2E spec, read/write via `window.__handTracker.__engine.*` — don't invent a flatter shape.
- `__getLastGridLayout()` returns a function value, not a property. Spec must call `window.__handTracker.__engine.lastGridLayout()` (the function reference is stored on the hook). Same for `getLandmarkBlobCount`.
- Dev-hook gate in `src/engine/devHooks.ts`: `import.meta.env.DEV || MODE === 'test' || VITE_EXPOSE_DEV_HOOK === '1'`. Playwright webServer already runs `pnpm build --mode test && pnpm preview` so hooks expose with zero env-var ceremony. The `VITE_DEV_HOOKS=1` pattern mentioned in task-2-R.md is NOT implemented — per synergy-review finding #14/#27 the resolution is to use `MODE === 'test'` instead. Task file is stale on this point.
- Stage.tsx data-testids: `stage`, `render-canvas`, `stage-video`, `webgl-canvas`, `overlay-canvas`. Panel.tsx uses `params-panel`. NO `tweakpane-root` exists — task file is stale.
- `setFakeLandmarks` is a Task-3.3-scoped dev hook per architecture skill; NOT yet implemented. Task 2.R spec requires it for the "blob count = 5 on injected landmarks" test (checklist row 7). Resolution: add minimal hotfix on this branch as a separate commit with `Task 2.R (hotfix):` prefix — wires a landmark override ref into startRenderLoop + exposes `setFakeLandmarks` on `__engine`.
- Render loop lives in `src/engine/renderLoop.ts` (via `startRenderLoop`), App.tsx owns its lifetime per StrictMode contract. For fake landmark injection, place the override ref inside renderLoop module (module-scoped), consulted per-frame before MediaPipe detection runs.
- Playwright config reads `PLAYWRIGHT_BASE_URL`; if set, webServer is skipped. For the regression, simpler to rely on the committed webServer (runs `pnpm build --mode test && pnpm preview` automatically).

## Current Task

Execute task file `task-2-R.md` and iterate until all 4 validation levels exit 0 against the pnpm preview production build.

## Plan Reference

.claude/orchestration-hand-tracker-fx/tasks/phase-2/task-2-R.md

## Instructions

1. Preflight: verify every Phase 2 artifact exists; regenerate fake-hand.y4m if missing.
2. Hotfix commit: add setFakeLandmarks to devHooks.ts + render-loop injection. Test-gated. Separate commit.
3. Write phase-2-regression.spec.ts targeting the ACTUAL dev-hook shape (not the task file's aspirational flat shape). Describe title: `Task 2.R: Phase 2 regression — engine + overlay`.
4. Run L1 → L2 → L3 → L4. Use playwright's committed webServer; do NOT set `VITE_DEV_HOOKS=1`.
5. Fix any failures at source; update this Progress Log.
6. Write reports/phase-2-regression.md with validation matrix + checklist + SHIP decision.
7. Commit `Task 2.R: ...` and emit `<promise>COMPLETE</promise>`.

## Progress Log

## Iteration 1 — 2026-04-15T16:00:00.000Z

### Completed this iteration
- Initial orientation: read task-2-R.md, devHooks.ts, App.tsx, manifest.ts, playwright.config.ts, package.json, Stage.tsx testids.
- Identified 3 drifts between task file and reality (see Codebase Patterns above).
- Decision: Option A — hotfix setFakeLandmarks as a separate commit on this branch, adapt spec to actual shape, drop VITE_DEV_HOOKS requirement.
- Created TaskList with 5 items (preflight, hotfix, spec, L1-L4, report+commit).

### Validation Status
- L1 Biome: not yet run
- L1 tsc: not yet run
- L2 Vitest: not yet run
- L3 Build: not yet run
- L4 E2E: not yet run

### Learnings
- Task-2-R.md is stale on 3 points (dev-hook shape, VITE_DEV_HOOKS env var, setFakeLandmarks availability). Adapt the spec to reality instead of working around — task file itself acknowledges "if missing, open hotfix."
- Synergy-review findings #14 and #27 pre-identified the VITE_DEV_HOOKS drift; fix is to drop it.

### Next Steps
- Preflight (ls + pnpm test:setup if needed).
- Write hotfix commit for setFakeLandmarks.

---
