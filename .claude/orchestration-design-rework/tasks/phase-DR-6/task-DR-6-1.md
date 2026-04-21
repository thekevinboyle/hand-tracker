# Task DR-6.1: Design tokens (CSS custom properties)

**Phase**: DR-6 — Foundation
**Branch**: `task/DR-6-1-design-tokens`
**Commit prefix**: `Task DR-6.1:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal** — Establish a single source of truth for all visual design tokens (color, spacing, type scale, radius, motion) as CSS custom properties, with a TypeScript mirror for programmatic consumers.

**Deliverable** — `src/ui/tokens.css` exports every token the rework needs as a CSS custom property on `:root`, and `src/ui/tokens.ts` re-exports the same values as a typed TS record. `src/index.css`, `src/ui/Stage.css`, and `src/ui/cards.css` are refactored to reference tokens exclusively (no hardcoded hex except inside `tokens.css` itself).

**Success Definition** —
1. `grep -En '#[0-9a-fA-F]{3,6}' src/ui src/index.css` returns ONLY lines inside `src/ui/tokens.css` (plus `favicon` glyph hex if any survives in a comment — no runtime style should reference raw hex outside tokens.css).
2. `pnpm vitest run src/ui/tokens.test.ts` exits 0 asserting every required key exists on the exported TS record.
3. `pnpm test:e2e --grep "Task DR-6.1:"` exits 0 — browser-computed values for at least 6 representative tokens match the token definitions.
4. Existing Phase 1–4 aggregate E2E specs (`tests/e2e/phase-*-regression.spec.ts`) still exit 0 after the refactor — no visual regression in the current Tweakpane UI.

---

## User Persona

**Target User** — The next execution agent implementing DR-6.2 (font), DR-6.3 (reset), and all of Phase DR-7 (primitives) + DR-8 (chrome). Every downstream CSS rule will reference these tokens by name.

**Use Case** — Reusable design language. A primitive CSS file should never embed a hex color or a hard-coded spacing value again — every value comes from this file via `var(--…)`.

**Pain Points Addressed** — The current codebase has hardcoded `#111`, `#1b1b1b`, `#d23030`, etc. scattered across 6 files (see research/current-ui-audit.md §2). When the palette shifts during Phase DR-6 → DR-8 iteration, there is no one-file update path. This task creates that path.

---

## Why

- **DR5** (dark palette) — full semantic mapping from role → hex is defined in DISCOVERY. This task encodes that mapping as CSS variables.
- **DR7** (font + fluid root size) — the `clamp(13px, 0.9vw, 16px)` root size and `-0.01em` letter-spacing live as tokens so DR-6.3 consumes them without redeclaration.
- **DR8** (styling approach, §8.8) — "Plain CSS + CSS custom properties + CSS Modules (optional) only". This task is the opinion-setting moment for the rework.
- **DR11** (motion) — `--duration-short: 0.2s` and spring `cubic-bezier(0.47, 0, 0.23, 1.38)` need canonical names so every primitive uses identical timings.
- **DR12** (near-neutral palette) — prevents drift to warm/cool tinted blacks.
- Downstream: **DR-6.2** adds the `@font-face` + `--font-family` token to this file. **DR-6.3** reads `--font-size-m`, `--color-text-primary`, `--font-family` for the body baseline. Every Phase DR-7 primitive reads from `var(--…)`.

---

## What

User-visible behavior after this task:

- **No visual change** in the running app. The Tweakpane UI still renders with its own theme. The restyled surfaces (`index.css`, `Stage.css`, `cards.css`) use tokens whose values are the NEW palette — so the error cards and page background do shift to the new palette. The tweakpane-rendered panel, still using its internal dark theme, looks the same.
- Existing error-state card colors update from old `#1c1c1e / #fafafb / #c7c7cc` to new tokens mapped from DR5.
- Page background updates from old `#0a0a0b` (coincidentally matches DR5 `--color-bg`) to `var(--color-bg)` sourcing from the new token.

### NOT Building (scope boundary)

