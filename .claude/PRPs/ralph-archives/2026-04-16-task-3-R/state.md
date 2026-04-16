---
iteration: 1
max_iterations: 30
plan_path: ".claude/orchestration-hand-tracker-fx/tasks/phase-3/task-3-R.md"
input_type: "plan"
started_at: "2026-04-16T05:00:00.000Z"
---

# PRP Ralph Loop State — Task 3.R

## Codebase Patterns
- Dev-hook shape: `window.__handTracker.{getFPS, getLandmarkCount}` flat; `__handTracker.__engine.{listEffects, getParam, setParam, getLandmarkBlobCount, lastGridLayout, setFakeLandmarks, getVideoTextureHandle, testCompileShaders, computeActiveRegions, getLastRegionCount, forceContextLoss, forceContextRestore}` nested.
- `lastGridLayout()` returns `{columns: number[], rows: number[]}` — breakpoints (not widths). Widths = diffs between consecutive breakpoints.
- `VITE_DEV_HOOKS` is NOT implemented. Playwright webServer runs `pnpm build --mode test && pnpm preview` which bakes in MODE=test → dev hooks exposed automatically. Drop the VITE_DEV_HOOKS=1 incantation.
- Blobs + labels are rendered to a canvas, NOT DOM. Blob count verified via `__engine.getLandmarkBlobCount()`. Label format already covered in L2 (blobRenderer.test.ts) — no need to re-check from DOM in L4.
- Stage data-testids: `stage`, `stage-video`, `webgl-canvas`, `overlay-canvas`, `render-canvas`. No `stage-ready`. Use `camera-state === 'GRANTED'` marker for readiness.
- For composite image: navigate to a blank data: URL, load both PNGs as data URLs, draw onto a canvas, toDataURL, write via node fs.
- Same setup/mirror/COOP/COEP pattern as 2.R regression (see archive `2026-04-15-task-2-R`).

## Progress Log
## Iteration 1 — 2026-04-16T05:00:00.000Z — orientation
- Plan: preflight → spec (adapted to actual dev-hook shape) → L1-L4 → composite + report → commit+merge.

---
