# Task DR-7.R: Phase DR-7 Regression — dev-only `/primitives` showcase route

**Phase**: DR-7 — Primitives
**Branch**: `task/DR-7-R-primitives-regression`
**Commit prefix**: `Task DR-7.R:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Close Phase DR-7 by confirming all seven primitive tasks ship green AND by adding a dev-only `/primitives` showcase route that renders every primitive side-by-side with representative props for manual QA and Playwright assertion. The route is gated behind `import.meta.env.DEV` so it NEVER ships to production.

**Deliverable**:
- `src/ui/primitives/Showcase.tsx` — single page rendering Button (×4 variants), Segmented (2/3/5-option), Slider + RangeSlider, Toggle, ColorPicker, LayerCard (always-expanded + collapsible), useParam demo row
- Dev-only routing wiring in `src/App.tsx` OR `src/main.tsx` — `if (import.meta.env.DEV && location.pathname === '/primitives') render(<Showcase />)`
- `tests/e2e/DR-7-R-showcase.spec.ts` — Playwright spec `describe('Task DR-7.R: primitives showcase renders', …)` that navigates to `/primitives`, asserts every primitive's testid is visible, screenshots to `reports/DR-7-regression/primitives-showcase.png`
- `reports/DR-7-regression/primitives-showcase.png` — captured screenshot
- `reports/DR-7-regression.md` — Ralph report summarizing all 7 sub-tasks + L1–L4 status

**Success Definition**: `pnpm biome check . && pnpm tsc --noEmit && pnpm vitest run && pnpm build --mode test && pnpm preview & pnpm test:e2e --grep "Task DR-7"` all exit 0. The showcase renders in dev mode; `pnpm build` (production mode) excludes the Showcase code from the bundle (tree-shaken behind `import.meta.env.DEV`).

---

## Context

This is the gate at the end of Phase DR-7. All seven primitives (DR-7.1 through DR-7.7) must be `done` in PROGRESS.md before this task starts. The showcase is purely a dev affordance — the production bundle must not carry the Showcase bytes. This matches the parent project's pattern of `__handTracker` dev hooks guarded by `import.meta.env.DEV`.

After this task closes, Phase DR-8 (Chrome Integration) assembles these primitives into the final reworked chrome.

## Dependencies

- **DR-7.1** through **DR-7.7** — ALL must be `done` in PROGRESS.md

## Blocked By

- Any DR-7.N with status `not done` or `in progress`

## Research Findings

- **From `.claude/skills/hand-tracker-fx-architecture/SKILL.md`**: dev-only hooks live behind `import.meta.env.DEV` and are tree-shaken in production. The `__handTracker` global is the existing pattern.
- **From `.claude/skills/playwright-e2e-webcam/SKILL.md`**: E2E describe blocks must begin with the task prefix `Task DR-7.R:` so `--grep` resolves cleanly. Tests run against `pnpm preview` (built + previewed) OR `pnpm dev` (raw Vite) — since the showcase is DEV-ONLY, this spec MUST run against `pnpm dev` (port 5173) and NOT `pnpm preview`.
- **From `.claude/skills/vite-vercel-coop-coep/SKILL.md`**: the Showcase page does NOT need the camera; COOP/COEP headers apply but `getUserMedia` is not invoked. Playwright can skip `--use-fake-device-for-media-stream` for this spec.

## Implementation Plan

### Step 1: Showcase component

`src/ui/primitives/Showcase.tsx`:

```tsx
import { useState } from 'react';
import { Button } from './Button';
import { ColorPicker } from './ColorPicker';
import { LayerCard, LayerSection } from './LayerCard';
import { RangeSlider, Slider } from './Slider';
import { Segmented } from './Segmented';
import { Toggle } from './Toggle';
import { useParam } from './useParam';
import styles from './Showcase.module.css';

