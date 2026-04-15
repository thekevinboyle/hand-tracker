# Playwright E2E Testing (Fake Webcam) - Research

**Wave**: Second
**Researcher**: Web research specialist subagent
**Date**: 2026-04-14
**Status**: Complete

---

## Summary

Playwright supports fake webcam injection in Chromium via three launch flags (`--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`, `--use-file-for-fake-video-capture`). The video file must be either Y4M (preferred, lossless, natively read by Chrome's fake capture pipeline) or MJPEG; H.264/MP4 does not work with `--use-file-for-fake-video-capture`. A synthetic Y4M file can be generated in one `ffmpeg` command with no input — no real hand footage required. The smoke test waits for a `data-testid` on the canvas, then polls a dev-only `window.__handTracker` global for FPS and landmark count; a 60 s timeout on first detection absorbs MediaPipe WASM + model cold-start. Tests run against `pnpm preview` (port 4173) locally and against a `PLAYWRIGHT_BASE_URL` env var for Vercel preview deployments.

---

## Key Findings

### 1. Chromium Fake-Media Launch Flags

Three flags must all be present together:

| Flag | Purpose |
|------|---------|
| `--use-fake-ui-for-media-stream` | Auto-grants the permission dialog — no actual browser permission prompt appears |
| `--use-fake-device-for-media-stream` | Substitutes the real webcam with the fake capture device |
| `--use-file-for-fake-video-capture=<path>` | Points the fake device at a video file to stream |

Without `--use-fake-ui-for-media-stream`, Chrome still shows the permission prompt and the test hangs. Without `--use-fake-device-for-media-stream`, the `--use-file-for-fake-video-capture` flag has no effect. All three are required.

**Source**: Confirmed across [strich.io barcode testing post](https://strich.io/blog/posts/automated-testing-of-barcode-scanning-apps-with-playwright/), [Medium: Dynamically Inject Webcam Data in Playwright Tests](https://medium.com/@bshet768/dynamically-inject-webcam-data-in-playwright-tests-using-y4m-d96fdea2545c), [github.com/microsoft/playwright issue #24589](https://github.com/microsoft/playwright/issues/24589).

### 2. Video Format: Y4M vs MJPEG vs MP4

Chrome's `--use-file-for-fake-video-capture` supports exactly two formats:

- **Y4M (YUV4MPEG2)** — lossless, uncompressed, natively understood by Chromium's fake capture. Pixel format must be `yuv420p` (4:2:0). The 4:2:2 variant is NOT supported and silently fails.
- **MJPEG** — each frame is an independent JPEG. Works in some Chrome versions but reported as less reliable across platforms.
- **MP4 / H.264 / WebM** — do NOT work. The flag only feeds raw/lossless formats to the fake device.

**Recommendation**: Use Y4M. Generate it with `ffmpeg` using `-pix_fmt yuv420p`.

**Source**: [strich.io](https://strich.io/blog/posts/automated-testing-of-barcode-scanning-apps-with-playwright/), [xiph.org Y4M sample note](http://media.xiph.org/video/derf/), [multimedia.cx YUV4MPEG2 wiki](https://wiki.multimedia.cx/index.php/YUV4MPEG2).

### 3. Generating the Test Y4M File with FFmpeg

A synthetic animated video — no hand footage required — can be generated entirely from `ffmpeg` built-in sources. The `testsrc2` filter produces a moving color-bar pattern with a scrolling gradient that changes every frame, ensuring the fake webcam is not a static freeze-frame (important: a static Y4M with one frame loops correctly, but a multi-frame animated file gives MediaPipe different pixel data each inference cycle, reducing false "no hand" steady-state).

**Recommended command (30 s, 640x480, 30 fps, looping synthetic pattern):**

```bash
ffmpeg -y \
  -f lavfi \
  -i "testsrc2=size=640x480:rate=30,format=yuv420p" \
  -t 30 \
  -f yuv4mpegpipe \
  tests/assets/fake-hand.y4m
```

Flags explained:
- `-f lavfi -i "testsrc2=..."` — use the libavfilter virtual input (no real file needed)
- `testsrc2=size=640x480:rate=30` — 640x480 at 30 fps, matches `getUserMedia` ideal constraints in D22
- `format=yuv420p` — forces 4:2:0 pixel format (the only Chrome-supported variant)
- `-t 30` — 30 seconds of content (Chrome loops Y4M automatically)
- `-f yuv4mpegpipe` — write the YUV4MPEG2 container format

**File size**: approximately 1.4 GB uncompressed (640 × 480 × 1.5 bytes/px × 30 fps × 30 s). This is too large to commit to git. Use a shorter duration:

```bash
# 5-second looping file — ~235 MB, Chrome loops it automatically
ffmpeg -y \
  -f lavfi \
  -i "testsrc2=size=640x480:rate=30,format=yuv420p" \
  -t 5 \
  -f yuv4mpegpipe \
  tests/assets/fake-hand.y4m
```

Even at 5 s, the file is ~235 MB — not suitable for git. Use `.gitignore` and a `pnpm test:setup` script (or a `just setup-test-assets` recipe) that generates it on first use.

**Add to `.gitignore`:**
```
tests/assets/fake-hand.y4m
```

**One-liner setup script** agents can run:
```bash
mkdir -p tests/assets && \
ffmpeg -y \
  -f lavfi \
  -i "testsrc2=size=640x480:rate=30,format=yuv420p" \
  -t 5 \
  -f yuv4mpegpipe \
  tests/assets/fake-hand.y4m
```

**Alternative if ffmpeg is not installed** (CI must install it):
```yaml
- name: Install ffmpeg
  run: sudo apt-get install -y ffmpeg
```

**Source**: [FFmpeg testsrc2 via X/@FFmpeg](https://x.com/FFmpeg/status/1184173404636598272), [ffmpeg lavfi FilteringGuide](https://trac.ffmpeg.org/wiki/FilteringGuide), [multimedia.cx YUV4MPEG2](https://wiki.multimedia.cx/index.php/YUV4MPEG2).

### 4. Dev-Only Global Hooks for Testing

Vite statically replaces `import.meta.env.DEV` at build time, enabling complete tree-shaking of dev-only code from production bundles. Code guarded by `if (import.meta.env.DEV || import.meta.env.MODE === 'test')` is eliminated in `vite build` (production mode). This is the correct pattern for exposing a `window.__handTracker` test hook.

**Source**: [Vite env-and-mode docs](https://vite.dev/guide/env-and-mode).

The hook should be registered in `src/engine/renderer.ts` or `src/app/main.tsx` after the render loop starts:

```typescript
// src/engine/renderer.ts (inside startRenderLoop or equivalent)
if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
  const state = {
    _fpsBuffer: [] as number[],
    _lastFrameTime: 0,
    _landmarkCount: 0,
  };

  // Called once per rVFC frame inside the render loop:
  // state._fpsBuffer.push(fps); if > 60 entries, shift
  // state._landmarkCount = landmarks?.length ?? 0;

  (window as unknown as Record<string, unknown>).__handTracker = {
    getFPS(): number {
      if (state._fpsBuffer.length === 0) return 0;
      const sum = state._fpsBuffer.reduce((a, b) => a + b, 0);
      return sum / state._fpsBuffer.length;
    },
    getLandmarkCount(): number {
      return state._landmarkCount;
    },
  };
}
```

**In `vite.config.ts` define the test mode** so `import.meta.env.MODE === 'test'` works during `pnpm preview` (Playwright runs against the built output):

```typescript
// vite.config.ts
export default defineConfig(({ mode }) => ({
  define: {
    // Expose test mode to the bundle when built with --mode test
    ...(mode === 'test' ? { 'import.meta.env.MODE': JSON.stringify('test') } : {}),
  },
  // ... rest of config
}));
```

Then in `playwright.config.ts`, the `webServer` command becomes:
```
pnpm build --mode test && pnpm preview
```

This ensures the `window.__handTracker` global survives the production build that Playwright tests against.

### 5. WebServer Configuration (Build + Preview)

Playwright's `webServer` option runs a shell command and waits for a URL to respond before tests begin. For production-mode testing (`pnpm preview`), the build must complete first.

The `command` field is a shell command, so `&&` chains are valid:
```typescript
webServer: {
  command: 'pnpm build --mode test && pnpm preview --port 4173',
  url: 'http://127.0.0.1:4173',
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,  // build + preview startup can take 60-90s on first run
  stdout: 'pipe',
},
```

When `PLAYWRIGHT_BASE_URL` is set (Vercel preview), the `webServer` block should be skipped entirely — the external server is already running.

**Source**: [playwright.dev/docs/test-webserver](https://playwright.dev/docs/test-webserver), [Playwright webServer Vite issue #21227](https://github.com/vuejs/create-vue/issues/263).

### 6. Vercel Preview URL Testing

The recommended pattern uses a `deployment_status` GitHub Actions trigger and `PLAYWRIGHT_TEST_BASE_URL` (note: the variable name in the Instil.co article) or `PLAYWRIGHT_BASE_URL` (the convention used in this project per the task spec).

**Source**: [instil.co: Automate Playwright testing on Vercel](https://instil.co/blog/automate-playwright-testing-on-vercel).

Pattern for `playwright.config.ts`:
```typescript
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';
```

When `PLAYWRIGHT_BASE_URL` is set, skip `webServer` (no local server needed):
```typescript
webServer: process.env.PLAYWRIGHT_BASE_URL
  ? undefined
  : {
      command: 'pnpm build --mode test && pnpm preview --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
    },
```

### 7. Flakiness: MediaPipe WASM + Model Cold-Start

MediaPipe `HandLandmarker` initialization has two sequential async phases:
1. **WASM runtime load** — fetch and compile `~3 MB` of WASM. On a cold CI runner this takes 5–15 s.
2. **Model load** — fetch `hand_landmarker.task` (7.82 MB self-hosted from `public/models/`). Another 5–20 s on first hit.

Total cold-start before the first inference result: potentially 20–35 s on CI. Using `page.waitForSelector` with the default 30 s timeout is insufficient. Use `{ timeout: 60_000 }` on any assertion that depends on the first landmark result.

**Pattern**: Wait for the presence of a landmark blob element (which only renders when `HandLandmarker` has returned at least one result) using a long timeout:

```typescript
// Wait up to 60s for first landmark blob to appear
await page.locator('[data-testid="landmark-blob"]').first().waitFor({
  state: 'visible',
  timeout: 60_000,
});
```

After that first landmark appears, all subsequent assertions can use the default 5–10 s timeout because the WASM is warm.

**Source**: Derived from D17 (WASM worker issue, main-thread model load), D33 (7.82 MB model file self-hosted), [playwright.dev waitForSelector docs](https://playwright.dev/docs/api/class-locator#locator-wait-for).

### 8. FPS Measurement via page.evaluate

`page.evaluate()` runs JS in the page context and returns a serializable value. The pattern for polling `window.__handTracker.getFPS()` over 3 s:

```typescript
// Poll FPS over 3 seconds
const fps = await page.evaluate(async () => {
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  await sleep(3000);
  return (window as unknown as { __handTracker: { getFPS(): number } }).__handTracker.getFPS();
});
expect(fps).toBeGreaterThanOrEqual(20);
```

**Source**: [playwright.dev/docs/evaluating](https://playwright.dev/docs/evaluating).

### 9. GitHub Actions Caching Pattern

The Playwright binary cache lives at `~/.cache/ms-playwright`. The cache key should include the Playwright version (derived from `package-lock.json` or `pnpm-lock.yaml` hash) so it invalidates on upgrades.

The pattern for cache hit: restore the binary cache, skip `playwright install`, but still run `playwright install-deps` (system-level `.so` libraries are not cached).

**Source**: [jpoehnelt DEV.to: Caching Playwright Binaries in GitHub Actions](https://dev.to/jpoehnelt/caching-playwright-binaries-in-github-actions-2mfc).

---

## Recommended Approach

1. Commit `tests/assets/.gitkeep`; add `tests/assets/fake-hand.y4m` to `.gitignore`
2. Add a `just setup-test-assets` (or `pnpm test:setup`) script that generates the Y4M with the `ffmpeg` one-liner
3. Build with `--mode test` so the `window.__handTracker` global survives tree-shaking
4. In `playwright.config.ts`: `--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`, `--use-file-for-fake-video-capture` pointing at the Y4M absolute path
5. `webServer` runs `pnpm build --mode test && pnpm preview --port 4173` with a 120 s timeout
6. `baseURL` falls back to `process.env.PLAYWRIGHT_BASE_URL` for Vercel preview runs
7. Smoke test: navigate → wait for canvas → wait for first landmark blob (60 s timeout) → poll FPS for 3 s → assert ≥ 20 fps → assert landmark count ≥ 5

---

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| MJPEG instead of Y4M | Smaller file size | Less reliable across Chrome versions, documented failures with H.264 | Rejected |
| Real hand footage Y4M | More realistic test data | Requires real webcam recording, large file, can't be regenerated autonomously | Rejected |
| `page.route` to mock `getUserMedia` | No ffmpeg dep | getUserMedia is a native browser API, not interceptable via network routing | Rejected |
| Vitest browser mode instead of Playwright | Same repo tooling | Cannot inject `--use-fake-device-for-media-stream` at Chromium launch level | Rejected |
| Static single-frame Y4M | Tiny file | Chrome may loop a freeze-frame; MediaPipe gets identical pixels every frame, potentially returning stale cached results | Accepted with note: animated preferred |

---

## Pitfalls and Edge Cases

- **Y4M must be yuv420p (4:2:0)**: 4:2:2 is silently unsupported. The `ffmpeg` command above forces `format=yuv420p` in the filter chain — this is not optional.
- **Absolute path required for `--use-file-for-fake-video-capture`**: Relative paths work only when the CWD is exactly the project root. Use `path.resolve(__dirname, 'tests/assets/fake-hand.y4m')` in `playwright.config.ts` to be safe.
- **`__dirname` is undefined in ESM**: Vite projects set `"type":"module"` in `package.json`, making `playwright.config.ts` an ES module where `__dirname` does not exist. Reconstruct it with `import { fileURLToPath } from 'node:url'` and `const __dirname = path.dirname(fileURLToPath(import.meta.url))`. The deliverable above includes this fix.
- **`permissions: ['camera']` must be in `use` alongside `launchOptions`**: Some Playwright/Chromium version combinations require the context-level permission grant in addition to `--use-fake-ui-for-media-stream`. Omitting it can cause `getUserMedia` to be blocked silently in newer Chromium builds that check the permission store independently of the UI flag.
- **`webServer.command` with `&&` runs in `/bin/sh`**: This works on Linux/macOS. On Windows CI, use a separate `setup` step instead of chaining.
- **`reuseExistingServer: true` on CI wastes no time but hides stale builds**: Set `reuseExistingServer: !process.env.CI` so local devs can run `pnpm preview` in a separate terminal, but CI always gets a fresh build.
- **MediaPipe model must be present before tests run**: If `public/models/hand_landmarker.task` is missing (e.g., first checkout without the 7.82 MB binary), the app reaches `MODEL_LOAD_FAIL` state and the smoke test fails. The CI workflow must include a step to download the model file or confirm it is committed.
- **`window.__handTracker` must be registered before `page.evaluate` is called**: The render loop starts asynchronously after `HandLandmarker` initializes. The smoke test should wait for `landmark-blob` visibility before calling `page.evaluate` for FPS — that sequencing guarantees the hook is registered.
- **`--use-fake-ui-for-media-stream` bypasses the permission state machine**: In the real app, `useCamera.ts` runs through `PROMPT → GRANTED` states. With the fake UI flag, the browser never fires the `getUserMedia` prompt, so the state machine jumps directly to `GRANTED`. The smoke test assertion is that no error card is visible (i.e., not `USER_DENIED`, `NOT_FOUND`, etc.), which is correct behavior regardless of whether `PROMPT` was visually shown.
- **`import.meta.env.MODE === 'test'` requires `pnpm build --mode test`**: Forgetting `--mode test` means the production build strips the `window.__handTracker` hook and `page.evaluate` returns `undefined`, crashing the test.
- **`deployment_status` trigger requires Vercel to post deploy events to GitHub**: Only works when the Vercel project is linked to the GitHub repo via the Vercel GitHub integration. If not linked, the event never fires.
- **pnpm on GitHub Actions requires `pnpm/action-setup@v4` before `actions/setup-node`**: Without the pnpm action, `pnpm` is not on PATH and the `command` in `webServer` fails.

---

## References

- [Playwright: Test Webserver docs](https://playwright.dev/docs/test-webserver)
- [Playwright: CI docs](https://playwright.dev/docs/ci)
- [Playwright: Evaluating JS](https://playwright.dev/docs/evaluating)
- [strich.io: Automated Testing of Barcode Scanning Apps with Playwright](https://strich.io/blog/posts/automated-testing-of-barcode-scanning-apps-with-playwright/)
- [Medium: Dynamically Inject Webcam Data in Playwright Tests (Using Y4M)](https://medium.com/@bshet768/dynamically-inject-webcam-data-in-playwright-tests-using-y4m-d96fdea2545c)
- [Medium: Simulating Webcam Access in Playwright](https://medium.com/@sap7deb/simulating-webcam-access-in-playwright-testing-web-apps-with-mocked-media-stream-and-device-f403dbbcb166)
- [github.com/microsoft/playwright issue #24589](https://github.com/microsoft/playwright/issues/24589)
- [Vite: Env Variables and Modes](https://vite.dev/guide/env-and-mode)
- [instil.co: Automate Playwright testing on Vercel](https://instil.co/blog/automate-playwright-testing-on-vercel)
- [DEV.to: Caching Playwright Binaries in GitHub Actions](https://dev.to/jpoehnelt/caching-playwright-binaries-in-github-actions-2mfc)
- [FFmpeg testsrc2 and lavfi filter guide](https://trac.ffmpeg.org/wiki/FilteringGuide)
- [MultimediaWiki: YUV4MPEG2 format](https://wiki.multimedia.cx/index.php/YUV4MPEG2)

---

## Second Wave Additions

### Implementation Details (filtered by DISCOVERY.md)

The decisions below map directly to D21 (one Playwright smoke test), D23 (8 webcam states, test PROMPT→GRANTED path), D41 (L4 validation in every task file), D42 (final phase against Vercel preview).

---

#### Deliverable 1 — `playwright.config.ts`

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ESM-safe __dirname equivalent (Vite projects use "type":"module" in package.json)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,        // one worker; webcam device is a shared resource
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,                  // serialise fake webcam tests; avoids port conflicts
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL,
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Grant camera permission at the context level in addition to bypassing
        // the browser dialog with --use-fake-ui-for-media-stream. Both are needed
        // in some Playwright/Chromium version combinations.
        permissions: ['camera'],
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            `--use-file-for-fake-video-capture=${path.resolve(__dirname, 'tests/assets/fake-hand.y4m')}`,
            // Required for MediaPipe SharedArrayBuffer / COOP+COEP in headless Chrome:
            '--disable-web-security',  // only for localhost tests; NOT for Vercel preview runs
          ],
        },
      },
    },
  ],

  // Skip local webServer when testing against an external URL (Vercel preview)
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'pnpm build --mode test && pnpm preview --port 4173',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'pipe',
      },
});
```

**Notes on `--disable-web-security`**: MediaPipe uses `SharedArrayBuffer`, which requires COOP + COEP headers. In `vite.config.ts` these headers are set for the dev server (D32). The Vite preview server also serves the `dist/` folder, but the `--preview` command does not apply custom headers by default. Options:

A. Add a `vite.config.ts` `preview.headers` block (cleanest):
```typescript
preview: {
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  },
},
```

B. Use `--disable-web-security` in Chromium launch args (only acceptable for localhost CI tests, never for production).

Option A is correct — implement it in `vite.config.ts`. Remove `--disable-web-security` from the config once `preview.headers` is wired up.

---

#### Deliverable 2 — Y4M Test Asset Setup

**File to commit**: `tests/assets/.gitkeep` (empty, keeps the directory in git)

**Add to `.gitignore`** (project root):
```
tests/assets/fake-hand.y4m
```

**Setup script** — add to `package.json` scripts:
```json
{
  "scripts": {
    "test:setup": "mkdir -p tests/assets && ffmpeg -y -f lavfi -i 'testsrc2=size=640x480:rate=30,format=yuv420p' -t 5 -f yuv4mpegpipe tests/assets/fake-hand.y4m"
  }
}
```

Or as a `justfile` recipe:
```
setup-test-assets:
    mkdir -p tests/assets
    ffmpeg -y \
      -f lavfi \
      -i "testsrc2=size=640x480:rate=30,format=yuv420p" \
      -t 5 \
      -f yuv4mpegpipe \
      tests/assets/fake-hand.y4m
    @echo "Generated tests/assets/fake-hand.y4m"
```

---

#### Deliverable 3 — `tests/e2e/smoke.spec.ts`

```typescript
// tests/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';

// Type declaration for the dev-only global
declare global {
  interface Window {
    __handTracker: {
      getFPS(): number;
      getLandmarkCount(): number;
    };
  }
}

test.describe('Hand Tracker FX smoke', () => {
  test('PROMPT → GRANTED: canvas renders, no error card, FPS ≥ 20', async ({ page }) => {
    // ── 1. Navigate ──────────────────────────────────────────────────────────
    await page.goto('/');

    // ── 2. Wait for the pre-prompt explanation card (PROMPT state, D23) ─────
    // The app shows an explanation card before calling getUserMedia when
    // permissionStatus.state === 'prompt'. With --use-fake-ui-for-media-stream,
    // the browser auto-grants, so this card may appear briefly or be skipped.
    // We allow up to 5 s for it to appear, then continue regardless.
    const promptCard = page.locator('[data-testid="state-card-PROMPT"]');
    const promptAppeared = await promptCard.isVisible({ timeout: 5_000 }).catch(() => false);
    if (promptAppeared) {
      // Click the "Allow camera" / "Continue" button on the pre-prompt card
      await page.locator('[data-testid="allow-camera-btn"]').click();
    }

    // ── 3. Wait for the render canvas to be visible (GRANTED state reached) ─
    await expect(page.locator('[data-testid="render-canvas"]')).toBeVisible({
      timeout: 30_000,
    });

    // ── 4. Assert no error-state card is present ──────────────────────────────
    // All 7 error states share data-testid="error-state-card"
    await expect(page.locator('[data-testid="error-state-card"]')).not.toBeVisible();

    // ── 5. Wait for MediaPipe WASM + model cold-start + first detection ───────
    // Model is 7.82 MB self-hosted; WASM compile adds ~10-20 s on CI.
    // Use a 60 s timeout on first landmark blob appearance.
    await page.locator('[data-testid="landmark-blob"]').first().waitFor({
      state: 'visible',
      timeout: 60_000,
    });

    // ── 6. Assert at least 5 landmark blobs (one per fingertip, D6) ──────────
    const blobs = page.locator('[data-testid="landmark-blob"]');
    await expect(blobs).toHaveCount(5, { timeout: 5_000 });

    // ── 7. Sample FPS over 3 seconds via the dev-only global hook ────────────
    const fps = await page.evaluate(async (): Promise<number> => {
      await new Promise<void>(resolve => setTimeout(resolve, 3000));
      return window.__handTracker.getFPS();
    });

    // D21 acceptance: render FPS ≥ 20
    expect(fps).toBeGreaterThanOrEqual(20);
  });
});
```

**Data attributes required on app elements:**

| `data-testid` | Element | Where to add |
|---|---|---|
| `render-canvas` | The WebGL or top Canvas 2D element | `src/engine/renderer.ts` or `App.tsx` |
| `state-card-PROMPT` | Pre-prompt explanation card | `src/ui/ErrorStates.tsx` |
| `allow-camera-btn` | "Allow camera" button on PROMPT card | `src/ui/ErrorStates.tsx` |
| `error-state-card` | Any of the 7 error-state cards (USER_DENIED etc.) | `src/ui/ErrorStates.tsx` |
| `landmark-blob` | Each fingertip blob circle | Canvas 2D overlay OR a DOM overlay element |

**Important note on Canvas 2D blobs**: If fingertip blobs are drawn directly onto a `<canvas>` (not as DOM elements), `data-testid="landmark-blob"` cannot be a DOM attribute. In that case, expose landmark count via the `window.__handTracker.getLandmarkCount()` hook instead:

```typescript
// Alternative assertion when blobs are canvas-drawn:
const landmarkCount = await page.evaluate(() => window.__handTracker.getLandmarkCount());
expect(landmarkCount).toBeGreaterThanOrEqual(5);
```

The recommended approach for testability is a DOM overlay: render blobs as `<div>` or `<svg circle>` elements positioned absolutely over the canvas with `data-testid="landmark-blob"`. This is also cleaner for accessibility (screen reader descriptions). If canvas-only is required for performance, use the `window.__handTracker.getLandmarkCount()` approach.

---

#### Deliverable 4 — Dev-Only Test Hooks in the App

Add to `src/engine/renderer.ts` (or wherever the `requestVideoFrameCallback` loop lives):

```typescript
// src/engine/renderer.ts

// Rolling FPS buffer — updated every frame
const _fpsState = {
  buffer: [] as number[],
  lastTime: 0,
  landmarkCount: 0,
};

// Inside the rVFC callback, after computing the current frame's FPS:
function updateFPSHook(nowMs: number, landmarkCount: number) {
  if (_fpsState.lastTime > 0) {
    const instantFPS = 1000 / (nowMs - _fpsState.lastTime);
    _fpsState.buffer.push(instantFPS);
    if (_fpsState.buffer.length > 90) _fpsState.buffer.shift(); // keep last 3 s at 30fps
  }
  _fpsState.lastTime = nowMs;
  _fpsState.landmarkCount = landmarkCount;
}

// Register the global — only in dev/test builds (tree-shaken in production)
if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
  (window as unknown as Record<string, unknown>).__handTracker = {
    getFPS(): number {
      if (_fpsState.buffer.length === 0) return 0;
      return _fpsState.buffer.reduce((a, b) => a + b, 0) / _fpsState.buffer.length;
    },
    getLandmarkCount(): number {
      return _fpsState.landmarkCount;
    },
  };
}
```

Call `updateFPSHook(nowMs, landmarks?.length ?? 0)` once per `requestVideoFrameCallback` invocation.

---

#### Deliverable 5 — GitHub Actions CI Workflow

```yaml
# .github/workflows/playwright.yml
name: Playwright E2E

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    name: E2E – Chromium
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      # Cache Playwright Chromium binary to save ~40s per run
      - name: Cache Playwright browsers
        id: playwright-cache
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: ${{ runner.os }}-playwright-${{ hashFiles('pnpm-lock.yaml') }}

      - name: Install Playwright Chromium
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: pnpm exec playwright install chromium --with-deps

      - name: Install Playwright system deps (cache hit path)
        if: steps.playwright-cache.outputs.cache-hit == 'true'
        run: pnpm exec playwright install-deps chromium

      # Install ffmpeg and generate the fake webcam Y4M
      - name: Install ffmpeg
        run: sudo apt-get install -y ffmpeg

      - name: Generate fake webcam asset
        run: pnpm test:setup

      # Download the MediaPipe model if not committed
      # (Only needed if public/models/hand_landmarker.task is in .gitignore)
      # - name: Download MediaPipe model
      #   run: |
      #     mkdir -p public/models
      #     curl -sL -o public/models/hand_landmarker.task \
      #       https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task

      - name: Run Playwright tests
        run: pnpm exec playwright test
        env:
          CI: true

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

**Notes**:
- `pnpm/action-setup@v4` must come before `actions/setup-node` so that `cache: 'pnpm'` in setup-node correctly locates the pnpm store.
- `pnpm exec playwright install chromium --with-deps` installs only Chromium and its OS dependencies (libnss, libatk, etc.) — not Firefox or WebKit. Saves ~400 MB download on CI.
- The model download step is commented out because D33 says to commit the model into `public/models/`. If the model is committed (git-lfs or directly), that step is not needed.

---

#### Deliverable 6 — Running Against Vercel Preview

The final phase (D42) runs E2E against a Vercel preview URL. Two integration patterns:

**Pattern A: `deployment_status` trigger (automated, fires per-deploy)**

```yaml
# .github/workflows/playwright-vercel-preview.yml
name: Playwright – Vercel Preview

on:
  deployment_status:

jobs:
  e2e-preview:
    name: E2E on Vercel Preview
    runs-on: ubuntu-latest
    timeout-minutes: 20
    # Only run on successful Vercel deployments (preview or production)
    if: github.event.deployment_status.state == 'success'

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Install Playwright Chromium
        run: pnpm exec playwright install chromium --with-deps

      - name: Install ffmpeg
        run: sudo apt-get install -y ffmpeg

      - name: Generate fake webcam asset
        run: pnpm test:setup

      - name: Run Playwright against Vercel preview
        run: pnpm exec playwright test
        env:
          CI: true
          PLAYWRIGHT_BASE_URL: ${{ github.event.deployment_status.target_url }}

      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report-preview
          path: playwright-report/
          retention-days: 7
```

**Pattern B: Manual run with env var (final phase, one-shot)**

```bash
PLAYWRIGHT_BASE_URL=https://hand-tracker-fx-abc123.vercel.app pnpm exec playwright test
```

This requires no CI changes — any developer can run it locally against any Vercel preview URL.

**Source**: [instil.co: Automate Playwright testing on Vercel](https://instil.co/blog/automate-playwright-testing-on-vercel).

---

#### Deliverable 7 — Anti-Flakiness: Detector Warmup Strategy

Full warmup strategy summary:

```
Page load
  → Vite bundle executes
  → MediaPipe FilesetResolver.forVisionTasks('/wasm') fetches WASM  [~5-15s CI]
  → HandLandmarker.createFromOptions() loads model task file        [~5-20s CI]
  → First getUserMedia stream starts
  → requestVideoFrameCallback fires
  → First HandLandmarker.detectForVideo() call
  → First result with landmarks returned                            [total: up to 35s CI]
  → Canvas 2D draws first landmark blob
  → data-testid="landmark-blob" becomes visible in DOM
  ← Playwright assertion fires (60s timeout covers entire chain)
```

**Sequence in the smoke test**:
1. `page.goto('/')` — starts the page
2. Short wait (up to 5 s) for PROMPT card → click if present
3. `waitFor('[data-testid="render-canvas"]', { timeout: 30_000 })` — canvas is wired up immediately after GRANTED
4. `waitFor('[data-testid="landmark-blob"]', { timeout: 60_000 })` — this single wait absorbs the entire WASM + model + first-inference chain
5. After step 4 passes, everything is warm. All subsequent assertions (`toHaveCount`, `page.evaluate` for FPS) can use default timeouts.

**Never use `page.waitForTimeout()`** — it introduces a fixed delay regardless of readiness. The `waitFor` with a long timeout returns as soon as the condition is true and only fails if 60 s elapses without it.

---

### Tool and MCP Configuration

| Tool/Service | Purpose | Setup Required | Agent Can Self-Configure? |
|---|---|---|---|
| ffmpeg | Generate fake-hand.y4m test asset | `brew install ffmpeg` (macOS) / `apt-get install ffmpeg` (CI) | Yes — via Bash |
| Playwright | E2E test runner | `pnpm exec playwright install chromium --with-deps` | Yes — via Bash |
| Vercel GitHub integration | `deployment_status` events | Vercel project must be linked to GitHub repo | No — user must connect in Vercel dashboard |

---

### Testing Strategy

- **Test assets needed**: `tests/assets/fake-hand.y4m` (generated by `ffmpeg`, not committed)
- **Simulated inputs**: `--use-fake-device-for-media-stream` + Y4M file; testsrc2 produces an animated color pattern, not a real hand
- **User flows to verify**:
  1. PROMPT card appears → click allow → canvas appears → blobs appear → FPS ≥ 20 (smoke test)
  2. Error state: MODEL_LOAD_FAIL card shows if model file missing (manual test, not automated in smoke)
  3. L4 validation in every task file runs the same `pnpm exec playwright test` command

---

### Human Actions Required

| Action | Who | How | Status |
|---|---|---|---|
| Connect Vercel project to GitHub repo | User | Vercel dashboard → Import repository | Pending (needed for D42 deployment_status trigger) |
| Commit `hand_landmarker.task` (7.82 MB) to `public/models/` | Agent | `curl -sL ... -o public/models/hand_landmarker.task` then `git add` | Pending (D44, Phase 1) |
| Install ffmpeg locally | User (macOS) | `brew install ffmpeg` | Pending |
