# Task DR-7.5: Build `ColorPicker` primitive (swatch + hex text input)

**Phase**: DR-7 — Primitives
**Branch**: `task/DR-7-5-color-picker-primitive`
**Commit prefix**: `Task DR-7.5:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Build a `<ColorPicker>` primitive that pairs a 20×20 square native `<input type="color">` swatch with a borderless uppercase-transformed text input. Both edit the same controlled hex value; typing an invalid hex keeps the previous valid color (no rejection UI — just ignore); committing via Enter or blur normalizes the text. Native color popup opens on swatch click.

**Deliverable**:
- `src/ui/primitives/ColorPicker.tsx`
- `src/ui/primitives/ColorPicker.module.css`
- `src/ui/primitives/ColorPicker.test.tsx` (≥ 8 tests)

**Success Definition**: `pnpm biome check src/ui/primitives/ColorPicker.* && pnpm tsc --noEmit && pnpm vitest run src/ui/primitives/ColorPicker.test.tsx` all exit 0; typing `"#12GGGG"` into the text input and blurring leaves the previous valid hex intact; typing `"#abcdef"` and blurring uppercases to `"#ABCDEF"` and fires `onChange('#abcdef')`.

---

## Context

The ColorPicker backs `grid.lineColor` (manifest default `#00ff88`) — currently edited via Tweakpane's built-in color input. In DR-8.2 this primitive appears inside LAYER 1 / Grid section. Invalid-hex-keeps-prior is the pixelcrash pattern (silent rejection — no red outline, no error message).

## Dependencies

- **DR-6.1** tokens: `--color-text-primary`, `--color-text-muted`, `--color-focus-ring`, `--space-04`, `--space-08`, `--space-20`, `--space-56`, `--duration-fast`, `--ease-default`, `--font-family`.

## Blocked By

- DR-6.R

## Research Findings

- **From `research/pixelcrash-design-language.md` § Components > 8. Color Picker Group**:
  ```
  .color-picker-group { width: 9.2rem; display: flex; flex-direction: row;
                        align-items: center; justify-content: flex-end; gap: 0.8rem; }
  .color-picker-input { width: 5.6rem; height: 2.0rem; background: transparent;
                        text-transform: uppercase; cursor: text; }
  input.color-picker { width: 2.0rem; height: 2.0rem; border: none;
                       border-radius: 0; cursor: pointer; }
  input.color-picker::-webkit-color-swatch { border: none; border-radius: 0; padding: 0; }
  ```
- Hex validation: `/^#[0-9a-fA-F]{6}$/` (6 digits only — 3-digit shorthand is rare and rejected for consistency with manifest values like `#00ff88`).
- Browser `<input type="color">` only accepts 6-digit hex; it normalizes `#fff` input silently to `#ffffff`.
- Text input hover pattern: `.symb-text-field:hover { text-decoration: underline; }` — apply same to our text input for consistency.

## Implementation Plan

### Step 1: Minimal TypeScript signature

```typescript
// src/ui/primitives/ColorPicker.tsx

export type ColorPickerProps = {
  value: string;                           // must be valid 6-digit hex, e.g. '#00ff88'
  onChange: (next: string) => void;        // only fired with valid hex
  ariaLabel: string;
  disabled?: boolean;
  testid?: string;                         // default 'color-picker'
};

export function ColorPicker(props: ColorPickerProps): JSX.Element;

/** Exported for testability. Returns `input` normalized (lowercase, with leading #)
 *  when valid 6-digit hex; returns null when invalid. */
export function normalizeHex(input: string): string | null;
```

### Step 2: State + behavior

Two inputs, one source of truth. The text input holds a DRAFT value (local state) while the user types; on Enter or blur we validate and either commit (call `onChange`) or revert the draft to the incoming `value`. The color swatch always reflects the committed `value`.

