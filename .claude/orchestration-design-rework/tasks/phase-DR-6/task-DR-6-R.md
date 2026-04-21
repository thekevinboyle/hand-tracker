# Task DR-6.R: Phase DR-6 Regression

**Phase**: DR-6 — Foundation
**Branch**: `task/DR-6-R-phase-regression`
**Commit prefix**: `Task DR-6.R:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal** — Prove that Phase DR-6 is foundation-complete and regression-clean: tokens, font, and body baseline landed, Tweakpane chrome still functions end-to-end, every prior Phase 1–4 E2E still passes, and the app ships to a Vercel preview with live headers confirmed.

**Deliverable** — (a) An aggregate E2E spec covering the Phase DR-6 foundation invariants, (b) a Playwright MCP manual walkthrough with step screenshots, (c) a deploy-preview smoke check with live header verification, and (d) a report at `reports/DR-6-regression.md` that records the full validation transcript.

**Success Definition** —
1. L1 + L2 + L3 + L4 all green against `pnpm build && pnpm preview`.
2. 45 Phase 1–4 aggregate E2E specs all pass.
3. New `tests/e2e/DR-6-regression.spec.ts` with describe block `Task DR-6.R: Phase DR-6 foundation invariants` exits 0 — covers: computed tokens, font-face, body baseline, app still functional end-to-end with Tweakpane present.
4. Playwright MCP walkthrough captures 4 screenshots: pre-prompt, granted + Tweakpane open, preset cycler interaction, record state. Saved under `reports/DR-6-regression/step-*.png`.
5. Vercel preview URL deployed; `curl -I <preview>/` shows all 6 required headers; `curl -I <preview>/fonts/JetBrainsMono-Medium-subset.woff2` shows long-cache + COEP.
6. `reports/DR-6-regression.md` written, listing all transcripts + the preview URL + any deviations.

---

## User Persona

**Target User** — The orchestrator preparing Phase DR-7. A clean DR-6.R gate means the foundation is trusted; Phase DR-7 primitives can assume tokens, font, and baseline exist and are stable.

**Use Case** — Quality gate between foundation (DR-6) and primitive rebuild (DR-7). A broken DR-6 propagates invisibly into every primitive — this gate catches it.

**Pain Points Addressed** — Without a dedicated regression task, phase-boundary bugs leak forward. This task is the "no false green" insurance policy for Phase DR-6.

---

## Why

- **DR4 / PHASES.md** — every phase ends with an `.R` regression task. Sequential gate.
- **DR14** — error/pre-prompt cards must still function after DR-6 wiring (palette changed, structure identical).
- **DR19** — dev-comment signature present in index.html (sanity check).
- **D31 / D33** (parent) — live Vercel preview must retain COOP/COEP/CSP and correct cache headers on static assets (including the new /fonts/*).
- **D42** (parent) — final-cut phase runs E2E against preview; this task rehearses the mechanic one phase early.
- Downstream: Phase DR-7 primitives require: tokens available globally, JetBrains Mono rendering, body baseline inheriting. All three are verified here.

---

## What

User-visible behavior after this task: NONE. This is a gate task. The app ships a Vercel preview but no feature changes land.

Agent-visible outputs:

- `tests/e2e/DR-6-regression.spec.ts` — the aggregate spec.
- `reports/DR-6-regression.md` — written by the agent at clean completion.
- `reports/DR-6-regression/step-*.png` — manual MCP walkthrough screenshots.

### NOT Building (scope boundary)

- New E2E coverage beyond foundation invariants (Phase DR-7 handles primitive coverage).
- Production (main-alias) deploy — Vercel preview from the feature branch is sufficient. DR-9.R handles prod-tagging.
- Custom domain, analytics, CI config — out of scope.
- Visual fidelity snapshot gate — that is DR-9.3 (parent 5.5).
- Service worker cache extension to /fonts/* — out of scope; HTTP cache headers are sufficient.

### Success Criteria

- [ ] L1 clean: `pnpm biome check src/ && pnpm tsc --noEmit` exits 0.
- [ ] L2 clean: `pnpm vitest run` exits 0.
- [ ] L3 clean: `pnpm build` exits 0; `dist/` contains tokens.css (inlined), three /fonts/*.woff2, and correct index.html.
- [ ] L4 clean: `pnpm test:e2e --grep "Task DR-6"` exits 0 (matches DR-6.1, DR-6.2, DR-6.3, DR-6.R specs).
- [ ] Full phase-1–4 aggregate: `pnpm test:e2e --grep "Task [1-4]\."` exits 0.
- [ ] 45+ specs collectively exit 0 — `pnpm test:e2e` total green.
- [ ] New spec `tests/e2e/DR-6-regression.spec.ts` present with describe block `Task DR-6.R: Phase DR-6 foundation invariants`.
- [ ] Vercel preview URL deployed; curl transcript pasted into the report.
- [ ] Playwright MCP step screenshots saved.
- [ ] `reports/DR-6-regression.md` written with all transcripts + observations.

---

## All Needed Context

```yaml
files:
  - path: tests/e2e/phase-4-regression.spec.ts
    why: MIRROR — the most-recent .R-phase spec. Follow its shape (imports, fixtures,
         describe groups, beforeEach pattern). Phase 4 regression covers modulation +
         presets + record; this phase's regression is narrower (foundation only).
    gotcha: Phase-4 regression uses the __handTracker dev hook for deterministic fake
            landmark injection. DR-6.R does NOT need fake landmarks — foundation tests
            are pre-camera-grant + Tweakpane sanity.

  - path: tests/e2e/task-DR-6-1.spec.ts
    why: From DR-6.1. Asserts tokens on :root.

  - path: tests/e2e/task-DR-6-2.spec.ts
    why: From DR-6.2. Asserts font load + cache header.

  - path: tests/e2e/task-DR-6-3.spec.ts
    why: From DR-6.3. Asserts body baseline.

  - path: tests/e2e/task-5-1.spec.ts
    why: Reference for request.get() + header assertion pattern (used here for /fonts/* live).

  - path: reports/
    why: Directory for .R-phase reports. Check if prior reports (phase-4-regression.md,
         phase-5-deploy.md) exist; mirror their markdown structure.

  - path: .claude/orchestration-design-rework/DISCOVERY.md
    why: Every DR decision — spot-check DR5 colors, DR7 font weights, DR11 motion,
         DR14 card structure preserved, DR19 comment present.

  - path: vercel.json
    why: INSPECT ONLY — Phase DR-6.2 added the /fonts/(.*) entry. Confirm still
         present and correct.

  - path: index.html
    why: INSPECT ONLY — Phase DR-6.2 added preload + DR19 comment. Confirm present.

  - path: public/fonts/
    why: INSPECT ONLY — 3 woff2 files + LICENSE.txt + README.md committed by DR-6.2.

  - path: src/ui/tokens.css, src/ui/tokens.ts, src/index.css
    why: INSPECT ONLY — foundation files from DR-6.1 + DR-6.3. No edits in this task.

urls:
  - url: https://vercel.com/docs/cli/deploy
    why: `vercel --prod=false` or `vercel` (no flag) produces a preview. Agent cannot
         run `vercel login`; if the CLI is unauthed, HUMAN must authenticate first.
    critical: Preview URL auto-derives from branch name, e.g.
              `hand-tracker-jade-git-task-dr-6-r-phase-regression-<user>.vercel.app`.

  - url: https://playwright.dev/docs/api/class-page#page-evaluate
    why: page.evaluate + page.request for asserting server headers + computed styles.

  - url: https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/ready
    why: `document.fonts.ready` Promise — wait for all @font-face entries to load.

skills:
  - prp-task-ralph-loop
  - hand-tracker-fx-architecture
  - design-tokens-dark-palette
  - jetbrains-mono-self-hosting
  - vite-vercel-coop-coep
  - playwright-e2e-webcam

discovery:
  - DR4: sequential phases, .R gate at each boundary.
  - DR14: error cards must retain role / aria-live / testids after restyle.
  - DR19: signature dev comment present in index.html.
  - D31 (parent): COOP/COEP/CSP headers on live.
  - D33 (parent): self-hosted assets + cache control.
  - D42 (parent): final-cut E2E against preview URL.
```

### Current Codebase Tree (as of DR-6.3 completion)

```
src/
  index.css                  (body baseline wired)
  ui/
    tokens.css               (@font-face × 3 + :root tokens)
    tokens.ts
    Stage.css
    cards.css
    tokens.test.ts
    fontLoading.test.ts
    (Panel.tsx, PresetActions.tsx, PresetBar.tsx, RecordButton.tsx — unchanged)
    (PrePromptCard.tsx, ErrorStates.tsx, errorCopy.ts — unchanged)
index.html                    (DR19 signature + Medium-weight preload)
vercel.json                   (2 header entries: global + /fonts/*)
public/
  fonts/                      (3 × .woff2 + LICENSE.txt + README.md)
tests/
  e2e/
    task-DR-6-1.spec.ts
    task-DR-6-2.spec.ts
    task-DR-6-3.spec.ts
reports/
  (phase-5-deploy.md exists from Task 5.2)
```

### Desired Codebase Tree (changes in this task)

```
tests/
  e2e/
    DR-6-regression.spec.ts  NEW — aggregate foundation invariants spec
reports/
  DR-6-regression.md         NEW — full transcript + preview URL + observations
  DR-6-regression/           NEW directory
    step-1-pre-prompt.png    NEW — MCP screenshot
    step-2-granted-tweakpane.png  NEW
    step-3-preset-cycle.png       NEW
    step-4-record-active.png      NEW
```

### Known Gotchas

```typescript
// CRITICAL: DR-6.R is a gate task, not a feature task. It must NEVER modify foundation
// code to "fix" a failing regression. If any DR-6.1 / DR-6.2 / DR-6.3 regression fails,
// the root-cause fix belongs to THAT task file; re-open it. Do NOT patch around in the
// .R task.

// CRITICAL: Playwright's default viewport may not be 1440×900. The DR-6.3 test asserts
// a specific clamp value at that viewport. The DR-6.R spec should set the viewport
// explicitly via page.setViewportSize before asserting sizes.

// CRITICAL: Phase 1–4 regression coverage is in tests/e2e/phase-{1,2,3,4}-regression.spec.ts
// AND in the various task-N-M.spec.ts files. Match pattern "Task [1-4]\." for the
// task-specific specs and run phase-*-regression.spec.ts by file, not grep.

// CRITICAL: Tweakpane is still mounted after camera grant. Its panel must be visible
// and functional in the MCP walkthrough. The panel's dark theme differs slightly
// from our new tokens — that is EXPECTED and DESIRED (we're replacing Tweakpane in DR-8.6).
// Do NOT attempt to restyle Tweakpane in this task.

// CRITICAL: The Vercel preview step requires `vercel` CLI authenticated (~/.vercel/).
// Task 5.2 completed this auth. If a FRESH workspace runs this task and `vercel whoami`
// fails, HALT and prompt the human — DR-6.R cannot gate without a live preview.

// CRITICAL: Do NOT commit preview URL into DISCOVERY.md or PHASES.md. Preview URLs
// are branch-scoped and ephemeral. Paste only into the report at reports/DR-6-regression.md.

// CRITICAL: Service worker (sw.js from Task 5.1) intercepts /models/* and /wasm/*.
// It does NOT touch /fonts/*. Verify this in DevTools Application panel — if the SW
// starts caching /fonts/* unexpectedly, that's a 5.1 bug to follow up on, not a blocker.

// CRITICAL: pnpm only.

// CRITICAL: Do NOT emit <promise>COMPLETE</promise> unless ALL items in Final Validation
// Checklist are checked off — including the preview deploy verification.
```

---

## Implementation Blueprint

### Implementation Tasks (ordered)

```yaml
Task 1: Pre-flight sanity
  - IMPLEMENT (agent):
      git status            # should be on main, DR-6.1+2+3 already merged
      git log --oneline -20 # confirm three DR-6.{1,2,3} commits present
      pnpm install --frozen-lockfile
      pnpm biome check src/
      pnpm tsc --noEmit
      pnpm vitest run
      pnpm build
      pnpm test:e2e --grep "Task DR-6"
      pnpm test:e2e --grep "Task 4\."
  - GOTCHA: If any level fails, STOP. Root-cause belongs to DR-6.1/2/3 respectively.
            Do not proceed to Task 2.
  - VALIDATE: All exit 0.

Task 2: CREATE tests/e2e/DR-6-regression.spec.ts
  - IMPLEMENT: Playwright spec with describe block
      `Task DR-6.R: Phase DR-6 foundation invariants`

    Inside describe, tests:

    TEST 1 — tokens + font + baseline all compose correctly:
      test('tokens, JetBrains Mono, and body baseline compose at runtime', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto('/')
        await page.evaluate(() => document.fonts.ready)

        const { tokenBg, tokenSpring, fontMedium, bodyFontFamily, bodyFontSize,
                bodyColor, bodyBackground, rootLetterSpacing } =
          await page.evaluate(() => {
            const r = getComputedStyle(document.documentElement)
            const b = getComputedStyle(document.body)
            return {
              tokenBg: r.getPropertyValue('--color-bg').trim(),
              tokenSpring: r.getPropertyValue('--ease-spring').trim(),
              fontMedium: r.getPropertyValue('--font-weight-medium').trim(),
              bodyFontFamily: b.fontFamily,
              bodyFontSize: b.fontSize,
              bodyColor: b.color,
              bodyBackground: b.backgroundColor,
              rootLetterSpacing: r.letterSpacing,
            }
          })

        expect(tokenBg.toUpperCase()).toBe('#0A0A0B')
        expect(tokenSpring).toBe('cubic-bezier(0.47, 0, 0.23, 1.38)')
        expect(fontMedium).toBe('500')
        expect(bodyFontFamily).toContain('JetBrains Mono')
        expect(parseFloat(bodyFontSize)).toBeGreaterThanOrEqual(13)
        expect(parseFloat(bodyFontSize)).toBeLessThanOrEqual(16)
        expect(bodyColor).toBe('rgb(234, 234, 234)')
        expect(bodyBackground).toBe('rgb(10, 10, 11)')
        expect(parseFloat(rootLetterSpacing)).toBeLessThan(0)
      })

    TEST 2 — @font-face rules present; Medium woff2 fetched from /fonts/:
      test('Medium weight woff2 loads with long-cache header', async ({ page, request }) => {
        await page.goto('/')
        const r = await request.get('/fonts/JetBrainsMono-Medium-subset.woff2')
        expect(r.status()).toBe(200)
        const cc = r.headers()['cache-control'] ?? ''
        expect(cc).toContain('max-age=31536000')
        expect(cc).toContain('immutable')
      })

    TEST 3 — existing chrome still functional (pre-prompt card renders correctly):
      test('PrePromptCard renders with new palette + font', async ({ page }) => {
        await page.goto('/')
        await page.evaluate(() => document.fonts.ready)

        const card = page.getByTestId('error-state-card-PROMPT')
        await expect(card).toBeVisible()

        const cardColor = await card.evaluate(el => getComputedStyle(el).color)
        const titleFontFamily = await page.evaluate(() => {
          const title = document.querySelector('#prp-title') as HTMLElement | null
          return title ? getComputedStyle(title).fontFamily : ''
        })

        expect(cardColor).toBe('rgb(234, 234, 234)')
        expect(titleFontFamily).toContain('JetBrains Mono')
      })

    TEST 4 — Tweakpane still mounts after grant (existing chrome survival):
      test('after camera grant, Tweakpane panel mounts with correct testid', async ({ page, context }) => {
        await context.grantPermissions(['camera'])
        await page.goto('/')
        // Click the Enable Camera button from PrePromptCard
        await page.getByRole('button', { name: /enable camera/i }).click()
        // Tweakpane renders inside data-testid="params-panel"
        await expect(page.getByTestId('params-panel')).toBeVisible({ timeout: 10000 })
        // Stage renders
        await expect(page.getByTestId('stage')).toBeVisible()
      })

    TEST 5 — DR19 signature comment present in HTML:
      test('index.html contains DR19 rework signature', async ({ request }) => {
        const r = await request.get('/')
        const html = await r.text()
        expect(html).toContain('<!-- Hand Tracker FX — pixelcrash-inspired rework 2026-04-20 -->')
      })

  - MIRROR: tests/e2e/phase-4-regression.spec.ts for describe structure.
  - GOTCHA: Test 4 requires camera grant — use context.grantPermissions(['camera'])
            which works with fake-webcam Chromium flags in the Playwright config.
  - VALIDATE: `pnpm test:e2e --grep "Task DR-6.R:"` exits 0.

Task 3: Playwright MCP manual walkthrough + screenshots
  - IMPLEMENT (agent via Playwright MCP):
      1. `pnpm build && pnpm preview &` (local production preview — port 4173)
      2. `mcp__playwright__browser_navigate({ url: 'http://localhost:4173' })`
      3. `mcp__playwright__browser_take_screenshot({ filename: 'reports/DR-6-regression/step-1-pre-prompt.png', fullPage: true })`
      4. Click "Enable Camera" button
      5. Wait ~3s for MediaPipe model load
      6. `mcp__playwright__browser_take_screenshot({ filename: 'reports/DR-6-regression/step-2-granted-tweakpane.png', fullPage: true })`
      7. `mcp__playwright__browser_press_key({ key: 'ArrowRight' })` (preset cycle)
      8. `mcp__playwright__browser_take_screenshot({ filename: 'reports/DR-6-regression/step-3-preset-cycle.png', fullPage: true })`
      9. Click the Record button
      10. `mcp__playwright__browser_take_screenshot({ filename: 'reports/DR-6-regression/step-4-record-active.png', fullPage: true })`
      11. Click Record again to stop (avoid leaving MediaRecorder running)
  - GOTCHA: Fake webcam must be active. Playwright MCP respects the project's
            Playwright config flags when launched through the MCP server.
            If the webcam prompt does not auto-grant, set permissions on the
            MCP context before navigation (MCP docs).
  - VALIDATE: `ls reports/DR-6-regression/step-*.png` returns 4 files.

Task 4: Vercel preview deploy + live header verification
  - IMPLEMENT (HUMAN step — agent prompts):
      HUMAN: `git checkout task/DR-6-R-phase-regression && git push -u origin HEAD`
      HUMAN: Vercel auto-deploys on push. Wait ~90s for preview.
      HUMAN: Open Vercel dashboard; copy the preview URL.
      HUMAN: Paste the preview URL to the agent.

    AGENT, given <PREVIEW_URL>:
      curl -sI "$PREVIEW_URL/" | grep -iE 'cross-origin|permissions-policy|content-security-policy|x-content-type-options|referrer-policy'
      curl -sI "$PREVIEW_URL/fonts/JetBrainsMono-Medium-subset.woff2" | grep -iE 'cache-control|content-type|cross-origin'
      curl -sI "$PREVIEW_URL/models/hand_landmarker.task" | grep -iE 'cross-origin|content-type|cache-control'

  - GOTCHA: If `vercel` CLI is not authenticated in this workspace OR the task branch
            is not pushed, the preview won't exist. Prompt human.
  - VALIDATE: All three curl transcripts captured. Root returns all 6 headers.
              /fonts/* returns cache-control + COEP/COOP. /models/* returns cache-control + COEP/COOP.

Task 5: Run against preview (L4 on live URL)
  - IMPLEMENT:
      PLAYWRIGHT_BASE_URL="$PREVIEW_URL" pnpm test:e2e --grep "Task DR-6"
  - GOTCHA: Some specs may timeout against a cold CDN on first fetch (model is 7.5 MB).
            Re-run once if first attempt fails on a first-landmark timeout.
  - VALIDATE: Exit 0.

Task 6: CREATE reports/DR-6-regression.md
  - IMPLEMENT: Markdown report with sections:
      # Phase DR-6 Regression Report
      ## Summary (pass/fail, date, commit sha)
      ## Validation Transcripts
        - L1 biome + tsc
        - L2 vitest
        - L3 build (+ dist file list)
        - L4 E2E results (local + preview)
        - Full phase 1–4 regression transcript
      ## Preview Deploy
        - URL
        - curl transcripts (root, /fonts/*, /models/*)
      ## MCP Walkthrough Screenshots
        - step-1-pre-prompt.png
        - step-2-granted-tweakpane.png
        - step-3-preset-cycle.png
        - step-4-record-active.png
      ## Observations
        - Tweakpane still theming itself (expected; retires in DR-8.6)
        - Any cosmetic drift noted
      ## Deviations
        - (none, or list)
      ## Sign-off
        - Phase DR-6 gate: PASS
        - Ready for Phase DR-7
  - MIRROR: reports/phase-5-deploy.md if present, otherwise a clean structure.
  - VALIDATE: `test -f reports/DR-6-regression.md` and file is ≥ 50 lines.

Task 7: Commit + final green
  - IMPLEMENT:
      git add tests/e2e/DR-6-regression.spec.ts reports/DR-6-regression.md reports/DR-6-regression/
      git commit -m "$(cat <<'EOF'
      Task DR-6.R: Phase DR-6 foundation regression complete

      Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
      EOF
      )"
      git push
  - VALIDATE: `pnpm test:e2e --grep "Task DR-6"` exits 0 one more time.
              `PLAYWRIGHT_BASE_URL="$PREVIEW_URL" pnpm test:e2e --grep "Task DR-6.R:"` exits 0.
```

### Integration Points

```yaml
No runtime integration changes in this task. Read-only verification.

Report file + spec + screenshots are the only new artifacts.

Downstream:
  - Phase DR-7 primitives start from a trusted foundation.
  - The `reports/DR-6-regression.md` file becomes a historical record; DR-9.R archives it alongside other phase reports.
```

---

## Validation Loop

```bash
# Level 1 — Syntax & Style
pnpm biome check tests/e2e/DR-6-regression.spec.ts src/
pnpm tsc --noEmit

# Level 2 — Unit
pnpm vitest run

# Level 3 — Integration
pnpm build
ls -la dist/fonts/*.woff2 dist/assets/*.css dist/index.html

# Level 4 — E2E (this task + DR-6 sub-tasks + phase 1–4 aggregate)
pnpm test:e2e --grep "Task DR-6"           # includes DR-6.1, DR-6.2, DR-6.3, DR-6.R
pnpm test:e2e --grep "Task 1\."
pnpm test:e2e --grep "Task 2\."
pnpm test:e2e --grep "Task 3\."
pnpm test:e2e --grep "Task 4\."
pnpm test:e2e --grep "Task 5\."

# Preview URL verification (after HUMAN pushes branch)
DEPLOY_URL="<preview-url-from-human>"
curl -sI "$DEPLOY_URL/" | grep -iE 'cross-origin|permissions-policy|content-security-policy'
curl -sI "$DEPLOY_URL/fonts/JetBrainsMono-Medium-subset.woff2" | grep -iE 'cache-control|content-type|cross-origin'
PLAYWRIGHT_BASE_URL="$DEPLOY_URL" pnpm test:e2e --grep "Task DR-6"
```

---

## Final Validation Checklist

### Technical

- [ ] `pnpm biome check src/ tests/` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `pnpm vitest run` exits 0 — full suite
- [ ] `pnpm build` exits 0; dist includes tokens.css, fonts/*.woff2, updated index.html
- [ ] `pnpm test:e2e --grep "Task DR-6"` exits 0 (all 4 DR-6 specs pass)
- [ ] `pnpm test:e2e --grep "Task [1-4]\."` exits 0 (45+ specs pass)
- [ ] `pnpm test:e2e` full run exits 0 (total across every spec file)
- [ ] Preview URL deployed
- [ ] `curl -I <preview>/` shows all 6 D31 headers
- [ ] `curl -I <preview>/fonts/JetBrainsMono-Medium-subset.woff2` shows `Cache-Control: public, max-age=31536000, immutable` + COEP + COOP
- [ ] `PLAYWRIGHT_BASE_URL=<preview> pnpm test:e2e --grep "Task DR-6"` exits 0

### Feature

- [ ] MCP walkthrough: PrePromptCard renders in new palette + JetBrains Mono (step-1 screenshot)
- [ ] MCP walkthrough: after Enable Camera, Tweakpane panel visible (step-2)
- [ ] MCP walkthrough: preset cycle via ArrowRight works (step-3)
- [ ] MCP walkthrough: record button toggles recording state (step-4)
- [ ] `crossOriginIsolated === true` on preview URL
- [ ] No console errors on preview during walkthrough
- [ ] DR19 signature comment present in served HTML

### Code Quality

- [ ] `tests/e2e/DR-6-regression.spec.ts` uses `describe('Task DR-6.R: Phase DR-6 foundation invariants', …)`
- [ ] `reports/DR-6-regression.md` written with full transcripts
- [ ] Screenshots committed to `reports/DR-6-regression/`
- [ ] No `skip` / `only` / `fixme` annotations on any test
- [ ] No DR-6 foundation code modified in this task (DR-6.R is gate-only)

---

## Anti-Patterns

- Do NOT modify DR-6.1 / DR-6.2 / DR-6.3 source files in this task. If regression fails, re-open the relevant task.
- Do NOT bump test thresholds or skip failing tests to make green.
- Do NOT claim COMPLETE before the preview URL is verified.
- Do NOT embed the preview URL into DISCOVERY.md / PHASES.md / CLAUDE.md.
- Do NOT push --force; use a standard branch push.
- Do NOT run `vercel --prod`. Preview is the gate — prod alias is untouched.
- Do NOT restyle Tweakpane to match new tokens. Retirement is DR-8.6.
- Do NOT emit `<promise>COMPLETE</promise>` if any L1/L2/L3/L4 is still red OR if the preview verification is outstanding.

Universal anti-patterns apply (`.claude/skills/prp-task-ralph-loop/SKILL.md` §6).

---

## No Prior Knowledge Test

- [ ] DR-6.1, DR-6.2, DR-6.3 are all merged to main (check `git log --oneline main | grep "Task DR-6"`).
- [ ] `tests/e2e/task-DR-6-{1,2,3}.spec.ts` all exist.
- [ ] `reports/` directory exists and contains at least one prior phase report.
- [ ] `vercel.json` has two header entries (global + /fonts/*).
- [ ] `public/fonts/` has 3 woff2 files + LICENSE.txt + README.md.
- [ ] `index.html` contains the DR19 comment and the Medium preload tag.
- [ ] `src/index.css` has the body baseline (font, weight, letter-spacing, color) token references.
- [ ] Vercel project is linked for this repo (Task 5.2 complete).
- [ ] Playwright MCP server is available in this environment (check `mcp__playwright__*` tool availability).
- [ ] Phase 1–4 spec files exist at `tests/e2e/phase-{1,2,3,4}-regression.spec.ts`.

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
.claude/skills/vite-vercel-coop-coep/SKILL.md
.claude/skills/design-tokens-dark-palette/SKILL.md
.claude/skills/jetbrains-mono-self-hosting/SKILL.md
```

> `design-tokens-dark-palette` and `jetbrains-mono-self-hosting` skills are authored in
> parallel. If missing at iteration 1, log it in the Ralph state file — the verifications
> in this task depend on artifacts (tokens.css, fonts/*, index.html) being correct, not on
> the skill docs being present.

---

## Research Files to Read

```
.claude/orchestration-design-rework/research/pixelcrash-design-language.md
.claude/orchestration-design-rework/research/current-ui-audit.md
```

## Git

- Branch: `task/DR-6-R-phase-regression` (from `main`)
- Commit prefix: `Task DR-6.R:`
- Trailer: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
- Push to origin to trigger Vercel preview deploy.
- Merge: fast-forward to `main` after all 4 validation levels exit 0 AND the preview URL verification is complete.
