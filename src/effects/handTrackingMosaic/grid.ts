/**
 * Seeded grid generator (Task 2.3).
 *
 * Produces the TouchDesigner-style non-uniform column/row breakpoints that
 * define the hand-tracking mosaic overlay. Deterministic: same seed always
 * yields the same layout — required so presets save/load restore the exact
 * visible grid (D4). Pure module: no DOM, no React, no paramStore imports.
 *
 * Algorithm:
 *   - Mulberry32 PRNG (32-bit state, single ~8-line function) for speed,
 *     determinism, and cross-platform stability. `Math.imul` preserves
 *     32-bit multiplication semantics where plain `*` would lose precision.
 *   - Each cell starts at a uniform base width `1/count` and is jittered by
 *     `(rng() - 0.5) * variance * base`. A hard floor of `base * 0.2`
 *     prevents zero-width cells at variance=1. Results are normalized so the
 *     cumulative breakpoints end at exactly 1.0 (no fp underdraw at the edge).
 *   - Rows are generated from the seed XOR'd with 0xA5A5A5A5 so columns and
 *     rows decorrelate — a single seed still produces two visibly different
 *     non-uniform distributions.
 */

/**
 * Normalized cumulative breakpoints in (0, 1], monotonically increasing,
 * with the last element === 1.0 exactly.
 */
export type Breakpoints = number[];

export type GridLayout = {
  columns: Breakpoints; // length === columnCount
  rows: Breakpoints; // length === rowCount
};

export type GridGenInput = {
  seed: number;
  columnCount: number;
  rowCount: number;
  widthVariance: number; // clamped to [0, 1]
};

const ROW_SEED_DECORRELATOR = 0xa5a5a5a5;
const MIN_CELL_FRACTION = 0.2;

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * Mulberry32 PRNG. Returns a function `() => number` producing values in [0, 1).
 * Deterministic per 32-bit unsigned seed; the same seed always produces the
 * same infinite sequence.
 */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateCumulativeBreakpoints(
  rng: () => number,
  count: number,
  variance: number,
): Breakpoints {
  if (count <= 0) return [];
  if (count === 1) return [1];

  const v = clamp01(variance);
  const base = 1 / count;
  const minCell = base * MIN_CELL_FRACTION;

  const widths: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const jitter = (rng() - 0.5) * v * base;
    widths[i] = Math.max(minCell, base + jitter);
  }

  let total = 0;
  for (let i = 0; i < count; i++) {
    const w = widths[i] ?? 0;
    total += w;
  }
  if (total <= 0) {
    // Defensive — cannot happen because minCell > 0 and count >= 2, but satisfy
    // noUncheckedIndexedAccess and keep the function total-free of NaN output.
    return Array.from({ length: count }, (_, i) => (i + 1) / count);
  }

  const breakpoints: number[] = new Array(count);
  let acc = 0;
  for (let i = 0; i < count; i++) {
    const w = widths[i] ?? 0;
    acc += w / total;
    breakpoints[i] = acc;
  }
  // Snap the final cumulative to 1.0 exactly — protects right-edge drawing
  // against fp rounding drift (sum may be 0.9999999998 after divisions).
  breakpoints[count - 1] = 1;
  return breakpoints;
}

/**
 * Deterministic, normalized column breakpoints for `count` cells. `variance=0`
 * returns the uniform `[1/count, 2/count, …, 1]`; `variance=1` returns the
 * maximally non-uniform distribution consistent with all cells > 0. Out-of-range
 * variance is clamped.
 */
export function generateColumnWidths(seed: number, count: number, variance: number): Breakpoints {
  return generateCumulativeBreakpoints(createRng(seed), count, variance);
}

/**
 * Deterministic, normalized row breakpoints. Uses `seed ^ 0xA5A5A5A5` so that
 * row widths are decorrelated from column widths at the same seed — otherwise
 * a square-ish grid would display mirrored distributions.
 */
export function generateRowWidths(seed: number, count: number, variance: number): Breakpoints {
  return generateCumulativeBreakpoints(createRng(seed ^ ROW_SEED_DECORRELATOR), count, variance);
}

/**
 * Convenience: build both column + row breakpoints in one call. Consumers
 * should treat the returned object as immutable-by-convention — mutating it
 * does not notify subscribers.
 */
export function buildGridLayout(input: GridGenInput): GridLayout {
  return {
    columns: generateColumnWidths(input.seed, input.columnCount, input.widthVariance),
    rows: generateRowWidths(input.seed, input.rowCount, input.widthVariance),
  };
}
