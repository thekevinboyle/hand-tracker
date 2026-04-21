# Task DR-7.6: Build `LayerCard` primitive (shell + collapsible + `LayerSection`)

**Phase**: DR-7 — Primitives
**Branch**: `task/DR-7-6-layer-card-primitive`
**Commit prefix**: `Task DR-7.6:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Build a reusable `<LayerCard>` shell + `<LayerSection>` child that renders: panel surface (`--color-panel`), 20px padding, header row (title + optional action slot) separated from body by a 1px hairline divider. Optional `collapsible` prop animates height (300ms ease) and content opacity (500ms ease) with a chevron button that rotates 180° — respects `prefers-reduced-motion`.

**Deliverable**:
- `src/ui/primitives/LayerCard.tsx` (exports `LayerCard`, `LayerSection`)
- `src/ui/primitives/LayerCard.module.css`
- `src/ui/primitives/LayerCard.test.tsx` (≥ 10 tests)

**Success Definition**: `pnpm biome check src/ui/primitives/LayerCard.* && pnpm tsc --noEmit && pnpm vitest run src/ui/primitives/LayerCard.test.tsx` all exit 0; `<LayerCard title="LAYER 1" />` renders `role="region"` with `aria-labelledby` pointing at the title; `<LayerCard title="MODULATION" collapsible defaultCollapsed />` renders the body hidden behind `aria-expanded="false"`.

---

## Context

LayerCard is the structural container for the entire sidebar in DR-8. It hosts LAYER 1 (always-expanded per DR6) with three inner `<LayerSection>`s (Grid / Mosaic / Input), and hosts the MODULATION card (collapsible, default collapsed per DR8 research). The visual recipe is a direct translation of pixelcrash's `.layer-panel`.

## Dependencies

- **DR-6.1** tokens: `--color-panel`, `--color-divider`, `--color-text-primary`, `--color-text-muted`, `--color-focus-ring`, `--space-01`, `--space-02`, `--space-08`, `--space-16`, `--space-20`, `--space-24`, `--duration-short`, `--duration-medium`, `--duration-long`, `--ease-default`, `--font-size-m`, `--font-size-l`.

## Blocked By

- DR-6.R

## Research Findings

- **From `research/pixelcrash-design-language.md` § Components > 5. Layer Panel / Card**:
  ```
  .layer-panel {
    display: flex; flex-direction: column;
    gap: 1.6rem; padding: 2.0rem;
    background-color: --color-grey-94;
    overflow: hidden;
    transition: height 0.3s ease, gap 0.3s ease;
  }
  .panel-divider { width: 100%; height: 0.1rem;
                   background-color: --color-grey-86; margin: 0.2rem 0; }
  ```
- **From § Interaction Patterns > Layer Panel Collapse/Expand**:
  ```
  .layer-panel { transition: height 0.3s ease, gap 0.3s ease; }
  .layer-panel > *:not(.panel-header) { opacity: 1; transition: opacity 0.5s ease; }
  ```
  Content fades 0.5s (slower than height's 0.3s) — staggered exit.
- **DISCOVERY DR6**: Single LAYER 1 card. Three inner sections: Grid / Mosaic / Input.
- **DISCOVERY DR8**: MODULATION card below LAYER 1 in right sidebar, collapsible, default-collapsed with toggle chevron.
- **Header row**: pixelcrash ` .panel-header.layer-header { height: 2.0rem; display:flex; justify-content: space-between; align-items:center; }`. Title is `font-weight: 600`, uppercase (CSS or content — we'll use content literal "LAYER 1" / "MODULATION" and leave no transform).

## Implementation Plan

### Step 1: Minimal TypeScript signatures

```typescript
// src/ui/primitives/LayerCard.tsx
import type { ReactNode } from 'react';

export type LayerCardProps = {
  title: string;                         // e.g. "LAYER 1" — rendered literally
  action?: ReactNode;                    // right-anchored slot (e.g. Delete text button)
  collapsible?: boolean;
  defaultCollapsed?: boolean;            // initial collapsed state (collapsible only)
  onCollapsedChange?: (collapsed: boolean) => void;
  children: ReactNode;
  testid?: string;                       // default 'layer-card'
};

export type LayerSectionProps = {
  heading?: string;                      // e.g. "Grid"
  children: ReactNode;
  withDivider?: boolean;                 // default true — draws bottom hairline
  testid?: string;                       // default 'layer-section'
};

export function LayerCard(props: LayerCardProps): JSX.Element;
export function LayerSection(props: LayerSectionProps): JSX.Element;
```

### Step 2: JSX structure

```tsx
import { useId, useState } from 'react';

