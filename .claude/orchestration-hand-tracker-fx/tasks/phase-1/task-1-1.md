# Task 1.1: Harden scaffold and wire CI gate

**Phase**: 1 — Foundation
**Branch**: `task/1-1-scaffold-ci`
**Commit prefix**: `Task 1.1:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Lock in the Phase-0 scaffold as a production-grade gate — a GitHub Actions CI workflow, a Playwright smoke spec that asserts `crossOriginIsolated === true`, and a root-level `CLAUDE.md` orchestration pointer — so every subsequent task runs against a green baseline.

**Deliverable**: `.github/workflows/ci.yml` + `tests/e2e/smoke.spec.ts` + root `CLAUDE.md` + a passing `pnpm check` + a passing `pnpm test:e2e --grep "Task 1.1:"` run.

**Success Definition**: `pnpm check` exits 0, `pnpm build && pnpm preview` serves `/` with COOP/COEP/CSP headers, and the Playwright smoke asserts `crossOriginIsolated === true` on the preview URL. CI workflow is committed and runs on push + PR.

---

## User Persona

**Target User**: Any future Ralph agent (or human) executing a Phase 1–5 task on this repo.

**Use Case**: Before touching feature code, the agent needs every later task to inherit a green baseline — lint, types, unit, E2E all passing — so a regression is attributable to the agent's own change rather than scaffold drift.

**User Journey**:
1. Agent clones the repo, runs `pnpm install`.
2. Agent runs `pnpm check` — Biome + tsc + Vitest all green.
3. Agent runs `pnpm test:e2e` — Playwright spins up `pnpm build && pnpm preview`, drives Chromium with fake-webcam flags, confirms `crossOriginIsolated === true`.
4. Agent pushes a branch — GitHub Actions runs the same pipeline and posts status on the PR.

**Pain Points Addressed**: Without CI and a `crossOriginIsolated` bake-in test, a header misconfiguration silently disables MediaPipe multi-threaded wasm and the first feature task fails mysteriously in Phase 1.4.

---

## Why

- Required by D31 (Vercel headers) and D32 (dev-server headers) — the headers must be asserted at runtime, not assumed from config strings.
- Satisfies D41 (PRP task file format — CI gates every task at the `pnpm check` boundary) and D42 (phase regression pass must run against `pnpm preview`).
- Establishes the `Task N.M:` E2E describe-naming convention that every later task's L4 validation relies on.
- Unlocks every subsequent Phase 1 task — 1.2 through 1.6 each depend on a green CI baseline so they can attribute failures to their own change.

---

## What

- A GitHub Actions workflow runs on `push` and `pull_request`, executing `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test:setup`, `pnpm test:e2e` on `ubuntu-latest` with Chromium only.
- A Playwright smoke spec at `tests/e2e/smoke.spec.ts` boots the app and asserts `crossOriginIsolated === true`, `navigator.mediaDevices` is defined, and the `<main>` element renders.
- A root `CLAUDE.md` orchestration pointer documents the project's top-authority chain (DISCOVERY.md → PHASES.md → task files), the PRP task format, and the 4-level validation commands.
- The `Task N.M:` describe-naming convention is exercised — `Task 1.1: smoke —` is the test's describe prefix so `--grep "Task 1.1:"` resolves exactly one test file.

### NOT Building (scope boundary)

- No feature logic — no `useCamera`, no MediaPipe, no render loop. Those ship in Tasks 1.2 / 1.4 / 1.5.
- No service worker — D33 notes one is desired but deferred to Phase 5.
- No deploy to Vercel — Vercel linking lands in Phase 5.
- No mobile viewport, no Firefox/Safari Playwright project.
- No visual-regression screenshot diffing (Phase 5.6).

### Success Criteria

- [ ] `.github/workflows/ci.yml` committed; jobs green on first push (or dry-run via `act`).
- [ ] `tests/e2e/smoke.spec.ts` committed — one test prefixed `Task 1.1:` asserting `crossOriginIsolated === true`.
- [ ] Root `CLAUDE.md` committed — contains the "PRP Methodology and Ralph Loop" section and the 4-level validation table.
- [ ] `pnpm check` exits 0 (tsc + biome + vitest).
- [ ] `pnpm test:e2e --grep "Task 1.1:"` exits 0 locally.
- [ ] `curl -I http://localhost:4173/` (while `pnpm preview` is running) shows `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.

