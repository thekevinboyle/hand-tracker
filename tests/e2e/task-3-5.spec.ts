/**
 * L4 for Task 3.5 — webgl context loss recovery.
 *
 * Forces a `WEBGL_lose_context.loseContext()` on the mounted webgl-canvas,
 * waits for Stage's `onLost` handler to drop the texture, then force-
 * restores and asserts:
 *   1. One `WebGL context lost` warn + one `WebGL context restored` info
 *      appear in the console.
 *   2. After the Texture is rebuilt and App.tsx's `textureGen`-driven
 *      effect re-runs, injecting a hand hull lights at least one region —
 *      i.e. rendering fully resumed.
 *   3. No additional console errors across the cycle.
 *
 * Hardware that lacks `WEBGL_lose_context` is rare in Chromium test runs
 * but the dev hook guards it — the test short-circuits with `test.skip` if
 * `forceContextLoss()` returns false so the suite stays green on those
 * machines.
 *
 * Describe prefix MUST be literal `Task 3.5:` for `--grep "Task 3.5:"`.
 */

import { expect, test } from '@playwright/test';

interface EngineHook {
  setFakeLandmarks?: (
    lms: Array<{ x: number; y: number; z: number; visibility?: number }> | null,
  ) => void;
  getLastRegionCount?: () => number;
  forceContextLoss?: () => boolean;
  forceContextRestore?: () => boolean;
}

interface HandTrackerHook {
  __engine?: EngineHook;
}

function spreadHandLandmarks(): Array<{ x: number; y: number; z: number; visibility: number }> {
  const center = { x: 0.5, y: 0.5, z: 0, visibility: 1 };
  const out = Array.from({ length: 21 }, () => ({ ...center }));
  const hull: Array<[number, number]> = [
    [0.3, 0.75],
    [0.2, 0.55],
    [0.35, 0.2],
    [0.55, 0.15],
    [0.72, 0.35],
    [0.78, 0.55],
  ];
  [0, 4, 8, 12, 16, 20].forEach((idx, i) => {
    const pt = hull[i];
    if (pt) out[idx] = { x: pt[0], y: pt[1], z: 0, visibility: 1 };
  });
  return out;
}

test.describe('Task 3.5: webgl context loss recovery', () => {
  test('forced loseContext → restoreContext cycle resumes mosaic rendering', async ({ page }) => {
    const logs: Array<{ type: string; text: string }> = [];
    page.on('console', (m) => logs.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message }));

    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        return (
          typeof w.__handTracker?.__engine?.forceContextLoss === 'function' &&
          typeof w.__handTracker.__engine.forceContextRestore === 'function' &&
          typeof w.__handTracker.__engine.setFakeLandmarks === 'function'
        );
      },
      undefined,
      { timeout: 10_000 },
    );

    // Baseline: inject a hull + confirm rendering is live before the cycle.
    // 15 s timeout covers a cold MediaPipe model load on the runner.
    await page.evaluate((lms) => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setFakeLandmarks?.(lms);
    }, spreadHandLandmarks());
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        return (w.__handTracker?.__engine?.getLastRegionCount?.() ?? 0) > 0;
      },
      undefined,
      { timeout: 15_000 },
    );

    const lossOk = await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      return w.__handTracker?.__engine?.forceContextLoss?.() ?? false;
    });
    test.skip(!lossOk, 'WEBGL_lose_context extension unavailable on this runner');

    // Wait for the browser's async `webglcontextlost` dispatch to land +
    // Stage's onLost handler to run. 500 ms is generous — the event
    // typically fires on the next task tick.
    await page.waitForFunction(
      () => {
        // Stage's onLost drops the video texture via unmountTexture().
        const w = window as unknown as { __handTracker?: HandTrackerHook } & {
          __handTracker?: { __engine?: { getVideoTextureHandle?: () => WebGLTexture | null } };
        };
        return w.__handTracker?.__engine?.getVideoTextureHandle?.() === null;
      },
      undefined,
      { timeout: 5_000 },
    );

    const restoreOk = await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      return w.__handTracker?.__engine?.forceContextRestore?.() ?? false;
    });
    expect(restoreOk, 'forceContextRestore should succeed').toBe(true);

    // Stage's onRestored → mountTexture + onTextureRecreated → App.tsx's
    // effect tears down + rebuilds the EffectInstance with the new texture.
    // Re-inject the hull (Stage reset the override via the App re-render).
    await page.waitForTimeout(500);
    await page.evaluate((lms) => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setFakeLandmarks?.(lms);
    }, spreadHandLandmarks());

    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        return (w.__handTracker?.__engine?.getLastRegionCount?.() ?? 0) > 0;
      },
      undefined,
      { timeout: 10_000 },
    );
    const regionCountAfterRestore = await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      return w.__handTracker?.__engine?.getLastRegionCount?.() ?? 0;
    });
    expect(regionCountAfterRestore).toBeGreaterThan(0);

    // Cleanup so later specs in the same worker start fresh.
    await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setFakeLandmarks?.(null);
    });

    // Console hygiene: exactly one 'context lost' warn + one 'restored' info,
    // zero errors introduced by the loss cycle.
    const warns = logs.filter((l) => l.type === 'warning' && l.text.includes('WebGL context lost'));
    const infos = logs.filter(
      (l) => l.type === 'info' && l.text.includes('WebGL context restored'),
    );
    expect(warns.length, `context-lost warns: ${warns.map((w) => w.text).join(' | ')}`).toBe(1);
    expect(infos.length, `context-restored infos: ${infos.map((i) => i.text).join(' | ')}`).toBe(1);

    const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
    expect(errors, `unexpected errors: ${errors.map((e) => e.text).join(' | ')}`).toEqual([]);
  });
});
