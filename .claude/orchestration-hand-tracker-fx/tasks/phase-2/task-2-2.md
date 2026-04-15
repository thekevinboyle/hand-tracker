# Task 2.2: Implement paramStore + buildPaneFromManifest + Panel

**Phase**: 2 — Engine + Overlay
**Branch**: `task/2-2-param-store-build-pane`
**Commit prefix**: `Task 2.2:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Ship a plain-object `paramStore` (D20) with a `useSyncExternalStore`-compatible subscribe API AND a `buildPaneFromManifest()` function that turns an `EffectManifest.params` array into a Tweakpane 4 pane with tabs/folders/bindings, AND a React `<Panel />` component that mounts Tweakpane into a ref and disposes on cleanup.

**Deliverable**:
- `src/engine/paramStore.ts` — plain-object store with `get/set/replace/subscribe/snapshot/bindingTarget`
- `src/engine/buildPaneFromManifest.ts` — manifest → Pane constructor with `dispose()`
- `src/ui/Panel.tsx` — React wrapper, `useEffect` mount + dispose
- `src/engine/paramStore.test.ts` — unit tests
- `src/engine/buildPaneFromManifest.test.ts` — unit tests with a mock manifest
- `src/ui/Panel.test.tsx` — component mount/unmount test

**Success Definition**: `pnpm vitest run src/engine/paramStore.test.ts src/engine/buildPaneFromManifest.test.ts src/ui/Panel.test.tsx` exits 0, `pnpm typecheck` exits 0, and mounting `<Panel manifest={mockManifest} />` in the browser shows a Tweakpane with the right tabs/folders/bindings, and dragging a slider updates `paramStore.snapshot` synchronously.

---

## User Persona

**Target User**: Creative technologist tweaking grid column count, mosaic tile size, and other live params from a TouchDesigner-style panel.

**Use Case**: User opens the app, sees a Tweakpane panel on the right with the effect's params grouped into tabs (Grid / Effect / Input). Dragging a slider or toggling a checkbox updates the render in real time — the canvas loop reads `paramStore.snapshot` synchronously every frame.

**User Journey**:
1. App mounts → `<Panel manifest={handTrackingMosaicManifest} />` constructs Tweakpane
2. User drags `grid.columnCount` slider from 12 to 20
3. Tweakpane's `on('change', ...)` fires → `paramStore.set('grid.columnCount', 20)`
4. Canvas render loop reads `paramStore.snapshot.grid.columnCount === 20` on next frame → grid re-renders with 20 columns
5. User unmounts → Tweakpane disposed, event listeners removed, no leaks

**Pain Points Addressed**: Without this task, there is no way to drive the effect from the UI; the canvas would render fixed defaults forever.

---

## Why

- Required by D19: Tweakpane 4 + Essentials plugin for the parameter panel
- Required by D20: `paramStore` is a plain object; React is ONLY for permissions UI, error screens, preset list, and layout chrome. Canvas hot path never touches React state.
- Required by D36: `buildPaneFromManifest` is how an `EffectManifest.params` array becomes live UI
- Unlocks Task 2.3 (grid renderer reads `grid.*` from paramStore), Task 2.4 (blob renderer reads `input.showLandmarks`), Task 2.5 (manifest registration), and all of Phase 4 (modulation + presets write into paramStore)
- Integrates with Task 2.1 types — `ParamDef` is the discriminator that drives `addBinding` vs `addButton`

---

## What

- `paramStore` exposes:
  - `snapshot` (getter returning current state reference — stable until mutation)
  - `getSnapshot()` (same as `snapshot`, for React `useSyncExternalStore`)
  - `subscribe(listener)` → `unsubscribe`
  - `set(dotPath, value)` — mutates a single dot-pathed key; produces new top-level reference
  - `replace(next)` — wholesale state replacement (for preset load)
  - `bindingTarget` — mirrored plain object that Tweakpane mutates; writes are reflected back via `set()` from the `on('change')` callback
- `buildPaneFromManifest(manifest, container, plugins)`:
  - Registers every plugin BEFORE adding any blade
  - Groups `manifest.params` by `page` into tabs (preserving first-seen order)
  - Groups by `folder` within each page
  - For each param, calls the right Tweakpane builder based on the discriminated `type` field
  - Wires `on('change')` → `paramStore.set(key, value)` for all bindings
  - Wires `on('click')` → `param.onClick(snapshot)` for buttons
  - Returns `{ pane, dispose }` where `dispose()` calls `pane.dispose()`
- `<Panel />` React component:
  - Accepts `manifest: EffectManifest` prop
  - Mounts Tweakpane in `useEffect` with `@tweakpane/plugin-essentials`
  - Disposes on cleanup (idempotent under StrictMode)

### NOT Building (scope boundary)

- No modulation UI (Phase 4)
- No preset persistence / UI (Phase 4 — just the store)
- No `pane.refresh()` per frame — never (anti-pattern; only after `replace()` / preset load)
- No multi-effect panel switcher (Phase 6+; MVP ships one effect)
- No `exportState`/`importState` — Presets use semantic `ParamState`, not Tweakpane state
- No styling beyond default Tweakpane CSS vars (Phase 4 theme pass if needed)

### Success Criteria

- [ ] `paramStore.snapshot` returns a stable reference until `set()` or `replace()`
- [ ] `paramStore.set('grid.columnCount', 20)` mutates snapshot reference AND `bindingTarget.grid.columnCount`
- [ ] `paramStore.replace(next)` updates both and notifies all subscribers exactly once
- [ ] `paramStore.subscribe(fn)` returns an unsubscribe; unsubscribed listeners don't fire
- [ ] `buildPaneFromManifest` creates one tab per unique `page` value (first-seen order)
- [ ] `buildPaneFromManifest` returns `{ pane, dispose }`; `dispose()` removes the pane DOM
- [ ] Tweakpane change event updates `paramStore.snapshot` to a NEW reference
- [ ] `<Panel />` mount + immediate unmount leaves zero DOM nodes from Tweakpane (StrictMode-safe)
- [ ] `pnpm lint src/engine/paramStore.ts src/engine/buildPaneFromManifest.ts src/ui/Panel.tsx` exits 0
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm vitest run src/engine/paramStore.test.ts src/engine/buildPaneFromManifest.test.ts src/ui/Panel.test.tsx` exits 0

