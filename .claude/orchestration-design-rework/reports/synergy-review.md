# Hand Tracker FX — Design-Rework Synergy Review

**Date**: 2026-04-19
**Reviewer**: synergy-review agent (fresh session)
**Inputs reviewed**: DISCOVERY.md (DR1–DR19), PHASES.md, research/pixelcrash-design-language.md, research/current-ui-audit.md, 24 task files (phase-DR-6/7/8/9), 3 design-rework skills (`design-tokens-dark-palette`, `custom-param-components`, `jetbrains-mono-self-hosting`), relevant engine/UI source files.

---

## Executive Summary

**Verdict**: **NEEDS REWORK (before Ralph loop starts) — then ship-with-fixes.**

The plan is directionally sound — 24 task files that each pass a no-prior-knowledge read, a sensible dependency graph, correct phase gating, and clear deletion ordering. But there is **widespread contract drift between the three design-rework skills and the task files** on the core CSS token vocabulary, and several dev-hook methods that task L4 specs rely on **do not exist in the code today**. Both categories will cause execution agents running in fresh sessions to fail immediately on L1 (broken token references → unused CSS custom properties) or L4 (e.g. `__handTracker.paramSnapshot is not a function`).

If the main agent applies the CRITICAL + HIGH fixes inline before spawning the first DR-6.1 subagent, the Ralph loop should execute cleanly. CRITICAL issues cluster in three areas that are all tractable with precise edits:

1. **Canonical token names** — pick one vocabulary and rewrite the other two + the task files that consume it. (Recommend: DR-6.1's names win, since DR-6.1 is the first-written artifact and its `src/ui/tokens.css` path matches the parent repo's `src/ui/` convention.)
2. **Canonical tokens.css path** — `src/ui/tokens.css` (DR-6.1) vs `src/styles/tokens.css` (two skills). Pick `src/ui/tokens.css` and fix the skills.
3. **Dev-hook extensions** — either update the tasks to use the existing `__handTracker.__engine.getParam(…)` / `setParam` / `listEffects` API, or extend `src/engine/devHooks.ts` to add `paramSnapshot()`, `modulationSnapshot()`, `savePreset()`, `forceCameraState()` so the tasks' Playwright evaluators work as written.

The remaining drift is real but cosmetic — token-name typos in individual task CSS snippets, one incorrect generic signature on `useParam`, and small counting errors (48 vs 45 modulation sources, 23 vs 24 task count, etc.).

No deletion ordering bug. No E2E describe-prefix collision with the parent project (`Task DR-N.M:` vs `Task N.M:`). No branch-name collision. Testid preservation is consistent across task files (all preserve `panel-root`, `params-panel`, `preset-bar`, `preset-name`, `preset-actions`, `record-button`, `record-elapsed`, 8 error-state testids, `stage`, `render-canvas`, etc.) — but the *mechanics* of moving `panel-root` + `params-panel` from Panel.tsx onto Sidebar.tsx + LayerCard1 body will silently break any existing spec that chains a child selector under `panel-root` (see HIGH-04).

---

## CRITICAL issues (must fix before Ralph loop runs)

### CRITICAL-01 — Token-name vocabulary divergence (three disagreeing sources)

**Severity**: Critical. Every DR-7.x primitive and every DR-8.x composite references token names via CSS `var(--…)`. If the referenced name doesn't exist in `src/ui/tokens.css`, the computed value is empty (CSS silently falls back), L2 unit tests that check getComputedStyle fail, and Playwright visual assertions fail. Worse, some components would render with *no* background or text color and look visually broken.

**Affected files**:

- `.claude/orchestration-design-rework/tasks/phase-DR-6/task-DR-6-1.md` (authoritative canonical list, lines 282–336)
- `.claude/skills/design-tokens-dark-palette/SKILL.md` (diverges from DR-6.1)
- `.claude/skills/custom-param-components/SKILL.md` (diverges from both)
- `.claude/skills/jetbrains-mono-self-hosting/SKILL.md` (introduces `--font-mono`)
- `.claude/orchestration-design-rework/tasks/phase-DR-7/task-DR-7-1.md` (Button CSS)
- `.claude/orchestration-design-rework/tasks/phase-DR-8/task-DR-8-4.md` (cards restyle)
- `.claude/orchestration-design-rework/tasks/phase-DR-8/task-DR-8-5.md` (PresetStrip CSS)

**Concrete drift (a sampling — full audit needed)**:

