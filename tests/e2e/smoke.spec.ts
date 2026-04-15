import { expect, test } from '@playwright/test';

test.describe('Task 1.1: smoke', () => {
  test('app boots with crossOriginIsolated=true and main visible', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (e) => consoleErrors.push(e.message));

    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();

    const coi = await page.evaluate(() => window.crossOriginIsolated);
    expect(coi).toBe(true);

    const hasGum = await page.evaluate(() => !!navigator.mediaDevices?.getUserMedia);
    expect(hasGum).toBe(true);

    await page.waitForLoadState('networkidle');
    expect(consoleErrors).toEqual([]);
  });
});
