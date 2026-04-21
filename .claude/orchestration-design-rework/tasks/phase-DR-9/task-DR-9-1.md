# Task DR-9.1: Parent 5.3 — GitHub Actions CI pipeline (all 4 PRP levels on PR + push)

**Phase**: DR-9 — Parent Phase-5 Resume
**Parent task**: 5.3 (CI full pipeline)
**Branch**: `task/DR-9-1-ci-pipeline`
**Commit prefix**: `Task DR-9.1:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Objective

Wire GitHub Actions to run the full 4-level PRP validation stack (L1 lint + typecheck → L2 unit → L3 build → L4 Playwright E2E) on every pull request and every push to `main`, plus a second workflow that re-runs the E2E suite against the live Vercel preview URL on every `deployment_status: success` event. Any red level must fail the workflow and block merge.

This is the Phase-5 resumption of parent task 5.3, adapted to the reworked chrome landed by Phases DR-6 through DR-8. The contract (4-level validation, Ubuntu + Chromium + Node 25, pnpm-first, COOP/COEP-compatible headless Chromium) is inherited verbatim from parent task 5.3; the only substantive delta is that Node version is pinned to **25** (per this rework's Tech Stack table) and the job names + cache keys are rewritten to reflect the DR-9 lineage.

---

## Context

Parent Phase-5 was paused after 5.2 (Vercel live deploy) so the design-rework branch could land on top of the functional MVP. DR-6 through DR-8 have now replaced Tweakpane with custom React chrome; DR-8.R captured a new `design-rework-reference.png` for the visual-fidelity gate (DR-9.3). With the UI stable on `hand-tracker-jade.vercel.app`, the parent's CI, error-state coverage, and visual gate get resumed in parallel as DR-9.1 / DR-9.2 / DR-9.3. DR-9.R closes out the release (tag v0.1.0 + CHANGELOG + archive).

DR-9.1 is meta/infra — it does not ship product code. It produces two YAML files and their first passing green runs.

**Authority**: `.claude/orchestration-design-rework/DISCOVERY.md` (DR1–DR19) + parent `.claude/orchestration-hand-tracker-fx/DISCOVERY.md` (D1–D45). DR overrides only the chrome / visual decisions; the CI contract inherits D21 (Ubuntu + Chromium only), D41 (4-level validation), D42 (preview-URL E2E).

---

## Dependencies

- **DR-8.R** — phase DR-8 regression complete; new chrome stable; `reports/DR-8-regression/design-rework-reference.png` exists; 45 aggregate Phase 1–4 E2E specs still green against the new chrome.
- **Parent 5.2** — `hand-tracker-jade.vercel.app` live; Vercel GitHub integration installed on the repo (verified in Task 5.2 report).
- `package.json` scripts present: `lint`, `typecheck`, `test`, `build`, `test:setup`, `test:e2e`.
- `playwright.config.ts` honors `PLAYWRIGHT_BASE_URL` (gates local `webServer` on absence of env).
- `scripts/gen-fake-webcam.mjs` + `tests/assets/fake-hand.y4m` generator still functional.

## Blocked By

- DR-8.R must be marked `done` in PROGRESS.md before this task starts.
- Verify Vercel GitHub App is still installed: `gh api "repos/thekevinboyle/hand-tracker/installation" --jq '.app_slug'` should return `vercel`. If missing, the `deployment_status` trigger never fires — resolve before starting.

---

## Research Findings

- **Parent task 5.3** (`.claude/orchestration-hand-tracker-fx/tasks/phase-5/task-5-3.md`) — authoritative CI contract. DR-9.1 inherits the split (`ci.yml` + `e2e-preview.yml`), the caching strategy (pnpm store + Playwright browsers + MediaPipe assets), the concurrency guards, the artifact-upload-on-failure pattern, and the anti-patterns (no matrix, no workers>1, no `continue-on-error`, no cache of `node_modules`).
- **DR design-rework PHASES.md §DR-9.1** — "Workflow runs biome + tsc + vitest + build + e2e on ubuntu-latest, node 25. Caches pnpm + playwright browsers. Status check required for merge to main."
- **`playwright-e2e-webcam` skill §"GitHub Actions CI outline"** — `pnpm/action-setup@v4` MUST precede `actions/setup-node@v4` so `cache: 'pnpm'` resolves the store. Playwright `--with-deps` required on cache-miss install; `install-deps chromium` on cache hit branch to top-up apt libs after runner image changes. Fake-webcam launch flags: `--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`, `--use-file-for-fake-video-capture=<abs-path>` — these are in `playwright.config.ts`, NOT the workflow.
- **`vite-vercel-coop-coep` skill** — COOP `same-origin` + COEP `require-corp` + CSP are **response-header** concerns, enforced by Vercel + by Vite's preview server via `configureServer`. Headless Chromium just needs `--enable-features=SharedArrayBuffer` (default on). No special flag needed to make CI honor COOP/COEP — the headers come from `pnpm preview` (L3) or Vercel (live preview L4).
- **Parent PROGRESS.md** — Node pinned at 25.2.1 on dev; parent task 5.3 specified Node 22 but this rework bumps to 25 (per rework Tech Stack table). Runners use `actions/setup-node@v4` with `node-version: '25'`.
- **DR-8.R** — captured the new `reports/DR-8-regression/design-rework-reference.png` at 1440×900. DR-9.3 consumes it as the diff target.

---

## Implementation Plan

### Step 1: Verify pre-requisites

```bash
# Vercel GitHub App installed
gh api "repos/thekevinboyle/hand-tracker/installation" --jq '.app_slug'
# → "vercel"   (if not → STOP, re-install in Vercel dashboard)

