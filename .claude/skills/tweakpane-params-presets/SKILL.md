---
name: tweakpane-params-presets
description: Use when implementing or extending the parameters panel, modulation routes, or preset persistence in Hand Tracker FX. Tweakpane v4 + Essentials, plain-object paramStore + useSyncExternalStore, CHOP-style modulation with bezier curves, versioned Preset schema.
---

# Tweakpane Params, Modulation, and Presets

Implementation reference for the parameter panel, CHOP-style modulation system, and preset persistence in Hand Tracker FX. All decisions here derive from `DISCOVERY.md` (D11, D13, D14, D15, D19, D20, D29, D30, D36) and the `params-and-presets-impl.md` research. DISCOVERY.md wins any conflict.

## When to Use

- Adding or editing params in `src/effects/handTrackingMosaic/manifest.ts`
- Extending `paramStore` state shape
- Adding new modulation sources or curve types
- Implementing/changing preset save, load, import, export
- Wiring the `<` / `>` preset cycler or keyboard cycling
- Anything that creates Tweakpane blades (Pane, Tab, Folder, Binding, Button, CubicBezier)

## Package Versions (pinned)

| Package | Version | Why |
|---|---|---|
| `tweakpane` | 4.0.5 | ESM-only; Vite handles natively. Do not attempt CJS require. |
| `@tweakpane/plugin-essentials` | 0.2.1 | Ships CubicBezier + Interval blades. Peer dep `tweakpane ^4.0.0`. |
| `bezier-easing` | 2.1.0 | ~500B. Matches CSS `cubic-bezier()` semantics. |

Install: `pnpm add tweakpane@4.0.5 @tweakpane/plugin-essentials@0.2.1 bezier-easing@2.1.0 && pnpm add -D @types/bezier-easing`.

## Architecture (D19, D20)

```
paramStore (plain object) ─┬─ snapshot ref ─► canvas loop reads per frame (zero React)
                           └─ subscribe + getSnapshot ─► React UI via useSyncExternalStore

Tweakpane ─► bindingTarget (mirror object) ─► onChange ─► paramStore.set()
                                                          │
modulationStore ─► routes ─► applyModulation ─────────────┴─► paramStore.replace()
```

Key rules:
- Canvas render loop NEVER touches React state. It reads `paramStore.snapshot` directly (getter returns the current reference).
- Tweakpane mutates `paramStore.bindingTarget` (a mirror), NOT the canonical snapshot. Its `on('change')` callback writes through to `paramStore.set(dotPath, value)`.
- React UI components use `useSyncExternalStore(paramStore.subscribe, paramStore.getSnapshot)`.
- Preset load calls `paramStore.replace(next)` AND `pane.refresh()` exactly once.

## Plugin Registration (required before any Essentials blade)

`EssentialsPlugin` must be registered on the Pane **before** any `addBlade({ view: 'cubicbezier' })` or `addBlade({ view: 'interval' })` call. Register immediately after `new Pane(...)`:

```ts
import { Pane } from 'tweakpane'
import * as EssentialsPlugin from '@tweakpane/plugin-essentials'

const pane = new Pane({ container, title: manifest.displayName })
pane.registerPlugin(EssentialsPlugin)
// NOW it's safe to addTab / addFolder / addBinding / addBlade({view:'cubicbezier'})
```

Anti-pattern: creating a tab/folder, then calling `registerPlugin`, then adding a cubicbezier blade to that pre-existing folder. Register first, always.

## paramStore Pattern (D20)

Plain object store implementing the `useSyncExternalStore` contract. Zero dependencies.

