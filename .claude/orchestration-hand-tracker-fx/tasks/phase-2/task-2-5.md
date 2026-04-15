# Task 2.5: Build `handTrackingMosaic` Manifest + Register Effect

**Phase**: 2 — Engine + Overlay
**Branch**: `task/2-5-mosaic-manifest`
**Commit prefix**: `Task 2.5:`
**Estimated complexity**: Low
**Max Ralph iterations**: 10

---

## Goal

**Feature Goal**: Declare the full `handTrackingMosaicManifest: EffectManifest<HandTrackingMosaicParams>` — every param from D4 / D9 (grid seed/count/variance/color/weight, mosaic tileSize/blendOpacity/edgeFeather, effect.regionPadding, input.mirrorMode/showLandmarks/deviceId) — and ship a `create(gl)` that returns a temporary `EffectInstance` whose `render(ctx)` calls grid + blob renderers. Phase 3 will replace the noop mosaic draw with the real shader; this task wires everything else.

**Deliverable**:
- `src/effects/handTrackingMosaic/manifest.ts` — `handTrackingMosaicManifest` (typed) + `HandTrackingMosaicParams` type + `DEFAULT_PARAM_STATE` + `create(gl)` returning a minimal `EffectInstance`
- `src/effects/handTrackingMosaic/index.ts` — re-export + `registerEffect(handTrackingMosaicManifest)` side effect
- `src/effects/handTrackingMosaic/manifest.test.ts` — unit tests covering manifest shape, default-param correctness, `create()` returns EffectInstance, `render()` invokes grid + blob renderers
- `src/main.tsx` (MODIFY) — import `./effects/handTrackingMosaic` (triggers registration) + mount `<Panel manifest={handTrackingMosaicManifest} />`
- Dev hook: expose `window.__handTracker.__engine.getParam(dotPath)` / `.getLandmarkBlobCount()` / `.lastGridLayout` for E2E tests in Tasks 2.2/2.3/2.4

**Success Definition**: `pnpm vitest run src/effects/handTrackingMosaic/manifest.test.ts` exits 0, `pnpm build` succeeds, app boots with `<Panel />` visible showing all params from D4/D9. `listEffects()` returns `[handTrackingMosaicManifest]`. Over a live render loop the grid draws + fingertip blobs appear (when a hand is present). The WebGL canvas remains transparent/clear-to-black because the mosaic shader is not yet wired — deliberate, per task scope.

---

## User Persona

**Target User**: Creative technologist opening the app for the first time with camera granted.

**Use Case**: User sees the full Tweakpane panel on the right — Grid tab, Effect tab, Input tab — with every parameter editable. The grid overlay draws over the webcam feed; fingertip blobs appear when a hand is present; mosaic is not yet visible (Phase 3).

**User Journey**:
1. App loads; camera granted
2. `<Panel />` renders on the right with 3 tabs (Grid, Effect, Input)
3. User drags `grid.columnCount` from 12 to 20 → overlay redraws with 20 columns immediately
4. User drags `mosaic.tileSize` from 16 to 64 → no visible mosaic change yet (expected, Phase 3 wires the shader)
5. User sees 5 fingertip blobs when hand is detected
6. User toggles `input.showLandmarks` off → blobs disappear

**Pain Points Addressed**: Without this task, the app has a Panel with no content, no grid, no blobs, no registered effect, and no way to exercise the end-to-end param→render pipeline.

---

## Why

- Required by D4 / D9: every grid + mosaic param must live in the manifest and be editable in the panel
- Required by D36: `EffectManifest.create(gl)` is the only way to instantiate an effect; `registerEffect(manifest)` is the only registration point
- Required by D37: `EffectInstance.render(ctx: FrameContext)` consumes the per-frame context from the render loop
- Integrates Task 2.1 (types), 2.2 (paramStore + Panel), 2.3 (grid + gridRenderer), 2.4 (blobRenderer) into a single cohesive effect
- Unlocks Phase 3 (mosaic shader replaces the noop mosaic draw in `render()`)
- Unlocks Task 2.R regression — the full Phase 2 pipeline is observable end-to-end

---

## What

- Declare `HandTrackingMosaicParams` TypeScript type with concrete shape matching DISCOVERY D4 + D9 values:
  - `grid.seed: number` (default 42)
  - `grid.columnCount: number` (default 12, min 4, max 32)
  - `grid.rowCount: number` (default 8, min 2, max 24)
  - `grid.widthVariance: number` (default 0.6, min 0, max 1, step 0.01)
  - `grid.lineColor: string` (default '#00ff88')
  - `grid.lineWeight: number` (default 1, min 0.5, max 4, step 0.5)
  - `mosaic.tileSize: number` (default 16, min 4, max 64, step 1)
  - `mosaic.blendOpacity: number` (default 1.0, min 0, max 1, step 0.01)
  - `mosaic.edgeFeather: number` (default 0, min 0, max 8, step 0.5)
  - `effect.regionPadding: number` (default 1, min 0, max 4, step 1)
  - `input.mirrorMode: boolean` (default true)
  - `input.showLandmarks: boolean` (default true)
  - `input.deviceId: string` (default '')
