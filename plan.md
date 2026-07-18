# Site Plan: Prescription Medicines

## Overview
- **Name:** Prescription Medicines
- **Repo name:** au-medicines
- **Tagline:** Every medicine Australia is prescribed on the PBS — 69 months of scripts, cost and who paid.

### Naming
Plain topic name, no country code. `country: "AU"` in the index entry renders the flag.

## Target Audience
Health journalists and policy researchers who want to know which medicines are actually
being dispensed and what they cost the Commonwealth; pharmacists and GPs curious how their
prescribing compares to the national picture; and ordinary people who have heard that
"Ozempic is exploding" or "ADHD meds are up" and want to see the real number. Mostly desktop
for the analysts, mobile for the curious reader arriving from a news link. Low-to-medium
domain knowledge assumed — PBS jargon (co-payment, safety net, concessional, ATC, Section 85)
must be explained inline.

## Value Proposition
The Department of Health publishes this as six ~25MB CSVs of item codes with no drug names
attached and no interface at all — you need a join, a pivot and a chart before you can answer
"how many semaglutide scripts were dispensed last year". This site does the join once and
makes 69 months × ~12,000 PBS item codes × ~2,600 generic medicines explorable in a browser:
search any medicine, see its monthly trajectory, what it costs per script, how much the
government pays versus the patient, and where it sits in the therapeutic hierarchy. Nothing
else public lets you rank every PBS medicine by government spend and click straight through
to its five-year curve.

## Data Sources
| Source | URL | What it provides | Update frequency | Auth required? |
|--------|-----|-------------------|-----------------|----------------|
| PBS Date of Supply supplementary reports (6 financial-year CSVs) | https://www.pbs.gov.au/statistics/dos-and-dop/files/dos-jul-YYYY-to-jun-YYYY-phrmcy-type.csv | Monthly prescriptions, patient/government contribution, total cost, retail mark-up by PBS item code × patient category × pharmacy type × script type | Monthly (2-month reporting lag) | No |
| PBS item drug map | https://www.pbs.gov.au/statistics/dos-and-dop/files/pbs-item-drug-map.csv | item code → generic drug name, form/strength, ATC5 code (12,119 items) | ~Monthly | No |
| WHO ATC level 1/2 nomenclature | Embedded in pipeline (`pipeline/atc-names.mjs`) | Human-readable names for the 14 anatomical groups and ~94 therapeutic subgroups | Static | No |

Caveats surfaced in the UI: the two most recent months are withheld by the department for
completeness; a ~1.5% step-up in reported scripts from March 2018 (before our window, so no
effect); under-co-payment scripts carry a zero government contribution by definition; the
department warns the report is unsuitable for analysing the very latest trend.

## Key Features
1. **Rankings** — every medicine leaderboard by scripts, government cost, total cost, cost per script or growth, with a therapeutic-group filter.
2. **Explorer** — searchable/sortable table of all ~2,600 medicines with 69-month sparklines.
3. **Therapeutic hierarchy sunburst** — ATC anatomical group → therapeutic subgroup → medicine, click to zoom, sized by cost or scripts.
4. **Cost vs Volume scatter** — log-log, the signature view: the handful of ultra-expensive low-volume medicines versus the everyday high-volume cheap ones, with cost-per-script diagonals.
5. **Movers** — slope chart of the fastest-growing and fastest-shrinking medicines (last 12 months vs the 12 before).
6. **Trends** — monthly national totals stacked by anatomical group, annotated with policy events (Jan 2023 co-payment cut to $30, Sep 2023 60-day dispensing, Jan 2026 cut to $25).
7. **Who Pays** — patient vs government split, and a therapeutic-group × patient-category matrix (concessional, general, safety net, veteran, prescriber bag).
8. **Insights** — auto-detected outliers: cost concentration, extreme cost-per-script, surging and collapsing medicines, groups where patients carry most of the cost.
9. **Per-medicine drill-down** — hash-linkable panel with rank, monthly series, cost-per-script trend, patient-category and pharmacy-type mix, and the PBS items that make it up.

## Target Audience (detailed)
Three overlapping groups. (a) Health reporters on deadline, desktop, medium data literacy,
arriving because they want one defensible number and a chart they can describe. (b) Pharmacy
and health-policy analysts, desktop, high data literacy, who currently do this join in Excel
and will use the Explorer and the scatter. (c) General readers on a phone following a news
link about a specific drug — they need search, one clear number, and plain-English labels.
The tone must be calm and factual; this is medicines data, not a scoreboard, and sensational
framing would be wrong.

