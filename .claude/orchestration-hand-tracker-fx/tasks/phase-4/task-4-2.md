# Task 4.2: CubicBezier Blade + Modulation Panel UI

**Phase**: 4 — Modulation, Presets, Record, A11y
**Branch**: `task/4-2-modulation-panel-ui`
**Commit prefix**: `Task 4.2:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Build the Tweakpane "Modulation" page that renders one collapsible folder per ModulationRoute with Enabled / Source / Target / Input-range / Output-range / Curve / CubicBezier controls, wiring every edit back to `modulationStore.upsertRoute()`.

**Deliverable**: `src/ui/ModulationPanel.ts` (imperative Tweakpane builder) + optional `src/ui/ModulationPanel.test.ts` (blade event sanity).

**Success Definition**: `pnpm tsc --noEmit` clean; opening the Modulation tab in the app shows one folder per default route; changing the Curve selector from "Linear" to "Cubic Bezier" reveals a draggable bezier editor; dragging the curve updates `modulationStore.getSnapshot().routes[N].bezierControlPoints` observably.

---

## User Persona

**Target User**: Creative technologist tweaking the feel of a route — "make the tileSize ramp steeper at low x values."

**Use Case**: User opens the panel, switches to the Modulation tab, finds the `landmark[8].x → mosaic.tileSize` folder, changes Curve → Cubic Bezier, drags the curve endpoints, sees the live effect respond to the new easing.

**User Journey**:
1. Open panel (Phase 2 chrome).
2. Click "Modulation" tab.
3. Expand "Route: landmark[8].x → mosaic.tileSize".
4. Change output-range max from 64 → 32 via interval blade.
5. See tileSize now maxes at 32 when finger is fully right.
6. Change curve → cubicBezier, drag handles, see non-linear response.

**Pain Points Addressed**: Without this UI, the default routes are immutable and cubic bezier curves are not editable.

---

## Why

- Fulfills D14 (user-configurable modulation) — without this, D14 is aspirational only.
- Unblocks full preset value (Task 4.3) — presets store modulationRoutes; users need to edit them to have meaningful presets.
- Demonstrates the @tweakpane/plugin-essentials CubicBezier blade, which the project has committed to (D19, D30).

---

## What

- "Modulation" tab page added to the existing Pane built by `buildPaneFromManifest`.
- One `addFolder` per route, title = `Route: {source} → {targetParam}`.
- Per-folder controls: Enabled (checkbox), Source (dropdown of all ModulationSourceIds), Target (dropdown of all modulatable params from the manifest), Input range (interval blade, min=-1, max=2, step=0.01), Output range (interval blade, bounds from the target ParamDef), Curve (dropdown), CubicBezier (blade, always present but only meaningful when curve==='cubicBezier').
- "Add route" button at the top of the page.
- Every change dispatches `modulationStore.upsertRoute()`.
- Folder disposal cleaned up on unmount.

### NOT Building (scope boundary)

- No modulation evaluator changes (Task 4.1 owns the math).
- No preset Save/Load UI (Task 4.3).
- No MIDI source support.
- No per-param "under modulation" green tint (explicitly deferred in research § Pitfalls).
- No drag-to-reorder routes.

### Success Criteria

- [ ] `pnpm biome check src/ui/ModulationPanel.ts` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] Clicking Curve → Cubic Bezier makes the CubicBezier blade visually prominent
- [ ] Changing any control fires `modulationStore.upsertRoute()` exactly once (verified via spy in a unit or manual test)
- [ ] Adding a route via the "Add route" button inserts into `modulationStore.getSnapshot().routes`
- [ ] Disposing the pane cleans up all route folders (no dangling bindings)

---

## All Needed Context

```yaml
files:
  - path: src/engine/modulation.ts
    why: Source of ModulationRoute + ModulationSourceId types; DEFAULT_MODULATION_ROUTES for initial render
    gotcha: Do not duplicate types — import from modulation.ts only

  - path: src/engine/modulationStore.ts
    why: `getSnapshot()`, `subscribe()`, `upsertRoute()`, `deleteRoute()` API consumed by this panel
    gotcha: subscribe() returns an unsubscribe function — capture it for cleanup

  - path: src/effects/handTrackingMosaic/manifest.ts
    why: Enumerates modulatable params for the Target dropdown (only params with `modulatable: true` in ParamDef)
    gotcha: Filter to numeric params — dropdowns and colors are not valid modulation targets

  - path: src/ui/Panel.tsx
    why: The React component that mounts the Pane; this task adds a call to `buildModulationPage(pane)` inside its useEffect
    gotcha: Panel.tsx uses useEffect with StrictMode-safe cleanup; the modulation page builder must also be teardown-safe

  - path: src/engine/buildPaneFromManifest.ts
    why: MIRROR file — same imperative-builder signature (pane + dispose)
    gotcha: Plugins (EssentialsPlugin) must be registered on the pane BEFORE the `cubicbezier` blade is added

