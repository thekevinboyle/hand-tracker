# Task DR-7.1: Build `Button` primitive with square→pill hover animation

**Phase**: DR-7 — Primitives
**Branch**: `task/DR-7-1-button-primitive`
**Commit prefix**: `Task DR-7.1:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Build a polymorphic `<Button>` React primitive with four variants (primary / secondary / text / icon) and two sizes (sm / md) that implements the pixelcrash signature square→pill hover animation via a `::before` pseudo-element, respects `prefers-reduced-motion`, and carries a stable testid surface for downstream consumers.

**Deliverable**: `src/ui/primitives/Button.tsx` + `src/ui/primitives/Button.module.css` + `src/ui/primitives/Button.test.tsx` (≥ 8 unit tests).

**Success Definition**: `pnpm biome check src/ui/primitives/Button.* && pnpm tsc --noEmit && pnpm vitest run src/ui/primitives/Button.test.tsx` all exit 0; mounting the component renders a button with the DR11 hover animation (visible in Playwright `/primitives` showcase in Task DR-7.R); reduced-motion browser profile collapses the animation to 0s.

---

## Context

This is the first primitive in Phase DR-7, a batch of hand-built React components that replace Tweakpane and provide the full chrome vocabulary for Phase DR-8. The Button is foundational — toolbar (Record), sidebar (Randomize, + Add route, preset Save/SaveAs/Delete), and modulation card (Delete link) all consume it. The square→pill hover is DR11 — the signature pixelcrash interaction we committed to port verbatim.

The engine is locked (DR3): we do not touch paramStore or manifest from this file. Downstream, LAYER 1 / Randomize, Toolbar / Record, and ModulationCard / Delete consume this component.

## Dependencies

- **DR-6.1** (tokens.css) — provides `--color-text-primary`, `--color-bg`, `--color-button-secondary-bg`, `--color-button-secondary-bg-hover`, `--color-text-muted`, `--radius-pill`, `--duration-short`, `--ease-default`
- **DR-6.2** (JetBrains Mono) — `--font-family` inherited from body
- **DR-6.3** (reset + body baseline) — normalized margins / padding / border-box

## Blocked By

- Tasks DR-6.1 through DR-6.R must be `done` in PROGRESS.md before this task starts.

## Research Findings

Key findings that shape the implementation:

- **From `research/pixelcrash-design-language.md` § Components › 3. Buttons**: Primary + Secondary use a `::before` pseudo-element as the colored background at `z-index: -1`; the `::before` is what animates border-radius on hover. The button element itself has transparent bg. Duration `--duration-short: 0.2s` for radius; background-color transition has a `0.1s` delay so the shape rounds first, then the color fades.
- **From `research/pixelcrash-design-language.md` § 3. Buttons**: Text-button hovers color-only from `--color-text-muted` → `--color-text-primary` over 0.1s. Icon-only buttons follow toggle-btn pattern (20×20 container).
- **From `research/pixelcrash-design-language.md` § Interaction Patterns › Disabled States**: `button:disabled { opacity: 0.4; pointer-events: none; }`.
- **From `DISCOVERY.md` DR5 (palette inverted)**: primary BG = `--color-text-primary` (`#EAEAEA`), primary text = `--color-bg` (`#0A0A0B`) — this is the INVERSE of pixelcrash.
- **From `DISCOVERY.md` DR11**: Hover radius → `var(--radius-pill)` (22px equivalent). Respect `prefers-reduced-motion: reduce` by collapsing transition-duration to 0.

## Implementation Plan

### Step 1: Minimal TypeScript signature (copy-paste-ready contract)

```typescript
// src/ui/primitives/Button.tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'icon';
export type ButtonSize = 'sm' | 'md';

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: ButtonVariant; // default 'secondary'
  size?: ButtonSize;       // default 'md'
  children: ReactNode;
  /** Overrides `data-testid`. Default: `button-{variant}` */
  testid?: string;
};

export function Button(props: ButtonProps): JSX.Element;
```

Implementation rules:
- `type="button"` by default (never accidentally submit a form).
- Spread through all standard `<button>` HTML attrs — `onClick`, `disabled`, `aria-label`, `aria-pressed`, `form`, `name`, `value`.
- Merge consumer `className` AFTER internal `styles.root` so consumer can override.
- Attach `data-variant={variant}` and `data-size={size}` so CSS can branch without className string juggling.
- Attach `data-testid={testid ?? `button-${variant}`}`.

### Step 2: CSS recipe — the `::before` pseudo-element pattern

This is the EXACT CSS recipe. Copy it verbatim (adjust only tokens, not structure):