- Declare `ParamDef[]` array with the right `type`/`page`/`folder` metadata per param
- Include a `type: 'button'` param `grid.randomize` with `onClick: (snapshot) => paramStore.set('grid.seed', randInt32())`
- `modulationSources: ModulationSourceDef[]` — declare the 21 landmark sources + pinch + centroid (no runtime wiring yet; Phase 4)
- `create(gl)` returns an `EffectInstance`:
  - `render(frameCtx)`:
    - Read `paramStore.snapshot` (grid + input params)
    - Get the 2D canvas context via a module ref set by the engine (or pass through `frameCtx` — add `ctx2d: CanvasRenderingContext2D` to FrameContext in this task)
    - Clear the 2D canvas (fill transparent)
    - Build grid layout via `buildGridLayout(snapshot.grid)`
    - Call `drawGrid(ctx2d, layout, target, { lineColor, lineWeight })`
    - Call `drawLandmarkBlobs(ctx2d, frameCtx.landmarks, target, style, { mirror: input.mirrorMode, showLandmarks: input.showLandmarks })` — record returned count into a module-level `lastBlobCount`
    - Mosaic shader draw is DEFERRED (Phase 3) — noop here. Clear the WebGL canvas to black via a simple `gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT)`.
  - `dispose()`: release any allocated resources (none in MVP noop)
- Register via `import './effects/handTrackingMosaic'` from `main.tsx`

### NOT Building (scope boundary)

- No mosaic fragment shader (Phase 3 — Tasks 3.1–3.4)
- No active-cell region math (Phase 3 — Task 3.3)
- No modulation evaluator — manifest declares sources but paramStore is not yet modulated (Phase 4)
- No preset save/load — paramStore defaults only (Phase 4)
- No RecordButton / MediaRecorder (Phase 4)
- No additional effects — MVP ships exactly one
- No reduced-motion gating

### Success Criteria

- [ ] `handTrackingMosaicManifest.id === 'handTrackingMosaic'`
- [ ] `handTrackingMosaicManifest.params.length >= 13` (all D4 + D9 + input + randomize button)
- [ ] `defaultParams` matches DISCOVERY values exactly (seed=42, cols=12, rows=8, variance=0.6, tileSize=16, blendOpacity=1.0, edgeFeather=0, regionPadding=1, mirrorMode=true, showLandmarks=true)
- [ ] `listEffects()` returns `[handTrackingMosaicManifest]` after `import './effects/handTrackingMosaic'`
- [ ] `create(fakeGl).render(fakeFrameCtx)` invokes `drawGrid` and `drawLandmarkBlobs` (spied)
- [ ] "Randomize Grid" button mutates `grid.seed` in paramStore
- [ ] `pnpm lint src/effects/handTrackingMosaic src/main.tsx` exits 0
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm vitest run src/effects/handTrackingMosaic/manifest.test.ts` exits 0

---

## All Needed Context

```yaml
files:
  - path: src/engine/manifest.ts
    why: CONSUMES — EffectManifest, EffectInstance, ParamDef, FrameContext, ModulationSourceDef types
    gotcha: ParamDef is a discriminated union; each entry must match exactly one variant

  - path: src/engine/registry.ts
    why: Registration — registerEffect(handTrackingMosaicManifest) at module load
    gotcha: Tests must call clearRegistry() in beforeEach; manifest.ts import has side effects

  - path: src/engine/paramStore.ts
    why: Manifest's onClick / onChange handlers write to paramStore.set(); render reads paramStore.snapshot
    gotcha: paramStore is a singleton; replace() must happen ONCE at startup to seed defaults from the manifest

  - path: src/engine/buildPaneFromManifest.ts
    why: Panel mounts Tweakpane from manifest.params — this task produces the consumer manifest
    gotcha: ParamDef 'button' variant requires onClick; ensure the closure captures paramStore correctly

  - path: src/effects/handTrackingMosaic/grid.ts
    why: buildGridLayout(input) consumed by render()
    gotcha: Pure function; no paramStore dependency — render() passes snapshot.grid directly

  - path: src/effects/handTrackingMosaic/gridRenderer.ts
    why: drawGrid(ctx, layout, target, style) consumed by render()
    gotcha: Takes LOGICAL pixel dimensions; Stage.tsx applies dpr scale once

  - path: src/effects/handTrackingMosaic/blobRenderer.ts
    why: drawLandmarkBlobs(ctx, landmarks, target, style, opts) consumed by render()
    gotcha: opts.mirror must match paramStore.snapshot.input.mirrorMode

  - path: src/App.tsx
    why: MODIFY to mount <Panel manifest={handTrackingMosaicManifest} /> alongside Stage + error UI
    gotcha: Keep existing structure; add Panel as a sibling div, not nested inside Stage

  - path: src/main.tsx
    why: MODIFY to import './effects/handTrackingMosaic' exactly once at module top (triggers registerEffect). The scaffold uses a flat `src/` layout; there is NO `src/app/` subfolder anywhere in this project.
    gotcha: Side-effect import — must be placed BEFORE App mount or the first render finds an empty registry

  - path: src/engine/types.ts (from Task 1.5)
    why: FrameContext type may live here; if so, MODIFY to add ctx2d?: CanvasRenderingContext2D
    gotcha: Keep backward compat with Task 1.5 consumers; optional field

