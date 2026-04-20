# Phase DR-7 Regression Report

**Date**: 2026-04-19
**Branch**: `task/DR-7-R-primitives-regression`
**Status**: SHIP

## Tasks Completed (merged to main)

| Task | Status | Unit tests | Notes |
|---|---|---|---|
| DR-7.1 Button primitive | green | 12 | `button-${variant}` default testid, `testid` override, forwardRef, square→pill hover via `::before` |
| DR-7.2 Segmented primitive | green | 24 | Typographic N-option radio group, "/" separator, roving tabindex, `value: V \| undefined` (synergy HIGH-01) |
| DR-7.3 Slider + RangeSlider | green | 33 | Hairline track, thin vertical thumb, non-crossing two-thumb, PageUp/PageDown ±10×step |
| DR-7.4 Toggle primitive | green | 16 | ARIA `role="switch"`, square↔circle morph, spring transition on icon |
| DR-7.5 ColorPicker primitive | green | 19 | Draft-on-keystroke / commit-on-blur-or-Enter, silent revert on invalid hex |
| DR-7.6 LayerCard + LayerSection | green | 20 | Collapsible via chevron, staggered exit animation, `withDivider` on sections |
| DR-7.7 useParam hook | green | 18 | `useSyncExternalStore` bridge, per-key re-render isolation via Object.is short-circuit |
| **DR-7.R Regression + Showcase** | **SHIP** | **—** | 9 new E2E, screenshot, all prior specs still green |

## Deliverables

- `src/ui/primitives/Showcase.tsx` — renders every primitive with explicit per-instance testids
- `src/ui/primitives/Showcase.module.css` — minimal token-driven layout
- `src/main.tsx` — `/primitives` route gated on `import.meta.env.DEV || import.meta.env.MODE === 'test'`
- `tests/e2e/DR-7-R-showcase.spec.ts` — 9 Playwright tests (`Task DR-7.R:` describe prefix)
- `reports/DR-7-regression/primitives-showcase.png` — full-page screenshot baseline (gitignored)

## Validation Summary

### L1 — biome + tsc
```
pnpm biome check src/ tests/   # 114 files, 0 errors
pnpm tsc --noEmit              # exit 0
```

### L2 — vitest unit tests
```
pnpm vitest run
# Test Files  34 passed (34)
# Tests       536 passed (536)
```
Zero new unit tests (Showcase is visual-only; its behavior is covered by the primitives' own suites + the new E2E). Aggregate count unchanged at 536 — no regressions in the seven primitives.

### L3 — build
```
pnpm build --mode test         # Showcase-*.js + Showcase-*.css CHUNKED (expected — /primitives route active)
pnpm build                     # NO Showcase-*.js / Showcase-*.css chunks emitted
grep -r "Showcase" dist/       # Only matches in index-*.js.map source-content comments (sourcemap of main.tsx preserves the comment text). Zero matches in any shipped runtime artifact:
  - dist/assets/index-*.js       → 0 hits
  - dist/index.html              → 0 hits
  - dist/assets/*.css            → 0 hits
```
Tree-shaking confirmed: the production bundle contains no Showcase code or reference, only a benign `"Showcase"` token inside the source-content field of the sourcemap (not loaded at runtime). Source-map `sources` list also excludes Showcase.tsx entirely.

### L4 — Playwright E2E (full aggregate)
```
pnpm test:e2e
# 72 passed (3.9m)  -- 63 prior + 9 new DR-7.R
```

DR-7.R new specs (all green):
1. `every primitive section mounts under its explicit testid`
2. `button variants render with per-instance testids (no default collision)`
3. `segmented renders 5 options and selection updates on click`
4. `slider + range slider render and are interactive`
5. `toggle flips aria-checked on click`
6. `color picker exposes swatch + hex text inputs`
7. `layer card MODULATION chevron toggles aria-expanded`
8. `useParam demo writes through paramStore and re-reads the new value`
9. `full-page screenshot captured for DR-8 visual baseline`

## Manual Screenshot

`reports/DR-7-regression/primitives-showcase.png` — full-page capture at 1440×900, Chromium preview server, served by `pnpm build --mode test && pnpm preview` (so the test bundle gate was exercised, not just the dev server). Serves as the pre-DR-8 visual baseline reference.

## Key decisions

1. **Gating expression** `import.meta.env.DEV || import.meta.env.MODE === 'test'`. Allows the default Playwright webServer (`pnpm build --mode test && pnpm preview`) to serve `/primitives` at port 4173 without any additional scripts, concurrently deps, or two-terminal flow. Production build (`pnpm build`, `MODE=production`) evaluates the guard to `false` at build time; Vite statically replaces both env flags and tree-shakes the entire dynamic-import branch.
2. **Dynamic import** `import('./ui/primitives/Showcase')` is what lets Vite rip out the Showcase module graph in prod. A static top-level import would pull Showcase.tsx into the main chunk regardless of the dead-code branch.
3. **paramStore seeding** (synergy HIGH-08) reuses the existing top-level side-effect import of `./effects/handTrackingMosaic` — that module already calls `paramStore.replace(DEFAULT_PARAM_STATE)` + `registerEffect(manifest)`. No manual `registerManifest` call needed.
4. **Explicit per-instance testids** on every showcase control (synergy CRITICAL-06): two `<Button variant="primary">` instances (Record + Disabled) both would default to `data-testid="button-primary"` and collide; both override via `testid="showcase-record"` / `testid="showcase-disabled"`.

## Notes / Known Issues

- The segmented-control E2E click path targets the `<label>` text (`getByText('XL', { exact: true })`) rather than the native `<input>`, because the input is zero-sized by design (the visible indicator is the sibling `.label` color + weight swap). Label click still routes to the input via HTML `<label htmlFor>` semantics.
- The preview server launched by Playwright uses `pnpm build --mode test`, so the L4 actually covers the test-mode Showcase include path (the Playwright spec is the authoritative regression for MODE=test tree-shaking — the grep-zero-hits check on `pnpm build` covers the prod path).
- No pre-existing E2E was modified. The only `src/main.tsx` change is additive (`if (isShowcase) { ... } else { ...existing path... }`).
