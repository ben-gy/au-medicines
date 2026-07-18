import { describe, expect, it } from 'vitest';
import { buildInsights, concentration, logHistogram, median, metricValue, movers, windowPair } from '../src/analysis';
import type { Dataset, Drug } from '../src/types';

function drug(partial: Partial<Drug> & { id: string; name: string }): Drug {
  const ms = partial.ms ?? new Array(24).fill(0);
  return {
    atc1: 'N',
    atc2: 'N06',
    atc5: 'N06AB03',
    scripts: ms.reduce((t, v) => t + v, 0),
    govt: 0,
    patient: 0,
    total: 0,
    cps: 0,
    underShare: 0,
    items: 1,
    mg: new Array(ms.length).fill(0),
    mp: new Array(ms.length).fill(0),
    ...partial,
    ms,
  };
}

describe('windowPair', () => {
  it('splits a 24-month series into two 12-month windows', () => {
    const series = [...new Array(12).fill(10), ...new Array(12).fill(20)];
    const pair = windowPair(series);
    expect(pair.prior).toBe(120);
    expect(pair.current).toBe(240);
    expect(pair.ratio).toBe(2);
    expect(pair.delta).toBe(120);
  });

  it('returns a zero ratio rather than Infinity when there is no prior activity', () => {
    const series = [...new Array(12).fill(0), ...new Array(12).fill(5)];
    expect(windowPair(series).ratio).toBe(0);
  });

  it('tolerates a series shorter than two windows', () => {
    const pair = windowPair([1, 2, 3]);
    expect(pair.current).toBe(6);
    expect(pair.prior).toBe(0);
    expect(Number.isFinite(pair.ratio)).toBe(true);
  });

  it('handles an empty series', () => {
    expect(windowPair([])).toEqual({ current: 0, prior: 0, ratio: 0, delta: 0 });
  });
});

describe('movers', () => {
  const rising = drug({
    id: 'rising',
    name: 'RISING',
    ms: [...new Array(12).fill(5000), ...new Array(12).fill(30000)],
  });
  const falling = drug({
    id: 'falling',
    name: 'FALLING',
    ms: [...new Array(12).fill(30000), ...new Array(12).fill(5000)],
  });
  const tiny = drug({ id: 'tiny', name: 'TINY', ms: [...new Array(12).fill(1), ...new Array(12).fill(50)] });
  const brandNew = drug({ id: 'new', name: 'NEW', ms: [...new Array(12).fill(0), ...new Array(12).fill(90000)] });

  it('ranks growth and decline separately', () => {
    const { up, down } = movers([rising, falling], { minCurrent: 1000, minPrior: 1000 });
    expect(up.map((m) => m.drug.id)).toEqual(['rising']);
    expect(down.map((m) => m.drug.id)).toEqual(['falling']);
  });

  it('excludes tiny medicines whose multiples are noise', () => {
    const { up } = movers([rising, tiny], { minCurrent: 20000, minPrior: 20000 });
    expect(up.map((m) => m.drug.id)).not.toContain('tiny');
  });

  it('excludes medicines with no prior window, which have no meaningful ratio', () => {
    const { up } = movers([brandNew], { minCurrent: 1000, minPrior: 1000 });
    expect(up).toHaveLength(0);
  });

  it('respects the limit', () => {
    const many = new Array(20).fill(0).map((_, i) =>
      drug({ id: `d${i}`, name: `D${i}`, ms: [...new Array(12).fill(30000), ...new Array(12).fill(30000 + i * 5000)] }),
    );
    expect(movers(many, { limit: 5, minCurrent: 1000, minPrior: 1000 }).up).toHaveLength(5);
  });

  it('can rank on an alternative series', () => {
    const d = drug({ id: 'x', name: 'X', ms: new Array(24).fill(1000) });
    d.mg = [...new Array(12).fill(100), ...new Array(12).fill(400)];
    const { up } = movers([d], { minCurrent: 100, minPrior: 100, series: (r) => r.mg });
    expect(up[0].ratio).toBe(4);
  });

  it('returns empty lists for an empty dataset', () => {
    expect(movers([])).toEqual({ up: [], down: [] });
  });
});

