# Work packages

Six work packages over 12–18 months. Each sheet has the fields the guide asks
for: objective, current limitation (from the measured baseline), technical
uncertainty, tasks, deliverable, KPI with its measurement method, responsible,
supplier, cost, start/end month, dependency. Costs are the €50k *core*
scenario from `06-budget-scenarios.md`; the €30k and €75k variants change the
scope notes at the end.

**Project title:** Development and experimental validation of an intelligent
SaaS environment discovery, utilisation and access-risk analysis engine for
small and mid-sized organisations.

**Project phase:** *development and experimentation* (the feasibility question
is already answered by the baseline: a rule engine reaches 76% F1 on
discovery and the misses are characterised; the open question is whether an
inference approach can be made reliable and explainable enough to act on).

**Month 0 = the month after submission.** Nothing below begins before filing.

---

## WP1 — SaaS environment data model and discovery

| Field | Content |
|---|---|
| Objective | Reconstruct an organisation's software inventory from fragmentary sources (bank export, identity directory, invoices, manual entry) into one model with a **confidence score per discovered tool**, instead of a yes/no list match |
| Current limitation | Discovery is an 80-entry hand-written regex list plus hint words. Baseline: precision 71%, recall 82%, F1 76% on 72 labelled lines; 7 unknown vendors missed, 13 false positives from advertising lines, word collisions and hint words (`02`, §2) |
| Technical uncertainty | Whether vendor identity and *software-ness* can be inferred from label shape, amount stability, cadence, counterparty features and cross-customer confirmation — for vendors never seen before — at a precision an accountant will accept without checking every line |
| Tasks | 1. Unified inventory model with source provenance and confidence. 2. Feature extraction from bank lines (label tokens, amount pattern, cadence, merchant class). 3. Candidate approaches: enriched rules with context; a small classifier trained on labelled lines; confirmation loop where a human's yes/no on one customer raises confidence for all. 4. Evaluation harness (extends `src/lib/baseline.js`) with held-out unseen vendors. 5. Import connectors for the two directory formats already supported (Google Workspace, Microsoft 365) feeding the same model |
| Deliverable | D1.1 data model and provenance spec · D1.2 discovery engine v1 with confidence · D1.3 evaluation report on held-out set |
| KPI | Discovery precision and recall on an **unseen-vendor** held-out set; % of discovered tools confirmed by the pilot administrator. Target: precision ≥90% at recall ≥85% on held-out; ≥80% confirmed |
| Measurement | `tools/record-baseline.mjs` extended to held-out splits; pilot confirmation via the "confirm / not a tool" action logged in the audit log (WP4) |
| Responsible | Founder |
| Supplier | External technical services (data/ML engineering, day-rate) — quote needed |
| Cost (core) | €12,000 (founder time €6,000 + external €6,000) |
| Months | 1–6 |
| Depends on | — |

## WP2 — Licence utilisation and cost intelligence

| Field | Content |
|---|---|
| Objective | Distinguish *assigned* from *actually used* licences, recover billing structure (seats × cadence × proration) from charges, and produce a cost model whose findings survive human review |
| Current limitation | *Last used* is a declared field; when missing, the engine says "no usage data". Cadence detection: 73% on labelled sequences; multi-seat, top-up, bimonthly and semi-annual patterns all read as *irregular*. Findings: 80%; usage-based bills read as price rises, two products of one vendor read as duplicates (`02`, §2–3) |
| Technical uncertainty | Whether utilisation can be inferred from sign-in telemetry, directory state and seat counts with a false-idle rate an administrator accepts; whether billing structure is recoverable from charges alone |
| Tasks | 1. Utilisation signal model (sign-in recency, directory membership, seat assignment, invoice seat counts) with explicit *unknown* state. 2. Cadence model with seat multiplicity, proration and the missing classes. 3. Findings with confidence thresholds and a *needs confirmation* tier. 4. Labelled evaluation set for utilisation from pilot data (WP6). 5. False-idle / false-active measurement |
| Deliverable | D2.1 utilisation inference module · D2.2 cadence and billing-structure model · D2.3 cost-optimisation findings v2 with confidence tiers |
| KPI | % of *idle* flags confirmed idle by the pilot; false-positive rate of findings; cadence accuracy. Target: ≥85% of idle flags confirmed; findings false-positive ≤10%; cadence ≥90% |
| Measurement | Confirm / reject actions on each finding (WP4) logged with the finding id; baseline harness on the extended labelled sets |
| Responsible | Founder |
| Supplier | Same external services as WP1 |
| Cost (core) | €9,000 (founder €5,000 + external €4,000) |
| Months | 4–10 |
| Depends on | WP1 model; WP6 pilot data for the utilisation set |