```ts
// src/engine/paramStore.ts
export type ParamState = {
  grid: { seed: number; columnCount: number; rowCount: number; widthVariance: number; lineColor: string; lineWeight: number }
  mosaic: { tileSize: number; blendOpacity: number; edgeFeather: number }
  effect: { regionPadding: number }
  input: { mirrorMode: boolean; showLandmarks: boolean; deviceId: string }
}

export const DEFAULT_PARAM_STATE: ParamState = {
  grid: { seed: 42, columnCount: 12, rowCount: 8, widthVariance: 0.6, lineColor: '#00ff88', lineWeight: 1 },
  mosaic: { tileSize: 16, blendOpacity: 1.0, edgeFeather: 0 },
  effect: { regionPadding: 1 },
  input: { mirrorMode: true, showLandmarks: true, deviceId: '' },
}

type Listener = () => void

function createParamStore(initial: ParamState) {
  let snapshot: ParamState = structuredClone(initial)
  const bindingTarget: ParamState = structuredClone(initial)
  const listeners = new Set<Listener>()

  const getSnapshot = () => snapshot
  const subscribe = (l: Listener) => { listeners.add(l); return () => listeners.delete(l) }
  const notify = () => listeners.forEach((l) => l())

  function set(dotPath: string, value: unknown): void {
    const [section, key] = dotPath.split('.') as [keyof ParamState, string]
    const prev = snapshot[section] as Record<string, unknown>
    if (prev[key] === value) return
    const newSection = { ...prev, [key]: value }
    snapshot = { ...snapshot, [section]: newSection as ParamState[typeof section] }
    ;(bindingTarget[section] as Record<string, unknown>)[key] = value
    notify()
  }

  function replace(next: ParamState): void {
    snapshot = structuredClone(next)
    for (const s of Object.keys(next) as (keyof ParamState)[]) {
      Object.assign(bindingTarget[s] as object, next[s])
    }
    notify()
  }

  return {
    getSnapshot, subscribe, set, replace, bindingTarget,
    get snapshot() { return snapshot },
  } as const
}

export const paramStore = createParamStore(DEFAULT_PARAM_STATE)
```

**React consumer:**
```ts
import { useSyncExternalStore } from 'react'
import { paramStore } from '../engine/paramStore'
export const useParams = () =>
  useSyncExternalStore(paramStore.subscribe, paramStore.getSnapshot)
```

**Canvas consumer (NO React):**
```ts
function onVideoFrame() {
  const p = paramStore.snapshot            // O(1), same ref until setState
  drawGrid(p.grid); drawMosaic(p.mosaic)
}
```

## buildPaneFromManifest (D36)

Generic panel builder. Iterates `manifest.params`, groups unique `page` values into tabs, groups `folder` into folders, and calls `addBinding`/`addButton` per `ParamDef`.

```ts
// src/engine/buildPaneFromManifest.ts
import { Pane } from 'tweakpane'
import type { FolderApi, TabPageApi, TpPluginBundle } from 'tweakpane'
import { paramStore } from './paramStore'
import type { EffectManifest } from '../types/effect-manifest'

type Container = Pane | TabPageApi | FolderApi
const folderCache = new WeakMap<Container, Map<string, FolderApi>>()

function getOrCreateFolder(c: Container, title: string): FolderApi {
  if (!folderCache.has(c)) folderCache.set(c, new Map())
  const cache = folderCache.get(c)!
  if (!cache.has(title)) cache.set(title, c.addFolder({ title, expanded: true }))
  return cache.get(title)!
}

function resolvePath(obj: Record<string, unknown>, dotPath: string) {
  const parts = dotPath.split('.')
  const leafKey = parts.pop()!
  let host: Record<string, unknown> = obj
  for (const p of parts) host = host[p] as Record<string, unknown>
  return { host, leafKey }
}

export function buildPaneFromManifest(
  manifest: EffectManifest,
  container: HTMLElement,
  plugins: TpPluginBundle[] = [],
): { pane: Pane; dispose: () => void } {
  const pane = new Pane({ container, title: manifest.displayName })
  for (const plugin of plugins) pane.registerPlugin(plugin)  // BEFORE any blade

  const pageNames = manifest.params
    .map((p) => p.page ?? 'Main')
    .filter((v, i, a) => a.indexOf(v) === i)

  const tab = pane.addTab({ pages: pageNames.map((title) => ({ title })) })
  const pages: Record<string, TabPageApi> = {}
  pageNames.forEach((n, i) => { pages[n] = tab.pages[i] })

  const bindingTarget = paramStore.bindingTarget as unknown as Record<string, unknown>

  for (const param of manifest.params) {
    const pageContainer = pages[param.page ?? 'Main']
    const folder = param.folder ? getOrCreateFolder(pageContainer, param.folder) : pageContainer

    if (param.type === 'button') {
      folder.addButton({ title: param.label }).on('click', () =>
        param.onChange?.(undefined, paramStore.snapshot),
      )
      continue
    }

    const { host, leafKey } = resolvePath(bindingTarget, param.key)
    const opts: Record<string, unknown> = { label: param.label }
    if (param.min !== undefined) opts.min = param.min
    if (param.max !== undefined) opts.max = param.max
    if (param.step !== undefined) opts.step = param.step
    if (param.options !== undefined) opts.options = param.options

    folder.addBinding(host, leafKey, opts).on('change', ({ value }: { value: unknown }) => {
      paramStore.set(param.key, value)
      param.onChange?.(value, paramStore.snapshot)
    })
  }

  return { pane, dispose: () => pane.dispose() }
}
```

