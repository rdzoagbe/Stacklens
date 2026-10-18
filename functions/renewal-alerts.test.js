import { describe, it, expect } from 'vitest';
import { renewalAlerts } from './renewal-alerts.js';
import { daysUntil, dueReminder } from './threshold-alerts.js';

// ── One renewal, one email per threshold ───────────────────────────────────
//
// The daily email used to try the 30-day reminder first, so a renewal first
// seen 3 days out was mailed "30 days" today and "7 days" tomorrow. And the
// day count was taken from the run's clock, so a renewal due today read
// "-1 days". These pin both fixes.

const TODAY = '2026-10-18';
const tool = (over = {}) => ({ id: 't1', name: 'Slack', renewal_date: '2026-10-21', cost_per_month: 100, ...over });

describe('the tightest threshold is the one sent', () => {
  it('a renewal first seen 3 days out gets one email, and nothing the next day', () => {
    const sent = {};
    const first = renewalAlerts([tool()], TODAY, {}, sent);
    expect(first).toEqual([{ name: 'Slack', date: '2026-10-21', days: 3, annual: 1200 }]);
    expect(Object.keys(sent).sort()).toEqual(['renewal_t1_2026-10-21_30', 'renewal_t1_2026-10-21_7']);
    expect(renewalAlerts([tool()], '2026-10-19', sent, {})).toEqual([]);
  });

  it('a renewal seen early is mailed at 30 days, then again at 7, and never a third time', () => {
    const t = [tool({ renewal_date: '2026-11-17' })];
    expect(renewalAlerts(t, '2026-10-17', {}, {})).toEqual([]);               // 31 days: not yet
    const k30 = {};
    expect(renewalAlerts(t, TODAY, {}, k30).map((r) => r.days)).toEqual([30]);
    expect(renewalAlerts(t, '2026-10-19', k30, {})).toEqual([]);
    expect(renewalAlerts(t, '2026-10-20', k30, {})).toEqual([]);
    const k7 = {};
    expect(renewalAlerts(t, '2026-11-10', k30, k7).map((r) => r.days)).toEqual([7]);
    expect(renewalAlerts(t, '2026-11-11', { ...k30, ...k7 }, {})).toEqual([]);
  });

  it('keeps the keys earlier emails stored, so a reminder already sent stays sent', () => {
    expect(renewalAlerts([tool()], TODAY, { 'renewal_t1_2026-10-21_7': '2026-10-15' }, {})).toEqual([]);
  });

  it('a new renewal date starts over', () => {
    const sent = {};
    renewalAlerts([tool()], TODAY, {}, sent);
    expect(renewalAlerts([tool({ renewal_date: '2027-10-21' })], '2027-10-18', sent, {})).toHaveLength(1);
  });
});

describe('the day count is in calendar days', () => {
  it('due today reads 0 days, not -1; tomorrow reads 1', () => {
    expect(renewalAlerts([tool({ renewal_date: TODAY })], TODAY).map((r) => r.days)).toEqual([0]);
    expect(daysUntil(TODAY, '2026-10-19')).toBe(1);
    expect(daysUntil(TODAY, '2026-11-17')).toBe(30);
  });

  it('skips past dates, tools without a date, and a workspace without tools', () => {
    expect(renewalAlerts([tool({ renewal_date: '2026-10-17' }), tool({ renewal_date: '' }), null], TODAY)).toEqual([]);
    expect(renewalAlerts(undefined, TODAY)).toEqual([]);
  });
});

describe('the shared rule', () => {
  it('beyond every threshold, nothing is due and nothing is marked', () => {
    const fresh = {};
    expect(dueReminder('x', 31, {}, fresh, TODAY)).toBe(false);
    expect(fresh).toEqual({});
  });
});
