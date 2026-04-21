---
name: design-tokens-dark-palette
description: Use when implementing or modifying CSS custom properties, palette, type scale, spacing, radii, or motion tokens in Hand Tracker FX. Defines the pixelcrash-inverted soft-dark palette, JetBrains Mono fluid type scale, and motion token system used by all chrome components.
---

# Design Tokens — Dark Palette (pixelcrash-inverted)

## What this covers

The single source of truth for the visual design-token system powering the Hand Tracker FX chrome rework. pixelcrash.xyz is a **light-mode** interface; we invert its neutral scale to produce a **soft-dark** palette that sits quietly behind webcam content while preserving pixelcrash's geometry, typography, and motion language.

Read this skill before you:
- Create or edit `src/ui/tokens.css`
- Create or edit `src/ui/tokens.ts` (TS re-export)
- Author any component CSS that references `var(--*)` custom properties
- Modify the fluid type scale, spacing scale, radii, or motion tokens
- Add a new token (follow the naming conventions below; add TS re-export in the same commit)
- Review a PR touching `tokens.css` / `tokens.ts`

Out of scope — covered by sibling skills:
- Individual component styling (Button, Segmented, Slider, Toggle, ColorPicker, LayerCard, ModulationRow) — see the per-component skills
- JetBrains Mono self-hosting, `@font-face`, font subsetting, preload tags — separate skill
- Tweakpane removal / React component replacement — `tweakpane-params-presets` + component skills

Authority: DISCOVERY.md at `.claude/orchestration-design-rework/DISCOVERY.md` overrides this document. See especially **DR5** (palette), **DR7** (font size scale), **DR11** (motion), **DR12** (soft-dark rationale). If this skill and DISCOVERY disagree, DISCOVERY wins.

---

## Token files

Two files, kept in sync, committed together.

| File | Role | Consumers |
|---|---|---|
| `src/ui/tokens.css` | Authoritative `:root { --* }` declarations + `@media (prefers-reduced-motion: reduce)` override + `::selection` override | All component CSS (`src/ui/**/*.css`), `src/index.css`, `index.html` inline critical CSS (if any) |
| `src/ui/tokens.ts` | Typed re-export of every token as a `const` (for TS code that needs raw values — canvas 2D overlay color, inline style fallbacks during font-load, test assertions) | `src/ui/**/*.tsx` that needs a raw hex (rare; prefer `var(--*)` via CSS), `tests/unit/tokens.test.ts` |

**Loading order:** `tokens.css` is imported **first** by `src/main.tsx` (before `src/index.css` and any component CSS), so `var(--*)` is resolvable everywhere.

**Sync rule:** Every token added to `tokens.css` MUST also be added to `tokens.ts` in the same commit. The `tokens.test.ts` unit test asserts re-export completeness by grepping `tokens.css` for `--[a-z0-9-]+:` lines and comparing against `Object.keys(tokens)`.

---

## Color tokens (full table)

All values match DR5. Each row also records the pixelcrash role that the token inverts — useful when translating a pixelcrash CSS snippet into our system.

### Surfaces

| Token | Value | Role | Inverts pixelcrash |
|---|---|---|---|
| `--color-bg` | `#0A0A0B` | Page / app background | `--color-white` (`#FFFFFF`) |
| `--color-panel` | `#151515` | Panel / card surface (LAYER card, MODULATION card, error cards) | `--color-grey-94` (`#F0F0F0`) |
| `--color-divider` | `#1F1F1F` | `0.1rem` hairline divider only (never a CSS `border`) | `--color-grey-86` (`#DBDBDB`) |

### Text

| Token | Value | Role | Inverts pixelcrash |
|---|---|---|---|
| `--color-text-primary` | `#EAEAEA` | Primary text, wordmark, LAYER title, segmented-selected, primary button TEXT-ON-LIGHT-BG, slider handle | `--color-black` (`#050505`) |
| `--color-text-muted` | `#8F8F8F` | Secondary body, info row, footer, muted labels | `--color-grey-56` (`#8F8F8F`, unchanged numerically — same grey works in both modes) |
| `--color-text-disabled` | `#6F6F6F` | Disabled / hint, segmented-unselected | `--color-grey-64` (`#A3A3A3`) |

