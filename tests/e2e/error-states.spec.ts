/**
 * Task DR-9.2 — D23 eight-state coverage on the reworked chrome.
 *
 * Renamed from `errorStates.spec.ts` (camelCase, parent Task 1.2 vintage) via
 * `git mv` per synergy-fix HIGH-06. The old 1-spec file is superseded by this
 * matrix: 8 describes, one per camera state, each forcing the state through
 * JS-level stubs (addInitScript / context.route / grantPermissions).
 *
 * Forcing mechanisms per state (no `?forceState=` URL-param shortcuts —
 * DR-9.2 tightens parent 5.4 by exercising real rejection paths):
 *   PROMPT           — context.clearPermissions + no grant; useCamera reads
 *                      permissions.query === 'prompt' and renders PrePromptCard.
 *   USER_DENIED      — permissions.query → 'denied' + gUM throws NotAllowedError.
 *   SYSTEM_DENIED    — permissions.query → 'prompt' + gUM throws NotAllowedError
 *                      (the permission-state signal differentiates from USER_DENIED).
 *   DEVICE_CONFLICT  — grantPermissions(['camera']) + gUM throws NotReadableError.
 *   NOT_FOUND        — enumerateDevices → [] + gUM throws NotFoundError.
 *   MODEL_LOAD_FAIL  — context.route fulfills /models/hand_landmarker.task with 500.
 *   NO_WEBGL         — HTMLCanvasElement.getContext stub returns null for
 *                      webgl / webgl2 / experimental-webgl; terminal — no retry.
 *   GRANTED          — default happy path; assert render-canvas visible and
 *                      no error card present.
 *
 * Describe blocks all start `Task DR-9.2:` so `--grep "Task DR-9.2:"` resolves
 * exactly these 8 specs. Each spec calls `unregisterSW(page)` BEFORE stubbing
 * so the Task-5.1 service worker can't cache-replay a prior successful fetch
 * (critical for MODEL_LOAD_FAIL — a cached 200 would mask the 500 we inject).
 */

import { expect, type Page, test } from '@playwright/test';

/**
 * Clear the Task-5.1 service worker BEFORE any other stub. The SW caches
 * /models/* and /wasm/* aggressively; if a prior test run cached the model,
 * our route-intercept 500 won't surface and MODEL_LOAD_FAIL silently passes.
 * This initScript also clears the Cache Storage entries the SW populated.
 */
async function unregisterSW(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const r of regs) void r.unregister();
      });
    }
    if (typeof caches !== 'undefined') {
      void caches.keys().then((keys) => {
        for (const k of keys) void caches.delete(k);
      });
    }
  });
}

/** Wait for the specific error-state card to become visible. */
async function waitForCard(page: Page, state: string) {
  const card = page.locator(`[data-testid="error-state-card-${state}"]`);
  await expect(card).toBeVisible({ timeout: 30_000 });
  return card;
}

// ─── 1. PROMPT ──────────────────────────────────────────────────────────────
// Default pre-grant state. Clear any inherited permission grants; stall
// getUserMedia so an auto-granted context (inherited from the test project's
// `permissions: ['camera']`) can't race past PROMPT.
test.describe('Task DR-9.2: PROMPT state card', () => {
  test('pre-prompt card renders when permissionState is prompt', async ({ browser }) => {
    const context = await browser.newContext({ permissions: [] });
    const page = await context.newPage();
    await unregisterSW(page);
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
    const card = await waitForCard(page, 'PROMPT');
    await expect(card).toHaveAttribute('role', /alertdialog|dialog|region|alert/);
    // PrePromptCard's primary action (copy: "Enable Camera").
    await expect(card.getByRole('button', { name: /enable|allow|grant/i })).toBeVisible();
    await context.close();
  });
});

