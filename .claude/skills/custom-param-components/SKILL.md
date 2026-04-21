---
name: custom-param-components
description: Use when implementing or modifying any React primitive or composite component in Hand Tracker FX's reworked chrome (Button, Segmented, Slider, Toggle, ColorPicker, LayerCard, ModulationRow, useParam). Defines paramStore-binding patterns, testid conventions, reduced-motion handling, and replaces the retired Tweakpane integration.
---

# Custom Param Components

The hand-built React component library that replaces Tweakpane in Hand Tracker FX. Every interactive control binds to the existing `paramStore` / `modulationStore` via the shared `useParam` hook. Nothing here imports from `tweakpane`, `@tweakpane/core`, or `@tweakpane/plugin-essentials` — those packages are deleted in Task DR-8.6.

Authority: `.claude/orchestration-design-rework/DISCOVERY.md` (DR1–DR19) overrides everything. Parent `.claude/orchestration-hand-tracker-fx/DISCOVERY.md` still authoritative for engine concerns. This skill codifies the patterns — palette tokens live in `design-tokens-dark-palette`, font wiring in `jetbrains-mono-self-hosting`.

## When to Use

- Implementing any task in Phase DR-7 (primitives) or Phase DR-8 (chrome integration)
- Adding / modifying a control bound to `paramStore` or `modulationStore`
- Reviewing a PR that touches `src/ui/primitives/**` or `src/ui/Layer*.tsx` / `ModulationCard.tsx` / `Toolbar.tsx` / `Sidebar.tsx` / `PresetStrip.tsx` / `Footer.tsx`
- Retiring Tweakpane references (DR-8.6)

Read BEFORE any DR-7.* or DR-8.* task file.

## 1. Architecture

### Directory layout

```
src/ui/
  primitives/                      # Phase DR-7 — unit-testable in isolation
    Button.tsx                     + Button.module.css        + Button.test.tsx
    Segmented.tsx                  + Segmented.module.css     + Segmented.test.tsx
    Slider.tsx                     + Slider.module.css        + Slider.test.tsx
    Toggle.tsx                     + Toggle.module.css        + Toggle.test.tsx
    ColorPicker.tsx                + ColorPicker.module.css   + ColorPicker.test.tsx
    LayerCard.tsx                  + LayerCard.module.css     + LayerCard.test.tsx
    useParam.ts                                               + useParam.test.ts
  Toolbar.tsx                      + Toolbar.module.css       # Phase DR-8.1
  CellSizePicker.tsx                                          # DR-8.1 (thin wrapper on Segmented)
  Sidebar.tsx                      + Sidebar.module.css       # DR-8.2
  LayerCard1.tsx                                              # DR-8.2 (handTrackingMosaic-only)
  LayerSection.tsx                                            # DR-8.2
  ModulationCard.tsx               + ModulationCard.module.css # DR-8.3
  ModulationRow.tsx                                           # DR-8.3
  PresetStrip.tsx                                             # DR-8.5
  Footer.tsx                       + Footer.module.css        # DR-8.7
  tokens.css                       # DR-6.1 — CSS custom properties (read-only by this skill)
  tokens.ts                        # DR-6.1 — TS mirror of tokens
  Stage.tsx + Stage.css            # ENGINE-LINKED — do not restyle tokens.css replacement only
  cards.css                        # DR-8.4 — restyled error/prompt cards
  PrePromptCard.tsx + ErrorStates.tsx + errorCopy.ts + useRecorder.ts  # LOCKED behaviorally
```

### CSS Modules vs inline

- **CSS Modules** for every `.tsx` that ships visible chrome. Filename is `{Component}.module.css`. Import as `import styles from './Button.module.css'`; reference via `className={styles.primary}`.
- **Global tokens** live in `src/ui/tokens.css` (imported once by `src/index.css`). All CSS Module rules read token values via `var(--token-name)`.
- **Inline styles** are forbidden in new components. Single allowed exception: ephemeral layout math (e.g. `style={{ transform: \`translateX(${x}%)\` }}` on a slider thumb). Never inline color / size / spacing / radius / duration values — always use tokens.
- **No CSS-in-JS libraries.** No Tailwind, no shadcn, no styled-components, no emotion. Plain CSS + CSS custom properties + CSS Modules only (DR §8.8).