urls:
  - url: https://google.github.io/mediapipe/solutions/hands.html
    why: 21-landmark indexing — confirms fingertip indices for modulationSources declaration
    critical: Index 0 = wrist; 4 = thumb tip; 8 = index; 12 = middle; 16 = ring; 20 = pinky

  - url: https://tweakpane.github.io/docs/input-bindings/#color
    why: Tweakpane auto-detects color strings — ParamDef { type: 'color', defaultValue: '#00ff88' } works
    critical: Use a hex string — not an RGB object — to let the plugin coerce correctly

  - url: https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext
    why: create(gl) receives WebGL2RenderingContext; Phase 3 uses it for the mosaic program
    critical: In this task the noop render() uses only gl.clearColor + gl.clear — no program compile

skills:
  - tweakpane-params-presets
  - hand-tracker-fx-architecture
  - ogl-webgl-mosaic       # for coordinate conventions + preview of Phase 3
  - vitest-unit-testing-patterns
  - prp-task-ralph-loop

discovery:
  - D4: Grid params — seed, columnCount, rowCount, widthVariance + Randomize button rerolls seed
  - D6: Fingertip landmarks (4, 8, 12, 16, 20) — used by blob renderer
  - D8: 1 hand
  - D9: Mosaic params — tileSize default 16 (range 4-64), blendOpacity default 1.0 (range 0-1), edgeFeather default 0 (range 0-8)
  - D10: Mirror mode ON by default
  - D13: Default modulation routes — landmark[8].x → mosaic.tileSize, landmark[8].y → grid.columnCount (manifest declares sources; wiring in Phase 4)
  - D15: Modulation sources — landmark[0..20].x|y, pinch, centroid.x|y
  - D36: EffectManifest/EffectInstance contract
  - D37: FrameContext passed to render()
  - D38: src/effects/handTrackingMosaic/manifest.ts + index.ts
```

### Current Codebase Tree (relevant subset)

```
src/
  engine/
    manifest.ts              # Task 2.1 types
    registry.ts              # Task 2.1
    paramStore.ts            # Task 2.2
    buildPaneFromManifest.ts # Task 2.2
    types.ts                 # Task 1.5 — FrameContext
    renderLoop.ts            # Task 1.5
    devHooks.ts              # Task 1.5 — window.__handTracker
  effects/
    handTrackingMosaic/
      grid.ts                # Task 2.3
      gridRenderer.ts
      grid.test.ts
      gridRenderer.test.ts
      blobRenderer.ts        # Task 2.4
      blobRenderer.test.ts
  ui/
    Panel.tsx                # Task 2.2
    Stage.tsx                # Task 1.6
  App.tsx
  main.tsx
```

### Desired Codebase Tree (files this task adds or modifies)

```
src/
  effects/
    handTrackingMosaic/
      manifest.ts            # NEW — handTrackingMosaicManifest + DEFAULT_PARAM_STATE + create()
      index.ts               # NEW — re-export + registerEffect side effect
      manifest.test.ts       # NEW — manifest shape + default param values + create().render() spy assertions
  App.tsx                    # MODIFY — render <Panel manifest={handTrackingMosaicManifest} />
  main.tsx                   # MODIFY — import './effects/handTrackingMosaic'
  engine/
    devHooks.ts              # MODIFY — expose __engine.{listEffects, getParam, getLandmarkBlobCount, lastGridLayout}
```

### Known Gotchas

```typescript
// CRITICAL: Side-effect imports. `import './effects/handTrackingMosaic'` ONLY triggers the
// registerEffect call because index.ts executes top-level code. Do NOT lazy-import or the
// manifest is never registered.

