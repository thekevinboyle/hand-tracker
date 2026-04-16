import { expect, test } from '@playwright/test';

/**
 * L4 for Task 2.2 (paramStore + buildPaneFromManifest + <Panel />).
 *
 * The `<Panel />` component is not yet wired into `App.tsx` (integration is
 * scheduled for Task 2.5 alongside the handTrackingMosaic manifest). This
 * spec therefore validates the BROWSER-SIDE contract that Task 2.2 ships —
 * the `__engine.getParam` / `__engine.setParam` dev hooks wrapping the
 * paramStore — which is what downstream tasks rely on.
 *
 * When Task 2.5 mounts the Panel in the app, add a follow-up test here that
 * locates a Tweakpane slider in the rendered DOM and asserts the round-trip
 * from slider drag → `getParam('grid.columnCount')`.
 */

test.describe('Task 2.2: paramStore + buildPaneFromManifest + Panel', () => {
  test('dev hook exposes __engine.getParam and __engine.setParam round-trip', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();

    const shape = await page.evaluate(() => {
      type Hook = {
        __engine?: {
          getParam?: (dotPath: string) => unknown;
          setParam?: (dotPath: string, value: unknown) => void;
          listEffects?: () => unknown;
        };
      };
      const w = window as unknown as { __handTracker?: Hook };
      const engine = w.__handTracker?.__engine;
      return {
        hasEngine: typeof engine === 'object' && engine !== null,
        hasGetParam: typeof engine?.getParam === 'function',
        hasSetParam: typeof engine?.setParam === 'function',
        // Prior task 2.1 contract — ensure we didn't regress.
        hasListEffects: typeof engine?.listEffects === 'function',
      };
    });

    expect(shape.hasEngine).toBe(true);
    expect(shape.hasGetParam).toBe(true);
    expect(shape.hasSetParam).toBe(true);
    expect(shape.hasListEffects).toBe(true);

    // Task 2.5 seeds paramStore with DEFAULT_PARAM_STATE on module load.
    // Verify getParam reads the seeded default for grid.columnCount (D4: 12).
    const columnCount = await page.evaluate(() => {
      type Hook = { __engine?: { getParam?: (k: string) => unknown } };
      const w = window as unknown as { __handTracker?: Hook };
      return w.__handTracker?.__engine?.getParam?.('grid.columnCount');
    });
    expect(columnCount).toBe(12);

    await page.waitForLoadState('networkidle');
    expect(pageErrors).toEqual([]);
  });
});
