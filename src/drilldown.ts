import { loadDetail } from './data';
import { atcColor } from './colors';
import { esc } from './app';
import { splitBar, sparkline } from './charts';
import { count, countFull, money, moneyCents, moneyFull, monthLong, monthShort, pct, growth } from './format';
import { titleCase, windowPair, metricValue } from './analysis';
import { gloss } from './glossary';
import { niceTicks } from './utils/scale';
import type { Dataset, Drug } from './types';

const CW = 640;
const CH = 200;
const CM = { top: 14, right: 12, bottom: 30, left: 58 };

let overlay: HTMLDivElement | null = null;
let panel: HTMLElement | null = null;
let controller: AbortController | null = null;

export function initDrilldown(): void {
  overlay = document.createElement('div');
  overlay.className = 'drill-overlay';
  overlay.innerHTML = `<aside class="drill-panel" role="dialog" aria-modal="true" aria-label="Medicine details" tabindex="-1"></aside>`;
  document.body.appendChild(overlay);
  panel = overlay.querySelector('.drill-panel');

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeDrilldown();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay?.classList.contains('open')) closeDrilldown();
  });
}

export function closeDrilldown(): void {
  controller?.abort();
  controller = null;
  overlay?.classList.remove('open');
  document.body.classList.remove('drill-open');
  if (location.hash.startsWith('#drug=')) {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }
}

export async function openDrilldown(id: string, data: Dataset): Promise<void> {
  const drug = data.byId.get(id);
  if (!drug || !panel || !overlay) return;

  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;

  overlay.classList.add('open');
  document.body.classList.add('drill-open');
  panel.scrollTop = 0;
  panel.innerHTML = header(drug, data) + '<div class="drill-loading">Loading the full profile…</div>';
  bindClose();
  panel.focus();

  try {
    const detail = await loadDetail(id, signal);
    if (signal.aborted) return;
    panel.innerHTML = header(drug, data) + bodyHtml(drug, detail, data);
    bindClose();
  } catch (err) {
    if (signal.aborted || (err as Error)?.name === 'AbortError') return;
    panel.innerHTML =
      header(drug, data) +
      `<div class="drill-error">
         <p>Could not load the detailed breakdown for this medicine.</p>
         <button type="button" class="btn" data-retry>Try again</button>
       </div>`;
    bindClose();
    panel.querySelector('[data-retry]')?.addEventListener('click', () => void openDrilldown(id, data));
  }
}

function bindClose(): void {
  panel?.querySelector('[data-close]')?.addEventListener('click', closeDrilldown);
}

function rankOf(drug: Drug, drugs: Drug[], key: 'total' | 'scripts' | 'govt'): number {
  return drugs.filter((d) => metricValue(d, key) > metricValue(drug, key)).length + 1;
}

function header(drug: Drug, data: Dataset): string {
  const { labels, drugs } = data;
  return `
    <header class="drill-head" style="--group:${atcColor(drug.atc1)}">
      <button type="button" class="drill-close" data-close aria-label="Close details">×</button>
      <p class="drill-eyebrow">${esc(labels.atc1[drug.atc1] ?? 'Unclassified')}</p>
      <h2>${esc(titleCase(drug.name))}</h2>
      <p class="drill-sub">${esc(labels.atc2[drug.atc2] ?? 'Unclassified')} · ATC ${esc(drug.atc5)} ·
        ${drug.items} PBS ${drug.items === 1 ? 'item' : 'items'}</p>
      <div class="drill-stats">
        <div data-tip="${esc(`${countFull(drug.scripts)} prescriptions`)}">
          <b>${count(drug.scripts)}</b><span>prescriptions</span><i>#${rankOf(drug, drugs, 'scripts')} nationally</i>
        </div>
        <div data-tip="${esc(`${moneyFull(drug.total)} total cost`)}">
          <b>${money(drug.total)}</b><span>total cost</span><i>#${rankOf(drug, drugs, 'total')} nationally</i>
        </div>
        <div data-tip="${esc(`${moneyFull(drug.govt)} paid by the Commonwealth`)}">
          <b>${money(drug.govt)}</b><span>government</span><i>${pct(drug.govt / Math.max(1, drug.total))} of cost</i>
        </div>
        <div data-tip="Average total cost of one dispensing">
          <b>${moneyCents(drug.cps)}</b><span>per script</span><i>${
            drug.cps > 1000 ? 'high-cost medicine' : drug.cps < 20 ? 'low-cost medicine' : 'mid-range'
          }</i>
        </div>
      </div>
    </header>
  `;
}