export function Showcase(): JSX.Element {
  const [segValue, setSegValue] = useState<number>(16);
  const [sliderValue, setSliderValue] = useState<number>(50);
  const [rangeValue, setRangeValue] = useState<readonly [number, number]>([20, 80]);
  const [toggleOn, setToggleOn] = useState<boolean>(true);
  const [hex, setHex] = useState<string>('#00ff88');
  const [tileSize, setTileSize] = useParam('mosaic.tileSize');

  return (
    <main className={styles.root} data-testid="showcase-root">
      <h1 className={styles.title}>Hand Tracker FX — Primitives Showcase</h1>

      <section data-testid="showcase-button">
        <h2>Button</h2>
        <div className={styles.row}>
          <Button variant="primary" testid="showcase-record">Record</Button>
          <Button variant="secondary" testid="showcase-randomize">Randomize</Button>
          <Button variant="text" testid="showcase-delete">Delete</Button>
          <Button variant="icon" aria-label="Close" testid="showcase-close">×</Button>
          <Button variant="primary" disabled testid="showcase-disabled">Disabled</Button>
        </div>
      </section>

      <section data-testid="showcase-segmented">
        <h2>Segmented</h2>
        <Segmented
          ariaLabel="Cell size"
          options={[
            { value: 4, label: 'XS' },
            { value: 8, label: 'S' },
            { value: 16, label: 'M' },
            { value: 32, label: 'L' },
            { value: 64, label: 'XL' },
          ]}
          value={segValue}
          onChange={setSegValue}
        />
      </section>

      <section data-testid="showcase-slider">
        <h2>Slider</h2>
        <Slider min={0} max={100} step={1} value={sliderValue} onChange={setSliderValue} ariaLabel="Demo slider" />
        <h3>RangeSlider</h3>
        <RangeSlider min={0} max={100} step={1} value={rangeValue} onChange={setRangeValue} ariaLabel="Demo range" />
      </section>

      <section data-testid="showcase-toggle">
        <h2>Toggle</h2>
        <Toggle checked={toggleOn} onChange={setToggleOn} ariaLabel="Demo toggle" />
      </section>

      <section data-testid="showcase-color-picker">
        <h2>ColorPicker</h2>
        <ColorPicker value={hex} onChange={setHex} ariaLabel="Demo color" />
      </section>

      <section data-testid="showcase-layer-card">
        <h2>LayerCard</h2>
        <LayerCard title="LAYER 1" action={<Button variant="text">Delete</Button>}>
          <LayerSection heading="Grid">Grid controls…</LayerSection>
          <LayerSection heading="Mosaic">Mosaic controls…</LayerSection>
          <LayerSection heading="Input" withDivider={false}>Input controls…</LayerSection>
        </LayerCard>
        <LayerCard title="MODULATION" collapsible defaultCollapsed>
          <LayerSection heading="Routes">Routes…</LayerSection>
        </LayerCard>
      </section>

      <section data-testid="showcase-use-param">
        <h2>useParam demo (mosaic.tileSize)</h2>
        <p>Current: {tileSize}</p>
        <Button variant="secondary" onClick={() => setTileSize(tileSize === 16 ? 32 : 16)}>
          Toggle 16 ↔ 32
        </Button>
      </section>
    </main>
  );
}
```

Simple styling file `src/ui/primitives/Showcase.module.css` — just stack sections with padding; this is dev chrome, not production UI.

### Step 2: Dev-only route

Preferred: in `src/main.tsx`, guard the render:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const root = createRoot(document.getElementById('root')!);

if (import.meta.env.DEV && window.location.pathname === '/primitives') {
  // Dynamic import keeps production bundles clean.
  import('./ui/primitives/Showcase').then(async ({ Showcase }) => {
    // Seed paramStore so the useParam('mosaic.tileSize') demo has a real value.
    // Without this, tileSize reads as undefined and the Toggle button throws on set.
    const [{ registerManifest }, { handTrackingMosaicManifest }] = await Promise.all([
      import('./engine/registry'),
      import('./effects/handTrackingMosaic'),
    ]);
    registerManifest(handTrackingMosaicManifest);
    root.render(
      <StrictMode>
        <Showcase />
      </StrictMode>,
    );
  });
} else {
  // … existing App render
}
```

