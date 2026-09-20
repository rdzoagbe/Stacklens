# Security, privacy and trust package

The guide (section 12) asks for precise, evidenced statements — "EU-hosted",
"data minimisation designed into the architecture", "privacy controls
implemented" — and warns against a blanket "GDPR compliant". This document
gives each statement with the file that makes it true, and names what is
missing. The gaps are WP5's task list, not something to hide.

**Verify before filing:** the Firestore database location in the Firebase
console (the public sub-processor page says Belgium / `europe-west1`; the code
cannot prove it), and that the App Check enforcement state is what
`src/firebase-config.js` says.

## 1. Data inventory

| Category | Fields | Where it comes from | Personal data? |
|---|---|---|---|
| Account | Firebase uid, email, display name, photo URL, plan, trial start, Stripe customer / subscription ids | Sign-in (Google, magic link, password); Stripe webhook | Yes (the customer's admin) |
| Employees | name, email, department, title, status (active / offboarding / offboarded), start date, manager | CSV import; Google Workspace or Microsoft 365 directory sync; manual entry | Yes (the customer's staff) |
| Tools | name, vendor, category, cost per month, owner email, last-used date, MFA flags, criticality, renewal date, status | CSV import; manual entry; integrations | Owner email only |
| Access grants | employee id ↔ tool id, level (user / admin), status, granted date, last-reviewed date | Import; sync; manual | Indirectly (links a person to a tool) |
| Contracts, invoices, licences | vendor, amounts, dates, seat counts, document text for invoice extraction | Upload; invoice inbox; manual | Rarely (a contact name on an invoice) |
| Audit log | action, actor, timestamp, details | Every mutation (`src/lib/audit.js`, `appendAudit`) | Actor email |
| Consent and legal acceptance | choice, version, user agent, language, timestamp; documents accepted | Cookie banner; sign-up | No / uid only |
| Bank export (public audit) | Never stored, never sent — parsed in the visitor's browser (`src/lib/saasAudit.js`; the test asserts no network call) | — | Not processed by Stacklens |
| Product analytics | Event names with counts, buckets and kind labels | `src/lib/analytics.js`; `src/lib/analytics-privacy.test.js` forbids any personal key or identity field at every call site | No |

## 2. Data flow

```
Customer's browser ──(HTTPS, CSP, App Check)──► Firebase Auth
        │
        │ localStorage 'accessguard_v1'  ← primary read path (README, "Data flow")
        │
        ├─ debounced write ────────────► Firestore /userdata/{uid} (+ /chunks for large arrays)
        │                                     owner-only rules (firestore.rules)
        ├─ billing state (read-only) ◄── Firestore /users/{uid} ◄── Stripe webhook (functions/index.js)
        │
        ├─ AI features ──► Cloud Function /ai ──► Anthropic API (USA)
        │      chat text · contract text · invoice text · weekly-email facts (aggregates + tool names)
        │      20 calls / user / hour; App Check + Bearer token required
        │
        ├─ directory sync ──► Google Workspace / Microsoft 365 APIs (customer's own tenant, OAuth)
        │
        └─ scheduled functions (us-central1): daily alerts, weekly summary, purge of deleted client workspaces
                 read /userdata → email via the gated mailer (functions/mailer.js; no key = no send)

Export: Settings → Data (CSV per collection; full workspace JSON, src/lib/workspace-export.js)
Delete: Settings → Data → delete account (functions 'deleteaccount' action); client workspaces: 90-day soft delete then purge
```

## 3. Where data is stored, and in which region

| Store | Region | Evidence |
|---|---|---|
| Firestore (`/userdata`, `/users`, `/client_orgs`, logs) | EU, Belgium — as published on `/sub-processors` (`src/pages/LegalPages.jsx`, "Google Firebase … EU (Belgique)"). **Confirm in console** | Sub-processor page; CLAUDE.md |
| Firebase Hosting (static app) | Google global CDN | `firebase.json` |
| Cloud Functions (gen2) | **`us-central1` (USA)** — data is processed in memory there while a function runs (weekly summary, daily alerts, AI proxy, workspace API) | `functions/index.js` header comment and `region: 'us-central1'` |
| Browser localStorage | The customer's device | `src/lib/db.js` |
| Anthropic | USA — content of the four AI features only | `/sub-processors`; `functions/index.js` |
| Stripe | EU (Ireland) — billing identity only | `/sub-processors` |
| Sentry | EU / USA — error reports | `src/main.jsx`; `/sub-processors` |
| Google Analytics | EU — event names and counts only | `/sub-processors`; privacy test |

**Honest statement for the application:** *Customer data is stored at rest in
the EU. Server-side processing currently runs in a US region and four optional
AI features send the content they operate on to a US provider. Moving
processing to an EU region and bounding or replacing the AI provider for the
inference path are WP5 deliverables.*

## 4. Who can access tenant data

| Who | What | How it is enforced |
|---|---|---|
| The workspace owner | Their own `/userdata/{uid}` and chunks, read and write | `firestore.rules`: `isOwner(uid)` on both paths |
| Workspace members (viewer / editor / admin / owner) | The shared workspace, through the `workspace` Cloud Function only | Server-side role checks in `functions/workspace-write.js`; client `RoleGate` |
| The founder | `/users` (plan and trial fields, for support); **not** `/userdata` | `firestore.rules`: `isFounder()` grants `list` on `/users` and `founderWriteSafe()` limits fields; nothing grants `/userdata` |
| Any client | Nothing on `/client_orgs`, `/integration_credentials`, `/rate_limits` writes, `/consent_logs` reads | Explicit `allow read, write: if false` and the default deny |
| Cloud Functions | Admin SDK, bypasses rules | Every function requires a Firebase Bearer token (`verifyAuth`) and App Check; rate-limited |
| Tests | `src/lib/firestore-rules.test.js` runs the rules against the emulator | `npm run test:rules` |

## 5. Retention and deletion

| Data | Rule | Where |
|---|---|---|
| Client workspaces (agency model) | Soft delete: `deleted_at` + `purge_after` = +90 days; frozen (read-only, export allowed) until purge; `restoreorg` within the window; scheduled `purgeClientOrgs` hard-deletes chunks, document and record | `functions/workspace-write.js` (`RETENTION_DAYS = 90`); CLAUDE.md "Client workspace retention" |
| The account | `deleteAccount(confirmEmail)` → server `deleteaccount` action | `src/firebase-config.js`; `functions/` |
| Audit log | Capped at 2,000 entries (`AUDIT_MAX`), oldest dropped | `src/lib/audit.js` |
| Rate-limit counters | Hourly windows | `functions/index.js` |
| Daily-alert de-duplication state | Pruned after 400 days | `functions/index.js` |
| Bank exports on `/audit-saas` | Never retained: not uploaded | `src/lib/saasAudit.js` |
| **Gap** | No written retention schedule per category for the main workspace data (it lives as long as the account) | WP5 D5.1 |

## 6. Encryption

- In transit: HTTPS only; `Strict-Transport-Security` header (`firebase.json`).
- At rest: Google-managed encryption on Firestore and Cloud Storage (platform default; no customer-managed keys).
- Browser: localStorage is unencrypted on the device, by design of the platform; the app's public security page says "encrypted in transit and at rest" about the cloud copy. **Keep that wording precise in the application.**

## 7. Application-layer controls

| Control | Evidence |
|---|---|
| Content Security Policy, X-Frame-Options, Permissions-Policy | `firebase.json` headers; `src/lib/hosting-cache.test.js` and `external-services.test.js` keep `connect-src` in step with what the app calls |
| Firebase App Check (reCAPTCHA v3) on every function | `APP_CHECK_ENABLED = true` in `src/firebase-config.js`; probe on `/founder-admin` |
| Rate limits | `/ai` 20 per user per hour; checkout and portal 5 per hour |
| Billing fields cannot be written by the client | `protectedFieldsSafe()` in `firestore.rules`; trial replay blocked by `trialStampImmutable()` |
| Secrets in GCP Secret Manager, never in the repo | `functions/index.js` `defineSecret`; the mailer refuses to load its SDK without a key (`functions/mailer.js`) |
| Sub-processor page parity | `src/lib/subprocessors.test.js` fails if a service is called and not listed |
| No personal data in analytics | `src/lib/analytics-privacy.test.js` |
| Dependencies | Dependabot weekly, grouped minor/patch, majors separate (`.github/dependabot.yml`) |
| Error monitoring | Sentry (`src/main.jsx`) |

## 8. Audit logging

Every mutation through `useDbMutations()` appends an entry `{ action, user,
timestamp, details }` (`src/hooks/useDbQuery.js` → `appendAudit`). Imports log
`import.<kind>`. The log is exportable as CSV from Settings → Data. It records
**administrative actions**; it does not yet record recommendation verdicts
(confirm / reject / correct) because those actions do not exist yet — WP4.

## 9. AI provider and data-processing arrangements

| Feature | What is sent | Who can trigger it |
|---|---|---|
| Support chat (`FloatingChatbot`) | The user's typed messages plus a fixed system prompt | Any signed-in user, by choice |
| Contract comparison | Two contract texts the user uploaded | By choice |
| Invoice extraction (Budget tab, invoice inbox) | Invoice text | By choice / inbound email |
| Weekly summary insight | Aggregates: monthly spend, idle spend, up to 5 idle tool names, ex-employee-access count, up to 5 renewals (tool, date, cost), orphaned and high-risk counts | Scheduled, for users who opted into the email |

Provider: Anthropic (USA), listed on `/sub-processors` with the transfer
mechanism. Messages are capped (20 per call, 10,000 characters each) and
proxied server-side so the key never reaches a browser. **No inference in
WP1–WP3 depends on this provider today** (see `02`, §1c). WP5 decides whether
the inference path may use a hosted model at all, and under what boundary.

## 10. Incident response and security testing

| Item | State |
|---|---|
| Breach notification commitment | The DPA text commits to notifying within 72 hours (`src/translations.js`, `dpa_s6_item5`) |
| Written internal incident-response procedure | **Missing.** WP5 D5.3 |
| Automated tests | 826 unit tests in CI (2026-09-20), lint at 0 errors, Firestore rules tests against the emulator, a husky pre-commit hook |
| External penetration test | **Never done.** Budget line "security / privacy / testing" in `06`; WP5 D5.3 |
| Vulnerability management | Dependabot; Sentry; no formal SLA |
| Threat model | **Missing.** WP5 |

## 11. Lawful basis and roles (for privacy counsel to confirm)

- Stacklens is a **processor** for the customer's employee and tool data (the
  customer decides what to import and why) and a **controller** for account,
  billing, consent and analytics data.
- The DPA, privacy policy and sub-processor register are published at
  `/dpa`, `/privacy`, `/sub-processors`.
- **Gap:** no written record of processing (registre) and no DPIA-style
  assessment for the inference features. WP5 D5.4.

## 12. Data export

Settings → Data offers CSV per collection and a full workspace JSON export
(`src/lib/workspace-export.js`); a deleted client workspace stays exportable
during its 90-day window. This is the portability and hand-back path.