describe('logHistogram', () => {
  const drugs = [0.5, 1, 5, 12, 90, 400, 9000, 28000].map((cps, i) => drug({ id: `d${i}`, name: `D${i}`, cps }));

  it('spans every value in the set', () => {
    const bins = logHistogram(drugs, (d) => d.cps);
    expect(bins.length).toBeGreaterThan(0);
    expect(bins.reduce((t, b) => t + b.count, 0)).toBe(drugs.length);
  });

  it('produces strictly increasing, non-overlapping bins', () => {
    const bins = logHistogram(drugs, (d) => d.cps);
    for (const b of bins) expect(b.to).toBeGreaterThan(b.from);
    for (let i = 1; i < bins.length; i++) expect(bins[i].from).toBeCloseTo(bins[i - 1].to, 6);
  });

  it('keeps the member medicines alongside the counts', () => {
    const bins = logHistogram(drugs, (d) => d.cps);
    const members = bins.flatMap((b) => b.drugs.map((d) => d.id));
    expect(new Set(members).size).toBe(drugs.length);
  });

  it('skips zero and negative values that a log axis cannot place', () => {
    const bins = logHistogram([...drugs, drug({ id: 'zero', name: 'Z', cps: 0 })], (d) => d.cps);
    expect(bins.reduce((t, b) => t + b.count, 0)).toBe(drugs.length);
  });

  it('returns nothing when there is nothing plottable', () => {
    expect(logHistogram([], (d) => d.cps)).toEqual([]);
    expect(logHistogram([drug({ id: 'z', name: 'Z', cps: 0 })], (d) => d.cps)).toEqual([]);
  });
});

describe('concentration and median', () => {
  const drugs = [100, 50, 25, 15, 10].map((total, i) => drug({ id: `d${i}`, name: `D${i}`, total }));

  it('measures the share held by the top n', () => {
    expect(concentration(drugs, 'total', 2)).toBeCloseTo(150 / 200, 9);
  });

  it('returns 1 when n covers everything', () => {
    expect(concentration(drugs, 'total', 99)).toBeCloseTo(1, 9);
  });

  it('returns 0 for an empty or all-zero set rather than NaN', () => {
    expect(concentration([], 'total', 5)).toBe(0);
    expect(concentration([drug({ id: 'z', name: 'Z', total: 0 })], 'total', 1)).toBe(0);
  });

  it('takes the middle value, averaging an even-length set', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe('metricValue', () => {
  const d = drug({ id: 'x', name: 'X', total: 10, govt: 6, patient: 4, cps: 2.5, ms: [7] });
  it('reads each metric off the record', () => {
    expect(metricValue(d, 'total')).toBe(10);
    expect(metricValue(d, 'govt')).toBe(6);
    expect(metricValue(d, 'patient')).toBe(4);
    expect(metricValue(d, 'cps')).toBe(2.5);
    expect(metricValue(d, 'scripts')).toBe(7);
  });
});

describe('buildInsights', () => {
  const drugs: Drug[] = [
    drug({
      id: 'big',
      name: 'BIGDRUG',
      total: 1_000_000_000,
      govt: 900_000_000,
      patient: 100_000_000,
      cps: 5000,
      atc1: 'L',
      ms: [...new Array(12).fill(20000), ...new Array(12).fill(60000)],
    }),
    drug({
      id: 'common',
      name: 'COMMONDRUG',
      total: 100_000_000,
      govt: 10_000_000,
      patient: 90_000_000,
      cps: 12,
      underShare: 0.6,
      atc1: 'C',
      ms: [...new Array(12).fill(900000), ...new Array(12).fill(400000)],
    }),
  ];
  const data: Dataset = {
    meta: {
      generated: '2026-07-18T00:00:00.000Z',
      months: ['202404', '202405'],
      monthLabels: ['Apr 2024', 'May 2024'],
      drugCount: drugs.length,
      itemCount: 10,
      rowCount: 100,
      totals: {
        scripts: drugs.reduce((t, d) => t + d.scripts, 0),
        govt: 910_000_000,
        patient: 190_000_000,
        total: 1_100_000_000,
      },
      sources: [],
      sourcePage: 'https://example.invalid',
    },
    drugs,
    labels: { atc1: { L: 'Cancer', C: 'Cardiovascular' }, atc2: {}, patientCat: {}, pharmacy: {}, drugType: {} },
    monthly: { months: [], byAtc1: {} },
    matrix: {},
    byId: new Map(drugs.map((d) => [d.id, d])),
  };

  const insights = buildInsights(data);

  it('produces a card set', () => {
    expect(insights.length).toBeGreaterThanOrEqual(6);
  });

  it('names the costliest medicine', () => {
    const card = insights.find((i) => i.id === 'biggest');
    expect(card?.title).toContain('Bigdrug');
    expect(card?.drugId).toBe('big');
  });

  it('computes the under-co-payment share from the data rather than hard-coding it', () => {
    const card = insights.find((i) => i.id === 'under-copayment');
    // COMMONDRUG contributes 60% of its scripts; BIGDRUG contributes none.
    const expected = Math.round(((0.6 * drugs[1].scripts) / data.meta.totals.scripts) * 100);
    expect(card?.title).toContain(`${expected}%`);
  });

  it('identifies the medicine patients carry', () => {
    const card = insights.find((i) => i.id === 'self-funded');
    expect(card?.drugId).toBe('common');
  });

  it('routes every card to either a medicine or a view', () => {
    for (const card of insights) {
      expect(Boolean(card.drugId) || Boolean(card.view)).toBe(true);
    }
  });

  it('gives every card a unique id', () => {
    expect(new Set(insights.map((i) => i.id)).size).toBe(insights.length);
  });
});
