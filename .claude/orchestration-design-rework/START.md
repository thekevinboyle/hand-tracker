# Hand Tracker FX Design-Rework Orchestrator

When `/start` is invoked (or when a new session resumes this orchestration), this document defines how the main agent spawns execution subagents for the 24 task files in Phases DR-6 through DR-9. Designed for fully autonomous Ralph-loop execution.

---

## Startup Sequence

1. **Read `/Users/kevin/Documents/web/hand-tracker/PROGRESS.md`** — determine which DR-* tasks are `done`, which are `pending`, which phase is active
2. **Read `.claude/orchestration-design-rework/PHASES.md`** — load the full 24-task plan
3. **Identify next task** — the lowest-numbered pending task whose dependencies (per PHASES.md dependency graph) are all `done`
4. **Spawn execution subagent** (see below)
5. **After task completes**:
   - Verify PROGRESS.md was updated by the subagent
   - Verify the task's branch is fast-forward-merged to `main`
   - If `failed`: escalate per the Failure Handling section
   - Otherwise repeat from step 3
6. **Phase transition** — after a `DR-N.R` regression task passes, update the Phase Overview table in PROGRESS.md and announce phase completion before starting the next phase

---

## Spawning an Execution Subagent

For each task, spawn a `general-purpose` subagent via the `Agent` tool. Prompt template:

```
You are executing Task DR-N.M for the Hand Tracker FX design rework.

## Your task file

Read your full task specification at:
  .claude/orchestration-design-rework/tasks/phase-DR-N/task-DR-N-M.md

This file is the complete, self-contained PRP. It includes objective, context,
dependencies, files to create/modify, acceptance criteria, all 4 PRP validation
levels with concrete commands, known gotchas, and anti-patterns.

## Execution protocol (Ralph loop — follow the `prp-task-ralph-loop` skill)

### Phase 0: Orient
- Read PROGRESS.md at /Users/kevin/Documents/web/hand-tracker/PROGRESS.md
- Confirm this task is the next pending task and its dependencies are `done`
- Read your task file end-to-end
- Read every skill listed in your task's "Skills to Read" section
- Read the relevant research files at `.claude/orchestration-design-rework/research/`
- Read `.claude/orchestration-design-rework/DISCOVERY.md` — this is the top
  authority. If any conflict with the task file or a skill arises, DISCOVERY wins.

### Phase 1: Explore & Plan
- Explore the codebase at `/Users/kevin/Documents/web/hand-tracker/`
- Read the files the task will modify; understand current state
- Plan your approach in a Ralph state file at:
    .claude/prp-ralph.state.md
  (Follow the schema in the `prp-task-ralph-loop` skill.)

### Phase 2: Implement
- Create a feature branch: `task/DR-N-M-<kebab-description>` from `main`
- Write code following existing project conventions (pnpm, Biome, Vitest, Playwright)
- Write tests alongside code (TDD-friendly; see `test-driven-development` skill)
- Use tokens from `src/ui/tokens.css` — NEVER hardcode hex/px values
- Preserve every existing testid (listed in DISCOVERY §7)

### Phase 3: Validate (all 4 PRP levels in order)
- L1: `pnpm biome check <paths> && pnpm tsc --noEmit`  — MUST be zero errors
- L2: `pnpm vitest run <unit-paths>`                   — MUST be all passing
- L3: `pnpm build --mode test`                         — MUST build clean
- L4: `pnpm test:e2e --grep "Task DR-N.M:"`            — MUST be all passing
- If any level fails: diagnose root cause, fix, increment Ralph iteration, retry
- Maximum 5 Ralph iterations per task — escalate beyond that

### Phase 4: Complete
- Update PROGRESS.md:
    - Set status to `done`
    - Add branch name, date, iteration count, test counts, brief notes
- Commit on the feature branch with message prefix `Task DR-N.M: <description>`
    - Trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- Fast-forward merge to `main` (no --force, no --no-verify)
- Emit `<promise>COMPLETE</promise>` at end of response

## Never do
- Never false-COMPLETE (don't claim `done` without all 4 levels green)
- Never `--no-verify`, never `--force-push`
- Never edit `src/engine/`, `src/effects/`, `src/camera/`, `src/tracking/`
  (except reads; DISCOVERY §8 locks these. DR-8.6 deletes `buildPaneFromManifest.ts`
  and DR-8.3 deletes `ModulationPanel.ts` — those are explicitly permitted.)
- Never skip a failing test — diagnose and fix the root cause
```