Caveat: the dev-only `/primitives` route mounts Showcase in place of `<App />`, so the camera pipeline + modulation store do NOT run here. Only `paramStore` is seeded. The Showcase's `useParam('mosaic.tileSize')` returns the default `16` after seeding.

The dynamic `import()` combined with the `import.meta.env.DEV` check is tree-shaken by Vite in production mode — verify via:

```bash
pnpm build
grep -r "Showcase" dist/  # should return 0 hits
```

### Step 3: Playwright spec

`tests/e2e/DR-7-R-showcase.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';
import path from 'node:path';

test.describe('Task DR-7.R: primitives showcase renders', () => {
  test.beforeEach(async ({ page }) => {
    // This spec runs against `pnpm dev` (port 5173) because the showcase is
    // dev-only and stripped from production bundles.
    await page.goto('http://localhost:5173/primitives');
  });

  test('renders all primitive showcases', async ({ page }) => {
    await expect(page.getByTestId('showcase-root')).toBeVisible();
    for (const id of [
      'showcase-button',
      'showcase-segmented',
      'showcase-slider',
      'showcase-toggle',
      'showcase-color-picker',
      'showcase-layer-card',
      'showcase-use-param',
    ]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }

    await page.screenshot({
      path: path.resolve(__dirname, '../../reports/DR-7-regression/primitives-showcase.png'),
      fullPage: true,
    });
  });

  test('segmented keyboard cycling updates selection', async ({ page }) => {
    const seg = page.getByTestId('segmented').first();
    await seg.getByRole('radio', { name: 'M' }).focus();
    await page.keyboard.press('ArrowRight');
    // Post-cycle L is checked.
    await expect(seg.getByRole('radio', { name: 'L' })).toBeChecked();
  });

  test('button hover transitions border-radius (non-reduced-motion)', async ({ page }) => {
    // Target the explicit showcase-record testid rather than button-primary.first()
    // (two primary buttons exist in the showcase: Record + Disabled).
    const btn = page.getByTestId('showcase-record');
    await btn.hover();
    // Computed style reflects `var(--radius-pill)` resolved.
    const radius = await btn.evaluate((el) => window.getComputedStyle(el, '::before').borderRadius);
    expect(radius).not.toBe('0px');
  });

  test('useParam demo writes through paramStore', async ({ page }) => {
    const btn = page.getByTestId('showcase-use-param').getByRole('button', { name: /Toggle 16/i });
    await expect(page.getByTestId('showcase-use-param').locator('p')).toHaveText(/Current: 16/);
    await btn.click();
    await expect(page.getByTestId('showcase-use-param').locator('p')).toHaveText(/Current: 32/);
  });

  test('layer-card MODULATION chevron toggles', async ({ page }) => {
    const modCard = page.getByTestId('layer-card').nth(1); // MODULATION is second
    const chevron = modCard.getByTestId('layer-card-chevron');
    await expect(chevron).toHaveAttribute('aria-expanded', 'false');
    await chevron.click();
    await expect(chevron).toHaveAttribute('aria-expanded', 'true');
  });
});
```

Run this spec ONLY when a dev server is running. Add a script or Playwright project config:

```json
// package.json script
"test:e2e:dev": "concurrently --kill-others -s first \"pnpm dev --strictPort\" \"wait-on http://localhost:5173 && pnpm playwright test tests/e2e/DR-7-R-showcase.spec.ts\""
```

(If `concurrently` / `wait-on` are not installed, add them as dev dependencies, OR document the two-terminal approach: Terminal 1: `pnpm dev`; Terminal 2: `pnpm playwright test tests/e2e/DR-7-R-showcase.spec.ts`.)

