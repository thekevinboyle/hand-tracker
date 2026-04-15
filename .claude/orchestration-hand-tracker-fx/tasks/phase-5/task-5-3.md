# Task 5.3: Full GitHub Actions CI pipeline + preview-URL E2E workflow

**Phase**: 5 — Deploy + Comprehensive E2E
**Branch**: `task/5-3-ci-full`
**Commit prefix**: `Task 5.3:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal** — Stand up two GitHub Actions workflows that (a) run the full `pnpm check` + Playwright E2E suite on every push and PR to `main`, and (b) re-run the E2E suite against the Vercel preview URL every time a Vercel deployment reaches `success`.

**Deliverable** — Two workflow files:

- `.github/workflows/ci.yml` — PR gate + `main` push gate; full 4-level validation.
- `.github/workflows/e2e-preview.yml` — `on: deployment_status` trigger; runs E2E against the live preview URL with `PLAYWRIGHT_BASE_URL`.

Both workflows cache the MediaPipe model + wasm via `actions/cache` so cold-start is not a per-run penalty.

**Success Definition** —
1. A PR opened against `main` runs `ci.yml`; all jobs green in < 15 minutes.
2. A Vercel preview deployment completing triggers `e2e-preview.yml`; job runs; `crossOriginIsolated === true` asserted against the live URL.
3. Artifact uploads on failure: `playwright-report/` + optional `test-results/*.webm`.

---

## User Persona

**Target User** — Any contributor (human or agent) opening a PR against `main`, plus the Vercel deploy bot.

**Use Case** — Automated enforcement of the 4-level validation before merge; automated enforcement of live-URL correctness after deploy.

**User Journey**:

1. Agent or human pushes a branch → opens PR.
2. GitHub Actions runs `ci.yml` (typecheck + lint + unit + build + E2E). Fail-fast on L1.
3. PR merged to main → Vercel deploys prod.
4. Vercel fires `deployment_status` event with state `success` → `e2e-preview.yml` runs against the new URL.
5. On failure, an agent (or human) reads the uploaded HAR + video + trace artifacts.

**Pain Points Addressed** — Drift between local-preview behavior and Vercel's actual response; regressions caught post-merge without blocking merge speed.

---

## Why

- D41: 4-level validation is the contract; CI enforces it on every change.
- D42: Final phase runs E2E against Vercel preview URL; `e2e-preview.yml` is the deliverable.
- D32 + D33: Headers and self-hosted assets must work under real HTTP, not just `vite preview`. The preview workflow catches Vercel-only regressions.
- Unblocks Task 5.4 and 5.5, both of which rely on this CI scaffolding running their specs.

---

## What

User-visible behavior:

- Open PR → GitHub shows `CI / check` and `CI / e2e` status checks.
- Deploy completes → GitHub shows `E2E (preview) / chromium` status check tied to the deploy.
- Failing test uploads a zipped `playwright-report/` containing a trace.zip per failed case.

Technical requirements:

- `ci.yml` matrix: `ubuntu-latest` + Node 22. Single job (no matrix explosion).
- Separate steps: install, cache, typecheck, lint, unit, build, e2e.
- `actions/cache` for:
  - pnpm store (keyed on `pnpm-lock.yaml` hash)
  - Playwright browsers (`~/.cache/ms-playwright`, keyed on `@playwright/test` version)
  - MediaPipe assets (`public/models/hand_landmarker.task`, `public/wasm/**`, keyed on a constant or file hash)
- `ffmpeg` installed via apt before `pnpm test:setup`.
- `pnpm/action-setup@v4` runs BEFORE `actions/setup-node@v4` so node caching works.
- `e2e-preview.yml` fires on `deployment_status`; guards on `github.event.deployment_status.state == 'success'`.
- `PLAYWRIGHT_BASE_URL` set from `github.event.deployment_status.target_url`.
- Artifact upload on failure only (not on pass — artifacts cost storage).

### NOT Building (scope boundary)

- Windows or macOS runners — D21 + playwright-e2e-webcam skill mandate Ubuntu + Chromium only.
- Multiple Node versions — Node 22 only.
- Firefox / WebKit browsers in CI — scope constraint; reference browsers are tested manually.
- Required-status-check protection rules — configured in repo settings by HUMAN, not in this task.
- Secret management — no secrets needed; `PLAYWRIGHT_BASE_URL` comes from the event payload.
- Matrix sharding — suite is < 30 tests; single worker is fine (fake webcam is single-resource per skill §flakiness).

### Success Criteria

- [ ] `.github/workflows/ci.yml` exists, well-formed YAML
- [ ] `.github/workflows/e2e-preview.yml` exists, well-formed YAML
- [ ] First PR after merge triggers `ci.yml`; all steps green
- [ ] First Vercel deploy after merge triggers `e2e-preview.yml`; all steps green
- [ ] `pnpm store` cache hit on second run
- [ ] Playwright browser cache hit on second run
- [ ] `act -j check` (optional — local dry run) completes without error
- [ ] Failed test uploads `playwright-report/` artifact

---

## All Needed Context

```yaml
files:
  - path: package.json
    why: `packageManager: pnpm@10.32.1` pins the version; CI must install the same pnpm.
    gotcha: `pnpm/action-setup@v4` with `version: 10` picks the latest 10.x — good enough.

  - path: playwright.config.ts
    why: `webServer` is gated on `PLAYWRIGHT_BASE_URL`; when set, Playwright skips local build.
    gotcha: When CI sets PLAYWRIGHT_BASE_URL the `pnpm build && pnpm preview` step never runs locally, saving ~90s.

  - path: scripts/gen-fake-webcam.mjs
    why: ffmpeg-driven Y4M generator; `pnpm test:setup` invokes it.
    gotcha: CI must `apt-get install -y ffmpeg` before running; the Ubuntu runner does not ship ffmpeg preinstalled.

  - path: public/models/hand_landmarker.task
    why: Committed to repo (7.82 MB, under 50 MB GitHub soft limit).
    gotcha: No CI download step needed — it is in the checkout. Cache step exists only to avoid Playwright re-reading it (marginal win; keep for future-proofing against a migration to Git LFS).

  - path: .claude/skills/playwright-e2e-webcam/SKILL.md
    why: "GitHub Actions CI outline" section (lines 342-405) — mirror that shape.
    gotcha: The skill example is a single workflow combining push/pr/deployment_status; in THIS task we split into two files for clarity.

urls:
  - url: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#deployment_status
    why: Trigger behavior + payload schema.
    critical: `github.event.deployment_status.target_url` holds the preview URL. State can be `pending | success | failure | error | inactive` — we gate on `success`.

  - url: https://github.com/pnpm/action-setup
    why: Official pnpm action
    critical: Must run BEFORE setup-node so `cache: 'pnpm'` on setup-node works. Skill §"GitHub Actions CI outline" notes this explicitly.

  - url: https://playwright.dev/docs/ci#github-actions
    why: Playwright install best practices
    critical: `pnpm exec playwright install --with-deps chromium` installs system libs (libnss3 etc.). Drop `--with-deps` and tests flake.

  - url: https://vercel.com/docs/git/vercel-for-github
    why: Vercel auto-fires deployment_status from the Vercel GitHub App
    critical: The Vercel GitHub integration must be enabled on the repo. If e2e-preview.yml never triggers, check the integration settings.

skills:
  - prp-task-ralph-loop
  - hand-tracker-fx-architecture
  - playwright-e2e-webcam
  - vite-vercel-coop-coep

discovery:
  - D21: Ubuntu + Chromium only; one happy-path smoke; FPS ≥ 20 baseline.
  - D41: 4-level validation is the contract.
  - D42: Final phase E2E against Vercel preview via PLAYWRIGHT_BASE_URL.
  - D43: GitHub user is thekevinboyle; no other accounts needed for CI.
```

### Current Codebase Tree

```
hand-tracker/
├── package.json          (scripts: test, test:e2e, test:setup, check)
├── pnpm-lock.yaml
├── playwright.config.ts
├── scripts/gen-fake-webcam.mjs
├── public/models/, public/wasm/
├── tests/e2e/smoke.spec.ts
└── .github/workflows/    (may or may not exist — check)
```

### Desired Codebase Tree

```
.github/
└── workflows/
    ├── ci.yml                    NEW — PR + push gate
    └── e2e-preview.yml           NEW — deployment_status trigger
```

If `ci.yml` already exists from Task 1.1, MODIFY rather than create. Preserve prior content if the `check` job is already wired; ADD the e2e job.

### Known Gotchas

```typescript
// CRITICAL: pnpm/action-setup must precede setup-node or cache:'pnpm' errors.

// CRITICAL: Do NOT set `workers: <n>` higher than 1 in Playwright config for CI.
// Fake webcam is a singleton resource — parallel specs silently corrupt frames.

// CRITICAL: deployment_status trigger ONLY fires if Vercel GitHub integration
// is installed. If the workflow never runs after a deploy, check:
//   https://github.com/<owner>/<repo>/settings/installations

// CRITICAL: github.event.deployment_status.target_url is an untrusted string
// from an app integration. Do not interpolate it into a shell without quoting.
// Always: PLAYWRIGHT_BASE_URL="${{ github.event.deployment_status.target_url }}".

// CRITICAL: Playwright browser cache key must include playwright version
// or CI caches a stale binary after a playwright dep bump.

// CRITICAL: actions/cache restore + save semantics — on cache hit the step
// skips the install automatically. No manual guards needed.

// CRITICAL: `if: failure()` on the upload-artifact step is intentional.
// Uploading on pass wastes storage and slows CI.
```

---

## Implementation Blueprint

### Implementation Tasks

```yaml
Task 1: CREATE .github/workflows/ci.yml
  - IMPLEMENT: Full CI workflow YAML — see "ci.yml full content" below.
  - MIRROR: Shape from .claude/skills/playwright-e2e-webcam/SKILL.md §"GitHub Actions CI outline"
  - NAMING: job id = `check`, workflow name = "CI"
  - GOTCHA: Keep total runtime under 15 minutes. Use caching aggressively.
  - VALIDATE: yamllint or `gh workflow list` after push

Task 2: CREATE .github/workflows/e2e-preview.yml
  - IMPLEMENT: Preview-URL workflow YAML — see "e2e-preview.yml full content" below.
  - MIRROR: Same skill doc, but guard on deployment_status trigger.
  - NAMING: job id = `e2e`, workflow name = "E2E (preview)"
  - GOTCHA: Guard BOTH `state == 'success'` AND `environment == 'Production' || environment == 'Preview'`.
  - VALIDATE: Trigger manually via `gh workflow run e2e-preview.yml` is NOT possible (deployment_status is not workflow_dispatch-compatible); verify by waiting for a real deploy.

Task 3: commit + push; open PR
  - IMPLEMENT: git checkout -b task/5-3-ci-full; git add .github/workflows/*.yml; git commit -m "Task 5.3: …"
  - VALIDATE: `gh pr create --fill`; the CI workflow runs on the PR itself — it must be green.
```

### ci.yml full content

Copy verbatim into `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    name: check (typecheck + lint + unit + build + e2e)
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install ffmpeg
        run: sudo apt-get update && sudo apt-get install -y ffmpeg

      - name: Resolve Playwright version
        id: pw
        run: |
          version=$(node -p "require('./node_modules/@playwright/test/package.json').version")
          echo "version=$version" >> "$GITHUB_OUTPUT"

      - name: Cache Playwright browsers
        id: playwright-cache
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ steps.pw.outputs.version }}

      - name: Install Playwright browsers
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: pnpm exec playwright install --with-deps chromium

      - name: Install Playwright system deps (cache hit branch)
        if: steps.playwright-cache.outputs.cache-hit == 'true'
        run: pnpm exec playwright install-deps chromium

      - name: Cache MediaPipe model + wasm
        uses: actions/cache@v4
        with:
          path: |
            public/models
            public/wasm
          key: mediapipe-assets-${{ hashFiles('public/models/**', 'public/wasm/**') }}

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Unit tests
        run: pnpm test

      - name: Build
        run: pnpm build

      - name: Generate fake webcam Y4M
        run: pnpm test:setup

      - name: Playwright E2E
        run: pnpm test:e2e

      - name: Upload Playwright report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-${{ github.run_id }}
          path: playwright-report
          retention-days: 14

      - name: Upload test results on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-${{ github.run_id }}
          path: test-results
          retention-days: 14
```

### e2e-preview.yml full content

Copy verbatim into `.github/workflows/e2e-preview.yml`:

```yaml
name: E2E (preview)

on:
  deployment_status:

concurrency:
  group: e2e-preview-${{ github.event.deployment.id }}
  cancel-in-progress: true

jobs:
  e2e:
    name: chromium against ${{ github.event.deployment_status.target_url }}
    runs-on: ubuntu-latest
    timeout-minutes: 15
    if: >
      github.event.deployment_status.state == 'success' &&
      github.event.deployment_status.target_url != ''

    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.deployment.sha }}

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install ffmpeg
        run: sudo apt-get update && sudo apt-get install -y ffmpeg

      - name: Resolve Playwright version
        id: pw
        run: |
          version=$(node -p "require('./node_modules/@playwright/test/package.json').version")
          echo "version=$version" >> "$GITHUB_OUTPUT"

      - name: Cache Playwright browsers
        id: playwright-cache
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ steps.pw.outputs.version }}

      - name: Install Playwright browsers
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: pnpm exec playwright install --with-deps chromium

      - name: Install Playwright system deps (cache hit branch)
        if: steps.playwright-cache.outputs.cache-hit == 'true'
        run: pnpm exec playwright install-deps chromium

      - name: Generate fake webcam Y4M
        run: pnpm test:setup

      - name: Playwright E2E against preview URL
        env:
          PLAYWRIGHT_BASE_URL: ${{ github.event.deployment_status.target_url }}
        run: pnpm test:e2e

      - name: Upload Playwright report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-preview-${{ github.run_id }}
          path: playwright-report
          retention-days: 14

      - name: Upload test results on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-preview-${{ github.run_id }}
          path: test-results
          retention-days: 14
```

### Integration Points

```yaml
GitHub:
  - New workflows appear under Actions tab
  - PRs show "CI / check" status
  - Deployments show "E2E (preview) / e2e" status

Vercel:
  - Vercel GitHub App must be installed on the repo (set up in Task 5.2)
  - Each successful preview triggers deployment_status → e2e-preview.yml

Downstream tasks:
  - 5.4 adds error-state specs — they run automatically in both workflows
  - 5.5 adds visual-fidelity gate — runs in ci.yml (fast) and optionally e2e-preview.yml
```

---

## Validation Loop

```bash
# Level 1 — Syntax & Style
pnpm lint
pnpm typecheck
# YAML lint is optional; `gh workflow view ci.yml` after push validates syntax.

# Level 2 — Unit
pnpm test

# Level 3 — Integration: YAML parse
# Use yq or a validator locally. On PR push, GitHub itself validates YAML
# and reports a "Workflow file issues" annotation on failure.
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/e2e-preview.yml'))"

# Level 4 — E2E: verify CI runs on a real PR
# (Ralph loop sub-step: after commit+push, `gh run watch` until green.)
gh run list --workflow=ci.yml --limit 1
gh run watch  # requires a running job
```

---

## Final Validation Checklist

### Technical

- [ ] Both workflow YAMLs parse with no errors
- [ ] CI workflow triggered by the PR on this task itself; green end-to-end
- [ ] Cache steps show `cache-hit: true` on second run of same PR
- [ ] ffmpeg install step completes
- [ ] Playwright cache hit on second run
- [ ] e2e-preview.yml job visible under Actions tab (even if unused until first deploy)
- [ ] No secrets referenced (beyond `GITHUB_TOKEN` which is ambient)

### Feature

- [ ] Opening any PR against main runs ci.yml
- [ ] Successful Vercel deploy runs e2e-preview.yml with correct PLAYWRIGHT_BASE_URL
- [ ] Failed E2E uploads report artifact; downloadable from Actions UI

### Code Quality

- [ ] Concurrency guard prevents duplicate runs on rapid pushes
- [ ] Timeouts (20 min ci / 15 min preview) are realistic
- [ ] No `workflow_dispatch` trigger used for e2e-preview (deployment_status only — cannot be manually invoked; ok)
- [ ] Cache keys include tool versions where relevant

---

## Anti-Patterns

- Do NOT add `workflow_dispatch` to `e2e-preview.yml` without also passing a `preview_url` input — manual triggers with no URL fail confusingly.
- Do NOT bump `workers` in Playwright config to "speed up CI" — fake webcam is a shared resource.
- Do NOT set `continue-on-error: true` on any step to make the workflow green — that defeats the purpose.
- Do NOT set a permission policy narrower than GitHub default here — we are not writing back to the repo.
- Do NOT cache `node_modules` directly — pnpm uses its own store; caching `node_modules` corrupts symlinks.
- Do NOT run matrix across Node versions — D21 is Ubuntu + Chromium + single Node.
- Do NOT hardcode the Vercel preview URL — always from `github.event.deployment_status.target_url`.
- Do NOT install browsers without `--with-deps` on first install (cache miss) — missing system libs cause flakes.

Universal anti-patterns apply (`.claude/skills/prp-task-ralph-loop/SKILL.md` §6).

---

## No Prior Knowledge Test

- [ ] `package.json` has the scripts this workflow invokes (`typecheck`, `lint`, `test`, `build`, `test:setup`, `test:e2e`)
- [ ] `playwright.config.ts` honors `PLAYWRIGHT_BASE_URL` (verified in skill)
- [ ] Task 5.2 merged and the Vercel GitHub integration is installed (verified via `gh api repos/thekevinboyle/hand-tracker-fx/installation`)
- [ ] D21, D41, D42 cited exist in DISCOVERY.md
- [ ] MIRROR reference exists: `.claude/skills/playwright-e2e-webcam/SKILL.md` §"GitHub Actions CI outline"
- [ ] Validation Loop commands are runnable
- [ ] Task is atomic — no future task dependencies

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
.claude/skills/vite-vercel-coop-coep/SKILL.md
```
