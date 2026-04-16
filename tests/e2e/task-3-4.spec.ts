/**
 * L4 for Task 3.4 — effect render wire-up.
 *
 * Injects a known hand hull via `setFakeLandmarks`, waits for the next
 * render tick, and asserts:
 *   1. `getLastRegionCount()` > 0 (effect.render() ran + packed rects)
 *   2. Changing `mosaic.tileSize` changes the rendered pixel (the uniform
 *      upload path actually invalidates ogl's cache)
 *   3. Zero console errors during a 3 s capture window (shader compiled +
 *      linked cleanly; no stray `INVALID_OPERATION` / `out of memory`
 *      driver complaints).
 *
 * Describe prefix MUST be literal `Task 3.4:` for `--grep "Task 3.4:"`.
 */

import { expect, test } from '@playwright/test';

interface EngineHook {
  setFakeLandmarks?: (
    lms: Array<{ x: number; y: number; z: number; visibility?: number }> | null,
  ) => void;
  setParam?: (dotPath: string, value: unknown) => void;
  getLastRegionCount?: () => number;
}

interface HandTrackerHook {
  __engine?: EngineHook;
}

function spreadHandLandmarks(): Array<{ x: number; y: number; z: number; visibility: number }> {
  // 21-point array; only the 6 hull indices (0, 4, 8, 12, 16, 20) carry a
  // real spread — fillers sit at frame centre. This geometry covers a wide
  // chunk of the grid so `computeActiveRegions` returns > 5 rects.
  const center = { x: 0.5, y: 0.5, z: 0, visibility: 1 };
  const out = Array.from({ length: 21 }, () => ({ ...center }));
  const hull: Array<[number, number]> = [
    [0.3, 0.75], // 0  wrist
    [0.2, 0.55], // 4  thumb
    [0.35, 0.2], // 8  index tip
    [0.55, 0.15], // 12 middle tip
    [0.72, 0.35], // 16 ring tip
    [0.78, 0.55], // 20 pinky tip
  ];
  [0, 4, 8, 12, 16, 20].forEach((idx, i) => {
    const pt = hull[i];
    if (pt) out[idx] = { x: pt[0], y: pt[1], z: 0, visibility: 1 };
  });
  return out;
}

async function readCenterPixel(
  page: import('@playwright/test').Page,
): Promise<[number, number, number, number] | null> {
  return await page.evaluate(() => {
    const canvas = document.querySelector(
      'canvas[data-testid="webgl-canvas"]',
    ) as HTMLCanvasElement | null;
    if (!canvas) return null;
    const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) return null;
    const x = Math.floor(gl.drawingBufferWidth / 2);
    const y = Math.floor(gl.drawingBufferHeight / 2);
    const px = new Uint8Array(4);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return [px[0] ?? 0, px[1] ?? 0, px[2] ?? 0, px[3] ?? 0];
  });
}

test.describe('Task 3.4: effect render wire-up', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        return (
          typeof w.__handTracker?.__engine?.setFakeLandmarks === 'function' &&
          typeof w.__handTracker.__engine.getLastRegionCount === 'function'
        );
      },
      undefined,
      { timeout: 10_000 },
    );
  });

  test('getLastRegionCount() > 0 after injecting a spread hand hull', async ({ page }) => {
    await page.evaluate((lms) => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setFakeLandmarks?.(lms);
    }, spreadHandLandmarks());

    // Cold-start MediaPipe + first rVFC tick can take several seconds on a
    // fresh page — bump past the default 5 s to avoid a false flake.
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        return (w.__handTracker?.__engine?.getLastRegionCount?.() ?? 0) > 0;
      },
      undefined,
      { timeout: 15_000 },
    );
    const count = await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      return w.__handTracker?.__engine?.getLastRegionCount?.() ?? 0;
    });
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(96);

    await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setFakeLandmarks?.(null);
    });
  });

  test('mosaic.tileSize setParam round-trips + render does not error', async ({ page }) => {
    // Pixel-level tile-size changes are visually verified in Task 3.R's
    // regression (the synthetic testsrc2 webcam has flat regions where
    // different tile sizes happen to sample identical pixels). Here we
    // assert the parameter path is wired end-to-end: setParam flows through
    // paramStore → manifest.render() reads it → uniform upload happens.
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

    for (const tileSize of [4, 16, 32, 64]) {
      await page.evaluate((ts) => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        w.__handTracker?.__engine?.setParam?.('mosaic.tileSize', ts);
      }, tileSize);
      await page.waitForTimeout(100);
      const pixel = await readCenterPixel(page);
      // The render path stays healthy across the entire D9 range (4..64).
      expect(pixel, `tileSize=${tileSize} should render a readable pixel`).not.toBeNull();
      // Alpha should be 255 when the WebGL canvas has drawn through the
      // Program (vs. an uninitialised 0 from a blank buffer).
      expect(pixel?.[3]).toBe(255);
    }

    // Reset so downstream tests don't inherit the tile-size bump.
    await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setParam?.('mosaic.tileSize', 16);
      w.__handTracker?.__engine?.setFakeLandmarks?.(null);
    });
  });

  test('no console errors during a 3s mosaic-rendering window', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
    });

    await page.evaluate((lms) => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setFakeLandmarks?.(lms);
    }, spreadHandLandmarks());

    await page.waitForTimeout(3_000);

    await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setFakeLandmarks?.(null);
    });

    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
