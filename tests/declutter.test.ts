// Positional tests for label de-collision. Overlapping labels shipped once on
// the slope chart (two medicine names printed on top of each other), so this
// asserts the invariant directly: no two labels closer than the gap, order
// preserved, everything in bounds.

import { describe, expect, it } from 'vitest';
import { declutter } from '../src/utils/declutter';

const MIN = 0;
const MAX = 500;

function gaps(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.slice(1).map((v, i) => v - sorted[i]);
}

describe('declutter', () => {
  it('leaves already-separated labels alone', () => {
    const input = [10, 100, 200, 300];
    expect(declutter(input, 12, MIN, MAX)).toEqual(input);
  });

  it('pushes overlapping labels apart to at least the minimum gap', () => {
    const out = declutter([200, 201, 202, 203], 12, MIN, MAX);
    for (const gap of gaps(out)) expect(gap).toBeGreaterThanOrEqual(12 - 1e-9);
  });

  it('preserves the relative order of the original positions', () => {
    const input = [300, 100, 305, 102, 200];
    const out = declutter(input, 15, MIN, MAX);
    const rankIn = [...input].sort((a, b) => a - b).map((v) => input.indexOf(v));
    const rankOut = [...out].sort((a, b) => a - b).map((v) => out.indexOf(v));
    expect(rankOut).toEqual(rankIn);
  });

  it('keeps every label inside the bounds', () => {
    const out = declutter([0, 1, 2, 3, 4, 495, 498, 500], 12, MIN, MAX);
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(MIN - 1e-9);
      expect(v).toBeLessThanOrEqual(MAX + 1e-9);
    }
  });

  it('pulls the tail back up when the forward sweep overruns the bottom', () => {
    // Eight labels all bunched near the bottom cannot all sit below 500.
    const out = declutter([470, 472, 474, 476, 478, 480, 482, 484], 12, MIN, MAX);
    expect(Math.max(...out)).toBeLessThanOrEqual(MAX + 1e-9);
    for (const gap of gaps(out)) expect(gap).toBeGreaterThanOrEqual(12 - 1e-9);
  });

  it('distributes evenly when the labels cannot possibly all fit', () => {
    // 30 labels needing 20px each in 100px of space.
    const out = declutter(new Array(30).fill(50), 20, 0, 100);
    expect(out).toHaveLength(30);
    for (const v of out) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(-1e-9);
      expect(v).toBeLessThanOrEqual(100 + 1e-9);
    }
    // Evenly spread rather than piled up.
    expect(new Set(out.map((v) => v.toFixed(3))).size).toBe(30);
  });

  it('handles the degenerate sizes', () => {
    expect(declutter([], 10, MIN, MAX)).toEqual([]);
    expect(declutter([250], 10, MIN, MAX)).toEqual([250]);
    expect(declutter([-40], 10, MIN, MAX)).toEqual([MIN]);
  });

  it('never returns NaN, even for non-finite input', () => {
    const out = declutter([NaN, 100, Infinity], 10, MIN, MAX);
    for (const v of out) expect(Number.isFinite(v)).toBe(true);
  });

  it('produces the same result twice for the same input', () => {
    const input = [120, 121, 300, 301, 302, 60];
    expect(declutter(input, 14, MIN, MAX)).toEqual(declutter(input, 14, MIN, MAX));
  });
});
