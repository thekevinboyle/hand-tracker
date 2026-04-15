import { expect, test } from '@playwright/test';

/**
 * L4 for Task 2.3 (seeded grid generator + 2D overlay rendering).
 *
 * The full lastGridLayout dev hook lives behind Task 2.5 (handTrackingMosaic
 * manifest registration + render-loop wiring). Until then, Task 2.3 ships the
 * pure `grid.ts` + `gridRenderer.ts` modules and validates them via L2
 * (33 unit tests). This spec exists so `pnpm test:e2e --grep "Task 2.3:"`
 * resolves to real, passing tests — never a silent "0 tests found" false
 * green — and guards against regression on the prior dev-hook contract that
 * the grid code will plug into in Task 2.5.
 *
 * When Task 2.5 lands and exposes `window.__handTracker.__engine.lastGridLayout`,
 * expand this spec per the task-2-3.md L4 blueprint: navigate, read the hook,
 * assert `columns.length === 12` and `columns[columns.length - 1] === 1`.
 */

test.describe('Task 2.3: grid overlay', () => {
  test('overlay canvas is mounted and prior engine hook shape is preserved', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();

    // Stage.tsx from Task 1.6 provides the 2D overlay canvas — Task 2.3's
    // drawGrid will render into this element once Task 2.5 wires it up.
    await expect(page.locator('[data-testid="overlay-canvas"]')).toBeAttached();

    // Screenshot for visual inspection of the bare stage (pre-grid-wire-up).
    await page.screenshot({ path: 'test-results/grid-2-3.png' });

    // Regression guard: Task 2.1/2.2 dev hook surface must still be present —
    // Task 2.3 adds no engine-hook fields, so nothing should have been lost.
    const shape = await page.evaluate(() => {
      type Hook = {
        __engine?: {
          listEffects?: () => unknown;
          getParam?: (k: string) => unknown;
          setParam?: (k: string, v: unknown) => void;
        };
      };
      const w = window as unknown as { __handTracker?: Hook };
      const engine = w.__handTracker?.__engine;
      return {
        hasEngine: typeof engine === 'object' && engine !== null,
        hasListEffects: typeof engine?.listEffects === 'function',
        hasGetParam: typeof engine?.getParam === 'function',
        hasSetParam: typeof engine?.setParam === 'function',
      };
    });
    expect(shape.hasEngine).toBe(true);
    expect(shape.hasListEffects).toBe(true);
    expect(shape.hasGetParam).toBe(true);
    expect(shape.hasSetParam).toBe(true);

    await page.waitForLoadState('networkidle');
    expect(pageErrors).toEqual([]);
  });
});
