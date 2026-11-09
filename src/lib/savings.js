// ── Savings a finance lead can defend ──────────────────────────────────────
//
// The one savings figure (computeWaste().recoverable in lib/waste.js) is the
// monthly cost of tools nobody holds active access to. That is a suspicion,
// not money saved, and the review asked for three things it did not say:
//
//   1. What stage each saving is at:
//        suspected  the rule found it (no active access)
//        approved   someone decided it goes, recorded with who and when, and
//                   whether that person is the tool's owner
//        rejected   someone said it is not a saving, with the reason; it
//                   leaves every savings figure (lib/waste.js honours it)
//        realised   the subscription was cancelled: who, when, and the
//                   evidence (a cancellation confirmation)
//   2. When the money actually stops. A yearly contract cancelled today still
//      bills until its renewal date, and a notice period already missed pushes
//      that to the next renewal (lib/renewalNotice.js). `next12` is what
//      stopping saves over the next twelve months, not the annual price.
//   3. What the suspicion rests on. "No active access" means something only if
//      access was recorded for the tool at all: a tool with no access rows of
//      any kind is `no_access_recorded`, said apart and never presented as
//      proven.
//
// A realised saving is checked against the invoices Stacklens holds
// (db.invoice_records): `contradicted` when the vendor billed after the stop
// date, `confirmed` when a full billing period has passed with no invoice and
// earlier invoices exist to compare with, `awaiting` until then, `no_billing`
// when no invoice from that vendor was ever imported. Nothing here contacts a
// vendor or cancels anything.

import { enrichToolCosts } from './waste';
import { vendorMatchesTool } from './invoiceCheck';
import { addDays, noticeDays, procurementLead, todayISOUtc } from './renewalNotice';
import { csvText } from './csvSafe';

export const SAVING_STAGES = ['suspected', 'approved', 'rejected', 'realised'];
export const MIN_REASON = 3;
const PERIOD_DAYS = { monthly: 31, quarterly: 92, yearly: 366 };
const GRACE_DAYS = 7;
const DAY_MS = 86400000;

const iso = (at) => (at instanceof Date ? at : new Date(at || Date.now())).toISOString();
const clean = (s, n = 300) => String(s ?? '').trim().slice(0, n);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').slice(0, 10));
const sameEmail = (a, b) => !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

export const savingOf = (tool) => (tool?.saving && SAVING_STAGES.includes(tool.saving.stage) ? tool.saving : null);

function needReason(text) {
  const r = clean(text, 500);
  if (r.length < MIN_REASON) throw new Error('reason_required');
  return r;
}

/** Someone decided this saving goes ahead. */
export function approveSaving(tool, { by = '', at, note = '' } = {}) {
  return { ...tool, saving: { stage: 'approved', by, at: iso(at), note: clean(note), by_owner: sameEmail(by, tool.owner_email) } };
}

/** Not a saving, and why (used through SSO, access not tracked, needed for audits…). */
export function rejectSaving(tool, { by = '', at, note = '' } = {}) {
  return { ...tool, saving: { stage: 'rejected', by, at: iso(at), note: needReason(note), by_owner: sameEmail(by, tool.owner_email) } };
}

/** Back to what the rule says. A realised saving is not undone here: the tool is cancelled. */
export function reopenSaving(tool) {
  if (savingOf(tool)?.stage === 'realised') throw new Error('realised');
  const { saving: _gone, ...rest } = tool;
  return rest;
}

/**
 * The subscription was cancelled. Evidence is required (the vendor's
 * confirmation, a ticket). `stops_on` is the last day billed, from the
 * contract when not given. The tool is marked decommissioned, which takes it
 * out of spend everywhere (lib/waste.js).
 */
export function realiseSaving(tool, { by = '', at, evidence = '', stops_on = '', today = todayISOUtc() } = {}) {
  const prev = savingOf(tool);
  const stop = isDate(stops_on) ? String(stops_on).slice(0, 10) : commitmentOf(tool, today).stops_on;
  return {
    ...tool,
    status: 'decommissioned',
    saving: {
      ...(prev && prev.stage === 'approved' ? { approved: { by: prev.by, at: prev.at, by_owner: prev.by_owner, note: prev.note } } : {}),
      stage: 'realised', by, at: iso(at), evidence: needReason(evidence), stops_on: stop,
      monthly: Number(tool.cost_per_month) || 0, billing_cycle: tool.billing_cycle || 'monthly',
    },
  };
}