## Style Direction
**Tone:** calm/reassuring with clinical precision — a health-department portal that someone
actually designed.
**Colour palette:** clinical off-white background (#f7f9fb) with deep teal as the primary
accent (#0f766e) and a slate-navy ink (#0f1c2e). Teal reads as health without the alarm of
red or the coldness of pure clinical blue; the 14 anatomical groups get a distinct
categorical ramp used identically in every view. Positive/negative growth uses teal/amber
rather than green/red to avoid a good-vs-bad reading of prescribing volumes.
**UI density:** balanced — dense tables and charts, but generous line-height and a readable
14px base, because half the audience is not an analyst.
**Dark/light theme:** light. Health and general-audience content; a dark terminal aesthetic
would be wrong for this subject.
**Reference sites for tone:** aihw.gov.au report pages (authoritative, restrained, well
-labelled charts) and ourworldindata.org (explanatory, every chart carries its own caption).

## Technical Architecture
- **Stack:** Vanilla TypeScript + Vite (single-page, tabbed dashboard; no routing or deep component tree needed)
- **Data strategy:** pipeline — the source publishes monthly, so the cron is **monthly** (the fastest cadence the factory allows), day 9 at 04:23 UTC to stagger against other repos.
- **Key libraries:** none beyond dev tooling. All charts are hand-rolled SVG; the sunburst is
  a hand-rolled radial partition (arc geometry, positional tests included). No Leaflet — this
  dataset has no geography and a map would be decoration.

## Layout
Fixed 52px header (wordmark, view tabs, search, About `?`). Below it a full-width content
column capped at 1680px. Each view is a titled card stack: title + subtitle + legend, then
the visualisation inside its own `overflow-x: auto` scroller. The drill-down is a right-hand
slide-in panel (full-width sheet below 768px) driven by `#drug=<slug>`. Below 768px the tab
strip scrolls horizontally, tables collapse to two-line rows, and the sunburst/scatter drop
to a square aspect.

## Pages/Views
Single page, eight tabbed views (Rankings, Explorer, Hierarchy, Cost vs Volume, Movers,
Trends, Who Pays, Insights) plus the per-medicine drill-down panel and an About modal.

## Visualization Strategy

Design research: the bar here is set by the AIHW's own PBS dashboards (which stop at national
totals per ATC2 and offer no per-drug drill-down) and by OurWorldInData's explorer pattern
(one chart, many entity selections, always captioned). The distinguishing shape of *this*
dataset is that it is a **hierarchy** (ATC: 14 → ~94 → ~2,600) crossed with a **long monthly
panel** and a **brutally skewed cost distribution** — so the view set is built around those
three properties rather than the house defaults. Notably there is no map, because there is no
geography in the data; and no force-directed network, because medicines do not connect to
each other. Both would be borrowed decoration.

- **Table view (Explorer)** — sortable, filterable, searchable, with sparklines. Answers "what is the number for the specific drug I came here for?"
- **Rankings bars** — horizontal bars coloured by anatomical group. Answers "what dominates, and by which measure?" Volume and cost give completely different top tens; that contrast is the point.
- **Radial sunburst (hierarchy)** — the ATC tree is a genuine 3-level hierarchy, which is exactly what a partition layout is for; a treemap would lose the ring-per-level reading of "which body system, then which drug class". Click a ring to zoom into that subtree, click a leaf to drill down. Answers "where does the money sit in the therapeutic tree?"
- **Log-log scatter (cost vs volume)** — the distribution spans seven orders of magnitude, which no bar chart survives. Diagonals mark constant cost-per-script. Answers "which medicines are expensive because they're everywhere versus expensive per dose?"
- **Slope chart (movers)** — ranked change between two 12-month windows, up and down. Answers "what is actually changing right now?" A bar chart of growth % would bury the magnitudes; a slope chart keeps both endpoints visible.
- **Stacked area / stacked bars over 69 months (trends)** — real time axis with policy annotations. Answers "what did the co-payment cut and 60-day dispensing actually do to volumes and to government spend?"
- **Matrix heatmap (who pays)** — anatomical group × patient category. Answers "which medicines are carried by concession-card holders, and where do general patients pay most of the bill?"
- **Histogram (inside Insights + drill-down)** — cost-per-script distribution with click-through to the matching medicines. Answers "is this drug's price normal?"
