# Application form — fields prepared

The guide's section 17, prefilled where the repository or the guide holds the
answer. *[founder]* marks what only the founder can supply. **Reconcile the
company block against a fresh SIRENE extract before submission; do not reuse
an old document.**

## Company identification

| Field | Value | Source |
|---|---|---|
| Legal form | Entrepreneur individuel | Guide §2 (SIRENE notice) |
| Activity (APE) | 58.29C — Édition de logiciels applicatifs | Guide §2 |
| SIREN / SIRET | 104 838 727 / 104 838 727 00014 | Guide §2 — **verify** |
| Active since | 07/05/2026 | Guide §2 |
| Île-de-France establishment | 89 avenue Carnot, 93140 Bondy | Guide §2 |
| Contact | Roland Dzoagbe — *[founder: phone]* — hello@stacklens.fr | Public site |
| Product | Stacklens — SaaS spend and access management — https://stacklens.fr | |

## Company presentation

- Founded 2026 in Bondy by a solo founder; the product is in production at
  stacklens.fr with a free plan, a paid Starter and Pro plan, and a
  client-workspace model for accountants managing several companies.
- Public positioning since PR #279–#280: accountants and bookkeepers as the
  channel, with a free browser-only audit of a bank export as the entry
  point; small companies as the end user.
- Customers / users / revenue: *[founder: Firebase Auth user count, Stripe
  MRR, dated screenshots]*. State actuals only.

## Project title

Development and experimental validation of an intelligent SaaS environment
discovery, utilisation and access-risk analysis engine for small and
mid-sized organisations.

## Project phase

*Development and experimentation.* Feasibility is established by the
measured baseline (`02`): a rule engine reaches 76% F1 on discovery and its
failure modes are characterised. The project develops inference methods for
those failure modes and validates them with pilot organisations.

## Innovation description

State of the art: see `07` (sourced cells required). Gap and uncertainty:
`02` §3, eight uncertainties each with a measured or planned baseline.
Novelty: inference of inventory, utilisation and access risk from fragmentary
small-company evidence, with confidence, explanation and human verdict loops,
under data minimisation — rather than integration-dependent measurement.

## Work programme

`03` — WP1–WP6, deliverables D1.1–D6.3, milestones at months 3, 6, 9, 10,
12, 14, 18.

## Team

| Role | Who | Evidence |
|---|---|---|
| Founder, product and engineering lead, responsible for all WPs | Roland Dzoagbe | CV *[founder]*; development history below |
| External data / ML engineering | *[supplier, quote]* | Statement of work per WP |
| Security testing | *[supplier, quote]* | |
| Privacy counsel | *[supplier, quote]* | |
| UX / research support | *[supplier, quote]* | |

