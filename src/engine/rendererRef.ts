/**
 * Module-level pointer to the currently mounted ogl `Renderer` (Task 3.4).
 *
 * Parallel to `videoTextureRef.ts` — lets `handTrackingMosaicManifest.create(gl)`
 * reach the Renderer without adding a `deps` parameter to the D36-pinned
 * `create(gl: WebGL2RenderingContext): EffectInstance` signature. Stage.tsx
 * owns the lifetime: calls `setRenderer(renderer)` after construction and
 * `setRenderer(null)` in its cleanup (StrictMode-safe).
 *
 * Readers should tolerate `null` (pre-mount, post-unmount). The helpers
 * `getRendererOrThrow()` / `getRenderer()` cover both styles: throwing is
 * appropriate inside `create()` (Stage's effect is guaranteed to have run
 * by the time App.tsx's render-loop effect builds the effect instance);
 * nullable is appropriate for devHooks / E2E probes.
 */

import type { Renderer } from 'ogl';

let current: Renderer | null = null;

/** Stage.tsx owns this setter. Passing `null` clears the pointer on unmount. */
export function setRenderer(renderer: Renderer | null): void {
  current = renderer;
}

/** Nullable reader — use from dev hooks / E2E code that must tolerate mount gaps. */
export function getRenderer(): Renderer | null {
  return current;
}

/** Throwing reader — use from the hot path where `null` is a contract violation. */
export function getRendererOrThrow(): Renderer {
  if (!current) {
    throw new Error(
      'Renderer not initialized — manifest.create() called before Stage mounted the ogl bundle',
    );
  }
  return current;
}

/** @internal test-only reset; keeps vitest reruns deterministic. */
export function __resetRenderer(): void {
  current = null;
}
