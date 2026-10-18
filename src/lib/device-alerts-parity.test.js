import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { coverageEnding, COVERAGE_SOON_DAYS } from './assets';

// ── The daily email and the Devices page agree on warranty and lease ends ──
//
// The Devices page lists warranties and leases ending within 30 days
// (src/lib/assets.js coverageEnding); the daily email mails them at 30 and 7
// days (functions/device-alerts.js), which cannot import this code. An admin
// told "2 warranties end this month" by email who finds three on the page
// stops trusting both, so both copies run on the same devices here.

const require_ = createRequire(import.meta.url);
const server = require_('../../functions/device-alerts.js');

const TODAY = '2026-10-17';
const NOW = Date.parse(`${TODAY}T10:00:00Z`);

const DEVICES = [
  { id: 'a', name: 'MacBook Air', coverage_type: 'warranty', coverage_end: '2026-10-20', status: 'in_use', assigned_name: 'Ana' },
  { id: 'b', name: 'iPhone 15', coverage_type: 'lease', coverage_end: '2026-11-16', status: 'in_stock' },      // day 30
  { id: 'c', name: 'Dell U27', coverage_type: 'warranty', coverage_end: '2026-11-17', status: 'in_use' },      // day 31: not yet
  { id: 'd', name: 'Old phone', coverage_type: 'lease', coverage_end: '2026-10-25', status: 'retired' },       // written off
  { id: 'e', name: 'Lost tablet', coverage_type: 'warranty', coverage_end: '2026-10-25', status: 'lost' },
  { id: 'f', name: 'Expired', coverage_type: 'warranty', coverage_end: '2026-10-16', status: 'in_use' },       // already ended
  { id: 'g', name: 'No date', coverage_type: 'warranty', coverage_end: '', status: 'in_use' },
  { id: 'h', name: 'Today', coverage_end: '2026-10-17', status: 'in_repair' },                                  // day 0
];

describe('the email and the page pick the same devices', () => {
  it('same window, same exclusions', () => {
    const page = coverageEnding({ assets: DEVICES }, { now: NOW }).map((a) => a.name);
    const mail = server.deviceCoverageAlerts(DEVICES, TODAY).map((d) => d.name);
    expect(mail).toEqual(page);
    expect(mail).toEqual(['Today', 'MacBook Air', 'iPhone 15']);
  });

  it('the same 30 days and the same statuses written off', () => {
    expect(Math.max(...server.COVERAGE_THRESHOLDS)).toBe(COVERAGE_SOON_DAYS);
    expect(server.GONE_STATUSES).toEqual(['retired', 'lost']);
  });
});

describe('each end is mailed once at 30 days and once at 7', () => {
  it('remembers what it sent, and the tighter threshold wins on the day', () => {
    const sent = {}; const fresh = {};
    const first = server.deviceCoverageAlerts(DEVICES, TODAY, sent, fresh);
    expect(first.find((d) => d.name === 'MacBook Air').days).toBe(3);
    // MacBook (3 days) and Today (0 days) are past the 7-day mark: their 7 is
    // sent, and their 30 settled with it so it never follows tomorrow.
    expect(Object.keys(fresh).sort()).toEqual([
      'coverage_a_2026-10-20_30', 'coverage_a_2026-10-20_7', 'coverage_b_2026-11-16_30',
      'coverage_h_2026-10-17_30', 'coverage_h_2026-10-17_7',
    ]);
    // The next day, nothing again for the devices already mailed; only the
    // Dell screen, which has just reached 30 days.
    const again = server.deviceCoverageAlerts(DEVICES, '2026-10-18', { ...fresh }, {});
    expect(again.map((d) => [d.name, d.days])).toEqual([['Dell U27', 30]]);
  });

  it('a lease mailed at 30 days is mailed again at 7, and a new end date starts over', () => {
    const lease = [{ id: 'b', name: 'iPhone 15', coverage_type: 'lease', coverage_end: '2026-11-16', status: 'in_use' }];
    const k30 = {}; server.deviceCoverageAlerts(lease, TODAY, {}, k30);
    expect(server.deviceCoverageAlerts(lease, '2026-11-09', k30, {})).toHaveLength(1);   // 7 days left
    const extended = [{ ...lease[0], coverage_end: '2027-11-16' }];
    expect(server.deviceCoverageAlerts(extended, '2027-10-20', k30, {})).toHaveLength(1);
  });

  it('copes with a workspace that has no devices', () => {
    expect(server.deviceCoverageAlerts(undefined, TODAY)).toEqual([]);
    expect(server.deviceCoverageAlerts([], TODAY)).toEqual([]);
  });
});

describe('the email line', () => {
  it('says what ends, when, and who holds it, with what people typed escaped', () => {
    const [title, detail] = server.deviceAlertLine({ name: '<b>Mac</b>', type: 'lease', date: '2026-10-20', days: 3, holder: 'Ana & co' });
    expect(title).toBe('&lt;b&gt;Mac&lt;/b&gt;');
    expect(detail).toBe('Lease ends 2026-10-20 (3 days) · held by Ana &amp; co');
    expect(server.deviceAlertLine({ name: 'X', type: '', date: '2026-10-18', days: 1, holder: '' })[1]).toBe('Warranty or lease ends 2026-10-18 (1 day)');
  });
});