// ─── 2. USER_DENIED ─────────────────────────────────────────────────────────
// User explicitly denied. permissions.query → 'denied' + gUM throws
// NotAllowedError; useCamera's PermissionStatus path sets USER_DENIED directly
// on mount because permission.state === 'denied' before startCapture runs.
test.describe('Task DR-9.2: USER_DENIED state card', () => {
  test('renders with retry button when user denies permission', async ({ browser }) => {
    const context = await browser.newContext({ permissions: [] });
    const page = await context.newPage();
    await unregisterSW(page);
    await page.addInitScript(() => {
      if (navigator.permissions) {
        navigator.permissions.query = () =>
          Promise.resolve({
            state: 'denied',
            name: 'camera',
            onchange: null,
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent: () => true,
          } as unknown as PermissionStatus);
      }
      const md = navigator.mediaDevices;
      if (md) {
        md.getUserMedia = () =>
          Promise.reject(new DOMException('Permission denied by user', 'NotAllowedError'));
      }
    });
    await page.goto('/');
    const card = await waitForCard(page, 'USER_DENIED');
    await expect(card.getByRole('button', { name: /retry|try again/i })).toBeVisible();
    await context.close();
  });
});

// ─── 3. SYSTEM_DENIED ──────────────────────────────────────────────────────
// OS / browser policy blocked gUM before the user saw a prompt. Signature:
// gUM throws NotAllowedError but permissions.query is still 'prompt'
// (mapGetUserMediaError: NotAllowedError + 'prompt' → SYSTEM_DENIED).
//
// useCamera does NOT auto-call getUserMedia when the permission status is
// 'prompt' — it waits for the user to click Enable Camera (which routes
// through `retry()` → `startCapture()`). Click through the PrePromptCard so
// the gUM stub fires and the error mapper sets SYSTEM_DENIED.
test.describe('Task DR-9.2: SYSTEM_DENIED state card', () => {
  test('renders with OS-block copy after Enable Camera click', async ({ browser }) => {
    const context = await browser.newContext({ permissions: [] });
    const page = await context.newPage();
    await unregisterSW(page);
    await page.addInitScript(() => {
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
      const md = navigator.mediaDevices;
      if (md) {
        md.getUserMedia = () =>
          Promise.reject(new DOMException('OS-level block', 'NotAllowedError'));
      }
    });
    await page.goto('/');
    const prePrompt = await waitForCard(page, 'PROMPT');
    await prePrompt.getByRole('button', { name: /enable|allow|grant/i }).click();
    const card = await waitForCard(page, 'SYSTEM_DENIED');
    await expect(card).toContainText(/blocked|OS|settings|system|policy/i);
    await expect(card.getByRole('button', { name: /retry|try again/i })).toBeVisible();
    await context.close();
  });
});

// ─── 4. DEVICE_CONFLICT ────────────────────────────────────────────────────
// Camera in use by another app (Zoom / FaceTime / …). Signature: gUM throws
// NotReadableError → mapper → DEVICE_CONFLICT.
test.describe('Task DR-9.2: DEVICE_CONFLICT state card', () => {
  test('renders when camera is already in use', async ({ browser }) => {
    const context = await browser.newContext({ permissions: ['camera'] });
    const page = await context.newPage();
    await unregisterSW(page);
    await page.addInitScript(() => {
      if (navigator.permissions) {
        navigator.permissions.query = () =>
          Promise.resolve({
            state: 'granted',
            name: 'camera',
            onchange: null,
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent: () => true,
          } as unknown as PermissionStatus);
      }
      const md = navigator.mediaDevices;
      if (md) {
        md.getUserMedia = () =>
          Promise.reject(new DOMException('Device is in use', 'NotReadableError'));
      }
    });
    await page.goto('/');
    const card = await waitForCard(page, 'DEVICE_CONFLICT');
    await expect(card).toContainText(/use|another|Zoom|FaceTime|close|busy/i);
    await expect(card.getByRole('button', { name: /retry|try again/i })).toBeVisible();
    await context.close();
  });
});

