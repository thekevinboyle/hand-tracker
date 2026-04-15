# Parameter UI + Effect Architecture - Research

**Wave**: First
**Researcher**: Web research agent — UI library comparison, TouchDesigner parameter patterns, reactive binding, CHOP-style modulation, effect registry, preset patterns
**Date**: 2026-04-14
**Status**: Complete

---

## Summary

Tweakpane 4 is the recommended parameter panel library for this project: it is framework-agnostic (no React re-render overhead), ships a native Point 2D binding that maps directly to the XY modulation use case, has a clean exportState/importState preset API, and has a far lower open-issue surface than leva. The effect architecture should use a typed manifest registry pattern — each effect exports a single `EffectManifest` object containing its parameter schema, render function, and metadata, registered into a central `effectRegistry`. A Zustand vanilla store holds live parameter state; the canvas render loop reads it via `getState()` entirely outside of React, keeping the 30 fps target achievable without fighting React's scheduler.

---

## Key Findings

### 1. Parameter Panel Libraries — Comparison

#### leva (pmndrs/leva) — v0.10.1

- **React-first hooks API.** `useControls(schema)` returns live values as a plain object; an optional function form `useControls(() => schema)` returns `[values, set, get]` for bidirectional control from outside the GUI.
- **Folder grouping.** `folder({ key: value })` inside the schema creates a collapsible section. Folders can be nested.
- **Input types.** Number (auto-slider when min+max set), string, boolean, color, vector2/3, interval (range slider), select, image. Type is inferred from value or explicit schema key.
- **Persistence.** Values are persisted between React re-renders automatically (like useState). There is no built-in localStorage save/load for named presets — that requires a separate persistence layer.
- **Multiple stores.** `useCreateStore()` + `useControls({ ... }, { store })` allows isolated panels.
- **Transient onChange.** Inputs with `onChange` callbacks skip React re-renders entirely (transient mode) — useful for high-frequency canvas updates.
- **TypeScript.** 99% TypeScript, smart inference.
- **Theming.** CSS variable theming documented; dark mode default.
- **Maintenance.** v0.10.1 released October 2025. 123 open issues as of April 2026. Active (architectural discussions about Tailwind migration). React 18 StrictMode has known issues.
- **Key limitation.** Tightly coupled to React's render cycle. Getting values into a canvas loop outside React requires the `onChange` transient pattern, which is workable but adds indirection.

#### Tweakpane — v4.0.5

- **Framework-agnostic.** Zero dependencies; integrates into any environment with a plain JS binding model.
- **Binding model.** `pane.addBinding(obj, 'key', options)` — mutates the source object directly and fires `on('change', cb)` events. No framework needed.
- **Folder / Tab / Blade organization.** `pane.addFolder({ title })` returns a folder that accepts the same `addBinding` calls. `pane.addTab({ pages: [{title},...] })` creates tabbed pages — direct TouchDesigner page analogue.
- **Input types (built-in).** Number (slider when min+max), string (text or options dropdown), boolean (checkbox), color (`{r,g,b}` or CSS string), Point 2D (`{x,y}` auto-detects; supports per-axis `min/max/step`, `inverted`, `picker: 'inline'`), Point 3D (`{x,y,z}`).
- **Plugin-essentials package (`@tweakpane/plugin-essentials`).** Adds: interval slider, FPS graph, radio grid, button grid, cubic Bezier editor.
- **No native XY pad with a visual crosshair** — the Point 2D binding shows two numeric fields + a picker widget, not a draggable 2D canvas pad. For a full 2D scrubber, a custom plugin would be needed.
- **State import/export.** `pane.exportState()` returns a plain JSON-serializable object; `pane.importState(obj)` restores it. Works at folder level too. Directly maps to localStorage or file export.
- **Theming.** CSS custom properties (`--tp-base-background-color`, etc.) for full visual customization.
- **TypeScript.** Full type support; install `@tweakpane/core` for type definitions.
- **React integration options.** Three paths: (a) `tweakpane/use-tweaks` hook (official, minimal); (b) `react-tweakpane` (MelonCode, hook-based with per-blade hooks); (c) plain `useEffect` / `useRef` imperative mount — most stable for production.
- **Maintenance.** v4.0.5 released November 2024. Only 31 open issues. ESM-only from v4 (CJS available in v3).
- **Key strength.** The binding model reads directly from a plain JS object — the same object that the canvas loop already holds. No adapter layer required between state and render.

