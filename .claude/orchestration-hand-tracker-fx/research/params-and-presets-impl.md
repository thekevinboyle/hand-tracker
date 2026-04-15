# Params & Presets Implementation - Research

**Wave**: Second
**Researcher**: Web research agent — Tweakpane v4 + Essentials, paramStore, modulation, preset persistence
**Date**: 2026-04-14
**Status**: Complete

---

## Summary

This file delivers concrete TypeScript implementation for the full param/preset subsystem aligned to DISCOVERY.md decisions D13, D14, D19, D20, D29, D30, D36. It covers: a plain-object `paramStore` with `useSyncExternalStore`-compatible subscribe, `buildPaneFromManifest` that constructs Tweakpane v4 tabs/folders/bindings from the effect manifest, `ModulationRoute` type + `applyModulation` evaluator, Bezier blade wiring via `@tweakpane/plugin-essentials`, full preset CRUD (localStorage, export file, import file, validation), the chevron cycler with ArrowLeft/ArrowRight keyboard support, and the "Default" preset matching the reference screenshot.

---

## Key Findings

### 1. Package Versions (confirmed April 2026)

| Package | Version | Notes |
|---|---|---|
| `tweakpane` | 4.0.5 | ESM-only in v4; no CJS. Vite handles this automatically. |
| `@tweakpane/plugin-essentials` | 0.2.1 | Peer dep on tweakpane ^4.0.0. Ships CubicBezier blade. |
| `bezier-easing` | 2.1.0 | ~500B. Matches CSS `cubic-bezier()` semantics. |

Install:
```
pnpm add tweakpane @tweakpane/plugin-essentials bezier-easing
pnpm add -D @types/bezier-easing
```

### 2. Tweakpane v4 API Reference (authoritative)

**Core imports:**
```ts
import { Pane } from 'tweakpane'
import type { TabPageApi, FolderApi, BindingApi } from 'tweakpane'
import * as EssentialsPlugin from '@tweakpane/plugin-essentials'
```

**Plugin registration (must happen once, before any blade creation):**
```ts
const pane = new Pane({ container: divRef.current })
pane.registerPlugin(EssentialsPlugin)
```

**Core Pane methods:**
```ts
// All return typed API objects
pane.addBinding(obj, 'key', { min, max, step, options, label })
pane.addFolder({ title: string, expanded?: boolean })   // → FolderApi
pane.addTab({ pages: { title: string }[] })              // → TabApi
pane.addButton({ title: string, label?: string })        // → ButtonApi

// Events
binding.on('change', (ev: { value: T, last: boolean }) => void)
button.on('click', () => void)
pane.on('change', (ev) => void)  // global — all children

// State
pane.exportState()           // → BladeState (plain JSON-serializable object)
pane.importState(state)      // → boolean

// Maintenance
pane.refresh()               // force-reads all bound objects, updates UI
pane.dispose()               // cleanup, call in useEffect return
```

**Tab page access pattern:**
```ts
const tab = pane.addTab({ pages: [{ title: 'Grid' }, { title: 'Effect' }] })
const gridPage: TabPageApi = tab.pages[0]
const effectPage: TabPageApi = tab.pages[1]
gridPage.addBinding(obj, 'columnCount', { min: 4, max: 20, step: 1 })
```

**CubicBezier blade (Essentials):**
```ts
const bezierBlade = container.addBlade({
  view: 'cubicbezier',
  value: [0.5, 0, 0.5, 1] as [number, number, number, number],
  expanded: false,
  label: 'Curve',
  picker: 'inline',
})
bezierBlade.on('change', (ev: { value: [number, number, number, number] }) => {
  // ev.value is [x1, y1, x2, y2]
  route.bezierControlPoints = ev.value
})
```

**Refresh after external state writes (required for preset load):**
```ts
// After writing to the bound plain object, call refresh() so UI reflects new values
Object.assign(bindingTarget, newParams)
pane.refresh()
```

### 3. `useSyncExternalStore` contract (React 19)

The React docs define the contract:

- `subscribe(callback): () => void` — register listener, return unsubscribe
- `getSnapshot(): T` — return same reference (by `Object.is`) when state unchanged
- If state is mutable, cache the last snapshot and only return a new object reference when something actually changed

The plain-object store below satisfies this contract by comparing the state reference on every `setState` call and only notifying listeners when the reference changes.

---

## Implementation Code

### File: `src/engine/paramStore.ts`

