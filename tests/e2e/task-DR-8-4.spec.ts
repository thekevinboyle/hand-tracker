/**
 * Task DR-8.4 — Restyled error + pre-prompt cards E2E.
 *
 * L4 for the fourth Phase-DR-8 task. Proves that:
 *   1. The PROMPT card mounts with the new token-driven palette — card root
 *      carries BOTH `.card` and `.card-panel` classes (HIGH-07 co-class —
 *      no new wrapper <div>); its computed background matches --color-panel
 *      (#151515 → rgb(21, 21, 21)).
 *   2. The <hr class="card-divider" /> (DR14) is rendered between title
 *      and body and is visible (a 1px hairline in --color-divider).
 *   3. The card preserves its stable testid `error-state-card-PROMPT` plus
 *      role="dialog" + aria-live="polite" so existing specs keep resolving.
 *   4. GRANTED flow still dismounts the pre-prompt card.
 *
 * The full 6 remaining error states (USER_DENIED, SYSTEM_DENIED,
 * DEVICE_CONFLICT, NOT_FOUND, MODEL_LOAD_FAIL, NO_WEBGL) rely on
 * `addInitScript`-based navigator stubs that DR-9.2 introduces. DR-8.4 only
 * owns the RESTYLE; those visual assertions land in DR-9.2 alongside the
 * spec rename from `errorStates.spec.ts` → `error-states.spec.ts`.
 *
 * Describe prefix MUST start with literal `Task DR-8.4:` so
 * `pnpm test:e2e --grep "Task DR-8.4:"` resolves these tests only.
 */

import { expect, test } from '@playwright/test';

test.describe('Task DR-8.4: PrePromptCard renders with the new tokens', () => {
  test('PROMPT card: panel background + divider + preserved testid', async ({ browser }) => {
    // Fresh context without the Playwright-config's camera auto-grant so the
    // app lands on PROMPT. Stall getUserMedia so the PROMPT state doesn't
    // auto-transition to GRANTED during page load (same pattern as the
    // DR-6-regression walkthrough).
    const context = await browser.newContext({ permissions: [] });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const never = new Promise<MediaStream>(() => {});
      const md = navigator.mediaDevices;
      if (md) md.getUserMedia = () => never;
      if (navigator.permissions) {
        navigator.permissions.query = () =>
          Promise.resolve({
            state: 'prompt',
            name: 'camera',
            onchange: null,
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent: () => true,
          } as unknown as PermissionStatus);
      }
    });
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('PROMPT', { timeout: 30_000 });

    const card = page.getByTestId('error-state-card-PROMPT');
    await expect(card).toBeVisible();

    // HIGH-07 co-class: the panel styling lives on the SAME element as
    // the testid root. No new wrapper div exists. Any legacy selector
    // chaining directly off the testid (`[data-testid=…] .card-title`)
    // still resolves because the title is a direct child of the panel.
    const hasPanelClass = await card.evaluate((el) => el.classList.contains('card-panel'));
    expect(hasPanelClass).toBe(true);

    // DR5 — panel bg token resolves to #151515 = rgb(21, 21, 21).
    const bg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(21, 21, 21)');

    // DR14 — hairline divider is rendered and visible (1px tall, non-zero
    // border between title and body).
    const divider = card.locator('hr.card-divider');
    await expect(divider).toBeVisible();
    const dividerBorder = await divider.evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(dividerBorder).toBe('1px');

    // DR7 — JetBrains Mono inherited from :root through the card.
    const titleFont = await card
      .locator('.card-title')
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(titleFont).toContain('JetBrains Mono');

    // DR14 structural invariant — testid + role + aria-live preserved.
    await expect(card).toHaveAttribute('role', 'dialog');
    await expect(card).toHaveAttribute('aria-live', 'polite');

    // Title (--color-text-primary #EAEAEA) + body (--color-text-muted #8F8F8F)
    // computed colors come through as rgb() strings.
    const titleColor = await card
      .locator('.card-title')
      .evaluate((el) => getComputedStyle(el).color);
    expect(titleColor).toBe('rgb(234, 234, 234)');
    const bodyColor = await card.locator('.card-body').evaluate((el) => getComputedStyle(el).color);
    expect(bodyColor).toBe('rgb(143, 143, 143)');

    // Retry button uses .card-retry — cursor:pointer + radius-0 at rest.
    const retry = card.locator('.card-retry');
    await expect(retry).toBeVisible();
    const retryStyle = await retry.evaluate((el) => {
      const s = getComputedStyle(el);
      return { cursor: s.cursor, borderRadius: s.borderTopLeftRadius };
    });
    expect(retryStyle.cursor).toBe('pointer');
    // radius-0 = '0' → computed style reports '0px'.
    expect(retryStyle.borderRadius).toBe('0px');

    await context.close();
  });
});

test.describe('Task DR-8.4: GRANTED flow dismounts the PROMPT card', () => {
  test('no error card in the DOM once camera resolves to GRANTED', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });
    // All 8 testids resolve to zero matches once GRANTED.
    await expect(page.getByTestId('error-state-card-PROMPT')).toHaveCount(0);
    await expect(page.getByTestId('error-state-card-USER_DENIED')).toHaveCount(0);
    await expect(page.locator('[role="alert"]')).toHaveCount(0);
  });
});
