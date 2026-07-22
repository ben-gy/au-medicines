#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// Downloads the PBS "Date of Supply" supplementary reports (one CSV per
// financial year, monthly rows by PBS item code) plus the item→drug→ATC5 map.
//
// The file names carry their year range, so we discover them from the index
// page rather than hard-coding a list that would silently go stale each July.
// Discovery is by content pattern (`*-phrmcy-type.csv`), not by position.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'pipeline', 'raw');

const INDEX_URL = 'https://www.pbs.gov.au/statistics/dos-and-dop/dos-and-dop';
const BASE = 'https://www.pbs.gov.au';
// The department's WAF rejects non-browser user agents.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,*/*' } });
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return res.text();
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return buf.length;
}

async function main() {
  await mkdir(RAW, { recursive: true });

  console.log(`Fetching index: ${INDEX_URL}`);
  const html = await fetchText(INDEX_URL);

  const hrefs = [...html.matchAll(/href="([^"]+\.csv)"/gi)].map((m) => m[1]);
  const dosFiles = [...new Set(hrefs.filter((h) => /dos-.*phrmcy-type\.csv$/i.test(h)))];
  const mapFile = hrefs.find((h) => /pbs-item-drug-map\.csv$/i.test(h));

  if (dosFiles.length === 0) throw new Error('No date-of-supply CSVs found on the index page — layout changed?');
  if (!mapFile) throw new Error('No pbs-item-drug-map.csv found on the index page — layout changed?');

  const manifest = { fetched: new Date().toISOString(), source: INDEX_URL, files: [] };

  for (const href of [mapFile, ...dosFiles.sort()]) {
    const name = href.split('/').pop();
    const url = href.startsWith('http') ? href : BASE + href;
    const bytes = await download(url, join(RAW, name));
    console.log(`  ${name.padEnd(44)} ${(bytes / 1e6).toFixed(1)} MB`);
    manifest.files.push({ name, url, bytes });
  }

  await writeFile(join(RAW, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Downloaded ${manifest.files.length} files.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
