import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
// Side-effect import: seeds paramStore + registers the handTrackingMosaic effect
// in the global registry BEFORE React renders. Must be AFTER runtime imports.
import './effects/handTrackingMosaic';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('#root element not found in index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
