# Current UI Audit — Hand Tracker FX (pre-rework)

**Date**: 2026-04-20
**Scope**: All chrome / visual surface area in `src/ui/`, `src/App.tsx`, `src/main.tsx`, `index.html`, CSS files. Engine (`src/engine/`, `src/effects/`, `src/camera/`, `src/tracking/`) explicitly out of scope — documented here as "locked" so the rework plan does not touch it.
**Authored by**: subagent audit (written to disk by main agent because the Explore agent runs read-only)

---

## 1. Component Inventory

### Core UI components — `src/ui/`

| File | LOC | Purpose | Key markup / style notes |
|------|-----|---------|--------------------------|
| **Stage.tsx** | 268 | Hidden `<video>` + stacked WebGL + 2D overlay canvases | Refs: `videoRef`, `webglRef`, `overlayRef`. Classes: `.stage`, `.stage-video`, `.stage-canvas`, `.stage-webgl`, `.stage-overlay`. Attribute: `data-mirror` (true/false). Testids: `stage`, `render-canvas`, `stage-video`, `webgl-canvas`, `overlay-canvas`. |
| **Stage.css** | 42 | Layout for stage canvases | `.stage` fixed full-viewport bg `#000`, `.stage-canvas` absolute inset 0, mirror via `scaleX(-1)`, z-index layering (webgl 0, overlay 1). |
| **Panel.tsx** | 69 | Tweakpane wrapper React component | Ref-owned `<div>`, class `panel-container`, testid `panel-root`. Child div for params: testid `params-panel`. Wraps `PresetActions`. |
| **PresetActions.tsx** | 188 | Preset Save / Load / Delete / Export / Import | Fixed top: 0, left: 0, z-index 100. Inline styles: bg `#111`, border 1px `#2d2d2d`. Buttons: bg `#1b1b1b`, color `#e6e6e6`. Name input. Testid: `preset-actions`. |
| **PresetBar.tsx** | 134 | Chevron cycler + ArrowLeft/Right | Fixed bottom 12, left 50% `translateX(-50%)`, z-index 10. Bg `rgba(17,17,17,0.85)`, border 1px `#2d2d2d`, radius 20px. Chevrons `‹` / `›` 18px. Testids: `preset-bar`, `preset-name`. |
| **RecordButton.tsx** | 109 | Red REC + elapsed + error | Fixed top 50, right 12, z-index **110** (above PresetActions). Bg `rgba(17,17,17,0.85)` → `rgba(200,40,40,0.85)` recording. Dot 10×10 `#d23030`. Testids: `record-button`, `record-elapsed`. |
| **cards.css** | 57 | Shared styling for error/prompt cards | `.card` fixed full-screen, centered 480px max-width. `.card-title` 1.5rem `#fafafb`. `.card-body` 1rem `#c7c7cc`. `.card-retry` bg `#1c1c1e`, border `#3a3a3c`, hover `#2c2c2e`. |
| **PrePromptCard.tsx** | 32 | Camera-permission prompt | `.card` + `.card-title` + `.card-body` + `.card-retry`. Copy from `errorCopy.PROMPT`. `role="dialog"`, `aria-live="polite"`. Testid: `error-state-card-PROMPT`. |
| **ErrorStates.tsx** | 39 | Error states (NOT_FOUND, DEVICE_CONFLICT, …) | Same `.card` structure. `role="alert"`. Testid: `error-state-card-${state}`. |
| **errorCopy.ts** | 45 | Copy strings for all camera states | `errorCopy: Record<CameraState, CardCopy>`. Keys: `PROMPT`, `GRANTED`, `USER_DENIED`, `SYSTEM_DENIED`, `DEVICE_CONFLICT`, `NOT_FOUND`, `MODEL_LOAD_FAIL`, `NO_WEBGL`. |
| **ModulationPanel.ts** | 206 | Imperative Tweakpane folder builder — NOT React | Builds folder-per-route. `SOURCE_OPTIONS` (45 landmark + pinch + centroid). `CURVE_OPTIONS` (Linear, Ease In, Ease Out, Ease In-Out, Cubic Bezier). |
| **PresetCycler.ts** | 118 | Preset cycler state machine — NOT React | Module singleton. `cycleNext`, `cyclePrev`, `goTo`, `refresh`, `onChange`, `getState`. |
| **useRecorder.ts** | 175 | MediaRecorder hook + `captureStream()` | State: `isRecording`, `elapsedMs`, `error`. `start(canvas)` / `stop()`. Codec chain: vp9 → vp8 → webm. |

