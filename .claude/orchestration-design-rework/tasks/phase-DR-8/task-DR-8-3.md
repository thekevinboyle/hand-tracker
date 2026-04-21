# Task DR-8.3: ModulationCard

**Phase**: DR-8 — Chrome Integration
**Branch**: `task/DR-8-3-modulation-card`
**Commit prefix**: `Task DR-8.3:`
**Estimated complexity**: Large
**Max Ralph iterations**: 30

---

## Goal

**Feature Goal**: Build the collapsible `ModulationCard` that renders below the LAYER 1 card in the sidebar. It lists every current `modulationStore` route with inline controls that replace the Tweakpane folder-per-route UI. A "+ Add route" button at the bottom adds a new route to the store. The imperative Tweakpane-driven builder (`src/ui/ModulationPanel.ts`) is deleted.

**Deliverable**:
- `src/ui/ModulationCard.tsx` + `ModulationCard.module.css` — collapsible card, lists routes, + Add-route button
- `src/ui/ModulationRow.tsx` + `ModulationRow.module.css` — per-route inline controls
- `src/ui/ModulationCard.test.tsx` + `src/ui/ModulationRow.test.tsx` — unit coverage
- **DELETE** `src/ui/ModulationPanel.ts`
- `tests/e2e/task-DR-8-3.spec.ts` — Playwright L4

**Success Definition**: `ModulationCard` renders `modulationStore.getSnapshot().routes` with one row per route. Each row exposes: enabled toggle, source dropdown (21 landmarks × 2 axes + pinch + centroid.x + centroid.y = 45 options), target-param dropdown, input-range slider (range variant), output-range slider (range variant), curve dropdown, bezier editor for `cubicBezier` curve, delete link. The card is collapsed by default; chevron toggles it. A "+ Add route" button seeds a new route via `modulationStore.upsertRoute`. Integration with `src/ui/Sidebar.tsx`'s `modulationSlot` prop lands the card just below LAYER 1.

---

## User Persona

**Target User**: Creative technologist building a modulation graph — wants to see all routes at once without clicking into folders.

**Use Case**: User expands the Modulation card, sees two existing routes from the default baseline (D13 seeds two). Clicks the enabled toggle on route 1 → mosaic tile size stops reacting to fingertip X. Clicks "+ Add route" → a new row appears bound to landmark[8].x → mosaic.tileSize with linear curve. Changes the curve dropdown to "Cubic Bezier" → the bezier editor appears inline. Drags the bezier control points. Pressing "Delete" removes the row.

**User Journey**:
1. App is GRANTED, sidebar visible, LAYER 1 card expanded.
2. Below LAYER 1, the MODULATION card is collapsed by default — header shows "MODULATION" + chevron + count.
3. User clicks the chevron; the card body animates open (300ms height + 500ms content opacity).
4. Two existing routes render, each with inline `enabled / source / target / inputRange / outputRange / curve / delete`.
5. User adds a route → a third row appears at the bottom; paramStore updates per frame as the hand moves.
6. User switches the curve to "Cubic Bezier" on route 3 → an inline cubic-bezier editor appears with 4 draggable control points.
7. User deletes route 3 → row disappears, modulationStore emits a snapshot change.

**Pain Points Addressed**: Tweakpane's folder pattern hid each route behind a click; the new card shows everything at once.

---

## Why

- DR8 — Modulation is a collapsible card in the sidebar, same visual pattern as LAYER 1 card.
- DR3 — Replace Tweakpane entirely; retire `src/ui/ModulationPanel.ts`.
- D14 — Five curve options: Linear, Ease In, Ease Out, Ease In-Out, Cubic Bezier.
- D15 — 45 modulation sources: 21 landmarks × 2 axes (= 42) + pinch + centroid.x + centroid.y.
- Depends on tokens (DR-6.1), all primitives (DR-7.1..7.7). Depends on DR-8.2 (Sidebar exposes `modulationSlot`).
- Unblocks DR-8.6 (no Tweakpane-dependent code left) and DR-8.R regression.

---

## What