- Font family switch — that is DR-6.2. Keep `font-family: system-ui, -apple-system, 'Segoe UI', sans-serif` in `index.css` for this task.
- Body reset / `-webkit-font-smoothing` / letter-spacing baseline — that is DR-6.3.
- New React components or primitives — that is Phase DR-7.
- Replacing Tweakpane theme — that is DR-8.6.
- `@font-face` declarations — DR-6.2 adds them to `tokens.css`.

### Success Criteria

- [ ] `src/ui/tokens.css` exists and declares ≥ 30 custom properties covering color (≥ 16 roles), spacing (≥ 10 steps), type scale (≥ 5 steps), radius (≥ 3 roles), motion (≥ 3 duration + ≥ 2 easing).
- [ ] `src/ui/tokens.ts` exports a typed `Tokens` record whose keys are every token name (minus the `--` prefix) and whose values are strings matching the CSS declarations.
- [ ] `src/index.css` imports `./ui/tokens.css` FIRST and uses `var(--…)` for every color, spacing, and font size previously hardcoded.
- [ ] `src/ui/Stage.css` and `src/ui/cards.css` refactored to tokens only.
- [ ] Unit test `src/ui/tokens.test.ts` asserts every required key exists and every color token is a valid 6-digit hex.
- [ ] New E2E spec `tests/e2e/task-DR-6-1.spec.ts` with describe block `Task DR-6.1: design tokens expose palette + scale` asserts computed CSS custom property values on `:root`.
- [ ] All prior Phase 1–4 E2E specs still pass.

---

## All Needed Context

```yaml
files:
  - path: src/index.css
    why: MODIFY — change 4 hardcoded values (`#0a0a0b`, `#e6e6e8`, `24px` padding, font-family fallback stays) to `var(--color-bg)`, `var(--color-text-primary)`, `var(--space-24)`. Keep `font-family` and `color-scheme: dark` inline for this task (DR-6.2 wires font).
    gotcha: This file is imported by `App.tsx` — it's the entry CSS. `tokens.css` MUST be imported FIRST inside `index.css` so `:root { --… }` is defined before any `var(--…)` consumer.

  - path: src/ui/Stage.css
    why: MODIFY — replace `#000` (stage bg) with `var(--color-stage-bg)` (new token, mapped to `#000` since the stage is letterboxed webcam).
    gotcha: Do NOT add `var(--color-bg)` on `.stage` — stage bg is deliberately pure black (DR5 §soft dark does not apply — stage is a photographic surface).

  - path: src/ui/cards.css
    why: MODIFY — replace every hex color (`#fafafb`, `#c7c7cc`, `#1c1c1e`, `#3a3a3c`, `#2c2c2e`, `#5a5a5c`, `#6aa9ff`) with tokens. Replace `16px` / `32px` / `10px 18px` with spacing tokens. Replace `6px` radius with `var(--radius-0)` (pill-on-hover animation belongs to DR-7.1 — here we just preserve the current radius semantically).
    gotcha: Keep the `@media (prefers-reduced-motion: reduce)` branch as-is — the rule still matters for DR-6.3.

  - path: src/ui/PresetActions.tsx, src/ui/PresetBar.tsx, src/ui/RecordButton.tsx
    why: INSPECT ONLY — these have inline style objects with hardcoded colors. We leave them alone for this task; they get rewritten in Phase DR-8. Do not refactor them here (scope).
    gotcha: If you grep for hex in `src/ui/`, these files will match. Only fail the grep-cleanliness acceptance check for the three CSS files + `src/index.css`. Inline-style refactor is Phase DR-8 scope.

  - path: .claude/orchestration-design-rework/DISCOVERY.md
    why: DR5 table is the authority for every color token value. Copy verbatim.
    gotcha: DR5 values are hex codes (not HSL like pixelcrash). We use hex because they match the existing codebase style and are easier to eyeball-diff.

  - path: .claude/orchestration-design-rework/research/pixelcrash-design-language.md
    why: Sections "Color Tokens", "Type Scale", "Space Token Scale", "Animation Summary" document the naming conventions we mirror (not the values — values come from DR5/DR7/DR11).
    gotcha: pixelcrash uses HSL + fluid `rem`. We use hex for color (easier codebase grep) and literal `rem` for space — BUT the root font-size clamp IS fluid per DR7.

  - path: .claude/orchestration-design-rework/research/current-ui-audit.md
    why: §2 lists every current hardcoded color in the codebase — the migration target set.
    gotcha: §7 marks `src/engine/` as LOCKED. Do not touch engine files.

  - path: src/ui/Panel.tsx
    why: INSPECT ONLY — Tweakpane injects its own dark theme. Do not override it via tokens in this task.
    gotcha: We will retire Tweakpane in DR-8.6. Until then, do nothing to its styles.

  - path: tests/e2e/phase-4-regression.spec.ts
    why: MIRROR — shape of a phase-regression spec, for style reference when authoring the new task-DR-6-1.spec.ts.
    gotcha: Describe blocks MUST start with `Task N.M:` literal for `--grep` to match.

  - path: src/engine/paramStore.ts
    why: INSPECT ONLY — uses `useSyncExternalStore`; pattern reference for any future hook work, not relevant to this task except to confirm there are zero cross-cutting concerns.

