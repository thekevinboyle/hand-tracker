# Hand Tracker FX - Discovery Document

**Created**: 2026-04-14
**Status**: Complete
**Rounds of Q&A**: 5

> **Authority rule**: This document is the top authority for all implementation decisions. It overrides PRD.md, research files, skills, and CLAUDE.md. If any downstream artifact contradicts this document, this document wins. If a genuine ambiguity exists here, escalate to the human rather than guess.

---

## 1. Product Vision & Scope

**D1: What is this app?**
A: A browser-based, TouchDesigner-inspired video effects app. MVP ships exactly ONE effect — a "Hand Tracking Mosaic" that recreates the TouchDesigner reference screenshot. Webcam is the only input source.

**D2: Single effect, or many?**
A: Ship ONE effect in MVP (the hand-tracking mosaic). Architect the engine with an effect registry + manifest system so additional effects are drop-in additions later. The reference screenshot is the visual target.

**D3: What's OUT of scope for MVP?**
A: No backend, no auth, no accounts, no cloud processing, no file/video/image inputs, no pre-recorded sources, no mobile optimization, no light theme, no privacy badge, no pause button, no mobile "desktop recommended" notice (the last three were explicitly declined), no analytics, no telemetry, no error reporting service, no mic/audio recording, no scheduled jobs.

---

## 2. Visual Behavior (matches reference screenshot)

**D4: Grid overlay — generation rule?**
A: Procedural with seed. Parameters: `grid.seed` (int), `grid.columnCount` (int, default 12), `grid.rowCount` (int, default 8), `grid.widthVariance` (float 0–1, default 0.6). A seeded RNG derives non-uniform column widths; `widthVariance=0` yields uniform, `1` yields maximum chaos. Panel exposes a "Randomize Grid" button that rerolls `seed`.

**D5: Which cells get the mosaic effect?**
A: **Hand-bounded region.** Each frame, compute a polygon from landmarks `{0 (wrist), 4, 8, 12, 16, 20 (fingertips)}`. A grid cell is "active" (mosaiced) iff it overlaps the polygon. Add a parameter `effect.regionPadding` (int, cells) to expand the polygon outward by N cells for slop.

**D6: Which landmarks render as dotted-circle blobs with xy labels?**
A: **Fingertips only** — landmarks 4, 8, 12, 16, 20 (5 per hand). Matches the reference.

**D7: Coordinate label format?**
A: Normalized, 3 decimal places: `x: 0.373  y: 0.287`. Rendered next to each blob.

**D8: How many hands?**
A: **1 hand.** `maxNumHands: 1`. Matches reference and minimizes inference cost.

**D9: Mosaic effect defaults + range?**
A: `mosaic.tileSize` default 16 px, range 4–64. `mosaic.blendOpacity` default 1.0 (full replace), range 0–1. `mosaic.edgeFeather` default 0, range 0–8 px. All exposed in the panel.

**D10: Mirror mode?**
A: **ON by default.** CSS `scaleX(-1)` on the display layer. Inference receives unmirrored pixels so landmark x-coords need no correction.

**D11: Left/right chevron arrows in reference — role?**
A: **Functional preset cycler.** Clicking `<` / `>` or pressing ArrowLeft/ArrowRight cycles through saved presets of the current effect. Since MVP has one effect, they cycle presets within that effect.

**D12: Theme?**
A: Dark theme only.

---

## 3. X/Y Axis Modulation

**D13: Modulation source and default bindings?**
A: **Index fingertip (landmark 8)** is the default modulation source.
- `landmark[8].x` in `[0, 1]` → `mosaic.tileSize` in `[4, 64]` (linear)
- `landmark[8].y` in `[0, 1]` → `grid.columnCount` in `[4, 20]` (linear, rounded to int)

**D14: User-configurability of modulation?**
A: The panel exposes a "Modulation" page where users can edit the two default routes: change source (any landmark index, or `pinch`, or `centroid`), input range, output parameter, output range, and easing curve. Full `ModulationRoute` schema supported per the parameter-UI research. Saving routes is part of a preset.

**D15: Sources beyond the default?**
A: Available sources: `landmark[0..20].x|y`, `pinch` (distance between landmarks 4 & 8), `centroid.x|y` (mean of all tracked landmarks). No MIDI/keyboard in MVP (architecture supports later).

---

## 4. Tech Stack

**D16: Frontend framework + build tooling?**
A: React 19 + Vite 8 + TypeScript 5.7 (strict). Package manager: pnpm 10. Linter/formatter: Biome v2 (single config). Unit tests: Vitest 3. E2E: Playwright.

