# Synergy-review Fixes Applied

**Date**: 2026-04-19
**Agent**: Fix-application pass (fresh session, pre-Ralph-loop)
**Source**: `.claude/orchestration-design-rework/reports/synergy-review.md`

All CRITICAL + HIGH + selected-MEDIUM fixes from the synergy review have been applied. Ralph execution can proceed.

---

## Fixes Applied

### CRITICAL

- **CRITICAL-01 — Token-name vocabulary.** Locked the vocabulary to DR-6.1. Edited:
  - `.claude/skills/design-tokens-dark-palette/SKILL.md` — 13+ renames (panel/text/button/radius/font-weight tables, body rule, CSS snippets, reduced-motion media query, prefix-1 grep, tokens.ts example).
  - `.claude/skills/custom-param-components/SKILL.md` — 2 renames (`--color-primary-text/bg` → `--color-button-primary-text/bg` in the Button CSS sample) + timing-token rename (`--duration-fast` → `--duration-short`).
  - `.claude/skills/jetbrains-mono-self-hosting/SKILL.md` — `--font-mono` → `--font-family`.
  - `task-DR-7-1.md` Button CSS — `--color-btn-secondary-bg` → `--color-button-secondary-bg`, `--color-btn-secondary-hover-bg` → `--color-button-secondary-bg-hover`, + prose token lists in Dependencies + CSS custom properties note. Changed `::before` transition to `--duration-short`.
  - `task-DR-8-4.md` cards CSS — `--color-button-secondary-hover` → `--color-button-secondary-bg-hover`, `--color-focus` → `--color-focus-ring` (also fixed an over-replacement `--color-focus-ring-ring`), `--duration-fast` → `--duration-short`.
  - `task-DR-8-5.md` PresetStrip CSS — `--color-focus` → `--color-focus-ring`, `--color-button-secondary-hover` → `--color-button-secondary-bg-hover`, `--duration-fast` → `--duration-short`.

- **CRITICAL-02 — tokens.css path.** Global replace `src/styles/tokens.*` → `src/ui/tokens.*` across both `design-tokens-dark-palette` (8 occurrences) and `jetbrains-mono-self-hosting` (2 occurrences).

- **CRITICAL-03 — Dev-hook API drift.** Chose Option A (no engine change). Rewrote L4 evaluators in:
  - `task-DR-8-1.md` (line 348 → `__engine?.getParam('mosaic.tileSize')`).
  - `task-DR-8-2.md` (lines 507, 517 → `__engine?.getParam(...)` for `grid.widthVariance` and `mosaic.tileSize`).
  - `task-DR-8-3.md` (line 462 → DOM-count via `getByTestId(/^modulation-route-\d+$/)`; line 470 → `__engine?.getParam('mosaic.tileSize')`).
  - `task-DR-8-4.md` (line 349 → removed `forceCameraState`, replaced the 7-state loop with PROMPT + GRANTED assertions; full 8-state matrix now deferred to DR-9.2).
  - `task-DR-8-5.md` (line 451 → UI-driven Save As dialog replacing `__handTracker?.savePreset('Alt')`).
  - `task-DR-8-7.md` (line 253 → fresh `browser.newContext({ permissions: [] })` for PROMPT verification instead of `forceCameraState`).
  - `task-DR-8-R.md` (lines 278/289/297/361 → `__engine?.getParam(...)` for tileSize, widthVariance, seed; line 306 → DOM-count; line 369 → DR-9.2-style `addInitScript` stub for USER_DENIED; "why" line 137 updated to document the real API).

- **CRITICAL-04 — `useParam<T>` generic.** Dropped the explicit generic everywhere a consumer passes a VALUE type:
  - `task-DR-8-1.md` line 290 (`useParam('mosaic.tileSize')`).
  - `task-DR-8-2.md` lines 325–341 — all 12 calls in `LayerCard1.tsx` + prose references.
  - `.claude/skills/custom-param-components/SKILL.md` — sample Usage block and CellSizePicker prose.
  - `task-DR-7-7.md` Success Definition — `useParam<number>(...)` → `useParam(...)`.
  - Also updated DR-8.1 and DR-8.2 gotcha prose to explain the inference rule.
  - DR-7.2 Segmented.value type update deferred to Ralph (documented in the CRITICAL-04 note; the consumer fix above is sufficient for L1/L2 to compile because `ParamValue<'mosaic.tileSize'>` narrows to `number` exactly).

- **CRITICAL-05 — Duplicate LayerSection.** Removed `LayerSection.tsx` + `LayerSection.module.css` from DR-8.2's create list; now imports `LayerSection` directly from `./primitives/LayerCard` (DR-7.6 shape). Moved the net-new `Row` helper into `LayerRow.tsx` + `LayerRow.module.css` (new create entries). Renamed all DR-8.2 code-snippet usages: `title` → `heading`, `testId` → `testid`, `Row` → `LayerRow`. Updated the desired-tree block, L1 biome path list, Final Validation grep, and the Step-1 content entirely.