| Role | DR-6.1 (`tokens.css`) | design-tokens skill | custom-param-components skill | jetbrains-mono skill | DR-7.1 / DR-8.4 / DR-8.5 task CSS |
|---|---|---|---|---|---|
| Panel surface | `--color-panel` | `--color-surface` | `--color-panel` | — | `--color-panel` (OK) |
| Primary text | `--color-text-primary` | `--color-text` | `--color-primary-text` (!) | — | `--color-text-primary` (DR-6.3, cards); `--color-primary-text` (DR-7.1 Button `::before`) |
| Disabled text | `--color-text-disabled` | `--color-text-hint` | — | — | — |
| Primary btn BG | `--color-button-primary-bg` | `--color-btn-primary-bg` | `--color-primary-bg` | — | — |
| Primary btn text | `--color-button-primary-text` | `--color-btn-primary-text` | — | — | — |
| Secondary btn BG | `--color-button-secondary-bg` | `--color-btn-secondary-bg` | — | — | `--color-btn-secondary-bg` (DR-7.1 — drift from DR-6.1) |
| Secondary btn hover | `--color-button-secondary-bg-hover` | `--color-btn-secondary-bg-hover` | — | — | `--color-btn-secondary-hover-bg` (DR-7.1 — typo'd drift); `--color-button-secondary-hover` (DR-8.4 card-retry — also drift); `--color-button-secondary-hover` (DR-8.5 PresetStrip) |
| Focus ring | `--color-focus-ring` | `--color-accent-focus` | — | — | `--color-focus-ring` (DR-7.1); `--color-focus` (DR-8.4 card-retry, DR-8.5 PresetStrip — drift) |
| Radius 0 | `--radius-0` | `--radius-none` | `--radius-0` | — | `--radius-0` |
| Font family | `--font-family` | — | `--font-family` | `--font-mono` (!) | `--font-family` (consistent everywhere except the jetbrains skill) |
| Text-button color | — (not defined) | `--color-btn-text` / `--color-btn-text-hover` | — | — | Used in DR-7.1 `text` variant as `var(--color-text-muted)` / `var(--color-text-primary)` — OK but skill adds unneeded aliases |

Every row with ≥ 2 different names is a bug — the author of the primitive CSS writes one name; the `tokens.css` file declares another; the browser silently falls back to the inheritable default (often `currentcolor` or the initial value).

**Fix recommendation**: Lock the vocabulary **to DR-6.1** (it is authoritative — it's the first task to create `tokens.css` and its naming has `--color-button-*` (not `--color-btn-*`) + `--radius-0` (not `--radius-none`) + `--color-focus-ring` (not `--color-focus`) + `--color-text-primary` (not `--color-text`)). Apply these edits:

1. **`.claude/skills/design-tokens-dark-palette/SKILL.md`** — global search-and-replace:
   - `--color-surface` → `--color-panel`
   - `--color-surface-elevated` → (delete row; not in DR-6.1 scope)
   - `--color-text` → `--color-text-primary`
   - `--color-text-hint` → `--color-text-disabled`
   - `--color-btn-primary-bg` → `--color-button-primary-bg`
   - `--color-btn-primary-text` → `--color-button-primary-text`
   - `--color-btn-secondary-bg` → `--color-button-secondary-bg`
   - `--color-btn-secondary-bg-hover` → `--color-button-secondary-bg-hover`
   - `--color-btn-secondary-text` → (delete; DR-6.1 uses `--color-text-primary` inheritance)
   - `--color-btn-text` / `--color-btn-text-hover` → (delete; use `--color-text-muted` + `--color-text-primary` directly)
   - `--color-accent-focus` → `--color-focus-ring`
   - `--color-selection-bg` / `--color-selection-text` → (delete; DR-6.1 has no selection tokens — or add them to DR-6.1)
   - `--radius-none` → `--radius-0`
   - `--font-weight-bold` → `--font-weight-semibold` (DR-6.1 uses `regular/medium/semibold` — no `bold`)

2. **`.claude/skills/custom-param-components/SKILL.md`** — global search-and-replace:
   - `--color-primary-text` / `--color-primary-bg` → `--color-button-primary-text` / `--color-button-primary-bg`

3. **`.claude/skills/jetbrains-mono-self-hosting/SKILL.md`** — rename `--font-mono` to `--font-family` to match DR-6.1. (Also fix the path — see CRITICAL-02.)

4. **`task-DR-7-1.md`** Button CSS (lines 137, 141, 145):
   - `--color-btn-secondary-bg` → `--color-button-secondary-bg`
   - `--color-btn-secondary-hover-bg` → `--color-button-secondary-bg-hover`

5. **`task-DR-8-4.md`** (lines 272, 281, 286):
   - `--color-button-secondary-hover` → `--color-button-secondary-bg-hover`
   - `--color-focus` → `--color-focus-ring`

6. **`task-DR-8-5.md`** (lines 360, 362, 366, 371):
   - `--color-focus` → `--color-focus-ring`
   - `--color-button-secondary-hover` → `--color-button-secondary-bg-hover`

7. **Optional but recommended**: add an L1 grep check to the DR-6.1 task file's validation loop that fails the task if any `var(--color-…)` / `var(--radius-…)` / `var(--space-…)` / `var(--duration-…)` / `var(--ease-…)` / `var(--font-…)` reference resolves to an undeclared custom property. Example:

```bash
# Extract every `var(--x)` reference from src/ and verify each --x is declared
declared=$(grep -oE -- '--[a-z0-9-]+:' src/ui/tokens.css | tr -d ':')
referenced=$(grep -rhoE 'var\(--[a-z0-9-]+' src/ --include='*.css' --include='*.tsx' --include='*.ts' | sed 's/var(//')
for ref in $referenced; do
  grep -qx "$ref" <<< "$declared" || { echo "undeclared: $ref"; exit 1; }
done
```

---

### CRITICAL-02 — tokens.css path drift (`src/ui/tokens.css` vs `src/styles/tokens.css`)

**Severity**: Critical. Execution agents read the skill, create the file at the wrong path, then downstream tasks fail to import it.

**Affected files**:

- `.claude/skills/design-tokens-dark-palette/SKILL.md` lines 35, 38, 369 — says `src/styles/tokens.css` and `src/styles/tokens.ts`.
- `.claude/skills/jetbrains-mono-self-hosting/SKILL.md` line 163 — says `src/styles/tokens.css`.
- `.claude/skills/custom-param-components/SKILL.md` line 44 — says `src/ui/tokens.css` (matches DR-6.1).
- `.claude/orchestration-design-rework/tasks/phase-DR-6/task-DR-6-1.md` — unambiguously specifies `src/ui/tokens.css` + `src/ui/tokens.ts` (with `src/index.css` doing the `@import "./ui/tokens.css"`).

**Fix recommendation**: Global replace in the two skills:
- `src/styles/tokens.css` → `src/ui/tokens.css`
- `src/styles/tokens.ts` → `src/ui/tokens.ts`

(8 occurrences in `design-tokens-dark-palette`, 2 in `jetbrains-mono-self-hosting`.)

---

### CRITICAL-03 — `__handTracker` dev-hook API drift (methods that don't exist in the current `devHooks.ts`)

**Severity**: Critical. Multiple L4 specs call dev-hook methods that ARE NOT defined in `src/engine/devHooks.ts`. The Playwright evaluator returns `undefined`, the assertion chains on an undefined, Playwright throws, the test fails.

**Missing methods (and the tasks that call them)**:

| Called method | Reality in `devHooks.ts` | Task files that rely on it |
|---|---|---|
| `__handTracker?.paramSnapshot()?.foo` | No `paramSnapshot`. Dev hook exposes `__handTracker.__engine.getParam('foo')` (single dot-path). | DR-8.1 (line 348), DR-8.2 (lines 507, 517), DR-8.3 (line 470), DR-8.6 (line 537), DR-8.R (lines 278, 289, 297, 361), DR-7.R (line 230, indirect via showcase `useParam`) |
| `__handTracker?.modulationSnapshot()?.routes` | No `modulationSnapshot`. Engine exposes no modulation-snapshot dev-hook at all today. | DR-8.3 (line 462), DR-8.R (line 307) |
| `__handTracker?.savePreset('X')` | No `savePreset`. Presets are saved only by the PresetStrip UI → `savePreset` module function. | DR-8.5 (line 451) |
| `__handTracker?.forceCameraState('USER_DENIED')` | No `forceCameraState`. Camera state is driven by `useCamera` reading real permissions. | DR-8.4 (line 349), DR-8.7 (line 253), DR-8.R (line 370) |

**Fix recommendation**: Two equally valid paths — **pick one and lock it in before the Ralph loop runs**.

**Option A (simpler, no source changes)**: Rewrite the Playwright evaluators to use the dev-hook API that actually exists. Examples:

- `(window as any).__handTracker?.paramSnapshot()?.mosaic?.tileSize`
  → `(window as any).__handTracker?.__engine?.getParam('mosaic.tileSize')`
- `(window as any).__handTracker?.paramSnapshot()?.grid?.widthVariance`
  → `(window as any).__handTracker?.__engine?.getParam('grid.widthVariance')`
- `(window as any).__handTracker?.savePreset('X')` — delete this call; instead drive the Save As button via Playwright UI (DR-8.5 already drives it elsewhere, so the UI path is proven).
- For `forceCameraState` and `modulationSnapshot`: these capabilities don't exist. Either replace the tests with UI-driven paths (DR-9.2 shows exactly how to force each camera state via `addInitScript` stubs — reuse that pattern in DR-8.4 / DR-8.7 / DR-8.R; for modulation snapshot, read the count via UI via `page.getByTestId(/^modulation-route-\d+$/).count()`).

**Option B (cleaner but requires a small engine change)**: Extend `src/engine/devHooks.ts` to add these 4 methods. The engine lock (DISCOVERY §8) permits this — the dev hook is strictly additive and tree-shaken in production. Add to `SHOULD_EXPOSE` block, with a sibling import of `modulationStore` + `useCamera`'s state-setter, plus a call into `presets.ts`. New task DR-7.0 or prepended to DR-6.R. Concretely:

```ts
// src/engine/devHooks.ts (extensions)
import { modulationStore } from './modulationStore';
import { paramStore } from './paramStore';
import { savePreset as savePresetImpl } from './presets';
// For forceCameraState, add a setter to useCamera (or a module-level override
// in cameraState.ts); DR-9.2 forces via addInitScript stubs — that's orthogonal.

function paramSnapshot(): ParamState {
  return paramStore.snapshot;
}
function modulationSnapshot(): ModulationStoreState {
  return modulationStore.getSnapshot();
}
function savePreset(name: string): void {
  savePresetImpl(name);
}
// forceCameraState is more invasive; recommend Option A for that one.

// inside SHOULD_EXPOSE block:
w.__handTracker = {
  ...existing,
  // ...existing fields...
  paramSnapshot,
  modulationSnapshot,
  savePreset,
};
```

**Recommendation**: **Option A for `paramSnapshot` / `modulationSnapshot` / `savePreset`** (the existing `__engine.getParam` path is already wired; less scope to cover). **Option A for `forceCameraState`** too — DR-9.2 already replaces the URL-param fallback with JS-level stubs; reuse that pattern everywhere. The tasks that currently call `forceCameraState` should be rewritten to use `context.route` / `addInitScript` patterns like DR-9.2 does.

Either way, every task file in this list needs its L4 spec rewritten before Ralph runs, or the tasks will false-fail on first iteration and burn Ralph iterations.

---

### CRITICAL-04 — `useParam<T>(key)` generic signature mismatch

**Severity**: Critical. DR-7.7 defines the hook signature as `useParam<K extends ParamKey>(key: K): [ParamValue<K>, (next: ParamValue<K>) => void]` — the generic is the **key**, and the value type is derived. Multiple consumer task files call it with `useParam<number>(...)` or `useParam<string>(...)` — that's **passing the value type as the key-type generic**, which fails TypeScript compilation because `number` does not extend `ParamKey` (`ParamKey` is a union of string literals).

**Affected files**:

- `task-DR-7-R.md` line 69 — `useParam('mosaic.tileSize')` (OK, no generic)
- `task-DR-8-1.md` line 290 — `useParam<number>('mosaic.tileSize')` ❌
- `task-DR-8-2.md` lines 325–341 — 12 calls, all of the form `useParam<number>('grid.seed')`, `useParam<boolean>('input.mirrorMode')`, etc. ❌ all fail
- `.claude/skills/custom-param-components/SKILL.md` lines 105–107 — `useParam<number>('mosaic.tileSize')` ❌
- Research section of DR-8.3: `useParam<boolean>('enabled')` implied — actually DR-8.3 uses `modulationStore` directly, OK

**Fix recommendation**: Either (a) update DR-7.7's hook signature to match the skill's simpler `useParam<T>(dotPath: string): [T, (v: T) => void]` form (less type safety but matches consumer sites verbatim), or (b) update every consumer in DR-8.1 / DR-8.2 / skill to drop the generic and rely on inference (which yields `ParamValue<'mosaic.tileSize'>` = `number` automatically).

**Recommended**: (b). DR-7.7 is the strongest typing and the whole point is to prevent key typos. Edit the consumer task files to use:

```tsx
// DR-8.1 CellSizePicker.tsx
const [tileSize, setTileSize] = useParam('mosaic.tileSize'); // no generic
```

and the skill's sample code similarly. This drops the explicit type annotation and lets the hook's `ParamValue<K>` infer the right type.

Also: update `src/ui/primitives/Segmented.tsx` call site in `CellSizePicker.tsx` (DR-8.1 lines 290–291) — it passes `value={active}` where `active` can be `number | undefined`, but DR-7.2's `SegmentedProps<V>.value: V` is NOT optional (V extends string | number). The `<Segmented>` will reject an `undefined`. Fix by either:
- Changing `SegmentedProps<V>.value` to `V | undefined` in DR-7.2 and handling the "no bucket selected" rendering case inside `Segmented.tsx`, or
- Clamping to a bucket in CellSizePicker (e.g. round to nearest bucket value) — lossy, so reject.

Recommended: update DR-7.2's signature to `value: V | undefined` and document the un-selected rendering path.

---

### CRITICAL-05 — DR-8.2 creates a duplicate `LayerSection` component that shadows DR-7.6's

**Severity**: Critical. DR-7.6 creates `src/ui/primitives/LayerCard.tsx` which exports both `LayerCard` and `LayerSection` with this signature:

```ts
export type LayerSectionProps = {
  heading?: string;
  children: ReactNode;
  withDivider?: boolean;
  testid?: string;
};
```

DR-8.2 **also creates** `src/ui/LayerSection.tsx` (a separate file) with a DIFFERENT signature:

```ts
export type LayerSectionProps = {
  title: string;       // renamed from heading
  testId: string;      // required, renamed testid → testId
  action?: ReactNode;
  children: ReactNode;
};
```

This is contract drift: `heading` vs `title`, `testid` vs `testId` (casing!), optional vs required testId. Downstream (DR-8.3, DR-7.R showcase) uses `<LayerSection heading="Grid">` (DR-7.6 form) but DR-8.2's `<LayerSection title="Grid" testId="layer-card-grid">` (DR-8.2 form). Fresh execution agents will either (a) import from the wrong file, or (b) TypeScript will fail at the point the two are mixed.

**Affected files**:
- `.claude/orchestration-design-rework/tasks/phase-DR-7/task-DR-7-6.md` (DR-7.6 LayerSection, in `src/ui/primitives/LayerCard.tsx`)
- `.claude/orchestration-design-rework/tasks/phase-DR-7/task-DR-7-R.md` line 121–127 — calls `<LayerSection heading="Grid">…</LayerSection>`
- `.claude/orchestration-design-rework/tasks/phase-DR-8/task-DR-8-2.md` (creates DIFFERENT `src/ui/LayerSection.tsx`)

**Fix recommendation**: Delete the DR-8.2 LayerSection wholesale. Reuse DR-7.6's `LayerSection`. Update DR-8.2:

1. Remove `CREATE src/ui/LayerSection.tsx` + `src/ui/LayerSection.module.css` from the desired tree (lines 220–221).
2. Import from `./primitives/LayerCard`:
   ```tsx
   import { LayerCard, LayerSection } from './primitives/LayerCard';
   ```
3. Rename `testId` → `testid` and `title` → `heading` in the Step 1 & 2 Show LayerSection code snippets.
4. DR-8.2's `Row` helper (a label/control two-column row) IS net-new and belongs in a separate file, e.g. `src/ui/LayerRow.tsx`. Move it there.

Related: DR-7.6's `LayerCard` supports an `action?: ReactNode` slot — DR-8.2 mentions `action` as well. DR-8.2's section-header has an optional trailing action. The two can coexist via DR-7.6's existing `action` prop on `LayerCard` (shown in the `LayerCard` header area) and a new section-level action slot if needed. DR-8.2 should call this out.

Also: DR-7.6's `LayerCard` header uses `<h2>` for title; DR-8.2's `LayerSection` uses `<span>` — keep them different heading levels (`h2` for card, `h3` for section) for a11y.

---

### CRITICAL-06 — Duplicate `<Button variant="primary">` testid in DR-7.R showcase (and the L4 spec depends on `.first()`)

**Severity**: Critical. DR-7.1 sets default `data-testid` to `button-${variant}`. DR-7.R's Showcase renders TWO `<Button variant="primary">` — "Record" and the `disabled="true"` "Disabled" button — both with default testid `button-primary`. The showcase E2E at DR-7.R line 222 does `page.getByTestId('button-primary').first()` which silently picks the first match. But the second test at line 230 calls `page.getByTestId('showcase-use-param').getByRole('button', { name: /Toggle 16/i })` — that one is fine since it's scoped.

Worse, DR-7.R also renders `<Button variant="secondary">` multiple times (inside LayerCard showcase, `+ Add route` inside MOD card, etc.) — same duplicate-testid issue.

**Affected**: `task-DR-7-R.md` lines 80–84 (showcase JSX with two `variant="primary"`), line 222 L4 spec.

**Fix recommendation**: Either (a) set explicit `testid` props in the showcase to disambiguate:

```tsx
<Button variant="primary" testid="showcase-record">Record</Button>
<Button variant="primary" disabled testid="showcase-disabled">Disabled</Button>
```

Or (b) scope the L4 assertions to their parent sections. Recommend (a) because the showcase is a QA surface; explicit testids are valuable.

---

## HIGH issues (cross-task drift that would cause test failures)

### HIGH-01 — `Segmented.value` not optional, but CellSizePicker needs to pass `undefined` for "no bucket selected"

**Severity**: High. See CRITICAL-04's closing note. DR-7.2 declares `value: V` required; DR-8.1 Cell-picker passes `undefined` when the current `mosaic.tileSize` is between buckets (e.g. 12 from a modulation route). TypeScript rejects; no graceful "nothing selected" render path.

**Fix**: Update DR-7.2 to `value: V | undefined` and document the unselected render (no `.label` has `font-weight: 600`, no `aria-checked="true"`).

---

### HIGH-02 — Slider/ColorPicker/Toggle `ariaLabel` prop is required; DR-8.2 consumers don't pass it

**Severity**: High. DR-7.3 Slider `SliderProps.ariaLabel: string`, DR-7.4 Toggle `ToggleProps.ariaLabel: string`, DR-7.5 ColorPicker `ColorPickerProps.ariaLabel: string`. DR-7.6 LayerCard `title: string` — no ariaLabel needed. DR-8.2's LayerCard1 implementation block (lines 350–410) calls:

- `<Slider min={0} max={65535} step={1} value={seed} onChange={setSeed} />` — **no ariaLabel** ❌ (many more like this)
- `<ColorPicker value={lineColor} onChange={setLineColor} />` — **no ariaLabel** ❌
- `<Toggle checked={mirror} onChange={setMirror} ariaLabel="Mirror" />` — OK

**Fix**: Update DR-8.2 Step 2 code snippet to add `ariaLabel` to every Slider + ColorPicker call, using the row's `label` string (e.g. `ariaLabel="Seed"`). Alternatively, relax the type in DR-7.3 / DR-7.5 — but that degrades a11y, not recommended.

---

### HIGH-03 — DR-8.3 ModulationCard uses `collapsedByDefault` but DR-7.6 LayerCard prop is `defaultCollapsed`

**Severity**: High. DR-7.6 (the LayerCard primitive) defines prop `defaultCollapsed?: boolean`. DR-8.3 line 401 uses `<LayerCard title="MODULATION" collapsible collapsedByDefault action={...}>` — typo. TypeScript will flag an extraneous prop + `defaultCollapsed` defaults to `false` and the card renders OPEN by default (contradicts DR8 lock: "collapsed by default").

**Fix**: In `task-DR-8-3.md` line 401, rename `collapsedByDefault` → `defaultCollapsed`.

---

### HIGH-04 — Moving `panel-root` from Panel.tsx to Sidebar (`<aside>`) may break chained selectors in pre-existing specs

**Severity**: High. `panel-root` currently sits on the Tweakpane wrapper `<div>` (src/ui/Panel.tsx). DR-8.2 moves it onto the sidebar `<aside>`. Any pre-existing E2E spec that does `page.locator('[data-testid="panel-root"] .tp-dfwv')` (Tweakpane class selector under panel-root) silently fails — the Tweakpane DOM is gone.

**Check**: 
- `tests/e2e/panel.spec.ts` exists (parent project) — verify it only asserts `toBeVisible()` on `panel-root`, not on Tweakpane-specific children.
- `tests/e2e/phase-4-regression.spec.ts` — check if any assertion under `panel-root` chains through Tweakpane classes.

**Fix recommendation**: The main agent should run `grep -rn 'panel-root' tests/e2e/ | grep -v 'toBeVisible\|toContainText\|grantPermissions'` before starting DR-8.2 and list any chained selectors in a dedicated pre-flight note. If there are any, either update the spec in the same DR-8.2 PR, or add a one-line task to DR-8.R that rewrites them. Do NOT let Ralph discover this on iteration 3 of DR-8.2 and waste a week.

The new testid `params-panel` also moves — same audit applies.

---

### HIGH-05 — `useParam` implementation in custom-param-components skill lacks the subscription-isolation logic specified in DR-7.7

**Severity**: High. The skill's `useParam` (lines 70–99 of `custom-param-components/SKILL.md`) is the "naive" form:

```ts
const snapshot = useSyncExternalStore(paramStore.subscribe, ...);
const value = readDotPath(snapshot, dotPath);
```

This re-renders the consumer on EVERY paramStore change (because the top-level snapshot reference changes on any mutation). DR-7.7's blueprint (lines 107–144) specifies a MORE careful implementation that compares `Object.is(next, lastValueRef.current)` inside the subscribe callback and swallows notifications for sibling keys. DR-7.7's Acceptance Criteria line 247 explicitly says "Re-renders only the consumer when its specific key changes (verified by a render-count test)".

If the skill is read as authoritative, the execution agent implements the naive form, the render-count test fails, Ralph iterates to fix it.

**Fix**: Update the skill to match DR-7.7's implementation (paste the stabilised implementation from lines 107–144). Or flip it: update DR-7.7's acceptance criteria to drop the "only re-render on specific key change" requirement and accept whole-snapshot re-renders. Recommend keeping DR-7.7 authoritative (the isolation matters for perf) and updating the skill.

---

### HIGH-06 — DR-8.4 references `errorStates.spec.ts` + DR-9.2 also touches `tests/e2e/error-states.spec.ts` (note the hyphen). Possible file-name collision.

**Severity**: High. DR-8.4 validation loop grep: `pnpm test:e2e --grep "errorStates"` (line 398) — but `--grep` matches describe blocks, not filenames. So that grep currently matches no tests (unless the existing `errorStates.spec.ts` has a describe block literally containing "errorStates"). Check.

DR-9.2 creates `tests/e2e/error-states.spec.ts` (hyphenated). The existing repo has `tests/e2e/errorStates.spec.ts` (camelCase). DR-9.2 line 25 says it "rewrites" the file — but at a different path (hyphenated vs camelCase).

**Fix**:
1. DR-9.2 clarify: does it rename `errorStates.spec.ts` → `error-states.spec.ts`, or does it create a new file and leave the old one? If rename, add `git mv tests/e2e/errorStates.spec.ts tests/e2e/error-states.spec.ts` to Step 2. If create-new, document that the old file is legacy and will coexist. Recommend: rename.
2. DR-8.4 fix the validation grep: `--grep "Task 1\\.2:"` (if the existing spec has that describe prefix) or just run the spec by filename: `pnpm test:e2e tests/e2e/errorStates.spec.ts`.

---

### HIGH-07 — DR-8.4's instruction to wrap card body with `<div class="card-panel">` is a breaking structural change not listed in testid preservation

**Severity**: High. DR-8.4 Step 2 says PrePromptCard.tsx + ErrorStates.tsx both gain a `<div className="card-panel">` wrapper inside the `.card` root. DISCOVERY DR14 says "restyle, keep structure; existing `role`, `aria-live`, testids preserved exactly (E2E tests must continue to pass)." Wrapping children in a new div IS a structural change, and:

- Any existing spec that does `page.locator('[data-testid="error-state-card-PROMPT"] > h2')` (direct child selector) will fail because the `<h2>` is now a grandchild.
- The role + aria-live + testid stay on the outer `.card`, so toBeVisible checks still pass. Only chained DOM-structure selectors fail.

**Fix**: Two options:
1. (Preferred) Drop the wrapper; apply `.card-panel` styling directly to `.card` via a shared modifier class on the existing element. Keeps the DOM tree shape.
2. (Acceptable) Keep the wrapper, and update any chained E2E selectors in the same PR. Requires a grep pre-flight similar to HIGH-04.

Also: the retry button in the DR-8.4 redesign is supposed to hover-animate from `border-radius: 0` → `var(--radius-pill)` (DR11), but the current cards' retry button has `border-radius: 6px` at rest. That transition is correct (from 0 not from 6), so the initial render "flattening" is intentional — flag in the CHANGELOG.

---

### HIGH-08 — DR-7.R Showcase's `const [tileSize, setTileSize] = useParam('mosaic.tileSize')` runs at Showcase render time, but the showcase is **dev-only** with NO surrounding app

**Severity**: High. DR-7.R Showcase renders `<Toggle … useParam('mosaic.tileSize')…>`. But `/primitives` dev route per the skill is rendered INSTEAD of `<App />` (Step 2 in DR-7.R). In this route, `paramStore` is never seeded (parent `main.tsx` calls `initializePresetsIfEmpty()` + `registerManifest(handTrackingMosaicManifest)` only when rendering `<App />`).

If Showcase mounts without registering the mosaic manifest, `paramStore.snapshot` is the empty initial state (no `mosaic` section), `useParam` returns `undefined`, the `<p>Current: {tileSize}</p>` renders `Current: ` (no value), and clicking the toggle button calls `setTileSize(16)` which throws because `paramStore.set` rejects unknown paths (depending on the implementation).

**Fix**: DR-7.R Step 2 should seed the paramStore before rendering Showcase:

```tsx
if (import.meta.env.DEV && window.location.pathname === '/primitives') {
  import('./ui/primitives/Showcase').then(async ({ Showcase }) => {
    // Seed paramStore so useParam demo doesn't read undefined.
    const { registerManifest } = await import('./engine/registry');
    const { handTrackingMosaicManifest } = await import('./effects/handTrackingMosaic');
    registerManifest(handTrackingMosaicManifest);
    root.render(<StrictMode><Showcase /></StrictMode>);
  });
}
```

Also document this in DR-7.R Step 1 caveats.

---

### HIGH-09 — DR-8.3 ModulationRow imports `./BezierEditor` but no task creates a BezierEditor file

**Severity**: High. DR-8.3 line 292 imports `import { BezierEditor } from './BezierEditor'` but DR-8.3's "Files to Create" list (line 183–189) only lists `ModulationCard.*` and `ModulationRow.*`. Step 3 describes the BezierEditor inline but doesn't add it to the create-list. TypeScript fails to resolve the import.

**Fix**: Add `CREATE src/ui/BezierEditor.tsx` + `src/ui/BezierEditor.module.css` to the DR-8.3 desired-tree block, with acceptance criteria + unit tests. Alternately, inline BezierEditor inside `ModulationRow.tsx` and remove the external import.

---

### HIGH-10 — Stage.css modification is engine-adjacent; DR-8.6 edits it explicitly

**Severity**: Medium-High. DISCOVERY §8 locks `src/engine/`, `src/effects/`, `src/camera/`, `src/tracking/`. `src/ui/Stage.tsx` + `src/ui/Stage.css` are in `src/ui/` — technically chrome, per current-ui-audit §7 — so editing Stage.css is OK. But Stage.tsx owns the render loop, the ogl lifecycle, and the context-loss handlers. If DR-8.6's proposed change (`position: fixed` → `position: relative; flex: 1 1 0`) changes the computed size on the render target between mounts, the resize observer + WebGL viewport calculation can drift.

**Fix recommendation**: The task file is correctly scoped, but add a verification step: after DR-8.6 modifies Stage.css, confirm that `stage-visual.spec.ts` (if it exists) or `phase-3-regression.spec.ts` still captures the mosaic at the same aspect ratio. If rendering regressions appear, the fix is to wrap Stage in a flex parent rather than change Stage.css itself.

---

### HIGH-11 — Dev-hook `VITE_EXPOSE_DEV_HOOK` flag not documented in DR task files (partial answer to the user's question #8)

**Severity**: Medium-High. The user asked: "Does anything document the `VITE_DEV_HOOKS` flag disappearance from the parent project's synergy review note, or is that settled?"

The actual flag name is **`VITE_EXPOSE_DEV_HOOK`** (devHooks.ts line 89). None of the DR-* tasks mention it. DR-9.3 is the critical one: when running E2E against the **live Vercel preview URL**, the dev hook is tree-shaken out (line 54 of DR-9.3 confirms this: "Live URL does NOT have `__handTracker` (it is tree-shaken in PROD builds)"). So DR-9.3's spec doesn't use the dev hook — good.

But DR-9.1's `ci.yml` runs `pnpm build --mode test` (not plain `build`) for the L4 step, which keeps the dev hook — also good. DR-9.1's `e2e-preview.yml` runs against the live URL — where `__handTracker` is absent. As long as the preview-URL specs don't call `__handTracker.*`, that's fine.

**Actions needed**:
1. DR-9.1 task file should mention `VITE_EXPOSE_DEV_HOOK=1` as an **optional override** if a preview-URL spec ever needs dev hooks (e.g. the DR-9.3 spec currently doesn't, but DR-8.R's live-smoke note might want it). Add a line to DR-9.1 Gotchas: "To expose the dev hook on a Vercel deploy, set `VITE_EXPOSE_DEV_HOOK=1` as a build env var in the Vercel project. OMIT on prod to keep the bundle clean."
2. CRITICAL-03 above is the bigger issue — tasks calling `paramSnapshot` / `modulationSnapshot` / `savePreset` / `forceCameraState` fail whether the dev hook is exposed or not, because those methods don't exist.

---

## MEDIUM issues (doc inconsistencies, wording drift, low-risk ambiguities)

### MEDIUM-01 — PHASES.md task count drift

**User-asked item**: PHASES.md line 106 says "Total: 23". Actual count: 4 (DR-6) + 8 (DR-7) + 8 (DR-8) + 4 (DR-9) = **24**. Also, PHASES.md §DR-9 scope row says "4" tasks, but the table's header line 105 also claims "4" — OK there. Only the Total row disagrees.

**Fix**: Edit PHASES.md line 106: `| **Total** | | **24** |`. Also update the "Phase Overview" at the top (line 105-106) and the references to "23 DR tasks" in DR-9.R CHANGELOG (line 189 of task-DR-9-R.md: "parent 32 + DR 23 = 55" → "parent 32 + DR 24 = 56"). Ripples into CLAUDE.md "Design Rework" section if that copy is inserted.

---

### MEDIUM-02 — `--duration-medium` = 0.35s (DR-6.1) vs 0.3s (pixelcrash research) — DR-7.6 claims 0.3s

**Severity**: Medium. DR-6.1 task file declares `--duration-medium: 0.35s` (line 334). Pixelcrash research documents height transitions at 0.3s (300ms). DR-7.6 LayerCard No-Prior-Knowledge Test line 429 asserts `--duration-medium == 0.3s`.

**Fix**: Reconcile. Either (a) change DR-6.1 to `--duration-medium: 0.3s` + rename (e.g. `--duration-medium: 0.3s`, `--duration-medium-spring: 0.35s` for the toggle), or (b) accept 0.35s everywhere (toggle AND layer-card height) and fix DR-7.6's acceptance text. Recommend (b) — the 50ms delta is imperceptible, and fewer tokens is better. Update DR-7.6 line 429 to `'0.35s'`.

Also: `--duration-long: 0.5s` is consistent (DR-6.1 line 335; DR-7.6 uses it for content opacity fade).

---

### MEDIUM-03 — `modulationSources` count: 45 vs 48 vs 49

**Severity**: Medium. Source of truth: `src/effects/handTrackingMosaic/manifest.ts` — 21 landmarks × 2 axes + pinch + centroid.x + centroid.y = **45**. DR-8.3 line 332 says "45 landmark + pinch + centroid (= 48 options)" — 42 + 3 = 45, so the arithmetic is wrong AND the final count is wrong. `custom-param-components` skill line 353 says "45 options (21 landmarks × x/y) + pinch + centroid.x + centroid.y = 45" — arithmetic consistent at the end but earlier text "48 modulation sources" (DR8.3 line 51) contradicts.

**Fix**: Update DR-8.3 line 332: "48 options" → "45 options"; line 51 similarly. Update custom-param-components skill line 542: `45+2+2` → `42+1+2` (or `45`). Quick global grep for "48 modulation" / "49 modulation" in all task + skill files.

---

### MEDIUM-04 — Skill file references to `.claude/orchestration-design-rework/skills/` in DR-6 tasks

**Severity**: Medium. DR-6.1, DR-6.2, DR-6.3, DR-6.R all reference skill paths like `.claude/orchestration-design-rework/skills/design-tokens-dark-palette/SKILL.md`. That folder exists but is **empty**. The actual skills live at `.claude/skills/design-tokens-dark-palette/SKILL.md`. DR-7.x + DR-8.x + DR-9.x tasks correctly use `.claude/skills/…`.

Moreover, each DR-6 task's "Note" clause handles this gracefully: "may not exist yet (authored in parallel). If the file is missing at iteration 1, log it in the Ralph state file … and continue".

**Fix**: Global replace in `task-DR-6-{1,2,3,R}.md`:
- `.claude/orchestration-design-rework/skills/design-tokens-dark-palette/SKILL.md` → `.claude/skills/design-tokens-dark-palette/SKILL.md`
- `.claude/orchestration-design-rework/skills/jetbrains-mono-self-hosting/SKILL.md` → `.claude/skills/jetbrains-mono-self-hosting/SKILL.md`

(5 occurrences total.)

---

### MEDIUM-05 — DR-6.1 adds padding to `.app-shell` (`padding: var(--space-24)`), but `.app-shell` is the outer flex container — Stage.tsx is `position: fixed inset: 0` which ignores it

**Severity**: Medium. Currently `.app-shell { padding: 24px }` pushes the PresetBar / RecordButton (when they are fixed-pos) into a 24px-padded zone. After DR-8.6, Stage is no longer `position: fixed` and Sidebar is flex-inline. `.app-shell { padding: var(--space-24) }` adds outer spacing that fights with the toolbar/footer which want to bleed edge-to-edge. Minor layout issue.

**Fix**: DR-8.6 Step 7 adds `.app-layout { display: flex; flex-direction: column; height: 100vh; width: 100vw }` which SIBLINGS `.app-shell`'s padding. Recommend either (a) DR-8.6 Step 7 ALSO sets `.app-shell { padding: 0 }` (scoped via a `:has()` selector or a class-override when GRANTED renders), or (b) DR-6.3 delays the `.app-shell { padding: var(--space-24) }` edit until DR-8.6 so the pre-DR-8.6 layout isn't ambiguously spaced.

Recommend (b): Remove `.app-shell { padding: var(--space-24) }` from DR-6.1 Task 3 (line 371), keep current behavior, and add `.app-shell { padding: 0 }` + `.app-layout { padding: 0 }` as part of DR-8.6 Step 7. Alternatively, embrace the padding as pre-DR-8.6 scaffolding.

---

### MEDIUM-06 — DR-9.2 covers 8 states; PHASES.md §DR-9.2 only enumerates 7

**Severity**: Medium. PHASES.md line 419: "Each of PROMPT, USER_DENIED, SYSTEM_DENIED, DEVICE_CONFLICT, NOT_FOUND, MODEL_LOAD_FAIL, NO_WEBGL has a spec" — 7 items. DR-9.2 task covers 8 (adds GRANTED happy-path assertion). Minor.

**Fix**: Update PHASES.md to list 8, or add a parenthetical "(plus GRANTED happy-path)".

---

### MEDIUM-07 — DR-9.3 Known Gotcha references `reference-assets/pixelcrash-reference.png` as a non-diff target, but DISCOVERY DR4 does mention that path

**Severity**: Medium (clarification-only). DR-9.3's "Do NOT compare against `pixelcrash-reference.png`" is correct — that's a stylistic reference. But DISCOVERY DR4 (line 32) says "Visual-fidelity gate ... adopts the new reference screenshot at `.claude/orchestration-design-rework/reference-assets/pixelcrash-reference.png` instead of `touchdesigner-reference.png`". This is self-contradictory inside DISCOVERY — it names the pixelcrash image as the "new reference" but DR-8.R captures a different file (`reports/DR-8-regression/design-rework-reference.png`) that DR-9.3 correctly targets.

**Fix**: Update DISCOVERY DR4 line 32: replace `pixelcrash-reference.png` with `reports/DR-8-regression/design-rework-reference.png` (which DR-8.R produces) and add a parenthetical "(pixelcrash-reference.png is the stylistic inspiration, NOT the diff target)".

---

### MEDIUM-08 — DR-6.2 vercel.json guidance contradicts the jetbrains-mono skill

**Severity**: Medium. DR-6.2 Task 6 (lines 366–380) says to APPEND a `/fonts/(.*)` entry AFTER the existing `/(.*)` entry, and Vercel "applies ALL matching source entries in order". The `jetbrains-mono-self-hosting` skill (lines 268–295) says to PREPEND the `/fonts/(.*\.woff2)` entry BEFORE the `/(.*)` entry because "Vercel's first-match-wins semantics mean the global block doesn't stack"; the skill also repeats COOP/COEP in the fonts block.

One of these is factually wrong. (Vercel docs: headers are additive when multiple sources match — so DR-6.2's "ALL matching source entries" is correct.)

**Fix**: Align the skill with DR-6.2:
- In `jetbrains-mono-self-hosting/SKILL.md` §8, change "Vercel applies the first matching rule and stops" → "Vercel applies ALL matching rules additively — a file under `/fonts/*` inherits COOP/COEP/CSP from the catch-all entry AND picks up `Cache-Control` from the `/fonts/*` entry".
- Remove the duplicated COOP/COEP lines from the `/fonts/(.*\.woff2)` entry in the skill's example (the catch-all provides them).

---

### MEDIUM-09 — DR-8.5 PresetStrip imports `Pane` from 'tweakpane' — DR-8.6 removes the package but PresetStrip ships first

**Severity**: Medium. DR-8.5 (ships before DR-8.6) imports `import type { Pane } from 'tweakpane'` for the paneRef prop. While tweakpane is still a dep at DR-8.5 time, this import creates a cycle: DR-8.5's PresetStrip survives but DR-8.6 must edit PresetStrip to drop the Pane import. DR-8.6 task file (lines 108, 176) already lists this as a modification — ✓ correctly handled.

Minor alternative: DR-8.5 could skip the Pane import entirely and make `paneRef` a generic `unknown`-typed ref, so DR-8.6 doesn't need to edit PresetStrip.

**No fix required** — DR-8.6 sequence handles it.

---

### MEDIUM-10 — DR-8.7 Footer `<span className={styles.spacer} aria-hidden="true">······</span>` uses a stylistic spacer; DISCOVERY DR18 wording

**Severity**: Low-Medium. DR18 wording: `[hand-tracker-fx v0.1.0] ·················· [Built with MediaPipe, ogl, React]`. That's 18 dots. DR-8.7 Step 1 uses 6 dots (`······`). Stylistic — but PHASES.md and DR-8.R regression caption depend on the literal text.

**Fix**: Pick a number (recommend: `flex: 1` middle span with `letter-spacing: 0.3em` and repeating pattern via CSS pseudo-element so the count is responsive). DR-8.7 Step 1's "6 middle-dot" recommendation + `letter-spacing: 0.3em` is fine — the exact count doesn't visually match DISCOVERY's 18 because DISCOVERY was illustrative. Note this in DR-8.7 as "flex-1 spacer using unicode middle-dot; count visually approximates DISCOVERY's ASCII mock".

---

### MEDIUM-11 — DR-8.4 Step 4 uses `__handTracker.forceCameraState` — see CRITICAL-03

Already covered in CRITICAL-03 but noting here for completeness. DR-8.4 line 350 evaluator will fail; task has a fallback note ("If forceCameraState is unavailable, skip the other 7") but that silently reduces coverage.

---

### MEDIUM-12 — DR-8.R Step 2 `test.step('02 — ..', async () => { await page.waitForTimeout(1000); await page.screenshot(...); })` captures the reference AFTER 01's screenshot but BEFORE 03's mutations. However, the `test.step` API gives all steps shared page state — if any earlier step (01) lands on `GRANTED`, the mosaic HAS been running for 5-10s already. That's fine for capture stability but means the captured reference includes whatever mosaic randomness seeded from time-T. The reference should be reproducible.

**Severity**: Low. Unlikely to break the first capture, but if the seed is re-rolled intentionally elsewhere the reference drifts.

**Fix**: In DR-8.R Step 2, before `page.screenshot`, explicitly set the seed via `__handTracker.__engine.setParam('grid.seed', 42)` so future captures match. Also set `paramStore.replace(DEFAULT)` if available, to reset all params.

---

## LOW issues (nits)

### LOW-01 — DR-7.R Playwright script relies on `concurrently` / `wait-on` npm packages

DR-7.R Step 3 suggests a `test:e2e:dev` script using `concurrently` and `wait-on`. These aren't currently installed. DR-7.R acknowledges this ("If not installed, add them as dev dependencies, OR document the two-terminal approach"). Recommend: don't install them. Document two-terminal.

### LOW-02 — DR-6.1 No-Prior-Knowledge Test expects "No placeholder `<…>` tokens remain in this task file" — the task file itself uses `<…>` in prose. This is a meta-test; leave it.

### LOW-03 — DR-9.R CHANGELOG's "Security" section says `'unsafe-inline' styles (unavoidable for inline style attributes on custom primitives)`. DR-7.x tasks' Anti-Patterns all say "No inline `style={{ }}` hex values". Resolve whether primitives use inline styles at all. Recommend: no inline styles, remove that claim from CHANGELOG.

### LOW-04 — DR-7.4 Toggle Step 2's SVG uses horizontal + vertical lines to draw an "X" (actually draws a "+"). The code comment (line 106) acknowledges the visual ambiguity. Pixelcrash's actual SVG is diagonals. Make the SVG match pixelcrash (diagonals `x1=1 y1=1 x2=9 y2=9` and `x1=1 y1=9 x2=9 y2=1`) so the rotate-to-"+" animation makes visual sense. Low priority — the toggle is 20×20 px, barely visible.

### LOW-05 — DR-7.6 `LayerCard` module CSS has `transition: gap var(--duration-medium) var(--ease-default)` on `.root` but nowhere is `gap` actually animating (the `.collapsed` rule sets `gap: 0` but the property isn't animatable on all browsers). Pixelcrash also transitions `gap`, which IS animatable on Chromium. OK for our Chromium-only target.

### LOW-06 — DR-8.4 and DR-8.5 both target the same testid `preset-name` indirectly? No — `preset-name` is only on DR-8.5. Confirmed no collision.

### LOW-07 — DR-8.3's DEFAULT route references "landmark[8].x" (index finger tip X). DR-8.R regression adds a third route also mapping landmark[8].x → mosaic.tileSize. After DR-8.3's "+ Add route" defaults seed another route on landmark[8].x → mosaic.tileSize, DR-8.R now has THREE routes on the same source→target pair. Modulation store may not deduplicate. Cosmetic.

### LOW-08 — Commit trailer: all task files say `Co-Authored-By: Claude Opus 4.6 (1M context)`. Current session is Opus 4.7. Update CLAUDE.md + all task files if you want accuracy; otherwise keep as parent-project convention.

### LOW-09 — DR-6.2 validation command `pnpm dlx jq '.headers | length' vercel.json` assumes `jq` is available via pnpm dlx. Fine, but `jq` is usually on PATH anyway.

### LOW-10 — DR-6.3 line 291: `grep -c 'var(--' src/index.css` returns ≥ 10 — count sensitive to biome formatting. Loosen to ≥ 8 or drop the count.

### LOW-11 — DR-8.2 Slider for `grid.seed` uses `min=0 max=65535 step=1` (truncated from manifest's 0..2147483647). DR-8.2 Gotcha acknowledges this. Fine, but the Randomize button calls `manifestDef.onClick()` which rolls 0..2147483647 — so the slider value can exceed max and not render the thumb. DR-7.3 Slider: `proportion * 100` is clamped in `toProportion`, so a >max value just renders at 100%. Acceptable.

---

## Cross-project namespace audit (parent-project collisions — user question #5)

Checked systematically:

| Concern | Parent (`orchestration-hand-tracker-fx`) | Design-rework | Collision? |
|---|---|---|---|
| Task-id namespace | `Task 1.1` .. `Task 5.R` | `Task DR-6.1` .. `Task DR-9.R` | **No collision**. `DR-` prefix cleanly disambiguates. |
| Branch names | `task/N-M-…` (e.g. `task/5-2-vercel-deploy`) | `task/DR-N-M-…` (e.g. `task/DR-6-1-design-tokens`) | **No collision**. |
| Commit prefixes | `Task N.M:` (e.g. `Task 5.2:`) | `Task DR-N.M:` | **No collision**. |
| E2E describe prefixes | `describe('Task N.M: …')` | `describe('Task DR-N.M: …')` | **No collision**. `--grep "Task 5\."` matches parent only; `--grep "Task DR-"` matches rework only. |
| `reports/` folder (repo root) | `phase-N-*.md`, `phase-N-*.png`, `phase-N-walkthrough/` | `DR-6-regression/`, `DR-6-regression.md`, `DR-7-regression/`, `DR-8-regression/`, `DR-8-regression.md`, `prp-ralph-final.md` | **No collision** between files. Mild consistency-drift: parent uses `phase-N-regression.md` (hyphen); rework uses `DR-N-regression.md`. Minor — not blocking. |
| `.claude/orchestration-*/reports/` | Parent has `synergy-review-*.md`, `tool-verification.md`, `phase-1-regression.md`, `phase-4-status.md` | Rework: empty `reports/` until this synergy-review lands | **No collision**. |
| `tests/e2e/` | `phase-{1,2,3,4}-regression.spec.ts`, `task-{3,4,5}-*.spec.ts` + category specs | Rework adds `task-DR-6-*`, `task-DR-7-*`, `task-DR-8-*`, `task-DR-9-*`, `DR-{6,7,8}-regression.spec.ts`, `error-states.spec.ts` (rewrites existing `errorStates.spec.ts`), `visual-fidelity.spec.ts`, `DR-7-R-showcase.spec.ts` | **Mild collision**: existing `tests/e2e/errorStates.spec.ts` vs new `tests/e2e/error-states.spec.ts` (see HIGH-06). Otherwise clean. |
| Skills folder | `.claude/skills/*/SKILL.md` (e.g. `hand-tracker-fx-architecture`) | Same folder + 3 new (`design-tokens-dark-palette`, `custom-param-components`, `jetbrains-mono-self-hosting`) | **No collision** — new skill names are distinct. |

Verdict: namespace discipline is clean. No renames or prefixes needed.

---

## Engine-lock audit (user question #9)

DISCOVERY §8 + current-ui-audit §7 lock these paths:
- `src/engine/`
- `src/effects/`
- `src/camera/`
- `src/tracking/`

**Tasks that modify engine paths** (every edit should be flagged):

| Task | Engine edit | Justified? |
|---|---|---|
| DR-7.7 (useParam) | READS from `src/engine/paramStore.ts` and `src/effects/handTrackingMosaic/manifest.ts` | **Yes** — read-only |
| DR-8.3 (ModulationCard) | READS from `src/engine/modulationStore.ts`, `src/engine/modulation.ts`, manifest | **Yes** — read-only |
| DR-8.6 (retire Tweakpane) | DELETES `src/engine/buildPaneFromManifest.ts` + `src/engine/buildPaneFromManifest.test.ts` | **Permitted by DR3** ("`src/engine/buildPaneFromManifest.ts` and `src/ui/ModulationPanel.ts` get retired"). |
| DR-9.2 (error-state stubs) | `src/camera/useCamera.ts` READ ONLY (stubs override browser APIs via `addInitScript`; no source edit) | **Yes** — read-only |
| (hypothetical) CRITICAL-03 Option B | Would EDIT `src/engine/devHooks.ts` | **Dev-hook is additive; arguably permitted as not changing runtime engine semantics. Recommend: Option A (no engine change).** |

No task inadvertently edits `src/effects/handTrackingMosaic/*.ts` or `src/tracking/*.ts` or the renderLoop. `src/ui/Stage.tsx` + `Stage.css` are technically chrome per current-ui-audit §7 (listed explicitly as "CHROME — target for rework" line 224), so DR-8.6's Stage.css edit is acceptable.

**Verdict**: engine lock respected.

---

## PRP Ralph hygiene audit (user question #10)

**L1 / L2 / L3 / L4 completeness across all 24 tasks**:

| Task | L1 | L2 | L3 | L4 | L4 describe-prefix correct? |
|---|---|---|---|---|---|
| DR-6.1 | ✓ | ✓ | ✓ | ✓ (`Task DR-6.1:`) | ✓ |
| DR-6.2 | ✓ | ✓ | ✓ | ✓ (`Task DR-6.2:`) | ✓ |
| DR-6.3 | ✓ | ✓ | ✓ | ✓ (`Task DR-6.3:`) | ✓ |
| DR-6.R | ✓ | ✓ | ✓ | ✓ (`Task DR-6.R:`) | ✓ |
| DR-7.1 | ✓ | ✓ | ✓ | ✓ ("must exit 0 cleanly — no tests expected in this task; describe prefix `Task DR-7.1:` if any") — **ambiguous, acceptable** |
| DR-7.2 | ✓ | ✓ | ✓ | ✓ (same pattern) |
| DR-7.3 | ✓ | ✓ | ✓ | ✓ |
| DR-7.4 | ✓ | ✓ | ✓ | ✓ |
| DR-7.5 | ✓ | ✓ | ✓ | ✓ |
| DR-7.6 | ✓ | ✓ | ✓ | ✓ |
| DR-7.7 | ✓ | ✓ | ✓ | ✓ |
| DR-7.R | ✓ | ✓ | ✓ | ✓ (`Task DR-7.R:`) |
| DR-8.1 | ✓ | ✓ | ✓ | ✓ (`Task DR-8.1:`) |
| DR-8.2 | ✓ | ✓ | ✓ | ✓ |
| DR-8.3 | ✓ | ✓ | ✓ | ✓ |
| DR-8.4 | ✓ | ✓ | ✓ | ✓ |
| DR-8.5 | ✓ | ✓ | ✓ | ✓ |
| DR-8.6 | ✓ | ✓ | ✓ | ✓ |
| DR-8.7 | ✓ | ✓ | ✓ | ✓ |
| DR-8.R | ✓ | ✓ | ✓ | ✓ |
| DR-9.1 | ✓ | ✓ | ✓ (via the PR's CI run itself) | ✓ (via the PR's CI run itself) |
| DR-9.2 | ✓ | ✓ | ✓ | ✓ |
| DR-9.3 | ✓ | ✓ | ✓ | ✓ |
| DR-9.R | ✓ | ✓ | ✓ | ✓ (N/A — no new specs; regression check only) |

All 24 tasks have the four levels present. The DR-7.x primitive tasks deliberately defer L4 to DR-7.R showcase, which is correct.

**Describe-prefix compliance**: Every task L4 spec uses `describe('Task DR-N.M: …')`. No task accidentally uses the parent-project form `describe('Task N.M: …')`. Phase-regression tasks use `describe('Task DR-N.R: …')` consistently.

---

## Evidence of consistency (non-issues, for the main agent's confidence)

- **Testid preservation** — Every relocation of a preserved testid (`panel-root`, `params-panel`, `preset-bar`, `preset-name`, `preset-actions`, `record-button`, `record-elapsed`, 8× `error-state-card-*`) is consistently described across DR-8.2 / DR-8.4 / DR-8.5 / DR-8.6. The intention is clear and matches DISCOVERY §7.
- **Deletion ordering** — `ModulationPanel.ts` deletes in DR-8.3 (before DR-8.6's Panel.tsx delete). `PresetBar.tsx` + `PresetActions.tsx` delete in DR-8.5 (before DR-8.6's wire-up). `Panel.tsx` + `buildPaneFromManifest.ts` delete in DR-8.6. `App.tsx` is rewritten in DR-8.6 — no crash window between tasks because intermediate states (after DR-8.3 still uses Panel.tsx for params) are explicitly called out ("keep Panel.tsx mounted but stop calling buildModulationPage" — DR-8.3 line 83). Good.
- **Archive ordering** — TouchDesigner reference is archived in DR-9.R per DR17. DR-9.R uses `git mv` (preserving history) per spec (DR-9.R line 378). Matches DR17 "move, don't delete".
- **Visual-fidelity target** — DR-9.3 points at `reports/DR-8-regression/design-rework-reference.png` (captured by DR-8.R at 1440×900). Correct. DR-8.R captures it. DR-9.3 `snapshotPathTemplate` wires it correctly.
- **Parent-project Phase 5.3/5.4/5.5/5.R mapping** — DR-9.1/.2/.3/.R each document their parent-task mapping and update PROGRESS.md accordingly.
- **CSP / COOP / COEP discipline** — DR-6.2 (fonts) explicitly does not modify CSP directives. DR-8.6 (Tweakpane retirement) removes a dep but doesn't touch CSP. DR-9.1 verifies via `e2e-preview.yml`.

---

## Fix-application suggestion

Recommendation: **Main agent applies CRITICAL-01 through CRITICAL-06 and HIGH-01 through HIGH-09 inline, BEFORE spawning the first DR-6.1 Ralph subagent.** Reasoning:

1. **Token-name and path drift (CRITICAL-01/02)** will cascade into every single DR-7.x and DR-8.x task as a silent L1/L2 failure. Ralph's self-healing loop WILL get stuck at iteration 5+ trying to reconcile which skill is authoritative. Fix these upfront; it's ~10 search-replace operations across 3 skills + 4 task files.

2. **Dev-hook drift (CRITICAL-03)** will cause all DR-8.x L4 specs to fail on first run. Ralph will waste iterations "fixing" tests that can't possibly work. Fix the specs to use `getParam` chains before Ralph starts. ~15 edits across 6 task files.

3. **useParam generic signature (CRITICAL-04)** is a 15-minute search-replace across 2 task files + 1 skill.

4. **Duplicate LayerSection (CRITICAL-05)** needs a coordinated 3-file edit (DR-8.2 + DR-7.6 + potentially DR-7.R).

5. **Duplicate button testid in Showcase (CRITICAL-06)** is a 5-line edit in DR-7.R.

6. **HIGH issues** — most are 1–3 line edits; apply before Ralph to save total iterations.

7. **MEDIUM + LOW issues** — safe to defer to first-pass Ralph execution; they will either self-heal (e.g. MEDIUM-02 duration typos — biome won't catch, but unit tests comparing `0.3s` vs `0.35s` will surface) or are cosmetic and surface in the DR-8.R regression.

**Specific punts to Ralph execution**:

- MEDIUM-10 (dot count in footer spacer) — a Ralph iteration can tune this based on screenshot.
- MEDIUM-12 (seed reset before reference capture) — DR-8.R can add this on iteration 2 if the first capture is non-reproducible.
- LOW-04 (toggle SVG diagonals) — cosmetic.
- LOW-08 (Claude model-version in commit trailer) — keep as-is; trailing convention.

**Total estimated fix-application effort** if doing it inline: **90–120 minutes of careful edits** (mostly search-and-replace with careful scoping). Compared to a Ralph loop burning 3–5 iterations per CRITICAL issue (~ 30 iterations of 15 min each = 7.5 hours) this is a clear win.

---

## Appendix A — Full canonical token-name set (from DR-6.1) for reference

Use this as the authoritative list when applying CRITICAL-01:

```
Colors (21):
  --color-bg, --color-stage-bg, --color-panel, --color-divider,
  --color-text-primary, --color-text-muted, --color-text-disabled,
  --color-button-primary-bg, --color-button-primary-text,
  --color-button-secondary-bg, --color-button-secondary-bg-hover,
  --color-segmented-unselected, --color-segmented-selected,
  --color-toggle-on, --color-toggle-off,
  --color-slider-track, --color-slider-active, --color-slider-handle, --color-slider-hover,
  --color-accent-record, --color-focus-ring

Spacing (13):
  --space-01, --space-02, --space-04, --space-06, --space-08, --space-10, --space-12,
  --space-16, --space-20, --space-24, --space-32, --space-44, --space-56

Type (10):
  --font-family, --font-size-root,
  --font-size-xs, --font-size-s, --font-size-m, --font-size-l, --font-size-xl,
  --font-weight-regular, --font-weight-medium, --font-weight-semibold,
  --line-height-body, --letter-spacing-body

Radius (3):
  --radius-0, --radius-pill, --radius-circle

Motion (6):
  --duration-fast, --duration-short, --duration-medium, --duration-long,
  --ease-default, --ease-spring
```

**Note**: DR-6.1 includes both `--duration-fast: 0.1s` AND `--duration-short: 0.2s`. Some task files use `--duration-fast` where they probably mean `--duration-short` (200ms for hover — see pixelcrash "0.2s" standard). Audit during fix-application:

- DR-7.1 Button `::before` transition: `transition: border-radius var(--duration-fast) …` — should probably be `--duration-short` (200ms per pixelcrash). Or redefine `--duration-fast` to 0.2s. Decide during fix-application.

---

## Appendix B — Files touched, by severity

**CRITICAL fix scope** (inline edits, before Ralph):

- 3 skill files: `design-tokens-dark-palette/SKILL.md`, `custom-param-components/SKILL.md`, `jetbrains-mono-self-hosting/SKILL.md`
- 6 task files: DR-6.1 (minor: add optional grep validation), DR-7.1, DR-7.6 (no change), DR-7.R, DR-8.1, DR-8.2, DR-8.3, DR-8.4, DR-8.5
- Possibly `src/engine/devHooks.ts` (only if Option B for CRITICAL-03)

**HIGH fix scope**:

- 5 task files: DR-7.2 (relax Segmented.value type), DR-8.2 (ariaLabel), DR-8.3 (fix collapsedByDefault + BezierEditor), DR-8.4 (card-panel wrapper), DR-7.R (seed paramStore in Showcase)

**MEDIUM / LOW**: PHASES.md (count), DISCOVERY.md (DR4 clarification), DR-6.{1,2,3,R} (skill paths), DR-9.R (CHANGELOG numbers).

---

*End of synergy review.*
