/**
 * Phase 2 regression — Task 2.R.
 *
 * Exercises the combined Phase 2 pipeline (Tasks 2.1-2.5 plus the
 * setFakeLandmarks hotfix committed earlier on this branch) against the
 * `pnpm build --mode test && pnpm preview` production bundle started by the
 * playwright webServer config. Dev hooks expose under
 * `window.__handTracker.__engine.*` (nested) — the spec queries that shape
 * directly; see `.claude/skills/hand-tracker-fx-architecture/SKILL.md`
 * "Dev Hook Contract" for the authoritative surface.
 *
 * Each test is standalone so a failure points at the single checklist row it
 * covers. Screenshots land in `reports/phase-2-walkthrough/step-NN-*.png`
 * (gitignored — regenerate on demand). The `Task 2.R:` describe prefix is
 * what `--grep "Task 2.R:"` matches; do NOT rename.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const SHOT_DIR = 'reports/phase-2-walkthrough';

interface EngineHook {
  listEffects?: () => Array<{ id: string }>;
  getParam?: (dotPath: string) => unknown;
  setParam?: (dotPath: string, value: unknown) => void;
  getLandmarkBlobCount?: () => number;
  /** Returns a `GridLayout = { columns: Breakpoints; rows: Breakpoints }` or null
   *  before the first render loop tick. `columns.length === columnCount`. */
  lastGridLayout?: () => { columns: number[]; rows: number[] } | null;
  setFakeLandmarks?: (
    lms: Array<{ x: number; y: number; z: number; visibility?: number }> | null,
  ) => void;
}

interface HandTrackerHook {
  getFPS?: () => number;
  getLandmarkCount?: () => number;
  __engine?: EngineHook;
}

async function snap(page: Page, step: number, label: string): Promise<void> {
  await fs.mkdir(SHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SHOT_DIR, `step-${String(step).padStart(2, '0')}-${label}.png`),
    fullPage: false,
  });
}

function fakeLandmarks(): Array<{ x: number; y: number; z: number }> {
  // 21-landmark NormalizedLandmark array. Fingertip indices 4, 8, 12, 16, 20
  // get distinct coordinates (each within [0, 1]); filler landmarks sit at the
  // frame centre so they don't accidentally break downstream assertions.
  return Array.from({ length: 21 }, (_, i) => {
    if (i === 4) return { x: 0.3, y: 0.4, z: 0 };
    if (i === 8) return { x: 0.37, y: 0.29, z: 0 };
    if (i === 12) return { x: 0.5, y: 0.25, z: 0 };
    if (i === 16) return { x: 0.62, y: 0.29, z: 0 };
    if (i === 20) return { x: 0.7, y: 0.4, z: 0 };
    return { x: 0.5, y: 0.5, z: 0 };
  });
}