### Buttons

| Token | Value | Role | Inverts pixelcrash |
|---|---|---|---|
| `--color-button-primary-bg` | `#EAEAEA` | Primary button BG (Record rest state, Save-preset) — light-on-dark is the inversion of pixelcrash's dark-on-light | `--color-black` |
| `--color-button-primary-text` | `#0A0A0B` | Primary button text (reads on `--color-button-primary-bg`) | `--color-white` |
| `--color-button-secondary-bg` | `#2A2A2A` | Secondary button BG (Randomize, Save As, Delete route) | `--color-grey-86` |
| `--color-button-secondary-bg-hover` | `#333333` | Secondary button hover BG | `--color-grey-82` |

Text-button styling (Delete link in LAYER header, etc.) uses `--color-text-muted` at rest and `--color-text-primary` on hover directly — no separate button-text aliases needed.

### Segmented / toggle / slider

| Token | Value | Role | Inverts pixelcrash |
|---|---|---|---|
| `--color-segmented-unselected` | `#6F6F6F` | Segmented item text when not `:checked` | `--color-grey-64` |
| `--color-segmented-selected` | `#EAEAEA` | Segmented item text when `:checked` (pair with `font-weight: 600`) | `--color-black` |
| `--color-toggle-on` | `#EAEAEA` | Toggle ON fill | `--color-black` |
| `--color-toggle-off` | `#4A4A4A` | Toggle OFF fill | `--color-grey-48` (`#7A7A7A`) |
| `--color-slider-track` | `#2A2A2A` | Slider unselected track | `--color-grey-82` |
| `--color-slider-active` | `#EAEAEA` | Slider filled range + handle | `--color-black` |
| `--color-slider-hover` | `#CFCFCF` | Slider hover state (connect + handle) | `--color-grey-32` (`#525252`, inverted direction) |

### Accents (kept from existing app)

| Token | Value | Role | Origin |
|---|---|---|---|
| `--color-accent-record` | `#D23030` | Record button active fill, recording dot | Kept from current build (`src/ui/RecordButton.tsx`) — the only saturated color in the system |
| `--color-focus-ring` | `#6AA9FF` | `:focus-visible` ring (all interactive elements) | Kept from current build (`src/ui/cards.css`) — DR5 explicitly preserves this |

**Token count (color):** see DR-6.1 for the authoritative 21-entry color list.

**Non-goals:**
- No opacity utility tokens (`--op-gray-*`). pixelcrash defines them but we don't use them. Don't add unless a component needs one; then add it here first.
- No semantic alias layer (e.g. no `--color-panel-bg` aliasing `--color-panel`). Components reference the primitive directly. Keep one level of indirection.

---

## Spacing tokens

Mirrors pixelcrash's `--space-NN` scale (where NN is `rem × 10`). All values are in `rem`; the fluid root (see below) scales them automatically.

