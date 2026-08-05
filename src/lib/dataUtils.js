import { differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';
import { Boxes, UserMinus, GitMerge, Download } from 'lucide-react';
import { safeParseISO } from './db';
import { getCurrency } from './currency';

// ── Tool/access derived-state computations ─────────────────────────────────

export function computeToolDerivedStatus(tool) {
  if (tool.status === 'decommissioned') return 'decommissioned';
  if (!tool.owner_email) return 'orphaned';
  const lastUsed = safeParseISO(tool.last_used_date);
  if (lastUsed && differenceInDays(new Date(), lastUsed) >= 90) return 'unused';
  return 'active';
}

export function computeToolDerivedRisk(tool) {
  const status = computeToolDerivedStatus(tool);
  if (status === 'orphaned') return 'high';
  if (status === 'unused') return 'high';
  if (tool.criticality === 'high' && status === 'active') return 'medium';
  return tool.risk_score || 'low';
}

export function getRiskEvidence(tool) {
  const reasons = [];
  const status = computeToolDerivedStatus(tool);
  if (status === 'orphaned') reasons.push({ key: 'evidence_orphaned', fallback: 'No owner assigned — no one is responsible for this tool' });
  if (status === 'unused')   reasons.push({ key: 'evidence_unused',   fallback: 'Marked as unused — may be wasting spend' });
  if (!tool.owner_email)     reasons.push({ key: 'evidence_no_owner', fallback: 'No owner assigned' });
  if (!tool.mfa_required && !tool.mfa_enabled) reasons.push({ key: 'evidence_no_mfa', fallback: 'MFA not enabled' });
  if (tool.last_used_date) {
    const days = Math.floor((Date.now() - new Date(tool.last_used_date).getTime()) / (1000 * 60 * 60 * 24));
    if (days > 90)      reasons.push({ key: 'evidence_not_used_days',  fallback: `Not used in ${days} days`, days });
    else if (days > 60) reasons.push({ key: 'evidence_last_used_days', fallback: `Last used ${days} days ago`, days });
  } else {
    reasons.push({ key: 'evidence_no_usage_data', fallback: 'No usage data available' });
  }
  if (tool.cost_per_month > 100) reasons.push({ key: 'evidence_high_cost',         fallback: `High cost: €${tool.cost_per_month}/mo` });
  if (tool.criticality === 'high') reasons.push({ key: 'evidence_business_critical', fallback: 'Tagged as business-critical' });
  return reasons;
}

export function computeAccessDerivedRiskFlag(accessRow, employeesById, toolsById) {
  const emp  = employeesById[accessRow.employee_id];
  const tool = toolsById[accessRow.tool_id];
  const toolStatus  = tool ? computeToolDerivedStatus(tool) : 'active';
  const ownerMissing = tool ? !tool.owner_email : false;

  if (accessRow.status !== 'active') return 'none';
  if (emp?.status === 'offboarded')  return 'former_employee';
  if (emp?.status === 'offboarding') return 'needs_review';
  if (ownerMissing)                  return 'orphaned';
  if (toolStatus === 'unused')       return 'unused';

  const lastReviewed = safeParseISO(accessRow.last_reviewed_date);
  if (accessRow.access_level === 'admin') {
    if (!lastReviewed) return 'needs_review';
    return differenceInDays(new Date(), lastReviewed) >= 180 ? 'needs_review' : 'excessive_admin';
  }
  if (lastReviewed && differenceInDays(new Date(), lastReviewed) >= 365) return 'needs_review';
  return 'none';
}

export function buildRiskAlerts(db, t) {
  // `t` is optional: when the caller passes the translation fn, alert text is
  // localized; without it (tests, non-UI callers) we fall back to English.
  const tr = (key, fallback) => (t ? t(key) : fallback);
  const employeesById = Object.fromEntries(db.employees.map((e) => [e.id, e]));

  const orphanedTools        = db.tools.filter((t) => !t.owner_email);
  const formerEmployeeAccess = db.access.filter((a) => {
    const e = employeesById[a.employee_id];
    return a.status === 'active' && e?.status === 'offboarded';
  });
  const adminOverdueReview = db.access.filter((a) => {
    if (a.status !== 'active' || a.access_level !== 'admin') return false;
    const lastReviewed = safeParseISO(a.last_reviewed_date);
    return !lastReviewed || differenceInDays(new Date(), lastReviewed) >= 180;
  });
  const toolsUnused90 = db.tools.filter((t) => {
    const d = safeParseISO(t.last_used_date);
    return d && differenceInDays(new Date(), d) >= 90;
  });
  const needsReview = db.access.filter((a) => {
    if (a.status !== 'active') return false;
    const lastReviewed = safeParseISO(a.last_reviewed_date);
    return !lastReviewed || differenceInDays(new Date(), lastReviewed) >= 365;
  });

  const alerts = [];

  if (orphanedTools.length) alerts.push({
    id: 'orphaned_tools', severity: 'critical',
    title: tr('alert_orphaned_title', 'Tools without owners detected'),
    body: tr('alert_orphaned_body', '{n} tool(s) have no owner assigned.').replace('{n}', orphanedTools.length),
    action: { label: tr('alert_orphaned_action', 'Review Tools'), to: '/tools', icon: Boxes },
  });

  if (formerEmployeeAccess.length) alerts.push({
    id: 'former_employee_access', severity: 'critical',
    title: tr('alert_former_title', 'Former employees still have access'),
    body: tr('alert_former_body', '{n} active access record(s) belong to offboarded employees.').replace('{n}', formerEmployeeAccess.length),
    action: { label: tr('alert_former_action', 'Offboarding'), to: '/offboarding', icon: UserMinus },
  });

  if (adminOverdueReview.length) alerts.push({
    id: 'admin_overdue_review', severity: 'high',
    title: tr('alert_admin_title', 'Admin access overdue for review'),
    body: tr('alert_admin_body', '{n} admin access record(s) have not been reviewed in 6+ months.').replace('{n}', adminOverdueReview.length),
    action: { label: tr('alert_admin_action', 'Access Map'), to: '/access', icon: GitMerge },
  });

  if (toolsUnused90.length) alerts.push({
    id: 'tools_unused_90', severity: 'high',
    title: tr('alert_unused_title', 'Tools unused for 90+ days'),
    body: tr('alert_unused_body', '{n} tool(s) have not been used in 90+ days.').replace('{n}', toolsUnused90.length),
    action: { label: tr('alert_unused_action', 'Audit Export'), to: '/audit', icon: Download },
  });

  if (needsReview.length) alerts.push({
    id: 'needs_review', severity: 'medium',
    title: tr('alert_review_title', 'Access records need review'),
    body: tr('alert_review_body', '{n} access record(s) are due for annual review.').replace('{n}', needsReview.length),
    action: { label: tr('alert_review_action', 'Review Access'), to: '/access', icon: GitMerge },
  });

  const spend = db.tools.reduce((sum, t) => sum + Number(t.cost_per_month || 0), 0);
  if (spend > 1000) alerts.push({
    id: 'spend_watch', severity: 'medium',
    title: tr('alert_spend_title', 'Monthly spend exceeds threshold'),
    body: tr('alert_spend_body', 'Current tool spend is {amount} / month.')
      .replace('{amount}', `${getCurrency(localStorage.getItem('language') || 'en')}${Math.round(spend)}`),
    action: { label: tr('alert_spend_action', 'Tools'), to: '/tools', icon: Boxes },
  });

  return alerts.slice(0, 7);
}

export function riskSeverityCounts(alerts) {
  const counts = { critical: 0, high: 0, medium: 0 };
  for (const a of alerts) counts[a.severity] = (counts[a.severity] || 0) + 1;
  return counts;
}

// ── Security posture metrics ────────────────────────────────────────────────
// Single source of truth. The Dashboard and the Security page each used to
// compute these independently and disagreed with each other on live data —
// two different security scores, two different orphaned counts, and an "MFA
// coverage" figure derived from ownership rather than from the MFA fields.

/** Tools with nobody accountable for them, whatever their lifecycle status. */
export function countOrphanedTools(tools = []) {
  return tools.filter(t => !t.owner_email).length;
}

/**
 * Real MFA coverage, read from the MFA fields.
 * Returns null when there are no tools, so callers can render "—" rather
 * than an unearned 100%.
 */
export function computeMfaCoverage(tools = []) {
  if (!tools.length) return null;
  const secured = tools.filter(t => t.mfa_required || t.mfa_enabled).length;
  return { percent: Math.round((secured / tools.length) * 100), secured, total: tools.length };
}

/**
 * Access records still active for people who have actually left.
 * "offboarding" means still employed and mid-transition — that is a different
 * (lesser) risk and must not be counted here.
 */
export function countFormerEmployeeAccess(access = [], employees = []) {
  const byId = Object.fromEntries(employees.map(e => [e.id, e]));
  return access.filter(a => a.status === 'active' && byId[a.employee_id]?.status === 'offboarded').length;
}

/** Overall posture score, 0-100. */
export function computeSecurityScore({ orphanedTools = 0, highRiskTools = 0, formerAccess = 0 } = {}) {
  return Math.max(0, Math.min(100, 100 - orphanedTools * 10 - highRiskTools * 5 - formerAccess * 8));
}

// ── Validation ─────────────────────────────────────────────────────────────

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateRequired(value, fieldName) {
  if (!value || !String(value).trim()) {
    toast.error(`${fieldName} is required`);
    return false;
  }
  return true;
}

// ── Currency helpers ────────────────────────────────────────────────────────

// Money formatting lives in lib/currency.js — these are re-exported so the
// many modules importing them from here keep working. They used to be a second
// implementation that had drifted: a Spanish user saw "$" on pages importing
// lib/currency and "€" on pages importing this one, for the same data.
export { getCurrency, convertCurrency, formatMoney } from './currency';


// ── File/CSV helpers ────────────────────────────────────────────────────────

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function toCsv(rows, columns) {
  const esc = (v) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  const header = columns.map(esc).join(',');
  const body   = rows.map((r) => columns.map((c) => esc(r[c])).join(',')).join('\n');
  return `${header}\n${body}\n`;
}

export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = splitCsvLine(line);
    const obj  = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = vals[i] ?? '';
    return obj;
  });
}

export function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = !inQ; }
      continue;
    }
    if (ch === ',' && !inQ) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}