---

## All Needed Context

```yaml
files:
  - path: package.json
    why: Already has `check`, `test:e2e`, `test:setup`, `build`, `preview` scripts — the CI workflow only composes these
    gotcha: pnpm version is pinned via `packageManager` field — CI MUST use `pnpm/action-setup` and read from `package.json`, not a hardcoded version

  - path: playwright.config.ts
    why: Already wires Chromium with `--use-fake-device-for-media-stream` + `--use-file-for-fake-video-capture=${FAKE_VIDEO}`; `webServer` runs `pnpm build && pnpm preview` on :4173
    gotcha: `process.env.PLAYWRIGHT_BASE_URL` overrides webServer — CI leaves it unset so webServer spins up locally

  - path: vite.config.ts
    why: `SECURITY_HEADERS` constant is the source of truth for dev + preview COOP/COEP; the smoke test verifies these are live
    gotcha: Dev omits CSP; preview + Vercel apply it; smoke runs against preview so CSP is in effect

  - path: vercel.json
    why: Production headers; smoke runs only against local preview but future Phase 5 Vercel-preview smoke reuses the same spec via PLAYWRIGHT_BASE_URL
    gotcha: Any header drift between vite.config.ts and vercel.json will bite in Phase 5 — keep them synced

  - path: src/App.tsx
    why: Scaffold component — the smoke spec asserts the `<main>` heading renders so a blank page is caught
    gotcha: Do NOT add feature behavior here in this task; it is intentionally minimal

  - path: scripts/gen-fake-webcam.mjs
    why: `pnpm test:setup` generates `tests/assets/fake-hand.y4m`; CI must run this before `pnpm test:e2e`
    gotcha: Requires `ffmpeg` — the GitHub Actions ubuntu-latest runner ships it preinstalled

  - path: tests/assets/fake-hand.y4m
    why: Ignored by git; generated on demand. The `test:setup` script is idempotent so re-running it in CI is safe
    gotcha: If this file is missing at test time, Chromium's fake-capture flag silently produces a black frame

urls:
  - url: https://github.com/pnpm/action-setup
    why: Official action to install pnpm from `packageManager` field in package.json
    critical: Use `version` input unset so pnpm is read from package.json `packageManager`; prevents drift between local and CI

  - url: https://playwright.dev/docs/ci#github-actions
    why: Canonical Playwright-on-GitHub-Actions workflow — install browsers via `pnpm exec playwright install --with-deps chromium`
    critical: Chromium only; Firefox/WebKit are out of scope per D13 focus on Chrome 120+

  - url: https://developer.mozilla.org/en-US/docs/Web/API/crossOriginIsolated
    why: Runtime property — `true` iff COOP+COEP are both set AND the browser honored them
    critical: The property is the single source of truth; never assert only on response headers

skills:
  - prp-task-ralph-loop
  - hand-tracker-fx-architecture
  - vite-vercel-coop-coep
  - playwright-e2e-webcam

discovery:
  - D16: Tech stack — React 19, Vite 8, TypeScript 6 strict, pnpm 10, Biome v2, Vitest 4, Playwright 1.59
  - D21: Testing scope — Vitest for utilities, Playwright E2E with fake device
  - D31: Vercel deploy headers (COOP/COEP/CSP/Permissions-Policy)
  - D32: Dev server headers mirror production
  - D39: Repo + branches — trunk-based, `task/N-M-<description>` feature branches
  - D40: Commit convention — `Task N.M: <description>` + `Co-Authored-By` trailer
  - D41: PRP task file format + 4 validation levels
  - D42: Phase regression runs against `pnpm preview` (closest to Vercel)
```

