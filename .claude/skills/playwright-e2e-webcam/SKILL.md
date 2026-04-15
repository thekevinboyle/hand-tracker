---
name: playwright-e2e-webcam
description: Use when writing, running, or debugging Playwright E2E tests for Hand Tracker FX, or wiring Level-4 validation commands in PRP task files. Fake webcam via Y4M + Chromium flags, crossOriginIsolated bake-in check, __handTracker dev hook, Vercel preview target via env.
---

# Playwright E2E Webcam Testing — Hand Tracker FX

This skill is the single source of truth for every Playwright E2E test in this repo. Every task file's **L4 validation** (PRP Level-4, per D41) is a `pnpm test:e2e` invocation that loads `playwright.config.ts`, so every detail here is load-bearing.

Authority chain: `DISCOVERY.md` (D21, D23, D41, D42) > this skill > individual test files. If a test seems to need a config change that contradicts D21/D23/D41/D42, stop and re-read DISCOVERY.md — the answer is almost always "don't change the config."

---

## What's already wired up (don't reinvent)

| File | Purpose |
|---|---|
| `playwright.config.ts` | Chromium launch flags, `permissions: ['camera']`, `webServer`, base URL env override |
| `scripts/gen-fake-webcam.mjs` | ffmpeg-driven Y4M generator, idempotent, ESM `__dirname` via `fileURLToPath` |
| `package.json` scripts | `test:setup` (runs the generator) and `test:e2e` (runs Playwright) |
| `tests/assets/.gitkeep` | Keeps the asset dir in git; the `.y4m` itself is gitignored |
| `tests/e2e/*.spec.ts` | Per-task describe blocks, each prefixed `Task N.M: …` (D41 filter convention) |

**If any of these is missing on your branch, STOP and flag it** — the scaffolding task (1.x) should have landed already. Don't silently rebuild it inline.

---

## Why Y4M is mandatory (and every other format fails)

Chromium's `--use-file-for-fake-video-capture=<path>` only accepts two container formats:

- **Y4M (YUV4MPEG2) with `yuv420p` pixel format** — lossless, natively read by Chrome's fake capture pipeline. This is what we use.
- **MJPEG** — reportedly works on some Chrome versions, silently fails on others. Do not use.

Everything else **silently fails**:

- MP4/H.264 — flag is accepted, no stream is produced, `getUserMedia` resolves with a black frame, `HandLandmarker` never produces results, the smoke test times out waiting for the first landmark.
- WebM/VP8/VP9 — same silent failure.
- Y4M with `yuv422p` (4:2:2) — silently unsupported; use `yuv420p` (4:2:0) only.

The ffmpeg command in `scripts/gen-fake-webcam.mjs` bakes in the correct pixel format. Don't edit it without checking the research file.

---

## The three Chromium flags (all required)

```ts
launchOptions: {
  args: [
    '--use-fake-ui-for-media-stream',            // auto-grants the browser permission dialog
    '--use-fake-device-for-media-stream',        // substitutes a fake capture device
    `--use-file-for-fake-video-capture=${FAKE_VIDEO}`, // feeds the fake device from the Y4M
  ],
},
```

**All three are required simultaneously.** Drop `--use-fake-ui-for-media-stream` and Chrome shows the permission prompt — the test hangs. Drop `--use-fake-device-for-media-stream` and the file flag is ignored. Drop the file flag and the fake device streams a moving green square instead of our content.

### You ALSO need `permissions: ['camera']` on the project

```ts
use: {
  ...devices['Desktop Chrome'],
  permissions: ['camera'],   // <-- context-level grant, required in addition to the UI flag
  launchOptions: { args: [...] },
},
```

Some Playwright/Chromium combinations check the permission store independently of `--use-fake-ui-for-media-stream`. Without the context-level grant, `getUserMedia` is blocked and the app transitions to `USER_DENIED` (one of the 8 states in D23) even though the UI flag says "allow all."

**Rule: both the UI flag AND `permissions: ['camera']` are required. Not one or the other.**

---

## ESM `__dirname` gotcha

`package.json` has `"type": "module"`, which makes `playwright.config.ts` and `scripts/gen-fake-webcam.mjs` ES modules. `__dirname` does not exist in ESM. Use:

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

This is already done in the committed config. If you add a new helper under `scripts/` or `tests/`, repeat the same pattern. Never use `__dirname` bare.

---

## webServer: build then preview

```ts
webServer: process.env.PLAYWRIGHT_BASE_URL
  ? undefined
  : {
      command: 'pnpm build && pnpm preview',
      port: 4173,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
```

Rationale:

