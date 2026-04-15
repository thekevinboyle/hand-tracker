---
name: vite-vercel-coop-coep
description: Use when modifying vite.config.ts, vercel.json, security headers, CSP, or service worker configuration in Hand Tracker FX. COOP/COEP for MediaPipe wasm threads, CSP for webcam + WebGL + Tweakpane, Vercel deploy wiring, runtime crossOriginIsolated check.
---

# Vite + Vercel COOP/COEP — Hand Tracker FX

Reference for the deploy + cross-origin isolation stack. Touch this before editing `vite.config.ts`, `vercel.json`, the CSP string, or the service worker. Loosening any header here has the potential to silently break MediaPipe multi-threaded wasm; the runtime symptom is `crossOriginIsolated === false` and thread pool initialization failing.

Upstream authority: DISCOVERY.md D31 (Vercel headers), D32 (dev server headers), D33 (self-host model + wasm), D44 (wasm path).

---

## Why cross-origin isolation is mandatory

MediaPipe `@mediapipe/tasks-vision` uses multi-threaded wasm internally (pthreads via `SharedArrayBuffer`). Browsers only expose `SharedArrayBuffer` to documents that have opted into cross-origin isolation:

| Condition | Required value |
|-----------|----------------|
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Embedder-Policy` | `require-corp` |
| Runtime check (bake-in) | `crossOriginIsolated === true` |

If either header is missing or weaker, `crossOriginIsolated` is `false`, `SharedArrayBuffer` is undefined, and MediaPipe falls back to single-threaded (or fails outright depending on build). The runtime check `crossOriginIsolated` is the single source of truth — always assert it in E2E, don't just check headers.

`COEP: require-corp` means every cross-origin subresource loaded via `no-cors` must advertise `Cross-Origin-Resource-Policy: cross-origin`. Self-hosted assets under `public/` sidestep this negotiation entirely — they are same-origin, so no CORP header is needed on them.

**Alternative rejected:** `COEP: credentialless` would allow CDN assets without CORP but has no Firefox/Safari support as of 2026. Per D13 we target Chrome 120+, Firefox 132+, Safari 17+, so `require-corp` is the only choice.

---

## Full security header table

Applied identically by `server.headers`, `preview.headers` (Vite), and `headers[]` (Vercel). Values live in the shared `SECURITY_HEADERS` constant in `vite.config.ts` and in `vercel.json`.

| Header | Value | Purpose |
|--------|-------|---------|
| `Cross-Origin-Opener-Policy` | `same-origin` | Process isolation; prerequisite for COI |
| `Cross-Origin-Embedder-Policy` | `require-corp` | Gates SharedArrayBuffer; forces CORP on cross-origin subresources |
| `Permissions-Policy` | `camera=(self)` | Only this origin may call `getUserMedia` for camera |
| `Content-Security-Policy` | (see below) | Scoped script/style/worker/media/connect surface |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing on wasm/task files |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer hygiene |

### CSP policy (each directive explained)

```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
media-src 'self' blob:;
worker-src 'self' blob:;
connect-src 'self';
font-src 'self';
object-src 'none';
base-uri 'self';
frame-ancestors 'none'
```

| Directive | Why |
|-----------|-----|
| `default-src 'self'` | Deny-by-default; everything else is an explicit relaxation |
| `script-src 'self' 'wasm-unsafe-eval'` | `'wasm-unsafe-eval'` is required for MediaPipe to compile wasm modules at runtime. This token is the narrow, wasm-only replacement for the old blanket `'unsafe-eval'`. |
| `style-src 'self' 'unsafe-inline'` | Tweakpane 4 injects styles at runtime via `CSSStyleSheet.insertRule()` / inline `<style>`. Without `'unsafe-inline'` the panel renders unstyled. Hardening this would require extracting Tweakpane styles to a static CSS bundle (out of scope). |
| `img-src 'self' data: blob:` | `data:` for canvas `toDataURL`; `blob:` for `URL.createObjectURL` (screenshots, exports) |
| `media-src 'self' blob:` | `blob:` required for the `MediaRecorder`-produced `.webm` download URL and for webcam MediaStream blob URLs |
| `worker-src 'self' blob:` | MediaPipe and future custom workers spawn from blob URLs in some builds |
| `connect-src 'self'` | All fetches are same-origin (model + wasm are self-hosted). If you ever add an external fetch (e.g., GitHub issue API), update this in BOTH `vite.config.ts` and `vercel.json` in the same commit. |
| `font-src 'self'` | No Google Fonts — self-host if fonts are ever added |
| `object-src 'none'` | Kill `<object>`/`<embed>` attack surface |
| `base-uri 'self'` | Prevent `<base>` tag injection redirecting relative URLs |
| `frame-ancestors 'none'` | App cannot be iframed; mitigates clickjacking on webcam prompt |

---

## vite.config.ts skeleton

Current `vite.config.ts` uses `vitest/config` import (unit-test config merged in). The security-critical shape:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const SECURITY_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Permissions-Policy': 'camera=(self)',
} as const;

export default defineConfig({
  plugins: [react()],
  server:  { port: 5173, headers: SECURITY_HEADERS },
  preview: { port: 4173, headers: SECURITY_HEADERS },
  build: {
    target: ['chrome120', 'firefox132', 'safari17'],
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@mediapipe/tasks-vision')) return 'mediapipe';
          if (id.includes('node_modules/ogl')) return 'ogl';
          if (id.includes('node_modules/tweakpane') || id.includes('node_modules/@tweakpane')) {
            return 'tweakpane';
          }
        },
      },
    },
  },
});
```

