# Task DR-7.2: Build `Segmented` primitive with "/" separator + keyboard cycling

**Phase**: DR-7 — Primitives
**Branch**: `task/DR-7-2-segmented-primitive`
**Commit prefix**: `Task DR-7.2:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Build a typographic `<Segmented>` radio-group primitive that renders N options separated by "/" characters (no pill track), selects via click or keyboard (ArrowLeft / ArrowRight cycles with wrap-around), and styles selected items as `var(--color-text-primary)` + `font-weight: 600` against unselected `var(--color-text-muted)`.

**Deliverable**: `src/ui/primitives/Segmented.tsx` + `src/ui/primitives/Segmented.module.css` + `src/ui/primitives/Segmented.test.tsx` (≥ 10 unit tests covering 2/3/5-option variants, click, keyboard cycling, onChange).

**Success Definition**: `pnpm biome check src/ui/primitives/Segmented.* && pnpm tsc --noEmit && pnpm vitest run src/ui/primitives/Segmented.test.tsx` all exit 0; the component is consumable by DR-8.1 (toolbar cell-size picker) and DR-8.2 (sidebar param bindings).

---

## Context

The segmented control is the most distinctive pixelcrash micro-pattern — pure typography with a "/" separator between items, no background track. In our project this backs the XS/S/M/L/XL cell-size picker in the toolbar (binding `mosaic.tileSize`) and any param with an enumerated value set. Engine locked — this task only produces the primitive; DR-8 wires it to params.

## Dependencies

- **DR-6.1** (tokens.css) — `--color-text-primary`, `--color-text-muted`, `--space-04`, `--space-12`, `--space-16`, `--font-family`, `--duration-fast`, `--ease-default`, `--color-focus-ring`
- **DR-6.3** (body baseline) — body font is JetBrains Mono 500

## Blocked By

- DR-6.R (foundation regression) must be `done`.

## Research Findings

- **From `research/pixelcrash-design-language.md` § Components > 4. Segmented Controls (Radio Group)**: The component is a `<div class="segmented">` of `<label class="segmented-item">` wrappers; each label contains a native `<input type="radio">` + visible `<span>`. The "/" separator is rendered via `.segmented input::before { content: '/'; position: absolute; transform: translateX(-1.2rem); color: var(--color-grey-64); }` and the first child suppresses it with `.segmented-item:first-child input::before { content: none; }`. No `display: none` on the radio itself — it participates in layout so `::before` anchors correctly (but visual indicator is the `<span>` color change).
- **From `research/pixelcrash-design-language.md` § 4 > "There is no pill/track background"** — selected = `color: var(--color-text-primary); font-weight: 600;` only.
- **From `DISCOVERY.md` DR5**: unselected = `#8F8F8F` (= our `--color-text-muted`); selected = `#EAEAEA` (`--color-text-primary`).
- **From `DISCOVERY.md` DR9**: The 5-bucket XS/S/M/L/XL cell-size picker binds to `mosaic.tileSize` (values 4/8/16/32/64). This task does NOT wire the binding — we only ship the generic primitive.
- **Keyboard per web a11y convention (WAI-ARIA radiogroup pattern)**: ArrowLeft/ArrowRight cycle with wrap; selection changes immediately on key press.

## Implementation Plan

### Step 1: Minimal TypeScript signature

```typescript
// src/ui/primitives/Segmented.tsx
export type SegmentedOption<V extends string | number> = {
  value: V;
  label: string;
  testid?: string;
};

export type SegmentedProps<V extends string | number> = {
  options: ReadonlyArray<SegmentedOption<V>>;
  value: V;
  onChange: (next: V) => void;
  ariaLabel: string; // required for a11y — radiogroup name
  name?: string;     // optional <input name>
  testid?: string;   // default 'segmented'
  disabled?: boolean;
};

export function Segmented<V extends string | number>(props: SegmentedProps<V>): JSX.Element;
```

Consumer sites (to keep in mind, but NOT wired here):
- `<Segmented options={XS_TO_XL_OPTIONS} value={tileSize} onChange={(v) => paramStore.set('mosaic.tileSize', v)} ariaLabel="Cell size" />`
- Boolean-style 2-option: `Below / Above` mapped to `0 / 1` or `false / true`.

### Step 2: JSX structure (required)