// CRITICAL: The manifest's onClick for "Randomize Grid" must close over paramStore.set()
// to write. The `allParams` argument is a READ-ONLY snapshot of the store — the ParamDef
// type allows the onClick to receive it, but the onClick MUST NOT mutate it. To write,
// always use `paramStore.set(key, value)` on the imported singleton. Pattern:
//   onClick: () => {
//     const seed = (Math.random() * 2 ** 32) >>> 0
//     paramStore.set('grid.seed', seed)
//   }
// (The allParams parameter is intentionally omitted from the closure — not needed here.)

// CRITICAL: paramStore is initialized empty in Task 2.2. This task MUST call
// paramStore.replace(DEFAULT_PARAM_STATE) at module top of manifest.ts OR in index.ts
// BEFORE App.tsx renders. Otherwise Tweakpane binds to empty objects and crashes.
// Order: index.ts calls paramStore.replace(DEFAULT_PARAM_STATE) → registerEffect(manifest)
// → main.tsx mounts React tree → <Panel /> reads paramStore.bindingTarget (populated).

// CRITICAL: FrameContext shape from Task 1.5/D37 is
//   { videoTexture, videoSize, landmarks, params, timeMs }
// This task needs access to the 2D canvas ctx. Two acceptable patterns:
//   (a) Extend FrameContext with `ctx2d?: CanvasRenderingContext2D` (MODIFY src/engine/types.ts)
//   (b) Store the 2D ctx ref in a module-scoped singleton populated by Stage.tsx mount
// Prefer (a) — explicit, typed, survives multiple canvases in future effects.

// CRITICAL: The render() function is called every video frame (up to 60 fps). Allocations
// matter:
//   - buildGridLayout() allocates arrays. Acceptable at 30-60 Hz (generating ~40 numbers).
//     Could be memoized on (seed, columnCount, rowCount, widthVariance) tuple for perf —
//     add a module-level cache: WeakRef-or-null; regenerate when the tuple changes.
//   - drawGrid/drawLandmarkBlobs do not allocate.
// For MVP: skip memoization; the generator is already <1ms for typical counts.

// CRITICAL: noUncheckedIndexedAccess — when iterating ParamDef[] in tests, guard
// array access. In the manifest literal itself, the discriminated union handles type
// narrowing automatically.

// CRITICAL: React StrictMode runs useEffect twice. Panel mount + dispose + mount. The
// registerEffect call in index.ts happens at MODULE LOAD (exactly once per process) —
// NOT in a useEffect. Therefore StrictMode cannot cause duplicate registration.

// CRITICAL: In tests, registerEffect throws on duplicate. manifest.test.ts MUST:
//   import { clearRegistry } from '../../engine/registry'
//   beforeEach(() => clearRegistry())
// THEN dynamically import the module to trigger registration:
//   await import('./index')   // or reset via vi.resetModules() + import

// CRITICAL: biome/typecheck — the manifest literal must match EffectManifest<HandTrackingMosaicParams>
// exactly. One missing field (e.g., `version`) is a type error. Use a satisfies clause to
// catch shape errors early:
//   export const handTrackingMosaicManifest = {
//     id: 'handTrackingMosaic',
//     displayName: 'Hand Tracking Mosaic',
//     version: '1.0.0',
//     description: 'Fingertip-bounded mosaic with seeded grid overlay',
//     params: [...],
//     defaultParams: DEFAULT_PARAM_STATE,
//     modulationSources: [...],
//     create(gl) { ... },
//   } satisfies EffectManifest<HandTrackingMosaicParams>

// CRITICAL: pnpm only. Never npm / bun / npx.

// CRITICAL: Do not add 'use client' in App.tsx or main.tsx — Vite SPA.
```

---

## Implementation Blueprint

### Data Models

```typescript
// src/effects/handTrackingMosaic/manifest.ts

import type { EffectInstance, EffectManifest, FrameContext, ModulationSourceDef, ParamDef } from '../../engine/manifest';
import { paramStore } from '../../engine/paramStore';
import { drawLandmarkBlobs } from './blobRenderer';
import { buildGridLayout } from './grid';
import { drawGrid } from './gridRenderer';

export type HandTrackingMosaicParams = {
  grid: {
    seed: number;
    columnCount: number;
    rowCount: number;
    widthVariance: number;
    lineColor: string;
    lineWeight: number;
  };
  mosaic: {
    tileSize: number;
    blendOpacity: number;
    edgeFeather: number;
  };
  effect: {
    regionPadding: number;
  };
  input: {
    mirrorMode: boolean;
    showLandmarks: boolean;
    deviceId: string;
  };
};

export const DEFAULT_PARAM_STATE: HandTrackingMosaicParams = {
  grid: { seed: 42, columnCount: 12, rowCount: 8, widthVariance: 0.6, lineColor: '#00ff88', lineWeight: 1 },
  mosaic: { tileSize: 16, blendOpacity: 1.0, edgeFeather: 0 },
  effect: { regionPadding: 1 },
  input: { mirrorMode: true, showLandmarks: true, deviceId: '' },
};