| Token | `rem` | ≈ px @ root 14.5px | Canonical use |
|---|---|---|---|
| `--space-01` | `0.1rem` | ~1.5px | Panel divider hairline height |
| `--space-02` | `0.2rem` | ~2.9px | Slider track height, divider margin, slider handle width |
| `--space-04` | `0.4rem` | ~5.8px | Tight inline padding (segmented item, color picker inner) |
| `--space-06` | `0.6rem` | ~8.7px | Symb-text-field padding |
| `--space-08` | `0.8rem` | ~11.6px | Small gap (logo→wordmark, segmented→segmented, toggle→label) |
| `--space-10` | `1.0rem` | ~14.5px | Toggle-btn hover border-radius (square→circle) |
| `--space-12` | `1.2rem` | ~17.4px | Header-buttons gap, segmented "/" separator offset |
| `--space-16` | `1.6rem` | ~23.2px | Panel inter-section gap, slider touch-area height |
| `--space-20` | `2.0rem` | ~29px | Layer-panel inner padding, logo-icon/toggle-btn/color-picker size |
| `--space-22` | `2.2rem` | ~31.9px | Button hover border-radius (full pill) |
| `--space-24` | `2.4rem` | ~34.8px | Header padding, section gaps |
| `--space-32` | `3.2rem` | ~46.4px | Header gap (leading↔buttons), info-row gap |
| `--space-36` | `3.6rem` | ~52.2px | Header height, in-header button height |
| `--space-44` | `4.4rem` | ~63.8px | Standard button height (outside header), scroll-fade height |
| `--space-48` | `4.8rem` | ~69.6px | Preview-area gap |
| `--space-56` | `5.6rem` | ~81.2px | Color-picker-input width |

**Token count (spacing):** 16.

Skipped rungs from pixelcrash (`--space-14`, `--space-28`, `--space-40`) are intentionally omitted — they're defined in pixelcrash's CSS but unused. Add here only when a new component needs them.

---

## Type scale (fluid clamp)

### Root

```css
:root {
  font-size: clamp(13px, 0.9vw, 16px);
  letter-spacing: -0.01em;
}
```

Why `clamp(13px, 0.9vw, 16px)` (DR7):
- **Lower bound 13px** — floor for readable body text at 1366×768 laptop screens. pixelcrash uses 9px floor which is too small for a webcam app viewed from camera distance.
- **Preferred 0.9vw** — at 1440px viewport → `12.96px`, clamped up to 13px; at 1600px → `14.4px`; at 1920px → `17.28px`, clamped down to 16px. Smooth scaling across the supported 768–4K range.
- **Upper bound 16px** — ceiling prevents oversized chrome on ultrawide monitors where it would dominate the webcam preview.

All `rem` values in this system scale against this fluid root. A `var(--font-size-m)` label at `1.3rem` is `~18.85px` at the 14.5px midpoint root.

### Scale tokens

| Token | `rem` | ≈ px @ root 14.5px | Usage |
|---|---|---|---|
| `--font-size-xs` | `1.15rem` | ~16.7px | Footer / info text, pause hint, credit row |
| `--font-size-s` | `1.2rem` | ~17.4px | Small labels, preset-bar body |
| `--font-size-m` | `1.3rem` | ~18.9px | **Body default**, control labels, segmented items, slider values |
| `--font-size-l` | `1.5rem` | ~21.8px | Medium emphasis (error-card titles, LAYER section titles if boosted) |
| `--font-size-xl` | `2.0rem` | ~29px | Wordmark, large display |

| Token | Value | Usage |
|---|---|---|
| `--font-weight-regular` | `400` | Reserved (not the UI default — JBM Medium is the body weight) |
| `--font-weight-medium` | `500` | Body default (JetBrains Mono Medium) |
| `--font-weight-semibold` | `600` | Wordmark, LAYER titles, segmented-selected, Record button |
| `--line-height-body` | `1.4` | Body line-height |

**Token count (type):** 8.

**Body rule** (applied by `src/ui/tokens.css` or `src/index.css`):

```css
body {
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--font-size-m);
  font-weight: var(--font-weight-regular);
  line-height: var(--line-height-body);
  letter-spacing: -0.01em;
  color: var(--color-text-primary);
  background-color: var(--color-bg);
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}
```

---

## Radius tokens

| Token | Value | Role |
|---|---|---|
| `--radius-0` | `0` | Default for everything — buttons at rest, panels, sliders, swatches |
| `--radius-circle` | `50%` | Toggle-btn hover state (square→circle at 2.0rem size), SVG toggle icon when OFF |
| `--radius-pill` | `2.2rem` | Button hover state (square→pill) — the **signature hover animation** |

**Token count (radius):** 3.