Call site in `Panel.tsx`:
```tsx
import * as EssentialsPlugin from '@tweakpane/plugin-essentials'

useEffect(() => {
  if (!containerRef.current) return
  const { pane, dispose } = buildPaneFromManifest(
    HandTrackingMosaicManifest,
    containerRef.current,
    [EssentialsPlugin],
  )
  paneRef.current = pane
  return dispose
}, [])
```

## Modulation (D13, D14, D15)

### ModulationRoute schema

```ts
export type ModulationSourceId =
  | `landmark[${number}].x`
  | `landmark[${number}].y`
  | 'pinch'
  | 'centroid.x'
  | 'centroid.y'

export type ModulationRoute = {
  id: string                                                   // stable uuid
  enabled: boolean
  source: ModulationSourceId                                   // 'landmark[8].x'
  targetParam: string                                          // 'mosaic.tileSize'
  inputRange: [number, number]                                 // default [0, 1]
  outputRange: [number, number]
  curve: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'cubicBezier'
  bezierControlPoints?: [number, number, number, number]       // [x1,y1,x2,y2]
}
```

### Evaluator with bezier cache

```ts
import BezierEasing from 'bezier-easing'

const bezierCache = new Map<string, (t: number) => number>()
function getBezierFn(cp: [number, number, number, number]) {
  const key = cp.join(',')
  if (!bezierCache.has(key)) bezierCache.set(key, BezierEasing(cp[0], cp[1], cp[2], cp[3]))
  return bezierCache.get(key)!
}

function applyCurve(t: number, c: ModulationRoute['curve'], cp?: [number, number, number, number]) {
  switch (c) {
    case 'linear':    return t
    case 'easeIn':    return t * t
    case 'easeOut':   return t * (2 - t)
    case 'easeInOut': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    case 'cubicBezier': return cp ? getBezierFn(cp)(t) : t
  }
}

export function applyModulation(
  routes: ModulationRoute[],
  sources: Map<ModulationSourceId, number>,
  params: ParamState,
): ParamState {
  if (routes.length === 0) return params
  const mutated = new Map<keyof ParamState, Record<string, unknown>>()

  for (const route of routes) {
    if (!route.enabled) continue
    const raw = sources.get(route.source)
    if (raw === undefined) continue

    const [inMin, inMax] = route.inputRange
    const t = Math.max(0, Math.min(1, (raw - inMin) / (inMax - inMin)))
    const curved = applyCurve(t, route.curve, route.bezierControlPoints)
    const [outMin, outMax] = route.outputRange
    let mapped = outMin + curved * (outMax - outMin)

    const [section, key] = route.targetParam.split('.') as [keyof ParamState, string]
    const currentSection = params[section] as Record<string, unknown>
    if (typeof currentSection[key] === 'number' && Number.isInteger(currentSection[key])) {
      mapped = Math.round(mapped)
    }

    if (!mutated.has(section)) {
      mutated.set(section, { ...(params[section] as Record<string, unknown>) })
    }
    mutated.get(section)![key] = mapped
  }

  if (mutated.size === 0) return params
  return {
    ...params,
    ...Object.fromEntries([...mutated.entries()]),
  } as ParamState
}
```

### Default routes (D13 — exact values)

```ts
export const DEFAULT_MODULATION_ROUTES: ModulationRoute[] = [
  {
    id: 'default-x-tileSize',
    enabled: true,
    source: 'landmark[8].x',          // index fingertip X
    targetParam: 'mosaic.tileSize',
    inputRange: [0, 1],
    outputRange: [4, 64],
    curve: 'linear',
  },
  {
    id: 'default-y-columnCount',
    enabled: true,
    source: 'landmark[8].y',          // index fingertip Y
    targetParam: 'grid.columnCount',
    inputRange: [0, 1],
    outputRange: [4, 20],
    curve: 'linear',
  },
]
```

