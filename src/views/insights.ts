// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import { card, esc, type View } from '../app';
import { buildInsights, logHistogram, titleCase } from '../analysis';
import { count, money, moneyCents } from '../format';
import { atcColor } from '../colors';
import { logScale } from '../utils/scale';

const W = 1020;
const H = 320;
const M = { top: 20, right: 20, bottom: 48, left: 60 };

export const insightsView: View = {
  id: 'insights',
  label: 'Insights',
  blurb: 'What the data says without being asked — outliers, concentrations and the things that changed.',

  render(host, ctx) {
    const { drugs } = ctx.data;
    const cards = buildInsights(ctx.data);
    const selected = ctx.pref<string>('insights.bin', '');

    // Distribution of cost per prescription — the shape that explains why the
    // rankings by cost and by volume disagree.
    const bins = logHistogram(drugs, (d) => d.cps, 2);
    const maxCount = Math.max(...bins.map((b) => b.count), 1);
    const plotW = W - M.left - M.right;
    const plotH = H - M.top - M.bottom;
    const bw = plotW / Math.max(1, bins.length);
    const x = logScale([bins[0]?.from ?? 1, bins.at(-1)?.to ?? 1000], [M.left, W - M.right]);

    const selectedBin = bins.find((b) => `${b.from}` === selected);

    host.innerHTML = card({
      title: 'What stands out',
      subtitle: 'Every figure on these cards is computed from the current data, not written by hand. Click a card to jump to the medicine or view behind it.',
      body: `
        <div class="insight-grid">
          ${cards
            .map(
              (c) => `
            <button type="button" class="insight-card sev-${c.severity}"
                    ${c.drugId ? `data-drug="${esc(c.drugId)}"` : `data-view="${esc(c.view ?? '')}"`}
                    data-tip="${esc(c.drugId ? 'Open this medicine' : `Go to the ${c.view} view`)}">
              <span class="insight-sev">${c.severity === 'alert' ? 'Notable' : c.severity === 'warn' ? 'Watch' : 'Context'}</span>
              <h3>${esc(c.title)}</h3>
              <p>${esc(c.body)}</p>
            </button>`,
            )
            .join('')}
        </div>

        <h3 class="matrix-title">How much a prescription costs</h3>
        <p class="block-sub">
          Every medicine placed by its average cost per dispensing, on a logarithmic axis because the range runs from cents to
          tens of thousands of dollars. Click a bar to list the medicines inside it.
        </p>
        <div class="scroll-x">
          <svg viewBox="0 0 ${W} ${H}" class="histogram" role="img" aria-label="Distribution of cost per prescription">
            ${bins
              .map((b, i) => {
                const h = (b.count / maxCount) * plotH;
                const isSel = `${b.from}` === selected;
                return `<rect class="hist-bar${isSel ? ' selected' : ''}" x="${(M.left + i * bw + 1).toFixed(1)}"
                          y="${(M.top + plotH - h).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}"
                          height="${Math.max(0.5, h).toFixed(1)}" data-bin="${esc(String(b.from))}"
                          tabindex="0" role="button"
                          aria-label="${b.count} medicines costing ${money(b.from)} to ${money(b.to)} per prescription"
                          data-tip="${esc(
                            `${money(b.from)} – ${money(b.to)} per prescription\n${b.count} ${
                              b.count === 1 ? 'medicine' : 'medicines'
                            }\nClick to list them`,
                          )}" />`;
              })
              .join('')}
            ${[0.01, 1, 10, 100, 1000, 10000]
              .filter((t) => t >= (bins[0]?.from ?? 0) && t <= (bins.at(-1)?.to ?? 0))
              .map(
                (t) =>
                  `<text class="axis-label" x="${x(t).toFixed(1)}" y="${H - M.bottom + 20}" text-anchor="middle">${esc(
                    money(t),
                  )}</text>`,
              )
              .join('')}
            <line class="axis-line" x1="${M.left}" y1="${M.top + plotH}" x2="${W - M.right}" y2="${M.top + plotH}" />
            <text class="axis-title" x="${(M.left + W - M.right) / 2}" y="${H - 8}" text-anchor="middle">
              Cost per prescription (log scale) →
            </text>
            <text class="axis-title" x="${-(M.top + plotH / 2)}" y="16" text-anchor="middle" transform="rotate(-90)">Medicines</text>
          </svg>
        </div>
        ${
          selectedBin
            ? `<div class="bin-detail">
                 <h4>${selectedBin.count} ${selectedBin.count === 1 ? 'medicine costs' : 'medicines cost'} ${money(
                   selectedBin.from,
                 )}–${money(selectedBin.to)} per prescription</h4>
                 <ul class="chip-list">
                   ${selectedBin.drugs
                     .sort((a, b) => b.total - a.total)
                     .slice(0, 40)
                     .map(
                       (d) =>
                         `<li><button type="button" class="chip" data-drug="${esc(d.id)}"
                            data-tip="${esc(
                              `${titleCase(d.name)}\n${moneyCents(d.cps)} per prescription\n${count(
                                d.scripts,
                              )} prescriptions\nClick for the full profile`,
                            )}"><i style="background:${atcColor(d.atc1)}"></i>${esc(titleCase(d.name))}</button></li>`,
                     )
                     .join('')}
                 </ul>
                 ${
                   selectedBin.drugs.length > 40
                     ? `<p class="table-note">Showing the 40 largest of ${selectedBin.drugs.length}.</p>`
                     : ''
                 }
                 <button type="button" class="chip-clear" data-clear-bin>Clear selection</button>
               </div>`
            : ''
        }
      `,
    });

    host.querySelectorAll<HTMLElement>('.insight-card').forEach((el) =>
      el.addEventListener('click', () => {
        if (el.dataset.drug) ctx.openDrug(el.dataset.drug);
        else if (el.dataset.view) ctx.setView(el.dataset.view);
      }),
    );
    host.querySelectorAll<SVGRectElement>('.hist-bar').forEach((bar) => {
      const select = () => {
        const key = bar.getAttribute('data-bin')!;
        ctx.setPref('insights.bin', ctx.pref<string>('insights.bin', '') === key ? '' : key);
        insightsView.render(host, ctx);
      };
      bar.addEventListener('click', select);
      bar.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') select();
      });
    });
    host.querySelector<HTMLButtonElement>('[data-clear-bin]')?.addEventListener('click', () => {
      ctx.setPref('insights.bin', '');
      insightsView.render(host, ctx);
    });
    host.querySelectorAll<HTMLElement>('.chip[data-drug]').forEach((chip) =>
      chip.addEventListener('click', () => ctx.openDrug(chip.dataset.drug!)),
    );
  },
};
