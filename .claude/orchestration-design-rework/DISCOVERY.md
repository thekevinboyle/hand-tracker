# Hand Tracker FX — Design Rework — DISCOVERY (top authority)

**Created**: 2026-04-20
**Status**: Complete (round 1 + 2)
**Rounds of Q&A**: 2 (12 numbered decisions + 7 agent-locked follow-ups)
**Authority**: This document overrides PRD.md, research/*, and any task files. When in conflict, DISCOVERY wins.

Builds on top of the parent project's DISCOVERY at `.claude/orchestration-hand-tracker-fx/DISCOVERY.md`. That document (45 decisions, D1–D45) remains authoritative for engine concerns. This document (DR1–DR19) overrides only the chrome / visual design decisions. Where a parent-project decision is explicitly restated here, this document wins.

---

## 1. Direction & Scope

**DR1: How closely should the Hand Tracker FX UI match the pixelcrash.xyz reference?**
A: **Inspired, looser.** Take pixelcrash's direction (instrument-panel aesthetic, monospace typography, dense information layout, minimal/editorial chrome) but give Hand Tracker FX its own identity. Not a 1:1 clone; our own wordmark, our own component library. Section-name semantics inside the LAYER card stay honest to our params (Grid / Mosaic / Input), not pixelcrash's (Mapping / Range / Cells / Symbols).

**DR2: Should the product be renamed?**
A: **Keep "Hand Tracker FX".** The wordmark in the pixelcrash screenshot is their brand; we can't use it. Hand Tracker FX stays. The wordmark is rendered in JetBrains Mono 600 at ~22px, paired with a solid-filled glyph mark (see DR13 favicon).

---

## 2. Technology

**DR3: Keep Tweakpane, replace it, or hybrid?**
A: **Replace Tweakpane entirely with custom React components.** Drop Tweakpane from the UI runtime. Render our own top-toolbar + layer-card controls directly against the existing `paramStore` + `manifest`. Engine (`src/engine/manifest.ts`, `src/engine/paramStore.ts`, `src/effects/`, `src/camera/`, `src/tracking/`) is LOCKED — we read its types and data, we don't change its contract. `src/engine/buildPaneFromManifest.ts` and `src/ui/ModulationPanel.ts` get retired. The `@tweakpane/core` + `@tweakpane/plugin-essentials` packages get removed from `package.json` in the final cleanup task.

---

## 3. Phasing

**DR4: How should the remaining Phase-5 tasks interact with the design rework?**
A: **Design rework first, then resume 5.3–5.R on top of the new design.** No parallel-track coordination. Visual-fidelity gate (5.5 in the parent orchestration) adopts the new reference screenshot at `reports/DR-8-regression/design-rework-reference.png` (captured by DR-8.R at 1440×900) instead of `touchdesigner-reference.png`. (`pixelcrash-reference.png` is the stylistic inspiration, NOT the diff target.) Phase 5 tasks are paused after 5.2 (Vercel deploy done) and resume as the last phase of this rework orchestration.

---

## 4. Visual Language

**DR5: Light mode vs dark mode?**
A: **Dark mode.** Webcam footage reads better on a dark stage. Borrow pixelcrash's geometry / typography / interaction patterns but invert the neutral scale. Specifically:

| Role | Value |
|---|---|
| Page background | `#0A0A0B` |
| Panel / card surface | `#151515` |
| Panel divider (hairline 1px) | `#1F1F1F` |
| Primary text | `#EAEAEA` |
| Muted / secondary text | `#8F8F8F` |
| Disabled / hint text | `#6F6F6F` |
| Primary button BG | `#EAEAEA` (light on dark — inverts pixelcrash) |
| Primary button text | `#0A0A0B` |
| Secondary button BG | `#2A2A2A` |
| Secondary button hover BG | `#333333` |
| Segmented unselected | `#6F6F6F` |
| Segmented selected | `#EAEAEA` + weight 600 |
| Toggle ON fill | `#EAEAEA` |
| Toggle OFF fill | `#4A4A4A` |
| Slider track | `#2A2A2A` |
| Slider active range | `#EAEAEA` |
| Slider handle | `#EAEAEA` |
| Slider hover | `#CFCFCF` |
| Accent (record active) | `#D23030` (existing app red, kept) |
| Focus ring | `#6AA9FF` (existing app blue, kept) |

Rationale: inverse of pixelcrash's `--color-white`/`--color-grey-94`/`--color-black` triad. No borders on panels — color-step separation only (`#0A0A0B` bg → `#151515` panel).

**DR6: How does the "LAYER N" concept map to our app?**
A: **Single LAYER 1 card.** We ship one effect today. The sidebar has exactly one LAYER card that groups all current `handTrackingMosaic` params. Three inner sections (mirroring our manifest pages):

- **Grid** — seed, columns, rows, width variance, line color, line weight, Randomize button
- **Mosaic** — tile size, blend opacity, edge feather, region padding
- **Input** — mirror, show landmarks, (camera device)

No "Add Layer" button. No multi-layer stacking UI.

**DR7: Font?**
A: **JetBrains Mono, self-hosted.** Download the OFL-licensed font files (Medium 500 + SemiBold 600 + Regular 400 Italic for fallback) from JetBrains, subset to Latin + basic Unicode punctuation (no ligatures needed in UI context), commit to `/public/fonts/`, wire up `@font-face` in `src/index.css`. Preload the 500 weight. Root font-size: fluid `clamp(13px, 0.9vw, 16px)` (a bit larger than pixelcrash's 9–13px — our users may be further from the monitor than pixelcrash's; also webcam apps read better at a slightly larger base size). letter-spacing: `-0.01em`. Default weight 500; 600 for emphasis (wordmark, LAYER titles, segmented selected state).

**DR8: Modulation panel location?**
A: **Collapsible section below the LAYER card in the right sidebar.** Structure: `[LAYER 1 card, always expanded] / [MODULATION card, collapsed by default with toggle chevron]`. When MODULATION expands, it lists routes with inline controls: `[Enabled ■] [Source ⌄] [Target ⌄] [InRange 0.00–1.00] [OutRange] [Curve ⌄] [Delete]`. Plus "+ Add route" at card bottom. Uses the same visual pattern as the LAYER card (same panel bg, same divider hairlines).

---

## 5. Interaction & Components

**DR9: Cell-size picker (XS / S / M / L / XL) binding?**
A: **Binds to `mosaic.tileSize`.** Five buckets: XS=4, S=8, M=16 (default), L=32, XL=64. Honors the manifest's min=4, max=64 range. Clicking a bucket calls `paramStore.set('mosaic.tileSize', value)`. The layer-card's tile-size slider subscribes to the same paramStore key so the UI stays consistent. Segmented-control style (typographic: grey → semibold black-on-dark); no pill track.

**DR10: "Colors | Video" tab and "Upload" button fate?**
A: **Drop both.** Our app is live-webcam-only — no upload source, no alternate view. Cleaner toolbar: `[wordmark] [Cells picker] ———————— [Record]`. "Show source" also dropped (no semantic equivalent in our render graph without adding scope). Honest to scope.

**DR11: Port pixelcrash's square→pill hover animation?**
A: **Yes, port it.** Buttons render at `border-radius: 0` at rest and animate to `border-radius: 22px` (~`--space-22` equivalent) on hover over 0.2s ease. Applies to: primary buttons (Record, + Add route), secondary buttons (Randomize, Delete route), toggle buttons (square→circle morph on hover). CSS-only — no JS animation library. Respects `prefers-reduced-motion: reduce` by collapsing transition duration to 0. Text links (Delete in layer header) use color-only hover.

**DR12: Dark-mode palette aggressiveness?**
A: **Soft dark.** See DR5 table. Not pure-black; not warm/cool tinted. Near-neutral blacks and greys that sit quietly behind webcam content.

---

## 6. Specific UI Locks (agent-decided, ratified here)

**DR13: Favicon.**
A: **Keep the existing `#863bff` / `#47bfff` gradient hand-glyph SVG.** It IS our brand mark. Pair it with JetBrains Mono "Hand Tracker FX" wordmark in the toolbar. (Possible tweak: also render a flat monochrome version as the toolbar's logomark — 20×20 px, same neutral-palette color as primary text.)

**DR14: Error + pre-prompt cards.**
A: **Restyle, keep structure.** The 8-state camera-permission UI (PrePromptCard + ErrorStates) stays behaviorally identical. Cards now use the new token palette: `#151515` panel bg, no border, `#1F1F1F` hairline separator between title and body, JetBrains Mono throughout. Existing `role`, `aria-live`, testids preserved exactly (E2E tests must continue to pass).

**DR15: Record button position.**
A: **Inline in top-right of toolbar.** Move from current fixed `top: 50px right: 12px` position into the toolbar row as the right-anchored flex child. Removes floating-button visual clutter. Keep the red recording state (`#D23030` fill) and elapsed-time display inline.

**DR16: Preset cycler + preset actions.**
A: **Move into the sidebar header, above LAYER 1 card.** The current fixed-bottom-center PresetBar and fixed-top-left PresetActions get merged into a single "preset strip" at the top of the sidebar: `[‹] Preset Name [›] [Save] [Save As] [Delete] [↓ Export] [↑ Import]`. Minimal visual weight; JetBrains Mono body size. Preserves ArrowLeft/Right keyboard behavior + all preset file I/O. Note: this replaces two currently-fixed components with one sidebar-internal strip — simplifies the floating z-index mess documented in the audit.

**DR17: Archive the TouchDesigner reference.**
A: **Move, don't delete.** `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png` → `.claude/orchestration-hand-tracker-fx/reference-assets/_historical/touchdesigner-reference.png`. Keep git history of both references. Update any CLAUDE.md / PROGRESS.md references to the new path or mark historical.

**DR18: Footer.**
A: **Keep, simplified.** Small bottom row: `[hand-tracker-fx v0.1.0] ·················· [Built with MediaPipe, ogl, React]`. No "Leave feedback" button (we don't have a feedback channel). Muted text color `#8F8F8F`. Hidden on error/pre-prompt screens.

**DR19: Signature dev-facing detail.**
A: **Source-code comment in `index.html`**: `<!-- Hand Tracker FX — pixelcrash-inspired rework 2026-04-20 -->`. Marks the rework landmark for future spelunkers. No functional effect.

---

## 7. Testing & Non-Functional

**Inherits from parent DISCOVERY D20–D45**: all PRP 4-level validation (biome + tsc, vitest, build, playwright E2E), Ralph iteration loop, COOP/COEP/CSP discipline, StrictMode safety, reduced-motion gate, 8-state camera permission UI contract — all preserved without change.

**New testing notes for the rework:**

- Each component primitive (Button, Segmented, Slider, Toggle, ColorPicker, LayerCard, ModulationRow) gets its own unit test file (`*.test.tsx` with @testing-library/react + jsdom).
- Every user-facing E2E test (Phase 1–4 aggregate) must still pass end-to-end against the new chrome. Testids MUST be preserved on the elements they currently target:
  - `camera-state`, `stage`, `render-canvas`, `stage-video`, `webgl-canvas`, `overlay-canvas`
  - `panel-root`, `params-panel` (retained on the sidebar root + layer-card body)
  - `preset-bar`, `preset-name`, `preset-actions`
  - `record-button`, `record-elapsed`
  - `error-state-card-${state}` (all 8 states)
- New testids for net-new chrome: `toolbar`, `toolbar-wordmark`, `toolbar-cell-picker`, `layer-card-grid`, `layer-card-mosaic`, `layer-card-input`, `modulation-card`, `modulation-route-${n}`.
- Visual-fidelity E2E test compares screenshots against a new reference at `reference-assets/design-rework-reference.png` (captured post-implementation and checked in).

---

## 8. Explicit Non-Goals

1. **Do not** change the `handTrackingMosaic` manifest, param keys, types, or defaults.
2. **Do not** change the render loop, MediaPipe integration, WebGL shader, or ogl renderer lifecycle.
3. **Do not** add new parameters, new effects, or a multi-effect registry.
4. **Do not** add new tracking features (multi-hand, face, 3D — see parent DISCOVERY §12).
5. **Do not** build a mobile layout; pixelcrash blocks < 768px and we follow suit.
6. **Do not** add analytics, telemetry, or a feedback channel.
7. **Do not** add authentication, accounts, cloud storage, or any server-side state.
8. **Do not** use a CSS-in-JS library, Tailwind, shadcn, or any component framework. Plain CSS + CSS custom properties + CSS Modules (optional) only.
9. **Do not** copy pixelcrash's wordmark, logo, or any of their branded assets.
10. **Do not** break the live URL (`hand-tracker-jade.vercel.app`) during the rework — all changes ship behind main-branch fast-forwards after each phase passes validation.

---

## 9. Open-for-refinement items

None blocking. Nice-to-haves for later:
- Keyboard shortcuts table (ArrowLeft/Right currently for preset cycle; potential additions: space for record toggle, `[`/`]` for cell-size bucket, `R` for randomize-grid).
- Reduced-motion test matrix — confirm all new hover animations skip cleanly when `prefers-reduced-motion: reduce` is set.
- Font-size fluid-clamp tuning — start with `clamp(13px, 0.9vw, 16px)`; adjust after implementation based on readability at common viewport sizes.

---

## 10. Decision Completeness Check

I have verified against the m2c1 self-audit checklist:

| Category | Status |
|---|---|
| Data model | N/A — no new data |
| External services | None needed |
| Content types | N/A |
| Error handling | Covered by DR14 + existing 8-state contract |
| Security | No change to COOP/COEP/CSP |
| Testing strategy | Covered by section 7 |
| Edge cases | Reduced-motion + font-load fallback + 768px min width |
| Performance | No regression budget; maintain FPS parity with current build |
| User workflow | Covered by PRD §3 + DR9/DR15/DR16 |
| Deployment | Inherit parent's Vercel pipeline |
| Platform-specific | Desktop-first, 768px min |
| Existing assets | Favicon kept; TouchDesigner ref archived |

**All discovery complete — ready to plan (PHASES.md).**