```ts
/**
 * Plain-object paramStore.
 *
 * Architecture (D20):
 *  - Canvas render loop reads via paramStore.snapshot (ref, no closure overhead)
 *  - React subscribes via useSyncExternalStore(paramStore.subscribe, paramStore.getSnapshot)
 *  - Tweakpane mutates a dedicated bindingTarget object; onChange callbacks call paramStore.set()
 */

export type ParamState = {
  grid: {
    seed: number
    columnCount: number
    rowCount: number
    widthVariance: number
    lineColor: string
    lineWeight: number
  }
  mosaic: {
    tileSize: number
    blendOpacity: number
    edgeFeather: number
  }
  effect: {
    regionPadding: number
  }
  input: {
    mirrorMode: boolean
    showLandmarks: boolean
    deviceId: string
  }
}

export const DEFAULT_PARAM_STATE: ParamState = {
  grid: {
    seed: 42,
    columnCount: 12,
    rowCount: 8,
    widthVariance: 0.6,
    lineColor: '#00ff88',
    lineWeight: 1,
  },
  mosaic: {
    tileSize: 16,
    blendOpacity: 1.0,
    edgeFeather: 0,
  },
  effect: {
    regionPadding: 1,
  },
  input: {
    mirrorMode: true,
    showLandmarks: true,
    deviceId: '',
  },
}

type Listener = () => void

function shallowEqual(a: object, b: object): boolean {
  const ka = Object.keys(a) as (keyof typeof a)[]
  const kb = Object.keys(b) as (keyof typeof b)[]
  if (ka.length !== kb.length) return false
  return ka.every((k) => a[k] === b[k])
}

function createParamStore(initial: ParamState) {
  // The canonical state held as a plain object.
  // snapshot is the reference React/tests read; mutated only on setState.
  let snapshot: ParamState = { ...initial }

  // Separate mutable object that Tweakpane binds to.
  // paramStore.bindingTarget is passed to addBinding() calls.
  // On every Tweakpane onChange, set() is called with the updated leaf value.
  const bindingTarget: ParamState = structuredClone(initial)

  const listeners = new Set<Listener>()

  function getSnapshot(): ParamState {
    return snapshot
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function notify() {
    listeners.forEach((l) => l())
  }

  /**
   * Deep-set a dot-path key into state and notify listeners.
   * e.g. set('mosaic.tileSize', 32)
   */
  function set(dotPath: string, value: unknown): void {
    const parts = dotPath.split('.')
    if (parts.length !== 2) {
      console.warn('[paramStore] Only depth-2 dot-paths supported:', dotPath)
      return
    }
    const [section, key] = parts as [keyof ParamState, string]
    const prevSection = snapshot[section] as Record<string, unknown>
    if (prevSection[key] === value) return // no-op for same value

    // Produce a new snapshot reference so React re-renders
    const newSection = { ...prevSection, [key]: value }
    snapshot = { ...snapshot, [section]: newSection as ParamState[typeof section] }

    // Also keep bindingTarget in sync for pane.refresh()
    ;(bindingTarget[section] as Record<string, unknown>)[key] = value

    notify()
  }

  /**
   * Replace entire state at once (used by preset load).
   * Deep-merges; shallow at section level.
   */
  function replace(next: ParamState): void {
    snapshot = structuredClone(next)
    // Sync bindingTarget for pane.refresh()
    const sections = Object.keys(next) as (keyof ParamState)[]
    for (const section of sections) {
      Object.assign(bindingTarget[section] as object, next[section])
    }
    notify()
  }

  return {
    getSnapshot,
    subscribe,
    set,
    replace,
    bindingTarget,
    /** Direct ref for canvas render loop — zero React overhead */
    get snapshot() {
      return snapshot
    },
  } as const
}

export const paramStore = createParamStore(DEFAULT_PARAM_STATE)
```

**Usage in render loop:**
```ts
// renderer.ts — reads once per frame, no React
function renderFrame() {
  const params = paramStore.snapshot  // direct property access, O(1)
  // ... use params.mosaic.tileSize, params.grid.columnCount, etc.
}
```

**Usage in React:**
```ts
// Panel.tsx or any component
import { useSyncExternalStore } from 'react'
import { paramStore } from '../engine/paramStore'

function useMosaicTileSize() {
  // Selector pattern — only re-renders when mosaic section reference changes
  return useSyncExternalStore(
    paramStore.subscribe,
    () => paramStore.getSnapshot().mosaic,
  ).tileSize
}

// Or subscribe to the whole snapshot for the panel:
function useParams() {
  return useSyncExternalStore(paramStore.subscribe, paramStore.getSnapshot)
}
```

---

### File: `src/engine/buildPaneFromManifest.ts`