# Scripts present
node -e "const p=require('./package.json').scripts; for (const s of ['lint','typecheck','test','build','test:setup','test:e2e']) if(!p[s]) throw new Error('missing: '+s);"
```

### Step 2: Create `.github/workflows/ci.yml`

Primary gate: PR + push to `main`. Runs L1 → L2 → L3 → L4 in sequence. Fail-fast on the first red level.

Copy verbatim:

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
    name: check (L1 lint+tsc · L2 unit · L3 build · L4 e2e)
    runs-on: ubuntu-latest
    timeout-minutes: 20
    strategy:
      fail-fast: true
      matrix:
        node-version: ['25']
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install ffmpeg (for fake-webcam Y4M generator)
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

      - name: Install Playwright browsers (cache miss)
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: pnpm exec playwright install --with-deps chromium

      - name: Install Playwright system deps (cache hit)
        if: steps.playwright-cache.outputs.cache-hit == 'true'
        run: pnpm exec playwright install-deps chromium

      - name: Cache MediaPipe model + wasm
        uses: actions/cache@v4
        with:
          path: |
            public/models
            public/wasm
          key: mediapipe-assets-${{ hashFiles('public/models/**', 'public/wasm/**') }}

      # ─── Level 1: syntax + style + types ─────────────────────────────────
      - name: L1 biome check
        run: pnpm lint

      - name: L1 tsc --noEmit
        run: pnpm typecheck

      # ─── Level 2: unit ───────────────────────────────────────────────────
      - name: L2 vitest
        run: pnpm test

      # ─── Level 3: integration build ──────────────────────────────────────
      - name: L3 build (--mode test bakes in dev hooks required by L4)
        run: pnpm build --mode test

      # ─── Level 4: Playwright E2E (fake webcam) ───────────────────────────
      - name: Generate fake webcam Y4M
        run: pnpm test:setup

      - name: L4 Playwright E2E
        run: pnpm test:e2e
        env:
          CI: '1'

      # ─── Artifacts (failure only) ────────────────────────────────────────
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

### Step 3: Create `.github/workflows/e2e-preview.yml`

Secondary gate: `deployment_status` trigger from Vercel. Re-runs L4 against the **live preview URL** so Vercel-only regressions (missing header, CDN caching oddity, service-worker stale-cache) get caught. Reuses the same matrix, caches, and flags as `ci.yml`.

```yaml
name: E2E (preview)

on:
  deployment_status:

concurrency:
  group: e2e-preview-${{ github.event.deployment.id }}
  cancel-in-progress: true