## WP3 — Access and security risk engine

| Field | Content |
|---|---|
| Objective | Detect dormant, orphaned and former-employee access from evidence rather than from a status somebody remembered to set; score risk with a calibrated model rather than a hand weighting |
| Current limitation | *Former employee still has access* fires only when the employee record is marked offboarded. Admin and annual review overdue are date rules. The security score is 100 − 10·orphaned − 5·high-risk − 8·former, floored at 0: a weighting, not a calibration (`02`, §1b) |
| Technical uncertainty | Whether departures and dormancy can be detected from directory and sign-in evidence before HR updates the record, with a false-alarm rate security teams tolerate (interviews, `09`, questions 5 and 11) |
| Tasks | 1. Evidence model for a grant: last sign-in, directory state, licence assignment, review history. 2. Leaver-detection rules and a first learned scorer where pilot data allows. 3. Risk scoring calibrated on pilot-confirmed findings. 4. Audit evidence attached to each detection (what was seen, when) |
| Deliverable | D3.1 access-evidence model · D3.2 detection engine v1 · D3.3 calibration report |
| KPI | Confirmed risk detections; false-positive rate; median days between a departure and its detection. Target: false positives ≤10%; detection within 7 days for pilots with directory sync |
| Measurement | Confirm / dismiss on each detection (WP4); pilot directory events as ground truth |
| Responsible | Founder |
| Supplier | External technical services; security review (WP5) |
| Cost (core) | €7,000 (founder €4,000 + external €3,000) |
| Months | 6–12 |
| Depends on | WP1 connectors; WP6 pilots with directory sync |

## WP4 — Explainable recommendation engine with human approval

| Field | Content |
|---|---|
| Objective | Every recommendation carries the evidence behind it, a confidence, and a confirm / reject / correct action whose outcome is recorded and feeds back into WP1–WP3 |
| Current limitation | The dashboard's action inbox shows five rule-based item types with the rule inputs restated as the reason. There is no reject or correct action, so nothing measures whether a recommendation was right. The product has just started recording *shown* and *acted* per item kind (`src/lib/activation.js`), which gives the denominator but not the verdict |
| Technical uncertainty | What evidence, presented how, gets an administrator to act on an automated recommendation rather than ignore it (interviews, `09`, questions 10–12); whether corrections can be fed back without a labelling burden the customer will not carry |
| Tasks | 1. Recommendation schema: claim, evidence list, confidence, reversible action. 2. Confirm / reject / correct UI and audit-log records. 3. Feedback path into the WP1–WP3 models. 4. Comprehension test with pilot users (think-aloud, 6–8 sessions) |
| Deliverable | D4.1 recommendation schema and UI · D4.2 feedback loop · D4.3 comprehension study report |
| KPI | Acceptance rate; correction rate; time from shown to decision; % of users who can state why a recommendation was made (comprehension test). Target: acceptance ≥60%; correction ≤15%; comprehension ≥80% |
| Measurement | `recommendation_acted` / `recommendations_shown` events (already live) plus the new verdict records in the audit log |
| Responsible | Founder |
| Supplier | UX / design (quote) |
| Cost (core) | €7,000 (founder €4,000 + design €3,000) |
| Months | 5–12 |
| Depends on | WP1–WP3 for content; WP5 for what evidence may be shown |

## WP5 — Privacy, security and EU-data architecture

