import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import {
  assignments, expiringAccess, closeAssignment, withException, withoutException, exceptionActive, nextReminder,
  REMIND_DAYS, ESCALATE_AFTER_DAYS, SHOW_BEFORE_DAYS,
} from './lifecycle';
import { computeAccessDerivedRiskFlag } from './dataUtils';
import { buildSeedDb } from './db';
import { csvPersonExtras } from '../hooks/useDbQuery';
import { mapHeaders } from './csvHeaders';

const require_ = createRequire(import.meta.url);
const server = require_('../../functions/lifecycle.js');
const { lifecycleAlertLine } = require_('../../functions/alert-email.js');

// ── An assignment, from the reminder to the last item handed back (Priority 7)

const TODAY = '2026-11-09';
const person = (over) => ({ id: over.id, full_name: over.id, email: `${over.id}@x.fr`, status: 'active', manager_email: 'boss@x.fr', ...over });
const grant = (id, emp, over = {}) => ({ id, tool_id: 't', tool_name: id, employee_id: emp, status: 'active', ...over });
const device = (id, emp, over = {}) => ({ id, name: id, assigned_to: emp, status: 'in_use', ...over });

describe('the stages of an assignment', () => {
  const db = {
    employees: [
      person({ id: 'later', end_date: '2027-01-01' }),                 // 53 days: not shown yet
      person({ id: 'upcoming', end_date: '2026-11-29' }),              // 20 days
      person({ id: 'remind', end_date: '2026-11-19' }),                // 10 days
      person({ id: 'ending', end_date: '2026-11-11' }),                // 2 days
      person({ id: 'ended', end_date: '2026-11-05' }),                 // 4 days ago, items open, has a manager
      person({ id: 'overdue', end_date: '2026-10-30' }),               // 10 days ago, items open
      person({ id: 'orphan', end_date: '2026-11-08', manager_email: '' }), // ended yesterday, no manager: escalates at once
      person({ id: 'ready', end_date: '2026-11-01' }),                 // ended, nothing open
      person({ id: 'closed', end_date: '2026-10-01', assignment_closed: { by: 'a', at: 'x' } }),
      person({ id: 'none' }),                                          // no end date: permanent
    ],
    access: ['upcoming', 'remind', 'ending', 'ended', 'overdue', 'orphan'].map((e) => grant(`a-${e}`, e)),
    assets: [device('d-overdue', 'overdue')],
  };

  it('shows ending within a month and ended until closed, escalated first', () => {
    const list = assignments(db, TODAY);
    expect(list.map((a) => [a.id, a.stage])).toEqual([
      ['overdue', 'overdue'], ['orphan', 'overdue'], ['ended', 'ended'], ['ready', 'ready_to_close'],
      ['ending', 'ending'], ['remind', 'remind'], ['upcoming', 'upcoming'],
    ]);
    expect(list.find((a) => a.id === 'overdue')).toMatchObject({ open: 2, escalated: true, days_to_end: -10 });
    expect(nextReminder(list.find((a) => a.id === 'upcoming'))).toEqual({ kind: 'remind', on: '2026-11-15' });
    expect(nextReminder(list.find((a) => a.id === 'ended'))).toEqual({ kind: 'escalate', on: '2026-11-12' });
  });

  it('the email says the same thing at the same moments, once each', () => {
    const sent = {};
    const today = server.lifecycleAlerts(db, TODAY, {}, sent);
    expect(today.map((r) => [r.name, r.kind])).toEqual([
      ['remind', 'ending'], ['ending', 'ending'], ['overdue', 'overdue'], ['orphan', 'overdue'],
    ]);
    // Nothing again the next day: each reminder once per threshold.
    expect(server.lifecycleAlerts(db, '2026-11-10', sent, {}).map((r) => r.name)).toEqual([]);
    // 'ended' (4 days, has a manager) escalates on day 7.
    expect(server.lifecycleAlerts(db, '2026-11-12', sent, {}).map((r) => [r.name, r.kind])).toEqual([['ended', 'overdue']]);
    expect([server.REMIND_DAYS, server.ESCALATE_AFTER_DAYS, server.SHOW_BEFORE_DAYS]).toEqual([REMIND_DAYS, ESCALATE_AFTER_DAYS, SHOW_BEFORE_DAYS]);
  });

  it('the email line names the manager and is escaped', () => {
    const [line] = server.lifecycleAlerts({ employees: [person({ id: '<b>x</b>', end_date: '2026-10-30', manager_email: 'm@x.fr' })], access: [grant('a', '<b>x</b>')] }, TODAY, {}, {});
    const [title, detail] = lifecycleAlertLine(line);
    expect(title).toBe('&lt;b&gt;x&lt;/b&gt;');
    expect(detail).toBe('assignment ended 2026-10-30, 10 days ago: 1 access and 0 devices still open · manager m@x.fr — escalated to you');
  });
});