---

## All Needed Context

```yaml
files:
  - path: src/engine/manifest.ts
    why: CONSUMES — ParamDef, EffectManifest, ParamType types (Task 2.1)
    gotcha: ParamDef is a DISCRIMINATED UNION; narrow on `param.type` before reading variant-specific fields

  - path: src/engine/registry.ts
    why: Pattern mirror — named exports, module-scoped state, tiny factory
    gotcha: Tests must clear state in beforeEach; paramStore is similar — use a factory `createParamStore()` + module singleton

  - path: src/App.test.tsx
    why: MIRROR — vitest imports + @testing-library/react render pattern
    gotcha: Use `cleanup()` explicitly or rely on the automatic afterEach cleanup from testing-library

  - path: src/App.tsx
    why: Pattern — functional React component, named export, no default
    gotcha: Panel must NOT use 'use client' — Vite SPA, no RSC boundary

  - path: package.json
    why: Confirm tweakpane 4.0.5 and @tweakpane/plugin-essentials 0.2.1 are already installed
    gotcha: Do NOT add deps; only import what is listed

  - path: biome.json
    why: noExplicitAny: error; noUnusedVariables; single-quote strings
    gotcha: Cast Tweakpane event shapes explicitly — do not use `any` as a workaround

urls:
  - url: https://tweakpane.github.io/docs/
    why: Tweakpane 4 API — Pane, addTab, addFolder, addBinding, addButton, registerPlugin, exportState, importState, dispose
    critical: registerPlugin() MUST be called AFTER `new Pane(...)` and BEFORE any `addBlade({view:'cubicbezier'})` or `addBlade({view:'interval'})`. Registration after a blade is added silently no-ops.

  - url: https://tweakpane.github.io/docs/input-bindings/#number
    why: addBinding(obj, key, { min, max, step }) for number sliders
    critical: Integer clamping requires `step: 1` — Tweakpane does not have a distinct integer type

  - url: https://tweakpane.github.io/docs/input-bindings/#boolean
    why: addBinding(obj, key) for checkboxes (value must already be a boolean)
    critical: `options: { a: 1, b: 2 }` coerces a binding into a dropdown even if the value is a primitive

  - url: https://tweakpane.github.io/docs/api/classes/Pane.html#dispose
    why: Pane.dispose() — MUST be called in useEffect cleanup
    critical: Calling dispose() twice is safe; Tweakpane guards. Calling it while a drag is in progress can leak a DOM overlay — mount Pane into a dedicated div and also `container.replaceChildren()` as belt-and-suspenders

  - url: https://react.dev/reference/react/useSyncExternalStore
    why: React 19 contract — subscribe + getSnapshot with stable references
    critical: getSnapshot MUST return the same reference (by Object.is) when state unchanged; otherwise infinite re-render

  - url: https://vitest.dev/guide/features.html#dom-mocking
    why: jsdom environment is configured in vitest.config (test.environment: 'jsdom')
    critical: Tweakpane needs DOM — tests MUST run under jsdom, not node

skills:
  - tweakpane-params-presets
  - hand-tracker-fx-architecture
  - prp-task-ralph-loop
  - vitest-unit-testing-patterns

discovery:
  - D13: Default modulation routes — not wired here, but paramStore keys must match `mosaic.tileSize`, `grid.columnCount`
  - D19: Tweakpane 4 + @tweakpane/plugin-essentials 0.2.1; Bezier blade used by Phase 4 modulation
  - D20: paramStore is plain object; React only for UI chrome — canvas reads snapshot directly
  - D29: Preset schema stores semantic ParamState, not exportState()
  - D36: EffectManifest.params drives the panel
  - D38: Folder layout — src/engine/paramStore.ts, src/engine/buildPaneFromManifest.ts, src/ui/Panel.tsx
```