- **CRITICAL-06 — Duplicate testids in Showcase.** Added explicit `testid="showcase-record"`, `showcase-randomize`, `showcase-delete`, `showcase-close`, `showcase-disabled` props on DR-7.R's showcase `<Button>`s. Updated the `button hover transitions border-radius` L4 spec to target `showcase-record` (was `getByTestId('button-primary').first()`).

### HIGH

- **HIGH-01** — Covered under CRITICAL-04.
- **HIGH-02** — Added `ariaLabel` to every `<Slider>` and `<ColorPicker>` call in DR-8.2's LayerCard1 code snippet (`Seed`, `Columns`, `Rows`, `Width variance`, `Line color`, `Line weight`, `Tile size`, `Blend opacity`, `Edge feather`, `Region padding`).
- **HIGH-03** — DR-8.3 `collapsedByDefault` → `defaultCollapsed`.
- **HIGH-04** — Added a preflight grep note to DR-8.2 Known Gotchas: run `grep -rn 'panel-root|params-panel' tests/e2e/` stripped of the common assertion methods before implementing; list any chained selectors that show up.
- **HIGH-05** — Updated `custom-param-components` skill's `useParam` sample to the subscription-isolation implementation from DR-7.7 lines 107–144 (uses `lastValueRef` + `Object.is` to swallow sibling-key notifications).
- **HIGH-06** — Added `git mv tests/e2e/errorStates.spec.ts tests/e2e/error-states.spec.ts` to DR-9.2 Step 2. Changed DR-8.4 L4 grep from `--grep "errorStates"` to `pnpm test:e2e tests/e2e/errorStates.spec.ts` (filename-based, since at DR-8.4 time the rename hasn't happened yet).
- **HIGH-07** — Dropped the `<div className="card-panel">` wrapper in DR-8.4. Now `card-panel` is applied as a co-class on the existing `.card` element (`className="card card-panel"`). DOM shape preserved; no chained E2E selectors break.
- **HIGH-08** — Updated DR-7.R Step 2 to seed `paramStore` before rendering Showcase: `registerManifest(handTrackingMosaicManifest)` is called inside the dynamic-import promise chain before `root.render(<StrictMode><Showcase /></StrictMode>)`.
- **HIGH-09** — Added `CREATE src/ui/BezierEditor.tsx` + `BezierEditor.module.css` + `BezierEditor.test.tsx` to DR-8.3's desired-tree block.
- **HIGH-10** — Added a post-Stage.css-modification verification step to DR-8.6 Level-4: `pnpm test:e2e tests/e2e/phase-3-regression.spec.ts` + a gotcha paragraph on ResizeObserver / WebGL viewport drift with a revert path.
- **HIGH-11** — Added an OPTIONAL `VITE_EXPOSE_DEV_HOOK=1` gotcha to DR-9.1 Known Gotchas, noting default = omitted, and that e2e-preview.yml runs WITHOUT the dev hook by default.

### MEDIUM (selected per instructions)

- **MEDIUM-01** — PHASES.md total `23` → `24` (DR-7 task count `7` → `8`); DR-9.R `32 + 23 = 55` → `32 + 24 = 56` (both the retrospective block and the arithmetic gotcha).
- **MEDIUM-02** — DR-7.6 No-Prior-Knowledge Test `0.3s` → `0.35s`.
- **MEDIUM-03** — DR-8.3: `48 modulation` / `48 options` → `45` + corrected arithmetic (21 × 2 = 42 plus pinch + centroid.x + centroid.y = 45). Also updated the `custom-param-components` skill references.
- **MEDIUM-04** — Replaced `.claude/orchestration-design-rework/skills/` → `.claude/skills/` in DR-6.1, DR-6.2, DR-6.3, DR-6.R (5 occurrences).
- **MEDIUM-05** — Removed the `.app-shell { padding: var(--space-24) }` block from DR-6.3; added a comment clarifying that DR-8.6 owns the app-shell / app-layout padding rewrite.
- **MEDIUM-06** — PHASES.md DR-9.2 acceptance criteria: added `(plus GRANTED happy-path)` after the 7-state enumeration.
- **MEDIUM-07** — DISCOVERY.md DR4: reference target swapped from `.claude/orchestration-design-rework/reference-assets/pixelcrash-reference.png` to `reports/DR-8-regression/design-rework-reference.png`, with the clarifying parenthetical.
- **MEDIUM-08** — `jetbrains-mono-self-hosting` §8: "first matching rule and stops" → "ALL matching rules additively". Removed the duplicated COOP/COEP headers from the fonts block in the example vercel.json (the catch-all provides them).

---

## Verification greps (all clean)

From `/Users/kevin/Documents/web/hand-tracker/`:

```
grep -rE 'src/styles/tokens\.(css|ts)' .claude/skills/                                                → CLEAN
grep -rnE '__handTracker\?\.paramSnapshot|__handTracker\?\.modulationSnapshot|
          __handTracker\?\.forceCameraState|__handTracker\?\.savePreset'
          .claude/orchestration-design-rework/tasks/                                                   → CLEAN
grep -rnE 'useParam<(number|string|boolean)'
          .claude/orchestration-design-rework/tasks/ .claude/skills/custom-param-components/           → CLEAN
grep -rn 'collapsedByDefault' .claude/orchestration-design-rework/tasks/                               → CLEAN
grep -rnE -- '--color-btn-|--color-surface|--color-focus[^-]|--font-mono|--radius-none'
          .claude/ (excluding reports/synergy-review.md)                                               → CLEAN
grep -rE '48 modulation|49 modulation' .claude/ (excluding reports/synergy-review.md)                  → CLEAN
```

---

## Deferred items (not in this fix pass)

All MEDIUM-09 through MEDIUM-12 and all LOW-01 through LOW-11 items from the synergy review are deferred to Ralph execution per the task brief. Notably:

- **MEDIUM-09** — DR-8.5's `import type { Pane } from 'tweakpane'` remains; DR-8.6 already lists PresetStrip in its MODIFY list, so the cycle resolves naturally.
- **MEDIUM-10** — Footer dot-count cosmetic. Ralph can tune from screenshots.
- **MEDIUM-11** — Covered by CRITICAL-03.
- **MEDIUM-12** — DR-8.R seed reset before reference capture. Can be added on iteration 2 if the first capture is non-reproducible.
- All LOW items (concurrently/wait-on deps, reduced-motion CSP note, toggle SVG diagonals, LayerCard gap animation, testid overlap smoke, task-id arithmetic, Claude model-version trailer, jq on PATH, biome-format count tolerance, seed range slider) — cosmetic or deferred.

---

## Files edited (summary)

| File | Edits |
|---|---|
| `.claude/skills/design-tokens-dark-palette/SKILL.md` | ~12 edits (all token renames + path renames + type-scale + SVG pitfall + reduced-motion block + grep pitfall) |
| `.claude/skills/custom-param-components/SKILL.md` | 5 edits (Button CSS tokens + useParam sample + CellSizePicker prose + modulation-count + hardcoded-hex pitfall) |
| `.claude/skills/jetbrains-mono-self-hosting/SKILL.md` | 3 edits (path + `--font-mono` rename + Vercel headers example) |
| `.claude/orchestration-design-rework/DISCOVERY.md` | 1 edit (DR4 reference path) |
| `.claude/orchestration-design-rework/PHASES.md` | 2 edits (total count + DR-9.2 enumerator) |
| `task-DR-6-1.md` | 1 skill-path edit |
| `task-DR-6-2.md` | 1 skill-path edit |
| `task-DR-6-3.md` | 4 edits (skill path + `.app-shell` padding removal) |
| `task-DR-6-R.md` | 1 skill-paths edit |
| `task-DR-7-1.md` | 4 edits (Button CSS tokens + dep-list prose + `--duration-short` transitions) |
| `task-DR-7-6.md` | 1 edit (`0.3s` → `0.35s`) |
| `task-DR-7-7.md` | 1 edit (Success Definition `useParam<number>` → `useParam`) |
| `task-DR-7-R.md` | 3 edits (showcase explicit testids + paramStore seeding in main.tsx + L4 selector) |
| `task-DR-8-1.md` | 3 edits (useParam generic drop + prose gotcha + L4 getParam) |
| `task-DR-8-2.md` | 10+ edits (LayerSection removal + LayerRow rename + imports + useParam generic drop + ariaLabel everywhere + preflight gotcha + CSS + L1/L4 adjustments) |
| `task-DR-8-3.md` | 6 edits (BezierEditor create + modulation-count + `collapsedByDefault` → `defaultCollapsed` + L4 getParam + DOM-count) |
| `task-DR-8-4.md` | 5 edits (card-panel co-class + token renames + `duration-fast` → `duration-short` + L4 PROMPT-only spec + filename-grep) |
| `task-DR-8-5.md` | 3 edits (token renames + UI-driven Save As seed + `duration-short`) |
| `task-DR-8-6.md` | 1 edit (post-Stage.css phase-3 regression verification step) |
| `task-DR-8-7.md` | 1 edit (PROMPT via new context permissions instead of forceCameraState) |
| `task-DR-8-R.md` | 7 edits (getParam across tileSize / widthVariance / seed reads + DOM-count for routes + addInitScript USER_DENIED + "why" doc) |
| `task-DR-9-1.md` | 1 edit (`VITE_EXPOSE_DEV_HOOK=1` optional gotcha) |
| `task-DR-9-2.md` | 1 edit (git-mv instruction in Step 2) |
| `task-DR-9-R.md` | 2 edits (arithmetic 55 → 56 in both retrospective + gotcha) |

Total: ~80 distinct edits across 23 files.

---

## Next step

Spawn the DR-6.1 Ralph subagent per `.claude/orchestration-design-rework/START.md`. The token vocabulary, tokens.css path, dev-hook API usage, useParam signatures, LayerSection ownership, Showcase testids, and task-count accounting are all aligned with DR-6.1 as the authoritative source.