/**
 * When the billing stops if the tool is cancelled today, and what that saves
 * over the next twelve months. Monthly: after the notice period. Quarterly or
 * yearly with a renewal date: at the renewal, or the one after when the last
 * day to cancel (notice and purchasing's delay) has passed. Yearly with no
 * renewal date: unknown, said so.
 */
export function commitmentOf(tool, today = todayISOUtc()) {
  const monthly = Number(tool?.cost_per_month) || 0;
  const cycle = tool?.billing_cycle || 'monthly';
  const notice = noticeDays(tool) || 0;
  const renewal = isDate(tool?.renewal_date) ? String(tool.renewal_date).slice(0, 10) : null;
  let stops_on; let basis;
  if (cycle === 'monthly') {
    stops_on = addDays(today, notice);
    basis = notice ? 'notice' : 'monthly';
    if (renewal && renewal >= today && tool.auto_renew === false) { stops_on = renewal < stops_on ? renewal : stops_on; basis = 'ends'; }
  } else if (renewal && renewal >= today) {
    const lastDay = addDays(renewal, -(notice + procurementLead(tool)));
    if (tool.auto_renew === false || lastDay >= today) { stops_on = renewal; basis = 'renewal'; } else { stops_on = addDays(renewal, cycle === 'yearly' ? 365 : 91); basis = 'next_renewal'; }
  } else {
    return { stops_on: null, basis: 'unknown', committed_months: null, next12: null, monthly };
  }
  const committed_months = Math.max(0, Math.min(12, daysBetween(today, stops_on) / 30.4375));
  return { stops_on, basis, committed_months: Math.round(committed_months * 10) / 10, next12: Math.round(monthly * (12 - committed_months)), monthly };
}

/** Invoices from this tool's vendor, oldest first. */
function invoicesFor(db, tool) {
  return (Array.isArray(db?.invoice_records) ? db.invoice_records : [])
    .filter((r) => r && r.vendor && Number(r.amount) > 0 && vendorMatchesTool(r.vendor, tool.name))
    .map((r) => ({ ...r, _day: String(r.invoice_date || r.period_start || '').slice(0, 10) }))
    .filter((r) => isDate(r._day))
    .sort((a, b) => a._day.localeCompare(b._day));
}

/** Does the billing agree that a realised saving stopped? */
export function billingCheck(db, tool, today = todayISOUtc()) {
  const s = savingOf(tool);
  if (!s || s.stage !== 'realised' || !s.stops_on) return null;
  const invoices = invoicesFor(db, tool);
  if (!invoices.length) return { state: 'no_billing', last_invoice: null };
  const after = invoices.filter((r) => !r.cleared && r._day > addDays(s.stops_on, GRACE_DAYS));
  const last = invoices[invoices.length - 1];
  if (after.length) return { state: 'contradicted', last_invoice: after[after.length - 1]._day, invoice_id: after[after.length - 1].id };
  const before = invoices.filter((r) => r._day <= addDays(s.stops_on, GRACE_DAYS));
  const quietUntil = addDays(s.stops_on, (PERIOD_DAYS[s.billing_cycle] || 31) + GRACE_DAYS);
  if (before.length && today >= quietUntil) return { state: 'confirmed', last_invoice: last._day, since: quietUntil };
  return { state: 'awaiting', last_invoice: last._day, until: quietUntil };
}

/**
 * Every saving in the workspace with its stage, commitment and evidence.
 * Suspected and approved come from billed tools; realised from cancelled ones.
 */
