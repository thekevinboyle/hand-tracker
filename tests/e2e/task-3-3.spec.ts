/**
 * L4 for Task 3.3 — hand polygon → active cells.
 *
 * Injects a deterministic 21-landmark fixture covering a known portion of
 * the frame, then calls the `computeActiveRegions` dev hook and asserts
 * UV-space invariants + non-zero rect count. Narrow coverage here — the
 * full concave / padding / cap matrix lives in
 * `src/effects/handTrackingMosaic/region.test.ts` (L2); this spec just
 * confirms the module is reachable from the live production bundle.
 *
 * Describe prefix MUST be literal `Task 3.3:` for `--grep "Task 3.3:"` to
 * resolve these tests only.
 */

import { expect, test } from '@playwright/test';

interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface EngineHook {
  setFakeLandmarks?: (
    lms: Array<{ x: number; y: number; z: number; visibility?: number }> | null,
  ) => void;
  computeActiveRegions?: (opts: {
    videoW: number;
    videoH: number;
    columnEdges: number[];
    rowEdges: number[];
    regionPadding: number;
  }) => Rect[];
}

interface HandTrackerHook {
  __engine?: EngineHook;
}

function uniformEdges(count: number, size: number): number[] {
  const edges = new Array<number>(count + 1);
  for (let i = 0; i <= count; i++) edges[i] = (i / count) * size;
  return edges;
}

function hullLandmarks(): Array<{ x: number; y: number; z: number; visibility: number }> {
  // 21-landmark array where wrist + 5 fingertips trace a diamond in the
  // centre of the frame. Filler landmarks sit at (0.5, 0.5) — they don't
  // enter the polygon math, only the 6 hull indices do.
  const center = { x: 0.5, y: 0.5, z: 0, visibility: 1 };
  const out = Array.from({ length: 21 }, () => ({ ...center }));
  const hull: Array<[number, number]> = [
    [0.3, 0.5], // 0 wrist
    [0.5, 0.3], // 4 thumb
    [0.7, 0.5], // 8 index
    [0.5, 0.7], // 12 middle
    [0.35, 0.6], // 16 ring
    [0.35, 0.45], // 20 pinky
  ];
  [0, 4, 8, 12, 16, 20].forEach((idx, i) => {
    const pt = hull[i];
    if (pt) out[idx] = { x: pt[0], y: pt[1], z: 0, visibility: 1 };
  });
  return out;
}

test.describe('Task 3.3: hand polygon → active cells', () => {
  test('computeActiveRegions returns UV rects under the injected hand hull', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        return (
          typeof w.__handTracker?.__engine?.setFakeLandmarks === 'function' &&
          typeof w.__handTracker.__engine.computeActiveRegions === 'function'
        );
      },
      undefined,
      { timeout: 10_000 },
    );

    await page.evaluate((lms) => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setFakeLandmarks?.(lms);
    }, hullLandmarks());

    const rects = await page.evaluate(
      ({ edges, size }) => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        return (
          w.__handTracker?.__engine?.computeActiveRegions?.({
            videoW: size,
            videoH: size,
            columnEdges: edges,
            rowEdges: edges,
            regionPadding: 0,
          }) ?? []
        );
      },
      { edges: uniformEdges(8, 800), size: 800 },
    );

    expect(rects.length, 'polygon should light at least one cell').toBeGreaterThan(0);
    expect(rects.length, 'MAX_REGIONS cap').toBeLessThanOrEqual(96);
    for (const r of rects) {
      expect(r.x1).toBeGreaterThanOrEqual(0);
      expect(r.y1).toBeGreaterThanOrEqual(0);
      expect(r.x2).toBeLessThanOrEqual(1);
      expect(r.y2).toBeLessThanOrEqual(1);
      expect(r.x2).toBeGreaterThan(r.x1);
      expect(r.y2).toBeGreaterThan(r.y1);
    }

    // Clean up so the rest of the session doesn't see injected landmarks.
    await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setFakeLandmarks?.(null);
    });
  });
});
