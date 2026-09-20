# KPIs and how each one is measured

The guide's rule: every KPI has a measurement method. This table gives, for
each KPI in the application, the exact event, script or sheet that produces
it, its baseline value or where the baseline will come from, and the target.

## Technical KPIs (from the baseline harness)

| KPI | Measured by | Baseline (2026-09-20) | Target (end of project) |
|---|---|---|---|
| SaaS discovery precision | `tools/record-baseline.mjs` → `summary.vendor.precision` | 70.5% | ≥90% on held-out unseen vendors |
| SaaS discovery recall | same → `summary.vendor.recall` | 81.6% | ≥85% |
| Vendor named correctly when flagged | same → `vendor_name_accuracy` | 100% (on known vendors; unknown ones are misses above) | ≥95% |
| Cadence accuracy | same → `summary.recurrence.accuracy` | 73.3% | ≥90% |
| Findings accuracy (duplicates, price rises, multi-charge) | same → `summary.findings.accuracy` | 80% | ≥90%, with a *needs confirmation* tier for the rest |
| Idle-licence flags confirmed idle | WP4 verdict records (to build) | none yet (declared field only) | ≥85% |
| Access-risk false-positive rate | WP4 verdict records | none yet | ≤10% |
| Accuracy loss on minimised data | harness run on full vs minimised views (WP5) | n/a | ≤5 points |

## Activation and product KPIs (live events)

All events go through `src/lib/analytics.js` → Google Analytics 4. Consent
Mode gates them: before the visitor accepts, GA receives cookieless pings only.
Parameters are counts, minutes, buckets and kind labels; the privacy test
refuses anything else.

| KPI | Event and parameters | Where fired | Baseline |
|---|---|---|---|
| Upload / import completion | `csv_import_completed { kind, records }` — *records* added for this dossier | `src/hooks/useDbQuery.js` (bulk import success) | GA4 from 2026-09-20 |
| Invoice import completion | `invoice_import_completed { count }` | same | live |
| Directory sync completion | `integration_sync_completed { source, added }` | `src/pages/settings/IntegrationsTab.jsx` | live |
| Number of tools / licences / users mapped | `records` on the import event; `added` on sync; `onboarding_completed { num_tools }` | as above | live |
| **Time from data to first actionable insight** | `first_insight { alerts, critical, minutes_since_data, minutes_since_signup }` — fires **once per user**, only when the dashboard has ≥1 alert, never in demo mode | `src/pages/DashboardPage.jsx` effect → `src/lib/activation.js` | new; report the **median** of `minutes_since_data` |
| Recommendations viewed | `recommendations_shown { total, <kind>: n }` — once per session; kinds are the stable alert ids (`orphaned_tools`, `former_employee_access`, `admin_overdue_review`, `tools_unused_90`, `needs_review`, `spend_watch`) | same effect | new |
| Recommendations acted on | `recommendation_acted { kind, severity }` — kinds `former_access`, `no_owner`, `no_mfa`, `budget`, `idle_spend` | action-inbox buttons and links | new |
| Recommendation acceptance / rejection / correction | **not measurable yet** — no reject or correct action exists | WP4 builds them and logs verdicts to the audit log | — |
| Return usage after first insight | `return_after_insight { days_since_first_insight }` — the first visit on any later calendar day | same effect | new |
| Free audit usage (accountant channel) | `audit_run { source, transactions, subscriptions }`, `audit_download` | `src/pages/SaasAuditPage.jsx` | live since PR #279 |
| Plan-limit friction | `plan_limit_hit { limit, plan, cap }` | `useDbQuery.js` | live |

How to read them in GA4: Explore → free form; dimension *event name*; metric
*event count*; add the custom parameters as dimensions (register them once in
Admin → Custom definitions: `minutes_since_data`, `alerts`, `kind`,
`severity`, `records`, `days_since_first_insight`, `total`). For the median of
`minutes_since_data`, export the events table and compute it in a sheet — GA4
gives averages, and an average of minutes is dominated by the one person who
imported a week after signing up.

Behavioural guarantees pinned by `src/lib/activation.test.js`: first insight
fires once; not on an empty inbox; not if storage refuses the stamp (so it can
never double-fire); returns count later days only; one user's stamp does not
silence another on the same browser.

## Pilot and impact KPIs (from WP6 sheets)

| KPI | Measured by | Baseline | Target |
|---|---|---|---|
| Pilot organisations | Signed data agreements | 0 | 5–8 (core) |
| Hours / month on SaaS administration, before vs after | Interview question 8 at baseline; the same question at post-test (`09`) | interviews | −40% |
| Confirmed annualised savings identified | Pilot-confirmed idle / duplicate findings × 12 × monthly cost (`computeWaste` gives the candidate list; confirmation is the verdict record) | 0 | reported per pilot, not extrapolated |
| Security / access issues identified and confirmed | Confirmed WP3 detections | 0 | reported per pilot |
| % of discovered tools manually confirmed | WP1 confirm action | n/a | ≥80% |
| Median time from import to first insight | `first_insight` | GA4 | ≤10 minutes |

## Economic and regional indicators (guide section 10)

These are the founder's numbers. Every cell is *actual*, *forecast* or
*target*, labelled as such; no market-size claims.

| Indicator | Baseline (actual, 2026-09) | 12–18 months (target) | 36 months (target) |
|---|---|---|---|
| Paying organisations | *[founder: Stripe dashboard]* | | |
| ARR | *[founder: Stripe]* | | |
| Jobs / contractors in Île-de-France | 1 (founder, Bondy) | | |
| R&D expenditure in Île-de-France | €0 claimed to date | project budget (`06`) | forecast |
| Pilot organisations | 0 | 5–8 | |
| Validated savings identified for customers | 0 | from WP6 | |
| Security / access findings confirmed | 0 | from WP6 | |
