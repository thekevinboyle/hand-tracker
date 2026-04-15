# Task 5.1: Register service worker for /models/* and /wasm/* cache-first

**Phase**: 5 — Deploy + Comprehensive E2E
**Branch**: `task/5-1-service-worker`
**Commit prefix**: `Task 5.1:`
**Estimated complexity**: Low
**Max Ralph iterations**: 10

---

## Goal

**Feature Goal** — Add a narrowly scoped, production-only service worker that cache-firsts `/models/*` and `/wasm/*` so that after the first visit, the 7.82 MB MediaPipe model and the ~52 MB wasm bundle are served from the Cache Storage API with no network round-trip.

**Deliverable** — `public/sw.js` (cache-first fetch handler covering two path prefixes) and `src/registerSW.ts` (idempotent registration guarded by `import.meta.env.PROD`), wired from `src/main.tsx`.

**Success Definition** — `pnpm build && pnpm preview`, load `http://localhost:4173/` once with devtools Network tab; reload → `/models/hand_landmarker.task` and every `/wasm/*.wasm` show `(ServiceWorker)` as the source. `pnpm test:e2e --grep "Task 5.1:"` passes. Offline reload after first load still serves the model (verified via `page.route('**/hand_landmarker.task', r => r.abort())` only hitting the network and being absorbed by the SW cache hit).

---

## User Persona

**Target User** — Returning visitor to the deployed app on a metered / slow connection (cafe, mobile hotspot, flaky hotel wifi).

**Use Case** — Second and subsequent visits should not re-download ~60 MB of immutable binaries.

**User Journey**:

1. First visit: normal cold path, model and wasm fetched and cached in `hand-tracker-fx-models-v1`.
2. Second visit (hours or weeks later): SW intercepts `/models/*` and `/wasm/*` fetches, serves from Cache Storage, falls back to network only on cache miss.
3. Developer updates the model file → bumps `CACHE_NAME` → old caches deleted on `activate`.

**Pain Points Addressed** — Re-downloading ~60 MB per visit on constrained networks; cold-start latency on the 7.82 MB model fetch.

---

## Why

- D33 mandates self-hosted model + wasm under `/models/*` and `/wasm/*`, with cache-first behavior.
- D31 permits `worker-src 'self' blob:` in CSP; `/sw.js` is same-origin so CSP does not block registration.
- D32 explicitly says SW is registered **only** in production to avoid dev-server cache interference.
- Integration: unblocks Task 5.2 (first deploy) and 5.4's `MODEL_LOAD_FAIL` forced-failure test (SW must NOT shadow an `abort()` from `page.route` — so SW scope must be correct AND be dev-off).

---

## What

User-visible behavior (all silent — this is an infra task):

- First load: network waterfall identical to pre-task.
- Second load: model + wasm served from SW cache; zero transfer bytes for those paths in devtools.
- Offline second load: app still initializes (permission flow, MediaPipe, renderer) because model + wasm hit the cache.
- Dev (`pnpm dev`) unchanged — no SW, no stale cache headaches.

Technical requirements:

- `public/sw.js` uses `CACHE_NAME = 'hand-tracker-fx-models-v1'`.
- Cache-first for `/models/` and `/wasm/` path prefixes only. Pass-through for everything else.
- Activation purges caches whose name does not match the current `CACHE_NAME`.
- Registration runs in `main.tsx` inside `if (import.meta.env.PROD && 'serviceWorker' in navigator)`.
- Registration failures are swallowed (`.catch(() => {})`) — the app must still work if SW registration fails.
- Dev never registers a SW; a prior dev registration from a misconfigured build should be auto-unregistered by the presence of a `/sw.js` that does `self.registration.unregister()` on dev builds? NO — simpler: we just never ship `sw.js` in dev (it is a public static file, always served) but we never call `register()`. If a user previously registered a SW they can clear it via devtools; we do not attempt automatic cleanup.

### NOT Building (scope boundary)

- No offline shell / app-shell caching — this is a live app that requires webcam + MediaPipe, fully offline is impossible.
- No PWA manifest, no install prompt, no home-screen icon. D3 declines PWA beyond model/wasm caching.
- No cache-busting logic tied to file hashes — we bump `CACHE_NAME` on model/wasm updates by hand.
- No stale-while-revalidate for `/assets/*` bundles — Vite fingerprints those and the HTTP cache handles them.

### Success Criteria