/** Monthly bars with a real time axis, used for both scripts and cost. */
function monthlyChart(values: number[], months: string[], color: string, fmt: (n: number) => string, label: string): string {
  const max = Math.max(...values, 1);
  const plotW = CW - CM.left - CM.right;
  const plotH = CH - CM.top - CM.bottom;
  const bw = plotW / values.length;
  const ticks = niceTicks([0, max], 3);
  const everyNth = Math.max(1, Math.round(values.length / 8));
  return `
    <svg viewBox="0 0 ${CW} ${CH}" class="mini-chart" role="img" aria-label="${esc(label)}">
      ${ticks
        .map(
          (t) =>
            `<line class="grid-line" x1="${CM.left}" y1="${(CM.top + plotH - (t / max) * plotH).toFixed(1)}"
                   x2="${CW - CM.right}" y2="${(CM.top + plotH - (t / max) * plotH).toFixed(1)}" />
             <text class="axis-label" x="${CM.left - 8}" y="${(CM.top + plotH - (t / max) * plotH + 4).toFixed(1)}"
                   text-anchor="end">${esc(fmt(t))}</text>`,
        )
        .join('')}
      ${values
        .map((v, i) => {
          const h = (v / max) * plotH;
          return `<rect class="mini-bar" x="${(CM.left + i * bw + 0.5).toFixed(2)}" y="${(CM.top + plotH - h).toFixed(2)}"
                    width="${Math.max(0.8, bw - 1).toFixed(2)}" height="${Math.max(0.4, h).toFixed(2)}" fill="${color}"
                    data-tip="${esc(`${monthLong(months[i])}\n${fmt(v)}`)}" />`;
        })
        .join('')}
      ${months
        .map((m, i) =>
          i % everyNth === 0
            ? `<text class="axis-label" x="${(CM.left + i * bw + bw / 2).toFixed(1)}" y="${CH - 10}" text-anchor="middle">${esc(
                monthShort(m),
              )}</text>`
            : '',
        )
        .join('')}
      <line class="axis-line" x1="${CM.left}" y1="${CM.top + plotH}" x2="${CW - CM.right}" y2="${CM.top + plotH}" />
    </svg>
  `;
}

function breakdownRows(
  rows: { key: string; label: string; scripts: number; govt: number; patient: number }[],
  color: string,
): string {
  const total = rows.reduce((t, r) => t + r.scripts, 0) || 1;
  return `
    <ul class="breakdown">
      ${rows
        .map(
          (r) => `<li data-tip="${esc(
            `${r.label}\n${countFull(r.scripts)} prescriptions\nGovernment ${moneyFull(r.govt)}\nPatients ${moneyFull(r.patient)}`,
          )}">
            <span class="breakdown-label">${esc(r.label)}</span>
            <span class="breakdown-track"><i style="width:${((r.scripts / total) * 100).toFixed(2)}%;background:${color}"></i></span>
            <span class="breakdown-value">${esc(pct(r.scripts / total))}</span>
          </li>`,
        )
        .join('')}
    </ul>
  `;
}

