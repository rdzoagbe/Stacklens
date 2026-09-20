# State of the art and competitor matrix

The guide's rule: for each competitor, record the source URL, the date checked
and the exact stated capability; never claim a competitor *cannot* do
something unless verified. So this file fills the **Stacklens column from the
code** and leaves every competitor cell as a prompt for a verified, dated
entry. Do not file the matrix with unverified cells.

## Which competitors to check

Pick three or four from these public SaaS-management products, and note in
the source column which segment each targets (most target mid-market and
enterprise; Stacklens targets small companies via accountants — that
positioning difference is itself part of the state-of-the-art argument, but
only once sourced).

- Zylo, Torii, Productiv, Zluri, BetterCloud (US, enterprise SaaS management)
- Cledara, Sastrify, Vertice (Europe, SaaS procurement / spend)
- Welii, Beamy (France)
- The "SaaS" modules of spend tools accountants already use (Spendesk, Pennylane, Qonto) — check whether they detect subscriptions from bank data and what they do with the result

For each: the product page, the pricing page, the security / trust page, any
published accuracy or method claim. Screenshot and date each source.

## The matrix

| Dimension | Stacklens today (from the code) | Competitor A | Competitor B | Competitor C |
|---|---|---|---|---|
| **SaaS discovery** | Rule-based: 80-entry vendor list + hint words on bank-export labels, in the browser (`src/lib/saasAudit.js`). Measured: precision 71%, recall 82% on the labelled baseline (`02`). Directory sync from Google Workspace and Microsoft 365 for users; CSV import for tools | *source, date, stated method (bank / SSO / browser extension / finance integration)* | | |
| **Licence utilisation** | Declared *last used* date; idle = ≥90 days or no active grant; no inference (`src/lib/dataUtils.js`, `waste.js`) | *do they infer use from sign-in telemetry? stated source?* | | |
| **Access / offboarding** | Former-employee grants flagged when the employee status is *offboarded*; admin review ≥180 days and annual review ≥365 days rules; offboarding queue and checklist | *automated deprovisioning? detection from directory events?* | | |
| **Duplicate-tool detection** | Same vendor under two bank labels (baseline: 1 false duplicate in 5 statements); no functional-overlap detection | *category-overlap detection claimed?* | | |
| **AI recommendations** | None in the inference path. A language model writes the weekly-email summary and powers a support chat, contract comparison and invoice extraction | *what is claimed, and is any accuracy published?* | | |
| **Explainability / audit trail** | Each flag lists its rule inputs; every mutation logged to an exportable audit log (`src/lib/audit.js`); no confirm / reject on recommendations yet | *evidence shown per recommendation? verdict recorded?* | | |
| **EU data / privacy posture** | Data at rest in the EU (Firestore, to confirm); functions in `us-central1`; owner-only rules with emulator tests; App Check; strict CSP; public DPA and sub-processor register; browser-only bank audit that never uploads (`04`) | *hosting region, certifications (SOC 2, ISO 27001), DPA availability* | | |
| **SMB setup effort** | CSV / Excel import wizard; directory sync; free plan; the public audit needs no account and no upload | *minimum plan price, setup path, target company size* | | |
| **Price point** | Free; Starter from €29/month; Pro from €79/month (public pricing page) | *published pricing* | | |

## What Stacklens is trying to improve, in one paragraph (for the narrative)

Existing SaaS-management products largely discover software through SSO
logs, browser extensions or finance-system integrations that assume an IT
function and a mid-market budget; utilisation is measured where an
integration exists and declared elsewhere. The technical gap this project
addresses is the small-company case where the only evidence is a bank export,
a directory and a few invoices: whether inventory, utilisation and access
risk can be **inferred** from that fragmentary evidence to a measured
reliability, explained per recommendation, and confirmed by a non-specialist
(often the company's accountant) — under data minimisation, since the
smallest companies are the least able to run a privacy programme. *(Verify the
first sentence against the sourced cells before using it.)*