- [ ] `public/sw.js` exists, ≤ 50 LOC, no imports
- [ ] `src/registerSW.ts` exports `registerSW()` and is called from `main.tsx`
- [ ] `import.meta.env.PROD` gate is the ONLY condition allowing registration
- [ ] `pnpm build` succeeds; `dist/sw.js` is emitted verbatim from `public/sw.js`
- [ ] `pnpm preview` + curl: `/sw.js` responds 200 with `Content-Type: application/javascript` (or `text/javascript`)
- [ ] Playwright `Task 5.1:` spec confirms `navigator.serviceWorker.controller` is non-null after hard reload
- [ ] Playwright `Task 5.1:` spec confirms offline-reload serves model from cache
- [ ] `pnpm check` green

---

## All Needed Context

```yaml
files:
  - path: src/main.tsx
    why: Add the `registerSW()` call at module top-level after `createRoot(...).render(...)`. Do not block rendering on the SW.
    gotcha: Must NOT call inside a React component — service-worker registration should be a one-time side effect at entry.

  - path: vercel.json
    why: Confirm `/(.*)`-scoped headers apply to `/sw.js` — COOP/COEP are fine on the SW response; the SW does not need special CSP.
    gotcha: Do not add a separate `source: "/sw.js"` override; the catch-all is correct.

  - path: public/
    why: Vite copies `public/*` to `dist/*` verbatim at build. `public/sw.js` becomes `/sw.js`.
    gotcha: `sw.js` at root scope (served from `/`) means scope is `/` — the broadest. We explicitly register with `{ scope: '/' }` to document this.

  - path: playwright.config.ts
    why: `webServer` already runs `pnpm build && pnpm preview`. L4 SW test runs against port 4173 where SW will be active (PROD bundle).
    gotcha: The `__handTracker` dev hook only exists when MODE=test or DEV. We rely on `navigator.serviceWorker.controller` from the page, which is always observable.

  - path: .claude/skills/vite-vercel-coop-coep/SKILL.md
    why: Canonical SW source is in the "Service worker" section (lines 170-211). MIRROR that exact shape.
    gotcha: CACHE_NAME in this task is `hand-tracker-fx-models-v1` (NOT `hand-fx-v1` as shown in the skill file worked example — the skill is illustrative; DISCOVERY D33 + phase spec names the cache).

urls:
  - url: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
    why: Baseline install/activate/fetch lifecycle pattern
    critical: `self.skipWaiting()` in install + `self.clients.claim()` in activate are required so the SW takes control on first load without a refresh.

  - url: https://web.dev/articles/service-worker-caching-and-http-caching
    why: Cache-first semantics vs HTTP cache — they compose multiplicatively
    critical: Chrome devtools "Disable cache" checkbox disables HTTP cache but NOT the SW cache. When debugging, call `caches.delete('hand-tracker-fx-models-v1')` manually.

  - url: https://vite.dev/guide/env-and-mode.html
    why: `import.meta.env.PROD` is replaced at build time with the literal `true`/`false`; the branch is dead-code-eliminated in dev.
    critical: Do NOT use `process.env.NODE_ENV` — undefined in Vite browser builds.

skills:
  - prp-task-ralph-loop
  - hand-tracker-fx-architecture
  - vite-vercel-coop-coep
  - playwright-e2e-webcam

discovery:
  - D31: Vercel headers — SW response inherits COOP/COEP/CSP from `/(.*)` catch-all; safe.
  - D32: Dev server has NO SW; registration gated on PROD.
  - D33: Self-hosted model + wasm; SW caches `/models/*` + `/wasm/*` cache-first.
  - D23: `MODEL_LOAD_FAIL` state is reachable if the underlying fetch fails — SW must not mask an intentional network failure for task 5.4's forced tests (verified: `page.route('**/hand_landmarker.task', r => r.abort())` before any visit → no cache yet → SW passes through → abort surfaces).
```

### Current Codebase Tree (relevant subset)

```
hand-tracker/
├── public/
│   ├── models/hand_landmarker.task        (7.82 MB, committed)
│   └── wasm/                               (6 MediaPipe wasm files, committed)
├── src/
│   └── app/
│       └── main.tsx                        (React createRoot entry)
├── vercel.json                             (COOP/COEP/CSP/etc.)
├── vite.config.ts                          (preview headers match)
├── playwright.config.ts                    (launches `pnpm build && pnpm preview`)
└── tests/
    └── e2e/
        └── smoke.spec.ts                   (Task 1.1 happy path)
```

### Desired Codebase Tree (files added/modified by this task)

```
public/
└── sw.js                                  NEW — cache-first SW, ~40 LOC
src/
└── app/
    ├── main.tsx                           MODIFIED — call registerSW()
    └── registerSW.ts                      NEW — idempotent registration helper