**D17: Hand tracking library?**
A: `@mediapipe/tasks-vision` `HandLandmarker` (latest, currently v0.10.34+). Apache-2.0. Run **on main thread** for MVP (GPU delegate enabled); worker architecture deferred (MediaPipe has a known `importScripts` worker compatibility issue per the research).

**D18: Rendering stack?**
A: Hybrid. Bottom layer: `ogl` (WebGL, ~29kb) — full-screen quad with the webcam HTMLVideoElement uploaded as a texture, GLSL fragment shader applies mosaic inside a `vec4[]` uniform array of active rectangles. Top layer: plain Canvas 2D `<canvas>` absolutely positioned over the WebGL canvas, draws grid lines + dotted landmark blobs (`setLineDash`) + coordinate labels (`fillText`). Render loop: `requestVideoFrameCallback` on the `<video>` (video-synced, not display-synced).

**D19: Parameters UI?**
A: Tweakpane 4 + the Essentials plugin (for the Bezier blade used by modulation curves). Tweakpane mutates a plain JS object; the canvas render loop reads that object synchronously — no React state in the hot path.

**D20: State management?**
A: The `paramStore` is a plain object (with a shallow subscribe function for React UI bits). React is used for permissions UI, error screens, preset list, layout chrome. The canvas loop accesses `paramStore.getState()` via a ref — never React state.

**D21: Testing scope?**
A: Vitest for pure utilities (grid geometry, modulation curve eval, preset (de)serialization, polygon-cell overlap math). One Playwright E2E smoke test with Chrome `--use-fake-device-for-media-stream` that asserts: page loads, error state machine reaches GRANTED, landmarks are produced, render FPS ≥ 20. Each task file (per PRP methodology, D32 below) ships with a 4-level Validation Loop of runnable commands; Ralph loop self-heals until all levels exit 0.

---

## 5. Webcam, Permissions, and Errors

**D22: getUserMedia constraints?**
A: `{ video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, min: 15 } }, audio: false }`. Always `ideal`, never `exact`. The user-selected `deviceId` (when chosen) is added.

**D23: Permission states with distinct UI?**
A: Eight full-screen state cards (each with dedicated copy + Retry where applicable):
`PROMPT`, `GRANTED`, `USER_DENIED`, `SYSTEM_DENIED`, `DEVICE_CONFLICT` (NotReadableError), `NOT_FOUND`, `MODEL_LOAD_FAIL`, `NO_WEBGL`. A `devicechange` listener + a `permissionStatus.onchange` listener feed a state machine. Pre-prompt explanation card shown before the first `getUserMedia` call when `permissionStatus.state === 'prompt'`.

**D24: Device selection UX?**
A: Small dropdown in the params panel (Input page) populated from `enumerateDevices()` after first grant. Chosen `deviceId` persists to `localStorage`; re-validated on load against live devices. `devicechange` event refreshes the list.

**D25: Cleanup on unmount?**
A: Every mounted component that opens a track MUST call `track.stop()` in its cleanup. React StrictMode is enabled; `useEffect` cleanups must cancel `requestAnimationFrame` / `requestVideoFrameCallback` registrations.

**D26: Reduced motion?**
A: Honor `prefers-reduced-motion`. When set: pause modulation (params hold their neutral values), continue rendering video + grid + blobs but without param animation. Listen for runtime changes.

**D27: Webcam source truth?**
A: The raw `<video>` element is the unmirrored source of pixels uploaded to WebGL and fed to the MediaPipe landmarker. CSS `scaleX(-1)` is applied only to the displayed canvases. Therefore landmark coordinates are in the unmirrored frame; if mirror mode is on, blob drawing must flip x for display (or the display canvas inherits the CSS transform).

---

## 6. Record / Export

**D28: Record behavior?**
A: Record button → `canvas.captureStream(30)` on the top composited canvas → `MediaRecorder({ mimeType: 'video/webm;codecs=vp9' })`. Press to start, press to stop, then trigger a blob download `hand-tracker-fx-{ISO-timestamp}.webm`. **No audio**, **no duration cap**, blob held in memory. Show a "REC" indicator + elapsed time while recording. If `vp9` unsupported, fall back to `vp8`.

---

## 7. Presets

**D29: Preset schema?**
A:
```ts
type Preset = {
  version: 1
  name: string
  effectId: 'handTrackingMosaic'   // forward-compat for future effects
  params: Record<string, unknown>  // Tweakpane exportState() output
  modulationRoutes: ModulationRoute[]
  createdAt: string                 // ISO
}
```
Stored in `localStorage` under key `hand-tracker-fx:presets:v1` as `Preset[]`. Also exportable as a single `.json` file via a panel button, and importable.

**D30: Preset UI?**
A: Panel "Presets" page shows: current preset name, Save/Save As, Delete, list of existing presets. Chevron arrows at screen edges + ArrowLeft/ArrowRight keys cycle within the list. First launch: ships with a "Default" preset matching the reference screenshot.