function bodyHtml(drug: Drug, detail: Awaited<ReturnType<typeof loadDetail>>, data: Dataset): string {
  const months = data.meta.months;
  const color = atcColor(drug.atc1);
  const cost = drug.mg.map((g, i) => g + drug.mp[i]);
  const pair = windowPair(drug.ms);
  const cpsSeries = drug.ms.map((s, i) => (s > 0 ? cost[i] / s : 0));

  return `
    <div class="drill-body">
      <section>
        <h3>Prescriptions each month</h3>
        <p class="drill-note">
          ${count(pair.current)} in the last 12 months against ${count(pair.prior)} the year before
          (<b class="${pair.ratio >= 1 ? 'up' : 'down'}">${esc(growth(pair.current, pair.prior))}</b>).
        </p>
        ${monthlyChart(drug.ms, months, color, count, `Monthly prescriptions of ${drug.name}`)}
      </section>

      <section>
        <h3>Cost each month</h3>
        <p class="drill-note">Government subsidy plus what patients paid, by month of supply.</p>
        ${monthlyChart(cost, months, color, money, `Monthly cost of ${drug.name}`)}
      </section>

      <section>
        <h3>Cost per prescription over time</h3>
        <p class="drill-note">
          ${
            cpsSeries.filter(Boolean).length > 1 &&
            Math.max(...cpsSeries.filter(Boolean)) / Math.max(1e-9, Math.min(...cpsSeries.filter(Boolean))) > 1.5
              ? 'This has moved materially — usually a price disclosure cut, a new brand entering, or a change in pack size.'
              : 'This has stayed broadly flat across the period.'
          }
        </p>
        ${monthlyChart(cpsSeries, months, color, (n) => moneyCents(n), `Cost per prescription of ${drug.name}`)}
      </section>

      <section>
        <h3>Who paid</h3>
        ${splitBar([
          {
            value: drug.govt,
            color: '#0f766e',
            label: 'Government',
            tip: `Government contribution\n${moneyFull(drug.govt)}\n${pct(drug.govt / Math.max(1, drug.total))} of total cost`,
          },
          {
            value: drug.patient,
            color: '#c2410c',
            label: 'Patients',
            tip: `Patient contribution\n${moneyFull(drug.patient)}\n${pct(drug.patient / Math.max(1, drug.total))} of total cost`,
          },
        ])}
        <p class="drill-note">
          ${pct(drug.underShare)} of these prescriptions were ${gloss('underCopayment', 'under co-payment')}, meaning the
          Commonwealth paid nothing towards them.
        </p>
      </section>

      <section>
        <h3>Patient category</h3>
        <p class="drill-note">Who the medicine was dispensed to. ${gloss('concessional', 'Concessional')} patients hold a
          pension or health care card; ${gloss('safetyNet', 'safety net')} means they had already passed the annual threshold.</p>
        ${breakdownRows(detail.patientCat, color)}
      </section>

      <section>
        <h3>Where it was dispensed</h3>
        ${breakdownRows(detail.pharmacy, color)}
      </section>

      <section>
        <h3>PBS items</h3>
        <p class="drill-note">The individual listings — strengths, forms and pack sizes — that make up this medicine.</p>
        <div class="scroll-x">
          <table class="data-table compact">
            <thead>
              <tr><th>Item</th><th>Form and strength</th><th class="num">Prescriptions</th><th class="num">Government</th><th class="num">Patients</th></tr>
            </thead>
            <tbody>
              ${detail.items
                .slice(0, 60)
                .map(
                  (it) => `<tr>
                    <td class="mono">${esc(it.code)}</td>
                    <td>${esc(it.form || '—')}</td>
                    <td class="num">${count(it.scripts)}</td>
                    <td class="num">${money(it.govt)}</td>
                    <td class="num">${money(it.patient)}</td>
                  </tr>`,
                )
                .join('')}
            </tbody>
          </table>
        </div>
        ${detail.items.length > 60 ? `<p class="table-note">Showing the 60 largest of ${detail.items.length} items.</p>` : ''}
      </section>

      <section class="drill-similar">
        <h3>Others in ${esc(data.labels.atc2[drug.atc2] ?? 'this class')}</h3>
        <ul class="chip-list">
          ${data.drugs
            .filter((d) => d.atc2 === drug.atc2 && d.id !== drug.id)
            .sort((a, b) => b.total - a.total)
            .slice(0, 12)
            .map(
              (d) =>
                `<li><button type="button" class="chip" data-drug="${esc(d.id)}"
                   data-tip="${esc(`${titleCase(d.name)}\n${moneyFull(d.total)}\n${countFull(d.scripts)} prescriptions`)}">
                   <i style="background:${atcColor(d.atc1)}"></i>${esc(titleCase(d.name))}
                   <em>${esc(money(d.total))}</em></button></li>`,
            )
            .join('') || '<li class="empty">No other medicine shares this class.</li>'}
        </ul>
        <div class="drill-spark">${sparkline(drug.ms, color, { width: 220, height: 34 })}</div>
      </section>
    </div>
  `;
}