### Current Codebase Tree (relevant subset)

```
hand-tracker/
  package.json              # scripts already defined
  vite.config.ts            # SECURITY_HEADERS wired
  vercel.json               # production headers wired
  playwright.config.ts      # Chromium + fake webcam wired
  biome.json
  tsconfig.json
  src/
    App.tsx                 # scaffold heading
    App.test.tsx            # scaffold Vitest
    main.tsx
    test/setup.ts
  scripts/
    fetch-mediapipe-assets.mjs
    gen-fake-webcam.mjs
  tests/
    assets/                 # fake-hand.y4m generated here
    e2e/                    # EMPTY — this task populates it
  public/
    models/hand_landmarker.task
    wasm/
```

### Desired Codebase Tree (this task adds)

```
hand-tracker/
  CLAUDE.md                                 # root orchestration pointer (new)
  .github/
    workflows/
      ci.yml                                # install → check → e2e (new)
  tests/
    e2e/
      smoke.spec.ts                         # Task 1.1: crossOriginIsolated + main render (new)
```

### Known Gotchas

```typescript
// CRITICAL: React StrictMode runs useEffect twice in dev.
// All useEffect cleanups must be idempotent:
//   cancelAnimationFrame(rafId)
//   video.cancelVideoFrameCallback(rvfcId)
//   tracks.forEach(t => t.stop())

// CRITICAL: MediaPipe detectForVideo() requires monotonically increasing timestamps.
// Not relevant to this task but documented here per the universal gotcha block.

// CRITICAL: Biome v2 is the single linter + formatter.
// Run: pnpm biome check <paths>    (check-only; used in CI)
// Run: pnpm biome check --write .  (auto-fix; local development only)

// CRITICAL: TypeScript strict is ON. `any` is a build failure.

// CRITICAL: pnpm, not npm or bun. CI workflow MUST use pnpm/action-setup.
// A stray `npm install` in CI creates package-lock.json which breaks every
// subsequent agent's `pnpm install --frozen-lockfile`.

// CRITICAL: Playwright grep MUST match. `--grep "Task 1.1:"` silently finds
// zero tests (exit 0 = false green) if the describe block is spelled differently.
// The canonical describe is EXACTLY: describe('Task 1.1: smoke', ...).

// CRITICAL: crossOriginIsolated is the runtime assertion, not just the header
// response. A browser can ignore a malformed COEP and still return it in
// response headers. Always assert window.crossOriginIsolated in E2E.

// CRITICAL: The GitHub Actions workflow runs without the repo having a remote
// yet (D39 says "create remote when first deploy is wired up"). The workflow
// should be committed now so it runs on the FIRST push when the remote is
// created later. Do not block this task on remote creation.
```

---

## Implementation Blueprint

### Data Models

No new types. This task is pure infra + smoke.

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE CLAUDE.md (at repo root, NOT inside .claude/)
  - IMPLEMENT: Top-level orchestration pointer with sections:
      - "Hand Tracker FX" title + one-line purpose
      - "Quick Reference" table (DISCOVERY.md, PHASES.md, PROGRESS.md if present, tasks/, START.md)
      - "Authority Rule" — DISCOVERY.md wins
      - "Tech Stack" table (match PHASES.md lines 31–46)
      - "Scope Constraints" (match DISCOVERY.md §12, 14 bullets)
      - "Git Workflow" — branch naming + commit prefix from D39/D40
      - "Testing" — 4-level validation summary from D41
      - "Skills" table — 9 entries from PHASES.md Skills Reference
      - "MCP Servers" table — Playwright + context7
      - "For Subagents" — read task file → read skills → follow Ralph protocol
  - MIRROR: /Users/kevin/Documents/web/CLAUDE.md (parent workspace orchestration pointer — same shape; adapt content)
  - NAMING: CLAUDE.md (ALL CAPS), markdown extension, repo root
  - GOTCHA: Do NOT duplicate DISCOVERY.md content. This file POINTS at it.
  - VALIDATE: pnpm biome check CLAUDE.md  # biome ignores .md by default; check it does not error

