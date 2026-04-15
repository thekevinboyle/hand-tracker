# Task 5.R: Final cut — tag v0.1.0, polish README, CHANGELOG, archive Ralph state

**Phase**: 5 — Deploy + Comprehensive E2E
**Branch**: `task/5-R-final-cut`
**Commit prefix**: `Task 5.R:`
**Estimated complexity**: Low
**Max Ralph iterations**: 10

---

## Goal

**Feature Goal** — Close out the MVP by tagging `v0.1.0`, writing a release-worthy `README.md` + `CHANGELOG.md`, and archiving the Ralph loop state file to the reports directory for posterity.

**Deliverable** —

- `CHANGELOG.md` at repo root containing the v0.1.0 entry following Keep-a-Changelog format.
- `README.md` polished — accurate quickstart, feature bullets, tech stack, live-demo link, contributing section (minimal).
- Git tag `v0.1.0` on `main` at the commit hash of the Phase 5 final merge.
- GitHub release `v0.1.0` via `gh release create`.
- `reports/prp-ralph-final.md` — copy of `.claude/prp-ralph.state.md` (last-known-good state before this task) + a one-paragraph retrospective.
- `.claude/prp-ralph.state.md` deleted (standard per Ralph completion protocol in SKILL §3g).

**Success Definition** —

1. `git tag --list v0.1.0` returns the tag; `git show v0.1.0` points at the correct commit.
2. `gh release view v0.1.0 --json url --jq .url` returns the release URL.
3. `README.md` renders cleanly on GitHub (agent view via `gh` + browser or Playwright MCP).
4. `CHANGELOG.md` is valid Keep-a-Changelog markdown.
5. `reports/prp-ralph-final.md` exists; `.claude/prp-ralph.state.md` does not.
6. CI `main` build is green.

---

## User Persona

**Target User** — Anyone landing on the GitHub repo: a developer evaluating the project, a recruiter reviewing code quality, a future contributor.

**Use Case** — First-impression handoff: the README tells a visitor what the app is, the live-demo link proves it works, the CHANGELOG records the v0.1.0 milestone.

**User Journey**:

1. Visitor opens `github.com/thekevinboyle/hand-tracker-fx`.
2. README renders with: hero image (reference screenshot thumbnail + link to live demo), 3-sentence pitch, quickstart commands, tech stack table, link to DISCOVERY.md for deep dive.
3. Visitor clicks Releases → sees v0.1.0 with CHANGELOG copy.
4. Visitor runs `pnpm install && pnpm dev` locally and it works.

**Pain Points Addressed** — README rot between scaffold and release; unnamed releases; orphaned state files.

---

## Why

- PHASES.md Task 5.R explicitly says: "Tag v0.1.0, finalize README, close any remaining Known Issues, archive orchestration state."
- D40: Commit convention; same applies to release tag naming.
- Ralph loop SKILL §3g: on completion, archive state file and delete the working copy.
- Closes Phase 5.

---

## What

Agent-visible outputs:

- `CHANGELOG.md` (new, ~80 lines)
- `README.md` (modified — polish existing scaffold-era README)
- `reports/prp-ralph-final.md` (new — archived state + retrospective)
- Git tag `v0.1.0`
- GitHub release

### NOT Building (scope boundary)

- A proper release-notes document beyond the CHANGELOG — the CHANGELOG entry IS the release notes.
- Automated release workflow (semantic-release, etc.) — MVP does one release; automation is overkill.
- Screenshots or animated GIFs in the README — a link to the live demo and the reference screenshot is sufficient.
- Badges (Actions status, coverage, license) — OPTIONAL; include Actions status if trivial, skip the rest.
- Contributing guide / Code of Conduct — no external contributors yet; deferred.
- Publishing to npm / publishing the model — self-contained SPA, no artifact registry.

### Success Criteria

- [ ] `CHANGELOG.md` exists; parses as Keep-a-Changelog
- [ ] `README.md` updated; no TODO / FIXME / scaffold placeholders left
- [ ] `git tag v0.1.0` set on the final merge commit
- [ ] `gh release create v0.1.0 --notes-file CHANGELOG.md --title "v0.1.0 — MVP"` succeeded
- [ ] `reports/prp-ralph-final.md` archived with retrospective
- [ ] `.claude/prp-ralph.state.md` deleted
- [ ] CI green on `main` after merge