### Source resolver

```ts
export function resolveModulationSources(
  landmarks: Landmark[] | null,
): Map<ModulationSourceId, number> {
  const s = new Map<ModulationSourceId, number>()
  if (!landmarks?.length) return s
  landmarks.forEach((lm, i) => {
    s.set(`landmark[${i}].x`, lm.x)
    s.set(`landmark[${i}].y`, lm.y)
  })
  if (landmarks[4] && landmarks[8]) {
    const dx = landmarks[4].x - landmarks[8].x
    const dy = landmarks[4].y - landmarks[8].y
    s.set('pinch', Math.min(1, Math.sqrt(dx * dx + dy * dy) / 0.4))
  }
  const cx = landmarks.reduce((a, l) => a + l.x, 0) / landmarks.length
  const cy = landmarks.reduce((a, l) => a + l.y, 0) / landmarks.length
  s.set('centroid.x', cx)
  s.set('centroid.y', cy)
  return s
}
```

## CubicBezier blade wiring

The Essentials plugin's `cubicbezier` view returns `ev.value` as `[number, number, number, number]` but TypeScript infers `unknown` without an explicit cast. Always cast.

```ts
const initial: [number, number, number, number] =
  route.bezierControlPoints ?? [0.5, 0, 0.5, 1]

const bezierBlade = folder.addBlade({
  view: 'cubicbezier',
  value: initial,
  expanded: false,
  label: 'Bezier Curve',
  picker: 'inline',
})

bezierBlade.on('change', (ev: { value: [number, number, number, number] }) => {
  modulationStore.upsertRoute({ ...route, bezierControlPoints: ev.value })
})
```

Interval blade (for output range):
```ts
folder.addBlade({
  view: 'interval',
  label: 'Output range',
  min: -100, max: 200, step: 1,
  value: { min: route.outputRange[0], max: route.outputRange[1] },
}).on('change', (ev: { value: { min: number; max: number } }) => {
  modulationStore.upsertRoute({ ...route, outputRange: [ev.value.min, ev.value.max] })
})
```

## Preset Schema (D29 — exact shape)

```ts
export type Preset = {
  version: 1
  name: string
  effectId: 'handTrackingMosaic'
  params: ParamState                   // semantic — NOT pane.exportState() output
  modulationRoutes: ModulationRoute[]
  createdAt: string                    // ISO 8601
}
```

**Why semantic `ParamState`, not `pane.exportState()`:** `exportState()` captures UI widget state (folder-expanded, picker positions) and is fragile against manifest schema changes. Semantic values survive manifest edits and diff cleanly across versions. Do not use `exportState()` in the Preset `params` field.

## Preset persistence

- localStorage key: `hand-tracker-fx:presets:v1`
- Stored as `Preset[]` (a JSON array of preset objects)
- Per-file export uses a single `Preset` object (not array), filename `{name}.hand-tracker-fx.json`
- Validation: manual `isValidPreset()` type guard, **no zod** (zero-dep)
- `JSON.parse` wrapped in try/catch; invalid entries filtered silently
- Future-version guard: `version === 1` required; `version: 2` entries are filtered out

```ts
const STORAGE_KEY = 'hand-tracker-fx:presets:v1'

function readStorage(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isValidPreset) : []
  } catch { return [] }
}

function isValidPreset(p: unknown): p is Preset {
  if (typeof p !== 'object' || p === null) return false
  const o = p as Record<string, unknown>
  return (
    o.version === 1 &&
    typeof o.name === 'string' &&
    o.effectId === 'handTrackingMosaic' &&
    typeof o.params === 'object' && o.params !== null &&
    Array.isArray(o.modulationRoutes) &&
    typeof o.createdAt === 'string'
  )
}

export function savePreset(name: string): Preset {
  const preset: Preset = {
    version: 1, name, effectId: 'handTrackingMosaic',
    params: structuredClone(paramStore.snapshot) as ParamState,
    modulationRoutes: structuredClone(modulationStore.getSnapshot().routes),
    createdAt: new Date().toISOString(),
  }
  const existing = readStorage()
  const idx = existing.findIndex((p) => p.name === name)
  const next = idx >= 0
    ? existing.map((p, i) => (i === idx ? preset : p))
    : [...existing, preset]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return preset
}

export function loadPreset(name: string): boolean {
  const preset = readStorage().find((p) => p.name === name)
  if (!preset) return false
  paramStore.replace(preset.params)
  modulationStore.setRoutes(preset.modulationRoutes)
  return true
  // Caller MUST call pane.refresh() after this returns true
}
```

