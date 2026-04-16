---
iteration: 1
max_iterations: 20
plan_path: ".claude/orchestration-hand-tracker-fx/tasks/phase-3/task-3-2.md"
input_type: "plan"
started_at: "2026-04-16T01:00:00.000Z"
---

# PRP Ralph Loop State — Task 3.2

## Codebase Patterns

- Shader source lives as raw string constants (no imports, no runtime). MIRROR paramStore.ts shape: named exports only, JSDoc at top.
- `#version 300 es` MUST be byte 0 — template literal opens with backtick IMMEDIATELY followed by the directive (no leading newline).
- Golden-string tests are load-bearing; real WebGL2 compile is only runnable in Chromium (L4). jsdom lacks WebGL.
- For L4: add `__engine.testCompileShaders()` dev hook that creates a throwaway canvas, acquires webgl2, compiles both strings, returns `{ vertex: boolean, fragment: boolean, log?: string }`.

## Progress Log

## Iteration 1 — 2026-04-16T01:00:00.000Z — orientation

### Next Steps
- Write shader.ts from the verbatim source in the task file.
- Write shader.test.ts with golden-string checks.
- Wire __engine.testCompileShaders dev hook + L4 spec.
- L1-L4 + commit + merge.

---