- **Preview (port 4173), not dev (port 5173)**: tests run against the production bundle, same code path as Vercel. This catches tree-shaking bugs where dev-only hooks get stripped.
- **`pnpm build && pnpm preview` in one string**: Playwright runs `command` through `/bin/sh`, so `&&` chaining works on macOS/Linux (all our CI is Ubuntu).
- **`reuseExistingServer: !process.env.CI`**: locally, a dev can keep `pnpm preview` running in another terminal; CI always gets a fresh build.
- **`timeout: 120_000`**: build + preview startup can take 60–90 s on first run.
- **`process.env.PLAYWRIGHT_BASE_URL` shortcut**: when set (Vercel preview URL), skip `webServer` entirely — the remote server is already running (see D42 final-phase pattern below).

---

## `PLAYWRIGHT_BASE_URL` for Vercel preview (D42 final phase)

D42 mandates that the **final phase of PHASES.md** runs the full E2E suite against a live Vercel preview deployment. Pattern:

```ts
use: {
  baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173',
  // ...
},
webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : { /* ... */ },
```

Then invoke as:

```bash
PLAYWRIGHT_BASE_URL=https://hand-tracker-fx-git-main-kb.vercel.app pnpm test:e2e
```

No local build, no local server. Playwright hits the preview URL directly. Useful checks on top of the normal smoke:

- `crossOriginIsolated === true` on the deployed URL (confirms COOP/COEP headers are actually served by Vercel, not just Vite preview).
- First landmark appears within 60 s (network model download on cold CDN cache).

**Do not hardcode the URL.** GitHub Actions passes it via `deployment_status` trigger — see the CI YAML outline below.

---

## The `window.__handTracker` dev/test hook

MediaPipe's internal state is not accessible from Playwright (it runs in WASM). We expose a tiny read-only shim:

```ts
// src/engine/renderer.ts (or wherever the rVFC loop lives)
if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
  (window as unknown as Record<string, unknown>).__handTracker = {
    getFPS(): number { /* rolling avg over last ~3 s */ },
    getLandmarkCount(): number { /* 0 or 21 per MediaPipe */ },
  };
}
```

Critical points:

- **`import.meta.env.DEV`** is replaced by Vite at build time with `true` in dev, `false` in `vite build` (production). The entire `if` block is tree-shaken in production — **the hook does not exist in the Vercel deploy**.
- **`import.meta.env.MODE === 'test'`** lets you opt the hook back in by building with `pnpm build --mode test` when you need to run E2E against a prod-mode bundle. This is the pattern used by `pnpm build && pnpm preview` in `webServer` — see `vite.config.ts` for the `define` block that makes this work.
- **The hook MUST be registered before `page.evaluate` is called.** The render loop starts async after `HandLandmarker` init. Always `waitFor` a landmark-rendered signal first (see smoke test below).

The hook is intentionally minimal — just `getFPS()` and `getLandmarkCount()`. Don't bloat it with mutation APIs. If you need to force a state for a negative test, do it via URL param or localStorage, not via the hook.

---

## Warmup timing: never sleep, always waitFor

MediaPipe HandLandmarker cold-start on CI is 20–35 s (WASM compile + 7.82 MB model fetch). Default Playwright timeouts (30 s) are insufficient for the **first** landmark. Subsequent assertions can use the default.

**Right pattern** — wait for a DOM signal that proves the first inference completed:

```ts
await page.waitForSelector('[data-testid="landmark-blob"]', { timeout: 60_000 });
```

**Wrong patterns**:

- `page.waitForTimeout(30_000)` — flaky, wasteful, doesn't prove anything. Banned.
- `await sleep(30_000)` via `page.evaluate` — same as above. Banned.
- `page.locator(...).waitFor({ timeout: 30_000 })` without a landmark signal — will time out on cold CI.

If blobs are drawn to `<canvas>` and there's no DOM element to select, use the fallback:

```ts
await page.waitForFunction(
  () => (window as any).__handTracker?.getLandmarkCount() >= 5,
  undefined,
  { timeout: 60_000 },
);
```

---

## FPS assertion: 3 s sample, ≥ 20

D21 acceptance: **render FPS ≥ 20**. Sample over 3 s to smooth out the first-frame spike:

```ts
const fps = await page.evaluate(async () => {
  await new Promise<void>(r => setTimeout(r, 3000));
  return (window as unknown as { __handTracker: { getFPS(): number } }).__handTracker.getFPS();
});
expect(fps).toBeGreaterThanOrEqual(20);
```

---

## `crossOriginIsolated` bake-in check

MediaPipe needs `SharedArrayBuffer`, which requires `crossOriginIsolated === true`, which requires `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`. Vite preview serves these from `vite.config.ts` `preview.headers`; Vercel serves them from `vercel.json` / `next.config` headers.

**Always include this assertion in the smoke test** — a regression in header config is otherwise silent until someone hits a `SharedArrayBuffer` ReferenceError:

