---
name: hand-tracker-fx-architecture
description: Use when orienting to the Hand Tracker FX project, choosing which sub-domain skill to read next, or making cross-cutting architecture decisions. Top-level project structure, data flow, and skill index.
---

# Hand Tracker FX — Architecture & Skill Index

## Purpose

Browser-based, TouchDesigner-inspired video effects app whose MVP ships exactly one effect — a "Hand Tracking Mosaic" — recreating a reference screenshot using a live webcam feed.

**Reference screenshot** (view during any visual task):
`.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png`

## Top Authority Rule

`/.claude/orchestration-hand-tracker-fx/DISCOVERY.md` **is the top authority** for every implementation decision. It overrides this skill, every sibling skill, PRD.md, research files, and CLAUDE.md. If a skill contradicts DISCOVERY, DISCOVERY wins. If DISCOVERY is genuinely ambiguous, escalate to the human — do not guess.

## Folder Structure (D38)

```
src/
  effects/
    handTrackingMosaic/
      manifest.ts           # EffectManifest: id, params, defaults, create()
      shader.glsl.ts        # GLSL source (fragment shader with active-cell uniforms)
      render.ts             # EffectInstance.render(ctx) body
      grid.ts               # seeded column-width generator (D4)
      region.ts             # hand-polygon from landmarks + cell-overlap test (D5)
  engine/
    renderer.ts             # ogl setup + rVFC render loop
    registry.ts             # global effectRegistry + registerEffect()
    modulation.ts           # ModulationRoute evaluator (source → eased → target)
    paramStore.ts           # plain-object store with shallow subscribe()
  tracking/
    handLandmarker.ts       # MediaPipe HandLandmarker wrapper (main thread)
  camera/
    useCamera.ts            # getUserMedia + 8-state permission machine
    deviceSelect.ts         # enumerateDevices + localStorage deviceId
  ui/
    App.tsx
    Panel.tsx               # Tweakpane container (Essentials plugin)
    ErrorStates.tsx         # 8 full-screen state cards
    PresetBar.tsx           # < / > chevrons + current preset name
    RecordButton.tsx
  app/
    main.tsx
    routes.tsx              # single-route MVP
public/
  models/hand_landmarker.task   # 7.82 MB, self-hosted (D33)
  wasm/                         # MediaPipe WASM runtime, self-hosted
```

## Data Flow

```
  webcam <video>  ──►  HandLandmarker (main thread, GPU delegate)
        │                       │
        │                       ▼
        │                 landmarks[] ──►  modulation.ts  ◄── paramStore
        │                                       │                 ▲
        │                                       ▼                 │
        │                               resolved params ──────────┘
        │                                       │
        ▼                                       ▼
   videoTexture ──────────────────────►  render loop (rVFC on <video>)
                                                │
                                                ├─► ogl WebGL quad: video + mosaic shader
                                                │      (active cells passed as vec4[] uniform)
                                                │
                                                └─► Canvas2D overlay: grid lines +
                                                      dotted fingertip blobs + xy labels
                                                │
                                                ▼
                                        composed top canvas
                                                │
                                                ▼
                                  (optional) MediaRecorder → .webm download
```

- `<video>` holds unmirrored pixels and is the single source of truth fed to both MediaPipe and WebGL (D27).
- Mirror mode is a CSS `scaleX(-1)` on display layers only (D10, D27); landmark x-coords need no correction.
- Landmark-to-modulation binding defaults: `landmark[8].x → mosaic.tileSize [4,64]`, `landmark[8].y → grid.columnCount [4,20]` (D13).

## Effect Manifest + Registry (D36)

```ts
type EffectManifest<TParams> = {
  id: string
  displayName: string
  params: ParamDef[]
  defaultParams: TParams
  modulationSources: ModulationSourceDef[]
  create(gl: WebGL2RenderingContext): EffectInstance
}

type EffectInstance = {
  render(ctx: FrameContext): void
  dispose(): void
}
```

