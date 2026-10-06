# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # start Vite dev server on port 5173

# Build & deploy
npm run build        # Vite build → dist/
npm run deploy       # build + firebase deploy --only hosting

# Deploy selectively (preferred — avoids Secret Manager billing requirement for functions)
firebase deploy --only hosting
firebase deploy --only hosting,firestore
firebase deploy --only functions   # requires billing enabled on GCP project

# Functions local dev
cd functions && npm run serve      # Firebase emulator for functions only

# Quality
npm run lint         # ESLint — must stay at 0 errors
npm test             # Vitest — src/lib, src/pages, functions/ (no count here: it
                     # goes stale on every test added. Firestore rules tests are
                     # excluded from this run — they need the emulator, so
                     # `npm run test:rules`, or `npm run test:all` for both.)

# Grant evidence
node tools/record-baseline.mjs   # re-measure the inference engine against the
                                   # labelled sets and rewrite the dossier's table
```

There is a **husky pre-commit hook** that runs ESLint on staged files — commits will be blocked on lint errors.

## Architecture

### Data flow

The app uses a **dual-layer persistence model**:

1. **localStorage** (`LS_KEY = 'accessguard_v1'`) — primary read path. All app state (tools, employees, access, contracts, invoices, licenses) lives here as a single JSON blob.
2. **Firestore** (`/userdata/{uid}`) — cloud backup. Writes are debounced fire-and-forget via `saveDb()`. Large arrays (employees, access, audit_log) are stored as size-capped slices in the `/userdata/{uid}/chunks` subcollection (Firestore 1MB doc limit) and reassembled by `loadUserData()`. On sign-in, `hydrateFromFirestore()` pulls cloud → localStorage (local wins if it has more data).

`useDbQuery()` (TanStack Query, `queryKey: ['db']`) reads localStorage through `readDb()`, which **never writes**: with no workspace in the browser it returns the demo company built in memory (`buildSeedDb()`). Only the paths that mean it save the demo (`seedDbIfEmpty()`: starting the demo, signing in, a change), so a visitor to a public page leaves nothing in their browser, and sign-out writes nothing back (`public-storage.test.jsx`). `useDbMutations()` wraps writes that call `saveDb()`. To update data anywhere: mutate via `useDbMutations()`, never write to localStorage directly.

**Own-account writes go through `saveOwnWorkspaceNow(uid, db)`** (`src/lib/db.js`), which refuses while the browser holds a shared or client workspace (`_shared_view`). Calling `saveUserData(uid, loadDb())` from a screen used to overwrite the viewer's own account with another company's workspace; `shared-view-writes.test.jsx` fails if any file other than firebase-config, lib/db and onboarding calls `saveUserData`.

Plan/billing state lives in a **separate** Firestore collection (`/users/{uid}`) updated only by the Stripe webhook. Client reads it via `getUserPlanFromFirestore()` and merges into `db.user`.

### Plan & access control

Three gating systems:
- `PlanGate({ requires })` — compares `resolvePlan(user)` against `PLAN_TIERS` in `src/lib/plan.js`. The tiers are **not** a single sales ladder: `free` 0, `starter` 2, `hr_finance` 2, `pro` 3, `enterprise` 4, `scale`/`unlimited`/`professional` 4, and `trial` 4 — a trial deliberately has full access and expires after `TRIAL_DAYS`. `starter` and `hr_finance` are the same tier, so `requires` cannot distinguish them; use `ModuleGate` when the distinction matters.
- `ModuleGate({ module })` — maps plan to enabled modules (`security`, `finance`, `people`, `ai`, `analytics`, `api`). Starter has `people`; HR & Finance adds `finance`; Pro adds `security`, `ai`, `analytics`; only Enterprise has `api`. The locked screen names the cheapest plan that unlocks the module (`cheapestPlanFor`).
- `RoleGate({ requires })` — RBAC within the app (`viewer`, `editor`, `admin`, `owner`)

`hasModule(user, module)` and `hasRole(requires)` (in `gates.jsx`) are the same rules for a single control, e.g. Finance → Budget: viewers read, editors import and set budgets; the bank button needs the `api` module because the `bankfeed` endpoint checks `API_PLANS` (`plan-parity.test.js`), and is shown locked below it. Team invites: `canInviteTeam()` / `NO_TEAM_PLANS` in `plan.js` mirror the `invite` check in the `workspace` function (free and trial cannot invite).

**Server side:** `resolvePlan()` is client-only, and nothing ever rewrites
`/users/{uid}.plan` from `'trial'` back to `'free'`. Cloud Functions must use
`effectivePlan()` from `functions/workspace-write.js`, which applies trial
expiry to the stored field — reading `plan` directly let an expired trial keep
its allowance indefinitely. `src/lib/plan-parity.test.js` keeps the two in step.

`resolvePlan()` in `src/lib/plan.js` is the **single source of truth** — always use it, never derive plan from `db.user.plan` directly. Founder override (`is_founder=true`) always returns `'scale'`. Trial expiry is checked client-side against `trial_started_at` + `TRIAL_MS` (7 days).

### Source files

#### Core

| File | Purpose |
|---|---|
| `src/App.jsx` | ~280 lines — providers, error boundary, and route table only |
| `src/firebase-config.js` | Firebase init, all auth helpers, Firestore CRUD, Stripe billing calls, AI proxy, consent logging |
| `src/translations.js` | i18n strings (EN/FR/DE/ES/PT) + `useTranslation()` hook. AI auto-translate via `callAI()`. |
| `src/main.jsx` | React entry point |

#### Pages (`src/pages/`)

| File | Route |
|---|---|
| `TrialPage.jsx` | `/` — landing + sign-in |
| `DashboardPage.jsx` | `/dashboard` |
| `ToolsPage.jsx` | `/tools` |
| `EmployeesPage.jsx` | `/employees` |
| `FinancePage.jsx` | `/finance` (shell; tabs below) |
| `SecurityCompliancePage.jsx` | `/security` |
| `AccessPage.jsx` | `/access` |
| `OffboardingPage.jsx` | `/offboarding` |
| `SettingsPage.jsx` | `/settings` (shell; tabs below) |
| `SecurityCompliancePage.jsx` | `/audit` (same page as `/security`) |
| `OnboardingPage.jsx` | `/onboarding` |
| `FinanceLeadsPage.jsx` | `/direction-financiere` — for finance leads; each row is a job-description line and the screen that does it, held to the code by `finance-channel.test.js` |
| `LegalPages.jsx` | `/privacy`, `/terms`, `/dpa`, `/sub-processors`, `/security-info`, `/legal`, `/about`, `/contact` |
| `FinishSignUpPage.jsx` | `/finishSignUp` |

#### Finance tabs (`src/pages/finance/`)

`OverviewTab`, `CostTab`, `LicensesTab`, `RenewalsTab`, `AnalyticsTab`, `BudgetTab`, `ExecutiveDashboard`

#### Settings tabs (`src/pages/settings/`)

`BillingTab`, `IntegrationsTab`, `TeamTab`, `NotificationsTab`, `SecurityTab`, `ApiKeysTab`, `DataTab`

`ApiKeysTab` is wrapped in `ModuleGate module="api"`, whose plan list must stay equal to `API_PLANS` in `functions/index.js` — enforced by `src/lib/plan-parity.test.js`.

#### Components (`src/components/`)

| File | Purpose |
|---|---|
| `AppShell.jsx` | Sidebar nav + top bar wrapper used by all authenticated pages |
| `FloatingChatbot.jsx` | AI chat assistant overlay |
| `gates.jsx` | `RequireAuth`, `PlanGate`, `ModuleGate`, `RoleGate` |
| `ui.jsx` | Shared primitives: Button, Input, Modal, Pill, etc. |

#### Other `src/` files

| File | Purpose |
|---|---|
| `components/ImportWizard.jsx` | CSV/spreadsheet import flow. Headers people write ("Nom", "Coût / mois", "E-mail") are mapped to the template names by `lib/csvHeaders.js` (`normaliseCsvHeaders`, per kind; `csvAmount` reads "1 200,50" and "49.90 €"); `parseCsv` follows the header's delimiter (`;` from French Excel). The dashboard opens it on "what are you importing?". |
| `components/SlackNotifications.jsx` | Slack webhook digests |
| `google-workspace.js` | GWS OAuth + Directory API helpers |
| `auth-redirect.js` | OAuth popup relay (Microsoft/Okta postMessage bridge) |

#### Contexts, hooks, lib

| Path | Purpose |
|---|---|
| `src/contexts/LangContext.jsx` | `LanguageContext` / `useLang()` — language preference |
| `src/contexts/CurrencyContext.jsx` | Currency conversion context |
| `src/contexts/TourContext.jsx` | Product tour state |
| `src/hooks/useAuth.js` | Firebase auth state hook |
| `src/hooks/useDbQuery.js` | TanStack Query wrapper for localStorage DB |
| `src/lib/plan.js` | `resolvePlan()`, `getTrialState()`, plan constants |
| `src/lib/planCards.js` | The plan cards (prices, bullets in 5 languages) shared by the landing page and Settings → Billing; every number comes from `PLAN_LIMITS`, `TEAM_INVITE_LIMIT`, `CLIENT_WORKSPACE_LIMIT` |
| `src/lib/db.js` | `saveDb()`, `hydrateFromFirestore()`, DB schema helpers |
| `src/lib/dataUtils.js` | Pure data utilities (sorting, filtering, CSV export) |
| `src/lib/currency.js` | Currency formatting and conversion |
| `src/lib/constants.js` | App-wide constants |
| `src/lib/utils.js` | `cx()` classname helper |
| `src/lib/waste.js` | `computeWaste()` — the single definition of recoverable spend |
| `src/lib/budget.js` | Department budgets, `spend_history` snapshots, `previousMonthSpend()`, `spendTrend()` |
| `src/lib/analytics.js` | `track()` — the only place that talks to gtag |

### Routing

All routes are in `src/App.jsx`. Public routes: `/` and legal pages (`/privacy`, `/terms`, `/dpa`, etc.). All authenticated routes wrap with `<RequireAuth>`. Sensitive modules (Finance, Employees, Security, Access, Offboarding) also wrap with `<ModuleGate>`.

**There are no `/pricing` or `/features` routes** — unknown paths hit `<NotFound>` which redirects to `/`.

Redirects: `/integrations` → `/settings`, `/billing` → `/settings`, `/analytics` → `/finance`, `/licenses` → `/finance`, `/renewals` → `/finance`, `/invoices` → `/finance`, `/contracts` → `/finance`.

Also routed and previously undocumented: `/cost`, `/executive`, `/import`, `/founder-admin`.

### Authentication

Three sign-in methods, all in `firebase-config.js`:
- Google popup (`signInWithGoogle`)
- Magic link (`sendMagicLink` / `completeMagicLinkSignIn`)
- Email/password (`registerWithEmail` / `signInWithEmail`)

**Firebase App Check (reCAPTCHA v3) is ENABLED** (`APP_CHECK_ENABLED = true` in `src/firebase-config.js`, set 2026-09-15). It had been flipped on twice before and took sign-in down twice: once App Check is initialised on the app Auth uses, the Auth SDK attaches a token to every ID-token refresh, so a failing exchange corrupts the refresh and 401s every auth-gated call. There is no fail-open.

The root cause of both outages was the reCAPTCHA **secret** field in Firebase Console → App Check → Apps holding the **site** key. The two look alike (same length, both begin `6L`) and Firebase stores the secret write-only, so every console screen read "Registered" while the exchange returned 400 — the one wrong value was the one value that cannot be displayed.

**Before touching the flag, the reCAPTCHA key, or its allowed domains:** run **Test App Check** on `/founder-admin`. `src/lib/appCheckProbe.js` attempts the same exchange on a second, throwaway Firebase app — no Auth instance, no Firestore, token auto-refresh off, app deleted afterwards — so a failure cannot reach a real session. It reports the raw Firebase error and the token's length, never the token.

**Rollback if sign-in breaks:** set the flag to `false` and `firebase deploy --only hosting`. That is the whole undo.

**Enforcement is a separate switch**, per service, under Firebase Console → App Check → APIs. The flag only makes the client *send* tokens; nothing is rejected for lacking one until enforcement is turned on there. Watch the verified/unverified split first.

### Cloud Functions

Functions called from the app require a Firebase Auth Bearer token (`verifyAuth`). Four HTTP endpoints deliberately do not, and each checks something else: `api` (the customer's API key), `stripeWebhook` (Stripe's signature), `invoiceInbound` (the private inbox address) and `clientErrors` (anonymous crash reports). The public security page names all four, and `src/lib/claims.test.js` fails if a fifth appears. Rate limits: `/ai` → 20 calls/hr per user, `/createCheckout` + `/createPortal` → 5 calls/hr per user. Limits are stored in Firestore `/rate_limits/{prefix}_{uid}`.

### Public claims are tested against the code

`src/lib/claims.test.js` holds what the site tells people — cookie consent, integration tokens, deletion, the browser copy, export, unauthenticated endpoints, AI disclosures — to the code that makes each true. When a test there fails, the fix is usually to change the copy, not the test: the test is telling you a public statement just became false.

### The free audit (`/audit-saas`): review and client report

The page promises the bank file never leaves the browser, and `accountant-channel.test.js` holds it to that: no fetch, no storage, analytics gets counts only. Two features live inside that promise:
- **Review.** Each line takes a verdict (correct / not software / rename / it's software), applied by `applyVerdicts` in `src/lib/saasAudit.js`; totals, findings, CSV and report are all rebuilt from it. Verdicts live in memory only.
- **Stopped subscriptions.** A subscription not charged for well over its billing period before the end of the file (`isStopped` in `saasAudit.js`: 1.5 periods + 5 days, never under 21 days; a single charge never) goes to `report.stopped`, out of every total and finding, listed with its last charge on the page, in the client report and in the CSV (`status` column).
- **Firm name, remembered on request.** The client-report panel can keep the accountant's own firm name on this device, only when its box is ticked (`src/lib/auditPrefs.js`, one key `stacklens_audit_firm`; unticking deletes it). The client name, the note and anything from the file are never kept; `accountant-channel.test.js` checks the module's storage calls and that the page copy says so.
- **From audit to workspace.** « Créer mon espace avec ces N abonnements » keeps a summary of the active subscriptions (vendor, category, frequency, per-month amount, last charge date, reviewed flag; never a bank label, a transaction or anything about the client) in `stacklens_audit_handoff` for 2 hours (`src/lib/auditHandoff.js`) and opens `/?signup=true`, which now opens the create-account form. Once signed in, `components/AuditHandoffPrompt.jsx` (in `AppShell`, never in the demo) lists what would be added, and writes nothing until Import (`importAuditTools`, within the plan's tool allowance; tools get `origin: 'audit'`, lines confirmed in the audit arrive reviewed). Ignore, import, expiry and sign-out all delete the list.
- **Several clients at once** (`src/lib/portfolio.js`). Several files dropped together (25 at most) become a portfolio: one row per client read exactly like a single file (bank or FEC), totals (not added across currencies), a CSV of figures only, and each client's full report a click away with its own in-memory review and its name prefilled on the client report. Same promise as the rest of the page; `accountant-channel.test.js` checks the module and the analytics payload (counts only).
- **Corrections to Stacklens** leave only as an email the reader sends: `correctionsMailto` opens their mail client with the corrected bank labels and verdicts, never amounts or dates.
- **FEC (beta).** A ledger export is recognised by its header (`isFec`) and read by `src/lib/fec.js` into the same transactions; each carries the class of its expense account (software / excluded / neutral), which `detectRecurring` lets override the vendor name. Bank transactions carry no ledger, so the bank baseline is unaffected. Measured on synthetic files only — `docs/fec-prototype.md` lists what real files must show.
- **Client report.** A one-page print layout with the accountant's firm and client name, printed by the browser ("Save as PDF"). It is portalled into `#print-report`, and the print CSS in `index.css` hides the rest of the page only while `body.printing-report` is set.

