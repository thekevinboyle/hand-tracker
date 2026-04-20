import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DEFAULT_MODULATION_ROUTES } from './engine/modulation';
import { modulationStore } from './engine/modulationStore';
import { initializePresetsIfEmpty } from './engine/presets';
import './index.css';
import { App } from './App';
import { registerSW } from './registerSW';
import { presetCycler } from './ui/PresetCycler';
// Side-effect import: seeds paramStore + registers the handTrackingMosaic effect
// in the global registry BEFORE React renders. Must be AFTER runtime imports.
// Shared by BOTH the normal App path and the Task DR-7.R `/primitives`
// showcase path below — useParam('mosaic.tileSize') in the Showcase reads
// DEFAULT_PARAM_STATE.mosaic.tileSize = 16 on first render (synergy HIGH-08).
import './effects/handTrackingMosaic';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('#root element not found in index.html');
}
const root = createRoot(rootEl);

// Task DR-7.R: dev-only `/primitives` showcase route.
//
// Gated on `import.meta.env.DEV` (true under `pnpm dev`) OR
// `import.meta.env.MODE === 'test'` (true under `pnpm build --mode test`,
// which is what the Playwright preview server runs). Both flags are STATIC
// at build time — Vite replaces them with literal booleans / strings, so
// the production build (`pnpm build`, MODE='production', DEV=false)
// evaluates the guard to `false` and the entire dynamic-import branch is
// tree-shaken. Verified via `grep -r "Showcase" dist/` → zero hits after
// `pnpm build`.
//
// The dynamic `import()` is what lets Vite rip out the Showcase module
// graph — a static top-level import would pull Showcase.tsx into the main
// chunk regardless of the dead-code branch.
const isShowcase =
  (import.meta.env.DEV || import.meta.env.MODE === 'test') &&
  window.location.pathname === '/primitives';

if (isShowcase) {
  void import('./ui/primitives/Showcase').then(({ Showcase }) => {
    root.render(
      <StrictMode>
        <Showcase />
      </StrictMode>,
    );
  });
} else {
  // Task 4.2: seed the modulation store with D13's default routes so the
  // ModulationCard and the render-loop evaluator both see the baseline on
  // first frame. Unit tests that mount the sidebar with a different route
  // set skip this branch because the modulationStore singleton is only
  // seeded here.
  modulationStore.replaceRoutes(DEFAULT_MODULATION_ROUTES);

  // Task 4.3: seed the first-launch Default preset from the current live
  // stores. No-op when a preset file is already present in localStorage.
  // Order matters — must follow the modulation seed above so the snapshot
  // captures the real default routes, not an empty list.
  initializePresetsIfEmpty();

  // Task 4.4: the PresetCycler singleton was constructed at module-import
  // time (via the App → PresetStrip → PresetCycler chain) BEFORE the
  // preset store was seeded, so its initial snapshot captured an empty
  // list. Refresh now so the first render already shows the Default
  // preset. (DR-8.6 kept this call — the ordering problem it solves is
  // independent of the retired Tweakpane path.)
  presetCycler.refresh();

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  // Task 5.1: register the production service worker AFTER render so it
  // doesn't block first paint. No-op in `pnpm dev` — see registerSW.ts.
  registerSW();
}
