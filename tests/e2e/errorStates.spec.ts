import { expect, test } from '@playwright/test';

test.describe('Task 1.3: error states', () => {
  test('reaches GRANTED under fake-device flags; no alert region present', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 10_000 });
    await expect(page.locator('[role="alert"]')).toHaveCount(0);
  });
});
