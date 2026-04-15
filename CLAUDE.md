# Hand Tracker FX

TouchDesigner-style webcam hand-tracking video effects, running entirely in the browser. MVP ships one effect (hand-bounded mosaic + grid + dotted landmark blobs + XY-axis-modulated params); architected for N effects.

## Quick Reference

| What | Where |
|------|-------|
| **Top authority** | `.claude/orchestration-hand-tracker-fx/DISCOVERY.md` — 45 numbered decisions, overrides all other docs |
| **Implementation plan** | `.claude/orchestration-hand-tracker-fx/PHASES.md` — 32 tasks across 5 phases |
| **Progress tracker** | `PROGRESS.md` (repo root) — task status, phase status, blockers |
| **Task files** | `.claude/orchestration-hand-tracker-fx/tasks/phase-N/task-N-M.md` — per-task PRP specs |
| **Orchestrator** | `.claude/orchestration-hand-tracker-fx/START.md` — how to spawn per-task subagents |
| **Research** | `.claude/orchestration-hand-tracker-fx/research/` — 13 research files |
| **Reports** | `.claude/orchestration-hand-tracker-fx/reports/` — tool-verification, synergy reviews, phase regressions |
| **Reference image** | `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png` — visual fidelity target |

## Authority Rule

DISCOVERY.md overrides everything. If a research file, skill, task file, or this document contradicts DISCOVERY.md, follow DISCOVERY.md. If still unsure, ask the human.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 6 strict (`noUncheckedIndexedAccess`, `noImplicitOverride`) |
| Framework | React 19.2 |
| Build | Vite 8 (ESM, rolldown) |
| Package mgr | pnpm 10 (never npm/yarn) |
| Linter/formatter | Biome 2.4 (no ESLint/Prettier) |
| Unit tests | Vitest 4.1 + jsdom 25 + vitest-canvas-mock + @testing-library/react |
| E2E | Playwright 1.59 + Chromium w/ fake Y4M webcam |
| Hand tracking | `@mediapipe/tasks-vision` 0.10.34 HandLandmarker (main-thread, GPU delegate) |
| WebGL | ogl 1.0 (mosaic fragment shader, full-screen quad) |
| 2D overlay | Canvas 2D (grid + dotted blobs + labels, pre-composites the WebGL canvas for captureStream) |
| Params UI | Tweakpane 4.0 + @tweakpane/plugin-essentials |
| Modulation | bezier-easing 2.1 |
| Deploy | Vercel w/ COOP `same-origin` + COEP `require-corp` + full CSP |
| Assets | MediaPipe model (7.5 MB) + 6 wasm files (~52 MB) self-hosted under `public/` |

## Scope Constraints (DO NOT implement)

Mobile layout, light theme, audio, multi-hand, face detection, 3D, pre-recorded input, cloud processing, auth, analytics, telemetry, privacy-badge UI, pause UI, mobile notice, PWA beyond model/wasm caching, MIDI/keyboard params, FPS-overlay UI. See DISCOVERY.md §12.

## Git Workflow

- Feature branches from `main`: `task/N-M-<short-description>`
- Commit prefix: `Task N.M: <description>`
- Every commit ends with `Co-Authored-By: Claude Opus 4.6 (1M context)` trailer
- Never `--no-verify`, never `--force-push`, never commit secrets
- Fast-forward merge to `main` after all 4 validation levels pass

## Testing (PRP 4-level validation)

Every task file must include all four levels. The Ralph loop runs them in order and self-heals failures.

| Level | Command template | Purpose |
|---|---|---|
| L1 | `pnpm biome check <paths> && pnpm tsc --noEmit` | Syntax + style + types |
| L2 | `pnpm vitest run <unit-paths>` | Pure logic |
| L3 | task-specific (`pnpm build` / integration script / component test) | Cross-module wiring |
| L4 | `pnpm test:e2e -- --grep "Task N.M:"` | User-emulating browser flow |

Describe blocks in `tests/e2e/*.spec.ts` MUST start with `Task N.M:` so `--grep` matches them.

## Skills

Execution agents MUST read the relevant skills before starting a task. All at `.claude/skills/<name>/SKILL.md`.

| Skill | Read when |
|---|---|
| `hand-tracker-fx-architecture` | Any task — top-level orientation, folder structure, data flow, Stage.tsx evolution, Dev Hook Contract |
| `prp-task-ralph-loop` | Any task — task file anatomy, 4-level validation, Ralph protocol, state file schema |
| `mediapipe-hand-landmarker` | Camera/tracking, landmark schema, error mapping, GPU delegate |
| `webcam-permissions-state-machine` | `useCamera` hook, 8-state error UI, mirror source-of-truth |
| `ogl-webgl-mosaic` | Render loop, mosaic shader, region masking, video texture |
| `tweakpane-params-presets` | Params panel, modulation, preset persistence, chevron cycler |
| `vite-vercel-coop-coep` | Vite/Vercel config, security headers, CSP, service worker |
| `playwright-e2e-webcam` | Any L4 E2E, fake webcam Y4M, `__handTracker` dev hook |
| `vitest-unit-testing-patterns` | Any L2 unit test |

## MCP Servers

| Server | Purpose |
|---|---|
| Playwright | Browser testing, manual visual verification via `browser_*` tools, Vercel dashboard automation |
| context7 | Live library documentation lookup (MediaPipe, ogl, Tweakpane, Vite) |

## For Subagents

If you are a subagent spawned to execute a task:
1. Read your task file at `.claude/orchestration-hand-tracker-fx/tasks/phase-N/task-N-M.md` first
2. Read `PROGRESS.md` to confirm this task is next and deps are `done`
3. Read DISCOVERY.md (authority) and every skill listed in your task's "Skills to Read"
4. Follow the Ralph loop from the `prp-task-ralph-loop` skill — L1 → L2 → L3 → L4, root-cause fixes, update `.claude/prp-ralph.state.md` each iteration
5. On success: update PROGRESS.md, commit per the Git Workflow above, merge to main, emit `<promise>COMPLETE</promise>`
6. Never false-COMPLETE; never `--no-verify`; never bypass validation

Orchestrator protocol for spawning subagents sequentially: see `.claude/orchestration-hand-tracker-fx/START.md`.