### File-naming conventions

- React component: PascalCase filename (`Button.tsx`), PascalCase default-exported component.
- Hook: camelCase filename prefixed `use` (`useParam.ts`).
- CSS Module: `{Component}.module.css`. Class names lowerCamel (`styles.primary`, `styles.isSelected`).
- Test: `{Component}.test.tsx` colocated next to source.

## 2. The `useParam` Hook

The single bridge between React UI and the `paramStore` singleton. Replaces Tweakpane's `addBinding` + `on('change')` round-trip.

### Contract

```ts
// src/ui/primitives/useParam.ts — subscription-isolation form per DR-7.7
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  paramStore,
  type ParamKey,
  type ParamValue,
  type ParamSnapshot,
} from '../../engine/paramStore';

function readValueAt(snapshot: ParamSnapshot, dotPath: string): unknown {
  const idx = dotPath.indexOf('.');
  if (idx < 0) return undefined;
  const section = dotPath.slice(0, idx);
  const leaf = dotPath.slice(idx + 1);
  const sec = (snapshot as Record<string, Record<string, unknown>>)[section];
  return sec === undefined ? undefined : sec[leaf];
}

export function useParam<K extends ParamKey>(
  key: K,
): readonly [ParamValue<K>, (next: ParamValue<K>) => void] {
  // Cache the last value so we can short-circuit re-renders on sibling changes.
  const lastValueRef = useRef<unknown>(readValueAt(paramStore.getSnapshot(), key));

  const subscribe = useCallback(
    (listener: () => void): (() => void) => {
      return paramStore.subscribe(() => {
        const next = readValueAt(paramStore.getSnapshot(), key);
        if (!Object.is(next, lastValueRef.current)) {
          lastValueRef.current = next;
          listener();
        }
        // If equal — swallow the notification: no re-render for sibling-key changes.
      });
    },
    [key],
  );

  const getSnapshot = useCallback((): ParamValue<K> => {
    const value = readValueAt(paramStore.getSnapshot(), key) as ParamValue<K>;
    lastValueRef.current = value;
    return value;
  }, [key]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setValue = useCallback(
    (next: ParamValue<K>) => {
      paramStore.set(key, next);
    },
    [key],
  );

  return useMemo(() => [value, setValue] as const, [value, setValue]);
}
```

### Usage

```tsx
const [tileSize, setTileSize] = useParam('mosaic.tileSize');
const [mirror, setMirror] = useParam('input.mirrorMode');
const [lineColor, setLineColor] = useParam('grid.lineColor');
```

### Guarantees

1. **Structural sharing.** `paramStore.set(dotPath, value)` only creates a new section reference for the section it mutated; consumers of OTHER sections do not re-render (Object.is stability of `snapshot.otherSection`). Preserve this by always going through `.set()` — never mutate `paramStore.snapshot` directly.
2. **StrictMode-safe.** `useSyncExternalStore` handles double-invocation in dev. The hook subscribes on mount, unsubscribes on unmount, and tolerates React 19's concurrent rendering. Do not add your own `useEffect(() => paramStore.subscribe(...), [])` — it duplicates the subscription.
3. **Type safety.** Caller supplies the `<T>` generic; runtime does not enforce. Wrong generic = silent bug. A future refactor can derive `T` from manifest `ParamDef` types. For now, match the manifest (see `src/effects/handTrackingMosaic/manifest.ts` `HandTrackingMosaicParams`).
4. **Setter stability.** The returned setter is `useCallback`-memoised against `dotPath`. Safe to pass to child components / pass to `useEffect` deps.

### For modulation routes

`modulationStore` has the same `subscribe` / `getSnapshot` shape. Use a parallel `useModulation` hook (lives in `src/ui/ModulationCard.tsx` or a sibling) — not `useParam`, which is paramStore-only:

```ts
function useModulationRoutes(): readonly ModulationRoute[] {
  const snap = useSyncExternalStore(
    modulationStore.subscribe,
    modulationStore.getSnapshot,
    modulationStore.getSnapshot,
  );
  return snap.routes;
}
```

## 3. Primitive Contracts

Each primitive is a plain React function component. All are `forwardRef` where a ref makes sense (Button, Slider). All expose `data-testid` through props for consumer-controlled E2E.

### 3.1 Button (DR-7.1, DR11)

