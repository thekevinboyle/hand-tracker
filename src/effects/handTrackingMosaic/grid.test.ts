import { describe, expect, it } from 'vitest';
import { buildGridLayout, createRng, generateColumnWidths, generateRowWidths } from './grid';

// D4 canonical seed used throughout Hand Tracker FX grid tests.
const SEED = 0x1a2b3c4d;

/**
 * Golden fixture — regenerate intentionally if the PRNG algorithm changes.
 * Produced by calling the shipping Mulberry32 implementation 5 times from
 * seed 0x1A2B3C4D and copying the exact JS-number representation.
 */
const MULBERRY32_GOLDEN = [
  0.2519546449184418, 0.597925832727924, 0.13079005177132785, 0.715884089237079, 0.934819060144946,
];

/**
 * Golden fixture for generateColumnWidths(0x1A2B3C4D, 12, 0.6). Pinned to
 * detect regressions in the PRNG→breakpoint pipeline. Regenerate intentionally.
 */
const COLS_12_V06_GOLDEN = [
  0.07135727113653903, 0.16011704402061408, 0.2253796832390083, 0.32007280790891846,
  0.42577845717067114, 0.48767887544064686, 0.5557847790314565, 0.6413368573331203,
  0.7378667452126912, 0.815937177511416, 0.8959971155629878, 1,
];

function stddev(xs: number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((acc, x) => acc + (x - mean) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}

function widthsFromBreakpoints(bp: number[]): number[] {
  const out = new Array<number>(bp.length);
  let prev = 0;
  for (let i = 0; i < bp.length; i++) {
    const cur = bp[i] ?? 0;
    out[i] = cur - prev;
    prev = cur;
  }
  return out;
}

describe('effects/handTrackingMosaic/grid — createRng', () => {
  it('is deterministic — matches golden fixture for seed 0x1A2B3C4D', () => {
    const rng = createRng(SEED);
    const produced = [rng(), rng(), rng(), rng(), rng()];
    expect(produced).toEqual(MULBERRY32_GOLDEN);
  });

  it('two instances with the same seed produce the same sequence', () => {
    const a = createRng(SEED);
    const b = createRng(SEED);
    for (let i = 0; i < 10; i++) {
      expect(a()).toBe(b());
    }
  });

  it('different seeds diverge', () => {
    const a = createRng(SEED);
    const b = createRng(SEED + 1);
    const aVals = Array.from({ length: 5 }, () => a());
    const bVals = Array.from({ length: 5 }, () => b());
    expect(aVals).not.toEqual(bVals);
  });

  it('returns values in [0, 1)', () => {
    const rng = createRng(SEED);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('coerces negative seeds via >>> 0 without throwing', () => {
    const rng = createRng(-1);
    for (let i = 0; i < 5; i++) {
      const v = rng();
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('effects/handTrackingMosaic/grid — generateColumnWidths', () => {
  it('matches the golden fixture for (0x1A2B3C4D, 12, 0.6)', () => {
    const bp = generateColumnWidths(SEED, 12, 0.6);
    expect(bp).toEqual(COLS_12_V06_GOLDEN);
  });

  it('last breakpoint is exactly 1.0', () => {
    const bp = generateColumnWidths(SEED, 12, 0.6);
    expect(bp[bp.length - 1]).toBe(1);
  });

  it('returns [] when count === 0', () => {
    expect(generateColumnWidths(SEED, 0, 0.5)).toEqual([]);
  });

  it('returns [1] when count === 1', () => {
    expect(generateColumnWidths(SEED, 1, 0.5)).toEqual([1]);
  });

  it('variance=0 is uniform within 1e-9', () => {
    const count = 12;
    const bp = generateColumnWidths(SEED, count, 0);
    for (let i = 0; i < count; i++) {
      const expected = (i + 1) / count;
      expect(bp[i] ?? Number.NaN).toBeCloseTo(expected, 9);
    }
    // Last element exact.
    expect(bp[count - 1]).toBe(1);
  });

  it('variance=1 produces non-uniform widths (stddev > 0.02)', () => {
    const bp = generateColumnWidths(SEED, 12, 1);
    const widths = widthsFromBreakpoints(bp);
    expect(stddev(widths)).toBeGreaterThan(0.02);
  });

  it('same seed and params return identical arrays', () => {
    const a = generateColumnWidths(SEED, 12, 0.6);
    const b = generateColumnWidths(SEED, 12, 0.6);
    expect(a).toEqual(b);
  });

  it('no cell has zero (or negative) width, even at variance=1', () => {
    const bp = generateColumnWidths(SEED, 20, 1);
    const widths = widthsFromBreakpoints(bp);
    for (const w of widths) {
      expect(w).toBeGreaterThan(0);
    }
  });

  it('clamps variance > 1 to 1 (widths match variance=1 fixture)', () => {
    const a = generateColumnWidths(SEED, 12, 1);
    const b = generateColumnWidths(SEED, 12, 5);
    expect(b).toEqual(a);
  });

  it('clamps variance < 0 to 0 (widths match uniform)', () => {
    const count = 8;
    const bp = generateColumnWidths(SEED, count, -0.5);
    for (let i = 0; i < count; i++) {
      expect(bp[i] ?? Number.NaN).toBeCloseTo((i + 1) / count, 9);
    }
  });

  it('breakpoints are strictly monotonically increasing', () => {
    const bp = generateColumnWidths(SEED, 12, 0.6);
    for (let i = 1; i < bp.length; i++) {
      expect(bp[i] ?? 0).toBeGreaterThan(bp[i - 1] ?? 0);
    }
  });
});

describe('effects/handTrackingMosaic/grid — generateRowWidths', () => {
  it('is decorrelated from columns at the same seed', () => {
    const cols = generateColumnWidths(SEED, 12, 0.6);
    const rows = generateRowWidths(SEED, 12, 0.6);
    expect(rows).not.toEqual(cols);
  });

  it('still deterministic for a given seed', () => {
    const a = generateRowWidths(SEED, 8, 0.6);
    const b = generateRowWidths(SEED, 8, 0.6);
    expect(a).toEqual(b);
  });

  it('last element is exactly 1.0', () => {
    const bp = generateRowWidths(SEED, 8, 0.6);
    expect(bp[bp.length - 1]).toBe(1);
  });
});

describe('effects/handTrackingMosaic/grid — buildGridLayout', () => {
  it('returns columns and rows of the requested lengths', () => {
    const layout = buildGridLayout({
      seed: SEED,
      columnCount: 12,
      rowCount: 8,
      widthVariance: 0.6,
    });
    expect(layout.columns).toHaveLength(12);
    expect(layout.rows).toHaveLength(8);
  });

  it('both axes end at exactly 1.0', () => {
    const layout = buildGridLayout({
      seed: SEED,
      columnCount: 12,
      rowCount: 8,
      widthVariance: 0.6,
    });
    expect(layout.columns[layout.columns.length - 1]).toBe(1);
    expect(layout.rows[layout.rows.length - 1]).toBe(1);
  });

  it('columns and rows differ at equal counts (seed decorrelation)', () => {
    const layout = buildGridLayout({
      seed: SEED,
      columnCount: 10,
      rowCount: 10,
      widthVariance: 0.8,
    });
    expect(layout.rows).not.toEqual(layout.columns);
  });
});