The deliberate use of `0` everywhere by default, with rounding as a **motion state**, is the core pixelcrash aesthetic — see "Square→pill hover pattern" below.

---

## Motion tokens (durations + easing curves)

| Token | Value | Use when |
|---|---|---|
| `--duration-fast` | `0.1s` | The snappiest micro-interactions (e.g. text-button color shift) |
| `--duration-short` | `0.2s` | Default hover/color/radius transitions — button border-radius 0→pill, background-color transitions, segmented selection |
| `--duration-medium` | `0.35s` | Structural changes: toggle SVG rotate (X↔+), icon path scale, small layout shifts |
| `--duration-long` | `0.5s` | Layer-panel content fade on collapse/expand, opacity-driven staggered exits |
| `--ease-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | Standard hover / color / radius / layout transitions |
| `--ease-spring` | `cubic-bezier(0.47, 0, 0.23, 1.38)` | Only for motion that should **overshoot**: toggle SVG rotate, icon scale, any "snap-in" quality |

**Token count (motion):** 6.

### Choosing between fast / short / medium / long

- **fast (0.1s)** — tight micro-interactions like a text-button color flip.
- **short (0.2s)** — the answer ~80% of the time: hover color shifts, button border-radius 0→pill, segmented selection.
- **medium (0.35s)** — the element is physically changing shape/orientation (rotate, scale), not just repainting.
- **long (0.5s)** — content fades on a container that's also resizing; staggered to feel like it lags behind the container motion.

### Choosing between default / spring

- **default (ease)** — any transition whose target value is monotonically approached (color, radius, opacity, translate, scale). Never overshoots.
- **spring** — only for discrete toggle-like state changes that should feel "snapped into place." Overuse destroys the effect. Currently: toggle SVG X↔+ rotate, toggle icon path scaleX.

---

## Usage patterns (CSS + TS)

### CSS — reference tokens via `var(--*)`

```css
/* src/ui/LayerCard.css */
.layer-card {
  background-color: var(--color-panel);
  padding: var(--space-20);
  gap: var(--space-16);
  /* NO border — surface color alone separates it from --color-bg */
}
.layer-card__divider {
  height: var(--space-01);
  background-color: var(--color-divider);
  margin: var(--space-02) 0;
}
.layer-card__title {
  color: var(--color-text-primary);
  font-size: var(--font-size-m);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
}
```

### TS — import from `tokens.ts` only when CSS can't reach

```ts
// src/ui/tokens.ts (excerpt — see DR-6.1 for the authoritative schema)
export const tokens = {
  "color-bg": "#0A0A0B",
  "color-panel": "#151515",
  "color-text-primary": "#EAEAEA",
  "color-accent-record": "#D23030",
  // ... every token above, kebab-cased keys
} as const;
export type TokenKey = keyof typeof tokens;
```

```ts
// src/effects/handTrackingMosaic/render.ts — 2D overlay color
import { tokens } from "../../ui/tokens";
ctx.strokeStyle = tokens["color-text-primary"]; // not "#EAEAEA"
```

Rule of thumb: **reach for CSS first**. Only import `tokens.ts` for Canvas 2D drawing, WebGL clear color, or when inline-styling a React `style={{}}` prop is genuinely simpler. Never hardcode the hex.

---

## Square→pill hover pattern

The signature pixelcrash motion. Implement via `::before` pseudo-element so the colored surface and the text can transition independently — the text stays exactly put while the shape morphs behind it.

```css
/* src/ui/Button.css */
button.primary {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: var(--space-44);
  padding: 0 var(--space-16);
  color: var(--color-button-primary-text);
  font-family: inherit;
  font-size: var(--font-size-m);
  font-weight: var(--font-weight-semibold);
  background-color: transparent; /* real color is on ::before */
  border: none;
  cursor: pointer;
  isolation: isolate; /* prevents ::before leaking outside */
}

