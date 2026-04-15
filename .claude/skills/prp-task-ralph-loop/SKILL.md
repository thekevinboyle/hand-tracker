---
name: prp-task-ralph-loop
description: Use when executing ANY task file in Hand Tracker FX or writing new task files. Defines PRP task anatomy, 4-level validation loop commands, Ralph self-healing iteration protocol, state file schema, and max-iteration escalation thresholds.
---

# PRP Task + Ralph Loop — Hand Tracker FX

## Purpose

This skill is the operational contract for **every execution agent** working on Hand Tracker FX. It defines:

1. The exact shape of a task file (PRP — Product Requirements Prompt)
2. The 4-level validation loop commands every task must satisfy
3. The Ralph loop — the self-healing autonomous iteration protocol
4. The `.claude/prp-ralph.state.md` schema
5. Max-iteration thresholds and escalation rules
6. Anti-patterns that silently break the loop

**Read this skill FIRST, alongside `hand-tracker-fx-architecture`, before touching any code.**

## Top Authority

`/.claude/orchestration-hand-tracker-fx/DISCOVERY.md` overrides this skill. D40 (commit convention), D41 (PRP format), and D42 (phase regression) are the controlling decisions for everything below.

Source-of-truth research files (authoritative for template details):

- `.claude/orchestration-hand-tracker-fx/research/prp-methodology-and-web-best-practices.md`
- `.claude/orchestration-hand-tracker-fx/research/prp-task-format-impl.md` (Deliverables 1, 2, 3, 4)

---

## 1. Task File Anatomy

Every task file lives at `.claude/orchestration-hand-tracker-fx/tasks/phase-N/task-N-M.md` and MUST contain every section below, in order. This is the drop-in template from research/prp-task-format-impl.md Deliverable 1. Copy it verbatim and fill in every placeholder. No `<angle-bracket>` tokens may survive in a finalized task file.

### 1.1 Header

```markdown
# Task N.M: <imperative-verb description>

**Phase**: N — <Phase Name>
**Branch**: `task/N-M-<kebab-description>`
**Commit prefix**: `Task N.M:`
**Estimated complexity**: <Low | Medium | High>
**Max Ralph iterations**: <10 | 20 | 30>
```

### 1.2 Goal / User Persona / Why / What

- **Goal** — Feature Goal (one sentence, no "and"s), Deliverable (concrete artifact), Success Definition (validation command that exits 0 + visible browser behavior).
- **User Persona** — Target User, Use Case, User Journey (numbered steps), Pain Points Addressed.
- **Why** — bullet list of business/creative value, integration points with adjacent tasks, D-numbers from DISCOVERY.md that this task satisfies.
- **What** — 3-6 bullets of user-visible behavior and technical requirements.
  - **NOT Building (scope boundary)** — explicit list of items out of scope to prevent scope creep.
  - **Success Criteria** — checkbox list; each item should ideally map to a validation command.

### 1.3 All Needed Context (YAML block)

The heaviest section. Must answer: "Could an agent with zero prior knowledge of this codebase implement this task using only this file?" If not, add more context.

```yaml
files:
  - path: src/<existing-file>.ts
    why: <MIRROR this file's pattern / extract this helper / understand this interface>
    gotcha: <specific constraint, e.g. "cleanup must cancel rVFC/rAF under StrictMode">

urls:
  - url: https://<authoritative-doc-URL>
    why: <specific API method or section being used>
    critical: <version-specific caveat, e.g. "detectForVideo requires monotonic timestamps">

skills:
  - <skill-name-1>   # from .claude/skills/<name>/SKILL.md
  - <skill-name-2>

discovery:
  - D<N>: <one-line summary of the decision this task depends on>
```

Also include:

- **Current Codebase Tree** (relevant subset, fenced)
- **Desired Codebase Tree** (files this task adds or modifies, with one-line responsibility per file)
- **Known Gotchas** block (TypeScript comments with `// CRITICAL:` prefix — see section 2)

### 1.4 Implementation Blueprint

- **Data Models** — fenced TypeScript with new types/interfaces.
- **Implementation Tasks (ordered by dependency)** — YAML list. Each entry specifies:

```yaml
Task N: CREATE|MODIFY src/<path>/<filename>
  - IMPLEMENT: <exact function signatures, exported names>
  - MIRROR: src/<closest-existing-file> (lines N-M — <pattern name>)
  - NAMING: camelCase hooks, PascalCase components/types, kebab-case files
  - GOTCHA: <specific constraint>
  - VALIDATE: <exact command that exits 0 when this sub-step is correct>
```

