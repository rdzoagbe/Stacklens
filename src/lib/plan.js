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
  enterprise: 4,
  // legacy aliases
  growth: 3, scale: 4, unlimited: 4, professional: 4, startup: 0,
};

// Hard limits enforced on data creation
export const PLAN_LIMITS = {
  free:       { tools: 10,    employees: 25,    teamMembers: 1,   label: 'Free' },
  trial:      { tools: 9999,  employees: 9999,  teamMembers: 5,   label: 'Trial (7 days)' },
  demo:       { tools: 9999,  employees: 9999,  teamMembers: 5,   label: 'Demo' },
  starter:    { tools: 100,   employees: 250,   teamMembers: 5,   label: 'Starter' },
  hr_finance: { tools: 100,   employees: 250,   teamMembers: 5,   label: 'HR & Finance' },
  pro:        { tools: 500,   employees: 1500,  teamMembers: 15,  label: 'Pro' },
  enterprise: { tools: 99999, employees: 99999, teamMembers: 999, label: 'Enterprise' },
  // legacy
  growth:       { tools: 500,   employees: 1500,  teamMembers: 15,  label: 'Pro' },
  scale:        { tools: 99999, employees: 99999, teamMembers: 999, label: 'Enterprise' },
  unlimited:    { tools: 99999, employees: 99999, teamMembers: 999, label: 'Enterprise' },
  professional: { tools: 99999, employees: 99999, teamMembers: 999, label: 'Enterprise' },
  startup:      { tools: 10,    employees: 25,    teamMembers: 1,   label: 'Free' },
};

export const TRIAL_DAYS = 7;
export const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Resolve the effective plan for a user object.
 * Single source of truth — handles trial expiry and founder override.
 * @param {object|null} user - { is_founder, plan, subscription_plan, trial_started_at }
 * @returns {string} plan key
 */
export function resolvePlan(user) {
  if (!user) return 'free';
  if (isFounderUser(user)) return 'scale';
  const stored = user.plan || user.subscription_plan;
  if (stored && stored !== 'trial' && stored !== 'free') return stored;
  if (stored === 'trial') {
    if (!user.trial_started_at) return 'free'; // no start date = invalid trial
    const startedAt = typeof user.trial_started_at === 'number'
      ? user.trial_started_at
      : Date.parse(user.trial_started_at) || 0;
    if (startedAt > 0 && (Date.now() - startedAt) < TRIAL_MS) return 'trial';
    return 'free';
  }
  return stored || 'free';
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

export function getPlanLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}
