---
iteration: 1
max_iterations: 20
plan_path: ".claude/orchestration-hand-tracker-fx/tasks/phase-4/task-4-4.md"
input_type: "plan"
started_at: "2026-04-16T09:00:00.000Z"
---

# PRP Ralph Loop State — Task 4.4

## Codebase Patterns
- paneRef currently lives inside Panel.tsx as a local useRef. Task 4.4 needs it in App.tsx to share with PresetBar. Lift: App creates ref, passes to both Panel (populates) and PresetBar (consumes).
- modulationStore pattern: createX() factory + module singleton + subscribe/getSnapshot. Mirror for presetCycler.
- Keydown MUST be on `window`, NOT `document`, per anti-pattern + Playwright page.keyboard compatibility.
- Target-type guard: ignore keydown when target is HTMLInputElement / HTMLTextAreaElement.
- PresetActions already calls refreshPane() after load; needs to also call presetCycler.refresh() after save/delete/import.

## Progress Log
## Iteration 1 — orientation
- Plan: PresetCycler.ts → PresetBar.tsx + tests → App.tsx lifts paneRef + mounts PresetBar → PresetActions refreshes cycler → L1-L3.

---
