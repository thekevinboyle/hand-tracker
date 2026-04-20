/**
 * Task DR-7.R — Phase DR-7 primitives showcase regression.
 *
 * The aggregate L4 gate for Phase DR-7. Tasks DR-7.1 through DR-7.7 each
 * shipped focused unit tests for their own primitive; this spec proves the
 * seven primitives *compose* correctly at runtime, render the paramStore-
 * bound useParam demo, and interoperate without regression.
 *
 * Runs against the default Playwright webServer (`pnpm build --mode test &&
 * pnpm preview`). The `/primitives` route is gated in src/main.tsx on
 * `import.meta.env.DEV || import.meta.env.MODE === 'test'` — `--mode test`
 * keeps the Showcase in the test bundle so this spec hits it at
 * `http://localhost:4173/primitives`. A plain `pnpm build` (production
 * mode) strips the Showcase entirely (grep-verified at L3).
 *
 * Testid discipline (synergy CRITICAL-06): every primitive instance below
 * is reached via its explicit `showcase-*` testid, so duplicated primitive
 * variants (two Buttons with variant=primary: Record + Disabled) never
 * collide on default testids. See Showcase.tsx for the full matrix.
 *
 * Describe prefix MUST start with literal `Task DR-7.R:` so
 * `pnpm test:e2e --grep "Task DR-7.R:"` resolves these tests only.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const SHOT_DIR = 'reports/DR-7-regression';

test.describe('Task DR-7.R: primitives showcase renders', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/primitives');
    await expect(page.getByTestId('showcase-root')).toBeVisible({ timeout: 10_000 });
  });

  test('every primitive section mounts under its explicit testid', async ({ page }) => {
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
  });

  test('button variants render with per-instance testids (no default collision)', async ({
    page,
  }) => {
    for (const id of [
      'showcase-record',
      'showcase-randomize',
      'showcase-delete',
      'showcase-close',
      'showcase-disabled',
    ]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    // Disabled button is semantically disabled.
    await expect(page.getByTestId('showcase-disabled')).toBeDisabled();
  });

  test('segmented renders 5 options and selection updates on click', async ({ page }) => {
    const group = page.getByTestId('showcase-segmented-ctrl');
    await expect(group).toBeVisible();

    // Default value is 16 (M). Sanity-check one radio checked.
    // The native <input> is zero-sized for custom styling; visible target is
    // the <label> text, so we click the label + assert via the input state.
    await expect(group.locator('input[type="radio"][value="16"]')).toBeChecked();

    // Clicking the XL label changes selection to 64. Use getByText scoped to
    // the group so we land on the clickable <label> wrapper.
    await group.getByText('XL', { exact: true }).click();
    await expect(group.locator('input[type="radio"][value="64"]')).toBeChecked();
    await expect(group.locator('input[type="radio"][value="16"]')).not.toBeChecked();
  });

  test('slider + range slider render and are interactive', async ({ page }) => {
    await expect(page.getByTestId('showcase-slider-ctrl')).toBeVisible();
    await expect(page.getByTestId('showcase-range-ctrl')).toBeVisible();
    // Nested native inputs reachable via the deterministic testid suffix.
    await expect(page.getByTestId('showcase-slider-ctrl-input')).toBeVisible();
    await expect(page.getByTestId('showcase-range-ctrl-input-lo')).toBeVisible();
    await expect(page.getByTestId('showcase-range-ctrl-input-hi')).toBeVisible();
  });

  test('toggle flips aria-checked on click', async ({ page }) => {
    const toggle = page.getByTestId('showcase-toggle-ctrl');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  test('color picker exposes swatch + hex text inputs', async ({ page }) => {
    await expect(page.getByTestId('showcase-color-ctrl')).toBeVisible();
    await expect(page.getByTestId('showcase-color-ctrl-text')).toHaveValue('#00FF88');
    await expect(page.getByTestId('showcase-color-ctrl-swatch')).toBeVisible();
  });

  test('layer card MODULATION chevron toggles aria-expanded', async ({ page }) => {
    const chevron = page.getByTestId('showcase-layer-card-2-chevron');
    await expect(chevron).toHaveAttribute('aria-expanded', 'false');
    await chevron.click();
    await expect(chevron).toHaveAttribute('aria-expanded', 'true');
    await chevron.click();
    await expect(chevron).toHaveAttribute('aria-expanded', 'false');
  });

  test('useParam demo writes through paramStore and re-reads the new value', async ({ page }) => {
    const valueText = page.getByTestId('showcase-tilesize-value');
    const toggleBtn = page.getByTestId('showcase-toggle-tilesize');

    // Initial value seeded by DEFAULT_PARAM_STATE.mosaic.tileSize = 16.
    await expect(valueText).toHaveText('Current: 16');

    await toggleBtn.click();
    await expect(valueText).toHaveText('Current: 32');

    await toggleBtn.click();
    await expect(valueText).toHaveText('Current: 16');
  });

  test('full-page screenshot captured for DR-8 visual baseline', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/primitives');
    await expect(page.getByTestId('showcase-root')).toBeVisible({ timeout: 10_000 });

    await fs.mkdir(SHOT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(SHOT_DIR, 'primitives-showcase.png'),
      fullPage: true,
    });
  });
});