### Tools the app added by itself (`src/lib/toolReview.js`)

Invoice import, the email inbox and the bank connection (all via `importInvoices`), Google Workspace discovery and the free-audit handoff create tools nobody typed. Each carries `origin` (`invoice` / `bank` / `google-workspace` / `audit`; older ones are recognised by their `notes`) and shows **To check** on the Tools page until an editor says Correct, renames it, or says Not software (`reviewTool` in `useDbQuery.js`). Not software deletes the tool and its access and adds the vendor to `db.rejected_vendors`, so `importInvoices` records the next invoice from them without re-creating the tool, and the import review screens start it unticked. A CSV `origin` column is ignored unless it is one of those.

### Supplier invoice check (`src/lib/invoiceCheck.js`)

Every imported invoice (`db.invoice_records`, from the PDF import, the email inbox or the bank connection) is checked: **duplicate** (same vendor, amount and date/period), **after_cancel** (a recent invoice for a decommissioned tool), **above_agreed** (more per month than the tool's `agreed_monthly`, `agreed_basis` `ht`/`ttc`) and **price_rise** (more than the vendor's previous invoice on the same billing cycle, only when no agreed price exists). Import paths extract `amount` including tax and, from PDFs and the inbox, `amount_excl_tax`; a before-tax agreed price is compared with that, or with the total after adding 20 % VAT, which the finding says it assumed. Shown in Finance → Budget (`components/InvoiceCheckPanel.jsx`: Justified sets `cleared` on the invoice, and the agreed price can be recorded inline or in the tool form) and as a dashboard action (`invoice_check`). Two bank summaries of one charge, or one document imported twice, are not a duplicate, and `importInvoices` skips a line already recorded (same source, vendor, amount, date, file); several amounts from one vendor in one month mean several products, not a price rise; an invoice is matched to the closest tool; vendors in `rejected_vendors` are not checked. The demo seed carries one of each main kind.

