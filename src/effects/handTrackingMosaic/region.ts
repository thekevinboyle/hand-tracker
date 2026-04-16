/**
 * Hand polygon → active mosaic regions (Task 3.3).
 *
 * Given MediaPipe landmarks + the current grid (column + row edges in pixel
 * space), decides which grid cells should be mosaicked by testing each cell
 * center against the 6-point hand hull (wrist + 5 fingertips, D5). Used by
 * Task 3.4's effect render() to populate the fragment shader's `uRegions`
 * uniform (up to `MAX_REGIONS = 96` vec4s per frame).
 *
 * Pure module — no React, no DOM, no MediaPipe runtime import (we take the
 * `NormalizedLandmark` shape as a read-only param). MIRROR paramStore.ts /
 * grid.ts module conventions: named exports only, JSDoc on the public API,
 * no hidden module-scoped state.
 *
 * References:
 *   - DISCOVERY.md D5 (polygon landmarks + regionPadding semantics), D27
 *     (landmarks are UNMIRRORED — this module does no `1 - x` flip), D37
 *     (FrameContext.landmarks is `NormalizedLandmark[] | null`)
 *   - .claude/skills/ogl-webgl-mosaic/SKILL.md "Region derivation"
 *   - https://en.wikipedia.org/wiki/Point_in_polygon#Winding_number_algorithm
 */

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { MAX_REGIONS } from './shader';

/** UV-space axis-aligned rectangle, packed as (x1, y1, x2, y2). Consumers
 *  flatten four `Rect`s into 16 floats before uploading to `uRegions`. */
export type Rect = {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
};

/** Hand polygon landmark indices per D5 — wrist + thumb/index/middle/ring/
 *  pinky fingertips, in the order they trace the hand's outer hull. */
export const POLY_LANDMARK_INDICES = [0, 4, 8, 12, 16, 20] as const;

/** Re-export of the shader's compile-time cap so callers who depend on this
 *  module don't have to import from two places — the single source of truth
 *  is still `shader.ts`. */
export const REGION_CAP: number = MAX_REGIONS;

/**
 * Extract the 6-point hand hull in pixel space. Returns `null` when
 * landmarks are missing or truncated — the caller returns an empty `Rect[]`
 * in response (graceful degradation for the render loop).
 */
export function polygonFromLandmarks(
  landmarks: readonly NormalizedLandmark[] | null,
  videoW: number,
  videoH: number,
): [number, number][] | null {
  if (!landmarks || landmarks.length < 21) return null;
  const poly: [number, number][] = [];
  for (const idx of POLY_LANDMARK_INDICES) {
    const lm = landmarks[idx];
    if (!lm) return null;
    poly.push([lm.x * videoW, lm.y * videoH]);
  }
  return poly;
}

/**
 * Centroid-push polygon inflation — each vertex is moved outward along the
 * centroid-to-vertex ray by `paddingPx`. Cheap and correct for near-convex
 * hand shapes; NOT a general polygon-offset algorithm. `paddingPx <= 0`
 * returns a shallow copy of the input (callers that mutate their output
 * must not observe changes on the input).
 */
export function expandPolygon(
  poly: readonly [number, number][],
  paddingPx: number,
): [number, number][] {
  if (paddingPx <= 0 || poly.length === 0) {
    return poly.map(([x, y]) => [x, y] as [number, number]);
  }
  let sx = 0;
  let sy = 0;
  for (const [x, y] of poly) {
    sx += x;
    sy += y;
  }
  const cx = sx / poly.length;
  const cy = sy / poly.length;
  const out: [number, number][] = [];
  for (const [x, y] of poly) {
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    out.push([x + (dx / len) * paddingPx, y + (dy / len) * paddingPx]);
  }
  return out;
}

/**
 * Winding-number point-in-polygon test (Dan Sunday form). Robust for
 * concave polygons — correctly excludes between-finger cells when the hand
 * is splayed. Orientation-agnostic (CW and CCW polygons both work).
 *
 * Complexity: O(n). For this project n === 6, so the per-cell cost is
 * effectively constant. Callers may upstream-filter cells via a cheap AABB
 * bounding-box test if the polygon ever grows (unneeded here).
 */
export function pointInPolygon(px: number, py: number, poly: readonly [number, number][]): boolean {
  const n = poly.length;
  if (n < 3) return false;
  let wn = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    if (!a || !b) continue;
    const [x0, y0] = a;
    const [x1, y1] = b;
    if (y0 <= py) {
      if (y1 > py) {
        // Upward crossing — point is left of the edge.
        const cross = (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0);
        if (cross > 0) wn++;
      }
    } else if (y1 <= py) {
      // Downward crossing — point is right of the edge.
      const cross = (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0);
      if (cross < 0) wn--;
    }
  }
  return wn !== 0;
}

/**
 * Produce up to `MAX_REGIONS` UV-space rectangles covering the grid cells
 * whose centers fall inside the expanded hand polygon. Row-major scan so
 * the output is deterministic frame-to-frame for identical input — good
 * for GPU uniform-cache hit rate.
 *
 * Allocation budget: exactly ONE `Rect[]` result plus ONE expanded-polygon
 * intermediate when `regionPadding > 0` (none when it's 0).
 */
export function computeActiveRegions(
  landmarks: readonly NormalizedLandmark[] | null,
  videoW: number,
  videoH: number,
  /** Pixel-space column breakpoints, length = columnCount + 1, starting 0. */
  columnEdges: readonly number[],
  /** Pixel-space row breakpoints, length = rowCount + 1, starting 0. */
  rowEdges: readonly number[],
  /** Padding in grid cells (D5). `0` → no inflation; fractional OK. */
  regionPadding: number,
): Rect[] {
  const raw = polygonFromLandmarks(landmarks, videoW, videoH);
  if (!raw) return [];

  const colCount = columnEdges.length - 1;
  const rowCount = rowEdges.length - 1;
  if (colCount < 1 || rowCount < 1) return [];

  const avgCellW = videoW / colCount;
  const avgCellH = videoH / rowCount;
  const paddingPx = Math.max(0, regionPadding) * Math.max(avgCellW, avgCellH);
  const poly = paddingPx > 0 ? expandPolygon(raw, paddingPx) : raw;

  const rects: Rect[] = [];

  for (let row = 0; row < rowCount; row++) {
    if (rects.length >= MAX_REGIONS) break;
    const rowA = rowEdges[row];
    const rowB = rowEdges[row + 1];
    if (rowA === undefined || rowB === undefined) continue;
    const cy = (rowA + rowB) * 0.5;

    for (let col = 0; col < colCount; col++) {
      if (rects.length >= MAX_REGIONS) break;
      const colA = columnEdges[col];
      const colB = columnEdges[col + 1];
      if (colA === undefined || colB === undefined) continue;
      const cx = (colA + colB) * 0.5;

      if (pointInPolygon(cx, cy, poly)) {
        rects.push({
          x1: colA / videoW,
          y1: rowA / videoH,
          x2: colB / videoW,
          y2: rowB / videoH,
        });
      }
    }
  }

  return rects;
}
