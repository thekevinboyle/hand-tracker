import { expect, test } from '@playwright/test';

test.describe('Task 1.6: Stage', () => {
  test('renders video + two canvases with mirror on GRANTED', async ({ page }) => {
    await page.goto('/');

    // COOP/COEP regression gate — MediaPipe wasm needs crossOriginIsolated.
    const isolated = await page.evaluate(() => window.crossOriginIsolated);
    expect(isolated).toBe(true);

    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 15_000 });

    const stage = page.getByTestId('stage');
    await expect(stage).toBeVisible();
    await expect(stage).toHaveAttribute('data-mirror', 'true');

    // Canvases are attached and have non-zero backing-store size.
    const webgl = page.getByTestId('webgl-canvas');
    const overlay = page.getByTestId('overlay-canvas');
    await expect(webgl).toBeAttached();
    await expect(overlay).toBeAttached();

    await expect
      .poll(async () => webgl.evaluate((el: HTMLCanvasElement) => el.width > 0 && el.height > 0), {
        timeout: 5_000,
      })
      .toBe(true);
    await expect
      .poll(
        async () => overlay.evaluate((el: HTMLCanvasElement) => el.width > 0 && el.height > 0),
        { timeout: 5_000 },
      )
      .toBe(true);

    // Video is ARIA-hidden and has a live MediaStream attached via the
    // Stage's srcObject effect (not via JSX).
    const video = page.getByTestId('stage-video');
    await expect(video).toHaveAttribute('aria-hidden', 'true');
    await expect
      .poll(async () => video.evaluate((el: HTMLVideoElement) => el.srcObject !== null), {
        timeout: 10_000,
      })
      .toBe(true);

    // Mirror source-of-truth (D27): scaleX(-1) is NEVER applied to the <video>.
    // The canvases carry the transform via the wrapper's data-mirror attribute.
    const videoTransform = await video.evaluate(
      (el: HTMLVideoElement) => window.getComputedStyle(el).transform,
    );
    // 'none' in the baseline; anything else would indicate the <video> got a CSS transform.
    expect(videoTransform === 'none' || videoTransform === '').toBe(true);

    const webglTransform = await webgl.evaluate(
      (el: HTMLCanvasElement) => window.getComputedStyle(el).transform,
    );
    // When mirror=true the computed transform should include scaleX(-1) → matrix(-1, 0, 0, 1, 0, 0).
    expect(webglTransform).toContain('matrix(-1');
  });
});