- `ModulationCard` wraps `primitives/LayerCard` with `title="MODULATION"` and `collapsible`.
- Header shows `MODULATION` + route count `"({n})"` in muted text.
- Body contains one `<ModulationRow />` per route + a "+ Add route" button (secondary variant).
- Collapsed state persists across mounts via a module-level boolean (no localStorage; reset on reload is fine).
- `ModulationRow` is a compact flex-row that expands into a second line when `curve === 'cubicBezier'` so the bezier editor has room.
- Per-row controls:
  - **Enabled** — `Toggle`
  - **Source** — native `<select>` with the 45 options from `modulationSources` in the manifest
  - **Target param** — native `<select>` populated from `handTrackingMosaicManifest.params` filtered to `type !== 'button'` + dotted key as value
  - **Input range** — `RangeSlider` (DR-7.3 variant) min=-1 max=2 step=0.01
  - **Output range** — `RangeSlider` min=-100 max=200 step=0.5
  - **Curve** — native `<select>` with 5 options
  - **Bezier editor** — inline svg editor when curve is `cubicBezier`; 4 draggable handles for control points; updates `bezierControlPoints: [x1,y1,x2,y2]`
  - **Delete** — `Button variant="text"` with label "Delete"
- Every change calls `modulationStore.upsertRoute({ ...route, <field>: next })` or `modulationStore.deleteRoute(route.id)`. The card subscribes via `useSyncExternalStore` pointing at `modulationStore`.
- "+ Add route" inserts a new route: `{ id: crypto.randomUUID(), enabled: true, source: 'landmark[8].x', targetParam: 'mosaic.tileSize', inputRange: [0,1], outputRange: [4,64], curve: 'linear' }` (same defaults as retired ModulationPanel.ts).

### Testid scheme

- `modulation-card` — on the card root
- `modulation-route-${n}` — on each row (n is the zero-based index, re-indexed on snapshot change)

### Deletions

- **DELETE** `src/ui/ModulationPanel.ts` — retired imperative Tweakpane builder
- `src/ui/Panel.tsx` still imports it; for DR-8.3 we temporarily replace the import with a no-op call site OR drop the mount (Panel.tsx is scheduled for deletion in DR-8.6, but DR-8.3 must ship without breaking build). The safer path: **keep Panel.tsx mounted but stop calling `buildModulationPage(pane)` inside it** — the ModulationCard now owns the modulation UI. DR-8.6 deletes Panel.tsx entirely. If this intermediate step causes type errors, add a comment `// Task DR-8.3: modulation UI moved to ModulationCard` and remove the import.

### NOT Building (scope boundary)

- No drag-reorder of routes (future).
- No per-route name / label editing (derived from source→target string).
- No save-to-preset UI in this card — existing preset flow handles it.
- No MIDI learn / LFO sources (out of scope per DISCOVERY §8).
- No analytics on route add/delete.

### Success Criteria

- [ ] Biome + tsc clean on all new files
- [ ] Unit: 15+ test cases (snapshot render, add, delete, edit each field, subscribe/unsubscribe, StrictMode double-mount)
- [ ] L4: `pnpm test:e2e --grep "Task DR-8.3:"` — drives a route that maps `landmark[8].x → mosaic.tileSize` and asserts the snapshot reflects the change
- [ ] `src/ui/ModulationPanel.ts` no longer exists (or is empty + no longer imported)
- [ ] All 45 existing Phase 1–4 E2E specs still green — specifically `phase-4-regression.spec.ts` which exercises modulation

---

## All Needed Context