---

## 8. Security, Privacy, Deployment

**D31: Deployment?**
A: Vercel, deploy on push to `main`. `vercel.json` sets:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`
- `Permissions-Policy: camera=(self)`
- `Content-Security-Policy` with `wasm-unsafe-eval`, `worker-src 'self' blob:`, `media-src 'self' blob:`, self-only for script/style, `img-src 'self' data: blob:`.

**D32: Dev server setup?**
A: Vite dev config sets COOP+COEP headers. `localhost` is a secure context → `getUserMedia` works over plain HTTP. `vite-plugin-mkcert` **not installed** for MVP (add later if LAN testing needed).

**D33: Model file hosting?**
A: **Self-host.** Commit `hand_landmarker.task` (7.82 MB, float16) to `public/models/`. Download URL: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task`. Configure a service worker for cache-first on `/models/*` and `/wasm/*`. `modelAssetPath: '/models/hand_landmarker.task'` at runtime.

**D34: Analytics / telemetry?**
A: **None.** No Plausible, no Sentry, no GA. Error reporting is limited to a "Report bug on GitHub" link (opens a prefilled issue template URL). The "nothing leaves your device" promise is kept strictly.

**D35: Privacy communication?**
A: Declined explicit badge. A short "About" modal (accessible via a small "?" icon) states: "All processing happens on your device. Your video feed never leaves your browser."

---

## 9. Architecture

**D36: Effect registry shape?**
A:
```ts
type EffectManifest<TParams> = {
  id: string                       // unique
  displayName: string
  params: ParamDef[]               // Tweakpane-compatible schema
  defaultParams: TParams
  modulationSources: ModulationSourceDef[]
  create(gl: WebGL2RenderingContext): EffectInstance
}

type EffectInstance = {
  render(ctx: FrameContext): void
  dispose(): void
}
```
A global `effectRegistry` holds all manifests; `registerEffect(manifest)` is the only entry point.

**D37: FrameContext passed to effects per frame?**
A:
```ts
type FrameContext = {
  videoTexture: WebGLTexture
  videoSize: { w: number; h: number }
  landmarks: Landmark[] | null    // null if no hand detected
  params: Record<string, unknown> // resolved params (post-modulation)
  timeMs: number
}
```

**D38: Project folder structure (TL;DR)?**
A:
```
src/
  effects/
    handTrackingMosaic/
      manifest.ts
      shader.glsl.ts
      render.ts
      grid.ts             # seeded column-width generator
      region.ts           # polygon-from-landmarks, cell-overlap test
  engine/
    renderer.ts           # ogl setup + render loop (rVFC)
    registry.ts           # effectRegistry
    modulation.ts         # ModulationRoute evaluator
    paramStore.ts         # plain-object store + subscribe
  tracking/
    handLandmarker.ts     # MediaPipe HandLandmarker wrapper
  camera/
    useCamera.ts          # getUserMedia state machine hook
    deviceSelect.ts
  ui/
    App.tsx
    Panel.tsx             # Tweakpane container
    ErrorStates.tsx       # 8 state cards
    PresetBar.tsx         # chevrons + name
    RecordButton.tsx
  app/
    main.tsx
    routes.tsx            # minimal; single route for MVP
public/
  models/hand_landmarker.task
  wasm/ (MediaPipe wasm files, self-hosted)
```

---

## 10. Workflow, Git, Testing Methodology

**D39: Repo + branches?**
A: Current directory `/Users/kevin/Documents/web/hand-tracker`, currently on branch `task/1-1-scaffold`. Trunk-based: short-lived feature branches `task/N-M-<description>`, PR/fast-forward to `main`. GitHub remote: **create when first deploy is wired up** (not before).

**D40: Commit convention?**
A: `Task N.M: <description>` matches the preexisting O&G scraper convention used on the parent workspace. Every commit includes `Co-Authored-By: Claude Opus 4.6 (1M context)` trailer per this workspace's standard.

**D41: Task file format — adopt Rasmus Widing PRP?**
A: **YES, full PRP + Ralph loop.** Every task file includes:
1. Goal / User Persona / Why
2. All Needed Context (YAML block with `files:`, `urls:`, `docs:`, each with `why:` + `gotcha:`)
3. Implementation Blueprint (ordered sub-steps with exact file paths)
4. Validation Loop with 4 levels of runnable commands:
   - L1: `pnpm biome check <paths>` + `pnpm tsc --noEmit`
   - L2: `pnpm vitest run <unit-file>`
   - L3: Integration smoke (script or Playwright component test)
   - L4: Playwright E2E smoke