// ─── 5. NOT_FOUND ──────────────────────────────────────────────────────────
// No camera devices. Signature: gUM throws NotFoundError. enumerateDevices
// returning [] is belt+suspenders — useCamera's devicechange path also
// short-circuits to NOT_FOUND when it sees zero videoinputs.
test.describe('Task DR-9.2: NOT_FOUND state card', () => {
  test('renders when no camera device is found', async ({ browser }) => {
    const context = await browser.newContext({ permissions: ['camera'] });
    const page = await context.newPage();
    await unregisterSW(page);
    await page.addInitScript(() => {
      if (navigator.permissions) {
        navigator.permissions.query = () =>
          Promise.resolve({
            state: 'granted',
            name: 'camera',
            onchange: null,
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent: () => true,
          } as unknown as PermissionStatus);
      }
      const md = navigator.mediaDevices;
      if (md) {
        md.enumerateDevices = () => Promise.resolve([]);
        md.getUserMedia = () => Promise.reject(new DOMException('No camera', 'NotFoundError'));
      }
    });
    await page.goto('/');
    const card = await waitForCard(page, 'NOT_FOUND');
    await expect(card).toContainText(/camera|no|device|connect/i);
    await expect(card.getByRole('button', { name: /retry|try again/i })).toBeVisible();
    await context.close();
  });
});

// ─── 6. MODEL_LOAD_FAIL ────────────────────────────────────────────────────
// MediaPipe model fetch returns 500. Route-intercept BEFORE goto; SW must be
// unregistered so no cached 200 masks the failure.
test.describe('Task DR-9.2: MODEL_LOAD_FAIL state card', () => {
  test('renders when /models/hand_landmarker.task returns 500', async ({ browser }) => {
    const context = await browser.newContext({ permissions: ['camera'] });
    const page = await context.newPage();
    await unregisterSW(page);
    await context.route('**/models/hand_landmarker.task', (route) =>
      route.fulfill({ status: 500, body: 'simulated server error' }),
    );
    await page.goto('/');
    const card = await waitForCard(page, 'MODEL_LOAD_FAIL');
    await expect(card.getByRole('button', { name: /retry|try again/i })).toBeVisible();
    await context.close();
  });
});

// ─── 7. NO_WEBGL ───────────────────────────────────────────────────────────
// WebGL2 unavailable. Stub HTMLCanvasElement.getContext to return null for
// every variant MediaPipe / ogl may probe. Terminal state — no retry button.
test.describe('Task DR-9.2: NO_WEBGL state card', () => {
  test('renders terminal no-webgl card', async ({ browser }) => {
    const context = await browser.newContext({ permissions: ['camera'] });
    const page = await context.newPage();
    await unregisterSW(page);
    await page.addInitScript(() => {
      const proto = HTMLCanvasElement.prototype as HTMLCanvasElement & {
        getContext: (kind: string, ...rest: unknown[]) => unknown;
      };
      const orig = proto.getContext;
      proto.getContext = function patched(
        this: HTMLCanvasElement,
        kind: string,
        ...rest: unknown[]
      ): unknown {
        if (kind === 'webgl' || kind === 'webgl2' || kind === 'experimental-webgl') {
          return null;
        }
        return (orig as (...a: unknown[]) => unknown).call(this, kind, ...rest);
      } as typeof proto.getContext;
    });
    await page.goto('/');
    const card = await waitForCard(page, 'NO_WEBGL');
    // Terminal — NO retry button.
    await expect(card.getByRole('button', { name: /retry|try again/i })).toHaveCount(0);
    await context.close();
  });
});

// ─── 8. GRANTED ────────────────────────────────────────────────────────────
// Default happy path. No stubs — rely on the test project's fake-webcam flags.
// Assert render-canvas visible AND no error card present.
test.describe('Task DR-9.2: GRANTED state (happy path)', () => {
  test('no error card visible on default happy path', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="render-canvas"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid^="error-state-card-"]')).toHaveCount(0);
  });
});