#### dat.GUI — v0.7.9

- Last meaningful update: 4+ years ago. 122 open issues. **Do not use** — effectively unmaintained.

#### lil-gui

- Drop-in dat.GUI replacement. Smaller, actively maintained (used by three.js examples). No React integration; imperative like Tweakpane. Fine for vanilla TS but less polished than Tweakpane.

#### Theatre.js / theatric

- Timeline-based animation toolset with a Leva-like panel via `theatric`. Excellent for keyframed animation authoring, but heavyweight (studio UI, project files) and mismatched to live realtime modulation. Not suitable here.

#### controlkit

- Unmaintained (last commit 2016). Reject.

#### NodeGUI

- Native desktop GUI via Node.js + Qt. Not browser-based. Not applicable.

---

### 2. TouchDesigner Parameter System — Architecture Reference

TouchDesigner's parameter UI is the direct inspiration. Key concepts to model:

| TD Concept | Description | Browser Analogue |
|---|---|---|
| **Parameter Pages** | Tabbed groupings at the top of the parameter panel (e.g., "Grid", "Effect", "Input") | Tweakpane `addTab({ pages: [{title:'Grid'}, ...] })` |
| **Parameter Folders** | Collapsible sub-groups within a page | Tweakpane `addFolder({ title })` |
| **Float / Int params** | Numeric with normMin/normMax (display range) and min/max (hard clamp) | `addBinding(obj, key, { min, max, step })` |
| **Toggle** | Boolean on/off | `addBinding(obj, key)` on a boolean |
| **Menu / Enum** | Dropdown select | `addBinding(obj, key, { options: { label: value } })` |
| **String** | Text input | `addBinding(obj, key)` on a string |
| **XY / XYZ** | Multi-axis numeric, optionally a 2D pad | `addBinding(obj, key)` on `{x,y}` object |
| **Pulse / Button** | Trigger action | `pane.addButton({ title })` |
| **Ramp / CHOP Export** | Drive a parameter from a data channel over time | Custom modulation layer (see section 4) |
| **normMin / normMax** | The slider display range, independent of hard clamp | Separate `displayMin`/`displayMax` in manifest schema |

TD organizes parameters in a **component → pages → folders → parameters** hierarchy. The browser equivalent: `effectRegistry → tabs/pages → folders → bindings`.

---

### 3. Parameter-to-Effect Binding Patterns

Three credible patterns for connecting a parameter store to a live canvas render:

#### A. Zustand Vanilla Store + Subscribe (Recommended)

```typescript
// store/paramStore.ts
import { createStore } from 'zustand/vanilla'
import { subscribeWithSelector } from 'zustand/middleware'

export const paramStore = createStore(
  subscribeWithSelector(() => ({
    grid: { cols: 12, rows: 8, lineColor: '#00ff88', lineWeight: 1 },
    effect: { mosaicTileSize: 16, blendOpacity: 0.9 },
    tracking: { maxHands: 1, showLandmarks: true },
    modulation: { xParam: 'effect.mosaicTileSize', xRange: [4, 64] },
  }))
)

// In canvas render loop (outside React):
function renderFrame() {
  const params = paramStore.getState()
  drawGrid(params.grid)
  applyMosaic(params.effect)
  requestAnimationFrame(renderFrame)
}

// Tweakpane directly mutates a mirrored plain object,
// then calls paramStore.setState(newValue) in the onChange callback.
```

**Why this works:** `getState()` is a synchronous O(1) read with no React involvement. `subscribeWithSelector` lets the panel component subscribe only to the keys it renders, preventing unnecessary React re-renders in the sidebar.

#### B. Reactive Signals (Preact Signals or @maverick-js/signals)

Fine-grained reactivity, zero-overhead propagation. `signal.value = newVal` pushes to subscribers immediately. Works well but adds a non-standard reactive primitive that requires discipline. Overkill for one effect.

#### C. Observer / EventEmitter on a Plain Object

The simplest approach — a plain mutable object plus a tiny EventEmitter. Tweakpane's `on('change')` fires the emitter, the canvas loop listens. Very low overhead. Lacks the devtools story of Zustand. Viable for a small project.

