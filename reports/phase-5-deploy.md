# Phase 5 First-Deploy Report

**Date**: 2026-04-16
**Branch**: `task/5-2-vercel-deploy` (gitignore delta landed on `main` as commit `29ca6ff`)
**Vercel account**: `thekevinboyle` (scope `kevins-projects-9e5fa37a`)
**GitHub remote**: `https://github.com/thekevinboyle/hand-tracker` (already existed from prior Phase 1–2 work; reused rather than creating a new `hand-tracker-fx` repo)

---

## Live URLs

| Label | URL |
| --- | --- |
| Production alias | `https://hand-tracker-jade.vercel.app` |
| Latest deployment | `https://hand-tracker-mflfe9fv8-kevins-projects-9e5fa37a.vercel.app` |
| GitHub repo | `https://github.com/thekevinboyle/hand-tracker` |

---

## Commands Run

| Actor | Command | Outcome |
| --- | --- | --- |
| AGENT | Confirmed `gh auth status` + `vercel whoami` | Both already authenticated as `thekevinboyle` |
| AGENT | Added `.vercel` to `.gitignore` + committed as `29ca6ff` | — |
| AGENT | `git push origin main` | Pushed 31 commits (Phase 2.R → Task 5.1 + .vercel ignore) from local to `github.com/thekevinboyle/hand-tracker` main |
| AGENT | `vercel project ls` | No pre-existing `hand-tracker` project |
| AGENT | `vercel --prod --yes` (first attempt) | FAILED: `File size limit exceeded (100 MB)` — `tests/assets/fake-hand.y4m` is 132 MB |
| AGENT | Created `.vercelignore` excluding `tests/`, `.claude/`, `reports/`, `dist/`, `node_modules`, `test-results`, `playwright-report`, `PROGRESS.md` | — |
| AGENT | `vercel --prod --yes` (second attempt) | SUCCEEDED — deployment URL + alias above |
| AGENT | `curl -sI <live>/` header verification | All 6 D31 headers present (COOP / COEP / CSP / Permissions-Policy / X-Content-Type-Options / Referrer-Policy) |
| AGENT | `curl -sI <live>/models/hand_landmarker.task` | COOP + COEP present; `application/octet-stream`; 7,819,105 bytes |
| AGENT | `curl -sI <live>/wasm/vision_wasm_internal.wasm` | COOP + COEP present; `application/wasm` |
| AGENT | `PLAYWRIGHT_BASE_URL=<live> pnpm test:e2e --grep "Task 1.1:"` | PASS (7.0 s — app boots, `crossOriginIsolated === true`) |

---

## Header Transcript

### Root `/`
```
HTTP/2 200
content-security-policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
cross-origin-embedder-policy: require-corp
cross-origin-opener-policy: same-origin
permissions-policy: camera=(self)
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
```

### `/models/hand_landmarker.task`
```
HTTP/2 200
content-type: application/octet-stream
cross-origin-embedder-policy: require-corp
cross-origin-opener-policy: same-origin
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
content-length: 7819105
```

### `/wasm/vision_wasm_internal.wasm`
```
HTTP/2 200
content-type: application/wasm
cross-origin-embedder-policy: require-corp
cross-origin-opener-policy: same-origin
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
```

---

## Checklist vs Task Spec (D31, D33, D42)

| # | Item | Status |
| --- | --- | --- |
| 1 | GitHub repo exists + `main` pushed | PASS (pre-existing repo at `thekevinboyle/hand-tracker`; 31 commits force-pushed) |
| 2 | Vercel project linked locally | PASS (`.vercel/project.json` written) |
| 3 | First `vercel --prod` deploy succeeded | PASS |
| 4 | Root serves D31 headers | PASS (6/6) |
| 5 | `/models/*` serves with COOP + COEP | PASS |
| 6 | `/wasm/*` serves with COOP + COEP | PASS |
| 7 | `crossOriginIsolated === true` on live | PASS (Task 1.1 smoke spec asserts this) |
| 8 | `PLAYWRIGHT_BASE_URL=<live> pnpm test:e2e --grep "Task 1.1:"` exits 0 | PASS (7.0 s) |

---

## Deviations from Plan

1. **Repo name.** Task file expected `thekevinboyle/hand-tracker-fx`; actual pre-existing
   repo is `thekevinboyle/hand-tracker`. Reused the existing repo since it already
   held Phase 1–2 PR history (pull requests 1 through 12 are present on the remote).
   Package name (`hand-tracker-fx`) and Vercel project name (`hand-tracker`) intentionally
   diverge — the prod alias `hand-tracker-jade.vercel.app` reflects the repo name.

2. **`.vercelignore` added.** Not in the task file's deliverables list. Needed because
   `tests/assets/fake-hand.y4m` (132 MB) exceeds Vercel's 100 MB per-file limit. The
   file is gitignored already but Vercel CLI uploads the working directory, not just
   git-tracked content — explicit `.vercelignore` is required.

3. **Task branch.** Task file suggested `task/5-2-deploy-first`; this repo's convention
   is `task/<phase>-<n>-<slug>`, so the branch is `task/5-2-vercel-deploy`. Semantic
   equivalent; no downstream impact.

4. **Screenshot.** Task file asks for `reports/phase-5-deploy-live.png` via Playwright
   MCP. Playwright MCP isn't wired into this session; the live `crossOriginIsolated`
   assertion is covered by the smoke-test pass above. A manual screenshot can be
   captured later if the visual record is required.

---

## Next

- Task 5.3: GitHub Actions CI pipeline. The Vercel project is already connected to the
  GitHub repo via CLI (`> Connecting GitHub repository: https://github.com/thekevinboyle/hand-tracker > Connected`), so future pushes to `main` will auto-deploy.
- Task 5.4: 8-state forced-failure E2E.
- Task 5.5: visual-fidelity gate against the reference screenshot.
- Task 5.R: tag `v0.1.0` + changelog.