---

## Regression Task Variation (`DR-N.R`)

Regression tasks also add this wrapper instruction:

```
This is a REGRESSION task for Phase DR-N. After implementing:

1. Deploy to preview environment:
   - `pnpm build --mode test && pnpm preview` (local), or
   - `vercel deploy` (live preview URL)
2. Run ALL specs from this phase PLUS every prior phase's aggregate:
   - Parent: tests/e2e/phase-{1,2,3,4}-regression.spec.ts
   - This rework: tests/e2e/DR-{6,7,8}-regression.spec.ts (as they land)
3. Perform manual Playwright MCP walkthrough of the GRANTED user journey
4. Capture screenshots at `reports/DR-N-regression/step-*.png` (gitignored)
5. Capture reference screenshot at canonical viewport if called for
   (DR-8.R captures `reports/DR-8-regression/design-rework-reference.png`
    — this becomes the visual-fidelity target for DR-9.3)
6. Write `reports/DR-N-regression.md` with SHIP / HOLD decision + evidence
7. All 45 (+ newly added) aggregate E2E specs must pass before SHIP
```

---

## Final-Phase Variation (`DR-9.R` — final cut)

```
This is the FINAL task. It produces the v0.1.0 release artifact.

1. Verify every DR-* task is `done` in PROGRESS.md
2. Verify parent Phases 5.3/5.4/5.5 map to DR-9.1/9.2/9.3 and are done
3. Archive TouchDesigner reference:
   `git mv .claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png \\
          .claude/orchestration-hand-tracker-fx/reference-assets/_historical/`
4. Write CHANGELOG.md at repo root (Keep-a-Changelog format)
5. Update PROGRESS.md to mark every task done (32 parent + 24 DR = 56 total)
6. Update CLAUDE.md to add a "Design Rework" section pointing at
   `.claude/orchestration-design-rework/`
7. Tag: `git tag -a v0.1.0 -m "v0.1.0 — pixelcrash-inspired design rework"`
8. Push tag: `git push --tags`
9. Create GitHub Release: `gh release create v0.1.0 --latest --notes-file CHANGELOG.md`
10. Smoke-test the live URL with `PLAYWRIGHT_BASE_URL=https://hand-tracker-jade.vercel.app pnpm test:e2e --grep "Task DR-9.3:"`
11. Archive Ralph state: move `.claude/prp-ralph.state.md` to
    `reports/prp-ralph-final.md`