- **Integration Points** — YAML block showing how this module wires into `paramStore`, `effectRegistry`, `handLandmarker`, `tweakpane`, `main.tsx`, etc.

### 1.5 Validation Loop (4 levels — exact commands)

The four levels are mandatory. Every task file fills in the concrete paths and greps. Placeholders (`<path>`, `{runner}`) MUST NOT survive into a finalized task file.

```bash
# Level 1 — Syntax & Style (run after EVERY file write)
pnpm biome check <paths>
pnpm tsc --noEmit

# Level 2 — Unit Tests (after implementation is wired up)
pnpm vitest run <unit-test-file>

# Level 3 — Integration (production build smoke; task-specific alternative
#   is a Playwright component test or an integration script)
pnpm build

# Level 4 — E2E (Playwright with --use-fake-device-for-media-stream)
pnpm test:e2e -- --grep "Task N.M:"
```

Rules:

- L1 runs after every file write — never batch writes and check at the end.
- L2 uses `vitest run` (not `vitest` which is watch mode).
- L3 defaults to `pnpm build`; a task may substitute a more targeted integration script if documented (e.g. a Playwright component test for a pure UI task).
- L4 Playwright tests are named with the exact prefix `Task N.M:` so `--grep "Task N.M:"` resolves to exactly the right test. A grep mismatch silently reports "0 tests found, exit 0" — a false green.

### 1.6 Final Validation Checklist

Three subsections of checkboxes:

- **Technical** — all 4 levels exit 0; full `pnpm vitest run`, `pnpm biome check .`, `pnpm tsc --noEmit`, `pnpm build` all green.
- **Feature** — success criteria met; manual browser test performed; StrictMode double-invoke produces no stream leak or duplicate rVFC registrations.
- **Code Quality** — no `any` types; no React state in render hot path; `track.stop()` in all stream cleanups; MIRROR pattern followed.

### 1.7 Anti-Patterns (task-level)

Explicit "Do not" list tailored to the task. Always include the universal ones from section 6.

### 1.8 No Prior Knowledge Test (self-check)

Checkbox list verifying the task file is self-sufficient before Ralph runs:

```markdown
- [ ] Every file path in `All Needed Context` exists in the codebase (or is created by this task — marked clearly)
- [ ] Every URL in `urls:` is reachable and points to the correct section
- [ ] Every D-number cited exists in DISCOVERY.md
- [ ] The Implementation Tasks list is topologically sorted — no task depends on a later task
- [ ] The Validation Loop commands are copy-paste runnable with no placeholders
- [ ] The MIRROR file exists in the codebase at the stated path (or is created by a prior completed task)
- [ ] The task is atomic — does not require knowledge from a future task file
```

### 1.9 Skills to Read Before Starting

Explicit path list of required skills. Always includes this skill (`prp-task-ralph-loop`) and `hand-tracker-fx-architecture`; add domain-specific skills (e.g. `mediapipe-hand-landmarker`) as needed.

```markdown
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/<domain-skill>/SKILL.md
```

---

## 2. Known Gotchas — Hand Tracker FX (copy into every task file's Known Gotchas block)

```typescript
// CRITICAL: React StrictMode runs useEffect twice in dev.
// All useEffect cleanups must be idempotent:
//   cancelAnimationFrame(rafId)
//   video.cancelVideoFrameCallback(rvfcId)
//   tracks.forEach(t => t.stop())
// Use a ref flag `isCancelled = true` to guard async state updates after cleanup.

// CRITICAL: MediaPipe detectForVideo() requires monotonically increasing timestamps.
// Pass performance.now() — never Date.now() — and never repeat the same value
// in the same frame. A repeated timestamp is a silent no-op.
// MediaPipe HandLandmarker runs on the MAIN THREAD only (GPU delegate).
// Do NOT attempt to move it to a Web Worker — the tasks-vision API does not
// support OffscreenCanvas handoff.

// CRITICAL: Biome v2 is the single linter + formatter (no ESLint, no Prettier).
// Run: pnpm biome check --write <paths>   (auto-fix during active development)
// Run: pnpm biome check <paths>           (check only — use this in validation loop)
// Never add eslint / prettier / eslint-* / prettier-* dependencies.

// CRITICAL: TypeScript strict is ON and `noExplicitAny: error` is configured.
// Using `any` is a BUILD FAILURE, not a warning. Use `unknown` and narrow,
// or import the correct library types. Never `// eslint-disable` or
// `// @ts-expect-error` as a workaround — fix the type.

