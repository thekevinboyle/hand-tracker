/**
 * L4 for Task 3.1 — ogl renderer bootstrap + video texture.
 *
 * Exercises the real WebGL2 stack end-to-end against the production preview
 * build. Asserts three invariants Phase 3.2+ depend on:
 *   1. The WebGL canvas has non-zero physical backing-store dimensions.
 *   2. `window.__handTracker.__engine.getVideoTextureHandle()` returns a
 *      live `WebGLTexture` after the camera reaches GRANTED + Stage has
 *      mounted the renderer.
 *   3. No `webglcontextlost` or console errors in a 3 s capture window.
 *
 * Describe prefix MUST start with literal `Task 3.1:` so `--grep "Task 3.1:"`
 * resolves to exactly these tests and nothing else.
 */

import { expect, test } from '@playwright/test';

test.describe('Task 3.1: ogl renderer bootstrap', () => {
  test('WebGL canvas physical size > 0 after GRANTED', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });

    const size = await page.evaluate(() => {
      const el = document.querySelector(
        'canvas[data-testid="webgl-canvas"]',
      ) as HTMLCanvasElement | null;
      return el ? { width: el.width, height: el.height } : null;
    });
    expect(size, 'webgl-canvas must be present').not.toBeNull();
    expect(
      size?.width,
      'renderer.setSize must have set a non-zero backing-store width',
    ).toBeGreaterThan(0);
    expect(
      size?.height,
      'renderer.setSize must have set a non-zero backing-store height',
    ).toBeGreaterThan(0);
  });

  test('getVideoTextureHandle() returns a WebGLTexture instance', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });

    interface EngineHook {
      getVideoTextureHandle?: () => WebGLTexture | null;
    }
    interface HandTrackerHook {
      __engine?: EngineHook;
    }

    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        return (
          typeof w.__handTracker?.__engine?.getVideoTextureHandle === 'function' &&
          w.__handTracker.__engine.getVideoTextureHandle() !== null
        );
      },
      undefined,
      { timeout: 10_000 },
    );

    const isTexture = await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      const handle = w.__handTracker?.__engine?.getVideoTextureHandle?.();
      return handle instanceof WebGLTexture;
    });
    expect(isTexture).toBe(true);
  });

  test('no webglcontextlost or console errors in a 3s window', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
    });

    await page.addInitScript(() => {
      (window as unknown as { __ctxLost: boolean }).__ctxLost = false;
      window.addEventListener('webglcontextlost', () => {
        (window as unknown as { __ctxLost: boolean }).__ctxLost = true;
      });
    });

    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });
    await page.waitForTimeout(3_000);

    const ctxLost = await page.evaluate(
      () => (window as unknown as { __ctxLost: boolean }).__ctxLost,
    );
    expect(ctxLost, 'webglcontextlost fired within 3s of GRANTED').toBe(false);
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