export const DEFAULT_MODULATION_SOURCES: ModulationSourceDef[] = [
  // 21 landmark.{x,y}
  ...Array.from({ length: 21 }, (_, i) => [
    { id: `landmark[${i}].x`, label: `Landmark ${i}.x` },
    { id: `landmark[${i}].y`, label: `Landmark ${i}.y` },
  ]).flat(),
  { id: 'pinch', label: 'Pinch strength' },
  { id: 'centroid.x', label: 'Hand centroid X' },
  { id: 'centroid.y', label: 'Hand centroid Y' },
];
```

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: MODIFY src/engine/types.ts (if exists) OR src/engine/manifest.ts (FrameContext)
  - FIND: export type FrameContext = { ... }
  - ADD: `ctx2d?: CanvasRenderingContext2D | null;` as a new optional field
  - PRESERVE: All existing fields (videoTexture, videoSize, landmarks, params, timeMs)
  - RATIONALE: Effects need access to the 2D overlay ctx. Optional for backward compat.
  - VALIDATE: pnpm lint <modified file> && pnpm typecheck

Task 2: CREATE src/effects/handTrackingMosaic/manifest.ts
  - IMPLEMENT:
      - HandTrackingMosaicParams type (as in Data Models above)
      - DEFAULT_PARAM_STATE const
      - DEFAULT_MODULATION_SOURCES const
      - PARAMS: ParamDef[] — one entry per leaf key:
          grid.seed       → integer, min 0, max 2**31 - 1, step 1, page 'Grid'
          grid.columnCount → integer, min 4, max 32, step 1, page 'Grid'
          grid.rowCount    → integer, min 2, max 24, step 1, page 'Grid'
          grid.widthVariance → number, min 0, max 1, step 0.01, page 'Grid'
          grid.lineColor   → color, page 'Grid'
          grid.lineWeight  → number, min 0.5, max 4, step 0.5, page 'Grid'
          grid.randomize   → button, page 'Grid'; onClick rerolls seed
          mosaic.tileSize       → integer, min 4, max 64, step 1, page 'Effect'
          mosaic.blendOpacity   → number, min 0, max 1, step 0.01, page 'Effect'
          mosaic.edgeFeather    → number, min 0, max 8, step 0.5, page 'Effect'
          effect.regionPadding  → integer, min 0, max 4, step 1, page 'Effect'
          input.mirrorMode      → boolean, page 'Input'
          input.showLandmarks   → boolean, page 'Input'
          input.deviceId        → string, page 'Input'  (dropdown populated by Task 1.2 device list; string for MVP)
      - Module-level state for dev hook:
          let lastBlobCount = 0
          let lastGridLayout: GridLayout | null = null
          export function __getLastBlobCount(): number { return lastBlobCount }
          export function __getLastGridLayout(): GridLayout | null { return lastGridLayout }
      - create(gl): EffectInstance
          return {
            render(frameCtx) {
              // Clear WebGL canvas (noop mosaic placeholder)
              gl.clearColor(0, 0, 0, 0)
              gl.clear(gl.COLOR_BUFFER_BIT)
              // 2D overlay
              const ctx2d = frameCtx.ctx2d ?? null
              if (!ctx2d) return
              const snap = paramStore.snapshot as unknown as HandTrackingMosaicParams
              const { w, h } = frameCtx.videoSize
              ctx2d.clearRect(0, 0, w, h)
              const layout = buildGridLayout(snap.grid)
              lastGridLayout = layout
              drawGrid(ctx2d, layout, { width: w, height: h }, {
                lineColor: snap.grid.lineColor,
                lineWeight: snap.grid.lineWeight,
              })
              lastBlobCount = drawLandmarkBlobs(ctx2d, frameCtx.landmarks, { width: w, height: h }, undefined, {
                mirror: snap.input.mirrorMode,
                showLandmarks: snap.input.showLandmarks,
              })
            },
            dispose() { /* noop in MVP — Phase 3 tears down shader program */ },
          }
      - Final export:
          export const handTrackingMosaicManifest = {
            id: 'handTrackingMosaic',
            displayName: 'Hand Tracking Mosaic',
            version: '1.0.0',
            description: 'Seeded grid overlay + fingertip blobs; mosaic shader lands in Phase 3',
            params: PARAMS,
            defaultParams: DEFAULT_PARAM_STATE,
            modulationSources: DEFAULT_MODULATION_SOURCES,
            create,
          } satisfies EffectManifest<HandTrackingMosaicParams>
  - MIRROR: src/engine/registry.ts (named exports, module-scoped state, `satisfies` clause)
  - GOTCHA: Use `satisfies EffectManifest<HandTrackingMosaicParams>` — preserves inference while type-checking shape
  - GOTCHA: The `grid.randomize` button onClick must close over the imported `paramStore` directly —
    do NOT use `onClick: (snapshot) => { snapshot.grid.seed = ... }` (mutation of readonly snapshot).
  - VALIDATE: pnpm lint src/effects/handTrackingMosaic/manifest.ts && pnpm typecheck

Task 3: CREATE src/effects/handTrackingMosaic/index.ts
  - IMPLEMENT:
      import { paramStore } from '../../engine/paramStore'
      import { registerEffect } from '../../engine/registry'
      import { DEFAULT_PARAM_STATE, handTrackingMosaicManifest } from './manifest'

      // Seed paramStore defaults from the manifest. ORDER MATTERS: replace before register
      // so consumers reading paramStore in the next microtask see the right shape.
      paramStore.replace(DEFAULT_PARAM_STATE as unknown as Parameters<typeof paramStore.replace>[0])
      registerEffect(handTrackingMosaicManifest)

      export { handTrackingMosaicManifest, DEFAULT_PARAM_STATE }
      export type { HandTrackingMosaicParams } from './manifest'
  - MIRROR: src/engine/registry.ts (pure re-exports after side-effect code)
  - GOTCHA: This file's TOP-LEVEL CODE is executed once when imported. That is exactly the
    point — the side effect is registration. Do NOT add 'type' to any of these imports.
  - VALIDATE: pnpm lint src/effects/handTrackingMosaic/index.ts && pnpm typecheck

Task 4: CREATE src/effects/handTrackingMosaic/manifest.test.ts
  - IMPLEMENT: Vitest suite (jsdom):
      import { beforeEach, describe, expect, it, vi } from 'vitest'
      import { clearRegistry, listEffects } from '../../engine/registry'

      describe('Task 2.5: handTrackingMosaic manifest', () => {
        beforeEach(() => {
          clearRegistry()
          vi.resetModules()
        })

        it('registers exactly one effect with id handTrackingMosaic', async () => {
          await import('./index')
          const all = listEffects()
          expect(all).toHaveLength(1)
          expect(all[0]?.id).toBe('handTrackingMosaic')
        })

        it('defaultParams matches DISCOVERY values (D4/D9/D10)', async () => {
          const mod = await import('./manifest')
          expect(mod.DEFAULT_PARAM_STATE.grid.seed).toBe(42)
          expect(mod.DEFAULT_PARAM_STATE.grid.columnCount).toBe(12)
          expect(mod.DEFAULT_PARAM_STATE.grid.rowCount).toBe(8)
          expect(mod.DEFAULT_PARAM_STATE.grid.widthVariance).toBeCloseTo(0.6)
          expect(mod.DEFAULT_PARAM_STATE.mosaic.tileSize).toBe(16)
          expect(mod.DEFAULT_PARAM_STATE.mosaic.blendOpacity).toBeCloseTo(1.0)
          expect(mod.DEFAULT_PARAM_STATE.mosaic.edgeFeather).toBe(0)
          expect(mod.DEFAULT_PARAM_STATE.effect.regionPadding).toBe(1)
          expect(mod.DEFAULT_PARAM_STATE.input.mirrorMode).toBe(true)
          expect(mod.DEFAULT_PARAM_STATE.input.showLandmarks).toBe(true)
        })

        it('params include all required keys', async () => {
          const { handTrackingMosaicManifest } = await import('./manifest')
          const keys = handTrackingMosaicManifest.params.map(p => p.key)
          for (const k of ['grid.seed','grid.columnCount','grid.rowCount','grid.widthVariance','grid.lineColor','grid.lineWeight','grid.randomize','mosaic.tileSize','mosaic.blendOpacity','mosaic.edgeFeather','effect.regionPadding','input.mirrorMode','input.showLandmarks','input.deviceId']) {
            expect(keys).toContain(k)
          }
        })

        it('modulationSources include 21 landmarks + pinch + centroid', async () => {
          const { handTrackingMosaicManifest } = await import('./manifest')
          const ids = handTrackingMosaicManifest.modulationSources.map(s => s.id)
          expect(ids).toContain('landmark[0].x')
          expect(ids).toContain('landmark[20].y')
          expect(ids).toContain('pinch')
          expect(ids).toContain('centroid.x')
          expect(ids).toContain('centroid.y')
          expect(ids.length).toBe(21 * 2 + 3)
        })

        it('grid.randomize onClick rerolls grid.seed', async () => {
          const { handTrackingMosaicManifest } = await import('./manifest')
          const { paramStore } = await import('../../engine/paramStore')
          const before = (paramStore.snapshot as any).grid?.seed
          const rand = handTrackingMosaicManifest.params.find(p => p.key === 'grid.randomize')
          expect(rand?.type).toBe('button')
          if (rand?.type === 'button') rand.onClick(paramStore.snapshot as any)
          const after = (paramStore.snapshot as any).grid?.seed
          expect(after).not.toBe(before)
        })

        it('create(gl).render invokes drawGrid and drawLandmarkBlobs', async () => {
          const { handTrackingMosaicManifest } = await import('./manifest')
          // Fake WebGL2 context
          const fakeGl = {
            clearColor: vi.fn(),
            clear: vi.fn(),
            COLOR_BUFFER_BIT: 0x4000,
          } as unknown as WebGL2RenderingContext
          // Fake 2D ctx
          const canvas = document.createElement('canvas')
          canvas.width = 640; canvas.height = 480
          const ctx2d = canvas.getContext('2d') as CanvasRenderingContext2D
          const strokeSpy = vi.spyOn(ctx2d, 'stroke')
          const instance = handTrackingMosaicManifest.create(fakeGl)
          instance.render({
            videoTexture: null,
            videoSize: { w: 640, h: 480 },
            landmarks: Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 })),
            params: {},
            timeMs: 0,
            ctx2d,
          })
          expect(fakeGl.clearColor).toHaveBeenCalled()
          expect(strokeSpy).toHaveBeenCalled()  // grid + blobs both stroke
          instance.dispose()
        })
      })
  - MIRROR: src/engine/registry.test.ts
  - GOTCHA: vi.resetModules() between tests is required — the manifest module's top-level
    registerEffect side effect would otherwise persist across tests.
  - VALIDATE: pnpm vitest run src/effects/handTrackingMosaic/manifest.test.ts

Task 5: MODIFY src/main.tsx
  - FIND: the top import block (existing: React, App)
  - ADD: `import './effects/handTrackingMosaic'` as the LAST import (after type/runtime imports,
    before ReactDOM createRoot call). The placement is intentional — side-effect imports go last.
  - PRESERVE: existing React StrictMode + createRoot(...).render(<App />)
  - VALIDATE: pnpm lint src/main.tsx && pnpm typecheck

Task 6: MODIFY src/App.tsx
  - FIND: the existing `<main className="app-shell">` block
  - ADD: `import { Panel } from './ui/Panel'` AND `import { handTrackingMosaicManifest } from './effects/handTrackingMosaic'`
  - ADD: `<Panel manifest={handTrackingMosaicManifest} />` inside the shell as a sibling of the Stage
    (or just after the heading for MVP layout)
  - PRESERVE: existing heading/copy
  - VALIDATE: pnpm lint src/App.tsx && pnpm typecheck

Task 7: MODIFY src/engine/devHooks.ts
  - FIND: the existing window.__handTracker object assignment (from Task 1.5)
  - ADD: an `__engine` sub-object exposing:
      listEffects (from registry.ts)
      getParam(dotPath): read from paramStore.snapshot using resolvePath
      setParam(dotPath, value): delegate to paramStore.set — REQUIRED by Task 2.R regression
      getLandmarkBlobCount: __getLastBlobCount from manifest.ts
      lastGridLayout: __getLastGridLayout from manifest.ts
      getFPS: existing from Task 1.5
  - GUARD: import.meta.env.DEV || import.meta.env.MODE === 'test' — do not expose in production
  - PRESERVE: All Task 1.5 dev hooks
  - VALIDATE: pnpm lint src/engine/devHooks.ts && pnpm typecheck
```

