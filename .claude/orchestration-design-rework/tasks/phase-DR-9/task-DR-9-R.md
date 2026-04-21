# Task DR-9.R: Final cut — tag v0.1.0, CHANGELOG, archive TouchDesigner reference, update PROGRESS + CLAUDE

**Phase**: DR-9 — Parent Phase-5 Resume (final task)
**Parent task**: 5.R (final cut — tag v0.1.0, changelog, archive)
**Branch**: `task/DR-9-R-final-cut`
**Commit prefix**: `Task DR-9.R:`
**Estimated complexity**: Low
**Max Ralph iterations**: 10

---

## Objective

Close out the MVP + design-rework line by:

1. Moving `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png` → `…/reference-assets/_historical/touchdesigner-reference.png` (DR17 lock: "move, don't delete").
2. Writing `CHANGELOG.md` at repo root in Keep-a-Changelog format with a v0.1.0 entry describing both the MVP and the design rework.
3. Updating `PROGRESS.md` to mark ALL DR-* tasks `done` AND all parent 5.3 / 5.4 / 5.5 / 5.R tasks `done` via the DR-9.x mapping.
4. Updating `CLAUDE.md` at repo root to add a new "Design Rework" section pointing at `.claude/orchestration-design-rework/` + noting the TouchDesigner reference is archived under `_historical/`.
5. Archiving the Ralph state file (`.claude/prp-ralph.state.md` → `reports/prp-ralph-final.md` + retrospective) and deleting the working copy.
6. Creating an annotated git tag `v0.1.0` on `main` at the DR-9.R merge commit, and a GitHub release pointing at the CHANGELOG.

This is parent task 5.R executed on the design-reworked main. The CHANGELOG consolidates the entire journey: Phase 1–4 engine work + Phase 5.1/5.2 deploy + Phase DR-6/7/8 chrome rework + Phase DR-9 parent-Phase-5 resume.

---

## Context

After DR-9.1 (CI), DR-9.2 (error-state E2E), and DR-9.3 (visual-fidelity gate) merge, the repo is code-complete for v0.1.0. DR-9.R is admin: it produces the documentation + tagging ceremony that marks the release. No source changes. No test changes. Only housekeeping files + git metadata.

**Authority**: DR DISCOVERY §DR17 (archive TouchDesigner reference) + §DR18 (footer shows `v0.1.0`) + parent 5.R contract (Keep-a-Changelog + annotated tag + `gh release create`).

---

## Dependencies

- **DR-9.1** merged — CI green on `main`.
- **DR-9.2** merged — all 8 error-state specs green.
- **DR-9.3** merged — visual-fidelity gate green on live.
- **Parent DISCOVERY.md** — tech stack + feature list that feeds the CHANGELOG "Added" section.
- **DR DISCOVERY.md** — DR decisions that feed the CHANGELOG "Changed" section.
- `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png` — file to move.
- `PROGRESS.md` + `CLAUDE.md` — files to edit.

## Blocked By

- DR-9.1, DR-9.2, DR-9.3 all merged to `main` with green CI.

---

## Research Findings

- **Parent task 5.R** (`.claude/orchestration-hand-tracker-fx/tasks/phase-5/task-5-R.md`) — Keep-a-Changelog + annotated tag + `gh release create` pattern. DR-9.R inherits verbatim and extends the v0.1.0 entry with DR-* bullets.
- **DR DISCOVERY §DR17** — "Move, don't delete. `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png` → `.claude/orchestration-hand-tracker-fx/reference-assets/_historical/touchdesigner-reference.png`. Keep git history of both references. Update any CLAUDE.md / PROGRESS.md references to the new path or mark historical."
- **DR DISCOVERY §DR18** — Footer renders `hand-tracker-fx v0.1.0 …`; the tag value `v0.1.0` must match what DR-8.7 hardcoded into the footer.
- **Keep-a-Changelog v1.1.0** — sections: Added / Changed / Deprecated / Removed / Fixed / Security. Top entry `[0.1.0] - YYYY-MM-DD`. Reference link at bottom: `[0.1.0]: https://github.com/thekevinboyle/hand-tracker/releases/tag/v0.1.0`.
- **Git annotated tag** — `git tag -a v0.1.0 -m "…"` (NOT lightweight); `gh release create` prefers annotated.
- **Ralph state archival** — per `prp-task-ralph-loop` skill §3g: on final-task completion, copy `.claude/prp-ralph.state.md` to `reports/prp-ralph-final.md` + retrospective, then delete the working copy.

