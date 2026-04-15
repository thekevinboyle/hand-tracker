# Hand Tracker FX - Product Requirements Document

**Created**: 2026-04-14
**Status**: Draft
**Source**: User brain dump + TouchDesigner reference screenshot

---

## 1. Vision

A web-based, TouchDesigner-style video effects application. The user's goal is to recreate a hand-tracking-driven visual effect — originally built in TouchDesigner — as a browser app that runs live on a webcam feed.

The initial release ships a single effect: a grid is overlaid on the live video, hand landmarks are tracked and displayed as dotted "blob" markers with their normalized (x, y) coordinates, and a pixelation / mosaic effect is applied inside specific grid cells. The effect's parameters are driven both by (a) hand movement on the X/Y axes and (b) a separate parameters panel in the UI.

The app is a creative/experimental tool — a playground for one hand-tracking effect now, architected so additional effects can be added later without re-scaffolding the engine.

## 2. Core Features

### Capture
- Webcam video as the source material (request `getUserMedia`, user grants permission)
- Handles webcam selection if multiple devices exist
- Mirror mode (selfie-style) on/off

### Hand Tracking
- Real-time hand landmark detection running in the browser
- Tracks 1 or 2 hands (up to 21 landmarks per hand in MediaPipe's model)
- Each landmark exposed with normalized `x`, `y` (and optionally `z`) in `[0, 1]` screen space

### Grid Overlay
- Grid of cells drawn over the video, visually matching the reference: vertical column lines of varying widths + horizontal rows
- Grid cell count, stroke width, and color are parameter-driven
- Certain grid cells receive an effect (pixelation/mosaic) when a hand landmark enters that cell OR when the cell falls inside a landmark-defined region (e.g., the cells between fingertip landmarks, or cells that overlap the face/hand bounding box in the reference)

### "Blob" Landmark Markers
- Each tracked landmark renders as a dotted circle (matching the reference)
- Next to each blob, render the normalized `(x, y)` coordinates to 3 decimal places
- Styling: thin dotted stroke, small text label next to the circle

### In-Grid Effects
- Pixelation / mosaic effect applied only within targeted grid cells (not the whole frame)
- Mosaic tile size, target cell selection logic, and blend/opacity are parameter-driven
- Performance target: remain visually smooth (aim for 30 fps on a modern laptop webcam)

### Parameter Panel (GUI)
- Side panel in the UI exposing live-editable parameters (TouchDesigner "parameters panel" analogue)
- Categories (initial guess, subject to discovery):
  - Grid: column count, row count, column width distribution, line color, line weight
  - Tracking: min detection confidence, max hands, show/hide landmarks, show/hide coordinate labels
  - Effect: mosaic tile size, target-cell selection mode (hand-proximity, face-overlap, manual), blend opacity
  - Input: webcam device selector, mirror on/off, resolution
- All parameters update the live render in real time (no reload)
- Parameter state should be persistable across reloads (local storage) and ideally exportable as a JSON preset

### X/Y Axis Driven Modulation
- Hand position on the X axis and Y axis modulates one or more effect parameters live (e.g., hand moving right increases mosaic tile size; hand moving up changes grid density)
- Which parameters are mapped to X/Y and the mapping range are themselves configurable in the panel (a mini "CHOP-style" mapping)

### UI Chrome (from reference)
- Left and right chevron navigation arrows visible in the reference — likely to cycle between effects/presets in the future; for MVP render them as non-functional placeholders OR a preset cycler if trivial

## 3. User Flows

### Flow 1: First Launch
1. User opens the web app
2. App requests webcam permission
3. On grant, live webcam appears with grid + landmark blobs + effect already running with default parameters
4. Parameters panel visible on the side

### Flow 2: Tweaking Parameters
1. User drags a slider / edits a number in the parameters panel
2. The live render updates immediately
3. User sees coordinate readouts on blobs change as they move their hand

### Flow 3: Preset Save/Load (nice-to-have)
1. User tweaks params to a look they like
2. Clicks "Save Preset" → preset stored (local storage) with a name
3. Later, selects it from a dropdown → params restore

## 4. Technical Signals

- **Inspiration**: TouchDesigner — modular node-based visual effects tool with a "parameters" panel per node
- **Source**: Webcam (for now; future could include pre-recorded video or image)
- **Architecture hint**: Should be structured so the single "hand tracking mosaic" effect is one node/module; additional effects are siblings. Think: an effects registry or pipeline abstraction even with only one effect today
- **Tracking library candidates**: MediaPipe Hands / Hand Landmarker (Google, runs in browser via WebAssembly/TFJS), Handsfree.js, or TensorFlow.js handpose — final choice resolved in Discovery
- **Rendering candidates**: Canvas 2D (simpler, may be fast enough), WebGL via a lib like PixiJS / three.js / regl for the mosaic shader (faster), or a hybrid (2D for grid/blobs, WebGL for mosaic)
- **Frontend framework**: Likely React + Vite (matches user's other web projects), but TBD in Discovery — could also be vanilla TS for minimal overhead
- **No backend needed** for MVP — everything runs client-side
- **Deployment**: static host (Vercel / Netlify / GitHub Pages) — TBD

## 5. Open Questions

- Which hand tracking library? (MediaPipe Hand Landmarker is the current best-in-class in-browser option, but need to confirm licensing/perf)
- Canvas 2D vs WebGL for rendering the mosaic effect?
- Frontend framework: React/Vite, Next.js, SvelteKit, or vanilla TS?
- Exact grid generation rules — is column-width variation random-seeded, hand-driven, or fixed from the reference?
- What exactly determines which grid cells get the mosaic effect? (Proximity to any landmark? Convex hull of landmarks? Bounding box of face? Manual cell selection?)
- Which X/Y mappings are "the" defaults? (User mentioned X and Y movement drives parameters — need to pick defaults)
- How many hands max — 1 or 2?
- Do coordinate labels render for every landmark, or only fingertips (as reference seems to show ~5-6 blobs, suggesting fingertips only)?
- Mirror mode default on or off?
- Is there a "record / export" feature in scope for MVP (record a clip of the effect output)?
- What resolution does the webcam feed run at? Auto or fixed?
- Are the left/right chevron arrows functional in MVP (preset cycler) or pure chrome?
- Desktop-only, or mobile-responsive?
- Dark theme only (reference is dark) or both?

## 6. Explicit Constraints

- **One effect only** in this release — do NOT build multiple effects, but DO architect for extension
- **Webcam source only** — no file upload, no pre-recorded video, no image input
- **Client-side only** — no backend, no auth, no user accounts, no cloud rendering
- **Faithful to reference** — the look must visually match the TouchDesigner screenshot (grid, dotted blobs with xy labels, mosaic cells)

## 7. Success Criteria

- User opens the web app, grants webcam access, and within seconds sees a live video with:
  - A grid overlay matching the reference style
  - Dotted-circle landmark blobs with xy coordinate labels near the hand
  - Mosaic/pixelation effect inside specific grid cells
- User can move their hand and the blob coordinates + any X/Y-mapped parameters update live
- User can open the parameters panel, change values, and see the live render respond immediately
- The effect is smooth (≥ 24 fps target, 30 fps ideal) on a modern laptop
- Code is structured so a second effect can be added without rewriting the engine
