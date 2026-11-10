import { FOUNDER_EMAILS } from './constants';

// True if this user should have founder access — either the Firestore
// is_founder flag, or their email is in the founder allowlist (so founder
// access survives an account delete/recreate).
export function isFounderUser(user) {
  if (!user) return false;
  if (user.is_founder === true) return true;
  const email = (user.email || '').toLowerCase();
  return !!email && FOUNDER_EMAILS.includes(email);
}

// Plan tiers — higher = more access
export const PLAN_TIERS = {
  free: 0,
  trial: 4,       // Trial = full access, expires after TRIAL_DAYS
  demo:  4,       // Demo mode = full access (showcase)
  starter: 2,
  hr_finance: 2,
  pro: 3,
  cabinet: 3,     // Pro's modules, for an accounting firm, with client workspaces
  business: 4,
  enterprise: 4,
  // legacy aliases
  growth: 3, scale: 4, unlimited: 4, professional: 4, startup: 0,
};

// How many people an owner can share the workspace with. Enforced by the
// workspace function (MAX_WORKSPACE_MEMBERS), which refuses any invite on free
// and trial and caps every paid plan at the same number. There are no
// per-plan seat tiers: the cards used to sell 5, 10 and 15 "team seats" that
// the server never counted. plan-parity.test.js keeps the two numbers equal.
export const TEAM_INVITE_LIMIT = 10;

// Client workspaces (the accountant model). Free has none, a trial gets a
// taste, every paid plan the same cap. Server copies: MAX_CLIENT_ORGS and
// TRIAL_CLIENT_ORGS in functions/index.js, held equal by plan-parity.test.js.
export const CLIENT_WORKSPACE_LIMIT = 50;
export const TRIAL_CLIENT_WORKSPACES = 3;

// Which plans may create client workspaces. Until 2026-11-10 every paid plan
// could, so a firm got the accountant offer for €29; it now comes with the
// Cabinet plan (and Business and Enterprise, which are bigger anyway). A trial
// still gets TRIAL_CLIENT_WORKSPACES, and an account that already holds a
// client workspace keeps adding up to the cap whatever its plan: nobody loses
// what they had. Server copy: CLIENT_PLANS in functions/index.js
// (plan-parity.test.js).
export const CLIENT_PLANS = ['cabinet', 'business', 'enterprise', 'scale', 'unlimited', 'professional'];

/** May this account create a client workspace? `hasClientOrgs`: it already holds one (kept from before the change). */
export function mayCreateClientWorkspace(plan, { hasClientOrgs = false } = {}) {
  if (plan === 'free') return false;
  return plan === 'trial' || CLIENT_PLANS.includes(plan) || hasClientOrgs;
}

// Hard limits enforced on data creation
export const PLAN_LIMITS = {
  free:       { tools: 10,    employees: 25,    teamInvites: 0,   label: 'Free' },
  trial:      { tools: 9999,  employees: 9999,  teamInvites: 0,   label: 'Trial (7 days)' },
  demo:       { tools: 9999,  employees: 9999,  teamInvites: 0,   label: 'Demo' },
  starter:    { tools: 100,   employees: 250,   teamInvites: TEAM_INVITE_LIMIT,   label: 'Starter' },
  hr_finance: { tools: 100,   employees: 250,   teamInvites: TEAM_INVITE_LIMIT,   label: 'HR & Finance' },
  pro:        { tools: 500,   employees: 500,   teamInvites: TEAM_INVITE_LIMIT,  label: 'Pro' },
  cabinet:    { tools: 500,   employees: 500,   teamInvites: TEAM_INVITE_LIMIT,  label: 'Cabinet' },
  business:   { tools: 99999, employees: 1500,  teamInvites: TEAM_INVITE_LIMIT,  label: 'Business' },
  enterprise: { tools: 99999, employees: 99999, teamInvites: TEAM_INVITE_LIMIT, label: 'Enterprise' },
  // legacy
  growth:       { tools: 500,   employees: 1500,  teamInvites: TEAM_INVITE_LIMIT,  label: 'Pro' },
  scale:        { tools: 99999, employees: 99999, teamInvites: TEAM_INVITE_LIMIT, label: 'Enterprise' },
  unlimited:    { tools: 99999, employees: 99999, teamInvites: TEAM_INVITE_LIMIT, label: 'Enterprise' },
  professional: { tools: 99999, employees: 99999, teamInvites: TEAM_INVITE_LIMIT, label: 'Enterprise' },
  startup:      { tools: 10,    employees: 25,    teamInvites: 0,   label: 'Free' },
};

