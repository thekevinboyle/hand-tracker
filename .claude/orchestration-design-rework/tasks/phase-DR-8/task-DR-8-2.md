# Task DR-8.2: Sidebar + LayerCard1 (wires all 14 params)

**Phase**: DR-8 — Chrome Integration
**Branch**: `task/DR-8-2-sidebar-layercard1`
**Commit prefix**: `Task DR-8.2:`
**Estimated complexity**: Large
**Max Ralph iterations**: 30

---

## Goal

**Feature Goal**: Build the right-hand `Sidebar` that hosts the LAYER 1 card. The card holds three inner sections — Grid, Mosaic, Input — each binding manifest params to primitive components via `useParam`. All 14 `handTrackingMosaic` manifest params get a control here; clicking/dragging any control writes through `paramStore`.

**Deliverable**:
- `src/ui/Sidebar.tsx` + `Sidebar.module.css` — right-column container (min-width 340px)
- `src/ui/LayerCard1.tsx` — hardcoded for `handTrackingMosaic` (DR6 — single effect)
- `src/ui/LayerRow.tsx` — the label+control row helper used inside LayerSection bodies
- `src/ui/LayerCard1.test.tsx` + `src/ui/Sidebar.test.tsx` — unit coverage
- `tests/e2e/task-DR-8-2.spec.ts` — Playwright L4

**Note**: `LayerCard` + `LayerSection` primitives come from DR-7.6 (`src/ui/primitives/LayerCard.tsx`). Do NOT create a second `LayerSection` component here.

**Success Definition**: All 14 manifest params have a visible control in the sidebar. Every control round-trips through `paramStore` (reading reflects the live value, writing mutates it). The three new testids (`layer-card-grid`, `layer-card-mosaic`, `layer-card-input`) are attached to the three section bodies. Existing `panel-root` + `params-panel` testids are preserved on the sidebar root + LayerCard1 body respectively.

---

## User Persona

**Target User**: Creative technologist tuning a live effect during a demo — wants every dial in one column without tab-switching.

**Use Case**: User drags the grid `widthVariance` slider while the mosaic renders. Each paint shows the new variance immediately. Switches to the `lineColor` picker, types `#FF00AA`, and the grid color updates live. Clicks `Randomize Grid` — the seed slider jumps to a new random value.

**User Journey**:
1. App is GRANTED. Sidebar visible on the right, 340px wide.
2. LAYER 1 card header reads "LAYER 1" in JetBrains Mono 600; chevron action optionally collapses the card (collapsible in DR-8.3 pattern — here always-expanded per DR6).
3. Three sections visible in order: **Grid / Mosaic / Input**.
4. User drags "Width variance" slider in Grid → mosaic re-renders.
5. User clicks "Randomize" → seed value rolls.
6. User switches "Mirror" toggle in Input → stage flips, video element still unmirrored.

**Pain Points Addressed**: No Tweakpane "folder" click required; every control is always visible in a single scrollable column.

---

## Why

- DR6 — single LAYER 1 card. No "Add Layer" button.
- DR8 — Sidebar hosts LAYER card + (eventually) Modulation card. Same panel surface token.
- DISCOVERY §7 — testids for new chrome: `layer-card-grid`, `layer-card-mosaic`, `layer-card-input`. Preserve `panel-root`, `params-panel`.
- Depends on every DR-7 primitive — `Slider`, `Segmented`, `Toggle`, `ColorPicker`, `Button`, `LayerCard`, `useParam`. Depends on tokens (DR-6.1).
- Unblocks DR-8.3 (ModulationCard attaches below LayerCard1 in the sidebar), DR-8.5 (preset strip in sidebar header), DR-8.6 (App retires Tweakpane Panel).

---

## What

- Sidebar is a `<aside data-testid="panel-root">` with class `.sidebar`, flexed to `flex: 0 0 auto; width: var(--sidebar-width)` (sidebar-width token defaults to `340px`; set inside Sidebar.module.css as a local fallback if not in tokens).
- Scrollable column: `overflow-y: auto`, `padding: var(--space-24)`, background `var(--color-bg)`.
- Inside: `<LayerCard1 />` (DR-8.2 output) + slot for `<ModulationCard />` (DR-8.3) + slot for preset strip (DR-8.5, but positioned at top via CSS grid / flex order; DR-8.2 reserves the slot with a pass-through prop or a `<header>` placeholder — actual component lands in DR-8.5).
- `LayerCard1.tsx`:
  - Wraps primitives/`LayerCard` with `title="LAYER 1"`.
  - Inner body assigns `data-testid="params-panel"` to the first child `<div>` for back-compat.
  - Three `<LayerSection>` children in order: Grid / Mosaic / Input.