5. Anti-Patterns (bulleted)
6. "No Prior Knowledge Test" self-check
Ralph loop: agents iterate implement → run all 4 levels → fix failures → retry, until all exit 0, then emit `<promise>COMPLETE</promise>` and move on.

**D42: Phase regression testing?**
A: The last task of every phase is a regression pass that runs all 4 validation levels on every task in the phase against the closest-to-live build (local production build via `pnpm build && pnpm preview`). Final phase (last phase of PHASES.md) is dedicated to full multi-angle E2E against a Vercel preview deployment.

---

## 11. Assets, Accounts, Tool Access

**D43: Required accounts?**
A:
- **Vercel account** (user already has or will create — agent can help via Playwright if needed for deploy step)
- **GitHub account** (user: `thekevinboyle`, already in workspace)
- **No MediaPipe / Google / OpenAI / other API keys** — everything is local, no auth.

**D44: Required files the agent must fetch?**
A:
- `hand_landmarker.task` (7.82 MB) — download from `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task` into `public/models/` during Phase 1 scaffold.
- MediaPipe WASM runtime files — self-hosted at `public/wasm/` so no CDN at runtime. Path configured in `FilesetResolver.forVisionTasks('/wasm')`.

**D45: Reference assets to consult during implementation?**
A:
- `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png` — the TouchDesigner screenshot. All implementation agents MUST view this file during visual tasks (grid, blobs, labels, mosaic). The mosaic effect's look is compared against it on every visual-task validation.

---

## 12. Explicit Non-Goals (to prevent scope creep)

- No mobile layout work
- No light theme
- No audio (no mic recording, no audio-reactive effects)
- No multi-hand tracking beyond 1
- No face detection or face-tracking effects
- No 3D, no three.js, no depth-based effects
- No pre-recorded video or image input
- No cloud processing / server
- No user accounts / auth
- No analytics, telemetry, or error-reporting service
- No privacy badge UI, no pause button UI, no "desktop recommended" mobile notice (all explicitly declined)
- No PWA / service-worker offline mode **beyond** caching the self-hosted model & wasm
- No MIDI / keyboard-mapped parameters in MVP (architecture supports adding)
- No FPS overlay (declined)

---

## 13. Success Criteria (Acceptance)

- Open the app on a modern desktop browser (Chrome 120+, Firefox 132+, Safari 17+), grant webcam access, and within 3 seconds see:
  - Live mirrored webcam feed
  - Grid overlay with seeded, non-uniform column widths
  - 5 dotted-circle blobs on visible fingertips with `x: 0.xxx  y: 0.xxx` labels
  - Mosaic applied inside the hand-bounded polygon, bounded to grid cells
- Move the index finger left/right → mosaic tile size changes live
- Move the index finger up/down → grid column count changes live
- Open the Tweakpane panel, change any parameter → live render updates immediately
- Save a preset, click the chevron, cycle back — parameters restore exactly
- Record button → press, move around, press again → .webm downloads and plays back the effect
- Deny camera permission → full-screen `USER_DENIED` card with retry instructions
- All three of: `pnpm vitest run`, `pnpm biome check .`, `pnpm tsc --noEmit` exit 0
- The single Playwright E2E test passes with fake device media stream
- Vercel preview deployment loads the app and the live E2E run against the preview passes

---

## 14. Completeness Self-Audit

| Category | Covered by |
|---|---|
| Data model | D29 (Preset schema), D36–D37 (effect manifest, frame context) |
| Every external service | D31 (Vercel), D33 (MediaPipe model), D43 (no other APIs) |
| Every content type/output | D7 (blob labels), D9 (mosaic), D28 (recording), D29 (preset JSON) |
| Error handling | D23 (8 permission states), D26 (reduced motion), D31 (CSP fallbacks) |
| Security | D31 (all security headers), D34 (no telemetry) |
| Testing strategy | D21 (Vitest + Playwright), D41 (PRP 4-level per task), D42 (phase regression) |
| Edge cases | D23, D26, permission revoked at runtime (D25), model fail (D23: MODEL_LOAD_FAIL), webgl unavailable (D23: NO_WEBGL), vp9 fallback (D28) |
| Performance | D17 (main-thread is OK per research), D18 (rVFC loop), 30fps target |
| User workflow | D1, D2, §13 success criteria |
| Deployment | D31 (Vercel + headers), D40 (branch flow), D44 (model fetch) |
| Platform constraints | D10 (mirror), D12 (dark), Desktop-only, D23 (per-state UI) |
| Existing assets | D39 (current dir), D45 (reference screenshot) |

**Self-answer to the required question — "If an execution agent read only DISCOVERY.md, could it make every implementation decision without guessing?"** — **YES**, with the caveat that the reference screenshot at `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png` is part of the discovery artifact and must be viewed by any agent working on visual tasks.
