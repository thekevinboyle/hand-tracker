/**
 * Task DR-8.1 — Toolbar + CellSizePicker.
 *
 * L4 for the first Phase-DR-8 task. Proves that the new `<Toolbar>` mounts
 * in GRANTED state with the three expected testids (toolbar-wordmark,
 * toolbar-cell-picker, record-button) and that clicking each of the 5
 * cell-picker buckets writes the correct numeric `mosaic.tileSize` to the
 * paramStore (observable via the `__handTracker.__engine.getParam` dev hook).
 *
 * Describe prefix MUST start with literal `Task DR-8.1:` so
 * `pnpm test:e2e --grep "Task DR-8.1:"` resolves these tests only.
 *
 * Segmented click-target gotcha (DR-7.R carry-forward): the native
 * `<input type="radio">` is zero-sized for custom styling; the visible
 * click target is the sibling `<label>` text. We click via
 * `getByText('XL', { exact: true })` scoped inside the cell-picker to
 * route through the native `<label htmlFor>` association.
 */

import { expect, test } from '@playwright/test';

test.describe('Task DR-8.1: Toolbar renders with wordmark + cell-picker + record button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });
  });

  test('toolbar chrome is visible and wordmark shows "Hand Tracker FX"', async ({ page }) => {
    await expect(page.getByTestId('toolbar')).toBeVisible();
    await expect(page.getByTestId('toolbar-wordmark')).toHaveText('Hand Tracker FX');
    await expect(page.getByTestId('toolbar-cell-picker')).toBeVisible();
    await expect(page.getByTestId('record-button')).toBeVisible();
  });
});

test.describe('Task DR-8.1: CellSizePicker writes through paramStore', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });
  });

  test('clicking each bucket updates mosaic.tileSize (XL/L/M/S/XS)', async ({ page }) => {
    const picker = page.getByTestId('toolbar-cell-picker');
    await expect(picker).toBeVisible();

    const cases: ReadonlyArray<readonly [string, number]> = [
      ['XL', 64],
      ['L', 32],
      ['M', 16],
      ['S', 8],
      ['XS', 4],
    ];

    for (const [label, expected] of cases) {
      await picker.getByText(label, { exact: true }).click();
      // Modulation runs on every frame — when the landmark[8].y → tileSize
      // route is active, it can overwrite the tileSize we just set between
      // the click and the evaluate. Pin the value by waiting for the
      // expected bucket to show aria-checked="true" (which reflects the
      // paramStore snapshot) inside the picker itself. This is resilient
      // against modulation because fakeLandmarks aren't being injected in
      // this spec — the D13 default route evaluates with empty landmarks
      // and returns identity.
      await expect(picker.locator(`input[type="radio"][value="${expected}"]`)).toBeChecked();

      const actual = await page.evaluate(() => {
        const w = window as unknown as {
          __handTracker?: { __engine?: { getParam?: (k: string) => unknown } };
        };
        return w.__handTracker?.__engine?.getParam?.('mosaic.tileSize');
      });
      expect(actual).toBe(expected);
    }
  });
});