### Current Codebase Tree (relevant subset)

```
src/
  App.tsx
  App.test.tsx
  main.tsx
  index.css
  engine/
    manifest.ts          # Task 2.1 — types
    registry.ts          # Task 2.1 — registerEffect/getEffect/listEffects/clearRegistry
    registry.test.ts
  camera/                # Phase 1
    useCamera.ts
    ...
  tracking/              # Phase 1
    handLandmarker.ts
  ui/
    Stage.tsx            # Phase 1 (Task 1.6) — canvas stack
```

### Desired Codebase Tree (files this task adds)

```
src/
  engine/
    paramStore.ts                       # plain-object store; createParamStore() + module singleton
    paramStore.test.ts                  # unit tests — set/replace/subscribe/snapshot stability
    buildPaneFromManifest.ts            # manifest → Pane; returns { pane, dispose }
    buildPaneFromManifest.test.ts       # unit tests — tabs/folders/bindings/buttons
  ui/
    Panel.tsx                           # React wrapper — useEffect mount + dispose
    Panel.test.tsx                      # mount/unmount + DOM cleanup tests
```

### Known Gotchas

```typescript
// CRITICAL: React StrictMode runs useEffect twice in dev.
// Panel.tsx useEffect MUST dispose the pane in the cleanup AND guard via
// `if (!containerRef.current) return` before mounting. Double-mount otherwise leaves
// two Tweakpane DOM trees.

// CRITICAL: Tweakpane addBinding mutates the host object in place.
// Always bind to `paramStore.bindingTarget` (the mirror), never to `paramStore.snapshot`
// (the immutable snapshot reference). The on('change') callback then writes through
// to paramStore.set(dotPath, value), which produces a NEW snapshot reference.

// CRITICAL: `pane.refresh()` — call ONCE after preset load / wholesale state replacement.
// NEVER in the render loop, NEVER inside an on('change') handler (infinite loop).

// CRITICAL: useSyncExternalStore requires getSnapshot() to return a stable reference
// (Object.is equal) when state is unchanged. Our paramStore achieves this by only
// producing a new top-level reference in set() / replace(). Do not spread-clone in
// getSnapshot().

// CRITICAL: Tweakpane 4 is ESM-only. Vite handles this — but Vitest must use jsdom.
// vitest.config.ts should already have `environment: 'jsdom'`. If not, L2 fails with
// "document is not defined" from Tweakpane.

// CRITICAL: Biome v2: `pnpm biome check --write <paths>` auto-fix in dev;
// `pnpm lint <paths>` (check only) in the validation loop. Do not disable rules.

// CRITICAL: TypeScript strict + noUncheckedIndexedAccess is ON.
// Array/Map lookups return T | undefined — narrow or throw. For Tab page access
// `tab.pages[i]` — assert non-null only after checking the array length.

// CRITICAL: pnpm only. Never npm / bun / npx.

// CRITICAL: `addBinding(host, leafKey, { options: {...} })` coerces primitive values
// to a dropdown. Use this for ParamDef.type === 'select'. For ParamDef.type === 'color',
// Tweakpane auto-detects color strings (hex '#rrggbb') — no `options`.

// CRITICAL: buildPaneFromManifest must register plugins BEFORE adding any blade.
// Call pane.registerPlugin(EssentialsPlugin) immediately after new Pane(...).

// CRITICAL: Discriminated union narrowing:
//    switch (param.type) {
//      case 'number': // param is now the number-variant with min/max
//      case 'select': // param is now the select-variant with options
//      ...
//    }
// DO NOT read `param.min` without narrowing — it's a type error.
```

