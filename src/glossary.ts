// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// Domain jargon, explained for someone who has never read a PBS report.
// Surfaced through `ℹ` buttons next to every term in the UI (see components/glossary.ts).

export interface GlossaryEntry {
  term: string;
  short: string;
  definition: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  pbs: {
    term: 'PBS',
    short: 'Pharmaceutical Benefits Scheme',
    definition:
      'The Pharmaceutical Benefits Scheme is the Australian Government programme that subsidises prescription medicines. When a medicine is "listed on the PBS", the government pays most of its cost and the patient pays a capped co-payment.',
  },
  rpbs: {
    term: 'RPBS',
    short: 'Repatriation PBS',
    definition:
      'The Repatriation Pharmaceutical Benefits Scheme covers eligible veterans and war widows/widowers through the Department of Veterans’ Affairs. It subsidises everything the PBS does, plus some extra items, and is included in this data.',
  },
  copayment: {
    term: 'Co-payment',
    short: 'the capped amount a patient pays',
    definition:
      'The most a patient pays for a PBS medicine; the government pays the rest. The general co-payment was cut from $42.50 to $30.00 in January 2023 and to $25.00 in January 2026. Concession card holders pay a much smaller amount (around $7.70).',
  },
  underCopayment: {
    term: 'Under co-payment',
    short: 'the medicine cost less than the co-payment',
    definition:
      'A prescription where the medicine’s total price was below the patient’s co-payment, so the government paid nothing and the patient paid the whole (small) amount. These scripts are still PBS prescriptions and still recorded — they just cost the Commonwealth $0. Around a third of all Australian prescriptions are under co-payment.',
  },
  safetyNet: {
    term: 'Safety net',
    short: 'the annual spending cap per household',
    definition:
      'Once a person or family’s PBS spending in a calendar year passes the safety net threshold, their medicines become cheaper (free for concession card holders, concession-priced for everyone else) for the rest of the year. Scripts supplied under this arrangement are flagged separately in the data.',
  },
  concessional: {
    term: 'Concessional',
    short: 'concession card holder',
    definition:
      'A patient holding a Pensioner Concession Card, Health Care Card, Commonwealth Seniors Health Card or DVA card. They pay a much lower co-payment, which means the government carries far more of the cost of their medicines.',
  },
  prescriberBag: {
    term: 'Prescriber bag',
    short: "the doctor's emergency supply",
    definition:
      'Medicines supplied free to doctors to keep on hand for emergency use (formerly called the "doctor’s bag"). There is no patient co-payment, and the government pays the full cost.',
  },
  atc: {
    term: 'ATC classification',
    short: 'the therapeutic family tree',
    definition:
      'The World Health Organization’s Anatomical Therapeutic Chemical system files every medicine under the body system it acts on (level 1, 14 groups such as "Cardiovascular system"), then a therapeutic subgroup (level 2, such as "Lipid modifying agents"), narrowing down to the individual substance at level 5.',
  },
  script: {
    term: 'Prescription',
    short: 'one dispensing of one medicine',
    definition:
      'One supply of one medicine to one patient — what pharmacists call a "script". A repeat counts as another prescription. From September 2023 many common medicines could be dispensed as 60 days’ supply instead of 30, which halves the script count without halving the medicine used.',
  },
  govtContribution: {
    term: 'Government contribution',
    short: 'what the Commonwealth paid',
    definition:
      'The PBS/RPBS subsidy paid by the Australian Government for these prescriptions. It is zero for under co-payment scripts, because no benefit is payable when the medicine costs less than the co-payment.',
  },
  patientContribution: {
    term: 'Patient contribution',
    short: 'what patients actually paid',
    definition:
      'The actual dollars patients handed over at the counter, as recorded by the department since January 2016. This site deliberately uses the actual figure rather than the department’s notional "patient contribution" column, which fills under co-payment scripts with the maximum schedule price instead of what was really paid.',
  },
  costPerScript: {
    term: 'Cost per prescription',
    short: 'total cost ÷ prescriptions',
    definition:
      'The average total cost (government plus patient) of one dispensing of this medicine. It spans more than four orders of magnitude — from under a dollar for a common blood pressure tablet to nearly $30,000 for some rare-disease biologics.',
  },
  section85: {
    term: 'Section 85',
    short: 'ordinary community supply',
    definition:
      'The part of the National Health Act covering medicines dispensed the usual way — a prescription taken to a community pharmacy. Section 100 covers special arrangements such as highly specialised drugs supplied through hospitals. This data includes Section 85 and part of Section 100, but not every Section 100 special arrangement.',
  },
  dateOfSupply: {
    term: 'Date of supply',
    short: 'when the patient got the medicine',
    definition:
      'Prescriptions are counted in the month the pharmacy handed the medicine to the patient, not the month the claim was paid. The department withholds the two most recent months because late claims are still arriving, and warns that the newest months in any release are the least complete.',
  },
  genericName: {
    term: 'Generic name',
    short: 'the active ingredient',
    definition:
      'The PBS records medicines by their active ingredient (for example "atorvastatin"), not by brand. Every brand of the same ingredient and strength is counted together here, which is why one entry can span dozens of PBS item codes.',
  },
};

export function lookup(key: string): GlossaryEntry | undefined {
  return GLOSSARY[key];
}

/** Inline `ℹ` affordance that opens the glossary popover for `key`. */
export function gloss(key: string, label?: string): string {
  const entry = GLOSSARY[key];
  if (!entry) return label ?? key;
  const text = label ?? entry.term;
  return `<span class="glossary-link" data-term="${key}" role="button" tabindex="0" aria-label="What is ${entry.term}?">${text}<span class="glossary-mark" aria-hidden="true">ℹ</span></span>`;
}
