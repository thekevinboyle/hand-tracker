# Task DR-8.1: Toolbar + CellSizePicker

**Phase**: DR-8 — Chrome Integration
**Branch**: `task/DR-8-1-toolbar-cellsize-picker`
**Commit prefix**: `Task DR-8.1:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Build the top-of-viewport `Toolbar` that replaces today's fixed-position `RecordButton` + absent wordmark. Three-column layout: wordmark (left) + `CellSizePicker` (center) + record button (right, restyled). Cell picker is a 5-option segmented control bound to `mosaic.tileSize` via `useParam`.

**Deliverable**:
- `src/ui/Toolbar.tsx` + `Toolbar.module.css` — flex-row container, tokens-driven
- `src/ui/CellSizePicker.tsx` — thin wrapper around `primitives/Segmented` mapping `XS/S/M/L/XL → 4/8/16/32/64`
- `src/ui/Toolbar.test.tsx` — unit coverage for rendering, testids, and integration with `paramStore`
- `tests/e2e/task-DR-8-1.spec.ts` — Playwright L4

**Success Definition**: Toolbar renders exactly ONE flex row with `data-testid="toolbar"`. Clicking each of the 5 `CellSizePicker` buckets calls `paramStore.set('mosaic.tileSize', 4|8|16|32|64)`. Existing `record-button` / `record-elapsed` testids preserved via restyled `RecordButton`. No Tweakpane regressions — DR-8.1 leaves the existing Panel mounted.

---

## User Persona

**Target User**: Creative technologist switching between demo setups — wants one-click pixel-size changes + instant recording without hunting the sidebar.

**Use Case**: Live demo → user clicks `L` in the toolbar picker → mosaic tiles visibly shrink → user clicks record → viewport captures at new tile size.

**User Journey**:
1. App is in `GRANTED` camera state.
2. User looks at the top of the viewport — sees wordmark "Hand Tracker FX" left, five buckets "XS / S / M / L / XL" center, a record button right.
3. User clicks "XL". `paramStore.mosaic.tileSize` flips to 64; mosaic re-tiles larger.
4. User clicks record. Button turns red; `record-elapsed` counts up.
5. Stage visible-area shrinks by toolbar height; overlay canvas respects the new viewport height.

**Pain Points Addressed**: No more floating z-index wars between the fixed-top-left preset actions, fixed-top-right record button, and fixed-bottom-center preset bar.

---

## Why

- DR6 — single LAYER 1 card means the toolbar is not cluttered with effect-switch UI.
- DR9 — cell-size picker binds to `mosaic.tileSize` with 5 buckets (4, 8, 16, 32, 64).
- DR10 — no "Colors | Video" tabs, no "Upload" button; toolbar is wordmark + picker + record only.
- DR15 — record button moves into the toolbar row (top-right), removes floating-button clutter.
- DR13 — wordmark is "Hand Tracker FX" in JetBrains Mono 600 ~22px + flat monochrome glyph mark.
- Depends on DR-6.1 / DR-6.2 / DR-6.3 tokens + font. Depends on DR-7.1 (`Button`) + DR-7.2 (`Segmented`) + DR-7.7 (`useParam`).
- Unblocks DR-8.6 (App.tsx wiring retires floating RecordButton position).

---

## What

- Toolbar is rendered as `<header data-testid="toolbar">` at the top of the App.
- Height: `var(--space-44)` (`4.4rem`), matching pixelcrash header. Padding: `0 var(--space-24)`.
- Background: `var(--color-bg)` (matches page; no color step — the toolbar blends with the page and separates from the stage only via the spatial gap).
- Three flex children:
  - `.toolbar-leading` — flex-shrink:0. Contains `.toolbar-mark` (monochrome 20×20 glyph, `background: var(--color-text-primary)`, `border-radius:0`) + `.toolbar-wordmark` span (font-weight 600, `var(--font-size-xl)` ~22px) — gap `var(--space-08)`.
  - `.toolbar-center` — flex:1, centered. Contains `<CellSizePicker />`.
  - `.toolbar-trailing` — flex-shrink:0. Contains restyled `<RecordButton />`.
- `CellSizePicker` is a thin wrapper: `<Segmented options={[{value:4,label:'XS'}, {value:8,label:'S'}, {value:16,label:'M'}, {value:32,label:'L'}, {value:64,label:'XL'}]} value={tileSize} onChange={setTileSize} />` where `tileSize` comes from `useParam('mosaic.tileSize')` (type inferred as `number` from `ParamValue<'mosaic.tileSize'>`). Wraps in `<div data-testid="toolbar-cell-picker">`.
- `RecordButton` restyle: existing component stays `src/ui/RecordButton.tsx` — DR-8.1 removes its fixed positioning (use `position: static` or just unstyled container), applies `Button variant="primary" size="md"` when idle and keeps the inline red state + `record-elapsed` display when recording. Testids `record-button` and `record-elapsed` preserved.

### NOT Building (scope boundary)

- No source-toggle tabs ("Colors | Video" dropped, DR10).
- No Upload button (DR10).
- No "Show source" (DR10).
- No preset strip in toolbar — that lives in the sidebar header (DR16, DR-8.5).
- No responsive / mobile layout (< 768px unsupported, DISCOVERY §8.5).
- No Tweakpane mount retirement — that ships in DR-8.6.
- The sidebar itself is DR-8.2's responsibility.

### Success Criteria

- [ ] `pnpm biome check src/ui/Toolbar.tsx src/ui/Toolbar.module.css src/ui/CellSizePicker.tsx src/ui/Toolbar.test.tsx` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] Unit tests green: Toolbar renders all 3 testids; CellSizePicker updates `paramStore` on click; each of 5 buckets resolves to the correct numeric tileSize
- [ ] L4: `pnpm test:e2e --grep "Task DR-8.1:"` green
- [ ] Existing 45 prior E2E specs still pass (DR-8.1 is additive — `RecordButton` testids unchanged, Panel still mounted)

---

## All Needed Context

```yaml
files:
  - path: src/effects/handTrackingMosaic/manifest.ts
    why: Defines `mosaic.tileSize` paramDef — min 4, max 64, step 1, default 16
    gotcha: The picker buckets (4/8/16/32/64) map onto valid manifest values — do NOT clamp further; just pass the raw value

  - path: src/engine/paramStore.ts
    why: `paramStore.set('mosaic.tileSize', value)` is the only write-path
    gotcha: Setting a value that equals the current snapshot's value should be a no-op — paramStore.set is structural-sharing aware

  - path: src/ui/RecordButton.tsx
    why: Existing component stays; DR-8.1 removes its fixed positioning, wraps its visual as a Button primitive
    gotcha: Must preserve `record-button` + `record-elapsed` testids; recording state still styles red

  - path: src/ui/primitives/Segmented.tsx
    why: Built in DR-7.2 — ships the typographic segmented control w/ "/" separators + ArrowLeft/Right cycle
    gotcha: Options must be typed generically; CellSizePicker's `value` is `number`

  - path: src/ui/primitives/useParam.ts
    why: Built in DR-7.7 — returns `[value, setValue]` tuple for any paramStore key
    gotcha: Call `useParam('mosaic.tileSize')` WITHOUT an explicit generic — the signature is `useParam<K extends ParamKey>(key: K)` and the value type is inferred from `ParamValue<K>`. Passing `<number>` would be passing the value-type where a key-type is expected and fails to compile.

  - path: src/ui/tokens.css
    why: Design tokens for color, spacing, font-family, font-size, radius, duration. Every style value must reference a --var
    gotcha: DO NOT hardcode hex or px values. Exception: 0 and 100%.

  - path: public/favicon.svg
    why: The existing brand mark (gradient #863bff / #47bfff). DR13 says the wordmark pairs with a FLAT monochrome logomark (not the gradient). Render the flat mark inline via `<span class="toolbar-mark" />` as a CSS-colored block, NOT as an inline SVG copy of favicon.
    gotcha: 20×20 px square, 0 border-radius, background=`var(--color-text-primary)` — same-shape-as-pixelcrash, our own color

urls:
  - url: https://react.dev/reference/react/forwardRef
    why: Toolbar may need to forward a ref to a DOM element for focus handoff later; optional
    critical: N/A in DR-8.1 — Toolbar is a simple functional component

skills:
  - custom-param-components
  - hand-tracker-fx-architecture
  - prp-task-ralph-loop
  - playwright-e2e-webcam
  - vitest-unit-testing-patterns
  - design-tokens-dark-palette

discovery:
  - DR9: Cell-size picker binds to `mosaic.tileSize` with 5 buckets (4/8/16/32/64)
  - DR10: Drop "Colors | Video" tab + Upload button + Show source — toolbar is [wordmark] [Cells] [Record] only
  - DR13: Wordmark "Hand Tracker FX" in JetBrains Mono 600 ~22px + flat glyph mark
  - DR15: Record button lives inline in toolbar top-right
```

### Testids to Preserve (existing)

- `record-button`, `record-elapsed` — keep intact on the restyled RecordButton component (still at `src/ui/RecordButton.tsx`).

### Testids to ADD (new — DR §7)

- `toolbar` — on the root `<header>`
- `toolbar-wordmark` — on the span containing "Hand Tracker FX"
- `toolbar-cell-picker` — on the wrapping div around the Segmented control

### Current Codebase Tree (relevant)

```
src/
  ui/
    RecordButton.tsx
    primitives/
      Segmented.tsx        # DR-7.2
      Button.tsx           # DR-7.1
      useParam.ts          # DR-7.7
    tokens.css             # DR-6.1
  effects/handTrackingMosaic/
    manifest.ts
```

### Desired Codebase Tree

```
src/
  ui/
    Toolbar.tsx              # CREATE
    Toolbar.module.css       # CREATE — or Toolbar.css if keeping plain imports
    CellSizePicker.tsx       # CREATE
    Toolbar.test.tsx         # CREATE
    RecordButton.tsx         # MODIFY — strip fixed positioning, style via Button primitive
tests/
  e2e/
    task-DR-8-1.spec.ts      # CREATE
```

### Known Gotchas

```typescript
// CRITICAL: The Toolbar is rendered at the TOP of the app but we are NOT retiring
// the old fixed-position RecordButton in this task — DR-8.6 owns that wiring change.
// During DR-8.1, RecordButton's fixed positioning can be removed here; App.tsx still
// renders the old Panel below. Coordinate by having App.tsx render <Toolbar /> above
// <Stage />, and the old floating PresetBar/PresetActions stay visible. Test the
// DR-8.1 E2E against the new toolbar DOM — it does NOT conflict with Panel.

// CRITICAL: RecordButton currently owns `useRecorder` and its own inline styles
// (position: fixed, top: 50, right: 12). DR-8.1 moves it into the flex flow: remove
// the `position: fixed / top / right / zIndex` inline styles, keep the useRecorder
// integration + record/stop/elapsed state. The red-recording visual state keeps
// rendering inline.

// CRITICAL: CellSizePicker must bind `mosaic.tileSize` by calling useParam — do NOT
// re-read the value on every keystroke via paramStore.snapshot. Subscription via
// useParam ensures re-render when another source (modulation route, preset load,
// or the future sidebar tile-size slider) updates the same key. The sidebar's
// tile-size slider (DR-8.2) will subscribe to the same key.

// CRITICAL: When `mosaic.tileSize` is a "between-bucket" value (e.g. 12, from a
// modulation route), Segmented should treat the value as "none selected" visually —
// no bucket is bold. Implement by checking `options.some(o => o.value === value)`
// inside CellSizePicker and passing `value={undefined}` to Segmented if no match.

// CRITICAL: Biome v2 defaults — pnpm, no 'use client'. React 19 strict. All styles
// via CSS Modules or plain CSS + tokens — never inline `style={{ ... }}` hex values.

// CRITICAL: The toolbar height consumes vertical space. Stage.tsx's full-viewport
// fixed layout must still fill below the toolbar; for DR-8.1 this is handled
// implicitly because Stage is `position: fixed; inset: 0` — toolbar overlays the
// top. This is fine visually because the canvas background is #000 and the
// toolbar has `var(--color-bg)` background. Accept this overlap in DR-8.1; DR-8.6
// introduces flex layout that resolves it cleanly.
```

---

## Implementation Blueprint

### Step 1: Create `Toolbar.tsx`

```typescript
import type { JSX } from 'react';
import { RecordButton } from './RecordButton';
import { CellSizePicker } from './CellSizePicker';
import styles from './Toolbar.module.css';

export type ToolbarProps = {
  getCanvas: () => HTMLCanvasElement | null;
};

export function Toolbar({ getCanvas }: ToolbarProps): JSX.Element {
  return (
    <header className={styles.toolbar} data-testid="toolbar">
      <div className={styles.leading}>
        <span className={styles.mark} aria-hidden="true" />
        <span className={styles.wordmark} data-testid="toolbar-wordmark">
          Hand Tracker FX
        </span>
      </div>
      <div className={styles.center}>
        <CellSizePicker />
      </div>
      <div className={styles.trailing}>
        <RecordButton getCanvas={getCanvas} />
      </div>
    </header>
  );
}
```

### Step 2: Create `Toolbar.module.css`

```css
.toolbar {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: var(--space-44);
  padding: 0 var(--space-24);
  gap: var(--space-32);
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-family: var(--font-family);
}
.leading { display: flex; align-items: center; gap: var(--space-08); flex: 0 0 auto; }
.mark { width: 2rem; height: 2rem; background: var(--color-text-primary); border-radius: 0; }
.wordmark { font-size: var(--font-size-xl); font-weight: 600; letter-spacing: -0.01em; }
.center { flex: 1 1 0; display: flex; justify-content: center; }
.trailing { flex: 0 0 auto; }
```

### Step 3: Create `CellSizePicker.tsx`

```typescript
import type { JSX } from 'react';
import { Segmented } from './primitives/Segmented';
import { useParam } from './primitives/useParam';

const BUCKETS = [
  { value: 4, label: 'XS' },
  { value: 8, label: 'S' },
  { value: 16, label: 'M' },
  { value: 32, label: 'L' },
  { value: 64, label: 'XL' },
] as const;

export function CellSizePicker(): JSX.Element {
  const [tileSize, setTileSize] = useParam('mosaic.tileSize');
  const active = BUCKETS.some((b) => b.value === tileSize) ? tileSize : undefined;
  return (
    <div data-testid="toolbar-cell-picker">
      <Segmented
        options={BUCKETS as unknown as Array<{ value: number; label: string }>}
        value={active}
        onChange={(v) => setTileSize(v)}
        ariaLabel="Cell size"
      />
    </div>
  );
}
```

### Step 4: Restyle `RecordButton.tsx`

- Remove `position: fixed`, `top`, `right`, `zIndex` from the outer wrapper.
- Keep the `useRecorder` + `record-button` + `record-elapsed` DOM.
- Use `Button` primitive (`variant="primary" size="md"`) for the main button visual; pass through the recording-state background switch as an extra `data-recording` attribute that CSS hooks (`.recording` background `var(--color-accent)`).
- Preserve the error fallback sibling.

### Step 5: Unit tests `Toolbar.test.tsx`

- Renders toolbar with all 3 expected testids
- CellSizePicker: rendering with default `mosaic.tileSize=16` shows "M" selected (`font-weight:600` on "M")
- Clicking "XL" → `paramStore.snapshot.mosaic.tileSize === 64`
- Non-bucket tileSize (e.g. via `paramStore.set('mosaic.tileSize', 12)`) → no bucket shows selected state
- Record button renders as child; test does not re-verify recording (that's covered by existing suites)

Use `@testing-library/react` + `fireEvent` + an isolated paramStore spy via `vi.spyOn(paramStore, 'set')`.

### Step 6: E2E test `tests/e2e/task-DR-8-1.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Task DR-8.1: toolbar cell-picker updates tileSize', () => {
  test('renders toolbar chrome in GRANTED state', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="camera-state"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="camera-state"]')?.textContent === 'GRANTED',
    );
    await expect(page.getByTestId('toolbar')).toBeVisible();
    await expect(page.getByTestId('toolbar-wordmark')).toHaveText('Hand Tracker FX');
    await expect(page.getByTestId('toolbar-cell-picker')).toBeVisible();
    await expect(page.getByTestId('record-button')).toBeVisible();
  });

  test('clicking each bucket updates mosaic.tileSize via paramStore', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="camera-state"]')?.textContent === 'GRANTED',
    );
    const buckets = [['XL', 64], ['L', 32], ['M', 16], ['S', 8], ['XS', 4]] as const;
    for (const [label, value] of buckets) {
      await page.getByTestId('toolbar-cell-picker').getByText(label, { exact: true }).click();
      const v = await page.evaluate(() => (window as any).__handTracker?.__engine?.getParam('mosaic.tileSize'));
      expect(v).toBe(value);
    }
  });
});
```

---

## Validation Loop

### Level 1 — Syntax & Style

```bash
pnpm biome check src/ui/Toolbar.tsx src/ui/Toolbar.module.css src/ui/CellSizePicker.tsx src/ui/Toolbar.test.tsx src/ui/RecordButton.tsx
pnpm tsc --noEmit
```

### Level 2 — Unit

```bash
pnpm vitest run src/ui/Toolbar.test.tsx
pnpm vitest run
```

### Level 3 — Integration

```bash
pnpm build
```

### Level 4 — E2E

```bash
pnpm test:setup
pnpm test:e2e --grep "Task DR-8.1:"
# Sanity — existing suites unchanged
pnpm test:e2e --grep "phase-4-regression"
```

---

## Final Validation Checklist

### Technical
- [ ] All 4 levels exit 0
- [ ] `grep -E '#[0-9a-fA-F]{3,6}' src/ui/Toolbar.* src/ui/CellSizePicker.tsx` returns zero hits
- [ ] `grep -E 'px\b' src/ui/Toolbar.module.css` returns zero hits

### Feature
- [ ] All 5 cell-size buckets update `paramStore.mosaic.tileSize`
- [ ] Toolbar renders wordmark + picker + record button in a single flex row
- [ ] Non-bucket tileSize values leave Segmented visually unselected
- [ ] RecordButton is no longer fixed-positioned
- [ ] Existing 45 E2E specs still pass

### Code Quality
- [ ] No inline style `{{ background: '#...' }}` in Toolbar or CellSizePicker
- [ ] All colors/spacing via `var(--token-name)`
- [ ] No `any` type

---

## Anti-Patterns

- Do not read from `paramStore.snapshot` directly in render; always use `useParam`.
- Do not hardcode `#EAEAEA`, `20px`, or any literal value — use tokens.
- Do not delete RecordButton — only strip its fixed-positioning and wrap its visuals via the Button primitive.
- Do not add z-index gymnastics; the toolbar's flex flow + sidebar/stage separation solves the old floating layers.
- Do not re-implement `useRecorder` logic in Toolbar — keep RecordButton as the owner.

---

## No Prior Knowledge Test

- [ ] Every cited file exists (RecordButton.tsx, useParam.ts, Segmented.tsx, paramStore.ts, manifest.ts)
- [ ] DR-numbers cited exist (DR6, DR9, DR10, DR13, DR15)
- [ ] Validation commands copy-paste runnable
- [ ] Test file enumerates bucket values + wordmark + record-button checks

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/custom-param-components/SKILL.md
.claude/skills/design-tokens-dark-palette/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
