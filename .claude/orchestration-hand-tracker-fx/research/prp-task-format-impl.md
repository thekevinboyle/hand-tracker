# PRP Task Format and Ralph Loop — Implementation Research

**Wave**: Second
**Researcher**: Web Research Specialist subagent
**Date**: 2026-04-14
**Status**: Complete

---

## Summary

This document synthesizes the upstream Rasmus Widing PRP methodology (fetched live from github.com/Wirasm/PRPs-agentic-eng on 2026-04-14) with the Hand Tracker FX project's specific tech stack (React 19 + Vite 8 + TypeScript 5.7 strict, pnpm 10, Biome v2, Vitest 3, Playwright) and DISCOVERY.md decisions to produce five ready-to-use artifacts: a drop-in task-file template, a ralph-loop-prompt, a state-file schema, a fully worked example task file (Task 1.2), and a CLAUDE.md integration snippet. Every section is project-specific — no generic placeholders survive.

---

## Key Findings

### Upstream Sources Examined (live fetched)

- `old-prp-commands/PRPs/templates/prp_base_typescript.md` — TypeScript PRP template v3 (the primary model)
- `.claude/commands/prp-core/prp-ralph.md` — official Ralph loop command (4-phase spec: PARSE, SETUP, EXECUTE, COMPLETE)
- `.claude/commands/prp-core/prp-implement.md` — implement command (6-phase: DETECT, LOAD, PREPARE, EXECUTE, VALIDATE, REPORT)
- `.claude/skills/prp-core-runner/SKILL.md` — prp-core-runner orchestration skill
- `prp-ralph-loop` skill at `/Users/kevin/.claude/skills/prp-ralph-loop/SKILL.md` — local iteration guide

Key divergences between upstream and this project:

| Upstream assumption | This project's reality |
|---------------------|------------------------|
| `npm run lint` / `npm test` | `pnpm biome check` / `pnpm vitest run` |
| ESLint + Prettier | Biome v2 only (single `biome.json`) |
| Next.js App Router, RSC, `'use client'` | Vite 8 SPA — no SSR, no RSC boundaries |
| Generic TypeScript/React patterns | WebGL (OGL), MediaPipe on main thread, rVFC render loop |
| No webcam specifics | 8-state permission machine, MediaStream lifecycle, cleanup |
| State file YAML uses `iteration:` / `max_iterations:` | Preserved exactly |
| `<promise>COMPLETE</promise>` completion signal | Preserved exactly |

---

## Deliverable 1 — Drop-in Task File Template

**Save to**: `.claude/orchestration-hand-tracker-fx/tasks/phase-N/task-N-M.md`

---

# Task N.M: \<imperative-verb description\>

**Phase**: N — \<Phase Name\>
**Branch**: `task/N-M-<kebab-description>`
**Commit prefix**: `Task N.M:`
**Estimated complexity**: \<Low | Medium | High\>
**Max Ralph iterations**: \<10 | 20 | 30\>

---

## Goal

**Feature Goal**: \<Specific, measurable end state — one sentence, no "and"s\>

**Deliverable**: \<Concrete artifact — hook, component, shader file, utility module, Vitest test suite, etc.\>

**Success Definition**: \<Exactly how you will know this is done. Reference a validation command that exits 0 AND a visible browser behavior.\>

---

## User Persona

**Target User**: Creative technologist using Hand Tracker FX on a modern desktop browser (Chrome 120+).

**Use Case**: \<Primary scenario — what the user is doing when this task's output is live\>

**User Journey**:
1. \<Step 1\>
2. \<Step 2\>
3. \<Step 3\>

**Pain Points Addressed**: \<What breaks or is absent without this task\>

---

## Why

- \<Business / creative value of this task in the context of the MVP\>
- \<How it integrates with adjacent tasks — what it unlocks\>
- \<D-number(s) from DISCOVERY.md this task satisfies, e.g., "Required by D22 (getUserMedia constraints) and D23 (8 permission states)"\>

---

## What

\<User-visible behavior and technical requirements — 3–6 bullets\>

- \<Behavior 1\>
- \<Technical requirement 1\>

### NOT Building (scope boundary)

The following are explicitly out of scope for this task:

- \<Item 1 — prevents scope creep during autonomous execution\>
- \<Item 2\>
- No mobile layout changes
- No light theme
- No audio

### Success Criteria

- [ ] \<Specific measurable outcome — ideally maps to a validation command\>
- [ ] `pnpm biome check <path>` exits 0 for all new/modified files
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `pnpm vitest run <unit-test-file>` exits 0
- [ ] \<Browser behavior assertion, e.g., "DOM shows state card with text 'Camera access blocked'"\>

---

## All Needed Context

> **Context Completeness Check**: Could an agent with zero prior knowledge of this codebase implement this task using only this file? If not, add what is missing before running Ralph.

```yaml
files:
  - path: src/camera/useCamera.ts
    why: MIRROR this file's hook structure — state machine pattern, cleanup pattern, return shape
    gotcha: StrictMode double-invocation means cleanup must cancel rVFC/rAF registrations or the stream leaks

  - path: src/engine/paramStore.ts
    why: Pattern for plain-object store with shallow subscribe — do NOT use React state in the hot path (D20)
    gotcha: Tweakpane mutates the store object directly; never spread-clone it in the render loop

  - path: src/ui/ErrorStates.tsx
    why: Pattern for the 8 permission state cards — copy className conventions and copy-string format
    gotcha: Each card is a full-screen overlay; z-index must be above both canvases

  - path: src/app/main.tsx
    why: Entry point — understand how the render loop is initialized and what refs are passed
    gotcha: React StrictMode is ON; effects run twice in dev — all cleanup paths must be idempotent

  - path: <MIRROR FILE — the single closest existing file to what you are building>
    why: Copy its file structure, export pattern, and TypeScript conventions exactly
    gotcha: <Any known constraint>

urls:
  - url: https://developers.google.com/mediapipe/solutions/vision/hand_landmarker/web_js
    why: HandLandmarker API — detectForVideo(), setOptions(), close() lifecycle
    critical: detectForVideo() must be called with monotonically increasing timestamps; same timestamp twice is a silent no-op

  - url: https://tweakpane.github.io/docs/
    why: Tweakpane 4 — addBinding(), exportState(), importState() API
    critical: importState() is destructive; call only on preset load, never in the render loop

  - url: https://oframe.github.io/ogl/examples/
    why: OGL WebGL2 — Program, Mesh, RenderTarget, Texture patterns
    critical: Texture must be uploaded each frame via texture.image = videoElement before renderer.render()

  - url: https://vitest.dev/api/
    why: Vitest 3 API — vi.fn(), vi.spyOn(), vi.stubGlobal() for mocking browser APIs
    critical: getUserMedia mock must be set up in beforeEach and torn down via vi.unstubAllGlobals() in afterEach

skills:
  - <skill-name-1>   # from .claude/orchestration-hand-tracker-fx/skills/
  - <skill-name-2>

discovery:
  - D16: Tech stack — React 19, Vite 8, TypeScript 5.7 strict, pnpm 10, Biome v2, Vitest 3, Playwright
  - D17: MediaPipe HandLandmarker — main thread, GPU delegate, v0.10.34+
  - D18: Rendering stack — OGL WebGL bottom layer + Canvas 2D top layer, rVFC loop
  - D19: Tweakpane 4 + Essentials plugin, plain paramStore, no React state in hot path
  - D20: paramStore is plain object; React only for permissions UI, error screens, layout chrome
  - D21: Testing — Vitest for utilities, Playwright E2E with fake device
  - D<N>: <relevant decision title>
```

