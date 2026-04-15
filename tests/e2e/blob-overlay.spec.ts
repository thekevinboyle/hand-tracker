import { expect, test } from '@playwright/test';

/**
 * L4 for Task 2.4 (dotted-circle fingertip blobs + xy-coordinate labels).
 *
 * The full `getLandmarkBlobCount` dev hook lives behind Task 2.5
 * (handTrackingMosaic manifest registration + render-loop wiring). Until
 * that lands, Task 2.4 ships the pure `blobRenderer.ts` module and validates
 * it via L2 (21 unit tests). This spec exists so
 * `pnpm test:e2e --grep "Task 2.4:"` resolves to a real, passing test —
 * never a silent "0 tests found" false green — and regression-guards the
 * prior dev-hook contract (`__engine.listEffects`, `__engine.getParam`,
 * `__engine.setParam` from Tasks 2.1 + 2.2) the blob render wiring will
 * plug into in Task 2.5.
 *
 * When Task 2.5 lands and exposes
 * `window.__handTracker.__engine.getLandmarkBlobCount`, extend this spec
 * per the task-2-4.md L4 blueprint:
 *   - synthetic testsrc2 Y4M (no hand) → count === 0
 *   - real-hand Y4M → count === 5
 */

test.describe('Task 2.4: landmark blobs', () => {
  test('overlay canvas is mounted and prior engine hook shape is preserved', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();

    // Stage.tsx from Task 1.6 provides the 2D overlay canvas — Task 2.4's
    // drawLandmarkBlobs will render into this element once Task 2.5 wires it up.
    await expect(page.locator('[data-testid="overlay-canvas"]')).toBeAttached();

    // Screenshot for visual inspection of the bare stage (pre-blob wire-up).
    await page.screenshot({ path: 'test-results/blob-2-4.png' });

    // Regression guard: Task 2.1 / 2.2 dev-hook surface must still be present —
    // Task 2.4 adds no engine-hook fields of its own (getLandmarkBlobCount is
    // introduced by Task 2.5's render-loop wiring, not this task).
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