### Integration Points

```yaml
EFFECT_REGISTRY:
  - registerEffect(handTrackingMosaicManifest) fires at module load of index.ts
  - main.tsx's side-effect import triggers this before ReactDOM renders

PARAM_STORE:
  - paramStore.replace(DEFAULT_PARAM_STATE) in index.ts seeds the store
  - Panel binds to paramStore.bindingTarget via buildPaneFromManifest
  - Canvas render loop (Task 1.5 + future 3.x) reads paramStore.snapshot via ctx.params

RENDER_LOOP:
  - Task 1.5 renderLoop invokes effect.render(frameCtx) — this task fulfills effect.render
  - frameCtx.ctx2d must be provided by renderLoop (requires renderLoop modification if not yet done)
  - In Task 2.R regression, verify the full loop: rVFC → landmarks → render → ctx2d draws

DEV_HOOKS:
  - window.__handTracker.__engine.listEffects() → []  (before index.ts loads)
  - window.__handTracker.__engine.listEffects() → [handTrackingMosaicManifest]  (after)
  - window.__handTracker.__engine.getLandmarkBlobCount() → 0 or 5 depending on detection
  - window.__handTracker.__engine.lastGridLayout → GridLayout | null
  - window.__handTracker.__engine.getParam('grid.columnCount') → 12 (default)
```

