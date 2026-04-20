/**
 * Task DR-8.2 — Sidebar + LayerCard1 E2E.
 *
 * L4 for the second Phase-DR-8 task. Proves that the new `<Sidebar>` mounts
 * in GRANTED state with the `panel-root` + `params-panel` + 3 layer-card-*
 * testids, and that interactions with at least one control per section
 * (Grid / Mosaic / Input) round-trip through paramStore (observable via
 * the `__handTracker.__engine.getParam` dev hook).
 *
 * Describe prefix MUST start with literal `Task DR-8.2:` so
 * `pnpm test:e2e --grep "Task DR-8.2:"` resolves these tests only.
 *
 * Gotchas carried forward:
 *   - `params-panel` testid previously wrapped the Tweakpane container. It
 *     now wraps the LayerCard1 body. Both are visible simultaneously
 *     because the Tweakpane Panel stays mounted until DR-8.6 with its
 *     testids renamed to `tweakpane-*`.
 *   - Old floating `PresetActions` still sits at z-index 100 in the
 *     top-right area during the DR-8.1→DR-8.6 transition. The Sidebar at
 *     z-index 140 sits below the Toolbar (150) but above PresetActions;
 *     since PresetActions is in the top band and the Sidebar is
 *     position:fixed on the RIGHT, they share a corner. Sidebar uses
 *     pointer-events: auto so its controls always win locally.
 *   - CellSizePicker (Mosaic bucket segmented) and the sidebar's Tile size
 *     slider share the same `mosaic.tileSize` key. Verifying the slider
 *     reflects bucket clicks is part of the round-trip assertion.
 */

import { expect, test } from '@playwright/test';

test.describe('Task DR-8.2: Sidebar mounts with all 14 params visible', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });
  });

  test('panel-root + params-panel + 3 layer-card-* testids are visible', async ({ page }) => {
    await expect(page.getByTestId('panel-root')).toBeVisible();
    await expect(page.getByTestId('params-panel')).toBeVisible();
    await expect(page.getByTestId('layer-card-grid')).toBeVisible();
    await expect(page.getByTestId('layer-card-mosaic')).toBeVisible();
    await expect(page.getByTestId('layer-card-input')).toBeVisible();
  });

  test('LAYER 1 heading is present inside the sidebar', async ({ page }) => {
    const sidebar = page.getByTestId('panel-root');
    await expect(sidebar.getByRole('heading', { level: 2, name: /layer 1/i })).toBeVisible();
  });

  test('Grid / Mosaic / Input section headings are visible', async ({ page }) => {
    const sidebar = page.getByTestId('panel-root');
    await expect(sidebar.getByRole('heading', { level: 3, name: /grid/i })).toBeVisible();
    await expect(sidebar.getByRole('heading', { level: 3, name: /mosaic/i })).toBeVisible();
    await expect(sidebar.getByRole('heading', { level: 3, name: /input/i })).toBeVisible();
  });
});

test.describe('Task DR-8.2: controls round-trip through paramStore', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });
  });

  test('Grid: widthVariance slider write propagates to paramStore', async ({ page }) => {
    const gridSection = page.getByTestId('layer-card-grid');
    const slider = gridSection.getByRole('slider', { name: /width variance/i });
    await slider.focus();
    // ArrowRight bumps +step (0.01). Default is 0.6 — press ArrowRight
    // multiple times to ensure the written value is distinguishable from
    // the baseline even if the test-browser swallows a keystroke.
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
    const value = await page.evaluate(() => {
      const w = window as unknown as {
        __handTracker?: { __engine?: { getParam?: (k: string) => unknown } };
      };
      return w.__handTracker?.__engine?.getParam?.('grid.widthVariance') as number;
    });
    expect(value).toBeGreaterThan(0.6);
  });

  test('Input: Mirror toggle click flips paramStore.input.mirrorMode', async ({ page }) => {
    const inputSection = page.getByTestId('layer-card-input');
    const toggle = inputSection.getByRole('switch', { name: /^mirror$/i });
    // Default is true. After one click it should be false.
    await toggle.click();
    const value = await page.evaluate(() => {
      const w = window as unknown as {
        __handTracker?: { __engine?: { getParam?: (k: string) => unknown } };
      };
      return w.__handTracker?.__engine?.getParam?.('input.mirrorMode') as boolean;
    });
    expect(value).toBe(false);
  });

  test('Grid: Randomize button rolls grid.seed to a new value', async ({ page }) => {
    const before = await page.evaluate(() => {
      const w = window as unknown as {
        __handTracker?: { __engine?: { getParam?: (k: string) => unknown } };
      };
      return w.__handTracker?.__engine?.getParam?.('grid.seed') as number;
    });
    await page.getByTestId('button-randomize-grid').click();
    const after = await page.evaluate(() => {
      const w = window as unknown as {
        __handTracker?: { __engine?: { getParam?: (k: string) => unknown } };
      };
      return w.__handTracker?.__engine?.getParam?.('grid.seed') as number;
    });
    expect(after).not.toBe(before);
  });

  test('Mosaic: Toolbar CellSizePicker and sidebar Tile-size slider stay in sync', async ({
    page,
  }) => {
    // Click the "L" bucket (value 32) in the top cell-picker.
    await page.getByTestId('toolbar-cell-picker').getByText('L', { exact: true }).click();
    // Paramstore should now read 32.
    const paramValue = await page.evaluate(() => {
      const w = window as unknown as {
        __handTracker?: { __engine?: { getParam?: (k: string) => unknown } };
      };
      return w.__handTracker?.__engine?.getParam?.('mosaic.tileSize') as number;
    });
    expect(paramValue).toBe(32);
    // Sidebar's Tile size slider reflects the same value.
    const slider = page
      .getByTestId('layer-card-mosaic')
      .getByRole('slider', { name: /tile size/i });
    await expect(slider).toHaveValue('32');
  });
});
