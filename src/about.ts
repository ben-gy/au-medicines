// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import { esc } from './app';
import { gloss, GLOSSARY } from './glossary';
import type { Meta } from './types';
import { count, money } from './format';

let modal: HTMLDivElement | null = null;

export function initAbout(meta: Meta): void {
  modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="about-title" tabindex="-1">
      <button type="button" class="modal-close" data-close aria-label="Close">×</button>
      <h2 id="about-title">About this site</h2>

      <p class="modal-lead">
        Every prescription medicine subsidised by the Australian Government, as actually dispensed —
        ${count(meta.totals.scripts)} prescriptions of ${meta.drugCount.toLocaleString('en-AU')} different medicines
        between ${esc(meta.monthLabels[0])} and ${esc(meta.monthLabels.at(-1) ?? '')}, costing
        ${money(meta.totals.govt)} in Commonwealth subsidy and ${money(meta.totals.patient)} out of patients’ pockets.
      </p>

      <h3>Where the data comes from</h3>
      <p>
        The Department of Health and Aged Care publishes ${gloss('dateOfSupply', 'date of supply')} reports for the
        ${gloss('pbs')} and ${gloss('rpbs')}: one row per PBS item code, month, patient category, pharmacy type and script
        type, giving prescriptions dispensed and the money paid. Those reports identify medicines only by a six-character item
        code, so they are joined here to the department’s item–drug map, which supplies the
        ${gloss('genericName', 'generic name')} and the ${gloss('atc', 'ATC classification')}.
      </p>
      <ul class="source-list">
        ${meta.sources
          .map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a></li>`)
          .join('')}
      </ul>
      <p class="modal-note">
        Source page: <a href="${esc(meta.sourcePage)}" target="_blank" rel="noopener">pbs.gov.au date of supply statistics</a>.
        Data last rebuilt ${esc(new Date(meta.generated).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }))}
        from ${meta.rowCount.toLocaleString('en-AU')} source rows across ${meta.itemCount.toLocaleString('en-AU')} PBS item codes.
      </p>

      <h3>How often it updates</h3>
      <p>
        The department republishes the whole report each month, adding one month and restating earlier ones as late pharmacy
        claims arrive. This site re-runs its pipeline monthly to match.
      </p>

      <h3>How the money is counted</h3>
      <p>
        “Government” is the PBS/RPBS subsidy. “Patients” is the actual amount patients paid, which the department records
        separately from a notional figure that assumes everyone paid the full schedule price. For
        ${gloss('underCopayment', 'under co-payment')} prescriptions that distinction matters a great deal: the notional column
        overstates what patients really spent by hundreds of millions of dollars a year, so this site uses the actual figure
        throughout.
      </p>

      <h3>What to be careful about</h3>
      <ul class="caveat-list">
        <li>
          <b>The newest months are incomplete.</b> The department withholds the two most recent months entirely and warns that
          the latest months in any release are still filling in. Treat the right-hand edge of every trend chart as provisional.
        </li>
        <li>
          <b>Prescription counts are not doses.</b> From September 2023 many medicines could be dispensed as 60 days’ supply
          rather than 30, which roughly halves the recorded prescription count without changing how much medicine is taken.
        </li>
        <li>
          <b>Not every subsidised medicine is here.</b> The reports cover ${gloss('section85', 'Section 85')} supply and part of
          Section 100, but not every Section 100 special arrangement — some hospital-supplied and highly specialised drugs sit
          outside this data.
        </li>
        <li>
          <b>Medicines are grouped by active ingredient.</b> Every brand and strength of the same ingredient is counted
          together, so one entry here can span dozens of PBS listings.
        </li>
        <li>
          <b>This is dispensing data, not clinical advice.</b> Nothing here says whether a medicine is right for anyone.
        </li>
      </ul>

      <h3>Glossary</h3>
      <dl class="glossary-list">
        ${Object.values(GLOSSARY)
          .map((g) => `<dt>${esc(g.term)}</dt><dd>${esc(g.definition)}</dd>`)
          .join('')}
      </dl>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal || (e.target as Element).closest('[data-close]')) closeAbout();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAbout();
  });
}

export function openAbout(): void {
  modal?.classList.add('open');
  modal?.querySelector<HTMLElement>('.modal')?.focus();
}

export function closeAbout(): void {
  modal?.classList.remove('open');
}