Notes:
- `SECURITY_HEADERS` is shared so dev (`pnpm dev`) and local preview (`pnpm preview`) produce identical responses. D31 requires preview to match production.
- `build.target` is an explicit array — matches D13 acceptance criteria verbatim. Do not switch to `'baseline-widely-available'`; keep the array so the target versions are documented.
- `manualChunks` **must be the function form** in Vite 8 / Rolldown. The object form (`manualChunks: { mediapipe: [...] }`) still works for Rollup but the function form is forward-compatible with `rolldownOptions`, handles sub-paths cleanly, and is the only form that survives if/when this file migrates to `build.rolldownOptions`.
- The full CSP is NOT set in `server.headers` here — Vite's dev server serves assets from arbitrary paths and the CSP is better enforced on the production Vercel side. If you add CSP to dev, copy the exact string from `vercel.json` into `SECURITY_HEADERS`.

---

## vercel.json structure

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install --frozen-lockfile",
  "outputDirectory": "dist",
  "framework": "vite",
  "headers": [
    { "source": "/(.*)", "headers": [ /* table above */ ] }
  ],
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

| Field | Rationale |
|-------|-----------|
| `buildCommand: "pnpm build"` | Overrides Vercel dashboard, keeps build reproducible from source |
| `installCommand: "pnpm install --frozen-lockfile"` | Fails CI if `pnpm-lock.yaml` drifted; explicit pnpm prevents npm fallback |
| `outputDirectory: "dist"` | Matches `vite.config.ts` `build.outDir` default |
| `framework: "vite"` | Vercel auto-detects but explicit is better for drift protection |
| `headers[].source: "/(.*)"` | Glob matches root + every sub-path. The same headers apply to `/`, `/models/*.task`, `/wasm/*.wasm`, `/assets/*` — exactly what COEP requires. |
| `rewrites[]` | SPA fallback. Vercel checks filesystem first, so real files (model, wasm, js/css) are served directly and the rewrite only fires for unknown paths. |

---

## Self-hosted assets (why no CORP negotiation)

All runtime-loaded assets live under `public/` and are served from the same origin as the document:

| Path | Size | Content-Type |
|------|------|--------------|
| `/models/hand_landmarker.task` | 7.82 MB | `application/octet-stream` |
| `/wasm/vision_wasm_internal.{js,wasm}` | 316 KB / 10.98 MB | `text/javascript` / `application/wasm` |
| `/wasm/vision_wasm_module_internal.{js,wasm}` | 316 KB / 10.98 MB | — |
| `/wasm/vision_wasm_nosimd_internal.{js,wasm}` | 316 KB / 10.21 MB | — |

MediaPipe `FilesetResolver.forVisionTasks('/wasm')` picks SIMD or noSIMD at runtime based on CPU capability — keep all four `.js`/`.wasm` pairs committed.

**Model file (7.82 MB)** is well below GitHub's 50 MB warning threshold and 100 MB hard block. Commit directly to `public/models/` — no Git LFS, no `.gitattributes` entry. A future float32 upgrade (~22 MB) still fits under 50 MB.

Do NOT move these assets to a CDN. Any cross-origin fetch under `COEP: require-corp` requires the CDN to emit `Cross-Origin-Resource-Policy: cross-origin`, which most public CDNs (Google Fonts included) do not.

---

## Service worker (NOT in scaffold — Phase 2 task)

The SW is narrowly scoped: cache-first for `/models/*` and `/wasm/*`, pass-through for everything else. Register only in production to avoid dev cache interference.