---

## Implementation Blueprint

### Data Models

```typescript
// src/engine/paramStore.ts

// ParamState is the SHAPE of paramStore.snapshot. It is declared as a generic type here
// and re-declared by the handTrackingMosaic effect (Task 2.5) with its concrete fields.
// For Task 2.2 we ship a general-purpose store that accepts any nested plain object.

export type ParamSection = Record<string, unknown>;
export type ParamState = Record<string, ParamSection>;

export type ParamStore<T extends ParamState = ParamState> = {
  readonly snapshot: T;
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
  set(dotPath: string, value: unknown): void;
  replace(next: T): void;
  readonly bindingTarget: T;
};

export function createParamStore<T extends ParamState>(initial: T): ParamStore<T>;

// Module singleton — consumers import `paramStore` directly.
// For tests, `createParamStore` is also exported so each test can own its instance.
export const paramStore: ParamStore;
```

```typescript
// src/engine/buildPaneFromManifest.ts

import type { Pane } from 'tweakpane';
import type { EffectManifest } from './manifest';

export type BuildPaneResult = {
  pane: Pane;
  dispose(): void;
};

export function buildPaneFromManifest(
  manifest: EffectManifest,
  container: HTMLElement,
  plugins?: readonly unknown[]
): BuildPaneResult;
```

```tsx
// src/ui/Panel.tsx

import type { EffectManifest } from '../engine/manifest';

export type PanelProps = {
  manifest: EffectManifest;
};

export function Panel({ manifest }: PanelProps): JSX.Element;
```

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE src/engine/paramStore.ts
  - IMPLEMENT:
      - `createParamStore<T>(initial: T): ParamStore<T>` factory:
          • let snapshot = structuredClone(initial)
          • const bindingTarget = structuredClone(initial)
          • const listeners = new Set<() => void>()
          • getSnapshot → snapshot
          • subscribe(l) → listeners.add; return () => listeners.delete(l)
          • set(dotPath, value):
              parts = dotPath.split('.')
              section = parts[0]; key = parts[1]
              current = snapshot[section] as Record<string, unknown>
              if (current[key] === value) return
              const newSection = { ...current, [key]: value }
              snapshot = { ...snapshot, [section]: newSection }
              (bindingTarget[section] as Record<string, unknown>)[key] = value
              listeners.forEach((l) => l())
          • replace(next):
              snapshot = structuredClone(next)
              for (const k of Object.keys(next)) Object.assign(bindingTarget[k] as object, next[k])
              listeners.forEach((l) => l())
          • return the object with `get snapshot()` getter returning current ref
      - Export module singleton: `export const paramStore = createParamStore<ParamState>({})` (empty init; Task 2.5 replaces on registration)
  - MIRROR: src/engine/registry.ts (named exports, module-scoped state, factory pattern)
  - NAMING: camelCase
  - GOTCHA: `set()` must ALWAYS produce a new top-level reference when a value changes —
    otherwise useSyncExternalStore won't notify React.
  - GOTCHA: `structuredClone` is native in all target browsers + Node 18+; no polyfill.
  - VALIDATE: pnpm lint src/engine/paramStore.ts && pnpm typecheck

