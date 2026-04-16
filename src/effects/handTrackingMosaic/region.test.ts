/**
 * Fixture-driven tests for region.ts (Task 3.3). Covers the five checklist
 * contracts from the task file — convex + concave PIP, padding expansion,
 * MAX_REGIONS cap, null / short-landmarks graceful degradation, and
 * row-major determinism — plus the polygon-extraction coord scaling.
 */

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { describe, expect, it } from 'vitest';
import {
  computeActiveRegions,
  expandPolygon,
  POLY_LANDMARK_INDICES,
  pointInPolygon,
  polygonFromLandmarks,
  REGION_CAP,
  type Rect,
} from './region';
import { MAX_REGIONS } from './shader';

/** Build a 21-landmark array where only `POLY_LANDMARK_INDICES` carry the
 *  caller-supplied x/y; filler landmarks sit at the centre so they can't
 *  accidentally skew downstream math. */
function landmarksFromHull(hull: Array<[number, number]>): NormalizedLandmark[] {
  const center: NormalizedLandmark = { x: 0.5, y: 0.5, z: 0, visibility: 1 };
  const out: NormalizedLandmark[] = Array.from({ length: 21 }, () => ({ ...center }));
  POLY_LANDMARK_INDICES.forEach((idx, i) => {
    const [x, y] = hull[i] ?? [0.5, 0.5];
    out[idx] = { x, y, z: 0, visibility: 1 };
  });
  return out;
}

/** Edges of length `count + 1` starting at 0, ending at `size`, uniformly spaced. */
function uniformEdges(count: number, size: number): number[] {
  const edges = new Array<number>(count + 1);
  for (let i = 0; i <= count; i++) edges[i] = (i / count) * size;
  return edges;
}

describe('polygonFromLandmarks', () => {
  it('returns null for null input', () => {
    expect(polygonFromLandmarks(null, 640, 480)).toBeNull();
  });

  it('returns null for fewer than 21 landmarks', () => {
    const partial: NormalizedLandmark[] = Array.from({ length: 5 }, () => ({
      x: 0,
      y: 0,
      z: 0,
      visibility: 1,
    }));
    expect(polygonFromLandmarks(partial, 640, 480)).toBeNull();
  });

  it('picks indices {0, 4, 8, 12, 16, 20} and multiplies by video size', () => {
    const lms = landmarksFromHull([
      [0.1, 0.2], // idx 0 — wrist
      [0.3, 0.4], // idx 4 — thumb
      [0.5, 0.6], // idx 8 — index
      [0.7, 0.8], // idx 12 — middle
      [0.2, 0.9], // idx 16 — ring
      [0.1, 0.7], // idx 20 — pinky
    ]);
    const poly = polygonFromLandmarks(lms, 100, 200);
    expect(poly).toEqual([
      [10, 40],
      [30, 80],
      [50, 120],
      [70, 160],
      [20, 180],
      [10, 140],
    ]);
  });
});

describe('pointInPolygon (winding number)', () => {
  const square: Array<[number, number]> = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];

  it('classifies interior points of a convex square', () => {
    expect(pointInPolygon(5, 5, square)).toBe(true);
    expect(pointInPolygon(0.1, 0.1, square)).toBe(true);
  });

  it('classifies exterior points of a convex square', () => {
    expect(pointInPolygon(-1, 5, square)).toBe(false);
    expect(pointInPolygon(11, 5, square)).toBe(false);
    expect(pointInPolygon(5, -1, square)).toBe(false);
    expect(pointInPolygon(5, 11, square)).toBe(false);
  });

  it('correctly excludes between-finger points of a concave polygon (C-shape)', () => {
    // Concave "C": open on the right side. A point inside the C's bounding box
    // but outside the body — in the mouth of the C — must be classified OUT.
    const cShape: Array<[number, number]> = [
      [0, 0],
      [10, 0],
      [10, 3],
      [3, 3],
      [3, 7],
      [10, 7],
      [10, 10],
      [0, 10],
    ];
    // (5, 5) is in the mouth of the C — should be OUTSIDE.
    expect(pointInPolygon(5, 5, cShape)).toBe(false);
    // (1, 5) is in the body of the C — should be INSIDE.
    expect(pointInPolygon(1, 5, cShape)).toBe(true);
    // (2, 5) is in the body of the C (barely) — should be INSIDE.
    expect(pointInPolygon(2, 5, cShape)).toBe(true);
  });

  it('returns false for degenerate polygons (< 3 vertices)', () => {
    expect(pointInPolygon(0, 0, [])).toBe(false);
    expect(pointInPolygon(0, 0, [[0, 0]])).toBe(false);
    expect(
      pointInPolygon(0, 0, [
        [0, 0],
        [1, 1],
      ]),
    ).toBe(false);
  });
});

