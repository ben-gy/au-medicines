#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// Joins the PBS date-of-supply rows (by item code) to the item→drug→ATC5 map and
// rolls them up into the JSON the site reads.
//
// Money model — this is the one thing that is easy to get wrong:
//
//   * GOVT_CONTRIB is the PBS subsidy. It is zero for every under-co-payment
//     script by definition (the medicine cost less than the co-payment, so no
//     benefit was payable).
//   * PATIENT_CONTRIB is only meaningful for ABOVE co-payment rows, where
//     GOVT_CONTRIB + PATIENT_CONTRIB == TOTAL_COST. For UNDER co-payment rows
//     the department fills it with the maximum schedule price, NOT what anyone
//     actually paid — summing it overstates patient spending by ~$300m a year.
//   * PATIENT_NET_CONTRIB is the actual dollars patients handed over, collected
//     for both script types since January 2016.
//
// So: government = sum(GOVT_CONTRIB), patient = sum(PATIENT_NET_CONTRIB),
// total = government + patient. TOTAL_COST is deliberately not used as the
// headline figure.

import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ATC1, ATC2, PATIENT_CAT, PHARMACY_TYPE, DRUG_TYPE } from './atc-names.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'pipeline', 'raw');
const OUT = join(ROOT, 'public', 'data');

/** Split one CSV line, honouring double quotes (form/strength fields contain commas). */
export function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** "202507" → 2 for a base of 202505. Months are stored as a dense index. */
export function monthIndex(months, ym) {
  return months.indexOf(ym);
}

