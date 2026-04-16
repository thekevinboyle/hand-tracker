---
iteration: 1
max_iterations: 20
plan_path: ".claude/orchestration-hand-tracker-fx/tasks/phase-3/task-3-3.md"
input_type: "plan"
started_at: "2026-04-16T02:00:00.000Z"
---

# PRP Ralph Loop State — Task 3.3

## Codebase Patterns

- Landmarks are in UNMIRRORED normalized coords (0..1). Multiply by videoW/videoH to get pixel-space polygon. No `1-x` flip.
- Use winding-number PIP (Dan Sunday form), NOT cross-product — handles concave polygons.
- MAX_REGIONS imported from './shader' — single source of truth.
- Hot path: ONE allocation (result Rect[]), plus expandPolygon's intermediate when padding > 0.
- `columnEdges` / `rowEdges` are PIXEL-space arrays of length count+1 with leading 0, built by Task 3.4 caller from grid.ts breakpoints.
- `setFakeLandmarks` dev hook already exists from Task 2.R. Need new `__engine.computeActiveRegions(grid, padding)` dev hook for L4.

## Progress Log

## Iteration 1 — orientation complete; moving to implementation.

---
