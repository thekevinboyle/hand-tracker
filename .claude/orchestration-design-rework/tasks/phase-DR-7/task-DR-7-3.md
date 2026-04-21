# Task DR-7.3: Build `Slider` and `RangeSlider` primitives with hairline track + thin-line thumb

**Phase**: DR-7 — Primitives
**Branch**: `task/DR-7-3-slider-primitive`
**Commit prefix**: `Task DR-7.3:`
**Estimated complexity**: High
**Max Ralph iterations**: 30

---

## Goal

**Feature Goal**: Build two related primitives in one file — `<Slider>` (single-thumb, 0..1 mapped to min..max) and `<RangeSlider>` (two-thumb, non-crossing) — both rendering a hairline track (`--space-02`) and a thin vertical line thumb (visually 2×16 px) with a 32×32 expanded invisible touch-area overlay. Keyboard stepping by manifest `step`; PageUp/PageDown by 10×. Pointer drag updates continuously. Zero noUiSlider dependency.

**Deliverable**:
- `src/ui/primitives/Slider.tsx` (exports `Slider`, `RangeSlider`)
- `src/ui/primitives/Slider.module.css`
- `src/ui/primitives/Slider.test.tsx` (≥ 15 tests: single + range + pointer + keyboard paths)

**Success Definition**: `pnpm biome check src/ui/primitives/Slider.* && pnpm tsc --noEmit && pnpm vitest run src/ui/primitives/Slider.test.tsx` all exit 0; a Slider at `value=max` renders the thumb at the right edge (fully inside the track bounds); keyboard ArrowRight on a slider with `step=1` fires onChange with value+1; PageUp fires with value+10.

---

## Context

Sliders back almost every numeric manifest param in DR-8: grid.seed, grid.columnCount, grid.rowCount, grid.widthVariance, grid.lineWeight, mosaic.tileSize, mosaic.blendOpacity, mosaic.edgeFeather, effect.regionPadding. A RangeSlider is used in the modulation card (Task DR-8.3) for input-range / output-range pairs. We don't ship noUiSlider — we write the primitive natively so the CSS is ours and the dep graph is minimal.

## Dependencies

- **DR-6.1** tokens: `--color-slider-track`, `--color-slider-handle`, `--color-slider-hover`, `--color-focus-ring`, `--space-02`, `--space-16`, `--space-32`, `--duration-fast`, `--ease-default`.

## Blocked By

- DR-6.R

## Research Findings

- **From `research/pixelcrash-design-language.md` § Components > 6. Range Slider**: Track = `height: 0.2rem` (`--space-02` = ~2px) in color `--color-grey-82` (our `--color-slider-track` = `#2A2A2A`). Filled range = black (`--color-slider-active` = `#EAEAEA` in our inverted palette). Thumb is `width: 0.2rem; height: 1.6rem; background: #050505; border: none; border-radius: 0;` — a THIN VERTICAL LINE, not a circle. Touch-area expands the interactive region to `3.2rem` wide.
- **Our mapping**: thumb visual = 2×16 px; touch-area = 32×32 px (spec from task title).
- **Hover**: `background: var(--color-slider-hover) !important;` (from research line 480).
- **For range**: two handles; prevent crossing by clamping lo ≤ hi - step on `lo`-drag and hi ≥ lo + step on `hi`-drag.
- **Keyboard** (WAI-ARIA slider pattern): ArrowLeft/ArrowDown = -step, ArrowRight/ArrowUp = +step, PageUp = +10×step, PageDown = -10×step, Home = min, End = max. All preventDefault.

## Implementation Plan

### Step 1: Minimal TypeScript signatures

```typescript
// src/ui/primitives/Slider.tsx

export type SliderProps = {
  min: number;
  max: number;
  step: number;       // manifest `step` — e.g. 1 for integer, 0.01 for number
  value: number;
  onChange: (next: number) => void;
  ariaLabel: string;
  disabled?: boolean;
  testid?: string;    // default 'slider'
};

export type RangeSliderProps = {
  min: number;
  max: number;
  step: number;
  value: readonly [number, number];
  onChange: (next: readonly [number, number]) => void;
  ariaLabel: string;
  disabled?: boolean;
  testid?: string;    // default 'range-slider'
};

export function Slider(props: SliderProps): JSX.Element;
export function RangeSlider(props: RangeSliderProps): JSX.Element;
```

### Step 2: Shared math helpers

