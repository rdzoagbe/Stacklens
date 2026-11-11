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

1. **The browser's copy** (`LS_KEY = 'accessguard_v1'`, `src/lib/workspaceStore.js`) — primary read path. All app state (tools, employees, access, contracts, invoices, licenses) is one JSON blob, kept in **IndexedDB** (no size ceiling) behind a synchronous in-memory copy primed once before React mounts (`primeWorkspaceStore()` in `main.jsx`), so `loadDb()` stays a plain call. localStorage keeps a **mirror while the blob is under 4 MB** (`LS_MIRROR_MAX_BYTES`), removed rather than cut when it grows past that; a copy an older build left in localStorage is migrated on first load, the newer `_saved_at` winning. Writes reach other open tabs through a `BroadcastChannel`, which re-reads the query. Where IndexedDB does not exist (tests under jsdom, a locked-down browser) the store is a plain localStorage pass-through, so every test that sets `accessguard_v1` directly still works; `workspaceStore.test.js` and `scale.test.js` (3,000 people, 20,000 access rows, stored whole, every derived figure computed over all of it) use `fake-indexeddb`. **Nothing is trimmed any more**: `saveDb` used to cut the access list to 150 rows above 4.5 MB and flag the blob `_trimmed`; the flag is still honoured on read (an old blob known to be incomplete is never synced to a shared workspace) and cleared by any copy read from the cloud. Only `lib/db.js`, `lib/workspaceStore.js`, `hooks/useAuth.js` and `firebase-config.js` touch the key; everything else reads through `loadDb()`.
2. **Firestore** (`/userdata/{uid}`) — cloud backup. Writes are debounced fire-and-forget via `saveDb()`. Large arrays (employees, access, audit_log) are stored as size-capped slices in the `/userdata/{uid}/chunks` subcollection (Firestore 1MB doc limit) and reassembled by `loadUserData()`. On sign-in, `hydrateFromFirestore()` pulls cloud → localStorage (local wins if it has more data).

`useDbQuery()` (TanStack Query, `queryKey: ['db']`) reads the browser's copy through `readDb()`, which **never writes**: with no workspace in the browser it returns the demo company built in memory (`buildSeedDb()`). Only the paths that mean it save the demo (`seedDbIfEmpty()`: starting the demo, signing in, a change), so a visitor to a public page leaves nothing in their browser, and sign-out writes nothing back (`public-storage.test.jsx`). `useDbMutations()` wraps writes that call `saveDb()`. To update data anywhere: mutate via `useDbMutations()`, never write to localStorage directly.

**Own-account writes go through `saveOwnWorkspaceNow(uid, db)`** (`src/lib/db.js`), which refuses while the browser holds a shared or client workspace (`_shared_view`). Calling `saveUserData(uid, loadDb())` from a screen used to overwrite the viewer's own account with another company's workspace; `shared-view-writes.test.jsx` fails if any file other than firebase-config, lib/db and onboarding calls `saveUserData`.

