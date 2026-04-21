# Hand Tracker FX — Design Rework — Implementation Phases

**Target**: Pixelcrash-inspired chrome rework complete, live on `hand-tracker-jade.vercel.app`, parent Phase-5 tasks resumed on top
**Execution**: Sequential phases, Ralph-loop autonomous subagent per task
**Authority**: `DISCOVERY.md` (this folder) overrides everything. Parent-project `DISCOVERY.md` still authoritative for engine concerns it hasn't been overridden.

---

## Scope Constraints (from DISCOVERY DR §8)

OUT of scope — do NOT implement:
- Light-mode toggle (we are dark-only; DR5)
- Multi-layer / "Add layer" button (single LAYER 1; DR6)
- "Colors | Video" tab, "Upload" button, "Show source" toggle (dropped; DR10)
- New manifest params / new effects / multi-effect registry
- Mobile layout (< 768px blocked; parent §12)
- CSS-in-JS library, Tailwind, shadcn, design-system framework (DR3 + §8.8)
- Authentication, analytics, telemetry, feedback channel
- Copying pixelcrash's wordmark or branded assets (DR2)

---

## Tech Stack (unchanged from parent)

| Layer | Technology |
|---|---|
| Language | TypeScript 6 strict (`noUncheckedIndexedAccess`, `noImplicitOverride`) |
| Framework | React 19.2 |
| Build | Vite 8 (ESM, rolldown) |
| Package mgr | pnpm 10 |
| Linter/formatter | Biome 2.4 |
| Unit tests | Vitest 4.1 + jsdom 25 + vitest-canvas-mock + @testing-library/react |
| E2E | Playwright 1.59 + Chromium w/ fake Y4M webcam |
| Hand tracking | `@mediapipe/tasks-vision` 0.10.34 HandLandmarker |
| WebGL | ogl 1.0 |
| Params UI | **Custom React (replaces Tweakpane) — DR3** |
| Modulation | bezier-easing 2.1 (reused) |
| Font | **JetBrains Mono, self-hosted @ `/public/fonts/` — DR7** |
| Styling | **Plain CSS + CSS custom properties — DR8 / §8.8** |
| Deploy | Vercel w/ COOP `same-origin` + COEP `require-corp` + full CSP |
| Assets | MediaPipe model (7.5 MB) + 6 wasm files + new font files (~80 KB subset) |

Dependencies to REMOVE in final cleanup: `tweakpane`, `@tweakpane/core`, `@tweakpane/plugin-essentials` (all no longer imported).

---

## Skills Reference

Existing skills (read before relevant tasks):