---

## All Needed Context

```yaml
files:
  - path: README.md
    why: Existing scaffold README. Polish rather than rewrite — preserve structure and expand.
    gotcha: Check for any `TODO` / scaffold-era phrasing ("this is a starter template") and remove.

  - path: DISCOVERY.md
    why: Source of truth for feature bullets. CHANGELOG entry should align with Success Criteria §13.
    gotcha: Do not duplicate DISCOVERY — link to it for the deep-dive.

  - path: .claude/prp-ralph.state.md
    why: May or may not exist. If it does, copy before deletion.
    gotcha: Do not delete without archiving first. If it does not exist (prior task cleaned up properly), note "no state file to archive" in reports/prp-ralph-final.md.

  - path: reports/
    why: Destination for the archived state.
    gotcha: Directory exists from prior tasks (5.2, 5.5).

  - path: .claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png
    why: May be referenced in README as the visual target. Use a relative link.
    gotcha: Do not embed the 1920x1080 PNG in the README body; link it.

urls:
  - url: https://keepachangelog.com/en/1.1.0/
    why: CHANGELOG format
    critical: Sections: Added / Changed / Deprecated / Removed / Fixed / Security. `[0.1.0] - YYYY-MM-DD` header.

  - url: https://cli.github.com/manual/gh_release_create
    why: GitHub release creation
    critical: `--notes-file` reads from a file; `--title` overrides the tag as display title. Use tag `v0.1.0`.

  - url: https://git-scm.com/docs/git-tag
    why: Annotated vs lightweight tags
    critical: Use ANNOTATED (`git tag -a v0.1.0 -m "..."`) so the tag carries metadata and a date.

skills:
  - prp-task-ralph-loop
  - hand-tracker-fx-architecture

discovery:
  - D39: Trunk-based; v0.1.0 is tagged on main.
  - D40: Commit convention + Co-Authored-By trailer on every commit including release commits.
  - D41: 4-level validation precedes release.
  - D42: Final phase runs against Vercel preview — already done in 5.3/5.4/5.5.
  - D43: GitHub user thekevinboyle; release lands there.
```

### Current Codebase Tree

```
hand-tracker/
├── README.md                (scaffold-era; needs polish)
├── DISCOVERY.md? → .claude/orchestration-hand-tracker-fx/DISCOVERY.md
├── CHANGELOG.md             (does not yet exist)
├── reports/
│   ├── phase-5-deploy.md
│   ├── phase-5-visual-fidelity.md
│   └── phase-5-reference-side-by-side.png
└── .claude/
    └── prp-ralph.state.md   (may exist; this task archives + deletes)
```

### Desired Codebase Tree

```
README.md                    MODIFIED
CHANGELOG.md                 NEW
reports/
└── prp-ralph-final.md       NEW
.claude/
(no prp-ralph.state.md)
```

### Known Gotchas

```typescript
// CRITICAL: Do NOT force-push to main for this task. Create the task branch,
// PR, merge cleanly. The tag is applied AFTER the merge commit lands on main.

// CRITICAL: Annotated tag: `git tag -a v0.1.0 -m "v0.1.0 — MVP"`. Lightweight
// tags (`git tag v0.1.0`) work but gh release prefers annotated tags.

// CRITICAL: `gh release create` pushes the tag if it is only local. Ensure
// the tag is on the merge commit on main BEFORE running `gh release create`.

// CRITICAL: CHANGELOG.md must list `v0.1.0` as the TOP entry under
// "## [0.1.0] - YYYY-MM-DD". Keep a placeholder "## [Unreleased]" at top
// for future work, but NOT required for MVP.

// CRITICAL: The Ralph state file is gitignored per SKILL.md §4 — do not
// `git add .claude/prp-ralph.state.md` (it won't stage anyway). The
// archived copy under reports/ is committed instead.

// CRITICAL: pnpm, not npm or bun. Release script uses gh CLI directly;
// no Node-side build needed for the release itself.
```

---

## Implementation Blueprint

### Implementation Tasks

