import { expect, test } from '@playwright/test';

test.describe('Task 1.R: regression soak', () => {
  test('10s post-GRANTED: no console errors, no unhandled rejections', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
    });

    await page.addInitScript(() => {
      (window as unknown as { __unh: string[] }).__unh = [];
      window.addEventListener('unhandledrejection', (e) => {
        const reason = e.reason;
        const msg =
          reason instanceof Error
            ? reason.message
            : typeof reason === 'string'
              ? reason
              : JSON.stringify(reason);
        (window as unknown as { __unh: string[] }).__unh.push(msg);
      });
    });

    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 15_000 });
    await page.waitForTimeout(10_000);

    const unhandled = await page.evaluate(() => (window as unknown as { __unh: string[] }).__unh);

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
    expect(unhandled, `unhandled rejections:\n${unhandled.join('\n')}`).toEqual([]);
  });
});
