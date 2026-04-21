# Task DR-6.3: Base reset + body baseline

**Phase**: DR-6 — Foundation
**Branch**: `task/DR-6-3-base-reset-body-baseline`
**Commit prefix**: `Task DR-6.3:`
**Estimated complexity**: Low
**Max Ralph iterations**: 10

---

## Goal

**Feature Goal** — Finish Phase DR-6 by giving the app a token-driven base reset and body typography baseline so every downstream primitive inherits the correct font, size, weight, line-height, letter-spacing, color, and smoothing without re-declaring.

**Deliverable** — `src/index.css` refactored so `html`, `body`, `#root` resets use tokens only; `body { font-family, font-size, font-weight, line-height, letter-spacing, color, -webkit-font-smoothing, text-rendering }` all bind to tokens from DR-6.1; existing chrome (PrePromptCard, Tweakpane panel, PresetBar, PresetActions, RecordButton) still renders and still passes every prior E2E.

**Success Definition** —
1. `pnpm test:e2e --grep "Task DR-6.3:"` exits 0 — E2E asserts computed `font-family`, `font-weight`, `line-height`, `letter-spacing`, `color`, and font-size values on `document.body`.
2. Viewing app at 1440×900 viewport, `getComputedStyle(document.body).fontSize` resolves to the clamp midpoint (~13px on 1440×900 because 0.9vw × 1440 = 12.96px, clamped to the 13px floor).
3. All 45 Phase 1–4 aggregate E2E specs still pass.
4. `pnpm build` succeeds.

---

## User Persona

**Target User** — Every agent working on Phase DR-7 (primitives) who expects `JetBrains Mono 500` at `--font-size-m` with `-0.01em` letter-spacing as the inherited default. Their primitive CSS will only override deliberately — not re-declare the baseline.

**Use Case** — Foundation-complete moment. After this task, Phase DR-6 is done and the app is ready for the design-system primitive rebuild.

**Pain Points Addressed** — Avoid per-component re-declaration of the baseline typography. Eliminate hard-coded 24px app-shell padding. Wire `color-scheme: dark` + text color + font smoothing correctly so font rendering matches pixelcrash's crispness on macOS.

---

## Why

- **DR7** — Exact root font-size `clamp(13px, 0.9vw, 16px)`, default weight 500, letter-spacing `-0.01em`. Matches pixelcrash body baseline values.
- **DR5** — Body color binds to `--color-text-primary` (`#EAEAEA`).
- **DR12** — Soft-dark palette reads correctly only with `-webkit-font-smoothing: antialiased` + `text-rendering: geometricPrecision`.
- **DR8** — Plain CSS + custom properties only.
- Downstream: every primitive in Phase DR-7 inherits body baseline, avoiding per-component font-family / font-weight declarations.

---

## What

User-visible behavior after this task:

- Body text — page-wide — renders as JetBrains Mono 500 at ~13px at standard desktop viewport, with slight letter-tightening (`-0.01em`) and antialiasing.
- PrePromptCard title + body + retry button all render in JetBrains Mono with correct weights.
- Page background `#0A0A0B`; text `#EAEAEA`; no system-ui anywhere.
- Tweakpane panel (post-camera-grant) still renders (its own theme — unaffected by body baseline).
- No FOUT on Chromium + local preview.

### NOT Building (scope boundary)

- Typographic styles for specific elements (headings, links, buttons) — those live with each primitive in Phase DR-7.
- Font-variable wght axis — three static weights only (from DR-6.2).
- Print styles — out of scope.
- Selection styling (`::selection`) — Phase DR-7 or DR-8 visual-polish pass.
- Scrollbar styling — Phase DR-8.
- Focus-visible baseline — Phase DR-7 Button primitive.

### Success Criteria