Square corners at rest, animates to pill-radius on hover. Four variants.

```tsx
type ButtonVariant = 'primary' | 'secondary' | 'text' | 'icon';
type ButtonSize = 'sm' | 'md';

type ButtonProps = {
  variant?: ButtonVariant;         // default 'secondary'
  size?: ButtonSize;               // default 'md'
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  'aria-label'?: string;
  'data-testid'?: string;
  children: React.ReactNode;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(...);
```

CSS pattern (pseudo-code, actual values in tokens):

```css
.button {
  position: relative;
  color: var(--color-button-primary-text);
  background: transparent;
  border: 0;
  z-index: 0;
}
.button::before {
  content: '';
  position: absolute; inset: 0;
  background: var(--color-button-primary-bg);
  border-radius: var(--radius-0);
  transition: border-radius var(--duration-short) var(--ease-default),
              background-color var(--duration-short) var(--ease-default) 0.1s;
  z-index: -1;
}
.button:hover::before { border-radius: var(--radius-pill); }
.reducedMotion .button::before { transition: none; }
```

**a11y:** native `<button>` element, keyboard-operable, `focus-visible` ring (see tokens). `aria-label` REQUIRED for `variant='icon'`. `disabled` prop toggles `aria-disabled` and CSS `pointer-events: none; opacity: 0.4`.

### 3.2 Segmented (DR-7.2, DR §5 Segmented)

N-option typographic radio group. No pill track — selected state is color + `font-weight: 600`. "/" separator rendered via `::before` on every option except the first.

```tsx
type SegmentedOption<V extends string | number> = { value: V; label: string };

type SegmentedProps<V extends string | number> = {
  options: readonly SegmentedOption<V>[];   // 2, 3, or 5 typically
  value: V;
  onChange: (value: V) => void;
  'aria-label': string;
  'data-testid'?: string;
};

export function Segmented<V extends string | number>(props: SegmentedProps<V>): JSX.Element;
```

**a11y:** `role="radiogroup"` on wrapper, `role="radio"` on each option, `aria-checked`. Keyboard: ArrowLeft / ArrowRight cycle selection (no wrapping on first/last, per native radiogroup semantics); Home / End jump to first / last. ArrowDown/Up behave identically for vertical ergonomics.

**Focus management:** roving tabindex — only the currently-selected option has `tabIndex={0}`; others `tabIndex={-1}`. This matches WAI-ARIA APG "Radio Group".

### 3.3 Slider (DR-7.3, DR §5 Slider)

Hairline 2px track, 2×16px thin vertical line thumb. Single and range variants share module CSS.

```tsx
type SliderProps = {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  'aria-label': string;
  'data-testid'?: string;
};

type RangeSliderProps = {
  min: number;
  max: number;
  step: number;
  value: readonly [number, number];
  onChange: (value: readonly [number, number]) => void;
  'aria-label': string;
  'data-testid'?: string;
};

export function Slider(props: SliderProps): JSX.Element;
export function RangeSlider(props: RangeSliderProps): JSX.Element;
```

**a11y / interaction:**
- Native `<input type="range">` under the hood is the simplest path and gets you keyboard + screen-reader support for free. Range variant (two thumbs) uses two stacked ranges with a CSS-driven connected fill between them.
- Keyboard: Arrow steps by `step`; PageUp/PageDown steps by `10 × step`; Home / End jumps to `min` / `max`.
- Visual thumb is 2×16px but the hitbox is 32×32px (achieved by making the native `<input>` taller than the visual thumb and transparent, overlaying a rendered `::-webkit-slider-thumb` styled to 2×16).
- Range variant's thumbs must not cross: clamp on `onChange` — `nextLow = Math.min(nextLow, highValue)`.

### 3.4 Toggle (DR-7.4, DR §5 Toggle)

20×20 morph between a square (ON, radius 0, filled primary) and a circle (OFF, radius 10, filled `--color-toggle-off`). Inner SVG X rotates −90° into a + when OFF. Uses the spring bezier easing on 0.35s.

```tsx
type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  'aria-label': string;               // REQUIRED
  'data-testid'?: string;
};

export function Toggle(props: ToggleProps): JSX.Element;
```

**a11y:** `role="switch"`, `aria-checked`, Space toggles. Enter also toggles (matches native button). Reduced-motion: instant state change, no transform or transition.