```tsx
import { useEffect, useState } from 'react';

export function normalizeHex(input: string): string | null {
  const trimmed = input.trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(withHash)) return null;
  return withHash.toLowerCase();
}

export function ColorPicker({ value, onChange, ariaLabel, disabled, testid }: ColorPickerProps): JSX.Element {
  const [draft, setDraft] = useState(value.toUpperCase());

  // Resync draft when upstream value changes (e.g. preset load).
  useEffect(() => {
    setDraft(value.toUpperCase());
  }, [value]);

  const commit = (): void => {
    const normalized = normalizeHex(draft);
    if (normalized === null) {
      // Silent reject — revert to current valid value.
      setDraft(value.toUpperCase());
      return;
    }
    if (normalized !== value) {
      onChange(normalized);
    }
    setDraft(normalized.toUpperCase());
  };

  return (
    <div className={styles.root} data-testid={testid ?? 'color-picker'}>
      <input
        type="text"
        className={styles.text}
        value={draft}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        disabled={disabled}
        aria-label={`${ariaLabel} hex`}
        spellCheck={false}
        autoComplete="off"
        maxLength={7}
        data-testid={`${testid ?? 'color-picker'}-text`}
      />
      <input
        type="color"
        className={styles.swatch}
        value={value.toLowerCase()}
        onChange={(e) => {
          // Native color input always returns a valid 7-char hex.
          const next = e.currentTarget.value.toLowerCase();
          onChange(next);
          setDraft(next.toUpperCase());
        }}
        disabled={disabled}
        aria-label={ariaLabel}
        data-testid={`${testid ?? 'color-picker'}-swatch`}
      />
    </div>
  );
}
```

### Step 3: CSS recipe

```css
/* src/ui/primitives/ColorPicker.module.css */
.root {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-08);
}

.text {
  width: var(--space-56);   /* 56px text input */
  height: var(--space-20);
  padding: 0 var(--space-04);
  background-color: transparent;
  border: 0;
  outline: 0;
  color: var(--color-text-primary);
  font: inherit;
  font-family: var(--font-family);
  letter-spacing: -0.01em;
  text-transform: uppercase;
  cursor: text;
  transition: text-decoration-color var(--duration-fast) var(--ease-default);
}

.text:hover {
  text-decoration: underline;
  text-decoration-color: var(--color-text-muted);
}

.text:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.swatch {
  width: var(--space-20);
  height: var(--space-20);
  padding: 0;
  border: 0;
  border-radius: 0;
  background-color: transparent;
  cursor: pointer;
}

.swatch::-webkit-color-swatch {
  border: 0;
  border-radius: 0;
  padding: 0;
}

.swatch::-moz-color-swatch {
  border: 0;
  border-radius: 0;
  padding: 0;
}

.swatch:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.root:has(:disabled) {
  opacity: 0.4;
  pointer-events: none;
}
```

### Step 4: Unit tests (≥ 8)

File: `src/ui/primitives/ColorPicker.test.tsx`. Must cover:

