---
name: jetbrains-mono-self-hosting
description: Use when self-hosting, subsetting, or wiring up JetBrains Mono (or future custom fonts) in Hand Tracker FX. Preserves COOP/COEP/CSP discipline, sets up @font-face and preload, and documents the OFL-1.1 licensing obligations.
---

# JetBrains Mono — self-hosting procedure for Hand Tracker FX

Reference for the single external type dependency in the design rework. Touch this before editing `public/fonts/`, `src/index.css` (or `tokens.css`), `index.html` `<link rel="preload">` tags, or `vercel.json` cache headers.

Upstream authority: DISCOVERY DR7 (font choice, weights, self-host). Inherits COOP/COEP/CSP invariants from parent DISCOVERY D31/D32 via the `vite-vercel-coop-coep` skill.

**Read before**: Task DR-6.2 (font wiring).

---

## 1. Licensing (SIL Open Font License 1.1)

JetBrains Mono ships under **SIL OFL-1.1**. What this means for us:

- **Allowed**: self-host, embed in our web app, serve to end users, ship as part of a commercial product, modify/subset the font for our own use.
- **Forbidden**: sell the font file on its own (it must be bundled with software or a work product — a web app counts).
- **Required**: ship the license text alongside the font files, and preserve the copyright notices.
- **Name protection**: if we ever *modify* the font (beyond subsetting glyphs) we must rename it — the "JetBrains Mono" name is a Reserved Font Name. A pure subset is not a modification in the OFL sense, so we keep the name.

**Compliance artifact**: commit `public/fonts/LICENSE.txt` with the full OFL-1.1 text + JetBrains's copyright line. Copy it verbatim from the upstream repo:

```bash
curl -L -o public/fonts/LICENSE.txt \
  https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/OFL.txt
```

Do NOT rename the file to `LICENSE-JetBrainsMono.txt`; the upstream convention is `OFL.txt` but we standardise on `LICENSE.txt` inside `public/fonts/` so the Vercel deploy ships it publicly at `/fonts/LICENSE.txt` and anyone auditing attribution can find it at a predictable URL.

---

## 2. Source files — which weights, where to get them

Per DR7 we ship exactly three weights (static, not variable):

| Weight | Role | File we want (from upstream zip) |
|---|---|---|
| 400 Regular | Fallback + italic body fallback | `JetBrainsMono-Regular.ttf` |
| 500 Medium  | **Default UI weight** | `JetBrainsMono-Medium.ttf` |
| 600 SemiBold | Wordmark, LAYER titles, segmented selected state | `JetBrainsMono-SemiBold.ttf` |

We do NOT ship the italic weights, the variable font, the NL ("no ligatures") variant, or any of the other ~15 weights. DR7 is explicit: three weights only, no ligatures needed.

### Download

The latest stable release at time of writing is **v2.304**. Always pin a version — do not pull from `master`. Use the release tag URL:

```bash
# Pin this version in the task commit message + PROGRESS.md
JB_MONO_VERSION=2.304

curl -L -o /tmp/jbmono.zip \
  "https://github.com/JetBrains/JetBrainsMono/releases/download/v${JB_MONO_VERSION}/JetBrainsMono-${JB_MONO_VERSION}.zip"

mkdir -p /tmp/jbmono-src
unzip -j /tmp/jbmono.zip \
  "fonts/ttf/JetBrainsMono-Regular.ttf" \
  "fonts/ttf/JetBrainsMono-Medium.ttf" \
  "fonts/ttf/JetBrainsMono-SemiBold.ttf" \
  -d /tmp/jbmono-src/
```

Take the TTF, not the WOFF2 — we are going to subset + re-encode to woff2 ourselves. The upstream woff2 files are not subset and would blow our performance budget.

---

## 3. Subsetting with `pyftsubset`

We use **fonttools `pyftsubset`** (part of the `fonttools` package). Install via pipx so it doesn't pollute the system Python:

```bash
# One-time
pipx install 'fonttools[woff]'
# The [woff] extra pulls in brotli, which pyftsubset needs to emit woff2.
```

Verify: `pyftsubset --help | head -5` should print the CLI banner.

### Unicode ranges we include

Minimal coverage for an English-language dev UI (DR7: "Latin + basic Unicode punctuation, no ligatures"):

| Block | Range | Why |
|---|---|---|
| Basic Latin | `U+0020-007E` | ASCII — letters, digits, common punctuation |
| Latin-1 Supplement | `U+00A0-00FF` | © ® ° ± × ÷ é ñ etc. for copy text |
| Latin Extended-A | `U+0100-017F` | European diacritics (cheap; keep for future i18n) |
| General Punctuation | `U+2000-206F` | en/em dash, curly quotes, ellipsis |
| Currency Symbols | `U+20A0-20CF` | € £ ¥ etc. (tiny, worth keeping) |
| Arrows (partial) | `U+2190-2199` | ← → ↑ ↓ used in preset cycler + docs |
| Geometric Shapes (partial) | `U+25A0-25FF` | ■ ● ▶ used in toggle/record UI |