describe('exceptions and closing', () => {
  it('an exception needs a reason and an end date within a year, and counts as accounted for until then', () => {
    const a = grant('a', 'e');
    expect(() => withException(a, { reason: '', until: '2026-12-01', today: TODAY })).toThrow('reason_required');
    expect(() => withException(a, { reason: 'handover', until: '2026-11-01', today: TODAY })).toThrow('until_required');
    expect(() => withException(a, { reason: 'handover', until: '2028-01-01', today: TODAY })).toThrow('until_too_far');
    const kept = withException(a, { reason: 'handover', until: '2026-11-20', by: 'boss@x.fr', today: TODAY });
    expect(exceptionActive(kept, TODAY)).toBe(true);
    expect(exceptionActive(kept, '2026-11-21')).toBe(false); // it ends: open again
    expect(withoutException(kept)).toEqual(a);
  });

  it('a leaver kept under an exception is not "former employee" risk until it ends', () => {
    const emp = { e: { id: 'e', status: 'active', end_date: '2026-11-01' } };
    const until = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    expect(computeAccessDerivedRiskFlag(grant('a', 'e'), emp, {})).toBe('former_employee');
    expect(computeAccessDerivedRiskFlag(grant('a', 'e', { exception: { reason: 'r', until } }), emp, {})).toBe('none');
    expect(computeAccessDerivedRiskFlag(grant('a', 'e', { exception: { reason: 'r', until: '2020-01-01' } }), emp, {})).toBe('former_employee');
  });

  it('closing is refused before the end, and while anything is open', () => {
    const emp = person({ id: 'e', end_date: '2026-11-01' });
    const db = { employees: [emp], access: [grant('a', 'e')], assets: [device('d', 'e')] };
    expect(() => closeAssignment(emp, db, { today: TODAY })).toThrow('items_open');
    const accounted = {
      ...db,
      access: [withException(db.access[0], { reason: 'handover', until: '2026-11-20', today: TODAY })],
      assets: [{ ...db.assets[0], status: 'in_stock', assigned_to: '' }],
    };
    expect(closeAssignment(emp, accounted, { by: 'boss@x.fr', today: TODAY }).assignment_closed).toMatchObject({ by: 'boss@x.fr', excepted: 1 });
    const future = person({ id: 'f', end_date: '2026-12-01' });
    expect(() => closeAssignment(future, { employees: [future] }, { today: TODAY })).toThrow('not_ended');
  });
});

describe('temporary access and files', () => {
  it('lists temporary access ending within a week or past its date, unless excepted', () => {
    const db = {
      employees: [person({ id: 'e' })],
      access: [
        grant('past', 'e', { expires_on: '2026-11-07' }), grant('soon', 'e', { expires_on: '2026-11-12' }),
        grant('later', 'e', { expires_on: '2026-12-30' }), grant('gone', 'e', { expires_on: '2026-11-01', status: 'revoked' }),
        grant('kept', 'e', { expires_on: '2026-11-01', exception: { reason: 'r', until: '2026-11-30' } }),
      ],
    };
    expect(expiringAccess(db, TODAY).map((x) => [x.id, x.days])).toEqual([['past', -2], ['soon', 3]]);
    expect(server.lifecycleAlerts(db, TODAY, {}, {}).map((r) => [r.kind, r.tool])).toEqual([['expired', 'past']]);
  });

  it('a people file in French brings the contract type and the manager', () => {
    expect(mapHeaders('Nom;E-mail;Type de contrat;Manager;Date de sortie', 'employees').line).toBe('full_name;email;worker_type;manager_email;end_date');
    expect(csvPersonExtras({ worker_type: 'Prestataire', manager_email: 'Boss@X.fr' })).toEqual({ worker_type: 'contractor', manager_email: 'boss@x.fr' });
    expect(csvPersonExtras({ worker_type: 'Stagiaire' })).toEqual({ worker_type: 'intern' });
    expect(csvPersonExtras({ worker_type: 'CDD' })).toEqual({ worker_type: 'temporary' });
    expect(csvPersonExtras({ worker_type: 'something', manager_email: 'not an email' })).toEqual({});
  });
});

describe('the demo production team can finish its assignments', () => {
  it('shows each stage, and Zoé’s internship closes with every item accounted for', () => {
    const db = buildSeedDb();
    const by = Object.fromEntries(assignments(db).map((a) => [a.name, a]));
    expect(by['Inès Garnier']).toMatchObject({ stage: 'remind', manager: 'emma.girard@acme.com', worker_type: 'contractor' });
    expect(by['Malik Haddad']).toMatchObject({ stage: 'overdue', escalated: true, open: 2 });
    expect(by['Zoé Lambert']).toMatchObject({ stage: 'ready_to_close', open: 0 });
    expect(by['Zoé Lambert'].access.map((i) => i.state)).toEqual(['excepted']);
    expect(expiringAccess(db).map((x) => [x.person, x.tool, x.days < 0])).toEqual(expect.arrayContaining([['Thomas Leroy', 'Datadog', true]]));
    const zoe = db.employees.find((e) => e.full_name === 'Zoé Lambert');
    expect(closeAssignment(zoe, db, { by: 'emma.girard@acme.com' }).assignment_closed.excepted).toBe(1);
  });
});