```yaml
files:
  - path: src/engine/modulationStore.ts
    why: Source of truth — getSnapshot / subscribe / upsertRoute / deleteRoute / replaceRoutes
    gotcha: Snapshot is a READONLY object — always create a new route object when mutating

  - path: src/engine/modulation.ts
    why: ModulationRoute + ModulationSourceId + DEFAULT_MODULATION_ROUTES types + D13 defaults
    gotcha: `bezierControlPoints` is [number, number, number, number] optional

  - path: src/ui/ModulationPanel.ts
    why: REFERENCE ONLY — the retired imperative Tweakpane version. Read for the SOURCE_OPTIONS + CURVE_OPTIONS constants before deleting.
    gotcha: `crypto.randomUUID()` was used in its add-route handler — replicate here

  - path: src/effects/handTrackingMosaic/manifest.ts
    why: Source of targetParam options — every non-button ParamDef's key is a valid targetParam
    gotcha: Include `grid.randomize` — NO. Button params are not modulation targets; filter out

  - path: src/ui/primitives/Slider.tsx
    why: DR-7.3 ships a RangeSlider variant for two-thumb ranges
    gotcha: Min/max passed at call site; the inputRange slider is wider (-1, 2) than the outputRange variant (-100, 200)

  - path: src/ui/primitives/LayerCard.tsx
    why: DR-7.6 shell with collapsible prop; ModulationCard uses collapsible=true

  - path: src/ui/primitives/Toggle.tsx
    why: DR-7.4 — enabled toggle

  - path: src/ui/primitives/Button.tsx
    why: DR-7.1 — text variant for Delete, secondary for + Add route

  - path: src/ui/Sidebar.tsx (from DR-8.2)
    why: Accepts `modulationSlot?: ReactNode`; App.tsx will pass <ModulationCard /> in DR-8.6. For DR-8.3 validation, render ModulationCard directly inside a dev route or mount it into Sidebar's slot via App.tsx patch (minimal).

skills:
  - custom-param-components
  - hand-tracker-fx-architecture
  - design-tokens-dark-palette
  - prp-task-ralph-loop
  - playwright-e2e-webcam
  - vitest-unit-testing-patterns

discovery:
  - DR3: Replace Tweakpane entirely
  - DR8: Modulation card in sidebar, collapsible, below LAYER 1
  - D14: 5 curve options
  - D15: 45 modulation sources
```

### Testids

**Add**:
- `modulation-card`
- `modulation-route-${n}`

### Current Codebase Tree (relevant)

```
src/
  engine/
    modulation.ts
    modulationStore.ts
  ui/
    ModulationPanel.ts           # DELETE in this task
    Panel.tsx                    # MODIFY — stop calling buildModulationPage; keep Tweakpane params for now
    Sidebar.tsx
    primitives/
      LayerCard.tsx
      Slider.tsx
      Toggle.tsx
      Button.tsx
```

### Desired Codebase Tree

```
src/
  ui/
    ModulationCard.tsx            # CREATE
    ModulationCard.module.css     # CREATE
    ModulationRow.tsx             # CREATE
    ModulationRow.module.css      # CREATE
    BezierEditor.tsx              # CREATE
    BezierEditor.module.css       # CREATE
    ModulationCard.test.tsx       # CREATE
    ModulationRow.test.tsx        # CREATE
    BezierEditor.test.tsx         # CREATE (≥ 6 unit tests — drag math, keyboard, reduced-motion)
    Panel.tsx                     # MODIFY — remove import + call of buildModulationPage
    ModulationPanel.ts            # DELETE
    Sidebar.tsx                   # MODIFY if needed — wire modulationSlot
tests/
  e2e/
    task-DR-8-3.spec.ts           # CREATE
```

### Known Gotchas

