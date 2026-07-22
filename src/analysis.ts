// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// Pure analysis over the loaded dataset: rolling windows, movers, distributions
// and the auto-detected insights. Everything here is deterministic and unit-tested.

import type { Dataset, Drug, Metric } from './types';
import { sum } from './format';

export const WINDOW = 12;

export interface WindowPair {
  current: number;
  prior: number;
  ratio: number;
  delta: number;
}

/**
 * Totals for the most recent `window` months and the `window` months before
 * them. Returns a ratio of 0 when there is nothing to compare against, so
 * callers can filter rather than trip over Infinity.
 */
export function windowPair(series: number[], window = WINDOW): WindowPair {
  const n = series.length;
  const current = sum(series, n - window, n);
  const prior = sum(series, n - window * 2, n - window);
  return {
    current,
    prior,
    ratio: prior > 0 ? current / prior : 0,
    delta: current - prior,
  };
}

export interface Mover extends WindowPair {
  drug: Drug;
}

/**
 * Medicines whose volume changed most between the last two 12-month windows.
 * `minCurrent`/`minPrior` keep out the noise from tiny items where a handful of
 * scripts produces a meaningless multiple.
 */
export function movers(
  drugs: Drug[],
  opts: { limit?: number; minCurrent?: number; minPrior?: number; series?: (d: Drug) => number[] } = {},
): { up: Mover[]; down: Mover[] } {
  const limit = opts.limit ?? 12;
  const minCurrent = opts.minCurrent ?? 20000;
  const minPrior = opts.minPrior ?? 20000;
  const pick = opts.series ?? ((d: Drug) => d.ms);

  const scored: Mover[] = [];
  for (const drug of drugs) {
    const pair = windowPair(pick(drug));
    if (pair.prior < minPrior && pair.current < minCurrent) continue;
    if (pair.prior <= 0) continue;
    scored.push({ ...pair, drug });
  }

  const up = scored
    .filter((m) => m.current >= minCurrent && m.ratio > 1)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, limit);
  const down = scored
    .filter((m) => m.prior >= minPrior && m.ratio < 1)
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, limit);
  return { up, down };
}

export function metricValue(drug: Drug, metric: Metric): number {
  switch (metric) {
    case 'govt': return drug.govt;
    case 'patient': return drug.patient;
    case 'scripts': return drug.scripts;
    case 'cps': return drug.cps;
    default: return drug.total;
  }
}

export interface Bin {
  from: number;
  to: number;
  count: number;
  drugs: Drug[];
}

/**
 * Log-spaced histogram of a metric. Cost per prescription spans four orders of
 * magnitude, so linear bins would put 95% of medicines in the first bar.
 */
export function logHistogram(drugs: Drug[], value: (d: Drug) => number, binsPerDecade = 2): Bin[] {
  const values = drugs.map(value).filter((v) => Number.isFinite(v) && v > 0);
  if (!values.length) return [];
  const lo = Math.floor(Math.log10(Math.min(...values)) * binsPerDecade) / binsPerDecade;
  const hi = Math.ceil(Math.log10(Math.max(...values)) * binsPerDecade) / binsPerDecade;
  const step = 1 / binsPerDecade;

  const bins: Bin[] = [];
  for (let e = lo; e < hi - 1e-9; e += step) {
    bins.push({ from: Math.pow(10, e), to: Math.pow(10, e + step), count: 0, drugs: [] });
  }
  if (!bins.length) return [];

  for (const drug of drugs) {
    const v = value(drug);
    if (!Number.isFinite(v) || v <= 0) continue;
    let idx = Math.floor((Math.log10(v) - lo) * binsPerDecade);
    idx = Math.max(0, Math.min(bins.length - 1, idx));
    bins[idx].count++;
    bins[idx].drugs.push(drug);
  }
  return bins;
}

