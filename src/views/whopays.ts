import { atcColor, ATC_ORDER, heatColor } from '../colors';
import { splitBar } from '../charts';
import { card, esc, segmented, type View } from '../app';
import { count, countFull, money, moneyFull, pct } from '../format';
import { gloss } from '../glossary';
import { titleCase } from '../analysis';

const CAT_ORDER = ['C1', 'C0', 'G2', 'G1', 'R1', 'R0', 'DB', 'UK'];

const METRICS: { value: string; label: string; tip: string }[] = [
  { value: 'scripts', label: 'Prescriptions', tip: 'Number of dispensings in each cell' },
  { value: 'govt', label: 'Government cost', tip: 'Commonwealth subsidy in each cell' },
  { value: 'patient', label: 'Patient cost', tip: 'Out-of-pocket spending in each cell' },
];

export const whoPaysView: View = {
  id: 'whopays',
  label: 'Who pays',
  blurb:
    'The split between the Commonwealth and the patient — and which body systems lean on concession card holders.',

  render(host, ctx) {
    const metric = ctx.pref<'scripts' | 'govt' | 'patient'>('whopays.metric', 'scripts');
    const { matrix, labels, meta, drugs } = ctx.data;

    const groups = ATC_ORDER.filter((g) => matrix[g]);
    const cats = CAT_ORDER.filter((c) => groups.some((g) => matrix[g]?.[c]));
    const fmt = (v: number) => (metric === 'scripts' ? count(v) : money(v));
    const fmtFull = (v: number) => (metric === 'scripts' ? `${countFull(v)} prescriptions` : moneyFull(v));

    const cell = (g: string, c: string) => matrix[g]?.[c]?.[metric] ?? 0;
    // Normalise per row: the question is "within this body system, who carries
    // it?", not "which body system is biggest" — which the rankings already answer.
    const rowMax = new Map(groups.map((g) => [g, Math.max(...cats.map((c) => cell(g, c)), 1)]));
    const rowTotal = new Map(groups.map((g) => [g, cats.reduce((t, c) => t + cell(g, c), 0)]));

    const underScripts = drugs.reduce((t, d) => t + d.scripts * d.underShare, 0);

    // Medicines where patients carry most of the cost, at real volume.
    const selfFunded = drugs
      .filter((d) => d.scripts >= 500000 && d.total > 0)
      .map((d) => ({ d, share: d.patient / d.total }))
      .sort((a, b) => b.share - a.share)
      .slice(0, 10);

    host.innerHTML = card({
      title: 'Who pays for Australia’s medicines',
      subtitle: `Across ${meta.monthLabels[0]} to ${meta.monthLabels.at(-1)} the Commonwealth paid ${money(
        meta.totals.govt,
      )} and patients paid ${money(meta.totals.patient)} — but the balance shifts sharply between body systems and patient types.`,
      controls: segmented('wmetric', METRICS, metric),
      body: `
        <div class="whopays-top">
          <div class="split-block">
            <h3>The national split</h3>
            ${splitBar([
              {
                value: meta.totals.govt,
                color: '#0f766e',
                label: 'Government',
                tip: `Government contribution\n${moneyFull(meta.totals.govt)}\n${pct(
                  meta.totals.govt / meta.totals.total,
                )} of all spending`,
              },
              {
                value: meta.totals.patient,
                color: '#c2410c',
                label: 'Patients',
                tip: `Patient contribution\n${moneyFull(meta.totals.patient)}\n${pct(
                  meta.totals.patient / meta.totals.total,
                )} of all spending`,
              },
            ])}
            <ul class="split-key">
              <li><i style="background:#0f766e"></i>${gloss('govtContribution', 'Government')} <b>${money(meta.totals.govt)}</b> <span>${pct(
                meta.totals.govt / meta.totals.total,
              )}</span></li>
              <li><i style="background:#c2410c"></i>${gloss('patientContribution', 'Patients')} <b>${money(
                meta.totals.patient,
              )}</b> <span>${pct(meta.totals.patient / meta.totals.total)}</span></li>
            </ul>
            <p class="split-note">
              ${pct(underScripts / Math.max(1, meta.totals.scripts))} of all prescriptions are
              ${gloss('underCopayment', 'under co-payment')} — the medicine cost less than the
              ${gloss('copayment', 'co-payment')}, so the Commonwealth paid nothing at all and the patient paid the lot.
            </p>

            <h3 class="split-second">Prescriptions by who carried the cost</h3>
            ${splitBar([
              {
                value: meta.totals.scripts - underScripts,
                color: '#0f766e',
                label: 'Subsidised',
                tip: `Above co-payment\n${countFull(Math.round(meta.totals.scripts - underScripts))} prescriptions\n${pct(
                  1 - underScripts / Math.max(1, meta.totals.scripts),
                )} of all prescriptions\nThe Commonwealth paid a benefit on these`,
              },
              {
                value: underScripts,
                color: '#c2410c',
                label: 'Under co-payment',
                tip: `Under co-payment\n${countFull(Math.round(underScripts))} prescriptions\n${pct(
                  underScripts / Math.max(1, meta.totals.scripts),
                )} of all prescriptions\nNo government benefit was payable`,
              },
            ])}
            <ul class="split-key">
              <li><i style="background:#0f766e"></i>Subsidised <b>${count(meta.totals.scripts - underScripts)}</b>
                <span>${pct(1 - underScripts / Math.max(1, meta.totals.scripts))}</span></li>
              <li><i style="background:#c2410c"></i>Under co-payment <b>${count(underScripts)}</b>
                <span>${pct(underScripts / Math.max(1, meta.totals.scripts))}</span></li>
            </ul>
            <p class="split-note">
              These two bars disagree on purpose. Under co-payment scripts are a third of the <em>volume</em> but almost none of
              the government’s <em>bill</em> — which is why ranking medicines by prescriptions and by cost produces two
              completely different lists.
            </p>
          </div>
          <div class="selffunded-block">
            <h3>Medicines patients pay for themselves</h3>
            <p class="block-sub">Share of total cost borne by patients, among medicines dispensed more than 500,000 times.</p>
            <ol class="mini-rank">
              ${selfFunded
                .map(
                  (s) => `<li>
                    <button type="button" class="mini-rank-row" data-drug="${esc(s.d.id)}"
                            data-tip="${esc(
                              `${titleCase(s.d.name)}\nPatients ${moneyFull(s.d.patient)}\nGovernment ${moneyFull(
                                s.d.govt,
                              )}\n${countFull(s.d.scripts)} prescriptions\nClick for the full profile`,
                            )}">
                      <i style="background:${atcColor(s.d.atc1)}"></i>
                      <span>${esc(titleCase(s.d.name))}</span>
                      <b>${pct(s.share)}</b>
                    </button>
                  </li>`,
                )
                .join('')}
            </ol>
          </div>
        </div>

        <h3 class="matrix-title">Body system × patient category</h3>
        <p class="block-sub">
          Each row is shaded against its own maximum, so the question is who carries that body system’s medicines — not which
          system is biggest. ${gloss('concessional', 'Concessional')} patients hold a pension or health care card;
          ${gloss('safetyNet', 'safety net')} rows are patients who have already passed the annual threshold.
        </p>
        <div class="scroll-x">
          <table class="matrix">
            <thead>
              <tr>
                <th class="corner">Body system</th>
                ${cats.map((c) => `<th data-tip="${esc(labels.patientCat[c] ?? c)}">${esc(shortCat(labels.patientCat[c] ?? c))}</th>`).join('')}
                <th class="row-total">Total</th>
              </tr>
            </thead>
            <tbody>
              ${groups
                .map(
                  (g) => `<tr>
                    <th class="row-head"><i style="background:${atcColor(g)}"></i>${esc(labels.atc1[g] ?? g)}</th>
                    ${cats
                      .map((c) => {
                        const v = cell(g, c);
                        const share = v / (rowTotal.get(g) || 1);
                        const t = v / (rowMax.get(g) || 1);
                        return `<td class="heat ${t > 0.55 ? 'on-dark' : ''}" style="background:${heatColor(t)}"
                                    data-tip="${esc(
                                      `${labels.atc1[g] ?? g}\n${labels.patientCat[c] ?? c}\n${fmtFull(v)}\n${pct(
                                        share,
                                        1,
                                      )} of this body system`,
                                    )}">${v ? esc(fmt(v)) : '<span class="zero">—</span>'}</td>`;
                      })
                      .join('')}
                    <td class="row-total" data-tip="${esc(`${labels.atc1[g] ?? g}\n${fmtFull(rowTotal.get(g) ?? 0)}`)}">${esc(
                      fmt(rowTotal.get(g) ?? 0),
                    )}</td>
                  </tr>`,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `,
    });

    host.querySelectorAll<HTMLButtonElement>('[data-wmetric]').forEach((btn) =>
      btn.addEventListener('click', () => {
        ctx.setPref('whopays.metric', btn.dataset.wmetric);
        whoPaysView.render(host, ctx);
      }),
    );
    host.querySelectorAll<HTMLElement>('[data-drug]').forEach((el) =>
      el.addEventListener('click', () => ctx.openDrug(el.dataset.drug!)),
    );
  },
};

function shortCat(label: string): string {
  return label.replace(' — ', ' ').replace('Veteran (RPBS)', 'Veteran').replace("Prescriber bag (doctor's bag)", 'Prescriber bag');
}