test.describe('Task 2.R: Phase 2 regression — engine + overlay', () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    (page as unknown as { __errors: string[] }).__errors = errors;

    await page.goto('/');
    // GRANTED is asserted via the hidden camera-state marker (Phase 1 pattern).
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });
    // Dev hook must materialise before any programmatic query.
    await page.waitForFunction(
      () =>
        typeof (window as unknown as { __handTracker?: HandTrackerHook }).__handTracker?.__engine
          ?.listEffects === 'function',
      undefined,
      { timeout: 10_000 },
    );
    // Wait for the render loop to complete its first tick — MediaPipe's cold
    // start + Stage ref attach + video.play() all have to resolve before
    // `lastGridLayout()` becomes non-null. Once it does, we know ctx2d is
    // wired through and all downstream assertions (grid, blobs, WebGL clear)
    // are inspecting live state rather than racing the first frame.
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        return w.__handTracker?.__engine?.lastGridLayout?.() !== null;
      },
      undefined,
      { timeout: 60_000 },
    );
    // Clear any stale landmark override from a prior test in the same worker.
    await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setFakeLandmarks?.(null);
      w.__handTracker?.__engine?.setParam?.('grid.columnCount', 12);
    });
  });

  test('crossOriginIsolated === true (COOP/COEP served by preview)', async ({ page }) => {
    const isolated = await page.evaluate(() => self.crossOriginIsolated);
    expect(isolated, 'crossOriginIsolated must be true on preview build').toBe(true);
  });

  test('registry exposes exactly handTrackingMosaic', async ({ page }) => {
    const ids = await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      const list = w.__handTracker?.__engine?.listEffects?.() ?? [];
      return list.map((e) => e.id);
    });
    expect(ids).toEqual(['handTrackingMosaic']);
  });

  test('default param snapshot matches DISCOVERY values', async ({ page }) => {
    const snap = await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      const get = (k: string) => w.__handTracker?.__engine?.getParam?.(k);
      return {
        seed: get('grid.seed'),
        columnCount: get('grid.columnCount'),
        rowCount: get('grid.rowCount'),
        widthVariance: get('grid.widthVariance'),
        tileSize: get('mosaic.tileSize'),
        blendOpacity: get('mosaic.blendOpacity'),
        edgeFeather: get('mosaic.edgeFeather'),
        regionPadding: get('effect.regionPadding'),
        mirrorMode: get('input.mirrorMode'),
        showLandmarks: get('input.showLandmarks'),
      };
    });
    expect(snap).toEqual({
      seed: 42,
      columnCount: 12,
      rowCount: 8,
      widthVariance: 0.6,
      tileSize: 16,
      blendOpacity: 1.0,
      edgeFeather: 0,
      regionPadding: 1,
      mirrorMode: true,
      showLandmarks: true,
    });
  });

  test('panel root is mounted (params-panel + tweakpane dom)', async ({ page }) => {
    await expect(page.getByTestId('params-panel')).toBeVisible();
    // Tweakpane renders a `.tp-rotv` root inside the container.
    await expect(page.locator('.tp-rotv')).toBeVisible();
  });

  test('grid default: 12 non-uniform columns, initial-load + grid-cols-before snaps', async ({
    page,
  }) => {
    // beforeEach already waited for the first render tick, so lastGridLayout()
    // is non-null here. We assert columns.length === 12 to match the D4 default.
    const columns = await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      return w.__handTracker?.__engine?.lastGridLayout?.()?.columns ?? [];
    });
    expect(columns).toHaveLength(12);
    // Breakpoints are cumulative; deltas between consecutive breakpoints are
    // the actual column widths. With widthVariance=0.6 those deltas must be
    // non-uniform — at least two distinct values after 4-decimal rounding.
    const deltas = columns.map((b, i) => b - (i > 0 ? (columns[i - 1] ?? 0) : 0));
    const uniqueDeltas = new Set(deltas.map((d) => d.toFixed(4)));
    expect(
      uniqueDeltas.size,
      'widthVariance=0.6 should produce non-uniform column widths',
    ).toBeGreaterThan(1);
    await snap(page, 1, 'initial-load');
    await snap(page, 2, 'grid-cols-before');
  });

  test('grid live-edit: setParam(grid.columnCount, 20) re-renders within 2s', async ({ page }) => {
    await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setParam?.('grid.columnCount', 20);
    });
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        return w.__handTracker?.__engine?.lastGridLayout?.()?.columns.length === 20;
      },
      undefined,
      { timeout: 2_000 },
    );
    const columns = await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      return w.__handTracker?.__engine?.lastGridLayout?.()?.columns ?? [];
    });
    expect(columns).toHaveLength(20);
    await snap(page, 3, 'grid-cols-after');
  });

  test('blob count = 0 with synthetic testsrc2 Y4M', async ({ page }) => {
    // beforeEach already confirmed the render loop is ticking (lastGridLayout
    // is non-null). One settle window keeps the "no hand" assertion stable —
    // the testsrc2 pattern cannot satisfy HandLandmarker so detection stays at 0.
    await page.waitForTimeout(1500);
    const count = await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      return w.__handTracker?.__engine?.getLandmarkBlobCount?.() ?? -1;
    });
    expect(count, 'synthetic Y4M should yield 0 blobs (no hand)').toBe(0);
    await snap(page, 4, 'blobs-testsrc2');
  });

  test('blob count = 5 with injected fake landmarks', async ({ page }) => {
    await page.evaluate((lms) => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setFakeLandmarks?.(lms);
    }, fakeLandmarks());
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
      return w.__handTracker?.__engine?.getLandmarkBlobCount?.() ?? -1;
    });
    expect(count).toBe(5);
    await snap(page, 5, 'blobs-injected');
    // Clean up so the next test doesn't see a stale override.
    await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setFakeLandmarks?.(null);
    });
  });

  test('WebGL canvas is alive and rendering (Phase 3.4+ — was "black" at Phase 2)', async ({
    page,
  }) => {
    // Historical note: Phase 2 (pre-3.4) asserted the WebGL canvas cleared to
    // black because `manifest.create()` was a noop gl.clear. Task 3.4 replaced
    // that with a real shader Program draw, so the canvas now carries video
    // pixels. The updated assertion only verifies the WebGL canvas is present
    // and renders a valid RGBA pixel (alpha === 255) — the specific visual
    // fidelity gate lives in Task 3.R.
    await snap(page, 6, 'webgl-black');
    const centerPixel = await page.evaluate(() => {
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
      return Array.from(px);
    });
    expect(centerPixel, 'WebGL canvas must be present').not.toBeNull();
    const alpha = (centerPixel as number[])[3];
    expect(alpha, 'a drawn Program leaves alpha=255 (vs cleared buffer=0)').toBe(255);
  });

  test('mirror default — display canvas carries scaleX(-1) transform', async ({ page }) => {
    const transform = await page.evaluate(() => {
      const el = document.querySelector('canvas[data-testid="webgl-canvas"]') as HTMLElement | null;
      if (!el) return null;
      return getComputedStyle(el).transform;
    });
    expect(transform).not.toBeNull();
    // matrix(-1, 0, 0, 1, 0, 0) is the standard scaleX(-1) serialization.
    expect(transform as string).toMatch(/matrix\(\s*-1|matrix3d\(\s*-1/);
  });

  test('zero console errors across a 5-second capture window', async ({ page }) => {
    await page.waitForTimeout(5_000);
    const errs = (page as unknown as { __errors: string[] }).__errors;
    expect(errs, `console errors: ${errs.join(' | ')}`).toEqual([]);
  });
});