// CRITICAL: pnpm, not npm or bun.
// All commands: pnpm install, pnpm run <script>, pnpm vitest run.
// Using `npm` or `npx` will create a package-lock.json that conflicts with
// pnpm-lock.yaml and breaks subsequent installs.

// CRITICAL: OGL Texture upload — set texture.image = videoEl AND
// texture.needsUpdate = true each frame BEFORE renderer.render().
// Without needsUpdate the GPU keeps the stale frame. Missing the assignment
// produces a black or frozen canvas.

// CRITICAL: Never store MediaStream in React state — use a ref.
// Storing in state triggers re-renders that restart the stream and break
// downstream video-frame consumers (MediaPipe, OGL texture).

// CRITICAL: This is a React 19 Vite SPA, not Next.js.
// Do NOT add 'use client' directives — there is no SSR/RSC boundary.
// Client-only APIs (getUserMedia, WebGL, MediaPipe) can be imported directly
// at module scope without boundary annotations.
```

---

## 3. Ralph Loop Protocol — the 7-step loop

Ralph is the autonomous self-healing iteration mode. The stop hook (configured in `.claude/settings.local.json`) re-injects the Ralph prompt every time the agent emits a Stop event, until the agent emits `<promise>COMPLETE</promise>` on its own line in its final message.

Execute these 7 steps in order, every iteration, no exceptions:

### Step a — Read Context (every iteration)

1. Read the task file at `plan_path` (from the state file frontmatter).
2. Read `.claude/prp-ralph.state.md` — check the **Codebase Patterns** section at the top for reusable patterns discovered in prior iterations, and the **Progress Log** at the bottom for prior failures.
3. Read every skill file listed in the task's `Skills to Read Before Starting` section.
4. Read `/.claude/orchestration-hand-tracker-fx/DISCOVERY.md` (at minimum the D-numbers cited in the task).
5. Run `git status` and `git diff --stat` — see what has already been changed in this run.

Starting blind wastes iterations.

### Step b — Implement per Blueprint

For each incomplete task in the Implementation Blueprint:

1. Read the MIRROR file referenced in the task — copy its file structure, export pattern, and TypeScript conventions exactly.
2. Implement the change.
3. Run Level 1 validation immediately after each file write — never batch file writes then check at the end.

### Step c — Run L1 → L2 → L3 → L4 in order

Run all four levels sequentially. **Stop at the first failure** — do not continue to higher levels when a lower level is failing. (Exception: if a level passes on its own but the task file requires both `pnpm biome check .` and `pnpm tsc --noEmit` in L1, run both before declaring L1 status.)

```bash
# L1
pnpm biome check src/
pnpm tsc --noEmit

# L2
pnpm vitest run

# L3
pnpm build

# L4
pnpm test:e2e -- --grep "Task N.M:"
```

### Step d — Diagnose + FIX root cause (not a bypass)

For each failing level:

1. Read the **full** error output — do not guess from the first line.
2. Identify the root cause — type error? missing import? test assertion? build config? browser behavior?
3. Fix the specific issue at its source.
4. Re-run the failing level (fast feedback), then re-run all four levels to confirm no regressions.

**Never bypass**: do not add `// @ts-expect-error`, do not comment out failing tests, do not disable Biome rules, do not catch-and-swallow errors. If a rule or test is genuinely wrong, escalate to the human — do not silently disable it.

### Step e — Update `.claude/prp-ralph.state.md`

After every iteration, append a Progress Log entry (schema in section 4). If a reusable, general pattern was discovered (not iteration-specific), also add it to the **Codebase Patterns** section at the TOP of the state file.

### Step f — Loop until all 4 levels exit 0

Emit a Stop event. The stop hook will re-inject the Ralph prompt. Return to Step a. Continue until all four validation levels exit 0.

### Step g — Emit completion promise

When — and only when — all four validation levels exit 0 AND all tasks in the Implementation Blueprint are complete:

1. Generate `.claude/PRPs/reports/task-N-M-report.md` per Deliverable 2 Step 7 of research/prp-task-format-impl.md.
2. Archive the run to `.claude/PRPs/ralph-archives/YYYY-MM-DD-task-N-M/` (copy state.md and task file).
3. Delete `.claude/prp-ralph.state.md`.
4. End the final message with exactly this, on its own line:

