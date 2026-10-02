// ── From the free audit to a workspace, without retyping anything ──────────
//
// The audit page reads a statement in the browser and keeps nothing
// (accountant-channel.test.js). When the reader clicks "create my workspace
// with these subscriptions", the reviewed list is kept here, in this browser,
// for a short while, so the app can offer to import it once they are signed
// in. It reaches Stacklens only if they confirm that import.
//
// What is kept is the summary a person would type by hand: vendor, category,
// frequency, amount per month, date of the last charge, number of charges,
// and whether they reviewed the line. Never a bank label, a transaction, a
// line that is not software, or anything about the client they audited.

import { CATEGORIES } from './constants';

export const HANDOFF_KEY = 'stacklens_audit_handoff';
export const HANDOFF_TTL_HOURS = 2;
const TTL_MS = HANDOFF_TTL_HOURS * 3_600_000;
// The card on the audit page counts with this too, so it never offers more
// lines than the click keeps.
export const HANDOFF_MAX_LINES = 200;

const isoDay = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '');
const REVIEWED = ['confirmed', 'renamed', 'added'];

/** The list to hand over: active subscriptions only, summary fields only. */
export function handoffFromReport(report, now = new Date()) {
  const subscriptions = (report?.subscriptions || []).slice(0, HANDOFF_MAX_LINES).map((s) => ({
    vendor: String(s.vendor || '').slice(0, 120),
    category: String(s.category || '').slice(0, 60),
    cadence: String(s.cadence || ''),
    monthly: Math.round((Number(s.monthlyEquivalent) || 0) * 100) / 100,
    last: isoDay(s.last),
    charges: Number(s.charges) || 0,
    reviewed: REVIEWED.includes(s.reviewed),
  })).filter((s) => s.vendor);
  return { v: 1, created_at: now.toISOString(), subscriptions };
}

export function saveHandoff(report, now = new Date()) {
  const payload = handoffFromReport(report, now);
  try {
    localStorage.setItem(HANDOFF_KEY, JSON.stringify(payload));
  } catch { /* storage blocked: the app simply will not offer the import */ }
  return payload.subscriptions.length;
}

export function clearHandoff() {
  try { localStorage.removeItem(HANDOFF_KEY); } catch { /* nothing to clear */ }
}

/** The pending list, or null. An expired or unreadable one is deleted. */
export function loadHandoff(now = new Date()) {
  let raw;
  try { raw = localStorage.getItem(HANDOFF_KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const h = JSON.parse(raw);
    const age = now - new Date(h.created_at);
    if (h?.v === 1 && Array.isArray(h.subscriptions) && h.subscriptions.length && age >= 0 && age <= TTL_MS) return h;
  } catch { /* fall through: unreadable */ }
  clearHandoff();
  return null;
}

// The audit names categories its own way ("CRM", "Identity"); the app has a
// fixed list. Anything without an obvious home goes to "other".
const CATEGORY_MAP = {
  crm: 'sales', sales: 'sales', marketing: 'marketing', website: 'marketing',
  finance: 'finance', hr: 'hr', security: 'security', identity: 'security',
  design: 'design', communication: 'communication', support: 'operations',
  automation: 'operations', productivity: 'operations', storage: 'operations',
  'e-signature': 'operations', scheduling: 'operations', media: 'design',
  development: 'engineering', engineering: 'engineering', hosting: 'engineering',
};
export function appCategory(auditCategory) {
  const c = String(auditCategory || '').toLowerCase().trim();
  if (CATEGORIES.includes(c)) return c;
  return CATEGORY_MAP[c] || 'other';
}

const nameKey = (s) => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');

/**
 * What importing the list into `db` would do: the tools to create, and the
 * vendors left out because the workspace already has them or someone there
 * said they are not software.
 */
export function planHandoffImport(handoff, db) {
  const have = new Set((db?.tools || []).map((t) => nameKey(t.name)));
  const rejected = new Set(db?.rejected_vendors || []);
  const toAdd = []; const existing = []; const skipped = [];
  // One vendor reached through two bank lines (two workspaces, two cards)
  // is one tool costing both: the lines are merged, their amounts added.
  const merged = new Map();
  for (const s of handoff?.subscriptions || []) {
    const k = nameKey(s.vendor);
    if (!k) continue;
    const prev = merged.get(k);
    if (!prev) { merged.set(k, { ...s }); continue; }
    prev.monthly = Math.round((prev.monthly + s.monthly) * 100) / 100;
    prev.charges += s.charges;
    if (s.last > prev.last) prev.last = s.last;
    prev.reviewed = prev.reviewed && s.reviewed;
    prev.lines = (prev.lines || 1) + 1;
  }
  for (const [k, s] of merged) {
    if (rejected.has(k)) { skipped.push(s.vendor); continue; }
    if (have.has(k)) { existing.push(s.vendor); continue; }
    const renewal = s.cadence === 'annual' && s.last
      ? new Date(Date.parse(s.last) + 365 * 86_400_000).toISOString().slice(0, 10) : '';
    toAdd.push({
      name: s.vendor,
      category: appCategory(s.category),
      cost_per_month: s.monthly,
      renewal_date: renewal,
      notes: `From the free audit: ${s.cadence || 'recurring'}, ${s.charges} charge(s), last on ${s.last || 'unknown'}`
        + (s.lines ? `; paid through ${s.lines} separate bank lines` : ''),
      origin: 'audit',
      // Lines the reader confirmed in the audit are not asked about again.
      ...(s.reviewed ? { reviewed: 'confirmed' } : {}),
    });
  }
  return { toAdd, existing, skipped };
}