```tsx
<div
  role="radiogroup"
  aria-label={ariaLabel}
  className={styles.root}
  data-testid={testid ?? 'segmented'}
  onKeyDown={handleKeyDown}
>
  {options.map((opt, i) => {
    const id = `${reactId}-${i}`;
    const checked = opt.value === value;
    return (
      <label key={String(opt.value)} className={styles.item}>
        <input
          type="radio"
          id={id}
          name={name ?? reactId}
          value={String(opt.value)}
          checked={checked}
          onChange={() => onChange(opt.value)}
          className={styles.input}
          tabIndex={checked ? 0 : -1}
          data-testid={opt.testid ?? `segmented-option-${String(opt.value)}`}
          disabled={disabled}
        />
        <span className={styles.label}>{opt.label}</span>
      </label>
    );
  })}
</div>
```

Key points:
- `useId()` provides the base id so tests remain stable under StrictMode double-render.
- Roving tabindex: only the selected radio has `tabIndex={0}`. Others `-1`.
- Focus stays on the selected input after keyboard cycling (move focus imperatively in `handleKeyDown`).

### Step 3: CSS — the "/" separator pattern (copy verbatim)

```css
/* src/ui/primitives/Segmented.module.css */
.root {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-16);
}

.item {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

/* Visually hide the radio input but keep it in layout so ::before can anchor.
   Pixelcrash does the same — the input has no visible indicator. */
.input {
  appearance: none;
  -webkit-appearance: none;
  width: 0;
  height: 0;
  margin: 0;
  padding: 0;
  border: 0;
  outline: 0;
  position: relative;
}

.label {
  color: var(--color-text-muted);
  padding: 0 var(--space-04);
  transition: color var(--duration-fast) var(--ease-default);
  font-family: var(--font-family);
  font-weight: 500;
  letter-spacing: -0.01em;
  user-select: none;
}

.item:hover .label {
  color: var(--color-text-primary);
}

.item:has(.input:checked) .label {
  color: var(--color-text-primary);
  font-weight: 600;
}

/* "/" separator rendered before every input except the first item's input.
   Position:absolute against the parent .item (which is position:relative).
   translateX pulls it left into the gap. */
.input::before {
  content: '/';
  position: absolute;
  left: calc(-1 * var(--space-12));
  color: var(--color-text-muted);
  pointer-events: none;
}

.item:first-child .input::before {
  content: none;
}

/* Focus ring: show when keyboard-focused on the input */
.input:focus-visible + .label {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

/* Disabled */
.root[data-disabled='true'] .label {
  opacity: 0.4;
  cursor: default;
}
```

### Step 4: Keyboard handler

```tsx
function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
  if (disabled) return;
  const idx = options.findIndex((o) => o.value === value);
  if (idx < 0) return;
  let nextIdx = idx;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    nextIdx = (idx - 1 + options.length) % options.length;
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    nextIdx = (idx + 1) % options.length;
  } else if (e.key === 'Home') {
    nextIdx = 0;
  } else if (e.key === 'End') {
    nextIdx = options.length - 1;
  } else {
    return;
  }
  e.preventDefault();
  const nextOption = options[nextIdx];
  if (nextOption !== undefined) {
    onChange(nextOption.value);
  }
}
```

Note: `noUncheckedIndexedAccess` is on — you MUST guard `options[nextIdx]`.

### Step 5: Unit tests (≥ 10)

File: `src/ui/primitives/Segmented.test.tsx`. Use `@testing-library/react` + `userEvent` (already installed via testing-library). Cover:

1. Renders 2-option variant (Below / Above)
2. Renders 3-option variant (Below / Between / Above)
3. Renders 5-option variant (XS / S / M / L / XL)
4. Click fires onChange with the clicked option's value
5. ArrowRight cycles to the next option and fires onChange
6. ArrowLeft cycles to the prev option (with wrap-around from first → last)
7. ArrowRight from last option wraps to first
8. Home key jumps to first option; End key jumps to last
9. Selected option carries `data-testid="segmented-option-<value>"` and sibling label has font-weight 600 via computed style OR the selected `<input>` has `checked=true`
10. `disabled` prop blocks onChange (click + key press both no-op)
11. (bonus) `ariaLabel` propagates to the role=radiogroup wrapper
12. (bonus) "/" separator is rendered by CSS — tests assert `getComputedStyle(input, '::before').content === '"/"'` or the DOM has N inputs (implementation verification)

## Files to Create

- `src/ui/primitives/Segmented.tsx`
- `src/ui/primitives/Segmented.module.css`
- `src/ui/primitives/Segmented.test.tsx`

## Files to Modify

- None.

## Contracts

### Provides

- `Segmented`, `SegmentedOption<V>`, `SegmentedProps<V>` from `src/ui/primitives/Segmented.tsx`. Generic over `V extends string | number` so numeric enums (tileSize) and string enums both work.
- Testid convention: wrapper = `segmented` (or consumer-overridable); each option = `segmented-option-${value}`.