tests/
└── e2e/
    └── service-worker.spec.ts             NEW — L4 verification of caching
```

### Known Gotchas

```typescript
// CRITICAL: React StrictMode runs useEffect twice in dev.
// registerSW() is NOT inside a component — it runs once at module load
// from main.tsx. StrictMode only affects React trees.

// CRITICAL: MediaPipe detectForVideo() requires monotonically increasing timestamps.
// Not relevant to this task but re-read if you touch renderer.ts.
// MediaPipe HandLandmarker runs on the MAIN THREAD only (GPU delegate).

// CRITICAL: Biome v2 is the single linter + formatter.
// Run: pnpm lint   (alias for `pnpm biome check .`)
// pnpm typecheck runs tsc across tsconfig references.

// CRITICAL: TypeScript strict is ON and `noExplicitAny: error` is configured.
// sw.js is plain JS — no TS types needed. Keep it JS for simplicity.
// registerSW.ts MUST be typed; no `any`.

// CRITICAL: pnpm, not npm or bun.

// CRITICAL: OGL Texture upload — not relevant here, but re-read if touching renderer.

// CRITICAL: Never store MediaStream in React state.

// CRITICAL: This is a React 19 Vite SPA, not Next.js.
// Do NOT add 'use client' directives.

// CRITICAL: import.meta.env.PROD is a Vite-time literal (true in build, false in dev).
// If you wrap the registration inside a function called from dev, the branch
// is dead-code-eliminated in prod — FINE. But if you call it unconditionally,
// dev registers a SW and you enter stale-cache hell. Always gate at call site.

// CRITICAL: Navigating to the page before the SW is "controlling" means the
// FIRST request for `/models/hand_landmarker.task` goes to network, not SW.
// This is expected — that is how the cache gets seeded. Test 5.1 accounts for
// this by reloading after the first `navigator.serviceWorker.ready`.
```

---

## Implementation Blueprint

### Data Models

N/A — no new TS types in this task. The existing window types remain.

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE public/sw.js
  - IMPLEMENT: Plain JS service worker. Exactly the content in "sw.js full content" below.
  - MIRROR: .claude/skills/vite-vercel-coop-coep/SKILL.md lines 173-200 (worked example)
  - NAMING: CACHE_NAME must equal 'hand-tracker-fx-models-v1'
  - GOTCHA: No imports. No top-level await. Keep it ES2020-compatible plain JS.
  - VALIDATE: `node -e "require('fs').readFileSync('public/sw.js','utf8')" | head -1` returns first line

Task 2: CREATE src/registerSW.ts
  - IMPLEMENT: `export function registerSW(): void`. Gated on `import.meta.env.PROD` AND `'serviceWorker' in navigator`. Uses `window.addEventListener('load', ...)` so registration does not block first paint. Swallows errors with `.catch((err) => console.warn('[sw] registration failed', err))`.
  - MIRROR: skill doc lines 203-209
  - NAMING: Default export is `registerSW`
  - GOTCHA: Never log the full error object with `console.error` — it creates a Sentry-ish signal; `console.warn` is intentional.
  - VALIDATE: `pnpm typecheck` exits 0

Task 3: MODIFY src/main.tsx
  - IMPLEMENT: Add `import { registerSW } from './registerSW'` and call `registerSW()` once, after `createRoot(...).render(...)`.
  - MIRROR: Existing top-level side-effect pattern in main.tsx (look at how StrictMode is wired)
  - NAMING: Call site is bare `registerSW()` — no alias
  - GOTCHA: Do NOT call inside a React component or a `useEffect` — it is a bootstrapper side effect.
  - VALIDATE: `pnpm build` exits 0 and `dist/sw.js` exists

Task 4: CREATE tests/e2e/service-worker.spec.ts
  - IMPLEMENT: Two tests. (1) "registers in prod bundle": navigate `/`, await `navigator.serviceWorker.ready`, reload, assert `navigator.serviceWorker.controller !== null`. (2) "serves /models/* from cache on second request": first visit, wait for landmark signal, reload, inspect `performance.getEntriesByType('resource')` to confirm `transferSize === 0` for `/models/hand_landmarker.task`.
  - MIRROR: tests/e2e/smoke.spec.ts (header, imports, test.describe naming)
  - NAMING: describe `'Task 5.1: Service worker caches /models and /wasm'`
  - GOTCHA: `transferSize === 0` indicates memory / disk / SW cache. Combined with `navigator.serviceWorker.controller !== null`, this is sufficient proof for MVP. Do not chase a more-exact assertion.
  - VALIDATE: `pnpm test:e2e --grep "Task 5.1:"` exits 0
```

