// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import { atcColor, ATC_COLORS, ATC_ORDER } from '../colors';
import { atcLegend, card, esc, segmented, type View } from '../app';
import { count, money, monthShort, monthLong } from '../format';
import { niceTicks } from '../utils/scale';

const W = 1120;
const H = 560;
const M = { top: 72, right: 24, bottom: 52, left: 76 };

const METRICS: { value: string; label: string; tip: string }[] = [
  { value: 'scripts', label: 'Prescriptions', tip: 'Number of dispensings each month' },
  { value: 'govt', label: 'Government cost', tip: 'Monthly PBS/RPBS subsidy' },
  { value: 'patient', label: 'Patient cost', tip: 'Monthly out-of-pocket spending' },
];

/**
 * Policy events worth marking. Prescription counts move for administrative
 * reasons as often as clinical ones, and a reader who does not know that will
 * misread the 2023 step change entirely.
 */
const EVENTS: { month: string; label: string; detail: string }[] = [
  {
    month: '202301',
    label: 'Co-payment cut to $30',
    detail: 'The general co-payment fell from $42.50 to $30.00 on 1 January 2023, the first cut in the scheme’s history.',
  },
  {
    month: '202309',
    label: '60-day dispensing begins',
    detail:
      'From 1 September 2023 many common medicines could be dispensed as 60 days’ supply in one go, phased in across three tranches. This halves the prescription count for an affected medicine without changing how much medicine anyone takes.',
  },
  {
    month: '202601',
    label: 'Co-payment cut to $25',
    detail: 'The general co-payment fell again, from $31.60 to $25.00, on 1 January 2026.',
  },
];

