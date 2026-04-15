# Hand Tracker FX — Orchestrator

When `/start` is invoked (or the user asks "continue execution"), this file describes how the main agent spawns per-task subagents and manages the pipeline through to v0.1.0.

---

## Startup Sequence

1. **Read** `PROGRESS.md` at the repo root → identify the current state
2. **Read** `.claude/orchestration-hand-tracker-fx/PHASES.md` → full plan (32 tasks, 5 phases)
3. **Identify next task**: lowest-numbered `pending` task whose Blocked-by deps are all `done`
4. **Spawn a subagent** scoped to that task (Ralph mode — see below)
5. **Verify** PROGRESS.md was updated, commit/merge landed, `<promise>COMPLETE</promise>` emitted
6. **Loop** from step 3 until all tasks are `done`

Do NOT execute tasks in parallel. Dependencies are mostly linear within a phase; a wrong ordering here corrupts state.

---

## Spawning a per-task Ralph subagent

For each task, spawn a `general-purpose` subagent via the Agent tool. The prompt template:

```
You are executing Task N.M for Hand Tracker FX in Ralph-loop mode.

## Read BEFORE starting (required, in order)
1. .claude/orchestration-hand-tracker-fx/tasks/phase-N/task-N-M.md  (your full spec)
2. PROGRESS.md  (confirm this task is next + dependencies are done)
3. .claude/orchestration-hand-tracker-fx/DISCOVERY.md  (top authority)
4. Every skill named in your task's "Skills to Read" field, each at .claude/skills/<name>/SKILL.md
5. Any research file referenced in your task's "All Needed Context" YAML (.claude/orchestration-hand-tracker-fx/research/)
6. The hand-tracker-fx-architecture skill (ALWAYS read first for orientation)
7. The prp-task-ralph-loop skill (Ralph protocol, validation commands, state file schema)

## Execution Protocol (Ralph loop — from prp-task-ralph-loop skill §3)

1. Orient: read everything above
2. Branch: `git checkout -b task/N-M-<slug> main` from latest main
3. Implement: follow the Implementation Blueprint in your task file exactly
4. Validate — run in order, stop on first failure:
   L1: `pnpm biome check <paths>` && `pnpm tsc --noEmit`
   L2: `pnpm vitest run <test paths listed in your task>`
   L3: task-specific (build / integration script / component test — see your task's L3 block)
   L4: `pnpm test:e2e --grep "Task N.M:"`
5. If any level fails: root-cause fix (no bypass, no skip, no comment-out). Update `.claude/prp-ralph.state.md` with iteration # + failed level + what was tried + next plan.
6. Loop until all 4 levels exit 0. Never false-COMPLETE. Respect the max-iteration budget (10/20/30 by complexity per the skill).
7. On success:
   - Update PROGRESS.md (task status `done`, branch name, date, notes)
   - Commit per D40: `Task N.M: <description>` with Co-Authored-By trailer
   - Merge feature branch to main (fast-forward)
   - Emit final message ending EXACTLY: `<promise>COMPLETE</promise>` on its own line
8. If max-iterations hit without success: escalate to the orchestrator; do NOT emit COMPLETE.

## Scope discipline
- DISCOVERY.md §12 enumerates explicit non-goals. Refuse any work outside scope.
- If the task file conflicts with DISCOVERY.md, DISCOVERY.md wins — note it in the state file and stop.
- Do NOT edit task files of OTHER tasks. If you discover a cross-task contract problem, write a note to the state file and stop (tier-2 escalation).

## Tools available
- Read, Write, Edit, Bash, Glob, Grep, TaskCreate/Update
- Playwright MCP (for manual visual verification via the browser_* tools)
- context7 MCP (live library docs)
- pnpm / node / git / ffmpeg / curl (via Bash)
```

---

## Regression task protocol (1.R, 2.R, 3.R, 4.R)

Same Ralph loop, but the L3+L4 scope widens:
- Run full `pnpm check` on a fresh `pnpm build && pnpm preview`
- Run every Playwright spec whose describe matches `Task N.*:` (the entire phase)
- Run Playwright MCP manual walkthrough per the regression task's spec
- Produce screenshots + markdown report in `reports/phase-N-*.{png,md}`

Any failure → create a hotfix task within the same phase → re-run regression.

---

## Final phase protocol (5.1–5.R)

- Use `PLAYWRIGHT_BASE_URL=<vercel preview url>` to target the live deploy
- 5.2 includes HUMAN steps — the subagent must stop and prompt for `vercel login` / `gh auth login` when those credentials are needed; all other steps it drives via Playwright MCP + CLI
- 5.5 captures the reference-comparison artifact at `reports/phase-5-visual-fidelity.png`
- 5.R tags `v0.1.0` only after all regression + L1–L4 green

---

## Failure Handling (3-tier)

**Tier 1 — Subagent self-recovery** (automatic inside Ralph loop): debug, fix root cause, retry. Update state file each iteration.

**Tier 2 — Orchestrator intervention**: if the subagent exits without `<promise>COMPLETE</promise>`:
1. Read the tail of `.claude/prp-ralph.state.md`
2. Identify the blocker
3. Spawn a **targeted fix subagent** scoped to just that problem
4. Re-run the original task

**Tier 3 — User escalation** (last resort): if tier 2 can't unstick within 3 iterations, stop and report to the human with: task number, what was attempted (last 3 state-file entries), the error, a suggested fix.

While waiting on tier-3 input, continue any task whose deps are still satisfied elsewhere in the graph. Most tasks are a linear chain so this rarely helps, but Phase 5.4's 8 error-state sub-specs can parallelize if 5.3 is done.

---

## Phase transitions

After a regression task passes:
1. Update PROGRESS.md Phase Overview row
2. Announce phase completion in the orchestrator's next message
3. Start Phase N+1 Task 1

---

## Session boundaries

All state is in files. A new session reads PROGRESS.md first and picks up where the last left off. No in-memory state matters. If context is getting large mid-session, finish the current task, then suggest compacting.

---

## File locations

| File | Path | Purpose |
|---|---|---|
| Orchestrator | `.claude/orchestration-hand-tracker-fx/START.md` | This file |
| Master plan | `.claude/orchestration-hand-tracker-fx/PHASES.md` | 32 tasks across 5 phases |
| Discovery (authority) | `.claude/orchestration-hand-tracker-fx/DISCOVERY.md` | All decisions (45 D-numbers) |
| Task files | `.claude/orchestration-hand-tracker-fx/tasks/phase-N/task-N-M.md` | Per-task PRP specs |
| Research | `.claude/orchestration-hand-tracker-fx/research/` | 13 research files |
| Skills | `.claude/skills/<name>/SKILL.md` | 9 skills |
| Progress | `PROGRESS.md` (repo root) | Task status tracker |
| Reports | `.claude/orchestration-hand-tracker-fx/reports/` | tool-verification, synergy-review, phase-N regression reports |
| Reference | `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png` | Visual fidelity target |
| Ralph state | `.claude/prp-ralph.state.md` (gitignored) | Per-iteration state for current subagent |