urls:
  - url: https://github.com/tweakpane/plugin-essentials
    why: CubicBezier blade view name is 'cubicbezier' (lowercase, no hyphen); Interval blade view is 'interval'
    critical: The plugin must be registered via `pane.registerPlugin(EssentialsPlugin)` before any blade is added

  - url: https://tweakpane.github.io/docs/ui-components/
    why: addFolder(), addBlade(), addBinding() API and `dispose()` semantics
    critical: Disposing the pane disposes children transitively; do NOT dispose folders manually after a pane.dispose() call

skills:
  - tweakpane-params-presets
  - hand-tracker-fx-architecture
  - vitest-unit-testing-patterns

discovery:
  - D14: User-configurable modulation — source, input range, output param, output range, easing curve
  - D19: Tweakpane 4 + Essentials plugin
  - D20: paramStore is plain object; no React state in hot path
```

### Current Codebase Tree

```
src/
  engine/
    modulation.ts                 # Task 4.1
    modulationStore.ts            # Phase 2
    buildPaneFromManifest.ts      # Phase 2
  effects/handTrackingMosaic/
    manifest.ts                   # has ParamDef list
  ui/
    Panel.tsx                     # React host for Pane
```

### Desired Codebase Tree

```
src/
  ui/
    ModulationPanel.ts            # CREATE — buildModulationPage(pane) + addRouteControls(folder, route)
    ModulationPanel.test.ts       # CREATE (optional, L2) — shallow blade event test
  ui/
    Panel.tsx                     # MODIFY — call buildModulationPage(pane) inside useEffect
```

### Known Gotchas

```typescript
// CRITICAL: CubicBezier blade emits `ev.value` as [number, number, number, number]
// but Tweakpane's TS type is `unknown`. Cast explicitly:
//   bezierBlade.on('change', (ev) => {
//     const cp = ev.value as [number, number, number, number]
//   })
// Do NOT `any`-cast; use a narrow typed alias.

// CRITICAL: Interval blade emits `ev.value` as `{ min: number; max: number }`.
// Use a typed interface or cast once at the boundary.

// CRITICAL: Folders persist across modulationStore changes.
// When routes[] changes (add/delete), teardown and rebuild the page section
// inside a `modulationStore.subscribe()` callback. Track each folder's dispose().

// CRITICAL: Plugin registration order matters. Register EssentialsPlugin BEFORE
// calling `addBlade({ view: 'cubicbezier' })` or Tweakpane throws at runtime.

// CRITICAL: React StrictMode runs the mount effect twice. The `buildModulationPage`
// call is wrapped by Panel.tsx's useEffect; its returned dispose() MUST clear the
// subscribe handle AND dispose every created folder. Never accumulate listeners.

// CRITICAL: Do not call `paneRef.refresh()` inside the blade change handler.
// Tweakpane already reflects the binding target value; refresh is only needed
// after programmatic store mutations (preset load — Task 4.3).

// CRITICAL: No React state in the render hot path. This panel builds DOM imperatively
// under Tweakpane; the only React touchpoint is the outer <div> container ref.

