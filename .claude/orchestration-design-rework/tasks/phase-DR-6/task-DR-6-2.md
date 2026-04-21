# Task DR-6.2: Self-host JetBrains Mono

**Phase**: DR-6 — Foundation
**Branch**: `task/DR-6-2-self-host-jetbrains-mono`
**Commit prefix**: `Task DR-6.2:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal** — Self-host the JetBrains Mono font (Regular 400, Medium 500, SemiBold 600) as subset woff2 files under `/public/fonts/`, wire `@font-face` declarations into `src/ui/tokens.css`, preload the Medium weight from `index.html`, and ensure long-cache headers + CSP remain compliant.

**Deliverable** — Three woff2 files (≤ 30 KB each) in `public/fonts/`, OFL license alongside, `@font-face` rules at the top of `src/ui/tokens.css`, a `<link rel="preload">` in `index.html`, long-cache headers for `/fonts/*` in `vercel.json`, and an E2E that verifies the Medium font loads with immutable caching and is the resolved `font-family` on `document.body`.

**Success Definition** —
1. `ls -la public/fonts/*.woff2` shows 3 files, total size < 90 KB.
2. `pnpm test:e2e --grep "Task DR-6.2:"` exits 0 — E2E fetches `/fonts/JetBrainsMono-Medium-subset.woff2`, asserts HTTP 200 + `Cache-Control: public, max-age=31536000, immutable`, asserts `getComputedStyle(document.body).fontFamily.includes('JetBrains Mono')`.
3. `pnpm build` succeeds; dist contains the three fonts.
4. `curl -sI https://<preview>/fonts/JetBrainsMono-Medium-subset.woff2` on a Vercel preview returns `Cache-Control: public, max-age=31536000, immutable` (manual verification step only — no assertion required at task-complete time; preview URL verification lives in DR-6.R regression).
5. `crossOriginIsolated === true` still holds on the preview (COEP not broken by font fetch).

---

## User Persona

**Target User** — The next execution agent working on DR-6.3 (body baseline) and all of Phase DR-7 / DR-8, who will style text in JetBrains Mono without thinking about font loading.

**Use Case** — Self-hosted fonts are a requirement because of COOP/COEP + CSP `font-src 'self'`. Using Google Fonts CDN would be blocked by CSP and would leak a cross-origin request — both violations of DISCOVERY D31/D33.

**Pain Points Addressed** — Avoids FOUT (flash of unstyled text) via `<link rel="preload">`. Keeps payload small via subsetting. Preserves `crossOriginIsolated` (MediaPipe wasm threads).

---

## Why

- **DR7** — JetBrains Mono is the chosen UI font. Self-host mandate; Medium (500) default + SemiBold (600) emphasis + Regular (400) fallback.
- **D31** (parent) — CSP `font-src 'self'`. External font CDN is blocked.
- **D33** (parent) — self-host discipline applies to all assets, not just MediaPipe wasm/model.
- **D43** (parent) — preload strategy for large assets.
- Downstream: **DR-6.3** consumes `--font-family` (already set in DR-6.1) and expects fonts to actually load. **Every primitive in Phase DR-7 uses JetBrains Mono.**

---

## What

User-visible behavior after this task:

- Page renders in JetBrains Mono (not system-ui) once the font loads. PrePromptCard title, body, and retry button are in JetBrains Mono.
- No FOUT — the preload tag ensures the Medium weight arrives before the first paint of text.
- Network panel shows `JetBrainsMono-Medium-subset.woff2` with status 200 and long-cache header.

### NOT Building (scope boundary)

- Italic variants (not needed for UI — DR7 marks them optional).
- Variable font — subsetting to static weights is simpler and smaller for 3 weights only.
- Icon fonts or any other font family.
- Ligature support — UI text does not benefit from code-ligatures. Subsetting will drop them.
- Fallback to system-ui for FOUT window — `font-display: swap` handles the 1–2 frames cleanly.
- Font-feature-settings tuning (tabular-nums, etc.) — Phase DR-7 may revisit per-primitive if needed.

### Success Criteria

- [ ] `public/fonts/JetBrainsMono-Regular-subset.woff2` exists, ≤ 30 KB.
- [ ] `public/fonts/JetBrainsMono-Medium-subset.woff2` exists, ≤ 30 KB.
- [ ] `public/fonts/JetBrainsMono-SemiBold-subset.woff2` exists, ≤ 30 KB.
- [ ] `public/fonts/LICENSE.txt` contains the full OFL-1.1 text (from JetBrains Mono release).
- [ ] `public/fonts/README.md` (small) documents source repo, version, subset ranges.
- [ ] `src/ui/tokens.css` contains three `@font-face` declarations at the top of the file, BEFORE `:root { … }`.
- [ ] `src/ui/tokens.css` `--font-family` token value unchanged (DR-6.1 already set it to `'JetBrains Mono', ui-monospace, Menlo, monospace`).
- [ ] `index.html` has `<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/JetBrainsMono-Medium-subset.woff2">` in `<head>` BEFORE the viewport meta.
- [ ] `vercel.json` serves `/fonts/(.*)` with `Cache-Control: public, max-age=31536000, immutable` AND inherits COEP/COOP from the global header block.
- [ ] CSP `font-src 'self'` is unchanged (no data: or external origins added).
- [ ] Vite config — no change needed (static `public/` assets are copied as-is).
- [ ] Unit test `src/ui/fontLoading.test.ts` asserts `@font-face` rules exist after `tokens.css` import (via a jsdom `document.styleSheets` probe).
- [ ] E2E spec `tests/e2e/task-DR-6-2.spec.ts` with describe `Task DR-6.2: JetBrains Mono loads + body renders in mono` — asserts HTTP 200 + Cache-Control + computed font-family.
- [ ] All existing Phase 1–4 E2E specs still pass.

---

## All Needed Context

```yaml
files:
  - path: src/ui/tokens.css
    why: CREATED by Task DR-6.1. THIS task appends three @font-face rules AT THE TOP.
    gotcha: The @import "./ui/tokens.css" line in src/index.css already exists after DR-6.1.
            @font-face rules MUST appear in tokens.css (not index.css) so the file stays
            a single-source-of-truth for all token-adjacent CSS. The `--font-family`
            token value does NOT need updating — DR-6.1 already declared the correct value.
    order_requirement: |
      @font-face declarations FIRST, then :root { … } block. CSS allows @font-face at
      any position, but placing them first is idiomatic and makes diffing easier.

  - path: index.html
    why: ADD a <link rel="preload"> for the Medium (500) weight — the most-used default.
         Plus the source-of-truth DR19 dev comment: <!-- Hand Tracker FX — pixelcrash-inspired rework 2026-04-20 -->
    gotcha: |
      crossorigin attribute is MANDATORY on the preload <link>. Without it, Chromium fetches
      the font once for the preload (without CORS) and again for the @font-face (with CORS),
      wasting bandwidth and defeating the preload.
      `type="font/woff2"` is also required to correctly prioritize the fetch.

  - path: vercel.json
    why: ADD a new headers entry matching `/fonts/(.*)` with long-cache Cache-Control.
         The existing top-level `headers[0]` matches `/(.*)` and sets COOP/COEP/CSP on everything —
         fonts inherit that. ADD a more-specific entry for Cache-Control; Vercel merges both
         header sets for /fonts/* (specificity not an issue because Vercel applies all matching
         source entries in order).
    gotcha: |
      A naive append that re-specifies COOP/COEP on /fonts/* is OK but redundant. Keep the
      /fonts/* entry minimal — only Cache-Control — so the global block remains authoritative
      for security headers.

  - path: public/
    why: Static-asset root. Files here are copied verbatim to dist/ by Vite.
    gotcha: Subdirectory `public/fonts/` is created by this task.

  - path: .claude/orchestration-design-rework/DISCOVERY.md
    why: DR7 — font specification (weights, subset, letter-spacing, fluid root).
         DR19 — signature dev comment in index.html.

  - path: .claude/orchestration-design-rework/research/pixelcrash-design-language.md
    why: §"Typography" documents JetBrains Mono's design characteristics.
         §"Font Loading" shows pixelcrash uses fonts.googleapis.com — we do NOT (CSP/COEP constraint).
    gotcha: |
      pixelcrash loads JetBrains Mono + Geist Mono from googleapis. They also disabled
      crossOriginIsolated by serving a non-isolated page. We MUST NOT follow that approach —
      our wasm threads require isolation.

  - path: tests/e2e/task-5-1.spec.ts
    why: MIRROR for fetching an asset + asserting headers in an E2E. Task 5.1's spec
         checks Cache-Control on /models/* and /wasm/* — identical shape for this task.
    gotcha: |
      page.request.get() honors the page's origin, so a relative URL "/fonts/…" works
      after navigation. Use baseURL from playwright.config if PLAYWRIGHT_BASE_URL is set.

  - path: playwright.config.ts
    why: INSPECT ONLY — honors PLAYWRIGHT_BASE_URL, runs Chromium with fake-webcam.

  - path: src/test/setup.ts (or equivalent vitest setup)
    why: INSPECT ONLY — jsdom setup. The unit test will dynamically import tokens.css
         via `?inline` suffix OR probe document.fonts (FontFaceSet). Pick the simpler path.

urls:
  - url: https://github.com/JetBrains/JetBrainsMono/releases
    why: Canonical source for the woff2 files. Fetch the latest release (at time of
         writing: v2.304 or later). Use the `fonts/webfonts/*.woff2` subset-ready files.
    critical: License is SIL Open Font License 1.1. Copy LICENSE verbatim to public/fonts/.

  - url: https://google-webfonts-helper.herokuapp.com/fonts/jetbrains-mono
    why: Alternative source with pre-subset files and @font-face snippets if direct
         download is easier. NOTE: do NOT link to the CDN from our app — download locally.
    critical: Use `latin` + `latin-ext` subsets ONLY. Drop Vietnamese, Cyrillic, Greek
              for this MVP — they are not needed in UI copy.

  - url: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link/preload
    why: Preload link element syntax + crossorigin requirement for fonts.
    critical: `as="font"` is mandatory. Without it, the preload is discarded in Chromium.

  - url: https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face
    why: @font-face syntax, font-display values.
    critical: Use `font-display: swap` — renders fallback immediately, swaps in when
              the web font arrives. Acceptable FOUT window for our use case.

  - url: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
    why: `public, max-age=31536000, immutable` is the canonical long-cache header for
         versioned static assets. Vercel respects per-route headers from vercel.json.

  - url: https://web.dev/articles/reduce-webfont-size
    why: Subsetting strategy. Latin (0020-00FF) + a few punctuation ranges are enough
         for English UI.

  - url: https://everythingfonts.com/subsetter
    why: Web tool to subset a woff2 without installing glyphhanger. If using CLI,
         `pnpm dlx glyphhanger --subset='*.woff2' --LATIN` also works.
    critical: Do NOT commit uncompressed .ttf. Commit only .woff2 — ~30% smaller.

skills:
  - jetbrains-mono-self-hosting        # authored in parallel; read once it exists
  - vite-vercel-coop-coep              # CSP + cache headers + Vercel routing
  - prp-task-ralph-loop
  - playwright-e2e-webcam

discovery:
  - DR7: JetBrains Mono self-hosted; weights 400/500/600; subset to Latin + basic punctuation.
  - DR11: motion — unchanged by this task but DR-6.1 defined --ease-spring.
  - DR19: signature dev comment in index.html.
  - D31 (parent): Full CSP including font-src 'self'. Breaking this fails the phase.
  - D33 (parent): COOP same-origin + COEP require-corp. Fonts served same-origin — OK.
  - D43 (parent): preload strategy for critical assets.
```

### Current Codebase Tree

```
hand-tracker/
  index.html                   (14 LOC — no font preload, system-ui only)
  vercel.json                  (27 LOC — headers for /(.*) only)
  public/
    favicon.svg
    models/                    (hand_landmarker.task)
    wasm/                      (6 wasm files)
    sw.js                      (service worker from Task 5.1)
  src/
    ui/
      tokens.css               (created in DR-6.1 — awaits @font-face rules)
      tokens.ts                (created in DR-6.1)
```

### Desired Codebase Tree (changes in this task)

```
hand-tracker/
  index.html                   MODIFIED — <link rel="preload"> + DR19 signature comment
  vercel.json                  MODIFIED — add /fonts/(.*) long-cache entry
  public/
    fonts/                     NEW
      JetBrainsMono-Regular-subset.woff2     NEW (≤ 30 KB)
      JetBrainsMono-Medium-subset.woff2      NEW (≤ 30 KB)
      JetBrainsMono-SemiBold-subset.woff2    NEW (≤ 30 KB)
      LICENSE.txt                            NEW — OFL-1.1 verbatim
      README.md                              NEW — source repo + version + subset ranges
  src/
    ui/
      tokens.css               MODIFIED — three @font-face rules prepended
      fontLoading.test.ts      NEW — asserts @font-face rules registered
  tests/
    e2e/
      task-DR-6-2.spec.ts      NEW — asserts HTTP 200 + Cache-Control + computed fontFamily
```

### Known Gotchas

```typescript
// CRITICAL: <link rel="preload" as="font"> REQUIRES `crossorigin` attribute.
// Without it, Chromium fetches the file twice (once for preload, once for @font-face),
// defeating the preload entirely. Add `crossorigin` even though font-src 'self'
// is same-origin — the fetch API treats fonts as CORS requests regardless.

// CRITICAL: type="font/woff2" on the preload tag is MANDATORY for correct priority.
// Without it the browser downgrades the preload priority.

// CRITICAL: @font-face must declare `font-display: swap` (not `block` or `auto`)
// to avoid invisible-text FOUT on slow connections. `swap` renders fallback first,
// swaps in JetBrains Mono when arrived.

// CRITICAL: The Cache-Control header `immutable` directive is a contract — the file's
// content at this URL NEVER changes. If we ever update JetBrains Mono to a newer
// version, we MUST change the filename (e.g. add a version suffix) or bump the hash.
// For MVP, ship v2.304 subset and never touch again without renaming.

// CRITICAL: CSP font-src 'self' MUST remain unchanged. Do not add data:, blob:, or
// https://fonts.gstatic.com. Self-hosted means self-hosted.

// CRITICAL: COEP require-corp on the response. Vercel's default Cross-Origin-Embedder-Policy
// header from the global /(.*) entry in vercel.json applies to /fonts/* automatically
// (Vercel merges matching header entries). Verify by `curl -I` after deploy.

// CRITICAL: Biome v2 does not lint HTML. `pnpm biome check` will skip index.html.
// Use `pnpm tsc --noEmit` + `pnpm build` as the guardrails. Confirm the preload tag
// is syntactically correct by opening index.html in the browser (no parse errors).

// CRITICAL: Subsetting — use the Latin + Latin-Ext ranges only. Do NOT include the
// full Unicode plane. The goal is ≤ 30 KB per weight, which is only achievable
// with tight subsetting.

// CRITICAL: Do not add bash scripts to auto-download fonts into the repo at build time.
// Commit the .woff2 files directly. Run-time fetch of fonts from JetBrains servers
// violates CSP and is slow on first paint.

// CRITICAL: StrictMode is ON. Font loading should not cause re-renders or state changes
// in React components — @font-face is CSS-only, no JS lifecycle involvement.

// CRITICAL: pnpm only. Never `npm install -g glyphhanger`; use `pnpm dlx glyphhanger`
// OR pre-download already-subset files from JetBrains' webfonts/ directory.

// CRITICAL: Do NOT commit the font files with git-lfs. They are small binaries;
// standard git object storage is fine. git-lfs would add deployment friction with Vercel.
```

---

## Implementation Blueprint

### Implementation Tasks (ordered)

```yaml
Task 1: Download + subset the font files
  - IMPLEMENT (via pnpm dlx OR manual download):
      Option A (preferred — already-subset files from upstream):
        Fetch https://github.com/JetBrains/JetBrainsMono/releases/download/<latest>/JetBrainsMono-<version>.zip
        Extract fonts/webfonts/JetBrainsMono-Regular.woff2,
                fonts/webfonts/JetBrainsMono-Medium.woff2,
                fonts/webfonts/JetBrainsMono-SemiBold.woff2
      Option B (subset further if over 30 KB):
        pnpm dlx glyphhanger --subset=JetBrainsMono-Medium.woff2 --LATIN
      Place into public/fonts/ with "-subset" suffix:
        public/fonts/JetBrainsMono-Regular-subset.woff2
        public/fonts/JetBrainsMono-Medium-subset.woff2
        public/fonts/JetBrainsMono-SemiBold-subset.woff2
  - GOTCHA: If JetBrains' upstream woff2 is already < 30 KB per weight, skip glyphhanger.
            Verify: `ls -la public/fonts/*.woff2 | awk '{print $5}'` — all ≤ 30720 bytes.
  - VALIDATE: `ls -la public/fonts/*.woff2` prints 3 lines.
              `wc -c public/fonts/*.woff2` — each < 30000.

Task 2: CREATE public/fonts/LICENSE.txt
  - IMPLEMENT: Copy the full OFL-1.1 text from
      https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt
    Include the "Copyright 2020 The JetBrains Mono Project Authors" attribution line.
  - VALIDATE: `head -5 public/fonts/LICENSE.txt` contains "SIL OPEN FONT LICENSE Version 1.1"

Task 3: CREATE public/fonts/README.md
  - IMPLEMENT: Short README — 10–20 lines max. Template:
      # Fonts
      Self-hosted under CSP font-src 'self' per DR7 + D31.
      Source: https://github.com/JetBrains/JetBrainsMono v<VERSION>
      License: SIL OFL-1.1 (see LICENSE.txt)
      Subset: Latin + Latin-Ext (U+0020–U+024F) + General Punctuation (U+2000–U+206F)
      Weights shipped: 400 Regular, 500 Medium, 600 SemiBold
  - GOTCHA: DO NOT write a long explainer. This file is discoverable context, not docs.

Task 4: MODIFY src/ui/tokens.css
  - IMPLEMENT: PREPEND three @font-face blocks BEFORE the :root { ... } block:
      @font-face {
        font-family: 'JetBrains Mono';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: url('/fonts/JetBrainsMono-Regular-subset.woff2') format('woff2');
      }
      @font-face {
        font-family: 'JetBrains Mono';
        font-style: normal;
        font-weight: 500;
        font-display: swap;
        src: url('/fonts/JetBrainsMono-Medium-subset.woff2') format('woff2');
      }
      @font-face {
        font-family: 'JetBrains Mono';
        font-style: normal;
        font-weight: 600;
        font-display: swap;
        src: url('/fonts/JetBrainsMono-SemiBold-subset.woff2') format('woff2');
      }
  - GOTCHA: Do NOT include a `unicode-range` descriptor unless adding additional subsets.
            A single Latin+Ext subset covers our UI copy.
  - GOTCHA: Do NOT touch the existing :root { … } block. --font-family is already correct.
  - VALIDATE: `pnpm biome check src/ui/tokens.css` exits 0.
              `grep -c '@font-face' src/ui/tokens.css` returns 3.

Task 5: MODIFY index.html
  - IMPLEMENT: ADD inside <head>, AFTER <meta charset>, BEFORE existing <link rel="icon">:
      <!-- Hand Tracker FX — pixelcrash-inspired rework 2026-04-20 -->
      <link rel="preload" as="font" type="font/woff2" crossorigin
            href="/fonts/JetBrainsMono-Medium-subset.woff2">
  - GOTCHA: The DR19 signature comment goes HERE (single comment in the <head>).
  - GOTCHA: Only one preload — the Medium weight. Regular and SemiBold load on-demand
            via @font-face. Preloading all three wastes bandwidth on the first paint.
  - VALIDATE: `grep -c 'rel="preload"' index.html` returns 1.
              `grep -c 'pixelcrash-inspired' index.html` returns 1.

Task 6: MODIFY vercel.json
  - IMPLEMENT: APPEND a new object to the `headers` array:
      {
        "source": "/fonts/(.*)",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
        ]
      }
    Resulting `headers` array has 2 entries: the existing /(.*) block (unchanged) + the new /fonts/(.*) block.
  - GOTCHA: Vercel applies ALL matching source entries. /fonts/foo.woff2 matches BOTH
            entries — receives COOP/COEP/CSP (from /(.*)) AND Cache-Control (from /fonts/(.*)).
            This is the intended behavior.
  - GOTCHA: Do NOT put Cache-Control on the first entry — that would apply to index.html
            and break preview-URL cache busting.
  - VALIDATE: `pnpm dlx jq '.headers | length' vercel.json` returns 2.
              `pnpm dlx jq '.headers[1].source' vercel.json` returns "/fonts/(.*)"

Task 7: CREATE src/ui/fontLoading.test.ts
  - IMPLEMENT: Vitest + jsdom. Dynamically import the tokens.css file (Vite '?inline' suffix):
      import tokensCss from './tokens.css?inline'
      describe('tokens.css @font-face', () => {
        it('declares three JetBrains Mono weights', () => {
          const fontFaces = tokensCss.match(/@font-face/g) ?? []
          expect(fontFaces).toHaveLength(3)
          expect(tokensCss).toContain("font-weight: 400")
          expect(tokensCss).toContain("font-weight: 500")
          expect(tokensCss).toContain("font-weight: 600")
          expect(tokensCss).toContain("font-display: swap")
          expect(tokensCss).toContain("/fonts/JetBrainsMono-Medium-subset.woff2")
        })
      })
  - MIRROR: src/engine/__tests__/*.test.ts for vitest + jsdom shape.
            Use ?inline import per Vite docs: https://vitejs.dev/guide/features.html#css
  - GOTCHA: jsdom does NOT implement document.fonts robustly — prefer a text-search
            on the CSS source. This is an L2 unit test, not an integration test.
  - VALIDATE: `pnpm vitest run src/ui/fontLoading.test.ts` exits 0.

Task 8: CREATE tests/e2e/task-DR-6-2.spec.ts
  - IMPLEMENT: Playwright spec with describe block
      `Task DR-6.2: JetBrains Mono loads + body renders in mono`
    Inside describe, two tests:

    TEST 1 — asset fetch + cache header:
      test('serves /fonts/JetBrainsMono-Medium-subset.woff2 with immutable cache', async ({ page, request }) => {
        await page.goto('/')
        const r = await request.get('/fonts/JetBrainsMono-Medium-subset.woff2')
        expect(r.status()).toBe(200)
        const cc = r.headers()['cache-control'] ?? ''
        expect(cc).toContain('max-age=31536000')
        expect(cc).toContain('immutable')
        const contentType = r.headers()['content-type'] ?? ''
        expect(contentType).toMatch(/font\/woff2|application\/font-woff2|application\/octet-stream/)
      })

    TEST 2 — computed font-family includes JetBrains Mono:
      test('body computed font-family includes JetBrains Mono after load', async ({ page }) => {
        await page.goto('/')
        // Wait for the font to actually load in the page
        await page.evaluate(async () => {
          await document.fonts.ready
        })
        const fontFamily = await page.evaluate(() =>
          getComputedStyle(document.body).fontFamily
        )
        expect(fontFamily).toContain('JetBrains Mono')
      })

  - MIRROR: tests/e2e/task-5-1.spec.ts for request.get() + headers pattern.
  - GOTCHA: page.request uses the page's baseURL from playwright.config. Works both
            against pnpm preview locally and against PLAYWRIGHT_BASE_URL for CI.
  - GOTCHA: Playwright's fake-webcam Chromium flag does not affect font loading.
            The PrePromptCard renders before camera is granted — font is already needed.
  - VALIDATE: `pnpm test:e2e --grep "Task DR-6.2:"` exits 0.
```

### Integration Points

```yaml
Cascade:
  - src/index.css → @import './ui/tokens.css'  (from DR-6.1)
  - tokens.css → @font-face × 3 + :root { --font-family, --font-size-*, ... }
  - HTML <link rel="preload"> → hints browser to fetch Medium weight early

Vercel routing:
  - /(.*) → COOP same-origin, COEP require-corp, CSP font-src 'self', ... (global)
  - /fonts/(.*) → Cache-Control: public, max-age=31536000, immutable (additive)
  - /fonts/JetBrainsMono-Medium-subset.woff2 inherits both → same-origin + isolated + cacheable

Service worker (Task 5.1):
  - Currently caches /models/* and /wasm/*. This task does NOT extend SW to /fonts/*.
    Fonts cache via HTTP Cache-Control alone — simpler and sufficient for v1.
    (DR-6.R regression may optionally propose SW extension; out of scope here.)

No changes to:
  - vite.config.ts (public/ static copying is default Vite behavior)
  - biome.json, tsconfig.json, playwright.config.ts
  - Any engine / effect / tracking / camera file
```

---

## Validation Loop

```bash
# Level 1 — Syntax & Style
pnpm biome check src/ui/tokens.css src/ui/fontLoading.test.ts tests/e2e/task-DR-6-2.spec.ts
pnpm tsc --noEmit

# Level 2 — Unit
pnpm vitest run src/ui/fontLoading.test.ts

# Level 3 — Integration (build — confirms public/fonts/ is copied into dist/)
pnpm build
ls -la dist/fonts/*.woff2           # expect 3 files
wc -c dist/fonts/*.woff2            # each < 30000

# Level 4 — E2E
pnpm test:e2e --grep "Task DR-6.2:"

# Regression (prior phases)
pnpm test:e2e --grep "Task 4\."
pnpm test:e2e --grep "Task DR-6.1:"
```

### Local preview verification (manual smoke)

```bash
pnpm build && pnpm preview &
sleep 2
curl -sI http://localhost:4173/fonts/JetBrainsMono-Medium-subset.woff2 \
  | grep -iE 'cache-control|content-type|cross-origin'
# Expect:
#   cache-control: public, max-age=31536000, immutable
#   content-type: font/woff2
#   cross-origin-embedder-policy: require-corp
#   cross-origin-opener-policy: same-origin
```

---

## Final Validation Checklist

### Technical

- [ ] `pnpm biome check src/` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `pnpm vitest run` — whole suite green (includes fontLoading.test.ts)
- [ ] `pnpm build` exits 0; `dist/fonts/` contains all three .woff2 files
- [ ] `pnpm test:e2e --grep "Task DR-6.2:"` exits 0
- [ ] `pnpm test:e2e --grep "Task DR-6.1:"` still exits 0 (tokens regression)
- [ ] `pnpm test:e2e --grep "Task 4\."` still exits 0 (Phase-4 regression)
- [ ] Local preview curl on /fonts/* returns Cache-Control + COEP + COOP

### Feature

- [ ] DevTools → Network → filter "font" → navigating to / shows JetBrainsMono-Medium-subset.woff2 fetched with priority "High" (preload works)
- [ ] DevTools → Network response headers show Cache-Control: public, max-age=31536000, immutable
- [ ] PrePromptCard title renders in JetBrains Mono (visually distinct from system-ui — monospace with narrow rectangular glyphs)
- [ ] No CSP violations in console
- [ ] `crossOriginIsolated === true` in console (unchanged by font fetch)

### Code Quality

- [ ] No hex colors added (this task only adds font files + @font-face — no color work)
- [ ] LICENSE.txt copied verbatim (no redaction of OFL-1.1 clauses)
- [ ] README.md in public/fonts/ is short and factual (no marketing copy)
- [ ] `index.html` <head> ordering: meta charset → DR19 comment → preload link → favicon link → viewport meta → title → meta description
- [ ] vercel.json `headers` array has exactly 2 entries (no duplication of global headers on the /fonts/ route)

---

## Anti-Patterns

- Do NOT link to `https://fonts.googleapis.com` or `https://fonts.gstatic.com`. CSP blocks them AND they break COEP.
- Do NOT add `'unsafe-inline'` to CSP's `font-src`. Self-hosted fonts do not need it.
- Do NOT preload all three weights. Medium only — Regular and SemiBold lazy-load on first use.
- Do NOT use `font-display: block` or `font-display: auto`. Always `swap`.
- Do NOT add a bash script or Vite plugin that fetches fonts at build time from the internet. Commit the .woff2 files as static assets.
- Do NOT commit .ttf or .otf alongside the .woff2. woff2 only.
- Do NOT add font-variable (wght 100..800 axis) file. Three static weights are smaller and sufficient.
- Do NOT touch the /(.*) Vercel header block — it is load-bearing for security.
- Do NOT use git-lfs.
- Do NOT skip L1 after index.html edit — rerun `pnpm tsc --noEmit` + `pnpm build` to catch Vite HTML-plugin errors.
- Do NOT emit `<promise>COMPLETE</promise>` if any L1/L2/L3/L4 is still red.

Universal anti-patterns apply (`.claude/skills/prp-task-ralph-loop/SKILL.md` §6).

---

## No Prior Knowledge Test

- [ ] DR7 specifies JetBrains Mono 400 / 500 / 600 weights.
- [ ] DR19 specifies the exact source-code comment wording.
- [ ] Parent D31 documents the CSP `font-src 'self'` clause.
- [ ] `src/ui/tokens.css` exists (created in DR-6.1) and is imported by `src/index.css`.
- [ ] `vercel.json` currently has a single entry in `headers` matching `/(.*)`.
- [ ] `index.html` has no preload tag at the start of this task.
- [ ] `public/fonts/` does not yet exist.
- [ ] `tests/e2e/task-5-1.spec.ts` exists — mirror for request + header assertion.
- [ ] JetBrains Mono v2.304 (or later) webfont .woff2 files are available from the GitHub release.

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/vite-vercel-coop-coep/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
.claude/skills/jetbrains-mono-self-hosting/SKILL.md
```

> Note: `jetbrains-mono-self-hosting` may not exist yet (authored in parallel). If missing at iteration 1, note in the Ralph state file and continue — this task file fully specifies the font URLs, subsets, @font-face declarations, preload pattern, and cache headers.

---

## Research Files to Read

```
.claude/orchestration-design-rework/research/pixelcrash-design-language.md
.claude/orchestration-design-rework/research/current-ui-audit.md
```

## Git

- Branch: `task/DR-6-2-self-host-jetbrains-mono` (from `main`)
- Commit prefix: `Task DR-6.2:`
- Trailer: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
- Merge: fast-forward to `main` after all 4 validation levels exit 0.
- Font binaries: commit normally (no git-lfs). Total added size ≤ 90 KB — trivial for git.
