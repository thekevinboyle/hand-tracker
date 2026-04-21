# Hand Tracker FX — Design Rework (to match pixelCrash) — PRD

**Created**: 2026-04-20
**Status**: Draft
**Source**: User brain dump + reference screenshot + pixelcrash.xyz

---

## 1. Vision

Hand Tracker FX today ships a working TouchDesigner-inspired UI: a dark stage with the webcam mosaic effect in the center and a Tweakpane parameters panel pinned to the right. The engine is done, the effect is shipped to Vercel, and Phases 1–4 are all green.

The ask: **rework the visual design to match pixelcrash.xyz** — a browser-based image/video-to-mosaic tool with a more polished, editorial, and opinionated layout. The reference screenshot shows a cleaner chrome: thin top toolbar with inline cell-size picker and record/upload actions, a large centered preview, and a right sidebar of discrete "LAYER" cards (Mapping / Range / Cells / Symbols) instead of a generic Tweakpane tree.

This is a **visual / chrome-only** rework. The engine (MediaPipe tracking, WebGL mosaic shader, modulation, preset persistence, record pipeline) does not change. Every current parameter and feature must remain addressable in the new UI.

Target audience stays the same: visitors demoing the live URL (hand-tracker-jade.vercel.app) — technically curious users who like generative / creative-coding tools.

## 2. Core Features (Visual rework)

### 2.1 Top toolbar
- Wordmark logo top-left (replaces current absence / replaces "Hand Tracker FX" text if present)
- Inline "Cells:" label + size picker segmented control (XS / S / M / L / XL) that binds to the existing `tileSize` (or equivalent) parameter
- Segmented tab control "Colors | Video" near center (purpose TBD — map to an existing view toggle or drop; resolve in discovery)
- "Show source" checkbox-style toggle
- Top-right: "Upload" button (inactive for MVP — hidden or disabled per discovery) + **Record** button (existing pipeline, restyled)

### 2.2 Main canvas
- Large centered preview area showing the live mosaic + hand overlay
- Subtle 1px border / slight rounded corners
- Canvas fills available space between top toolbar and footer
- Mirror-aware composition unchanged

### 2.3 Right sidebar — "Layer" cards
- Replace current Tweakpane default layout with custom card panels
- Each "LAYER N" card contains grouped sections:
  - **Mapping** — segmented (Brightness | Edge)
  - **Range** — segmented (Below | Between | Above) + numeric range slider (e.g. "200 - 255")
  - **Cells** — Sample / Solid toggle + hex color chips
  - **Symbols** — character-set rows + hex color
- Plus-button to add sections / rows
- "Delete" link per card
- Subtle card background, hairline border

> Open question: does "Layer" map onto the existing `handTrackingMosaic` param model, or is it a new concept we need to shoehorn in? Discovery will resolve.

### 2.4 Footer
- Small project version + credit ("Hand Tracker FX / built by …")
- "Leave feedback" button bottom-right (outlined, small)

### 2.5 Error / pre-prompt UI
- Existing 8-state camera permission UI (PrePromptCard + ErrorStates) restyled to the new language (dark panel, hairline border, same typography as layer cards) — no behavior change

### 2.6 Record button
- Existing `useRecorder` pipeline unchanged
- Button visually matches toolbar (filled dark, "Record" label, toggles to recording state with elapsed time)

### 2.7 Preset cycler + modulation panel
- Existing preset chevrons + ArrowLeft/Right behavior preserved
- Modulation routes must still be editable — location TBD in discovery (inline in layer cards? secondary drawer? collapsible section below layers?)

## 3. User Flows

### Flow 1: First visit
1. User lands on hand-tracker-jade.vercel.app
2. Dark stage renders with new chrome (top toolbar, empty canvas area behind pre-prompt, right sidebar showing a single default LAYER card in a neutral state)
3. Pre-prompt card invites camera access — restyled but same behavior
4. On grant → webcam renders in canvas area, mosaic runs, layer-card controls become active

### Flow 2: Adjusting the effect
1. User clicks a cell-size pill in the top toolbar → tile size changes
2. User tweaks range sliders / color chips in a layer card → effect updates live
3. User opens modulation panel (location TBD) → routes XY hand landmarks to params