```ts
import { Pane } from 'tweakpane'
import type { FolderApi, TabPageApi } from 'tweakpane'
import type { EffectManifest, ParamDef } from '../types/effect-manifest'
import { paramStore } from './paramStore'

type Container = Pane | TabPageApi | FolderApi

// Cache folders by container + folder-name so we don't create duplicates
const folderCache = new WeakMap<Container, Map<string, FolderApi>>()

function getOrCreateFolder(container: Container, title: string): FolderApi {
  if (!folderCache.has(container)) folderCache.set(container, new Map())
  const cache = folderCache.get(container)!
  if (!cache.has(title)) {
    cache.set(title, container.addFolder({ title, expanded: true }))
  }
  return cache.get(title)!
}

/**
 * Resolves a dot-path like "mosaic.tileSize" into { host: params.mosaic, leafKey: 'tileSize' }.
 * Tweakpane requires a plain object host and a string key — it cannot bind to nested paths directly.
 */
function resolvePath(
  obj: Record<string, unknown>,
  dotPath: string,
): { host: Record<string, unknown>; leafKey: string } {
  const parts = dotPath.split('.')
  const leafKey = parts.pop()!
  let host: Record<string, unknown> = obj
  for (const part of parts) {
    host = host[part] as Record<string, unknown>
  }
  return { host, leafKey }
}

/**
 * Constructs a full Tweakpane panel from an EffectManifest.
 * Tabs = manifest.params unique page values.
 * Folders = optional param.folder within each page.
 * Each binding writes back to paramStore via set().
 *
 * Returns a dispose function that callers should invoke on unmount.
 */
export function buildPaneFromManifest(
  manifest: EffectManifest,
  container: HTMLElement,
): { pane: Pane; dispose: () => void } {
  const pane = new Pane({ container, title: manifest.displayName })

  // Register Essentials plugin (required for CubicBezier blade on Modulation page)
  // Import is done at call-site; passed in here so this file stays tree-shakeable.
  // See Panel.tsx for the actual import pattern.

  // Derive unique page names in declaration order
  const pageNames = manifest.params
    .map((p) => p.page ?? 'Main')
    .filter((v, i, a) => a.indexOf(v) === i)

  const tab = pane.addTab({ pages: pageNames.map((title) => ({ title })) })
  const pages: Record<string, TabPageApi> = {}
  pageNames.forEach((name, i) => {
    pages[name] = tab.pages[i]
  })

  const bindingTarget = paramStore.bindingTarget as unknown as Record<string, unknown>

  for (const param of manifest.params) {
    if (param.type === 'button') {
      const pageName = param.page ?? 'Main'
      const pageContainer = pages[pageName]
      const folder = param.folder ? getOrCreateFolder(pageContainer, param.folder) : pageContainer
      const btn = folder.addButton({ title: param.label })
      btn.on('click', () => {
        param.onChange?.(undefined, paramStore.snapshot)
      })
      continue
    }

    const pageName = param.page ?? 'Main'
    const pageContainer = pages[pageName]
    const folder = param.folder ? getOrCreateFolder(pageContainer, param.folder) : pageContainer

    const { host, leafKey } = resolvePath(bindingTarget, param.key)

    const opts: Record<string, unknown> = { label: param.label }
    if (param.min !== undefined) opts.min = param.min
    if (param.max !== undefined) opts.max = param.max
    if (param.step !== undefined) opts.step = param.step
    if (param.options !== undefined) opts.options = param.options

    const binding = folder.addBinding(host, leafKey, opts)
    binding.on('change', ({ value }: { value: unknown }) => {
      paramStore.set(param.key, value)
      param.onChange?.(value, paramStore.snapshot)
    })
  }

  return {
    pane,
    dispose: () => pane.dispose(),
  }
}
```

**Panel.tsx integration pattern (React):**
```ts
import { useEffect, useRef } from 'react'
import { Pane } from 'tweakpane'
import * as EssentialsPlugin from '@tweakpane/plugin-essentials'
import { buildPaneFromManifest } from '../engine/buildPaneFromManifest'
import { HandTrackingMosaicManifest } from '../effects/handTrackingMosaic/manifest'

export function Panel() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Register Essentials so CubicBezier blade is available
    // We must patch it onto Pane before buildPaneFromManifest creates the pane
    // Workaround: pass a temporary pane for registration, or register globally once
    const { pane, dispose } = buildPaneFromManifest(
      HandTrackingMosaicManifest,
      containerRef.current,
    )
    pane.registerPlugin(EssentialsPlugin)

    return () => {
      dispose()
    }
  }, []) // run once — manifest is static

  return <div ref={containerRef} className="panel-root" />
}
```

**Gotcha:** `pane.registerPlugin()` must be called before any blade that uses that plugin is added. In practice, register at Pane construction time; the function above calls `registerPlugin` immediately after `new Pane()` inside `buildPaneFromManifest` (see refined version in implementation section below that accepts `plugins` array as parameter).

**Refined signature to allow plugin injection:**
```ts
export function buildPaneFromManifest(
  manifest: EffectManifest,
  container: HTMLElement,
  plugins: import('tweakpane').TpPluginBundle[] = [],
): { pane: Pane; dispose: () => void }
```
Inside the function, after `new Pane(...)`:
```ts
for (const plugin of plugins) pane.registerPlugin(plugin)
```

---

### File: `src/engine/modulation.ts`

