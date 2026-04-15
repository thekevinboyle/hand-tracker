# Task 5.5: Visual-fidelity gate against TouchDesigner reference screenshot

**Phase**: 5 — Deploy + Comprehensive E2E
**Branch**: `task/5-5-visual-fidelity`
**Commit prefix**: `Task 5.5:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal** — Capture a Playwright-MCP screenshot of the live Vercel deployment under a "real-hand-like" condition, diff it qualitatively against `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png`, and tick a 5-item fidelity checklist from PHASES.md Task 5.5.

**Deliverable** —

- `reports/phase-5-visual-fidelity.md` — markdown report with the 5-item checklist annotated pass/fail, observations, and embedded screenshots.
- `reports/phase-5-visual-fidelity.png` — full-page screenshot of the live app.
- `reports/phase-5-reference-side-by-side.png` — composite image placing the reference screenshot next to the captured frame (ffmpeg or image tool — agent-doable via pure Node).

**Success Definition** — All 5 checklist items tick green; the report is committed; a human reviewer opens the side-by-side PNG and agrees the MVP visually matches the reference.

This is not a pixel-exact gate — the reference is a TouchDesigner render, not a Chrome frame. We verify structural parity: grid non-uniformity, 5 dotted blobs with labels, mosaic presence inside the hand region, chevron positions, dark theme.

---

## User Persona

**Target User** — Release reviewer (human) auditing that the MVP visually matches the TouchDesigner reference before `v0.1.0`.

**Use Case** — One-time (per release) structural comparison of the deployed app against the reference screenshot.

**User Journey**:

1. Agent drives Playwright MCP against the live URL.
2. Agent loads a default-preset view with a hand visible (real webcam OR synthetic fixture frame).
3. Agent captures a full-page screenshot.
4. Agent assembles side-by-side composite with the reference.
5. Agent writes report; human reviews.

**Pain Points Addressed** — Silent divergence between the reference and the live app (grid seed mismatched, mosaic tile size drifted, chevron positions wrong) that passes every functional test but fails the "does it look like the reference?" sniff test.

---

## Why

- D45: The reference screenshot is part of DISCOVERY; visual tasks MUST consult it.
- D41: Phase regression tasks include "Playwright MCP manual walkthrough with screenshot artifacts."
- D42: Final phase runs against Vercel preview — we use the live URL, not local preview.
- PHASES.md Task 5.5 enumerates the exact 5 checklist items; this task is the execution of that gate.

---

## What

Agent-visible outputs:

- `reports/phase-5-visual-fidelity.md` — the report.
- `reports/phase-5-visual-fidelity.png` — live-app screenshot (Playwright MCP).
- `reports/phase-5-reference-side-by-side.png` — composite.
- Optional: `reports/phase-5-visual-fidelity-trace/` — Playwright trace zip if extra context needed.

Human-visible outputs:

- A PR containing the three files; reviewer checks the side-by-side PNG.

### The 5-item fidelity checklist (verbatim from PHASES.md Task 5.5)

1. Grid: seeded non-uniform columns visible.
2. Blobs: 5 dotted circles with xy labels.
3. Mosaic: cells inside hand region show pixelation.
4. Chevrons: render at screen edges.
5. Overall dark theme.

Each item is pass/fail with a one-line observation.

### NOT Building (scope boundary)

- Pixel-diff testing (impossible — reference is a TouchDesigner render, live is a Chrome canvas).
- Automated visual regression snapshots (Playwright `toHaveScreenshot`) — too brittle for a canvas app.
- Per-PR visual-fidelity gate — this is a one-time release gate, not a CI check.
- Re-shooting the reference screenshot — it is authoritative per D45; we match to it.
- Real-human hand in CI — CI uses the Y4M fake webcam; the visual-fidelity capture uses the fake webcam too, which shows the testsrc2 frame behind the effect. Document this in the report; a human can re-capture with a real hand when validating the PR.

### Success Criteria

- [ ] `reports/phase-5-visual-fidelity.png` captured from live URL
- [ ] Side-by-side composite written to `reports/phase-5-reference-side-by-side.png`
- [ ] `reports/phase-5-visual-fidelity.md` exists and ticks all 5 checklist items
- [ ] No item failed; if any failed, a hotfix task (5.5.1) is opened before moving to 5.R
- [ ] Report commits cleanly and `pnpm check` stays green (no code changes expected)

---

## All Needed Context

```yaml
files:
  - path: .claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png
    why: Authoritative visual target per D45. Used as the left-hand image in the side-by-side composite.
    gotcha: Do not modify. Do not resize before composition — keep native resolution in the composite.

  - path: reports/phase-3-visual.png (if exists from Task 3.R)
    why: Prior visual-gate artifact; informs the markdown structure for this task's report.
    gotcha: If absent, mirror the shape of any `reports/phase-N-*.md` that exists; otherwise invent a clean structure.

  - path: .claude/skills/playwright-e2e-webcam/SKILL.md
    why: Fake-webcam setup + __handTracker hook for FPS check inside the report.
    gotcha: When running against Vercel prod (MODE !== 'test'), the __handTracker dev hook is stripped. Use `MODE=test` build OR accept that FPS is manual-observable.

  - path: .claude/skills/hand-tracker-fx-architecture/SKILL.md
    why: General orientation; ensures the side-by-side narrative aligns with the effect pipeline.