### Risk, spend and cost rules the pages share

- **Access risk** (`computeAccessDerivedRiskFlag`): `former_employee` is the only high risk; an admin right unreviewed or reviewed over 180 days ago, or any right over a year, is `needs_review`; a recently reviewed admin is `none`. The Access page's "revoke all" lists each access by name in its confirm. The dashboard's "reviews overdue" counts `needs_review`.
- **Spend**: every total comes from `billedTools()` / `monthlySpend()` in `lib/waste.js` (decommissioned tools bill nobody), including `FinancePage`, `lib/budget.js` and its server twin in `functions/monthly-report.js`. `employeeCostShares()` splits each tool's cost between the people holding it; the Employees page shows that share.
- **Security score**: `computeMfaCoverage` is `null` until a tool says anything about MFA (the tool form's MFA field, or a `tool_mfa` / `mfa` CSV column via `csvToolExtras` in `useDbQuery.js`, which also reads `seats`, `billing_cycle`, `auto_renew`). The spend alert fires only above `db.user.budget_cap`. The customer's Security page carries no block about Stacklens's own certifications.
- `smb-walkthrough.test.js` holds these.

### Notification switches (`src/lib/notifications.js`)

Settings → Notifications shows only switches that change an email: each entry in `NOTIFICATION_SWITCHES` names the `db.user` field `dailyAlerts` / `weeklySummary` check (`renewal_alerts`, `budget_alerts`, `access_alerts`, `weekly_summary`). `notifications.test.jsx` fails if a switch has no server reader or a daily alert kind has no switch. Never add a switch for an email that does not exist.

### Monthly report to management (`functions/monthly-report.js`)

Opt-in in Settings → Notifications (`components/MonthlyReportSettings.jsx`, stored as `db.user.monthly_report = { enabled, recipients, lang }`). `monthlyReport` (scheduled `0 8 1 * *` Europe/Paris) builds last month's report — spend and forecast, budgets by department (same figures as Finance → Budget), supplier invoice findings, renewals in the next 30 days, three priority actions — and sends it once per period (`report_state/{uid}`, purged with the account). Recipients: the account's Firebase Auth email **only if verified** (`verifiedEmailForUid`, which every scheduled email uses) plus up to three colleagues **on the same domain, never a public mail domain** (`reportRecipients`; the workspace is client-written, so the server re-checks). `reportnow` sends a preview to the caller's own address only, 3/hour. The invoice check and the recipient rule exist in both `src/lib` and the functions module; `report-parity.test.js` runs both on the same inputs and compares their constants.

### Demo kit (`public/demo/`)

One fictional company (Atelier Lumen, domain `.example`) told through every file the site reads: `atelier-lumen-application.csv` for the in-app "Company data" import (people, tools and access in one file, using the optional `tool_owner_email`, `tool_last_used`, `access_status`, `access_last_used`, `access_last_reviewed` columns), and a 24-month bank statement and an FEC for the free audit. `public/demo/index.html` (stacklens.fr/demo/) lists them; `public/demo/LISEZ-MOI.md` is the French walkthrough for testing and prospect demos. Files are generated by `node tools/make-demo-kit.mjs` (deterministic) and `src/lib/demo-kit.test.jsx` checks they match the generator, runs them through the audit engine and the real import, and checks every figure the guide quotes. If the engine changes, regenerate and update the guide rather than the test.

### Testimonials (`src/lib/testimonials.js`)

Empty until a real customer approves a quote; `components/Testimonials.jsx` renders nothing while it is. Each entry must carry its consent (`consent.date`, `scope`, `approvedVerbatim: true`, `proof`) and state whether it came from early access, which the site discloses; `testimonials.test.jsx` refuses anything else. Never add an invented, reworded or unconsented quote. The process, the consent email and the review-site checklist are in `docs/outreach/preuves-clients.md`; logos go in `public/proof/`.

### Early access (`/experts-comptables#acces-anticipe`)

The offer (10 firms, Pro free for 6 months, 3 calls of 20 minutes) is read from `EARLY_ACCESS` in `src/lib/earlyAccess.js`; the copy uses placeholders, never typed numbers (`claims.test.js` §9). Set `OPEN: false` when the places are taken. Applications go to hello@ through the contact form provider (Web3Forms), with a mailto fallback; nothing is stored.

Granting it: **Early access** button on `/founder-admin` → `founderGrantPlan` writes `plan`, `plan_grant_until`, `plan_grant_reason` on `/users/{uid}`. Past `plan_grant_until` the account is free unless it has started paying: `grantExpired()` in `src/lib/plan.js` and its twin in `functions/workspace-write.js`, held together by `plan-parity.test.js`. The two grant fields are protected in `firestore.rules` (only the founder writes them). Setting a plan by hand clears any grant.

### Signing out, cancelling and deleting

- **Signing out** removes this account's data from the browser (`clearLocalWorkspace` in `src/lib/db.js`), after `flushBeforeSignOut` writes anything the cloud may not have. If that cannot be confirmed the user is asked before anything is discarded. An expired session does not clear, only an explicit sign-out.
- **Cancelling** a subscription moves the account to `free` and deletes nothing.
- **Deleting** the account (Settings → Data) calls the `workspace` function's `deleteaccount`, which purges everything via `purgeAccount`. It refuses with 409 `subscription_active` while Stripe can still bill (`subscriptionBlocksDeletion` in `functions/purge-account.js`), because purging `/users` removes the only link from the Stripe customer back to the account.

Secrets (ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SENDGRID_API_KEY) are in GCP Secret Manager — deploying functions requires billing enabled on the GCP project.

### Firestore security rules

`/users/{uid}` — owner read/write, but `protectedFieldsSafe()` blocks client writes to billing fields (`plan`, `stripe_*`, `subscription_*`, `is_founder`, `role`). Only exception: self-starting a trial (`plan='trial'` + `trial_started_at`) is allowed once per user (prevented from replay by checking existing doc has no `trial_started_at`).

`/userdata/{uid}` — owner only, no field restrictions.

`/legal_acceptances/{id}` — create-only, and only `uid`, `accepted_at`, `documents`, `plan_id` (no email: the row outlives the account, `functions/purge-account.js` RETAINED).

`/client_orgs/{orgId}` — server only (`allow read, write: if false`); reached
exclusively through the `workspace` function.

### Client workspace retention

`deleteorg` is a **soft delete**: it sets `deleted_at` and `purge_after` on the
`client_orgs` record and keeps the data. `purgeClientOrgs` (scheduled daily)
hard-deletes the chunks, the `userdata` document and the org record once
`purge_after` passes. `RETENTION_DAYS = 90` lives in
`functions/workspace-write.js` and is sent to the client by `listorgs`, so the
confirmation copy cannot claim a different window than the purge honours.

While deleted, a workspace is **frozen, not gone**: `read` still works so its
data can be exported and handed back, `write` returns 409, it is excluded from
`listorgs.orgs`, and it does not count against the plan's client-workspace cap.
`restoreorg` is the exact inverse and refuses once the window has passed.

### Innov'up grant dossier and the inference baseline

`docs/grants/innovup/` is the application dossier for the Innov'up
Île-de-France grant. Its technical claims are generated, not written:
`src/lib/baseline.js` scores `src/lib/saasAudit.js` against the labelled sets
in `test-data/innovup-baseline/`, `tools/record-baseline.mjs` writes the
result to `docs/grants/innovup/evidence/baseline-results.json` and into the
marker block of `02-technical-baseline.md`, and `src/lib/baseline.test.js`
fails whenever either stops matching the code.

**The freeze is lifted.** The Région answered on 2026-09-24 that entreprises
individuelles are not eligible for Innov'up, so there is no filing and no
reason to hold the engine still. Two rules survive on their own merit: re-run
`tools/record-baseline.mjs` whenever the engine changes so the dossier never
quotes a figure the code no longer earns, and keep each dated results file
rather than overwriting it, since the before-and-after is the evidence.

`src/lib/activation.js` records the activation KPIs the dossier quotes
(`first_insight`, `return_after_insight`, `recommendations_shown`,
`recommendation_acted`). They carry counts, minutes and kind labels only;
`analytics-privacy.test.js` checks every call site, and `activation.test.js`
pins that first insight fires once, never on an empty inbox, never in demo.

### i18n

`useTranslation()` from `translations.js` returns `t(key)`. Language preference stored in `localStorage('language')` and managed by `useLang()` from `src/contexts/LangContext.jsx`. Five languages: `en`, `fr`, `de`, `es`, `pt`. Missing keys are auto-translated via AI and cached in localStorage.

### Visual system

Held by `src/lib/design-tokens.test.js`:
- **Font:** Inter, self-hosted via `@fontsource-variable/inter` (imported in `main.jsx`, set as `fontFamily.sans` in `tailwind.config.js`). Never Google Fonts: it would be a new sub-processor and is outside the CSP.
- **Secondary text:** `text-slate-500`, whose token is overridden to `#74839a` so it passes WCAG AA on slate-950 and slate-900. Never `text-slate-600/700` for text.
- **Critical red:** `red-*` only; no `rose-*`.
- **Modal backdrop:** `bg-slate-950/70 backdrop-blur`, the same as `<Modal>`.
- **Public pages** (legal, about, contact, security, accountants, audit) use `<PublicNav>`; the landing nav keeps its own links but the same classes.

### Deployment

Firebase Hosting (`dist/`) with security headers in `firebase.json` including a strict CSP. After any `vite build`, run `firebase deploy --only hosting`. The CSP `connect-src` must include all external APIs the app fetches (googleapis, google.com, gstatic.com, apis.google.com, accounts.google.com). Note: `open.er-api.com` was removed deliberately — amounts are never converted (see `src/lib/currency.js`), so nothing fetches exchange rates.

Source maps are disabled in production (`sourcemap: false` in `vite.config.js`).