```ts
import BezierEasing from 'bezier-easing'

// ------------------------------------------------------------------
// Types (D13, D14, D15)
// ------------------------------------------------------------------

/**
 * All possible modulation sources.
 * landmark[N].x|y: normalized [0,1] from MediaPipe landmark N
 * pinch: normalized distance between landmarks 4 & 8 (thumb tip & index tip)
 * centroid.x|y: mean of all tracked landmark positions
 */
export type ModulationSourceId =
  | `landmark[${number}].x`
  | `landmark[${number}].y`
  | 'pinch'
  | 'centroid.x'
  | 'centroid.y'

export type ModulationRoute = {
  id: string                                       // stable uuid, used as React key
  enabled: boolean
  source: ModulationSourceId                       // e.g. "landmark[8].x"
  targetParam: string                              // dot-path: "mosaic.tileSize"
  inputRange: [number, number]                     // clamp source, default [0,1]
  outputRange: [number, number]                    // map to param range
  curve: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'cubicBezier'
  bezierControlPoints?: [number, number, number, number]  // [x1,y1,x2,y2] — only when curve==='cubicBezier'
}

/** Convenience: MediaPipe NormalizedLandmark subset */
export type Landmark = { x: number; y: number; z: number }

// ------------------------------------------------------------------
// Curve evaluators
// ------------------------------------------------------------------

// Bezier cache: keyed by serialized control points to avoid rebuilding on every frame
const bezierCache = new Map<string, (t: number) => number>()

function getBezierFn(cp: [number, number, number, number]): (t: number) => number {
  const key = cp.join(',')
  if (!bezierCache.has(key)) {
    bezierCache.set(key, BezierEasing(cp[0], cp[1], cp[2], cp[3]))
  }
  return bezierCache.get(key)!
}

function applyCurve(
  t: number,
  curve: ModulationRoute['curve'],
  cp?: [number, number, number, number],
): number {
  switch (curve) {
    case 'linear':
      return t
    case 'easeIn':
      return t * t
    case 'easeOut':
      return t * (2 - t)
    case 'easeInOut':
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    case 'cubicBezier':
      return cp ? getBezierFn(cp)(t) : t
  }
}

// ------------------------------------------------------------------
// Core evaluator
// ------------------------------------------------------------------

/**
 * Given a set of ModulationRoutes, current landmark/pinch sources,
 * and the current params snapshot, produce a new params snapshot
 * with modulated values applied.
 *
 * This runs every frame in the render loop — it must be allocation-light.
 * It does a shallow structural clone only for sections that were modified.
 */
export function applyModulation(
  routes: ModulationRoute[],
  sources: Map<ModulationSourceId, number>,
  params: import('./paramStore').ParamState,
): import('./paramStore').ParamState {
  if (routes.length === 0) return params

  // Track which sections were mutated so we only clone those
  type ParamSection = keyof import('./paramStore').ParamState
  const mutated = new Map<ParamSection, Record<string, unknown>>()

  for (const route of routes) {
    if (!route.enabled) continue
    const raw = sources.get(route.source)
    if (raw === undefined) continue

    const [inMin, inMax] = route.inputRange
    const t = Math.max(0, Math.min(1, (raw - inMin) / (inMax - inMin)))
    const curved = applyCurve(t, route.curve, route.bezierControlPoints)
    const [outMin, outMax] = route.outputRange
    let mapped = outMin + curved * (outMax - outMin)

    // Integer rounding for integer-typed params (grid.columnCount etc)
    // The manifest's ParamDef has type:'integer'; we check the current value type
    const [section, key] = route.targetParam.split('.') as [ParamSection, string]
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
    ...Object.fromEntries(
      [...mutated.entries()].map(([k, v]) => [k, v]),
    ),
  } as import('./paramStore').ParamState
}

// ------------------------------------------------------------------
// Source resolver — call once per frame before applyModulation
// ------------------------------------------------------------------

export function resolveModulationSources(
  landmarks: Landmark[] | null,
): Map<ModulationSourceId, number> {
  const sources = new Map<ModulationSourceId, number>()
  if (!landmarks || landmarks.length === 0) return sources

  // Landmark x/y
  landmarks.forEach((lm, i) => {
    sources.set(`landmark[${i}].x`, lm.x)
    sources.set(`landmark[${i}].y`, lm.y)
  })

  // Pinch: normalized Euclidean distance between landmark 4 (thumb tip) and 8 (index tip)
  // Max expected distance ~0.4 in normalized space; clamp to [0,1]
  if (landmarks[4] && landmarks[8]) {
    const dx = landmarks[4].x - landmarks[8].x
    const dy = landmarks[4].y - landmarks[8].y
    const dist = Math.sqrt(dx * dx + dy * dy)
    sources.set('pinch', Math.min(1, dist / 0.4))
  }

  // Centroid
  const cx = landmarks.reduce((s, l) => s + l.x, 0) / landmarks.length
  const cy = landmarks.reduce((s, l) => s + l.y, 0) / landmarks.length
  sources.set('centroid.x', cx)
  sources.set('centroid.y', cy)

  return sources
}

// ------------------------------------------------------------------
// Default routes (D13)
// ------------------------------------------------------------------

export const DEFAULT_MODULATION_ROUTES: ModulationRoute[] = [
  {
    id: 'default-x-tileSize',
    enabled: true,
    source: 'landmark[8].x',
    targetParam: 'mosaic.tileSize',
    inputRange: [0, 1],
    outputRange: [4, 64],
    curve: 'linear',
  },
  {
    id: 'default-y-columnCount',
    enabled: true,
    source: 'landmark[8].y',
    targetParam: 'grid.columnCount',
    inputRange: [0, 1],
    outputRange: [4, 20],
    curve: 'linear',
  },
]
```

---

### File: `src/engine/modulationStore.ts`

```ts
/**
 * Minimal store for modulation routes — same subscribe/getSnapshot pattern
 * as paramStore so React can subscribe with useSyncExternalStore.
 */
import { DEFAULT_MODULATION_ROUTES, type ModulationRoute } from './modulation'

type ModulationState = { routes: ModulationRoute[] }

type Listener = () => void

function createModulationStore(initial: ModulationState) {
  let snapshot = initial
  const listeners = new Set<Listener>()

  function getSnapshot() {
    return snapshot
  }
  function subscribe(cb: Listener) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }
  function notify() {
    listeners.forEach((l) => l())
  }
  function setRoutes(routes: ModulationRoute[]) {
    snapshot = { routes }
    notify()
  }
  function upsertRoute(route: ModulationRoute) {
    const existing = snapshot.routes.findIndex((r) => r.id === route.id)
    const next =
      existing >= 0
        ? snapshot.routes.map((r) => (r.id === route.id ? route : r))
        : [...snapshot.routes, route]
    setRoutes(next)
  }
  function deleteRoute(id: string) {
    setRoutes(snapshot.routes.filter((r) => r.id !== id))
  }

  return { getSnapshot, subscribe, setRoutes, upsertRoute, deleteRoute }
}

export const modulationStore = createModulationStore({
  routes: DEFAULT_MODULATION_ROUTES,
})
```

