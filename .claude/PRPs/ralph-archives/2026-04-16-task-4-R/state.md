---
iteration: 1
max_iterations: 30
plan_path: ".claude/orchestration-hand-tracker-fx/tasks/phase-4/task-4-R.md"
input_type: "plan"
started_at: "2026-04-16T12:00:00.000Z"
---

# PRP Ralph Loop State — Task 4.R

## Codebase Patterns
- Drift vs task file (expected per prior regressions):
  - No `window.__test__` needed — `__handTracker.__engine.*` covers setFakeLandmarks / getParam / setParam already.
  - camera-state testid is `camera-state` not `data-state="GRANTED"`.
  - Preset name testid is `preset-name` not `.preset-name` class.
  - Spec dir: `tests/e2e/` not `e2e/`.
  - Playwright webServer already runs `pnpm build --mode test` → MODE=test bakes dev hooks; no separate preview script needed. PLAYWRIGHT_BASE_URL env not required.
- D13 default routes: landmark[8].x=0.9 → tileSize = 4 + 0.9*60 = 58, rounded to 58. >48 ✓
- Reduced-motion: Playwright `emulateMedia({ reducedMotion: 'reduce' })` triggers matchMedia change in app; my reducedMotion subscribes to that.

## Progress Log
## Iteration 1 — orientation
- Plan: regression spec → screenshots → report → L1-L4 → merge.

---