```typescript
// CRITICAL: Subscribe to modulationStore via useSyncExternalStore, not useEffect+setState.
// The snapshot is a stable object reference — safe for the hook's identity check.
//
//   const snapshot = useSyncExternalStore(
//     modulationStore.subscribe,
//     modulationStore.getSnapshot,
//     modulationStore.getSnapshot, // server snapshot (jsdom — same)
//   );

// CRITICAL: The "+ Add route" button uses crypto.randomUUID() — polyfill-free in modern
// browsers + node 25. In jsdom tests this is available; no mock needed.

// CRITICAL: When curve changes AWAY from 'cubicBezier', do NOT clear bezierControlPoints.
// Preserve them so flipping back shows the previous curve shape. The evaluator only
// reads bezierControlPoints when curve === 'cubicBezier', so leaving them stale is
// harmless.

// CRITICAL: Target-param dropdown lists every non-button manifest param. Display the
// label but use the dotted key as the option value. Button params filtered out.

// CRITICAL: Deleting a row triggers modulationStore.deleteRoute(id) — the snapshot
// update re-renders with one fewer row. Do NOT animate the exit in DR-8.3; keep it
// instant. (A future task can add exit animations respecting reduced-motion.)

// CRITICAL: The bezier editor is a small inline SVG with 4 draggable points that
// write into bezierControlPoints = [x1, y1, x2, y2]. Normalize to [0,1] for x1/x2;
// allow overshoot [-1,2] for y1/y2 (matches CSS cubic-bezier conventions). Use
// pointermove + setPointerCapture for drag. Respect reduced-motion: no "snap"
// animations.

// CRITICAL: Panel.tsx currently imports + calls buildModulationPage — BREAK the
// import cleanly. If TS complains about a dangling `disposeModulation` variable, just
// delete that useEffect block in Panel.tsx (modulation is NOT in Tweakpane anymore).
// DR-8.6 will delete Panel.tsx entirely.

// CRITICAL: The card's collapsed/expanded state can live in a module-level
// `let isExpanded = false` + notify function, OR as local React state inside
// ModulationCard. DO NOT put it in paramStore — it's not a preset-participating
// value.

// CRITICAL: The testid `modulation-route-${n}` uses the ARRAY INDEX, not the route
// id — this matches DISCOVERY §7 ("modulation-route-${n}"). Re-index on every
// snapshot change. This is tested in L4 — adding then deleting a route must
// re-number the remaining rows from 0.

// CRITICAL: Biome will complain about complex SVG JSX; split the bezier editor
// into a sub-component to keep cyclomatic complexity low.
```

---

## Implementation Blueprint

### Step 1: Constants — `ModulationRow.tsx` top

```typescript
import { handTrackingMosaicManifest } from '../effects/handTrackingMosaic';

const SOURCE_OPTIONS: Array<{ value: string; label: string }> = (() => {
  const out: Array<{ value: string; label: string }> = [];
  for (let i = 0; i < 21; i++) {
    out.push({ value: `landmark[${i}].x`, label: `Landmark ${i} X` });
    out.push({ value: `landmark[${i}].y`, label: `Landmark ${i} Y` });
  }
  out.push({ value: 'pinch', label: 'Pinch strength' });
  out.push({ value: 'centroid.x', label: 'Hand centroid X' });
  out.push({ value: 'centroid.y', label: 'Hand centroid Y' });
  return out;
})();

const CURVE_OPTIONS = [
  { value: 'linear', label: 'Linear' },
  { value: 'easeIn', label: 'Ease In' },
  { value: 'easeOut', label: 'Ease Out' },
  { value: 'easeInOut', label: 'Ease In-Out' },
  { value: 'cubicBezier', label: 'Cubic Bezier' },
] as const;

const TARGET_OPTIONS = handTrackingMosaicManifest.params
  .filter((p) => p.type !== 'button')
  .map((p) => ({ value: p.key, label: p.label }));
```

### Step 2: `ModulationRow.tsx`

```typescript
import type { JSX } from 'react';
import type { ModulationRoute } from '../engine/modulation';
import { modulationStore } from '../engine/modulationStore';
import { Button } from './primitives/Button';
import { RangeSlider } from './primitives/Slider';
import { Toggle } from './primitives/Toggle';
import { BezierEditor } from './BezierEditor';
import styles from './ModulationRow.module.css';

export type ModulationRowProps = {
  route: ModulationRoute;
  index: number;
};

export function ModulationRow({ route, index }: ModulationRowProps): JSX.Element {
  const update = (patch: Partial<ModulationRoute>): void => {
    modulationStore.upsertRoute({ ...route, ...patch });
  };
  return (
    <div className={styles.row} data-testid={`modulation-route-${index}`}>
      <div className={styles.primary}>
        <Toggle
          checked={route.enabled}
          onChange={(v) => update({ enabled: v })}
          ariaLabel="Enabled"
        />
        <select
          value={route.source}
          onChange={(e) => update({ source: e.target.value as ModulationRoute['source'] })}
          aria-label="Source"
        >
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span aria-hidden>→</span>
        <select
          value={route.targetParam}
          onChange={(e) => update({ targetParam: e.target.value })}
          aria-label="Target param"
        >
          {TARGET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <RangeSlider min={-1} max={2} step={0.01} value={route.inputRange}
          onChange={(v) => update({ inputRange: v })} ariaLabel="Input range" />
        <RangeSlider min={-100} max={200} step={0.5} value={route.outputRange}
          onChange={(v) => update({ outputRange: v })} ariaLabel="Output range" />
        <select
          value={route.curve}
          onChange={(e) => update({ curve: e.target.value as ModulationRoute['curve'] })}
          aria-label="Curve"
        >
          {CURVE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <Button variant="text" size="sm" onClick={() => modulationStore.deleteRoute(route.id)}>
          Delete
        </Button>
      </div>
      {route.curve === 'cubicBezier' ? (
        <BezierEditor
          value={route.bezierControlPoints ?? [0.5, 0, 0.5, 1]}
          onChange={(cp) => update({ bezierControlPoints: cp })}
        />
      ) : null}
    </div>
  );
}
```