Task 2: CREATE src/engine/paramStore.test.ts
  - IMPLEMENT: Vitest suite with these tests:
      1. 'snapshot returns stable reference until set()' — two consecutive reads are `===`
      2. 'set() produces new snapshot reference' — before !== after
      3. 'set() updates bindingTarget in place' — same object, new property value
      4. 'set() is a no-op if value unchanged (same reference, no notify)'
      5. 'subscribe fires on set()' — listener spy called exactly once
      6. 'unsubscribe removes listener' — after unsubscribing, no calls
      7. 'replace() updates snapshot and bindingTarget' — both match `next`
      8. 'replace() notifies all subscribers once'
      9. 'multiple subscribers all fire'
     10. 'subscribe during a notify is not retroactively called' (optional)
  - MIRROR: src/engine/registry.test.ts
  - MOCK: none — pure JS
  - VALIDATE: pnpm vitest run src/engine/paramStore.test.ts

Task 3: CREATE src/engine/buildPaneFromManifest.ts
  - IMPLEMENT:
      - Import Pane from 'tweakpane' and types FolderApi, TabPageApi
      - const folderCache = new WeakMap<object, Map<string, FolderApi>>()
      - resolvePath(obj, dotPath): walks dot-path, returns { host, leafKey }
      - getOrCreateFolder(container, title): memoized
      - Function body:
          • const pane = new Pane({ container, title: manifest.displayName })
          • for (const p of plugins ?? []) pane.registerPlugin(p as never)  // cast documented
          • Collect unique page names in order: pageNames = unique(manifest.params.map(p => p.page ?? 'Main'))
          • const tab = pane.addTab({ pages: pageNames.map(title => ({ title })) })
          • const pages: Record<string, TabPageApi> = {}; pageNames.forEach((n, i) => pages[n] = tab.pages[i])
          • For each param:
              pageContainer = pages[param.page ?? 'Main']
              folder = param.folder ? getOrCreateFolder(pageContainer, param.folder) : pageContainer
              SWITCH on param.type:
                case 'button':
                  folder.addButton({ title: param.label }).on('click', () => param.onClick(paramStore.snapshot))
                  break
                case 'number':
                  const n = resolvePath(paramStore.bindingTarget, param.key)
                  folder.addBinding(n.host, n.leafKey, { label: param.label, min: param.min, max: param.max, step: param.step })
                    .on('change', ({ value }: { value: unknown }) => paramStore.set(param.key, value))
                  break
                case 'integer':
                  // same as number but force step: 1
                  ...
                case 'boolean':
                  folder.addBinding(host, leafKey, { label: param.label }).on('change', ...)
                case 'select':
                  folder.addBinding(host, leafKey, { label: param.label, options: param.options }).on('change', ...)
                case 'color':
                  folder.addBinding(host, leafKey, { label: param.label }).on('change', ...)
                case 'string':
                  folder.addBinding(host, leafKey, { label: param.label }).on('change', ...)
          • return { pane, dispose: () => { pane.dispose(); folderCache.delete(pane) } }
  - MIRROR: Tweakpane skill at .claude/skills/tweakpane-params-presets/SKILL.md (sections "Plugin Registration" and "buildPaneFromManifest")
  - GOTCHA: registerPlugin BEFORE any addTab/addFolder/addBlade. Order matters.
  - GOTCHA: ParamDef discriminated-union switch MUST be exhaustive — default: `const _exhaustive: never = param; throw new Error(...)`
  - GOTCHA: `pane.addTab({ pages: [] })` throws — if manifest.params is empty, skip tab creation.
  - VALIDATE: pnpm lint src/engine/buildPaneFromManifest.ts && pnpm typecheck