---

### Bezier Curve Blade Wiring (Modulation Page)

The Modulation page in the panel has one CubicBezier blade per route that has `curve === 'cubicBezier'`. This blade is created imperatively alongside the other route controls.

```ts
// src/ui/ModulationPanel.ts — imperative section added to Modulation tab page

import type { TabPageApi } from 'tweakpane'
import { modulationStore, type ModulationRoute } from '../engine/modulationStore'

/**
 * Adds controls for a single ModulationRoute to a Tweakpane container.
 * Called once per route; called again if routes list changes (dispose + recreate).
 */
export function addRouteControls(
  container: TabPageApi,
  route: ModulationRoute,
): () => void {
  const folder = container.addFolder({ title: `Route: ${route.source} → ${route.targetParam}` })

  // Enabled toggle
  const enabledObj = { enabled: route.enabled }
  folder.addBinding(enabledObj, 'enabled', { label: 'Enabled' })
    .on('change', ({ value }) => {
      modulationStore.upsertRoute({ ...route, enabled: value })
    })

  // Output range: use two numeric bindings or the Essentials interval blade
  const rangeObj = { min: route.outputRange[0], max: route.outputRange[1] }
  folder.addBlade({
    view: 'interval',
    label: 'Output range',
    min: -100,
    max: 200,
    step: 1,
    value: { min: rangeObj.min, max: rangeObj.max },
  }).on('change', (ev: { value: { min: number; max: number } }) => {
    modulationStore.upsertRoute({
      ...route,
      outputRange: [ev.value.min, ev.value.max],
    })
  })

  // Curve selector
  const curveObj = { curve: route.curve }
  folder.addBinding(curveObj, 'curve', {
    label: 'Curve',
    options: {
      Linear: 'linear',
      'Ease In': 'easeIn',
      'Ease Out': 'easeOut',
      'Ease In-Out': 'easeInOut',
      'Cubic Bezier': 'cubicBezier',
    },
  }).on('change', ({ value }) => {
    modulationStore.upsertRoute({ ...route, curve: value as ModulationRoute['curve'] })
  })

  // CubicBezier blade — only shown/relevant when curve === 'cubicBezier'
  // Always added; Tweakpane shows it regardless. Users ignore it for other curves.
  const cpObj = { cp: route.bezierControlPoints ?? ([0.5, 0, 0.5, 1] as [number, number, number, number]) }
  const bezierBlade = folder.addBlade({
    view: 'cubicbezier',
    value: cpObj.cp,
    expanded: false,
    label: 'Bezier Curve',
    picker: 'inline',
  })
  bezierBlade.on('change', (ev: { value: [number, number, number, number] }) => {
    modulationStore.upsertRoute({
      ...route,
      bezierControlPoints: ev.value,
    })
  })

  return () => folder.dispose()
}
```

---

### File: `src/engine/presets.ts`