**Decision for this project:** Pattern A (Zustand vanilla + subscribeWithSelector). It integrates with React for the panel's sidebar state, gives the canvas loop a synchronous read path, and provides middleware hooks for the preset save/load layer.

---

### 4. X/Y Axis Modulation — CHOP-Style Pattern

The PRD requires mapping a tracked input source (hand X/Y position in `[0, 1]`) to one or more parameters with configurable range and curve. This is the CHOP export / expression pattern from TouchDesigner.

#### Modulation Descriptor Schema

```typescript
interface ModulationRoute {
  id: string                // unique ID for this route
  source: 'handX' | 'handY' | 'handZ' | 'pinchStrength'
  targetParam: string       // dot-path into paramStore: "effect.mosaicTileSize"
  inputRange: [number, number]   // clamp source values, default [0, 1]
  outputRange: [number, number]  // map to this param range, e.g. [4, 64]
  curve: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'cubicBezier'
  bezierControlPoints?: [number, number, number, number] // if curve === 'cubicBezier'
  enabled: boolean
}
```

#### Mapping Function

```typescript
function applyModulation(
  rawValue: number,          // e.g. hand.x = 0.73
  route: ModulationRoute
): number {
  // 1. clamp to inputRange
  const t = Math.max(0, Math.min(1,
    (rawValue - route.inputRange[0]) / (route.inputRange[1] - route.inputRange[0])
  ))
  // 2. apply curve
  const curved = applyCurve(t, route.curve, route.bezierControlPoints)
  // 3. map to outputRange
  return route.outputRange[0] + curved * (route.outputRange[1] - route.outputRange[0])
}
```

Curves use standard easing functions — the `bezier-easing` npm package (MIT, 500B gzipped) provides cubic Bezier matching CSS's `cubic-bezier()`. The Tweakpane Essentials plugin ships a **Cubic Bezier editor blade** that can directly drive the `bezierControlPoints` values.

#### Modulation Engine in the Render Loop

```
Each frame:
  1. Read hand landmark data (MediaPipe output)
  2. For each enabled ModulationRoute:
     a. Read source value from landmark data
     b. Compute mapped output value via applyModulation()
     c. Write to paramStore via paramStore.setState()
  3. Read full params from paramStore.getState()
  4. Render frame using params
```

The modulation routes are themselves parameters, editable in the panel under a "Modulation" tab/page.

---

### 5. Effect Module Architecture — Drop-In Registry

#### Effect Manifest Schema

Each effect is a self-contained module that exports a typed `EffectManifest`. The core engine knows nothing about specific effects — it only knows the manifest interface.

```typescript
// types/effect-manifest.ts

export type ParamType =
  | 'number'
  | 'integer'
  | 'boolean'
  | 'select'
  | 'color'
  | 'point2d'
  | 'string'
  | 'button'

export interface ParamDef {
  key: string                   // dot-path key within this effect's param namespace
  label: string                 // display name in panel
  type: ParamType
  defaultValue: unknown
  // number / integer options
  min?: number
  max?: number
  step?: number
  displayMin?: number           // slider display range (TD normMin analogue)
  displayMax?: number
  // select options
  options?: Record<string, unknown>
  // grouping
  page?: string                 // tab/page name, default 'Main'
  folder?: string               // folder within the page
  // callbacks
  onChange?: (value: unknown, allParams: unknown) => void
}

export interface EffectManifest<TParams = Record<string, unknown>> {
  id: string                    // unique slug: 'hand-mosaic'
  displayName: string           // 'Hand Mosaic Grid'
  version: string               // '1.0.0'
  description: string
  params: ParamDef[]            // ordered list — panel builds from this
  defaultParams: TParams        // full default param object
  // Lifecycle
  init: (canvas: HTMLCanvasElement, params: TParams) => void | Promise<void>
  render: (
    canvas: HTMLCanvasElement,
    params: TParams,
    frameCtx: FrameContext
  ) => void
  dispose?: (canvas: HTMLCanvasElement) => void
  // Optional modulation hints: which params make good mod targets
  modulationTargets?: string[]  // keys from params array
}

export interface FrameContext {
  landmarks: HandLandmark[][]   // [handIndex][landmarkIndex]
  videoElement: HTMLVideoElement
  timestamp: number
  deltaTime: number
}
```

#### Effect Registry