/** Share of a metric held by the top `n` medicines. */
export function concentration(drugs: Drug[], metric: Metric, n: number): number {
  const sorted = [...drugs].sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
  const total = sorted.reduce((t, d) => t + metricValue(d, metric), 0);
  if (total <= 0) return 0;
  const top = sorted.slice(0, n).reduce((t, d) => t + metricValue(d, metric), 0);
  return top / total;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type Severity = 'info' | 'warn' | 'alert';

export interface Insight {
  id: string;
  severity: Severity;
  title: string;
  body: string;
  /** Medicine to open when the card is clicked. */
  drugId?: string;
  /** View to switch to when the card is clicked, when no medicine applies. */
  view?: string;
}

/**
 * Scans the dataset for things worth pointing at. Every number in the copy is
 * computed, never hard-coded, so the cards stay true as the data updates.
 */
export function buildInsights(data: Dataset): Insight[] {
  const { drugs, meta, labels } = data;
  const out: Insight[] = [];
  const fmtMoney = (n: number) => (n >= 1e9 ? `$${(n / 1e9).toFixed(2)} billion` : `$${(n / 1e6).toFixed(0)} million`);
  const fmtCount = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} million` : n.toLocaleString('en-AU'));

  // 1. Cost concentration — how few medicines carry the bill.
  const top20 = concentration(drugs, 'total', 20);
  const byTotal = [...drugs].sort((a, b) => b.total - a.total);
  out.push({
    id: 'concentration',
    severity: 'info',
    title: `20 medicines account for ${(top20 * 100).toFixed(0)}% of all PBS spending`,
    body:
      `${meta.drugCount.toLocaleString('en-AU')} distinct medicines were dispensed over these ${meta.months.length} months, but just 20 of them ` +
      `absorb ${(top20 * 100).toFixed(0)}% of the ${fmtMoney(meta.totals.total)} total. ` +
      `${titleCase(byTotal[0].name)} alone is ${fmtMoney(byTotal[0].total)}.`,
    view: 'hierarchy',
  });

  // 2. The most expensive medicine overall — usually a surprise (an eye injection).
  const biggest = byTotal[0];
  out.push({
    id: 'biggest',
    severity: 'info',
    title: `${titleCase(biggest.name)} is the single costliest medicine on the PBS`,
    body:
      `${fmtMoney(biggest.total)} across ${fmtCount(biggest.scripts)} prescriptions — ${money(biggest.cps)} each. ` +
      `It is classified under ${labels.atc1[biggest.atc1] ?? 'an unclassified group'}.`,
    drugId: biggest.id,
  });

  // 3. Extreme cost per script.
  const dear = [...drugs].filter((d) => d.scripts >= 1000).sort((a, b) => b.cps - a.cps)[0];
  if (dear) {
    out.push({
      id: 'costliest-script',
      severity: 'warn',
      title: `One prescription of ${titleCase(dear.name)} costs ${money(dear.cps)}`,
      body:
        `The dearest medicine per dispensing among those with at least 1,000 prescriptions. ` +
        `${fmtCount(dear.scripts)} prescriptions were supplied, costing ${fmtMoney(dear.total)} in total — ` +
        `the government paid ${((dear.govt / Math.max(1, dear.total)) * 100).toFixed(0)}% of it.`,
      drugId: dear.id,
    });
  }

  // 4. Under co-payment — the scripts that cost the Commonwealth nothing.
  const underScripts = drugs.reduce((t, d) => t + d.scripts * d.underShare, 0);
  const underShare = underScripts / Math.max(1, meta.totals.scripts);
  out.push({
    id: 'under-copayment',
    severity: 'info',
    title: `${(underShare * 100).toFixed(0)}% of prescriptions cost the government nothing`,
    body:
      `${fmtCount(Math.round(underScripts))} prescriptions were dispensed below the co-payment, so no subsidy was payable ` +
      `and the patient paid the whole (small) amount. These still appear in PBS statistics, which is why prescription counts ` +
      `and government spending tell different stories.`,
    view: 'whopays',
  });

  // 5. Medicines patients pay for almost entirely.
  const selfFunded = drugs
    .filter((d) => d.scripts >= 1e6 && d.total > 0)
    .map((d) => ({ d, share: d.patient / d.total }))
    .sort((a, b) => b.share - a.share)[0];
  if (selfFunded) {
    out.push({
      id: 'self-funded',
      severity: 'info',
      title: `Patients pay ${(selfFunded.share * 100).toFixed(0)}% of the cost of ${titleCase(selfFunded.d.name)}`,
      body:
        `Among medicines with more than a million prescriptions, ${titleCase(selfFunded.d.name)} leans hardest on patients: ` +
        `${fmtMoney(selfFunded.d.patient)} from patients against ${fmtMoney(selfFunded.d.govt)} from the Commonwealth. ` +
        `Cheap generics often fall under the co-payment, so the "subsidised" medicine is in practice self-funded.`,
      drugId: selfFunded.d.id,
    });
  }

  // 6/7. Biggest movers in both directions.
  const { up, down } = movers(drugs, { limit: 1, minCurrent: 100000, minPrior: 20000 });
  if (up[0]) {
    out.push({
      id: 'surging',
      severity: 'alert',
      title: `${titleCase(up[0].drug.name)} prescriptions are up ${formatRatio(up[0].ratio)} in a year`,
      body:
        `${fmtCount(up[0].current)} prescriptions in the most recent 12 months against ${fmtCount(up[0].prior)} in the 12 before — ` +
        `the fastest-growing medicine dispensed at scale.`,
      drugId: up[0].drug.id,
    });
  }
  if (down[0]) {
    // A medicine that falls to exactly zero has almost always been delisted from
    // the PBS rather than abandoned by prescribers — saying "demand collapsed"
    // would be the wrong story.
    const stopped = down[0].current === 0;
    out.push({
      id: 'collapsing',
      severity: 'warn',
      title: stopped
        ? `${titleCase(down[0].drug.name)} is no longer being dispensed on the PBS`
        : `${titleCase(down[0].drug.name)} prescriptions have fallen ${((1 - down[0].ratio) * 100).toFixed(0)}%`,
      body: stopped
        ? `${fmtCount(down[0].prior)} prescriptions in the previous 12 months and none at all in the latest 12. ` +
          `A drop to exactly zero normally means the medicine was delisted from the Schedule, not that prescribing stopped — ` +
          `patients may have moved to an alternative brand or strength that carries a different item code.`
        : `Down from ${fmtCount(down[0].prior)} to ${fmtCount(down[0].current)} prescriptions year on year — ` +
          `the sharpest decline among medicines that were being dispensed in volume.`,
      drugId: down[0].drug.id,
    });
  }

  // 8. Where the money sits in the therapeutic tree.
  const byGroup = new Map<string, number>();
  for (const d of drugs) byGroup.set(d.atc1, (byGroup.get(d.atc1) ?? 0) + d.total);
  const topGroup = [...byGroup].sort((a, b) => b[1] - a[1])[0];
  if (topGroup) {
    out.push({
      id: 'top-group',
      severity: 'info',
      title: `${labels.atc1[topGroup[0]] ?? topGroup[0]} is the costliest therapeutic group`,
      body:
        `${fmtMoney(topGroup[1])}, or ${((topGroup[1] / meta.totals.total) * 100).toFixed(0)}% of all spending across the period. ` +
        `Open the hierarchy to see which subgroups and medicines sit inside it.`,
      view: 'hierarchy',
    });
  }

  // 9. Volume versus cost — the two rankings barely overlap.
  const topByScripts = new Set([...drugs].sort((a, b) => b.scripts - a.scripts).slice(0, 20).map((d) => d.id));
  const overlap = byTotal.slice(0, 20).filter((d) => topByScripts.has(d.id)).length;
  out.push({
    id: 'volume-vs-cost',
    severity: 'info',
    title: `Only ${overlap} of the 20 most-prescribed medicines are also in the 20 most expensive`,
    body:
      `The medicines Australians take most often and the medicines that consume the PBS budget are almost entirely different lists. ` +
      `Cheap high-volume generics dominate one; low-volume biologics dominate the other.`,
    view: 'scatter',
  });

  return out;
}

function formatRatio(ratio: number): string {
  return ratio >= 2 ? `${ratio.toFixed(1)}×` : `${((ratio - 1) * 100).toFixed(0)}%`;
}

function money(n: number): string {
  if (n >= 1000) return `$${Math.round(n).toLocaleString('en-AU')}`;
  return `$${n.toFixed(2)}`;
}

export function titleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\bAnd\b/g, 'and')
    .replace(/\bWith\b/g, 'with');
}