```ts
/**
 * Preset CRUD, file export/import, localStorage persistence.
 * All aligned to D29 schema and D30 UI decisions.
 */

import { paramStore, DEFAULT_PARAM_STATE, type ParamState } from './paramStore'
import { modulationStore, type ModulationRoute } from './modulationStore'
import { DEFAULT_MODULATION_ROUTES } from './modulation'

// ------------------------------------------------------------------
// Type definitions (D29)
// ------------------------------------------------------------------

export type Preset = {
  version: 1
  name: string
  effectId: 'handTrackingMosaic'
  params: ParamState
  modulationRoutes: ModulationRoute[]
  createdAt: string  // ISO 8601
}

// ------------------------------------------------------------------
// Storage
// ------------------------------------------------------------------

const STORAGE_KEY = 'hand-tracker-fx:presets:v1'

function readStorage(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Version guard: only keep presets with version:1
    return parsed.filter(isValidPreset)
  } catch {
    return []
  }
}

function writeStorage(presets: Preset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  } catch (e) {
    console.warn('[presets] localStorage write failed:', e)
  }
}

// ------------------------------------------------------------------
// Validation (manual — no zod in this file to keep it zero-dep)
// ------------------------------------------------------------------

function isValidPreset(p: unknown): p is Preset {
  if (typeof p !== 'object' || p === null) return false
  const obj = p as Record<string, unknown>
  return (
    obj.version === 1 &&
    typeof obj.name === 'string' &&
    obj.effectId === 'handTrackingMosaic' &&
    typeof obj.params === 'object' && obj.params !== null &&
    Array.isArray(obj.modulationRoutes) &&
    typeof obj.createdAt === 'string'
  )
}

// ------------------------------------------------------------------
// CRUD API
// ------------------------------------------------------------------

export function listPresets(): Preset[] {
  return readStorage()
}

export function getPreset(name: string): Preset | undefined {
  return readStorage().find((p) => p.name === name)
}

/**
 * Save current paramStore + modulationStore state as a named preset.
 * If a preset with the same name exists, it is replaced.
 */
export function savePreset(name: string): Preset {
  const preset: Preset = {
    version: 1,
    name,
    effectId: 'handTrackingMosaic',
    params: structuredClone(paramStore.snapshot) as ParamState,
    modulationRoutes: structuredClone(modulationStore.getSnapshot().routes),
    createdAt: new Date().toISOString(),
  }

  const existing = readStorage()
  const idx = existing.findIndex((p) => p.name === name)
  const next = idx >= 0
    ? existing.map((p, i) => (i === idx ? preset : p))
    : [...existing, preset]

  writeStorage(next)
  return preset
}

/**
 * Load a preset into the live stores.
 * After calling this, callers MUST call pane.refresh() to sync Tweakpane UI.
 */
export function loadPreset(name: string): boolean {
  const preset = getPreset(name)
  if (!preset) return false

  paramStore.replace(preset.params)
  modulationStore.setRoutes(preset.modulationRoutes)
  return true
}

export function deletePreset(name: string): void {
  const next = readStorage().filter((p) => p.name !== name)
  writeStorage(next)
}

// ------------------------------------------------------------------
// File export / import
// ------------------------------------------------------------------

/**
 * Triggers a browser download of the named preset as a .json file.
 * The file contains a single Preset object (not an array).
 */
export function exportPresetFile(name: string): void {
  const preset = getPreset(name)
  if (!preset) {
    console.warn('[presets] exportPresetFile: preset not found:', name)
    return
  }
  const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name.replace(/[^a-z0-9_-]/gi, '_')}.hand-tracker-fx.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Imports a preset from a File object (from <input type="file">).
 * Validates the schema, saves to localStorage, and optionally loads it.
 * Returns the validated Preset or throws on invalid file.
 */
export async function importPresetFile(
  file: File,
  { loadImmediately = true } = {},
): Promise<Preset> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Preset file is not valid JSON')
  }

  if (!isValidPreset(parsed)) {
    throw new Error(
      'Preset file failed validation: expected { version:1, name, effectId, params, modulationRoutes, createdAt }',
    )
  }

  // Add to localStorage (overwrite if same name)
  const existing = readStorage()
  const idx = existing.findIndex((p) => p.name === parsed.name)
  const next =
    idx >= 0
      ? existing.map((p, i) => (i === idx ? parsed : p))
      : [...existing, parsed]
  writeStorage(next)

  if (loadImmediately) {
    loadPreset(parsed.name)
  }

  return parsed
}
```

---

### File: `src/ui/PresetCycler.ts` (logic — no JSX)

```ts
/**
 * Preset cycler logic (D11, D30).
 * Drives both the chevron buttons and keyboard ArrowLeft/ArrowRight.
 * Framework-agnostic: call cycle() and subscribe to onChange.
 */

import { listPresets, loadPreset, type Preset } from '../engine/presets'
import { paramStore } from '../engine/paramStore'

type CyclerState = {
  presets: Preset[]
  currentIndex: number
}

type ChangeHandler = (state: CyclerState) => void

function createPresetCycler() {
  let state: CyclerState = {
    presets: listPresets(),
    currentIndex: 0,
  }
  const handlers = new Set<ChangeHandler>()

  function notify() {
    handlers.forEach((h) => h(state))
  }

  function refresh() {
    state = { ...state, presets: listPresets() }
    notify()
  }

  function cycleNext(pane?: import('tweakpane').Pane) {
    if (state.presets.length === 0) return
    const next = (state.currentIndex + 1) % state.presets.length
    state = { ...state, currentIndex: next }
    loadPreset(state.presets[next].name)
    pane?.refresh()
    notify()
  }

  function cyclePrev(pane?: import('tweakpane').Pane) {
    if (state.presets.length === 0) return
    const prev = (state.currentIndex - 1 + state.presets.length) % state.presets.length
    state = { ...state, currentIndex: prev }
    loadPreset(state.presets[prev].name)
    pane?.refresh()
    notify()
  }

  function goTo(index: number, pane?: import('tweakpane').Pane) {
    if (index < 0 || index >= state.presets.length) return
    state = { ...state, currentIndex: index }
    loadPreset(state.presets[index].name)
    pane?.refresh()
    notify()
  }

  function onChange(handler: ChangeHandler): () => void {
    handlers.add(handler)
    return () => handlers.delete(handler)
  }

  function getState(): CyclerState {
    return state
  }

  return { cycleNext, cyclePrev, goTo, refresh, onChange, getState }
}

export const presetCycler = createPresetCycler()
```

**PresetBar.tsx — React integration with keyboard support:**
```tsx
import { useEffect, useRef, useState } from 'react'
import { presetCycler } from './PresetCycler'
import type { Pane } from 'tweakpane'

type Props = { paneRef: React.RefObject<Pane | null> }

export function PresetBar({ paneRef }: Props) {
  const [cyclerState, setCyclerState] = useState(presetCycler.getState)

  // Subscribe to cycler changes
  useEffect(() => {
    return presetCycler.onChange(setCyclerState)
  }, [])

  // ArrowLeft / ArrowRight keyboard cycling (D11, D30)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't steal keys when user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        presetCycler.cyclePrev(paneRef.current ?? undefined)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        presetCycler.cycleNext(paneRef.current ?? undefined)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [paneRef])

  const { presets, currentIndex } = cyclerState
  const currentName = presets[currentIndex]?.name ?? '—'

  return (
    <div className="preset-bar">
      <button
        aria-label="Previous preset"
        onClick={() => presetCycler.cyclePrev(paneRef.current ?? undefined)}
        disabled={presets.length <= 1}
      >
        &#8249;
      </button>
      <span className="preset-name">{currentName}</span>
      <button
        aria-label="Next preset"
        onClick={() => presetCycler.cycleNext(paneRef.current ?? undefined)}
        disabled={presets.length <= 1}
      >
        &#8250;
      </button>
    </div>
  )
}
```