describe('expandPolygon', () => {
  it('returns a shallow copy when paddingPx === 0', () => {
    const src: Array<[number, number]> = [
      [1, 2],
      [3, 4],
    ];
    const out = expandPolygon(src, 0);
    expect(out).toEqual(src);
    expect(out).not.toBe(src); // Fresh outer array.
  });

  it('returns a shallow copy when paddingPx < 0', () => {
    const src: Array<[number, number]> = [
      [1, 2],
      [3, 4],
    ];
    expect(expandPolygon(src, -5)).toEqual(src);
  });

  it('pushes each vertex outward from the centroid by paddingPx', () => {
    // Square centred at (5, 5). Each vertex moves outward along the diagonal.
    const square: Array<[number, number]> = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    const out = expandPolygon(square, Math.SQRT2); // Diagonal of unit square.
    // Each new vertex should be exactly (√2) pixels further from (5, 5) along
    // its own diagonal direction — so its (x, y) offset from the centre grows
    // by +/- 1 in BOTH x and y (unit diagonal × √2).
    expect(out[0]).toEqual([0 - 1, 0 - 1]);
    expect(out[1]).toEqual([10 + 1, 0 - 1]);
    expect(out[2]).toEqual([10 + 1, 10 + 1]);
    expect(out[3]).toEqual([0 - 1, 10 + 1]);
  });

  it('returns an empty array when the input is empty', () => {
    expect(expandPolygon([], 10)).toEqual([]);
  });
});

describe('computeActiveRegions', () => {
  const VIDEO_W = 100;
  const VIDEO_H = 100;

  it('returns [] for null landmarks', () => {
    expect(
      computeActiveRegions(
        null,
        VIDEO_W,
        VIDEO_H,
        uniformEdges(4, VIDEO_W),
        uniformEdges(4, VIDEO_H),
        0,
      ),
    ).toEqual([]);
  });

  it('returns [] when landmarks are shorter than 21', () => {
    const partial: NormalizedLandmark[] = [{ x: 0, y: 0, z: 0, visibility: 1 }];
    expect(
      computeActiveRegions(
        partial,
        VIDEO_W,
        VIDEO_H,
        uniformEdges(4, VIDEO_W),
        uniformEdges(4, VIDEO_H),
        0,
      ),
    ).toEqual([]);
  });

  it('flags only cells with centres inside the polygon (top-left quadrant)', () => {
    // Polygon covers the top-left 50x50 region of a 100x100 frame — all 6
    // hull landmarks clustered inside that quadrant.
    const lms = landmarksFromHull([
      [0.0, 0.0],
      [0.5, 0.0],
      [0.5, 0.5],
      [0.25, 0.5],
      [0.0, 0.5],
      [0.0, 0.25],
    ]);
    const edges = uniformEdges(4, VIDEO_W); // 25-wide columns / rows.
    const rects = computeActiveRegions(lms, VIDEO_W, VIDEO_H, edges, edges, 0);
    // Row 0 (cy = 12.5): cols 0 (cx=12.5) + col 1 (cx=37.5) — both inside the
    // 50x50 polygon.
    // Row 1 (cy = 37.5): cols 0 + col 1 — both inside.
    // Rows 2, 3 (cy = 62.5, 87.5) and cols 2, 3 — all outside.
    expect(rects).toHaveLength(4);
    // Spot-check the first rect is the top-left cell in UV space.
    expect(rects[0]).toEqual({ x1: 0, y1: 0, x2: 0.25, y2: 0.25 });
  });

  it('regionPadding expands the active set compared to 0', () => {
    // Polygon covers a small square near the centre — with padding = 0 a few
    // cells light up; with padding = 1 strictly more do.
    const lms = landmarksFromHull([
      [0.4, 0.4],
      [0.6, 0.4],
      [0.6, 0.6],
      [0.5, 0.6],
      [0.4, 0.6],
      [0.4, 0.5],
    ]);
    const edges = uniformEdges(8, VIDEO_W);
    const base = computeActiveRegions(lms, VIDEO_W, VIDEO_H, edges, edges, 0);
    const padded = computeActiveRegions(lms, VIDEO_W, VIDEO_H, edges, edges, 1);
    expect(padded.length).toBeGreaterThan(base.length);
  });

  it('caps at MAX_REGIONS when the polygon covers the whole frame', () => {
    // Hand hull traces the outer frame → every cell centre is inside.
    const lms = landmarksFromHull([
      [0, 0],
      [1, 0],
      [1, 0.5],
      [1, 1],
      [0, 1],
      [0, 0.5],
    ]);
    const edges = uniformEdges(12, VIDEO_W);
    const rects = computeActiveRegions(lms, VIDEO_W, VIDEO_H, edges, edges, 0);
    expect(rects.length).toBe(MAX_REGIONS);
    expect(rects.length).toBe(REGION_CAP);
    expect(MAX_REGIONS).toBe(96);
  });

  it('row-major determinism — identical input → deep-equal output', () => {
    const lms = landmarksFromHull([
      [0.2, 0.2],
      [0.5, 0.2],
      [0.7, 0.4],
      [0.7, 0.7],
      [0.3, 0.7],
      [0.2, 0.5],
    ]);
    const edges = uniformEdges(6, VIDEO_W);
    const rectsA: Rect[] = computeActiveRegions(lms, VIDEO_W, VIDEO_H, edges, edges, 0);
    const rectsB: Rect[] = computeActiveRegions(lms, VIDEO_W, VIDEO_H, edges, edges, 0);
    expect(rectsA).not.toBe(rectsB); // Fresh arrays per call.
    expect(rectsA).toEqual(rectsB);
  });

  it('returns [] when columnEdges / rowEdges are degenerate', () => {
    const lms = landmarksFromHull([
      [0, 0],
      [1, 0],
      [1, 1],
      [0.5, 0.5],
      [0, 1],
      [0, 0.5],
    ]);
    expect(computeActiveRegions(lms, VIDEO_W, VIDEO_H, [0], [0, 50, 100], 0)).toEqual([]);
    expect(computeActiveRegions(lms, VIDEO_W, VIDEO_H, [0, 50, 100], [0], 0)).toEqual([]);
  });
});