Task 2: CREATE .github/workflows/ci.yml
  - IMPLEMENT: GitHub Actions workflow with:
      name: ci
      on: { push: {}, pull_request: {} }
      jobs:
        check:
          runs-on: ubuntu-latest
          steps:
            - uses: actions/checkout@v4
            - uses: pnpm/action-setup@v4    # reads packageManager from package.json
            - uses: actions/setup-node@v4
              with: { node-version: 22, cache: 'pnpm' }
            - run: pnpm install --frozen-lockfile
            - run: pnpm check               # tsc + biome + vitest
        e2e:
          needs: check
          runs-on: ubuntu-latest
          steps:
            - uses: actions/checkout@v4
            - uses: pnpm/action-setup@v4
            - uses: actions/setup-node@v4
              with: { node-version: 22, cache: 'pnpm' }
            - run: pnpm install --frozen-lockfile
            - run: pnpm exec playwright install --with-deps chromium
            - run: pnpm test:setup          # generates tests/assets/fake-hand.y4m
            - run: pnpm test:e2e
            - uses: actions/upload-artifact@v4
              if: failure()
              with: { name: playwright-report, path: playwright-report/ }
  - MIRROR: None in-repo — use the Playwright GH Actions canonical structure (see urls:)
  - NAMING: lowercase file, `.yml` extension, `.github/workflows/` path
  - GOTCHA: `actions/setup-node` cache must be `'pnpm'`, not `'npm'`; requires pnpm/action-setup to run FIRST
  - VALIDATE: Syntactic YAML validity via `pnpm biome check .github/workflows/ci.yml` (Biome ignores YAML; fallback is `node -e "require('yaml').parse(require('fs').readFileSync('.github/workflows/ci.yml','utf8'))"` if yaml is installed, otherwise manual visual check)

