# Technical baseline — what the engine does today, measured

**Purpose.** Innov'up funds the reduction of technical uncertainty. This
document records, before any funded work, what the shipped inference engine
can and cannot do, on labelled data, with the misses listed. It answers the
guide's section 7D: define the current algorithm and its limitations, create a
labelled dataset, define precision/recall measures, record the baseline, keep
evidence of what remains uncertain.

**How to read the numbers.** They were produced by `tools/record-baseline.mjs`
from the code in `src/lib/saasAudit.js` and the labelled sets in
`test-data/innovup-baseline/`. `src/lib/baseline.test.js` fails whenever the
table below stops matching what the code produces, so the figures cannot
drift from the engine. The recorded run is in `evidence/baseline-results.json`
with the commit hash and date.

**What the labelled sets are.** Written, not harvested: no real customer or
bank data was used. The bank lines are formatted the way French banks print
them (PRLV SEPA, CB with masked card numbers, VIR) and deliberately include
the hard cases — vendors the engine has never heard of, advertising spend at
software vendors, common words that collide with product names. The set is
small (72 lines, 15 charge sequences, 5 statements). It is a baseline, not a
benchmark; WP6 replaces it with pilot data under a confidentiality agreement.

## 1. The engine, as it exists

Stacklens has two inference surfaces. Both are rule-based. Neither learns.

### 1a. Bank-export audit (`src/lib/saasAudit.js`, public page `/audit-saas`)

Runs entirely in the browser; no data leaves the visitor's machine.

| Step | Method today | Known limitation |
|---|---|---|
| Decode and parse | UTF-8 then windows-1252; delimiter sniffing; French amounts (`1 250,00`); day-first dates; separate Débit/Crédit columns | Column detection is by header keyword; an export with no header row or an unusual language fails cleanly but fails |
| Normalise the label | Strip payment-type words, dates, references, masked cards, legal suffixes, domains; keep the first three tokens | The three-token cut loses context that would disambiguate (`GOOGLE ADS` vs `GOOGLE GSUITE`) |
| Identify the vendor | A hand-written list of 80 regular expressions on the normalised label; a fallback list of "software-smelling" words (`ABONNEMENT`, `CLOUD`, `PREMIUM`, `API`…) marks unknown lines as *likely* | Cannot know a vendor it was not told about; cannot tell a vendor's advertising product from its software; single-word names collide with ordinary words (`MAKE`, `BOX`, `MONDAY`); the hint words fire on newspapers, bank fees, coffee shops |
| Detect recurrence | Group by normalised label; cadence from the median gap between charges (weekly / monthly / quarterly / annual, else *irregular*); monthly equivalent by cadence, or spend ÷ span for irregular | No notion of several seats on one card; no bimonthly or semi-annual classes; a seat top-up breaks an annual pattern; two charges are enough to call a cadence |
| Findings | Duplicates (same vendor, two labels); several charges per month; price increase ≥5% first→last on ≥3 charges; annual renewals due within 60 days; small long-running charges | Usage-based bills (cloud compute) read as price rises; two products of one vendor read as a duplicate |

### 1b. Workspace risk engine (`src/lib/dataUtils.js`, `src/lib/waste.js`)

Runs on the customer's imported or synced inventory (tools, employees, access
grants) inside the authenticated app.

| Signal | Rule today | What it cannot do |
|---|---|---|
| Tool status | `orphaned` if no owner email; `unused` if last-used date ≥90 days; else active | *Last used* is a declared or synced field. When it is missing the engine says "no usage data" — it cannot infer use from anything else |
| Tool risk | orphaned or unused → high; business-critical and active → medium; else the stored score | The rule is deterministic on declared fields; there is no evidence weighing |
| Access risk | active grant to an offboarded employee → *former employee*; to an offboarding one → *needs review*; admin grants unreviewed ≥180 days → *needs review*; any grant unreviewed ≥365 days → *needs review* | Depends on the employee status being updated. Nothing detects a leaver from the data itself (no sign-in since, directory removed, licence unassigned) |
| Recoverable spend | Monthly cost of tools with **zero** active grants; tools costing more than €200 per active user are listed for review, never counted as savings | Correct by construction, and therefore conservative: a tool with one dormant grant is "in use" |
| Security score | 100 − 10 × orphaned − 5 × high-risk − 8 × former-employee grants, floored at 0 | A weighting chosen by hand, not calibrated on outcomes |
| Evidence shown | Each flagged tool lists its reasons (no owner, no MFA, days since use, cost, criticality) | Reasons are the rule inputs restated, not an explanation of confidence |