---

## Implementation Plan

### Step 1: Archive TouchDesigner reference (DR17)

```bash
mkdir -p .claude/orchestration-hand-tracker-fx/reference-assets/_historical
git mv \
  .claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png \
  .claude/orchestration-hand-tracker-fx/reference-assets/_historical/touchdesigner-reference.png
```

`git mv` preserves history. Do not copy + delete.

Search for any remaining references to the old path and update them:

```bash
grep -Rln 'touchdesigner-reference.png' \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=_historical 2>/dev/null \
  | grep -v playwright-report
# For each hit: update to _historical/touchdesigner-reference.png
# OR mark the reference as archived + point forward to DR's design-rework-reference.png.
```

Expected hits: `CLAUDE.md` (Quick Reference table — update per Step 5), older phase reports under `reports/` (leave historical references as-is; they document past state).

### Step 2: Create `CHANGELOG.md` at repo root

Keep-a-Changelog format. Today's date is 2026-04-19 (fill in the date of actual merge). Replace `<DATE>` below with ISO-8601 date.

```markdown
# Changelog

All notable changes to Hand Tracker FX are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - <DATE>

First public release. Browser hand-tracking video effects running entirely on-device. Ships exactly one effect — the Hand Tracking Mosaic — behind a pixelcrash-inspired dark-mode chrome.

### Added (MVP engine, Phases 1–5.1)

- Webcam hand tracker powered by MediaPipe HandLandmarker 0.10.34 (main-thread, GPU delegate with WebGL fallback).
- WebGL mosaic effect (ogl) constrained to a 6-landmark hand polygon (wrist + 5 fingertips).
- Seeded procedural grid overlay with user-tunable non-uniform column widths (Mulberry32 PRNG).
- Canvas 2D overlay drawing 5 dotted fingertip blobs with 3-decimal normalized xy labels.
- X/Y modulation engine with bezier-easing curves; defaults bind landmark[8].x → mosaic.tileSize and landmark[8].y → grid.columnCount.
- Preset save/load/delete/export/import persisted to localStorage; chevron cycler + ArrowLeft/Right keyboard cycling.
- MediaRecorder → .webm download (vp9 with vp8 fallback), no audio, blob-in-memory.
- `prefers-reduced-motion` honored: modulation pauses, rendering continues.
- Full 8-state webcam permission machine (PROMPT, GRANTED, USER_DENIED, SYSTEM_DENIED, DEVICE_CONFLICT, NOT_FOUND, MODEL_LOAD_FAIL, NO_WEBGL) with dedicated full-screen cards.
- Service worker cache-first for `/models/*` and `/wasm/*` (production only).
- Self-hosted MediaPipe model (7.82 MB float16) + 6 wasm files (~52 MB); no CDN at runtime.
- Vercel deployment with COOP `same-origin` + COEP `require-corp` + full CSP + Permissions-Policy `camera=(self)`.

### Changed (Design Rework, Phases DR-6–DR-8)

- Replaced Tweakpane with hand-built React chrome: toolbar (wordmark + cell-size Segmented + record), right sidebar (preset strip + LAYER 1 card + MODULATION card), tokens-driven custom primitives (Button, Segmented, Slider, Toggle, ColorPicker, LayerCard, ModulationRow).
- Introduced design-token system in `src/ui/tokens.css` + `src/ui/tokens.ts` — soft-dark palette (page `#0A0A0B`, panel `#151515`, primary text `#EAEAEA`), fluid type scale `clamp(13px, 0.9vw, 16px)`, motion tokens (`--duration-fast`, `--ease-spring`), spacing scale, radii.
- Self-hosted JetBrains Mono (Regular 400 + Medium 500 + SemiBold 600 subset woff2; ~80 KB total) under `public/fonts/` with preload + immutable cache.
- Square → pill border-radius hover animation (DR11) on buttons; square ↔ circle morph toggle via `--ease-spring`. All motion respects `prefers-reduced-motion`.
- Error + pre-prompt cards restyled with the new palette + hairline divider; testids + a11y semantics preserved.
- Preset cycler + preset actions merged into a single preset strip at the top of the sidebar.
- Record button moved from fixed-top-right into the toolbar row.

### Added (Phase DR-9 — parent Phase-5 resume)

- GitHub Actions CI (`.github/workflows/ci.yml`) running L1 biome + tsc, L2 vitest, L3 `pnpm build --mode test`, L4 Playwright E2E on every PR + push to main. Caches pnpm store, Playwright browsers, MediaPipe assets. Single-node matrix on node 25.
- GitHub Actions preview-URL gate (`.github/workflows/e2e-preview.yml`) re-running L4 against `PLAYWRIGHT_BASE_URL` on every Vercel `deployment_status: success`.
- Eight Playwright specs in `tests/e2e/error-states.spec.ts` — one per D23 camera state — forcing each failure mode via real JS-level stubs (no URL-param shortcuts): `addInitScript` overrides of `navigator.permissions.query`, `navigator.mediaDevices.getUserMedia`, `navigator.mediaDevices.enumerateDevices`, `HTMLCanvasElement.prototype.getContext`; `context.route` intercept for the MediaPipe model fetch; `context.grantPermissions` for PROMPT and DEVICE_CONFLICT paths.
- Automated visual-fidelity gate in `tests/e2e/visual-fidelity.spec.ts` — 1440×900 viewport capture on default preset, diffed against `reports/DR-8-regression/design-rework-reference.png` with `maxDiffPixelRatio: 0.02`. Runs on every Vercel preview via `e2e-preview.yml`.

### Removed

- Tweakpane, @tweakpane/core, @tweakpane/plugin-essentials dependencies.
- TouchDesigner-inspired light-mode styling (superseded by pixelcrash-inspired dark-only chrome per DR5).
- Fixed-position floating record button + preset bar + preset actions (consolidated into sidebar).
- `?forceState=<STATE>` URL-param shortcut in error-state E2E (replaced by real JS-level stubs per DR-9.2).

### Deprecated

- Nothing.

### Fixed

- Nothing blocking release; synergy-review backlog items tracked separately in `.claude/orchestration-hand-tracker-fx/reports/synergy-review-backlog.md`.

### Security

- Strict CSP with `default-src 'self'`; only `wasm-unsafe-eval` (MediaPipe wasm thread requirement) and `unsafe-inline` styles (unavoidable for inline style attributes on custom primitives) relaxed.
- Cross-origin isolation enforced (`crossOriginIsolated === true` asserted in E2E).
- No telemetry, analytics, error-reporting SaaS, or feedback channel. All processing is on-device.
- Webcam stream never leaves the browser; no network egress for video data.

### Known limitations

- Desktop-only; no mobile layout below 768px (explicit scope decision per parent DISCOVERY §12 + DR non-goal §8).
- No light theme, no audio, no multi-hand, no face detection, no 3D (explicit scope).
- Single effect — `handTrackingMosaic` — shipped. The architecture supports N effects (registry pattern), but only one is wired.
- Visual-fidelity gate sensitive to sub-pixel font-rendering drift across Chromium point releases; 2% tolerance absorbs normal drift but catches structural regressions.

[0.1.0]: https://github.com/thekevinboyle/hand-tracker/releases/tag/v0.1.0
```

### Step 3: Update `PROGRESS.md`

Edit PROGRESS.md to mark ALL DR-* tasks done + parent 5.3 / 5.4 / 5.5 / 5.R done.

Changes:

1. Top-line metadata:
   ```
   **Current Phase**: v0.1.0 shipped (MVP + design rework complete)
   **Last updated**: <DATE>
   ```

2. Phase Overview table — update Phase 5 row and add DR phases:
   ```
   | 5: Deploy + E2E | done | 6 / 6 | 6 | 5.1, 5.2 shipped pre-rework; 5.3, 5.4, 5.5, 5.R re-executed on the rework via DR-9.1/.2/.3/.R |
   | DR-6: Foundation | done | 4 / 4 | 4 | Tokens + JetBrains Mono + reset |
   | DR-7: Primitives | done | 8 / 8 | 8 | Button, Segmented, Slider, Toggle, ColorPicker, LayerCard, useParam + DR-7.R |
   | DR-8: Chrome integration | done | 8 / 8 | 8 | Toolbar + Sidebar + LayerCard1 + ModulationCard + restyled error cards + preset strip + App wire-up + Footer + DR-8.R |
   | DR-9: Parent Phase-5 resume | done | 4 / 4 | 4 | CI + error-state E2E + visual-fidelity gate + final cut |
   ```
   Update the totals: MVP had 32 parent tasks; rework added 23 DR tasks (4 + 7 + 8 + 4). Final total: 55 tasks.

3. In the Phase 5 Task Progress table, change 5.3 / 5.4 / 5.5 / 5.R rows:
   ```
   | 5.3 | CI: full pipeline in GitHub Actions | done | task/DR-9-1-ci-pipeline | <DATE> | Re-executed via Task DR-9.1 on the reworked chrome |
   | 5.4 | E2E for all 8 error states (forced failures) | done | task/DR-9-2-error-states-e2e | <DATE> | Re-executed via Task DR-9.2 on the reworked chrome; JS stubs replaced URL-param fallbacks |
   | 5.5 | Visual-fidelity gate vs reference screenshot | done | task/DR-9-3-visual-fidelity | <DATE> | Re-executed via Task DR-9.3 on the reworked chrome; quantitative 2% pixel-diff against design-rework-reference.png |
   | 5.R | Final cut: tag v0.1.0, changelog, archive | done | task/DR-9-R-final-cut | <DATE> | Re-executed via Task DR-9.R; TouchDesigner reference archived to _historical/ per DR17 |
   ```

4. Add new "Phase DR-6" / "DR-7" / "DR-8" / "DR-9" sections with all task rows marked done. Use the same table shape as Phase 1–5. Populate branch + date + notes from each DR task's merge commit.

5. Add a "DR-9 Final" Regression Results block at the bottom of the Regression Results section, mirroring the Phase 4 / Phase 5 Final shape, with the SHIP decision + release tag.

### Step 4: Update `CLAUDE.md`

Edit the repo-root `CLAUDE.md` to add a new "Design Rework" section immediately after the Quick Reference table.

Old snippet (keep intact, but update the `Reference image` row):

```markdown
| **Reference image** | `.claude/orchestration-hand-tracker-fx/reference-assets/_historical/touchdesigner-reference.png` — historical TouchDesigner target (pre-rework); superseded by DR-8.R reference |
```

New section to insert after Quick Reference:

```markdown
## Design Rework

The chrome was reworked in April 2026 from a TouchDesigner-inspired light concept to a pixelcrash-inspired dark-mode design built on custom React primitives (replacing Tweakpane). Ship state: v0.1.0.

| What | Where |
|------|-------|
| **Rework authority** | `.claude/orchestration-design-rework/DISCOVERY.md` — 19 numbered decisions; overrides parent DISCOVERY for chrome concerns |
| **Rework plan** | `.claude/orchestration-design-rework/PHASES.md` — 23 tasks across DR-6/DR-7/DR-8/DR-9 |
| **Rework tasks** | `.claude/orchestration-design-rework/tasks/phase-DR-N/task-DR-N-M.md` |
| **Reference image** | `.claude/orchestration-design-rework/reference-assets/pixelcrash-reference.png` — stylistic target |
| **Live-diff baseline** | `reports/DR-8-regression/design-rework-reference.png` — captured from the implemented app; target of the DR-9.3 visual-fidelity gate |
| **Historical reference** | `.claude/orchestration-hand-tracker-fx/reference-assets/_historical/touchdesigner-reference.png` — pre-rework TouchDesigner mood board |
```

Also: update the Tech Stack table if it mentions Tweakpane (remove the Params UI row's Tweakpane entry and replace with "Custom React primitives + `paramStore` via `useSyncExternalStore`").

### Step 5: Archive Ralph state file

```bash
if [ -f .claude/prp-ralph.state.md ]; then
  cp .claude/prp-ralph.state.md reports/prp-ralph-final.md
else
  printf "# Ralph Final State — v0.1.0\n\nNo active state file at release. Ralph loops for each DR-* task cleaned up on completion.\n" > reports/prp-ralph-final.md
fi

# Append retrospective
cat >> reports/prp-ralph-final.md <<'EOF'

## Retrospective — v0.1.0

- Total phases: 5 engine (Phase 1–5) + 4 rework (DR-6, DR-7, DR-8, DR-9) = 9
- Total tasks: 32 parent + 24 DR = 56
- Live URL: https://hand-tracker-jade.vercel.app
- Visual-fidelity gate: DR-9.3 automated 2% pixel diff vs DR-8.R reference; quantitative replacement for parent 5.5's qualitative checklist
- Known limitations carried forward: SYSTEM_DENIED / DEVICE_CONFLICT — verified via JS-level stubs in DR-9.2 (replaced parent 5.4's URL-param fallback); no mobile layout; single effect shipped (architecture supports N)
- Dependencies removed at release: tweakpane, @tweakpane/core, @tweakpane/plugin-essentials
EOF

# Delete the working copy (gitignored; no add needed)
rm -f .claude/prp-ralph.state.md
```

### Step 6: Run full validation suite before tagging

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
# All green. The CI workflow will also run this on the PR.
```

### Step 7: Commit, push, merge

```bash
git checkout -b task/DR-9-R-final-cut

# Stage (explicit — avoid accidental adds of gitignored ralph state)
git add \
  CHANGELOG.md \
  CLAUDE.md \
  PROGRESS.md \
  reports/prp-ralph-final.md \
  .claude/orchestration-hand-tracker-fx/reference-assets/_historical/touchdesigner-reference.png

# The rename of the png is already staged by `git mv` from Step 1, but
# confirm with `git status` that both the deletion of the old path and
# the addition of the new path are present.
git status

git commit -m "$(cat <<'EOF'
Task DR-9.R: Final cut — v0.1.0

- CHANGELOG.md at repo root (Keep-a-Changelog) describing Phases 1–5 + DR-6/7/8/9.
- Moved touchdesigner-reference.png → _historical/ per DR17.
- Updated CLAUDE.md with new Design Rework section; updated reference-image row.
- Updated PROGRESS.md: all DR-* done; parent 5.3/5.4/5.5/5.R marked done via DR-9.x mapping.
- Archived .claude/prp-ralph.state.md → reports/prp-ralph-final.md + retrospective.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"

git push -u origin task/DR-9-R-final-cut
gh pr create --fill --title "Task DR-9.R: Final cut — v0.1.0"
```

Wait for CI green (`CI / check` required), then fast-forward merge to main.

### Step 8: Tag + release (post-merge, on `main`)

```bash
git fetch origin
git checkout main
git pull --ff-only

# Annotated tag (NOT lightweight)
git tag -a v0.1.0 -m "v0.1.0 — MVP + pixelcrash-inspired design rework"
git push origin v0.1.0

# GitHub release points at CHANGELOG.md
gh release create v0.1.0 \
  --title "v0.1.0 — MVP + design rework" \
  --notes-file CHANGELOG.md \
  --latest

# Verify
git tag --list v0.1.0
gh release view v0.1.0 --json url --jq .url
```

### Step 9: Post-release smoke

```bash
# Live URL still serves
curl -sI https://hand-tracker-jade.vercel.app/ | head -20

# Visual-fidelity gate still green on live
PLAYWRIGHT_BASE_URL=https://hand-tracker-jade.vercel.app \
  pnpm test:e2e --grep "Task DR-9.3:"
```

---

## Files to Create

- `CHANGELOG.md` (repo root) — Keep-a-Changelog with v0.1.0 entry.
- `reports/prp-ralph-final.md` — archived Ralph state + retrospective.

## Files to Modify

- `PROGRESS.md` — mark all DR-* done; mark parent 5.3/5.4/5.5/5.R done via DR-9.x mapping; add DR phase tables; add "DR-9 Final" regression block; update top-line metadata.
- `CLAUDE.md` — add "Design Rework" section; update Reference image row to point at `_historical/` + the new DR reference; update Tech Stack Params UI row to reflect custom primitives.

## Files to Move

- `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png` → `.claude/orchestration-hand-tracker-fx/reference-assets/_historical/touchdesigner-reference.png` via `git mv`.

## Files to Delete

- `.claude/prp-ralph.state.md` — per Ralph loop completion protocol; gitignored so no `git add` needed; just `rm -f`.

---

## Contracts

### Provides

- **Git tag `v0.1.0`** on `main` — annotated, points at the DR-9.R merge commit. Future tasks (e.g., a v0.2.0 feature line) branch from this tag.
- **GitHub release `v0.1.0`** — visible at `https://github.com/thekevinboyle/hand-tracker/releases/tag/v0.1.0`. Release notes are the CHANGELOG.md content.
- **`CHANGELOG.md`** — canonical release-note document; reference-linked from README (if present) and from `CLAUDE.md`.
- **`reports/prp-ralph-final.md`** — ceremonial artifact + retrospective for future historians.
- **`_historical/` archive convention** — any future design reference that gets superseded moves to `_historical/` via `git mv` (DR17 establishes the pattern).

### Consumes

- **DR-9.1/2/3 all merged + green** — the release is code-complete.
- **DR17** — move (not delete) the TouchDesigner reference.
- **Parent 5.R contract** — Keep-a-Changelog + annotated tag + `gh release create --notes-file`.

---

## Acceptance Criteria

- [ ] `CHANGELOG.md` exists at repo root; parses as Keep-a-Changelog (heading `# Changelog`; sections `Added` / `Changed` / `Removed` / `Deprecated` / `Fixed` / `Security`; top entry `## [0.1.0] - <ISO-DATE>`; bottom reference `[0.1.0]: <url>`).
- [ ] `touchdesigner-reference.png` is at `.claude/orchestration-hand-tracker-fx/reference-assets/_historical/touchdesigner-reference.png` — not at its old path.
- [ ] `git log --follow .claude/orchestration-hand-tracker-fx/reference-assets/_historical/touchdesigner-reference.png` shows the full history (proves `git mv` was used, not copy + delete).
- [ ] `PROGRESS.md` marks all DR-* tasks `done`; all parent 5.3 / 5.4 / 5.5 / 5.R rows `done` with branch pointers into the DR-9.x tasks.
- [ ] `CLAUDE.md` has a "Design Rework" section; Reference image row updated; Tech Stack Params UI row no longer names Tweakpane.
- [ ] `reports/prp-ralph-final.md` exists; contains a retrospective block.
- [ ] `.claude/prp-ralph.state.md` does not exist post-merge.
- [ ] `git tag --list v0.1.0` returns `v0.1.0`.
- [ ] `git cat-file -t v0.1.0` returns `tag` (annotated, not `commit` which is lightweight).
- [ ] `gh release view v0.1.0 --json url --jq .url` returns the release URL.
- [ ] `CI / check` green on the PR and on the main push after merge.
- [ ] `E2E (preview) / chromium vs <url>` green on the first deploy after tag.
- [ ] Live URL `hand-tracker-jade.vercel.app` still returns `crossOriginIsolated: true` and renders the new chrome.

---

## Testing Protocol

### L1 — Syntax + Style + Types

```bash
pnpm lint && pnpm typecheck
# No source changes expected — safety net.
```

### L2 — Unit

```bash
pnpm vitest run
# Full suite — confirms no accidental breakage.
```

### L3 — Integration

```bash
pnpm build                                                 # plain build (no --mode test) — release build
pnpm build --mode test                                     # test-mode build for L4

# File-existence gates
test -f CHANGELOG.md
test -f reports/prp-ralph-final.md
test -f .claude/orchestration-hand-tracker-fx/reference-assets/_historical/touchdesigner-reference.png
test ! -f .claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png
test ! -f .claude/prp-ralph.state.md

# Keep-a-Changelog format sanity
head -3 CHANGELOG.md | grep -q '^# Changelog'
grep -q '^## \[0.1.0\]' CHANGELOG.md
grep -q '^\[0.1.0\]:' CHANGELOG.md
```

### L4 — E2E

```bash
# Full suite — confirms release build is still functional.
pnpm test:e2e

# Live URL regression
PLAYWRIGHT_BASE_URL=https://hand-tracker-jade.vercel.app \
  pnpm test:e2e --grep "Task 1.1:"            # smoke
PLAYWRIGHT_BASE_URL=https://hand-tracker-jade.vercel.app \
  pnpm test:e2e --grep "Task DR-9.3:"         # visual-fidelity gate
```

### Post-tag verification

```bash
git tag --list v0.1.0                                      # prints v0.1.0
git cat-file -t v0.1.0                                     # prints "tag"
git cat-file -p v0.1.0 | head -5                           # annotated tag message visible
gh release view v0.1.0 --json tagName,url,isLatest         # tag name + url + isLatest=true
```

---

## Known Gotchas

```typescript
// CRITICAL: git mv (not cp + rm) for the reference archive. The --follow
// log must continue to show the full history. If the file was already moved
// in a dirty working tree before staging, verify via `git status` that the
// entry shows as a RENAMED file (R100), not as delete + add.

// CRITICAL: Do NOT pre-tag v0.1.0 before the PR is merged. The tag attaches
// to the HEAD commit at tag time; tagging the task branch then merging
// creates a tag on an unreachable commit. Sequence: PR green → merge to
// main → pull → tag → push tag.

// CRITICAL: Annotated tag required. `git tag v0.1.0` creates a lightweight
// tag; `git cat-file -t v0.1.0` returns "commit" instead of "tag". Use
// `git tag -a v0.1.0 -m "…"` always.

// CRITICAL: `gh release create` will push a local tag if it isn't already
// on origin, but the cleanest flow is: `git push origin v0.1.0` THEN
// `gh release create v0.1.0 …`. Saves a surprise push later.

// CRITICAL: CHANGELOG date — use the date of the actual merge-to-main
// commit, not the date the task file was written. Fill in at commit time:
//   DATE=$(date +%Y-%m-%d); sed -i '' "s/<DATE>/$DATE/g" CHANGELOG.md

// CRITICAL: PROGRESS.md task count arithmetic — parent 32 + DR 24 = 56.
// Do not double-count parent 5.3/5.4/5.5/5.R against DR-9 (they share
// status via the mapping row, not separate counts).

// CRITICAL: Do NOT commit .claude/prp-ralph.state.md — gitignored per the
// ralph loop skill §4. git add will silently no-op; verify via `git
// status` that the file doesn't appear.

// CRITICAL: When updating CLAUDE.md, search for any other hardcoded
// references to Tweakpane and replace them ("Params UI" row; Skills table
// — leave tweakpane-params-presets skill row with a "historical reference"
// note rather than removing).

// CRITICAL: --notes-file CHANGELOG.md posts the ENTIRE file as the
// release body. If that's too long for the release UI (it isn't for MVP),
// extract just the [0.1.0] section to a temp file and point at that.

// CRITICAL: The Vercel footer shows "v0.1.0" (DR18). Confirm DR-8.7's
// Footer.tsx hardcoded value matches the tag. If it's '0.1.0-preview' or
// similar, file a patch before tagging. `grep -n 'v0.1.0' src/ui/Footer.*`.

// CRITICAL: Do NOT bump to 1.0.0. Semver 0.1.0 is correct for MVP —
// public API is unstable.
```

---

## Anti-Patterns

- Do NOT force-push to `main` or rewrite history to "clean up" the DR-9.R commit.
- Do NOT use `cp` + `rm` for the reference archive — always `git mv` so history follows.
- Do NOT delete the TouchDesigner reference outright — DR17 mandates move, not delete.
- Do NOT skip the Ralph state archive — future retros depend on the artifact.
- Do NOT commit `.claude/prp-ralph.state.md` — gitignored.
- Do NOT pre-tag before merge.
- Do NOT use a lightweight tag.
- Do NOT add CI jobs in this task — DR-9.1 owns that.
- Do NOT modify source code — if a regression surfaces in L4, fix it in a separate PR before attempting DR-9.R again.
- Do NOT write release notes outside CHANGELOG.md — single source of truth.
- Do NOT bump to 1.0.0.
- Do NOT add badges (coverage, license) that require new CI jobs.

Universal anti-patterns apply (`.claude/skills/prp-task-ralph-loop/SKILL.md` §6).

---

## Skills to Read

- `prp-task-ralph-loop` — task anatomy + Ralph final-task archival protocol (§3g).
- `hand-tracker-fx-architecture` — top-level orientation; informs the CHANGELOG "Added" bullets.
- `playwright-e2e-webcam` — L4 live-URL smoke after tag.
- `vite-vercel-coop-coep` — confirms post-tag deploy still serves correct headers.
- `webcam-permissions-state-machine` — confirms DR-9.2 coverage claims in the CHANGELOG are accurate.

## Research / Reference Files

- `.claude/orchestration-hand-tracker-fx/tasks/phase-5/task-5-R.md` — parent task; CHANGELOG + tag + release pattern inherited.
- `.claude/orchestration-design-rework/DISCOVERY.md` §DR17 (archive), §DR18 (footer v0.1.0).
- `.claude/orchestration-design-rework/PHASES.md` §DR-9.R — scope row.
- `.claude/orchestration-hand-tracker-fx/DISCOVERY.md` §D39 (trunk-based), §D40 (commit convention), §D43 (GitHub user).
- https://keepachangelog.com/en/1.1.0/ — format spec.

---

## Git

- Branch: `task/DR-9-R-final-cut`
- Commit prefix: `Task DR-9.R:`
- E2E describe prefix: **N/A** (DR-9.R adds no specs).
- Every commit ends with `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>` trailer.
- Fast-forward merge to `main` after `CI / check` is green.
- Post-merge: annotated tag `v0.1.0` on `main` + `gh release create v0.1.0 --latest --notes-file CHANGELOG.md`.

---

## No-Prior-Knowledge Test

- [ ] DR-9.1, DR-9.2, DR-9.3 all merged to `main` with green CI.
- [ ] `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png` currently exists at the old path.
- [ ] `PROGRESS.md` has rows for 5.3, 5.4, 5.5, 5.R still `pending` (to be flipped to `done` by this task).
- [ ] `CLAUDE.md` at repo root references `touchdesigner-reference.png` in the Quick Reference table (to be updated).
- [ ] `gh` CLI authenticated as thekevinboyle.
- [ ] Vercel GitHub integration still installed (needed for the post-tag deploy's `e2e-preview` run).
- [ ] DR17 (DR DISCOVERY) + D39/D40/D43 (parent DISCOVERY) exist.
- [ ] Keep-a-Changelog URL reachable.
- [ ] Task is atomic + terminal — the release IS the endpoint.