### Step 4: Ralph regression report

`reports/DR-7-regression.md`:

```markdown
# Phase DR-7 Regression Report

**Date**: YYYY-MM-DD
**Branch**: task/DR-7-R-primitives-regression

## Tasks Completed (merged to main)

| Task | Status | Tests | PR |
|---|---|---|---|
| DR-7.1 Button | green | 8/8 | — |
| DR-7.2 Segmented | green | 10/10 | — |
| DR-7.3 Slider | green | 15/15 | — |
| DR-7.4 Toggle | green | 8/8 | — |
| DR-7.5 ColorPicker | green | 8/8 | — |
| DR-7.6 LayerCard | green | 10/10 | — |
| DR-7.7 useParam | green | 12/12 | — |

## Validation Summary

- L1 biome + tsc: PASS
- L2 vitest (all primitive suites + useParam): PASS (N/N)
- L3 build (production): PASS — Showcase confirmed tree-shaken
- L4 e2e (DR-7-R-showcase.spec.ts): PASS

## Manual Screenshot

`reports/DR-7-regression/primitives-showcase.png` captured at 1440×900 in dev mode.

## Notes / Known Issues

- (fill in)
```

## Files to Create

- `src/ui/primitives/Showcase.tsx`
- `src/ui/primitives/Showcase.module.css`
- `tests/e2e/DR-7-R-showcase.spec.ts`
- `reports/DR-7-regression/primitives-showcase.png` (captured by the spec)
- `reports/DR-7-regression.md`

## Files to Modify

- `src/main.tsx` — add the `import.meta.env.DEV && /primitives` guard with dynamic import
- `package.json` — optionally add `test:e2e:dev` script (see Step 3)
- `PROGRESS.md` — mark DR-7.R done when all 4 levels green

## Contracts

### Provides

- Playwright fixtures for DR-8 visual regression reference (the showcase PNG is the pre-chrome baseline).

### Consumes

- All DR-7.N components and their testids.

## Acceptance Criteria

- [ ] `/primitives` route renders in dev mode (`pnpm dev`)
- [ ] `pnpm build` produces a dist/ bundle that contains NO `Showcase` symbol — verify via `grep -r "Showcase" dist/` returns 0 hits
- [ ] L1 + L2 green on full workspace (`pnpm biome check . && pnpm tsc --noEmit && pnpm vitest run`)
- [ ] L3 green (`pnpm build`)
- [ ] L4 green — `pnpm test:e2e --grep "Task DR-7.R:"` passes with dev server running
- [ ] Screenshot `reports/DR-7-regression/primitives-showcase.png` saved
- [ ] `reports/DR-7-regression.md` written and committed
- [ ] PROGRESS.md updated to mark DR-7.R done and Phase DR-7 closed

## Testing Protocol

### L1

```bash
pnpm biome check src/ui/primitives/Showcase.tsx src/ui/primitives/Showcase.module.css src/main.tsx tests/e2e/DR-7-R-showcase.spec.ts
pnpm tsc --noEmit
```

### L2

```bash
pnpm vitest run
```

All primitive test suites should pass (aggregate from DR-7.1–DR-7.7).

### L3

```bash
pnpm build
grep -r "Showcase" dist/  # must return 0 hits
```

### L4

Two-terminal (documented) OR scripted:

```bash
# Terminal 1
pnpm dev

# Terminal 2 (once "Local: http://localhost:5173/" is printed)
pnpm playwright test tests/e2e/DR-7-R-showcase.spec.ts --grep "Task DR-7.R:"
```

Or:

```bash
pnpm test:e2e:dev
```

All spec cases must pass.

### Visual Verification (Playwright MCP)