urls:
  - url: https://playwright.dev/docs/screenshots
    why: `page.screenshot({ fullPage: true })` API
    critical: Full-page screenshot on a fixed-viewport app captures the viewport only (there is no scrollable content). Use `fullPage: false` for crisp viewport capture.

  - url: https://sharp.pixelplumbing.com/
    why: Node image compositing for the side-by-side; already pulled in indirectly or available via pnpm dlx.
    critical: If sharp is not a project dep, use `pnpm dlx sharp-cli` OR a tiny local script. Avoid adding sharp as a runtime dep — it is devtime only.

skills:
  - prp-task-ralph-loop
  - hand-tracker-fx-architecture
  - playwright-e2e-webcam
  - ogl-webgl-mosaic

discovery:
  - D45: Reference screenshot is top-authority for visual fidelity.
  - D31: Live URL has full headers; capture against Vercel, not localhost.
  - D12: Dark theme only.
  - D13: Modulation defaults — the captured frame should show the default preset.
```

### Current Codebase Tree

```
.claude/orchestration-hand-tracker-fx/
├── reference-assets/
│   └── touchdesigner-reference.png
└── tasks/phase-5/
reports/
└── (any prior phase reports)
```

### Desired Codebase Tree

```
reports/
├── phase-5-visual-fidelity.md            NEW
├── phase-5-visual-fidelity.png           NEW (captured)
└── phase-5-reference-side-by-side.png    NEW (composed)
scripts/
└── compose-side-by-side.mjs              NEW (optional helper; only if agent can't direct-MCP-compose)
```

### Known Gotchas

```typescript
// CRITICAL: Running against Vercel prod means import.meta.env.DEV is false
// and MODE !== 'test' (unless Vercel was built with --mode test).
// The __handTracker hook is therefore ABSENT on the live URL.
// If you want FPS in the report, either:
//   (a) build a separate `--mode test` preview and capture from localhost:4173, OR
//   (b) drop FPS from the report; the 5 checklist items are structural, not perf-based.

// CRITICAL: Playwright MCP operates in a separate Chromium — it is NOT the
// same context as `pnpm test:e2e`. Permissions and launch flags are default.
// Grant camera via `mcp__playwright__browser_navigate` to a URL with a
// beforeeach-style hook is not possible; use fake-webcam by launching
// Playwright MCP manually with args OR accept that the screenshot will
// show the pre-prompt card and a separate capture is needed with granted permissions.
// SIMPLEST: use `--use-fake-ui-for-media-stream` + Y4M on the MCP server
// via launch_args if the MCP supports it; otherwise capture locally from
// `pnpm test:e2e` in `--headed` mode with a `page.screenshot()` call
// embedded in a dedicated spec (Task 5.4 pattern).

// CRITICAL: Composite PNG dimensions matter — the reference is ~1920x1080;
// the capture should be normalized to the same height via sharp resize
// before horizontal concat. Side-by-side at mismatched heights is useless.

// CRITICAL: Do not overwrite reference-assets/touchdesigner-reference.png.

// CRITICAL: Reports directory may not exist — mkdir -p before writing.
```

---

## Implementation Blueprint

### Implementation Tasks

```yaml
Task 1: AGENT — capture live URL screenshot via Playwright MCP
  - IMPLEMENT: Use MCP tools to navigate and screenshot. Steps:
      mcp__playwright__browser_navigate({ url: "https://<deploy-url>/" })
      mcp__playwright__browser_wait_for({ text: "" , time: 30 })   # crude wait for warmup
      mcp__playwright__browser_take_screenshot({ filename: "reports/phase-5-visual-fidelity.png", fullPage: false })
  - GOTCHA: The permission prompt likely appears on MCP's default Chromium without fake flags. Two fallbacks:
      (a) If MCP supports launch args, pass `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-video-capture=<abs-path-to-fake-hand.y4m>`.
      (b) Otherwise capture from a separate Playwright-test run against the LIVE URL: create a temporary spec file `tests/e2e/visual-capture.spec.ts` (ignored in normal runs via grep) that does `await page.screenshot({ path: 'reports/phase-5-visual-fidelity.png' })` after waiting for the first landmark. Invoke via `PLAYWRIGHT_BASE_URL=<deploy> pnpm exec playwright test tests/e2e/visual-capture.spec.ts --project=chromium`.
  - VALIDATE: `test -f reports/phase-5-visual-fidelity.png && file reports/phase-5-visual-fidelity.png`

Task 2: AGENT — compose side-by-side PNG
  - IMPLEMENT: Create `scripts/compose-side-by-side.mjs` (temporary; can be removed after use or kept as utility):
      import sharp from 'sharp'
      const [left, right] = await Promise.all([
        sharp('.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png').resize({ height: 1080 }).toBuffer({ resolveWithObject: true }),
        sharp('reports/phase-5-visual-fidelity.png').resize({ height: 1080 }).toBuffer({ resolveWithObject: true }),
      ])
      const totalWidth = left.info.width + right.info.width
      await sharp({
        create: { width: totalWidth, height: 1080, channels: 4, background: '#000' },
      })
        .composite([
          { input: left.data, left: 0, top: 0 },
          { input: right.data, left: left.info.width, top: 0 },
        ])
        .png()
        .toFile('reports/phase-5-reference-side-by-side.png')
  - MIRROR: Use `pnpm dlx sharp` if `sharp` is not a project dep — do NOT add it as a dependency.
  - NAMING: File path exactly `reports/phase-5-reference-side-by-side.png`.
  - GOTCHA: Pass `--frozen-lockfile` tolerant invocation: `pnpm dlx sharp-cli ...` or include sharp via pnpm add -D sharp at run-time and remove after? Do NOT ship sharp in package.json. Best: use `pnpm dlx` to run a one-shot script via `node --input-type=module -e '<inline>'` reading from stdin. Document precisely in the script file.
  - VALIDATE: `file reports/phase-5-reference-side-by-side.png` reports PNG with correct dims.

Task 3: AGENT — write reports/phase-5-visual-fidelity.md
  - IMPLEMENT: Full markdown report covering:
      # Phase 5 Visual-Fidelity Gate
      - Deployment URL
      - Capture date (UTC)
      - Runtime details (browser: Playwright Chromium; fake webcam: <Y4M path>; preset: Default)
      - Embedded side-by-side image: ![side-by-side](./phase-5-reference-side-by-side.png)
      - ## 5-item Checklist
        1. **Grid: seeded non-uniform columns visible** — ☑/☐ + one-line observation
        2. **Blobs: 5 dotted circles with xy labels** — ☑/☐ + observation
        3. **Mosaic: cells inside hand region show pixelation** — ☑/☐ + observation
        4. **Chevrons: render at screen edges** — ☑/☐ + observation
        5. **Overall dark theme** — ☑/☐ + observation
      - ## Known Divergences (acceptable, documented)
        - TouchDesigner-specific color palette cannot be exactly matched (differing render pipelines)
        - Reference shows a real hand; our capture shows the Y4M fixture frame (no hand visible unless real-hand Y4M present)
      - ## Verdict
        PASS / FAIL
      - ## Next Steps
        If any item FAIL: open hotfix task 5.5.1 referencing this report.
  - NAMING: File path exactly `reports/phase-5-visual-fidelity.md`.
  - VALIDATE: `head -5 reports/phase-5-visual-fidelity.md` shows the header.

Task 4: AGENT — commit the artifacts
  - IMPLEMENT:
      git checkout -b task/5-5-visual-fidelity
      git add reports/phase-5-visual-fidelity.md reports/phase-5-visual-fidelity.png reports/phase-5-reference-side-by-side.png
      # If scripts/compose-side-by-side.mjs was used and is worth keeping: add it too
      git commit -m "Task 5.5: Visual-fidelity gate — all 5 checks pass"
      git push -u origin task/5-5-visual-fidelity
  - MIRROR: D40 commit convention with Co-Authored-By trailer.
  - VALIDATE: `gh pr create --fill`; merge after CI green.
```

### Integration Points

```yaml
Live URL:
  - Inherited from Task 5.2 report
  - Agent reads deploy URL from reports/phase-5-deploy.md

Playwright MCP:
  - browser_navigate, browser_take_screenshot, browser_evaluate
  - Used in-loop within the agent session; no pipeline wiring

Downstream:
  - 5.R CHANGELOG bullet "Visual-fidelity gate passed against TouchDesigner reference"
  - Reports committed to main; v0.1.0 release notes reference them
```

---

## Validation Loop

```bash
# Level 1 — Syntax & Style
pnpm lint
pnpm typecheck
# No src changes expected. This is a safety net.

# Level 2 — Unit
pnpm test

# Level 3 — Integration: artifacts exist and are well-formed
test -f reports/phase-5-visual-fidelity.md
test -f reports/phase-5-visual-fidelity.png
test -f reports/phase-5-reference-side-by-side.png
file reports/phase-5-visual-fidelity.png        | grep -q 'PNG image'
file reports/phase-5-reference-side-by-side.png | grep -q 'PNG image'

# Level 4 — E2E (optional, if a visual-capture spec was added)
pnpm test:e2e --grep "Task 5.5:"   # only if a dedicated capture spec exists
```

---

## Final Validation Checklist

### Technical

- [ ] All three artifacts exist in `reports/`
- [ ] PNG files open in an image viewer (agent can `base64 < file | head`)
- [ ] Markdown report parses (no dangling heading syntax)
- [ ] `pnpm check` green

### Feature

- [ ] 5-item checklist all ticked green
- [ ] Side-by-side image matches native resolution (1080p)
- [ ] Reference image on LEFT, live capture on RIGHT
- [ ] Verdict section explicitly writes PASS

### Code Quality

- [ ] No production code changes
- [ ] No new runtime dependency added (sharp used via `pnpm dlx` if at all)
- [ ] Commit message matches Task 5.5: convention + Co-Authored-By trailer

---

## Anti-Patterns

- Do NOT modify `touchdesigner-reference.png`. It is authoritative per D45.
- Do NOT add `sharp` to `package.json` — one-shot via `pnpm dlx` only.
- Do NOT commit Playwright trace zips larger than 5 MB — strip if oversized.
- Do NOT use `page.waitForTimeout(30_000)` in a capture spec — use the same `waitForSelector('[data-testid="landmark-blob"]')` pattern as the smoke test.
- Do NOT over-interpret the checklist — "Grid: seeded non-uniform columns" passes as long as column widths are visibly non-uniform; the exact seed is irrelevant.
- Do NOT fail this task if the Y4M fixture shows no hand and therefore no mosaic — capture with a real webcam or a real-hand Y4M; document the method.
- Do NOT add image-diff gates to CI — this is a one-time release gate, not a continuous check.

Universal anti-patterns apply (`.claude/skills/prp-task-ralph-loop/SKILL.md` §6).

---

## No Prior Knowledge Test

- [ ] `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png` exists
- [ ] Task 5.2 merged (deploy URL available in `reports/phase-5-deploy.md`)
- [ ] Task 5.4 merged (error-state cards confirmed functional; capture will not land on an error card)
- [ ] D45, D41, D42 exist in DISCOVERY.md
- [ ] Playwright MCP tools (browser_navigate, browser_take_screenshot, browser_evaluate) are available per the session's environment
- [ ] `reports/` directory may need creation — `mkdir -p` safe
- [ ] Task is atomic; 5.R is the only downstream

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
.claude/skills/ogl-webgl-mosaic/SKILL.md
```