### The subset command (one per weight)

Run this for each of Regular / Medium / SemiBold:

```bash
mkdir -p public/fonts

for W in Regular Medium SemiBold; do
  pyftsubset "/tmp/jbmono-src/JetBrainsMono-${W}.ttf" \
    --output-file="public/fonts/JetBrainsMono-${W}-subset.woff2" \
    --flavor=woff2 \
    --unicodes="U+0020-007E,U+00A0-00FF,U+0100-017F,U+2000-206F,U+20A0-20CF,U+2190-2199,U+25A0-25FF" \
    --layout-features-=liga,dlig,clig,calt \
    --no-hinting \
    --desubroutinize \
    --drop-tables+=DSIG \
    --recommended-glyphs
done
```

Flag-by-flag rationale:

| Flag | Why |
|---|---|
| `--flavor=woff2` | Web-delivery format; ~30% smaller than woff and ~50% smaller than ttf |
| `--unicodes=...` | Keep only the ranges above |
| `--layout-features-=liga,dlig,clig,calt` | **Strip ligatures.** DR7 says we don't use ligatures; JetBrains Mono's signature `->` / `!=` / `==` ligatures would add ~3 KB per weight and subtly break monospaced alignment in our dense UI |
| `--no-hinting` | TrueType hinting tables are ~2 KB dead weight at modern DPIs; browsers ignore them on high-DPI displays anyway |
| `--desubroutinize` | Recompiles CFF charstrings without shared subroutines — simpler for woff2's Brotli entropy coder to compress |
| `--drop-tables+=DSIG` | Digital signature table is useless post-subset and bloats the output |
| `--recommended-glyphs` | Keeps `.notdef`, `.null`, CR required by the spec — omitting these breaks some browsers |

### Expected output sizes

Target: **≤ 30 KB per weight** (woff2). Typical result with the ranges above is 22–28 KB per weight. If a weight comes in >32 KB, check that `--layout-features-=liga` took effect (`pyftsubset` is quirky about the `+=` / `-=` syntax — the trailing `-=` is correct, it *removes* features).

Fail-fast check:

```bash
ls -l public/fonts/JetBrainsMono-*-subset.woff2
# All three files should be 20k–32k.
```

---

## 4. File layout

After subsetting + license copy:

```
public/
  fonts/
    JetBrainsMono-Regular-subset.woff2    # ~24 KB, weight 400
    JetBrainsMono-Medium-subset.woff2     # ~25 KB, weight 500  (preloaded)
    JetBrainsMono-SemiBold-subset.woff2   # ~25 KB, weight 600
    LICENSE.txt                           # OFL-1.1 + JetBrains copyright
```

Total on-the-wire: ~75 KB. Commit all four files. No Git LFS needed. No `.gitattributes` entry.

**Do not** commit the intermediate `.ttf` files or the upstream zip. `/tmp/jbmono-src/` is scratch space.

---

## 5. `@font-face` declarations in `tokens.css`

Per DR7 the declarations live in the tokens CSS file (the design rework's single source of design truth), not in `index.css`. Add this block at the top of `src/ui/tokens.css` (ahead of any `:root { ... }` custom-property block):

```css
@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/JetBrainsMono-Regular-subset.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/JetBrainsMono-Medium-subset.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/JetBrainsMono-SemiBold-subset.woff2') format('woff2');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
```

Then set the family on `body` (or the app root):

```css
:root {
  --font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

body {
  font-family: var(--font-family);
  font-weight: 500;
  letter-spacing: -0.01em;
  font-size: clamp(13px, 0.9vw, 16px);
}
```

Notes:

- **All three declarations use the same `font-family: 'JetBrains Mono'`** — the `font-weight` descriptor is what tells the browser which file to pick for `font-weight: 400/500/600` in use sites. This is the standard way to register a family with multiple weight files.
- **`font-display: swap`** — DR7 requires slow-connection safety. Swap paints system fallback immediately, then swaps to JetBrains Mono when loaded. The alternative `optional` would *never* show the web font on a slow first load, hurting brand identity.
- **Fallback stack** — `ui-monospace` covers modern macOS/iOS, `SFMono-Regular` / `Menlo` / `Consolas` give us the closest visual match on older browsers so layout doesn't shift dramatically during the swap.

---

## 6. Preload in `index.html` (crossorigin required)

Only preload the **500 weight** — that is what `body` uses. Preloading 400 and 600 wastes bandwidth for text that may never render. The browser will fetch 400/600 lazily on first use.

Add inside `<head>`, **before** the `<link rel="stylesheet">` that loads the CSS bundle:

```html
<link
  rel="preload"
  as="font"
  type="font/woff2"
  crossorigin
  href="/fonts/JetBrainsMono-Medium-subset.woff2"
/>
```

### Why `crossorigin` is required under COEP `require-corp`

The attribute looks paradoxical on a same-origin URL, but both specs demand it:

1. **Font preload spec**: fonts are *always* fetched in CORS mode by the browser's layout/text engine, regardless of origin. A `<link rel="preload" as="font">` without `crossorigin` uses "no-cors" mode — the resulting response is unusable by the font engine, so the browser re-fetches the file when it's actually needed, defeating the preload.
2. **COEP `require-corp`**: any resource that isn't CORS-attributed must carry a `Cross-Origin-Resource-Policy: cross-origin` header to be embeddable. Our Vercel/Vite setup does *not* emit CORP on font files (we don't need to, since everything is same-origin), so the browser would reject a no-cors preload.

