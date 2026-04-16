/**
 * Module-level pointer to the currently mounted video `Texture` (Task 3.1).
 *
 * Broker between `src/ui/Stage.tsx` (owner — creates + disposes on mount /
 * unmount) and consumers that need a handle without wiring through React:
 *   - `src/engine/devHooks.ts` — exposes `__engine.getVideoTextureHandle()`
 *     so Playwright E2E can assert the WebGLTexture is alive.
 *   - (later) Phase 3 effect render() — reads the raw WebGLTexture for the
 *     `uVideo` sampler uniform.
 *
 * Ownership contract: Stage.tsx calls `setVideoTexture(texture)` exactly
 * once per mount and `setVideoTexture(null)` in its cleanup. Callers that
 * read must tolerate `null` (pre-mount, post-unmount, and during
 * StrictMode's teardown → re-create cycle).
 *
 * Mirrors the landmark-override broker pattern from Task 2.R.
 */

import type { Texture } from 'ogl';

let current: Texture | null = null;

/** Stage.tsx owns this setter. Passing `null` clears the pointer on unmount. */
export function setVideoTexture(texture: Texture | null): void {
  current = texture;
}

/** Raw `WebGLTexture` handle, or `null` before first mount / during teardown. */
export function getVideoTextureHandle(): WebGLTexture | null {
  return current?.texture ?? null;
}

/** The ogl wrapper — consumers that need `.image` / `.needsUpdate` (e.g.
 *  per-frame upload from App.tsx) read the wrapper, not the raw handle. */
export function getVideoTexture(): Texture | null {
  return current;
}

/** @internal test-only reset; keeps vitest reruns deterministic. */
export function __resetVideoTexture(): void {
  current = null;
}
