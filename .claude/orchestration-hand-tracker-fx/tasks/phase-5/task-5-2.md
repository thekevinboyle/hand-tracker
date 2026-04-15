# Task 5.2: Create GitHub remote, link Vercel project, ship first deploy

**Phase**: 5 — Deploy + Comprehensive E2E
**Branch**: `task/5-2-deploy-first`
**Commit prefix**: `Task 5.2:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal** — Go from a local-only trunk to a public Vercel deployment of Hand Tracker FX, with the GitHub remote wired to trigger future deploys on `git push origin main`.

**Deliverable** — A live URL (`https://hand-tracker-fx.vercel.app` or the Vercel-assigned subdomain) that serves the production build, with COOP/COEP/CSP/Permissions-Policy headers verified via `curl -I`, plus a deployment report at `reports/phase-5-deploy.md` documenting the commands run and the final URL.

**Success Definition** —
1. `curl -sI https://<deployment-url>/ | grep -iE 'cross-origin|permissions-policy|content-security-policy'` returns all four headers with the values specified in D31.
2. Playwright MCP navigates to the live URL and asserts `crossOriginIsolated === true` in the browser console.
3. `PLAYWRIGHT_BASE_URL=https://<deployment-url> pnpm test:e2e --grep "Task 1.1:"` exits 0.

This task is **partially human-driven**. Steps are split into `AGENT:` (automatable) and `HUMAN:` (requires user interaction with a browser/terminal). The agent MUST pause on HUMAN steps and prompt the user.

---

## User Persona

**Target User** — The project owner (thekevinboyle on GitHub) publishing the MVP so that test users can try it.

**Use Case** — One-time deploy bootstrap. After this task, pushes to `main` auto-deploy.

**User Journey**:

1. Agent prepares local state, commits any remaining config.
2. Agent prompts user for `gh auth status`, `vercel whoami`.
3. User authenticates CLIs (if not already).
4. Agent runs `gh repo create`, pushes main.
5. User or agent runs `vercel link` + `vercel --prod`.
6. Agent verifies headers via `curl -I` and runs E2E against preview URL.
7. Agent writes `reports/phase-5-deploy.md`.

**Pain Points Addressed** — Guesswork on deploy wiring; opaque header drift between local preview and Vercel runtime.

---

## Why

- D31: Vercel is the chosen host; deploy on push to `main`.
- D33: Self-hosted model + wasm must be served with the same cross-origin headers — verify on live.
- D39: GitHub remote is created at first deploy (not before). This is that moment.
- D42: Final phase runs E2E against the Vercel preview — this task unblocks 5.3/5.4/5.5.

---

## What

Agent-visible outputs:

- `reports/phase-5-deploy.md` — documents every command, the output URL, the header-verification transcript.
- Optionally `.vercel/project.json` (auto-written by `vercel link`; committed? NO — per best practice add `.vercel` to `.gitignore`).

Human-visible outputs:

- Live URL in browser.
- Vercel dashboard showing the project linked.
- GitHub repo at `github.com/thekevinboyle/hand-tracker-fx` with `main` pushed.

### NOT Building (scope boundary)

- Custom domain — Vercel's default `*.vercel.app` is sufficient for MVP.
- Environment variables on Vercel — no secrets, no runtime config needed.
- Multiple environments (staging/prod split) — MVP uses preview for all PRs and prod for `main`.
- Vercel analytics / Web Vitals / Speed Insights — D34 forbids telemetry.
- `.github/workflows/*` wiring — that is Task 5.3.

### Success Criteria

- [ ] GitHub repo exists (public) at `github.com/thekevinboyle/hand-tracker-fx`
- [ ] `main` branch pushed, CI workflow file (if any) lands on remote
- [ ] Vercel project linked locally via `vercel link`
- [ ] First `vercel --prod` deploy succeeds
- [ ] Live URL serves `index.html` with COOP/COEP/CSP/Permissions-Policy headers matching D31 verbatim
- [ ] `crossOriginIsolated === true` on the live URL (verified via Playwright MCP)
- [ ] `PLAYWRIGHT_BASE_URL=<live-url> pnpm test:e2e --grep "Task 1.1:"` exits 0
- [ ] `reports/phase-5-deploy.md` captures commands + URL + header transcript

---

## All Needed Context

