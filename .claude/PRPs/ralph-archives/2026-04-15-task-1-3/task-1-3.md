# Task 1.3: Render 8 error-state cards + pre-prompt card

**Phase**: 1 — Foundation
**Branch**: `task/1-3-error-state-ui`
**Commit prefix**: `Task 1.3:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Render one dedicated full-screen card per `CameraState` (plus a pre-prompt explanation card for `PROMPT`) with state-specific copy, a retry affordance where applicable, reduced-motion honored, and `aria-live` updates for screen readers.

**Deliverable**: `src/ui/ErrorStates.tsx`, `src/ui/PrePromptCard.tsx`, `src/ui/errorCopy.ts`, `src/ui/ErrorStates.test.tsx`, and a minimal integration in `App.tsx` that switches the UI on the `CameraState` returned from Task 1.2's hook.

**Success Definition**: `pnpm vitest run src/ui/ErrorStates.test.tsx` exits 0 with each of the 8 states rendering its dedicated copy; `pnpm test:e2e --grep "Task 1.3:"` verifies the PROMPT card renders on first load under a synthetic `permissions.query='prompt'` context.

---

(Archived copy — full content identical to .claude/orchestration-hand-tracker-fx/tasks/phase-1/task-1-3.md at commit time.)