// CRITICAL: Biome v2, pnpm, no 'use client'. Standard rules.
```

---

## Implementation Blueprint

### Data Models

No new types — consumes `ModulationRoute` + `ModulationSourceId` from `src/engine/modulation.ts`.

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE src/ui/ModulationPanel.ts
  - IMPLEMENT: |
      export function buildModulationPage(pane: Pane): () => void
      export function addRouteControls(container: FolderApi, route: ModulationRoute): () => void
  - DETAILS:
      - buildModulationPage creates a TabPage "Modulation" if using tabs, else a top-level folder.
      - Inside: iterate modulationStore.getSnapshot().routes; for each, call addRouteControls(folder, route).
      - Subscribe to modulationStore; on change, teardown old route folders and rebuild.
      - Add an "Add route" button (pane.addButton) at the top that inserts a new route with a fresh crypto.randomUUID() id.
      - Return a dispose function that unsubscribes + disposes all folders + disposes the page container.
  - MIRROR: src/engine/buildPaneFromManifest.ts (same dispose-pattern signature)
  - NAMING: camelCase functions, imperative builders
  - GOTCHA: Register EssentialsPlugin at pane construction (buildPaneFromManifest already does this in Phase 2 — verify and do not double-register)
  - VALIDATE: pnpm biome check src/ui/ModulationPanel.ts && pnpm tsc --noEmit

Task 2: MODIFY src/ui/Panel.tsx
  - FIND: the existing useEffect that calls buildPaneFromManifest
  - ADD: after pane construction, call `const disposeModulation = buildModulationPage(pane)`
  - ADD: in the cleanup, call `disposeModulation()` BEFORE `pane.dispose()`
  - PRESERVE: existing mount/unmount sequence and error handling
  - VALIDATE: pnpm tsc --noEmit

Task 3: CREATE src/ui/ModulationPanel.test.ts (optional but recommended)
  - IMPLEMENT: mock Tweakpane Pane with vi.fn() stubs; assert that buildModulationPage
               adds N folders for N default routes and that blade change handlers
               call modulationStore.upsertRoute exactly once per change.
  - MOCK: vi.mock('tweakpane', () => ({ Pane: class { ... stubs ... } }))
  - VALIDATE: pnpm vitest run src/ui/ModulationPanel.test.ts
```

### Integration Points

```yaml
MODULATION_STORE:
  - pattern: modulationStore.subscribe(rebuildFolders) for structural changes (add/delete route)
  - pattern: modulationStore.upsertRoute({ ...route, field: newValue }) for blade edits

PANE:
  - pattern: pane.addFolder({ title: `Route: ${route.source} → ${route.targetParam}` })
  - pattern: folder.addBinding(obj, key, opts).on('change', handler)
  - pattern: folder.addBlade({ view: 'cubicbezier', value: cp, label: 'Bezier', picker: 'inline' })
  - pattern: folder.addBlade({ view: 'interval', label: 'Output range', min, max, step, value: { min, max } })
```

### Concrete Code Sketch