export function savingsLedger(db, { today = todayISOUtc() } = {}) {
  const rowsByTool = new Map();
  for (const a of Array.isArray(db?.access) ? db.access : []) {
    if (!a?.tool_id) continue;
    const c = rowsByTool.get(a.tool_id) || { total: 0, active: 0, removed: 0 };
    c.total += 1;
    if (a.status === 'active' || a.status === 'pending_revocation') c.active += 1; else c.removed += 1;
    rowsByTool.set(a.tool_id, c);
  }
  const items = [];
  for (const tool of enrichToolCosts(db)) {
    const s = savingOf(tool);
    if (tool.wasteReason !== 'no-users' && !(s && s.stage === 'rejected' && tool.cost > 0 && tool.activeUsers === 0)) continue;
    const rows = rowsByTool.get(tool.id) || { total: 0, active: 0, removed: 0 };
    items.push({
      id: tool.id, name: tool.name, owner: tool.owner_email || '', monthly: tool.cost,
      stage: s?.stage || 'suspected', decision: s,
      access: rows.total === 0 ? 'no_access_recorded' : 'no_active_access',
      access_rows: rows,
      last_used: tool.last_used_date || null, usage_source: tool.usage_source || null,
      commitment: commitmentOf(tool, today),
    });
  }
  for (const tool of Array.isArray(db?.tools) ? db.tools : []) {
    const s = savingOf(tool);
    if (!tool || s?.stage !== 'realised') continue;
    items.push({
      id: tool.id, name: tool.name, owner: tool.owner_email || '', monthly: Number(s.monthly) || 0,
      stage: 'realised', decision: s, billing: billingCheck(db, tool, today),
    });
  }
  return items.sort((a, b) => b.monthly - a.monthly);
}

/** The figures, each with the count behind it. */
export function savingsSummary(db, opts) {
  const items = savingsLedger(db, opts);
  const sum = (list) => ({ count: list.length, monthly: list.reduce((s, i) => s + i.monthly, 0), annual: list.reduce((s, i) => s + i.monthly * 12, 0) });
  const open = items.filter((i) => i.stage === 'suspected' || i.stage === 'approved');
  const realised = items.filter((i) => i.stage === 'realised');
  return {
    items,
    suspected: sum(items.filter((i) => i.stage === 'suspected')),
    approved: sum(items.filter((i) => i.stage === 'approved')),
    rejected: sum(items.filter((i) => i.stage === 'rejected')),
    unrecordedAccess: sum(open.filter((i) => i.access === 'no_access_recorded')),
    next12: open.reduce((s, i) => s + (i.commitment.next12 ?? i.monthly * 12), 0),
    commitmentUnknown: open.filter((i) => i.commitment.basis === 'unknown').length,
    realised: sum(realised),
    confirmed: sum(realised.filter((i) => i.billing?.state === 'confirmed')),
    contradicted: sum(realised.filter((i) => i.billing?.state === 'contradicted')),
  };
}

export const SAVINGS_CSV_COLUMNS = [
  'tool', 'stage', 'monthly', 'annual', 'access_evidence', 'access_rows', 'removed_rows', 'last_used', 'usage_source',
  'stops_on', 'stop_basis', 'saving_next_12_months',
  'decided_by', 'decided_at', 'decided_by_owner', 'note', 'cancellation_evidence', 'billing_check', 'last_invoice',
];

/** The ledger as a spreadsheet: every figure with what it rests on. */
export function savingsCsv(db, { sep = ',', decimal = '.', today } = {}) {
  const esc = (v) => {
    const s = typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', decimal) : csvText(v ?? '');
    return s.includes('"') || s.includes('\n') || s.includes(sep) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const rows = savingsLedger(db, { today }).map((i) => [
    i.name, i.stage, i.monthly, i.monthly * 12, i.access || '', i.access_rows?.total ?? '', i.access_rows?.removed ?? '',
    i.last_used || '', i.usage_source || '',
    i.commitment?.stops_on || i.decision?.stops_on || '', i.commitment?.basis || '', i.commitment ? (i.commitment.next12 ?? '') : '',
    i.decision?.by || '', i.decision?.at || '', i.decision ? (i.decision.by_owner ? 'yes' : 'no') : '', i.decision?.note || '',
    i.decision?.evidence || '', i.billing?.state || '', i.billing?.last_invoice || '',
  ].map(esc).join(sep));
  return [SAVINGS_CSV_COLUMNS.join(sep), ...rows].join('\n') + '\n';
}