- `LayerSection.tsx`:
  - Renders a `<section data-testid={testId} class={styles.section}>`.
  - Sub-header row: section name + optional trailing action (link or button).
  - Section body is a flex-column, gap `var(--space-12)`.
  - A hairline divider (`<hr />`) sits between sections.

### The 14 manifest params

From `src/effects/handTrackingMosaic/manifest.ts` — the canonical source of truth:

| # | key | type | control | section |
|---|---|---|---|---|
| 1 | `grid.seed` | integer (0 – 2147483647, step 1) | `Slider` (compact numeric input variant OK; at min pick a wide-range slider or step-numeric) | Grid |
| 2 | `grid.columnCount` | integer (4–32) | `Slider` | Grid |
| 3 | `grid.rowCount` | integer (2–24) | `Slider` | Grid |
| 4 | `grid.widthVariance` | number (0–1, step 0.01) | `Slider` | Grid |
| 5 | `grid.lineColor` | color | `ColorPicker` | Grid |
| 6 | `grid.lineWeight` | number (0.5–4, step 0.5) | `Slider` | Grid |
| 7 | `grid.randomize` | button | `Button variant="secondary"` | Grid |
| 8 | `mosaic.tileSize` | integer (4–64) | `Slider` — subscribes to same key as `CellSizePicker` | Mosaic |
| 9 | `mosaic.blendOpacity` | number (0–1, step 0.01) | `Slider` | Mosaic |
| 10 | `mosaic.edgeFeather` | number (0–8, step 0.5) | `Slider` | Mosaic |
| 11 | `effect.regionPadding` | integer (0–4) | `Slider` | Mosaic |
| 12 | `input.mirrorMode` | boolean | `Toggle` | Input |
| 13 | `input.showLandmarks` | boolean | `Toggle` | Input |
| 14 | `input.deviceId` | string (free-form) | Native `<select>` (simple list — any `enumerateDevices` output OR a single inert option). DR-8.2 allows a plain `<select>` fallback; future DR-9 may upgrade | Input |

`effect.regionPadding` lives under the Mosaic section per DR6 ("Mosaic: tile size, blend opacity, edge feather, region padding"). Note that the manifest groups it on the "Effect" page — DR6 restructures visual grouping, not the underlying key.

### Row layout (per control)

Every control renders inside a `control-row`:
```
<div class="row">
  <label class="row-label">Width variance</label>
  <div class="row-control"><Slider … /></div>
</div>
```
`.row` = flex-row, `justify-content: space-between`, `align-items: center`, `gap: var(--space-08)`, padding-block `var(--space-04)`. Labels use `var(--color-text-muted)`. Controls right-aligned.

### NOT Building (scope boundary)

- No multi-effect registry lookup; card is hardcoded for `handTrackingMosaic`.
- No "Add layer" button.
- No collapse/expand on the LAYER 1 card (always expanded per DR6).
- No preset strip yet (DR-8.5).
- No Modulation card yet (DR-8.3).
- No camera-device enumeration UI — `<select>` shows a single current-value option; enumeration is future work.

### Success Criteria

- [ ] Biome + tsc clean on all new files
- [ ] Unit: every 14 params has at least one passing test (renders + interacts)
- [ ] Unit: writes to `grid.lineColor` accept only valid hex; invalid input keeps prior value (per DR-7.5)
- [ ] Unit: `grid.randomize` button fires `onClick` from the manifest's buttonDef
- [ ] L4: `pnpm test:e2e --grep "Task DR-8.2:"` green — a single spec drives at least one control per section
- [ ] All 45 existing Phase 1–4 E2E specs still green

---

## All Needed Context