```

---

## Available Tools (for execution subagents)

| Tool | Purpose |
|---|---|
| **Read, Edit, Write, Glob, Grep, Bash** | Standard editing + shell |
| **Playwright MCP** | Browser testing (localhost + live Vercel URL), manual visual verification via `browser_*` tools |
| **context7 MCP** | Library documentation (MediaPipe, ogl, Tweakpane-retirement reference, Vite, React, TypeScript) |
| `pnpm` | Package manager (never npm/yarn) |
| `pnpm biome check` / `pnpm tsc --noEmit` | L1 |
| `pnpm vitest run` | L2 |
| `pnpm build --mode test` | L3 |
| `pnpm test:e2e --grep "Task DR-N.M:"` | L4 |

---

## Orchestrator Rules

### Execution order
- Sequential only within a phase (one task at a time)
- Phase DR-7 primitives (7.1 through 7.7) can parallelize ONLY if the orchestrator is confident merge conflicts are unlikely — each primitive is in its own file under `src/ui/primitives/`, so practically they are mergeable. Default: sequential for safety.
- Phase DR-9.1/9.2/9.3 can parallelize (each targets a distinct concern: CI, stubs, visual gate). DR-9.R must be last.
- Regression tasks are always last in their phase
- Complete all tasks in a phase before starting the next phase

### Dependency checking
- Before spawning, re-read PROGRESS.md to confirm blockers are `done`
- The only true blockers are prior tasks not being complete
- If a task's task file references a skill that doesn't exist yet, the task's agent should log it in the Ralph state file and proceed using DISCOVERY.md + research files as the fallback (already documented in the DR-6.x task files)

### Failure handling (3-tier escalation)

**Tier 1 — Subagent self-recovery (automatic, inside Ralph loop)**
- Diagnose error from L1–L4 output
- Apply fix, increment Ralph iteration counter
- Re-run ALL four validation levels (not just the failed one)
- Repeat up to 5 iterations

**Tier 2 — Orchestrator intervention (if agent exits non-green after 5 iterations)**
- Read the `.claude/prp-ralph.state.md` file + task output
- Spawn a targeted fix subagent with the specific diagnostic + fix
- Re-run the original task after the fix

**Tier 3 — User escalation (last resort)**
- Provide: task number, what was attempted, the error, suggested fix
- Continue with next unblocked task while waiting for user decision

### Session boundaries
- PROGRESS.md enables session continuity — any fresh session reads it first
- If context is getting large, the orchestrator reports progress and suggests starting a fresh session
- All state lives in files; nothing is lost between sessions

---

## File Locations

| File | Path | Purpose |
|---|---|---|
| Master plan | `.claude/orchestration-design-rework/PHASES.md` | All 24 tasks, skills, testing, phases |
| Orchestrator | `.claude/orchestration-design-rework/START.md` | This file |
| Discovery | `.claude/orchestration-design-rework/DISCOVERY.md` | Top authority (19 decisions) |
| PRD | `.claude/orchestration-design-rework/PRD.md` | Vision |
| Research | `.claude/orchestration-design-rework/research/` | 2 files: pixelcrash spec + current UI audit |
| Task files | `.claude/orchestration-design-rework/tasks/phase-DR-{6,7,8,9}/task-DR-N-M.md` | Per-task PRP specs |
| Reports | `.claude/orchestration-design-rework/reports/` | synergy-review, synergy-fixes-applied, phase regressions |
| Progress | `PROGRESS.md` (repo root) | Task status tracker |
| Skills | `.claude/skills/` | Project + design-rework skills |
| Parent orchestration | `.claude/orchestration-hand-tracker-fx/` | Historical; engine decisions still authoritative |

---

## Key conventions (inherit from parent)

- **Branch naming**: `task/DR-N-M-<kebab-description>` (e.g. `task/DR-6-1-design-tokens`)
- **Commit prefix**: `Task DR-N.M: <description>`
- **Commit trailer**: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- **E2E describe prefix**: `describe('Task DR-N.M: …')` so `pnpm test:e2e --grep "Task DR-N.M:"` resolves correctly
- **No collision with parent** — the parent uses `Task N.M:` (no `DR-`). `grep "Task DR-"` matches this rework only.

---

## Pre-flight checklist (run ONCE before spawning the first subagent)

- [ ] `PROGRESS.md` has the DR-* task rows appended (Phase 12 artifact)
- [ ] `CLAUDE.md` has a "Design Rework" pointer section (Phase 12 artifact)
- [ ] All 24 task files exist under `tasks/phase-DR-{6,7,8,9}/`
- [ ] All 3 new skills exist under `.claude/skills/`
- [ ] `reports/synergy-fixes-applied.md` shows all CRITICAL + HIGH issues resolved
- [ ] Current git state is clean (`main` branch, no uncommitted changes not already understood)
- [ ] Dev server is NOT running (agents start fresh preview servers per Ralph iteration)
