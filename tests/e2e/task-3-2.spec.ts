/**
 * L4 for Task 3.2 — mosaic fragment shader.
 *
 * Invokes `window.__handTracker.__engine.testCompileShaders()` in a real
 * Chromium WebGL2 context and asserts both VERTEX and FRAGMENT strings
 * compile cleanly. Guards the most common regression: a whitespace / BOM
 * / accidental comment before `#version 300 es` that the golden-string L2
 * tests happen to accept (e.g. because the fixture was updated) but the
 * driver rejects with `no GLSL ES version directive`.
 *
 * Describe prefix MUST be literal `Task 3.2:` for `--grep "Task 3.2:"` to
 * resolve these tests and nothing else.
 */

import { expect, test } from '@playwright/test';

interface EngineHook {
  testCompileShaders?: () => { vertex: boolean; fragment: boolean; log: string };
}
interface HandTrackerHook {
  __engine?: EngineHook;
}

test.describe('Task 3.2: mosaic fragment shader', () => {
  test('both VERTEX + FRAGMENT compile in a real WebGL2 context', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        return typeof w.__handTracker?.__engine?.testCompileShaders === 'function';
      },
      undefined,
      { timeout: 10_000 },
    );

    const report = await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      return w.__handTracker?.__engine?.testCompileShaders?.() ?? null;
    });

    expect(report, 'testCompileShaders() returned null').not.toBeNull();
    expect(report?.vertex, `vertex compile failed: ${report?.log}`).toBe(true);
    expect(report?.fragment, `fragment compile failed: ${report?.log}`).toBe(true);
  });
});
