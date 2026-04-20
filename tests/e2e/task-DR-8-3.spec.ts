/**
 * Task DR-8.3 — ModulationCard + ModulationRow + BezierEditor E2E.
 *
 * L4 for the third Phase-DR-8 task. Proves the new React-driven modulation
 * card mounts in the sidebar, starts collapsed, expands via chevron, adds
 * and removes routes, and continues to let the two D13 default routes
 * drive `mosaic.tileSize` through the existing render-loop pipeline.
 *
 * Describe prefix MUST start with literal `Task DR-8.3:` so
 * `pnpm test:e2e --grep "Task DR-8.3:"` resolves these tests only.
 *
 * Carry-forwards (synergy-fix CRITICAL-03):
 *   - Assertions are UI-driven via `page.getByTestId(/^modulation-route-\d+$/)`.
 *     There is NO `modulationSnapshot()` helper on the dev hook — we probe
 *     via `__handTracker.__engine.getParam('mosaic.tileSize')` for the
 *     pipeline round-trip.
 *   - Describe prefix literal `Task DR-8.3:`.
 */

import { expect, test } from '@playwright/test';

interface EngineHook {
  getParam?: (dotPath: string) => unknown;
  setFakeLandmarks?: (
    lms: Array<{ x: number; y: number; z: number; visibility?: number }> | null,
  ) => void;
}

interface HandTrackerHook {
  __engine?: EngineHook;
}

function landmarksAt(idx8: { x: number; y: number }): Array<{
  x: number;
  y: number;
  z: number;
  visibility: number;
}> {
  const out = Array.from({ length: 21 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  }));
  out[8] = { x: idx8.x, y: idx8.y, z: 0, visibility: 1 };
  return out;
}

test.describe('Task DR-8.3: ModulationCard renders, collapses, and mutates', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', {
      timeout: 30_000,
    });
  });

  test('card is visible and collapsed by default; chevron toggles', async ({ page }) => {
    const card = page.getByTestId('modulation-card');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-collapsed', 'true');
    const chevron = page.getByTestId('modulation-card-chevron');
    await expect(chevron).toHaveAttribute('aria-expanded', 'false');
    await chevron.click();
    await expect(card).toHaveAttribute('data-collapsed', 'false');
    await expect(chevron).toHaveAttribute('aria-expanded', 'true');
  });

  test('"+ Add route" creates a new row and Delete removes it', async ({ page }) => {
    // Expand the card so the add button is reachable.
    await page.getByTestId('modulation-card-chevron').click();
    const rowLocator = page.getByTestId(/^modulation-route-\d+$/);
    const before = await rowLocator.count();
    await page.getByTestId('modulation-card-add-route').click();
    const afterAdd = await rowLocator.count();
    expect(afterAdd).toBe(before + 1);

    // Delete the last row; count drops back.
    const lastIndex = afterAdd - 1;
    await page.getByTestId(`modulation-route-${lastIndex}-delete`).click();
    await expect(rowLocator).toHaveCount(before);
  });

  test('Enabled toggle on the first default route flips aria-checked', async ({ page }) => {
    await page.getByTestId('modulation-card-chevron').click();
    const toggle = page.getByTestId('modulation-route-0-enabled');
    // Default route 0 (mosaic.tileSize) is enabled — aria-checked="true".
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
});

test.describe('Task DR-8.3: default route drives mosaic.tileSize end-to-end', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', {
      timeout: 30_000,
    });
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        return typeof w.__handTracker?.__engine?.setFakeLandmarks === 'function';
      },
      undefined,
      { timeout: 10_000 },
    );
  });

  test('landmark[8].x = 0.9 drives tileSize toward the upper bound via the D13 default route', async ({
    page,
  }) => {
    await page.evaluate(
      (lms) => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        w.__handTracker?.__engine?.setFakeLandmarks?.(lms);
      },
      landmarksAt({ x: 0.9, y: 0.1 }),
    );
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        const t = w.__handTracker?.__engine?.getParam?.('mosaic.tileSize');
        return typeof t === 'number' && t > 40;
      },
      undefined,
      { timeout: 10_000 },
    );
    const tile = (await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      return w.__handTracker?.__engine?.getParam?.('mosaic.tileSize');
    })) as number;
    expect(tile).toBeGreaterThan(40);
    expect(tile).toBeLessThanOrEqual(64);

    // Clean up injected landmarks so subsequent specs start fresh.
    await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setFakeLandmarks?.(null);
    });
  });
});