```yaml
files:
  - path: src/effects/handTrackingMosaic/manifest.ts
    why: Source of truth for all 14 params — type, min/max/step, default, onClick for button
    gotcha: Button-type params have `onClick` that writes to paramStore; do NOT duplicate logic — call it

  - path: src/engine/paramStore.ts
    why: Snapshot + set + subscribe contract; `useParam` wraps this
    gotcha: Nested key setting via dot notation — e.g. `paramStore.set('grid.seed', 42)`

  - path: src/engine/manifest.ts
    why: `ParamDef` discriminated union — use type narrowing when rendering control
    gotcha: `ButtonParamDef` has no `defaultValue` — don't crash when rendering it

  - path: src/ui/primitives/useParam.ts
    why: Subscription hook — `[value, setValue] = useParam(key)` (the generic is the KEY; value-type is inferred via `ParamValue<K>`)
    gotcha: Button params should NOT call useParam; they call def.onClick directly

  - path: src/ui/primitives/LayerCard.tsx
    why: DR-7.6 shell — title + optional action + collapsible; use non-collapsible here
    gotcha: `collapsible` false omits the chevron

  - path: src/ui/primitives/Slider.tsx
    why: DR-7.3 — supports integer + number paramDefs via min/max/step props

  - path: src/ui/primitives/Toggle.tsx
    why: DR-7.4 — boolean bool toggle w/ ARIA switch

  - path: src/ui/primitives/ColorPicker.tsx
    why: DR-7.5 — hex text + native color input

  - path: src/ui/primitives/Button.tsx
    why: DR-7.1 — secondary variant for Randomize

  - path: src/ui/CellSizePicker.tsx
    why: Reference — the toolbar picker also subscribes to `mosaic.tileSize`. Sidebar's Slider
    must STAY IN SYNC when the toolbar picker clicks a bucket (because both subscribe to the same
    paramStore key). Verify round-trip in L4.

skills:
  - custom-param-components
  - hand-tracker-fx-architecture
  - design-tokens-dark-palette
  - prp-task-ralph-loop
  - playwright-e2e-webcam
  - vitest-unit-testing-patterns

discovery:
  - DR6: Single LAYER 1 card, three sections (Grid / Mosaic / Input)
  - DR8: Sidebar hosts LAYER + Modulation cards
  - §7: Testids preserved (panel-root, params-panel) and added (layer-card-grid, layer-card-mosaic, layer-card-input)
```

### Testids (critical)