### 3.5 ColorPicker (DR-7.5, DR §5 Color Picker)

20×20 square swatch + borderless hex text input. Both share state.

```tsx
type ColorPickerProps = {
  value: string;                      // '#RRGGBB' normalised uppercase
  onChange: (hex: string) => void;
  'aria-label': string;
  'data-testid'?: string;
};

export function ColorPicker(props: ColorPickerProps): JSX.Element;
```

**Behavior:**
- Text input is `text-transform: uppercase`. Accept user input; validate on blur: if it matches `/^#[0-9A-Fa-f]{6}$/`, normalize and commit via `onChange`; otherwise revert visible text to the prop `value` (no error UI — pixelcrash-honest silence).
- Native `<input type="color">` handles the swatch pop-up. On its `change` event, forward the new hex.
- Hover underlines the text input (no border, no focus ring, no background).

### 3.6 LayerCard (DR-7.6, DR §5 Layer Panel)

Shell with `background: var(--color-panel)`, 20px padding, optional collapsible behavior. Composition slots: `title`, `action` (e.g. Delete link), `children` (sections).

```tsx
type LayerCardProps = {
  title: string;                                      // 'LAYER 1', 'MODULATION'
  action?: React.ReactNode;                           // e.g. a Delete text-button
  collapsible?: boolean;                              // default false
  defaultCollapsed?: boolean;                         // default false
  'data-testid'?: string;
  children: React.ReactNode;
};

type LayerSectionProps = {
  title?: string;                                     // 'Grid', 'Mosaic', 'Input'
  'data-testid'?: string;
  children: React.ReactNode;
};

export function LayerCard(props: LayerCardProps): JSX.Element;
export function LayerSection(props: LayerSectionProps): JSX.Element;
```

**Behavior:**
- Always-present panel divider (1px, `--color-divider`) between header and body.
- Sections separated by the same hairline divider. `LayerSection` does not render its own divider — `LayerCard` wraps children with dividers between.
- Collapsible: header has a chevron Button (`variant='icon'`). Click toggles. Height animates 0.3s (height + gap) + opacity 0.5s (children), matching pixelcrash. Reduced-motion: instant collapse/expand.
- Collapsible uses `<details>`/`<summary>` semantically where possible, or a manual ARIA pattern (`aria-expanded`, `aria-controls`). Keyboard: Space / Enter on chevron toggles.

## 4. Composite Components

These live in `src/ui/` (not `primitives/`). They assemble primitives into the app chrome.

### 4.1 Toolbar (DR-8.1)

```
[■ Hand Tracker FX]   [Cells: XS / S / M / L / XL]                    [⏺ Record  0:23]
```

- Left: wordmark (`src/ui/Toolbar.tsx` renders a small filled square logomark + "Hand Tracker FX" in JBM 600 ~22px).
- Center: `<CellSizePicker />` — a thin wrapper around `<Segmented>` that maps XS=4, S=8, M=16, L=32, XL=64 to `paramStore.set('mosaic.tileSize', ...)`. Subscribes via `useParam('mosaic.tileSize')` (the value type is inferred). On param value read-back, maps integer tile size back to the nearest bucket label (exact match only — modulated in-between values show no selected bucket, by design).
- Right: `<RecordButton>` (moved inline; uses existing `useRecorder` hook). Pass `variant='primary'` to the underlying Button.

Testids: `toolbar`, `toolbar-wordmark`, `toolbar-cell-picker`, `record-button` (preserved from existing code), `record-elapsed` (preserved).

### 4.2 Sidebar (DR-8.2)

Right-side column, hosts (top to bottom): PresetStrip → LayerCard1 → ModulationCard. Sets `data-testid="panel-root"` on its root and `data-testid="params-panel"` on LayerCard1's body — these are preserved from the Tweakpane era so Phase 1–4 E2E specs keep passing (DR-§7).

### 4.3 LayerCard1 (DR-8.2)

The ONE hardcoded LayerCard for `handTrackingMosaic`. No generic multi-effect registry. Three `<LayerSection>` children:

- **Grid** (`data-testid="layer-card-grid"`): `seed` (Slider), `columnCount` (Slider), `rowCount` (Slider), `widthVariance` (Slider 0–1, step 0.01), `lineColor` (ColorPicker), `lineWeight` (Slider 0.5–4, step 0.5), Randomize (Button — calls the existing `onClick` from manifest PARAMS array for `grid.randomize`, which does `paramStore.set('grid.seed', newSeed)`).
- **Mosaic** (`data-testid="layer-card-mosaic"`): `tileSize` (Slider 4–64, step 1 — same paramStore key as CellSizePicker), `blendOpacity` (Slider 0–1, step 0.01), `edgeFeather` (Slider 0–8, step 0.5), `regionPadding` (Slider 0–4, step 1; the effect.regionPadding key is surfaced here).
- **Input** (`data-testid="layer-card-input"`): `mirrorMode` (Toggle), `showLandmarks` (Toggle), `deviceId` (a plain `<select>` for now; list comes from `navigator.mediaDevices.enumerateDevices()` — existing `useCamera` integration unchanged).

All 14 leaf params (the counted set: 6 grid + 4 mosaic+effect + 3 input + 1 button) wired via `useParam` exactly once. Do not read `paramStore.snapshot` directly in render.

### 4.4 ModulationCard + ModulationRow (DR-8.3)

Collapsible LayerCard. Lists `modulationStore.snapshot.routes` by id as React keys. Per-row inline controls:

```
[Toggle] [SourceSelect] [TargetSelect] [RangeSlider in] [RangeSlider out] [CurveSelect] [Delete]
```

```tsx
type ModulationRowProps = {
  route: ModulationRoute;
  index: number;                                      // for testid
};

export function ModulationRow({ route, index }: ModulationRowProps): JSX.Element;
```

- SourceSelect: 45 options (21 landmarks × x/y = 42, plus pinch, centroid.x, centroid.y = 45). Options come from `handTrackingMosaicManifest.modulationSources`.
- TargetSelect: plain `<select>` listing every numeric leaf in `paramStore.snapshot` matching the existing manifest's `ParamDef[]` (exclude `button` + `color` + `boolean` + `string`). Deriving the target list is the ONE place the manifest has to be traversed at render time — memo'd via `useMemo`.
- CurveSelect: `Linear / Ease In / Ease Out / Ease In-Out / Cubic Bezier`. When `cubicBezier` selected, a mini bezier editor expands below (port of the existing BezierCanvas behavior — or for DR-8.3, render a compact SVG curve preview with four draggable handles; see research/pixelcrash-design-language.md §Interaction Patterns for the spring bezier pattern).
- Delete: `<Button variant='text'>`, calls `modulationStore.deleteRoute(route.id)`.
- "+ Add route" button at the card footer: `<Button variant='primary' full-width>`, calls `modulationStore.upsertRoute(newRoute)` with a fresh `crypto.randomUUID()` id.

Testids: `modulation-card` on the card root, `modulation-route-${index}` on each row.

### 4.5 PresetStrip (DR-8.5)

```
[‹] Preset Name [›]   [Save]  [Save As]  [Delete]   [↓ Export] [↑ Import]
```

Merges the current fixed `PresetBar` + `PresetActions` into a single sidebar-header strip. Preserves testids `preset-bar`, `preset-name`, `preset-actions` on the corresponding sub-regions to keep Phase 1–4 E2E specs green.