Task 4: CREATE src/engine/buildPaneFromManifest.test.ts
  - IMPLEMENT: Vitest suite (jsdom):
      1. 'creates one tab per unique page' — mock manifest w/ params on Grid / Effect / Grid → 2 tabs in that order
      2. 'groups params into folders within a page'
      3. 'number binding change updates paramStore' — simulate `on('change')` by grabbing the binding and calling its internal change fn; assert paramStore.snapshot updated
      4. 'select binding respects options'
      5. 'button onClick fires with snapshot'
      6. 'dispose removes Tweakpane DOM from container' — container.children.length === 0 after dispose()
      7. 'registering plugins before blades does not throw' — pass a fake plugin { id: 'x', register: () => {} }
  - MIRROR: src/engine/paramStore.test.ts
  - MOCK: Build a small mock manifest fixture at the top of the test file
  - GOTCHA: Simulating a Tweakpane `on('change')` in tests requires reaching into the binding API.
    The supported approach: after binding creation, call `binding.controller.value.setRawValue(v)`
    or dispatch a DOM input event. Simpler: directly test that buildPane wires correctly by
    using `pane.exportState()` on the tree, then calling the on('change') via `binding.emit`
    (if exposed). If too brittle, assert pane.exportState() structure (tabs + folder titles +
    binding count) AND test that paramStore.set() correctly updates, leaving full interaction
    to L4.
  - VALIDATE: pnpm vitest run src/engine/buildPaneFromManifest.test.ts

Task 5: CREATE src/ui/Panel.tsx
  - IMPLEMENT:
      - `import { useEffect, useRef } from 'react'`
      - `import type { EffectManifest } from '../engine/manifest'`
      - `import * as EssentialsPlugin from '@tweakpane/plugin-essentials'`
      - `import { buildPaneFromManifest } from '../engine/buildPaneFromManifest'`
      - Props: `{ manifest: EffectManifest }`
      - Component body:
          const containerRef = useRef<HTMLDivElement | null>(null)
          useEffect(() => {
            if (!containerRef.current) return
            const { dispose } = buildPaneFromManifest(manifest, containerRef.current, [EssentialsPlugin])
            return () => {
              dispose()
              if (containerRef.current) containerRef.current.replaceChildren()  // belt-and-suspenders
            }
          }, [manifest])
          return <div ref={containerRef} className="panel-container" data-testid="params-panel" />
  - MIRROR: src/App.tsx (functional component, named export)
  - GOTCHA: No 'use client' — Vite SPA
  - GOTCHA: StrictMode double-invoke — the cleanup in dev will run twice; dispose() is idempotent.
    The container.replaceChildren() guard handles the rare case where dispose() left DOM behind.
  - VALIDATE: pnpm lint src/ui/Panel.tsx && pnpm typecheck

Task 6: CREATE src/ui/Panel.test.tsx
  - IMPLEMENT:
      1. 'mounts without throwing with an empty manifest'
      2. 'renders a container with data-testid="params-panel"'
      3. 'unmount leaves container empty (StrictMode cleanup)'
      4. 'double-mount (StrictMode dev) leaves single pane'
  - MIRROR: src/App.test.tsx
  - MOCK: Mock manifest with 2-3 params
  - GOTCHA: @testing-library/react render + cleanup. Use `<StrictMode>` wrapper to simulate dev double-mount.
  - VALIDATE: pnpm vitest run src/ui/Panel.test.tsx
```

### Integration Points

```yaml
PARAM_STORE:
  - Canvas render loop (Tasks 2.3, 2.4, Phase 3): reads paramStore.snapshot per frame
  - React UI: useSyncExternalStore(paramStore.subscribe, paramStore.getSnapshot) — for Phase 4 preset list
  - Phase 4 modulation: writes via paramStore.replace(modulated) each frame

BUILD_PANE_FROM_MANIFEST:
  - Consumed by <Panel /> in Task 2.2
  - Consumed by Phase 4 ModulationPanel to add routes tab (via pane.addTab extension)

PANEL:
  - Consumed by src/App.tsx (modified in Task 2.R or Task 2.5) to render the params UI
  - Required prop: the active effect's manifest