export const TRIAL_DAYS = 7;
export const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
// Clocks differ a little; a trial start more than this far ahead was never real.
export const FUTURE_SKEW_MS = 5 * 60 * 1000;

/**
 * Resolve the effective plan for a user object.
 * Single source of truth — handles trial expiry and founder override.
 * @param {object|null} user - { is_founder, plan, subscription_plan, trial_started_at, plan_grant_until, subscription_status }
 * @returns {string} plan key
 */
// A plan given rather than bought — the early-access programme — carries an
// end date in plan_grant_until (ms). Past it the account is free, unless it has
// since started paying: a grant never overrides a live Stripe subscription.
// Nothing rewrites the stored plan when a grant ends, exactly as with trials,
// so the expiry has to be applied wherever the plan is read. The server twin
// is effectivePlan() in functions/workspace-write.js; plan-parity.test.js
// holds them together.
export const PAYING_STATUSES = ['active', 'trialing', 'past_due'];

export function grantExpired(user, now = Date.now()) {
  const until = Number(user?.plan_grant_until) || 0;
  if (!until || now < until) return false;
  return !PAYING_STATUSES.includes(user?.subscription_status);
}

export function resolvePlan(user) {
  if (!user) return 'free';
  if (isFounderUser(user)) return 'scale';
  if (grantExpired(user)) return 'free';
  const stored = user.plan || user.subscription_plan;
  if (stored && stored !== 'trial' && stored !== 'free') return stored;
  if (stored === 'trial') {
    if (!user.trial_started_at) return 'free'; // no start date = invalid trial
    const startedAt = typeof user.trial_started_at === 'number'
      ? user.trial_started_at
      : Date.parse(user.trial_started_at) || 0;
    // A start in the future is not a trial: it would never end
    // (functions/workspace-write.js effectivePlan says the same).
    if (startedAt > Date.now() + FUTURE_SKEW_MS) return 'free';
    if (startedAt > 0 && (Date.now() - startedAt) < TRIAL_MS) return 'trial';
    return 'free';
  }
  return stored || 'free';
}

/**
 * Plans that cannot invite colleagues. The workspace function's `invite`
 * refuses these (functions/index.js; plan-parity.test.js holds the two lists
 * together), so the app does not offer an invite it would refuse.
 */
export const NO_TEAM_PLANS = ['free', 'trial'];

/** May this account invite colleagues? Founders resolve to 'scale', so yes. */
export function canInviteTeam(user) {
  return !NO_TEAM_PLANS.includes(resolvePlan(user));
}

/**
 * Returns trial state: { isTrial, daysLeft, expired }
 */
export function getTrialState(user) {
  if (!user || !user.trial_started_at) return { isTrial: false, daysLeft: 0, expired: false };
  const startedAt = typeof user.trial_started_at === 'number'
    ? user.trial_started_at
    : Date.parse(user.trial_started_at) || 0;
  if (startedAt === 0) return { isTrial: false, daysLeft: 0, expired: false };
  const elapsed = Date.now() - startedAt;
  const daysLeft = Math.max(0, Math.ceil((TRIAL_MS - elapsed) / (24 * 60 * 60 * 1000)));
  const expired = elapsed >= TRIAL_MS;
  const isTrial = (user.plan === 'trial' || user.subscription_plan === 'trial') && !expired;
  return { isTrial, daysLeft, expired };
}

// Pro was sold up to 1,500 people until Business took over 500 to 1,500.
// A Pro subscription that began before the change, or Pro given without a
// subscription (an early-access grant), keeps 1,500: nobody already paying
// loses room. `pro_since` is when the account became Pro, written by the
// Stripe webhook (proSinceUpdate in functions/index.js; a protected field in
// firestore.rules) and removed when it stops being Pro, so a Starter from
// before the change that moves to Pro later gets the new allowance. No date
// means Pro from before the field existed, or Pro given by hand.
export const PRO_LEGACY_EMPLOYEES = 1500;
export const PRO_LIMIT_CUTOFF = Date.parse('2026-11-10T00:00:00Z');
export const isLegacyPro = (user) => {
  const started = Number(user?.pro_since) || 0;
  return !started || started < PRO_LIMIT_CUTOFF;
};

/** The plan's limits; pass the user so a Pro customer from before the change keeps 1,500 people. */
export function getPlanLimits(plan, user = null) {
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  if (plan === 'pro' && user && isLegacyPro(user)) return { ...limits, employees: PRO_LEGACY_EMPLOYEES };
  return limits;
}
