import { differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';
import { Boxes, UserMinus, GitMerge, Download } from 'lucide-react';
import { safeParseISO } from './db';

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

export function buildRiskAlerts(db) {
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
    title: 'Tools without owners detected',
    body: `${orphanedTools.length} tool(s) have no owner assigned.`,
    action: { label: 'Review Tools', to: '/tools', icon: Boxes },
  });

  if (formerEmployeeAccess.length) alerts.push({
    id: 'former_employee_access', severity: 'critical',
    title: 'Former employees still have access',
    body: `${formerEmployeeAccess.length} active access record(s) belong to offboarded employees.`,
    action: { label: 'Offboarding', to: '/offboarding', icon: UserMinus },
  });

  if (adminOverdueReview.length) alerts.push({
    id: 'admin_overdue_review', severity: 'high',
    title: 'Admin access overdue for review',
    body: `${adminOverdueReview.length} admin access record(s) have not been reviewed in 6+ months.`,
    action: { label: 'Access Map', to: '/access', icon: GitMerge },
  });

  if (toolsUnused90.length) alerts.push({
    id: 'tools_unused_90', severity: 'high',
    title: 'Tools unused for 90+ days',
    body: `${toolsUnused90.length} tool(s) have not been used in 90+ days.`,
    action: { label: 'Audit Export', to: '/audit', icon: Download },
  });

  if (needsReview.length) alerts.push({
    id: 'needs_review', severity: 'medium',
    title: 'Access records need review',
    body: `${needsReview.length} access record(s) are due for annual review.`,
    action: { label: 'Review Access', to: '/access', icon: GitMerge },
  });

  const spend = db.tools.reduce((sum, t) => sum + Number(t.cost_per_month || 0), 0);
  if (spend > 1000) alerts.push({
    id: 'spend_watch', severity: 'medium',
    title: 'Monthly spend exceeds threshold',
    body: `Current tool spend is ${getCurrency(localStorage.getItem('language') || 'en')}${Math.round(spend)} / month.`,
    action: { label: 'Tools', to: '/tools', icon: Boxes },
  });

  return alerts.slice(0, 7);
}

export function riskSeverityCounts(alerts) {
  const counts = { critical: 0, high: 0, medium: 0 };
  for (const a of alerts) counts[a.severity] = (counts[a.severity] || 0) + 1;
  return counts;
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

export function getCurrency(lang) {
  try {
    const activeLang = lang || localStorage.getItem('language') || 'en';
    const settings = JSON.parse(localStorage.getItem('sg_general') || '{}');
    if (settings.currency) {
      if (settings.currency.includes('£')) return '£';
      if (settings.currency.includes('€')) return '€';
      if (settings.currency.includes('¥')) return '¥';
      if (settings.currency.includes('$')) return '$';
    }
    if (activeLang === 'fr' || activeLang === 'es') return '€';
    return '$';
  } catch { return '$'; }
}

export function convertCurrency(amountUSD, lang) {
  try {
    const cached   = JSON.parse(localStorage.getItem('accessguard_fx_rates') || '{}');
    const rates    = cached.rates || { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5 };
    const activeLang = lang || localStorage.getItem('language') || 'en';
    const settings = JSON.parse(localStorage.getItem('sg_general') || '{}');
    let code = 'USD';
    if (settings.currency?.includes('£'))      code = 'GBP';
    else if (settings.currency?.includes('€')) code = 'EUR';
    else if (settings.currency?.includes('¥')) code = 'JPY';
    else if (activeLang === 'fr' || activeLang === 'es') code = 'EUR';
    return Math.round(amountUSD * (rates[code] || 1));
  } catch { return Math.round(amountUSD); }
}

export function formatMoney(n, currency, lang) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return (currency || getCurrency(lang)) + '0';
  return (currency || getCurrency(lang)) + convertCurrency(v, lang).toLocaleString();
}

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
