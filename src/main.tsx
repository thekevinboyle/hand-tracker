import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DEFAULT_MODULATION_ROUTES } from './engine/modulation';
import { modulationStore } from './engine/modulationStore';
import './index.css';
import { App } from './App';
// Side-effect import: seeds paramStore + registers the handTrackingMosaic effect
// in the global registry BEFORE React renders. Must be AFTER runtime imports.
import './effects/handTrackingMosaic';

// Task 4.2: seed the modulation store with D13's default routes so the
// Modulation panel and the render-loop evaluator both see the baseline on
// first frame. Tests that mount <Panel /> with a different route set skip
// this branch because the modulationStore singleton is only seeded here.
modulationStore.replaceRoutes(DEFAULT_MODULATION_ROUTES);

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('#root element not found in index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
