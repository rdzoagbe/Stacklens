# Budget scenarios — subvention only

**Rule:** €0 requested in repayable financing (no PI R&D, no avance
récupérable). The project is built around a cash budget the company can
execute; the grant covers a share (25–70% published range), the rest is the
company's contribution. Nothing already spent is claimed.

**These are planning scenarios**, not a statement of what the Région will
award, and not yet priced: the founder-time lines need an hourly cost basis
and a timesheet method (pre-filing question 4 asks the Région which method
they accept for a sole trader), and every external line needs a quote or a
documented estimate. The structure — every euro mapped to a work package — is
what this file settles.

## Scenario table

| Scenario | Project cost | At 40% | At 50% | At 70% | Company contribution at 50% |
|---|---|---|---|---|---|
| Lean | €30,000 | €12,000 | €15,000 | €21,000 | €15,000 |
| Core | €50,000 | €20,000 | €25,000 | €35,000 | €25,000 |
| Expanded | €75,000 | €30,000 | €37,500 | €52,500 | €37,500 |

**Decision rule (from the guide):** the smallest budget that fully funds the
credible R&D programme. Do not inflate to chase a larger grant. The founder's
cash-runway plan for the company share is the binding constraint; write it
down before choosing.

## Core scenario (€50,000) by cost family and work package

| Cost family | WP1 | WP2 | WP3 | WP4 | WP5 | WP6 | Total | Evidence needed |
|---|---|---|---|---|---|---|---|---|
| Founder R&D time | 6,000 | 5,000 | 4,000 | 4,000 | 2,000 | 5,000 | **26,000** | Hourly cost basis accepted by the Région; monthly timesheets per WP (start the sheet at month 0) |
| External technical / R&D services | 6,000 | 4,000 | 3,000 | — | — | — | **13,000** | Day-rate quotes from 2 providers (data / ML engineering), statements of work naming the WP |
| Security / privacy / testing | — | — | — | — | 5,000 | — | **5,000** | Quote for an external security test; quote for a privacy-counsel review |
| Cloud / compute / infrastructure | 500 | 1,000 | 500 | — | 1,000 | 1,000 | **4,000** | Current GCP / Firebase billing as cost basis; a note tying the increase to pilots and model runs |
| UX / design / experimentation | — | — | — | 3,000 | — | — | **3,000** | Quote (comprehension study, recommendation UI) |
| Market / user research | — | — | — | — | — | 3,000 | **3,000** | Method and cost (incentives for 15–20 interviews, transcription, pilot recruitment) |
| IP / legal / technical documentation | — | — | — | — | — | — | **0** in core; see note | — |
| **Total** | 12,500 | 10,000 | 7,500 | 7,000 | 8,000 | 9,000 | **54,000** | |

The columns sum to €54,000 against the €50,000 headline because the guide's
illustrative structure carried €3,000 of IP/legal and €20,000 of founder time;
this allocation moved €6,000 more onto founder time (the only person who can
do WP1–WP3) and dropped the IP line. **Reconcile to exactly the headline
before filing** — either trim founder time on WP6 and WP2 by €4,000, or file
at €54,000. The guide's gate says *the budget maps every euro to a work
package and reconciles exactly*; the mapping above is the input to that.

## Lean scenario (€30,000)

| Cost family | Amount | Note |
|---|---|---|
| Founder R&D time | 17,000 | WP1, WP2, WP4, WP6; WP3 rules only; WP5 design only |
| External technical services | 6,000 | WP1 only |
| Security / privacy / testing | 2,000 | Privacy review only; no penetration test |
| Cloud / compute | 2,000 | 3–5 pilots |
| UX / design | 1,500 | WP4 UI only |
| Market / user research | 1,500 | Interview incentives |
| **Total** | **30,000** | 12 months |

## Expanded scenario (€75,000)

| Cost family | Amount | Note |
|---|---|---|
| Founder R&D time | 32,000 | 18 months |
| External technical services | 20,000 | WP1–WP3 including a learned scorer in WP3 |
| Security / privacy / testing | 9,000 | Two external tests (before and after the models ship) + privacy review |
| Cloud / compute | 6,000 | 8–12 pilots, model runs |
| UX / design / experimentation | 4,000 | Formal comprehension study |
| Market / user research | 4,000 | Larger interview set, two Microsoft 365 pilots |
| **Total** | **75,000** | 18 months |

## Eligible expense families (official page, checked 2026-09-20 in the guide)

Personnel, external services, equipment depreciation during the programme, IP,
homologation, design, market study, technology acquisition. Verify the current
regulation for the exact treatment of each line before submission — in
particular founder personnel cost for an *entrepreneur individuel* (pre-filing
question 4) and cloud spend linked to R&D (question 5).

## Separation from operating costs

Keep a second column in the accounts from month 0: *project* vs *operations*.
Firebase hosting, the domain, Stripe fees, the existing SaaS the company pays
for and any work on the shipped product that is not a WP task are operating
costs and are not claimed. A single shared spreadsheet with one row per
expense, its WP, its evidence file name and the date is what the auditor will
ask for.