| Skill | Use When |
|---|---|
| `hand-tracker-fx-architecture` | Every task — top-level orientation |
| `prp-task-ralph-loop` | Every task — Ralph protocol, 4-level validation |
| `mediapipe-hand-landmarker` | Engine-adjacent questions (read, don't modify) |
| `webcam-permissions-state-machine` | Restyling error / pre-prompt cards (Task DR-8.4) |
| `ogl-webgl-mosaic` | Understanding what Stage.tsx owns (read, don't modify) |
| `tweakpane-params-presets` | **Retiring** Tweakpane — reference for what we're replacing |
| `vite-vercel-coop-coep` | Font self-hosting + CSP adjustments (Task DR-6.2) |
| `playwright-e2e-webcam` | All L4 tests |
| `vitest-unit-testing-patterns` | All L2 tests |

NEW skills to author in Phase 7 of this rework:

| New Skill | Purpose |
|---|---|
| `design-tokens-dark-palette` | CSS custom properties system, semantic mapping of pixelcrash-inverted palette, fluid font-size clamp, spacing scale |
| `custom-param-components` | React components bound to `paramStore` — Button, Segmented, Slider, Toggle, ColorPicker, LayerCard, ModulationRow. Interaction patterns (square→pill hover, spring motion on toggle), testid conventions, reduced-motion handling |
| `jetbrains-mono-self-hosting` | Downloading, subsetting, @font-face wiring, preload strategy, CSP impact |

---

## Tools Reference

| Tool | Use For |
|---|---|
| Playwright MCP | Local + live browser testing, new E2E specs |
| context7 MCP | JetBrains Mono font API / CSS reference lookups |
| pnpm | Install/remove deps (removing tweakpane at end) |
| Biome | L1 lint + format |
| Vitest | L2 unit (component + logic) |
| Playwright | L4 E2E |

---

## Testing Methods

| Method | Tool | Description |
|---|---|---|
| L1 syntax/types | `pnpm biome check && pnpm tsc --noEmit` | Zero errors |
| L2 unit | `pnpm vitest run <paths>` | Per-component, per-hook, per-util |
| L3 integration | `pnpm build --mode test` | Full build + asset correctness |
| L4 E2E | `pnpm test:e2e --grep "Task DR-N.M:"` | Fake-webcam Playwright, user-emulating |
| Visual fidelity | Playwright screenshot compare | vs `reference-assets/pixelcrash-reference.png` + new `design-rework-reference.png` after each phase regression |

---

## Phase Overview (this orchestration)

| Phase | Goal | Tasks |
|---|---|---|
| DR-6: Foundation | Design tokens, font, CSS reset, existing UI survives | 4 |
| DR-7: Primitives | Custom React replacements for every Tweakpane control | 8 |
| DR-8: Chrome integration | Toolbar, sidebar, layer card, modulation card, error cards, retire Tweakpane | 8 |
| DR-9: Parent Phase-5 resume | 5.3 CI · 5.4 error-state E2E · 5.5 visual gate · 5.R final cut (re-executed on new UI) | 4 |
| **Total** | | **24** |

Phase numbers use `DR-N` prefix (Design Rework) to avoid collision with the parent project's Phase 1–5 numbering in PROGRESS.md.

---

## Phase DR-6: Foundation

**Goal**: Introduce the new design-token system and self-hosted font *without* breaking the current (Tweakpane) UI. The current chrome should keep working end-to-end after this phase — just rendered with the new font + updated tokens. This is the safety-net phase: we prove the plumbing before rebuilding anything.

### Task DR-6.1: Design tokens (CSS custom properties)
- **Objective**: Establish all color / spacing / type-size / radius / duration / easing tokens as CSS custom properties in a single `src/ui/tokens.css` file. Export a TypeScript `tokens.ts` mirror for programmatic access.
- **Dependencies**: Parent Phase 5.2 (Vercel deployed) — done.
- **Blocked by**: None.
- **Files**:
  - CREATE `src/ui/tokens.css` — `:root { --color-bg, --color-panel, --color-divider, ... --space-01 .. --space-56, --font-size-xs .. --font-size-xl, --radius-0, --radius-pill, --duration-fast .. --duration-long, --ease-default, --ease-spring }`
  - CREATE `src/ui/tokens.ts` — re-export tokens as TS constants for JS consumers (e.g., programmatic animation, inline styles)
  - EDIT `src/index.css` — import tokens.css FIRST, replace hardcoded hex values with `var(--color-…)`
- **Contracts**: Every downstream task references tokens by name (e.g., `var(--color-panel)`). Naming convention: `--color-<role>`, `--space-<rem×10>`, `--font-size-<t-shirt>`, `--radius-<t-shirt>|pill|0`, `--duration-<speed>`, `--ease-<name>`.
- **Acceptance Criteria**:
  - [ ] `src/ui/tokens.css` exports ≥ 30 custom properties matching DR5 palette + DR7 type scale + DR11 motion
  - [ ] `src/ui/tokens.ts` TS-exports the same value set as a typed record
  - [ ] `src/index.css`, `src/ui/Stage.css`, `src/ui/cards.css` refactored to use token vars (no hardcoded hex)
  - [ ] `grep -E '#[0-9a-fA-F]{3,6}' src/ui src/index.css` returns only `tokens.css` + favicon references
- **Testing**:
  - [ ] L1: biome + tsc green
  - [ ] L2: `tokens.test.ts` asserts all required token keys exist on the exported TS record
  - [ ] L4: existing E2E `phase-4-regression.spec.ts` still green — proves no visual regression in current UI
- **Skills**: `design-tokens-dark-palette` (to be authored first; see DR-6.0 sub-step), `prp-task-ralph-loop`

### Task DR-6.2: Self-host JetBrains Mono
- **Objective**: Download JetBrains Mono (Regular 400 + Medium 500 + SemiBold 600; italics optional), subset to Latin + Latin-Ext + basic punctuation, commit as woff2 files under `/public/fonts/`, declare `@font-face` in tokens.css, set `--font-family` token, preload 500 weight in `index.html`.
- **Dependencies**: DR-6.1 (token file exists).
- **Files**:
  - ADD `public/fonts/JetBrainsMono-{Regular,Medium,SemiBold}-subset.woff2` (≤ 30 KB each)
  - ADD `public/fonts/LICENSE.txt` (OFL-1.1)
  - EDIT `src/ui/tokens.css` — add `@font-face` declarations, set `--font-family: 'JetBrains Mono', ui-monospace, monospace`
  - EDIT `index.html` — `<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/JetBrainsMono-Medium-subset.woff2">`
  - EDIT `vercel.json` / `vite.config.ts` — add `Cache-Control: public, max-age=31536000, immutable` for `/fonts/*`
- **Contracts**: CSS consumers reference `font-family: var(--font-family)` or inherit from `body`. No direct font-file path references in code.
- **Acceptance Criteria**:
  - [ ] 3 woff2 files under `public/fonts/`, total < 90 KB
  - [ ] `index.html` preloads the Medium weight with `crossorigin` (COOP/COEP compliant)
  - [ ] CSP header unchanged (fonts served same-origin)
  - [ ] Body renders in JetBrains Mono in Playwright (test asserts computed `font-family`)
- **Testing**:
  - [ ] L1 green
  - [ ] L2: `fontLoading.test.ts` asserts `@font-face` rules exist after tokens.css import
  - [ ] L4: `DR-6.2: loads JetBrains Mono` — Playwright fetches `/fonts/JetBrainsMono-Medium-subset.woff2` with `transfer-encoding` check and `Cache-Control: immutable`; asserts `getComputedStyle(document.body).fontFamily` includes `JetBrains Mono`
- **Skills**: `jetbrains-mono-self-hosting` (author first), `vite-vercel-coop-coep`

### Task DR-6.3: Base reset + body baseline
- **Objective**: Minimal CSS reset (border-box, margin/padding 0, font inheritance) + body baseline that uses tokens (size, weight, line-height, letter-spacing, color, `-webkit-font-smoothing`).
- **Dependencies**: DR-6.1, DR-6.2.
- **Files**:
  - EDIT `src/index.css` — reset block + body baseline applying tokens
- **Acceptance Criteria**:
  - [ ] Body computed font-size matches `clamp(13px, 0.9vw, 16px)` at 1440px viewport
  - [ ] Body font-weight 500, letter-spacing `-0.01em`, color `var(--color-text-primary)`
  - [ ] Current chrome still renders (preset actions, record button, tweakpane still functional)
- **Testing**:
  - [ ] L1 + L2 green
  - [ ] L4: existing E2E aggregate passes; plus `DR-6.3: body uses token baseline` asserts computed styles
- **Skills**: `design-tokens-dark-palette`

### Task DR-6.R: Phase DR-6 Regression
- **Objective**: Confirm foundation-only phase doesn't break anything. All prior Phase 1–4 E2E specs still green. Body renders in new font + new palette. Tweakpane still works (it just looks slightly different because of the cascade, but is fully functional).
- **Dependencies**: DR-6.1, DR-6.2, DR-6.3.
- **Testing**:
  - [ ] L1 + L2 + L3 + L4 all green against `pnpm build --mode test && pnpm preview`
  - [ ] 45 Phase 1–4 aggregate E2E specs still pass
  - [ ] Playwright MCP manual walkthrough — take `reports/DR-6-regression/step-*.png` screenshots
  - [ ] Live deploy (preview URL via Vercel) — visual smoke-check
- **Skills**: `prp-task-ralph-loop`

---

## Phase DR-7: Primitives

**Goal**: Hand-built React components that subscribe to / mutate `paramStore` directly. Zero Tweakpane imports. Each primitive lives in `src/ui/primitives/`, has unit tests, and is usable in isolation before Phase DR-8 assembles them into the chrome.

### Task DR-7.1: `Button` primitive (square→pill hover)
- **Objective**: Polymorphic button with `variant: 'primary' | 'secondary' | 'text' | 'icon'`, `size: 'sm' | 'md'`. Implements DR11 square→pill border-radius animation via `::before` pseudo-element (matches pixelcrash CSS pattern). Respects `prefers-reduced-motion`.
- **Files**:
  - CREATE `src/ui/primitives/Button.tsx` + `Button.module.css`
  - CREATE `src/ui/primitives/Button.test.tsx` — renders variants, fires onClick, asserts reduced-motion class toggle
- **Acceptance Criteria**:
  - [ ] All 4 variants pass a11y (button role, keyboard-accessible, focus-visible ring)
  - [ ] Hover animates border-radius 0 → `var(--radius-pill)` over `var(--duration-fast)`
  - [ ] Disabled state: opacity 0.4, pointer-events none
- **Testing**: L1, L2 (8+ unit tests), L4 smoke via downstream consumer.
- **Skills**: `custom-param-components` (author first), `vitest-unit-testing-patterns`

### Task DR-7.2: `Segmented` primitive
- **Objective**: Typographic segmented control. N-option variant (2, 3, 5). Unselected `var(--color-text-muted)`, selected `var(--color-text-primary) + font-weight 600`. "/" separator between items rendered via `::before` on the radio input. Keyboard: ArrowLeft / ArrowRight cycles.
- **Files**:
  - CREATE `src/ui/primitives/Segmented.tsx` + `Segmented.module.css`
  - CREATE `src/ui/primitives/Segmented.test.tsx`
- **Contracts**: `<Segmented options={[{value, label}]} value={v} onChange={fn} />`. Binds to any paramStore key via caller.
- **Acceptance Criteria**:
  - [ ] 2/3/5-option rendering
  - [ ] "/" separator visible between items, not before first
  - [ ] ArrowLeft/Right cycles selection + fires onChange
  - [ ] Selected state: bold + primary color
- **Testing**: L1, L2 (10+ tests), L4 via consumer.
- **Skills**: `custom-param-components`

### Task DR-7.3: `Slider` primitive (single + range)
- **Objective**: Hairline track, thin vertical line thumb (2×16px), hover darkens. Range variant (two thumbs) shares CSS. Standalone — no noUiSlider dep. Keyboard: Arrow keys step by manifest `step`; PageUp/Down step by 10×.
- **Files**:
  - CREATE `src/ui/primitives/Slider.tsx` + `Slider.module.css`
  - CREATE `src/ui/primitives/Slider.test.tsx`
- **Contracts**: `<Slider min max step value onChange />` + `<RangeSlider min max step value={[lo,hi]} onChange />`. Works for both integer and number paramDefs.
- **Acceptance Criteria**:
  - [ ] Pointer drag updates value continuously
  - [ ] Keyboard increments by `step`; PageUp/Down by 10×
  - [ ] Touch-area is 32×32px even though visual thumb is 2×16px
  - [ ] Visible at all values 0 ≤ v ≤ max (no off-screen)
  - [ ] Range variant: thumbs can't cross
- **Testing**: L1, L2 (15+ tests including pointer + keyboard paths), L4 via consumer.
- **Skills**: `custom-param-components`, `vitest-unit-testing-patterns`

### Task DR-7.4: `Toggle` primitive (square ↔ circle morph)
- **Objective**: 20×20 square ON (radius 0, fill `--color-text-primary`) ↔ 20×20 circle OFF (radius 10, fill `--color-toggle-off`). Uses spring bezier `--ease-spring` on 0.35s. Inner SVG rotates −90° to morph an "X" into a "+".
- **Files**:
  - CREATE `src/ui/primitives/Toggle.tsx` + `Toggle.module.css`
  - CREATE `src/ui/primitives/Toggle.test.tsx`
- **Contracts**: `<Toggle checked onChange aria-label />`.
- **Acceptance Criteria**:
  - [ ] ARIA switch role, keyboard-operable (Space toggles)
  - [ ] Reduced-motion: animation disabled, instant state change
- **Testing**: L1, L2 (8+ tests), L4 via consumer (mirror toggle).
- **Skills**: `custom-param-components`

### Task DR-7.5: `ColorPicker` primitive
- **Objective**: 20×20 square swatch + hex-text input. Text input is borderless, uppercase-transform. Hex value binds to paramStore color key.
- **Files**:
  - CREATE `src/ui/primitives/ColorPicker.tsx` + `ColorPicker.module.css`
  - CREATE `src/ui/primitives/ColorPicker.test.tsx`
- **Acceptance Criteria**:
  - [ ] Native `<input type="color">` + text input share state
  - [ ] Invalid hex text keeps previous valid color (no rejection UI — just ignore)
  - [ ] Hover underlines text input
- **Testing**: L1, L2 (6+ tests), L4 via consumer.
- **Skills**: `custom-param-components`

### Task DR-7.6: `LayerCard` primitive (shell + collapsible)
- **Objective**: Card shell with `var(--color-panel)` bg, 20px padding, header row (title + optional action link) + divider hairline + section body. Optional `collapsible` prop with height/opacity transition (300ms height + 500ms opacity, per pixelcrash pattern). Used for LAYER 1 and the MODULATION card.
- **Files**:
  - CREATE `src/ui/primitives/LayerCard.tsx` + `LayerCard.module.css`
  - CREATE `src/ui/primitives/LayerCard.test.tsx`
- **Contracts**: `<LayerCard title action={React.ReactNode} collapsible?> <LayerSection> children </LayerSection> </LayerCard>`.
- **Acceptance Criteria**:
  - [ ] Divider hairline between header and body
  - [ ] Section rows separated by inner divider (optional prop)
  - [ ] Collapsible: clicking header chevron toggles; respects reduced-motion
- **Testing**: L1, L2 (10+ tests), L4 via consumer.
- **Skills**: `custom-param-components`

### Task DR-7.7: `useParam` hook + paramStore subscription bridge
- **Objective**: Ergonomic React hook that subscribes to a single `paramStore` key via `useSyncExternalStore`. Returns `[value, setValue]` tuple. Replaces the role Tweakpane's `addBinding` served.
- **Files**:
  - CREATE `src/ui/primitives/useParam.ts`
  - CREATE `src/ui/primitives/useParam.test.ts`
- **Contracts**: `const [tileSize, setTileSize] = useParam<number>('mosaic.tileSize')`. Type-safe via manifest-derived generics.
- **Acceptance Criteria**:
  - [ ] Re-renders only the consumer when its specific key changes (structural sharing preserved)
  - [ ] Updates paramStore when setter is called
  - [ ] StrictMode-safe (no double-subscription)
- **Testing**: L1, L2 (12+ tests — subscription, unsubscribe, StrictMode, concurrent updates), L4 via integration.
- **Skills**: `custom-param-components`, `vitest-unit-testing-patterns`

### Task DR-7.R: Phase DR-7 Regression
- **Objective**: All primitives unit-tested, visually renderable. Add a developer-only showcase route `/primitives` (dev-mode only) that renders all primitives side-by-side for manual QA.
- **Testing**:
  - [ ] L1 + L2 green (all unit tests)
  - [ ] L4: `DR-7.R: primitives showcase renders` — Playwright navigates to `/primitives` in dev mode, asserts all components visible
  - [ ] Manual screenshot: `reports/DR-7-regression/primitives-showcase.png`

---

## Phase DR-8: Chrome Integration

**Goal**: Assemble primitives into the final reworked chrome. Retire Tweakpane. Every pre-existing feature preserved.

### Task DR-8.1: `Toolbar` component
- **Objective**: Top toolbar with wordmark (left), cell-size picker (center), record button (right). Fixed-height row, tokens-driven.
- **Files**:
  - CREATE `src/ui/Toolbar.tsx` + `Toolbar.module.css`
  - CREATE `src/ui/CellSizePicker.tsx` (thin wrapper around `Segmented` binding XS/S/M/L/XL to `mosaic.tileSize`)
- **Acceptance Criteria**:
  - [ ] Wordmark "Hand Tracker FX" in JetBrains Mono 600 ~22px + flat glyph mark
  - [ ] Cell-size picker cycles tileSize between 4/8/16/32/64; clicking a bucket updates paramStore
  - [ ] Record button = existing `useRecorder` pipeline, restyled via `Button variant="primary"`
  - [ ] Testids: `toolbar`, `toolbar-wordmark`, `toolbar-cell-picker`, `record-button`
- **Testing**: L1, L2, L4 `DR-8.1: toolbar cell-picker updates tileSize`.
- **Skills**: `custom-param-components`, existing `hand-tracker-fx-architecture`

### Task DR-8.2: `Sidebar` + `LayerCard1` (wires all 14 params)
- **Objective**: Right sidebar hosting the LAYER 1 card with three inner sections (Grid / Mosaic / Input). Each section binds manifest params to primitives via `useParam`.
- **Files**:
  - CREATE `src/ui/Sidebar.tsx` + `Sidebar.module.css`
  - CREATE `src/ui/LayerCard1.tsx` — hardcoded for `handTrackingMosaic` (no generic multi-effect handling; DR6)
  - CREATE `src/ui/LayerSection.tsx` — groups controls under a sub-header
- **Acceptance Criteria**:
  - [ ] All 14 manifest params have a control (Slider / Segmented / Toggle / ColorPicker / Button)
  - [ ] Grid section: seed (slider), columns (slider), rows (slider), variance (slider), line color (picker), line weight (slider), Randomize (button)
  - [ ] Mosaic section: tile size (slider; same state as toolbar picker), blend opacity (slider), edge feather (slider), region padding (slider)
  - [ ] Input section: mirror (toggle), show landmarks (toggle), camera device (select — simple `<select>` for now, can upgrade later)
  - [ ] Testids preserved: `panel-root`, `params-panel` retained on sidebar root + layer-card body
  - [ ] Testids new: `layer-card-grid`, `layer-card-mosaic`, `layer-card-input`
- **Testing**: L1, L2, L4 `DR-8.2: all 14 params mutable via sidebar`.
- **Skills**: `custom-param-components`, `hand-tracker-fx-architecture`

### Task DR-8.3: `ModulationCard`
- **Objective**: Collapsible card below LAYER 1. Lists current `modulationStore` routes. Per-route inline controls replace the old Tweakpane folder. "+ Add route" button at bottom.
- **Files**:
  - CREATE `src/ui/ModulationCard.tsx` + `ModulationCard.module.css`
  - CREATE `src/ui/ModulationRow.tsx` — per-route inline controls
  - DELETE `src/ui/ModulationPanel.ts` (the old Tweakpane imperative builder)
- **Acceptance Criteria**:
  - [ ] Lists all current routes from `modulationStore.snapshot`
  - [ ] Per-route controls: enabled toggle, source dropdown (45+3 options), target param dropdown, input range slider, output range slider, curve dropdown (+ cubic-bezier mini editor for Cubic Bezier curve), delete link
  - [ ] Collapsed by default; chevron toggles
  - [ ] Testid: `modulation-card`, `modulation-route-${n}`
- **Testing**: L1, L2 (15+ unit tests), L4 `DR-8.3: modulation route drives tileSize`.
- **Skills**: `custom-param-components`

### Task DR-8.4: Restyled error + pre-prompt cards
- **Objective**: Replace `cards.css` with tokens-driven styling. Keep `role`, `aria-live`, testids, copy identical. Apply new palette + JetBrains Mono + hairline divider between title and body.
- **Files**:
  - EDIT `src/ui/cards.css`
  - Optionally EDIT `src/ui/PrePromptCard.tsx` + `ErrorStates.tsx` to add a divider `<hr>` between title and body (DR14)
- **Acceptance Criteria**:
  - [ ] All 8 camera-state cards render in the new palette
  - [ ] All existing E2E (8 error-state specs) still pass
  - [ ] `error-state-card-${state}` testids unchanged
- **Testing**: L1, L2 (existing), L4 `DR-8.4: all 8 error states restyled`.
- **Skills**: `webcam-permissions-state-machine`

### Task DR-8.5: Preset strip in sidebar header
- **Objective**: Merge current fixed `PresetBar` (bottom-center) and fixed `PresetActions` (top-left) into one preset strip at the top of the sidebar: `[‹] Preset Name [›] [Save] [Save As] [Delete] [↓] [↑]`.
- **Files**:
  - EDIT `src/ui/Sidebar.tsx` — host the strip
  - CREATE `src/ui/PresetStrip.tsx` (merges old `PresetBar` + `PresetActions` code paths)
  - DELETE `src/ui/PresetBar.tsx` + `src/ui/PresetActions.tsx` (after porting logic)
- **Acceptance Criteria**:
  - [ ] ArrowLeft/Right cycles preset (keyboard behavior preserved)
  - [ ] All preset file I/O (Save/SaveAs/Delete/Export/Import) works
  - [ ] Testids preserved: `preset-bar`, `preset-name`, `preset-actions`
- **Testing**: L1, L2 (merged from old files), L4 `DR-8.5: preset strip keyboard + actions`.
- **Skills**: `custom-param-components`, `hand-tracker-fx-architecture`

### Task DR-8.6: Wire `App.tsx` to new chrome, retire Tweakpane
- **Objective**: Replace App.tsx composition to render `<Toolbar> + <Stage> + <Sidebar>`. Delete `Panel.tsx` + `buildPaneFromManifest.ts`. Remove tweakpane deps from `package.json`. Update `main.tsx` to seed stores without the Tweakpane scaffolding.
- **Files**:
  - EDIT `src/App.tsx`
  - EDIT `src/main.tsx`
  - DELETE `src/ui/Panel.tsx`
  - DELETE `src/engine/buildPaneFromManifest.ts`
  - EDIT `package.json` — remove `tweakpane`, `@tweakpane/core`, `@tweakpane/plugin-essentials`
  - EDIT `pnpm-lock.yaml`
- **Acceptance Criteria**:
  - [ ] `grep -r 'tweakpane' src/` returns 0 hits
  - [ ] App renders in new chrome
  - [ ] All 45 prior Phase 1–4 E2E specs pass
- **Testing**: L1, L2, L3, L4 aggregate.
- **Skills**: `hand-tracker-fx-architecture`, `tweakpane-params-presets` (reference only, for retirement)

### Task DR-8.7: Footer
- **Objective**: Small bottom-row footer with version + credit. Hidden on error/pre-prompt screens.
- **Files**:
  - CREATE `src/ui/Footer.tsx` + `Footer.module.css`
  - EDIT `src/App.tsx` — render footer only when camera state is `GRANTED`
- **Acceptance Criteria**:
  - [ ] Renders `hand-tracker-fx v0.1.0 ······ Built with MediaPipe, ogl, React`
  - [ ] `color: var(--color-text-muted)`
  - [ ] Hidden when any error card is rendered
- **Testing**: L1, L2 (2 tests), L4 `DR-8.7: footer visible post-GRANTED`.
- **Skills**: `hand-tracker-fx-architecture`

### Task DR-8.R: Phase DR-8 Regression — Visual fidelity gate
- **Objective**: Complete user-journey E2E walkthrough on the new chrome. Capture reference screenshot for future visual-fidelity gates.
- **Dependencies**: All DR-8.x complete.
- **Testing**:
  - [ ] L1 + L2 + L3 + L4 all green
  - [ ] 45 aggregate Phase 1–4 E2E specs still pass
  - [ ] New `tests/e2e/DR-8-regression.spec.ts` — walkthrough: GRANTED → cell-picker M→XL updates mosaic → adjust grid.widthVariance slider → add modulation route mapping landmark[8].x → mosaic.tileSize → Save As preset → cycle via chevron → ArrowLeft returns → Record → .webm downloads → reduced-motion pauses modulation → zero console errors
  - [ ] Capture `reports/DR-8-regression/design-rework-reference.png` — this becomes the new visual-fidelity reference for Phase DR-9.3 (parent 5.5) and future work
  - [ ] Ralph-loop report: `reports/DR-8-regression.md`

---

## Phase DR-9: Parent Phase-5 Resume

**Goal**: Execute the parent project's remaining Phase-5 tasks on top of the reworked chrome.

### Task DR-9.1: Parent 5.3 — CI pipeline
- **Objective**: Wire GitHub Actions to run L1 + L2 + L3 + L4 on every PR + push to main. Fail on any red level.
- **Files**:
  - CREATE `.github/workflows/ci.yml`
- **Acceptance Criteria**:
  - [ ] Workflow runs biome + tsc + vitest + build + e2e on ubuntu-latest, node 25
  - [ ] Caches pnpm + playwright browsers
  - [ ] Status check required for merge to main
- **Testing**: L1–L4 re-run in CI on a test PR.
- **Skills**: existing parent project skills

### Task DR-9.2: Parent 5.4 — Error-state E2E (forced failures)
- **Objective**: Playwright specs that force each of the 8 camera states (via `context.grantPermissions`, `context.clearPermissions`, mocking MediaDevices errors, stubbing WebGL loss, mocking fetch for model-load failure). Each test asserts the correct restyled card renders.
- **Files**:
  - CREATE `tests/e2e/error-states.spec.ts` — 8 specs (one per state)
- **Acceptance Criteria**:
  - [ ] Each of PROMPT, USER_DENIED, SYSTEM_DENIED, DEVICE_CONFLICT, NOT_FOUND, MODEL_LOAD_FAIL, NO_WEBGL has a spec (plus GRANTED happy-path)
  - [ ] Each spec forces the failure, asserts the right `error-state-card-*` testid visible, the title text, the retry button where applicable
- **Testing**: L4 runs 8 new specs.
- **Skills**: `webcam-permissions-state-machine`, `playwright-e2e-webcam`

### Task DR-9.3: Parent 5.5 — Visual-fidelity gate
- **Objective**: Playwright screenshot-comparison spec that captures the app at canonical viewport (1440×900) on a default preset and compares against `reports/DR-8-regression/design-rework-reference.png`. Pass threshold: ≤ 2% pixel diff.
- **Files**:
  - CREATE `tests/e2e/visual-fidelity.spec.ts`
- **Acceptance Criteria**:
  - [ ] Runs in CI on live preview deploy
  - [ ] Fails on > 2% diff; produces diff artifact
- **Testing**: L4 on the live Vercel deploy.
- **Skills**: `playwright-e2e-webcam`

### Task DR-9.R: Final cut — tag v0.1.0, changelog, archive
- **Objective**: Tag git `v0.1.0`, write `CHANGELOG.md`, archive orchestration folders, update PROGRESS.md + CLAUDE.md to reflect the rework landmark.
- **Files**:
  - CREATE `CHANGELOG.md`
  - EDIT `PROGRESS.md` — mark all DR-* + 5.3–5.R complete
  - EDIT `CLAUDE.md` — add reference to the design-rework orchestration folder + historical-reference note
  - Move `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png` → `…/reference-assets/_historical/`
- **Acceptance Criteria**:
  - [ ] Git tag `v0.1.0` on main
  - [ ] Live URL shows reworked UI
  - [ ] PROGRESS.md reflects all tasks done
  - [ ] CHANGELOG.md has an entry for "v0.1.0 — pixelcrash-inspired design rework"
- **Testing**: Manual verify + Playwright live-URL smoke.

---

## Dependency Graph

```
DR-6.1 ─┬─> DR-6.2 ─> DR-6.3 ─> DR-6.R
        │                           │
        └─────────────────────────────────────> DR-7.1
                                    │            DR-7.2
                                    │            DR-7.3          (parallel)
                                    │            DR-7.4
                                    │            DR-7.5
                                    │            DR-7.6
                                    │            DR-7.7
                                    │              │
                                    │              v
                                    │            DR-7.R
                                    │              │
                                    │              v
                                    │            DR-8.1 ─> DR-8.6
                                    │            DR-8.2 ─> DR-8.6
                                    │            DR-8.3 ─> DR-8.6
                                    │            DR-8.4 (parallel)
                                    │            DR-8.5 ─> DR-8.6
                                    │                          │
                                    │                          v
                                    │                       DR-8.7 ─> DR-8.R
                                    │                                   │
                                    │                                   v
                                    │                                DR-9.1, 9.2, 9.3 (parallel) ─> DR-9.R
                                    │
                                    v
                                  (tokens available to every downstream task)
```

Phase DR-7 primitives can be parallelized across 7 subagents (each primitive independent). Phase DR-9 1/2/3 can parallelize across 3 subagents.

---

## Task Execution Protocol

Inherits from parent `prp-task-ralph-loop` skill. Every task:
1. **Orient** — read the task file, relevant skills, `DISCOVERY.md`, `PROGRESS.md`
2. **Plan** — explore codebase
3. **Implement** — feature branch `task/DR-N-M-<short-desc>`
4. **Test** — L1 → L2 → L3 → L4, root-cause fix failures, update `.claude/prp-ralph.state.md` each Ralph iteration
5. **Complete** — update PROGRESS.md, commit per parent Git Workflow, fast-forward merge to `main`

Every commit message prefix: `Task DR-N.M: <description>`.
Every commit ends with `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>` (preserving parent convention).

---

## Final Artifacts (Phase 12 of the m2c1 framework)

Written by the main agent after PHASES.md is accepted:
- `reports/` — phase regression reports landed by Ralph loops
- `PROGRESS.md` (root) — DR-* task rows appended; parent Phase 5.3–5.R rows marked pending until DR-9 resumes them
- `START.md` (this orchestration folder) — orchestrator protocol for per-task subagents
- `CLAUDE.md` — add a short pointer to this orchestration folder under a new "Design Rework" section
