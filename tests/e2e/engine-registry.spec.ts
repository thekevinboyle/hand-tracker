import { expect, test } from '@playwright/test';

test.describe('Task 2.1: registry types', () => {
  test('window.__handTracker.__engine.listEffects is exposed and returns an array', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();

    const result = await page.evaluate(() => {
      type Hook = {
        __engine?: { listEffects?: () => unknown };
      };
      const w = window as unknown as { __handTracker?: Hook };
      const hook = w.__handTracker;
      const list = hook?.__engine?.listEffects?.() ?? null;
      return {
        hasHook: typeof hook === 'object' && hook !== null,
        hasEngine: typeof hook?.__engine === 'object' && hook?.__engine !== null,
        hasListEffects: typeof hook?.__engine?.listEffects === 'function',
        isArray: Array.isArray(list),
        length: Array.isArray(list) ? list.length : -1,
      };
    });

    expect(result.hasHook).toBe(true);
    expect(result.hasEngine).toBe(true);
    expect(result.hasListEffects).toBe(true);
    expect(result.isArray).toBe(true);
    // Task 2.5 registers the handTrackingMosaic effect at module load.
    expect(result.length).toBe(1);
  });
});
