// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import { atcColor, ATC_ORDER } from '../colors';
import { card, esc, atcLegend, type View } from '../app';
import { count, countFull, money, moneyCents, moneyFull } from '../format';
import { titleCase } from '../analysis';
import { logScale, logTicks } from '../utils/scale';
import { attachSvgZoom } from '../utils/svgZoom';
import { ATC_COLORS } from '../colors';

const W = 980;
const H = 620;
const M = { top: 24, right: 28, bottom: 56, left: 78 };

export const scatterView: View = {
  id: 'scatter',
  label: 'Cost vs volume',
  blurb:
    'Why the most-prescribed medicines and the most expensive medicines are two different lists — plotted across seven orders of magnitude.',

  render(host, ctx) {
    const { drugs, labels } = ctx.data;
    const highlight = ctx.pref<string>('scatter.group', 'all');

    const points = drugs.filter((d) => d.scripts > 0 && d.cps > 0);
    const x = logScale(
      [Math.max(1, Math.min(...points.map((d) => d.scripts))), Math.max(...points.map((d) => d.scripts))],
      [M.left, W - M.right],
    );
    const y = logScale(
      [Math.max(0.01, Math.min(...points.map((d) => d.cps))), Math.max(...points.map((d) => d.cps))],
      [H - M.bottom, M.top],
    );

    // Diagonals of constant total cost — the real story is that a point's
    // distance from the origin along this diagonal *is* its budget impact.
    const diagonals = [1e6, 1e7, 1e8, 1e9].map((totalCost) => {
      const pts: [number, number][] = [];
      for (const scripts of [x.domain[0], x.domain[1]]) {
        pts.push([x(scripts), y(totalCost / scripts)]);
      }
      return { totalCost, pts };
    });

    const radius = (d: { total: number }) => Math.max(2.2, Math.min(18, Math.sqrt(d.total / 4e6)));

    const body = `
      <div class="scatter-wrap">
        <svg viewBox="0 0 ${W} ${H}" class="scatter" role="img"
             aria-label="Cost per prescription against number of prescriptions, for every PBS medicine">
          <defs>
            <clipPath id="plot-clip"><rect x="${M.left}" y="${M.top}" width="${W - M.left - M.right}" height="${
              H - M.top - M.bottom
            }" /></clipPath>
          </defs>

          ${logTicks(x.domain)
            .map(
              (t) =>
                `<line class="grid-line" x1="${x(t).toFixed(1)}" y1="${M.top}" x2="${x(t).toFixed(1)}" y2="${H - M.bottom}" />
                 <text class="axis-label" x="${x(t).toFixed(1)}" y="${H - M.bottom + 18}" text-anchor="middle">${esc(count(t))}</text>`,
            )
            .join('')}
          ${logTicks(y.domain)
            .map(
              (t) =>
                `<line class="grid-line" x1="${M.left}" y1="${y(t).toFixed(1)}" x2="${W - M.right}" y2="${y(t).toFixed(1)}" />
                 <text class="axis-label" x="${M.left - 10}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end">${esc(money(t))}</text>`,
            )
            .join('')}

          <g clip-path="url(#plot-clip)">
            ${diagonals
              .map(
                (d) =>
                  `<line class="cost-diagonal" x1="${d.pts[0][0].toFixed(1)}" y1="${d.pts[0][1].toFixed(1)}"
                         x2="${d.pts[1][0].toFixed(1)}" y2="${d.pts[1][1].toFixed(1)}" />
                   <text class="diagonal-label" x="${(d.pts[1][0] - 6).toFixed(1)}" y="${(d.pts[1][1] - 6).toFixed(1)}"
                         text-anchor="end">${esc(money(d.totalCost))} total</text>`,
              )
              .join('')}

            ${points
              .map((d) => {
                const dim = highlight !== 'all' && d.atc1 !== highlight;
                return `<circle class="dot${dim ? ' dim' : ''}" cx="${x(d.scripts).toFixed(1)}" cy="${y(d.cps).toFixed(1)}"
                          r="${radius(d).toFixed(1)}" fill="${atcColor(d.atc1)}"
                          data-drug="${esc(d.id)}" tabindex="0" role="button"
                          aria-label="${esc(titleCase(d.name))}, ${esc(moneyCents(d.cps))} per prescription"
                          data-tip="${esc(
                            `${titleCase(d.name)}\n${countFull(d.scripts)} prescriptions\n${moneyCents(
                              d.cps,
                            )} per prescription\n${moneyFull(d.total)} total\n${labels.atc2[d.atc2] ?? 'Unclassified'}`,
                          )}" />`;
              })
              .join('')}
          </g>

          <text class="axis-title" x="${(M.left + (W - M.right)) / 2}" y="${H - 12}" text-anchor="middle">
            Prescriptions dispensed (log scale) →
          </text>
          <text class="axis-title" x="${-(M.top + (H - M.bottom)) / 2}" y="18" text-anchor="middle" transform="rotate(-90)">
            Cost per prescription (log scale) →
          </text>
        </svg>
      </div>
    `;

    host.innerHTML = card({
      title: 'Cost per prescription against volume',
      subtitle:
        'Each dot is one medicine, sized by its total cost. The dotted diagonals mark equal total spending — anything sitting on or above the upper diagonal is a billion-dollar line item, whether it got there through volume or through price.',
      controls: `
        <label class="select-wrap">
          <span class="sr-only">Highlight a therapeutic group</span>
          <select data-highlight aria-label="Highlight a therapeutic group">
            <option value="all"${highlight === 'all' ? ' selected' : ''}>Highlight: all groups</option>
            ${ATC_ORDER.filter((c) => drugs.some((d) => d.atc1 === c))
              .map((c) => `<option value="${c}"${highlight === c ? ' selected' : ''}>${esc(labels.atc1[c] ?? c)}</option>`)
              .join('')}
          </select>
        </label>
      `,
      legend: atcLegend(labels.atc1, ATC_COLORS, ATC_ORDER.filter((c) => drugs.some((d) => d.atc1 === c))),
      body,
    });

    host.querySelector<HTMLSelectElement>('[data-highlight]')?.addEventListener('change', (e) => {
      ctx.setPref('scatter.group', (e.target as HTMLSelectElement).value);
      scatterView.render(host, ctx);
    });
    host.querySelectorAll<SVGCircleElement>('.dot').forEach((dot) => {
      const open = () => ctx.openDrug(dot.getAttribute('data-drug')!);
      dot.addEventListener('click', open);
      dot.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') open();
      });
    });
    host.querySelectorAll<HTMLElement>('.legend-item').forEach((item, i) => {
      const codes = ATC_ORDER.filter((c) => drugs.some((d) => d.atc1 === c));
      item.classList.add('clickable');
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      const toggle = () => {
        const code = codes[i];
        ctx.setPref('scatter.group', ctx.pref<string>('scatter.group', 'all') === code ? 'all' : code);
        scatterView.render(host, ctx);
      };
      item.addEventListener('click', toggle);
      item.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') toggle();
      });
    });

    const svg = host.querySelector<SVGSVGElement>('.scatter');
    if (svg) attachSvgZoom(svg, { maxScale: 12 });
  },
};