export const trendsView: View = {
  id: 'trends',
  label: 'Trends',
  blurb: 'Sixty-nine months of dispensing, stacked by body system and marked with the policy changes that moved the line.',

  render(host, ctx) {
    const metric = ctx.pref<'scripts' | 'govt' | 'patient'>('trends.metric', 'scripts');
    const isolated = ctx.pref<string>('trends.group', 'all');
    const { monthly, labels, meta } = ctx.data;
    const months = monthly.months;

    const groups = ATC_ORDER.filter((c) => monthly.byAtc1[c] && monthly.byAtc1[c][metric].some((v) => v > 0));
    const shown = isolated === 'all' ? groups : groups.filter((g) => g === isolated);

    const monthTotals = months.map((_, i) => shown.reduce((t, g) => t + monthly.byAtc1[g][metric][i], 0));
    const yMax = Math.max(...monthTotals, 1);
    const plotW = W - M.left - M.right;
    const plotH = H - M.top - M.bottom;
    const bw = plotW / months.length;
    const yOf = (v: number) => M.top + plotH - (v / yMax) * plotH;
    const fmt = (v: number) => (metric === 'scripts' ? count(v) : money(v));

    const bars: string[] = [];
    for (let i = 0; i < months.length; i++) {
      let acc = 0;
      for (const g of shown) {
        const v = monthly.byAtc1[g][metric][i];
        if (v <= 0) continue;
        const y0 = yOf(acc + v);
        const y1 = yOf(acc);
        acc += v;
        bars.push(
          `<rect class="stack-seg" x="${(M.left + i * bw).toFixed(2)}" y="${y0.toFixed(2)}"
             width="${Math.max(0.6, bw - 0.7).toFixed(2)}" height="${Math.max(0.4, y1 - y0).toFixed(2)}"
             fill="${atcColor(g)}" data-group="${g}"
             data-tip="${esc(
               `${labels.atc1[g] ?? g}\n${monthLong(months[i])}\n${fmt(v)}\n${((v / (monthTotals[i] || 1)) * 100).toFixed(
                 1,
               )}% of that month`,
             )}" />`,
        );
      }
    }

    const ticks = niceTicks([0, yMax], 5);
    // Events that fall close together (the January 2023 co-payment cut and the
    // September 2023 dispensing change are eight months apart) would overprint
    // each other on one line, so consecutive labels alternate between two rows.
    const visibleEvents = EVENTS.filter((e) => months.includes(e.month));
    const eventMarks = visibleEvents.map((e, n) => {
      const i = months.indexOf(e.month);
      const x = M.left + i * bw + bw / 2;
      const prev = visibleEvents[n - 1];
      const crowded = prev !== undefined && (i - months.indexOf(prev.month)) * bw < 190;
      const row = crowded ? 1 : 0;
      const dotY = M.top - 26 + row * 15;
      const textY = M.top - 34 + row * 15;
      const anchor = i > months.length * 0.82 ? 'end' : i < months.length * 0.1 ? 'start' : 'middle';
      return `
        <g class="event-mark" data-tip="${esc(`${e.label}\n${monthLong(e.month)}\n${e.detail}`)}" tabindex="0" role="img"
           aria-label="${esc(e.label)}, ${esc(monthLong(e.month))}">
          <line x1="${x.toFixed(1)}" y1="${dotY}" x2="${x.toFixed(1)}" y2="${H - M.bottom}" />
          <circle cx="${x.toFixed(1)}" cy="${dotY}" r="4" />
          <text x="${x.toFixed(1)}" y="${textY}" text-anchor="${anchor}">${esc(e.label)}</text>
        </g>`;
    });

    const everyNth = Math.max(1, Math.round(months.length / 12));

    host.innerHTML = card({
      title: `Monthly ${metric === 'scripts' ? 'prescriptions' : metric === 'govt' ? 'government spending' : 'patient spending'}`,
      subtitle: `Every month from ${meta.monthLabels[0]} to ${meta.monthLabels.at(-1)}, stacked by the body system each medicine acts on. Hover any block for exact figures; click a legend swatch to isolate one group.`,
      controls: segmented('tmetric', METRICS, metric),
      legend: `${atcLegend(labels.atc1, ATC_COLORS, groups)}${
        isolated !== 'all' ? '<button type="button" class="chip-clear" data-clear>Show all groups</button>' : ''
      }`,
      body: `
        <div class="trend-wrap">
          <svg viewBox="0 0 ${W} ${H}" class="trend" role="img"
               aria-label="Stacked monthly ${metric} by therapeutic group">
            ${ticks
              .map(
                (t) =>
                  `<line class="grid-line" x1="${M.left}" y1="${yOf(t).toFixed(1)}" x2="${W - M.right}" y2="${yOf(t).toFixed(1)}" />
                   <text class="axis-label" x="${M.left - 10}" y="${(yOf(t) + 4).toFixed(1)}" text-anchor="end">${esc(fmt(t))}</text>`,
              )
              .join('')}
            ${bars.join('')}
            ${eventMarks.join('')}
            ${months
              .map((m, i) =>
                i % everyNth === 0
                  ? `<text class="axis-label" x="${(M.left + i * bw + bw / 2).toFixed(1)}" y="${H - M.bottom + 18}"
                       text-anchor="middle">${esc(monthShort(m))}</text>`
                  : '',
              )
              .join('')}
            <line class="axis-line" x1="${M.left}" y1="${H - M.bottom}" x2="${W - M.right}" y2="${H - M.bottom}" />
          </svg>
        </div>
        <p class="chart-note">
          The step down from September 2023 is 60-day dispensing, not people taking less medicine: one visit to the pharmacy now
          covers two months for many common medicines, so the prescription count falls while the volume supplied does not.
        </p>
      `,
      scroll: true,
    });

    host.querySelectorAll<HTMLButtonElement>('[data-tmetric]').forEach((btn) =>
      btn.addEventListener('click', () => {
        ctx.setPref('trends.metric', btn.dataset.tmetric);
        trendsView.render(host, ctx);
      }),
    );
    host.querySelector<HTMLButtonElement>('[data-clear]')?.addEventListener('click', () => {
      ctx.setPref('trends.group', 'all');
      trendsView.render(host, ctx);
    });
    host.querySelectorAll<HTMLElement>('.legend-item').forEach((item, i) => {
      item.classList.add('clickable');
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      const toggle = () => {
        const code = groups[i];
        ctx.setPref('trends.group', ctx.pref<string>('trends.group', 'all') === code ? 'all' : code);
        trendsView.render(host, ctx);
      };
      item.addEventListener('click', toggle);
      item.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') toggle();
      });
    });
    // Clicking a stacked block isolates that group — the same affordance as the legend.
    host.querySelectorAll<SVGRectElement>('.stack-seg').forEach((seg) => {
      seg.addEventListener('click', () => {
        const code = seg.getAttribute('data-group')!;
        ctx.setPref('trends.group', ctx.pref<string>('trends.group', 'all') === code ? 'all' : code);
        trendsView.render(host, ctx);
      });
    });
  },
};
