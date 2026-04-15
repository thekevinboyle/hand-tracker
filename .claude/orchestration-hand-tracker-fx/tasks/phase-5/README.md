# Phase 5 — Deploy + Comprehensive E2E

**Phase goal**: Vercel live; CI green on preview URL; all 8 D23 error states covered with forced-failure Playwright specs; final visual-fidelity gate against `reference-assets/touchdesigner-reference.png`; tag `v0.1.0`.

**Source**: `.claude/orchestration-hand-tracker-fx/PHASES.md` — Phase 5.

**Authority**: DISCOVERY.md overrides this directory. D23 (8 states), D31 (Vercel headers + CSP), D33 (self-hosted model + wasm), D39 (GitHub remote created at first deploy), D41 (PRP + 4-level validation), D42 (final phase runs against Vercel preview).

## Task index

| Task | Title | Complexity | Max Ralph iterations |
|---|---|---|---|
| 5.1 | Service worker for `/models/*` and `/wasm/*` cache | Low | 10 |
| 5.2 | GitHub remote + Vercel link + first deploy (human-assisted) | Medium | 20 |
| 5.3 | CI: full pipeline in GitHub Actions + preview E2E | Medium | 20 |
| 5.4 | E2E for all 8 error states with forced failures | High | 30 |
| 5.5 | Visual-fidelity gate against reference screenshot | Medium | 20 |
| 5.R | Final cut: tag v0.1.0, README polish, CHANGELOG, archive state | Low | 10 |

## Execution order

Strict: 5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 5.R. Each task depends on the previous one being merged to `main` and CI green.

## Running Phase 5 tasks

- Regular Ralph: each task file's L1–L4 Validation Loop is copy-paste runnable locally.
- Post-deploy (5.3 onward): `PLAYWRIGHT_BASE_URL=https://<preview>.vercel.app pnpm test:e2e` runs the suite against the live URL.
- Human steps in 5.2 are marked `HUMAN:` — agent must pause and prompt the user.

## Artifacts produced

- `public/sw.js`, `src/app/registerSW.ts` (5.1)
- `.github/workflows/ci.yml`, `.github/workflows/e2e-preview.yml` (5.3)
- `tests/e2e/error-states.spec.ts` (5.4)
- `reports/phase-5-deploy.md` (5.2)
- `reports/phase-5-visual-fidelity.md`, `reports/phase-5-visual-fidelity.png`, `reports/phase-5-reference-side-by-side.png` (5.5)
- `CHANGELOG.md`, `README.md` polish, git tag `v0.1.0`, `reports/prp-ralph-final.md` (5.R)

## Cross-cutting skills

Every Phase 5 task reads, at minimum:

- `.claude/skills/prp-task-ralph-loop/SKILL.md`
- `.claude/skills/hand-tracker-fx-architecture/SKILL.md`
- `.claude/skills/vite-vercel-coop-coep/SKILL.md`
- `.claude/skills/playwright-e2e-webcam/SKILL.md`

Per-task skill lists live inside each task file.
