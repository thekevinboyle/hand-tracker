# Task 1.6: Stage — video mount + mirror-aware stacked canvases

**Phase**: 1 — Foundation
**Branch**: `task/1-6-stage-mirror-canvas`
**Commit prefix**: `Task 1.6:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Compose the visible stage — a hidden `<video>` element feeding the WebGL texture, and two stacked canvases (WebGL bottom, 2D top) covering the full viewport, with CSS `scaleX(-1)` applied to the display canvases (never the `<video>`) so landmark coordinates remain unmirrored per D27.

**Deliverable**: `src/ui/Stage.tsx`, `src/ui/Stage.css`, `src/ui/Stage.test.tsx`, and an integration in `App.tsx` that renders `<Stage>` in the `GRANTED` branch and passes refs up to the render loop wiring added in Task 1.5.

**Success Definition**: `pnpm vitest run src/ui/Stage.test.tsx` passes; `pnpm test:e2e --grep "Task 1.6:"` verifies both canvases are present, the video is ARIA-hidden, and the mirror transform toggles correctly.

---

## Archive note

Full task file preserved at `.claude/orchestration-hand-tracker-fx/tasks/phase-1/task-1-6.md`. This archive snapshot captures the task identity + archival context; the upstream task file is the source of truth for re-runs. The state.md sibling in this archive directory records the Ralph iteration that closed the task on 2026-04-15.

- Branch: `task/1-6-stage-mirror-canvas`
- PR: https://github.com/thekevinboyle/hand-tracker/pull/6
- Iterations: 1
- All 4 validation levels exited 0. Full 1.1–1.6 E2E regression green.
