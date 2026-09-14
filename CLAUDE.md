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
npm test             # Vitest — 306 tests (src/lib, src/pages, functions/)
```

There is a **husky pre-commit hook** that runs ESLint on staged files — commits will be blocked on lint errors.

## Architecture

### Data flow

The app uses a **dual-layer persistence model**:

1. **localStorage** (`LS_KEY = 'accessguard_v1'`) — primary read path. All app state (tools, employees, access, contracts, invoices, licenses) lives here as a single JSON blob.
2. **Firestore** (`/userdata/{uid}`) — cloud backup. Writes are debounced fire-and-forget via `saveDb()`. Large arrays (employees, access, audit_log) are stored as size-capped slices in the `/userdata/{uid}/chunks` subcollection (Firestore 1MB doc limit) and reassembled by `loadUserData()`. On sign-in, `hydrateFromFirestore()` pulls cloud → localStorage (local wins if it has more data).

`useDbQuery()` (TanStack Query, `queryKey: ['db']`) reads localStorage. `useDbMutations()` wraps writes that call `saveDb()`. To update data anywhere: mutate via `useDbMutations()`, never write to localStorage directly.

Plan/billing state lives in a **separate** Firestore collection (`/users/{uid}`) updated only by the Stripe webhook. Client reads it via `getUserPlanFromFirestore()` and merges into `db.user`.

### Plan & access control

Three gating systems:
- `PlanGate({ requires })` — compares `resolvePlan(user)` against `PLAN_TIERS` in `src/lib/plan.js`. The tiers are **not** a single sales ladder: `free` 0, `starter` 2, `hr_finance` 2, `pro` 3, `enterprise` 4, `scale`/`unlimited`/`professional` 4, and `trial` 4 — a trial deliberately has full access and expires after `TRIAL_DAYS`. `starter` and `hr_finance` are the same tier, so `requires` cannot distinguish them; use `ModuleGate` when the distinction matters.
- `ModuleGate({ module })` — maps plan to enabled modules (`security`, `finance`, `people`)
- `RoleGate({ requires })` — RBAC within the app (`viewer`, `editor`, `admin`, `owner`)

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
| `components/ImportWizard.jsx` | CSV/spreadsheet import flow |
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

**Firebase App Check (reCAPTCHA v3) is currently DISABLED.** The switch is `APP_CHECK_ENABLED = false` in `src/firebase-config.js`, and the wiring behind it is intact — the site key is in `VITE_RECAPTCHA_SITE_KEY`. Nothing today verifies that a caller is the real app, so auth and the callable endpoints are reachable by any client that has the (public) Firebase config.

To re-enable, flip the flag to `true`. Do it as its own change: every auth operation then requires a valid App Check token, and if the deployment domain is not in the reCAPTCHA allowed-domains list in Google Cloud Console, sign-in fails with `auth/internal-error` for real users. Verify the allow-list before shipping it.

### Cloud Functions

All functions require a Firebase Auth Bearer token (`verifyAuth`). Rate limits: `/ai` → 20 calls/hr per user, `/createCheckout` + `/createPortal` → 5 calls/hr per user. Limits are stored in Firestore `/rate_limits/{prefix}_{uid}`.

Secrets (ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SENDGRID_API_KEY) are in GCP Secret Manager — deploying functions requires billing enabled on the GCP project.

### Firestore security rules

`/users/{uid}` — owner read/write, but `protectedFieldsSafe()` blocks client writes to billing fields (`plan`, `stripe_*`, `subscription_*`, `is_founder`, `role`). Only exception: self-starting a trial (`plan='trial'` + `trial_started_at`) is allowed once per user (prevented from replay by checking existing doc has no `trial_started_at`).

`/userdata/{uid}` — owner only, no field restrictions.

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

### i18n

`useTranslation()` from `translations.js` returns `t(key)`. Language preference stored in `localStorage('language')` and managed by `useLang()` from `src/contexts/LangContext.jsx`. Five languages: `en`, `fr`, `de`, `es`, `pt`. Missing keys are auto-translated via AI and cached in localStorage.

### Deployment

Firebase Hosting (`dist/`) with security headers in `firebase.json` including a strict CSP. After any `vite build`, run `firebase deploy --only hosting`. The CSP `connect-src` must include all external APIs the app fetches (googleapis, google.com, gstatic.com, apis.google.com, accounts.google.com). Note: `open.er-api.com` was removed deliberately — amounts are never converted (see `src/lib/currency.js`), so nothing fetches exchange rates.

Source maps are disabled in production (`sourcemap: false` in `vite.config.js`).
