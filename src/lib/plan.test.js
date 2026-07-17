import { describe, it, expect } from 'vitest';
import { resolvePlan, getTrialState, getPlanLimits, isFounderUser, PLAN_TIERS, TRIAL_DAYS, TRIAL_MS } from './plan';

const DAY = 24 * 60 * 60 * 1000;

describe('isFounderUser', () => {
  it('is true for the founder email (case-insensitive)', () => {
    expect(isFounderUser({ email: 'rolanddzoagbe@gmail.com' })).toBe(true);
    expect(isFounderUser({ email: 'ROLANDDZOAGBE@Gmail.com' })).toBe(true);
  });
  it('is true for the is_founder flag', () => {
    expect(isFounderUser({ is_founder: true })).toBe(true);
  });
  it('is false for other users and empty input', () => {
    expect(isFounderUser({ email: 'someone@else.com' })).toBe(false);
    expect(isFounderUser({ email: '' })).toBe(false);
    expect(isFounderUser(null)).toBe(false);
  });
  it('grants scale plan via resolvePlan for the founder email', () => {
    expect(resolvePlan({ email: 'rolanddzoagbe@gmail.com', plan: 'free' })).toBe('scale');
  });
});

describe('resolvePlan', () => {
  it('returns free for null user', () => {
    expect(resolvePlan(null)).toBe('free');
  });

  it('returns free for undefined user', () => {
    expect(resolvePlan(undefined)).toBe('free');
  });

  it('returns scale for founder regardless of plan', () => {
    expect(resolvePlan({ is_founder: true, plan: 'free' })).toBe('scale');
    expect(resolvePlan({ is_founder: true })).toBe('scale');
  });

  it('returns pro for user with paid plan', () => {
    expect(resolvePlan({ plan: 'pro' })).toBe('pro');
  });

  it('returns starter plan directly', () => {
    expect(resolvePlan({ plan: 'starter' })).toBe('starter');
  });

  it('returns trial for active trial within 7 days', () => {
    const user = { plan: 'trial', trial_started_at: Date.now() - 2 * DAY };
    expect(resolvePlan(user)).toBe('trial');
  });

  it('returns trial on day 1', () => {
    const user = { plan: 'trial', trial_started_at: Date.now() - 1 * DAY };
    expect(resolvePlan(user)).toBe('trial');
  });

  it('returns free for expired trial (8 days ago)', () => {
    const user = { plan: 'trial', trial_started_at: Date.now() - 8 * DAY };
    expect(resolvePlan(user)).toBe('free');
  });

  it('returns free for trial with no trial_started_at', () => {
    expect(resolvePlan({ plan: 'trial' })).toBe('free');
  });

  it('returns free for user with no plan', () => {
    expect(resolvePlan({ email: 'x@x.com' })).toBe('free');
  });

  it('reads subscription_plan if plan is absent', () => {
    expect(resolvePlan({ subscription_plan: 'enterprise' })).toBe('enterprise');
  });

  it('resolves legacy growth plan', () => {
    expect(resolvePlan({ plan: 'growth' })).toBe('growth');
    // growth maps to tier 3 same as pro
    expect(PLAN_TIERS['growth']).toBe(3);
  });
});

describe('getTrialState', () => {
  it('returns inactive for null user', () => {
    const s = getTrialState(null);
    expect(s).toEqual({ isTrial: false, daysLeft: 0, expired: false });
  });

  it('returns inactive for user without trial_started_at', () => {
    const s = getTrialState({ plan: 'trial' });
    expect(s).toEqual({ isTrial: false, daysLeft: 0, expired: false });
  });

  it('returns active trial state with correct daysLeft', () => {
    const user = { plan: 'trial', trial_started_at: Date.now() - 2 * DAY };
    const s = getTrialState(user);
    expect(s.isTrial).toBe(true);
    expect(s.expired).toBe(false);
    expect(s.daysLeft).toBe(TRIAL_DAYS - 2);
  });

  it('returns 0 daysLeft and expired=true after 8 days', () => {
    const user = { plan: 'trial', trial_started_at: Date.now() - 8 * DAY };
    const s = getTrialState(user);
    expect(s.expired).toBe(true);
    expect(s.isTrial).toBe(false);
    expect(s.daysLeft).toBe(0);
  });

  it('isTrial is false when plan is not trial even if trial_started_at is set', () => {
    const user = { plan: 'pro', trial_started_at: Date.now() - 2 * DAY };
    const s = getTrialState(user);
    expect(s.isTrial).toBe(false);
  });

  it('handles string ISO date in trial_started_at', () => {
    const ts = new Date(Date.now() - 3 * DAY).toISOString();
    const user = { plan: 'trial', trial_started_at: ts };
    const s = getTrialState(user);
    expect(s.isTrial).toBe(true);
    expect(s.daysLeft).toBe(TRIAL_DAYS - 3);
  });
});

describe('getPlanLimits', () => {
  it('returns free limits for unknown plan', () => {
    const limits = getPlanLimits('unknown_plan');
    expect(limits).toEqual(getPlanLimits('free'));
  });

  it('returns pro limits', () => {
    const limits = getPlanLimits('pro');
    expect(limits.tools).toBe(500);
    expect(limits.employees).toBe(1500);
  });

  it('enterprise has no practical limits', () => {
    const limits = getPlanLimits('enterprise');
    expect(limits.tools).toBeGreaterThan(9000);
  });
});

describe('TRIAL_DAYS constant', () => {
  it('is 7', () => expect(TRIAL_DAYS).toBe(7));

  it('TRIAL_MS equals 7 days in ms', () => {
    expect(TRIAL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