### Current Codebase Tree (relevant subset)

```
src/
  camera/
    useCamera.ts          # getUserMedia state machine hook
    deviceSelect.ts       # enumerateDevices wrapper
  engine/
    renderer.ts           # OGL setup + rVFC render loop
    registry.ts           # effectRegistry + registerEffect()
    modulation.ts         # ModulationRoute evaluator
    paramStore.ts         # plain-object store + subscribe
  effects/
    handTrackingMosaic/
      manifest.ts
      shader.glsl.ts
      render.ts
      grid.ts
      region.ts
  tracking/
    handLandmarker.ts     # MediaPipe HandLandmarker wrapper
  ui/
    App.tsx
    Panel.tsx
    ErrorStates.tsx
    PresetBar.tsx
    RecordButton.tsx
  app/
    main.tsx
public/
  models/hand_landmarker.task
  wasm/
```

### Desired Codebase Tree (files this task adds or modifies)

```
src/
  <new-or-modified file 1>   # <one-line responsibility>
  <new-or-modified file 2>   # <one-line responsibility>
  <new test file>            # Vitest unit tests for <module>
```

### Known Gotchas

```typescript
// CRITICAL: React StrictMode runs effects twice in dev.
// All useEffect cleanups must be idempotent:
//   cancelAnimationFrame(rafId)
//   video.cancelVideoFrameCallback(rvfcId)
//   tracks.forEach(t => t.stop())

// CRITICAL: MediaPipe detectForVideo() requires monotonically increasing timestamps.
// Pass performance.now() — never Date.now() — and never repeat the same value.

// CRITICAL: Biome v2 is the single linter + formatter (no ESLint, no Prettier).
// Run: pnpm biome check --write <paths>   (auto-fix during development)
// Run: pnpm biome check <paths>           (check only, used in validation loop)

// CRITICAL: TypeScript strict mode is ON.
// No `any` types. If a MediaPipe type is missing, use `unknown` and narrow.

// CRITICAL: pnpm, not npm or bun.
// All commands: pnpm install, pnpm run <script>, pnpm vitest run.

// CRITICAL: OGL Texture upload — set texture.image = videoEl each frame BEFORE renderer.render().
// Stale frame artifacts appear otherwise.

// CRITICAL: Never store MediaStream in React state — use a ref.
// Storing in state triggers re-renders that restart the stream.

// CRITICAL: Tweakpane exportState() returns an opaque object.
// Store it verbatim in Preset.params — never attempt to mutate individual keys.

// CRITICAL: This is a Vite SPA, not Next.js.
// Do NOT add 'use client' directives. There is no SSR/RSC boundary.
```

---

## Implementation Blueprint

### Data Models

```typescript
// Define new types/interfaces for this task here.
// Place in src/types/<domain>.ts or inline in the module if task-scoped.

export type <DomainName> = {
  <field>: <type>
}
```

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE src/<path>/<filename>.ts
  - IMPLEMENT: <what exactly — function signatures, exported names>
  - MIRROR: src/<closest-existing-file>.ts (lines <N>–<M> — <pattern name>)
  - NAMING: camelCase hooks, PascalCase components/types, kebab-case files
  - GOTCHA: <specific constraint>
  - VALIDATE: pnpm biome check src/<path>/<filename>.ts && pnpm tsc --noEmit

Task 2: CREATE src/<path>/<filename>.test.ts
  - IMPLEMENT: Vitest unit tests for Task 1 — cover happy path, error states, edge cases
  - MIRROR: <closest existing test file>
  - MOCK: vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } })
  - VALIDATE: pnpm vitest run src/<path>/<filename>.test.ts

Task 3: MODIFY src/<existing-file>.ts
  - FIND: <exact string to locate the insertion point>
  - ADD: <what to add and where>
  - PRESERVE: All existing exports and behavior
  - VALIDATE: pnpm biome check src/<existing-file>.ts && pnpm tsc --noEmit

Task 4: CREATE src/<path>/<Component>.tsx  (if UI involved)
  - IMPLEMENT: React component — props interface, render, cleanup
  - MIRROR: src/ui/<ClosestExisting>.tsx
  - REQUIRE: No React state in render hot path — read from paramStore.getState() via ref
  - GOTCHA: No 'use client' directive — Vite SPA, no RSC
  - VALIDATE: pnpm biome check src/<path>/<Component>.tsx && pnpm tsc --noEmit

Task 5: INTEGRATE in src/app/main.tsx  (if wiring to app entry)
  - FIND: <exact anchor string in main.tsx>
  - ADD: import and usage following existing pattern
  - PRESERVE: Existing initialization order
  - VALIDATE: pnpm build
```

### Integration Points

```yaml
PARAM_STORE:
  - pattern: paramStore.getState().<key> in render loop (read-only, no React state)
  - pattern: paramStore.setState({ <key>: value }) from UI handlers

EFFECT_REGISTRY:
  - pattern: registerEffect(manifest) called once at module load
  - file: src/engine/registry.ts

HAND_LANDMARKER:
  - pattern: handLandmarker.detectForVideo(videoEl, performance.now())
  - returns: HandLandmarkerResult | null

TWEAKPANE:
  - pattern: pane.addBinding(paramStore.getState(), '<key>', { min, max, step })
  - preset I/O: pane.exportState() / pane.importState(preset.params)
```

---

## Validation Loop

### Level 1 — Syntax and Style (run after EVERY file creation)

```bash
# Lint + format check (Biome v2 — check only, not auto-fix)
pnpm biome check src/<new-or-modified-paths>

# Auto-fix variant (use during active development, not in CI or loop)
pnpm biome check --write src/<new-or-modified-paths>

# Full TypeScript type check
pnpm tsc --noEmit

# Expected: zero errors. READ output and fix before proceeding to L2.
```

### Level 2 — Unit Tests (run after implementation is wired up)

```bash
# Run specific test file(s) for this task
pnpm vitest run src/<path>/<filename>.test.ts

# Run all unit tests (regression guard)
pnpm vitest run

# Expected: all tests pass. Never skip on the assumption they "should work".
```

### Level 3 — Integration (production build + dev server smoke)

```bash
# Production build — catches tree-shaking errors and Vite/esbuild issues
# that pnpm tsc --noEmit can miss (esbuild skips some type checks)
pnpm build

# Expected: exits 0 with no TypeScript or bundle errors.
```

### Level 4 — E2E (Playwright with fake media stream)

```bash
# Full E2E suite (Chrome with --use-fake-device-for-media-stream)
pnpm test:e2e -- --grep "<task-name>"

# Expected: Playwright test exits 0. Assertions:
#   - Page loads without JS errors
#   - <task-specific assertion, e.g., "state machine reaches GRANTED within 3s">
#   - <task-specific assertion, e.g., "canvas element is visible and non-zero size">
#   - render FPS >= 20 (checked via custom window.__fps__ helper if present)
```

---

## Final Validation Checklist

### Technical

- [ ] All 4 validation levels completed and exit 0
- [ ] `pnpm vitest run` — all tests pass
- [ ] `pnpm biome check .` — zero errors
- [ ] `pnpm tsc --noEmit` — zero errors
- [ ] `pnpm build` — production build succeeds

### Feature

- [ ] All success criteria checkboxes above are met
- [ ] Manual browser test: open `http://localhost:5173`, perform \<task-specific user action\>
- [ ] Error cases produce correct UI (not raw DOMException messages)
- [ ] React StrictMode double-invoke: no stream leak, no duplicate rVFC registrations