```typescript
// registry/effectRegistry.ts
import type { EffectManifest } from '../types/effect-manifest'

const registry = new Map<string, EffectManifest>()

export function registerEffect(manifest: EffectManifest) {
  if (registry.has(manifest.id)) {
    throw new Error(`Effect "${manifest.id}" is already registered`)
  }
  registry.set(manifest.id, manifest)
}

export function getEffect(id: string): EffectManifest {
  const m = registry.get(id)
  if (!m) throw new Error(`Effect "${id}" not found in registry`)
  return m
}

export function getAllEffects(): EffectManifest[] {
  return Array.from(registry.values())
}
```

#### Registering the First Effect

```typescript
// effects/hand-mosaic/manifest.ts
import type { EffectManifest } from '../../types/effect-manifest'
import type { HandMosaicParams } from './types'
import { render } from './render'

export const HandMosaicManifest: EffectManifest<HandMosaicParams> = {
  id: 'hand-mosaic',
  displayName: 'Hand Mosaic Grid',
  version: '1.0.0',
  description: 'Grid overlay with per-cell mosaic driven by hand landmarks',
  modulationTargets: ['effect.mosaicTileSize', 'grid.cols', 'grid.rows'],
  defaultParams: { /* ... */ },
  params: [
    { key: 'grid.cols', label: 'Columns', type: 'integer', min: 4, max: 32, defaultValue: 12, page: 'Grid' },
    { key: 'grid.rows', label: 'Rows', type: 'integer', min: 2, max: 24, defaultValue: 8, page: 'Grid' },
    { key: 'grid.lineColor', label: 'Line Color', type: 'color', defaultValue: '#00ff88', page: 'Grid' },
    { key: 'grid.lineWeight', label: 'Line Weight', type: 'number', min: 0.5, max: 4, step: 0.5, defaultValue: 1, page: 'Grid' },
    { key: 'effect.mosaicTileSize', label: 'Mosaic Tile', type: 'integer', min: 4, max: 64, defaultValue: 16, page: 'Effect' },
    { key: 'effect.blendOpacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.01, defaultValue: 0.9, page: 'Effect' },
    { key: 'tracking.maxHands', label: 'Max Hands', type: 'select', options: { One: 1, Two: 2 }, defaultValue: 1, page: 'Tracking' },
    { key: 'tracking.showLandmarks', label: 'Show Landmarks', type: 'boolean', defaultValue: true, page: 'Tracking' },
  ],
  init: async (canvas, params) => { /* setup */ },
  render,
  dispose: () => { /* teardown */ },
}

// effects/hand-mosaic/index.ts
import { registerEffect } from '../../registry/effectRegistry'
import { HandMosaicManifest } from './manifest'
registerEffect(HandMosaicManifest)
```

Adding a second effect in the future is exactly: create `effects/new-effect/`, export a manifest, call `registerEffect`. The engine panel builder iterates `getAllEffects()` and builds the parameter panel from `manifest.params` automatically.

---

### 6. Panel Builder — Tweakpane from Manifest

The panel component iterates the active effect's `params` array, groups by `page` (→ tabs) and `folder` (→ folders within tabs), and calls `addBinding()` for each:

```typescript
function buildPaneFromManifest(
  pane: Pane,
  manifest: EffectManifest,
  paramObj: Record<string, unknown>
) {
  const pages: Record<string, TabPageApi> = {}
  const tab = pane.addTab({ pages: manifest.params
    .map(p => p.page ?? 'Main')
    .filter((v, i, a) => a.indexOf(v) === i)
    .map(title => ({ title }))
  })

  manifest.params
    .map(p => p.page ?? 'Main')
    .filter((v, i, a) => a.indexOf(v) === i)
    .forEach((name, i) => { pages[name] = tab.pages[i] })

  for (const param of manifest.params) {
    const container = pages[param.page ?? 'Main']
    const folder = param.folder
      ? getOrCreateFolder(container, param.folder)
      : container

    // Flatten dot-path key into nested paramObj for Tweakpane binding
    const { host, leafKey } = resolvePath(paramObj, param.key)

    folder.addBinding(host, leafKey, {
      label: param.label,
      ...(param.min !== undefined && { min: param.min }),
      ...(param.max !== undefined && { max: param.max }),
      ...(param.step !== undefined && { step: param.step }),
      ...(param.options && { options: param.options }),
    }).on('change', ({ value }) => {
      // Write back to paramStore
      paramStore.setState(setNestedValue(paramStore.getState(), param.key, value))
    })
  }
}
```

