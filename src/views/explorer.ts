// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import { atcColor, ATC_ORDER } from '../colors';
import { sparkline } from '../charts';
import { card, esc, type View } from '../app';
import { count, moneyCents, money, pct } from '../format';
import { titleCase, windowPair } from '../analysis';
import { growth } from '../format';
import type { Drug } from '../types';

type SortKey = 'name' | 'scripts' | 'govt' | 'patient' | 'total' | 'cps' | 'under' | 'growth';

const COLUMNS: { key: SortKey; label: string; numeric: boolean; tip: string }[] = [
  { key: 'name', label: 'Medicine', numeric: false, tip: 'Generic name (the active ingredient) and its therapeutic subgroup' },
  { key: 'scripts', label: 'Prescriptions', numeric: true, tip: 'Total dispensings across the whole period' },
  { key: 'govt', label: 'Government', numeric: true, tip: 'PBS/RPBS subsidy paid by the Commonwealth' },
  { key: 'patient', label: 'Patients', numeric: true, tip: 'Actual dollars paid by patients' },
  { key: 'total', label: 'Total', numeric: true, tip: 'Government plus patient contribution' },
  { key: 'cps', label: 'Per script', numeric: true, tip: 'Average total cost of one dispensing' },
  { key: 'under', label: 'Under co-pay', numeric: true, tip: 'Share of prescriptions that cost the government nothing' },
  { key: 'growth', label: 'Year on year', numeric: true, tip: 'Prescriptions in the last 12 months against the 12 before' },
];

function sortValue(d: Drug, key: SortKey): number | string {
  switch (key) {
    case 'name': return d.name;
    case 'under': return d.underShare;
    case 'growth': {
      const p = windowPair(d.ms);
      return p.prior > 0 ? p.ratio : -1;
    }
    default: return d[key];
  }
}

export const explorerView: View = {
  id: 'explorer',
  label: 'Explorer',
  blurb: 'Every medicine dispensed on the PBS, searchable and sortable. Start typing a name.',

  render(host, ctx) {
    const { drugs, labels, meta } = ctx.data;
    const sort = ctx.pref<SortKey>('explorer.sort', 'total');
    const dir = ctx.pref<'asc' | 'desc'>('explorer.dir', 'desc');
    const group = ctx.pref<string>('explorer.group', 'all');
    const query = ctx.pref<string>('explorer.q', '');

    const groupOptions = ['all', ...ATC_ORDER.filter((c) => drugs.some((d) => d.atc1 === c))];

    host.innerHTML = card({
      title: 'Medicine explorer',
      subtitle: `All ${meta.drugCount.toLocaleString('en-AU')} medicines dispensed between ${meta.monthLabels[0]} and ${meta.monthLabels.at(-1)}. Click a row for the full profile.`,
      controls: `
        <label class="search-wrap">
          <span class="sr-only">Search medicines</span>
          <input type="search" data-search placeholder="Search a medicine…" value="${esc(query)}" autocomplete="off" />
        </label>
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
      `,
      body: '<div data-table-host></div>',
      scroll: false,
    });

    const tableHost = host.querySelector<HTMLElement>('[data-table-host]')!;

    const paint = (): void => {
      const q = ctx.pref<string>('explorer.q', '').trim().toLowerCase();
      const g = ctx.pref<string>('explorer.group', 'all');
      const s = ctx.pref<SortKey>('explorer.sort', 'total');
      const d = ctx.pref<'asc' | 'desc'>('explorer.dir', 'desc');

      let rows = drugs;
      if (g !== 'all') rows = rows.filter((r) => r.atc1 === g);
      if (q) {
        rows = rows.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            (labels.atc2[r.atc2] ?? '').toLowerCase().includes(q) ||
            (labels.atc1[r.atc1] ?? '').toLowerCase().includes(q) ||
            r.atc5.toLowerCase().includes(q),
        );
      }

      const sorted = [...rows].sort((a, b) => {
        const va = sortValue(a, s);
        const vb = sortValue(b, s);
        const cmp = typeof va === 'string' ? String(va).localeCompare(String(vb)) : (va as number) - (vb as number);
        return d === 'asc' ? cmp : -cmp;
      });

      tableHost.innerHTML = `
        <p class="table-count">${sorted.length.toLocaleString('en-AU')} ${sorted.length === 1 ? 'medicine' : 'medicines'}${
          q ? ` matching “${esc(q)}”` : ''
        }</p>
        <div class="scroll-x">
          <table class="data-table">
            <thead>
              <tr>
                ${COLUMNS.map(
                  (c) =>
                    `<th class="${c.numeric ? 'num' : ''} ${s === c.key ? 'sorted' : ''}" data-sort="${c.key}"
                         data-tip="${esc(c.tip)}" role="button" tabindex="0"
                         aria-sort="${s === c.key ? (d === 'asc' ? 'ascending' : 'descending') : 'none'}">
                       ${esc(c.label)}<span class="sort-mark">${s === c.key ? (d === 'asc' ? '▲' : '▼') : ''}</span>
                     </th>`,
                ).join('')}
                <th class="spark-col">Trend</th>
              </tr>
            </thead>
            <tbody>
              ${
                sorted.length
                  ? sorted
                      .slice(0, 400)
                      .map((r) => row(r, labels))
                      .join('')
                  : `<tr><td colspan="9" class="empty">No medicine matches “${esc(q)}”. Try a generic name such as “metformin”.</td></tr>`
              }
            </tbody>
          </table>
        </div>
        ${
          sorted.length > 400
            ? `<p class="table-note">Showing the first 400 of ${sorted.length.toLocaleString('en-AU')} — narrow the search or change the sort to see the rest.</p>`
            : ''
        }
      `;

      tableHost.querySelectorAll<HTMLElement>('[data-sort]').forEach((th) => {
        const activate = () => {
          const key = th.dataset.sort as SortKey;
          const current = ctx.pref<SortKey>('explorer.sort', 'total');
          const currentDir = ctx.pref<'asc' | 'desc'>('explorer.dir', 'desc');
          ctx.setPref('explorer.sort', key);
          ctx.setPref('explorer.dir', current === key ? (currentDir === 'asc' ? 'desc' : 'asc') : key === 'name' ? 'asc' : 'desc');
          paint();
        };
        th.addEventListener('click', activate);
        th.addEventListener('keydown', (e) => {
          if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
            e.preventDefault();
            activate();
          }
        });
      });
      tableHost.querySelectorAll<HTMLElement>('[data-drug]').forEach((tr) => {
        tr.addEventListener('click', () => ctx.openDrug(tr.dataset.drug!));
        tr.addEventListener('keydown', (e) => {
          if ((e as KeyboardEvent).key === 'Enter') ctx.openDrug(tr.dataset.drug!);
        });
      });
    };

    let debounce = 0;
    host.querySelector<HTMLInputElement>('[data-search]')?.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        ctx.setPref('explorer.q', value);
        paint();
      }, 300);
    });
    host.querySelector<HTMLSelectElement>('[data-group]')?.addEventListener('change', (e) => {
      ctx.setPref('explorer.group', (e.target as HTMLSelectElement).value);
      paint();
    });

    void sort;
    void dir;
    paint();
  },
};

