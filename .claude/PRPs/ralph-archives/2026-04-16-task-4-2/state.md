---
iteration: 1
max_iterations: 20
plan_path: ".claude/orchestration-hand-tracker-fx/tasks/phase-4/task-4-2.md"
input_type: "plan"
started_at: "2026-04-16T07:00:00.000Z"
---

# PRP Ralph Loop State — Task 4.2

## Codebase Patterns
- `modulationStore.ts` is referenced as "Phase 2" in task file but does NOT exist — must CREATE as part of this task. Minimal API: `{ getSnapshot, subscribe, upsertRoute, deleteRoute, replaceRoutes }`. Seed with `DEFAULT_MODULATION_ROUTES`. Mirror `paramStore.ts` structural-sharing + listener pattern.
- Panel.tsx currently builds the pane via `buildPaneFromManifest`; needs a second call to `buildModulationPage(pane)` with proper cleanup.
- Tweakpane Essentials plugin already registered by `buildPaneFromManifest` — do NOT double-register.
- CubicBezier blade emits `{ value: [n,n,n,n] }`; Interval blade emits `{ value: { min, max } }`. Cast at boundary, never `any`.
- Route dispose must unsubscribe store + dispose every folder. Resubscribe rebuilds on structural change.

## Progress Log
## Iteration 1 — orientation
- Plan: modulationStore.ts → ModulationPanel.ts → Panel.tsx wire → L1-L3 (L4 N/A, covered by 4.R).

---