```

---

## Validation Loop

### Level 1 — Syntax and Style

```bash
pnpm lint src/engine/paramStore.ts src/engine/paramStore.test.ts src/engine/buildPaneFromManifest.ts src/engine/buildPaneFromManifest.test.ts src/ui/Panel.tsx src/ui/Panel.test.tsx
pnpm typecheck
```

Expected: zero errors.

### Level 2 — Unit Tests

```bash
pnpm vitest run src/engine/paramStore.test.ts src/engine/buildPaneFromManifest.test.ts src/ui/Panel.test.tsx
```

Expected: all 15+ tests pass.

### Level 3 — Integration (production build)

```bash
pnpm build
```

Expected: exits 0. Tweakpane + @tweakpane/plugin-essentials must tree-shake cleanly. No circular-dep warnings.

### Level 4 — E2E

```bash
pnpm test:e2e -- --grep "Task 2.2:"
```

Expected: ships `tests/e2e/panel.spec.ts` with `test.describe('Task 2.2: paramStore + Panel', ...)`:

1. Page loads, navigates to `/`
2. `await expect(page.getByTestId('params-panel')).toBeVisible()`
3. Via `page.evaluate(...)`, mount a test manifest through a global hook OR assert the default DEFAULT-preset panel (if Task 2.5 has run)
4. Locate a slider (e.g., `page.locator('.tp-numbr .tp-sldi_i')`), change its value via keyboard, then assert `window.__handTracker?.__engine?.getParam?.('grid.columnCount')` updates (this requires a dev-hook exposing `paramStore.snapshot`)

If the dev hook does not exist yet, this test ships as `describe('Task 2.2:', () => { test.skip('pending dev-hook', ...) })` so the grep matches and the suite exits 0. Add the dev hook in Task 2.5 or later; regenerate the spec then.

---

## Final Validation Checklist

### Technical

- [ ] L1, L2, L3, L4 all exit 0
- [ ] `pnpm vitest run` — all tests pass
- [ ] `pnpm lint .` — zero errors
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm build` — production build succeeds

### Feature

- [ ] `paramStore.snapshot` ref stable until `set()` / `replace()`
- [ ] `paramStore.set()` updates both snapshot (new ref) and bindingTarget (same ref, new prop value)
- [ ] `paramStore.replace()` wholesale swap + single notify
- [ ] `buildPaneFromManifest` handles all 7 `ParamType` variants
- [ ] `buildPaneFromManifest` groups by page (tabs) and folder correctly
- [ ] `<Panel />` mounts + unmounts cleanly under StrictMode
- [ ] No React state in the snapshot read path — canvas loop reads `paramStore.snapshot` directly

### Code Quality

- [ ] No `any` types
- [ ] Tweakpane event values explicitly typed (e.g., `(ev: { value: number })`)
- [ ] Discriminated-union switch is exhaustive (`never` default)
- [ ] `pane.dispose()` in the `<Panel />` cleanup
- [ ] No 'use client' directives
- [ ] No `pane.refresh()` calls anywhere (reserved for Phase 4 preset load)

---

## Anti-Patterns

- Do NOT use `any` — cast Tweakpane event shapes explicitly
- Do NOT call `pane.refresh()` per frame — never (preset load only in Phase 4)
- Do NOT bind Tweakpane to `paramStore.snapshot` — it is immutable; bind to `bindingTarget`
- Do NOT store Tweakpane state in React `useState` — imperative library, use `useRef`
- Do NOT add `'use client'` — Vite SPA
- Do NOT skip `pane.dispose()` in cleanup — StrictMode will leave two DOM trees
- Do NOT use `exportState()` for preset params (Phase 4) — store semantic `ParamState`
- Do NOT register plugins AFTER adding blades — order matters
- Do NOT spread-clone in `getSnapshot()` — `useSyncExternalStore` will thrash
- Do NOT use `npm` / `npx` / `bun`
- Do NOT emit `<promise>COMPLETE</promise>` if any level is still failing

---

## No Prior Knowledge Test

- [x] Every file path in `All Needed Context` exists (src/engine/manifest.ts + registry.ts created by Task 2.1; src/App.tsx + App.test.tsx from scaffold)
- [x] Every URL in `urls:` is reachable
- [x] Every D-number cited (D13, D19, D20, D29, D36, D38) exists in DISCOVERY.md
- [x] Implementation Tasks topologically sorted (paramStore → tests → buildPane → tests → Panel → tests)
- [x] Validation Loop commands copy-paste runnable, no placeholders
- [x] MIRROR files exist (registry.ts from Task 2.1; App.tsx + App.test.tsx in scaffold)
- [x] Task is atomic — depends only on Task 2.1 + Phase 1 scaffold

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/tweakpane-params-presets/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