```typescript
/** Map numeric value to 0..1 proportion along the track. */
function toProportion(v: number, min: number, max: number): number {
  if (max <= min) return 0;
  const p = (v - min) / (max - min);
  return Math.max(0, Math.min(1, p));
}

/** Map an 0..1 proportion to a stepped value in [min, max]. */
function fromProportion(p: number, min: number, max: number, step: number): number {
  const raw = min + (max - min) * Math.max(0, Math.min(1, p));
  const steps = Math.round((raw - min) / step);
  const stepped = min + steps * step;
  // Clamp + round-off float noise for step=0.01 etc.
  const precision = step < 1 ? Math.ceil(-Math.log10(step)) : 0;
  const clamped = Math.max(min, Math.min(max, stepped));
  return Number.parseFloat(clamped.toFixed(precision));
}
```

### Step 3: Visual thumb vs expanded touch-area

CSS approach: thumb is an absolutely-positioned `<div>` inside the track; an overlay `<div>` that sits directly on the thumb with transparent background and `width/height: var(--space-32)` owns the pointer events. Thumb itself is `pointer-events: none` — all interaction is routed through the overlay OR through a native `<input type="range">` that we hide visually but keep for screen readers.

**Chosen pattern** (simpler, a11y-clean): A native `<input type="range">` per thumb, positioned absolutely on top of the track with `opacity: 0` (keyboard + pointer work natively; no re-implementation needed). The visible thumb + track are separate decorative divs positioned via `left: <prop>%`.

```tsx
<div
  className={styles.root}
  data-testid={testid ?? 'slider'}
  data-disabled={disabled ? 'true' : undefined}
>
  <div className={styles.track} aria-hidden="true">
    <div
      className={styles.activeRange}
      style={{ left: '0%', width: `${proportion * 100}%` }}
    />
    <div
      className={styles.thumb}
      style={{ left: `calc(${proportion * 100}% - 1px)` }}
    />
  </div>
  <input
    ref={inputRef}
    type="range"
    min={min}
    max={max}
    step={step}
    value={value}
    aria-label={ariaLabel}
    className={styles.nativeInput}   /* overlay, opacity 0, 32px tall */
    onChange={(e) => onChange(Number(e.currentTarget.value))}
    onKeyDown={handleKeyDown}
    disabled={disabled}
    data-testid={`${testid ?? 'slider'}-input`}
  />
</div>
```

For `RangeSlider`, render TWO `<input type="range">` overlays, each constrained to [min, hi-step] or [lo+step, max] respectively so they can't cross. See Step 6.

### Step 4: CSS recipe (copy verbatim)

```css
/* src/ui/primitives/Slider.module.css */
.root {
  position: relative;
  width: 100%;
  height: var(--space-32); /* 32px expanded touch-area */
  display: flex;
  align-items: center;
}

.track {
  position: relative;
  width: 100%;
  height: var(--space-02); /* 2px hairline */
  background-color: var(--color-slider-track);
  border-radius: 0;
}

.activeRange {
  position: absolute;
  top: 0;
  height: 100%;
  background-color: var(--color-slider-active);
  transition: background-color var(--duration-fast) var(--ease-default);
}

.thumb {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: var(--space-16); /* 16px tall */
  background-color: var(--color-slider-handle);
  border-radius: 0;
  pointer-events: none;
  transition: background-color var(--duration-fast) var(--ease-default);
}

/* Hover anywhere on the root lightens track & thumb */
.root:hover .activeRange,
.root:hover .thumb {
  background-color: var(--color-slider-hover);
}

/* Native range input overlay — invisible, handles pointer + keyboard + a11y */
.nativeInput {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  margin: 0;
  padding: 0;
  cursor: pointer;
}

.nativeInput:focus-visible + .track .thumb,
.nativeInput:focus-visible ~ .track .thumb {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.root[data-disabled='true'] {
  opacity: 0.4;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .activeRange,
  .thumb {
    transition-duration: 0.01ms !important;
  }
}
```

### Step 5: Keyboard handler (for custom PageUp/PageDown step-10x)

Native `<input type="range">` already implements Arrow keys = ±step and Home/End. BUT PageUp/PageDown on native range defaults to ~10% of the range, not 10× the step. We intercept PageUp/PageDown:

```tsx
function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
  if (disabled) return;
  if (e.key === 'PageUp') {
    e.preventDefault();
    onChange(Math.min(max, fromProportion((value + step * 10 - min) / (max - min), min, max, step)));
  } else if (e.key === 'PageDown') {
    e.preventDefault();
    onChange(Math.max(min, fromProportion((value - step * 10 - min) / (max - min), min, max, step)));
  }
  // Arrow/Home/End are handled by the native input — let them through.
}
```