| Field | Content |
|---|---|
| Objective | Reach the accuracy of WP1–WP4 on minimised data, with tenant isolation, EU processing and auditability documented and tested |
| Current limitation | Documented in `04-security-trust-package.md`. Strengths: Firestore owner-only rules with emulator tests; App Check; CSP and HSTS; audit log on every mutation; 90-day soft delete for client workspaces; a browser-only audit that never uploads. Gaps: server functions run in `us-central1`; no written incident-response procedure; no external penetration test; four AI features send content to a US provider; no data-classification per field |
| Technical uncertainty | How much of the inference accuracy can be reached on pseudonymised or on-device data (the browser-only audit is the existence proof for one surface); what the accuracy cost of minimisation is |
| Tasks | 1. Data classification per field and a minimisation design (what WP1–WP3 need vs. what is stored). 2. Move server processing to an EU region; document the AI provider boundary or replace it for inference. 3. Threat model, incident-response procedure, external security test. 4. Isolation and rules tests extended to the new models |
| Deliverable | D5.1 data-classification and minimisation design · D5.2 EU-region deployment · D5.3 security test report and incident procedure · D5.4 DPIA-style record |
| KPI | Accuracy delta between full and minimised data (from WP1–WP2 harness); security test findings closed; % of processing in EU regions. Target: accuracy loss ≤5 points; 100% EU processing for inference |
| Measurement | Baseline harness run on both data views; test report; deployment configuration |
| Responsible | Founder |
| Supplier | Security testing firm (quote); privacy counsel for the lawful-basis review (quote) |
| Cost (core) | €7,000 (security/privacy testing €5,000 + founder €2,000) |
| Months | 3–14 |
| Depends on | WP1 model for the classification |

## WP6 — Real-world experimentation and validation

| Field | Content |
|---|---|
| Objective | Replace the written baseline with measurements on real organisations, and produce the before/after report that decides what worked, what failed and what remains uncertain |
| Current limitation | The baseline in `02` is on labelled synthetic lines. No pilot data yet |
| Technical uncertainty | Whether the gains hold across organisations of different sizes and stacks; whether administrators' time on SaaS administration actually falls |
| Tasks | 1. Recruit 5–8 pilot organisations through the accountant channel (`/experts-comptables`) and existing users; NDA and data agreement. 2. Baseline collection: inventory, licences, access, hours per month on SaaS administration (interview `09`, question 8). 3. Prototype deployment per WP milestone. 4. Human verification of findings (labelled validation set). 5. Iteration. 6. Post-test measurement and final report |
| Deliverable | D6.1 pilot cohort and baseline dataset · D6.2 labelled validation results · D6.3 final experimental report |
| KPI | Pilot count; hours/month before vs after; confirmed annualised savings identified; confirmed security findings; median minutes from data import to first insight (`first_insight` event) |
| Measurement | Pilot baseline sheet (in `09`); activation events; confirm / reject records |
| Responsible | Founder |
| Supplier | Market/user research support (quote); cloud and compute for pilots |
| Cost (core) | €8,000 (founder €5,000 + research €3,000) plus €4,000 cloud/compute allocated across WPs in `06` |
| Months | 2–18 |
| Depends on | WP1 v1 for the first pilot deployment |

---

## Timeline (core scenario)

```
Month   1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18
WP1     ████████████████
WP2              ████████████████████
WP3                       ████████████████████
WP4                    ████████████████████████
WP5           ████████████████████████████████████
WP6        ████████████████████████████████████████████████████
Milestones:  M3 D1.1 · M6 D1.2/D1.3 · M9 D2.1 · M10 D2.3 · M12 D3.2/D4.2 · M14 D5.3 · M18 D6.3
```

## Scope by budget scenario

| Scenario | What changes |
|---|---|
| **Lean €30k** | WP1, WP2, WP4, WP6 only; WP3 reduced to the leaver-detection rules on directory events; WP5 limited to the data-classification design and EU-region move (no external security test). 3–5 pilots. 12 months |
| **Core €50k** | As written above. 5–8 pilots. 15 months |
| **Expanded €75k** | Adds a learned scorer in WP3, a second external security test after the models ship, 8–12 pilots including two with Microsoft 365 sync, and a formal comprehension study in WP4. 18 months |

## The "already started" boundary

Innov'up will not fund work that began before submission. The following exist
and are **not** claimed: the rule engine, the browser-only audit, the labelled
baseline sets and scorer, the activation events, the security controls listed
in `04`. They are the state of the art *inside the company* at filing. Every
task above is new work on top of them.
