/**
 * Hand Tracking Mosaic — entry point + registration side effect (Task 2.5).
 *
 * Importing this module:
 *   1. Seeds `paramStore` with `DEFAULT_PARAM_STATE` (must happen before React
 *      mounts so Tweakpane's `buildPaneFromManifest` finds populated sections).
 *   2. Registers the manifest in the global `effectRegistry`.
 *
 * Both operations are idempotent per module-load semantics (ES modules execute
 * top-level code exactly once per process). React StrictMode cannot cause
 * double-registration because the import is at module scope, not inside a
 * `useEffect`.
 */

import type { ParamState } from '../../engine/paramStore';
import { paramStore } from '../../engine/paramStore';
import { registerEffect } from '../../engine/registry';
import { DEFAULT_PARAM_STATE, handTrackingMosaicManifest } from './manifest';

// Seed paramStore defaults from the manifest. ORDER MATTERS: replace before
// register so consumers reading paramStore in the next microtask see the
// right shape.
paramStore.replace(DEFAULT_PARAM_STATE as unknown as ParamState);
registerEffect(handTrackingMosaicManifest);

export type { HandTrackingMosaicParams } from './manifest';
export { DEFAULT_PARAM_STATE, handTrackingMosaicManifest };
