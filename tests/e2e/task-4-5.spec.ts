/**
 * L4 for Task 4.5 — record → .webm download.
 *
 * Drives the real MediaRecorder + HTMLCanvasElement.captureStream stack
 * in Chromium against the overlay canvas. Asserts:
 *   1. Record button exists + starts in idle state.
 *   2. Clicking Record toggles `data-recording="true"` + shows mm:ss.
 *   3. Clicking Record again triggers a Playwright download event whose
 *      filename matches `hand-tracker-fx-*.webm` and whose payload is
 *      non-empty.
 *
 * Describe prefix MUST start with literal `Task 4.5:` so
 * `--grep "Task 4.5:"` resolves these tests only.
 */

import { expect, test } from '@playwright/test';

test.describe('Task 4.5: record webm download', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });
    // Give the render loop a couple of frames so the overlay canvas has a
    // non-black buffer before captureStream picks it up.
    await page.waitForTimeout(500);
  });

  test('record → stop triggers a .webm download with a timestamped name', async ({ page }) => {
    const recordBtn = page.getByRole('button', { name: 'Start recording' });
    await expect(recordBtn).toBeVisible();
    await expect(recordBtn).toHaveAttribute('data-recording', 'false');

    // Race the click with the download listener so the download event is
    // observable regardless of when the blob flushes.
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });

    await recordBtn.click();
    // Button flips to recording state.
    await expect(page.getByRole('button', { name: 'Stop recording' })).toHaveAttribute(
      'data-recording',
      'true',
    );

    // Record for ~1.2 seconds so the recorder captures at least one frame.
    await page.waitForTimeout(1_200);

    await page.getByRole('button', { name: 'Stop recording' }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^hand-tracker-fx-.*\.webm$/);
    expect(download.suggestedFilename()).not.toContain(':');

    const stream = await download.createReadStream();
    if (!stream) throw new Error('download stream unavailable');
    let bytes = 0;
    for await (const chunk of stream as unknown as AsyncIterable<Buffer>) {
      bytes += chunk.length;
    }
    expect(bytes, 'recorded .webm payload should be non-empty').toBeGreaterThan(0);

    // Button returns to idle.
    await expect(page.getByRole('button', { name: 'Start recording' })).toHaveAttribute(
      'data-recording',
      'false',
    );
  });

  test('elapsed time displays mm:ss while recording', async ({ page }) => {
    const recordBtn = page.getByRole('button', { name: 'Start recording' });
    await recordBtn.click();

    // Wait until the 250 ms ticker has fired at least once.
    await page.waitForTimeout(350);
    const elapsed = page.getByTestId('record-elapsed');
    await expect(elapsed).toBeVisible();
    await expect(elapsed).toHaveText(/^\d+:\d{2}$/);

    // Clean up so the download doesn't linger into the next test.
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
    await page.getByRole('button', { name: 'Stop recording' }).click();
    await downloadPromise;
  });
});