```yaml
files:
  - path: vercel.json
    why: Already sets every security header per D31. Do NOT modify in this task except to add `"git": { "deploymentEnabled": { "main": true } }` IF Vercel's dashboard UI toggle is insufficient.
    gotcha: The default on Vercel is production-deploy-on-main — explicit JSON is belt-and-suspenders.

  - path: .gitignore
    why: Must contain `.vercel/` BEFORE `vercel link` is run (it writes `.vercel/project.json` with project + org IDs, non-sensitive but org-scoped).
    gotcha: If `.vercel/` is not gitignored and a commit includes it, a future agent's `vercel link` in another workspace will conflict.

  - path: .claude/skills/vite-vercel-coop-coep/SKILL.md
    why: "Verification workflow" section (lines 217-246) shows the exact curl commands.
    gotcha: The section on `vercel link` (lines 252-260) notes the pnpm-dlx invocation.

  - path: playwright.config.ts
    why: Already honors `PLAYWRIGHT_BASE_URL` env var (per skill). No changes needed.
    gotcha: When base URL is external, `webServer` is undefined — Playwright doesn't try to build locally.

urls:
  - url: https://vercel.com/docs/cli
    why: `vercel link`, `vercel --prod`, `vercel whoami`
    critical: First-time `vercel login` is browser-based. Agent cannot complete it — must delegate to HUMAN.

  - url: https://cli.github.com/manual/gh_repo_create
    why: `gh repo create thekevinboyle/hand-tracker-fx --public --source=. --remote=origin --push`
    critical: `--source=.` uses the current directory; `--push` pushes current branch.

  - url: https://vercel.com/docs/deployments/deployment-protection
    why: Preview deployments are public by default — no auth wall.
    critical: If the user has "Deployment Protection" enabled org-wide, preview URLs return a login page. Task 5.3's `deployment_status` trigger handles this via a bypass secret.

skills:
  - prp-task-ralph-loop
  - hand-tracker-fx-architecture
  - vite-vercel-coop-coep
  - playwright-e2e-webcam

discovery:
  - D31: Vercel deploy on push to main; COOP+COEP+CSP+Permissions-Policy required on live.
  - D33: /models and /wasm self-hosted; live curl must show headers on those paths too.
  - D39: GitHub remote created when first deploy wired — this is that task.
  - D42: Final phase E2E hits the preview URL via PLAYWRIGHT_BASE_URL.
  - D43: User has (or will create) a Vercel account. Agent may drive Playwright MCP but `vercel login` requires human confirmation.
```

### Current Codebase Tree

```
hand-tracker/
├── vercel.json                (present, correct per D31)
├── .gitignore                 (check — must include .vercel/)
├── public/models/*, public/wasm/*
├── dist/                      (build output, gitignored)
└── .git/
    └── config                 (local only — no remote yet per D39)
```

### Desired Codebase Tree (changes in this task)