```yaml
Task 1: AGENT — archive Ralph state
  - IMPLEMENT:
      if [ -f .claude/prp-ralph.state.md ]; then
        cp .claude/prp-ralph.state.md reports/prp-ralph-final.md
      else
        # Create a stub documenting no in-progress state
        printf "# Ralph Final State — Phase 5\n\nNo active state file at Phase 5 completion.\n" > reports/prp-ralph-final.md
      fi
  - IMPLEMENT: Append a retrospective paragraph:
      ## Retrospective
      - Total phases: 5 (32 tasks)
      - Final deploy URL: <from reports/phase-5-deploy.md>
      - Visual-fidelity verdict: <from reports/phase-5-visual-fidelity.md>
      - Known limitations: <SYSTEM_DENIED/DEVICE_CONFLICT URL-param-forced; pixel-diff gate intentionally not wired>
  - NAMING: File is exactly `reports/prp-ralph-final.md`.
  - VALIDATE: `test -f reports/prp-ralph-final.md`

Task 2: AGENT — remove active state file
  - IMPLEMENT: `rm -f .claude/prp-ralph.state.md`
  - GOTCHA: Only after Task 1 completes. Never before.
  - VALIDATE: `test ! -f .claude/prp-ralph.state.md`

Task 3: AGENT — write CHANGELOG.md
  - IMPLEMENT: Create CHANGELOG.md with Keep-a-Changelog structure. See "CHANGELOG.md full content" below.
  - NAMING: File is exactly `CHANGELOG.md` at repo root.
  - VALIDATE: `head -3 CHANGELOG.md` starts with `# Changelog`

Task 4: AGENT — polish README.md
  - IMPLEMENT: Replace scaffold README with a release-worthy README. See "README.md full content" below.
  - NAMING: File is exactly `README.md` at repo root.
  - GOTCHA: Preserve any existing license block; add one if missing (MIT is default).
  - VALIDATE: `head -20 README.md` matches expected structure; no TODO markers.

Task 5: AGENT — pnpm check + build
  - IMPLEMENT:
      pnpm check
      pnpm build
  - VALIDATE: both exit 0. If check fails, fix issues (non-release-related regressions).

Task 6: AGENT — commit, push, merge
  - IMPLEMENT:
      git checkout -b task/5-R-final-cut
      git add CHANGELOG.md README.md reports/prp-ralph-final.md
      git commit -m "Task 5.R: Final cut — v0.1.0 README + CHANGELOG + archive state"  (with Co-Authored-By trailer)
      git push -u origin task/5-R-final-cut
      gh pr create --fill --title "Task 5.R: Final cut — v0.1.0"
  - HUMAN: Merge PR to main (fast-forward).

Task 7: AGENT — tag v0.1.0 + create release
  - IMPLEMENT: After merge lands on main:
      git fetch origin
      git checkout main
      git pull --ff-only
      git tag -a v0.1.0 -m "v0.1.0 — MVP: hand-tracking mosaic effect"
      git push origin v0.1.0
      gh release create v0.1.0 \
        --title "v0.1.0 — MVP" \
        --notes-file CHANGELOG.md \
        --latest
  - VALIDATE:
      git tag --list v0.1.0                        # prints v0.1.0
      gh release view v0.1.0 --json url --jq .url  # prints release URL
  - GOTCHA: `--notes-file CHANGELOG.md` passes the ENTIRE file as notes; the release UI trims appropriately. Alternative: extract just the v0.1.0 section to a temp file and pass that.
```

### CHANGELOG.md full content

Copy verbatim; fill in the date.

```markdown
# Changelog

All notable changes to Hand Tracker FX are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-14

First public release. TouchDesigner-inspired browser hand-tracking video effects. Ships exactly one effect: the Hand Tracking Mosaic.