### Entry points & layout

| File | LOC | Purpose |
|------|-----|---------|
| **App.tsx** | 159 | Renders `<Stage>` + `<Panel>` + `<PresetBar>` + `<RecordButton>` + error states. Class `app-shell`. Owns render-loop lifecycle. |
| **main.tsx** | 46 | React root + module init. Seeds modulation / presets / cycler stores before render. Registers `handTrackingMosaic`. Calls `registerSW()`. |
| **index.html** | 14 | Root `#root`. No custom fonts (system-ui). Favicon `/favicon.svg`. Viewport + description meta. |

### CSS files at a glance

- **src/index.css** (24 LOC) — `color-scheme: dark`, bg `#0a0a0b`, color `#e6e6e8`, system-ui. `.app-shell` padding 24px.
- **src/ui/Stage.css** (42 LOC) — Full-viewport fixed layout, canvas z-index, mirror `scaleX(-1)`.
- **src/ui/cards.css** (57 LOC) — Centered modal cards, dark button styling, reduced-motion branch.

---

## 2. Styling System

### Color palette (inline + hardcoded — no tokens)

- **Background**: `#0a0a0b` (root), `#000` (stage), `#111` (preset-actions bar), `#1b1b1b` / `#1c1c1e` (buttons).
- **Text**: `#e6e6e8` (root), `#e6e6e6` (buttons/panels), `#fafafb` (card titles), `#c7c7cc` (card bodies).
- **Borders**: `#2d2d2d` (buttons/panels), `#3a3a3c` (card), `#5a5a5c` (card hover).
- **Accent**: `#6aa9ff` (focus ring), `#d23030` (record dot), `#863bff` (favicon glyph), `#47bfff` (favicon accent).
- **Recording**: `rgba(200,40,40,0.85)` button state.

### Typography
- Family: `system-ui, -apple-system, 'Segoe UI', sans-serif`. No `@font-face`. No font files loaded.
- Sizes: 1.5rem (card titles), 1rem (card body), 12px (buttons / preset bar), 11px (error text).
- Weights: mostly inherited; 500 on preset name.

### Spacing
- Padding: 24px (app-shell), 32px (card), 10px 18px (buttons), 6px 12px (preset bar/buttons).
- Gap: 16px (card), 8px (preset bar), 4px (record column), 6px (preset actions).
- Fixed offsets: preset-actions top 0; record-button top 50 right 12; preset-bar bottom 12.

### CSS custom properties / tokens
- **None.** All values are hardcoded inline or in CSS class bodies. No design-token indirection.

### CSS import strategy (Vite)
- `main.tsx` → `App.tsx` imports `./index.css`.
- `Stage.tsx` imports `./Stage.css`.
- `Panel.tsx` has no direct CSS (Tweakpane injects its own).
- `PrePromptCard.tsx` + `ErrorStates.tsx` both import `./cards.css`.
- No CSS Modules. Vite bundles normally.

---

## 3. Tweakpane Integration

### Mount
- `Panel.tsx:47` — `buildPaneFromManifest()` inside `useEffect`.
- Plugin `@tweakpane/plugin-essentials` imported at `Panel.tsx:18`, registered before any blade.
- Container: ref-owned `<div data-testid="params-panel">`.
- **No theme override** — Tweakpane default dark theme, no CSS injection.