**Development history as capacity evidence.** In this checkout the history
runs from 2026-07-19 to 2026-09-19 with 95 commits on the main branch (check
GitHub for the full history; the clone may be shallow). Over the last two
weeks alone the repository shipped nine reviewed pull requests (#272–#280)
covering deployment reliability, authentication, email deliverability, the
accountant channel and a public audit tool, each with tests. The unit suite
stands at 826 tests across 44 files (2026-09-20, including the baseline and activation suites); lint at 0 errors; every merge goes
through CI. Development tooling includes an AI coding assistant; authorship
and ownership sit with the entrepreneur (see IP below).

## Budget and financing plan

`06`. Subvention only; €0 repayable. Company contribution = project cost −
grant, funded from *[founder: cash plan]*.

## Market, commercialisation, impact

- Market and need: interview themes with counts (`09` tally sheet), not
  market-size claims.
- Route to market: accountants as channel (`/experts-comptables`), free audit
  as the hook, client workspaces as the product for a practice; direct SMB
  sign-up as the second route.
- Commercialisation of the validated technology: the inference engine becomes
  the core of the paid plans (confidence-scored discovery, verified idle
  licences, leaver detection); pricing stays per company per month.
- Impact: `05`, economic and regional table — actuals, forecasts and targets
  labelled.

## Risk management

`08`.

## Timeline

`03`, timeline block.

## Attachments checklist (guide §18)

| Attachment | Where / status |
|---|---|
| Current SIRENE extract | *[founder]* |
| Accounting / tax documents | *[founder]* |
| Product screenshots | `docs/screenshots/` (dated 2026-08; retake after the homepage change in #280) |
| Product architecture diagram | README "Architecture" + `04` §2 |
| Data-flow / privacy diagram | `04` §2 |
| Technical roadmap | `03` timeline |
| Technical backlog of unresolved R&D questions | `02` §3 |
| Competitor matrix | `07` — after sourcing |
| Interview notes and findings | `evidence/interviews/` — after `09` |
| Pilot letters of interest | *[founder]* |
| Customer / user metrics | GA4 exports; Stripe; Firebase Auth *[founder]* |
| Pricing and commercial assumptions | Public pricing page; `06` |
| 12–18 month and 3-year forecasts | *[founder]* |
| Supplier quotes | *[founder]* |
| Founder CV | *[founder]* |
| Security / privacy documentation | `04`; public `/dpa`, `/privacy`, `/sub-processors`, `/security-info` |
| IP / open-source inventory | below |
| Gantt | `03` |
| Budget workbook | `06` → spreadsheet *[founder]* |
| Pre-filing eligibility correspondence | `01` and the reply |

## Intellectual property and know-how

- **Ownership.** The code, the labelled datasets, the scorer and this dossier
  are authored by the entrepreneur; the git history is the dated record of
  authorship. No contractor has contributed code to date, so no IP-assignment
  clause is outstanding; every future supplier contract (WP1–WP5) must carry
  one.
- **AI-assisted development.** The code is written with an AI coding
  assistant under the founder's direction. Confirm the assistant's commercial
  terms assign output to the customer and keep a copy of those terms in the
  evidence folder.
- **Trade secret vs. documented.** The vendor list and rule thresholds are
  readable in the public JavaScript bundle by design (the audit runs in the
  browser); they are not a secret. What would be protectable is the inference
  models, features and labelled datasets produced by WP1–WP3: keep those
  server-side or in the repository, dated.
- **Dated technical documentation.** This folder, plus the commit history, is
  the evolution record. Keep `evidence/baseline-results.json` from each
  re-recording rather than overwriting it once the project is filed.

### Open-source components (direct dependencies, from `package.json`, licences read from the installed packages on 2026-09-20)

Application:

| Package | Version | Licence |
|---|---|---|
| react, react-dom, react-is | 19.3.0 | MIT |
| react-router-dom | 7.18.3 | MIT |
| @tanstack/react-query | 5.102.8 | MIT |
| firebase | 12.19.0 | Apache-2.0 |
| @azure/msal-browser | 5.21.0 | MIT |
| @sentry/react | 10.74.0 | MIT |
| date-fns | 4.4.0 | MIT |
| exceljs | 4.4.0 | MIT |
| framer-motion | 13.2.0 | MIT |
| jspdf, jspdf-autotable | 4.2.1, 5.0.8 | MIT |
| lucide-react | 1.45.0 | ISC |
| mammoth | 1.12.3 | BSD-2-Clause |
| pdfjs-dist | 6.3.289 | Apache-2.0 |
| react-hot-toast | 2.6.0 | MIT |
| recharts | 3.10.1 | MIT |

Cloud Functions:

| Package | Version | Licence |
|---|---|---|
| firebase-admin | 14.3.0 | Apache-2.0 |
| firebase-functions | 7.3.2 | MIT |
| @sendgrid/mail | 8.1.6 | MIT (loaded only when a key is configured) |
| busboy | 1.6.0 | MIT |
| cors | 2.8.6 | MIT |
| pdf-parse | 2.4.5 | Apache-2.0 |
| stripe | 22.6.1 | MIT |

All permissive (MIT, ISC, BSD-2, Apache-2.0); no copyleft obligation on the
product. Build tooling (Vite, ESLint, Vitest, Tailwind) is dev-only.
