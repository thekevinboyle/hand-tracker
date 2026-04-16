/**
 * Phase 3 regression — Task 3.R.
 *
 * Visual-fidelity gate for the Phase 3 pipeline (Tasks 3.1-3.5). Drives the
 * production preview build via the committed playwright webServer (`pnpm
 * build --mode test && pnpm preview`), injects a deterministic hand hull,
 * and asserts every item on the 8-point visual checklist where it can be
 * verified programmatically. The human-reviewed side-by-side composite is
 * generated in a separate `captures side-by-side composite` test that
 * writes three PNGs into `reports/`. The pixel-exact comparison against
 * the TouchDesigner reference is explicitly NOT done — structure only.
 *
 * Dev-hook shape (matches current codebase, not the stale task file):
 *   window.__handTracker.getFPS()                      — flat
 *   window.__handTracker.__engine.getLandmarkBlobCount — nested
 *   window.__handTracker.__engine.getLastRegionCount   — nested
 *   window.__handTracker.__engine.setFakeLandmarks     — nested
 *   window.__handTracker.__engine.lastGridLayout       — nested, fn-valued
 *   window.__handTracker.__engine.forceContextLoss     — nested
 *   window.__handTracker.__engine.forceContextRestore  — nested
 *
 * Describe prefix MUST be literal `Task 3.R:` for `--grep "Task 3.R:"`.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const REPORTS_DIR = 'reports';
const REFERENCE_PNG = path.resolve(
  '.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png',
);

interface EngineHook {
  setFakeLandmarks?: (
    lms: Array<{ x: number; y: number; z: number; visibility?: number }> | null,
  ) => void;
  getLandmarkBlobCount?: () => number;
  getLastRegionCount?: () => number;
  lastGridLayout?: () => { columns: number[]; rows: number[] } | null;
  forceContextLoss?: () => boolean;
  forceContextRestore?: () => boolean;
  getVideoTextureHandle?: () => WebGLTexture | null;
}

interface HandTrackerHook {
  getFPS?: () => number;
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

async function injectAndWaitForRegions(page: Page): Promise<void> {
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
    { timeout: 20_000 },
  );
}

test.describe('Task 3.R: Phase 3 regression — visual fidelity gate', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        return (
          typeof w.__handTracker?.__engine?.setFakeLandmarks === 'function' &&
          typeof w.__handTracker.__engine.getLastRegionCount === 'function' &&
          typeof w.__handTracker.__engine.lastGridLayout === 'function'
        );
      },
      undefined,
      { timeout: 10_000 },
    );
  });

  test('crossOriginIsolated === true (D31)', async ({ page }) => {
    const isolated = await page.evaluate(() => self.crossOriginIsolated);
    expect(isolated).toBe(true);
  });

  test('grid: 12 columns × 8 rows, non-uniform widths (D4)', async ({ page }) => {
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        return w.__handTracker?.__engine?.lastGridLayout?.() !== null;
      },
      undefined,
      { timeout: 20_000 },
    );
    const layout = await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      return w.__handTracker?.__engine?.lastGridLayout?.() ?? null;
    });
    expect(layout).not.toBeNull();
    expect(layout?.columns).toHaveLength(12);
    expect(layout?.rows).toHaveLength(8);
    // Non-uniform: diffs between breakpoints must have > 1 unique value.
    const cols = layout?.columns ?? [];
    const widths = cols.map((b, i) => b - (i > 0 ? (cols[i - 1] ?? 0) : 0));
    const unique = new Set(widths.map((w) => w.toFixed(4)));
    expect(unique.size, 'variance=0.6 produces non-uniform widths').toBeGreaterThan(1);
  });

  test('5 fingertip blobs render with injected landmarks (D6)', async ({ page }) => {
    await injectAndWaitForRegions(page);
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        return w.__handTracker?.__engine?.getLandmarkBlobCount?.() === 5;
      },
      undefined,
      { timeout: 5_000 },
    );
    const count = await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      return w.__handTracker?.__engine?.getLandmarkBlobCount?.() ?? 0;
    });
    expect(count).toBe(5);
    await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setFakeLandmarks?.(null);
    });
  });

  test('mosaic active: region count > 0 when hand polygon present (D5)', async ({ page }) => {
    await injectAndWaitForRegions(page);
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

  test('full-viewport + mirror ON by default (D10, D18, D27)', async ({ page }) => {
    // Canvas fills 100vw/100vh: physical backing > 0.
    const size = await page.evaluate(() => {
      const c = document.querySelector(
        'canvas[data-testid="webgl-canvas"]',
      ) as HTMLCanvasElement | null;
      return c ? { w: c.width, h: c.height, style: getComputedStyle(c).transform } : null;
    });
    expect(size).not.toBeNull();
    expect(size?.w).toBeGreaterThan(0);
    expect(size?.h).toBeGreaterThan(0);
    // Mirror default: scaleX(-1) on the canvas.
    expect(size?.style as string).toMatch(/matrix\(\s*-1|matrix3d\(\s*-1/);
  });

  test('dark theme — page background is dark (D12)', async ({ page }) => {
    const bgColor = await page.evaluate(() => {
      const bg = getComputedStyle(document.body).backgroundColor;
      // Parse "rgb(r, g, b)" / "rgba(r, g, b, a)" into an RGB tuple.
      const m = bg.match(/\d+/g);
      return m && m.length >= 3 ? [Number(m[0]), Number(m[1]), Number(m[2])] : null;
    });
    expect(bgColor).not.toBeNull();
    const [r, g, b] = bgColor as number[];
    // Perceived lightness (rough approximation) must be low.
    const lightness = (r + g + b) / 3;
    expect(lightness, `body bg RGB=(${r}, ${g}, ${b}) should be dark`).toBeLessThan(50);
  });

  test('FPS ≥ 10 (CI liveness) — real-world target ≥ 20 (D21) measured manually', async ({
    page,
  }) => {
    // D21's ≥ 20 fps success criterion targets user hardware with a real GPU.
    // Playwright on headless Chromium with SwiftShader / software rendering
    // typically caps at 12-16 fps with MediaPipe inference in the hot path,
    // so this gate only asserts the render loop is alive (≥ 10). The full
    // target is re-verified manually on the maintainer's hardware per the
    // regression report checklist.
    await injectAndWaitForRegions(page);
    await page.waitForTimeout(2_000); // warmup
    // `getFPS` is a rolling 3 s average maintained by the render loop.
    await page.waitForTimeout(3_000);
    const fps = await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      return w.__handTracker?.getFPS?.() ?? 0;
    });
    expect(fps, `getFPS returned ${fps.toFixed(2)}`).toBeGreaterThanOrEqual(10);
    await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setFakeLandmarks?.(null);
    });
  });

  test('zero console errors across a 5 s capture window', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
    });
    await page.waitForTimeout(5_000);
    expect(errors, `errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('context loss → restore resumes mosaic rendering (Task 3.5 re-exercise)', async ({
    page,
  }) => {
    await injectAndWaitForRegions(page);
    const initialCount = await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      return w.__handTracker?.__engine?.getLastRegionCount?.() ?? 0;
    });
    expect(initialCount).toBeGreaterThan(0);

    const lossOk = await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      return w.__handTracker?.__engine?.forceContextLoss?.() ?? false;
    });
    test.skip(!lossOk, 'WEBGL_lose_context unavailable on this runner');

    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        return w.__handTracker?.__engine?.getVideoTextureHandle?.() === null;
      },
      undefined,
      { timeout: 5_000 },
    );

    const restoreOk = await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      return w.__handTracker?.__engine?.forceContextRestore?.() ?? false;
    });
    expect(restoreOk).toBe(true);

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
      { timeout: 15_000 },
    );
    const resumedCount = await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      return w.__handTracker?.__engine?.getLastRegionCount?.() ?? 0;
    });
    expect(resumedCount).toBeGreaterThan(0);

    await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setFakeLandmarks?.(null);
    });
  });

  test('captures live app screenshot + reference + 2-up composite', async ({ page }) => {
    await injectAndWaitForRegions(page);
    await fs.mkdir(REPORTS_DIR, { recursive: true });

    const appPath = path.join(REPORTS_DIR, 'phase-3-visual-01-app.png');
    const refPath = path.join(REPORTS_DIR, 'phase-3-visual-02-reference.png');
    const compPath = path.join(REPORTS_DIR, 'phase-3-visual-composite.png');

    await page.screenshot({ path: appPath, fullPage: false });
    await fs.copyFile(REFERENCE_PNG, refPath);

    const appBytes = await fs.readFile(appPath);
    const refBytes = await fs.readFile(refPath);
    const appB64 = `data:image/png;base64,${appBytes.toString('base64')}`;
    const refB64 = `data:image/png;base64,${refBytes.toString('base64')}`;

    // Use a blank data: URL (same-origin as nothing) so the composite canvas
    // can drawImage both data URLs without CORS friction.
    await page.goto('data:text/html,<html><body><canvas id="c"></canvas></body></html>');
    const compositeDataUrl = await page.evaluate(
      async ({ app, ref }) => {
        const load = (src: string): Promise<HTMLImageElement> =>
          new Promise((res, rej) => {
            const img = new Image();
            img.onload = () => res(img);
            img.onerror = rej;
            img.src = src;
          });
        const [appImg, refImg] = await Promise.all([load(app), load(ref)]);
        const c = document.getElementById('c') as HTMLCanvasElement;
        const gap = 16;
        const h = Math.max(appImg.height, refImg.height);
        c.width = appImg.width + gap + refImg.width;
        c.height = h;
        const ctx = c.getContext('2d');
        if (!ctx) throw new Error('2D context unavailable');
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(appImg, 0, 0);
        ctx.drawImage(refImg, appImg.width + gap, 0);
        return c.toDataURL('image/png');
      },
      { app: appB64, ref: refB64 },
    );

    const base64 = compositeDataUrl.split(',')[1];
    if (!base64) throw new Error('composite dataURL missing base64 segment');
    await fs.writeFile(compPath, Buffer.from(base64, 'base64'));

    const stat = await fs.stat(compPath);
    expect(stat.size).toBeGreaterThan(0);
  });
});