Bottom line: `crossorigin` on preload+font is mandatory in this project. Omitting it triggers a silent double-fetch (the preload warning appears in DevTools as "The resource was preloaded using link preload but not used within a few seconds from the window's load event").

---

## 7. CSP impact — verify, don't change

Our CSP already permits same-origin fonts:

```
font-src 'self'
```

That directive, combined with `default-src 'self'`, is sufficient for every font URL under `/fonts/*`. **No CSP changes are required** for this task. Double-check that `font-src 'self'` is still present in both `vercel.json` and `vite.config.ts` — if someone accidentally dropped the directive, fonts will load fine in dev (Vite's server ignores CSP) and silently 404-at-parse in production.

Quick grep after the task:

```bash
grep "font-src 'self'" vercel.json vite.config.ts
# Both files must match.
```

See `vite-vercel-coop-coep` skill for the full CSP table.

---

## 8. Cache headers — Vercel config

Font files never change once committed (we re-generate and re-commit if we update the subset). They deserve aggressive caching with the content-hash-free filename strategy we already use:

Add a **second entry** to `vercel.json`'s `headers[]` array (not a replacement for the global `/(.*)`, an addition). Vercel applies ALL matching rules additively — so a font under `/fonts/*` inherits COOP/COEP/CSP from the catch-all entry AND picks up `Cache-Control` + `Content-Type` from the `/fonts/*` entry. The fonts entry only needs to declare the values it overrides/adds:

```json
{
  "headers": [
    {
      "source": "/fonts/(.*\\.woff2)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" },
        { "key": "Content-Type", "value": "font/woff2" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" },
        { "key": "Permissions-Policy", "value": "camera=(self)" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

Notes:

- `max-age=31536000` = 1 year. `immutable` tells browsers never to revalidate during the cache lifetime, which saves an If-None-Match round-trip per font on every repeat visit.
- Vercel applies ALL matching rules additively — a file under `/fonts/*` inherits COOP/COEP/CSP from the catch-all entry AND picks up `Cache-Control` from the `/fonts/*` entry. We do NOT repeat COOP/COEP in the fonts block; the global entry covers it.
- We explicitly set `Content-Type: font/woff2` so the response doesn't rely on Vercel's MIME-type guess.
- The `\\.woff2` pattern is escaped for JSON. In the raw regex that's `\.woff2`.
- `LICENSE.txt` is served by the catch-all and keeps standard headers; no special-casing needed.

---

## 9. Verification

### Build-time

```bash
pnpm build
ls -l dist/fonts/
# Should show all three .woff2 files + LICENSE.txt, sizes matching public/fonts/.
```

### Runtime (pnpm preview, then curl)

```bash
pnpm preview &
sleep 2

# Headers check
curl -sI http://localhost:4173/fonts/JetBrainsMono-Medium-subset.woff2 \
  | grep -iE 'content-type|cache-control|cross-origin'

# Expected:
#   content-type: font/woff2
#   cache-control: public, max-age=31536000, immutable
#   cross-origin-opener-policy: same-origin
#   cross-origin-embedder-policy: require-corp
```

### Runtime (browser DevTools, Playwright, or a throwaway `page.evaluate`)

```ts
// In a Playwright test or DevTools console:
const loaded = await document.fonts.ready;
const has500 = [...loaded].some(
  (f) => f.family === 'JetBrains Mono' && f.weight === '500' && f.status === 'loaded'
);
// has500 === true

const computed = getComputedStyle(document.body).fontFamily;
// computed.includes("JetBrains Mono") === true
```

Also check the Network tab: `JetBrainsMono-Medium-subset.woff2` should have `transferSize > 0` on the first load, `transferSize === 0` (from disk cache) on subsequent loads.

---

## 10. Common pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| Forgetting `crossorigin` on `<link rel="preload">` | DevTools warning "preloaded but not used"; font double-fetches under COEP | Add `crossorigin` (no value needed — it's `anonymous` by default, which is what we want) |
| Subsetting too aggressively (missing ranges) | Em dashes show as boxes; curly quotes render as `.notdef` | Re-run `pyftsubset` with the full range list in §3. Start generous, tighten only if size budget bites |
| Leaving ligatures in the subset | File is 3+ KB larger than expected; `==` / `!=` render as joined glyphs in UI labels, breaking character alignment | Re-run with `--layout-features-=liga,dlig,clig,calt` — verify the file shrank |
| Missing `font-display: swap` | Slow networks: blank text for up to 3s (default `font-display: auto`) | Add `font-display: swap` to every `@font-face`. DR7 requires this |
| Committing raw `.ttf` files or the upstream zip | Repo bloat (~3 MB per ttf); potential OFL "Reserved Font Name" confusion if the unmodified files ship alongside subsets | Only commit the three subset woff2s + LICENSE.txt |
| Omitting `LICENSE.txt` | OFL violation — we are redistributing the font without the required license | Always commit `public/fonts/LICENSE.txt` in the same PR as the font files |
| Forgetting to preload only one weight | Preloading all three wastes ~50 KB on every cold load | Preload **only** the 500 weight; 400/600 are used sparingly and can fetch lazily |
| Preload `<link>` after the stylesheet | The stylesheet triggers font fetch first; preload becomes redundant | Place preload tag **before** the main CSS `<link>` in `<head>` |
| Skipping the Vercel fonts-specific header entry | Fonts ship with default caching (no `immutable`, 1h max-age); repeat-visit performance regresses | Add the `/fonts/(.*\\.woff2)` entry per §8 |
| Catching up on upstream JetBrains Mono updates without re-subsetting | The woff2 in `public/fonts/` drifts from the latest OFL.txt copyright year | Re-run the download + subset pipeline; re-commit both woff2 and LICENSE.txt in the same commit |

---

## 11. Testing strategy

Unit test (Vitest): not meaningful — `@font-face` is a rendering concern, not a logic concern. Skip.

**Playwright E2E** (Level 4) spec, to live at `tests/e2e/fonts.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test.describe('Task DR-6.2: JetBrains Mono self-hosting', () => {
  test('font file is served with correct headers', async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/fonts/JetBrainsMono-Medium-subset.woff2`);
    expect(res.status()).toBe(200);

    const headers = res.headers();
    expect(headers['content-type']).toBe('font/woff2');
    expect(headers['cache-control']).toMatch(/immutable/);
    expect(headers['cache-control']).toMatch(/max-age=31536000/);
    expect(headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(headers['cross-origin-embedder-policy']).toBe('require-corp');

    const body = await res.body();
    expect(body.byteLength).toBeGreaterThan(10_000); // sanity: not an HTML 404
    expect(body.byteLength).toBeLessThan(40_000);    // sanity: subset really happened
  });

  test('body computed font-family resolves to JetBrains Mono', async ({ page, baseURL }) => {
    await page.goto(baseURL!);
    await page.evaluate(() => document.fonts.ready);

    const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(family).toContain('JetBrains Mono');

    const loadedMedium = await page.evaluate(() =>
      [...document.fonts].some(
        (f) => f.family.includes('JetBrains Mono') && f.weight === '500' && f.status === 'loaded',
      ),
    );
    expect(loadedMedium).toBe(true);
  });

  test('license is served publicly for OFL compliance', async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/fonts/LICENSE.txt`);
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/SIL OPEN FONT LICENSE/i);
    expect(text).toMatch(/JetBrains/);
  });
});
```

The describe block prefix `Task DR-6.2:` lets the Ralph loop's `pnpm test:e2e --grep "Task DR-6.2:"` target exactly these three tests.

---

## 12. References

- `.claude/orchestration-design-rework/DISCOVERY.md` — **DR7** (font choice, weights, self-host, subsetting, preload, fluid font-size)
- `.claude/skills/vite-vercel-coop-coep/SKILL.md` — security-header discipline (COOP/COEP/CSP); the companion skill this one depends on
- [JetBrains Mono landing page](https://www.jetbrains.com/lp/mono/) — marketing, specimen, license link
- [JetBrains Mono GitHub releases](https://github.com/JetBrains/JetBrainsMono/releases) — pinned version downloads
- [SIL Open Font License 1.1](https://scripts.sil.org/OFL) — full license text (same as `OFL.txt` in the upstream repo)
- [fonttools pyftsubset docs](https://fonttools.readthedocs.io/en/latest/subset/) — subsetter CLI reference
- `vercel.json`, `vite.config.ts` — current live security-header configuration