function row(r: Drug, labels: { atc1: Record<string, string>; atc2: Record<string, string> }): string {
  const pair = windowPair(r.ms);
  const g = growth(pair.current, pair.prior);
  const trend = pair.prior > 0 ? (pair.ratio > 1.05 ? 'up' : pair.ratio < 0.95 ? 'down' : 'flat') : 'flat';
  return `
    <tr data-drug="${esc(r.id)}" tabindex="0" role="button" aria-label="${esc(titleCase(r.name))} details">
      <td class="name-cell">
        <span class="dot" style="background:${atcColor(r.atc1)}" data-tip="${esc(labels.atc1[r.atc1] ?? 'Unclassified')}"></span>
        <span class="name-text">
          ${esc(titleCase(r.name))}
          <em>${esc(labels.atc2[r.atc2] ?? 'Unclassified')}</em>
        </span>
      </td>
      <td class="num" data-tip="${esc(r.scripts.toLocaleString('en-AU'))} prescriptions">${count(r.scripts)}</td>
      <td class="num" data-tip="Commonwealth subsidy">${money(r.govt)}</td>
      <td class="num" data-tip="Paid by patients">${money(r.patient)}</td>
      <td class="num strong" data-tip="Government plus patients">${money(r.total)}</td>
      <td class="num" data-tip="Average cost of one dispensing">${moneyCents(r.cps)}</td>
      <td class="num" data-tip="Share of prescriptions below the co-payment">${pct(r.underShare)}</td>
      <td class="num trend-${trend}" data-tip="${esc(count(pair.current))} prescriptions in the last 12 months versus ${esc(
        count(pair.prior),
      )} before">${esc(g)}</td>
      <td class="spark-col">${sparkline(r.ms, atcColor(r.atc1), { width: 84, height: 22 })}</td>
    </tr>
  `;
}