### Flow 3: Record and share
1. User clicks Record (top right)
2. Button turns active, shows elapsed time
3. User clicks Stop → webm downloads

### Flow 4: Presets
1. User cycles presets via chevrons or ArrowLeft/Right
2. Layer card sections + top toolbar reflect the loaded preset values

## 4. Technical Signals

- **Stack is locked**: React 19.2, Vite 8, TypeScript 6 strict, Biome, Vitest, Playwright — no changes
- **Tweakpane**: current plan is to drop it for the custom layer cards (research subagents will confirm feasibility). If we keep it, we'd heavily theme it, which fights its DOM. Preferred direction: hand-rolled React components styled with CSS Modules or a lightweight CSS-in-JS that matches Biome + strict TS.
- **Font**: pixelcrash uses what appears to be a semi-monospace technical sans (possibly "Söhne Mono", "Berkeley Mono", or similar) — final choice in discovery. Self-host to preserve COOP/COEP.
- **Color tokens**: introduce CSS custom properties for all colors, spacing, type sizes
- **Icon set**: minimal — plus, delete, chevron. Likely inline SVG.
- **Accessibility**: keep `prefers-reduced-motion` hookup; add focus-visible rings; maintain keyboard nav on segmented controls
- **Engine boundary**: `src/engine/`, `src/effects/`, `src/camera/` are off-limits. Rework touches `src/ui/`, `src/App.tsx` composition, `index.html`, CSS files, and possibly the mount seam for Tweakpane.

## 5. Open Questions

- Q1: Does the user want a **1:1 visual copy** of pixelcrash.xyz, or a "pixelcrash-inspired" adaptation that keeps Hand Tracker FX's identity?
- Q2: Does the new "LAYER" model translate to our mosaic params, or is it just visual? (We only have one effect today; "Layer 1 / Layer 2" may not map.)
- Q3: What are the "Mapping (Brightness/Edge)" and "Range (Below/Between/Above)" controls in pixelcrash — and is there an analogue in Hand Tracker FX, or are they dropped?
- Q4: Keep Tweakpane (themed) or replace entirely with custom React components?
- Q5: Where does the modulation-route UI live in the new layout?
- Q6: Font licensing — self-host a specific font (Berkeley Mono is paid; JetBrains Mono is free), or use a free approximation?
- Q7: Keep the existing "Upload" and "Colors / Video" affordances, hide them, or map them to something real in our app?
- Q8: Should the app be rebranded to "pixelCrash" (the screenshot shows that wordmark) or keep "Hand Tracker FX" identity? Almost certainly the latter — confirm.
- Q9: Existing TouchDesigner reference (`reference-assets/touchdesigner-reference.png`) — retire it or keep as historical?
- Q10: Phase-5 pending tasks (5.3 CI, 5.4 error-state E2E, 5.5 visual-fidelity gate, 5.R final cut) — do these run before, after, or in parallel with the design rework?

## 6. Explicit Constraints

- Engine code (`src/engine/`, `src/effects/`, `src/camera/`) MUST NOT change
- All existing parameters, modulation, presets, and recording must remain accessible
- Stack (React 19, Vite 8, TS 6, Biome, Vitest, Playwright) unchanged
- No new heavy dependencies (no full CSS-in-JS library, no design-system framework)
- COOP/COEP/CSP discipline preserved — self-host any fonts
- Live URL (hand-tracker-jade.vercel.app) must keep working throughout the rework

## 7. Success Criteria

- Side-by-side comparison against the pixelcrash reference screenshot shows ≥ 90% visual fidelity (spacing, typography, color, component shapes) on a default preset at 1440×900
- Every pre-existing feature still works: 8 camera states, mosaic runs, params mutate, modulation drives params, preset cycler cycles, record outputs .webm, reduced-motion pauses modulation
- All 4 PRP validation levels green (biome + tsc, vitest, build, playwright)
- Live URL reflects the new design end-to-end
- Phase 5 remaining tasks still completable (or explicitly rescoped) on top of the new UI

---
