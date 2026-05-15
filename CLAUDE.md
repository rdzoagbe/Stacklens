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
```

There are no tests or linters configured. Type checking is implicit via React/JSX.

## Architecture

### Data flow

The app uses a **dual-layer persistence model**:

1. **localStorage** (`LS_KEY = 'saasguard_db'`) — primary read path. All app state (tools, employees, access, contracts, invoices, licenses) lives here as a single JSON blob.
2. **Firestore** (`/userdata/{uid}`) — cloud backup. Writes are fire-and-forget via `saveDb()`. On sign-in, `hydrateFromFirestore()` pulls cloud → localStorage (local wins if it has more data).

`useDbQuery()` (TanStack Query, `queryKey: ['db']`) reads localStorage. `useDbMutations()` wraps writes that call `saveDb()`. To update data anywhere: mutate via `useDbMutations()`, never write to localStorage directly.

Plan/billing state lives in a **separate** Firestore collection (`/users/{uid}`) updated only by the Stripe webhook. Client reads it via `getUserPlanFromFirestore()` and merges into `db.user`.

### Plan & access control

Two gating systems:
- `PlanGate({ requires })` — checks `resolvePlan(user)` against plan hierarchy: `free → trial → starter → hr_finance → pro → enterprise → scale`
- `ModuleGate({ module })` — maps plan to enabled modules (`security`, `finance`, `people`)
- `RoleGate({ requires })` — RBAC within the app (`viewer`, `editor`, `admin`, `owner`)

`resolvePlan()` (line ~4571) is the single source of truth. Founder override (`is_founder=true`) always returns `'scale'`. Trial expiry is checked client-side against `trial_started_at` + `TRIAL_MS` (7 days).

### Source files

| File | Purpose |
|---|---|
| `src/App.jsx` | **~15k lines** — entire app: routing, all pages, all components, all hooks, all business logic. Everything lives here. |
| `src/firebase-config.js` | Firebase init, all auth helpers, Firestore CRUD, Stripe billing calls, AI proxy, consent logging |
| `src/translations.js` | i18n strings (EN/FR/DE/ES/PT) + `useTranslation()` hook. AI auto-translate via `callAI()`. |
| `src/components/ui.jsx` | Tiny shared UI primitives (Button, Input, Modal, etc.) — rarely needed since App.jsx has its own copies |
| `src/lib/utils.js` | `cn()` classname helper |
| `functions/index.js` | Cloud Functions: `/ai`, `/createCheckout`, `/createPortal`, `/stripeWebhook`, `/syncuser`, `renewalAlerts` |

### Routing

All routes are defined at the bottom of `App.jsx` (~line 14920). Public routes: `/`, `/pricing`, `/features`, legal pages. Authenticated routes wrap with `<RequireAuth>` and often `<ModuleGate>`. `/integrations`, `/billing`, `/analytics`, `/licenses`, `/renewals`, `/invoices`, `/contracts` all redirect to `/settings` or `/finance`.

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

`useTranslation()` from `translations.js` returns `t(key)`. Language preference stored in `localStorage('language')` and managed by `LanguageContext` / `LanguageProvider` at the top of `App.jsx`. Five languages: `en`, `fr`, `de`, `es`, `pt`.

### Deployment

Firebase Hosting (`dist/`) with security headers in `firebase.json` including a strict CSP. After any `vite build`, run `firebase deploy --only hosting`. The CSP `connect-src` must include all external APIs the app fetches (googleapis, google.com, gstatic.com, apis.google.com, accounts.google.com, open.er-api.com).

Source maps are disabled in production (`sourcemap: false` in `vite.config.js`).