Task 3: CREATE tests/e2e/smoke.spec.ts
  - IMPLEMENT:
      import { test, expect } from '@playwright/test'

      test.describe('Task 1.1: smoke', () => {
        test('app boots with crossOriginIsolated=true and main visible', async ({ page }) => {
          await page.goto('/')
          await expect(page.locator('main')).toBeVisible()
          const coi = await page.evaluate(() => window.crossOriginIsolated)
          expect(coi).toBe(true)
          const hasGum = await page.evaluate(() => !!navigator.mediaDevices?.getUserMedia)
          expect(hasGum).toBe(true)
          const consoleErrors: string[] = []
          page.on('pageerror', (e) => consoleErrors.push(e.message))
          await page.waitForLoadState('networkidle')
          expect(consoleErrors).toEqual([])
        })
      })
  - MIRROR: None — first E2E spec in the repo. All later specs mirror THIS shape.
  - NAMING: kebab-case file, `.spec.ts` extension, describe prefix EXACTLY `Task 1.1: smoke`
  - GOTCHA: `page.goto('/')` uses `baseURL` from playwright.config.ts (default http://localhost:4173)
  - VALIDATE: pnpm biome check tests/e2e/smoke.spec.ts && pnpm tsc --noEmit && pnpm test:e2e --grep "Task 1.1:"
```

### Integration Points

```yaml
CI:
  - trigger: GitHub push to any branch + PRs into main
  - gates: `check` job blocks `e2e`; both must be green
  - artifact: playwright-report on failure

VALIDATION_CONVENTION:
  - every later task's L4 uses `pnpm test:e2e --grep "Task N.M:"`
  - describe block MUST start with `Task N.M: <feature>` (this spec is the template)

DOCS:
  - CLAUDE.md is the first file an agent reads when `cat`ing the repo root
  - Points at `.claude/orchestration-hand-tracker-fx/DISCOVERY.md` and `PHASES.md`
```

---

## Validation Loop

### Level 1 — Syntax and Style

```bash
pnpm biome check tests/e2e/smoke.spec.ts CLAUDE.md
pnpm tsc --noEmit
```

Expected: zero errors. Biome does not lint YAML; `.github/workflows/ci.yml` is visual-checked.

### Level 2 — Unit Tests

```bash
pnpm vitest run src/App.test.tsx
```

Expected: 1/1 passing. This task adds no new unit test — the existing scaffold test must still pass.

### Level 3 — Integration (production build)

```bash
pnpm build
```

Expected: exits 0. The build output `dist/index.html` must exist; `dist/assets/*` contains the MediaPipe/OGL/Tweakpane chunks (though MediaPipe is not imported yet, the manualChunks rule is a no-op).

### Level 4 — E2E

```bash
pnpm test:setup        # generate fake-hand.y4m if missing (idempotent)
pnpm test:e2e --grep "Task 1.1:"
```

Expected: one test passes; the log shows `Task 1.1: smoke > app boots with crossOriginIsolated=true and main visible` ✓. `--grep "Task 1.1:"` must NOT return "0 tests found, exit 0" — verify by reading the Playwright output summary.

---

## Final Validation Checklist

### Technical

- [ ] L1: `pnpm biome check .` + `pnpm tsc --noEmit` exit 0
- [ ] L2: `pnpm vitest run` — 1/1 existing test passes
- [ ] L3: `pnpm build` exits 0
- [ ] L4: `pnpm test:e2e --grep "Task 1.1:"` exits 0 with `1 passed`
- [ ] `curl -sI http://localhost:4173/` (with preview running) shows `cross-origin-opener-policy: same-origin` and `cross-origin-embedder-policy: require-corp`
- [ ] `.github/workflows/ci.yml` YAML parses (`node --input-type=module -e "import('yaml').then(y=>console.log(y.default.parse(require('fs').readFileSync('.github/workflows/ci.yml','utf8'))))"` or visual)

### Feature

- [ ] CLAUDE.md exists at repo root and cites DISCOVERY.md, PHASES.md, the 9 skills, and D41 4-level validation
- [ ] smoke.spec.ts describe is EXACTLY `Task 1.1: smoke`
- [ ] smoke asserts `crossOriginIsolated === true` on the preview URL
- [ ] CI workflow has `check` + `e2e` jobs with `e2e` depending on `check`

### Code Quality

- [ ] No `any` types in smoke.spec.ts — narrow via `!!` and `? true : false`
- [ ] No TODOs/FIXMEs left in any new file
- [ ] smoke.spec.ts uses `test.describe` + `test` from `@playwright/test`, not `test.only` / `test.skip`

---

## Anti-Patterns

- Do not hardcode pnpm version in `ci.yml` — read from `packageManager` in `package.json` via `pnpm/action-setup@v4`.
- Do not run `npm install` anywhere in CI — project is pnpm-only.
- Do not drop `pnpm test:setup` from the e2e job — without the Y4M the fake webcam is a black frame.
- Do not assert only on response headers in smoke — use `window.crossOriginIsolated`.
- Do not omit `--grep "Task 1.1:"` — a future agent running the full suite must filter to this spec.
- Do not install Firefox/WebKit Playwright browsers in CI — Chromium only per Phase 1 scope.
- Do not add `act`-specific hacks to `ci.yml` — act is optional local-dry-run, not a CI dependency.
- Do not put feature code in `src/App.tsx` — scaffold only.

---

## No Prior Knowledge Test

- [x] `package.json`, `playwright.config.ts`, `vite.config.ts`, `vercel.json`, `scripts/gen-fake-webcam.mjs` all exist in repo (verified)
- [x] Every URL cited is public and stable
- [x] D-numbers D16, D21, D31, D32, D39, D40, D41, D42 all exist in DISCOVERY.md
- [x] Implementation Tasks are dependency-ordered: CLAUDE.md → ci.yml → smoke.spec.ts
- [x] Validation commands have no placeholders
- [x] MIRROR targets are either in-repo (package.json) or explicitly marked "None" with the canonical external pattern cited
- [x] Task is atomic — does not depend on 1.2–1.6

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/vite-vercel-coop-coep/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
```