### sw.js full content

Copy verbatim into `public/sw.js`:

```js
// Hand Tracker FX service worker.
// Cache-first for /models/* and /wasm/*; pass-through for everything else.
// Bump CACHE_NAME whenever any asset under /models or /wasm changes.
const CACHE_NAME = 'hand-tracker-fx-models-v1';
const CACHE_FIRST_PATTERNS = [/^\/models\//, /^\/wasm\//];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!CACHE_FIRST_PATTERNS.some((re) => re.test(url.pathname))) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    })(),
  );
});
```

### registerSW.ts full content

```ts
/**
 * Register the production service worker.
 * No-op in dev (Vite sets import.meta.env.PROD to false → dead-code eliminated).
 * Swallows registration errors — the app must keep working even if SW fails.
 */
export function registerSW(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err: unknown) => {
        console.warn('[sw] registration failed', err);
      });
  });
}
```

### Integration Points

```yaml
main.tsx:
  - Add: import { registerSW } from './registerSW'
  - Add: registerSW() after root.render(...)

paramStore: N/A
effectRegistry: N/A
handLandmarker: N/A (SW is transparent to it)
tweakpane: N/A
```

---

## Validation Loop

```bash
# Level 1 — Syntax & Style (run after EVERY file write)
pnpm lint
pnpm typecheck

# Level 2 — Unit Tests
# No unit tests for this task — the SW is a browser-context artifact best tested via E2E.
# Confirm no existing units regressed:
pnpm test

# Level 3 — Integration: production build, confirm sw.js copied through
pnpm build
test -f dist/sw.js && echo "dist/sw.js OK" || (echo "MISSING" && exit 1)

# Level 4 — E2E
pnpm test:e2e --grep "Task 5.1:"
```

---

## Final Validation Checklist

### Technical

- [ ] `pnpm lint` exits 0
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0
- [ ] `pnpm build` exits 0 and `dist/sw.js` exists
- [ ] `pnpm test:e2e --grep "Task 5.1:"` exits 0
- [ ] Full `pnpm check` green

### Feature

- [ ] `pnpm preview` first visit: model downloads via network, SW installs
- [ ] `pnpm preview` reload: `/models/hand_landmarker.task` served from SW cache (devtools Network tab shows "(ServiceWorker)" / zero transfer)
- [ ] `pnpm dev`: no SW registered (devtools Application tab empty)
- [ ] StrictMode double-mount unchanged (registerSW is outside React tree)

### Code Quality

- [ ] No `any` types in `registerSW.ts`
- [ ] `public/sw.js` is ≤ 50 LOC
- [ ] CACHE_NAME is exactly `'hand-tracker-fx-models-v1'`
- [ ] Registration is gated on both `PROD` and `'serviceWorker' in navigator`

---

## Anti-Patterns

- Do NOT register the SW in dev. Stale cache during dev is a time sink.
- Do NOT cache `/` or `/index.html`. The document must be network-fresh or the user gets stuck on a stale deploy.
- Do NOT cache anything outside `/models/` and `/wasm/`. Vite's fingerprinted `/assets/` chunks are already HTTP-cacheable and do not benefit from SW.
- Do NOT use Workbox or a plugin — this is 40 lines of hand-written JS, no toolchain needed.
- Do NOT put `self.skipWaiting()` inside `event.waitUntil(...)` — it is a sync call, no promise needed.
- Do NOT add a version query string (`/sw.js?v=123`) — Vite serves the file as-is, and the SW scope is `/`, so the URL must be stable.

See also universal anti-patterns in `.claude/skills/prp-task-ralph-loop/SKILL.md` §6.

---

## No Prior Knowledge Test

- [ ] `public/sw.js` file path is reachable (new file — this task creates it)
- [ ] `src/main.tsx` exists in the codebase
- [ ] MDN service-worker URL is reachable
- [ ] `D31`, `D32`, `D33` exist in DISCOVERY.md (verified: lines 145-156 of DISCOVERY.md)
- [ ] Implementation Tasks list is topologically sorted (sw.js → registerSW.ts → main.tsx → e2e)
- [ ] Validation Loop commands are copy-paste runnable with no placeholders
- [ ] `.claude/skills/vite-vercel-coop-coep/SKILL.md` exists — MIRROR target
- [ ] Task is atomic — no dependency on future tasks

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/vite-vercel-coop-coep/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
```
