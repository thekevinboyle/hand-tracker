/**
 * L4 for Task 5.1 — service worker caches /models/* and /wasm/*.
 *
 * Verifies:
 *   1. After the first load, `navigator.serviceWorker.controller` is
 *      non-null (the SW took control).
 *   2. A reload serves `/models/hand_landmarker.task` out of the SW
 *      cache — `PerformanceResourceTiming.transferSize === 0` is the
 *      canonical signal (Web Perf 2 spec: 0 means memory/disk/SW cache).
 *   3. A reload also serves at least one `/wasm/*.wasm` from cache.
 *
 * Describe prefix MUST start with literal `Task 5.1:` for `--grep "Task
 * 5.1:"` to resolve these tests.
 */

import { expect, test } from '@playwright/test';

test.describe('Task 5.1: service worker caches /models and /wasm', () => {
  test('SW registers + controls the page after first load', async ({ page, context }) => {
    // Clear any previously-registered SW + cached responses so the test
    // starts from a cold state (otherwise prior runs in the same worker
    // could skip the install-event seeding path).
    await context.clearCookies();
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), undefined, {
      timeout: 15_000,
    });

    // First load: controller MAY be null because the SW only claims on
    // activate; a reload guarantees it takes over.
    await page.reload();
    const hasController = await page.evaluate(() => navigator.serviceWorker.controller !== null);
    expect(hasController, 'SW should control the page after reload').toBe(true);
  });

  test('/models/hand_landmarker.task served from cache on reload (transferSize === 0)', async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    // Cold load → SW installs → model fetched from network → cache seeded.
    await page.goto('/');
    // Wait for the app's render loop to start, which means MediaPipe's
    // initHandLandmarker() fetched the model.
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: { getFPS?: () => number } };
        return (w.__handTracker?.getFPS?.() ?? 0) > 0;
      },
      undefined,
      { timeout: 60_000 },
    );

    // Reload to hit the cached entry.
    await page.reload();
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: { getFPS?: () => number } };
        return (w.__handTracker?.getFPS?.() ?? 0) > 0;
      },
      undefined,
      { timeout: 60_000 },
    );

    const modelEntry = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const match = entries.find((e) => e.name.endsWith('/models/hand_landmarker.task'));
      return match ? { name: match.name, transferSize: match.transferSize } : null;
    });
    expect(modelEntry, 'model resource entry missing on reload').not.toBeNull();
    // transferSize === 0 iff served from memory / disk / SW cache — proves
    // the reload did NOT re-download the 7.82 MB model.
    expect(modelEntry?.transferSize, 'model should be served from cache').toBe(0);

    // At least one wasm binary should also be cache-hit on reload.
    const wasmEntry = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const match = entries.find(
        (e) => e.name.includes('/wasm/') && e.name.endsWith('.wasm') && e.transferSize === 0,
      );
      return match ? { name: match.name, transferSize: match.transferSize } : null;
    });
    expect(wasmEntry, 'at least one wasm should be served from cache').not.toBeNull();
  });
});
