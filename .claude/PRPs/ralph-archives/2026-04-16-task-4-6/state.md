---
iteration: 1
max_iterations: 10
plan_path: ".claude/orchestration-hand-tracker-fx/tasks/phase-4/task-4-6.md"
input_type: "plan"
started_at: "2026-04-16T11:00:00.000Z"
---

# PRP Ralph Loop State — Task 4.6

## Codebase Patterns
- Task 4.1 shipped applyModulation + modulationStore + DEFAULT_MODULATION_ROUTES but did NOT wire into the render loop. App.tsx's onFrame is the right call site. Hook it up here behind the reducedMotion branch.
- matchMedia string MUST be exact: `'(prefers-reduced-motion: reduce)'`.
- Use `addEventListener('change', ...)`, NOT deprecated `addListener`.
- Singleton factory — only ONE module-scoped mq listener that fans out to subscribers.
- Guard `typeof window.matchMedia === 'function'` for jsdom/Node envs that might lack it.

## Progress Log
## Iteration 1 — orientation
- Plan: reducedMotion.ts + tests → wire applyModulation in App.tsx onFrame with reducedMotion gate → L1-L3.

---