button.primary::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background-color: var(--color-button-primary-bg);
  border-radius: var(--radius-0);
  transition:
    border-radius var(--duration-short) var(--ease-default),
    background-color var(--duration-short) var(--ease-default) 0.1s;
}

button.primary:hover::before {
  border-radius: var(--radius-pill);
}

button.primary:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
```

Key details:
- `isolation: isolate` — creates a stacking context so `z-index: -1` on `::before` stays behind the button's text but doesn't fall behind the page.
- **Staggered transitions** — `border-radius` starts immediately; `background-color` has a `0.1s` delay. This gives the "shape morphs first, then color fades" feel that pixelcrash nails. Don't collapse them into one shorthand.
- **No radius in the rest state.** `--radius-0` (i.e. `0`) is explicit — it documents intent and survives any future `border-radius: inherit` or UA default stylesheet.
- The same recipe applies to `button.secondary` (swap color tokens) and `button.toggle-btn` (swap `--radius-pill` for `--radius-circle`). Toggle ON rest state starts at `--radius-0`; toggle OFF rest state uses `--radius-circle` and hover darkens the fill.

---

## Reduced-motion strategy

DISCOVERY D42 + DR11 require that `prefers-reduced-motion: reduce` collapses all transition durations to 0 without changing final states. Token-level override:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0s;
    --duration-short: 0s;
    --duration-medium: 0s;
    --duration-long: 0s;
  }
}
```

Because **every component CSS references `var(--duration-*)`**, the media query flips all animation off at once. Components don't need their own `@media (prefers-reduced-motion: reduce)` blocks.

Testing:
- Unit: mock `matchMedia('(prefers-reduced-motion: reduce)')` → true; assert `getComputedStyle(document.documentElement).getPropertyValue('--duration-fast').trim() === '0s'`.
- E2E: run at least one test with `context.emulateMedia({ reducedMotion: 'reduce' })` and assert the button does not animate on hover (or just assert no-throw + visual stability).

Non-tokenized animations (e.g. a `transform` spec inlined in keyframes) are an anti-pattern — always drive duration via a token.

---

## Common pitfalls

### 1. Hardcoded hex outside `tokens.css`

Anti-pattern. Pre-rework, every chrome file had `#1b1b1b` / `#e6e6e6` / `#2d2d2d` scattered inline (see `current-ui-audit.md` §2). We reject that here.

L1 grep check (add to `biome.json` or a pre-commit script):

```bash
# Fails if any hex color is defined outside tokens.css / tokens.ts
rg -n '#[0-9a-fA-F]{3,8}\b' src/ \
  --glob '!src/ui/tokens.css' \
  --glob '!src/ui/tokens.ts' \
  --glob '!**/*.test.*' \
  --glob '!public/favicon.svg'
```

Allowed exceptions (all documented in place):
- `public/favicon.svg` — brand gradient colors (`#863bff`, `#47bfff`) are part of the mark itself.
- `*.test.*` files — test fixtures may use raw hex for assertion-readability.
- Shader source strings (GLSL uniforms use `vec3` numerics, not hex — no issue).
- `src/ui/tokens.css` and `src/ui/tokens.ts` — the canonical token declarations.

### 2. Font FOUT despite token existing

The `--font-family` token doesn't load fonts; `@font-face` does. If `tokens.css` references JetBrains Mono but `index.html` omits `<link rel="preload">`, users see a brief flash of the fallback monospace. Pair every addition of `--font-family` to CSS with a `<link rel="preload" as="font" type="font/woff2" crossorigin>` tag in `index.html`. See the JetBrains-Mono self-hosting skill for the full recipe.

### 3. SVG currentColor pass-through

Tokens can't be referenced directly from an external SVG file's `fill` or `stroke` attribute — the SVG runs in its own document context. To token-drive SVG colors, set `fill="currentColor"` in the SVG and `color: var(--color-text)` on the parent element:

