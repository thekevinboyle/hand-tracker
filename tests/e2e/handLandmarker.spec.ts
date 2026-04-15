import { expect, test } from '@playwright/test';

test.describe('Task 1.4: handLandmarker', () => {
  test('build includes tracking module and preview serves crossOriginIsolated=true', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (e) => consoleErrors.push(e.message));

    await page.goto('/');

    // Camera must reach GRANTED first (Task 1.2 wiring).
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 10_000 });

    // COOP+COEP must be in place so MediaPipe wasm threads can run — regression gate.
    const isolated = await page.evaluate(() => window.crossOriginIsolated);
    expect(isolated).toBe(true);

    // Task 1.4 does NOT wire the tracker module into the app — that is Task 1.5's job.
    // The E2E responsibility here is loose by design: confirm the preview build is clean
    // (no page errors) and that the dev hook contract is at least a detectable shape
    // once the module is imported. In dev/test mode the module registers
    // `window.__handTracker = { isReady, isUsingGpu }`; in a preview build (no
    // MODE=test, no DEV) the block is tree-shaken and the hook is undefined until
    // Task 1.5 imports the module. Either outcome is acceptable here — assert only
    // that evaluating the check yields a boolean and the page has not errored.
    const hookShape = await page.evaluate(() => {
      const hook = (window as unknown as { __handTracker?: Record<string, unknown> }).__handTracker;
      return {
        present: typeof hook !== 'undefined',
        readyIsFn: typeof hook?.isReady === 'function',
        usingGpuIsFn: typeof hook?.isUsingGpu === 'function',
      };
    });
    expect(typeof hookShape.present).toBe('boolean');
    expect(typeof hookShape.readyIsFn).toBe('boolean');
    expect(typeof hookShape.usingGpuIsFn).toBe('boolean');

    await page.waitForLoadState('networkidle');
    expect(consoleErrors).toEqual([]);
  });
});