- A global `effectRegistry` holds manifests.
- `registerEffect(manifest)` is the only entry point; all new effects are drop-in.

## FrameContext (D37)

Passed to `EffectInstance.render()` every frame:

```ts
type FrameContext = {
  videoTexture: WebGLTexture
  videoSize: { w: number; h: number }
  landmarks: Landmark[] | null    // null when no hand detected
  params: Record<string, unknown> // AFTER modulation resolution
  timeMs: number
}
```

## Threading Model (D17)

- **Main thread only** for MVP. MediaPipe's HandLandmarker runs with the GPU delegate on the main thread.
- Worker-based architecture is deferred: MediaPipe has a known `importScripts` worker-compat issue, confirmed in research.
- 30 fps target is achievable on the main thread per research; reassess only if profiling proves otherwise.

## Render Heartbeat

- `requestVideoFrameCallback` on the `<video>` element is the loop driver — video-synced, not display-synced.
- Never use `requestAnimationFrame` for the primary loop (it de-syncs from the camera).
- StrictMode cleanups (`useEffect`) MUST cancel the rVFC registration + `track.stop()` on unmount (D25).

## Stage.tsx Evolution Across Phases

`src/ui/Stage.tsx` is touched by four tasks. Each task ADDS — never replaces in bulk. Final shape after Phase 3:

| Task | What it adds |
|---|---|
| 1.6 | Base component: hidden `<video>` + 2 stacked canvases (WebGL bottom, 2D top) + `StageHandle` imperative ref + `data-testid="stage"` + `data-testid="render-canvas"` alias + DPR-aware resize effect + `onVideoReady?: (el: HTMLVideoElement) => void` prop that App.tsx uses to own the render-loop lifetime (renderer ownership lives in App.tsx, NOT Stage). |
| 3.1 | Inside Stage's useEffect: call `createOglRenderer(webglRef.current)` + `createVideoTexture(gl)`; populate module-scoped refs in `src/engine/renderer.ts` via `_setRenderer()` / `_setVideoTexture()` so `manifest.create(gl)` can reach them via `getRenderer()` / `getVideoTexture()`. Cleanup clears those refs. |
| 3.4 | No new Stage.tsx modification — the effect's `render()` now draws the mosaic and pre-composites the WebGL canvas onto the 2D overlay via `ctx.drawImage(webglCanvas, 0, 0)` (precondition for Phase 4 `captureStream`). |
| 3.5 | Adds `attachContextLossHandlers` wire-up inside Stage's useEffect: onLost cancels rVFC + disposes effect; onRestored re-bootstraps the renderer + texture + effect + restarts the rVFC. Cleanup calls `disposeRenderer(...)`. |

Key invariant: **Stage.tsx does NOT own the render loop.** App.tsx owns it via the `onVideoReady` callback. Stage only exposes the DOM refs and lifecycle events.

## Dev Hook Contract — `window.__handTracker`

Gated by `import.meta.env.DEV || import.meta.env.MODE === 'test'`. Enumerated below with the task that introduces each field:

| Member | Signature | Introduced in |
|---|---|---|
| `isReady` | `() => boolean` | Task 1.4 |
| `isUsingGpu` | `() => boolean` | Task 1.4 |
| `getFPS` | `() => number` | Task 1.5 |
| `getLandmarkCount` | `() => number` | Task 1.5 |
| `__engine.listEffects` | `() => EffectManifest[]` | Task 2.1 / 2.5 |
| `__engine.getParam` | `(dotPath: string) => unknown` | Task 2.5 |
| `__engine.setParam` | `(dotPath: string, value: unknown) => void` | Task 2.5 (required by 2.R) |
| `__engine.getLandmarkBlobCount` | `() => number` | Task 2.4 / 2.5 |
| `__engine.lastGridLayout` | `() => GridLayout \| null` | Task 2.5 |
| `getVideoTextureHandle` | `() => WebGLTexture \| null` | Task 3.1 |
| `setFakeLandmarks` | `(lms: NormalizedLandmark[]) => void` | Task 3.3 |
| `computeActiveRegions` | `() => Rect[]` | Task 3.3 |
| `getLastRegionCount` | `() => number` | Task 3.4 |
| `forceContextLoss` | `() => void` | Task 3.5 |
| `forceContextRestore` | `() => void` | Task 3.5 |