export function monthLabel(ym) {
  const y = ym.slice(0, 4);
  const m = Number(ym.slice(4, 6));
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`;
}

const round = (n) => Math.round(n);
const round2 = (n) => Math.round(n * 100) / 100;

async function loadItemMap() {
  const text = await readFile(join(RAW, 'pbs-item-drug-map.csv'), 'utf8');
  const lines = text.split(/\r?\n/);
  const header = parseCsvLine(lines[0]).map((h) => h.trim().toUpperCase());
  const iItem = header.indexOf('ITEM_CODE');
  const iDrug = header.indexOf('DRUG_NAME');
  const iForm = header.findIndex((h) => h.startsWith('FORM'));
  const iAtc = header.findIndex((h) => h.startsWith('ATC5'));
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const f = parseCsvLine(lines[i]);
    map.set(f[iItem], { drug: (f[iDrug] || '').trim(), form: (f[iForm] || '').trim(), atc5: (f[iAtc] || '').trim() });
  }
  return map;
}

function atcParts(atc5) {
  // ATC5 looks like "N06AB03". Anything that isn't a real ATC code (the PBS uses
  // "Z" for extemporaneous items and "99999Z" for unlisted RPBS items) becomes Z.
  if (!/^[A-Z]\d{2}[A-Z]{2}\d{2}$/.test(atc5)) return { atc1: 'Z', atc2: 'ZZZ' };
  return { atc1: atc5[0], atc2: atc5.slice(0, 3) };
}

async function main() {
  const itemMap = await loadItemMap();
  console.log(`Item map: ${itemMap.size.toLocaleString()} PBS item codes`);

  const files = (await readdir(RAW)).filter((f) => /phrmcy-type\.csv$/.test(f)).sort();
  if (!files.length) throw new Error('No raw date-of-supply CSVs — run collect.mjs first');

  // ── pass 1: collect the month vocabulary so series can be dense arrays ──
  const monthSet = new Set();
  // ── accumulators ──
  const drugs = new Map(); // name → record
  const drugAtcVotes = new Map(); // name → Map<atc5, scripts>
  const rows = { total: 0, unmapped: 0 };

  const getDrug = (name) => {
    let d = drugs.get(name);
    if (!d) {
      d = {
        name,
        scripts: 0, govt: 0, patient: 0,
        underScripts: 0,
        byMonthScripts: new Map(), byMonthGovt: new Map(), byMonthPatient: new Map(),
        byPatientCat: new Map(), byPharmacy: new Map(), byDrugType: new Map(),
        items: new Map(),
      };
      drugs.set(name, d);
    }
    return d;
  };
  const bump = (map, key, scripts, govt, patient) => {
    let v = map.get(key);
    if (!v) { v = { scripts: 0, govt: 0, patient: 0 }; map.set(key, v); }
    v.scripts += scripts; v.govt += govt; v.patient += patient;
  };

  for (const file of files) {
    process.stdout.write(`  reading ${file} …`);
    let n = 0;
    const rl = createInterface({ input: createReadStream(join(RAW, file)), crlfDelay: Infinity });
    let header = null;
    let idx = {};
    for await (const line of rl) {
      if (!line) continue;
      if (!header) {
        header = parseCsvLine(line).map((h) => h.trim().toUpperCase());
        idx = Object.fromEntries(header.map((h, i) => [h, i]));
        continue;
      }
      const f = parseCsvLine(line);
      const ym = f[idx.MONTH_OF_SUPPLY];
      const item = f[idx.ITEM_CODE];
      const scripts = Number(f[idx.PRESCRIPTIONS]) || 0;
      if (!scripts) continue;
      const govt = Number(f[idx.GOVT_CONTRIB]) || 0;
      const patient = Number(f[idx.PATIENT_NET_CONTRIB]) || 0;

      monthSet.add(ym);
      const meta = itemMap.get(item);
      if (!meta || !meta.drug) rows.unmapped++;
      const name = meta && meta.drug ? meta.drug : 'UNMAPPED PBS ITEM';
      const atc5 = meta && meta.atc5 ? meta.atc5 : 'Z';

      const d = getDrug(name);
      d.scripts += scripts; d.govt += govt; d.patient += patient;
      if (f[idx.SCRIPT_TYPE] === 'UNDER CO-PAYMENT') d.underScripts += scripts;

      bump(d.byMonthScripts, ym, scripts, govt, patient);
      bump(d.byPatientCat, f[idx.PATIENT_CAT], scripts, govt, patient);
      bump(d.byPharmacy, f[idx.PHRMCY_TYPE], scripts, govt, patient);
      bump(d.byDrugType, f[idx.DRUG_TYPE], scripts, govt, patient);
      bump(d.items, item, scripts, govt, patient);

      let votes = drugAtcVotes.get(name);
      if (!votes) { votes = new Map(); drugAtcVotes.set(name, votes); }
      votes.set(atc5, (votes.get(atc5) || 0) + scripts);

      rows.total++;
      n++;
    }
    console.log(` ${n.toLocaleString()} rows`);
  }

  const months = [...monthSet].sort();
  console.log(`Months: ${months.length} (${monthLabel(months[0])} → ${monthLabel(months.at(-1))})`);
  console.log(`Rows: ${rows.total.toLocaleString()} (${rows.unmapped.toLocaleString()} with no item-map entry)`);

  const mi = new Map(months.map((m, i) => [m, i]));

  // ── build the drug list ──
  const list = [];
  for (const [name, d] of drugs) {
    const votes = drugAtcVotes.get(name) || new Map();
    let atc5 = 'Z';
    let best = -1;
    for (const [code, s] of votes) if (s > best) { best = s; atc5 = code; }
    const { atc1, atc2 } = atcParts(atc5);

    const ms = new Array(months.length).fill(0);
    const mg = new Array(months.length).fill(0);
    const mp = new Array(months.length).fill(0);
    for (const [ym, v] of d.byMonthScripts) {
      const i = mi.get(ym);
      ms[i] = v.scripts; mg[i] = round(v.govt); mp[i] = round(v.patient);
    }

    const total = d.govt + d.patient;
    list.push({
      id: slugify(name),
      name,
      atc1, atc2, atc5,
      scripts: d.scripts,
      govt: round(d.govt),
      patient: round(d.patient),
      total: round(total),
      cps: d.scripts ? round2(total / d.scripts) : 0,
      underShare: d.scripts ? round2(d.underScripts / d.scripts) : 0,
      items: d.items.size,
      ms, mg, mp,
      _d: d,
    });
  }

  // Unique ids (two generic names can slugify the same after truncation).
  const seen = new Set();
  for (const r of list) {
    let id = r.id || 'item';
    let k = 2;
    while (seen.has(id)) id = `${r.id}-${k++}`;
    seen.add(id);
    r.id = id;
  }

  list.sort((a, b) => b.total - a.total);
  console.log(`Drugs: ${list.length.toLocaleString()}`);

  await rm(join(OUT, 'drugs'), { recursive: true, force: true });
  await mkdir(join(OUT, 'drugs'), { recursive: true });

  // ── per-drug detail chunks (lazily fetched by the drill-down panel) ──
  const breakdown = (map, names) =>
    [...map]
      .map(([k, v]) => ({ key: k, label: names[k] || k, scripts: v.scripts, govt: round(v.govt), patient: round(v.patient) }))
      .sort((a, b) => b.scripts - a.scripts);

  for (const r of list) {
    const d = r._d;
    const detail = {
      id: r.id,
      name: r.name,
      patientCat: breakdown(d.byPatientCat, PATIENT_CAT),
      pharmacy: breakdown(d.byPharmacy, PHARMACY_TYPE),
      drugType: breakdown(d.byDrugType, DRUG_TYPE),
      items: [...d.items]
        .map(([code, v]) => ({
          code,
          form: itemMap.get(code)?.form || '',
          atc5: itemMap.get(code)?.atc5 || '',
          scripts: v.scripts,
          govt: round(v.govt),
          patient: round(v.patient),
        }))
        .sort((a, b) => b.scripts - a.scripts),
    };
    await writeFile(join(OUT, 'drugs', `${r.id}.json`), JSON.stringify(detail));
    delete r._d;
  }

  // ── national monthly series, split by anatomical group ──
  const monthlyByAtc1 = {};
  for (const code of Object.keys(ATC1)) {
    monthlyByAtc1[code] = { scripts: new Array(months.length).fill(0), govt: new Array(months.length).fill(0), patient: new Array(months.length).fill(0) };
  }
  for (const r of list) {
    const b = monthlyByAtc1[r.atc1];
    for (let i = 0; i < months.length; i++) {
      b.scripts[i] += r.ms[i]; b.govt[i] += r.mg[i]; b.patient[i] += r.mp[i];
    }
  }

  // ── anatomical group × patient category matrix ──
  const matrix = {};
  for (const [name, d] of drugs) {
    const votes = drugAtcVotes.get(name) || new Map();
    let atc5 = 'Z', best = -1;
    for (const [code, s] of votes) if (s > best) { best = s; atc5 = code; }
    const { atc1 } = atcParts(atc5);
    matrix[atc1] ??= {};
    for (const [cat, v] of d.byPatientCat) {
      matrix[atc1][cat] ??= { scripts: 0, govt: 0, patient: 0 };
      matrix[atc1][cat].scripts += v.scripts;
      matrix[atc1][cat].govt += v.govt;
      matrix[atc1][cat].patient += v.patient;
    }
  }
  for (const a of Object.values(matrix)) {
    for (const c of Object.values(a)) { c.govt = round(c.govt); c.patient = round(c.patient); }
  }

  const totals = list.reduce(
    (acc, r) => {
      acc.scripts += r.scripts; acc.govt += r.govt; acc.patient += r.patient;
      return acc;
    },
    { scripts: 0, govt: 0, patient: 0 },
  );

  const manifest = JSON.parse(await readFile(join(RAW, 'manifest.json'), 'utf8'));

  await mkdir(OUT, { recursive: true });
  await writeFile(
    join(OUT, 'meta.json'),
    JSON.stringify({
      generated: new Date().toISOString(),
      months,
      monthLabels: months.map(monthLabel),
      drugCount: list.length,
      itemCount: itemMap.size,
      rowCount: rows.total,
      totals: { ...totals, total: totals.govt + totals.patient },
      sources: manifest.files.map((f) => ({ name: f.name, url: f.url })),
      sourcePage: manifest.source,
    }, null, 2),
  );
  await writeFile(join(OUT, 'drugs.json'), JSON.stringify(list));
  await writeFile(join(OUT, 'monthly.json'), JSON.stringify({ months, byAtc1: monthlyByAtc1 }));
  await writeFile(join(OUT, 'matrix.json'), JSON.stringify(matrix));
  await writeFile(
    join(OUT, 'labels.json'),
    JSON.stringify({ atc1: ATC1, atc2: ATC2, patientCat: PATIENT_CAT, pharmacy: PHARMACY_TYPE, drugType: DRUG_TYPE }),
  );

  console.log(
    `Totals: ${(totals.scripts / 1e6).toFixed(1)}m scripts, ` +
      `$${(totals.govt / 1e9).toFixed(2)}bn government, $${(totals.patient / 1e9).toFixed(2)}bn patients`,
  );
}

if (process.argv[1] && process.argv[1].endsWith('aggregate.mjs')) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