---

### 7. Preset Save/Load Pattern

#### Storage Schema

```typescript
interface Preset {
  id: string               // uuid or slug
  name: string
  effectId: string         // which effect this preset belongs to
  createdAt: string        // ISO timestamp
  version: number          // schema version for forward compat
  params: Record<string, unknown>
  modulations: ModulationRoute[]
}
```

#### localStorage Implementation

```typescript
const PRESET_STORAGE_KEY = 'htracker-fx-presets-v1'

export function savePreset(name: string, effectId: string): Preset {
  const preset: Preset = {
    id: crypto.randomUUID(),
    name,
    effectId,
    createdAt: new Date().toISOString(),
    version: 1,
    params: paramStore.getState(),
    modulations: modulationStore.getState().routes,
  }
  const existing = loadAllPresets()
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify([...existing, preset]))
  return preset
}

export function loadPreset(id: string) {
  const preset = loadAllPresets().find(p => p.id === id)
  if (!preset) return
  paramStore.setState(preset.params)
  modulationStore.setState({ routes: preset.modulations })
  // Tweakpane panel rebuilds via store subscription
}

export function exportPresetFile(preset: Preset) {
  const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${preset.name}.htracker.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importPresetFile(file: File): Promise<Preset> {
  return file.text().then(text => {
    const preset = JSON.parse(text) as Preset
    // TODO: validate schema version
    loadPreset(preset.id)
    return preset
  })
}
```

Tweakpane's `pane.exportState()` / `pane.importState()` can be used as an alternative serialization path if you want to capture the exact pane widget state (including collapsed folders). The `params` field in the Preset above captures semantic values; Tweakpane's state captures UI widget state. Both can coexist.

---

### 8. Keyboard Shortcuts + MIDI — Future-Facing Hooks

#### Keyboard

Standard `useEffect(() => { window.addEventListener('keydown', handler) })` pattern. For structured bindings, `hotkeys-js` (npm, ~2KB, no deps) maps key combos to actions. Integrate as `shortcutStore`: a map of `{ combo: ActionFn }`. The parameter panel can expose a "bindings" configuration UI later.

#### MIDI

The Web MIDI API (`navigator.requestMIDIAccess()`) is supported in Chromium-based browsers. For React, `@react-midi/hooks` provides `useMIDIMessage` and `useMIDIInputs` hooks. MIDI CC messages (0-127) map naturally to `inputRange: [0, 127]` in the ModulationRoute schema — the same mapping pipeline handles both hand position and MIDI without separate code paths. Add `source: 'midiCC:channel:cc'` to `ModulationRoute.source` when the time comes.

---

## Recommended Approach

**Library: Tweakpane 4 (vanilla) with a custom React mount hook**

1. Use Tweakpane 4 (`tweakpane` + `@tweakpane/plugin-essentials`) as the parameter panel. Mount it imperatively inside a `useEffect` on a `<div ref>`. Keep it outside React's render cycle.
2. Build a `buildPaneFromManifest(pane, manifest, paramObj)` utility that generates the full tabbed panel from a manifest's `params` array — including pages, folders, and bindings.
3. Use a Zustand vanilla store (`createStore` from `zustand/vanilla`) with `subscribeWithSelector` middleware as the single source of truth for all parameter values.
4. The canvas render loop reads params via `paramStore.getState()` each frame — zero React involvement at render time.
5. Tweakpane `onChange` callbacks write back to `paramStore.setState()`. A Tweakpane-facing plain object acts as the binding target; it stays in sync with the store via a store subscription.
6. Implement the `EffectManifest` schema as a TypeScript interface. Register the single `hand-mosaic` effect at startup. The engine is generic over manifests.
7. Preset save/load uses `localStorage` with the `Preset` schema above; `exportPresetFile` / `importPresetFile` provide JSON portability.