```css
/* src/ui/primitives/Button.module.css */
.root {
  position: relative;
  z-index: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-08);
  height: var(--space-44);          /* md */
  padding: 0 var(--space-16);
  background-color: transparent;
  border: 0;
  border-radius: 0;
  font: inherit;
  font-weight: 500;
  letter-spacing: -0.01em;
  cursor: pointer;
  user-select: none;
  color: inherit;
}

.root::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background-color: transparent;
  border-radius: 0;
  transition:
    border-radius var(--duration-short) var(--ease-default),
    background-color var(--duration-short) var(--ease-default) 0.1s;
}

.root:hover::before {
  border-radius: var(--radius-pill);
}

.root:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.root[disabled] {
  opacity: 0.4;
  pointer-events: none;
}

/* Variant: primary ------------------------------------ */
.root[data-variant='primary'] {
  color: var(--color-bg);
}
.root[data-variant='primary']::before {
  background-color: var(--color-text-primary);
}

/* Variant: secondary ---------------------------------- */
.root[data-variant='secondary'] {
  color: var(--color-text-primary);
}
.root[data-variant='secondary']::before {
  background-color: var(--color-button-secondary-bg);
}
.root[data-variant='secondary']:hover::before {
  background-color: var(--color-button-secondary-bg-hover);
}

/* Variant: text --------------------------------------- */
.root[data-variant='text'] {
  height: auto;
  padding: 0 var(--space-04);
  color: var(--color-text-muted);
  transition: color var(--duration-short) var(--ease-default);
}
.root[data-variant='text']::before {
  content: none;
}
.root[data-variant='text']:hover {
  color: var(--color-text-primary);
}

/* Variant: icon --------------------------------------- */
.root[data-variant='icon'] {
  width: var(--space-20);
  height: var(--space-20);
  padding: 0;
  color: var(--color-text-primary);
}

/* Size: sm -------------------------------------------- */
.root[data-size='sm'] {
  height: var(--space-36);
  padding: 0 var(--space-12);
}

/* REDUCED-MOTION override ----------------------------- */
@media (prefers-reduced-motion: reduce) {
  .root::before {
    transition-duration: 0.01ms !important;
  }
  .root[data-variant='text'] {
    transition-duration: 0.01ms !important;
  }
}
```

### Step 3: Reduced-motion class toggle via `matchMedia`

CSS media query already covers the motion. No JS toggle required; do NOT add one. Unit tests verify the CSS rule exists by asserting on `getComputedStyle` via jsdom-stubbed matchMedia (see Testing Protocol below).

### Step 4: Unit tests (≥ 8)

File: `src/ui/primitives/Button.test.tsx`. Cover exactly these cases — a Ralph iteration that produces fewer than 8 fails.

1. renders with default variant `secondary` and size `md`
2. renders text children
3. fires `onClick` on click
4. respects `disabled` — no `onClick` and `pointer-events: none` computed
5. sets `data-testid="button-primary"` by default for `variant='primary'`
6. honors consumer `testid` override
7. applies `data-variant` and `data-size` data attributes correctly
8. spreads `aria-label` onto the native button
9. merges consumer `className` with internal class
10. (bonus) defaults `type="button"`

## Files to Create

- `src/ui/primitives/Button.tsx` — the component (pure React 19, no hooks besides prop forwarding)
- `src/ui/primitives/Button.module.css` — the exact CSS above
- `src/ui/primitives/Button.test.tsx` — ≥ 8 tests per Step 4

## Files to Modify

- None (DR-7 primitives are authored in isolation; DR-8 wires them up).

## Contracts

### Provides (for downstream tasks)

- `Button`, `ButtonProps`, `ButtonVariant`, `ButtonSize` exported from `src/ui/primitives/Button.tsx`.
- Testid convention: `button-${variant}` (`button-primary`, `button-secondary`, `button-text`, `button-icon`) unless consumer overrides.

### Consumes (from upstream tasks)

- CSS custom properties from Task DR-6.1: `--color-text-primary`, `--color-bg`, `--color-button-secondary-bg`, `--color-button-secondary-bg-hover`, `--color-text-muted`, `--color-focus-ring`, `--space-04|08|12|16|20|36|44`, `--radius-pill`, `--duration-short`, `--ease-default`.

## Acceptance Criteria

- [ ] All 4 variants render; a11y = native `<button role="button">`, keyboard-accessible, focus-visible outline via `--color-focus-ring`
- [ ] Hover transitions border-radius from 0 → `var(--radius-pill)` over `var(--duration-fast)` (primary/secondary/icon only — text variant has no `::before`)
- [ ] Disabled: `opacity: 0.4` and `pointer-events: none`
- [ ] `@media (prefers-reduced-motion: reduce)` collapses `transition-duration` to `0.01ms`
- [ ] `pnpm biome check src/ui/primitives/Button.*` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `pnpm vitest run src/ui/primitives/Button.test.tsx` reports ≥ 8 passing tests

## Testing Protocol

### Level 1 — Syntax & Style

```bash
pnpm biome check src/ui/primitives/Button.tsx src/ui/primitives/Button.module.css src/ui/primitives/Button.test.tsx
pnpm tsc --noEmit
```