Every new field MUST be added to this table in the same PR that introduces it, so downstream tasks have a single source of truth.

## Mirror Mode (D10, D27)

- ON by default (dark-theme-only app, matches reference).
- Source of truth: the raw `<video>` is unmirrored. Inference gets unmirrored pixels.
- Display-side canvases receive `scaleX(-1)` via CSS. If drawing blobs to a canvas that is NOT CSS-flipped, flip x manually at draw time.

## Sibling Skills (read the one relevant to your task)

| Skill | Read when… |
|---|---|
| `mediapipe-hand-landmarker` | Wiring HandLandmarker, tuning options, wasm+model loading, landmark schema |
| `ogl-webgl-mosaic` | Writing the GLSL mosaic shader, ogl program setup, video texture upload, active-cell uniforms |
| `tweakpane-params-presets` | Param panel, Essentials Bezier blade, preset save/load/export/import, modulation page |
| `webcam-permissions-state-machine` | `useCamera`, the 8 permission states, devicechange / permissionStatus.onchange, device dropdown |
| `vite-vercel-coop-coep` | Dev/preview headers, `vercel.json` CSP + COOP/COEP, deploy config, service worker for /models /wasm |
| `playwright-e2e-webcam-testing` | Fake-device streams, the single smoke test, `crossOriginIsolated` assertion, Y4M fixture |
| `prp-task-ralph-loop` | Authoring task files, the 4-level Validation Loop, Ralph iteration protocol |
| `vitest-unit-testing-patterns` | Pure-utility tests (grid, modulation eval, preset serde, polygon-overlap), jsdom setup |

## Scripts Cheat Sheet

| Command | Purpose |
|---|---|
| `pnpm dev` | Vite dev server with COOP+COEP headers |
| `pnpm build` | Production build to `dist/` |
| `pnpm preview` | Serve `dist/` with production headers (local prod-sim) |
| `pnpm typecheck` | `tsc --noEmit`, strict TS |
| `pnpm lint` | Biome v2 (formatter + linter + organizeImports) |
| `pnpm test` | Vitest unit tests (jsdom) |
| `pnpm test:e2e` | Playwright smoke test (fake media stream) |
| `pnpm fetch:assets` | Download MediaPipe model + WASM to `public/` |
| `pnpm test:setup` | Generate `tests/assets/fake-hand.y4m` via ffmpeg |
| `pnpm check` | Composite: typecheck + lint + test |

## Commit Convention (D40)

- Branch: `task/N-M-<short-description>` off `main`.
- Commit subject: `Task N.M: <description>`.
- Every commit includes trailer: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`.
- Fast-forward / PR to `main` once the phase's 4-level validation exits 0.

## Scope Guardrails (do NOT implement)

No backend, no auth, no cloud processing, no mobile layout, no light theme, no audio, no multi-hand, no face tracking, no 3D, no pre-recorded input, no analytics/telemetry, no privacy badge, no pause button, no mobile notice, no MIDI/keyboard mapping in MVP, no FPS overlay.

## When NOT to Use This Skill

- You've already been oriented and know which sub-domain you're working in — go directly to that sibling skill.
- You need specific implementation details (shader math, state-machine transitions, preset JSON codec) — those live in siblings, not here.
- You're doing a trivial doc/typo fix — just do it.

## When TO Use This Skill

- First time touching the repo in a session.
- Cross-cutting changes that span two or more sibling skill areas (e.g. a new effect that needs engine + tracking + UI glue).
- Deciding which skill to read next for a given task.
- Sanity-checking that a proposed change respects the data flow and mirror source-of-truth.