### 1c. Where a language model is used today

Four places call Anthropic's API through a server-side proxy (`functions/index.js`,
`/ai`, 20 calls per user per hour): the support chat, the contract comparison
page, invoice extraction (invoice text → structured rows) and the two-sentence
insight at the top of the weekly email (aggregate figures and tool names). None
of these participates in the discovery, utilisation or access-risk inference
above. **The product does not currently use machine learning for inference.**
That is a fact to state plainly in the application, not to hide: it is the
gap between the rule engine and the project.

## 2. Measured baseline

Recorded 2026-09-20 on the commit named in `evidence/baseline-results.json`.

<!-- baseline:start -->
| Engine | Labelled set | Measure | Result |
|---|---|---|---|
| Vendor identification | 72 bank lines (38 software, 34 not) | Precision | 71% (31 right of 44 flagged) |
| | | Recall | 82% (31 found of 38) |
| | | F1 | 76% |
| | | Vendor named correctly, when flagged | 100% |
| Recurrence (cadence) | 15 charge sequences | Accuracy | 73% (11 of 15) |
| Findings (duplicates, price rises, multi-charge) | 15 checks over 5 statements | Accuracy | 80% (12 of 15) |

**Vendor identification misses**

| Bank line | Kind | Expected | Engine said | Why it is hard |
|---|---|---|---|---|
| `CB DOCTOLIB PRO` | false negative | Doctolib | — | SaaS the engine does not know: false negative expected |
| `CB AIRCALL SAS` | false negative | Aircall | — | SaaS the engine does not know |
| `CB DEEPL SE` | false negative | DeepL | — | SaaS the engine does not know |
| `PRLV SEPA INDY` | false negative | Indy | — | French accounting SaaS the engine does not know |
| `CB GANDI SAS` | false negative | Gandi | — | domains/hosting; unknown vendor |
| `CB IONOS SE` | false negative | IONOS | — | hosting; unknown vendor |
| `CB O2SWITCH` | false negative | o2switch | — | French hosting; unknown vendor |
| `CB QONTO ABONNEMENT` | false positive | — | Qonto Abonnement (likely) | bank plan fee; carries the word ABONNEMENT, which is a software hint to the engine |
| `CB LE MONDE ABONNEMENT` | false positive | — | Le Monde Abonnement (likely) | newspaper subscription; recurring but not software |
| `PRLV SEPA GOOGLE ADS 1234-5678-9012` | false positive | — | Google Workspace (known) | advertising spend, not software; the engine's GOOGLE rule cannot tell them apart |
| `CB LINKEDIN ADS` | false positive | — | LinkedIn (known) | advertising spend at a vendor the engine treats as SaaS |
| `CB MICROSOFT ADVERTISING` | false positive | — | Microsoft 365 (known) | advertising spend at a vendor the engine treats as SaaS |
| `CB MAKE UP FOR EVER PARIS` | false positive | — | Make (known) | cosmetics shop; the token MAKE collides with the automation vendor |
| `CB MONDAY CAFE PARIS 11` | false positive | — | monday.com (known) | a cafe; the token MONDAY collides with monday.com |
| `CB LA BOX DU FROMAGER` | false positive | — | Box (known) | food gift box; the token BOX collides with Box storage |
| `CB CLOUD NINE COFFEE` | false positive | — | Cloud Nine Coffee (likely) | coffee shop; the token CLOUD is a software hint |
| `CB PREMIUM CARBURANT TOTAL` | false positive | — | Premium Carburant Total (likely) | fuel; the token PREMIUM is a software hint |
| `CB APPLE STORE OPERA` | false positive | — | Apple (known) | hardware purchase at a vendor the engine treats as a subscription |
| `CB GOOGLE *PLAY STORE` | false positive | — | Google Workspace (known) | app purchase at a vendor the engine treats as Google Workspace |
| `CB API RESTAURANT` | false positive | — | Api Restaurant (likely) | the token API is a software hint |

