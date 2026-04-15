import { expect, test } from '@playwright/test';

test.describe('Task 1.5: renderLoop', () => {
  test('window.__handTracker.getFPS() > 0 after warmup', async ({ page }) => {
    await page.goto('/');

    // COOP/COEP regression gate — MediaPipe wasm needs crossOriginIsolated.
    const isolated = await page.evaluate(() => window.crossOriginIsolated);
    expect(isolated).toBe(true);

    // Wait for camera → GRANTED (fake Y4M webcam auto-grants via launch flags).
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 15_000 });

    // Wait for the render loop to register the __handTracker.getFPS hook.
    // Cold runs may need the MediaPipe model/wasm to fetch + compile (~20-35s).
    await page.waitForFunction(
      () =>
        typeof (window as unknown as { __handTracker?: { getFPS?: () => number } }).__handTracker
          ?.getFPS === 'function',
      undefined,
      { timeout: 60_000 },
    );

    // Wait for the loop to actually accumulate FPS samples (rVFC runs once a
    // frame; need at least a few before getFPS() exits its < 2 sample guard).
    await page.waitForFunction(
      () => {
        const hook = (window as unknown as { __handTracker?: { getFPS?: () => number } })
          .__handTracker;
        return typeof hook?.getFPS === 'function' && hook.getFPS() > 0;
      },
      undefined,
      { timeout: 60_000 },
    );

    // Sample FPS over a 3s window.
    const fps = await page.evaluate(async () => {
      await new Promise<void>((r) => setTimeout(r, 3000));
      return (
        window as unknown as { __handTracker: { getFPS: () => number } }
      ).__handTracker.getFPS();
    });
    expect(fps).toBeGreaterThan(0);
  });
});