- [ ] `src/index.css` includes a token-driven body baseline:
  - `font-family: var(--font-family)`
  - `font-size: var(--font-size-root)`
  - `font-weight: var(--font-weight-medium)`
  - `line-height: var(--line-height-body)`
  - `letter-spacing: var(--letter-spacing-body)`
  - `color: var(--color-text-primary)`
  - `background: var(--color-bg)`
  - `-webkit-font-smoothing: antialiased`
  - `text-rendering: geometricPrecision`
- [ ] Minimal reset: `* { box-sizing: border-box; margin: 0; padding: 0; font: inherit; }` (or equivalent `* { box-sizing }` + html/body/#root `margin: 0; padding: 0`).
- [ ] `.app-shell` padding unchanged in this task (DR-8.6 owns the app-shell / app-layout padding rewrite).
- [ ] `color-scheme: dark` declared on `:root`.
- [ ] Existing `html, body, #root { height: 100%; width: 100%; overflow: hidden }` block preserved.
- [ ] New E2E spec `tests/e2e/task-DR-6-3.spec.ts` with describe `Task DR-6.3: body uses token baseline` — asserts computed styles match tokens.
- [ ] All Phase 1–4 E2E aggregate still pass.

---

## All Needed Context

```yaml
files:
  - path: src/index.css
    why: MODIFY — this is THE file the task edits. After DR-6.1 it has @import + a
         :root { color-scheme, font-family, background, color } block + a * { box-sizing }
         rule + html/body/#root height/width/overflow (no .app-shell padding — DR-8.6 owns that).
         This task adds the body baseline (font-size, weight, line-height, letter-spacing,
         smoothing, rendering) and refines the reset.
    gotcha: |
      Order matters. @import MUST stay line 1. :root { color-scheme } stays because
      it's inherited by the UA shadow. body { … } rules must be after :root but before
      .app-shell. Running biome check --write may reorder — prefer biome check (no --write)
      in validation.

  - path: src/ui/tokens.css
    why: INSPECT ONLY — this file (from DR-6.1 + DR-6.2) defines all referenced tokens.
         No edits in this task.
    gotcha: If DR-6.1 or DR-6.2 are incomplete, this task cannot complete. Run
            `pnpm test:e2e --grep "Task DR-6.1:"` and `pnpm test:e2e --grep "Task DR-6.2:"`
            before starting, as a dependency sanity check.

  - path: src/ui/cards.css
    why: INSPECT ONLY — DR-6.1 already migrated it to tokens. With body baseline in
         place, some cards.css font-size declarations become redundant (the baseline now
         handles defaults). Do NOT prune them in this task — they set specific emphasis
         (title 1.5rem, body 1rem). Leave as-is.

  - path: src/ui/Stage.css
    why: INSPECT ONLY — Stage is opaque to font baseline (it's a WebGL surface).

  - path: src/ui/PrePromptCard.tsx, src/ui/ErrorStates.tsx
    why: INSPECT ONLY — these render .card / .card-title / .card-body / .card-retry
         and will inherit the new body baseline. Verify visually that the new baseline
         does not break the old error copy layout.

  - path: src/ui/Panel.tsx
    why: INSPECT ONLY — Tweakpane injects its own CSS into shadow-DOM-adjacent nodes.
         The new body baseline does NOT cascade into Tweakpane's internals.

  - path: .claude/orchestration-design-rework/DISCOVERY.md
    why: DR5, DR7, DR12 authority.

  - path: .claude/orchestration-design-rework/research/pixelcrash-design-language.md
    why: §"Body Typography Rules" documents the exact declarations pixelcrash uses
         on body. This task adopts the same SHAPE with our token values.

urls:
  - url: https://developer.mozilla.org/en-US/docs/Web/CSS/font-smooth
    why: `-webkit-font-smoothing: antialiased` explanation + browser support.
    critical: ONLY effective on macOS. On Windows / Linux it's a no-op. Still declare
              it — it's a hint; other platforms ignore safely.

  - url: https://developer.mozilla.org/en-US/docs/Web/CSS/text-rendering
    why: `text-rendering: geometricPrecision` trades off legibility for exact glyph
         positioning — appropriate for technical UI with monospace.
    critical: Not recommended for long-form reading copy, but correct for our
              instrument-panel aesthetic.

  - url: https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme
    why: `color-scheme: dark` hints to UA to render form controls / scrollbars in
         dark style. We already have this from DR-6.1; verify it remains.

  - url: https://drafts.csswg.org/css-values-4/#clamp-func
    why: clamp(min, preferred, max) semantics. Our root size computes as:
         min(max(13px, 0.9vw), 16px). At 1440×900: 0.9vw = 12.96px → 13px (floor).
         At 1920×1080: 0.9vw = 17.28px → 16px (ceiling).

skills:
  - design-tokens-dark-palette       # authored in parallel
  - hand-tracker-fx-architecture
  - prp-task-ralph-loop

discovery:
  - DR5: text color EAEAEA; bg 0A0A0B.
  - DR7: root font clamp(13px, 0.9vw, 16px); default weight 500; letter-spacing -0.01em.
  - DR12: soft-dark; font smoothing required for readability at small monospace sizes.
```

### Current Codebase Tree (as of DR-6.2 completion)

```
src/
  index.css                  (after DR-6.1 + DR-6.2 — ~12 LOC, no body baseline yet)
  ui/
    tokens.css               (with @font-face × 3 + :root tokens)
    tokens.ts
    tokens.test.ts
    fontLoading.test.ts
    Stage.css
    cards.css                (tokenized)
```

### Desired Codebase Tree (changes in this task)

```
src/
  index.css                  MODIFIED — adds body baseline block; refines reset
tests/
  e2e/
    task-DR-6-3.spec.ts      NEW — asserts computed body styles match tokens
```

### Known Gotchas

```typescript
// CRITICAL: `font-size: var(--font-size-root)` is the clamp; DO NOT use `--font-size-m`
// on body. --font-size-root IS the clamped root; --font-size-m is a multiplier on top.
// Using --font-size-m on body yields font-size: 1.3rem, which is relative to itself — fine,
// but less explicit. Use --font-size-root to make the clamp intent obvious. Then child
// elements can use `--font-size-m` and get 1.3× the root.

// CRITICAL: font-size on body ALSO acts as the rem base. Setting font-size on :root
// (HTML) vs body is load-bearing. Modern convention: set font-size on :root (html).
// In our case :root { font-size: var(--font-size-root) } AND body { font-size: inherit }
// would be safest. Simpler: set `font-size: var(--font-size-root)` on `:root` and leave
// body to inherit; but rem math cares only about :root's font-size, not body's.
// OUR CHOICE for this task: declare `font-size: var(--font-size-root)` on `:root`
// (html-equivalent). Body inherits. This mirrors pixelcrash.

// CRITICAL: `line-height: var(--line-height-body)` is dimensionless (1.4) per DR-6.1.
// Do NOT use a space token (e.g. var(--space-20) / 2rem) — that creates a rigid line-box.
// Dimensionless line-height scales with the element's font-size and is the correct
// CSS idiom.

// CRITICAL: Biome v2 may rewrite CSS shorthand (margin: 0 0 0 0 → margin: 0). Accept
// whatever biome --write produces, but run `biome check` (no --write) in validation
// to confirm no pending rewrites.

// CRITICAL: StrictMode renders twice in dev — visually no effect here, but verify the
// E2E spec does not assume single-mount semantics on the body element.

// CRITICAL: Playwright computes styles via getComputedStyle at the point of navigation.
// If the font has not loaded yet when the assertion runs, font-family may still
// include the fallback. Use `await document.fonts.ready` inside page.evaluate before
// asserting.

// CRITICAL: Reduced-motion handling lives in cards.css from DR-6.1 + will be extended in
// Phase DR-7 per-component. DO NOT add prefers-reduced-motion rules to body / index.css
// in this task.

// CRITICAL: pnpm only.

// CRITICAL: Do NOT touch engine / effects / camera / tracking. DO NOT touch Panel.tsx,
// PresetActions.tsx, PresetBar.tsx, RecordButton.tsx. Those are DR-8 scope.
```

---

## Implementation Blueprint

### Implementation Tasks (ordered)

```yaml
Task 1: MODIFY src/index.css
  - IMPLEMENT: Final shape of the file (approximately 30 LOC):

      @import "./ui/tokens.css";

      :root {
        color-scheme: dark;
        font-family: var(--font-family);
        font-size: var(--font-size-root);
        font-weight: var(--font-weight-medium);
        line-height: var(--line-height-body);
        letter-spacing: var(--letter-spacing-body);
        color: var(--color-text-primary);
        background: var(--color-bg);
        -webkit-font-smoothing: antialiased;
        text-rendering: geometricPrecision;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body,
      #root {
        margin: 0;
        padding: 0;
        height: 100%;
        width: 100%;
        overflow: hidden;
      }

      body {
        font: inherit;
        color: inherit;
        background: inherit;
      }

      /* NOTE: .app-shell padding is left untouched in DR-6.3. The current Stage is
         `position: fixed` so extra padding has no effect; DR-8.6 replaces the
         fixed Stage with a flex layout and explicitly sets `.app-layout { padding: 0 }`
         there. Introducing .app-shell padding now would create an ambiguous
         pre-DR-8.6 layout. */

  - GOTCHA: Placing font-related declarations on :root (not body) makes them cascade
            correctly AND makes the rem calculation depend on --font-size-root.
  - GOTCHA: `body { font: inherit }` shorthand sets font-family, font-size, font-style,
            font-variant, font-weight, line-height, font-stretch from parent (:root).
            This is simpler than re-declaring each property on body.
  - GOTCHA: Do NOT use Biome's `--write` in the validation loop. Run `--write` during
            implementation if you want auto-fix, then run `pnpm biome check` (no flag)
            to confirm the final file passes.
  - VALIDATE: `pnpm biome check src/index.css` exits 0.
              `grep -c 'var(--' src/index.css` returns ≥ 10 (one per token reference).
              `grep -cE '#[0-9a-fA-F]{3,6}' src/index.css` returns 0.

Task 2: CREATE tests/e2e/task-DR-6-3.spec.ts
  - IMPLEMENT: Playwright spec with describe block
      `Task DR-6.3: body uses token baseline`

    test('html + body computed styles match tokens', async ({ page }) => {
      await page.goto('/')
      await page.evaluate(() => document.fonts.ready)

      const styles = await page.evaluate(() => {
        const root = document.documentElement
        const body = document.body
        const rootCS = getComputedStyle(root)
        const bodyCS = getComputedStyle(body)
        return {
          rootFontFamily: rootCS.fontFamily,
          rootFontSize: rootCS.fontSize,         // px-resolved from clamp
          rootFontWeight: rootCS.fontWeight,     // "500"
          rootLineHeight: rootCS.lineHeight,     // "1.4" (dimensionless inherits as multiple)
          rootLetterSpacing: rootCS.letterSpacing, // px, computed from -0.01em
          rootColor: rootCS.color,               // "rgb(234, 234, 234)"
          rootBackground: rootCS.backgroundColor, // "rgb(10, 10, 11)"
          bodyFontFamily: bodyCS.fontFamily,
          bodyFontSize: bodyCS.fontSize,
        }
      })

      // Font family contains JetBrains Mono
      expect(styles.rootFontFamily).toContain('JetBrains Mono')
      expect(styles.bodyFontFamily).toContain('JetBrains Mono')

      // Font weight is 500
      expect(styles.rootFontWeight).toBe('500')

      // Font size is within clamp range [13px, 16px]
      const rootFontPx = parseFloat(styles.rootFontSize)
      expect(rootFontPx).toBeGreaterThanOrEqual(13)
      expect(rootFontPx).toBeLessThanOrEqual(16)

      // At default Playwright viewport (1280 × 720), 0.9vw = 11.52px < 13px floor
      // So expect exactly 13px unless Playwright sets a non-default viewport.
      // If we know the viewport from playwright.config, assert it precisely.

      // Color is EAEAEA
      expect(styles.rootColor).toBe('rgb(234, 234, 234)')

      // Background is 0A0A0B
      expect(styles.rootBackground).toBe('rgb(10, 10, 11)')

      // Letter spacing is -0.01em — computes to a small negative px number
      const ls = parseFloat(styles.rootLetterSpacing)
      expect(ls).toBeLessThan(0)
      expect(ls).toBeGreaterThan(-1)  // sanity bound
    })

    test('viewport at 1440×900 clamps root font to 13px', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('/')
      await page.evaluate(() => document.fonts.ready)
      const fontSize = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.documentElement).fontSize)
      )
      // 0.9vw × 1440 = 12.96 → clamped to 13
      expect(fontSize).toBe(13)
    })

  - MIRROR: tests/e2e/task-DR-6-1.spec.ts (from DR-6.1) for the describe-block convention
            and the getComputedStyle evaluate-and-expect pattern.
  - GOTCHA: `document.fonts.ready` — await inside `page.evaluate(() => ...)`.
            Without this the font may still be loading at assertion time.
  - GOTCHA: `.fontFamily` in computed style is comma-separated with quotes sometimes
            preserved sometimes stripped. Use `.toContain('JetBrains Mono')` rather
            than exact-equal.
  - VALIDATE: `pnpm test:e2e --grep "Task DR-6.3:"` exits 0.

Task 3: Visual / regression sanity run
  - IMPLEMENT: No code change. Run all prior E2E suites:
      pnpm test:e2e --grep "Task 1\."
      pnpm test:e2e --grep "Task 2\."
      pnpm test:e2e --grep "Task 3\."
      pnpm test:e2e --grep "Task 4\."
      pnpm test:e2e --grep "Task 5\."
      pnpm test:e2e --grep "Task DR-6.1:"
      pnpm test:e2e --grep "Task DR-6.2:"
      pnpm test:e2e --grep "Task DR-6.3:"
  - VALIDATE: All exit 0. If any fail, the failure is almost certainly due to assumption
              about hardcoded font-family or font-size in the test — fix the test, not
              the baseline, since DR-6.3 is deliberately tightening the type system.
  - GOTCHA: If a phase-N spec asserts against a literal font-family string that now
            no longer matches (e.g., expected 'system-ui'), update the spec to assert
            `.toContain('JetBrains Mono')` instead. Root-cause fix — not bypass.
```

### Integration Points

```yaml
Cascade (after this task):
  - :root { font-family, font-size, font-weight, line-height, letter-spacing, color, background }
  - * { box-sizing: border-box }
  - html/body/#root { margin:0; padding:0; height/width:100%; overflow:hidden }
  - body { font: inherit; color: inherit; background: inherit }
  - (.app-shell padding is NOT introduced in DR-6.3; DR-8.6 owns app-shell / app-layout padding.)
  - .card, .stage, .panel-container, …  (all inherit font, color, smoothing)
  - Tweakpane — not affected (isolated via its own CSS)

No changes to:
  - src/ui/tokens.css (DR-6.1 + DR-6.2)
  - src/ui/Stage.css
  - src/ui/cards.css
  - index.html
  - vercel.json
  - vite.config.ts / biome.json / tsconfig.json / playwright.config.ts
  - Any engine / effect / tracking / camera file
```

---

## Validation Loop

```bash
# Level 1 — Syntax & Style
pnpm biome check src/index.css tests/e2e/task-DR-6-3.spec.ts
pnpm tsc --noEmit

# Level 2 — Unit (no new unit tests in this task; regression check)
pnpm vitest run

# Level 3 — Integration
pnpm build

# Level 4 — E2E (this task + full regression)
pnpm test:e2e --grep "Task DR-6.3:"
pnpm test:e2e --grep "Task DR-6.1:"
pnpm test:e2e --grep "Task DR-6.2:"
pnpm test:e2e --grep "Task 4\."
```

---

## Final Validation Checklist

### Technical

- [ ] `pnpm biome check src/` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `pnpm vitest run` — all green
- [ ] `pnpm build` exits 0
- [ ] `pnpm test:e2e --grep "Task DR-6.3:"` exits 0
- [ ] `pnpm test:e2e --grep "Task DR-6.2:"` still exits 0
- [ ] `pnpm test:e2e --grep "Task DR-6.1:"` still exits 0
- [ ] Phase 1–4 E2E aggregate still exits 0

### Feature

- [ ] Open `pnpm dev` at 1440×900. PrePromptCard title renders in JetBrains Mono SemiBold
      (if card CSS declares weight 600) or Medium (default).
- [ ] Body text renders at ~13px (devtools computed shows 13px on this viewport).
- [ ] Letter-spacing: inspect body in devtools → computed → letter-spacing: -0.13px
      (negative, proportional to 13px × -0.01).
- [ ] Color: body foreground `rgb(234, 234, 234)`; background `rgb(10, 10, 11)`.
- [ ] Scroll behavior: no scrollbars visible (overflow: hidden on html/body/#root).
- [ ] Tweakpane panel still mounts and renders controls after camera grant.

### Code Quality

- [ ] No hardcoded hex in src/index.css
- [ ] No hardcoded px / rem size in src/index.css except `height: 100%` / `width: 100%` and `margin: 0` / `padding: 0`
- [ ] No use of `any` (no TS files touched in this task)
- [ ] No inline `style={{ font… }}` added to existing TSX components

---

## Anti-Patterns

- Do NOT declare `font-family: 'JetBrains Mono'` directly — use `var(--font-family)`.
- Do NOT set `font-size: 13px` directly — use `var(--font-size-root)`.
- Do NOT add `::selection` styles (Phase DR-8 polish pass).
- Do NOT add a `:focus-visible` baseline rule on body (belongs to Button primitive in DR-7.1).
- Do NOT touch Tweakpane styling — not even to try to match.
- Do NOT add a `@media (prefers-reduced-motion)` rule at the body level — per-component only.
- Do NOT add vendor prefixes except `-webkit-font-smoothing`. Biome v2's `useGenericFontNames` linter may complain — add `@property` or ignore if necessary, but try to keep plain `-webkit-font-smoothing` which every browser accepts.
- Do NOT prune cards.css font-size declarations — they intentionally specify emphasis.
- Do NOT edit index.html — font preload is DR-6.2's job, already done.
- Do NOT emit `<promise>COMPLETE</promise>` if any L1/L2/L3/L4 is still red.

Universal anti-patterns apply (`.claude/skills/prp-task-ralph-loop/SKILL.md` §6).

---

## No Prior Knowledge Test

- [ ] DR-6.1 complete — tokens.css exports --font-family, --font-size-root, --font-weight-medium, --line-height-body, --letter-spacing-body, --color-text-primary, --color-bg, --space-24.
- [ ] DR-6.2 complete — JetBrains Mono 3 weights self-hosted; preload in index.html.
- [ ] `src/index.css` exists and currently imports `./ui/tokens.css`.
- [ ] `tests/e2e/task-DR-6-1.spec.ts` exists as mirror for describe-block + getComputedStyle pattern.
- [ ] Playwright Chromium runs with fake webcam — PrePromptCard is the visible initial state.
- [ ] `document.fonts.ready` Promise API available in Chromium (yes — evergreen).

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/design-tokens-dark-palette/SKILL.md
```

---

## Research Files to Read

```
.claude/orchestration-design-rework/research/pixelcrash-design-language.md
.claude/orchestration-design-rework/research/current-ui-audit.md
```

## Git

- Branch: `task/DR-6-3-base-reset-body-baseline` (from `main`)
- Commit prefix: `Task DR-6.3:`
- Trailer: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
- Merge: fast-forward to `main` after all 4 validation levels exit 0.
