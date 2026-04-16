/**
 * Landmark override — test-only injection slot consulted by the render loop.
 *
 * Ownership split exists to avoid a circular import between `renderLoop.ts`
 * (reader) and `devHooks.ts` (writer exposure). This module is the shared
 * broker. Test code writes via `setLandmarkOverride`; the render loop reads
 * via `getLandmarkOverride` once per frame and, when non-null, substitutes
 * the override for MediaPipe's `detectForVideo` output before invoking the
 * per-frame callback.
 *
 * Scope: Phase 2 (Task 2.R) hotfix supporting the regression spec's
 * "blob count = 5 on injected landmarks" assertion. Used by Phase 3+ E2E
 * specs too (see Task 3.3 / Task 3.R).
 */

import type { Landmark } from './types';

let override: Landmark[] | null = null;

/**
 * Force the render loop to emit these landmarks instead of MediaPipe's
 * detection. Pass `null` to clear the override and restore real detection.
 * Gated to test builds via `devHooks.ts` — not exposed in production.
 */
export function setLandmarkOverride(lms: Landmark[] | null): void {
  override = lms;
}

/** Per-frame reader for the render loop. */
export function getLandmarkOverride(): Landmark[] | null {
  return override;
}

/** @internal test-only reset — keeps vitest reruns deterministic. */
export function __resetLandmarkOverride(): void {
  override = null;
}