Run Chromium in Playwright MCP, navigate to `http://localhost:5173/primitives`, capture screenshots of each section, sanity-check:
- Button primary: square at rest, pill on hover (animates)
- Segmented: "/" separators between items, selected is bold + white
- Slider: hairline track, thin vertical thumb at correct proportion, touch area generous
- RangeSlider: two thumbs can't cross
- Toggle ON: bright square; OFF: dark circle; spring on transition
- ColorPicker: swatch 20×20 + uppercase hex text; invalid hex reverts on blur
- LayerCard LAYER 1: no chevron, divider between header and body
- LayerCard MODULATION: chevron collapsed state; click expands with staggered fade

## Skills to Read

- `.claude/skills/custom-param-components/SKILL.md`
- `.claude/skills/design-tokens-dark-palette/SKILL.md`
- `.claude/skills/vitest-unit-testing-patterns/SKILL.md`
- `.claude/skills/prp-task-ralph-loop/SKILL.md`
- `.claude/skills/hand-tracker-fx-architecture/SKILL.md`
- `.claude/skills/playwright-e2e-webcam/SKILL.md` — for the describe-prefix convention and Playwright config
- `.claude/skills/vite-vercel-coop-coep/SKILL.md` — context on why the build strips dev-only code

## Research Files to Read

- `.claude/orchestration-design-rework/research/pixelcrash-design-language.md` — sanity-check the showcase visuals against the research
- `.claude/orchestration-design-rework/research/current-ui-audit.md` — the pre-DR-8 baseline this screenshot predates

## Known Gotchas

```typescript
// CRITICAL: The showcase must be tree-shaken in production. Use BOTH:
//   if (import.meta.env.DEV) { ... }
//   AND dynamic import() inside the guard.
// A static import at module top outside the if() guard WILL include Showcase
// in the prod bundle — Vite's tree-shaking cannot remove side-effectful module
// graph members.

// CRITICAL: The DR-7.R E2E spec does NOT use the fake webcam (no getUserMedia
// in the showcase). Playwright config still sets the flags, but they are
// harmless.

// CRITICAL: The dev server MUST be running on port 5173 when the L4 spec runs.
// `pnpm preview` serves the built bundle (which has the Showcase stripped) —
// tests against preview will fail with 404 at /primitives. Document this
// clearly in the spec comments.

// CRITICAL: Ralph must run L1–L4 on the FULL workspace (not just DR-7 scoped
// paths) at this regression step — this is the phase gate, not a per-file
// check. Use `pnpm biome check .` (dot), `pnpm vitest run` (no path),
// `pnpm build` (full).

// CRITICAL: If any DR-7.N task-level regressions surface here (e.g. LayerCard
// broke Button's focus ring), root-cause fix in the owning task file's
// branch — do NOT patch in DR-7.R. DR-7.R is a gate, not a fixture.
```

## Anti-Patterns

- Do not ship Showcase to production. Always verify `grep -r "Showcase" dist/` returns 0 hits post-build.
- Do not use real camera in the spec. The showcase has no camera dependency.
- Do not add new primitives here. Strictly a regression gate.
- Do not skip the screenshot capture — it's the pre-DR-8 visual baseline.
- Do not patch over failures in upstream DR-7.N task files. Fix at the source.

## No Prior Knowledge Test

- [ ] All seven DR-7.N task files referenced exist under `.claude/orchestration-design-rework/tasks/phase-DR-7/`
- [ ] Every primitive is imported from `src/ui/primitives/<Component>.tsx` at the expected path
- [ ] The `import.meta.env.DEV` guard is documented
- [ ] The screenshot path `reports/DR-7-regression/primitives-showcase.png` is stable and matches the spec's `path.resolve`
- [ ] L1–L4 commands runnable

## Git

- Branch: `task/DR-7-R-primitives-regression`
- Commit prefix: `Task DR-7.R:`
- Trailer: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
- On completion: fast-forward merge to `main`; emit `<promise>COMPLETE</promise>` per Ralph protocol.