jobs:
  e2e:
    name: chromium vs ${{ github.event.deployment_status.target_url }}
    runs-on: ubuntu-latest
    timeout-minutes: 15
    if: >
      github.event.deployment_status.state == 'success' &&
      github.event.deployment_status.target_url != ''
    strategy:
      fail-fast: true
      matrix:
        node-version: ['25']
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.deployment.sha }}

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
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

      - name: Install Playwright browsers (cache miss)
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: pnpm exec playwright install --with-deps chromium

      - name: Install Playwright system deps (cache hit)
        if: steps.playwright-cache.outputs.cache-hit == 'true'
        run: pnpm exec playwright install-deps chromium

      - name: Generate fake webcam Y4M
        run: pnpm test:setup

      - name: L4 Playwright against preview URL
        env:
          PLAYWRIGHT_BASE_URL: ${{ github.event.deployment_status.target_url }}
          CI: '1'
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

### Step 4: Validate YAML locally before pushing

```bash
# Either yamllint (pip install yamllint) OR a quick Python parse:
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/e2e-preview.yml'))"

# Optional: local dry run via `act` — DOES NOT fully reproduce GitHub runners
# but catches gross syntactic issues and missing step references.
# https://github.com/nektos/act
act --list 2>/dev/null || echo "act not installed — skip; rely on GitHub's YAML validator"
```

### Step 5: Push branch + open PR; watch first CI run

```bash
git checkout -b task/DR-9-1-ci-pipeline
git add .github/workflows/ci.yml .github/workflows/e2e-preview.yml
git commit -m "$(cat <<'EOF'
Task DR-9.1: GitHub Actions CI pipeline (L1→L4 on PR + push, preview-URL E2E on deploy)

- ci.yml: biome + tsc + vitest + build(--mode test) + playwright e2e on ubuntu-latest, node 25; caches pnpm store + playwright browsers + MediaPipe assets; fail-fast on any red level; uploads playwright-report on failure only.
- e2e-preview.yml: deployment_status trigger; re-runs L4 against target_url with PLAYWRIGHT_BASE_URL; identical cache + setup as ci.yml.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin task/DR-9-1-ci-pipeline
gh pr create --fill --title "Task DR-9.1: GitHub Actions CI pipeline"
gh run watch  # tails the first CI run on this PR
```

### Step 6: Require status check in branch protection

The status check `check / check (L1 lint+tsc · L2 unit · L3 build · L4 e2e)` should be marked **required** for merge to `main`. This is a repo setting configured via the GitHub UI by the human reviewer, NOT in YAML. Document the setting in the PR description:

> Repo Settings → Branches → main → Branch protection rule → Require status checks to pass before merging → add `CI / check`.

---

## Files to Create

- `.github/workflows/ci.yml` — PR + push gate; 4-level validation.
- `.github/workflows/e2e-preview.yml` — `deployment_status` trigger; live-URL E2E.

## Files to Modify

- None. DR-9.1 is meta/infra only.

---

## Contracts

### Provides (for downstream tasks)

- **Required status check `CI / check`** — blocks merge to `main` until green. DR-9.2 + DR-9.3 lean on this to ensure their new E2E specs run on PR.
- **Workflow status `E2E (preview) / chromium vs <url>`** — per-deploy gate; DR-9.3 extends this workflow (or adds a sister workflow) to run the visual-fidelity spec against the same `target_url`.
- **Artifact conventions** — `playwright-report-<run_id>` (on CI failure) and `playwright-report-preview-<run_id>` (on preview-URL failure). Debug agents download via `gh run download <run_id>`.

### Consumes (from upstream tasks)

- **DR-8.R's green aggregate** — all 45 prior Phase 1–4 E2E specs + all DR-6/7/8 primitive tests currently pass when run through `pnpm test:e2e`. CI re-runs the same command.
- **Parent 5.2's Vercel integration** — `deployment_status` events are fired by the Vercel GitHub App.

---

## Acceptance Criteria