### Step 3: `BezierEditor` (sub-component, inline in ModulationRow.tsx or own file `BezierEditor.tsx`)

- 120×80 SVG
- Two control points drawn as small squares; two end points anchored at (0,1) and (1,0)
- Pointer drag mutates [x1, y1, x2, y2]
- Normalize x1/x2 to [0,1]; clamp. Allow y1/y2 in [-1, 2] for overshoot.
- `setPointerCapture` on mousedown; release on mouseup
- Keyboard: focus → ArrowKeys step by 0.01

### Step 4: `ModulationCard.tsx`

```typescript
import type { JSX } from 'react';
import { useSyncExternalStore } from 'react';
import { modulationStore } from '../engine/modulationStore';
import { LayerCard } from './primitives/LayerCard';
import { Button } from './primitives/Button';
import { ModulationRow } from './ModulationRow';
import styles from './ModulationCard.module.css';

export function ModulationCard(): JSX.Element {
  const snapshot = useSyncExternalStore(
    modulationStore.subscribe,
    modulationStore.getSnapshot,
    modulationStore.getSnapshot,
  );
  const routes = snapshot.routes;

  function addRoute(): void {
    modulationStore.upsertRoute({
      id: crypto.randomUUID(),
      enabled: true,
      source: 'landmark[8].x',
      targetParam: 'mosaic.tileSize',
      inputRange: [0, 1],
      outputRange: [4, 64],
      curve: 'linear',
    });
  }

  return (
    <div data-testid="modulation-card">
      <LayerCard title="MODULATION" collapsible defaultCollapsed action={<span className={styles.count}>({routes.length})</span>}>
        <div className={styles.list}>
          {routes.map((r, i) => (
            <ModulationRow key={r.id} route={r} index={i} />
          ))}
        </div>
        <div className={styles.footer}>
          <Button variant="secondary" size="sm" onClick={addRoute}>+ Add route</Button>
        </div>
      </LayerCard>
    </div>
  );
}
```

### Step 5: Delete `src/ui/ModulationPanel.ts`

- Remove the file
- Remove the import from `src/ui/Panel.tsx`
- Delete the `buildModulationPage(pane)` call inside Panel.tsx's useEffect — leave the effect building the effect-params portion. Modulation UI now lives in `ModulationCard`.

### Step 6: Unit tests

`ModulationCard.test.tsx`:
- Renders with empty store → no rows + Add button visible
- Seeds store with 2 routes → 2 rows visible, testids `modulation-route-0` and `modulation-route-1`
- Click + Add route → store has 3 routes; third row visible
- Click Delete on middle row → store has 2 routes; remaining rows re-indexed 0..1
- StrictMode double-mount → no duplicate subscribers (spy via `vi.fn()` on subscribe return)

`ModulationRow.test.tsx`:
- Toggle enabled → upsertRoute called with enabled toggled
- Change source → upsertRoute called with new source
- Change curve to cubicBezier → BezierEditor renders
- Change curve back to linear → BezierEditor unmounts; bezierControlPoints preserved on the route object
- Click Delete → deleteRoute called with route id