export function LayerCard({
  title, action, collapsible = false, defaultCollapsed = false,
  onCollapsedChange, children, testid,
}: LayerCardProps): JSX.Element {
  const titleId = useId();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggle = (): void => {
    setCollapsed((prev) => {
      const next = !prev;
      onCollapsedChange?.(next);
      return next;
    });
  };

  return (
    <section
      role="region"
      aria-labelledby={titleId}
      className={`${styles.root} ${collapsed ? styles.collapsed : ''}`}
      data-testid={testid ?? 'layer-card'}
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <header className={styles.header}>
        <h2 id={titleId} className={styles.title}>{title}</h2>
        <div className={styles.headerRight}>
          {action}
          {collapsible && (
            <button
              type="button"
              className={`${styles.chevron} ${collapsed ? styles.chevronCollapsed : ''}`}
              aria-expanded={!collapsed}
              aria-controls={`${titleId}-body`}
              aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
              onClick={toggle}
              data-testid={`${testid ?? 'layer-card'}-chevron`}
            >
              <svg viewBox="0 0 10 10" width={10} height={10} aria-hidden="true">
                <path d="M2 4 L5 7 L8 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </header>
      <div className={styles.divider} aria-hidden="true" />
      <div
        id={`${titleId}-body`}
        className={styles.body}
        aria-hidden={collapsed}
      >
        {children}
      </div>
    </section>
  );
}

export function LayerSection({
  heading, children, withDivider = true, testid,
}: LayerSectionProps): JSX.Element {
  return (
    <div
      className={`${styles.section} ${withDivider ? styles.sectionWithDivider : ''}`}
      data-testid={testid ?? 'layer-section'}
    >
      {heading && <h3 className={styles.sectionHeading}>{heading}</h3>}
      {children}
    </div>
  );
}
```

### Step 3: CSS recipe

```css
/* src/ui/primitives/LayerCard.module.css */
.root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
  padding: var(--space-20);
  background-color: var(--color-panel);
  border-radius: 0;
  overflow: hidden;
  transition:
    gap var(--duration-medium) var(--ease-default);
}

.header {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-08);
}

.title {
  margin: 0;
  font-family: var(--font-family);
  font-size: var(--font-size-m);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--color-text-primary);
}

.headerRight {
  display: inline-flex;
  align-items: center;
  gap: var(--space-08);
}

.chevron {
  width: var(--space-20);
  height: var(--space-20);
  padding: 0;
  background: transparent;
  border: 0;
  color: var(--color-text-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transform: rotate(0deg);
  transition: transform var(--duration-short) var(--ease-default);
}

.chevronCollapsed {
  transform: rotate(-90deg);
}

.chevron:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.divider {
  width: 100%;
  height: var(--space-01);   /* 1px hairline */
  background-color: var(--color-divider);
  margin: var(--space-02) 0;
}

.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
  overflow: hidden;
  opacity: 1;
  max-height: 9999px;        /* large enough for any content; transitions from this sentinel */
  transition:
    opacity var(--duration-long) var(--ease-default),
    max-height var(--duration-medium) var(--ease-default);
}

.collapsed .body {
  opacity: 0;
  max-height: 0;
  /* Staggered exit: opacity at 0.5s, height at 0.3s.
     When EXPANDING, opacity reverses back to 1 over 0.5s. */
}

.collapsed {
  gap: 0;
}

/* Hide divider visually when collapsed to match pixelcrash pattern */
.collapsed .divider {
  opacity: 0;
  transition: opacity var(--duration-short) var(--ease-default);
}

/* Section */
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-08);
  padding-bottom: var(--space-16);
}

.sectionWithDivider:not(:last-child) {
  border-bottom: var(--space-01) solid var(--color-divider);
}

.sectionHeading {
  margin: 0 0 var(--space-04) 0;
  font-size: var(--font-size-m);
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}

