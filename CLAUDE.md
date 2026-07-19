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
npm test             # Vitest — 84 tests across lib/
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
- `PlanGate({ requires })` — checks `resolvePlan(user)` against plan hierarchy: `free → trial → starter → hr_finance → pro → enterprise → scale`
- `ModuleGate({ module })` — maps plan to enabled modules (`security`, `finance`, `people`)
- `RoleGate({ requires })` — RBAC within the app (`viewer`, `editor`, `admin`, `owner`)

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
| `AuditPage.jsx` | `/audit` |
| `OnboardingPage.jsx` | `/onboarding` |
| `LegalPages.jsx` | `/privacy`, `/terms`, `/dpa`, `/sub-processors`, `/security-info`, `/legal`, `/about`, `/contact` |
| `FinishSignUpPage.jsx` | `/finishSignUp` |

#### Finance tabs (`src/pages/finance/`)

`OverviewTab`, `CostTab`, `LicensesTab`, `RenewalsTab`, `AnalyticsTab`, `ExecutiveDashboard`

#### Settings tabs (`src/pages/settings/`)

`BillingTab`, `IntegrationsTab`

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
| `DashboardComponents.jsx` | Spend cards, KPI widgets used by DashboardPage |
| `ExecutiveDashboard.jsx` | Executive summary view |
| `Modals.jsx` | Shared modal components (AddTool, ImportWizard, etc.) |
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
| `src/lib/utils.js` | `cn()` classname helper |

### Routing

All routes are in `src/App.jsx`. Public routes: `/` and legal pages (`/privacy`, `/terms`, `/dpa`, etc.). All authenticated routes wrap with `<RequireAuth>`. Sensitive modules (Finance, Employees, Security, Access, Offboarding) also wrap with `<ModuleGate>`.

**There are no `/pricing` or `/features` routes** — unknown paths hit `<NotFound>` which redirects to `/`.

Redirects: `/integrations` → `/settings`, `/billing` → `/settings`, `/analytics` → `/finance`, `/licenses` → `/finance`, `/renewals` → `/finance`, `/invoices` → `/finance`, `/contracts` → `/finance`.

### Authentication

Three sign-in methods, all in `firebase-config.js`:
- Google popup (`signInWithGoogle`)
- Magic link (`sendMagicLink` / `completeMagicLinkSignIn`)
- Email/password (`registerWithEmail` / `signInWithEmail`)

Firebase App Check (reCAPTCHA v3) is active — the site key is in `VITE_RECAPTCHA_SITE_KEY`. All auth ops require a valid App Check token. If sign-in fails with `auth/internal-error`, check that the deployment domain is in the reCAPTCHA allowed-domains list in Google Cloud Console.

### Cloud Functions

All functions require a Firebase Auth Bearer token (`verifyAuth`). Rate limits: `/ai` → 20 calls/hr per user, `/createCheckout` + `/createPortal` → 5 calls/hr per user. Limits are stored in Firestore `/rate_limits/{prefix}_{uid}`.

Secrets (ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SENDGRID_API_KEY) are in GCP Secret Manager — deploying functions requires billing enabled on the GCP project.

### Firestore security rules

`/users/{uid}` — owner read/write, but `protectedFieldsSafe()` blocks client writes to billing fields (`plan`, `stripe_*`, `subscription_*`, `is_founder`, `role`). Only exception: self-starting a trial (`plan='trial'` + `trial_started_at`) is allowed once per user (prevented from replay by checking existing doc has no `trial_started_at`).

`/userdata/{uid}` — owner only, no field restrictions.

### i18n

`useTranslation()` from `translations.js` returns `t(key)`. Language preference stored in `localStorage('language')` and managed by `useLang()` from `src/contexts/LangContext.jsx`. Five languages: `en`, `fr`, `de`, `es`, `pt`. Missing keys are auto-translated via AI and cached in localStorage.

### Deployment

Firebase Hosting (`dist/`) with security headers in `firebase.json` including a strict CSP. After any `vite build`, run `firebase deploy --only hosting`. The CSP `connect-src` must include all external APIs the app fetches (googleapis, google.com, gstatic.com, apis.google.com, accounts.google.com, open.er-api.com).

Source maps are disabled in production (`sourcemap: false` in `vite.config.js`).