---

## Validation Loop

### Level 1 — Syntax and Style

```bash
pnpm lint src/effects/handTrackingMosaic src/app src/main.tsx src/App.tsx src/engine/devHooks.ts
pnpm typecheck
```

Expected: zero errors.

### Level 2 — Unit Tests

```bash
pnpm vitest run src/effects/handTrackingMosaic/manifest.test.ts
```

Expected: all 6+ tests pass.

### Level 3 — Integration (production build)

```bash
pnpm build
```

Expected: exits 0. The side-effect import must survive Vite's tree-shaking — verify by checking `dist/assets/*.js` includes `handTrackingMosaic`.

### Level 4 — E2E

```bash
pnpm test:e2e --grep "Task 2.5:"
```

Expected: `tests/e2e/manifest-registration.spec.ts` with `test.describe('Task 2.5: handTrackingMosaic manifest', ...)`:

1. Navigate to `/`
2. Grant fake camera via `context.grantPermissions(['camera'])`
3. Wait for `__handTracker.__engine.listEffects()` to return length 1:
   ```js
   await page.waitForFunction(() =>
     (window as any).__handTracker?.__engine?.listEffects?.().length === 1
   )
   ```
4. Assert `effects[0].id === 'handTrackingMosaic'`
5. Assert Panel DOM is visible: `await expect(page.getByTestId('params-panel')).toBeVisible()`
6. Click the Tweakpane slider for `grid.columnCount`, set to 20 (via `page.locator(...)` + keyboard), assert `getParam('grid.columnCount') === 20`
7. Assert `__engine.lastGridLayout?.columns?.length === 20` after the change