urls:
  - url: https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties
    why: Canonical reference for CSS custom property cascade + `var()` fallback syntax.
    critical: Custom properties ARE inherited and case-sensitive. `--color-bg` and `--Color-Bg` are different.

  - url: https://developer.mozilla.org/en-US/docs/Web/CSS/@property
    why: `@property` allows typed custom properties (e.g., `syntax: '<color>'`). Optional for this task but useful if downstream we want animatable tokens.
    critical: NOT required in this task. Prefer plain `:root { --color-…: #…; }` — simpler, broader browser support (which we already have via Chromium-only target).

  - url: https://drafts.csswg.org/css-values-4/#clamp-func
    why: `clamp(min, preferred, max)` syntax for fluid font size.
    critical: DR7 specifies `clamp(13px, 0.9vw, 16px)` for root font. This is the only clamp value in the token file.

skills:
  - design-tokens-dark-palette   # authored in parallel; may not exist yet — still reference it in Skills to Read
  - hand-tracker-fx-architecture
  - prp-task-ralph-loop
  - vitest-unit-testing-patterns

discovery:
  - DR5: dark palette hex values (page bg / panel / text / buttons / segmented / toggle / slider / accents).
  - DR7: JetBrains Mono self-hosted (font loading is DR-6.2; here we pre-wire `--font-family` as a string token so DR-6.2 just updates the value).
  - DR8: modulation card location (no impact here).
  - DR11: spring bezier `cubic-bezier(0.47, 0, 0.23, 1.38)` + standard `ease` — encoded as `--ease-default` and `--ease-spring`.
  - DR12: soft near-neutral dark (no tinting).
  - DR14: error cards restyled; here we make the token wiring, DR-8.4 finishes the card redesign.