### Step 6: RangeSlider non-crossing constraint

```tsx
function RangeSlider({ min, max, step, value, onChange, ariaLabel, disabled, testid }: RangeSliderProps) {
  const [lo, hi] = value;
  const loProp = toProportion(lo, min, max);
  const hiProp = toProportion(hi, min, max);

  return (
    <div className={styles.root} data-testid={testid ?? 'range-slider'} data-disabled={disabled ? 'true' : undefined}>
      <div className={styles.track}>
        <div
          className={styles.activeRange}
          style={{ left: `${loProp * 100}%`, width: `${(hiProp - loProp) * 100}%` }}
        />
        <div className={styles.thumb} style={{ left: `calc(${loProp * 100}% - 1px)` }} />
        <div className={styles.thumb} style={{ left: `calc(${hiProp * 100}% - 1px)` }} />
      </div>
      <input
        type="range" min={min} max={hi - step} step={step} value={lo}
        aria-label={`${ariaLabel} (lower)`}
        className={`${styles.nativeInput} ${styles.nativeInputLo}`}
        onChange={(e) => onChange([Number(e.currentTarget.value), hi])}
        disabled={disabled}
        data-testid={`${testid ?? 'range-slider'}-input-lo`}
      />
      <input
        type="range" min={lo + step} max={max} step={step} value={hi}
        aria-label={`${ariaLabel} (upper)`}
        className={`${styles.nativeInput} ${styles.nativeInputHi}`}
        onChange={(e) => onChange([lo, Number(e.currentTarget.value)])}
        disabled={disabled}
        data-testid={`${testid ?? 'range-slider'}-input-hi`}
      />
    </div>
  );
}
```

Note: When both overlays stack, pointer events go to the later one (hi). To split the region, add z-index fighting via a tiny split: `nativeInputLo { right: 50%; }` / `nativeInputHi { left: 50%; }`. OR set `pointer-events` on each to only span its half. Simpler: split at the midpoint between current lo and hi proportions — update on each render.

### Step 7: Unit tests (≥ 15)

File: `src/ui/primitives/Slider.test.tsx`. Must include:

1. `<Slider>` renders with correct initial proportion (value halfway)
2. `<Slider>` at value=min renders thumb at 0%
3. `<Slider>` at value=max renders thumb at 100% (not off-screen — `left: calc(100% - 1px)`)
4. Click/change on the native input fires onChange with Number(new value)
5. ArrowRight key steps value up by `step` (native behavior — test the input receives the key and onChange fires)
6. ArrowLeft key steps value down by `step`
7. PageUp key steps value up by `10 * step` (custom handler)
8. PageDown key steps value down by `10 * step`
9. PageUp clamps at max
10. PageDown clamps at min
11. `disabled` prop blocks onChange
12. `<RangeSlider>` renders two thumbs and an active range spanning [lo, hi]
13. `<RangeSlider>` lo input maxes at `hi - step` (cannot exceed hi)
14. `<RangeSlider>` hi input mins at `lo + step` (cannot go below lo)
15. `<RangeSlider>` onChange fires with `[newLo, hi]` tuple on lo-input change
16. `<RangeSlider>` onChange fires with `[lo, newHi]` tuple on hi-input change
17. `fromProportion(0.5, 0, 100, 1)` returns 50 (helper unit)
18. `fromProportion(1, 0, 1, 0.01)` returns 1 (no float noise like 0.99999)
19. (bonus) Touch-area overlay is ≥ 32×32 (computed via `getBoundingClientRect` of the root)

Export the helpers (`toProportion`, `fromProportion`) for testability.

## Files to Create

- `src/ui/primitives/Slider.tsx`
- `src/ui/primitives/Slider.module.css`
- `src/ui/primitives/Slider.test.tsx`

## Files to Modify

- None.

## Contracts

### Provides

- `Slider`, `RangeSlider`, `SliderProps`, `RangeSliderProps`, `toProportion`, `fromProportion` from `src/ui/primitives/Slider.tsx`.
- Testid conventions: `slider` / `slider-input`, `range-slider` / `range-slider-input-lo` / `range-slider-input-hi`.

### Consumes

- Tokens from DR-6.1 as listed.

## Acceptance Criteria