## DEFAULT_PRESET (matches reference screenshot)

Seeded on first launch when `listPresets().length === 0`.

```ts
export const DEFAULT_PRESET: Preset = {
  version: 1,
  name: 'Default',
  effectId: 'handTrackingMosaic',
  params: structuredClone(DEFAULT_PARAM_STATE),     // seed=42, cols=12, rows=8, variance=0.6
  modulationRoutes: structuredClone(DEFAULT_MODULATION_ROUTES),
  createdAt: '2026-04-14T00:00:00.000Z',
}

export function initializePresetsIfEmpty(): void {
  if (readStorage().length === 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([DEFAULT_PRESET]))
    loadPreset('Default')
  }
}
```

Call in `main.tsx` BEFORE `createRoot(...).render(...)`.

## PresetCycler (D11, D30)

Chevron buttons + ArrowLeft/ArrowRight keyboard. Wraps on both ends.

```ts
function createPresetCycler() {
  let state = { presets: listPresets(), currentIndex: 0 }
  const handlers = new Set<(s: typeof state) => void>()

  const notify = () => handlers.forEach((h) => h(state))

  function cycleNext(pane?: Pane) {
    if (state.presets.length === 0) return
    const next = (state.currentIndex + 1) % state.presets.length
    state = { ...state, currentIndex: next }
    loadPreset(state.presets[next].name)
    pane?.refresh()                     // ONCE — not per frame
    notify()
  }

  function cyclePrev(pane?: Pane) {
    if (state.presets.length === 0) return
    const prev = (state.currentIndex - 1 + state.presets.length) % state.presets.length
    state = { ...state, currentIndex: prev }
    loadPreset(state.presets[prev].name)
    pane?.refresh()
    notify()
  }

  function goTo(i: number, pane?: Pane) {
    if (i < 0 || i >= state.presets.length) return
    state = { ...state, currentIndex: i }
    loadPreset(state.presets[i].name)
    pane?.refresh()
    notify()
  }

  return { cycleNext, cyclePrev, goTo,
           onChange: (h: typeof handlers extends Set<infer H> ? H : never) => { handlers.add(h); return () => handlers.delete(h) },
           getState: () => state,
           refresh: () => { state = { ...state, presets: listPresets() }; notify() } }
}

export const presetCycler = createPresetCycler()
```

Keyboard wiring (with input-focus guard — prevents stealing arrow keys from Tweakpane number inputs):

```tsx
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (e.key === 'ArrowLeft')  { e.preventDefault(); presetCycler.cyclePrev(paneRef.current ?? undefined) }
    if (e.key === 'ArrowRight') { e.preventDefault(); presetCycler.cycleNext(paneRef.current ?? undefined) }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [paneRef])
```

## pane.refresh() — call rules

- Call ONCE after `loadPreset()`, `importPresetFile()`, or `cycleNext/Prev/goTo`.
- NEVER in the render loop. The canvas loop reads `paramStore.snapshot` directly; Tweakpane already reflects `bindingTarget` writes. Calling `refresh()` per frame forces redundant widget DOM updates at 30 Hz.
- NEVER inside an `on('change')` handler — infinite loop risk.

## Anti-patterns

- **NEVER put Tweakpane state into React `useState`.** Tweakpane is imperative; it mutates its binding target. Use `useRef` for the Pane instance and `useSyncExternalStore(paramStore.subscribe, paramStore.getSnapshot)` for React reads.
- **NEVER call `pane.refresh()` per frame.** Preset load/cycle only.
- **NEVER use `pane.exportState()` as the Preset `params` field.** Store semantic `ParamState` so presets survive manifest changes.
- **NEVER register plugins after adding blades that require them.** `pane.registerPlugin(EssentialsPlugin)` must run immediately after `new Pane(...)`.
- **NEVER skip `pane.dispose()` in `useEffect` cleanup.** React StrictMode double-mount will leave orphaned panels. Guard with `if (!containerRef.current) return` and always return the dispose.
- **NEVER mutate `paramStore.snapshot` directly.** Use `paramStore.set(dotPath, value)` or `paramStore.replace(next)` — they produce new section references so `useSyncExternalStore` detects changes.
- **NEVER bind Tweakpane to a dot-path string.** Tweakpane needs `(host, leafKey)`. Use `resolvePath()` to convert `"mosaic.tileSize"` into `(params.mosaic, 'tileSize')`.
- **NEVER cast `cubicbezier` `ev.value` implicitly.** Annotate: `(ev: { value: [number, number, number, number] })`.
- **NEVER assume `structuredClone` polyfill.** Target is Chrome 98+/Firefox 94+/Safari 15.4+; all native.
- **NEVER use zod or similar dep for Preset validation.** Manual `isValidPreset()` only.

