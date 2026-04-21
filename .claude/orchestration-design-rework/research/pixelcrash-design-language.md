# pixelcrash.xyz — Design Language Reference

**Version of site analyzed:** pixelCrash v1.1  
**Creator credit in footer:** by [@van_der_ex](https://www.instagram.com/van_der_ex/)  
**Date of analysis:** 2026-04-19  
**Sources:**
- Raw HTML: `https://pixelcrash.xyz` (direct `curl` of HTML)
- CSS source: `https://pixelcrash.xyz/bundle.min.css` (complete, unobfuscated)
- Reference screenshot: `.claude/orchestration-design-rework/reference-assets/pixelcrash-reference.png`
- everywhere.tools listing: `https://everywhere.tools/projects/pixelcrash`
- Instagram post: `https://www.instagram.com/p/DTavh3tl1wK/`
- JetBrains Mono landing: `https://www.jetbrains.com/lp/mono/`

---

## Overview

pixelCrash is a browser-based video-to-mosaic/ASCII effect tool built on p5.js. It converts uploaded or live video into layered pixel-art effects, where each "layer" maps a brightness range to a cell style and symbol set. The UI is a **minimal, light-mode, monospaced design** — no dark mode, no shadows, no gradients (except as scroll-fade utilities). It reads as a design-tool instrument panel: sparse, precise, technical-geometric. The entire interface is a single-page app with no navigation.

The aesthetic is closest to: Vercel dashboard typography + Linear's density + a hand-built CSS framework with explicit token names. It is **not** using Tailwind, shadcn, or any component library. All CSS is bespoke.

---

## Color Tokens

All values are sourced directly from `bundle.min.css` `:root {}` block. The site uses **no dark mode**. The `--rgb` variable is a semantic primitive that flips between `--rgb-black` and `--rgb-white` depending on mode, but only light mode is implemented.

### Primitive Scale

| Token | Value | Hex Approximation | Role |
|---|---|---|---|
| `--color-black` | `hsl(0, 0%, 2%)` | `#050505` | Primary text, primary button BG, icon fill, selected toggle, slider handle/track |
| `--color-white` | `hsl(0, 0%, 100%)` | `#FFFFFF` | Page background, primary button text, scroll-fade base |
| `--color-grey-94` | `hsl(0, 0%, 94%)` | `#F0F0F0` | Layer card / panel background |
| `--color-grey-86` | `hsl(0, 0%, 86%)` | `#DBDBDB` | Secondary button background (Upload), dividers (`panel-divider`), slider track base color |
| `--color-grey-82` | `hsl(0, 0%, 82%)` | `#D1D1D1` | Secondary button hover background |
| `--color-grey-64` | `hsl(0, 0%, 64%)` | `#A3A3A3` | Unselected segmented-item text, text-button color, slider "/" separator character |
| `--color-grey-56` | `hsl(0, 0%, 56%)` | `#8F8F8F` | Footer / info text, muted body copy |
| `--color-grey-48` | `hsl(0, 0%, 48%)` | `#7A7A7A` | `.toggle-btn.off` background (inactive toggle square) |
| `--color-grey-40` | `hsl(0, 0%, 40%)` | `#666666` | Hover state for sliders and connected track |
| `--color-grey-32` | `hsl(0, 0%, 32%)` | `#525252` | Active/hover on slider handles and connects |
| `--color-grey-20` | `hsl(0, 0%, 20%)` | `#333333` | (Reserved, not observed in use in CSS) |

### Opacity Utility Tokens (rgba black)

| Token | Value |
|---|---|
| `--op-gray-10` | `rgba(0,0,0,0.1)` |
| `--op-gray-20` | `rgba(0,0,0,0.2)` |
| … | … |
| `--op-gray-90` | `rgba(0,0,0,0.9)` |

These are defined but not used in the primary UI — likely used in p5 canvas logic.

### Derived Semantic Mapping

| Role | Token | Hex |
|---|---|---|
| Page / app background | `--color-white` | `#FFFFFF` |
| Panel / card surface | `--color-grey-94` | `#F0F0F0` |
| Panel divider / hairline | `--color-grey-86` | `#DBDBDB` |
| Primary text | `--color-black` | `#050505` |
| Muted / secondary text | `--color-grey-56` | `#8F8F8F` |
| Disabled / hint text | `--color-grey-64` | `#A3A3A3` |
| Primary button BG | `--color-black` | `#050505` |
| Primary button text | `--color-white` | `#FFFFFF` |
| Secondary button BG | `--color-grey-86` | `#DBDBDB` |
| Secondary button hover | `--color-grey-82` | `#D1D1D1` |
| Segmented unselected | `--color-grey-64` | `#A3A3A3` |
| Segmented selected | `--color-black` | `#050505` + weight 600 |
| Toggle ON fill | `--color-black` | `#050505` |
| Toggle OFF fill | `--color-grey-48` | `#7A7A7A` |
| Slider track | `--color-grey-82` | `#D1D1D1` |
| Slider active range | `--color-black` | `#050505` |
| Slider handle | `--color-black` | `#050505` |
| Slider hover state | `--color-grey-32` | `#525252` |
| Text selection BG | `--color-black` | `#050505` |
| Text selection color | `--color-grey-82` | `#D1D1D1` |

**Accent color: none.** There is no brand accent color — the single "accent" is black itself used in primary actions. No blue, no green, no red in the design system (user-supplied hex color chips in layer cells are the only color).

**Screenshot cross-reference (reference-assets/pixelcrash-reference.png):** The screenshot confirms:
- White page background, ~#F0F0F0 layer card panels
- Black logo square (solid filled rectangle)
- Upload button: light gray pill with dark text
- Record button: solid black pill with white "⏺ Record" text
- "Delete" link in layer header: small, muted color
- Layer card color chips: small filled squares in colors like `#E5E5E5`, `#AAAAAA`, `#4E6e6` (user-set values, not design tokens)

---

## Typography

### Font Loading (from `<head>`)

```html
<link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@100..800&display=swap" rel="stylesheet">
```

Both fonts are loaded but **JetBrains Mono is the active UI font** — it is set as `--font-family` in CSS:

```css
--font-family: "JetBrains Mono", monospace;
```

Geist Mono is loaded but **not assigned in any CSS rule** visible in `bundle.min.css`. It may be used for user-editable symbol text fields or was a development remnant. The reference screenshot's text appearance is consistent with JetBrains Mono.

### JetBrains Mono: Design Characteristics

- **Classification:** Technical-geometric monospaced. Minimal stroke contrast (near-monolinear). "Radical cut at the end of strokes" gives a strict, mechanical personality.
- **X-height:** Intentionally tall relative to cap height — very high lowercase visibility at small sizes.
- **Stroke:** Clean, no serifs, no unnecessary flourishes. Designed for screen rendering at small sizes.
- **Weights available:** 100 (Thin) → 200 → 300 (Light) → 400 (Regular) → 500 (Medium) → 600 (SemiBold) → 700 (Bold) → 800 (ExtraBold).
- **Ligatures:** Yes, code-specific ligatures are a feature but are not needed in the UI context.
- Source: [JetBrains Mono landing page](https://www.jetbrains.com/lp/mono/)

### Type Scale (from CSS tokens)

The root font-size is a fluid clamp: `clamp(9px, 0.667vw, 13px)`. This means all `rem` values are relative to a fluid base between 9px–13px depending on viewport width. Computed pixel values below assume the **clamp midpoint of ~11px** for reference, but the design scales proportionally.

| Token | `rem` value | Approx px (at 11px base) | Usage |
|---|---|---|---|
| `--font-size-xs` | `1.15rem` | ~12.7px | Footer / info text (`info-text-*`) |
| `--font-size-s` | `1.2rem` | ~13.2px | Small labels |
| `--font-size-m` | `1.3rem` | ~14.3px | **Body default** (`body` rule) |
| `--font-size-l` | `1.5rem` | ~16.5px | Medium emphasis |
| `--font-size-xl` | `2rem` | ~22px | Logo text (`pixelCrash` wordmark) |
| `--font-size-t2` | `2.4rem` | ~26.4px | Sub-heading (unused in current UI) |
| `--font-size-t1` | `2.8rem` | ~30.8px | Display (unused in current UI) |

### Body Typography Rules

```css
body {
  font-family: var(--font-family), monospace;  /* JetBrains Mono */
  font-size: var(--font-size-m);               /* 1.3rem */
  font-weight: 500;                            /* Medium — heavier than regular */
  line-height: var(--space-20);               /* 2.0rem ~22px */
  letter-spacing: -0.01em;                    /* slight tightening */
  color: var(--color-black);
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}
```

Key observations:
- **Default weight is 500 (Medium), not 400.** The UI reads as slightly heavier than typical body text, which is intentional for dense-information interfaces.
- **letter-spacing: -0.01em** — very slight tightening, consistent with modern geometric sans conventions at UI sizes. Counterintuitive for a mono font but correct here.
- **antialiased smoothing** — thinner/crisper rendering on Mac.
- **geometricPrecision** text rendering — pixel-level precision over legibility, appropriate for technical UI.

### Weight Usage Observed

| Weight | Where used |
|---|---|
| 500 (Medium) | Default body, control labels, most UI text |
| 600 (SemiBold) | Logo (`pixelCrash` wordmark), panel header titles (`LAYER N`), segmented selected state |

---

## Layout & Spacing

### Space Token Scale (from CSS)

All spacing is in `rem` relative to the fluid root. The scale uses names `--space-NN` where NN is the rem×10 value:

| Token | Value | Approx px (11px base) |
|---|---|---|
| `--space-01` | `0.1rem` | ~1.1px — used for panel divider height |
| `--space-02` | `0.2rem` | ~2.2px — slider track height, divider margin |
| `--space-04` | `0.4rem` | ~4.4px — color picker padding, segmented item padding |
| `--space-06` | `0.6rem` | ~6.6px — symb-text-field padding |
| `--space-08` | `0.8rem` | ~8.8px — logo gap, cell-size gap, segmented gap, toggle-btn gap |
| `--space-10` | `1.0rem` | ~11px — toggle-btn on hover border-radius |
| `--space-12` | `1.2rem` | ~13.2px — header-buttons gap, segmented "/" separator offset |
| `--space-14` | `1.4rem` | ~15.4px |
| `--space-16` | `1.6rem` | ~17.6px — panel gap between sections, slider touch-area |
| `--space-20` | `2.0rem` | ~22px — line-height, layer panel padding, logo-icon size, toggle-btn size, color-picker size |
| `--space-22` | `2.2rem` | ~24.2px — button hover border-radius (full pill) |
| `--space-24` | `2.4rem` | ~26.4px — header padding, header-leading height (36→ 3.6rem), section gaps |
| `--space-28` | `2.8rem` | ~30.8px |
| `--space-32` | `3.2rem` | ~35.2px — header gap, info-block gaps |
| `--space-36` | `3.6rem` | ~39.6px — header height, header-leading height |
| `--space-40` | `4.0rem` | ~44px |
| `--space-44` | `4.4rem` | ~48.4px — standard button height, scroll-wrapper fade height |
| `--space-48` | `4.8rem` | ~52.8px — preview-area gap |
| `--space-56` | `5.6rem` | ~61.6px — color-picker-input width |

### Grid / Page Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HEADER (.header)  flex-row  padding: 2.4rem  gap: 3.2rem  h: 3.6rem   │
│  [logo-group]   [cell-size + source tabs]        [upload btn][rec btn] │
├──────────────────────────────────────┬──────────────────────────────────┤
│  PREVIEW AREA (.preview-area)        │  SIDEBAR (.sidebar)             │
│  flex: 8 1 0   min-w: 0             │  flex: 3 1 0  min-w: 340px      │
│                                      │                                  │
│  [canvas-wrapper]                    │  [scroll-container]              │
│    [canvas-container]                │    [layer-panel] × N            │
│    max: 1080×720px                   │    [+ Add layer btn]            │
│                                      │                                  │
│  [info footer row]                   │                                  │
│    copyright | pause hint | credit   │                                  │
└──────────────────────────────────────┴──────────────────────────────────┘
MAIN (.main-section): padding 0 2.4rem 2.4rem, gap: 2.4rem, white BG
APP SHELL (.app-shell): flex-col, gap: 0.8rem, height: 100vh
```

### Corner Radii

**Most elements have NO border-radius.** This is a deliberate design choice.

| Element | Radius |
|---|---|
| Buttons (default) | `0rem` (square corners) |
| Buttons (on hover) | `2.2rem` (full pill — animates from 0 to pill on hover) |
| Logo icon square | `0rem` (sharp square) |
| Slider track/handle | `0rem` |
| Toggle buttons | `0rem` default → `1.0rem` on hover (rounds to circle) |
| Color picker swatch | `0rem` |
| Layer panel | `0rem` (implied — no border-radius on `.layer-panel`) |
| Text selection | N/A (uses background only) |

The **hover-animation from 0→pill radius** is the signature interaction: buttons start square and round to pill on hover. This is a distinctive motion pattern. Duration: `--duration-short: 0.2s`.

### Borders

The site uses **no CSS `border` properties on panels or layout elements**. Separation is achieved via background-color differences:
- White page → Grey-94 panel creates a surface distinction without a border.
- The `panel-divider` element is a `height: 0.1rem` (`--space-01`) div with `background-color: --color-grey-86`. This is the only visible divider.

**There are no `1px solid` borders on cards, panels, inputs, or buttons.** The screenshot confirms this — panels appear as floating color-blocks without stroke.

---

## Components

### 1. Logo / Wordmark

```
[■] pixelCrash
```

- `[■]` = `.logo-icon` — a `2.0rem × 2.0rem` solid black square (`background-color: --color-black`). Zero border-radius. Functions as a logomark.
- `pixelCrash` = `<span>` inside `.logo-group` — `font-size: 2.0rem`, `font-weight: 600`, `padding-bottom: 0.4rem`.
- Gap between icon and text: `0.8rem`.
- The `®` symbol appears only in the footer info text, not in the header.

### 2. Header Toolbar

```
[■ pixelCrash]  [Cells: ——XS / S / M / L / XL]  [Colors | Video]  [↑ Upload] [⏺ Record]
```

CSS structure:
```
.header
  .header-leading          (flex: 8 1 0, height: 3.6rem)
    .logo-group            (flex: 0 0 auto)
    .source-management-block
      [cell-size-control / slider area]
      [source tab group: Colors | Video]
  .header-buttons          (flex: 1 1 0, min-width: 240px, gap: 1.2rem)
    #upload-btn            (button.secondary)
    #record-btn            (button.primary)
```

The reference screenshot shows the header contains:
- Logo left-anchored
- "Cells:" label + a slider + segmented XS/S/M/L/XL options (or a combined slider+label row)
- "Colors" and "Video" as a tab-style segmented control (two options)
- Upload and Record buttons right-anchored

### 3. Buttons

Two button variants, both using the `::before` pseudo-element as the colored background (z-index: -1 behind text).

**Primary button** (Record):
```css
button.primary {
  color: var(--color-white);
}
button.primary::before {
  background-color: var(--color-black);  /* #050505 */
  border-radius: 0rem;
}
button.primary:hover::before {
  border-radius: var(--space-22);  /* 2.2rem = full pill */
}
```
- Height: `3.6rem` (in header context, `.header-buttons > button`)
- Standard height: `4.4rem` (`--space-44`)
- Contains: `⏺ Record` (unicode circle + text)

**Secondary button** (Upload):
```css
button.secondary {
  color: var(--color-black);
}
button.secondary::before {
  background-color: var(--color-grey-86);  /* #DBDBDB */
}
button.secondary:hover::before {
  background-color: var(--color-grey-82);  /* #D1D1D1 */
  border-radius: var(--space-22);          /* pill */
}
```

**Text button** (Delete link in layer header):
```css
button.text-button {
  height: auto;
  padding: 0 0.4rem;
  color: var(--color-grey-64);  /* #A3A3A3 */
  transition: color 0.1s;
}
button.text-button:hover {
  color: var(--color-black);
  border-radius: 2.4rem;
}
```

**Disabled state:** `opacity: 0.4`, `pointer-events: none`.

**Animation:** The border-radius animation uses `cubic-bezier` default (`ease`) with `--duration-short: 0.2s`. The background-color transition has an extra `0.1s` delay: `transition: background-color 0.2s ease 0.1s`. This means the shape rounds first (instant), then the color fades — creating a subtle sequence.

### 4. Segmented Controls (Radio Group)

The segmented control is a custom radio-button group with no background track — options appear as space-separated text items with "/" separators.

```
Below / Between / Above
```

HTML pattern:
```html
<div class="segmented">
  <label class="segmented-item">
    <input type="radio" name="…">
    <span>Below</span>
  </label>
  <label class="segmented-item">
    <input type="radio" name="…">
    <span>Between</span>
  </label>
  <label class="segmented-item">
    <input type="radio" name="…">
    <span>Above</span>
  </label>
</div>
```

CSS behavior:
```css
.segmented {
  display: flex;
  gap: 1.6rem;  /* --space-16 — gap between items */
}
.segmented-item span {
  color: var(--color-grey-64);  /* unselected: #A3A3A3 */
  padding: 0 0.4rem;
  transition: color 0.1s;
}
.segmented-item span:hover {
  color: var(--color-black);
}
.segmented-item:has(input:checked) span {
  color: var(--color-black);
  font-weight: 600;  /* selected: black + semibold */
}
/* The "/" separator is rendered via input::before pseudo-element */
.segmented input::before {
  content: "/";
  position: absolute;
  transform: translateX(-1.2rem);  /* positioned to the left */
  color: var(--color-grey-64);
}
.segmented-item:first-child input::before {
  content: none;  /* no separator before first item */
}
```

**Variants observed in screenshot:**
- 2-option: `Below / Above` (for Cells type)
- 3-option: `Below / Between / Above` (for Range Mapping)
- 5-option: `XS / S / M / L / XL` (for cell size in header)

**There is no pill/track background** on the segmented control. Selected state is purely typographic (color + weight change). This is starkly minimal.

### 5. Layer Panel / Card

```
┌─────────────────────────────────────────────────────┐
│ LAYER 1                                      Delete │  ← .panel-header .layer-header
├─────────────────────────────────────────────────────┤  ← .panel-divider (0.1rem line)
│ Mapping          Brightness / Edge                  │  ← .control-row (segmented)
├─────────────────────────────────────────────────────┤  ← .panel-divider
│ Range            Below / Between / Above            │  ← .control-row (segmented)
│                  [————————————————————]             │  ← .slider-row (noUiSlider)
│                  200        255                     │
├─────────────────────────────────────────────────────┤
│ Cells     Sample  Solid   [#E5E5E5 ■]              │  ← .control-row with color-picker
│ Symbols   #0/MASK_INI     [#AAAAAA ■]              │  ← .control-row with symb-text-field
└─────────────────────────────────────────────────────┘
```

CSS:
```css
.layer-panel {
  display: flex;
  flex-direction: column;
  gap: 1.6rem;               /* between sections */
  padding: 2.0rem;           /* all sides */
  background-color: var(--color-grey-94);  /* #F0F0F0 */
  overflow: hidden;
  /* Animate open/close: */
  transition: height 0.3s ease, gap 0.3s ease;
}
.panel-header.layer-header {
  height: 2.0rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-title-group {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.8rem;
  font-weight: 600;
}
.panel-divider {
  width: 100%;
  height: 0.1rem;            /* hairline */
  background-color: var(--color-grey-86);  /* #DBDBDB */
  margin: 0.2rem 0;
}
.control-row {
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;
}
```

The layer panel height animates — it can collapse/expand (the `will-change: height` and transition confirm this). When collapsed, `gap` also transitions to 0.

The layer number appears as `LAYER 1`, `LAYER 2`, etc. (observed in screenshot — all caps styling). The CSS uses `font-weight: 600` in `.header-title-group` — the uppercase rendering is either CSS `text-transform: uppercase` applied in JS or the text content itself is uppercase.

### 6. Range Slider (noUiSlider)

The slider is built with noUiSlider library, heavily restyled:

```css
/* Track */
.noUi-connects {
  height: 0.2rem;                          /* 2px-equivalent hairline */
  background: var(--color-grey-82);        /* #D1D1D1 unselected */
}
.noUi-connect {
  height: 0.2rem;
  background: var(--color-black);          /* #050505 filled range */
}
/* Handle (thumb) */
.noUi-handle {
  width: 0.2rem;                           /* thin vertical line, not a circle */
  height: 1.6rem;
  background: var(--color-black);
  border: none;
  border-radius: 0;                        /* square, no circle */
  box-shadow: none;
}
/* Hover state */
.noUi-base:hover .noUi-connect,
.noUi-base:hover .noUi-handle {
  background: var(--color-grey-32) !important;  /* #525252 */
}
```

The slider thumb is a **thin vertical line (`0.2rem` wide × `1.6rem` tall)**, not a circle. This is a very distinctive design choice. The touch target is expanded via `.noUi-touch-area` to `3.2rem` wide.

For the range slider (two handles), the "from-center" variant hides the lower handle: `.from-center .noUi-handle[data-handle="0"] { display: none }`.

### 7. Toggle Button (Layer Section Visibility)

```css
button.toggle-btn {
  width: 2.0rem;
  height: 2.0rem;
  padding: 0;
  background-color: transparent;
}
button.toggle-btn::before {
  background-color: var(--color-black);   /* ON state: black square */
  border-radius: 0rem;
}
button.toggle-btn:hover::before {
  border-radius: 1.0rem;                  /* rounds to circle on hover */
}
button.toggle-btn.off::before {
  background-color: var(--color-grey-48); /* OFF state: #7A7A7A grey */
  border-radius: 1.0rem;                  /* already rounded when off */
}
button.toggle-btn.off:hover::before {
  background-color: var(--color-black);   /* hover over off → black preview */
}
```

Inside the toggle is an SVG "X" icon (`.svg-x-icon`, `1.0rem × 1.0rem`). When the toggle is `.off`:
- The icon rotates -90°: `transform: rotate(-90deg)` — becomes a "+" shape suggesting "add/expand"
- The horizontal bar scales to 0: `.off .hor { transform: scaleX(0) }`
- Animation uses the spring bezier: `cubic-bezier(0.47, 0, 0.23, 1.38)` with `--duration-medium: 0.35s`

### 8. Color Picker Group

```html
<div class="color-picker-group">
  <input class="color-picker-input" type="text" value="#E5E5E5">
  <input class="color-picker" type="color" value="#e5e5e5">
</div>
```

```css
.color-picker-group {
  width: 9.2rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 0.8rem;
}
.color-picker-input {
  width: 5.6rem;
  height: 2.0rem;
  background-color: transparent;
  text-transform: uppercase;  /* #E5E5E5 */
  cursor: text;
}
input.color-picker {
  width: 2.0rem;
  height: 2.0rem;
  border: none;
  border-radius: 0;  /* SQUARE swatch */
  cursor: pointer;
}
input.color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 0;
  padding: 0;
}
```

The color swatch is a `2.0rem × 2.0rem` filled square with zero border-radius. The hex value text field is editable inline and shows the hex string in uppercase (e.g. `#E5E5E5`). Both appear in a right-aligned group.

### 9. Symbol Text Field

```css
.symb-text-field {
  width: 12rem;
  height: 2.0rem;
  padding: 0 0.6rem;
  background-color: transparent;
  cursor: text;
  text-transform: uppercase;
}
.symb-text-field:hover {
  text-decoration: underline;
}
.symb-text-field:focus {
  outline: none;
}
```

This is an inline editable field for the symbol character set (e.g. `#0/MASK_INI`, `# 0 /M45K_I`). No border, no background, no focus ring — just text that underlines on hover. Very minimal.

### 10. Scroll Wrapper / Sidebar Fade

The sidebar uses a scroll-fade mask pattern:
```css
.scroll-wrapper::before {  /* fade top */
  background: linear-gradient(to bottom, var(--color-white) 0%, transparent 100%);
  opacity: 0;
}
.scroll-wrapper::after {  /* fade bottom */
  background: linear-gradient(to top, var(--color-white) 0%, transparent 100%);
  opacity: 0;
}
.scroll-wrapper.can-scroll-up::before { opacity: 1; }
.scroll-wrapper.can-scroll-down::after { opacity: 1; }
```
White-to-transparent fade, 4.4rem tall, revealing scroll availability. Scrollbar is hidden (`scrollbar-width: none`).

### 11. Footer / Info Bar

```
pixelCrash® v1.1      Click on the preview area...     The tool lets you export...
by @van_der_ex
```

```css
.info {
  color: var(--color-grey-56);  /* #8F8F8F */
  font-size: var(--font-size-xs);  /* 1.15rem, smallest size in scale */
  line-height: 1.1em;
  display: flex;
  flex-direction: row;
  gap: 3.2rem;
}
```

Three columns in a row (flex): copyright (flex 1), pause hint (flex 1), credit text (flex 3). Links within info: `text-decoration: underline`, hover: `color: --color-black`.

### 12. "Add layer" Button

```html
<button id="add-layer-btn" class="primary full-width no-shrink">
  + Add layer
</button>
```

This is a `.primary` button with `.full-width` — same black background, white text. It is at the bottom of the scroll container, using `flex-shrink: 0` to stay visible. Height: `4.4rem` (standard `--space-44`).

---

## Interaction Patterns

### Motion Language

The site has two animation curves:

**Standard ease:** `ease` (CSS default cubic-bezier) — used for button background-color, collapse/expand, hover color transitions.

**Spring bezier:** `cubic-bezier(0.47, 0, 0.23, 1.38)` — used for the toggle button's SVG X→+ icon animation. This has slight overshoot (> 1.0 in y2), creating a "snap" or "spring" feel.

### Hover States

| Element | Hover Change |
|---|---|
| Primary button | Border-radius animates from 0 → 2.2rem (square → pill), color stays black |
| Secondary button | Border-radius 0 → 2.2rem, background lightens from `#DBDBDB` → `#D1D1D1` |
| Text button (Delete) | Color changes from `#A3A3A3` → `#050505`, 0.1s |
| Toggle ON | Border-radius 0 → 1.0rem (square → circle) |
| Toggle OFF | Background `#7A7A7A` → `#050505` (preview of ON), already rounded |
| Segmented item | Color `#A3A3A3` → `#050505`, 0.1s |
| Slider track | Color `#D1D1D1` → `#525252` for connect and handle |
| Symbol text field | text-decoration: underline |
| Info links | Color `#8F8F8F` → `#050505` |

### Focus States

**There are no visible focus rings defined in the CSS.** The design deliberately removes focus outlines on interactive elements. `input:focus { outline: none }` is explicit. This is a desktop-only tool (768px minimum width enforced), suggesting keyboard-nav accessibility was deprioritized.

### Active / Selected States

- Segmented selected: `font-weight: 600` + `color: #050505`
- Toggle ON: black square
- Toggle OFF: grey rounded square
- Slider active range: black filled track

### Disabled States

```css
.disabled {
  opacity: 0.25;
  pointer-events: none;
  cursor: default;
}
button:disabled {
  opacity: 0.4;
  pointer-events: none;
}
```

Two levels: `.disabled` class uses 25% opacity, `button:disabled` attribute uses 40% opacity.

### Layer Panel Collapse/Expand

```css
.layer-panel {
  transition: height 0.3s ease, gap 0.3s ease;
}
.layer-panel > *:not(.panel-header) {
  opacity: 1;
  transition: opacity 0.5s ease;
}
```

Content fades out (opacity 0.5s) slightly slower than the height collapses (0.3s). A staggered exit sequence.

### Text Selection Override

```css
::selection {
  background-color: var(--color-black) !important;
  color: var(--color-grey-82) !important;
}
```

Text selection is styled black with light grey text — consistent brand application even to browser selection behavior.

---

## Iconography

### Logo Icon

A solid filled black square (`2.0rem × 2.0rem`, zero border-radius) implemented as a `<div>` with `background-color: black`. This is the only "logo" icon.

### Button Icons

- Upload button: Unicode `↑` (upward arrow, U+2191) + text "Upload"
- Record button: Unicode `⏺` (black circle for record, U+23FA) + text "Record"

These are plain Unicode characters, not SVG or icon-font glyphs. They render in JetBrains Mono weight 500.

### Toggle X/Plus SVG

The only SVG in the UI is the toggle button's X icon (`.svg-x-icon`):
```
width: 1.0rem × 1.0rem
```
It is a minimal X (two crossing lines). When toggled OFF, it rotates -90° to become a "+" shape, with the horizontal bar fading (scaleX 0). This suggests the SVG has two paths: `.hor` (horizontal) and presumably a vertical path.

The SVG path uses `transition: transform 0.35s cubic-bezier(0.47, 0, 0.23, 1.38) 0.15s` — the 0.15s delay on the path means the background animates first, then the icon completes its transform.

### Icon Style Summary

- Style: ultra-minimal, Unicode characters only (except one SVG toggle icon)
- No icon set (no Heroicons, Feather, Lucide, etc.)
- Size: 1.0rem (icon) within 2.0rem button container
- No stroked outlines — either filled Unicode or minimal SVG paths
- Color: inherits from context (black or white based on button type)

---

## Animation Summary

| Property | Duration | Easing | Trigger |
|---|---|---|---|
| Button border-radius | 0.2s | ease | hover |
| Button background-color | 0.2s + 0.1s delay | ease | hover |
| Toggle background | 0.2s | ease | click |
| Toggle border-radius | 0.2s | ease | click |
| Toggle SVG rotate | 0.35s | spring bezier | click |
| Toggle SVG path scale | 0.35s + 0.15s delay | spring bezier | click |
| Segmented color | 0.1s | ease | click |
| Text-button color | 0.1s | ease | hover |
| Layer panel height | 0.3s | ease | click |
| Layer panel gap | 0.3s | ease | click |
| Layer panel content opacity | 0.5s | ease | click |
| Scroll fade mask opacity | 0.2s | ease | scroll |

Spring bezier: `cubic-bezier(0.47, 0, 0.23, 1.38)` (slight overshoot, snap-in quality)

---

## Responsive Breakpoints

```css
@media (max-width: 800px)  { /* Mobile: hide .app-shell, show .mobile-placeholder */ }
@media (max-width: 1079px) { /* Tablet: hide .header-buttons, reduce preview-area gap */ }
@media (max-width: 960px)  { /* Small tablet: hide .info-text-pause */ }
```

The app enforces minimum 768px (mobile placeholder shown via CSS at 800px, which is close enough). Below 1079px the Upload/Record buttons are hidden from the header.

---

## Design Vocabulary for the Rework

For a developer implementing a UI in this system, the rules are:

1. **Color system:** Light mode only. Two neutrals do the work — white background, `#F0F0F0` panel surface. One accent: black. Secondary text: `#8F8F8F`. Disabled: `#A3A3A3`.

2. **No borders on containers.** Color steps create separation. The only border-equivalent is the `0.1rem` hairline divider div.

3. **Font:** JetBrains Mono, weight 500 as default, 600 for emphasis. Size: `1.3rem` body on a fluid root (`clamp(9px, 0.667vw, 13px)`). Letter-spacing: `-0.01em`.

4. **Button corners start at 0, pill on hover.** This is the signature animation. No button is pre-rounded — rounding is a hover state.

5. **Segmented controls are just text items separated by "/" characters, no background track.** Selected = black + semibold. Unselected = grey. This is the most unusual design decision in the system.

6. **Sliders use hairline tracks and thin vertical line thumbs.** No circles, no fat handles.

7. **All inputs are borderless, backgroundless.** Text fields are invisible until interacted with (underline on hover).

8. **Spring animation on structural changes** (toggle SVG). Linear/ease for color. `0.2s` for micro-interactions. `0.3s` for layout. `0.5s` for opacity fades.

9. **Unicode characters, not icons.** Only one SVG (toggle X/+).

10. **The aesthetic is: technical, precise, instrument-panel, not "app".**

---

## Gaps and Unconfirmed Details

- The **"Colors | Video" tab group** HTML structure could not be confirmed — it appears in the reference screenshot but no explicit class was found in the HTML crawl. It is likely another `.segmented` control with two options.
- The **cell-size slider in the header** — the screenshot shows `XS / S / M / L / XL` labels. The CSS has `.cell-size-control` and `.cell-controls` but the exact sub-markup (whether it's a segmented or a slider) was not confirmed from the HTML shell.
- The **"Brightness / Edge" segmented control** for Mapping type is visible in the screenshot — two options with "/" separator, consistent with the `.segmented` pattern.
- **Geist Mono** is loaded but no CSS rule applies it. It may be applied dynamically by JS for the canvas overlay text (p5.js rendering) rather than UI elements. Confidence: medium.
- **Layer header icon** — the screenshot shows a small square/icon before "LAYER 1". This is likely the `.toggle-btn` (the X/+ SVG) rendered in its ON state (black square appearance when `::before` has 0 border-radius).
- The **"Show source" button/link** visible in the reference screenshot top-right of the canvas area is not in the static HTML. It is likely inserted by JS. Its styling would be `.text-button` or similar.
- Exact **computed pixel values** depend on viewport width due to `clamp(9px, 0.667vw, 13px)` — at 1440px wide: `0.667vw = 9.6px`, so root ~9.6px. At 1920px: `0.667vw = 12.8px` → clamped to 13px.

---

## References

| Source | URL | What it provided |
|---|---|---|
| Raw HTML | https://pixelcrash.xyz | Full HTML structure, font link tags, class names, element IDs |
| CSS source | https://pixelcrash.xyz/bundle.min.css | Complete design token system, all component styles, animations |
| JS bundle | https://pixelcrash.xyz/bundle.min.js | Confirmed p5.js as rendering engine; app-level code not extractable (minified, bundled with p5) |
| Reference screenshot | `.claude/orchestration-design-rework/reference-assets/pixelcrash-reference.png` | Visual confirmation of colors, layout, component rendering, layer panel structure |
| everywhere.tools | https://everywhere.tools/projects/pixelcrash | Creator attribution (@van_der_ex), tool description |
| Instagram post | https://www.instagram.com/p/DTavh3tl1wK/ | Tool description, p5.js confirmation, community usage notes |
| JetBrains Mono | https://www.jetbrains.com/lp/mono/ | Font design philosophy, weight range, character specs |
