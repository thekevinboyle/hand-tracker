# Vite 8 + Vercel Deploy Config - Research

**Wave**: Second
**Researcher**: Web research specialist subagent
**Date**: 2026-04-14
**Status**: Complete

---

## Summary

This file provides ready-to-implement configurations for the full Vite 8 dev/build/preview pipeline and Vercel deployment, including exact header values mandated by DISCOVERY.md D31/D32, service worker cache-first sketch for model and WASM files, build script definitions, and curl verification commands. The 7.82 MB `.task` model file is below GitHub's 50 MB warning threshold and well below the 100 MB hard limit — no LFS is needed.

---

## Key Findings

### 1. Vite 8 Architecture Changes Relevant to Config

Vite 8 replaced Rollup/esbuild as the primary bundler with **Rolldown** (Rust-based). Key implications:

- `build.rollupOptions` is deprecated in favour of `build.rolldownOptions`. Existing Rollup options are auto-converted for compatibility, but prefer `rolldownOptions` in new code.
- `@vitejs/plugin-react` v6 now uses **Oxc** instead of Babel for React Refresh transforms. No Babel dependency installed by default — faster installs, faster dev-server start.
- `build.target` default changed to `'baseline-widely-available'` (Chrome 111+, Edge 111+, Firefox 114+, Safari 16.4+ as of 2026-01-01). For this project targeting modern desktop browsers (Chrome 120+, Firefox 132+, Safari 17+ per D13 acceptance criteria), the default is appropriate or can be tightened.
- **Built-in tsconfig paths**: `resolve.tsconfigPaths: true` is now a native Vite 8 option. `vite-tsconfig-paths` plugin is still available and recommended for advanced use cases (lazy loading, OXC Resolver integration), but the built-in option is sufficient for this project.
- `server.headers` and `preview.headers` work identically to Vite 6/7 — both accept `Record<string, string>`.
- `assetsInclude` is unchanged: accepts `string | RegExp | (string | RegExp)[]` using picomatch patterns.