- [ ] Pointer drag updates value continuously (native range input behavior)
- [ ] Keyboard ±step with Arrow keys; ±10×step with Page keys; Home→min, End→max
- [ ] Touch-area = 32×32 px; visual thumb = 2×16 px
- [ ] Thumb visible at all values 0 ≤ v ≤ max (no off-screen — `calc(pct - 1px)` offset)
- [ ] Range variant: thumbs can't cross (enforced via `max={hi-step}` / `min={lo+step}`)
- [ ] `disabled` → opacity 0.4, no interaction
- [ ] ≥ 15 passing unit tests

## Testing Protocol

### L1

```bash
pnpm biome check src/ui/primitives/Slider.tsx src/ui/primitives/Slider.module.css src/ui/primitives/Slider.test.tsx
pnpm tsc --noEmit
```

### L2

```bash
pnpm vitest run src/ui/primitives/Slider.test.tsx
```

### L3

```bash
pnpm build
```

### L4

```bash
pnpm test:e2e --grep "Task DR-7.3:"
```

Deferred to DR-7.R showcase. The DR-7.R spec will include a Slider interaction — describe block `describe('Task DR-7.R: …', …)` matches both DR-7.3 and DR-7.R greps when consolidated.

## Skills to Read

- `.claude/skills/custom-param-components/SKILL.md`
- `.claude/skills/design-tokens-dark-palette/SKILL.md`
- `.claude/skills/vitest-unit-testing-patterns/SKILL.md` — for testing `<input type="range">` with `fireEvent.change({ target: { value: '42' } })`
- `.claude/skills/prp-task-ralph-loop/SKILL.md`
- `.claude/skills/hand-tracker-fx-architecture/SKILL.md`

## Research Files to Read

- `.claude/orchestration-design-rework/research/pixelcrash-design-language.md` — § Components > 6. Range Slider (track height, thumb dimensions, touch-area)
- `.claude/orchestration-design-rework/research/current-ui-audit.md`

## Known Gotchas

```typescript
// CRITICAL: Native <input type="range"> on jsdom dispatches 'input' AND 'change'
// events. @testing-library's fireEvent.change(el, { target: { value: '42' } })
// is the right path — it sets el.value and fires both events.

// CRITICAL: Thumb positioning with `left: calc(100% - 1px)` prevents the thumb
// from clipping off the right edge when value === max. Half the thumb width (1px)
// is subtracted. Do NOT use `left: 100%` — thumb will be off-screen.

// CRITICAL: noUncheckedIndexedAccess — destructuring `const [lo, hi] = value`
// works because tuples carry both elements in the type, but if you later
// write `const x = arr[i]` you MUST guard for undefined.

// CRITICAL: Floating-point step issues — step=0.01 and 100 steps can produce
// 0.9999999 instead of 1. fromProportion uses toFixed(precision) to clamp
// the display precision. Tests must assert with toBeCloseTo for non-integer
// step cases, NOT toBe.

// CRITICAL: RangeSlider's two overlays must not fight for pointer events
// at the midpoint. The simplest approach is to split their hit areas via
// `pointer-events` at the midpoint proportion — or use styles.nativeInputLo
// { right: `${100 - midProp * 100}%` } and similar for hi.

// CRITICAL: PageUp/PageDown default on <input type="range"> is ~10% of
// (max - min), NOT 10 * step. We override this behavior via keydown handler.
// e.preventDefault() is required to suppress the native behavior.

// CRITICAL: Reduced-motion: this primitive has near-zero motion anyway —
// the transitions are only on color change (hover). The @media block is
// kept for consistency.
```

## Anti-Patterns

- Do not install noUiSlider or rc-slider. Native `<input type="range">` + CSS is sufficient.
- Do not use `useState` for the value — it's controlled by the consumer via `value` + `onChange`.
- Do not render the thumb as a circle (`border-radius: 50%`). It is a 2px-wide rectangle.
- Do not use mousemove / mouseup global listeners — the native input already handles drag.
- Do not forget `aria-label` on the input — without it the slider is unnamed for screen readers.

## No Prior Knowledge Test

- [ ] Tokens `--color-slider-track`, `--color-slider-handle`, `--color-slider-hover`, `--color-slider-active`, `--color-focus-ring`, `--space-02`, `--space-16`, `--space-32` all exist in tokens.css
- [ ] `toProportion`, `fromProportion` are exported and independently testable
- [ ] ≥ 15 tests listed; some cover `<RangeSlider>` non-crossing
- [ ] All 4 validation commands copy-paste runnable

## Git

- Branch: `task/DR-7-3-slider-primitive`
- Commit prefix: `Task DR-7.3:`
- Trailer: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