### Consumes

- Tokens from DR-6.1; font from DR-6.2; body baseline from DR-6.3.

## Acceptance Criteria

- [ ] 2 / 3 / 5-option rendering verified visually in Task DR-7.R showcase
- [ ] "/" separator visible between items, NOT before first item
- [ ] ArrowLeft / ArrowRight cycles with wrap-around; Home / End jump to ends
- [ ] Selected state: `color: var(--color-text-primary)` + `font-weight: 600`
- [ ] `role="radiogroup"` + `aria-label` set
- [ ] Roving tabindex (selected = 0, others = -1)
- [ ] `disabled` prop blocks all interaction
- [ ] ≥ 10 passing unit tests

## Testing Protocol

### L1

```bash
pnpm biome check src/ui/primitives/Segmented.tsx src/ui/primitives/Segmented.module.css src/ui/primitives/Segmented.test.tsx
pnpm tsc --noEmit
```

### L2

```bash
pnpm vitest run src/ui/primitives/Segmented.test.tsx
```

Pattern (keyboard test):
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('cycles right with ArrowRight', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <Segmented
      options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]}
      value="a"
      onChange={onChange}
      ariaLabel="test"
    />,
  );
  screen.getByRole('radio', { name: /a/i }).focus();
  await user.keyboard('{ArrowRight}');
  expect(onChange).toHaveBeenCalledWith('b');
});
```

### L3

```bash
pnpm build
```

### L4

No new L4 spec in this task — deferred to DR-7.R showcase spec. If you write one, the describe block must begin `describe('Task DR-7.2: …', …)`.

```bash
pnpm test:e2e --grep "Task DR-7.2:"
```

Must exit 0 (either "no tests found" or the DR-7.R showcase spec exists and passes).

## Skills to Read

- `.claude/skills/custom-param-components/SKILL.md`
- `.claude/skills/design-tokens-dark-palette/SKILL.md`
- `.claude/skills/vitest-unit-testing-patterns/SKILL.md` — § 4.5 for React + userEvent patterns
- `.claude/skills/prp-task-ralph-loop/SKILL.md`
- `.claude/skills/hand-tracker-fx-architecture/SKILL.md`

## Research Files to Read

- `.claude/orchestration-design-rework/research/pixelcrash-design-language.md` — § "Components" > 4. Segmented Controls (mandatory — the "/" separator `::before` pattern is authoritative there)
- `.claude/orchestration-design-rework/research/current-ui-audit.md`

## Known Gotchas

```typescript
// CRITICAL: The "/" separator is rendered via input::before — NOT a <span>
// between items, NOT a flex gap with background-image. This preserves
// the pixelcrash pattern and the `.item:first-child input::before { content: none; }`
// rule cleanly excludes the first.

// CRITICAL: Use `appearance: none` on the radio input to remove native chrome;
// do NOT `display: none` — the input must participate in layout so the
// pseudo-element positions correctly.

// CRITICAL: noUncheckedIndexedAccess is ON (tsconfig). Array access like
// `options[nextIdx]` returns `T | undefined`. Guard with an `if (nextOption !== undefined)`
// BEFORE calling onChange.

// CRITICAL: userEvent's v14 API is async — always `await user.click(...)` and
// `await user.keyboard(...)`. Forgetting `await` produces false-green tests.

// CRITICAL: Use `useId()` (React 19 stable) to generate name/id pairs,
// NOT Math.random() or a mutable module-level counter (both break StrictMode
// double-invocation).

// CRITICAL: When the keyboard cycles, move focus imperatively to the newly
// selected input (via ref map) so the roving tabindex stays aligned with
// the user's focus. Tests assert this via document.activeElement.
```

## Anti-Patterns

- Do not render "/" as a static `<span>` between items. Use the `::before` CSS per research.
- Do not add a background track (`background-color` on `.root`). Pixelcrash is typography-only.
- Do not emit `onChange` on every focus move — only on actual selection change (Arrow keys DO change selection per WAI-ARIA, so that case is correct).
- Do not assume `options` is non-empty — render nothing and call no onChange if empty.

## No Prior Knowledge Test

- [ ] Token names referenced exist in `tokens.css` (DR-6.1)
- [ ] `useId` imported from `react` (React 19 stable)
- [ ] The `::before` separator recipe compiles under Biome CSS parsing
- [ ] ≥ 10 tests listed in test file

## Git

- Branch: `task/DR-7-2-segmented-primitive`
- Commit prefix: `Task DR-7.2:`
- Trailer: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
