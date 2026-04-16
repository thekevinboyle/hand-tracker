import { expect, test } from '@playwright/test';

/**
 * L4 for Task 2.5 — handTrackingMosaic manifest + registration.
 *
 * Validates the full browser pipeline:
 *   1. Effect registered in the global registry
 *   2. Panel DOM visible (Tweakpane root)
 *   3. Dev hooks exposed: listEffects, getParam, getLandmarkBlobCount, lastGridLayout
 *   4. getParam reads default values from the paramStore
 */
test.describe('Task 2.5: handTrackingMosaic manifest + registration', () => {
  test('effect is registered and Panel is visible', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();

    // Wait for the effect to register (module-load side effect fires on import)
    const effectResult = await page.waitForFunction(() => {
      type Hook = {
        __engine?: {
          listEffects?: () => { id: string }[];
        };
      };
      const w = window as unknown as { __handTracker?: Hook };
      const list = w.__handTracker?.__engine?.listEffects?.() ?? [];
      return list.length === 1 ? list[0] : null;
    });

    const effect = await effectResult.jsonValue();
    expect(effect).not.toBeNull();
    expect(effect?.id).toBe('handTrackingMosaic');

    // Panel should be visible (Tweakpane renders a `.tp-rotv` root element)
    await expect(page.locator('.tp-rotv')).toBeVisible({ timeout: 5000 });

    // Verify getParam returns default values from D4
    const columnCount = await page.evaluate(() => {
      type Hook = {
        __engine?: { getParam?: (k: string) => unknown };
      };
      const w = window as unknown as { __handTracker?: Hook };
      return w.__handTracker?.__engine?.getParam?.('grid.columnCount');
    });
    expect(columnCount).toBe(12);

    const tileSize = await page.evaluate(() => {
      type Hook = {
        __engine?: { getParam?: (k: string) => unknown };
      };
      const w = window as unknown as { __handTracker?: Hook };
      return w.__handTracker?.__engine?.getParam?.('mosaic.tileSize');
    });
    expect(tileSize).toBe(16);

    // Verify new dev hooks from Task 2.5 are exposed
    const hookShape = await page.evaluate(() => {
      type Hook = {
        __engine?: {
          getLandmarkBlobCount?: () => number;
          lastGridLayout?: () => unknown;
          listEffects?: () => unknown;
          getParam?: (k: string) => unknown;
          setParam?: (k: string, v: unknown) => void;
        };
      };
      const w = window as unknown as { __handTracker?: Hook };
      const engine = w.__handTracker?.__engine;
      return {
        hasGetLandmarkBlobCount: typeof engine?.getLandmarkBlobCount === 'function',
        hasLastGridLayout: typeof engine?.lastGridLayout === 'function',
        hasListEffects: typeof engine?.listEffects === 'function',
        hasGetParam: typeof engine?.getParam === 'function',
        hasSetParam: typeof engine?.setParam === 'function',
      };
    });

    expect(hookShape.hasGetLandmarkBlobCount).toBe(true);
    expect(hookShape.hasLastGridLayout).toBe(true);
    expect(hookShape.hasListEffects).toBe(true);
    expect(hookShape.hasGetParam).toBe(true);
    expect(hookShape.hasSetParam).toBe(true);

    await page.waitForLoadState('networkidle');
    expect(pageErrors).toEqual([]);
  });
});