```html
<!-- public/icons/plus.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
  <path d="M8 2v12 M2 8h12" stroke="currentColor" stroke-width="1.5"/>
</svg>
```

```tsx
<span style={{ color: "var(--color-text-primary)" }}>
  <img src="/icons/plus.svg" alt="" aria-hidden />
</span>
```

For inline SVG, tokens can be referenced via CSS (`stroke: var(--color-text-primary)`) since the SVG shares the document's scope.

### 4. StrictMode-safe `:root` styles

`tokens.css` is static CSS — safe. But do **not** dynamically set custom properties in a `useEffect` on `document.documentElement`:

```tsx
// ANTI-PATTERN — double-mount under StrictMode re-runs the effect, leaving stale dynamic props
useEffect(() => {
  document.documentElement.style.setProperty("--custom-whatever", "value");
}, []);
```

If a runtime-computed token is ever needed (e.g. viewport-derived spacing), compute it inline on the consuming element's `style={{}}` or compute once at module scope. Never mutate `:root` from React.

### 5. Tailwind / CSS-in-JS drift

DR explicit non-goal #8: no Tailwind, no styled-components, no emotion, no shadcn. All styling is plain CSS + CSS custom properties. If a task description or research file suggests otherwise, treat DISCOVERY as authority.

---

## Testing strategy

### Level 2 (unit)

`tests/unit/tokens.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { tokens } from "../../src/ui/tokens";

describe("tokens", () => {
  it("re-exports every --* declared in tokens.css", () => {
    const css = readFileSync(
      resolve(__dirname, "../../src/ui/tokens.css"),
      "utf-8",
    );
    const cssNames = [...css.matchAll(/--([a-z0-9-]+)\s*:/gi)]
      .map((m) => m[1])
      .filter((n) => !n.startsWith("duration-") || true); // keep all
    const tsNames = Object.keys(tokens).map((k) =>
      k.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`),
    );
    for (const name of cssNames) {
      expect(tsNames).toContain(name);
    }
  });

  it("collapses durations under prefers-reduced-motion", () => {
    // jsdom: apply the media query manually by parsing tokens.css
    // and asserting the override block contains the three 0s lines.
    const css = readFileSync(
      resolve(__dirname, "../../src/ui/tokens.css"),
      "utf-8",
    );
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toMatch(/--duration-fast:\s*0s/);
    expect(css).toMatch(/--duration-medium:\s*0s/);
    expect(css).toMatch(/--duration-long:\s*0s/);
  });
});
```

### Level 1 (lint)

CI runs the `rg` grep from "Pitfall 1" above. A non-zero result fails L1.

### Level 4 (E2E)

Per `playwright-e2e-webcam`:
- At least one test uses `context.emulateMedia({ reducedMotion: 'reduce' })` and asserts stable layout across a hover.
- Optional visual-fidelity screenshot diff against `reference-assets/design-rework-reference.png` (captured post-implementation).

---

## References

- `.claude/orchestration-design-rework/DISCOVERY.md` — **DR5** (color table), **DR7** (font/root/scale), **DR11** (square→pill hover + reduced-motion), **DR12** (soft-dark rationale)
- `.claude/orchestration-design-rework/research/pixelcrash-design-language.md` — original pixelcrash token system being inverted. Sections used: "Color Tokens" (primitive scale + semantic mapping), "Typography" (JetBrains Mono rules + scale), "Layout & Spacing" (space-NN scale + radii), "Animation Summary" (duration + easing table).
- `.claude/orchestration-design-rework/research/current-ui-audit.md` — **§2** enumerates every hardcoded hex value the rework replaces; use as the checklist when auditing whether a file has been fully token-ized.
- `.claude/orchestration-hand-tracker-fx/DISCOVERY.md` D42 — reduced-motion gate (parent-project authority, still active).
- Sibling skills: `tweakpane-params-presets` (retirement path), `vite-vercel-coop-coep` (CSP interaction with `@font-face`), `vitest-unit-testing-patterns` (token test boilerplate).