If Panel DOM assertion fails because test-ids aren't set up fully, soften to
`await expect(page.locator('.tp-rotv')).toBeVisible()` (Tweakpane's root class).

---

## Final Validation Checklist

### Technical

- [ ] L1, L2, L3, L4 all exit 0
- [ ] `pnpm vitest run` — all tests pass
- [ ] `pnpm lint .` — zero errors
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm build` — production build succeeds

### Feature

- [ ] `handTrackingMosaicManifest` exported and typed with `satisfies EffectManifest<HandTrackingMosaicParams>`
- [ ] All 14 params present (13 leaf + 1 button) across Grid / Effect / Input pages
- [ ] `DEFAULT_PARAM_STATE` exactly matches DISCOVERY D4/D9/D10 values
- [ ] `create(gl).render(frameCtx)` invokes drawGrid + drawLandmarkBlobs + gl.clear
- [ ] `grid.randomize` onClick reroll works
- [ ] `listEffects()` returns `[handTrackingMosaicManifest]` after import
- [ ] Dev hooks exposed: `listEffects`, `getParam`, `getLandmarkBlobCount`, `lastGridLayout`
- [ ] `<Panel />` rendered in `<App />` with the manifest prop

### Code Quality

- [ ] No `any` types (narrow via discriminated union; cast only at the generic type boundary with a documented comment)
- [ ] `satisfies` clause preserves param shape inference
- [ ] Side-effect import isolated to `index.ts` top-level
- [ ] `paramStore.replace(DEFAULT_PARAM_STATE)` called exactly once
- [ ] No `pane.refresh()` calls

---

## Anti-Patterns

- Do NOT call `registerEffect` from a React effect — must be module-load side effect
- Do NOT mutate `paramStore.snapshot` inside `onClick` — always `paramStore.set(...)`
- Do NOT declare the manifest with a loose `EffectManifest` type annotation — use `satisfies` for shape-checking + narrow inference
- Do NOT store state inside the module that's not exposed via the dev hook — it's invisible to E2E
- Do NOT skip `vi.resetModules()` in tests — the registerEffect side effect persists
- Do NOT deep-import internal registry state (the `Map`) — use `listEffects()` / `clearRegistry()`
- Do NOT add `'use client'` directives — Vite SPA
- Do NOT use `npm` / `npx` / `bun`
- Do NOT emit `<promise>COMPLETE</promise>` if any validation level is failing

---

## No Prior Knowledge Test

- [x] Every file path in `All Needed Context` exists (Tasks 2.1/2.2/2.3/2.4 outputs + Phase 1 scaffold)
- [x] Every URL in `urls:` is reachable
- [x] Every D-number cited (D4, D6, D8, D9, D10, D13, D15, D36, D37, D38) exists in DISCOVERY.md
- [x] Implementation Tasks topologically sorted (types → manifest → index → tests → main.tsx → App.tsx → devHooks)
- [x] Validation Loop commands copy-paste runnable
- [x] MIRROR files exist (registry.ts, registry.test.ts, App.tsx, main.tsx)
- [x] Task is atomic — depends on all prior Phase 2 tasks + Phase 1 complete

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/tweakpane-params-presets/SKILL.md
.claude/skills/ogl-webgl-mosaic/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
