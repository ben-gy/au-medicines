# Prescription Medicines — Build Review

This file exists only to create a reviewable PR. All code is already deployed on `main`.

**Merge this PR to acknowledge the build.** Closing without merging is also fine.

## Links

- **GitHub Pages:** https://ben-gy.github.io/au-medicines/ *(redirects to the custom domain)*
- **Custom domain:** https://au-medicines.benrichardson.dev

## What it is

Every PBS-subsidised medicine dispensed in Australia between July 2020 and March 2026 — 2,047,223 source
rows across 12,119 PBS item codes, resolved to 1,013 generic medicines and 69 months of history.
1.88 billion prescriptions, $68.27bn in Commonwealth subsidy, $18.28bn from patients.

## Findings worth a look

- **Aflibercept** — an eye injection — is the single costliest medicine on the PBS at $2.69bn, ahead of every heart, cancer or diabetes drug.
- **Menopause hormone therapy is up 43×** year on year after its 2025 PBS listing (progesterone + estradiol, 998,678 scripts).
- **31% of all prescriptions cost the government nothing** — dispensed under the co-payment, so no benefit was payable.
- **Patients pay 85%** of the cost of the combined oral contraceptive, the most self-funded high-volume medicine on the scheme.
- **One lanadelumab prescription costs $29,290**; the government pays 100% of it.

## Data handling note

The department's `PATIENT_CONTRIB` column fills every under-co-payment script with the *maximum schedule
price* rather than what was actually paid, which overstates patient spending by roughly $300m a year.
This build uses `PATIENT_NET_CONTRIB` (the actual recorded amount) throughout, and says so in the About
modal.

## DNS

Already provisioned: CNAME `au-medicines` → `ben-gy.github.io` in the `benrichardson.dev` Cloudflare zone
(DNS only), with the GitHub Pages CNAME set and cycled for certificate issuance.