**Preserve**:
- `panel-root` — on the `<aside>` sidebar root
- `params-panel` — on the LayerCard1 body wrapper (was on Tweakpane's div; now attaches to the card body)

**Add**:
- `layer-card-grid` — on the `<section>` for Grid
- `layer-card-mosaic` — on the `<section>` for Mosaic
- `layer-card-input` — on the `<section>` for Input

### Current Codebase Tree (relevant)

```
src/
  effects/handTrackingMosaic/
    manifest.ts
  engine/
    manifest.ts
    paramStore.ts
  ui/
    primitives/
      Slider.tsx
      Segmented.tsx
      Toggle.tsx
      ColorPicker.tsx
      Button.tsx
      LayerCard.tsx
      useParam.ts
    Toolbar.tsx
    CellSizePicker.tsx
    tokens.css
```

### Desired Codebase Tree

```
src/
  ui/
    Sidebar.tsx              # CREATE
    Sidebar.module.css       # CREATE
    LayerCard1.tsx           # CREATE
    LayerRow.tsx             # CREATE (new; net-new Row helper for label+control)
    LayerRow.module.css      # CREATE
    LayerCard1.test.tsx      # CREATE
    Sidebar.test.tsx         # CREATE
tests/
  e2e/
    task-DR-8-2.spec.ts      # CREATE
```

`LayerCard` + `LayerSection` are imported from `./primitives/LayerCard` (DR-7.6 authored them). This task does NOT create a second LayerSection.

### Known Gotchas

```typescript
// CRITICAL: `grid.seed` has range 0 … 2147483647. A slider with that span is unusable
// at pixel resolution; use a narrower visible range in the Slider primitive (e.g.
// 0..65535) with keyboard step 1 — OR render a thin numeric input next to a small
// randomize-chip. Simpler: use DR-7.3's Slider with min=0, max=65535, step=1. The
// manifest's max is accepted by paramStore because the set path doesn't clamp.

// CRITICAL: `grid.lineColor` is a color ParamDef — bind to ColorPicker, not Slider.

// CRITICAL: `input.deviceId` is a string type. The sidebar ships a simple native
// <select> with one `<option value="">Default</option>` — the actual enumeration is
// DR-9 work. Do NOT crash when paramStore.snapshot.input.deviceId is ''.

// CRITICAL: `grid.randomize` is a button — render <Button onClick={def.onClick} />.
// Look up the manifest button def at render time, NOT at module load, so any future
// re-register swaps the handler.

// CRITICAL: panel-root testid MOVES from the old <Panel> container to the new
// <aside> sidebar. Existing E2E specs look for [data-testid="panel-root"] and
// expect it to be visible when state === 'GRANTED'. Keep that guarantee.

// CRITICAL: params-panel testid previously wrapped the Tweakpane div. In DR-8.2 it
// moves to LayerCard1's body <div> inside the card. Existing panel.spec.ts must
// still pass — the selector is `[data-testid="params-panel"]`, visibility is all
// that matters.

// CRITICAL: The sidebar uses CSS grid or flex-column with gap = var(--space-24).
// LayerCard1 is the first child; a slot (comment or placeholder <section />) is
// reserved for ModulationCard (DR-8.3) to land below. DO NOT add an #add-layer
// button — DR6 bans it.

// CRITICAL: Under React StrictMode the LayerCard1 mounts twice in dev. All useParam
// subscriptions must unsubscribe in their effect cleanup; DR-7.7 handles this, but
// verify via the useParam unit tests that no leak occurs on re-mount.

// CRITICAL: NO inline hex colors, NO inline pixel values. All via tokens.

// PREFLIGHT: Before implementing, run:
//   grep -rn 'panel-root' tests/e2e/ | grep -v 'toBeVisible\|toContainText\|grantPermissions'
//   grep -rn 'params-panel' tests/e2e/ | grep -v 'toBeVisible\|toContainText\|grantPermissions'
// If any chained selectors like `[data-testid="panel-root"] .tp-dfwv` show up,
// list them here and update them in the same PR (the Tweakpane DOM is going away).
```

---

## Implementation Blueprint

### Step 1: `LayerRow.tsx` (net-new helper — LayerSection already exists in DR-7.6)

```typescript
import type { JSX, ReactNode } from 'react';
import styles from './LayerRow.module.css';

export function LayerRow({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
}
```

`LayerSection` is imported directly from `./primitives/LayerCard` (DR-7.6 shape: `heading?: string`, `testid?: string`, `withDivider?: boolean`, `children`). Do NOT redeclare it. Do NOT rename `heading` → `title` or `testid` → `testId`.

### Step 2: `LayerCard1.tsx`

```typescript
import type { JSX } from 'react';
import { handTrackingMosaicManifest } from '../effects/handTrackingMosaic';
import { LayerCard, LayerSection } from './primitives/LayerCard';
import { Button } from './primitives/Button';
import { ColorPicker } from './primitives/ColorPicker';
import { Slider } from './primitives/Slider';
import { Toggle } from './primitives/Toggle';
import { useParam } from './primitives/useParam';
import { LayerRow } from './LayerRow';

export function LayerCard1(): JSX.Element {
  // Grid
  const [seed, setSeed] = useParam('grid.seed');
  const [cols, setCols] = useParam('grid.columnCount');
  const [rows, setRows] = useParam('grid.rowCount');
  const [variance, setVariance] = useParam('grid.widthVariance');
  const [lineColor, setLineColor] = useParam('grid.lineColor');
  const [lineWeight, setLineWeight] = useParam('grid.lineWeight');

  // Mosaic
  const [tileSize, setTileSize] = useParam('mosaic.tileSize');
  const [blendOpacity, setBlendOpacity] = useParam('mosaic.blendOpacity');
  const [edgeFeather, setEdgeFeather] = useParam('mosaic.edgeFeather');
  const [regionPadding, setRegionPadding] = useParam('effect.regionPadding');

  // Input
  const [mirror, setMirror] = useParam('input.mirrorMode');
  const [showLandmarks, setShowLandmarks] = useParam('input.showLandmarks');
  const [deviceId, setDeviceId] = useParam('input.deviceId');

  const randomizeDef = handTrackingMosaicManifest.params.find(
    (p) => p.type === 'button' && p.key === 'grid.randomize',
  );

  return (
    <LayerCard title="LAYER 1">
      <div data-testid="params-panel">
        <LayerSection heading="Grid" testid="layer-card-grid">
          <LayerRow label="Seed">
            <Slider min={0} max={65535} step={1} value={seed} onChange={setSeed} ariaLabel="Seed" />
          </LayerRow>
          <LayerRow label="Columns">
            <Slider min={4} max={32} step={1} value={cols} onChange={setCols} ariaLabel="Columns" />
          </LayerRow>
          <LayerRow label="Rows">
            <Slider min={2} max={24} step={1} value={rows} onChange={setRows} ariaLabel="Rows" />
          </LayerRow>
          <LayerRow label="Width variance">
            <Slider min={0} max={1} step={0.01} value={variance} onChange={setVariance} ariaLabel="Width variance" />
          </LayerRow>
          <LayerRow label="Line color">
            <ColorPicker value={lineColor} onChange={setLineColor} ariaLabel="Line color" />
          </LayerRow>
          <LayerRow label="Line weight">
            <Slider min={0.5} max={4} step={0.5} value={lineWeight} onChange={setLineWeight} ariaLabel="Line weight" />
          </LayerRow>
          <LayerRow label="">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => randomizeDef?.type === 'button' && randomizeDef.onClick()}
            >
              Randomize
            </Button>
          </LayerRow>
        </LayerSection>

        <LayerSection heading="Mosaic" testid="layer-card-mosaic">
          <LayerRow label="Tile size">
            <Slider min={4} max={64} step={1} value={tileSize} onChange={setTileSize} ariaLabel="Tile size" />
          </LayerRow>
          <LayerRow label="Blend opacity">
            <Slider min={0} max={1} step={0.01} value={blendOpacity} onChange={setBlendOpacity} ariaLabel="Blend opacity" />
          </LayerRow>
          <LayerRow label="Edge feather">
            <Slider min={0} max={8} step={0.5} value={edgeFeather} onChange={setEdgeFeather} ariaLabel="Edge feather" />
          </LayerRow>
          <LayerRow label="Region padding">
            <Slider min={0} max={4} step={1} value={regionPadding} onChange={setRegionPadding} ariaLabel="Region padding" />
          </LayerRow>
        </LayerSection>

        <LayerSection heading="Input" testid="layer-card-input">
          <LayerRow label="Mirror">
            <Toggle checked={mirror} onChange={setMirror} ariaLabel="Mirror" />
          </LayerRow>
          <LayerRow label="Show landmarks">
            <Toggle checked={showLandmarks} onChange={setShowLandmarks} ariaLabel="Show landmarks" />
          </LayerRow>
          <LayerRow label="Camera device">
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              aria-label="Camera device"
            >
              <option value="">Default</option>
            </select>
          </LayerRow>
        </LayerSection>
      </div>
    </LayerCard>
  );
}
```

### Step 3: `Sidebar.tsx`

```typescript
import type { JSX, ReactNode } from 'react';
import { LayerCard1 } from './LayerCard1';
import styles from './Sidebar.module.css';

export type SidebarProps = {
  presetStripSlot?: ReactNode; // filled by DR-8.5
  modulationSlot?: ReactNode;  // filled by DR-8.3
};

export function Sidebar({ presetStripSlot, modulationSlot }: SidebarProps): JSX.Element {
  return (
    <aside className={styles.sidebar} data-testid="panel-root">
      {presetStripSlot ? <div className={styles.header}>{presetStripSlot}</div> : null}
      <LayerCard1 />
      {modulationSlot ?? null}
    </aside>
  );
}
```

### Step 4: CSS — `Sidebar.module.css` + `LayerRow.module.css`

```css
/* Sidebar.module.css */
.sidebar {
  flex: 0 0 340px;
  min-width: 340px;
  display: flex;
  flex-direction: column;
  gap: var(--space-24);
  padding: var(--space-24);
  background: var(--color-bg);
  overflow-y: auto;
  font-family: var(--font-family);
  color: var(--color-text-primary);
}
.header { flex: 0 0 auto; }
```

```css
/* LayerRow.module.css — row-level styling only. Section-level CSS lives with the DR-7.6 LayerSection primitive. */
.row { display: flex; justify-content: space-between; align-items: center; gap: var(--space-08); padding-block: var(--space-04); }
.rowLabel { color: var(--color-text-muted); }
.rowControl { min-width: 9.2rem; display: flex; justify-content: flex-end; }
```

### Step 5: Unit tests

- `LayerCard1.test.tsx`
  - Mount with a fresh paramStore seeded to `DEFAULT_PARAM_STATE`
  - Assert every 14 param has a rendered control (by label or testid)
  - Interact: change 3 sliders, 1 toggle, 1 color, 1 button; verify paramStore mutations + set-of-expected-keys
- `Sidebar.test.tsx`
  - Renders `panel-root`; renders LayerCard1 inside; accepts optional slots and renders them

### Step 6: E2E test

```typescript
import { test, expect } from '@playwright/test';

test.describe('Task DR-8.2: all 14 params mutable via sidebar', () => {
  test('sidebar sections visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="camera-state"]')?.textContent === 'GRANTED',
    );
    await expect(page.getByTestId('panel-root')).toBeVisible();
    await expect(page.getByTestId('params-panel')).toBeVisible();
    await expect(page.getByTestId('layer-card-grid')).toBeVisible();
    await expect(page.getByTestId('layer-card-mosaic')).toBeVisible();
    await expect(page.getByTestId('layer-card-input')).toBeVisible();
  });

  test('driving a Grid slider mutates paramStore', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="camera-state"]')?.textContent === 'GRANTED',
    );
    // Target the widthVariance slider by its row label
    const row = page.getByTestId('layer-card-grid').getByText('Width variance').locator('..');
    const slider = row.getByRole('slider');
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    const v = await page.evaluate(() => (window as any).__handTracker?.__engine?.getParam('grid.widthVariance'));
    expect(v).toBeGreaterThan(0.6);
  });

  test('toolbar CellSizePicker and sidebar tile-size slider stay in sync', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="camera-state"]')?.textContent === 'GRANTED',
    );
    await page.getByTestId('toolbar-cell-picker').getByText('L', { exact: true }).click();
    const v = await page.evaluate(() => (window as any).__handTracker?.__engine?.getParam('mosaic.tileSize'));
    expect(v).toBe(32);
    // Sidebar row reflects the change (aria-valuenow or role=slider value)
    const row = page.getByTestId('layer-card-mosaic').getByText('Tile size').locator('..');
    await expect(row.getByRole('slider')).toHaveAttribute('aria-valuenow', '32');
  });
});
```

---

## Validation Loop

### Level 1

```bash
pnpm biome check src/ui/Sidebar.tsx src/ui/Sidebar.module.css src/ui/LayerCard1.tsx src/ui/LayerRow.tsx src/ui/LayerRow.module.css src/ui/LayerCard1.test.tsx src/ui/Sidebar.test.tsx
pnpm tsc --noEmit
```

### Level 2

```bash
pnpm vitest run src/ui/LayerCard1.test.tsx src/ui/Sidebar.test.tsx
pnpm vitest run
```

### Level 3

```bash
pnpm build
```

### Level 4

```bash
pnpm test:setup
pnpm test:e2e --grep "Task DR-8.2:"
pnpm test:e2e --grep "phase-4-regression"
pnpm test:e2e --grep "panel.spec"
```

---

## Final Validation Checklist

### Technical
- [ ] All 4 levels exit 0
- [ ] `grep -E '#[0-9a-fA-F]{3,6}' src/ui/Sidebar.* src/ui/LayerCard1.* src/ui/LayerRow.*` empty
- [ ] `[data-testid="panel-root"]` and `[data-testid="params-panel"]` visible in GRANTED state
- [ ] All 3 section testids visible

### Feature
- [ ] All 14 manifest params have a rendered control
- [ ] Changing Grid → Seed (via keyboard ArrowRight) mutates paramStore
- [ ] CellSizePicker and sidebar tile-size slider share state
- [ ] `Randomize` button rolls `grid.seed`
- [ ] `Mirror` toggle flips stage mirror

### Code Quality
- [ ] No `any` types
- [ ] No reading from `paramStore.snapshot` in render — only `useParam`
- [ ] LayerCard1 is hardcoded for handTrackingMosaic (no generic multi-effect lookup)

---

## Anti-Patterns

- Do not paint control values by reading `paramStore.snapshot.grid.seed` in render — always `useParam`.
- Do not place tile-size in Grid section; it lives in Mosaic (DR6).
- Do not wire the modulation card or preset strip in this task — they have their own tasks.
- Do not style with inline `style={{ color: '#...' }}` — always tokens.
- Do not forget `panel-root` + `params-panel` testids — 45 existing E2E specs depend on them.

---

## No Prior Knowledge Test

- [ ] Every cited file exists (manifest.ts, paramStore.ts, useParam.ts, Slider.tsx, …)
- [ ] DR-numbers cited exist (DR6, DR8, §7)
- [ ] Validation commands copy-paste runnable
- [ ] All 14 param keys enumerated above
- [ ] Sync-with-toolbar E2E case specified

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