```ts
const isolated = await page.evaluate(() => crossOriginIsolated);
expect(isolated).toBe(true);
```

Run it early (before waiting for landmarks) so you fail fast with a clear message instead of a 60 s landmark timeout.

---

## The 8 D23 error states — how to force each

With the three Chromium flags on, you're always on the `PROMPT → GRANTED` path. To test the other 7 states, force the scenario:

| State | How to force |
|---|---|
| `PROMPT` | Observable briefly; with `--use-fake-ui-for-media-stream` it's auto-skipped. Drop the UI flag to see it. |
| `GRANTED` | Default smoke-test path. |
| `USER_DENIED` | Remove `permissions: ['camera']` AND drop `--use-fake-ui-for-media-stream`; test dialog dismissal. Or use `await context.clearPermissions()` mid-test. |
| `SYSTEM_DENIED` | Hard to simulate in Chromium. Cover via unit test of the state-machine reducer, not E2E. |
| `DEVICE_CONFLICT` (`NotReadableError`) | Not reproducible with a fake device. Cover in unit tests. |
| `NOT_FOUND` | Point `--use-file-for-fake-video-capture` at a nonexistent path: `--use-file-for-fake-video-capture=/tmp/does-not-exist.y4m`. Chromium reports no devices, `getUserMedia` rejects with `NotFoundError`. |
| `MODEL_LOAD_FAIL` | `page.route('**/hand_landmarker.task', r => r.abort())` before navigation. |
| `NO_WEBGL` | `launchOptions.args: ['--disable-webgl', '--disable-webgl2']` in a dedicated project. |

**Scoping** (D21): only one full happy-path smoke test is required. Error-state tests are **optional** and gated behind whichever task file adds them — don't pre-build all 7 for free.

---

## Naming convention (D41): `Task N.M:` describe prefix

Every `describe` block starts with `Task N.M:` so that `--grep` can filter to a task's tests:

```ts
test.describe('Task 1.2: Webcam permission flow', () => {
  test('PROMPT card renders then dismisses on Allow', async ({ page }) => { /* ... */ });
  test('USER_DENIED card appears when permission is denied', async ({ page }) => { /* ... */ });
});
```

In a task file's L4 validation command:

```bash
pnpm test:e2e --grep "Task 1.2:"
```

This lets Ralph loop run **only the current task's tests** during the self-heal cycle, then the final phase's regression pass drops `--grep` to run everything.

---

## Flakiness pitfalls (earned the hard way)

- **Retry only in CI**: `retries: process.env.CI ? 2 : 0`. Locally, a flaky test is a bug to investigate; on CI, a 2-retry tolerance absorbs occasional WASM load variance.
- **`video: 'retain-on-failure'` + `trace: 'on-first-retry'`**: cheap to keep, invaluable when debugging CI-only failures. Already set in `playwright.config.ts`.
- **`fullyParallel: false`, `workers: 1`**: the fake webcam is a shared Chromium resource; parallel specs cause silent contention. Don't bump workers to "speed up CI."
- **Never `sleep` / `waitForTimeout`**: always a `waitFor*` on a concrete condition (selector visible, function returns true, response received).
- **Absolute path for `--use-file-for-fake-video-capture`**: relative paths only work if Playwright's CWD is exactly the project root. The committed config uses `path.resolve(__dirname, ...)`.
- **Model file must be present**: if `public/models/hand_landmarker.task` is missing (large binary, sometimes excluded from a fresh checkout), the app transitions to `MODEL_LOAD_FAIL` and the smoke test fails in a confusing way. CI must ensure the model is in place before running tests (committed in git or downloaded in a CI step).

---

## Worked smoke test example

```ts
// tests/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    __handTracker: {
      getFPS(): number;
      getLandmarkCount(): number;
    };
  }
}

test.describe('Task 1.1: Smoke — webcam to landmarks to ≥20 fps', () => {
  test('PROMPT → GRANTED path renders hand tracker at ≥20 fps', async ({ page }) => {
    // 1. Navigate to the preview build
    await page.goto('/');

    // 2. Fail fast if SAB/COOP/COEP headers regressed
    const isolated = await page.evaluate(() => crossOriginIsolated);
    expect(isolated, 'crossOriginIsolated must be true (COOP+COEP required for SharedArrayBuffer)').toBe(true);

    // 3. With --use-fake-ui-for-media-stream, permission auto-grants;
    //    the app may flash the PROMPT card briefly. No assertion needed.

    // 4. Wait for the render canvas (GRANTED state reached)
    await expect(page.locator('[data-testid="render-canvas"]')).toBeVisible({ timeout: 30_000 });

    // 5. No error-state card is visible
    await expect(page.locator('[data-testid="error-state-card"]')).not.toBeVisible();

    // 6. Wait up to 60 s for first landmark (WASM + 7.82 MB model cold-start)
    await page.waitForSelector('[data-testid="landmark-blob"]', { timeout: 60_000 });

    // 7. At least 5 landmark blobs (one per fingertip, D6)
    await expect(page.locator('[data-testid="landmark-blob"]')).toHaveCount(5, { timeout: 5_000 });

    // 8. Sample FPS over 3 s — D21 acceptance: ≥ 20
    const fps = await page.evaluate(async () => {
      await new Promise<void>(r => setTimeout(r, 3000));
      return window.__handTracker.getFPS();
    });
    expect(fps, `render FPS ${fps.toFixed(1)} — D21 requires ≥ 20`).toBeGreaterThanOrEqual(20);
  });
});
```

