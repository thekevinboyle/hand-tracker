import { expect, test } from '@playwright/test';

test.describe('Task 1.2: useCamera', () => {
  test('reaches GRANTED with Chromium fake device after auto-prompt grant', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (e) => consoleErrors.push(e.message));

    await page.goto('/');

    const stateEl = page.getByTestId('camera-state');
    await expect(stateEl).toBeVisible();
    // Chromium fake-device flag + permissions:['camera'] makes permissions.query
    // resolve 'granted' on load, so the hook auto-starts capture and reaches GRANTED.
    await expect(stateEl).toHaveText('GRANTED', { timeout: 10_000 });

    expect(consoleErrors).toEqual([]);
  });
});