- [ ] `.github/workflows/ci.yml` exists; `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` exits 0.
- [ ] `.github/workflows/e2e-preview.yml` exists; same YAML parse check passes.
- [ ] Opening this task's PR triggers `CI / check`; all 6 steps (L1 lint, L1 tsc, L2 unit, L3 build, fake-webcam gen, L4 e2e) complete green within 15 min.
- [ ] First Vercel preview after PR merge triggers `E2E (preview) / chromium vs <url>` and it passes end-to-end.
- [ ] Cache hit observed on second CI run (same PR, second push): `pnpm store` step reports cache-hit; `Cache Playwright browsers` step reports `cache-hit: true`.
- [ ] Failed step uploads `playwright-report-*` artifact; `gh run download` retrieves it.
- [ ] No `workflow_dispatch`, no `workers: >1`, no `continue-on-error: true`, no matrix beyond `node-version: ['25']`.
- [ ] Node version is `'25'` in both workflows (quoted string — unquoted `25` becomes integer and breaks setup-node).
- [ ] Status check `CI / check` marked Required in branch protection for `main` (human step; document in PR).

---

## Testing Protocol

### L1 — Syntax + Style + Types (meta)

```bash
pnpm lint                                                     # biome — no src changes expected
pnpm typecheck                                                # tsc --noEmit — no src changes expected
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/e2e-preview.yml'))"
# Optional: act --list  (requires `brew install act`)
```

### L2 — Unit

```bash
pnpm vitest run                                               # full suite — no src changes expected
```

### L3 — Integration: first CI run on the PR itself

The PR IS the integration test. Push → `CI / check` runs → green.

```bash
gh pr create --fill --title "Task DR-9.1: GitHub Actions CI pipeline"
gh run list --workflow=ci.yml --limit 1
gh run watch
```

If any step fails, debug via uploaded artifacts:

```bash
gh run view <run-id> --log-failed
gh run download <run-id>
```

### L4 — E2E

L4 is transitive via L3 — the E2E step INSIDE ci.yml is what we're validating. Locally:

```bash
pnpm test:setup && pnpm test:e2e
# Should match what CI runs (same --mode test build preview server + fake-webcam).
```

Once live: after this PR merges and the next Vercel preview deploys, verify `E2E (preview)` triggers:

```bash
gh run list --workflow=e2e-preview.yml --limit 1
# Expect state=success within 15 min of deploy.
```

### Build / Lint / Type Checks

- [ ] `pnpm lint` exits 0
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0
- [ ] `pnpm build --mode test` exits 0
- [ ] `pnpm test:e2e` exits 0 (locally, pre-push)
- [ ] First CI run on the PR is green end-to-end
- [ ] First e2e-preview run after merge is green end-to-end
- [ ] Second CI run shows cache hits

---

## Known Gotchas

```yaml
# CRITICAL: pnpm/action-setup@v4 MUST run BEFORE actions/setup-node@v4.
# If ordered the other way, `cache: 'pnpm'` on setup-node errors with
# "Caching for 'pnpm' is not supported" because pnpm is not yet on PATH.

# CRITICAL: Node version is QUOTED ('25') — unquoted 25 parses as integer
# and setup-node rejects it.

# CRITICAL: --with-deps on first install or flaky system libs manifest.
# On cache-hit we run `install-deps chromium` to refresh apt.

# CRITICAL: deployment_status is NOT workflow_dispatch-able. You cannot
# manually trigger e2e-preview.yml for testing. Wait for a real deploy.

# CRITICAL: github.event.deployment_status.target_url is untrusted input
# from an integration. Always pass as an env var (PLAYWRIGHT_BASE_URL);
# never interpolate into a shell argument position.

# CRITICAL: pnpm build MUST use --mode test (NOT plain `build`) because
# the `__handTracker` dev hook that L4 relies on is tree-shaken in
# production mode. This is identical to playwright.config.ts's webServer
# command — consistency is deliberate.

# CRITICAL: Do NOT increase Playwright `workers` > 1 for this suite.
# The fake-webcam Y4M is a singleton resource; parallel specs silently
# corrupt each other.

# CRITICAL: `if: failure()` on artifact upload is intentional. Success
# runs do not need artifacts.

# CRITICAL: cache keys. Playwright key MUST include the Playwright
# version (`steps.pw.outputs.version`) or a dep bump serves a stale
# binary. MediaPipe key is a hashFiles digest of the checked-in assets
# — file contents are deterministic, so the key is stable.

# CRITICAL: Node 25 is the parent + rework Tech Stack pin. Do NOT add
# 22 or 20 to the matrix for "safety" — single-version matrix is the
# DR design contract (PHASES.md §DR-9.1).

# CRITICAL: The L3 step is `pnpm build --mode test`, not `pnpm build`.
# Parent 5.3 used `pnpm build`; this rework's L4 baked-in dev hooks
# require --mode test. Confirmed against PROGRESS.md §Phase 1/1.R note.

# OPTIONAL: To expose the `__handTracker` dev hook on a Vercel preview
# deploy (e.g. if a DR-9.3 spec or a live-smoke check ever needs it),
# set `VITE_EXPOSE_DEV_HOOK=1` as a build env var in the Vercel project
# settings for that preview. Default is OMITTED — production bundles
# stay clean (the flag is checked by `src/engine/devHooks.ts` at the
# `SHOULD_EXPOSE` gate). e2e-preview.yml asserts live preview URL
# behavior WITHOUT the dev hook by default.
```

