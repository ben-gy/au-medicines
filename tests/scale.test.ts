import { describe, expect, it } from 'vitest';
import { linePath, linearScale, logScale, logTicks, niceTicks } from '../src/utils/scale';
import { clampViewBox, zoomViewBox } from '../src/utils/svgZoom';
import { parseCsvLine, slugify } from '../pipeline/aggregate.mjs';

describe('linearScale', () => {
  const s = linearScale([0, 100], [0, 500]);
  it('maps the domain onto the range', () => {
    expect(s(0)).toBe(0);
    expect(s(50)).toBe(250);
    expect(s(100)).toBe(500);
  });
  it('inverts', () => {
    expect(s.invert(250)).toBeCloseTo(50, 9);
  });
  it('centres a zero-width domain instead of dividing by zero', () => {
    const flat = linearScale([5, 5], [0, 100]);
    expect(flat(5)).toBe(50);
  });
  it('never returns NaN for a non-finite input', () => {
    expect(Number.isFinite(s(NaN))).toBe(true);
  });
});

describe('logScale', () => {
  const s = logScale([1, 1000], [0, 300]);
  it('spaces decades evenly', () => {
    expect(s(1)).toBeCloseTo(0, 6);
    expect(s(10)).toBeCloseTo(100, 6);
    expect(s(100)).toBeCloseTo(200, 6);
    expect(s(1000)).toBeCloseTo(300, 6);
  });
  it('clamps values at or below zero to the domain floor', () => {
    expect(s(0)).toBe(s(1));
    expect(s(-5)).toBe(s(1));
  });
  it('widens a degenerate domain rather than dividing by zero', () => {
    const flat = logScale([10, 10], [0, 100]);
    expect(Number.isFinite(flat(10))).toBe(true);
  });
  it('inverts', () => {
    expect(s.invert(100)).toBeCloseTo(10, 6);
  });
});

describe('ticks', () => {
  it('emits decade ticks inside a log domain', () => {
    expect(logTicks([1, 1000])).toEqual([1, 10, 100, 1000]);
  });
  it('excludes decades outside the domain', () => {
    expect(logTicks([2, 90])).toEqual([10]);
  });
  it('picks round linear ticks', () => {
    const ticks = niceTicks([0, 100], 5);
    expect(ticks[0]).toBe(0);
    expect(ticks.at(-1)).toBeLessThanOrEqual(100);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i] - ticks[i - 1]).toBeCloseTo(ticks[1] - ticks[0], 6);
    }
  });
  it('degrades gracefully on a zero-width domain', () => {
    expect(niceTicks([7, 7])).toEqual([7]);
  });
});

describe('linePath', () => {
  it('builds a polyline', () => {
    expect(linePath([[0, 0], [10, 5]])).toBe('M 0.00 0.00 L 10.00 5.00');
  });
  it('drops non-finite points instead of emitting NaN', () => {
    expect(linePath([[0, 0], [NaN, 5], [10, 5]])).not.toMatch(/NaN/);
  });
  it('returns an empty string for no points', () => {
    expect(linePath([])).toBe('');
  });
});

describe('zoomViewBox', () => {
  const base = { x: 0, y: 0, w: 100, h: 100 };

  it('zooms in about the focus point', () => {
    const zoomed = zoomViewBox(base, base, 2, 50, 50);
    expect(zoomed.w).toBeCloseTo(50, 9);
    expect(zoomed.x).toBeCloseTo(25, 9);
  });

  it('never zooms out past the base view', () => {
    const out = zoomViewBox(base, base, 0.25, 50, 50);
    expect(out).toEqual(base);
  });

  it('respects the maximum scale', () => {
    let vb = base;
    for (let i = 0; i < 20; i++) vb = zoomViewBox(vb, base, 2, 50, 50, 1, 8);
    expect(vb.w).toBeCloseTo(100 / 8, 9);
  });

  it('keeps the view inside the base bounds when panning', () => {
    const vb = clampViewBox({ x: -50, y: 200, w: 50, h: 50 }, base);
    expect(vb.x).toBe(0);
    expect(vb.y).toBe(50);
  });
});

describe('pipeline CSV parsing', () => {
  it('splits a plain row', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('keeps commas inside quoted fields — the form/strength trap', () => {
    expect(parseCsvLine('"01234A","AMOXICILLIN","Capsule, 500 mg","J01CA04"')).toEqual([
      '01234A',
      'AMOXICILLIN',
      'Capsule, 500 mg',
      'J01CA04',
    ]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCsvLine('"say ""hi""",2')).toEqual(['say "hi"', '2']);
  });

  it('preserves empty trailing fields', () => {
    expect(parseCsvLine('a,,')).toEqual(['a', '', '']);
  });

  it('slugifies drug names into stable ids', () => {
    expect(slugify('GLECAPREVIR + PIBRENTASVIR')).toBe('glecaprevir-pibrentasvir');
    expect(slugify('PROGESTERONE (&) ESTRADIOL')).toBe('progesterone-estradiol');
    expect(slugify('ROSUVASTATIN')).toBe('rosuvastatin');
  });
});
