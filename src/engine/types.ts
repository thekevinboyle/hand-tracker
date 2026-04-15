import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Canonical landmark type for the project — aliased to MediaPipe's NormalizedLandmark.
 * Do NOT declare a custom `{ x, y, z, visibility? }` structural copy anywhere else.
 * Task 2.1's `src/engine/manifest.ts` will re-export `Landmark` via
 * `export type { Landmark } from './types'` — it does NOT redeclare.
 */
export type Landmark = NormalizedLandmark;

/** Per-frame context passed to effect renders. Matches DISCOVERY.md D37. */
export interface FrameContext {
  /** Populated by Phase 3 (Task 3.1) — OGL video texture. Null in Phase 1. */
  videoTexture: WebGLTexture | null;
  /** Source video dimensions. */
  videoSize: { w: number; h: number };
  /** Landmarks for the first hand in the frame (numHands=1 per D8), or null. */
  landmarks: Landmark[] | null;
  /**
   * 2D overlay canvas context. Optional in Phase 1 before Stage.tsx exists;
   * once Task 1.6 mounts the overlay canvas, App.tsx supplies it so Phase 2's
   * effect render() can draw grid + blobs without early-returning on missing ctx.
   */
  ctx2d: CanvasRenderingContext2D | null;
  /** Resolved params (post-modulation). Empty record in Phase 1; populated in Phase 2. */
  params: Record<string, unknown>;
  /** Monotonic ms from rVFC `now`. Pass directly to detectForVideo. */
  timeMs: number;
}