`public/sw.js`:
```js
const CACHE_NAME = 'hand-fx-v1';
const CACHE_FIRST = [/\/models\//, /\/wasm\//];

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (!CACHE_FIRST.some((re) => re.test(url.pathname))) return;
  e.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const hit = await cache.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    })
  );
});
```

Registration in `src/app/main.tsx`:
```ts
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}
```

Cache-busting: bump `CACHE_NAME` (e.g. `hand-fx-v1` → `hand-fx-v2`) whenever the `.task` file or any wasm is updated. The `activate` handler purges non-matching caches. Forgetting this strands users on stale model files.

COEP note: the service worker itself receives the same COOP/COEP headers as every other route (the `/(.*)` glob covers `/sw.js`). That is fine — those headers apply to document contexts, not the SW context.

---

## Verification workflow

### Phase 6 curl checks (deployed or local preview)

```bash
# Root HTML
curl -sI https://<deployment>/ | grep -iE 'cross-origin|permissions-policy|content-security-policy'
# Model file
curl -sI https://<deployment>/models/hand_landmarker.task | grep -iE 'cross-origin|content-type'
# WASM file
curl -sI https://<deployment>/wasm/vision_wasm_internal.wasm | grep -iE 'content-type|cross-origin'
```

Expected on every path:
```
cross-origin-opener-policy: same-origin
cross-origin-embedder-policy: require-corp
```
Plus on `/`: `permissions-policy: camera=(self)` and the full CSP string.

### Playwright runtime bake-in

The header check is necessary but not sufficient. The conclusive proof is the runtime predicate:

```ts
const isIsolated = await page.evaluate(() => crossOriginIsolated);
expect(isIsolated).toBe(true);
```

Assert this in the E2E smoke test (Phase 1 task). If headers are present but the flag is false, something else in the page (e.g., an unmarked cross-origin iframe) broke isolation.

---

## Vercel CLI deploy wiring

Per D31 deploy-on-push-to-main, the flow is:

```bash
pnpm dlx vercel link        # one-time, links local project to Vercel project
pnpm dlx vercel --prod      # manual prod deploy (optional; git push handles subsequent)
git push origin main        # triggers auto-deploy after first link
```

Per D39 the GitHub remote is created only when the first deploy is wired up. The Vercel project is linked in the final phase's deploy task, not the scaffold.

---

## Known gotchas

- **Vite 8 default COEP is `credentialless`** on some platforms — the explicit `require-corp` override in `SECURITY_HEADERS` is mandatory. Never remove it.
- **`manualChunks` must be a function in Vite 8.** The object form works via Rollup compatibility shim but will not migrate cleanly to `build.rolldownOptions`.
- **Preview server is the pre-push gate.** `pnpm build && pnpm preview` serves `dist/` with the exact `preview.headers` from `vite.config.ts`, which is the closest local approximation of Vercel's runtime. Always run curl checks against `http://localhost:4173/` before pushing.
- **MediaPipe reads wasm via `fetch()` at runtime**, not via bundler imports. `manualChunks: { mediapipe: ... }` only splits the JS glue; wasm files are always loaded from the `/wasm/` URL.
- **CSP `connect-src 'self'`** will block any new external fetch without warning. If you add a GitHub issue API call, a telemetry endpoint, or a CDN resource, update BOTH `vite.config.ts` (if/when CSP is added to dev headers) AND `vercel.json` in the same commit.
- **Tweakpane + `style-src`**: removing `'unsafe-inline'` breaks the panel. The only clean alternative is to extract Tweakpane's CSS into a static bundle, which is out of MVP scope.

---

## When NOT to change headers

Any loosening of the header stack risks breaking MediaPipe threads. Specifically, do not:

- Weaken `COOP` (e.g., to `same-origin-allow-popups`) — breaks isolation.
- Weaken `COEP` to `credentialless` — breaks Firefox/Safari.
- Remove `'wasm-unsafe-eval'` from `script-src` — breaks MediaPipe wasm compilation.
- Remove `blob:` from `worker-src` / `media-src` — breaks webcam or recording.
- Change `Permissions-Policy: camera=(self)` to `camera=()` — disables webcam.
- Add external origins to `connect-src` without auditing — can introduce exfiltration vectors.

If you genuinely need to relax a header (e.g., to allow a new CDN), update this skill file in the same commit so the next agent has the new invariant documented.

---

## Cross-references

- `.claude/orchestration-hand-tracker-fx/DISCOVERY.md` — D31, D32, D33, D44 (authority)
- `.claude/orchestration-hand-tracker-fx/research/vite-vercel-config-impl.md` — source research
- `.claude/orchestration-hand-tracker-fx/reports/tool-verification.md` — Phase 6 verification evidence
- `vite.config.ts`, `vercel.json` — current live configuration