## structuredClone notes

Required for:
- `paramStore.replace(next)` — cloning `next` before storing
- `savePreset()` — cloning `paramStore.snapshot` and `modulationStore` routes
- `DEFAULT_PRESET` initialization

Available natively on all target browsers. Do not polyfill. If a test env (jsdom) lacks it, use Node 17+ (Vitest default).

## Testing Strategy (Vitest)

- Environment: `jsdom` (needed for `localStorage`, DOM container).
- Mount a real Tweakpane into a `<div>` in `document.body`; assert via `pane.exportState()` structure (widget tree) AND `paramStore.snapshot` (semantic values). Both should agree.
- Representative tests:

```ts
// paramStore.test.ts
test('set() updates snapshot reference', () => {
  const before = paramStore.snapshot
  paramStore.set('mosaic.tileSize', 32)
  expect(paramStore.snapshot).not.toBe(before)
  expect(paramStore.snapshot.mosaic.tileSize).toBe(32)
})

// modulation.test.ts
test('default route maps landmark[8].x=0.5 to tileSize≈34', () => {
  const sources = new Map([['landmark[8].x', 0.5]])
  const out = applyModulation(DEFAULT_MODULATION_ROUTES, sources, DEFAULT_PARAM_STATE)
  expect(out.mosaic.tileSize).toBeCloseTo(34, 0)
})

// presets.test.ts
test('save → load round-trip restores exact params', () => {
  paramStore.set('mosaic.tileSize', 48)
  savePreset('test')
  paramStore.set('mosaic.tileSize', 8)
  expect(loadPreset('test')).toBe(true)
  expect(paramStore.snapshot.mosaic.tileSize).toBe(48)
})

test('importPresetFile rejects invalid JSON', async () => {
  const file = new File(['not json'], 'x.json', { type: 'application/json' })
  await expect(importPresetFile(file)).rejects.toThrow(/not valid JSON/)
})

test('version:2 entries filtered from readStorage', () => {
  localStorage.setItem('hand-tracker-fx:presets:v1', JSON.stringify([{ version: 2, name: 'x' }]))
  expect(listPresets()).toEqual([])
})

// buildPaneFromManifest.test.ts
test('creates one tab per unique page', () => {
  const { pane } = buildPaneFromManifest(mockManifest, container, [EssentialsPlugin])
  const state = pane.exportState()
  const tabChildren = (state.children?.[0] as any).pages
  expect(tabChildren).toHaveLength(2)
})
```

## File layout (D38)

```
src/engine/
  paramStore.ts
  modulationStore.ts
  modulation.ts                # types, applyModulation, resolveModulationSources, DEFAULT_MODULATION_ROUTES
  buildPaneFromManifest.ts
  presets.ts                   # CRUD + file export/import + DEFAULT_PRESET + initializePresetsIfEmpty
src/ui/
  Panel.tsx                    # mounts Pane via useEffect + buildPaneFromManifest
  PresetBar.tsx                # chevrons + keyboard hook
  PresetCycler.ts              # framework-agnostic cycler logic
  ModulationPanel.ts           # addRouteControls(routePage, route)
src/effects/handTrackingMosaic/
  manifest.ts                  # ParamDef[] drives the panel
```

## Cross-references

- `DISCOVERY.md` — top authority (D11, D13, D14, D15, D19, D20, D29, D30, D36)
- `parameter-ui-architecture.md` — first-wave research, library comparison
- `params-and-presets-impl.md` — second-wave implementation details
- `hand-tracker-fx-architecture` skill — overall project structure