```
.gitignore                     MODIFIED — ensure `.vercel` and `.vercel/*` present
reports/
└── phase-5-deploy.md          NEW — deploy log + URL + curl transcript
```

Plus (external to filesystem):

- GitHub repo created
- Vercel project linked
- First prod deploy complete

### Known Gotchas

```typescript
// CRITICAL: Service worker from Task 5.1 must already be merged before this deploy,
// otherwise the first live load does not seed the SW cache. If 5.1 is not yet
// merged to main, HALT and flag.

// CRITICAL: vercel link writes .vercel/project.json — MUST be in .gitignore first.
// If accidentally committed, do a follow-up cleanup commit (git rm --cached .vercel).

// CRITICAL: pnpm, not npm or bun. vercel CLI respects the `installCommand`
// in vercel.json (we set it to `pnpm install --frozen-lockfile`) but the
// local `vercel --prod` invocation runs the same command. Keep lockfile current.

// CRITICAL: `gh auth login` and `vercel login` are browser-flow authentications.
// An agent CANNOT complete these. Prompt the HUMAN.

// CRITICAL: Never commit a Vercel token. The default auth stores it in
// `~/.vercel/auth.json`. `.vercel/project.json` in the repo holds only
// projectId + orgId, which are not secrets but are scoped to the user's account.

// CRITICAL: Do not enable Vercel Analytics / Speed Insights / Web Analytics.
// D34 forbids telemetry.
```

---

## Implementation Blueprint

### Step-by-step (mixed AGENT + HUMAN)

```yaml
Step 1 — AGENT: prepare local repo
  - IMPLEMENT: Verify `.gitignore` contains `.vercel` (add if missing, commit).
  - IMPLEMENT: Confirm `main` branch is green: `pnpm check && pnpm build && pnpm test:e2e --grep "Task 1.1:"`.
  - IMPLEMENT: Confirm SW task 5.1 is merged (`git log --oneline main | grep "Task 5.1"`).
  - VALIDATE: all three commands above exit 0.

Step 2 — HUMAN: authenticate CLIs
  - HUMAN: Run `gh auth status`. If not logged in as thekevinboyle, run `gh auth login` (follow browser flow).
  - HUMAN: Install Vercel CLI if needed: `pnpm add -g vercel` OR use `pnpm dlx vercel …` inline.
  - HUMAN: Run `vercel whoami`. If not logged in, run `vercel login` (follow browser flow).
  - AGENT prompt: "Please run the two auth commands above and paste the final `gh auth status` + `vercel whoami` output here before I continue."

Step 3 — AGENT: create GitHub repo + push
  - IMPLEMENT: `gh repo create thekevinboyle/hand-tracker-fx --public --source=. --remote=origin --push --description "TouchDesigner-style browser hand-tracking FX (React + Vite + MediaPipe)"`
  - GOTCHA: If the repo name already exists, add a suffix (e.g., `-fx`) and update this task file + commands accordingly. Confirm with HUMAN before renaming.
  - VALIDATE: `git remote -v` shows `origin → git@github.com:thekevinboyle/hand-tracker-fx.git`.
  - VALIDATE: `gh repo view --json url --jq .url` prints the repo URL.

Step 4 — HUMAN: link Vercel project (interactive prompts)
  - HUMAN: From repo root, run `vercel link`.
  - HUMAN: Answer prompts — scope: personal account; project name: `hand-tracker-fx`; link to existing or create new: CREATE NEW.
  - AGENT prompt: "After `vercel link` completes, paste the `.vercel/project.json` contents (or confirm the project was created) so I can verify."

Step 5 — HUMAN: first production deploy
  - HUMAN: Run `vercel --prod` from repo root.
  - HUMAN: Confirm prompts; wait for "✅ Production: https://<subdomain>.vercel.app" line.
  - AGENT prompt: "Paste the final deployment URL here."

Step 6 — AGENT: verify headers on live URL
  - IMPLEMENT: Given `<DEPLOY_URL>` from step 5, run:
      curl -sI "$DEPLOY_URL/" | grep -iE 'cross-origin|permissions-policy|content-security-policy|x-content-type-options|referrer-policy'
      curl -sI "$DEPLOY_URL/models/hand_landmarker.task" | grep -iE 'cross-origin|content-type|content-length'
      curl -sI "$DEPLOY_URL/wasm/vision_wasm_internal.wasm" | grep -iE 'cross-origin|content-type'
  - VALIDATE: Root response includes:
      cross-origin-opener-policy: same-origin
      cross-origin-embedder-policy: require-corp
      permissions-policy: camera=(self)
      content-security-policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; …
      x-content-type-options: nosniff
      referrer-policy: strict-origin-when-cross-origin
  - VALIDATE: Model + wasm responses include COOP + COEP.
  - GOTCHA: If any header missing → vercel.json was not deployed. Re-inspect build logs.

Step 7 — AGENT: drive Playwright MCP to verify crossOriginIsolated on live
  - IMPLEMENT: Use Playwright MCP:
      mcp__playwright__browser_navigate({ url: DEPLOY_URL })
      mcp__playwright__browser_evaluate({ function: "() => crossOriginIsolated" })
  - VALIDATE: evaluate returns literal true.
  - IMPLEMENT: Screenshot for the deploy report:
      mcp__playwright__browser_take_screenshot({ filename: "reports/phase-5-deploy-live.png", fullPage: true })
  - GOTCHA: If `crossOriginIsolated === false` on live but headers are present, check for an iframe or cross-origin script without CORP. Inspect Network tab.

Step 8 — AGENT: run Playwright E2E against live preview URL
  - IMPLEMENT: `PLAYWRIGHT_BASE_URL="$DEPLOY_URL" pnpm test:e2e --grep "Task 1.1:"`
  - VALIDATE: Exit 0. If fails on first-landmark timeout (60 s), re-run — cold CDN cache for model.
  - GOTCHA: If repeatedly fails, check whether the SW from 5.1 is caching the model correctly (devtools Application tab).

Step 9 — AGENT: write reports/phase-5-deploy.md
  - IMPLEMENT: Create `reports/phase-5-deploy.md` documenting:
      - Commands run (with HUMAN/AGENT attribution)
      - Final deploy URL
      - Full curl header transcript for /, /models/*, /wasm/*
      - `crossOriginIsolated` check evidence
      - Screenshot reference (reports/phase-5-deploy-live.png)
      - Any deviations (renamed repo, etc.)
  - MIRROR: If prior phase reports exist in `reports/`, follow their markdown style.
  - VALIDATE: `test -f reports/phase-5-deploy.md`

Step 10 — AGENT: commit + push
  - IMPLEMENT:
      git checkout -b task/5-2-deploy-first
      git add .gitignore reports/phase-5-deploy.md reports/phase-5-deploy-live.png
      git commit -m "Task 5.2: Create GitHub remote, link Vercel, ship first deploy"  (with Co-Authored-By trailer per D40)
      git push -u origin task/5-2-deploy-first
  - HUMAN: Open PR via `gh pr create --fill`; merge to main.
```

### Integration Points

```yaml
GitHub remote:
  - origin → git@github.com:thekevinboyle/hand-tracker-fx.git
  - default branch → main

Vercel:
  - Project: hand-tracker-fx
  - Production branch: main
  - Install command: pnpm install --frozen-lockfile (from vercel.json)
  - Build command: pnpm build
  - Output directory: dist
  - Environment variables: none

Downstream tasks:
  - 5.3: uses GitHub Actions on the new remote; deployment_status trigger fires from Vercel.
  - 5.4: hits PLAYWRIGHT_BASE_URL on every run (for error-state specs that want live CSP too).
  - 5.5: visual-fidelity gate captures screenshot against the live URL.
  - 5.R: `gh release create v0.1.0` uses this remote.
```

---

## Validation Loop

```bash
# Level 1 — Syntax & Style
pnpm lint
pnpm typecheck
# (No src changes in this task; this is a safety net.)

# Level 2 — Unit
pnpm test
# Again, no code changes — a regression guard.

# Level 3 — Integration
# The "integration" here is the deploy itself. Surrogate command:
pnpm build
# Confirms the same build that Vercel will run.

# Level 4 — E2E against live URL (requires step 6+ complete)
PLAYWRIGHT_BASE_URL="<paste-deploy-url>" pnpm test:e2e --grep "Task 1.1:"

# Additionally, the header-verification transcript:
DEPLOY_URL="<paste-deploy-url>"
curl -sI "$DEPLOY_URL/" | grep -iE 'cross-origin|permissions-policy|content-security-policy'
curl -sI "$DEPLOY_URL/models/hand_landmarker.task" | grep -iE 'cross-origin|content-type'
```

---

## Final Validation Checklist

### Technical

- [ ] `pnpm check` green locally
- [ ] `git remote -v` shows origin pointing at thekevinboyle/hand-tracker-fx
- [ ] `main` pushed to origin
- [ ] `vercel --prod` deploy succeeded
- [ ] `.vercel/` is gitignored
- [ ] `curl -I <deploy>/` shows all D31 headers
- [ ] `curl -I <deploy>/models/hand_landmarker.task` shows COOP + COEP
- [ ] Playwright MCP `crossOriginIsolated` returns true on live
- [ ] `PLAYWRIGHT_BASE_URL=<deploy> pnpm test:e2e --grep "Task 1.1:"` exits 0
- [ ] `reports/phase-5-deploy.md` written

### Feature

- [ ] Opening the live URL in a fresh Chrome profile renders the app
- [ ] Allow camera → webcam feed appears
- [ ] Landmarks render within 60s
- [ ] Devtools Security tab shows "Secure (strict)"

### Code Quality

- [ ] No secrets committed
- [ ] `.vercel/project.json` NOT in git
- [ ] `reports/phase-5-deploy.md` does not contain Vercel auth tokens
- [ ] Commit message follows `Task 5.2:` convention with Co-Authored-By trailer

---

## Anti-Patterns

- Do NOT run `vercel login` or `gh auth login` as the agent. Browser-flow auth requires human presence.
- Do NOT commit `.vercel/project.json` — gitignore first, then `vercel link`.
- Do NOT enable Vercel Web Analytics, Speed Insights, or Observability plugins. D34 forbids telemetry.
- Do NOT modify `vercel.json` in this task without re-running Phase 6 header-verification.
- Do NOT use `npm install -g vercel`. If globally installing, use `pnpm add -g vercel`; preferably use `pnpm dlx vercel …` one-shot.
- Do NOT commit a deploy URL that contains a preview hash into DISCOVERY.md — the canonical URL is the production alias (`hand-tracker-fx.vercel.app` or similar).
- Do NOT push to `main` directly for this task — use `task/5-2-deploy-first` branch + PR.

Universal anti-patterns apply (`.claude/skills/prp-task-ralph-loop/SKILL.md` §6).

---

## No Prior Knowledge Test

- [ ] `vercel.json` exists and is correct per D31
- [ ] `playwright.config.ts` already honors `PLAYWRIGHT_BASE_URL`
- [ ] D31, D33, D39, D42, D43 exist in DISCOVERY.md
- [ ] `.claude/skills/vite-vercel-coop-coep/SKILL.md` has a "Verification workflow" section with the exact curl commands
- [ ] `.claude/skills/playwright-e2e-webcam/SKILL.md` documents `PLAYWRIGHT_BASE_URL`
- [ ] User identity `thekevinboyle` matches workspace git user (verified in D43)
- [ ] Task is atomic: everything it creates externally (GitHub repo, Vercel project) is a one-time action

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/vite-vercel-coop-coep/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
```
