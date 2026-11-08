import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as client from './renewalNotice';

// ── The email and the screens name the same last day to cancel ────────────

const require_ = createRequire(import.meta.url);
const server = require_('../../functions/renewal-notice.js');
const { renewalAlerts } = require_('../../functions/renewal-alerts.js');
const { renewalAlertLine } = require_('../../functions/alert-email.js');

const TODAY = '2026-11-08';
const T = (over) => ({ id: over.name, cost_per_month: 100, auto_renew: true, ...over });
const TOOLS = [
  T({ name: 'Slack', renewal_date: '2026-12-02', notice_days: 30 }),                                   // deadline 11-02: locked
  T({ name: 'GitHub', renewal_date: '2027-01-01', notice_days: 30, procurement_required: true }),     // decide 11-17: 9 days, soon
  T({ name: 'Figma', renewal_date: '2026-12-15', notice_days: 30 }),                                   // decide 11-15: 7 days, act_now
  T({ name: 'Notion', renewal_date: '2026-11-20' }),                                                   // no notice: renewal reminder
  T({ name: 'Zoom', renewal_date: '2027-06-01', notice_days: 60 }),                                    // later
  T({ name: 'Asana', renewal_date: '2026-12-15', notice_days: 30, renewal_decision: { renewal_date: '2026-12-15', choice: 'cancel', by: 'a@x.fr' } }),
  T({ name: 'Old decision', renewal_date: '2026-12-14', notice_days: 30, renewal_decision: { renewal_date: '2025-12-14', choice: 'renew' } }), // last year's: decide 11-14, 6 days
  T({ name: 'Gone', renewal_date: '2026-12-15', notice_days: 30, status: 'decommissioned' }),
  T({ name: 'Past', renewal_date: '2026-11-01', notice_days: 30 }),
  T({ name: 'Bad notice', renewal_date: '2026-12-15', notice_days: 'soon' }),
  T({ name: 'Custom lead', renewal_date: '2027-01-01', notice_days: 30, procurement_required: true, procurement_lead_days: 5 }),
  T({ name: 'Manual', renewal_date: '2026-11-25', notice_days: 30, auto_renew: false }),             // nothing to cancel: renewal reminder
];

describe('both copies compute the same timeline for every tool', () => {
  it('same dates, same states', () => {
    for (const tool of TOOLS) expect(client.noticeTimeline(tool, TODAY), tool.name).toEqual(server.noticeTimeline(tool, TODAY));
    const state = Object.fromEntries(TOOLS.map((t) => [t.name, client.noticeTimeline(t, TODAY)?.state ?? null]));
    expect(state).toEqual({
      Slack: 'locked', GitHub: 'soon', Figma: 'act_now', Notion: 'unknown_notice', Zoom: 'later', Asana: 'decided',
      'Old decision': 'act_now', Gone: null, Past: null, 'Bad notice': 'unknown_notice', 'Custom lead': 'soon', Manual: 'no_auto_renew',
    });
    const gh = client.noticeTimeline(TOOLS[1], TODAY);
    expect(gh).toMatchObject({ notice_deadline: '2026-12-02', decide_by: '2026-11-17', procurement_lead_days: 15, days_to_decide: 9 });
    expect(client.noticeTimeline(TOOLS[10], TODAY)).toMatchObject({ decide_by: '2026-11-27', procurement_lead_days: 5 });
  });
  it('the same constants', () => {
    for (const k of ['DEFAULT_PROCUREMENT_LEAD_DAYS', 'ACT_NOW_DAYS', 'SOON_DAYS', 'RENEWAL_DECISIONS']) expect(client[k], k).toEqual(server[k]);
  });
});