Run it locally:

```bash
pnpm test:setup      # generates tests/assets/fake-hand.y4m via ffmpeg (idempotent)
pnpm test:e2e        # builds, previews, runs Playwright
```

Run only this task's tests during Ralph iteration:

```bash
pnpm test:e2e --grep "Task 1.1:"
```

Run against Vercel preview (final phase):

```bash
PLAYWRIGHT_BASE_URL=https://hand-tracker-fx-git-pr-N-kb.vercel.app pnpm test:e2e
```

---

## GitHub Actions CI outline

```yaml
# .github/workflows/playwright.yml
name: Playwright E2E
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  deployment_status:   # Vercel preview → full regression against live URL (D42 final phase)

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    # Only run on Vercel "ready" deployment statuses (or on push/pr normally)
    if: >
      github.event_name != 'deployment_status' ||
      github.event.deployment_status.state == 'success'
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with: { version: 10 }

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Ensure ffmpeg
        run: sudo apt-get update && sudo apt-get install -y ffmpeg

      - name: Install Playwright Chromium
        run: pnpm exec playwright install --with-deps chromium

      - name: Generate fake webcam Y4M
        run: pnpm test:setup

      - name: Run E2E
        env:
          # When triggered by deployment_status, hit the Vercel preview URL
          PLAYWRIGHT_BASE_URL: ${{ github.event_name == 'deployment_status' && github.event.deployment_status.target_url || '' }}
        run: pnpm test:e2e

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report
          retention-days: 14
```

Notes:

- `pnpm/action-setup@v4` **must run before** `actions/setup-node@v4`, otherwise `pnpm` isn't on `PATH` when the node action tries to use it for caching.
- `playwright install --with-deps chromium` installs system libs (`libnss3`, etc.) in addition to the browser binary. Don't drop `--with-deps`.
- ffmpeg is a hard dependency of `pnpm test:setup`. Install it explicitly.
- `deployment_status` trigger only fires when the Vercel GitHub integration is enabled on the repo. If deployment-linked regression isn't firing, check the integration first.

---

## Anti-patterns (don't do these)

- **Committing `tests/assets/fake-hand.y4m`** — it's ~235 MB. `.gitignore` entry exists; `pnpm test:setup` regenerates it on demand.
- **Using H.264/MP4/WebM for the fake capture** — silently fails; Y4M `yuv420p` only.
- **Skipping `permissions: ['camera']`** because "the UI flag handles it" — both are required.
- **`page.waitForTimeout(...)`** anywhere — banned. Always a concrete `waitFor*`.
- **Increasing `workers`** to parallelise specs — the fake device is shared; contention is silent and corrupting.
- **Inlining camera-stream logic in the test** (`context.grantPermissions`, raw `getUserMedia` mocks via `addInitScript`) — the launch flags are the tested path; mocks diverge from production.
- **Relying on `import.meta.env.DEV` alone** for the `__handTracker` hook — it's `false` in `vite build`. Use the `DEV || MODE === 'test'` guard.
- **Hardcoding `baseURL`** — always allow `PLAYWRIGHT_BASE_URL` override so D42 final phase works.
- **Letting the smoke test "pass" without the `crossOriginIsolated` assertion** — COOP/COEP regressions become silent until a user hits a SAB error in production.

---

## Quick reference

| Task | Command |
|---|---|
| Generate fake webcam Y4M | `pnpm test:setup` |
| Run all E2E locally | `pnpm test:e2e` |
| Run only Task N.M's tests | `pnpm test:e2e --grep "Task N.M:"` |
| Run against Vercel preview | `PLAYWRIGHT_BASE_URL=https://... pnpm test:e2e` |
| Open last HTML report | `pnpm exec playwright show-report` |
| Debug interactively | `pnpm test:e2e --ui` |
| Update snapshots (if any) | `pnpm test:e2e --update-snapshots` |

| Env var | Effect |
|---|---|
| `PLAYWRIGHT_BASE_URL` | Target an external URL; skip local `webServer` |
| `CI` | Set by GitHub Actions; enables retries, disables `reuseExistingServer` |