**Settings → Data → Compare with the stored copy** (`lib/reconcile.js`, `components/ReconcilePanel.jsx`): the browser's copy against the server's (the own account's Firestore document through `loadUserData`, a shared or client workspace through `workspaceRead`), collection by collection (`RECONCILED_COLLECTIONS`), by record id: what is stored but missing here, what is here but not yet stored, and the revision each holds. It changes nothing until **Save now** (the usual revision-checked save) or **Use the stored copy** (`adoptCloudCopy`, own account only; a shared workspace is reopened from Client workspaces). The demo has nothing stored. `reconcile.test.js`, `ReconcilePanel.test.jsx`; the help list has `hf_reconcile`.

**Concurrent edits never overwrite each other silently** (`lib/revision.js`): every cloud write, the owner's `saveUserData` transaction and a member's `workspace` `write`, is conditional on the `_rev` it was based on; a stale write is refused (409 for members), the two copies are compared (`sameSubstance`: two tabs saving the same data is not a conflict), and otherwise the person chooses keep-theirs or keep-mine (`markSyncConflict`, `save-conflict.test.js`).

Plan/billing state lives in a **separate** Firestore collection (`/users/{uid}`) updated only by the Stripe webhook. Client reads it via `getUserPlanFromFirestore()` and merges into `db.user`.

### Plan & access control

Three gating systems:
- `PlanGate({ requires })` — compares `resolvePlan(user)` against `PLAN_TIERS` in `src/lib/plan.js`. The tiers are **not** a single sales ladder: `free` 0, `starter` 2, `hr_finance` 2, `pro` 3, `cabinet` 3, `business` 4, `enterprise` 4, `scale`/`unlimited`/`professional` 4, and `trial` 4 — a trial deliberately has full access and expires after `TRIAL_DAYS`. `starter` and `hr_finance` are the same tier, so `requires` cannot distinguish them; use `ModuleGate` when the distinction matters.
- `ModuleGate({ module })` — maps plan to enabled modules (`security`, `finance`, `people`, `ai`, `analytics`, `api`). Free and Starter have `people` (every card sells a number of employees, so the pages that hold them open on every plan); Starter (and the legacy HR & Finance) add `finance`; Pro and Cabinet add `security`, `ai`, `analytics`; Business and Enterprise add `api` (the API and the bank connection). The locked screen names the cheapest plan that unlocks the module (`cheapestPlanFor`).
- `RoleGate({ requires })` — RBAC within the app (`viewer`, `editor`, `admin`, `owner`)

`hasModule(user, module)` and `hasRole(requires)` (in `gates.jsx`) are the same rules for a single control, e.g. Finance → Budget: viewers read, editors import and set budgets; the bank button needs the `api` module because the `bankfeed` endpoint checks `API_PLANS` (`plan-parity.test.js`), and is shown locked below it. Team invites: `canInviteTeam()` / `NO_TEAM_PLANS` in `plan.js` mirror the `invite` check in the `workspace` function (free and trial cannot invite).

**Server side:** `resolvePlan()` is client-only, and nothing ever rewrites
`/users/{uid}.plan` from `'trial'` back to `'free'`. Cloud Functions must use
`effectivePlan()` from `functions/workspace-write.js`, which applies trial
expiry to the stored field — reading `plan` directly let an expired trial keep
its allowance indefinitely. `src/lib/plan-parity.test.js` keeps the two in step. A trial stamped in the future is no trial (`FUTURE_SKEW_MS`, 5 minutes, in both), and `firestore.rules` accepts a self-started trial only with `trial_started_at == request.time` (the client's `serverTimestamp()`): a far-future stamp used to make the trial last for ever.

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
| `DevicesPage.jsx` | `/devices` — the hardware register (see below) |
| `SettingsPage.jsx` | `/settings` (shell; tabs below) |
| `SecurityCompliancePage.jsx` | `/audit` (same page as `/security`) |
| `OnboardingPage.jsx` | `/onboarding` |
| `FinanceLeadsPage.jsx` | `/direction-financiere` — for finance leads; each row is a job-description line and the screen that does it, held to the code by `finance-channel.test.js` |
| `LegalPages.jsx` | `/privacy`, `/terms`, `/dpa`, `/sub-processors`, `/security-info` (the cards, then **For larger organisations**: `sec_large_have_*` / `sec_large_not_*`, what exists and what does not, written for a vendor security review), `/legal`, `/about`, `/contact` |
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
| `components/ImportWizard.jsx` | CSV/spreadsheet import flow. Headers people write ("Nom", "Coût / mois", "E-mail") are mapped to the template names by `lib/csvHeaders.js` (`normaliseCsvHeaders`, per kind; `csvAmount` reads "1 200,50" and "49.90 €"); `parseCsv` follows the header's delimiter (`;` from French Excel). An `.xlsx` is read by the bundled exceljs (`lib/xlsxToCsv.js`; the old SheetJS 0.18.5 from cdnjs had published advisories and is gone, as is cdnjs from the CSP); an old `.xls` is refused with a sentence. The dashboard opens it on "what are you importing?". |
| `components/SlackNotifications.jsx` | Slack webhook digests |
| `auth-redirect.js` | OAuth popup relay (Microsoft/Okta postMessage bridge) |

#### Contexts, hooks, lib

| Path | Purpose |
|---|---|
| `src/contexts/LangContext.jsx` | `LanguageContext` / `useLang()` — language preference |
| `src/contexts/CurrencyContext.jsx` | Currency conversion context |
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

**There are no `/pricing` or `/features` routes** — unknown paths hit `<NotFound>`, a real 404 page (`nf_*` keys) with the public menu and a link home; it used to bounce to `/` without a word.

Redirects: `/integrations` → `/settings?tab=integrations`, `/billing` → `/settings?tab=billing`, `/analytics` → `/finance`, `/licenses` → `/finance`, `/renewals` → `/finance`, `/invoices` → `/finance`, `/contracts` → `/finance`.

**A button that opens a Settings tab links to `/settings?tab=…`** (`VALID_TABS` in `SettingsPage.jsx`), never navigates and then clicks the tab on a timer: Settings is loaded on demand, so the timer fired before the page existed and people landed on General. `settings-links.test.js` fails on a timer click, on a bare `/settings` link and on a tab Settings does not have.

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

**A failed sign-in says why.** Every sign-in function in `firebase-config.js` returns `authFail(provider, error)`, which logs `[sign-in] <provider> failed: <code> <reason>` to the console (emails and long tokens scrubbed; a closed popup is not logged) and keeps the provider's explanation (an `AADSTS…` number or an OAuth2 error word) with the message. `authErrorMessage(raw, t, { sso })` builds the sentence the sign-in screen shows: the generic one, and for the Google and Microsoft buttons "Wrong email or password." too, carry `(code · reason)`; every other named failure keeps its own sentence. That is how an expired Azure client secret (stored in Firebase Console, not in the repo) is told from a wrong password. `auth-diagnostics.test.js` holds it, including that no sign-in function returns the bare message and that the screen never calls `t(authErrorKey(…))` by hand.

**Two-step sign-in (TOTP, an authenticator app)** is optional per account, set up in Settings → Security (`components/TwoStepCard.jsx`: QR code drawn locally by `qrcode-generator` as a data URL, the secret kept only in component state, first code confirms; a verified email is required, so for an unverified account the card offers Resend verification email (60 s cooldown, like the sign-up screen) and I've verified, which re-reads the flag from the server with `refreshEmailVerified`; an account with no email at all, as some Microsoft sign-ins reach Firebase, gets an address field instead: `addVerifiedEmail` (`verifyBeforeUpdateEmail`) sets the address only when its link is clicked, and Firebase then ends the session, which the copy says). Every sign-in function goes through `signInResult` in `firebase-config.js`: on `auth/multi-factor-auth-required` it asks for the code in `SecondFactorPrompt` (mounted once in `App`, `lib/secondFactor.js`) and finishes with `TotpMultiFactorGenerator.assertionForSignIn`; closing the prompt is `auth/user-cancelled`, silent like a closed popup. It needs **Firebase Authentication with Identity Platform** (Firebase Console → Authentication → Settings) and TOTP switched on for the project: the founder's **Turn on** on `/founder-admin` (`founderops` `enableTotp`, `adjacentIntervals: 5`). Until then nobody can enrol and the card says "not switched on". Not enforced: the public pages still say only what is true for every account. `SecondFactorPrompt.test.jsx` and `SecurityTab.test.jsx` hold it.

**Enforcement is a separate switch**, per service, under Firebase Console → App Check → APIs, and that console switch reaches **Firestore and Authentication only**. The HTTP functions verify the token themselves: every browser call to a function spreads `appCheckHeader()` (`src/firebase-config.js`, `X-Firebase-AppCheck`, never throws, header simply absent when no token) into its headers, CORS lists the header, and `verifyAppCheck(req, res)` in `functions/index.js` runs before `verifyAuth` on every browser-authenticated endpoint. `APP_CHECK_ENFORCE` there is `false`: a missing or invalid token is logged (`allowing (monitoring mode)`) and let through. Flip it to `true` in a one-line PR and deploy to reject with 401; flip back to roll back. `claims.test.js` holds the public copy (`sec_real_appcheck`, `dpa_s9_body`: "not rejected yet") to that function, so the flip and the copy change together. Never on `api`, `stripeWebhook`, `invoiceInbound` or `clientErrors` (`functions/app-check.test.js`, `src/lib/app-check-client.test.js`). Order of enforcement, lowest blast radius first: Firestore (console), then the functions flag, then Authentication last — on Auth a reCAPTCHA low score locks a real person out of sign-in. Watch the verified/unverified split first.

### Cloud Functions

Functions called from the app require a Firebase Auth Bearer token (`verifyAuth`). Four HTTP endpoints deliberately do not, and each checks something else: `api` (the customer's API key), `stripeWebhook` (Stripe's signature), `invoiceInbound` (the private inbox address) and `clientErrors` (anonymous crash reports). The public security page names all four, and `src/lib/claims.test.js` fails if a fifth appears. Rate limits: `/ai` → 20 calls/hr per user, `/createCheckout` + `/createPortal` → 5 calls/hr per user. Limits are stored in Firestore `/rate_limits/{prefix}_{uid}`.

**Who is trusted, and what is escaped.** `verifyAuth(req, res, { checkRevoked: true })` also asks Firebase Auth whether the session was revoked or the account disabled; it is used on billing (`createCheckout`, `createPortal`), on `founderops` and on the `workspace` actions in `REVOCATION_CHECKED_ACTIONS` (invite, revoke, setrole, createorg, deleteorg, restoreorg, deleteaccount), not on every read, because it costs one Auth lookup. The founder is decided by `isFounderCaller` (`functions/founder-gate.js`) and `isFounderEmail()` in `firestore.rules`: an allow-listed uid, the `is_founder` flag, or a founder address **that Firebase has verified**; `founder-gate.test.js` and `firestore-rules.test.js` hold both. Every customer-typed value that goes into an email's HTML (tool, department and employee names, dates, the AI insight) is escaped: `functions/html-escape.js` and the builders in `functions/alert-email.js` (`alert-email.test.js` feeds them hostile names and checks `index.js` calls them). The Okta domain and Salesforce instance/login URLs a customer types are checked by `vendorOrigin` in `functions/integrations.js` (HTTPS, the vendor's own domains, no port or credentials) before the server sends a token there, and next-page links never leave that host (`integrations.test.js`). `invoiceInbound` is rate-limited per account (`inbound`, 30/h); `sendInvite` needs a verified email and an invitation already recorded by `workspace`'s `invite`.

**CSV cells.** Every CSV the app writes goes through `csvText` / `csvField` (`src/lib/csvSafe.js`): text starting with = + - @ (or a tab or carriage return) gets a leading `'` so a spreadsheet shows it instead of running it; numbers are written as they are. `csvSafe.test.js` feeds each builder a hostile name.

### Public claims are tested against the code

`src/lib/claims.test.js` holds what the site tells people (`index.html` included: its meta, JSON-LD and `noscript` block used to carry "SOC 2", "GDPR-compliant" and a search that does not exist) — cookie consent, integration tokens, deletion, the browser copy, export, unauthenticated endpoints, AI disclosures — to the code that makes each true. When a test there fails, the fix is usually to change the copy, not the test: the test is telling you a public statement just became false.

### The free audit (`/audit-saas`): review and client report

The page promises the bank file never leaves the browser, and `accountant-channel.test.js` holds it to that: no fetch, no storage, analytics gets counts only. Two features live inside that promise:
- **Review.** Each line takes a verdict (correct / not software / rename / it's software), applied by `applyVerdicts` in `src/lib/saasAudit.js`; totals, findings, CSV and report are all rebuilt from it. Verdicts live in memory only.
- **Stopped subscriptions.** A subscription not charged for well over its billing period before the end of the file (`isStopped` in `saasAudit.js`: 1.5 periods + 5 days, never under 21 days; a single charge never) goes to `report.stopped`, out of every total and finding, listed with its last charge on the page, in the client report and in the CSV (`status` column).
- **Firm name, remembered on request.** The client-report panel can keep the accountant's own firm name on this device, only when its box is ticked (`src/lib/auditPrefs.js`, one key `stacklens_audit_firm`; unticking deletes it). The client name, the note and anything from the file are never kept; `accountant-channel.test.js` checks the module's storage calls and that the page copy says so.
- **From audit to workspace.** « Créer mon espace avec ces N abonnements » keeps a summary of the active subscriptions (vendor, category, frequency, per-month amount, last charge date, reviewed flag; never a bank label, a transaction or anything about the client) in `stacklens_audit_handoff` for 2 hours (`src/lib/auditHandoff.js`) and opens `/?signup=true`, which now opens the create-account form. Once signed in, `components/AuditHandoffPrompt.jsx` (in `AppShell`, never in the demo) lists what would be added, and writes nothing until Import (`importAuditTools`, within the plan's tool allowance; tools get `origin: 'audit'`, lines confirmed in the audit arrive reviewed). An account that may manage client workspaces (`canManageClients`) chooses instead **a new client workspace**, named there and nowhere earlier: `createClientFromAudit` calls `createorg`, reads the seeded workspace back and writes the tools through the `workspace` endpoint (`toolFromHandoffRecord`, the one definition both paths use), touching nothing in the accountant's own workspace, then opens `/clients`; a refusal (free plan, client cap) is shown as the server said it. Ignore, import, expiry and sign-out all delete the list.
- **Several clients at once** (`src/lib/portfolio.js`). Several files dropped together (25 at most) become a portfolio: one row per client read exactly like a single file (bank or FEC), totals (not added across currencies), a CSV of figures only, and each client's full report a click away with its own in-memory review and its name prefilled on the client report. Same promise as the rest of the page; `accountant-channel.test.js` checks the module and the analytics payload (counts only).
- **What the file held that is not in the totals.** `parseBankExport` returns `credits` (money received, left out on purpose, said so in plain words) apart from `skipped` (a line with no usable date, amount or label), and `unreadable` keeps the first five of those so the page can show them. They used to be one count, which told an accountant "73 lines could not be read" about a statement whose 73 were payments received.
- **CSV for the reader's spreadsheet.** `csvStyleFor(language)`: English keeps commas and points; any other language gets semicolons and decimal commas (French also gets French column titles) and the download starts with a byte-order mark (`CSV_BOM`), so French Excel opens columns and numbers. The clipboard copy has no mark. Same for the portfolio CSV.
- **The handoff count and the plan's room.** The audit page quotes `handoffToolCount` (one per vendor, as the import merges two bank lines of one vendor), and `AuditHandoffPrompt` starts with the costliest ticked up to what the plan still allows, saying so before the import rather than after.
- **Corrections to Stacklens** leave only as an email the reader sends: `correctionsMailto` opens their mail client with the corrected bank labels and verdicts, never amounts or dates.
- **FEC (beta).** A ledger export is recognised by its header (`isFec`) and read by `src/lib/fec.js` into the same transactions; each carries the class of its expense account (software / excluded / neutral), which `detectRecurring` lets override the vendor name. Bank transactions carry no ledger, so the bank baseline is unaffected. Measured on synthetic files only — `docs/fec-prototype.md` lists what real files must show.
- **What to look at first** (`reviewSummary` in `saasAudit.js`): from the report, a yearly "to review" figure (the extra lines of a vendor paid more than once, never the dearest, plus possibly forgotten small subscriptions; worded as "not yet a saving"), the three biggest actions (duplicate, forgotten, renewal with its date, price rise), and the AI tools paid for (`category: 'AI'`: OpenAI, Anthropic, Midjourney, Perplexity, Mistral, Cursor, ElevenLabs, Runway). Shown above the figures on the page and on page one of the client report. `saasAudit.test.js`.
- **Bank exports from other countries** (`bank-formats.test.js`): Sparkasse, DKB, Barclays, Monzo, Starling, PostFinance, UBS, Belfius, KBC, Spuerkeess, Millennium and CGD layouts, hand-written from each bank's documented columns, each read whole and finding the same five subscriptions; Chase is in `saasAudit.test.js`. `detectColumns` prefers the payee column (`labelStrong`) over looser text columns, knows German, Dutch, Portuguese and Spanish date/amount names, and reads a UBS "Belastung"/"Gutschrift" pair instead of its unsigned "Betrag". `detectSymbol` (`lib/portfolio.js`) shows £ for a UK sort-code account, $ for proven month-first dates, CHF when the file says so, € otherwise. Add a real tester's file there when one arrives.
- **Client report.** A print layout (one A4 page for a small client, two for a long list: rows are never split and column titles repeat) with the accountant's firm and client name, printed by the browser ("Save as PDF"). It is portalled into `#print-report`, and the print CSS in `index.css` hides the rest of the page only while `body.printing-report` is set.

### Trust and the billable audit (`/note-donnees`, `/experts-comptables`)

From a simulated buyer panel of French accountants (0 of 20 paid; trust and "my clients won't pay" were the reasons), three answers, each held by `src/pages/DataNotePage.test.jsx`:
- **Check it yourself.** The audit page's `OfflineCheck` tells people to load the page, switch the internet off and drop the file (the audit needs no network once loaded, verified in a browser with zero requests), and says so live when `navigator.onLine` is false.
- **The data note** (`/note-donnees`, `pages/DataNotePage.jsx`, `dn_*`): one printable page (white, one A4) to hand to a client: the free audit, how to check it, what a paid workspace stores and where (worded as the sub-processors page), the exit rules (`EXIT_NOTICE_DAYS` in `lib/constants.js`, equal to terms section 10) and who runs Stacklens (`LEGAL_ENTITY`). The cookie banner never prints.
- **Make it billable** (`Billable` on the accountants page, `acct_bill_*`): a client proposal to copy, fee left as a placeholder (no digit in any language: Stacklens suggests no price). Early access asks for written feedback; a call to run the first client audit together is offered, never required (`ea_get_3`, `ea_get_4`, `ea_give_1`).

### Tools the app added by itself (`src/lib/toolReview.js`)

Invoice import, the email inbox and the bank connection (all via `importInvoices`), Google Workspace discovery and the free-audit handoff create tools nobody typed. Each carries `origin` (`invoice` / `bank` / `google-workspace` / `audit`; older ones are recognised by their `notes`) and shows **To check** on the Tools page until an editor says Correct, renames it, or says Not software (`reviewTool` in `useDbQuery.js`). Until then an ownerless one is not counted high risk (`computeToolDerivedRisk`): nobody has been asked who owns it yet. Not software deletes the tool and its access and adds the vendor to `db.rejected_vendors`, so `importInvoices` records the next invoice from them without re-creating the tool, and the import review screens start it unticked. A CSV `origin` column is ignored unless it is one of those.

### Supplier invoice check (`src/lib/invoiceCheck.js`)

Every imported invoice (`db.invoice_records`, from the PDF import, the email inbox or the bank connection) is checked: **duplicate** (same vendor, amount and date/period), **after_cancel** (a recent invoice for a decommissioned tool), **above_agreed** (more per month than the tool's `agreed_monthly`, `agreed_basis` `ht`/`ttc`) and **price_rise** (more than the vendor's previous invoice on the same billing cycle, only when no agreed price exists). Import paths extract `amount` including tax and, from PDFs and the inbox, `amount_excl_tax`; a before-tax agreed price is compared with that, or with the total after adding 20 % VAT, which the finding says it assumed. Shown in Finance → Budget (`components/InvoiceCheckPanel.jsx`: Justified sets `cleared` on the invoice, and the agreed price can be recorded inline or in the tool form) and as a dashboard action (`invoice_check`). Two bank summaries of one charge, or one document imported twice, are not a duplicate, and `importInvoices` skips a line already recorded (same source, vendor, amount, date, file); several amounts from one vendor in one month mean several products, not a price rise; an invoice is matched to the closest tool; vendors in `rejected_vendors` are not checked. The demo seed carries one of each main kind.

### Risk, spend and cost rules the pages share

- **Access risk** (`computeAccessDerivedRiskFlag`): `former_employee` is the only high risk, and a person whose `end_date` has passed counts as having left whatever their `status` says (`hasLeft`; a freelancer or intermittent whose contract ended with nobody pressing Offboard used to fall out of every list, and the Offboarding page lists them too); an admin right unreviewed or reviewed over 180 days ago, or any right over a year, is `needs_review`; a recently reviewed admin is `none`. The Access page's "revoke all" lists each access by name in its confirm. The dashboard's "reviews overdue" counts `needs_review`.
- **Spend**: every total comes from `billedTools()` / `monthlySpend()` in `lib/waste.js` (decommissioned tools bill nobody), including `FinancePage`, `lib/budget.js` and its server twin in `functions/monthly-report.js`; `enrichToolCosts` (the Cost tab, `computeWaste`) starts from the same list (a tool recorded as not a saving, `saving.stage: 'rejected'`, leaves every savings figure; access counts as held while `active` or `pending_revocation`), so a tool marked `unused` counts in the total and in the savings rather than vanishing from the one tab meant to show it. `employeeCostShares()` splits each tool's cost between the people holding it; the Employees page shows that share.
- **Security score**: `computeMfaCoverage` is `null` until a tool says anything about MFA (the tool form's MFA field, or a `tool_mfa` / `mfa` CSV column via `csvToolExtras` in `useDbQuery.js`, which also reads `seats`, `billing_cycle`, `auto_renew`). The spend alert fires only above `db.user.budget_cap`. The customer's Security page carries no block about Stacklens's own certifications.
- `smb-walkthrough.test.js` holds these.
- **Workspace categories** (`CATEGORIES` in `lib/constants.js`) are shown through `useCategoryLabel()` in `components/ui.jsx` (`cat_*` keys in five languages); the stored value stays English. `RENEWAL_SAVINGS_PCT` (`lib/constants.js`) is the one renewal-savings figure both Finance tabs quote. Plans and Stripe (`lib/planCards.js`, `lib/stripePrices.js`): Free, Starter €39 / €372 a year (€29 / €278 until 2026-11-11; earlier prices stay in `PLAN_MAP` for subscriptions billed on them; took in HR & Finance on 2026-11-10: the Finance pages are in Starter; HR & Finance is no longer sold, its subscribers keep it), Pro €79 (500 people), **Cabinet** €79 / €756 a year (for accounting firms: Pro's modules plus client workspaces; client workspaces now come only with Cabinet, Business and Enterprise, `CLIENT_PLANS` and `mayCreateClientWorkspace` in `lib/plan.js`, the server's twin in `createorg`; a trial keeps its three, and an account holding a client workspace created before `CLIENT_PLAN_CUTOFF` (2026-11-10 14:30 UTC) keeps adding up to the cap, while one made during a trial does not carry the right into Starter; inside someone else's workspace the buttons stay and the server decides from the caller's own plan; the early-access grant is Cabinet; the landing grid has a Monthly / Yearly switch (every yearly price is twelve whole months, €31 / €63 / €119, held by `stripe-prices.test.js`; yearly shows that per-month figure with the total and the saving under it: `lp_per_month_yearly`, `lp_billed_yearly`; `TrialPage.test.jsx`) and leaves Cabinet out (it read as a second Pro at the same price) and links to its section `#cabinet` on the accountants page, while Settings → Billing still sells it), **Business** €149 / €1,428 a year (unlimited tools, 1,500 people, `api`), Enterprise from €299 (`contact: true`: over 1,500 people, annual by headcount; its card opens `/contact?subject=enterprise` instead of checkout, and the About page says so: card checkout up to 1,500 people). No card says "unlimited employees" (`plan-claims.test.js`). The JSON-LD offers in `index.html` are the plan cards at their monthly prices, and the About page's "from €…" is the cheapest paid card (`claims.test.js`). A Pro subscription that began before `PRO_LIMIT_CUTOFF` (2026-11-10), or Pro by grant, keeps 1,500 people: `getPlanLimits(plan, user)` reads `pro_since`, when the account became Pro, written by the webhook (`proSinceUpdate`: set on becoming Pro, kept while Pro, cleared otherwise and on cancellation; an account already Pro takes Stripe's `start_date`), protected in `firestore.rules` and passed to members by the `workspace` `read`. Price ids live once in `lib/stripePrices.js` (`priceIdFor`, `CHECKOUT_PLANS`); `stripe-prices.test.js` holds them equal to `ALLOWED_PRICE_IDS` (exactly the prices offered: Enterprise ids stay only in `PLAN_MAP`, for existing subscriptions) and `PLAN_MAP` in `functions/index.js`.

### Savings with their evidence (`lib/savings.js`, `components/SavingsPanel.jsx`)

`computeWaste().recoverable` (billed tools nobody holds access to) is a suspicion; `savingsLedger` gives each saving a **stage** on `tool.saving`: `suspected` (the rule), `approved` (`by`, `at`, `by_owner` when the approver is the tool's `owner_email`), `rejected` (a reason is required; the tool leaves every savings figure through `enrichToolCosts`), `realised` (cancelled: evidence required, `stops_on`, the tool becomes `decommissioned` so it leaves spend). `commitmentOf` says when billing actually stops if cancelled today (monthly: after `notice_days`; quarterly or yearly: at the renewal, or the next one when the last day to cancel incl. purchasing's delay has passed; `auto_renew: false` ends at its date; no renewal date: `unknown`, never guessed) and `next12`, what stopping saves over twelve months. `access` says what the suspicion rests on: `no_active_access` (rows exist, none held) or `no_access_recorded` (nothing ever imported for that tool, said apart). A realised saving is checked against `db.invoice_records` by `billingCheck`: `contradicted` (an uncleared invoice dated after `stops_on` + 7 days), `confirmed` (one billing period + 7 days passed with none, earlier invoices to compare with), `awaiting`, `no_billing`. The invoice check's `after_cancel` (both `lib/invoiceCheck.js` and `functions/monthly-report.js`) ignores an invoice up to `stops_on` + 7 days.
- Finance → Cost opens with the panel: four figures (suspected with how many have no access recorded, approved, next 12 months after commitments, realised with how many the invoices confirm or contradict), each saving with its evidence lines, Approve / Cancelled… / Not a saving… / Undo for editors (`recordSaving`, audit `saving.approved|rejected|reopened|realised`), and the ledger CSV (`savingsCsv`, spreadsheet-safe). The dashboard's savings figure links there with one line of approved and realised. `savings.test.js`; the demo carries one saving at each stage (Loom approved, Typeform rejected, Calendly confirmed by its invoices, Hotjar awaiting).

### Cancellation notice (`lib/renewalNotice.js`, `functions/renewal-notice.js`)

A contract that renews by itself has to be cancelled before its renewal date, so the date that matters is the **last day to cancel**, not the renewal. Each tool can carry `notice_days`, `contract_owner_email`, `procurement_required` and `procurement_lead_days` (tool form, or the CSV columns préavis / responsable contrat / validation achats / délai achats, read by `csvToolExtras`). `noticeTimeline` gives `notice_deadline = renewal_date − notice_days` and `decide_by = notice_deadline − procurement lead` (`DEFAULT_PROCUREMENT_LEAD_DAYS`, 15, when purchasing must approve and no delay is given), and a state: `decided` (a `renewal_decision` recorded for this renewal date), `no_auto_renew` (`auto_renew: false`: nothing to cancel), `unknown_notice`, `locked` (the last day has passed), `act_now` (decide within `ACT_NOW_DAYS`, 7), `soon` (within 30), `later`. Blank notice stays unknown, never 0.
- **Email**: `dailyAlerts` sends `noticeAlerts` (at 30 and 7 days before `decide_by`, through `dueReminder`, and once when a deadline passes with no decision) beside `renewalAlerts`, which now covers only tools with no notice period and no decision (`coveredByRenewalReminder`). The lines are built by `renewalAlertLine` in `functions/alert-email.js`, escaped.
- **Screens**: Finance → Renewals opens with **Decide before the last day to cancel** (`components/NoticeDecisionsPanel.jsx`: due, decided within 90 days, notice unknown within 90 days), a Last day to cancel column, a Decision needed filter, and the .ics carries a decide-by event. Editors record Renew / Cancel / Renegotiate (`decideRenewal`, `withDecision`, audit `renewal.decided` / `renewal.decision_cleared`); the decision is tied to the renewal date, so the next cycle asks again. Recording changes nothing at the vendor, and the panel says so. The dashboard has one to-do line, `notice_deadline` (locked and act_now, from `decisionsDue`).
- `renewal-notice-parity.test.js` runs both copies on the same tools and compares their constants. The demo seed carries one of each state.

### Licence eligibility (`lib/eligibility.js`, `components/EligibilityView.jsx`)

Access → **Eligibility** (`/access?view=eligibility`). Each tool can carry a rule (`tool.eligibility = { mode: 'all' | 'match', departments, titles, excluded_ids }`): everyone, or people in some departments or whose job title contains some words (case and accents ignored; the `admin`/`user` account type the Google Workspace import writes into `role` never counts as a title). `eligibilityGaps` gives **toGrant** (active people covered, no licence) and **outsideRule** (active people holding one the rule does not give), with a per-licence price from seats, else from holders, else none. Only `status: 'active'` people count; leavers stay the Offboarding page's job and are never listed here. The buttons only **record** what was done in the vendor's console, and the page says so: Mark as granted creates an access row (`origin: 'eligibility'`), Approve removal approves its removal (lib/removals.js, source `eligibility`), Not needed adds the person to `excluded_ids`, Keep as an exception sets `access.eligibility_exception`. Editors act; viewers read.

### Access reviews (`lib/accessReviews.js`, `components/AccessReviewsView.jsx`)

Access → **Reviews** (`/access?view=reviews`). A review is a **snapshot** of the held access rows in scope (everyone, one tool, or one department: `rowsInScope`, case and accents ignored, revoked rows never), stored in `db.access_reviews` (member-writable in `functions/workspace-write.js`, in the export list). Each row takes `keep` or `revoke` (`decide`, `decideRemaining`, undo with `null`). **Signing is the only moment anything changes** (`signOff`, refused with a row undecided, an empty scope, or twice): kept rows get today's `last_reviewed_date` (so the dashboard's "reviews overdue" drops), revoked rows get an **approved removal** (`approveRemoval`, source `review`: still held until done in the tool, see Access removal below), rows outside the review are untouched, and the review carries `signed_off = { name, by, at }`. The hook (`startAccessReview`, `decideAccessReview`, `signOffAccessReview`) writes `access.review.started`, one `access.removal_approved` per revoked row, and `access.review.signed` to the audit log. Evidence is the review itself: `PrintReview` (white page through `#print-report` / `body.printing-report`, like the free audit's client report) and `reviewCsv` (semicolons outside English, like the audit CSV). The copy says revocations are recorded here and removed in each tool's own console. Editors act; viewers read; the start form shows only while no review is open.

### Access removal (`lib/removals.js`, `components/RemovalsView.jsx`)

Clicking Revoke used to set an access row to `revoked` at once, although nothing had been removed in the tool. A removal now goes through four recorded steps on `access.removal`, each with `by` (`auditActor`) and `at`: **approved** (a decision: Access page, dashboard, offboarding, a signed review, an eligibility rule; `status: 'pending_revocation'`), **requested** (to whom, ticket reference; still held), **completed** (removed in the tool: `method` `manual` with evidence required, `vendor` when Stacklens did it through the vendor's API, today only the Microsoft 365 sign-in block on Microsoft's own tools (`isMicrosoftTool`), or `connector`; `status: 'revoked'`, `revoked_at`), **verified** (a later check: `manual` with evidence, or `connector`, e.g. Google's licence read finding no licence, which also completes a removal nobody marked done). A row revoked before this existed reads as completed with method `unrecorded` and stays in the unverified list; evidence can be added. `pending_revocation` is still held everywhere (`HELD` sets, server `status !== 'revoked'`), and `computeAccessDerivedRiskFlag` keeps its risk, so a leaver with an approved removal stays in the dashboard's priority band until it is done.
- Every screen goes through one mutation, `recordRemoval({ ids, step: approve|request|complete|verify|cancel, … })`, audited as `access.removal_approved`, `access.removal_requested`, `access.revoked`, `access.removal_verified`, `access.removal_cancelled`. `removals.test.js` fails if a screen writes `status: 'revoked'` itself.
- Access → **Removals** (`/access?view=removals`): to do in the tool, removed but not verified, verified; an evidence CSV (`removalsCsv`, spreadsheet-safe, semicolons outside English). Editors act, viewers read. Dashboard: `former_access` lines for an approved removal link there; one `removal_unverified` line. The demo seed has one removal at each step.

### Tamper-evident audit trail (`functions/audit-chain.js`, `lib/auditSync.js`)

`db.audit_log` is written by the browser into a workspace its owner can edit, so it proves nothing on its own. Every new row is also sent (batched, `saveDb` → `noteAuditLog`, `workspaceAudit` with `keepalive` on page hide) to the `workspace` function's `audit` action, which appends it to `/audit_chains/{workspaceId}/events/{seq}`: each row carries `prev_hash` and `hash = SHA-256(prev_hash|seq|at|actor|action|details)`, the head document holds the count and last hash, both written in one transaction. The **actor and time are the server's** (the verified token email, else marked unverified, else the uid; the server clock); the browser sends only an action name (`[a-z][a-z0-9_.-]`) and a detail (≤ 500 chars, ≤ 50 per call). The server records what it does itself (`team.invited`, `team.removed`, `team.role_changed`, `client_workspace.created/deleted/restored`); those names are refused from a browser (`cleanEvents` drops `team.*` and `client_workspace.*` unless the server asks), so nobody can forge the server's own record. `auditchain` always returns the newest 500 rows, also past the 20,000-row read limit. `firestore.rules` closes `/audit_chains` to every browser; `auditchain` returns the check (`verifyChain`: edits, removals, reordering and a cut tail all break it) and the newest 500 rows, shown by Settings → Data (Verify, CSV of the server copy). Its own rate limit (`audit`, 600/h). Purged with the workspace (`purgeWorkspace`, `purgeClientOrgs`). What it does not prove, and the copy says so: that every action was reported (a change made offline may be missing), or anything against someone who rewrites the whole chain with database access. `audit-chain.test.js` and `auditSync.test.js` hold it.

### Google licences (`lib/googleLicences.js`, `components/GoogleLicencesCard.jsx`)

On Access → Eligibility, an editor clicks **Read the licences from Google**: a Google Identity Services token (`admin.directory.user.readonly` + `apps.licensing`, consent each time, kept in memory) reads the customer id from the directory, then `licenseAssignments.listForProduct` for each product in `GOOGLE_LICENCE_PRODUCTS` (Gemini 101047 and 101068, Google-Apps, AppSheet, Voice, Vault, Chrome Enterprise; ids from Google's License Manager "Product and SKU IDs" page). A product the organisation lacks answers with an error and is skipped. Names shown are Google's. **Read only**: Google has no read-only licensing scope, so the copy says Stacklens never assigns or removes, and `googleLicences.test.js` fails on any non-GET request or any browser storage. Each SKU is linked to a Stacklens tool (`tool.google_sku`, or same name), and `reconcileSku` lists who Google licenses that Stacklens has not recorded (Record them all → access rows `origin: 'google-licensing'`), who Stacklens shows that Google does not license (Confirm removed: Google's read verifies the removal, method `connector`, lib/removals.js), and licensed addresses not among the people. Nothing Google returns is kept beyond the page. Needs `VITE_GOOGLE_CLIENT_ID` and the `apps.licensing` scope on the OAuth consent screen; not in the demo.

### Joiners and movers (`lib/peopleChanges.js`)

`setDb` in `useDbQuery.js` runs `annotatePeopleChanges` on every write, so any path that changes people (a form, a CSV import, a directory sync) is covered. A new active person is a **joiner**, except in a first import or a write adding more than `BULK_LIMIT` (25) people at once (a directory being loaded), where only a start date within 30 days counts; someone back after leaving is a joiner too. An active person whose department or job title changed is a **mover**; filling an empty value, a change of case or accents, and the `admin`/`user` account type are not. The change is stored on the person (`employee.people_change = { kind, at, from, to, done_at }`), never in a list of its own, because a teammate in a shared or client workspace may only write `MEMBER_WRITABLE_KEYS`. `openPeopleChanges` reads what each open change asks for from the eligibility rules every time (grants, removals, and for a mover the tools no rule covers), so the to-do follows rule edits and recorded grants. Shown at the top of Access → Eligibility and as one dashboard action (`people_changes`); open until Done, or for `OPEN_DAYS` (90). Leavers stay the Offboarding page's. Directory syncs go through `directoryPatch`: department and title follow the directory while they still equal the last value it gave (`dir_department`, `dir_role`), so a move in the directory arrives without overwriting a hand edit.

### Assignments: contractors, interns, fixed-term (`lib/lifecycle.js`, `functions/lifecycle.js`, `components/AssignmentsPanel.jsx`)

A person can carry `worker_type` (employee / contractor / intern / temporary) and `manager_email` (person form, or the CSV columns type de contrat and manager, `csvPersonExtras`); an access row `expires_on` (access form, CSV `expires_on` / `access_expires`); an access row or a device an `exception = { reason, until, by, at }` (`withException`: reason required, end date from today up to a year; `cleanAsset` keeps it only while someone holds the device). `assignments(db)` lists everyone whose `end_date` is within `SHOW_BEFORE_DAYS` (30) or passed and not `assignment_closed`, with what is still open (held access not under an active exception; devices `in_use` not excepted) and a stage: `upcoming`, `remind` (≤ 14 days), `ending` (≤ 3), `ended`, `overdue` (ended with something open for `ESCALATE_AFTER_DAYS`, 7, or at once with no manager: the escalation), `ready_to_close`. `closeAssignment` refuses before the end and while anything is open. `expiringAccess` lists temporary access within 7 days of `expires_on` or past it. An active exception lifts the `former_employee` risk on that row until it ends.
- **Email** (`dailyAlerts`, behind `access_alerts`): `lifecycleAlerts` sends `ending` at 14 and 3 days (through `dueReminder`), `overdue` once (the escalation to the account owner), `expired` once per temporary access past its date; `lifecycleAlertLine` in `alert-email.js`, escaped. Reminders go to the owner's verified address only; the manager is named in the line and on screen. `lifecycle.test.js` runs both copies on the same people and compares their constants.
- **Screens**: Offboarding opens with **Assignments ending** (stage, manager or "No manager named", next reminder or escalation date, a checklist per person: Approve removal / Record the removal, Keep until…, Mark returned, Kept by agreement…, End the exception, then **Close the assignment**) and **Temporary access ending**. Editors act (`recordAssignment`: audit `access.exception_granted|removed`, `asset.exception_granted|removed`, `assignment.closed`), viewers read. Dashboard: one `assignment_overdue` line. The demo carries a production team: Inès (contractor, ends in 10 days, temporary Notion), Malik (ended 9 days ago, Slack and a laptop still out: escalated), Zoé (intern, ready to close, Miro kept under an exception), and Thomas's expired temporary Datadog access.

### Data sources and freshness (`lib/dataSources.js`, `components/DataSourcesPanel.jsx`)

A finding is only as good as the data under it, so every source that feeds the workspace records its runs in the workspace itself: `db.data_sources[id] = { last_success_at, last_attempt_at, last_error, counts, runs }` (member-writable, in the export list, so the team and every device see the same record; it used to be one `sg_*_last_sync` localStorage key per vendor in one browser, which still exists for the Integrations cards). The caller that did the work records it through `useDbMutations().recordSourceRun`, success or failure, so nothing records a run that did not happen: Google Workspace, Microsoft 365 and the six token connectors (IntegrationsTab), each CSV import kind (`csv:company|tools|employees|access` in ImportWizard, `csv:assets` on Devices), Intune (read failure, Record success), Google licences, Google usage discovery on Tools, `invoice:{invoice,inbox,bank}` inside `importInvoices`, and `audit` inside `importAuditTools`. `SOURCE_FACTS` is the static half: which areas each source feeds (people, tools, access, devices, usage, invoices), how it authenticates, and whether it writes (only `microsoft-365`: blocking a leaver's sign-in). Shown as **Data sources and freshness**, the first card of Settings → Integrations (per area: newest read and the source behind it, `fresh` ≤ 7 days, `stale` ≤ 30, `old`, `failed` when the last attempt failed after the last success, `manual` when records exist that no recorded source explains; then every source with its last success, error, counts and what it does), and as one line on the dashboard above the figures (`FreshnessLine`: newest read, failed and stale connectors, link to the details; amber when a connector failed or nothing was read by a connector). **Unknown is not unused**: a tool's `last_used_date` is confirmed only with `usage_source` (Google usage discovery sets it), the Tools table says "read from …", "typed" or "Unknown" (`usageKnowledge`). The demo seed carries a history with a failed Okta token and a devices file over a month old. Labels come from `sourceLabelKey(id)`; `dataSources.test.js` fails on a source, area, state or recorded count without a label in five languages, or a caller recording an unknown source id.

### Hardware register (`lib/assets.js`, `pages/DevicesPage.jsx`)

`/devices` (module `people`, like Employees and Offboarding) records the company's devices in `db.assets`: kind, model, serial, holder (`assigned_to` employee id, with `assigned_name` / `assigned_email` beside it so a device still says who had it after that person is deleted), status (`in_use` / `in_stock` / `in_repair` / `retired` / `lost`), purchase date and price, warranty or lease end. **A register, not a remote control**: nothing locks, wipes, locates or installs anything, and the page says so in its first banner; Mark returned only records it (`in_stock`, holder cleared, `returned_at`). Every row goes through `cleanAsset`, which keeps status and holder consistent. `devicesToReturn` lists devices still held by someone `offboarding` or `offboarded`: shown on the Devices page, on the leaver's Offboarding panel and as the dashboard action `device_return`; `coverageEnding` (within `COVERAGE_SOON_DAYS`, 30) is the action `device_coverage`. CSV import (`assetsFromCsv`, French and English headers, `;` files) matches holders by email, and a serial already in the register updates that device with only the columns the file filled (`mergeAssets`). CSV export (`assetsToCsv` / `assetsCsvFile`: the Devices page's Export CSV for anyone who reads the register, and a Devices tile in Settings → Data) writes the import's columns plus the holder's name, so an exported file imports back unchanged; outside English it uses semicolons, decimal commas and a byte-order mark, and text starting with = + - @ is prefixed with ' so a spreadsheet does not run it. Editors write, viewers read; `assets` is in `MEMBER_WRITABLE_KEYS` so a team editor's changes are kept (needs the functions deployed).

**Microsoft Intune** (`lib/intuneDevices.js`, `components/IntuneDevicesCard.jsx`, on the Devices page). An editor clicks **Read the devices from Intune**: MSAL asks for `DeviceManagementManagedDevices.Read.All` only, on that click (`acquireMSToken([INTUNE_SCOPE])`; Microsoft documents it as the least privileged permission for `GET /deviceManagement/managedDevices`, delegated, and the tenant needs an Intune licence), and the list is read with `@odata.nextLink`, never followed off `graph.microsoft.com`. **Read only**: `intuneDevices.test.js` fails on any non-GET request, browser storage, or a write permission or device action in the module or card. What comes back stays in the card's state until the editor clicks Record: devices the register lacks are added (`origin: 'intune'`, holder from the Intune address when that person is in the people list), devices it has (same Intune id, else same serial) get the snapshot `asset.mdm` (`cleanMdm` in `lib/assets.js`: Intune id, compliance, encryption, OS and version, last check-in, read date; nothing else Microsoft returns is kept). A recorded holder is never changed by a read: `reconcileIntune` lists the differences and the editor takes Intune's one per device. `mdmConcerns` (non-compliant, not encrypted) feeds the Devices page's flagged panel. Needs `VITE_AZURE_CLIENT_ID` and the permission added, with admin consent, on the Azure app registration; not in the demo, whose two devices with a snapshot are examples.

### Finding your way (`components/PublicMenu.jsx`, `lib/pageHelp.js`, `components/HelpPanel.jsx`)

- **Public menu.** The landing page and every `PublicNav` page show one menu (`PublicMenu`): free audit, accountants, finance leads, what works (`/fonctionnalites`), pricing, demo, sign in, start free; it folds into a menu button below 1280px, and on a phone "Start free" lives in the panel. Off the landing page, sign in / sign up / demo go to `/?signin=true`, `/?signup=true`, `/?demo=true`, which `TrialPage` reads on arrival.
- **What works today** (`/fonctionnalites`, `pages/CapabilitiesPage.jsx`): for a prospect before a call. Nine "works today" rows, each saying what Stacklens does and what the customer does, each naming the module and function behind it (`proof`); the connector table rendered from `SOURCE_FACTS` itself (connectors, then files; what each reads, how it connects, and that only Microsoft 365 changes anything at a vendor); "does not exist" reusing the security page's `sec_large_not_*` lines plus `cap_not_removal`; links to the trust documents. `capabilities.test.js` fails when a row's function disappears, the table stops being `SOURCE_FACTS`, the not-available list drifts from the security page, or the route, menu link or sitemap entry goes.
- **Landing hero.** The audit's own headline (`audit_title_1` + `audit_title_2`, no figure: the old "80 tools" line had no source and was removed), the accountant eyebrow (`lp_hero_badge`) and body (`lp_hero_body`), one primary action (the free audit, a `<Link>`) with the demo as a link beside it; sign-up lives in the menu. On the right, `components/AuditExampleCard.jsx`: what the audit returns, badged and subtitled as example data. `homepage-pitch.test.js` holds it.
- **Two data paths, said apart** (claims §13). A bank export or FEC gives subscriptions, duplicates, price rises and renewals; who still has access comes only from the tools-and-people file, and the hero and "How it works" say which gives what. Step 3 says Stacklens records what was done and names the one action it carries out at a vendor (Microsoft 365 sign-in blocking, `m365-writeback.js`: editors only, never from a shared or client workspace, the narrowest Graph permission that changes `accountEnabled` (`User.EnableDisableAccount.All` plus `User.Read.All`, asked for on first use, never `User.ReadWrite.All`), and the confirmation names the account Microsoft found, its own display name and sign-in address, before the PATCH; DPA §3 item 7 describes it). `lp_data_location_note` (functions partly in us-central1, AI via Anthropic, Stripe, SCCs, link to `/sub-processors`) sits under the pricing EU line and under the sign-up consent; `lp_faq3_a` says the same. The cookie banner is one row from `lg` up, its three buttons one class.
- **Landing.** Under the hero, "Where do you want to start?" (free audit, finance leads, accountants, then the SMB card, which stays last for `homepage-pitch.test.js`) and a demo link; after "How it works", "What's inside" (`LANDING_MODULES`), named with the sidebar's own `nav_*` labels so the page and the app never call a screen two things.
- **In the app.** Each sidebar page has one sentence under its title (`PAGE_HELP`, shown by `TopBar` and the phone header; the generic `topbar_subtitle` only where none exists), and the **?** button opens "Where to find what" (`HELP_TASKS`, searched without case or accents). `page-help.test.js` fails on a link to a route or tab that does not exist, a sidebar page without a sentence, or a missing language. Add a task when a screen gains something people will look for.
- The old product tour (`TourContext`) was never reachable and is gone; the test keeps it from half-returning.

### Mandatory company sign-in (`functions/sso-policy.js`, `lib/sso.js`)

Settings → Security → **Company sign-in**: an owner or admin, in their own workspace, outside the demo, requires that everyone who opens it signed in with a **Google or Microsoft work account**. The switch is `/users/{uid}.sso_required`, written by the browser (`setSsoRequired`), and the policy is checked against the **session**, not the account: Firebase stamps every ID token with the provider that started it (`firebase.sign_in_provider`; email/password and the magic link are both `password`), so an account that also has Google is refused while signed in with its password. Enforced in two places, constants held equal by `sso.test.js`:
- `firestore.rules`: `/userdata/{uid}` and its chunks need `ssoSatisfied(uid)` (one `get` of `/users/{uid}`); and `ssoSwitchSafe()` lets **only a Google or Microsoft session** turn the field on or off, so a phished password cannot switch it off first and a password session cannot lock itself out. `firestore-rules.test.js` holds it.
- The `workspace` function: `ssoGate(target, org)` runs on `read`, `write`, `audit` and `auditchain` before any data is touched, applying the owner's policy, or the agency's for a client workspace, and answers 403 `{ code: 'sso_required', signed_in_with }`. `read` returns `user.sso_required` so a member's Settings card shows the state. `sso-policy.test.js` holds the pure rules and the four call sites.

The browser only says which button to use: `useAuth` reads `/users/{uid}` before hydrating and, when refused, loads nothing, marks nothing signed in and raises `raiseSsoBlock({ scope: 'own' })`; `useClientWorkspaces.openWorkspace` raises `scope: 'shared'` on the server's code. `components/CompanySignInRequired.jsx` (mounted once in `App`, like `SecondFactorPrompt`) offers the Google and Microsoft buttons (a new session, full load of `/dashboard`), sign out for an own account, or back to the viewer's own workspace. The card reads the session's provider with `getIdTokenResult().signInProvider` and is disabled, with the reason, for a password session, an editor, a teammate in someone else's workspace, or the demo. `set_sso_desc` and the public `sec_card_auth_body` say it exists; Okta and SAML still do not (`french-screens.test.js`). `audit.test.js` records both Security switches and where each is enforced.

### Screen protection (`lib/screenProtection.js`, `components/ScreenProtection.jsx`)

A **deterrent, not a lock**: a web page cannot stop the system's screenshot or recording, or a camera, and nothing here may claim it can (`screenProtection.test.js` refuses copy that says so; the Settings card carries the limits sentence). Off by default; an owner or admin turns it on in Settings → Security (`db.user.screen_protection`, so it also applies to team members opening that workspace). While on, for the people let into the workspace, never for anyone who can switch it off (`canSwitchOff`: an owner or admin in their own workspace, the same rule as the Settings switch), the founder (`is_founder` or a `FOUNDER_EMAILS` address) or the demo: a faint watermark of the **viewer's own** email (`firebaseUser.email`, never the owner's) and the time; the app blurs when the window loses focus; copy, cut, right-click, drag and print are refused outside text fields (the free audit's client report keeps printing: `body.printing-report`); Print Screen and the macOS/Windows capture shortcuts blur briefly and empty the clipboard. Mounted once in `AppShell`, never on public pages. It makes no request and stores nothing.

### Notification switches (`src/lib/notifications.js`)

Settings → Notifications shows only switches that change an email: each entry in `NOTIFICATION_SWITCHES` names the `db.user` field `dailyAlerts` / `weeklySummary` check (`renewal_alerts`, `budget_alerts`, `access_alerts`, `weekly_summary`, `device_alerts`). `device_alerts` mails warranty and lease ends from the hardware register at 30 and 7 days (`functions/device-alerts.js`, the server twin of `coverageEnding`; `device-alerts-parity.test.js` runs both on the same devices): one email per threshold, and a device first seen inside 7 days gets one email, not two. Renewals (`renewal_alerts`, `functions/renewal-alerts.js`) follow the same rule, from `functions/threshold-alerts.js` (`dueReminder`, calendar-day `daysUntil`); `renewal-alerts.test.js` holds it. `notifications.test.jsx` fails if a switch has no server reader or a daily alert kind has no switch. Never add a switch for an email that does not exist.

### Monthly report to management (`functions/monthly-report.js`)

Opt-in in Settings → Notifications (`components/MonthlyReportSettings.jsx`, stored as `db.user.monthly_report = { enabled, recipients, lang }`). `monthlyReport` (scheduled `0 8 1 * *` Europe/Paris) builds last month's report — spend and forecast, budgets by department (same figures as Finance → Budget), supplier invoice findings, renewals in the next 30 days, three priority actions — and sends it once per period (`report_state/{uid}`, purged with the account). Recipients: the account's Firebase Auth email **only if verified** (`verifiedEmailForUid`, which every scheduled email uses) plus up to three colleagues **on the same domain, never a public mail domain** (`reportRecipients`; the workspace is client-written, so the server re-checks). `reportnow` sends a preview to the caller's own address only, 3/hour. The invoice check and the recipient rule exist in both `src/lib` and the functions module; `report-parity.test.js` runs both on the same inputs and compares their constants.

### Demo kit (`public/demo/`)

One fictional company (Atelier Lumen, domain `.example`) told through every file the site reads: `atelier-lumen-application.csv` for the in-app "Company data" import (people, tools and access in one file, using the optional `tool_owner_email`, `tool_last_used`, `access_status`, `access_last_used`, `access_last_reviewed` columns), and a 24-month bank statement and an FEC for the free audit. `public/demo/index.html` (stacklens.fr/demo/) lists them; `public/demo/LISEZ-MOI.md` is the French walkthrough for testing and prospect demos. Files are generated by `node tools/make-demo-kit.mjs` (deterministic) and `src/lib/demo-kit.test.jsx` checks they match the generator, runs them through the audit engine and the real import, and checks every figure the guide quotes. If the engine changes, regenerate and update the guide rather than the test.

### Testimonials (`src/lib/testimonials.js`)

Empty until a real customer approves a quote; `components/Testimonials.jsx` renders nothing while it is. Each entry must carry its consent (`consent.date`, `scope`, `approvedVerbatim: true`, `proof`) and state whether it came from early access, which the site discloses; `testimonials.test.jsx` refuses anything else. Never add an invented, reworded or unconsented quote. The process, the consent email and the review-site checklist are in `docs/outreach/preuves-clients.md`; logos go in `public/proof/`.

### Early access (`/experts-comptables#acces-anticipe`)

The offer (10 firms, Pro free for 6 months in return for written feedback on three questions; a 20-minute call offered, never required) is read from `EARLY_ACCESS` in `src/lib/earlyAccess.js`; the copy uses placeholders, never typed numbers (`claims.test.js` §9). Set `OPEN: false` when the places are taken. Applications go to hello@ through the contact form provider (Web3Forms), with a mailto fallback; nothing is stored.

Granting it: **Early access** button on `/founder-admin` → `founderGrantPlan` writes `plan`, `plan_grant_until`, `plan_grant_reason` on `/users/{uid}`. Past `plan_grant_until` the account is free unless it has started paying: `grantExpired()` in `src/lib/plan.js` and its twin in `functions/workspace-write.js`, held together by `plan-parity.test.js`. The two grant fields are protected in `firestore.rules` (only the founder writes them). Setting a plan by hand clears any grant.

### Signing out, cancelling and deleting

- **Signing out** removes this account's data from the browser (`clearLocalWorkspace` in `src/lib/db.js`), after `flushBeforeSignOut` writes anything the cloud may not have. If that cannot be confirmed the user is asked before anything is discarded. An expired session does not clear, only an explicit sign-out.
- **Clearing data** (tools, people and access) has one definition, `clearWorkspaceData` in `src/lib/clearData.js`: an audit entry, the local save, then the cloud copy awaited (a failure is reported, never success). Settings → Data uses it, and so does the dashboard's **Clear data** (`components/ClearDataButton.jsx`), shown only to an owner or admin, in their own workspace, outside the demo, when there is data, behind a dialog with the counts and a link to the export. The plan, settings and audit log are kept. The Employees page shows the same button as **Clear people** (`scope="people"`: people and access go; tools and devices, which keep the holder's name, stay).
- **Cancelling** a subscription moves the account to `free` and deletes nothing.
- **Deleting** the account (Settings → Data) calls the `workspace` function's `deleteaccount`, which purges everything via `purgeAccount`. It refuses with 409 `subscription_active` while Stripe can still bill (`subscriptionBlocksDeletion` in `functions/purge-account.js`), because purging `/users` removes the only link from the Stripe customer back to the account.

Secrets (ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, BREVO_API_KEY) are in GCP Secret Manager — deploying functions requires billing enabled on the GCP project. A function keeps the secret version it was deployed with, and Build & Deploy only deploys functions when their code changes: after changing a secret, run **Actions → Redeploy functions → Run workflow** (`.github/workflows/redeploy-functions.yml`), choosing the secret. `tools/functions-to-redeploy.mjs` reads from `functions/index.js` which functions name that secret in their options and deploys them from main in batches of five with 90 s pauses; `functions/redeploy-scope.test.js` holds it. Email is sent through Brevo by `functions/mailer.js` (one HTTPS request, nothing contacted without a `xkeysib-` key); SendGrid remains only as the inbound door for forwarded invoices (Inbound Parse → `invoiceInbound`).

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

`useTranslation()` from `translations.js` returns `t(key)`. Language preference stored in `localStorage('language')` and managed by `useLang()` from `src/contexts/LangContext.jsx`. Five languages: `en`, `fr`, `de`, `es`, `pt`, all offered in both language switchers (`LANGUAGE_OPTIONS` in `AppShell.jsx`). **Every English key exists in all five** (`i18n-coverage.test.jsx`, with placeholders identical): add a new string in five languages, never in English alone. A key still missing is auto-translated via AI and cached in localStorage, which only works for a signed-in user and spends their AI allowance.

**Legal documents are English and French only.** Keys starting `dpa_`, `privacy_`, `terms_`, `subproc_`, `legal_` (`LEGAL_KEY_PREFIXES`) are shown in English in any other language: never auto-translated, never read from the cache, never mixed with a partial translation; each legal page says so in one line (`doc_lang_note`). A contract translated by a machine could say something the English and French do not; a German, Spanish or Portuguese version needs a reviewed translation and a change to `LEGAL_LANGUAGES`.

### Visual system

Held by `src/lib/design-tokens.test.js`:
- **Font:** Inter, self-hosted via `@fontsource-variable/inter` (imported in `main.jsx`, set as `fontFamily.sans` in `tailwind.config.js`). Never Google Fonts: it would be a new sub-processor and is outside the CSP.
- **Secondary text:** `text-slate-500`, whose token is overridden to `#74839a` so it passes WCAG AA on slate-950 and slate-900. Never `text-slate-600/700` for text.
- **Critical red:** `red-*` only; no `rose-*`.
- **Modal backdrop:** `bg-slate-950/70 backdrop-blur`, the same as `<Modal>`.
- **Public pages** (legal, about, contact, security, accountants, audit) use `<PublicNav>`; the landing nav keeps its own links but the same classes.
- **Light mode** (`src/design/palette.js`, `palette.test.js`). The app's Tailwind greys (slate, gray), `white`, coloured text (`text-{hue}-50…600`), gradient stops 300/400 and deep tints (`{hue}-900/950`) are CSS variables (`--c-…`, rgb channels, so opacity modifiers still work). Dark holds Tailwind's own values (slate-500 is `#74839a`), so dark renders exactly as before; light turns the greys round (page slate-50, cards white, text darker) and darkens coloured text to 700/800. Inside a solid coloured fill (`bg-{hue}-300…800`, a coloured gradient that is not `bg-clip-text`, their `hover:` and `!` forms) the dark values come back, so white on blue stays white on blue. `palette.test.js` checks every text grey and hue at 4.5:1 in light and that dark equals Tailwind. The choice (Dark default, Light, Same as system) is the sidebar's Appearance row and the phone menu (`lib/theme.js`, localStorage `theme`, written only for light or system), applied before paint by `public/theme-init.js` (a plain blocking script, kept in git by `.gitignore`). Colours that cannot be a class (SVG attributes in charts) read `useResolvedTheme()`; inline styles use `rgb(var(--c-slate-800))`. Never hard-code a dark hex in a style or SVG attribute.
- **Design tokens:** `src/design/tokens.json` is a copy of the "Stacklens" design-system artifact (https://claude.ai/artifact/RJWC7xrkgdo2bLQciMdVTb). `index.css` declares each colour as a CSS variable (dark under `:root`, light under `[data-theme="light"]`, switched by the Appearance setting) and `tailwind.config.js` exposes it as a semantic colour (`bg-brand`, `text-ink-muted`, `border-line-control`, `outline-focus-ring`…). They are plain `var()` values, so opacity modifiers (`bg-brand/50`) do not work on them. Change a value in `tokens.json` and in `index.css` together; the test fails if they drift, and checks every text pair at 4.5:1 and controls at 3:1 in both themes.
- **Dashboard and sidebar** (`dashboard-layout.test.js`): one priority band (people who left and can still sign in), three figures (monthly spend with the recorded previous month when there is one, potential savings from `computeWaste`, security score), one ranked to-do list (`todo` in `DashboardPage.jsx`, levels Urgent / Important / To plan, six lines then "Show all") and the spend breakdown. The old "critical alerts" panel and "action inbox" are merged into that list; access reviews (`access_review`) are a line of it. `recommendations_shown` counts the to-do lines on screen by the same kinds as `recommendation_acted`. Sidebar: tokens, active item `bg-brand-soft text-brand-text` with `aria-current`.
- **Buttons and fields:** a filled blue or red button darkens on hover (`hover:bg-blue-700`, `hover:bg-red-700`): white on blue-500 or red-500 is under 4.5:1. Text fields, selects and textareas use `border-line-control` (3:1); `Button` shows a solid `outline-focus-ring` 2px off for the keyboard.

### Deployment

Firebase Hosting (`dist/`) with security headers in `firebase.json` including a strict CSP. `public/.well-known/security.txt` is not copied by the build (dot-directory), so the same file lives at `public/security.txt` and a hosting rewrite serves it at `/.well-known/security.txt`; keep the two identical. After any `vite build`, run `firebase deploy --only hosting`. **The CSP allows no inline script** (`script-src 'self'` plus named hosts, no `'unsafe-inline'`, no `'unsafe-eval'`): the Google Consent Mode script is `public/consent-init.js`, loaded by `index.html` as a plain blocking `<script src>` before the app, and `src/lib/csp.test.js` fails on an inline script, an inline handler, a wildcard `connect-src` host or a weaker policy. Anything that needs a new script goes in a file, or its host is added to the policy deliberately. The CSP `connect-src` must include all external APIs the app fetches (googleapis, google.com, gstatic.com, apis.google.com, accounts.google.com). Note: `open.er-api.com` was removed deliberately — amounts are never converted (see `src/lib/currency.js`), so nothing fetches exchange rates.

Source maps are disabled in production (`sourcemap: false` in `vite.config.js`).