**Sources:**
- [Vite 8.0 is out! — vite.dev](https://vite.dev/blog/announcing-vite8)
- [Build Options — vite.dev](https://vite.dev/config/build-options)
- [Shared Options — vite.dev](https://vite.dev/config/shared-options)

---

### 2. Complete vite.config.ts

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// D32: dev server COOP/COEP (localhost HTTP is fine — no mkcert needed for MVP)
// D31: these same values land in vercel.json for production
const SECURITY_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Permissions-Policy': 'camera=(self)',
  // CSP: wasm-unsafe-eval required for MediaPipe WASM execution (D31)
  // worker-src self blob: required for MediaPipe spawned workers
  // media-src self blob: required for webcam feed (blob URLs from getUserMedia)
  // img-src self data: blob: for canvas toDataURL + blob object URLs
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",        // unsafe-inline needed by Tweakpane 4 inline styles
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "img-src 'self' data: blob:",
    "connect-src 'self'",                       // no external fetches at runtime (all assets self-hosted)
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
}

export default defineConfig({
  plugins: [react()],

  // Vite 8 built-in tsconfig paths — replaces vite-tsconfig-paths plugin for simple cases
  resolve: {
    tsconfigPaths: true,
  },

  // D32: Dev server — localhost HTTP, COOP+COEP required for crossOriginIsolated
  server: {
    port: 5173,
    headers: SECURITY_HEADERS,
  },

  // Preview server (pnpm preview) must mirror production headers
  // Used for Phase regression testing (D42: local production build via pnpm build && pnpm preview)
  preview: {
    port: 4173,
    headers: SECURITY_HEADERS,
  },

  // D33: .task model files live in public/models/ — Vite copies public/ verbatim, no import needed.
  // assetsInclude is only required if you import .task files via JS (import modelUrl from './foo.task').
  // Since the model is loaded at runtime via fetch('/models/hand_landmarker.task'), no assetsInclude needed.
  // If a future task imports the .task file as a static asset URL, add:
  //   assetsInclude: ['**/*.task'],

  build: {
    // Target matches DISCOVERY.md D13 acceptance: Chrome 120+, Firefox 132+, Safari 17+
    // 'baseline-widely-available' covers all of these; explicit array is equivalent and documents intent
    target: ['chrome120', 'firefox132', 'safari17'],

    // Output directory (Vercel reads from here per vercel.json outputDirectory: "dist")
    outDir: 'dist',

    // Keep public/models/ and public/wasm/ copied verbatim — default behaviour is fine
    copyPublicDir: true,

    // Rolldown options (Vite 8 native, supersedes rollupOptions for new projects)
    rolldownOptions: {
      output: {
        // Separate chunk for MediaPipe to improve caching (large, rarely changes)
        manualChunks: {
          mediapipe: ['@mediapipe/tasks-vision'],
        },
      },
    },

    // Sourcemaps: inline in dev (Vite default), disabled in prod to avoid leaking source
    sourcemap: false,
  },

  // esbuild passthrough for type stripping in Vite 8 (Oxc handles transforms, esbuild for non-JS)
  // No extra esbuild config needed for this project
})
```

**Key decisions:**
- The `SECURITY_HEADERS` object is defined once and shared between `server.headers` and `preview.headers` to guarantee they are identical (D31 requires preview to match server).
- `style-src 'unsafe-inline'` is a known Tweakpane 4 requirement; it injects styles at runtime. If this is unacceptable, replace Tweakpane's injection with a compiled CSS bundle (out of scope for MVP).
- `connect-src 'self'` only — all model and WASM files are self-hosted under `/public/`, so no external `connect-src` entries are needed at runtime.
- The `.task` file in `public/models/` is served as a static file; no `assetsInclude` entry is required because it is never imported as a module.

---

### 3. Complete vercel.json

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",

  "buildCommand": "pnpm run build",
  "outputDirectory": "dist",
  "installCommand": "pnpm install",

  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy",   "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy",  "value": "require-corp" },
        { "key": "Permissions-Policy",            "value": "camera=(self)" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; media-src 'self' blob:; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        },
        { "key": "X-Content-Type-Options",        "value": "nosniff" },
        { "key": "X-Frame-Options",               "value": "DENY" },
        { "key": "Referrer-Policy",               "value": "strict-origin-when-cross-origin" }
      ]
    }
  ],

  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Notes:**
- `"source": "/(.*)"` is the correct Vercel glob pattern for all paths. It matches the root (`/`) and every sub-path.
- The `rewrites` rule implements SPA fallback: all paths that are not real files get served `index.html`. Vercel checks the filesystem before applying rewrites, so `/models/hand_landmarker.task`, `/wasm/*.wasm`, `/assets/*` etc. are still served correctly.
- `installCommand: "pnpm install"` is explicit because Vercel auto-detects pnpm from `pnpm-lock.yaml` but specifying it prevents surprise if lock file naming conventions change.
- `buildCommand: "pnpm run build"` overrides any Vercel project settings; Vite outputs to `dist/` which matches `outputDirectory`.
- Vercel does **not** need `framework: "vite"` — it auto-detects from `vite.config.ts` presence.

**Sources:**
- [Static Configuration with vercel.json — vercel.com](https://vercel.com/docs/project-configuration/vercel-json)
- [Content Security Policy — vercel.com/docs](https://vercel.com/docs/headers/security-headers)

---

### 4. Why COEP require-corp Requires Self-Hosted or CORP-Marked Assets

When `Cross-Origin-Embedder-Policy: require-corp` is set on a document, the browser enforces a strict rule on every cross-origin sub-resource loaded via `no-cors` requests (i.e., resources without explicit CORS headers):

> The resource must include `Cross-Origin-Resource-Policy: cross-origin` (or `same-site`) in its response headers, OR the request must be a CORS request with an appropriate `Access-Control-Allow-Origin` header.

If a cross-origin resource lacks either of these, the browser blocks it silently — the network request may succeed but the browser refuses to make the response available to the page. This is the mechanism that enables `SharedArrayBuffer` (required for MediaPipe multi-threaded WASM) because it prevents Spectre-style timing attacks via shared memory.

**Implications for this project:**

| Asset | Location | CORP status | Status |
|-------|----------|-------------|--------|
| `hand_landmarker.task` | `/public/models/` — same origin | Same origin, no CORP header needed | Safe |
| MediaPipe WASM files | `/public/wasm/` — same origin | Same origin, no CORP header needed | Safe |
| JS/CSS bundles | `/dist/assets/` — same origin | Same origin | Safe |
| Any CDN resource (fonts, icons, analytics) | Cross-origin | MUST send `CORP: cross-origin` | Blocked unless CORP present |

**The implication of D33 (self-host model + WASM under `/public/`)** is precisely this: by keeping all runtime assets on the same origin, the app avoids the CORP requirement entirely. No CDN will ever block the app.

If an external resource is needed (e.g., a Google Font), it must either be self-hosted or the CDN must send `Cross-Origin-Resource-Policy: cross-origin`. Google Fonts CDN does not send this header; self-host fonts instead.

An alternative to `require-corp` for loading CDN assets is `Cross-Origin-Embedder-Policy: credentialless` (Chrome/Edge only as of 2026, no Firefox/Safari support) — rejected for this project since Firefox and Safari are target browsers.

**Sources:**
- [Making your website cross-origin isolated — web.dev](https://web.dev/articles/coop-coep)
- [Cross-Origin-Embedder-Policy — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)
- [Cross-Origin-Resource-Policy — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cross-Origin_Resource_Policy)

---

### 5. Git LFS Decision for hand_landmarker.task (7.82 MB)

GitHub enforces these size limits:
- **Warning at 50 MB** — git shows a large-file warning but the push succeeds.
- **Hard block at 100 MB** — push is rejected; Git LFS required.

The `hand_landmarker.task` file is **7.82 MB** — well below both thresholds.

**Decision: No LFS needed.** Commit the file directly to `public/models/`. No `.gitattributes` entry required.

If the model is later upgraded to a larger variant (e.g., a float32 full model is ~22 MB), it still stays below 50 MB. Only if a file exceeds 100 MB does LFS become mandatory.

**Sources:**
- [About large files on GitHub — GitHub Docs](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)

---

### 6. Service Worker Sketch (cache-first for model and WASM)

**Discovery constraint (D3 / D12):** No PWA offline mode beyond caching the self-hosted model and WASM. The service worker is narrowly scoped: cache-first for `/models/*` and `/wasm/*` only. All other requests pass through to the network as normal.

**`public/sw.js`:**
```javascript
// public/sw.js
// Narrowly scoped cache-first SW for MediaPipe model + WASM files only.
// Version this string when model or WASM files are updated to bust the cache.
const CACHE_NAME = 'hand-fx-v1'

const CACHE_FIRST_PATTERNS = [
  /\/models\//,   // /models/hand_landmarker.task
  /\/wasm\//,     // /wasm/vision_wasm_internal.js + .wasm, vision_wasm_nosimd_internal.js + .wasm
]

self.addEventListener('install', (event) => {
  // Activate immediately; don't wait for old SW to die
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Clean up old cache versions
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  const isCacheFirst = CACHE_FIRST_PATTERNS.some((re) => re.test(url.pathname))

  if (!isCacheFirst) {
    // All non-model/wasm requests: pass through normally
    return
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request)
      if (cached) return cached

      const response = await fetch(event.request)
      if (response.ok) {
        // Clone before consuming — response body is a one-time stream
        cache.put(event.request, response.clone())
      }
      return response
    })
  )
})
```

**`src/app/main.tsx` — registration snippet:**
```typescript
// Register service worker only in production to avoid dev cache interference
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.debug('[SW] Registered:', registration.scope)
      })
      .catch((error) => {
        // Non-fatal: app works fine without SW (model loads from network)
        console.warn('[SW] Registration failed:', error)
      })
  })
}
```

**Important COEP note:** The service worker itself receives the same response headers as other resources because Vercel applies headers to all routes (the `"source": "/(.*)"` glob in `vercel.json` covers `/sw.js`). The COOP/COEP headers on the service worker's own response are fine — they apply to the document context, not the SW context.

**MediaPipe WASM files to cache** (copy from `node_modules/@mediapipe/tasks-vision/wasm/` to `public/wasm/` during scaffold):
```
vision_wasm_internal.js
vision_wasm_internal.wasm
vision_wasm_nosimd_internal.js
vision_wasm_nosimd_internal.wasm
```

The SW cache-first pattern `/wasm/` covers all four files. The runtime auto-selects SIMD or noSIMD based on CPU capability.

---

### 7. robots.txt and humans.txt

**`public/robots.txt`:**
```
User-agent: *
Allow: /
```

This is a creative visual app. No content is SEO-sensitive, and there is nothing to block. The permissive default is appropriate.

**`public/humans.txt`:**
```
/* TEAM */
Developer: Kevin Boyle
GitHub: https://github.com/thekevinboyle

/* TECHNOLOGY */
- React 19
- Vite 8
- MediaPipe Tasks Vision
- TypeScript 5.7
- ogl (WebGL)
- Tweakpane 4
- Deployed on Vercel

/* THANKS */
Google AI Edge — MediaPipe hand tracking
```

Neither file has COEP implications — they are same-origin assets. No further config needed.

---

### 8. Build Script Definitions (pnpm scripts in package.json)

```json
{
  "scripts": {
    "dev":          "vite",
    "build":        "pnpm run typecheck && vite build",
    "preview":      "vite preview",
    "typecheck":    "tsc --noEmit",
    "lint":         "biome check .",
    "lint:fix":     "biome check --write .",
    "format":       "biome format --write .",
    "test:unit":    "vitest run",
    "test:unit:watch": "vitest",
    "test:e2e":     "playwright test",
    "test:e2e:ui":  "playwright test --ui",
    "check":        "pnpm run typecheck && pnpm run lint && pnpm run test:unit"
  }
}
```

**Notes:**
- `build` runs `typecheck` first: compilation errors fail the build before Rolldown runs, surfacing TS errors with better messages than Rolldown's own type stripping.
- `check` is the single pre-commit command that covers all three of D41 L1 levels (`pnpm biome check`, `pnpm tsc --noEmit`, `pnpm vitest run`).
- `preview` starts the Vite preview server on port 4173; this server applies the `preview.headers` from `vite.config.ts` so local regression testing gets identical headers to production (important for `crossOriginIsolated` validation).

---

### 9. Verifying Headers on the Deployed App (curl -I commands)

Run these after first Vercel deploy to confirm all four security headers are present:

```bash
# 1. Check all 4 required security headers on the root HTML document
curl -sI https://<your-app>.vercel.app/ | grep -iE 'cross-origin|permissions-policy|content-security-policy'

# Expected output (order may vary):
# cross-origin-opener-policy: same-origin
# cross-origin-embedder-policy: require-corp
# permissions-policy: camera=(self)
# content-security-policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; ...

# 2. Check that the model file gets the same headers (COEP must apply to all responses)
curl -sI https://<your-app>.vercel.app/models/hand_landmarker.task | grep -iE 'cross-origin|content-type'

# Expected:
# cross-origin-opener-policy: same-origin
# cross-origin-embedder-policy: require-corp
# content-type: application/octet-stream

# 3. Check that WASM files are served with correct MIME type
curl -sI https://<your-app>.vercel.app/wasm/vision_wasm_internal.wasm | grep -iE 'content-type|cross-origin'

# Expected:
# content-type: application/wasm
# cross-origin-opener-policy: same-origin
# cross-origin-embedder-policy: require-corp

# 4. Verify crossOriginIsolated in the browser (run in DevTools console after deploy)
# > crossOriginIsolated
# true
```

**Programmatic check (add to Playwright E2E smoke test):**
```typescript
// In playwright test — verifies crossOriginIsolated is true in production deploy
const isIsolated = await page.evaluate(() => crossOriginIsolated)
expect(isIsolated).toBe(true)
```

---

## Recommended Approach

1. Commit the `vite.config.ts` above with the `SECURITY_HEADERS` constant shared between `server` and `preview`.
2. Commit `vercel.json` to the repo root. Vercel picks it up automatically on next deploy.
3. Add `pnpm run typecheck &&` prefix to the `build` script so CI fails early on type errors.
4. Place `public/sw.js` and register it in `src/app/main.tsx` with the `import.meta.env.PROD` guard.
5. After first deploy, run the `curl -I` commands above and confirm all 4 headers are present.
6. Add the `crossOriginIsolated` Playwright assertion to the E2E smoke test for automatic regression protection.

---

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| `COEP: credentialless` instead of `require-corp` | Allows CDN assets without CORP headers | No Firefox or Safari support (2026) | Rejected |
| `resolve.tsconfigPaths: true` (built-in) | No extra package | Small perf cost; less flexible | Recommended for MVP (simpler dep tree) |
| `vite-tsconfig-paths` plugin | OXC-backed, lazy loading, detailed logging | Extra dependency | Acceptable alternative if built-in proves insufficient |
| Workbox for service worker | Rich caching API, precaching manifest | ~100kb extra JS, overkill for 2-pattern cache | Rejected — manual SW is sufficient |
| SPA fallback via Vercel `routes` (legacy) | More flexible | Deprecated in favour of `rewrites` | Rejected |
| Git LFS for .task file (7.82 MB) | Would enable very large model variants | Unnecessary; file is under 50 MB threshold | Rejected |
| `build.target: 'esnext'` | Minimal transpilation, smaller output | Unnecessary for this project; baseline-widely-available covers all target browsers | Rejected |

---

## Pitfalls and Edge Cases

- **`style-src 'unsafe-inline'` and Tweakpane**: Tweakpane 4 injects styles via `CSSStyleSheet.insertRule()` and/or `<style>` tags. A strict `style-src 'nonce-...'` policy will break Tweakpane rendering without framework-level nonce injection (not supported in static Vite builds). `'unsafe-inline'` is the pragmatic choice for MVP. Mitigation if hardening is needed later: extract Tweakpane's styles to a static CSS file and serve them from `'self'`.

- **Service worker and `crossOriginIsolated` in dev**: The SW is gated to `import.meta.env.PROD`. In dev mode, the SW is never registered, but `crossOriginIsolated` is still `true` because `server.headers` in `vite.config.ts` sets COOP+COEP on every dev server response. This is the correct behaviour.

- **SW cache-busting**: When `hand_landmarker.task` is updated, increment the `CACHE_NAME` string (e.g., `hand-fx-v1` → `hand-fx-v2`). The `activate` event handler deletes all caches not matching the current name. Forgetting this causes stale model files to persist across deploys.

- **Vite `preview` server and SW**: `pnpm preview` serves files from `dist/` including `dist/sw.js`. Because `import.meta.env.PROD` is `true` in the built output, the SW registers during preview testing. Run `pnpm preview` to validate the full production header + SW stack locally before pushing.

- **`rolldownOptions.manualChunks` and MediaPipe**: MediaPipe's WASM loader (`FilesetResolver`) makes dynamic `fetch()` calls at runtime for the WASM files. Splitting the JS into a separate chunk does not affect WASM loading — the WASM files are always fetched via URL from `/wasm/`, not bundled. The `manualChunks` split only affects the JS glue code.

- **`buildCommand` in vercel.json vs Project Settings**: `buildCommand` in `vercel.json` overrides the project dashboard. This is correct — keep it in source control so deploys are reproducible regardless of dashboard state.

- **Vercel auto-detects pnpm**: Vercel detects the package manager from the lock file (`pnpm-lock.yaml`). Setting `installCommand: "pnpm install"` makes this explicit and documents the intent in source. If `pnpm-lock.yaml` is accidentally deleted, the explicit `installCommand` ensures pnpm is used rather than npm falling back.

- **`connect-src 'self'` and future CDN requests**: If any future code makes a fetch to an external URL (e.g., a GitHub API for the bug report link, or a CDN for a library), the CSP `connect-src 'self'` will block it. Update the CSP value in both `vite.config.ts` and `vercel.json` simultaneously when adding any external fetch.

---

## References

- [Vite 8.0 is out! — vite.dev](https://vite.dev/blog/announcing-vite8)
- [Build Options — vite.dev](https://vite.dev/config/build-options)
- [Shared Options — vite.dev](https://vite.dev/config/shared-options)
- [Static Configuration with vercel.json — vercel.com](https://vercel.com/docs/project-configuration/vercel-json)
- [Content Security Policy — vercel.com](https://vercel.com/docs/headers/security-headers)
- [Cross-Origin-Embedder-Policy — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)
- [Cross-Origin-Resource-Policy — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cross-Origin_Resource_Policy)
- [Making your website cross-origin isolated — web.dev](https://web.dev/articles/coop-coep)
- [Why you need cross-origin isolated for powerful features — web.dev](https://web.dev/articles/why-coop-coep)
- [About large files on GitHub — GitHub Docs](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)
- [Using Service Workers — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
- [vite-tsconfig-paths — npm](https://www.npmjs.com/package/vite-tsconfig-paths)
- [MediaPipe Tasks Vision WASM files — cdn.jsdelivr.net](https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/)

---

## Second Wave Additions

### Implementation Details (filtered by DISCOVERY.md)

| Decision | Config location | Value |
|----------|----------------|-------|
| D31 COOP | vercel.json + vite.config.ts | `same-origin` |
| D31 COEP | vercel.json + vite.config.ts | `require-corp` |
| D31 Permissions-Policy | vercel.json + vite.config.ts | `camera=(self)` |
| D31 CSP wasm-unsafe-eval | vercel.json + vite.config.ts | `script-src 'self' 'wasm-unsafe-eval'` |
| D31 worker-src | vercel.json + vite.config.ts | `worker-src 'self' blob:` |
| D31 media-src | vercel.json + vite.config.ts | `media-src 'self' blob:` |
| D31 script/style self | vercel.json + vite.config.ts | `script-src 'self'`, `style-src 'self' 'unsafe-inline'` |
| D32 dev HTTP | vite.config.ts | No mkcert, plain HTTP on localhost |
| D33 model path | public/models/ | `/models/hand_landmarker.task` served as static file |
| D44 wasm path | public/wasm/ | `/wasm/vision_wasm_internal.{js,wasm}` etc. |

### Tool and MCP Configuration

| Tool/Service | Purpose | Setup Required | Agent Can Self-Configure? |
|-------------|---------|----------------|---------------------------|
| Vercel CLI | Initial project link + deploy | `pnpm dlx vercel link` then `vercel deploy` | Yes — agent can run CLI commands |
| Vercel Dashboard | Verify headers on live deployment | Browser check at Project > Deployments | Yes (Playwright) |
| curl | Verify response headers after deploy | None | Yes (Bash) |

### Testing Strategy

- **L1 (lint/typecheck)**: `pnpm run check` (covers biome + tsc + vitest unit)
- **L2 (unit)**: `pnpm run test:unit` — no config-file tests needed (config is structural, not logic)
- **L3 (local smoke)**: `pnpm build && pnpm preview` then `curl -sI http://localhost:4173/ | grep -i cross-origin` to confirm COOP/COEP headers present on preview server
- **L4 (E2E)**: After Vercel deploy, run `curl -I https://<deployment>.vercel.app/` and assert `crossOriginIsolated === true` in Playwright

### Human Actions Required

| Action | Who | How | Status |
|--------|-----|-----|--------|
| Vercel project creation | User or Agent (Playwright) | `vercel link` in project root or Vercel dashboard | Pending (Phase 1 scaffold) |
| Push `main` to trigger deploy | User | `git push origin main` after scaffold task | Pending |