Keyboard: ArrowLeft / ArrowRight cycle via `presetCycler` — same key handler wiring as today. Input-focus guard (don't steal keys from text inputs) stays.

### 4.6 Footer (DR-8.7)

Bottom row, muted text. Rendered only when `cameraState === 'GRANTED'` (App.tsx gates it). Content: `hand-tracker-fx v0.1.0 ······· Built with MediaPipe, ogl, React`.

## 5. Testid Conventions

### Preserved — must NOT change

These testids appear in 45 existing E2E specs (Phase 1–4 aggregate + the ErrorStates aggregate). If a DR-task breaks any of these, all downstream specs fail.

| testid | Where it must remain |
|---|---|
| `camera-state` | Hidden `<p>` in App.tsx (state mirror) |
| `stage` | Stage root |
| `render-canvas` | Stage inner wrapper |
| `stage-video` | Hidden video element |
| `webgl-canvas` | WebGL canvas |
| `overlay-canvas` | 2D overlay canvas |
| `panel-root` | Sidebar root (moved from old Panel.tsx) |
| `params-panel` | LayerCard1 body (moved from old Panel.tsx inner div) |
| `preset-bar` | PresetStrip chevron region |
| `preset-name` | PresetStrip current-name element |
| `preset-actions` | PresetStrip Save/SaveAs/Delete/Export/Import region |
| `record-button` | Inline Record button in Toolbar |
| `record-elapsed` | Elapsed-time span next to record button |
| `error-state-card-PROMPT` | PrePromptCard root |
| `error-state-card-USER_DENIED` | ErrorStates render |
| `error-state-card-SYSTEM_DENIED` | ErrorStates render |
| `error-state-card-DEVICE_CONFLICT` | ErrorStates render |
| `error-state-card-NOT_FOUND` | ErrorStates render |
| `error-state-card-MODEL_LOAD_FAIL` | ErrorStates render |
| `error-state-card-NO_WEBGL` | ErrorStates render |

### New testids — add these

| testid | Where |
|---|---|
| `toolbar` | Toolbar root |
| `toolbar-wordmark` | Wordmark element |
| `toolbar-cell-picker` | CellSizePicker root |
| `layer-card-grid` | Grid section root |
| `layer-card-mosaic` | Mosaic section root |
| `layer-card-input` | Input section root |
| `modulation-card` | ModulationCard root |
| `modulation-route-${n}` | Each ModulationRow (n = 0-indexed route position) |

Source: `DISCOVERY.md` §7. If you add another testid for an internal detail, document it in the task file and prefix with the component name (`toolbar-logomark`, `layer-card-randomize-btn`, etc.).

## 6. Reduced-Motion Handling

Every animated component respects `prefers-reduced-motion: reduce` via a single pattern:

```tsx
import { reducedMotion } from '../../engine/reducedMotion';
import styles from './Button.module.css';

export function Button(props: ButtonProps) {
  const isReduced = reducedMotion.getIsReduced();
  return (
    <button
      className={`${styles.button} ${isReduced ? styles.reducedMotion : ''}`}
      {...}
    />
  );
}
```

### Rules

1. **Read once per render.** `reducedMotion.getIsReduced()` is O(1) — safe to call inline.
2. **Conditionally apply a CSS class.** Never branch on `isReduced` to call different JS animation libraries — we have zero JS-driven animations (pixelcrash doesn't either). All motion is CSS `transition`.
3. **The CSS class collapses `transition-duration` to 0.** Example:
   ```css
   .button.reducedMotion::before { transition: none !important; }
   ```
4. **No OS change listener in primitives.** The `reducedMotion` module already subscribes to `matchMedia`. If you need a component to re-render when the OS setting toggles mid-session, use `useSyncExternalStore(reducedMotion.subscribe, reducedMotion.getIsReduced)` — but most primitives render often enough that a stale class on the next click is acceptable (pixelcrash-honest: rare corner case).
5. **Do not gate modulation.** The engine-side `App.tsx` already pauses modulation when `isReduced` is true (existing behavior, D26). Components need not repeat that check.

## 7. Common Pitfalls

| Pitfall | Why it breaks | Fix |
|---|---|---|
| `import { Pane } from 'tweakpane'` in any `src/` file after DR-8.6 | Task DR-8.6 deletes the package; build fails. | Use primitives + `useParam`. If you need a feature Tweakpane had, add it to a primitive or composite. |
| Adding `useEffect(() => paramStore.subscribe(cb))` alongside `useParam` | Double-subscribes in StrictMode; sometimes fires listeners twice. | Trust `useSyncExternalStore` inside `useParam`. Don't wire your own subscription. |
| Mutating `paramStore.snapshot.mosaic.tileSize = 32` directly | `snapshot` is the live object; mutation bypasses `notify()`; UI does not update; structural sharing invariant violated. | Always call `paramStore.set('mosaic.tileSize', 32)`. |
| Hardcoding `#EAEAEA` / `12px` / `0.2s` in a CSS Module | Bypasses the token system; breaks the single source of truth; a palette tweak in Phase DR-9 won't propagate. | `var(--color-text-primary)`, `var(--space-12)`, `var(--duration-short)`. Palette values live in `design-tokens-dark-palette`. |
| Changing `data-testid="panel-root"` to something cleaner | Breaks 15+ E2E specs that grep the DOM for it. | Keep the testid on whatever root element replaces the old panel. If you must rename, update all E2E specs in the same PR and re-run L4. |
| Adding inline `<style>` in `Toolbar.tsx` for "just this one thing" | Defeats CSS Modules; hot-reload is flaky; theme swaps break. | Make a new class in `Toolbar.module.css`. |
| Forgetting `aria-label` on an icon-only Button or a Toggle | Screen readers announce unlabeled; Playwright a11y assertions fail. | Always provide `aria-label` on iconography-only components; it's a required prop in the types above. |
| Calling `paramStore.replace(next)` from a component | Wipes preset cycler invariants; listeners fire for every section. | Only `presetCycler` / `importPresetFile` / preset-load code paths use `.replace()`. Components use `.set()`. |
| Using `useState` to mirror a paramStore value "for speed" | State desyncs on external updates (preset load, modulation); causes double-render. | `useParam` is the only legitimate source. If you need derived state, `useMemo(() => …, [value])`. |

## 8. Testing Strategy

Toolchain (DISCOVERY §7 + parent D38):
- **Vitest 4.1** + **jsdom 25** for unit tests
- **@testing-library/react** for render / user events
- **vitest-canvas-mock** for anything that touches `<canvas>` context (LayerCard's chevron doesn't; Stage does — but Stage isn't in this skill's scope)
- **Playwright 1.59** for L4 E2E (see `playwright-e2e-webcam` skill)

### Per-primitive unit tests — minimum 8 tests each

Minimum coverage for each primitive:

1. Renders default props (smoke)
2. Each variant / prop combo renders with the expected class
3. `onChange` / `onClick` fires with the right payload
4. Keyboard interaction (Arrow keys, Space, Enter, Home/End where applicable)
5. a11y roles + aria attrs present (`role`, `aria-checked`, `aria-label`)
6. Focus-visible ring appears on keyboard focus (testable via `userEvent.tab()`)
7. Reduced-motion class toggles when `reducedMotion.getIsReduced()` returns true (mock the module)
8. `disabled` / `aria-disabled` states render + reject pointer events
9. (Slider / Range only) clamping at min/max; (Toggle) aria-checked toggle
10. testid propagation — `data-testid` prop appears on root DOM node

Example skeleton:

```tsx
// Button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Button } from './Button';

describe('Button primitive', () => {
  it('renders primary variant by default', () => {
    render(<Button onClick={() => {}}>Record</Button>);
    expect(screen.getByRole('button', { name: /record/i })).toBeInTheDocument();
  });

  it('fires onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('applies reduced-motion class when preference is set', async () => {
    vi.mock('../../engine/reducedMotion', () => ({
      reducedMotion: { getIsReduced: () => true, subscribe: () => () => {} },
    }));
    render(<Button onClick={() => {}}>X</Button>);
    expect(screen.getByRole('button').className).toMatch(/reducedMotion/);
  });

  // 5+ more tests covering disabled, icon variant, keyboard, focus ring, testid
});
```

### `useParam` tests — minimum 12

(Per PHASES.md Task DR-7.7 acceptance.) Cover: first-mount read, subsequent `.set()` updates, StrictMode double-mount yields single subscription, two hooks watching different keys don't cross-notify, setter is stable across renders, wrong generic is runtime-tolerant, unmount unsubscribes, concurrent updates preserve order, `replace()` re-renders all consumers, `set()` with equal value does NOT re-render (via spy on listener), server-snapshot path matches (SSR-never but required by React 19 types), reads `undefined` gracefully for missing keys.

### Integration tests — composite components

Each composite gets one "happy-path" integration test:

- **Toolbar.test.tsx**: renders wordmark + cell picker + record button; clicking a cell-size bucket updates `paramStore.snapshot.mosaic.tileSize`; modifying `paramStore.snapshot.mosaic.tileSize` externally updates the selected bucket.
- **LayerCard1.test.tsx**: renders all three sections; mutating each of the 14 params via its control writes the expected value to paramStore; Randomize button changes `grid.seed`; a second effect NOT registered does NOT blow up (though we ship one effect — this is a robustness test).
- **ModulationCard.test.tsx**: adding a route shows a new ModulationRow; toggling route enabled persists; deleting a route removes the row; changing source/target/curve updates `modulationStore`.
- **PresetStrip.test.tsx**: chevron forward/backward cycles preset; ArrowLeft/Right keyboard cycles; Save creates entry; Delete removes entry; Export downloads a JSON; Import reads a JSON file and calls `paramStore.replace`.

### L4 E2E

Phase DR-8.R runs the full user-journey spec on the new chrome. See `playwright-e2e-webcam` skill for the fake-webcam Y4M pattern. All 45 existing E2E specs must still pass — no testid regressions allowed (see §5 above).

Every new spec's `describe` block MUST start with `Task DR-N.M:` so the Ralph loop's `--grep "Task DR-N.M:"` matches.

## 9. References

### Cross-links

- **`design-tokens-dark-palette`** — all color, spacing, radius, duration, easing tokens. This skill never hardcodes values; it references `var(--token)`.
- **`jetbrains-mono-self-hosting`** — font-face wiring. Components inherit `font-family: var(--font-family)` from body baseline.
- **`hand-tracker-fx-architecture`** — parent project orientation. Read first if you've never touched the repo.
- **`tweakpane-params-presets`** — RETIRED. Read only to understand what behavior we must preserve (preset round-trip, modulation evaluator, CHOP semantics). All Tweakpane-specific wiring (addBinding, addBlade, Pane, pane.refresh) is gone.
- **`vitest-unit-testing-patterns`** — L2 test scaffolding (StrictMode, deterministic RNG, canvas mocks).
- **`playwright-e2e-webcam`** — L4 test wiring (fake webcam, `__handTracker` dev hook).
- **`webcam-permissions-state-machine`** — Unchanged by this skill. Error cards re-skinned in DR-8.4; state machine untouched.

### DISCOVERY decisions

- **DR3** — replace Tweakpane with custom React; engine locked.
- **DR5** — dark palette. See `design-tokens-dark-palette`.
- **DR6** — single LAYER 1 card with Grid / Mosaic / Input sections. No "Add layer".
- **DR7** — JetBrains Mono 500 default, 600 emphasis.
- **DR8** — Modulation as collapsible card below LAYER 1.
- **DR9** — CellSizePicker = Segmented XS/S/M/L/XL → `mosaic.tileSize`.
- **DR10** — Drop Colors/Video tab + Upload + Show source.
- **DR11** — square→pill hover on buttons; square↔circle on toggle; reduced-motion honors.
- **DR14** — error/prompt cards keep structure + testids + copy; re-skin only.
- **DR15** — Record button inline in toolbar right.
- **DR16** — PresetStrip merges old PresetBar + PresetActions.
- **DR17** — TouchDesigner reference archived.
- **DR18** — Footer is lightweight and hidden on error states.
- **DR19** — source-code landmark comment in `index.html`.

### PHASES tasks this skill governs

- DR-7.1 Button · DR-7.2 Segmented · DR-7.3 Slider · DR-7.4 Toggle · DR-7.5 ColorPicker · DR-7.6 LayerCard · DR-7.7 useParam · DR-7.R Primitives regression
- DR-8.1 Toolbar · DR-8.2 Sidebar + LayerCard1 · DR-8.3 ModulationCard · DR-8.4 Cards re-skin · DR-8.5 PresetStrip · DR-8.6 Retire Tweakpane · DR-8.7 Footer · DR-8.R Phase regression + visual-fidelity gate

### Engine files this skill binds to (READ ONLY from primitives)

- `src/engine/paramStore.ts` — state source of truth. Mutate via `.set()` only.
- `src/engine/modulationStore.ts` — routes source of truth. Mutate via `.upsertRoute()` / `.deleteRoute()` / `.replaceRoutes()`.
- `src/engine/reducedMotion.ts` — OS motion preference. Read `getIsReduced()` at render time.
- `src/engine/manifest.ts` + `src/effects/handTrackingMosaic/manifest.ts` — 14 param defs, 45 modulation sources (42 landmark axes + pinch + centroid.x + centroid.y). Derive select options from `handTrackingMosaicManifest.modulationSources` and `handTrackingMosaicManifest.params`.
- `src/engine/modulation.ts` — curve evaluator. Do not reimplement; if ModulationRow needs a preview, call the same `applyCurve` / `applyModulation` functions.
- `src/engine/presets.ts` — save/load/export/import. PresetStrip wires to the existing API, does not reimplement.