```typescript
// src/ui/ModulationPanel.ts (reference — Ralph must produce equivalent type-clean code)

import type { FolderApi, Pane } from 'tweakpane'
import {
  modulationStore,
} from '../engine/modulationStore'
import type {
  ModulationRoute,
  ModulationSourceId,
} from '../engine/modulation'

type IntervalChangeEvent = { value: { min: number; max: number } }
type BezierChangeEvent = { value: [number, number, number, number] }

export function addRouteControls(
  container: FolderApi,
  route: ModulationRoute,
): () => void {
  const folder = container.addFolder({
    title: `Route: ${route.source} → ${route.targetParam}`,
    expanded: false,
  })

  const enabledObj = { enabled: route.enabled }
  folder
    .addBinding(enabledObj, 'enabled', { label: 'Enabled' })
    .on('change', ({ value }: { value: boolean }) => {
      modulationStore.upsertRoute({ ...route, enabled: value })
    })

  const curveObj = { curve: route.curve }
  folder
    .addBinding(curveObj, 'curve', {
      label: 'Curve',
      options: {
        Linear: 'linear',
        'Ease In': 'easeIn',
        'Ease Out': 'easeOut',
        'Ease In-Out': 'easeInOut',
        'Cubic Bezier': 'cubicBezier',
      },
    })
    .on('change', ({ value }: { value: string }) => {
      modulationStore.upsertRoute({
        ...route,
        curve: value as ModulationRoute['curve'],
      })
    })

  const cp: [number, number, number, number] =
    route.bezierControlPoints ?? [0.5, 0, 0.5, 1]
  const bezierBlade = folder.addBlade({
    view: 'cubicbezier',
    value: cp,
    expanded: false,
    label: 'Bezier Curve',
    picker: 'inline',
  })
  bezierBlade.on('change', (ev: BezierChangeEvent) => {
    modulationStore.upsertRoute({ ...route, bezierControlPoints: ev.value })
  })

  folder
    .addBlade({
      view: 'interval',
      label: 'Output range',
      min: -100,
      max: 200,
      step: 0.5,
      value: { min: route.outputRange[0], max: route.outputRange[1] },
    })
    .on('change', (ev: IntervalChangeEvent) => {
      modulationStore.upsertRoute({
        ...route,
        outputRange: [ev.value.min, ev.value.max],
      })
    })

  return () => folder.dispose()
}

export function buildModulationPage(pane: Pane): () => void {
  const container = pane.addFolder({ title: 'Modulation', expanded: true })
  let disposers: Array<() => void> = []

  function rebuild() {
    disposers.forEach((d) => d())
    disposers = modulationStore
      .getSnapshot()
      .routes.map((r) => addRouteControls(container, r))
  }

  rebuild()
  const unsubscribe = modulationStore.subscribe(rebuild)

  container
    .addButton({ title: '+ Add route' })
    .on('click', () => {
      modulationStore.upsertRoute({
        id: crypto.randomUUID(),
        enabled: true,
        source: 'landmark[8].x' as ModulationSourceId,
        targetParam: 'mosaic.tileSize',
        inputRange: [0, 1],
        outputRange: [4, 64],
        curve: 'linear',
      })
    })

  return () => {
    unsubscribe()
    disposers.forEach((d) => d())
    container.dispose()
  }
}
```

---

## Validation Loop

### Level 1 — Syntax & Style

```bash
pnpm biome check src/ui/ModulationPanel.ts src/ui/ModulationPanel.test.ts src/ui/Panel.tsx
pnpm tsc --noEmit
```

### Level 2 — Unit Tests

```bash
pnpm vitest run src/ui/ModulationPanel.test.ts
pnpm vitest run
```

### Level 3 — Integration (production build)

```bash
pnpm build
```

### Level 4 — E2E (optional; satisfied by Task 4.R)

```bash
pnpm test:e2e --grep "Task 4.2:"
```

If no Playwright test exists with that grep, mark L4 N/A and rely on Task 4.R regression.

---

## Final Validation Checklist

### Technical

- [ ] All 4 validation levels exit 0 (L4 may be N/A)
- [ ] `pnpm biome check .` — zero errors
- [ ] `pnpm tsc --noEmit` — zero errors
- [ ] `pnpm build` — success

### Feature

- [ ] Opening the Modulation folder shows one sub-folder per default route
- [ ] Curve dropdown reveals all 5 options
- [ ] Dragging the Bezier curve fires `upsertRoute` with new `bezierControlPoints`
- [ ] "+ Add route" button appends a route with a unique id
- [ ] Disposing the pane removes all DOM under the Modulation folder

### Code Quality

- [ ] No `any` types
- [ ] No React state used for modulation data (data flows via modulationStore)
- [ ] Subscribe unsubscribe called in dispose
- [ ] MIRROR pattern followed — matches buildPaneFromManifest shape

---

## Anti-Patterns

- Do not duplicate `ModulationRoute` type locally — import it.
- Do not call `pane.refresh()` inside blade change handlers.
- Do not skip `EssentialsPlugin` registration — cubicbezier blade throws without it.
- Do not store routes in React state — they live in `modulationStore`.
- Do not leak folder references after dispose.
- Do not use `crypto.randomUUID()` inside a render hot path — only in the Add Route button handler.

---

## No Prior Knowledge Test

- [ ] Every referenced file exists (Phase 2 deliverables confirmed in codebase)
- [ ] Every D-number cited exists in DISCOVERY.md (D14, D19, D20)
- [ ] All blade view names are correct strings (`'cubicbezier'`, `'interval'`)
- [ ] Validation commands are copy-paste runnable
- [ ] Task does not depend on Tasks 4.3/4.4/4.5/4.6

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/tweakpane-params-presets/SKILL.md
```