@media (prefers-reduced-motion: reduce) {
  .root,
  .body,
  .chevron,
  .divider {
    transition-duration: 0.01ms !important;
  }
}
```

Critical timing values (DO NOT change — task brief locked these):
- Height transition: `var(--duration-medium)` (`0.3s`)
- Content opacity transition: `var(--duration-long)` (`0.5s`)
- Chevron rotate: `var(--duration-short)` (`0.2s`)

### Step 4: Unit tests (≥ 10)

File: `src/ui/primitives/LayerCard.test.tsx`:

1. Renders `role="region"` with `aria-labelledby` pointing at the title heading
2. Renders title text as `<h2>` with `font-weight: 600`
3. Renders children inside `.body`
4. Renders `action` slot in the header-right area
5. Renders `divider` element between header and body
6. `collapsible={false}` (default) does NOT render chevron button
7. `collapsible` renders chevron with `aria-expanded="true"` initially
8. `defaultCollapsed` starts with `aria-expanded="false"` and `data-collapsed="true"`
9. Clicking chevron toggles `aria-expanded` and `data-collapsed`
10. `onCollapsedChange` fires with new state on chevron click
11. `aria-hidden="true"` on body when collapsed
12. `<LayerSection>` renders heading + children; `withDivider` default renders bottom border class

## Files to Create

- `src/ui/primitives/LayerCard.tsx`
- `src/ui/primitives/LayerCard.module.css`
- `src/ui/primitives/LayerCard.test.tsx`

## Files to Modify

- None.

## Contracts

### Provides

- `LayerCard`, `LayerSection`, `LayerCardProps`, `LayerSectionProps` from `src/ui/primitives/LayerCard.tsx`.
- Testids: `layer-card` (+ `-chevron` suffix for the button) and `layer-section`.

### Consumes

- DR-6.1 tokens as listed.

## Acceptance Criteria

- [ ] Divider hairline renders between header and body
- [ ] Section rows separated by inner divider (optional via `withDivider` prop)
- [ ] Collapsible: chevron toggles; `aria-expanded` reflects state; `onCollapsedChange` callback fires
- [ ] Height transition: 300ms (`--duration-medium`)
- [ ] Content opacity transition: 500ms (`--duration-long`)
- [ ] Chevron rotate: 200ms (`--duration-short`)
- [ ] `prefers-reduced-motion`: all transitions collapse to `0.01ms`
- [ ] `role="region"` + `aria-labelledby` wiring
- [ ] ≥ 10 passing unit tests

## Testing Protocol

### L1

```bash
pnpm biome check src/ui/primitives/LayerCard.tsx src/ui/primitives/LayerCard.module.css src/ui/primitives/LayerCard.test.tsx
pnpm tsc --noEmit
```

### L2

```bash
pnpm vitest run src/ui/primitives/LayerCard.test.tsx
```

### L3

```bash
pnpm build
```

### L4

```bash
pnpm test:e2e --grep "Task DR-7.6:"
```

Deferred to DR-7.R showcase.

## Skills to Read

- `.claude/skills/custom-param-components/SKILL.md`
- `.claude/skills/design-tokens-dark-palette/SKILL.md`
- `.claude/skills/vitest-unit-testing-patterns/SKILL.md`
- `.claude/skills/prp-task-ralph-loop/SKILL.md`
- `.claude/skills/hand-tracker-fx-architecture/SKILL.md`

## Research Files to Read

- `.claude/orchestration-design-rework/research/pixelcrash-design-language.md` — § Components > 5. Layer Panel / Card, § Interaction Patterns > Layer Panel Collapse/Expand

## Known Gotchas

```typescript
// CRITICAL: max-height transition requires a known numeric upper bound. We use
// `max-height: 9999px` as the open state. CSS does not transition between
// `height: auto` and a numeric value, so `max-height` is the workaround. Do
// NOT switch to `height: auto` — it will snap, not animate.

// CRITICAL: Use React 19's useId() for aria-labelledby/aria-controls pairs.
// Math.random() or module counters are StrictMode-unsafe.

// CRITICAL: The chevron rotates -90deg when COLLAPSED (matches pixelcrash's
// "v shape points down when expanded, right when collapsed" convention).

// CRITICAL: `aria-hidden={collapsed}` on the body hides it from screen readers
// when collapsed. Do NOT use `display: none` — we need the height transition.

// CRITICAL: CSS Modules compose names. Do NOT check for literal class strings
// in tests — test the data-collapsed attribute or aria state instead.

// CRITICAL: LayerCard's root is <section role="region">. Adding an explicit
// role is required (sections without aria-labelledby aren't landmarks).

// CRITICAL: onCollapsedChange callback should fire with the NEW state
// (post-toggle). Don't fire with the current state — consumer would need
// to invert it.
```

## Anti-Patterns

- Do not use `display: none` for the collapsed body — breaks the height transition.
- Do not render the chevron as an ASCII character like "v" or "›" — use the SVG for crisp rendering.
- Do not put the title inside a `<button>` (WAI-ARIA expansion pattern wraps the chevron in the button; title stays an `<h2>`).
- Do not omit `aria-labelledby` — the region won't be announced correctly otherwise.
- Do not hardcode pixel values that DR-6.1 tokens cover. Always use token references.

## No Prior Knowledge Test

- [ ] All tokens cited exist in tokens.css (DR-6.1)
- [ ] `--duration-short` == `0.2s`, `--duration-medium` == `0.35s`, `--duration-long` == `0.5s`
- [ ] ≥ 10 tests listed
- [ ] Validation commands runnable

## Git

- Branch: `task/DR-7-6-layer-card-primitive`
- Commit prefix: `Task DR-7.6:`
- Trailer: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