### `buildPaneFromManifest`
- `src/engine/buildPaneFromManifest.ts:108–181`.
- Input: `manifest.params[]` (discriminated union `ParamDef`).
- Output: Pane with tabs (one per page) or folders.
- Per-param: `addBinding()` for sliders/text/buttons → `paramStore.set(key, value)`.
- Folder cache: `WeakMap<FolderContainer, Map<string, FolderApi>>`.
- Dispose guard is idempotent, clears container DOM.

### Modulation panel
- `ModulationPanel.ts:170–206` — mounted **after** effect params at `Panel.tsx:54`.
- One collapsible folder per `ModulationRoute`.
- Per-route: enabled toggle, source dropdown (45 options), target param, input/output ranges (interval blade), curve (dropdown + cubic-bezier blade), delete button.
- "Add route" button at bottom.
- Subscribes to `modulationStore`; rebuilds on change.
- **No React** — pure imperative Tweakpane.

### Preset actions bar
- `PresetActions.tsx:48–62` — fixed `top 0 left 0 right 0, zIndex 100`.
- Above Tweakpane's default-fixed panel.
- Buttons: Save, Save As, Delete, Export + Import file input. Editable current-preset-name input (blur triggers load).

### Record button
- `RecordButton.tsx:24–35` — fixed `top 50 right 12, zIndex 110` (above preset actions @ 100).
- Flex column, gap 4; error message below button.

---

## 4. Layout / Stage

### Runtime DOM

```
<main class="app-shell">
  <p data-testid="camera-state" style="position: absolute; left: -9999px">
    {state}
  </p>

  <!-- conditionally rendered -->
  <div class="stage" data-mirror="true/false" data-testid="stage">
    <div data-testid="render-canvas" style="position: absolute; inset: 0; pointer-events: none"></div>
    <video class="stage-video" data-testid="stage-video"></video>
    <canvas class="stage-canvas stage-webgl" data-testid="webgl-canvas"></canvas>
    <canvas class="stage-canvas stage-overlay" data-testid="overlay-canvas"></canvas>
  </div>

  <div class="panel-container" data-testid="panel-root">
    <div style="position: fixed; top: 0; …" data-testid="preset-actions">[preset buttons]</div>
    <div data-testid="params-panel">[Tweakpane renders here]</div>
  </div>

  <div style="position: fixed; bottom: 12; …" data-testid="preset-bar">[‹ ›]</div>
  <div style="position: fixed; top: 50; right: 12; …" data-testid="record-button">[REC]</div>
</main>
```

### Video / canvas specifics
- `Stage.tsx:239–267`.
- Video: absolute 1×1 px, opacity 0, never visible. **Source of truth for MediaPipe** (D27 — unmirrored raw pixels).
- WebGL canvas: `.stage-webgl`, z-index 0, full viewport.
- Overlay canvas: `.stage-overlay`, z-index 1, pointer-events none.
- Both canvases get `scaleX(-1)` when `data-mirror="true"`; video is **never** transformed.

### Mirror transform
```css
.stage[data-mirror="true"] .stage-canvas {
  transform: scaleX(-1);
  transform-origin: center;
}
```

### Renderer lifecycle (`ogl`)
- `Stage.tsx:147–237`.
- `createOglRenderer(canvas)` → `{ renderer, gl }`.
- `createVideoTexture(gl)` — one.
- `attachContextLossHandlers()` → on loss: unmount texture, null brokers; on restore: new texture, fire `onTextureRecreated` → App.tsx re-mounts EffectInstance.
- Resize observer + window resize.
- Cleanup via idempotent `disposeRenderer()` (no `forceLoseContext` — StrictMode-safe).

---

## 5. Error / Pre-prompt UI

