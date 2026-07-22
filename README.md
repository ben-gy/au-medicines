# Prescription Medicines

**Every medicine Australia is prescribed on the PBS — 69 months of scripts, cost and who paid.**

🔗 **Live:** [https://au-medicines.benrichardson.dev](https://au-medicines.benrichardson.dev)

## What is this?

The Australian Government publishes exactly what every subsidised medicine in the country cost and how
often it was dispensed — as six ~30MB CSVs of six-character item codes with no drug names attached, no
interface, and no way to answer a simple question without a join and a pivot table. This site does that
join once: 2,047,223 source rows across 12,119 PBS item codes, resolved to 1,013 generic medicines and
69 months of history from July 2020 to March 2026.

The result is 1.88 billion prescriptions costing $68.27bn in Commonwealth subsidy and $18.28bn out of
patients' own pockets, explorable by medicine, by therapeutic class, by month and by who paid. Some of
what falls out is genuinely surprising: the single costliest medicine on the PBS is **aflibercept**, an
eye injection for macular degeneration, at $2.69bn — ahead of every heart, cancer or diabetes drug.
Menopause hormone therapy is up **43×** in a year after its 2025 listing. And 31% of all Australian
prescriptions are dispensed *under co-payment*, meaning the government pays nothing at all — which is
why the medicines Australians take most often and the medicines that consume the PBS budget are almost
entirely different lists.

Money is counted carefully. The department's notional "patient contribution" column fills every under
co-payment script with the maximum schedule price rather than what anyone actually paid, overstating
patient spending by hundreds of millions a year. This site uses the actual recorded figure instead.

## Who is this for?

Health journalists who need one defensible number and a chart to describe; pharmacy and health-policy
analysts who currently do this join in Excel; and general readers arriving from a news story about a
specific drug who want to see the real curve. Every piece of PBS jargon — co-payment, safety net,
concessional, ATC, Section 85 — carries an inline definition, because most visitors will not know them.

## Data Sources

| Source | What it provides | Update frequency |
|--------|-------------------|-----------------|
| [PBS Date of Supply supplementary reports](https://www.pbs.gov.au/statistics/dos-and-dop/dos-and-dop) | Monthly prescriptions, government and patient contribution, total cost and retail mark-up by PBS item code × patient category × pharmacy type × script type | Monthly (2-month reporting lag) |
| [PBS item drug map](https://www.pbs.gov.au/statistics/dos-and-dop/files/pbs-item-drug-map.csv) | Item code → generic drug name, form/strength, ATC5 code | ~Monthly |
| WHO ATC level 1/2 nomenclature (embedded) | Names for the 14 anatomical groups and ~94 therapeutic subgroups | Static |

## Features

- **Rankings** — every medicine leaderboard by total cost, government spend, patient spend, prescriptions or cost per script, filterable by therapeutic group.
- **Explorer** — searchable, sortable table of all 1,013 medicines with 69-month sparklines and year-on-year change.
- **Therapeutic hierarchy** — a radial partition of the full ATC tree: body system → drug class → medicine. Click a ring to zoom, click a medicine for its profile.
- **Cost vs volume** — log-log scatter across seven orders of magnitude, with diagonals marking equal total spending, plus zoom and pan.
- **Movers** — slope charts of the medicines rising and falling fastest between the last two twelve-month windows, with de-collided labels.
- **Trends** — 69 months stacked by body system, annotated with the policy changes that moved the line (the 2023 and 2026 co-payment cuts, 60-day dispensing).
- **Who pays** — the Commonwealth/patient split, the subsidised/under-co-payment split, the medicines patients fund themselves, and a body-system × patient-category heatmap.
- **Insights** — auto-detected outliers and concentrations, every figure computed from the current data rather than written by hand.
- **Per-medicine drill-down** — hash-linkable panel with national rank, monthly prescriptions, monthly cost, cost-per-script trend, patient-category and pharmacy mix, and the PBS items behind it.

## Tech Stack

- **Runtime:** Vanilla TypeScript
- **Build:** Vite 6
- **Testing:** Vitest (108 tests, including positional layout assertions for the sunburst and label de-collision)
- **Hosting:** GitHub Pages (static, no backend)
- **Data:** GitHub Actions pipeline, monthly
- No chart library — every visualisation is hand-rolled SVG. No map, because this dataset has no geography.

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Production build
npm run build

# Preview production build
npm run preview

# Refresh the data (downloads ~190MB, takes a few minutes)
node pipeline/collect.mjs && node pipeline/aggregate.mjs
```

## How it works

`pipeline/collect.mjs` discovers the current financial-year CSVs from the PBS index page by content
pattern (rather than a hard-coded list that would go stale each July) and downloads them alongside the
item–drug map. `pipeline/aggregate.mjs` streams all 2 million rows, joins each item code to its generic
name and ATC classification, and rolls the result up into `public/data/`: a `drugs.json` carrying every
medicine with its dense 69-month series, national monthly totals split by anatomical group, a body-system
× patient-category matrix, and one lazily-fetched detail chunk per medicine. The browser loads the
aggregates on boot and fetches a detail chunk only when a drill-down opens.

A monthly GitHub Actions workflow re-runs both steps and commits any changes, matching the department's
own monthly republication cadence.

## Caveats

- The department withholds the two most recent months and warns that the newest months in any release are the least complete. Treat the right edge of every trend as provisional.
- Prescription counts are not doses: 60-day dispensing (from September 2023) roughly halves the recorded script count for affected medicines without changing how much medicine is taken.
- Coverage is Section 85 supply plus part of Section 100 — some hospital-supplied and highly specialised medicines sit outside this data.
- Medicines are grouped by active ingredient, so one entry can span dozens of PBS listings.
- This is dispensing data, not medical advice.

## license

[GNU Affero General Public License v3.0 or later](./LICENSE), with an attribution
requirement added under section 7(b) — see
[ADDITIONAL-TERMS.md](./ADDITIONAL-TERMS.md).

In short: you may run, modify, redistribute and even sell this, but if you
distribute it — or run a modified version where other people can reach it — you
have to publish your source under the same licence and keep the attribution. A
separate commercial licence without those obligations is available on request:
<hi@ben.gy>.

Third-party components keep their own licences — see
[THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