```
<promise>COMPLETE</promise>
```

**Never emit the completion promise if any validation level is still failing.** The Ralph loop is trust-based. Lying breaks the mechanism for every future run.

---

## 4. `.claude/prp-ralph.state.md` Schema

**Location**: `.claude/prp-ralph.state.md` (project-root `.claude/`, NOT inside `orchestration-hand-tracker-fx/`).

**This file is gitignored** — see `.gitignore` line: `.claude/prp-ralph.state.md`.

**Lifecycle**:

- Created by the agent on iteration 1.
- Read by the agent at the start of every subsequent iteration.
- Updated by the agent at the end of every iteration (Progress Log append; Codebase Patterns append if applicable).
- Deleted by the agent on clean completion (after archive copy to `.claude/PRPs/ralph-archives/YYYY-MM-DD-{task-name}/state.md`).

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
<!-- Add reusable, general patterns here. Future iterations read this first.
     Format: one bullet per pattern, starting with the file or domain context. -->
- (empty on first run — populated as patterns are discovered)

## Current Task
Execute task file at plan_path and iterate until all 4 validation levels exit 0.

## Plan Reference
.claude/orchestration-hand-tracker-fx/tasks/phase-N/task-N-M.md

## Instructions
1. Read the plan file — understand all tasks and validation requirements
2. Check Codebase Patterns section above — apply any prior learnings
3. Review the Progress Log below — what did prior iterations do?
4. Implement incomplete tasks, running L1 after each file write
5. Run ALL 4 validation levels: L1 (biome + tsc), L2 (vitest), L3 (build), L4 (e2e)
6. Fix any failures, re-run, update the Progress Log
7. When ALL levels exit 0: emit <promise>COMPLETE</promise>

## Progress Log

<!-- Append one entry per iteration. Never delete prior entries. -->

---
```

### Frontmatter Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `iteration` | int | Current iteration number; incremented by the agent at the end of each iteration. |
| `max_iterations` | int | Hard cap. Escalate to human if reached without completion. |
| `plan_path` | string (quoted) | Path to the task file being executed. Must be a `.md` file. |
| `input_type` | string | `"plan"` for a task file. `"prd"` if feeding a PRD for phase selection. |
| `started_at` | ISO 8601 string | Timestamp of iteration 1. Used in archive directory naming. |

### Progress Log Entry Schema (append every iteration)

```markdown
## Iteration {N} — {ISO timestamp}

### Completed this iteration
- {bullet}

### Validation Status
- L1 Biome: PASS | FAIL ({error summary if failing})
- L1 tsc: PASS | FAIL ({error count})
- L2 Vitest: PASS | FAIL ({X/Y tests passing})
- L3 Build: PASS | FAIL ({error summary})
- L4 E2E: PASS | FAIL ({test name + assertion that failed})

### Learnings
- {reusable pattern: "in this codebase, X is done by Y"}
- {gotcha: "never do Z because W"}

### Next Steps
- {specific remaining work}
- {specific blocker if any}

