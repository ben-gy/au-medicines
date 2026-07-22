// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import { atcColor, ATC_ORDER } from '../colors';
import { barChart, sparkline, type BarRow } from '../charts';
import { card, esc, segmented, type View } from '../app';
import { count, countFull, money, moneyCents, moneyFull, pct } from '../format';
import { metricValue, titleCase } from '../analysis';
import type { Metric } from '../types';

const METRICS: { value: Metric; label: string; tip: string }[] = [
  { value: 'total', label: 'Total cost', tip: 'Government subsidy plus what patients actually paid' },
  { value: 'govt', label: 'Government', tip: 'PBS and RPBS subsidy paid by the Commonwealth' },
  { value: 'patient', label: 'Patients', tip: 'Actual dollars paid by patients at the counter' },
  { value: 'scripts', label: 'Prescriptions', tip: 'Number of times the medicine was dispensed' },
  { value: 'cps', label: 'Cost per script', tip: 'Average total cost of one dispensing' },
];

export const rankingsView: View = {
  id: 'rankings',
  label: 'Rankings',
  blurb: 'The medicines that dominate — by money or by volume. They are almost entirely different lists.',

  render(host, ctx) {
    const metric = ctx.pref<Metric>('rankings.metric', 'total');
    const group = ctx.pref<string>('rankings.group', 'all');
    const { drugs, labels } = ctx.data;

    const pool = group === 'all' ? drugs : drugs.filter((d) => d.atc1 === group);
    // Cost per script is meaningless for one-off items, so that ranking gets a floor.
    const eligible = metric === 'cps' ? pool.filter((d) => d.scripts >= 1000) : pool;
    const ranked = [...eligible].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)).slice(0, 30);

    const display = (value: number): string => {
      if (metric === 'scripts') return count(value);
      if (metric === 'cps') return moneyCents(value);
      return money(value);
    };

    const rows: BarRow[] = ranked.map((d) => ({
      id: d.id,
      label: titleCase(d.name),
      sub: labels.atc2[d.atc2] ?? labels.atc1[d.atc1] ?? '',
      value: metricValue(d, metric),
      display: display(metricValue(d, metric)),
      color: atcColor(d.atc1),
      spark: sparkline(d.ms, atcColor(d.atc1), { width: 72, height: 20 }),
      tip:
        `${titleCase(d.name)}\n` +
        `${countFull(d.scripts)} prescriptions\n` +
        `Government ${moneyFull(d.govt)} · Patients ${moneyFull(d.patient)}\n` +
        `${moneyCents(d.cps)} per prescription\n` +
        `${labels.atc2[d.atc2] ?? 'Unclassified'}`,
    }));

    const groupOptions = ['all', ...ATC_ORDER.filter((c) => drugs.some((d) => d.atc1 === c))];

    const controls = `
      ${segmented('metric', METRICS as { value: string; label: string; tip: string }[], metric)}
      <label class="select-wrap">
        <span class="sr-only">Therapeutic group</span>
        <select data-group aria-label="Filter by therapeutic group">
          ${groupOptions
            .map(
              (c) =>
                `<option value="${c}"${c === group ? ' selected' : ''}>${
                  c === 'all' ? 'All therapeutic groups' : esc(labels.atc1[c] ?? c)
                }</option>`,
            )
            .join('')}
        </select>
      </label>
    `;

    const totalOfMetric = pool.reduce((t, d) => t + metricValue(d, metric), 0);
    const shownShare = metric === 'cps' ? null : ranked.reduce((t, d) => t + metricValue(d, metric), 0) / (totalOfMetric || 1);

    host.innerHTML = card({
      title: `Top 30 medicines by ${METRICS.find((m) => m.value === metric)!.label.toLowerCase()}`,
      subtitle:
        metric === 'cps'
          ? 'Average cost of a single dispensing, among medicines dispensed at least 1,000 times. Bars are coloured by anatomical group; click any row for the full profile.'
          : `These 30 account for ${pct(shownShare ?? 0)} of ${
              group === 'all' ? 'the national total' : `the ${esc(labels.atc1[group] ?? group)} total`
            }. Bars are coloured by anatomical group; click any row for the full profile.`,
      controls,
      body: ranked.length
        ? barChart(rows)
        : '<p class="empty">No medicines match this filter.</p>',
    });

    host.querySelectorAll<HTMLButtonElement>('[data-metric]').forEach((btn) => {
      btn.addEventListener('click', () => {
        ctx.setPref('rankings.metric', btn.dataset.metric);
        rankingsView.render(host, ctx);
      });
    });
    host.querySelector<HTMLSelectElement>('[data-group]')?.addEventListener('change', (e) => {
      ctx.setPref('rankings.group', (e.target as HTMLSelectElement).value);
      rankingsView.render(host, ctx);
    });
    host.querySelectorAll<HTMLButtonElement>('[data-drug]').forEach((btn) => {
      btn.addEventListener('click', () => ctx.openDrug(btn.dataset.drug!));
    });
  },
};