### Code Quality

- [ ] No `any` types introduced
- [ ] No React state in the render hot path
- [ ] `track.stop()` called in all relevant cleanups (D25)
- [ ] Mirror pattern followed — file structure matches closest existing file
- [ ] Anti-patterns below not present

---

## Anti-Patterns

- Do not call `getUserMedia()` without a preceding user gesture (D22 / D23)
- Do not store MediaStream in React state — use a ref
- Do not use `any` types — use `unknown` and narrow, or import MediaPipe types
- Do not import from `@mediapipe/tasks-vision` without confirming wasm files resolve from `/wasm/`
- Do not use ESLint or Prettier — Biome v2 only (single `biome.json`)
- Do not use `npm` or `bun` commands — project uses `pnpm` exclusively
- Do not write React state that the canvas render loop reads — use `paramStore.getState()` via a ref
- Do not call `detectForVideo()` with the same timestamp twice — it silently no-ops
- Do not call `exportState()` from Tweakpane mid-frame — call only on Save Preset user action
- Do not add `'use client'` directives — Vite SPA, no SSR/RSC boundary
- Do not skip Level 1 validation "because the types look right" — run `tsc --noEmit` explicitly
- Do not accumulate failing tests across tasks — fix before moving to the next task file

---

## No Prior Knowledge Test

Before handing this task file to a Ralph agent, verify:

- [ ] Every file path in `All Needed Context` exists in the codebase (or is created by this task — mark clearly)
- [ ] Every URL in `urls:` is reachable and points to the correct section
- [ ] Every D-number cited in `discovery:` exists in DISCOVERY.md
- [ ] The `Implementation Tasks` list is topologically sorted — no task depends on a later task
- [ ] The `Validation Loop` commands are copy-paste runnable with no placeholders (`<path>`, `{runner}`, etc.)
- [ ] The MIRROR file exists in the codebase at the stated path
- [ ] The task is atomic — it does not require knowledge from a future task file to complete

If all boxes are checked, the task file is ready for Ralph.

---

## Skills to Read Before Starting

```
.claude/orchestration-hand-tracker-fx/skills/<skill-1>.md
.claude/orchestration-hand-tracker-fx/skills/<skill-2>.md
```