### Level 2 — Unit Tests

```bash
pnpm vitest run src/ui/primitives/Button.test.tsx
```

Pattern (per `vitest-unit-testing-patterns` § 4.5):
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button primitive', () => {
  it('renders with default variant', () => {
    render(<Button>Record</Button>);
    expect(screen.getByRole('button', { name: /record/i })).toHaveAttribute('data-variant', 'secondary');
  });
  // …7 more
});
```

### Level 3 — Integration

```bash
pnpm build
```

Verifies the CSS module resolves and the component tree-shakes cleanly.

### Level 4 — E2E

Smoke is deferred to Task DR-7.R (`/primitives` showcase page). No new L4 spec is required in this task; instead verify via:

```bash
pnpm test:e2e --grep "Task DR-7.1:"
```

This MUST return `No tests found` cleanly (exit 0) because the showcase spec does not yet exist. If you write a DR-7.1-specific spec, its describe block MUST begin `describe('Task DR-7.1: …', …)`.

### Browser Testing (Playwright MCP — deferred to DR-7.R)

The `/primitives` showcase in DR-7.R renders all four Button variants — use it to eyeball the square→pill animation.

## Skills to Read

- `.claude/skills/custom-param-components/SKILL.md` — **being authored alongside DR-7**; read for naming conventions, testid discipline, reduced-motion handling patterns, and the decision to use CSS Modules (not CSS-in-JS)
- `.claude/skills/design-tokens-dark-palette/SKILL.md` — **being authored alongside DR-7**; authoritative for which token name maps to which role (you will use these exact names in CSS)
- `.claude/skills/vitest-unit-testing-patterns/SKILL.md` — § 4.5 (React component tests with `@testing-library/react`)
- `.claude/skills/prp-task-ralph-loop/SKILL.md` — the loop you execute; § 1.5 for the L1–L4 template and § 3 for the 7-step iteration protocol
- `.claude/skills/hand-tracker-fx-architecture/SKILL.md` — top-level orientation; confirms `src/ui/` is a React tree separate from the engine

## Research Files to Read

- `.claude/orchestration-design-rework/research/pixelcrash-design-language.md` — § "Components" > 3. Buttons, § "Interaction Patterns" > Motion Language
- `.claude/orchestration-design-rework/research/current-ui-audit.md` — verify what consumer code is currently calling `<button>` directly (Record button in `Stage.tsx`, Randomize in the Tweakpane folder)

## Known Gotchas

```typescript
// CRITICAL: The background-color transition has an intentional 0.1s delay
// AFTER the border-radius transition starts. This sequencing is the pixelcrash
// signature. Do NOT shorten or zero-out this delay — the design calls for
// "shape rounds first, then the color fades".

// CRITICAL: CSS Modules class names are hashed. Do NOT assert on the literal
// class string in tests — query by role or data attribute.

// CRITICAL: prefers-reduced-motion is checked via @media query, NOT JS. Do
// NOT add a matchMedia listener in the component. The CSS override is
// sufficient and StrictMode-safe (no effect to double-fire).

// CRITICAL: This is a React 19 Vite SPA. Do NOT add 'use client' directives.
// The component is a plain function component — no state, no effects.

// CRITICAL: Biome v2 format for CSS is opinionated. Run
//   pnpm biome check --write src/ui/primitives/Button.module.css
// once before checking in to normalize.
```

## Anti-Patterns (task-level)

- Do not animate `border-radius` on the `<button>` element itself — use `::before`. The pixelcrash pattern puts the bg on the pseudo so layout shifts don't happen.
- Do not use an icon library (Heroicons, Feather, Lucide). DR research § Iconography: Unicode characters only.
- Do not add a focus-ring style that differs from the shared `--color-focus-ring` (DR5).
- Do not set `border-radius` pre-emptively on hover via JS — this is a CSS-only interaction.
- Do not snapshot-test rendered HTML (anti-pattern per `vitest-unit-testing-patterns` § 6).
- Do not accept an `as="a"` polymorphic prop — DR research text-button is still a `<button>`, not an `<a>`. Keep it a `<button>` for this task.

## No Prior Knowledge Test

- [ ] Every file path referenced above exists OR is created by this task (explicitly marked CREATE)
- [ ] Every token name cited (`--color-text-primary` etc.) exists in `src/ui/tokens.css` (DR-6.1)
- [ ] The CSS recipe in Step 2 compiles — no undeclared custom properties
- [ ] The test count target (≥ 8) is enforced by the test file before completion
- [ ] All 4 validation commands are copy-paste runnable with no placeholders

## Git

- Branch: `task/DR-7-1-button-primitive`
- Commit prefix: `Task DR-7.1:`
- Commit trailer: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
- Merge: fast-forward to `main` after L1+L2+L3 exit 0