```

### Current Codebase Tree

```
src/
  index.css                  (24 LOC — hardcodes #0a0a0b / #e6e6e8, system-ui)
  ui/
    Stage.css                (42 LOC — hardcodes #000)
    cards.css                (57 LOC — hardcodes 7 hex values)
    Panel.tsx, PresetActions.tsx, PresetBar.tsx, RecordButton.tsx,
    PrePromptCard.tsx, ErrorStates.tsx, …
  engine/                    (LOCKED)
  effects/                   (LOCKED)
  camera/                    (LOCKED)
  tracking/                  (LOCKED)
```

### Desired Codebase Tree (changes in this task)

```
src/
  index.css                  MODIFIED — @import './ui/tokens.css'; replace 4 hex, 1 padding.
  ui/
    tokens.css               NEW — all CSS custom properties; @font-face placeholder (DR-6.2 fills)
    tokens.ts                NEW — TypeScript mirror, typed Tokens record
    tokens.test.ts           NEW — vitest asserting every key exists + hex validity
    Stage.css                MODIFIED — replace #000 → var(--color-stage-bg)
    cards.css                MODIFIED — full token migration
tests/
  e2e/
    task-DR-6-1.spec.ts      NEW — assertions on getComputedStyle(document.documentElement)
```

### Known Gotchas

```typescript
// CRITICAL: CSS custom properties do NOT work with @import order in all toolchains.
// Vite's CSS pipeline respects @import order, but mixing @import with JS-imported CSS
// modules can cause ordering surprises. Keep it simple: `src/index.css` top line is
//   @import "./ui/tokens.css";
// before any other rule. Never @import tokens.css from the TS side.

// CRITICAL: Do NOT set `--font-family` to a real font file in this task. DR-6.2 does
// the @font-face wiring. For DR-6.1, the value is the fallback chain:
//   --font-family: 'JetBrains Mono', ui-monospace, 'Menlo', monospace;
// so the string is stable; DR-6.2 only needs to add @font-face rules above it.

// CRITICAL: tokens.ts is a *mirror*, not a source. The CSS file is the source of truth.
// If a downstream consumer imports tokens.ts and the value disagrees with tokens.css,
// the CSS wins at render time. Keep them in sync MANUALLY in this task; a future task
// could codegen one from the other but that is out of scope.

// CRITICAL: Biome v2 is the linter. Run `pnpm biome check` (not --write) in the L1 step
// of the validation loop. Use --write only during active development.

// CRITICAL: Stage background (`.stage`) is deliberately pure black (#000000), NOT the
// page background. Do not unify `--color-bg` and `--color-stage-bg`. The stage is a
// photographic surface; the page chrome is a UI surface. They need different tokens.

// CRITICAL: The `noUncheckedIndexedAccess` TS flag is ON. When indexing `Tokens`,
// the compiler demands `Tokens[key] | undefined`. Use `as const` on the literal or
// use `satisfies Record<string, string>` to preserve exact keys.

// CRITICAL: Do not add a `light` mode branch (no @media (prefers-color-scheme: light)).
// DR5 is dark-only.

// CRITICAL: pnpm, not npm. pnpm vitest run / pnpm test:e2e.

// CRITICAL: Do not touch src/engine/ — that tree is LOCKED per current-ui-audit §7.
```

---

## Implementation Blueprint

### Data Models

```typescript
// src/ui/tokens.ts
export type TokenKey =
  // Color — primary palette
  | 'color-bg'
  | 'color-stage-bg'
  | 'color-panel'
  | 'color-divider'
  | 'color-text-primary'
  | 'color-text-muted'
  | 'color-text-disabled'
  // Color — buttons
  | 'color-button-primary-bg'
  | 'color-button-primary-text'
  | 'color-button-secondary-bg'
  | 'color-button-secondary-bg-hover'
  // Color — controls
  | 'color-segmented-unselected'
  | 'color-segmented-selected'
  | 'color-toggle-on'
  | 'color-toggle-off'
  | 'color-slider-track'
  | 'color-slider-active'
  | 'color-slider-handle'
  | 'color-slider-hover'
  // Color — accents
  | 'color-accent-record'
  | 'color-focus-ring'
  // Spacing
  | 'space-01' | 'space-02' | 'space-04' | 'space-06'
  | 'space-08' | 'space-10' | 'space-12' | 'space-16'
  | 'space-20' | 'space-24' | 'space-32' | 'space-44' | 'space-56'
  // Type
  | 'font-family'
  | 'font-size-root'
  | 'font-size-xs' | 'font-size-s' | 'font-size-m' | 'font-size-l' | 'font-size-xl'
  | 'font-weight-regular' | 'font-weight-medium' | 'font-weight-semibold'
  | 'line-height-body'
  | 'letter-spacing-body'
  // Radius
  | 'radius-0' | 'radius-pill' | 'radius-circle'
  // Motion
  | 'duration-fast' | 'duration-short' | 'duration-medium' | 'duration-long'
  | 'ease-default' | 'ease-spring'

export type Tokens = Record<TokenKey, string>

export const tokens: Tokens = { /* … */ } as const
```

### Implementation Tasks (ordered)

```yaml
Task 1: CREATE src/ui/tokens.css
  - IMPLEMENT: Single :root {} block with ~40 custom properties per the TokenKey list above.
                   Values sourced verbatim from DR5 (colors), DR7 (type), DR11 (motion).
  - MIRROR: pixelcrash-design-language.md §"Color Tokens" + §"Space Token Scale" for naming.
  - NAMING: --color-<role>, --space-NN (NN = rem × 10), --font-size-<xs|s|m|l|xl>,
            --font-weight-<regular|medium|semibold>, --radius-<0|pill|circle>,
            --duration-<fast|short|medium|long>, --ease-<default|spring>.
  - VALUES (anchors to cross-check):
      --color-bg: #0A0A0B
      --color-panel: #151515
      --color-divider: #1F1F1F
      --color-text-primary: #EAEAEA
      --color-text-muted: #8F8F8F
      --color-text-disabled: #6F6F6F
      --color-button-primary-bg: #EAEAEA
      --color-button-primary-text: #0A0A0B
      --color-button-secondary-bg: #2A2A2A
      --color-button-secondary-bg-hover: #333333
      --color-segmented-unselected: #6F6F6F
      --color-segmented-selected: #EAEAEA
      --color-toggle-on: #EAEAEA
      --color-toggle-off: #4A4A4A
      --color-slider-track: #2A2A2A
      --color-slider-active: #EAEAEA
      --color-slider-handle: #EAEAEA
      --color-slider-hover: #CFCFCF
      --color-accent-record: #D23030
      --color-focus-ring: #6AA9FF
      --color-stage-bg: #000000
      --space-01: 0.1rem
      --space-02: 0.2rem
      --space-04: 0.4rem
      --space-06: 0.6rem
      --space-08: 0.8rem
      --space-10: 1.0rem
      --space-12: 1.2rem
      --space-16: 1.6rem
      --space-20: 2.0rem
      --space-24: 2.4rem
      --space-32: 3.2rem
      --space-44: 4.4rem
      --space-56: 5.6rem
      --font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace
      --font-size-root: clamp(13px, 0.9vw, 16px)
      --font-size-xs: 1.15rem
      --font-size-s: 1.2rem
      --font-size-m: 1.3rem
      --font-size-l: 1.5rem
      --font-size-xl: 2rem
      --font-weight-regular: 400
      --font-weight-medium: 500
      --font-weight-semibold: 600
      --line-height-body: 1.4
      --letter-spacing-body: -0.01em
      --radius-0: 0
      --radius-pill: 2.2rem
      --radius-circle: 50%
      --duration-fast: 0.1s
      --duration-short: 0.2s
      --duration-medium: 0.35s
      --duration-long: 0.5s
      --ease-default: cubic-bezier(0.4, 0, 0.2, 1)
      --ease-spring: cubic-bezier(0.47, 0, 0.23, 1.38)
  - GOTCHA: Place hex in UPPERCASE (matches DR5 table). Keeps grep predictable.
  - VALIDATE: `pnpm biome check src/ui/tokens.css` exits 0.
             `grep -c '^\s*--' src/ui/tokens.css` returns ≥ 40.

Task 2: CREATE src/ui/tokens.ts
  - IMPLEMENT: Export `Tokens` type (as in Data Models above).
               Export `const tokens: Tokens = { ... } as const` mirroring every key+value
               from tokens.css verbatim.
               Export `const cssVar = (key: TokenKey): string => \`var(--${key})\`` as
               a typed helper (some downstream code uses inline styles like
               `style={{ color: cssVar('color-text-primary') }}`).
  - MIRROR: src/engine/paramStore.ts (TypeScript strict-mode + `as const` + exported-type pattern).
  - NAMING: lowerCamelCase for TS members (`tokens.colorBg`) is WRONG — we use the
            same kebab keys as CSS (`tokens['color-bg']`) so grep/diff is trivial.
            Expose `cssVar('color-bg')` as the ergonomic path.
  - GOTCHA: `noUncheckedIndexedAccess: true` means indexing a Record yields
            `string | undefined`. Use `satisfies Tokens` or explicit TokenKey union.
  - VALIDATE: `pnpm tsc --noEmit` exits 0.

Task 3: MODIFY src/index.css
  - IMPLEMENT:
      @import "./ui/tokens.css";
      :root {
        color-scheme: dark;
        font-family: var(--font-family);
        background: var(--color-bg);
        color: var(--color-text-primary);
      }
      * { box-sizing: border-box; }
      html, body, #root {
        margin: 0; padding: 0;
        height: 100%; width: 100%;
        overflow: hidden;
      }
      .app-shell { padding: var(--space-24); }
  - GOTCHA: @import MUST be the first non-comment line in the file (CSS spec).
           No space before @import or it's a no-op (Chromium tolerant but Biome catches it).
  - VALIDATE: `pnpm biome check src/index.css` exits 0.
             `pnpm build` — the built `dist/assets/*.css` should contain the literal
             `#EAEAEA` (inlined from tokens.css).

Task 4: MODIFY src/ui/Stage.css
  - IMPLEMENT: Replace only `background: #000;` with `background: var(--color-stage-bg);`.
               No other changes. The spatial layout (position, z-index, transform) is
               engine-locked and stays identical.
  - VALIDATE: `pnpm biome check src/ui/Stage.css` exits 0. `grep -E '#[0-9a-fA-F]' src/ui/Stage.css` returns empty.

Task 5: MODIFY src/ui/cards.css
  - IMPLEMENT: Migrate every hex + spacing number to tokens.
      Before → After map:
        16px                → var(--space-16)
        32px                → var(--space-32)
        1.5rem (title)      → var(--font-size-l)
        1rem (body)         → var(--font-size-m)
        #fafafb             → var(--color-text-primary)
        #c7c7cc             → var(--color-text-muted)
        #1c1c1e (bg)        → var(--color-button-secondary-bg)
        #3a3a3c (border)    → var(--color-divider)
        #2c2c2e (hover bg)  → var(--color-button-secondary-bg-hover)
        #5a5a5c (hover border) → var(--color-text-disabled)
        #6aa9ff             → var(--color-focus-ring)
        10px 18px padding   → var(--space-10) var(--space-16)
        6px border-radius   → var(--radius-0)    (DR-8.4 will wire pill-on-hover; radius 0 at rest per DR11)
        120ms               → var(--duration-fast)
      Keep the `@media (prefers-reduced-motion: reduce)` block as-is.
  - GOTCHA: `line-height: 1.2` and `line-height: 1.5` are dimensionless — keep them literal.
            They are NOT tokens in this scale; adding --line-height-title / --line-height-body-relaxed
            is unnecessary for this phase.
  - VALIDATE: `grep -E '#[0-9a-fA-F]' src/ui/cards.css` returns empty.
             `pnpm biome check src/ui/cards.css` exits 0.

Task 6: CREATE src/ui/tokens.test.ts
  - IMPLEMENT: Vitest unit test. Import `tokens` from './tokens'. For each TokenKey:
      - assert the key exists on the object (`expect(tokens[k]).toBeDefined()`)
      - for color-* keys: assert value matches /^#[0-9A-F]{6}$/ (or is 'rgba(…)' if you ever add transparency — not in this pass)
      - for space-* keys: assert value ends in `rem` and parses to a finite number
      - for duration-* keys: assert value ends in `s` and parses
    Add a separate describe block asserting `cssVar('color-bg') === 'var(--color-bg)'`.
  - MIRROR: tests in src/engine/__tests__/*.test.ts for jsdom + vitest shape.
  - NAMING: Use describe('tokens', …) at module scope — this is L2, not L4, so no Task-prefix grep match needed.
  - VALIDATE: `pnpm vitest run src/ui/tokens.test.ts` exits 0.

Task 7: CREATE tests/e2e/task-DR-6-1.spec.ts
  - IMPLEMENT: Playwright spec with describe block `Task DR-6.1: design tokens expose palette + scale`.
    Launch app at default url (fake webcam). Wait for PrePromptCard visible.
    Evaluate on page:
      const root = document.documentElement
      const cs = getComputedStyle(root)
      return {
        bg: cs.getPropertyValue('--color-bg').trim(),
        panel: cs.getPropertyValue('--color-panel').trim(),
        textPrimary: cs.getPropertyValue('--color-text-primary').trim(),
        space20: cs.getPropertyValue('--space-20').trim(),
        fontFamily: cs.getPropertyValue('--font-family').trim(),
        easeSpring: cs.getPropertyValue('--ease-spring').trim(),
      }
    Expect exact strings:
      bg === '#0A0A0B'
      panel === '#151515'
      textPrimary === '#EAEAEA'
      space20 === '2.0rem'
      fontFamily.includes('JetBrains Mono')
      easeSpring === 'cubic-bezier(0.47, 0, 0.23, 1.38)'
    Also assert page `background-color` on `html` computes to 'rgb(10, 10, 11)' (matches #0A0A0B).
  - MIRROR: tests/e2e/phase-4-regression.spec.ts (describe-block convention, camera permission pattern).
  - GOTCHA: `getPropertyValue` returns a string with a leading space if the CSS has one.
            Always `.trim()`. Some browsers lowercase hex output — if the assertion fails
            case-mismatch, normalize both sides to lowercase before compare.
  - VALIDATE: `pnpm test:e2e --grep "Task DR-6.1:"` exits 0.
```

### Integration Points

```yaml
CSS cascade:
  - src/index.css @imports src/ui/tokens.css on line 1 — this is the single entry.
  - React components that want tokens in inline styles: import { cssVar } from './ui/tokens'
  - CSS Modules are NOT used in this task (they arrive in Phase DR-7 primitives).

TypeScript:
  - tokens.ts exports: Tokens type, tokens object, cssVar helper.
  - No changes to tsconfig.json.

Downstream readiness:
  - DR-6.2 will append @font-face rules at the top of tokens.css and overwrite --font-family if needed.
  - DR-6.3 will add a body { … } block in src/index.css consuming var(--font-size-m), var(--font-weight-medium), var(--letter-spacing-body), var(--line-height-body).
  - Phase DR-7 primitives each import their own CSS file that uses var(--…) exclusively.

Engine (LOCKED):
  - src/engine/*, src/effects/*, src/camera/*, src/tracking/* are NOT touched.
```

---

## Validation Loop

```bash
# Level 1 — Syntax & Style
pnpm biome check src/ui/tokens.css src/ui/tokens.ts src/ui/tokens.test.ts src/index.css src/ui/Stage.css src/ui/cards.css tests/e2e/task-DR-6-1.spec.ts
pnpm tsc --noEmit

# Level 2 — Unit
pnpm vitest run src/ui/tokens.test.ts

# Level 3 — Integration (build — ensures @import resolves, no broken cascade)
pnpm build

# Level 4 — E2E
pnpm test:e2e --grep "Task DR-6.1:"

# Regression sanity (prior phases still pass)
pnpm test:e2e --grep "Task 4\."
pnpm test:e2e --grep "Task 3\."
```

Grep-cleanliness spot-check (run after Task 5):

```bash
# Only tokens.css should contain raw hex in src/ (excluding favicon.svg gradient in public/)
grep -rnE '#[0-9a-fA-F]{3,6}' src/index.css src/ui/Stage.css src/ui/cards.css
# Expected output: EMPTY (tokens.css not in this grep target; inline-styled TSX out of scope).
```

---

## Final Validation Checklist

### Technical

- [ ] `pnpm biome check src/` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `pnpm vitest run` — whole suite green
- [ ] `pnpm build` exits 0; built CSS contains literal `#EAEAEA` and `cubic-bezier(0.47, 0, 0.23, 1.38)`
- [ ] `pnpm test:e2e --grep "Task DR-6.1:"` exits 0
- [ ] `pnpm test:e2e --grep "Task 4\."` — all Phase-4 specs still green (no visual regression)
- [ ] `grep -rnE '#[0-9a-fA-F]{3,6}' src/index.css src/ui/Stage.css src/ui/cards.css` returns empty

### Feature

- [ ] Open app locally (`pnpm dev`). PrePromptCard renders in new palette (bg `#0A0A0B`, text `#EAEAEA`, card bg `#2A2A2A`).
- [ ] DevTools → Elements → `:root` → Computed shows `--color-bg`, `--space-20`, `--ease-spring` values per the spec.
- [ ] Tweakpane, when mounted after camera grant, still renders (its own dark theme — unchanged by our tokens).

### Code Quality

- [ ] No `any` types in `tokens.ts`
- [ ] `as const` OR `satisfies Tokens` on the literal
- [ ] No hex values anywhere in `src/ui/*.css` outside `tokens.css`
- [ ] No inline-styled color on new code (DR-6.1 only rewrites existing CSS files)
- [ ] Biome `organizeImports` did not reorder the `@import "./ui/tokens.css"` — it must remain first in index.css

---

## Anti-Patterns

- Do NOT rename pre-existing testids on any component. Every `data-testid` in `Stage.tsx`, `PrePromptCard.tsx`, `ErrorStates.tsx`, `PresetBar.tsx`, `PresetActions.tsx`, `RecordButton.tsx`, `Panel.tsx` must be preserved.
- Do NOT modify inline styles in `PresetBar.tsx` / `PresetActions.tsx` / `RecordButton.tsx`. Those are Phase DR-8 scope.
- Do NOT touch Tweakpane, modulation, render loop, manifest, paramStore, or any engine file.
- Do NOT add a light-mode @media query (DR5 is dark-only).
- Do NOT codegen `tokens.ts` from `tokens.css` in this task — keep them hand-synced; future enhancement only.
- Do NOT use `@property` typed custom properties — plain `:root { --…: …; }` only.
- Do NOT use `npm` / `npx` / `bun` anywhere.
- Do NOT skip L1 between file writes — run biome + tsc after each file is saved.
- Do NOT emit `<promise>COMPLETE</promise>` if any of L1/L2/L3/L4 is still red.

Universal anti-patterns apply (`.claude/skills/prp-task-ralph-loop/SKILL.md` §6).

---

## No Prior Knowledge Test

- [ ] DR5 color palette table exists in `.claude/orchestration-design-rework/DISCOVERY.md` lines 38–63.
- [ ] DR7 font + clamp + letter-spacing specified in DISCOVERY.md DR7.
- [ ] DR11 motion bezier specified in DISCOVERY.md DR11.
- [ ] `src/index.css`, `src/ui/Stage.css`, `src/ui/cards.css` all exist in the codebase.
- [ ] `tests/e2e/phase-4-regression.spec.ts` exists — mirror for the new spec.
- [ ] Playwright config already has fake-webcam Y4M baked in.
- [ ] `biome.json` exists at repo root; `pnpm biome check` is a working command.
- [ ] No placeholder `<…>` tokens remain in this task file.

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
.claude/skills/design-tokens-dark-palette/SKILL.md
```

> Note: `design-tokens-dark-palette` may not exist yet (authored in parallel). If the file is missing at iteration 1, log it in the Ralph state file under "Learnings" and continue — the values this task encodes are already fully specified in DISCOVERY.md DR5 / DR7 / DR11.

---

## Research Files to Read

```
.claude/orchestration-design-rework/research/pixelcrash-design-language.md
.claude/orchestration-design-rework/research/current-ui-audit.md
```

## Git

- Branch: `task/DR-6-1-design-tokens` (from `main`)
- Commit prefix: `Task DR-6.1:`
- Trailer: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
- Merge: fast-forward to `main` after all 4 validation levels exit 0.