### PrePromptCard (`src/ui/PrePromptCard.tsx:1–32`)
```jsx
<div class="card" role="dialog" aria-live="polite" aria-labelledby="prp-title" data-testid="error-state-card-PROMPT">
  <h2 id="prp-title" class="card-title">{copy.title}</h2>
  <p class="card-body">{copy.body}</p>
  <button class="card-retry" type="button" onClick={onAllow}>{copy.retryLabel}</button>
</div>
```
Copy (`errorCopy.ts:10–14`):
- Title: "Enable your camera"
- Body: "Hand Tracker FX needs your camera to track your hand. Video stays on your device — nothing is uploaded."
- Button: "Enable Camera"

### ErrorStates (`src/ui/ErrorStates.tsx:1–39`)
Same structure, `role="alert"`. Mapping:

| State | Title | Retry? |
|---|---|---|
| USER_DENIED | "Camera access blocked" | yes |
| SYSTEM_DENIED | "Your OS or browser blocked camera access" | yes |
| DEVICE_CONFLICT | "Camera is busy" | yes |
| NOT_FOUND | "No camera detected" | yes |
| MODEL_LOAD_FAIL | "Hand tracking failed to load" | yes |
| NO_WEBGL | "Your browser can't run the effect" | no |

Styling (`cards.css`): fixed inset 0, max-width 480px, centered; `.card-title` 1.5rem `#fafafb`; `.card-body` 1rem `#c7c7cc`; `.card-retry` bg `#1c1c1e` border `#3a3a3c` hover `#2c2c2e` focus `#6aa9ff`. Reduced-motion disables transitions.

---

## 6. Existing Assets

### Logo / favicon
- `public/favicon.svg` — gradient + filter SVG, "hand/finger silhouette with blur", 48×46 viewBox.
- Primary `#863bff`, accent `#47bfff` (display-p3 colour space).
- Referenced at `index.html:5`: `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`.

### Historical reference
- `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png` (744 KB) — original design target; **do not compare** for the rework, just note it exists. Keep for history.

### No other assets
- No PNG / JPG logos. No background images. No icon sprites (inline SVG where needed).

---

## 7. Engine vs Chrome Separation

### LOCKED — engine (DO NOT touch in rework)

`src/engine/` — buildPaneFromManifest, manifest, paramStore, modulationStore, presets, modulation, renderLoop, renderer, rendererRef, videoTextureRef, registry, reducedMotion, contextLoss, devHooks.

`src/effects/handTrackingMosaic/` — manifest, shader, render, gridRenderer, blobRenderer, region, grid.

`src/camera/` — useCamera, cameraState, mapError.

`src/tracking/` — handLandmarker, errors.

### CHROME — target for rework

- Everything in `src/ui/` (.tsx + .css + copy strings).
- `src/index.css`.
- `index.html` (title, meta, fonts, favicon).
- `App.tsx` composition (component order, z-index layers, fixed positions).
- `main.tsx` may need minor tweaks (e.g. font loader) but no logic change.
- Tweakpane mount/unmount strategy stays — only theme / wrapper is up for rework. If we replace Tweakpane with custom React components, `buildPaneFromManifest` remains as the upstream contract we read from; we render our own blades against that data.

---

## Exact targets for the rework plan

- Color hardcodes:
  - `src/index.css:4–5`
  - `src/ui/Stage.css` (lines 1–42)
  - `src/ui/cards.css` (lines 1–57)
  - `src/ui/PresetBar.tsx:27–64` inline
  - `src/ui/RecordButton.tsx:24–67` inline
  - `src/ui/PresetActions.tsx:33–62` inline
- Layout z-indexes:
  - PresetActions 100 (`src/ui/PresetActions.tsx:61`)
  - RecordButton 110 (`src/ui/RecordButton.tsx:34`)
  - PresetBar 10 (`src/ui/PresetBar.tsx:41`)
- Tweakpane mount: `src/ui/Panel.tsx:47`, container class `panel-container`.
- Stage layout: `src/ui/Stage.tsx:239–267` + `src/ui/Stage.css:1–42`.
- Cards: `src/ui/PrePromptCard.tsx:9–30`, `src/ui/ErrorStates.tsx:18–39`, `src/ui/cards.css:1–57`.