**Recurrence misses**

| Case | Expected | Engine said |
|---|---|---|
| two seats on one card, 5th and 21st | monthly | irregular |
| annual, with a mid-year seat top-up | annual | irregular |
| every two months | bimonthly | irregular |
| every six months | semiannual | irregular |

**Findings misses**

| Statement | Finding | Expected | Engine raised |
|---|---|---|---|
| Google Ads next to Google Workspace is not a duplicate subscription | duplicates | 0 | 1 |
| Google Ads next to Google Workspace is not a duplicate subscription | priceIncreases | 0 | 1 |
| usage-based cloud bill is not a price increase | priceIncreases | 0 | 1 |
<!-- baseline:end -->

## 3. What the misses say — the technical uncertainties

Each uncertainty below is backed by at least one row in the tables above.
They map onto the guide's section 5 table and onto the work packages in `03`.

| Uncertainty | Evidence in the baseline | Experimental question | WP |
|---|---|---|---|
| **Discovery from incomplete evidence.** A hand-written vendor list cannot scale; seven common French business tools were missed outright | 7 false negatives (Doctolib, Aircall, DeepL, Indy, Gandi, IONOS, o2switch) | Can vendor identity be inferred from label shape, amount pattern, cadence and cross-customer confirmation rather than a list — and with what precision/recall on unseen vendors? | WP1 |
| **Disambiguation beyond the label.** The same vendor sells software and advertising; ordinary words collide with product names | 13 false positives: 3 advertising lines, 3 word collisions, 2 store purchases, 5 hint-word misfires | What features (amount stability, cadence, counterparty type, merchant category) separate a subscription from a purchase at the same vendor? | WP1 |
| **Utilisation inference.** The workspace engine reads *last used* from a field; when nobody fills it in, there is no signal | Not measurable on labelled data yet — the field is declared, not inferred. The pilot baseline (WP6) measures how often it is missing | Can utilisation be inferred from sign-in telemetry, directory state and billing seat counts with a false-idle rate an administrator will accept? | WP2 |
| **Cadence and seat structure.** Several seats on one card, seat top-ups, bimonthly and semi-annual plans all read as *irregular* | 4 recurrence misses of 15 | Can billing structure (seats × cadence × proration) be recovered from charge sequences alone? | WP2 |
| **Findings that survive contact with reality.** Usage-based billing is not a price rise; two products of one vendor are not a duplicate | 3 findings misses of 15 | Which findings can be made to a confidence threshold, and which need a human to confirm? What is the acceptance and correction rate? | WP2, WP4 |
| **Leaver detection.** *Former employee still has access* depends on someone marking the person as offboarded | Rule is exact but blind: no baseline is possible until pilots supply directory events | Can departures be detected from directory and sign-in evidence before HR updates the record, with a false-alarm rate below what security teams tolerate? | WP3 |
| **Explainability.** Reasons shown today restate the rule inputs | Qualitative; the interviews (`09`, questions 10–12) measure what would make a recommendation trusted or rejected | What evidence, shown how, gets a recommendation acted on rather than dismissed? | WP4 |
| **Privacy-preserving intelligence.** Every inference above is more accurate with more employee data | The security package (`04`) lists what is stored today | How much of the accuracy can be reached on minimised, pseudonymised or on-device data? | WP5 |

## 4. Rules for this baseline

- **Frozen until filing.** The vendor list, the cadence rules and the findings
  thresholds in `src/lib/saasAudit.js` are not to be tuned against the labelled
  sets before the application is submitted. Improving them is the project.
  (The parity test makes any change visible: it fails until the baseline is
  re-recorded, and the re-recording is a dated commit.)
- **Pilot data replaces this.** WP6's first task is a real baseline on pilot
  organisations' data under NDA. This document then becomes the pre-pilot
  reference, kept unchanged.
- **The labelled sets are the founder's authorship.** They are dated in git
  and can be handed to a reviewer as-is.
