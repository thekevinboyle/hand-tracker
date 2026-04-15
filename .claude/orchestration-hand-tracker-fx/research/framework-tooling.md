# Frontend Framework + Build Tooling - Research

**Wave**: First
**Researcher**: Web research specialist subagent
**Date**: 2026-04-14
**Status**: Complete

---

## Summary

For a browser-only, single-page creative app with a full-screen canvas and side parameters panel, **React 19 + Vite 8 + TypeScript 5.7** is the recommended stack. It matches the user's existing project patterns, has the widest ecosystem for webcam/canvas/MediaPipe integrations, and offers the best balance of reactivity ergonomics (hooks fit the animation-loop + parameters model well), tooling maturity, and static deployment simplicity. **Biome v2** replaces ESLint+Prettier in a single tool with zero friction on a new project. **pnpm** is the package manager sweet spot: 75% smaller disk footprint than npm with full compatibility and no Bun runtime risk. **Cloudflare Pages** wins for purely static SPA deployment with unlimited bandwidth on the free tier.

---

## Key Findings

### 1. Frontend Framework Comparison

**React 19 + Vite**

React remains the dominant choice in 2026, with TypeScript adoption in React projects at 78% (State of JS 2025). React 19 stable ships with the same hooks API plus new `use()` and compiler optimizations. For a canvas-heavy creative app, React's model works well: component tree manages UI (parameters panel, overlays), and canvas rendering lives entirely outside the React reconciler in a `useRef`/`useEffect` animation loop — React does not touch the canvas pixels at all, so VDOM overhead is irrelevant to render performance.

Key facts:
- Bundle size (gzipped): ~42 kB runtime, but irrelevant when the app also loads a ~25 MB MediaPipe WASM model
- Largest ecosystem: webcam hooks, MediaPipe React wrappers, canvas utility libraries all have React examples or first-class support
- `useRef` + `useEffect` + `requestAnimationFrame` is the settled pattern for canvas loops in React, stable across React 18 and 19
- Vite 8 scaffold: `npm create vite@latest hand-tracker-fx -- --template react-ts`

**SvelteKit**

Svelte 5 compiles components to minimal DOM-manipulating JS with no VDOM. Bundle is tiny (~1.6 kB runtime). Svelte's reactivity (`$state`, `$derived`) is more ergonomic than `useState` for deeply reactive parameter panels. However:
- SvelteKit adds a full meta-framework (routing, SSR) that is unnecessary for a single-page no-backend app — you would use the bare `svelte` + Vite template instead, not SvelteKit proper
- Ecosystem for MediaPipe, hand tracking, and canvas libraries is React-first; Svelte ports exist but are thinner
- Smaller community means fewer creative-coding patterns to reference
- DX rating for solo devs: 9/10 (solodevstack.com, 2026), but ecosystem gap for this specific domain is a real cost

**SolidJS**

Fine-grained reactivity (signals), no VDOM, top-tier benchmark scores. Performance advantage over React is real but "negligible for 95% of applications" (solodevstack.com, 2026). The critical issue: SolidJS components do not re-run (unlike React), and destructuring props breaks reactivity — learning curve trips up developers coming from React. For a solo project where the rendering hot path is a canvas `requestAnimationFrame` loop (not reactive DOM reconciliation), SolidJS's advantage does not materialize. Not recommended.

**Vanilla TypeScript + Vite**

Zero framework overhead. All state management is manual. Well-suited for pure canvas/WebGL engines. The downside is that the parameters panel (sliders, dropdowns, real-time feedback) requires either rolling custom reactivity or importing a small reactive library anyway. For a project that is 50% UI (parameters panel) and 50% canvas engine, vanilla TS means building the UI reactive layer from scratch. Not worth it unless you are explicitly avoiding any framework dependency.

**Verdict**: React 19 + Vite is the correct choice for this project given the mixed UI + canvas nature of the app, the user's existing project patterns (PRD explicitly cites React + Vite as the likely choice), and ecosystem alignment with MediaPipe and creative-coding libraries.