---

### Default Preset (D29, D30, reference screenshot)

Shipped at first launch if `localStorage` has no presets. Matches the reference screenshot values: 12 columns, 8 rows, 0.6 width variance, seed 42, tileSize 16, blendOpacity 1.0, default modulation routes.

```ts
// src/engine/presets.ts — add this initialization function

import { DEFAULT_MODULATION_ROUTES } from './modulation'
import { DEFAULT_PARAM_STATE } from './paramStore'

export const DEFAULT_PRESET: Preset = {
  version: 1,
  name: 'Default',
  effectId: 'handTrackingMosaic',
  params: structuredClone(DEFAULT_PARAM_STATE),
  modulationRoutes: structuredClone(DEFAULT_MODULATION_ROUTES),
  createdAt: '2026-04-14T00:00:00.000Z',
}

/**
 * Call at app boot (before Panel mounts).
 * If no presets exist in localStorage, seeds with DEFAULT_PRESET and loads it.
 */
export function initializePresetsIfEmpty(): void {
  const existing = readStorage()
  if (existing.length === 0) {
    writeStorage([DEFAULT_PRESET])
    loadPreset('Default')
  }
}
```

Call site in `main.tsx`:
```ts
import { initializePresetsIfEmpty } from './engine/presets'
initializePresetsIfEmpty()
```

---

## Recommended Approach

1. Create `src/engine/paramStore.ts` first — it is the dependency for everything else. No external packages needed.
2. Add `bezier-easing` and `@tweakpane/plugin-essentials` to `package.json`.
3. Create `src/engine/modulation.ts` + `src/engine/modulationStore.ts`.
4. Create `src/engine/presets.ts` with the exact Preset type from D29.
5. Implement `src/engine/buildPaneFromManifest.ts` — pass `[EssentialsPlugin]` as the plugins array.
6. Wire `buildPaneFromManifest` inside `Panel.tsx` via `useEffect` with cleanup.
7. Create `src/ui/PresetCycler.ts` and `src/ui/PresetBar.tsx`.
8. Call `initializePresetsIfEmpty()` in `main.tsx` before React root renders.
9. In the render loop, call `resolveModulationSources()` then `applyModulation()` each frame; write modulated params back via `paramStore.replace()` only when values actually differ (add a fast reference check).

---

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Zustand vanilla store | Devtools, subscribeWithSelector | Extra package, more abstraction | Rejected — D20 says plain object |
| Preact signals | Zero-overhead propagation | Non-standard reactive primitive | Rejected |
| Zod for preset validation | Type-safe parse + error messages | Adds dependency; overkill for one schema | Optional — manual validation sufficient for MVP |
| `pane.exportState()` as `params` field | Captures UI widget state too | Fragile if manifest changes; semantic params are clearer | Use semantic params (D29 schema); `exportState` only for advanced debug |

---

## Pitfalls and Edge Cases

- **React StrictMode double-mount.** `useEffect` fires twice in development. Guard with `if (!containerRef.current) return` and always return `dispose()` from the effect cleanup. Tweakpane throws if `addBinding` is called on a disposed pane.

- **pane.refresh() is required after preset load.** Tweakpane does not observe the bound object automatically. After `paramStore.replace()` + `modulationStore.setRoutes()`, call `paneRef.current?.refresh()` immediately. Without this, the panel shows stale values until the user interacts.

- **Bezier cache invalidation.** The `bezierCache` Map in `modulation.ts` grows unbounded if users create many unique control-point combinations. For MVP (two default routes, user-editable), this is fine. Add a `MAX_CACHE_SIZE = 50` eviction if needed.

- **structuredClone availability.** Requires Chrome 98+, Firefox 94+, Safari 15.4+. All within the D21 target browsers. Do not polyfill.

- **Modulation writes vs. slider interaction.** When a route is enabled, `applyModulation` overwrites `mosaic.tileSize` every frame. If the user drags the Tweakpane slider simultaneously, the modulated value will snap back each frame. Solution: in the render loop, skip modulation writes for params that have `modulationLocked: false`. A future enhancement is a per-param "under modulation control" visual indicator (green tint, matching TD behavior). For MVP, this is acceptable.

- **localStorage serialization of floating-point numbers.** `JSON.stringify`/`JSON.parse` round-trips floats correctly for the precision needed (3 decimal places for 0.0–1.0 range). No custom serializer needed.

- **Preset import with unknown effectId.** The `isValidPreset` guard checks `effectId === 'handTrackingMosaic'`. A preset file from a future multi-effect version would fail this check. This is intentional for MVP safety.

- **Tweakpane ESM-only.** Vite handles this. Do not attempt `require('tweakpane')` in any test runner config — use `vitest` with `environment: 'jsdom'` and the default ESM transform.