describe('the email', () => {
  it('reminds of the decision date for tools with a notice period, of the renewal for the rest, once', () => {
    const sent = {};
    const notices = server.noticeAlerts(TOOLS, TODAY, {}, sent);
    expect(notices.map((n) => [n.name, n.kind, n.days])).toEqual([
      ['Slack', 'locked', 24], ['GitHub', 'notice', 9], ['Figma', 'notice', 7], ['Old decision', 'notice', 6], ['Custom lead', 'notice', 19],
    ]);
    // A tool with a notice period is no longer reminded of its renewal date.
    expect(renewalAlerts(TOOLS, TODAY, {}, {}).map((r) => r.name)).toEqual(['Notion', 'Manual']); // 'Bad notice' renews in 37 days: outside the 30-day window
    expect(server.noticeAlerts(TOOLS, TODAY, sent, {})).toEqual([]);
    expect(server.noticeAlerts(TOOLS, '2026-11-09', sent, {})).toEqual([]);
  });
  it('the line names the decision date, the last day to cancel, the purchasing delay and the owner, escaped', () => {
    const [n] = server.noticeAlerts([T({ name: '<b>GitHub</b>', renewal_date: '2027-01-01', notice_days: 30, procurement_required: true, owner_email: 'it@x.fr' })], TODAY, {}, {});
    const [title, detail] = renewalAlertLine(n, '€', (x) => String(x));
    expect(title).toBe('&lt;b&gt;GitHub&lt;/b&gt;');
    expect(detail).toBe("decide by 2026-11-17 (9 days): last day to cancel 2026-12-02 (30 days' notice, after 15 days for purchasing approval), renews 2027-01-01 · €1200/yr · owner it@x.fr");
    const [locked] = server.noticeAlerts([TOOLS[0]], TODAY, {}, {});
    expect(renewalAlertLine(locked, '€', String)[1]).toMatch(/has passed with no decision recorded: it renews 2026-12-02/);
  });
});

describe('the screens', () => {
  it('list what needs a decision now, locked first, and record a decision for this cycle only', () => {
    expect(client.decisionsDue({ tools: TOOLS }, TODAY).map((t) => t.name)).toEqual(['Slack', 'Old decision', 'Figma']);
    const decided = client.withDecision(TOOLS[2], { choice: 'cancel', by: 'Claire', at: new Date('2026-11-08T10:00:00Z') });
    expect(decided.renewal_decision).toEqual({ renewal_date: '2026-12-15', choice: 'cancel', by: 'Claire', note: '', at: '2026-11-08T10:00:00.000Z' });
    expect(client.noticeTimeline(decided, TODAY).state).toBe('decided');
    expect(() => client.withDecision(TOOLS[2], { choice: 'maybe' })).toThrow();
  });
});

describe('the inputs', () => {
  it('a tools sheet in French brings the notice, the contract owner and purchasing', async () => {
    const { mapHeaders } = await import('./csvHeaders');
    const { csvToolExtras } = await import('../hooks/useDbQuery');
    const { line } = mapHeaders('Outil;Préavis;Responsable contrat;Validation achats;Délai achats', 'tools');
    expect(line).toBe('name;notice_days;contract_owner_email;procurement_required;procurement_lead_days');
    expect(csvToolExtras({ notice_days: '30 jours', contract_owner_email: 'Achats@Acme.fr', procurement_required: 'oui', procurement_lead_days: '10' }, ''))
      .toEqual({ notice_days: 30, contract_owner_email: 'achats@acme.fr', procurement_required: true, procurement_lead_days: 10 });
    // Blank and unreadable cells stay unknown rather than becoming 0.
    expect(csvToolExtras({ notice_days: '', contract_owner_email: 'nobody', procurement_lead_days: '' }, '')).toEqual({});
  });

  it('the Renewals panel lists what is due, what is decided and where the notice is missing', () => {
    const rows = client.noticeRows(TOOLS, TODAY);
    expect(rows.due.map((r) => [r.name, r.state])).toEqual([
      ['Slack', 'locked'], ['Old decision', 'act_now'], ['Figma', 'act_now'], ['GitHub', 'soon'], ['Custom lead', 'soon'],
    ]);
    expect(rows.decided.map((r) => r.name)).toEqual(['Asana']);
    expect(rows.unknown.map((r) => r.name)).toEqual(['Notion', 'Bad notice']);
  });
});

describe('purchasing late, cancellation still possible', () => {
  it('says how long is left before the last day to cancel, never a negative count', () => {
    const tool = T({ name: 'Late', renewal_date: '2026-12-10', notice_days: 20, procurement_required: true }); // cancel by 11-20, decide 11-05
    const tl = client.noticeTimeline(tool, TODAY);
    expect(tl).toMatchObject({ state: 'act_now', days_to_decide: -3, days_to_deadline: 12 });
    const [n] = server.noticeAlerts([tool], TODAY, {}, {});
    expect(renewalAlertLine(n, '€', String)[1]).toMatch(/^purchasing's date \(2026-11-05\) has passed, 12 days left: last day to cancel 2026-11-20/);
  });
});