### Step 7: E2E test

```typescript
import { test, expect } from '@playwright/test';

test.describe('Task DR-8.3: modulation route drives tileSize', () => {
  test('card collapsed by default, expand then add route', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="camera-state"]')?.textContent === 'GRANTED',
    );
    const card = page.getByTestId('modulation-card');
    await expect(card).toBeVisible();
    // Default collapsed — rows are visually hidden but present in DOM is OK per design;
    // expand via the header chevron (role button)
    await card.getByRole('button', { name: /modulation/i }).click();
    // Click + Add route
    await card.getByRole('button', { name: '+ Add route' }).click();
    // New row appears with next index — use DOM count via testid pattern (modulationSnapshot is not on the dev hook)
    const count = await page.getByTestId(/^modulation-route-\d+$/).count();
    await expect(await page.getByTestId(`modulation-route-${count - 1}`)).toBeVisible();
  });

  test('modulating landmark[8].x → mosaic.tileSize drives tileSize', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="camera-state"]')?.textContent === 'GRANTED',
    );
    // Default routes include landmark[8].x → mosaic.tileSize per D13
    // After a few frames, tileSize should have drifted from default 16
    await page.waitForTimeout(500);
    const v = await page.evaluate(() => (window as any).__handTracker?.__engine?.getParam('mosaic.tileSize'));
    expect(v).toBeGreaterThan(4);
    expect(v).toBeLessThanOrEqual(64);
  });
});
```

---

## Validation Loop

### Level 1

```bash
pnpm biome check src/ui/ModulationCard.tsx src/ui/ModulationCard.module.css src/ui/ModulationRow.tsx src/ui/ModulationRow.module.css src/ui/ModulationCard.test.tsx src/ui/ModulationRow.test.tsx src/ui/Panel.tsx
pnpm tsc --noEmit
# Confirm retired file removed:
test ! -f src/ui/ModulationPanel.ts
```

### Level 2

```bash
pnpm vitest run src/ui/ModulationCard.test.tsx src/ui/ModulationRow.test.tsx
pnpm vitest run
```

### Level 3

```bash
pnpm build
```

### Level 4

```bash
pnpm test:setup
pnpm test:e2e --grep "Task DR-8.3:"
pnpm test:e2e --grep "phase-4-regression"
```

---

## Final Validation Checklist

### Technical
- [ ] All 4 levels exit 0
- [ ] `src/ui/ModulationPanel.ts` removed
- [ ] `grep -r 'ModulationPanel' src/ui/` returns zero hits
- [ ] `testids modulation-card + modulation-route-0..n-1` visible

### Feature
- [ ] Card collapsed by default; chevron toggles
- [ ] Snapshot → render is reactive via `useSyncExternalStore`
- [ ] Add route inserts new default-shaped route
- [ ] Delete re-indexes remaining rows
- [ ] Cubic Bezier curve toggles the inline editor
- [ ] Existing phase-4-regression spec still green

### Code Quality
- [ ] No `any`; all event values cast at boundary
- [ ] No reading paramStore.snapshot in this card (modulationStore is the data source)
- [ ] Biome clean, no inline hex / px literals

---

## Anti-Patterns

- Do not reuse `ModulationPanel.ts`'s imperative Tweakpane patterns in the React card.
- Do not subscribe via `useEffect + setState` — use `useSyncExternalStore`.
- Do not clear `bezierControlPoints` on curve switch.
- Do not mutate `modulationStore` directly — only through `upsertRoute` / `deleteRoute`.
- Do not put collapse state in paramStore.

---

## No Prior Knowledge Test

- [ ] Cited files exist (modulationStore.ts, ModulationPanel.ts, LayerCard.tsx, Slider.tsx, Toggle.tsx, Button.tsx, manifest.ts)
- [ ] DR/D numbers exist (DR3, DR8, D13, D14, D15, §7)
- [ ] Deletion explicit: `src/ui/ModulationPanel.ts`
- [ ] Validation includes test-for-no-file and panel-tsx-import cleanup
- [ ] Testids enumerated

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