---

### 2. TypeScript Configuration Best Practices

**Recommended `tsconfig.json` for Vite + React SPA (2026)**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@engine/*": ["src/engine/*"],
      "@effects/*": ["src/effects/*"],
      "@hooks/*": ["src/hooks/*"],
      "@types/*": ["src/types/*"],
      "@utils/*": ["src/utils/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Key decisions:
- `"strict": true` — enables `strictNullChecks`, `strictFunctionTypes`, `noImplicitAny`, etc. Start strict; retrofitting later is painful (confirmed by multiple 2026 sources)
- `"moduleResolution": "bundler"` — the correct setting for Vite 6+ projects (not `node16` or `nodenext`, which are for Node runtime output)
- `"noEmit": true` — Vite uses esbuild for transpilation, TypeScript is type-checking only
- Path aliases in `tsconfig.json` need a corresponding entry in `vite.config.ts` (or use the `vite-tsconfig-paths` plugin to DRY this up)

**Path alias wiring in `vite.config.ts`**

Option A — manual (explicit, no extra dep):
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@engine': path.resolve(__dirname, './src/engine'),
      '@effects': path.resolve(__dirname, './src/effects'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
})
```

Option B — `vite-tsconfig-paths` plugin (DRY, reads from tsconfig automatically):
```bash
pnpm add -D vite-tsconfig-paths
```
```typescript
import tsconfigPaths from 'vite-tsconfig-paths'
export default defineConfig({ plugins: [react(), tsconfigPaths()] })
```

Recommended: Option B for a new project — single source of truth in tsconfig, Vite plugin v6 supports lazy discovery and automatic reloads. Requires `npm install -D @types/node` only when using Option A with `__dirname`.

---

### 3. Package Manager: npm vs pnpm vs Bun (2026)

**Versions as of early 2026:**
- npm 11.7.0
- pnpm 10.27.0
- Bun 1.3.0

**Install speed benchmarks (50-dependency project, cold install):**

| Manager | Cold Install | Disk Usage (200-dep project) |
|---------|-------------|------------------------------|
| Bun 1.3 | 0.8s | 461 MB |
| pnpm 10 | 4.2s | 124 MB (-75% vs npm) |
| npm 11  | 14.3s | 487 MB |

**Recommendation: pnpm 10**

Rationale:
- 75% disk space savings over npm matters when iterating with multiple `node_modules` installs during development
- 3.4x faster than npm on cold install, 1.5x faster on warm
- Lockfile (`pnpm-lock.yaml`) is human-readable YAML — better for diffing in git than npm's JSON lockfile
- Full compatibility with all npm packages and all the relevant libraries (MediaPipe, React, Vite)
- More conservative compatibility than Bun — Bun 1.3 is fast but its binary lockfile (`bun.lockb`) is not human-readable, and Bun-as-runtime carries compatibility risks for some packages (not relevant here since we use Node+Vite, but pnpm is safer for a standard Vite build pipeline)
- 2026 consensus: "pnpm offers the best balance of speed, disk efficiency, and compatibility" for existing/solo projects

Bun is the right pick only if you are adopting the full Bun runtime. For a Vite project that runs in Node, pnpm is the sweet spot.

---

### 4. Testing: Vitest + Playwright + @testing-library

**Recommended testing stack (2026 consensus):**

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit / component | Vitest 3 + @testing-library/react | Fast, Vite-native, no config |
| Canvas mocking | vitest-canvas-mock | Polyfills HTMLCanvasElement in JSDOM |
| E2E / browser | Playwright | Real browser, webcam permission flows |

**Vitest 3 configuration (`vitest.config.ts` or via `vite.config.ts`):**

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
```

**`src/test/setup.ts`:**
```typescript
import 'vitest-canvas-mock'
```

Key facts:
- Vitest 3 cold start is ~6x faster than Jest due to native ESM support
- Vitest became the default for Vite projects in 2025; Jest is legacy for new projects
- Canvas/WebGL tests in JSDOM require `vitest-canvas-mock` (a port of `jest-canvas-mock` for Vitest)
- For real rendering verification (does the mosaic effect actually draw pixels), use Playwright with `page.screenshot()` and visual comparison — JSDOM cannot run WebGL or real canvas rendering
- In 2026 many teams skip heavy JSDOM integration tests for canvas apps and go directly to Playwright component/visual tests

**Playwright** covers:
- Webcam permission grant flow (mock `getUserMedia`)
- Parameters panel interactions and live update verification
- Visual regression against reference screenshots

---

### 5. Linting and Formatting: Biome vs ESLint+Prettier

**Recommendation: Biome v2 (sole tool)**

**Biome v2 facts (March 2026):**
- Ships 423+ lint rules
- Type-aware linting without a full TypeScript compiler pass (own inference engine)
- Formatter output matches Prettier for ~96% of cases
- 10-25x faster than ESLint on large codebases; for a small project the absolute time savings are irrelevant, but the single-binary DX and zero config-conflict experience matter
- Ships as a single binary, single `biome.json` config file (vs. 127+ npm packages, multiple config files for ESLint+Prettier)

**Known gap:** No `eslint-plugin-react-hooks` equivalent (`exhaustive-deps`, `rules-of-hooks`). For a canvas-heavy app that uses hooks extensively, this is a real gap. Mitigation options:
1. Keep a minimal ESLint config for react-hooks only alongside Biome (hybrid approach)
2. Accept that TypeScript's strict mode catches most hook misuse patterns at compile time anyway
3. Rely on Biome's type-aware rules plus code review

For this project, **option 2 is acceptable** — the canvas render loop pattern uses `useRef`/`useEffect` in well-understood ways, and `strict: true` catches the most dangerous misuse. Adopt Biome-only for simplicity.

**Install and init:**
```bash
pnpm add -D @biomejs/biome
pnpm exec biome init
```

**`biome.json` for React + TypeScript:**
```json
{
  "$schema": "https://biomejs.dev/schemas/2.3.0/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": false,
    "ignore": ["dist", "node_modules", ".vite"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "jsxQuoteStyle": "double",
      "trailingCommas": "es5"
    },
    "jsxRuntime": "transparent"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  },
  "assist": {
    "enabled": true
  }
}
```

`"jsxRuntime": "transparent"` is the correct setting for React 17+ with the new JSX transform (no manual `import React from 'react'` needed).

**`package.json` scripts:**
```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write ."
  }
}
```

---

### 6. Project Folder Structure

The app has two distinct halves: a canvas rendering engine (imperative, frame-loop driven) and a React UI (declarative, event-driven). Keeping these cleanly separated is the core structural decision.

**Recommended structure for `hand-tracker-fx`:**

```
src/
├── main.tsx                  # App entry, React root mount
├── App.tsx                   # Root layout: <CanvasView> + <ParamsPanel>
│
├── engine/                   # Pure rendering engine — no React imports
│   ├── EngineLoop.ts         # requestAnimationFrame coordinator
│   ├── renderer/
│   │   ├── GridRenderer.ts   # Canvas 2D grid drawing
│   │   ├── BlobRenderer.ts   # Landmark dot + label rendering
│   │   └── MosaicRenderer.ts # Pixelation/mosaic effect
│   └── types.ts              # EngineConfig, FrameState, etc.
│
├── effects/                  # One directory per effect (architecture for extension)
│   └── mosaic/
│       ├── MosaicEffect.ts   # The single effect in MVP
│       └── params.ts         # Default params + param schema for this effect
│
├── tracking/                 # Hand tracking abstraction
│   ├── HandTracker.ts        # MediaPipe wrapper, emits landmark events
│   └── types.ts              # HandLandmark, TrackingResult, etc.
│
├── hooks/                    # React hooks bridging engine <-> UI
│   ├── useCamera.ts          # getUserMedia, device selection, mirror
│   ├── useHandTracker.ts     # Wraps HandTracker, exposes React state
│   ├── useEngineLoop.ts      # Wires canvas ref + engine + tracking results
│   └── useParams.ts          # Param state, localStorage persistence, presets
│
├── components/
│   ├── canvas/
│   │   └── CanvasView.tsx    # <canvas> ref host, full-screen
│   ├── params/
│   │   ├── ParamsPanel.tsx   # Side panel shell
│   │   ├── ParamSlider.tsx   # Reusable slider row
│   │   ├── ParamSelect.tsx   # Reusable select row
│   │   └── XYMappingRow.tsx  # CHOP-style X/Y mapping config
│   └── ui/
│       ├── ChevronNav.tsx    # Placeholder left/right arrows
│       └── PresetPicker.tsx  # Preset save/load dropdown
│
├── types/                    # Shared domain types
│   ├── params.ts             # ParamSchema, ParamValue, ParamMap
│   ├── landmarks.ts          # NormalizedLandmark, HandResult
│   └── effects.ts            # EffectModule interface (for future effects)
│
├── utils/
│   ├── math.ts               # clamp, lerp, mapRange (X/Y modulation math)
│   ├── storage.ts            # localStorage read/write helpers
│   └── coords.ts             # Normalized → canvas pixel coordinate helpers
│
└── test/
    └── setup.ts              # vitest-canvas-mock import
```

**Key structural decisions:**
- `engine/` has zero React imports — it is a pure imperative rendering module driven by a frame loop. This is the boundary that keeps React re-renders from interfering with 30+ fps canvas drawing.
- `effects/` is the extension point — adding a second effect means adding `effects/glitch/`, not modifying the engine. Each effect exports a standard `EffectModule` interface.
- `hooks/` is the bridge layer — they translate between the imperative engine world and React's declarative state. `useEngineLoop` owns the `requestAnimationFrame` lifecycle; React components only read state or call callbacks.
- `tracking/` is isolated — if the hand tracking library changes (e.g., switch from MediaPipe to a future TensorFlow.js model), only `HandTracker.ts` changes.

---

### 7. Static Deployment Options

**Comparison for a purely client-side SPA (2026):**

| Platform | Free Bandwidth | Free Builds | Team Pricing | Best For |
|----------|---------------|-------------|--------------|----------|
| Cloudflare Pages | Unlimited | 500/mo | No per-seat fee | SPA, global CDN, no bills |
| Vercel | 100 GB/mo | 6,000 min/mo | $20/member/mo | Next.js apps, edge functions |
| Netlify | 100 GB/mo | 300 min/mo | $19/member/mo | Content sites |
| GitHub Pages | Unlimited (soft) | Unlimited (via Actions) | Free | Simple static, no CI needed |

**Recommendation: Cloudflare Pages**

For this app:
- No backend, no serverless functions, no SSR — Vercel's specializations are irrelevant
- Cloudflare's 300+ edge nodes give consistent sub-50ms TTFB globally — important when the app loads a large MediaPipe WASM binary on first visit
- Unlimited bandwidth on free tier: no surprise bills if the app goes viral or is demo'd repeatedly
- Build command: `pnpm run build`, output directory: `dist` — standard Vite output, zero Cloudflare-specific config needed
- GitHub integration: push to `main` → automatic deploy, preview URLs on PR branches

GitHub Pages is an acceptable fallback for maximum simplicity (no account required beyond GitHub), but lacks preview deployments and has softer bandwidth limits.

---

## Recommended Approach

Based on all research, the recommended stack is:

1. **Framework**: React 19 with `@vitejs/plugin-react` (Babel transform for Fast Refresh)
2. **Build tool**: Vite 8 (current stable as of April 2026)
3. **Language**: TypeScript 5.7 with `strict: true`, `moduleResolution: "bundler"`, path aliases via `vite-tsconfig-paths`
4. **Package manager**: pnpm 10 (`pnpm create vite@latest hand-tracker-fx --template react-ts`)
5. **Linting/formatting**: Biome v2 only (no ESLint, no Prettier)
6. **Testing**: Vitest 3 (JSDOM + vitest-canvas-mock) for unit/component; Playwright for E2E / visual regression
7. **Deployment**: Cloudflare Pages (unlimited free bandwidth, 300+ edge nodes, GitHub push-to-deploy)

### Scaffold Commands

```bash
# 1. Scaffold
pnpm create vite@latest hand-tracker-fx --template react-ts
cd hand-tracker-fx

# 2. Install deps
pnpm install

# 3. Add path alias plugin
pnpm add -D vite-tsconfig-paths

# 4. Add Biome
pnpm add -D @biomejs/biome
pnpm exec biome init

# 5. Add testing stack
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom vitest-canvas-mock

# 6. Add Playwright for E2E
pnpm exec playwright install --with-deps chromium
```

---

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| React 19 + Vite 8 | Largest ecosystem, hooks fit canvas loop pattern well, matches user's existing projects, best MediaPipe community | Larger runtime bundle vs Svelte/Solid (irrelevant given WASM payload) | **Recommended** |
| Svelte 5 + Vite (bare, not SvelteKit) | Tiny bundle, elegant reactivity, excellent DX for solo dev | Thinner MediaPipe/canvas ecosystem, user's other projects are React | Rejected — ecosystem gap |
| SolidJS + Vite | Top benchmark scores, fine-grained reactivity | Learning curve (no destructuring props), performance advantage doesn't apply to canvas loops | Rejected — complexity without benefit |
| Vanilla TypeScript + Vite | Zero framework overhead, maximum control | Must build reactive UI layer manually; no DX for parameters panel | Rejected — unnecessary complexity for a 50% UI app |
| npm | Ships with Node, universal | 3-4x slower installs, 4x larger disk vs pnpm | Rejected — pnpm is a strict upgrade |
| Bun | 18x faster installs | Binary lockfile, runtime compatibility risks, not needed since we use Vite | Rejected — pnpm is safer for a Vite project |
| ESLint 9 + Prettier 3 | React hooks plugin, largest rule ecosystem | 6+ packages, multiple config files, 10-25x slower than Biome | Rejected for new project — Biome covers enough |
| Vercel | Best Next.js experience, edge functions | $20/member/mo for teams, 100 GB bandwidth limit, overkill for pure SPA | Rejected — Cloudflare Pages free tier is superior for an SPA |
| GitHub Pages | Simplest possible, free | No preview deployments per PR, softer limits, no custom CI visibility | Acceptable fallback only |

---

## Pitfalls and Edge Cases

- **Canvas + React StrictMode double-mount**: React 18+ StrictMode mounts components twice in development. An animation loop started in `useEffect` will be started, cancelled, and restarted. Always return a cleanup function from `useEffect` that calls `cancelAnimationFrame`. Not doing this causes two concurrent animation loops in development, with confusing behavior.

- **`useRef` for animation state, not `useState`**: Animation frame IDs, timestamp references, and running-state flags must live in `useRef`, not `useState`. `setState` triggers re-renders; updating a ref does not. A re-render mid-frame will cancel the current draw call and cause visual glitches.

- **Path alias `@types/*` shadow risk**: The alias `@types/*` can shadow the global `@types/` npm namespace in some bundler configurations. Use `@app-types/*` or just `@t/*` to avoid ambiguity, or restrict the alias to specific named paths rather than a wildcard.

- **Vite and `__dirname`**: `__dirname` is not available by default in Vite's ES module config. Use `import.meta.dirname` (Node 22+) or add `import { fileURLToPath } from 'url'; const __dirname = fileURLToPath(new URL('.', import.meta.url))` in `vite.config.ts` if targeting Node 20 LTS. Alternatively, use `vite-tsconfig-paths` to avoid manual `__dirname` use entirely.

- **Biome missing `react-hooks/exhaustive-deps`**: The `useEffect` dependency array is not validated by Biome. In the canvas render loop pattern, this is the most common source of stale closure bugs (capturing an old params reference inside the render loop). Mitigations: (a) use `useRef` for mutable state that the render loop reads, (b) structure the engine so it receives params as a plain object passed in from outside the effect, (c) consider adding a minimal ESLint react-hooks config for just this one rule.

- **Vitest and canvas in JSDOM**: JSDOM does not implement the Canvas 2D API. Tests that attempt to call canvas methods without `vitest-canvas-mock` will throw. Import the mock in the Vitest setup file — do not rely on individual test files to import it.

- **Cloudflare Pages and WASM**: MediaPipe ships large `.wasm` files. Cloudflare Pages serves these as static assets with correct `Content-Type: application/wasm` headers automatically — no manual header configuration needed. Vite's build output places WASM files in `dist/assets/` and Cloudflare serves them correctly.

- **Webcam in Playwright E2E tests**: Playwright cannot grant real webcam access from a system camera in CI. Use `page.context().grantPermissions(['camera'])` plus a fake video source via `--use-fake-device-for-media-stream` Chrome flag to test the permission-grant flow without a physical camera.

---

## References

- [Vite Getting Started Guide](https://vite.dev/guide/)
- [SolidJS vs Svelte for Solo Developers 2026 — SoloDevStack](https://solodevstack.com/blog/solidjs-vs-svelte-solo-developers)
- [Why I Choose Svelte — Mainmatter, 2026](https://mainmatter.com/blog/2026/02/24/why-choose-svelte/)
- [Best Frontend Frameworks 2025 Comparison — FrontendTools](https://www.frontendtools.tech/blog/best-frontend-frameworks-2025-comparison)
- [Production-Ready React + TypeScript + Vite Setup 2026 — OneUptime Blog](https://oneuptime.com/blog/post/2026-01-08-react-typescript-vite-production-setup/view)
- [TypeScript Path Aliases Configuration 2026 — OneUptime Blog](https://oneuptime.com/blog/post/2026-01-24-configure-typescript-path-aliases/view)
- [vite-tsconfig-paths — npm](https://www.npmjs.com/package/vite-tsconfig-paths)
- [Biome vs ESLint+Prettier Linting 2026 — PkgPulse](https://www.pkgpulse.com/blog/biome-vs-eslint-prettier-linting-2026)
- [Biome Configure Guide — Official Docs](https://biomejs.dev/guides/configure-biome/)
- [Biome Configuration Reference — Official Docs](https://biomejs.dev/reference/configuration/)
- [pnpm vs npm vs yarn vs Bun 2026 — Pockit Tools](https://pockit.tools/blog/pnpm-npm-yarn-bun-comparison-2026/)
- [Package Manager Showdown 2026 — DEV Community](https://dev.to/pockit_tools/pnpm-vs-npm-vs-yarn-vs-bun-the-2026-package-manager-showdown-51dc)
- [Vitest in 2026: New Standard for JS Testing — jeffbruchado.com.br](https://jeffbruchado.com.br/en/blog/vitest-2026-standard-modern-javascript-testing)
- [vitest-canvas-mock — GitHub](https://github.com/wobsoriano/vitest-canvas-mock)
- [Choosing a TypeScript Testing Framework 2026 — DEV Community](https://dev.to/agent-tools-dev/choosing-a-typescript-testing-framework-jest-vs-vitest-vs-playwright-vs-cypress-2026-7j9)
- [Cloudflare Pages vs Netlify vs Vercel Static Hosting 2026 — DanubeData](https://danubedata.ro/blog/cloudflare-pages-vs-netlify-vs-vercel-static-hosting-2026)
- [requestAnimationFrame with React Hooks — CSS-Tricks](https://css-tricks.com/using-requestanimationframe-with-react-hooks/)
- [React Hooks with Canvas — Koen van Gilst](https://blog.koenvangilst.nl/react-hooks-with-canvas/)
- [TypeScript TSConfig Reference — Official Docs](https://www.typescriptlang.org/tsconfig/)
