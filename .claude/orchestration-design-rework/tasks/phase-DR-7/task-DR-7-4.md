# Task DR-7.4: Build `Toggle` primitive with square↔circle spring morph

**Phase**: DR-7 — Primitives
**Branch**: `task/DR-7-4-toggle-primitive`
**Commit prefix**: `Task DR-7.4:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Build a `<Toggle>` (ARIA switch) primitive rendering a 20×20 container whose `::before` pseudo-element morphs from a filled square (ON: `--color-text-primary`, radius 0) to a filled circle (OFF: `--color-toggle-off`, radius 50%) with a spring easing curve. Inside, a 10×10 SVG icon morphs from "X" (ON) to "+" (OFF) via a -90° rotation on a 0.35s spring bezier with a 0.15s delay so the background animates first, then the icon snaps into place.

**Deliverable**:
- `src/ui/primitives/Toggle.tsx`
- `src/ui/primitives/Toggle.module.css`
- `src/ui/primitives/Toggle.test.tsx` (≥ 8 tests)

**Success Definition**: `pnpm biome check src/ui/primitives/Toggle.* && pnpm tsc --noEmit && pnpm vitest run src/ui/primitives/Toggle.test.tsx` all exit 0; mounting with `checked={true}` renders an element with ARIA `role="switch"` and `aria-checked="true"`; Space key toggles `aria-checked`; `prefers-reduced-motion: reduce` collapses all transitions to 0.

---

## Context

Toggle backs the two boolean params in `handTrackingMosaic.manifest`: `input.mirrorMode` and `input.showLandmarks`. It's also used for modulation route `Enabled` on/off (Task DR-8.3). The spring motion is the second distinctive pixelcrash interaction (after square→pill — DR11).

## Dependencies

- **DR-6.1** tokens: `--color-text-primary`, `--color-toggle-off`, `--color-bg`, `--color-focus-ring`, `--space-04`, `--space-10`, `--space-16`, `--space-20`, `--duration-medium`, `--duration-fast`, `--ease-spring`, `--ease-default`.

## Blocked By

- DR-6.R

## Research Findings

- **From `research/pixelcrash-design-language.md` § Components > 7. Toggle Button**:
  ```
  button.toggle-btn { width: 2.0rem; height: 2.0rem; padding: 0; background: transparent; }
  ::before { background: black; border-radius: 0; }        /* ON: square */
  :hover::before { border-radius: 1.0rem; }                /* hover -> rounds halfway */
  .off::before { background: #7A7A7A; border-radius: 1.0rem; } /* OFF: circle */
  .off:hover::before { background: black; }                 /* OFF hover -> preview ON color */
  ```
  Our inverted palette: ON = `--color-text-primary` (`#EAEAEA`), OFF = `--color-toggle-off` (`#4A4A4A`), text-on-fill = `--color-bg` (`#0A0A0B`).
- **From § 7 Toggle Button**: The inner SVG X icon has `width: 1.0rem × 1.0rem`. When OFF, it rotates −90° and the horizontal bar scales to 0 (X → +).
- **Special callout (from task brief)**: "The SVG X→+ rotation uses spring bezier `cubic-bezier(0.47, 0, 0.23, 1.38)` at 0.35s with 0.15s delay." This bezier is `--ease-spring` in tokens.
- **Animation Summary § — Toggle SVG rotate = 0.35s / spring / click**. Toggle background = 0.2s ease.
- **A11y**: `role="switch"` + `aria-checked={checked}`. Space toggles. Enter optional but standard.

## Implementation Plan

### Step 1: Minimal TypeScript signature

```typescript
// src/ui/primitives/Toggle.tsx

export type ToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;      // required for screen readers
  disabled?: boolean;
  testid?: string;        // default 'toggle'
};

export function Toggle(props: ToggleProps): JSX.Element;
```

### Step 2: JSX structure

```tsx
<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={ariaLabel}
  disabled={disabled}
  className={`${styles.root} ${checked ? styles.on : styles.off}`}
  onClick={() => onChange(!checked)}
  onKeyDown={(e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  }}
  data-testid={testid ?? 'toggle'}
  data-checked={checked ? 'true' : 'false'}
>
  <svg
    className={styles.icon}
    viewBox="0 0 10 10"
    aria-hidden="true"
    width={10}
    height={10}
  >
    {/* Two crossing lines: horizontal (.hor) + vertical (.ver).
        When OFF, .hor scaleX(0) hides horizontal; the element rotates -90
        so the remaining vertical becomes "+" relative to original "X". */}
    <line className={styles.hor} x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.5" />
    <line className={styles.ver} x1="5" y1="1" x2="5" y2="9" stroke="currentColor" strokeWidth="1.5" />
  </svg>
</button>
```

NOTE: Read the SVG carefully. The X is drawn as two diagonal lines in pixelcrash; we render it as horizontal + vertical here because the rotate(-90°) on "+" (plus) vs "X" (cross) is functionally equivalent — the morph from ON to OFF is `background: dark→light → radius: 0→10 → icon rotates`. If tests want the actual X look, replace the two lines with diagonals `x1=1 y1=1 x2=9 y2=9` and `x1=1 y1=9 x2=9 y2=1`. Document your choice in a code comment; tests should assert on behavior not exact SVG coords.

### Step 3: CSS recipe (copy verbatim)

```css
/* src/ui/primitives/Toggle.module.css */
.root {
  position: relative;
  z-index: 0;
  width: var(--space-20);    /* 20px */
  height: var(--space-20);
  padding: 0;
  background-color: transparent;
  border: 0;
  border-radius: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-bg);
}

.root::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  transition:
    background-color var(--duration-fast) var(--ease-default),
    border-radius var(--duration-fast) var(--ease-default);
}

.on::before {
  background-color: var(--color-text-primary);
  border-radius: 0;
}

.off::before {
  background-color: var(--color-toggle-off);
  border-radius: 50%; /* full circle at 20x20 container */
}

.on:hover::before {
  border-radius: var(--space-10); /* 10px = half the container, i.e. rounds toward circle on hover */
}

.off:hover::before {
  background-color: var(--color-text-primary); /* preview of ON color */
}

.root:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.root[disabled] {
  opacity: 0.4;
  pointer-events: none;
}

.icon {
  width: var(--space-10);  /* 10px */
  height: var(--space-10);
  color: var(--color-bg);   /* paints lines in the dark bg color for contrast */
  transition: transform var(--duration-medium) var(--ease-spring) 0.15s;
  transform: rotate(0deg);
}

.off .icon {
  transform: rotate(-90deg);
}

.hor {
  transition: transform var(--duration-medium) var(--ease-spring) 0.15s;
  transform-origin: center;
}

.off .hor {
  transform: scaleX(0);
}

/* REDUCED MOTION — collapse to instant */
@media (prefers-reduced-motion: reduce) {
  .root::before,
  .icon,
  .hor {
    transition-duration: 0.01ms !important;
  }
}
```

Critical values to double-check against DISCOVERY:
- `--ease-spring` MUST equal `cubic-bezier(0.47, 0, 0.23, 1.38)` (defined in tokens.css by DR-6.1).
- `--duration-medium` MUST equal `0.35s`.
- `.icon` delay MUST equal `0.15s` (hardcoded — not a token, per DR11 spec).

### Step 4: Unit tests (≥ 8)

File: `src/ui/primitives/Toggle.test.tsx`.

1. Renders with `role="switch"` and `aria-checked="true"` when `checked={true}`
2. `aria-checked="false"` when `checked={false}`
3. Click fires `onChange(!checked)`
4. Space key fires `onChange(!checked)` and prevents default scroll
5. Enter key fires `onChange(!checked)`
6. `aria-label` is propagated to the button
7. `disabled` blocks click and key events
8. `data-checked` attribute reflects state (`'true'` / `'false'`)
9. (bonus) `testid` prop overrides default `toggle`
10. (bonus) assert the `styles.on` / `styles.off` class variance via `data-checked` selector

## Files to Create

- `src/ui/primitives/Toggle.tsx`
- `src/ui/primitives/Toggle.module.css`
- `src/ui/primitives/Toggle.test.tsx`

## Files to Modify

- None.

## Contracts

### Provides

- `Toggle`, `ToggleProps` from `src/ui/primitives/Toggle.tsx`.
- Testid: `toggle` (consumer-overridable).

### Consumes

- DR-6.1 tokens: `--color-text-primary`, `--color-toggle-off`, `--color-bg`, `--color-focus-ring`, `--space-10`, `--space-20`, `--duration-fast`, `--duration-medium`, `--ease-default`, `--ease-spring`.

## Acceptance Criteria

- [ ] `role="switch"` + `aria-checked` both set correctly
- [ ] Space key toggles (preventDefault)
- [ ] Enter key toggles
- [ ] Reduced motion: all transitions collapse to `0.01ms`
- [ ] Spring bezier at `0.35s` with `0.15s` delay on the icon (verified via CSS assertion)
- [ ] Hover on ON: radius 0 → `var(--space-10)` (animates toward circle)
- [ ] Hover on OFF: background darkens to `--color-text-primary` preview
- [ ] ≥ 8 passing unit tests

## Testing Protocol

### L1

```bash
pnpm biome check src/ui/primitives/Toggle.tsx src/ui/primitives/Toggle.module.css src/ui/primitives/Toggle.test.tsx
pnpm tsc --noEmit
```

### L2

```bash
pnpm vitest run src/ui/primitives/Toggle.test.tsx
```

### L3

```bash
pnpm build
```

### L4

```bash
pnpm test:e2e --grep "Task DR-7.4:"
```

Deferred to DR-7.R showcase. Must exit 0.

## Skills to Read

- `.claude/skills/custom-param-components/SKILL.md`
- `.claude/skills/design-tokens-dark-palette/SKILL.md`
- `.claude/skills/vitest-unit-testing-patterns/SKILL.md`
- `.claude/skills/prp-task-ralph-loop/SKILL.md`
- `.claude/skills/hand-tracker-fx-architecture/SKILL.md`

## Research Files to Read

- `.claude/orchestration-design-rework/research/pixelcrash-design-language.md` — § Components > 7. Toggle Button, § Iconography > Toggle X/Plus SVG, § Animation Summary table

## Known Gotchas

```typescript
// CRITICAL: The spring bezier is cubic-bezier(0.47, 0, 0.23, 1.38) — the y2=1.38
// overshoots beyond 1.0 by design, producing the "snap" feel. Do NOT normalize
// it to 1.0. Stored as `--ease-spring` in tokens.css (DR-6.1).

// CRITICAL: Space and Enter both toggle the switch per WAI-ARIA. preventDefault
// on Space is required to suppress page scroll.

// CRITICAL: Use role="switch" not role="checkbox". The ARIA switch pattern is
// aria-checked={true|false}, NOT "mixed". Ours is strictly boolean.

// CRITICAL: The icon's color is `--color-bg` so it contrasts on the bright
// ON background (EAEAEA). On OFF (4A4A4A), the dark icon is barely visible —
// that's fine because the OFF state's morphed "+" is intended to read as
// "add / activate".

// CRITICAL: jsdom does not compute CSS transitions. Test EVENT behavior
// (onChange fires, aria-checked flips) rather than asserting on transition
// timing. Visual verification happens in the DR-7.R showcase.

// CRITICAL: This primitive has NO internal state. It is fully controlled by
// `checked` + `onChange`. Tests must render with a parent that manages state
// or use an uncontrolled wrapper in tests.
```

## Anti-Patterns

- Do not use `<input type="checkbox">` — the ARIA switch role is the correct pattern here and the native checkbox styling fights our CSS.
- Do not animate via JS / Framer Motion / React Spring. CSS transitions only.
- Do not move the icon out of the button (keep it as a child of the `<button>`).
- Do not drop `preventDefault` on Space — it causes unwanted page scroll.
- Do not use `aria-pressed` — that's the Button (toggle-button) pattern; we use `aria-checked` for switch.

## No Prior Knowledge Test

- [ ] All tokens referenced exist in tokens.css (DR-6.1)
- [ ] `--ease-spring` == `cubic-bezier(0.47, 0, 0.23, 1.38)` per DISCOVERY DR11
- [ ] `--duration-medium` == `0.35s`
- [ ] ≥ 8 tests listed
- [ ] L1–L4 commands all runnable

## Git

- Branch: `task/DR-7-4-toggle-primitive`
- Commit prefix: `Task DR-7.4:`
- Trailer: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