- **CubicBezier change event type.** The Essentials plugin's `change` event for the `cubicbezier` blade emits `ev.value` as `[number, number, number, number]`. TypeScript will infer `ev` as `{ value: unknown }` without the type assertion shown above. Cast explicitly.

- **ArrowLeft/ArrowRight when Tweakpane has focus.** Tweakpane number inputs respond to arrow keys internally. The keyboard handler in `PresetBar.tsx` checks `e.target instanceof HTMLInputElement` to avoid stealing those events.

---

## References

- [Tweakpane v4 Pane class API](https://tweakpane.github.io/docs/api/classes/Pane.html)
- [Tweakpane input bindings](https://tweakpane.github.io/docs/input-bindings/)
- [Tweakpane UI components (folder/tab/blade)](https://tweakpane.github.io/docs/ui-components/)
- [Tweakpane misc — exportState/importState/refresh](https://tweakpane.github.io/docs/misc/)
- [tweakpane/plugin-essentials — GitHub](https://github.com/tweakpane/plugin-essentials)
- [tweakpane/plugin-essentials — npm (0.2.1)](https://www.npmjs.com/package/@tweakpane/plugin-essentials)
- [useSyncExternalStore — React docs](https://react.dev/reference/react/useSyncExternalStore)
- [bezier-easing — npm](https://github.com/gre/bezier-easing)
- [TouchDesigner Parameter docs](https://derivative.ca/UserGuide/Parameter)

---

## Second Wave Additions

### Implementation Details (filtered by DISCOVERY.md)

**D20 — plain-object paramStore, not Zustand:**
The implementation above uses a zero-dependency hand-rolled store that satisfies `useSyncExternalStore`'s `subscribe`/`getSnapshot` contract exactly. No Zustand. The first-wave research recommended Zustand; this second wave supersedes that recommendation per D20.

**D29 — exact Preset schema shape:**
`params` stores the semantic `ParamState` object (not `pane.exportState()` output). `modulationRoutes` is the `ModulationRoute[]` array. The `pane.exportState()` approach is deliberately excluded because it captures UI widget state (folder collapsed/open) and is fragile against manifest schema changes.

**D36 — effect manifest drives panel construction:**
`buildPaneFromManifest` iterates `manifest.params`, groups by `page` into `addTab` pages, groups by `folder` into `addFolder` sections, and calls `addBinding`/`addButton` per `ParamDef`. The manifest file at `src/effects/handTrackingMosaic/manifest.ts` is the single source of truth for what params appear, in what order, on which page.

**Render loop integration pattern:**
```ts
// engine/renderer.ts — per-frame sketch
function onVideoFrame(timeMs: number) {
  const landmarks = handLandmarker.getLatestLandmarks()
  const sources = resolveModulationSources(landmarks)
  const routes = modulationStore.getSnapshot().routes
  // applyModulation returns a new object only if something changed
  const modulated = applyModulation(routes, sources, paramStore.snapshot)
  if (modulated !== paramStore.snapshot) {
    paramStore.replace(modulated)
    // Do NOT call pane.refresh() here — too expensive per-frame.
    // Tweakpane panel reads will lag by one React render cycle; that is acceptable.
  }
  // Pass paramStore.snapshot to the WebGL effect render
  activeEffect.render({ ..., params: paramStore.snapshot })
  video.requestVideoFrameCallback(onVideoFrame)
}
```

Note on `pane.refresh()` in the render loop: calling it 30 times/second would force Tweakpane to re-read all bindings on every frame, which is fine for a small panel but unnecessary since Tweakpane already reflects the binding target values that `paramStore.replace()` updates. Only call `pane.refresh()` explicitly after a preset load (one-shot) or after the user reopens the panel.

### Tool and MCP Configuration

| Tool/Service | Purpose | Setup Required | Agent Can Self-Configure? |
|---|---|---|---|
| pnpm | Package installation | None | Yes (`pnpm add tweakpane @tweakpane/plugin-essentials bezier-easing`) |
| Vitest + jsdom | Unit tests for stores, modulation, presets | `vitest.config.ts` must set `environment: 'jsdom'` for localStorage tests | Yes |
| Playwright | E2E smoke (fake device) | Chrome launch args | Yes |

### Testing Strategy

Unit tests (Vitest, `src/engine/__tests__/`):

- `paramStore.test.ts`: set() updates snapshot reference, notify fires, replace() syncs bindingTarget, shallowEqual works correctly
- `modulation.test.ts`: `applyModulation` with default routes produces expected tileSize/columnCount for landmark[8].x=0.5 (expect tileSize≈34, columnCount≈12); bezier curve caches correctly; resolveModulationSources with null landmarks returns empty Map
- `presets.test.ts`: savePreset → listPresets → loadPreset round-trip; importPresetFile rejects invalid JSON; deletePreset removes from storage; versioning guard filters out `version:2` entries; DEFAULT_PRESET loads without error
- `buildPaneFromManifest.test.ts`: given a mock manifest with two pages and one folder, verify tab count and folder creation (mock Pane with jest.fn stubs)

Test assets needed:
- A mock `HandTrackingMosaicManifest` with 3 params across 2 pages
- A valid preset JSON string for import tests
- A corrupt/invalid JSON string for error path tests

### Human Actions Required

| Action | Who | How | Status |
|---|---|---|---|
| None — fully agent-implementable | — | — | — |