---

## Anti-Patterns

- Do NOT add `workflow_dispatch` to `e2e-preview.yml` — manual triggers with no `target_url` fail confusingly. The DISCOVERY contract says this workflow runs ONLY on real deploys.
- Do NOT run matrix across multiple Node versions — rework pins Node 25 only.
- Do NOT run matrix across Firefox/WebKit — D21 + DR PHASES both say Chromium only.
- Do NOT cache `node_modules` directly — pnpm uses its store; `node_modules` is symlinks into the store and caching the symlinks corrupts the install.
- Do NOT set `permissions: write` on the job — neither workflow writes back to the repo.
- Do NOT `continue-on-error: true` any validation step to make things "green."
- Do NOT paste a hardcoded deploy URL — always use `github.event.deployment_status.target_url`.
- Do NOT omit `--with-deps` from the cache-miss install branch — system libs missing ⇒ silent flakes.

Universal anti-patterns apply (`.claude/skills/prp-task-ralph-loop/SKILL.md` §6).

---

## Skills to Read

- `prp-task-ralph-loop` — Task anatomy + Ralph iteration protocol + state-file schema.
- `hand-tracker-fx-architecture` — Top-level orientation; understand what the L3 + L4 steps actually exercise.
- `playwright-e2e-webcam` — Fake-webcam Y4M setup, `__handTracker` dev hook, `PLAYWRIGHT_BASE_URL` override mechanics, Chromium-only flags.
- `vite-vercel-coop-coep` — COOP/COEP/CSP are live-deploy concerns; e2e-preview validates them end-to-end. Also: `pnpm preview` vs `pnpm build --mode test` header-parity reminder.

## Research / Reference Files

- `.claude/orchestration-hand-tracker-fx/tasks/phase-5/task-5-3.md` — Parent task this one inherits from.
- `.claude/orchestration-hand-tracker-fx/DISCOVERY.md` §D21, §D41, §D42 — CI contract.
- `.claude/orchestration-design-rework/PHASES.md` §DR-9.1 — This phase's scope row.
- `reports/DR-8-regression.md` — verifies new chrome is green before DR-9 starts.

---

## Git

- Branch: `task/DR-9-1-ci-pipeline`
- Commit prefix: `Task DR-9.1:`
- E2E describe prefix: **N/A** (DR-9.1 is meta — it does not add specs; its own validation is the CI run on this PR itself).
- Every commit ends with `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>` trailer.
- Fast-forward merge to `main` after `CI / check` is green.
- Mark `5.3` in parent PROGRESS.md mapping row (done via DR-9.1) after merge.

---

## No-Prior-Knowledge Test

- [ ] `package.json` scripts `lint`, `typecheck`, `test`, `build`, `test:setup`, `test:e2e` exist.
- [ ] `playwright.config.ts` honors `PLAYWRIGHT_BASE_URL` and sets `workers: 1`.
- [ ] Task 5.2 merged; Vercel GitHub App installed.
- [ ] DR-8.R merged; `reports/DR-8-regression/design-rework-reference.png` exists.
- [ ] D21, D41, D42 exist in parent DISCOVERY.md.
- [ ] DR PHASES.md §DR-9.1 row matches this task's scope.
- [ ] All validation commands runnable from a fresh clone after `pnpm install --frozen-lockfile`.