(Populate with actual skill file names from `.claude/orchestration-hand-tracker-fx/skills/` relevant to this task's domain.)

---

---

## Deliverable 2 — Ralph Loop Prompt

**Save to**: `.claude/orchestration-hand-tracker-fx/ralph-loop-prompt.md`

This is the exact prompt text injected into the subagent when running in Ralph mode. The stop hook feeds this prompt back at the start of each iteration until `<promise>COMPLETE</promise>` is emitted in the final agent message.

---

# PRP Ralph Loop — Hand Tracker FX

**Plan file**: `{PLAN_PATH}`
**State file**: `.claude/prp-ralph.state.md`
**Iteration**: {ITERATION} of {MAX_ITERATIONS}

---

## Your Mission

You are executing a PRP task file for the Hand Tracker FX project in autonomous Ralph mode. Your job is to implement the task, run all four validation levels, fix any failures, and iterate until every level exits 0. You do not stop until all validations pass or max iterations is reached.

**Core rule**: Never emit `<promise>COMPLETE</promise>` unless all four validation levels exit 0. Never lie to exit. The loop continues until genuinely complete.

---

## Step 1: Read Context (every iteration, no exceptions)

1. Read `.claude/prp-ralph.state.md` — check the "Codebase Patterns" section at the top for reusable patterns discovered in previous iterations.
2. Read `{PLAN_PATH}` — understand all tasks and their completion status.
3. Run `git status` and `git diff --stat` — see what has already been changed.
4. Check the Progress Log at the bottom of the state file — what did previous iterations attempt? What failed?

Do not skip this step. Starting blind wastes iterations.

---

## Step 2: Identify Remaining Work

From the task file, identify:

- Which Implementation Tasks are not yet complete
- Which validation levels are not yet passing
- What specific errors appeared in the last iteration (from Progress Log)

---

## Step 3: Implement

For each incomplete task:

1. Read the MIRROR file referenced in the task — copy its file structure, export pattern, and TypeScript conventions exactly.
2. Implement the change.
3. Run Level 1 validation immediately after each file write — do not batch file writes then check at the end.

**Project-specific constraints during implementation**:

- Package manager: `pnpm` only. Never use `npm` or `bun`.
- Linter/formatter: `pnpm biome check` only. Never use eslint or prettier.
- No `any` TypeScript types. Use `unknown` and narrow.
- No React state in the canvas render hot path. Use `paramStore.getState()` via a ref.
- No `'use client'` directives — this is a Vite SPA with no SSR boundary.
- `track.stop()` must be called in every `useEffect` cleanup that opens a MediaStream track.
- All `requestAnimationFrame` / `requestVideoFrameCallback` IDs must be cancelled in cleanup — React StrictMode runs effects twice in dev.
- MediaPipe `detectForVideo()` requires monotonically increasing `performance.now()` timestamps. Never repeat a timestamp.
- Model file is at `public/models/hand_landmarker.task`. WASM files are at `public/wasm/`. No CDN.

---

## Step 4: Run All Four Validation Levels

Run these in order. Do not skip any level. Run all four even after the first failure — you need the full picture before fixing.

### Level 1 — Syntax and Style

```bash
pnpm biome check src/
pnpm tsc --noEmit
```

Expected: zero errors, zero warnings.

### Level 2 — Unit Tests

```bash
pnpm vitest run
```

Expected: all tests pass.

### Level 3 — Integration (production build)

```bash
pnpm build
```

Expected: exits 0 with no TypeScript or bundle errors.

### Level 4 — E2E (Playwright with fake media stream)

```bash
pnpm test:e2e
```

Expected: all Playwright tests pass, including the task-specific assertion named in the task file.

---

## Step 5: Fix Failures

For each failing level:

1. Read the full error output — do not guess from a partial message.
2. Identify the root cause — is it a type error, a missing import, a test assertion failure, a build config issue, or a browser behavior?
3. Fix the specific issue.
4. Re-run only the failing level (fast feedback), then re-run all four levels to confirm no regressions.
5. Document the fix in the Progress Log.

**If stuck on the same error for two consecutive iterations**:

- Try an alternative implementation pattern.
- Check the "Codebase Patterns" section of the state file for prior insights.
- Look at the MIRROR file again — have you diverged from the established pattern?
- Add a more targeted test that isolates the failing behavior.
- Document the blocker clearly so the human can intervene if needed.

---

## Step 6: Update the State File

After every iteration, append to the Progress Log section of `.claude/prp-ralph.state.md`:

```
## Iteration {N} — {ISO timestamp}

### Completed this iteration
- {Task or fix 1}
- {Task or fix 2}

### Validation Status
- L1 Biome: PASS | FAIL ({error summary if failing})
- L1 tsc: PASS | FAIL ({error count})
- L2 Vitest: PASS | FAIL ({X/Y tests passing})
- L3 Build: PASS | FAIL ({error summary})
- L4 E2E: PASS | FAIL ({test name + assertion that failed})

### Learnings
- {Reusable pattern: "in this codebase, X is done by Y"}
- {Gotcha: "never do Z because W"}
- {Context: "file X lives at path Y, not where I expected"}

### Next Steps
- {Specific remaining work}
- {Specific blocker if any}

---
```

If you discover a **reusable pattern** (general, not iteration-specific), also add it to the "Codebase Patterns" section at the TOP of the state file.

---

## Step 7: Completion

When ALL four validation levels exit 0 AND all tasks in the plan file are marked complete:

1. Generate `.claude/PRPs/reports/{task-name}-report.md`:

```
# Implementation Report — {Task Name}

**Plan**: {PLAN_PATH}
**Completed**: {ISO timestamp}
**Iterations used**: {N}

## Summary
{2–3 sentences on what was implemented}

## Tasks Completed
{Bulleted list from the plan file}

## Validation Results
| Level | Check | Result |
|-------|-------|--------|
| L1 | pnpm biome check | PASS |
| L1 | pnpm tsc --noEmit | PASS |
| L2 | pnpm vitest run | PASS |
| L3 | pnpm build | PASS |
| L4 | pnpm test:e2e | PASS |

## Codebase Patterns Discovered
{From "Codebase Patterns" section of state file}

## Deviations from Plan
{Any changes made to the plan's approach and why, or "None"}
```

2. Archive the run:

```bash
DATE=$(date +%Y-%m-%d)
TASK_NAME=$(basename {PLAN_PATH} .md)
ARCHIVE_DIR=".claude/PRPs/ralph-archives/${DATE}-${TASK_NAME}"
mkdir -p "$ARCHIVE_DIR"
cp .claude/prp-ralph.state.md "$ARCHIVE_DIR/state.md"
cp {PLAN_PATH} "$ARCHIVE_DIR/plan.md"
```

3. Move plan to completed:

```bash
mkdir -p .claude/PRPs/plans/completed
mv {PLAN_PATH} .claude/PRPs/plans/completed/
```

4. Clean up state file:

```bash
rm .claude/prp-ralph.state.md
```

5. **Emit the completion promise as the last text in your final message** (the stop hook checks for this):

```
<promise>COMPLETE</promise>
```

---

## What NOT to Do

- Do not emit `<promise>COMPLETE</promise>` if any validation level is still failing
- Do not skip reading the state file at the start of each iteration
- Do not batch file writes and check types at the end — check after each file
- Do not use `any` types as a workaround for type errors — fix the types
- Do not use `npm` or `npx` — always `pnpm`
- Do not run ESLint or Prettier — Biome only
- Do not add `'use client'` directives — Vite SPA, no RSC
- Do not add dependencies to `package.json` that are not specified in the task file — document the need and escalate

---

---

## Deliverable 3 — `.claude/prp-ralph.state.md` Schema

**Location**: `.claude/prp-ralph.state.md` (project root `.claude/`, not inside `orchestration-hand-tracker-fx/`)

The state file is a live markdown document with YAML frontmatter. It is created fresh for each Ralph run, read at the start of every iteration, and deleted on clean completion (then archived).

### Schema

```markdown
---
iteration: 1
max_iterations: 20
plan_path: ".claude/orchestration-hand-tracker-fx/tasks/phase-N/task-N-M.md"
input_type: "plan"
started_at: "2026-04-14T10:00:00.000Z"
---

# PRP Ralph Loop State

## Codebase Patterns
<!-- IMPORTANT: Add reusable, general patterns here. Future iterations read this section first.
     Format: one bullet per pattern, starting with the file or domain context. -->
- (empty on first run — populated as patterns are discovered)

## Current Task
Execute task file at plan_path and iterate until all 4 validation levels exit 0.

## Plan Reference
.claude/orchestration-hand-tracker-fx/tasks/phase-N/task-N-M.md

## Instructions
1. Read the plan file — understand all tasks and validation requirements
2. Check "Codebase Patterns" section above — apply any prior learnings
3. Review the Progress Log below — what did prior iterations do?
4. Implement incomplete tasks, running L1 after each file write
5. Run ALL 4 validation levels: L1 (biome + tsc), L2 (vitest), L3 (build), L4 (e2e)
6. Fix any failures, re-run, update the Progress Log
7. When ALL levels exit 0: emit <promise>COMPLETE</promise>

## Progress Log

<!-- Append one entry per iteration. Never delete prior entries. -->

---
```

### YAML Frontmatter Field Definitions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `iteration` | int | Current iteration number. Stop hook increments this before re-injecting the prompt. | `1` |
| `max_iterations` | int | Hard cap. Stop hook allows session to close when `iteration >= max_iterations`. | `20` |
| `plan_path` | string (quoted) | Path to the task file being executed. Must be a `.md` file. | `".claude/orchestration-hand-tracker-fx/tasks/phase-1/task-1-2.md"` |
| `input_type` | string | Always `"plan"` for task files. `"prd"` if feeding a PRD for phase selection. | `"plan"` |
| `started_at` | ISO 8601 string | Timestamp of first iteration. Used in archive directory naming. | `"2026-04-14T10:00:00.000Z"` |

### Progress Log Entry Schema

Appended by the agent after every iteration:

```
## Iteration {N} — {ISO timestamp}

### Completed this iteration
- {bullet}

### Validation Status
- L1 Biome: PASS | FAIL ({detail})
- L1 tsc: PASS | FAIL ({error count})
- L2 Vitest: PASS | FAIL ({X/Y tests passing})
- L3 Build: PASS | FAIL ({detail})
- L4 E2E: PASS | FAIL ({test name + assertion that failed})

### Learnings
- {bullet}

### Next Steps
- {bullet}

---
```

### State File Lifecycle

```
Created by:  Agent on first iteration (from ralph-loop-prompt.md Step 1)
Read by:     Agent at the start of every subsequent iteration
Updated by:  Agent — appends Progress Log entry each iteration
             Agent — adds to Codebase Patterns section when a pattern is found
Deleted by:  Agent on clean completion (after archive copy)
Archived to: .claude/PRPs/ralph-archives/YYYY-MM-DD-{task-name}/state.md
```

---

---

## Deliverable 4 — Worked Example: Task 1.2

**Save to**: `.claude/orchestration-hand-tracker-fx/tasks/phase-1/task-1-2.md`

This is a fully populated instance of the template above. It serves as the canonical worked example for all future task files in this project.

---

# Task 1.2: Implement getUserMedia State Machine Hook

**Phase**: 1 — Scaffold and Foundation
**Branch**: `task/1-2-usecamera-state-machine`
**Commit prefix**: `Task 1.2:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Implement `useCamera` — a React hook that manages the full `getUserMedia` lifecycle as a deterministic 8-state state machine, returning the current state enum and the live `MediaStream` when granted.

**Deliverable**: `src/camera/useCamera.ts` + `src/camera/useCamera.test.ts` — a fully typed hook and its Vitest unit test suite.

**Success Definition**: `pnpm vitest run src/camera/useCamera.test.ts` exits 0 with all 8 permission states covered; `pnpm tsc --noEmit` exits 0; mounting the hook in `App.tsx` and denying camera permission in Chrome shows the `USER_DENIED` state card.

---

## User Persona

**Target User**: Creative technologist opening Hand Tracker FX for the first time on Chrome 120+ macOS.

**Use Case**: The user lands on the app, sees a pre-prompt explanation card, clicks "Enable Camera", grants or denies permission, and sees the appropriate full-screen state UI.

**User Journey**:
1. User opens `https://hand-tracker-fx.vercel.app`
2. App renders `PROMPT` state card — explanation of why camera is needed, "Enable Camera" button
3. User clicks "Enable Camera" — `getUserMedia()` is called
4. Browser prompt appears
5a. User clicks "Allow" → state transitions to `GRANTED` → live video renders
5b. User clicks "Block" → state transitions to `USER_DENIED` → denial card with recovery instructions
6. If camera is in use by another app → `DEVICE_CONFLICT` card
7. If no camera hardware → `NOT_FOUND` card

**Pain Points Addressed**: Without this hook, the app crashes with a raw `DOMException` on permission denial, leaving the user with a blank screen and no recovery path.

---

## Why

- Required by D23 (8 distinct permission UI states) — the entire camera pipeline depends on this hook
- Satisfies D22 (`getUserMedia` constraints: `{ video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, min: 15 } }, audio: false }`)
- Satisfies D25 (cleanup: `track.stop()` on unmount; idempotent under StrictMode)
- Satisfies D24 (device selection: `enumerateDevices()` after first grant)
- Unlocks Task 1.3 (MediaPipe HandLandmarker initialization), which depends on a valid `HTMLVideoElement` with an active stream

---

## What

- Hook returns `{ state: CameraState, stream: MediaStream | null, error: string | null, retry: () => void }`
- `CameraState` is a union: `'PROMPT' | 'GRANTED' | 'USER_DENIED' | 'SYSTEM_DENIED' | 'DEVICE_CONFLICT' | 'NOT_FOUND' | 'MODEL_LOAD_FAIL' | 'NO_WEBGL'`
- `getUserMedia()` is NEVER called on mount — only when `retry()` is explicitly invoked
- On grant, `enumerateDevices()` is called to populate the device list
- A `permissionStatus.onchange` listener and a `devicechange` listener are attached on mount and removed on cleanup
- Safari does NOT support `navigator.permissions.query({ name: 'camera' })` — the hook uses try/catch on `getUserMedia()` directly as the permission probe

### NOT Building

- `ErrorStates.tsx` UI component (Task 1.4)
- `deviceSelect.ts` dropdown UI (Task 1.5)
- `MODEL_LOAD_FAIL` and `NO_WEBGL` state transition logic (deferred to Tasks 1.3 and 1.6 respectively)
- No audio constraints (`audio: false` always)
- No mobile layout
- No light theme

### Success Criteria

- [ ] `src/camera/useCamera.ts` exports `useCamera` hook and `CameraState` type
- [ ] All 8 states are reachable via distinct code paths (covered by tests)
- [ ] `pnpm biome check src/camera/` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `pnpm vitest run src/camera/useCamera.test.ts` exits 0 — all 8+ state transition tests pass
- [ ] Mounting the hook and clicking "Enable Camera" then denying in Chrome shows `USER_DENIED` state (verified in L4)
- [ ] `track.stop()` is called in the `useEffect` cleanup (verified via `vi.spyOn`)

---

## All Needed Context

```yaml
files:
  - path: src/engine/paramStore.ts
    why: MIRROR this file's module structure — plain TypeScript module, named exports only, no default export
    gotcha: paramStore uses a closure pattern with getState/setState; do NOT use this pattern in useCamera; use useReducer instead

  - path: src/app/main.tsx
    why: Understand how the hook will be consumed — what refs are passed, how return value is used
    gotcha: React StrictMode is ON in main.tsx — the hook's useEffect will run twice in dev; cleanup must be idempotent

urls:
  - url: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    why: getUserMedia() API — constraint shapes, DOMException error names
    critical: "NotAllowedError covers BOTH user denial and OS-level denial; distinguish by checking navigator.permissions first, falling back to USER_DENIED on Safari"

  - url: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/permissions
    why: permissions.query({ name: 'camera' }) — check existing permission state before calling getUserMedia
    critical: Safari does NOT support permissions.query for camera — always wrap in try/catch and fall back to getUserMedia try/catch

  - url: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/devicechange_event
    why: devicechange event — refresh device list and re-validate stream on plug/unplug
    critical: Must remove listener in cleanup; event fires even when stream is not active

  - url: https://vitest.dev/api/vi.html#vi-stubglobal
    why: vi.stubGlobal() — mock navigator.mediaDevices.getUserMedia in tests without modifying the real global
    critical: Must call vi.unstubAllGlobals() in afterEach; otherwise the mock leaks between tests

skills:
  - framework-tooling    # Vite 8 + TypeScript 5.7 + Biome v2 + Vitest 3 patterns

discovery:
  - D16: Tech stack — React 19, Vite 8, TypeScript 5.7 strict, pnpm 10, Biome v2, Vitest 3, Playwright
  - D22: getUserMedia constraints — { video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, min: 15 } }, audio: false }
  - D23: 8 permission states — PROMPT, GRANTED, USER_DENIED, SYSTEM_DENIED, DEVICE_CONFLICT, NOT_FOUND, MODEL_LOAD_FAIL, NO_WEBGL
  - D24: Device selection — enumerateDevices() after first grant, deviceId persisted to localStorage, re-validated on load
  - D25: Cleanup — track.stop() on unmount, StrictMode cleanup must cancel rVFC/rAF, idempotent
  - D27: Webcam source truth — raw video element is unmirrored; CSS scaleX(-1) applied only to display canvases
```

### Current Codebase Tree (relevant subset)

```
src/
  camera/
    (useCamera.ts — TO BE CREATED by this task)
    (deviceSelect.ts — TO BE CREATED by Task 1.5)
  engine/
    paramStore.ts     # MIRROR: module structure pattern
  app/
    main.tsx          # Entry point — understand hook consumption shape
```

### Desired Codebase Tree

```
src/
  camera/
    useCamera.ts          # getUserMedia state machine hook (this task)
    useCamera.test.ts     # Vitest unit tests — 8 state transitions (this task)
```

### Known Gotchas

```typescript
// CRITICAL: React StrictMode runs useEffect twice in dev.
// Use a ref flag `isCancelled = true` to prevent state updates after cleanup.
// Cleanup: track.stop() idempotently, remove all event listeners.

// CRITICAL: Safari does not support navigator.permissions.query({ name: 'camera' }).
// Pattern:
//   try {
//     const status = await navigator.permissions.query({ name: 'camera' as PermissionName })
//     // use status.state
//   } catch {
//     // Safari: proceed directly to getUserMedia() and handle errors by name
//   }

// CRITICAL: NotAllowedError from getUserMedia() can mean EITHER user denied OR
// OS-level denied. Use navigator.permissions.query result to distinguish when available.
// On Safari (permissions API unavailable), check error.message for 'system' keyword,
// or default to USER_DENIED (more actionable for the user).

// CRITICAL: Never store MediaStream in React state — only in a ref.
// Storing in state causes re-renders that trigger cleanup and restart the stream.

// CRITICAL: getUserMedia() must NOT be called on mount.
// Initial state is PROMPT. Call getUserMedia() only when the user triggers retry().

// CRITICAL: pnpm biome check will flag unused variables with noUnusedVariables.
// All declared variables must be used. MODEL_LOAD_FAIL and NO_WEBGL states are
// defined but transitioned by later tasks — add a comment explaining this.
```

---

## Implementation Blueprint

### Data Models

```typescript
// src/camera/useCamera.ts — types to define

export type CameraState =
  | 'PROMPT'
  | 'GRANTED'
  | 'USER_DENIED'
  | 'SYSTEM_DENIED'
  | 'DEVICE_CONFLICT'
  | 'NOT_FOUND'
  | 'MODEL_LOAD_FAIL'  // transitioned by Task 1.3 (HandLandmarker init)
  | 'NO_WEBGL'         // transitioned by Task 1.6 (renderer init)

export type UseCameraReturn = {
  state: CameraState
  stream: MediaStream | null
  error: string | null
  retry: () => void
}
```

### Implementation Tasks

```yaml
Task 1: CREATE src/camera/useCamera.ts
  - IMPLEMENT:
      - CameraState type union (all 8 states)
      - UseCameraReturn type
      - useCamera() React hook:
          - useReducer for state transitions (not useState — avoids stale closure issues)
          - useEffect: attaches permissionStatus.onchange and devicechange listeners on mount, removes on cleanup
          - retry() function: calls getUserMedia() with D22 constraints; handles DOMExceptions:
              NotAllowedError → distinguish system vs user via permissions API, fallback to USER_DENIED
              NotReadableError → DEVICE_CONFLICT
              NotFoundError → NOT_FOUND
              OverconstrainedError → retry with relaxed constraints (drop frameRate), log warning to console
          - On GRANTED: store stream in a ref, attach track.onended to detect stream loss
          - Cleanup: track.stop() on all stream tracks, remove event listeners, set isCancelled flag
  - MIRROR: src/engine/paramStore.ts (named exports only, no default export, no barrel re-export)
  - NAMING: useCamera (camelCase hook), CameraState (PascalCase type), UseCameraReturn (PascalCase type)
  - GOTCHA: Store stream in a ref, never React state; expose via return value read from the ref
  - VALIDATE: pnpm biome check src/camera/useCamera.ts && pnpm tsc --noEmit

Task 2: CREATE src/camera/useCamera.test.ts
  - IMPLEMENT: Vitest unit tests covering:
      - Initial state is PROMPT
      - retry() triggers getUserMedia()
      - getUserMedia() resolves → state becomes GRANTED, stream is non-null
      - getUserMedia() rejects NotAllowedError (user) → USER_DENIED
      - getUserMedia() rejects NotAllowedError (system, permissions query returns 'denied') → SYSTEM_DENIED
      - getUserMedia() rejects NotReadableError → DEVICE_CONFLICT
      - getUserMedia() rejects NotFoundError → NOT_FOUND
      - Cleanup: track.stop() is called on unmount (vi.spyOn on track.stop)
      - StrictMode double-invoke: mounting and immediately unmounting leaves no orphaned listeners
  - MOCK:
      vi.stubGlobal to mock navigator.mediaDevices.getUserMedia
      vi.stubGlobal to mock navigator.permissions.query
      Create a minimal fake MediaStream with a fake MediaStreamTrack that has a stop() spy
  - VALIDATE: pnpm vitest run src/camera/useCamera.test.ts
```

### Integration Points

```yaml
CONSUMED_BY:
  - src/app/main.tsx: const { state, stream, retry } = useCamera()
  - src/ui/ErrorStates.tsx (Task 1.4): receives state prop, renders correct card
  - src/tracking/handLandmarker.ts (Task 1.3): receives stream, attaches to video element

EXPORTS:
  - useCamera (named: import { useCamera } from '../camera/useCamera')
  - CameraState (type — consumed by ErrorStates and App)
  - UseCameraReturn (type — consumed by App for prop typing)
```

---

## Validation Loop

### Level 1 — Syntax and Style

```bash
pnpm biome check src/camera/useCamera.ts src/camera/useCamera.test.ts
pnpm tsc --noEmit
```

Expected: zero errors. Fix all Biome and TypeScript errors before proceeding to L2.

### Level 2 — Unit Tests

```bash
pnpm vitest run src/camera/useCamera.test.ts
```

Expected: all 9+ tests pass. If any fail, read the full error output — do not guess from the first line.

### Level 3 — Integration

```bash
pnpm build
```

Expected: exits 0. The hook must be importable from `src/app/main.tsx` without breaking the production build.

### Level 4 — E2E

```bash
pnpm test:e2e -- --grep "Task 1.2"
```

Expected: Playwright test with `--use-fake-device-for-media-stream`:

- Page loads without JS errors in the console
- With fake device and `browserContext.grantPermissions(['camera'])`: state reaches `GRANTED` within 3 seconds, video element is playing
- With `browserContext.clearPermissions()` and camera denied via Chrome args: DOM contains the `USER_DENIED` state card copy

---

## Final Validation Checklist

### Technical

- [ ] L1, L2, L3, L4 all exit 0
- [ ] `pnpm vitest run` — all tests pass (not just useCamera)
- [ ] `pnpm biome check .` — zero errors
- [ ] `pnpm tsc --noEmit` — zero errors
- [ ] `pnpm build` — production build succeeds

### Feature

- [ ] All 8 `CameraState` values are defined and typed
- [ ] `getUserMedia()` is NOT called on mount — only when `retry()` is invoked
- [ ] `track.stop()` is called in cleanup — verified by `vi.spyOn` test
- [ ] Safari Permissions API fallback is implemented (try/catch around `permissions.query`)
- [ ] NotAllowedError distinguishes USER_DENIED vs SYSTEM_DENIED
- [ ] OverconstrainedError triggers relaxed-constraint retry

### Code Quality

- [ ] No `any` types
- [ ] `MediaStream` stored in a `ref`, not React state
- [ ] Hook is idempotent under StrictMode double-invoke
- [ ] Named exports only (no default export)

---

## Anti-Patterns

- Do not call `getUserMedia()` in the `useEffect` body on mount — initial state is `PROMPT`
- Do not store `MediaStream` in `useState` — stale closure will restart the stream on re-render
- Do not assume `navigator.permissions` exists in Safari — always try/catch
- Do not use `any` for `DOMException` — use `instanceof DOMException` and check `e.name`
- Do not leave `permissionStatus.onchange` or `devicechange` listeners attached after unmount
- Do not use `eslint-disable` comments — Biome is the linter; if Biome flags it, fix it
- Do not use `npm test` — use `pnpm vitest run`

---

## No Prior Knowledge Test

- [x] `src/engine/paramStore.ts` exists as MIRROR file — confirmed by D38 folder structure (created in Task 1.1)
- [x] All D-numbers cited exist in DISCOVERY.md
- [x] Implementation Tasks are topologically sorted (types → hook → tests — no forward dependency)
- [x] Validation Loop commands are copy-paste runnable (no angle-bracket placeholders)
- [x] Task is atomic — does not require knowledge from Task 1.3+ to implement
- [x] MIRROR file exists or will exist when prior tasks complete — Task 1.1 scaffold creates `paramStore.ts`

---

## Skills to Read Before Starting

```
.claude/orchestration-hand-tracker-fx/skills/framework-tooling.md
```

---

---

## Deliverable 5 — CLAUDE.md / agents.md Snippet

Append this section to the project root `CLAUDE.md`. Do not replace the file — append.

---

## PRP Methodology and Ralph Loop

### How Task Files Work

Every implementation task in this project has a dedicated task file at:

`.claude/orchestration-hand-tracker-fx/tasks/phase-N/task-N-M.md`

Each task file is a self-contained PRP (Product Requirements Prompt) — a structured context packet designed so an autonomous agent can implement the task in a single pass without asking clarifying questions. The format is defined at:

`.claude/orchestration-hand-tracker-fx/research/prp-task-format-impl.md`

Task files include:

1. **Goal / User Persona / Why** — motivation and acceptance definition
2. **All Needed Context** — YAML block with exact file paths, doc URLs, skill names, and DISCOVERY.md D-numbers; each with `why:` and `gotcha:` fields
3. **Implementation Blueprint** — ordered subtasks with exact file paths, MIRROR references, function signatures, and data shapes
4. **Validation Loop** — four runnable levels (see below)
5. **Anti-Patterns** — explicit list of what NOT to do
6. **No Prior Knowledge Test** — self-check confirming the task file is self-sufficient before running Ralph

### The Four Validation Levels

Every task file specifies exact runnable commands at four levels:

| Level | Name | Commands |
|-------|------|----------|
| L1 | Syntax and Style | `pnpm biome check <paths>` + `pnpm tsc --noEmit` |
| L2 | Unit Tests | `pnpm vitest run <test-file>` |
| L3 | Integration | `pnpm build` (production build must succeed) |
| L4 | E2E | `pnpm test:e2e -- --grep "<Task N.M>"` |

**Golden Rule**: Never accumulate broken state. Fix L1 failures before writing the next file.

### How Ralph Loop Works

Ralph is an autonomous iteration mode. When a task is given to a Ralph agent:

1. Agent reads the task file and the state file (`.claude/prp-ralph.state.md`)
2. Implements the task, running L1 after each file write
3. Runs all four validation levels
4. If any level fails, reads the error, fixes the issue, and re-runs
5. Appends a structured Progress Log entry to the state file after every iteration
6. When ALL four levels exit 0, emits `<promise>COMPLETE</promise>` and the stop hook releases the session

The stop hook lives at `.claude/hooks/prp-ralph-stop.sh` and is configured in `.claude/settings.local.json`:

```json
{
  "hooks": {
    "Stop": [{ "hooks": [{ "type": "command", "command": ".claude/hooks/prp-ralph-stop.sh" }] }]
  }
}
```

The Ralph loop prompt (injected each iteration by the stop hook) lives at:

`.claude/orchestration-hand-tracker-fx/ralph-loop-prompt.md`

### Workflow for Executing a Task

```
1. Human: "Execute task 1.2"
2. Agent: reads task file, DISCOVERY.md, referenced skill files
3. Agent: creates .claude/prp-ralph.state.md with iteration: 1
4. Agent: implements → runs all 4 levels → fixes failures → loops
5. Agent: emits <promise>COMPLETE</promise> when all pass
6. Agent: commits with "Task 1.2: Implement getUserMedia state machine hook"
            Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
7. Human: merges task/1-2-usecamera-state-machine to main
```

### State File Location

`.claude/prp-ralph.state.md` — created fresh for each Ralph run, deleted on clean completion, archived to `.claude/PRPs/ralph-archives/YYYY-MM-DD-{task-name}/` for reference.

### Max Iterations by Task Complexity

| Complexity | Max Iterations | Example Tasks |
|------------|----------------|---------------|
| Low | 10 | Config changes, type definitions, simple utilities |
| Medium | 20 | Hooks, components, shader files, single-domain modules |
| High | 30 | Full pipeline integration, multi-file features, E2E wiring |

### Naming Convention for E2E Tests

Every Playwright test for a task is named `"Task N.M: <task description>"`. This ensures the `--grep "Task 1.2"` filter in L4 resolves to exactly the right test.

### Patterns Discovered via Ralph

*(This section is updated after each completed Ralph run. Permanent patterns — not iteration-specific details — are recorded here for all future agents.)*

---

---

## Recommended Approach

1. Copy the task-file template (Deliverable 1) to `.claude/orchestration-hand-tracker-fx/tasks/phase-N/task-N-M.md` for each new task and fill in every placeholder. No `<angle-bracket>` tokens should survive in a finalized task file.
2. Run the No Prior Knowledge Test checklist before handing any task file to a Ralph agent.
3. Configure the stop hook in `.claude/settings.local.json` before Phase 1 begins (one-time setup). The hook script must be copied to `.claude/hooks/prp-ralph-stop.sh` and made executable (`chmod +x`).
4. Use Task 1.2 (Deliverable 4) as the worked example reference for what a complete, populated task file looks like.
5. After each Ralph completion, check `.claude/PRPs/ralph-archives/` and add any permanent patterns to the "Patterns Discovered via Ralph" section of CLAUDE.md.
6. Use `max_iterations: 20` for all Medium-complexity tasks in Phase 1. Increase to 30 only for tasks involving multi-service wiring (MediaPipe + OGL + Tweakpane wired together in a single task).

---

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Use upstream `prp_base_typescript.md` verbatim | Zero adaptation work | References Next.js App Router (RSC, 'use client'), uses `npm test`, ESLint — all wrong for this Vite SPA | Rejected — adapted |
| Single monolithic task file per phase | Less file overhead | Too large for single Ralph context window; validation loops ambiguous about which files to check | Rejected |
| Inline Ralph prompt in the stop hook bash script | One fewer file | Complex markdown in bash heredoc is fragile | Rejected — keep `ralph-loop-prompt.md` as separate file |
| Use Husky + lint-staged as L1 | Runs on every commit automatically | Adds dev dependency; stop hook pattern is file-read-based, not git-hook-based | Rejected |
| Skip L3 build check for simple hooks | Faster iteration | Production build catches tree-shaking and Vite/esbuild issues that `tsc --noEmit` misses | Rejected — L3 required |

---

## Pitfalls and Edge Cases

- **Placeholder survival**: The most common Ralph failure mode is a task file with `<path>` or `{runner}` placeholders in validation commands. Agent tries to run them literally and gets a shell error on iteration 1. Grep for `<` and `{` before the task file goes live.
- **MIRROR file does not exist yet**: If a task's MIRROR file is created by an earlier task in the same phase, note this explicitly: "MIRROR: src/engine/paramStore.ts — created by Task 1.1; ensure Task 1.1 is complete before running Ralph on this task."
- **Stop hook not configured**: Without the Stop hook in `.claude/settings.local.json`, Ralph runs as a one-shot with no iteration. Configure the hook before Phase 1 begins.
- **Biome auto-fix vs check**: `pnpm biome check --write` auto-fixes; `pnpm biome check` check-only. The validation loop must use `check` (not `--write`) so exit code reflects real errors. Use `--write` interactively during development.
- **`pnpm tsc --noEmit` vs `pnpm build`**: Vite uses esbuild for production transforms and does NOT run tsc as part of `pnpm build` by default. Configure `vite-plugin-checker` or a pre-build `tsc --noEmit` script so L1 tsc and L3 build errors are consistent.
- **Playwright fake device on macOS**: `--use-fake-device-for-media-stream` requires launching Chrome (not WebKit or Firefox). The Playwright config must set `channel: 'chrome'` or provide a real Chrome `executablePath`.
- **Max iterations exhausted with no COMPLETE**: If Ralph hits `max_iterations`, it exits without completing. Check `.claude/PRPs/ralph-archives/` for the last `state.md` to understand where it stopped and why.
- **E2E test grep mismatch**: If the Playwright test name doesn't match the `--grep` pattern in L4, the test suite reports zero tests found and exits 0 — a false green. Always use the exact `"Task N.M:"` prefix convention.

---

## References

- https://github.com/Wirasm/PRPs-agentic-eng — primary source; all templates fetched live from this repo on 2026-04-14
- https://github.com/Wirasm/PRPs-agentic-eng/blob/main/old-prp-commands/PRPs/templates/prp_base_typescript.md — TypeScript PRP template v3 (direct basis for Deliverable 1)
- https://github.com/Wirasm/PRPs-agentic-eng/blob/main/.claude/commands/prp-core/prp-ralph.md — official Ralph loop command (4-phase spec)
- https://github.com/Wirasm/PRPs-agentic-eng/blob/main/.claude/commands/prp-core/prp-implement.md — implement command (6-phase spec)
- https://ghuntley.com/ralph/ — original Ralph Wiggum technique (source of Ralph loop concept)
- `/Users/kevin/.claude/skills/prp-ralph-loop/SKILL.md` — local prp-ralph-loop skill (iteration behavior protocol)
- `.claude/orchestration-hand-tracker-fx/DISCOVERY.md` — all project decisions cited via D-numbers
- `.claude/orchestration-hand-tracker-fx/research/prp-methodology-and-web-best-practices.md` — first-wave PRP + web best practices synthesis

---

## Second Wave Additions

### Implementation Details

The upstream `prp-ralph-stop.sh` hook parses the state file YAML frontmatter using `jq` and `sed` (both standard on macOS). It checks for `<promise>COMPLETE</promise>` in the last assistant message of the transcript JSON, injected by the Claude Code harness as `$.transcript_path` in the hook's stdin. No additional tooling is required beyond what is in the standard macOS dev environment.

**One required human action before Phase 1**: Copy or write `prp-ralph-stop.sh` to `.claude/hooks/prp-ralph-stop.sh` in this project and make it executable:

```bash
chmod +x .claude/hooks/prp-ralph-stop.sh
```

The stop hook script (from upstream, adapted):

```bash
#!/usr/bin/env bash
# .claude/hooks/prp-ralph-stop.sh
# Reads transcript JSON from stdin, checks for COMPLETE promise.
# If found: exits 0 (allows Claude session to close).
# If not found: exits 1 (blocks session close; Claude restarts iteration).

set -euo pipefail

INPUT=$(cat)
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')

if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  exit 0  # No transcript available; allow close
fi

LAST_ASSISTANT=$(jq -r '[.[] | select(.role == "assistant")] | last | .content // ""' "$TRANSCRIPT_PATH" 2>/dev/null || echo "")

if echo "$LAST_ASSISTANT" | grep -q '<promise>COMPLETE</promise>'; then
  # Archive and clean up state file if present
  if [ -f ".claude/prp-ralph.state.md" ]; then
    PLAN_PATH=$(grep -m1 'plan_path:' .claude/prp-ralph.state.md | sed "s/.*plan_path: *['\"]//;s/['\"].*//")
    STARTED=$(grep -m1 'started_at:' .claude/prp-ralph.state.md | sed "s/.*started_at: *['\"]//;s/['\"].*//;s/T.*//" || date +%Y-%m-%d)
    TASK_NAME=$(basename "$PLAN_PATH" .md 2>/dev/null || echo "unknown")
    ARCHIVE_DIR=".claude/PRPs/ralph-archives/${STARTED}-${TASK_NAME}"
    mkdir -p "$ARCHIVE_DIR"
    cp .claude/prp-ralph.state.md "$ARCHIVE_DIR/state.md" 2>/dev/null || true
    [ -f "$PLAN_PATH" ] && cp "$PLAN_PATH" "$ARCHIVE_DIR/plan.md" 2>/dev/null || true
    rm -f .claude/prp-ralph.state.md
  fi
  exit 0  # Allow session to close — loop complete
fi

# Increment iteration counter in state file if present
if [ -f ".claude/prp-ralph.state.md" ]; then
  CURRENT_ITER=$(grep -m1 '^iteration:' .claude/prp-ralph.state.md | awk '{print $2}' || echo "1")
  MAX_ITER=$(grep -m1 '^max_iterations:' .claude/prp-ralph.state.md | awk '{print $2}' || echo "20")
  NEXT_ITER=$((CURRENT_ITER + 1))

  if [ "$NEXT_ITER" -gt "$MAX_ITER" ]; then
    echo "Ralph loop: max_iterations ($MAX_ITER) reached. Allowing session to close." >&2
    exit 0
  fi

  sed -i.bak "s/^iteration: $CURRENT_ITER$/iteration: $NEXT_ITER/" .claude/prp-ralph.state.md
  rm -f .claude/prp-ralph.state.md.bak
fi

exit 1  # Block session close — continue loop
```

### Tool and MCP Configuration

| Tool/Service | Purpose | Setup Required | Agent Can Self-Configure? |
|-------------|---------|----------------|---------------------------|
| Playwright MCP | L4 E2E tests on localhost | Already configured per CLAUDE.md | Yes |
| `prp-ralph-stop.sh` stop hook | Ralph iteration control | Write to `.claude/hooks/` + chmod +x; add to `.claude/settings.local.json` | Yes (agent can write both files in Task 1.1) |
| `pnpm biome check` | L1 lint + format | Installed as devDependency in Task 1.1 scaffold | Yes |
| `pnpm tsc --noEmit` | L1 type check | TypeScript installed in scaffold | Yes |
| `pnpm vitest run` | L2 unit tests | Vitest installed in scaffold | Yes |
| `pnpm test:e2e` | L4 E2E | Playwright installed in scaffold; `test:e2e` script added to package.json | Yes (agent adds script in scaffold task) |

### Testing Strategy

For a task file to be Ralph-ready, the L4 E2E test name must match the `--grep` pattern exactly. Convention: every Playwright test for a task is named `"Task N.M: <task description>"` so that `--grep "Task 1.2"` resolves to exactly the right test file.

Test assets for camera-related tasks:

- Chrome `--use-fake-device-for-media-stream` flag — synthetic webcam without real hardware; configured in Playwright project settings
- `browserContext.grantPermissions(['camera'])` — simulates user grant
- `browserContext.clearPermissions()` + Chrome launch arg `--deny-permission-prompts` — simulates user denial

### Human Actions Required

| Action | Who | How | Status |
|--------|-----|-----|--------|
| Write `prp-ralph-stop.sh` to `.claude/hooks/` and `chmod +x` | Agent (Task 1.1 scaffold) | Write file from this document's script + chmod | Pending |
| Add Stop hook entry to `.claude/settings.local.json` | Agent (Task 1.1 scaffold) | Write JSON config | Pending |
| Verify Playwright can launch Chrome with fake device on macOS | User | Run `pnpm test:e2e` after Task 1.1 scaffold completes | Pending |