---
```

---

## 5. Max Iterations by Task Complexity

Every task file specifies `Max Ralph iterations` in its header. Pick the value using this rubric (from DISCOVERY.md D41 and research recommendation):

| Complexity | Max Iterations | Example Tasks |
|------------|----------------|---------------|
| **Low (simple)** | **10** | Config changes, type-only additions, simple utility functions, biome.json / tsconfig tweaks |
| **Medium** | **20** | Hooks, single components, shader files, single-domain modules, unit test suites |
| **High (complex)** | **30** | Multi-file features, MediaPipe + OGL + Tweakpane integration, E2E wiring across several modules |

**Escalation rule**: If the Ralph loop reaches `iteration == max_iterations` without emitting `<promise>COMPLETE</promise>`, the agent must:

1. Write a final Progress Log entry summarising the blocker.
2. Emit a final message describing what is stuck, what has been tried, and what specific human intervention is needed.
3. **Do NOT emit `<promise>COMPLETE</promise>`.** Let the loop terminate without the promise — the human will take over.

Do not quietly raise `max_iterations` mid-run. If the task is genuinely more complex than estimated, note that in the Progress Log and escalate; the human decides whether to bump the cap.

---

## 6. Universal Anti-Patterns (every task file inherits these)

These break the Ralph loop or the codebase. Never do any of these:

- Do not emit `<promise>COMPLETE</promise>` if any validation level is still failing. The loop is trust-based; lying breaks every future run.
- Do not mark a task "done" with a `// TODO` or `// FIXME` comment left in implementation code. TODOs are not completion.
- Do not comment out or `.skip()` failing tests to make L2 green. Fix the test or the code.
- Do not add `// biome-ignore` or `// @ts-expect-error` as a workaround for a type/lint error. Fix the underlying issue.
- Do not disable Biome rules in `biome.json` to make L1 green. If a rule is genuinely wrong for the project, escalate.
- Do not swallow errors with `try { ... } catch {}`. Every caught error must be logged, surfaced to the user, or explicitly rethrown.
- Do not commit with `--no-verify`. Hooks exist for a reason; if a hook fails, fix the underlying issue.
- Do not batch file writes then run L1 at the end. Run L1 after EACH file write — this catches type errors while the context is fresh.
- Do not store MediaStream in React state. Use a ref.
- Do not call `getUserMedia()` on mount. Initial state is always `PROMPT`; only call `getUserMedia()` on explicit user gesture.
- Do not repeat a MediaPipe `detectForVideo()` timestamp. It silently no-ops.
- Do not use `any` types. `noExplicitAny: error` is enforced.
- Do not use `npm` or `npx` or `bun`. Project is pnpm-only.
- Do not use ESLint or Prettier. Biome v2 is the single tool.
- Do not add `'use client'` directives. Vite SPA, no RSC boundary.
- Do not skip reading the state file at the start of each iteration.

---

## 7. Worked Example

The canonical fully-populated task file is **Task 1.2: Implement getUserMedia State Machine Hook**, produced as Deliverable 4 in:

`.claude/orchestration-hand-tracker-fx/research/prp-task-format-impl.md` (starting at the section `## Deliverable 4 — Worked Example: Task 1.2`)

When writing a new task file, open that worked example side-by-side and mirror the density and shape of each section. It shows:

- How to cite D-numbers in the Why and discovery: blocks
- How to shape a `files:` entry with `why:` + `gotcha:`
- How to write Known Gotchas as TypeScript-commented `// CRITICAL:` blocks
- How to shape Implementation Tasks with IMPLEMENT / MIRROR / NAMING / GOTCHA / VALIDATE
- How to fill in all 4 validation levels with concrete, runnable commands
- How to write a complete No Prior Knowledge Test checklist

---

## 8. Quick Reference — What to do when

| Situation | Action |
|-----------|--------|
| Starting a task for the first time | Read this skill + `hand-tracker-fx-architecture` + the task file + referenced skills + cited D-numbers. Create `.claude/prp-ralph.state.md`. |
| Resuming mid-task (state file exists) | Read state file Progress Log first. Apply Codebase Patterns. Continue from last incomplete work. |
| L1 fails | Stop. Read full `tsc` / `biome` output. Fix at source. Re-run L1 only. Then re-run all 4. |
| L2 fails | Read full vitest output. Identify which test + which assertion. Fix code or fix test (never skip). |
| L3 fails but L1 passed | Vite/esbuild caught something `tsc --noEmit` missed — typically a tree-shaking or import-resolution issue. Read full build output. |
| L4 fails | Check Playwright trace. Verify `--grep` pattern matches a real test. Verify `--use-fake-device-for-media-stream` is set in Playwright config. |
| Same error 2 iterations in a row | Try an alternative pattern. Re-check MIRROR file. Read state file's Codebase Patterns for prior insight. Document the blocker. |
| Hit max_iterations | Do NOT emit `<promise>COMPLETE</promise>`. Write final Progress Log entry. Describe blocker. Escalate to human. |
| All 4 levels exit 0 | Generate report → archive state → delete state → commit with `Task N.M: <description>` + `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>` → emit `<promise>COMPLETE</promise>` as the last line. |

---

## 9. Commit Convention (D40)

On clean completion, commit with this format (HEREDOC, never inline):

```bash
git commit -m "$(cat <<'EOF'
Task N.M: <imperative-verb description matching the task file title>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

Branch: `task/N-M-<kebab-description>` (created from `main`).
Merge: fast-forward to `main` after all 4 validation levels are green and the human reviews.

---

**End of skill. When in doubt, DISCOVERY.md wins. If DISCOVERY.md is silent, escalate to the human — do not guess.**
