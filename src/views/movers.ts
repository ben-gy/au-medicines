// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import { atcColor } from '../colors';
import { card, esc, segmented, type View } from '../app';
import { count, countFull, growth, money, moneyFull } from '../format';
import { movers, titleCase, type Mover } from '../analysis';
import { logScale } from '../utils/scale';
import { declutter } from '../utils/declutter';
import type { Drug, Metric } from '../types';

const W = 460;
const H = 520;
const PAD = { top: 34, bottom: 30, left: 106, right: 106 };

const METRICS: { value: string; label: string; tip: string }[] = [
  { value: 'scripts', label: 'Prescriptions', tip: 'Change in how often the medicine was dispensed' },
  { value: 'total', label: 'Cost', tip: 'Change in total cost — government plus patients' },
];

/**
 * Slope chart: two 12-month windows on a shared log axis, one line per medicine.
 * Both endpoints stay visible, which a growth-percentage bar chart would hide.
 */
function slopeChart(rows: Mover[], title: string, fmt: (n: number) => string, direction: 'up' | 'down'): string {
  if (!rows.length) return `<div class="slope-col"><h3>${esc(title)}</h3><p class="empty">Nothing qualifies.</p></div>`;

  const values = rows.flatMap((r) => [r.prior, r.current]).filter((v) => v > 0);
  const y = logScale([Math.min(...values), Math.max(...values)], [H - PAD.bottom, PAD.top]);
  const x0 = PAD.left;
  const x1 = W - PAD.right;

  // Dots stay on their true values; the names and change figures beside them get
  // pushed apart, because a log axis routinely stacks several medicines within a
  // couple of pixels and their labels would otherwise overprint each other.
  const labelLeft = declutter(rows.map((r) => y(Math.max(r.prior, 1))), 12, PAD.top, H - PAD.bottom);
  const labelRight = declutter(rows.map((r) => y(Math.max(r.current, 1))), 12, PAD.top, H - PAD.bottom);

  return `
    <div class="slope-col">
      <h3 class="slope-title ${direction}">${esc(title)}</h3>
      <svg viewBox="0 0 ${W} ${H}" class="slope" role="img" aria-label="${esc(title)}">
        <text class="axis-title" x="${x0}" y="${PAD.top - 14}" text-anchor="middle">Previous 12 months</text>
        <text class="axis-title" x="${x1}" y="${PAD.top - 14}" text-anchor="middle">Latest 12 months</text>
        <line class="slope-axis" x1="${x0}" y1="${PAD.top - 4}" x2="${x0}" y2="${H - PAD.bottom + 4}" />
        <line class="slope-axis" x1="${x1}" y1="${PAD.top - 4}" x2="${x1}" y2="${H - PAD.bottom + 4}" />
        ${rows
          .map((r, idx) => {
            const ya = y(Math.max(r.prior, 1));
            const yb = y(Math.max(r.current, 1));
            const la = labelLeft[idx];
            const lb = labelRight[idx];
            const color = atcColor(r.drug.atc1);
            const tip =
              `${titleCase(r.drug.name)}\n` +
              `Previous 12 months: ${fmt(r.prior)}\n` +
              `Latest 12 months: ${fmt(r.current)}\n` +
              `Change: ${growth(r.current, r.prior)}\nClick for the full profile`;
            return `
              <g class="slope-item" data-drug="${esc(r.drug.id)}" tabindex="0" role="button"
                 data-tip="${esc(tip)}" aria-label="${esc(titleCase(r.drug.name))}, ${esc(growth(r.current, r.prior))}">
                <line class="slope-line" x1="${x0}" y1="${ya.toFixed(1)}" x2="${x1}" y2="${yb.toFixed(1)}" stroke="${color}" />
                <circle class="slope-dot" cx="${x0}" cy="${ya.toFixed(1)}" r="3.5" fill="${color}" />
                <circle class="slope-dot" cx="${x1}" cy="${yb.toFixed(1)}" r="3.5" fill="${color}" />
                <polyline class="slope-leader" points="${(x0 - 4).toFixed(1)},${ya.toFixed(1)} ${(x0 - 7).toFixed(
                  1,
                )},${la.toFixed(1)} ${(x0 - 10).toFixed(1)},${la.toFixed(1)}" stroke="${color}" />
                <polyline class="slope-leader" points="${(x1 + 4).toFixed(1)},${yb.toFixed(1)} ${(x1 + 7).toFixed(
                  1,
                )},${lb.toFixed(1)} ${(x1 + 10).toFixed(1)},${lb.toFixed(1)}" stroke="${color}" />
                <text class="slope-name" x="${x0 - 13}" y="${(la + 3.5).toFixed(1)}" text-anchor="end">${esc(
                  clip(titleCase(r.drug.name), 15),
                )}</text>
                <text class="slope-change" x="${x1 + 13}" y="${(lb + 3.5).toFixed(1)}" text-anchor="start" fill="${color}">${esc(
                  growth(r.current, r.prior),
                )}</text>
              </g>`;
          })
          .join('')}
      </svg>
    </div>
  `;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export const moversView: View = {
  id: 'movers',
  label: 'Movers',
  blurb: 'What changed. The medicines rising and falling fastest between the last two twelve-month windows.',

  render(host, ctx) {
    const metric = ctx.pref<Metric>('movers.metric', 'scripts');
    const series = (d: Drug) => (metric === 'total' ? d.mg.map((g, i) => g + d.mp[i]) : d.ms);
    const fmt = (n: number) => (metric === 'total' ? money(n) : count(n));
    const fmtFull = (n: number) => (metric === 'total' ? moneyFull(n) : `${countFull(n)} prescriptions`);

    const { up, down } = movers(ctx.data.drugs, {
      limit: 14,
      series,
      minCurrent: metric === 'total' ? 5e6 : 100000,
      minPrior: metric === 'total' ? 5e6 : 100000,
    });

    host.innerHTML = card({
      title: 'Rising and falling fastest',
      subtitle:
        'Each line joins a medicine’s total for the previous twelve months to its total for the latest twelve. The axis is logarithmic, so a steeper line is a bigger multiple, not a bigger number. Click any line for the full profile.',
      controls: segmented('mmetric', METRICS, metric),
      legend:
        '<span class="legend-note">Only medicines already being dispensed in volume qualify, so a handful of scripts cannot manufacture a dramatic multiple. ' +
        'A fall to zero usually means the item was delisted from the Schedule rather than prescribing stopping.</span>',
      body: `<div class="slope-grid">
        ${slopeChart(up, 'Growing fastest', fmtFull, 'up')}
        ${slopeChart(down, 'Falling fastest', fmtFull, 'down')}
      </div>`,
      scroll: true,
    });

    void fmt;

    host.querySelectorAll<HTMLButtonElement>('[data-mmetric]').forEach((btn) =>
      btn.addEventListener('click', () => {
        ctx.setPref('movers.metric', btn.dataset.mmetric);
        moversView.render(host, ctx);
      }),
    );
    host.querySelectorAll<SVGGElement>('.slope-item').forEach((g) => {
      const open = () => ctx.openDrug(g.getAttribute('data-drug')!);
      g.addEventListener('click', open);
      g.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') open();
      });
    });
  },
};