### Added
- Browser-based webcam hand tracker powered by MediaPipe HandLandmarker (main-thread, GPU delegate).
- WebGL mosaic effect (ogl) constrained to a polygon derived from 6 landmarks (wrist + 5 fingertips).
- Seeded procedural grid overlay (non-uniform column widths, user-tunable variance).
- Canvas 2D overlay drawing 5 dotted fingertip blobs with 3-decimal normalized xy labels.
- Tweakpane parameter panel (grid, mosaic, effect, input, modulation pages).
- X/Y modulation engine with bezier easing; defaults bind landmark[8].x → mosaic.tileSize and landmark[8].y → grid.columnCount.
- Preset system (save/load/delete/export/import) persisted to localStorage; chevron cycler + ArrowLeft/Right keys.
- MediaRecorder → .webm download (vp9 default, vp8 fallback), no audio, blob-in-memory.
- Reduced-motion honored: modulation pauses, rendering continues.
- Full 8-state webcam permission state machine (D23) with dedicated full-screen cards.
- Service worker cache-first for /models/* and /wasm/* (production only).
- Self-hosted MediaPipe model (7.82 MB float16) + wasm (~52 MB); no CDN at runtime.
- Vercel deployment with COOP, COEP, CSP (`wasm-unsafe-eval`, `worker-src 'self' blob:`, etc.), Permissions-Policy `camera=(self)`.
- GitHub Actions CI: typecheck, lint, unit, build, Playwright E2E; preview-URL E2E on deployment_status.
- E2E coverage for all 8 D23 states with forced-failure scenarios.
- Visual-fidelity gate against the TouchDesigner reference screenshot (pass).

### Known limitations
- SYSTEM_DENIED and DEVICE_CONFLICT are verified via URL-param forcing + unit-tested reducer (Chromium fake-device cannot reproduce the OS-level conditions).
- Desktop-only; no mobile layout (explicit scope decision per DISCOVERY.md D3).
- No light theme, no audio, no multi-hand, no analytics (explicit non-goals per DISCOVERY.md §12).

### Security
- Strict CSP with `default-src 'self'`; only `wasm-unsafe-eval` and `unsafe-inline` styles (Tweakpane runtime requirement) relaxed.
- Cross-origin isolation enforced (SharedArrayBuffer required for MediaPipe threads).
- No telemetry, analytics, or error-reporting SaaS (D34). All processing stays on-device.

[0.1.0]: https://github.com/thekevinboyle/hand-tracker-fx/releases/tag/v0.1.0
```

### README.md full content

Copy verbatim; replace `<DEPLOY_URL>` with the actual production alias.

```markdown
# Hand Tracker FX

TouchDesigner-inspired, browser-based webcam hand-tracking video effects. Ships the "Hand Tracking Mosaic" effect that pixellates grid cells bounded by your hand. Everything runs on-device — your webcam never leaves your browser.

**Live demo**: <https://<DEPLOY_URL>>

![Reference screenshot — TouchDesigner visual target](.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png)

---

## Features

- Real-time hand tracking via MediaPipe HandLandmarker (GPU-accelerated, main-thread).
- WebGL mosaic effect masked to the hand region (ogl fragment shader).
- Seeded procedural grid overlay with user-tunable non-uniformity.
- 5 dotted fingertip blobs with normalized xy labels.
- Tweakpane parameter panel; X/Y modulation routes; preset save/load + chevron cycler.
- MediaRecorder → .webm download (vp9 with vp8 fallback).
- Honors `prefers-reduced-motion`.
- Full 8-state webcam permission machine with dedicated error cards.
- Strict CSP + COOP + COEP; service-worker caching for the model + wasm.

## Quick start

Prerequisites: Node 22+, pnpm 10, a desktop browser (Chrome 120+, Firefox 132+, Safari 17+).

```bash
pnpm install
pnpm dev          # opens http://localhost:5173
```

### Production build + preview

```bash
pnpm build
pnpm preview      # serves dist/ on http://localhost:4173 with COOP/COEP
```

### Testing

```bash
pnpm check        # typecheck + lint + unit
pnpm test:setup   # regenerate the fake-webcam Y4M (requires ffmpeg)
pnpm test:e2e     # Playwright E2E (Chromium + fake device)
```

## Tech stack

| Layer | Tool |
|---|---|
| Build | Vite 8 + TypeScript 6 strict |
| UI | React 19 |
| Params | Tweakpane 4 + plugin-essentials |
| Tracking | @mediapipe/tasks-vision (HandLandmarker) |
| Rendering | ogl (WebGL 2) + Canvas 2D overlay |
| Tests | Vitest + Playwright |
| Lint/format | Biome 2 |
| Deploy | Vercel |

## Architecture

See [DISCOVERY.md](.claude/orchestration-hand-tracker-fx/DISCOVERY.md) for the authoritative product + tech decisions (D1–D45). High-level flow:

1. `<video>` element holds the raw unmirrored stream.
2. MediaPipe runs `detectForVideo()` on each `requestVideoFrameCallback` tick.
3. The effect registry resolves the active effect; `paramStore` supplies current params; modulation routes transform them.
4. WebGL layer (full-screen quad + mosaic shader) renders the video texture with per-cell pixelation inside the hand polygon.
5. Canvas 2D layer draws grid lines, dotted blobs, and coordinate labels on top.
6. CSS `scaleX(-1)` on the displayed canvases produces the mirror effect; landmark math stays in the unmirrored coordinate space.

## Privacy

All processing runs locally in your browser. There is no server, no analytics, no error-reporting SaaS, and no telemetry. The webcam stream is never uploaded anywhere.

## Status

**v0.1.0 — MVP** (2026-04-14). See [CHANGELOG.md](./CHANGELOG.md).

## License

MIT
```

### Integration Points

```yaml
GitHub:
  - Tag v0.1.0 on main
  - Release v0.1.0 visible at /releases
  - README renders on repo landing page

Vercel:
  - No change; production deploy remains current

Downstream:
  - Phase 5 closed; no further phases per PHASES.md
```

---

## Validation Loop

```bash
# Level 1 — Syntax & Style
pnpm lint
pnpm typecheck

# Level 2 — Unit
pnpm test

# Level 3 — Integration
pnpm build
# Plus: verify new files well-formed
test -f CHANGELOG.md
test -f README.md
test -f reports/prp-ralph-final.md
test ! -f .claude/prp-ralph.state.md

# Level 4 — E2E
pnpm test:e2e --grep "Task 1.1:"   # regression smoke on the release build
```

Post-merge:

```bash
# Tag and release — run only AFTER merge lands on main
git fetch origin && git checkout main && git pull --ff-only
git tag -a v0.1.0 -m "v0.1.0 — MVP"
git push origin v0.1.0
gh release create v0.1.0 --title "v0.1.0 — MVP" --notes-file CHANGELOG.md --latest
gh release view v0.1.0 --json url --jq .url
```

---

## Final Validation Checklist

### Technical

- [ ] `pnpm check` green
- [ ] `pnpm build` green
- [ ] `pnpm test:e2e --grep "Task 1.1:"` green
- [ ] `CHANGELOG.md` parses
- [ ] `README.md` contains no TODO/FIXME/scaffold placeholders
- [ ] `git tag --list v0.1.0` returns v0.1.0
- [ ] `gh release view v0.1.0` returns the release
- [ ] `reports/prp-ralph-final.md` exists
- [ ] `.claude/prp-ralph.state.md` does not exist

### Feature

- [ ] README hero image renders (reference screenshot link works)
- [ ] README `pnpm install && pnpm dev` instructions work on a fresh clone
- [ ] CHANGELOG v0.1.0 entry lists all Phase 1–5 deliverables

### Code Quality

- [ ] No secrets committed
- [ ] Commit message matches `Task 5.R:` + Co-Authored-By trailer
- [ ] Annotated tag (`git tag -a`) not lightweight
- [ ] `gh release create` uses `--notes-file CHANGELOG.md` (not inline body)

---

## Anti-Patterns

- Do NOT force-push to main or the release tag.
- Do NOT skip the Ralph state archive — future retrospectives depend on it.
- Do NOT commit `.claude/prp-ralph.state.md` — it is gitignored per SKILL §4.
- Do NOT pre-tag v0.1.0 before the PR is merged — the tag attaches to the PR's HEAD commit, which is not on main.
- Do NOT embed the full reference screenshot as base64 in the README — link it.
- Do NOT write release notes beyond the CHANGELOG — single source of truth.
- Do NOT add badges (coverage, build status) if they require adding extra CI steps.
- Do NOT bump version to 1.0.0 — per semver, 0.1.0 is the correct MVP designation (unstable API).

Universal anti-patterns apply (`.claude/skills/prp-task-ralph-loop/SKILL.md` §6).

---

## No Prior Knowledge Test

- [ ] `README.md` exists in the repo (to be modified, not created)
- [ ] `CHANGELOG.md` does NOT exist yet (new file)
- [ ] `reports/` directory exists (from prior Phase 5 tasks)
- [ ] `gh` CLI authenticated as thekevinboyle (verified in Task 5.2)
- [ ] `main` branch is green and Phase 5 tasks 5.1–5.5 are merged
- [ ] DISCOVERY.md D39, D40, D43 exist
- [ ] Keep-a-Changelog URL is reachable
- [ ] Task is atomic and is the final task of Phase 5

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
```