1. Renders with initial `value` (swatch has lowercase hex; text input shows uppercase)
2. Typing into text input updates local draft but does NOT fire onChange yet
3. Pressing Enter on valid hex fires `onChange` with normalized lowercase hex
4. Blurring on valid hex fires `onChange` with lowercase
5. Blurring on INVALID hex reverts draft to previous `value` and does NOT fire onChange
6. Native color input change fires onChange with the picked hex
7. `normalizeHex('#ABCDEF')` === `'#abcdef'`
8. `normalizeHex('abcdef')` === `'#abcdef'` (adds leading #)
9. `normalizeHex('#12GGGG')` === `null`
10. `normalizeHex('#abc')` === `null` (3-digit not accepted — manifest uses 6)
11. (bonus) `disabled` hides both inputs from interaction
12. (bonus) Resync: changing the `value` prop from outside updates the draft text

## Files to Create

- `src/ui/primitives/ColorPicker.tsx`
- `src/ui/primitives/ColorPicker.module.css`
- `src/ui/primitives/ColorPicker.test.tsx`

## Files to Modify

- None.

## Contracts

### Provides

- `ColorPicker`, `ColorPickerProps`, `normalizeHex` from `src/ui/primitives/ColorPicker.tsx`.
- Testids: `color-picker` / `color-picker-text` / `color-picker-swatch`.

### Consumes

- DR-6.1 tokens as listed.

## Acceptance Criteria

- [ ] Native `<input type="color">` + text input share the same controlled state
- [ ] Invalid hex in text input: silently reverts on blur, no `onChange` fired
- [ ] Valid hex on blur/Enter: fires `onChange` with lowercase normalized
- [ ] Text input shows UPPERCASE via `text-transform: uppercase` (and draft stored uppercase)
- [ ] Hover on text input: underlined
- [ ] Swatch is a 20×20 square (no border-radius, no border via `::-webkit-color-swatch`)
- [ ] ≥ 8 passing unit tests

## Testing Protocol

### L1

```bash
pnpm biome check src/ui/primitives/ColorPicker.tsx src/ui/primitives/ColorPicker.module.css src/ui/primitives/ColorPicker.test.tsx
pnpm tsc --noEmit
```

### L2

```bash
pnpm vitest run src/ui/primitives/ColorPicker.test.tsx
```

Pattern:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('reverts invalid hex on blur', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<ColorPicker value="#00ff88" onChange={onChange} ariaLabel="Line color" />);
  const text = screen.getByTestId('color-picker-text') as HTMLInputElement;
  await user.clear(text);
  await user.type(text, '#12GGGG');
  fireEvent.blur(text);
  expect(onChange).not.toHaveBeenCalled();
  expect(text.value).toBe('#00FF88');
});
```

### L3

```bash
pnpm build
```

### L4

```bash
pnpm test:e2e --grep "Task DR-7.5:"
```

Deferred to DR-7.R showcase. Must exit 0.

## Skills to Read

- `.claude/skills/custom-param-components/SKILL.md`
- `.claude/skills/design-tokens-dark-palette/SKILL.md`
- `.claude/skills/vitest-unit-testing-patterns/SKILL.md` — § 4.5 (component + userEvent)
- `.claude/skills/prp-task-ralph-loop/SKILL.md`
- `.claude/skills/hand-tracker-fx-architecture/SKILL.md`

## Research Files to Read

- `.claude/orchestration-design-rework/research/pixelcrash-design-language.md` — § Components > 8. Color Picker Group, § 9. Symbol Text Field (for hover-underline pattern)

## Known Gotchas

```typescript
// CRITICAL: <input type="color"> in browsers only emits 7-char lowercase hex.
// Do not attempt shorthand '#fff' — it won't round-trip.

// CRITICAL: Store the draft in UPPERCASE (display form). Fire onChange with
// lowercase (manifest form). Canonical serialized hex is lowercase per
// paramStore convention.

// CRITICAL: useEffect(() => setDraft(value.toUpperCase()), [value]) resyncs
// draft when the parent mutates value (preset load). Without this, preset
// loads don't update the visible text.

// CRITICAL: jsdom may not fire change events from <input type="color"> the
// same way Chrome does. Test via fireEvent.change(swatch, { target: { value: '#abc123' } })
// rather than userEvent, which clicks to open the native picker (unsupported
// in jsdom).

// CRITICAL: normalizeHex must reject '#abc' (3-char). Our manifest
// exclusively uses 6-char hex (e.g., '#00ff88').

// CRITICAL: The text input's onChange handler updates DRAFT only — do NOT
// call onChange prop here. Commit happens on blur / Enter only.
```

## Anti-Patterns

- Do not render a custom color picker UI (eye-dropper, HSL sliders, etc.) — the native `<input type="color">` is sufficient.
- Do not display a red error outline on invalid hex — silent reject per pixelcrash.
- Do not call `onChange` on every keystroke — parent state would thrash and preset saves would see partial values.
- Do not trim whitespace aggressively inside normalizeHex — only `trim()` around the whole string.
- Do not accept 3-char shorthand hex — manifest convention is 6-char.

## No Prior Knowledge Test

- [ ] Tokens exist in tokens.css
- [ ] `normalizeHex` is exported and independently testable
- [ ] ≥ 8 tests listed
- [ ] Validation commands copy-paste runnable

## Git

- Branch: `task/DR-7-5-color-picker-primitive`
- Commit prefix: `Task DR-7.5:`
- Trailer: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