---

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Tweakpane 4** | Framework-agnostic, native Point 2D binding, exportState API, 31 open issues, CSS theming, plugin-essentials Bezier editor | No visual XY crosshair pad; React integration requires imperative mount | **Recommended** |
| **leva (pmndrs)** | React-first hooks, great DX in React, auto TypeScript inference, active pmndrs ecosystem | 123 open issues, no built-in preset management, canvas integration needs transient onChange workaround, React 18 StrictMode bugs | Viable fallback if staying 100% in React |
| **dat.GUI** | Widespread familiarity | Unmaintained 4+ years, 122 open issues | Rejected |
| **lil-gui** | Tiny, dat.GUI compatible, maintained | No React hooks, fewer input types, no tabs | Rejected |
| **Theatre.js/theatric** | Timeline-based, keyframe animation | Heavyweight, not suited to realtime modulation use case | Rejected |
| **controlkit** | Historical reference | Last commit 2016, unmaintained | Rejected |

---

## Pitfalls and Edge Cases

- **Tweakpane ESM-only in v4.** Ensure the build tool (Vite default) handles ESM. CommonJS consumers need v3 or a bundler shim. Vite handles this correctly out of the box.
- **Tweakpane + React double-mount (StrictMode).** React 18 StrictMode runs `useEffect` twice in development. Guard the Tweakpane init with a `ref.current` null check and call `pane.dispose()` in the cleanup function to prevent double-panels.
- **Zustand store and Tweakpane binding object staying in sync.** Tweakpane mutates its bound object; paramStore is the canonical source. On preset load, both must be updated: call `paramStore.setState(preset.params)` AND `pane.importState(preset.tweakpaneState)` (or rebuild the pane). Rebuilding the pane from the manifest is safer — `importState` is fragile if the manifest schema changed.
- **Point 2D binding in Tweakpane is numeric fields + a popover picker, not a draggable canvas pad.** For the XY modulation visualizer in the panel, a custom React component (a simple `<canvas>` or `<svg>` that shows the hand position dot) will be more effective than trying to use the Tweakpane Point 2D widget as the visualizer.
- **High-frequency onChange → localStorage writes.** Debounce preset auto-save at ~500ms minimum. Continuous slider drags would otherwise thrash localStorage.
- **Dot-path parameter keys (e.g., `"effect.mosaicTileSize"`) need a path resolver** when binding Tweakpane (which expects a plain host object + a leaf key). Implement `resolvePath(obj, dotPath)` returning `{ host, leafKey }`.
- **ModulationRoute writes to paramStore during render loop.** If modulation is active AND the user is dragging a slider simultaneously, the modulation write will overwrite the slider value every frame. Add a `modulationLocked` flag per param, or display an indicator that a param is under modulation control (green, like TouchDesigner).

---

## References

- [Tweakpane docs](https://tweakpane.github.io/docs/)
- [Tweakpane input bindings](https://tweakpane.github.io/docs/input-bindings/)
- [Tweakpane UI components (folder/tab/blade)](https://tweakpane.github.io/docs/ui-components/)
- [Tweakpane misc (import/export)](https://tweakpane.github.io/docs/misc/)
- [tweakpane/plugin-essentials](https://github.com/tweakpane/plugin-essentials)
- [tweakpane/use-tweaks — React integration](https://github.com/tweakpane/use-tweaks)
- [pmndrs/leva GitHub](https://github.com/pmndrs/leva)
- [leva useControls hook — DeepWiki](https://deepwiki.com/pmndrs/leva/2.1-usecontrols-hook)
- [npm trends: dat.gui vs leva vs tweakpane](https://npmtrends.com/dat.gui-vs-leva-vs-tweakpane)
- [Zustand vanilla store + subscribe](https://zustand.docs.pmnd.rs/apis/create-store)
- [Zustand subscribeWithSelector middleware](https://github.com/pmndrs/zustand)
- [TouchDesigner Parameter docs](https://derivative.ca/UserGuide/Parameter)
- [TouchDesigner Custom Parameters](https://derivative.ca/UserGuide/Custom_Parameters)
- [TouchDesigner Parameter CHOP](https://docs.derivative.ca/Parameter_CHOP)
- [Manifest Pattern — Andrew Hathaway](https://andrewhathaway.net/blog/manifest-pattern/)
- [bezier-easing (npm)](https://github.com/gre/bezier-easing)
- [@react-midi/hooks](https://www.npmjs.com/package/@react-midi/hooks)
- [hotkeys-js (npm)](https://github.com/jaywcjlove/hotkeys-js)
