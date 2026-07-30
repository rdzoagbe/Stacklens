import React, { useMemo } from 'react';
import toast from 'react-hot-toast';
import { Download, FileText, Users } from 'lucide-react';
import { todayISO } from '../lib/db';
import { computeToolDerivedStatus, computeToolDerivedRisk, computeAccessDerivedRiskFlag, formatMoney, downloadText, toCsv } from '../lib/dataUtils';
import { cx } from '../lib/utils';
import { useDbQuery } from '../hooks/useDbQuery';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Button, Card, CardBody, CardHeader, EmptyState, SkeletonRow } from '../components/ui';
import { PlanGate } from '../components/gates';
import { AppShell } from '../components/AppShell';

const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function generateAuditReportHTML(derived, language, _t) {
  const fm = (n) => formatMoney(n, null, language);
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const hScore = derived.healthScore;
  const hColor = hScore >= 80 ? '#10b981' : hScore >= 60 ? '#f59e0b' : '#ef4444';
  const hLabel = hScore >= 80 ? 'Healthy' : hScore >= 60 ? 'Needs Attention' : 'At Risk';
  const wastedSpend = Math.round(derived.spend * 0.14);
  const annualSavings = wastedSpend * 12;
  const topSpend = [...derived.tools].filter(t => t.cost_per_month > 0).sort((a, b) => b.cost_per_month - a.cost_per_month).slice(0, 10);
  const highRiskTools = derived.tools.filter(t => t.derived_risk === 'high');
  const unusedTools = derived.tools.filter(t => t.derived_status === 'unused' || t.derived_status === 'orphaned');
  const categorySpend = {};
  derived.tools.forEach(t => { const c = t.category || 'Other'; categorySpend[c] = (categorySpend[c] || 0) + (t.cost_per_month || 0); });
  const catRows = Object.entries(categorySpend).sort((a, b) => b[1] - a[1]);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SaaS Audit Report — Stacklens</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; background: #fff; line-height: 1.6; }
  .page { max-width: 800px; margin: 0 auto; padding: 48px 40px; }
  @media print { .page { padding: 24px; } .no-print { display: none !important; } @page { margin: 1cm; } }
  .header { border-bottom: 3px solid #3b82f6; padding-bottom: 24px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
  .brand { font-size: 28px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
  .brand span { color: #3b82f6; }
  .subtitle { color: #64748b; font-size: 13px; margin-top: 4px; }
  .date { color: #94a3b8; font-size: 12px; text-align: right; }
  h2 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 32px 0 16px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
  h3 { font-size: 14px; font-weight: 600; color: #334155; margin: 16px 0 8px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 24px 0; }
  .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: center; }
  .kpi-value { font-size: 28px; font-weight: 800; color: #0f172a; }
  .kpi-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-top: 4px; }
  .kpi-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .health-box { display: flex; align-items: center; gap: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 16px 0; }
  .health-score { width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 800; color: white; flex-shrink: 0; }
  .health-detail { flex: 1; }
  .health-label { font-size: 18px; font-weight: 700; }
  .health-desc { font-size: 13px; color: #64748b; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 12px 0; }
  th { background: #f1f5f9; text-align: left; padding: 8px 12px; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
  td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
  tr:nth-child(even) { background: #fafbfc; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
  .pill-red { background: #fef2f2; color: #dc2626; }
  .pill-amber { background: #fffbeb; color: #d97706; }
  .pill-green { background: #f0fdf4; color: #16a34a; }
  .pill-slate { background: #f1f5f9; color: #64748b; }
  .savings-box { background: linear-gradient(135deg, #eff6ff, #f0fdf4); border: 1px solid #bfdbfe; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; }
  .savings-value { font-size: 36px; font-weight: 800; color: #16a34a; }
  .savings-label { font-size: 13px; color: #64748b; margin-top: 4px; }
  .bar { height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin-top: 4px; }
  .bar-fill { height: 100%; border-radius: 4px; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 11px; }
  .actions { margin: 24px 0; text-align: center; }
  .actions button { padding: 12px 32px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; margin: 0 8px; }
  .actions button:hover { background: #2563eb; }
  .actions button.secondary { background: #64748b; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand">Stack<span>lens</span></div>
      <div class="subtitle">SaaS Audit Report</div>
    </div>
    <div class="date">Generated ${today}</div>
  </div>

  <div class="actions no-print">
    <button onclick="window.print()">Print / Save as PDF</button>
    <button class="secondary" onclick="window.close()">Close</button>
  </div>

  <h2>Executive Summary</h2>
  <div class="health-box">
    <div class="health-score" style="background:${hColor}">${hScore}</div>
    <div class="health-detail">
      <div class="health-label" style="color:${hColor}">${hLabel}</div>
      <div class="health-desc">
        Your SaaS stack has ${derived.tools.length} tools, ${derived.employees.filter(e => e.status === 'active').length} active employees,
        and ${derived.access.filter(a => a.status === 'active').length} active permissions.
        ${derived.highRiskCount > 0 ? derived.highRiskCount + ' high-risk tool' + (derived.highRiskCount > 1 ? 's' : '') + ' require attention.' : 'No high-risk tools detected.'}
        ${derived.formerEmpAccess > 0 ? derived.formerEmpAccess + ' former employee access record' + (derived.formerEmpAccess > 1 ? 's' : '') + ' need revocation.' : ''}
      </div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-value">${derived.tools.length}</div>
      <div class="kpi-label">Total Tools</div>
      <div class="kpi-sub">${derived.activeTools} active, ${derived.unusedTools} unused</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${fm(derived.spend)}</div>
      <div class="kpi-label">Monthly Spend</div>
      <div class="kpi-sub">${fm(derived.spend * 12)}/year</div>
    </div>
    <div class="kpi">
      <div class="kpi-value" style="color:${derived.highRiskCount > 0 ? '#dc2626' : '#16a34a'}">${derived.highRiskCount}</div>
      <div class="kpi-label">High Risk Tools</div>
      <div class="kpi-sub">${derived.formerEmpAccess} former employee access</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${derived.employees.length}</div>
      <div class="kpi-label">Employees</div>
      <div class="kpi-sub">${derived.employees.filter(e => e.status === 'active').length} active</div>
    </div>
  </div>

  ${wastedSpend > 0 ? `
  <div class="savings-box">
    <div class="savings-value">${fm(annualSavings)}</div>
    <div class="savings-label">Estimated annual savings opportunity (based on industry avg 14% SaaS waste)</div>
  </div>` : ''}

  <h2>Spend Breakdown by Category</h2>
  <table>
    <thead><tr><th>Category</th><th>Monthly Cost</th><th>Annual Cost</th><th>% of Total</th><th>Distribution</th></tr></thead>
    <tbody>
      ${catRows.map(([cat, cost]) => {
        const pct = derived.spend > 0 ? Math.round((cost / derived.spend) * 100) : 0;
        return `<tr>
          <td><strong>${escHtml(cat)}</strong></td>
          <td>${fm(cost)}</td>
          <td>${fm(cost * 12)}</td>
          <td>${pct}%</td>
          <td><div class="bar"><div class="bar-fill" style="width:${pct}%;background:#3b82f6"></div></div></td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>

  <h2>Top Tools by Spend</h2>
  <table>
    <thead><tr><th>Tool</th><th>Category</th><th>Owner</th><th>Monthly Cost</th><th>Status</th><th>Risk</th></tr></thead>
    <tbody>
      ${topSpend.map(t => `<tr>
        <td><strong>${escHtml(t.name)}</strong></td>
        <td>${escHtml(t.category || '—')}</td>
        <td>${escHtml(t.owner_email || 'Unassigned')}</td>
        <td>${fm(t.cost_per_month)}</td>
        <td><span class="pill ${t.derived_status === 'active' ? 'pill-green' : t.derived_status === 'unused' ? 'pill-amber' : 'pill-red'}">${escHtml(t.derived_status)}</span></td>
        <td><span class="pill ${t.derived_risk === 'high' ? 'pill-red' : t.derived_risk === 'medium' ? 'pill-amber' : 'pill-green'}">${escHtml(t.derived_risk)}</span></td>
      </tr>`).join('')}
    </tbody>
  </table>

  ${highRiskTools.length > 0 ? `
  <h2>High Risk Tools</h2>
  <table>
    <thead><tr><th>Tool</th><th>Category</th><th>Owner</th><th>Status</th><th>Last Used</th></tr></thead>
    <tbody>
      ${highRiskTools.map(t => `<tr>
        <td><strong>${escHtml(t.name)}</strong></td>
        <td>${escHtml(t.category || '—')}</td>
        <td>${t.owner_email ? escHtml(t.owner_email) : '<span class="pill pill-red">Unassigned</span>'}</td>
        <td><span class="pill pill-red">${escHtml(t.derived_status)}</span></td>
        <td>${escHtml(t.last_used_date || 'Never')}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}

  ${unusedTools.length > 0 ? `
  <h2>Unused & Orphaned Tools</h2>
  <p style="color:#64748b;font-size:13px;margin-bottom:12px">These tools are either unused (no activity in 90+ days) or orphaned (no assigned owner). Consider decommissioning to reduce spend.</p>
  <table>
    <thead><tr><th>Tool</th><th>Monthly Cost</th><th>Status</th><th>Last Used</th><th>Potential Savings</th></tr></thead>
    <tbody>
      ${unusedTools.map(t => `<tr>
        <td><strong>${escHtml(t.name)}</strong></td>
        <td>${fm(t.cost_per_month || 0)}</td>
        <td><span class="pill ${t.derived_status === 'orphaned' ? 'pill-red' : 'pill-amber'}">${escHtml(t.derived_status)}</span></td>
        <td>${escHtml(t.last_used_date || 'Never')}</td>
        <td style="color:#16a34a;font-weight:600">${fm((t.cost_per_month || 0) * 12)}/yr</td>
      </tr>`).join('')}
      <tr style="font-weight:700;border-top:2px solid #e2e8f0">
        <td>Total potential savings</td>
        <td></td><td></td><td></td>
        <td style="color:#16a34a">${fm(unusedTools.reduce((s, t) => s + (t.cost_per_month || 0), 0) * 12)}/yr</td>
      </tr>
    </tbody>
  </table>` : ''}

  ${derived.formerEmpAccess > 0 ? `
  <h2>Security: Former Employee Access</h2>
  <p style="color:#dc2626;font-size:13px;margin-bottom:12px;font-weight:600">These former employees still have active access to tools. Immediate revocation recommended.</p>
  <table>
    <thead><tr><th>Employee</th><th>Tool</th><th>Access Level</th><th>Granted</th></tr></thead>
    <tbody>
      ${derived.access.filter(a => a.derived_risk_flag === 'former_employee').map(a => `<tr>
        <td><strong>${escHtml(a.employee_name)}</strong></td>
        <td>${escHtml(a.tool_name)}</td>
        <td><span class="pill ${a.access_level === 'admin' || a.access_level === 'owner' ? 'pill-red' : 'pill-amber'}">${escHtml(a.access_level)}</span></td>
        <td>${escHtml(a.granted_date || '—')}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}

  <h2>Recommendations</h2>
  <ol style="padding-left:20px;color:#334155;font-size:14px;line-height:1.8">
    ${derived.formerEmpAccess > 0 ? `<li><strong>Revoke ${derived.formerEmpAccess} former employee access records</strong> — Critical security risk. Former employees with active permissions can access company data.</li>` : ''}
    ${highRiskTools.length > 0 ? `<li><strong>Address ${highRiskTools.length} high-risk tools</strong> — Assign owners to orphaned tools and review unused subscriptions.</li>` : ''}
    ${unusedTools.length > 0 ? `<li><strong>Decommission ${unusedTools.length} unused/orphaned tools</strong> — Potential savings of ${fm(unusedTools.reduce((s, t) => s + (t.cost_per_month || 0), 0) * 12)}/year.</li>` : ''}
    ${derived.tools.filter(t => !t.mfa_enabled && !t.mfa_required).length > 0 ? `<li><strong>Enable MFA on ${derived.tools.filter(t => !t.mfa_enabled && !t.mfa_required).length} tools</strong> — Multi-factor authentication should be required for all business-critical applications.</li>` : ''}
    <li><strong>Schedule quarterly access reviews</strong> — Regular reviews prevent permission creep and ensure least-privilege access.</li>
    <li><strong>Consolidate overlapping tools</strong> — Review tools in the same category for consolidation opportunities.</li>
  </ol>

  <div class="footer">
    <p>Generated by <strong>Stacklens</strong> — SaaS Spend & Access Management</p>
    <p>stacklens.fr · ${today}</p>
  </div>
</div>
</body>
</html>`;
}

export function AuditTabContent() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db, isLoading } = useDbQuery();

  const derived = React.useMemo(() => {
    if (!db) return null;
    const tools = db.tools.map((tool) => ({
      ...tool,
      derived_status: computeToolDerivedStatus(tool),
      derived_risk: computeToolDerivedRisk(tool),
    }));
    const employeesById = Object.fromEntries(db.employees.map((e) => [e.id, e]));
    const toolsById = Object.fromEntries(tools.map((t) => [t.id, t]));
    const access = db.access.map((a) => ({
      ...a,
      derived_risk_flag: computeAccessDerivedRiskFlag(a, employeesById, toolsById),
    }));
    const activeTools    = tools.filter(t => t.derived_status === "active").length;
    const unusedTools    = tools.filter(t => t.derived_status === "unused" || t.derived_status === "orphaned").length;
    const highRiskCount  = tools.filter(t => t.derived_risk === "high").length;
    const formerEmpAccess = access.filter(a => a.derived_risk_flag === "former_employee").length;
    const spend          = tools.reduce((s, t) => s + Number(t.cost_per_month || 0), 0);
    const toolUserCount = {};
    db.access.filter(a => a.status === "active").forEach(a => {
      toolUserCount[a.tool_name] = (toolUserCount[a.tool_name] || 0) + 1;
    });
    const topToolsByUsers = Object.entries(toolUserCount).sort((a,b) => b[1]-a[1]).slice(0,8);
    return {
      tools, access, employees: db.employees,
      activeTools, unusedTools, highRiskCount, formerEmpAccess, spend, topToolsByUsers,
      healthScore: Math.round(Math.max(0, 100 - (highRiskCount * 10) - (formerEmpAccess * 5) - (unusedTools * 3))),
    };
  }, [db]);

  const exportTools = () => {
    if (!derived) return;
    const headers = ["Name","Category","Owner","Criticality","Status","Risk","Monthly Cost","Last Used","URL"];
    const rows = derived.tools.map(t => [t.name, t.category, t.owner_email||'Unassigned', t.criticality, t.derived_status, t.derived_risk, t.cost_per_month||0, t.last_used_date||'Never', t.url||'']);
    downloadText(`stacklens_tools_${todayISO()}.csv`, toCsv(headers, rows));
    toast.success(t('aud_tools_exported'));
  };
  const exportEmployees = () => {
    if (!derived) return;
    const headers = ["Name","Email","Department","Role","Status","Start Date","End Date"];
    const rows = derived.employees.map(e => [e.full_name, e.email, e.department, e.role, e.status, e.start_date||'', e.end_date||'']);
    downloadText(`stacklens_employees_${todayISO()}.csv`, toCsv(headers, rows));
    toast.success(t('aud_emp_exported'));
  };
  const exportAccess = () => {
    if (!derived) return;
    const headers = ["Tool","Employee","Email","Access Level","Granted","Last Accessed","Last Reviewed","Status","Risk Flag"];
    const rows = derived.access.map(a => [a.tool_name, a.employee_name, a.employee_email, a.access_level, a.granted_date||'', a.last_accessed_date||'', a.last_reviewed_date||'', a.status, a.derived_risk_flag||'none']);
    downloadText(`stacklens_access_${todayISO()}.csv`, toCsv(headers, rows));
    toast.success(t('aud_access_exported'));
  };
  const exportFullPackage = () => { exportTools(); setTimeout(exportEmployees, 300); setTimeout(exportAccess, 600); };
  const generateReport = () => {
    if (!derived) return;
    const html = generateAuditReportHTML(derived, language, t);
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
    else toast.error(t('aud_popup_error'));
  };

  const healthColor = (s) => s >= 80 ? "text-emerald-400" : s >= 60 ? "text-amber-400" : "text-red-400";

  if (isLoading || !derived) return (
    <div className="flex items-center justify-center py-20 text-slate-500">{t('aud_loading')}</div>
  );

  return (
    <div className="space-y-6">

      {/* ── Row 1: Audit Summary + Export Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">

        {/* Health Score Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">{t("audit_health_score")}</div>
          <div className="flex items-center gap-5">
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="6"/>
                <circle cx="50" cy="50" r="42" fill="none"
                  stroke={derived.healthScore >= 80 ? '#10b981' : derived.healthScore >= 60 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="6"
                  strokeDasharray={`${2*Math.PI*42}`}
                  strokeDashoffset={`${2*Math.PI*42*(1-derived.healthScore/100)}`}
                  strokeLinecap="round"/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-black ${healthColor(derived.healthScore)}`}>{derived.healthScore}</span>
              </div>
            </div>
            <div>
              <div className={`text-lg font-semibold ${healthColor(derived.healthScore)}`}>
                {derived.healthScore >= 80 ? t('aud_audit_ready') : derived.healthScore >= 60 ? t('aud_needs_attention') : t('aud_at_risk')}
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {derived.healthScore >= 80
                  ? t('audit_ready_msg')
                  : derived.healthScore >= 60
                    ? t('audit_needs_msg')
                    : t('audit_risk_msg')}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('aud_tools')}</div>
            <div className="text-2xl font-black text-white">{derived.activeTools}</div>
            <div className="text-xs text-slate-500">{derived.unusedTools} {t('aud_unused')}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('aud_employees')}</div>
            <div className="text-2xl font-black text-white">{derived.employees.length}</div>
            <div className="text-xs text-slate-500">{derived.employees.filter(e => e.status === 'active').length} {t('aud_active')}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('aud_access_records')}</div>
            <div className="text-2xl font-black text-white">{derived.access.length}</div>
            <div className="text-xs text-slate-500">{derived.access.filter(a => a.status === 'active').length} {t('aud_active')}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('aud_risk_items')}</div>
            <div className="text-2xl font-black text-red-400">{derived.highRiskCount + derived.formerEmpAccess}</div>
            <div className="text-xs text-slate-500">{derived.highRiskCount} {t('aud_tools_count')}, {derived.formerEmpAccess} {t('aud_access_count')}</div>
          </div>
        </div>

        {/* Export Actions */}
        <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-900 to-blue-950/20 p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">{t("audit_export_package")}</div>
          <p className="text-sm text-slate-400 mb-5">{t("audit_package_desc")}</p>
          <button onClick={generateReport}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 rounded-xl font-bold text-sm transition-all mb-3">
            <FileText className="h-4 w-4" /> {t("generate_audit_report")}
          </button>
          <button onClick={exportFullPackage}
            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold text-sm transition-colors mb-3">
            <Download className="h-4 w-4" /> {t("audit_download_full")}
          </button>
          <div className="text-xs text-slate-600 text-center">{t("audit_three_files")}</div>
        </div>
      </div>

      {/* ── Row 2: Individual Exports with preview ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
        {[
          {
            title: t('aud_tools_inventory'),
            desc: t('aud_tools_inv_desc'),
            count: derived.tools.length,
            fn: exportTools,
            color: 'blue',
            preview: derived.tools.slice(0,3).map(t => ({ name: t.name, status: t.derived_status, risk: t.derived_risk })),
          },
          {
            title: t('aud_emp_directory'),
            desc: t('aud_emp_dir_desc'),
            count: derived.employees.length,
            fn: exportEmployees,
            color: 'emerald',
            preview: derived.employees.slice(0,3).map(e => ({ name: e.full_name, dept: e.department, status: e.status })),
          },
          {
            title: t('aud_access_records_title'),
            desc: t('aud_access_rec_desc'),
            count: derived.access.length,
            fn: exportAccess,
            color: 'purple',
            preview: derived.access.slice(0,3).map(a => ({ tool: a.tool_name, user: a.employee_name, level: a.access_level })),
          },
        ].map(item => (
          <div key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-white">{item.title}</h3>
              <span className="text-xs text-slate-500">{item.count} {t('aud_records')}</span>
            </div>
            <p className="text-sm text-slate-400 mb-4">{item.desc}</p>

            {/* Mini preview table */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 mb-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">{t('aud_preview')}</div>
              <div className="space-y-1.5">
                {item.preview.map((row, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 truncate flex-1">{row.name || row.tool || '—'}</span>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      (row.status === 'active' || row.level === 'admin') ? 'text-emerald-400' :
                      (row.risk === 'high' || row.status === 'offboarding') ? 'text-red-400' :
                      'text-slate-500'
                    }`}>{row.status || row.dept || row.level || '—'}</span>
                  </div>
                ))}
              </div>
              {item.count > 3 && <div className="text-[10px] text-slate-600 mt-1.5">+ {item.count - 3} {t('aud_more')}</div>}
            </div>

            <button onClick={item.fn}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold text-sm transition-colors">
              <Download className="h-4 w-4" /> {t('aud_export_csv')}
            </button>
          </div>
        ))}
      </div>

      {/* ── Row 3: Tool Usage Heatmap ── */}
      {derived.topToolsByUsers.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-white">{t("audit_usage_dist")}</h2>
              <p className="text-sm text-slate-500">{t("audit_usage_sub")}</p>
            </div>
            <span className="text-xs text-slate-500">{derived.topToolsByUsers.length} {t('aud_tools_with_users')}</span>
          </div>
          <div className="space-y-3">
            {derived.topToolsByUsers.map(([name, count], idx) => {
              const maxCount = derived.topToolsByUsers[0]?.[1] || 1;
              const pct = Math.round((count / maxCount) * 100);
              const colors = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#6366f1'];
              return (
                <div key={name} className="flex items-center gap-4">
                  <div className="w-28 text-sm text-slate-300 truncate font-medium">{name}</div>
                  <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{width: pct + '%', background: colors[idx % colors.length]}} />
                  </div>
                  <div className="w-20 text-right">
                    <span className="text-sm font-semibold text-white">{count}</span>
                    <span className="text-xs text-slate-500 ml-1">{t('aud_users')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


export function AuditExportPage() {
  const { data: db, isLoading } = useDbQuery();
  const { language } = useLang();
  const t = useTranslation(language);

  const derived = useMemo(() => {
    if (!db) return null;
    const tools = db.tools.map((tool) => ({
      ...tool,
      derived_status: computeToolDerivedStatus(tool),
      derived_risk: computeToolDerivedRisk(tool),
    }));
    const employeesById = Object.fromEntries(db.employees.map((e) => [e.id, e]));
    const toolsById     = Object.fromEntries(tools.map((t) => [t.id, t]));
    const access = db.access.map((a) => ({
      ...a,
      derived_risk_flag: computeAccessDerivedRiskFlag(a, employeesById, toolsById),
    }));

    // App health
    const activeTools    = tools.filter(t => t.derived_status === "active").length;
    const unusedTools    = tools.filter(t => t.derived_status === "unused" || t.derived_status === "orphaned").length;
    const highRiskCount  = tools.filter(t => t.derived_risk === "high").length;
    const formerEmpAccess = access.filter(a => a.derived_risk_flag === "former_employee").length;
    const spend          = tools.reduce((s, t) => s + Number(t.cost_per_month || 0), 0);

    // Login / usage stats — tools with recent last_used_date
    const now = new Date();
    const toolsWithLogins = tools.filter(t => {
      if (!t.last_used_date) return false;
      const d = new Date(t.last_used_date);
      return (now - d) / (1000 * 60 * 60 * 24) <= 30;
    }).length;

    // Per-tool user count from access records
    const toolUserCount = {};
    db.access.filter(a => a.status === "active").forEach(a => {
      toolUserCount[a.tool_name] = (toolUserCount[a.tool_name] || 0) + 1;
    });
    const topToolsByUsers = Object.entries(toolUserCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return {
      tools, access, employees: db.employees,
      activeTools, unusedTools, highRiskCount, formerEmpAccess, spend,
      toolsWithLogins, topToolsByUsers,
      healthScore: Math.round(Math.max(0, 100 - (highRiskCount * 10) - (formerEmpAccess * 5) - (unusedTools * 3))),
    };
  }, [db]);

  const exportTools = () => {
    if (!derived) return;
    downloadText(`tools_${todayISO()}.csv`, toCsv(derived.tools,
      ["name","category","owner_email","owner_name","criticality","url","description","derived_status","last_used_date","cost_per_month","derived_risk","notes"]
    ));
  };
  const exportEmployees = () => {
    if (!derived) return;
    downloadText(`employees_${todayISO()}.csv`, toCsv(derived.employees,
      ["full_name","email","department","role","status","start_date","end_date"]
    ));
  };
  const exportAccess = () => {
    if (!derived) return;
    downloadText(`access_${todayISO()}.csv`, toCsv(derived.access,
      ["tool_name","employee_name","employee_email","access_level","granted_date","last_accessed_date","last_reviewed_date","status","derived_risk_flag"]
    ));
  };
  const exportAll = () => { exportTools(); exportEmployees(); exportAccess(); };

  const healthColor = (score) =>
    score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-rose-400";
  const healthLabel = (score) =>
    score >= 80 ? t('aud_healthy') : score >= 60 ? t('aud_needs_attn') : t('aud_at_risk');

  return (
    <PlanGate requires="scale" feature={t('feat_audit_export')}><AppShell
      title={t('aud_audit_export')}
      right={
        <div className="flex gap-2">
          <Button onClick={() => {
            if (!derived) return;
            const html = generateAuditReportHTML(derived, language, t);
            const win = window.open('', '_blank');
            if (win) { win.document.write(html); win.document.close(); }
          }}>
            <FileText className="h-4 w-4" /> {t('aud_audit_report')}
          </Button>
          <Button onClick={exportAll}>
            <Download className="h-4 w-4" /> {t('aud_csv_export')}
          </Button>
        </div>
      }
    >
      <div className="grid gap-5">

        {/* Health + summary row */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <Card className="lg:col-span-1">
            <CardBody>
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">{t('app_health_score')}</div>
                {isLoading || !derived ? (
                  <div className="h-16 w-16 rounded-full border-4 border-slate-700 animate-pulse" />
                ) : (
                  <>
                    <div className={cx("text-2xl md:text-5xl font-black", healthColor(derived.healthScore))}>
                      {derived.healthScore}
                    </div>
                    <div className={cx("text-sm font-semibold mt-1", healthColor(derived.healthScore))}>
                      {healthLabel(derived.healthScore)}
                    </div>
                    <div className="mt-3 w-full bg-slate-800 rounded-full h-2">
                      <div
                        className={cx("h-2 rounded-full transition-all", derived.healthScore >= 80 ? "bg-emerald-500" : derived.healthScore >= 60 ? "bg-amber-500" : "bg-rose-500")}
                        style={{ width: `${derived.healthScore}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">{t('tool_inventory')}</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">{t('total_tools')}</span><span className="font-bold text-white">{derived?.tools.length ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('active')}</span><span className="font-bold text-emerald-400">{derived?.activeTools ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('orphaned')}</span><span className="font-bold text-amber-400">{derived?.unusedTools ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('high_risk')}</span><span className="font-bold text-rose-400">{derived?.highRiskCount ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('active')}</span><span className="font-bold text-blue-400">{derived?.toolsWithLogins ?? "—"}</span></div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">{t('risk_alerts')}</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">{t('total_access_records')}</span><span className="font-bold text-white">{derived?.access.length ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('active')}</span><span className="font-bold text-emerald-400">{derived?.access.filter(a => a.status === "active").length ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t("hc_former_employee_access")}</span><span className="font-bold text-rose-400">{derived?.formerEmpAccess ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('aud_employees')}</span><span className="font-bold text-slate-300">{derived?.employees.length ?? "—"}</span></div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">{t('aud_spend')}</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">{t('monthly_total')}</span><span className="font-bold text-white">{derived ? formatMoney(derived.spend, null, language) : "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('annual_projection')}</span><span className="font-bold text-blue-400">{derived ? formatMoney(derived.spend * 12, null, language) : "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('avg_per_tool')}</span><span className="font-bold text-slate-300">{derived && derived.tools.length ? formatMoney(derived.spend / derived.tools.length, null, language) : "—"}</span></div>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
          {/* Tool login / user counts */}
          <Card>
            <CardHeader title={t('aud_users_logged')} subtitle={t('all_permissions_sub')} />
            <CardBody>
              {isLoading || !derived ? <SkeletonRow cols={3} /> : derived.topToolsByUsers.length === 0 ? (
                <EmptyState icon={Users} title={t('aud_no_access')} body={t('aud_no_access_desc')} />
              ) : (
                <div className="space-y-3">
                  {derived.topToolsByUsers.map(([toolName, count]) => {
                    const pct = Math.round((count / derived.employees.length) * 100);
                    return (
                      <div key={toolName}>
                        <div className="flex items-center justify-between mb-1 text-sm">
                          <span className="text-slate-300 font-medium">{toolName}</span>
                          <span className="text-slate-400">{count} {count !== 1 ? t('aud_users') : t('aud_user')} <span className="text-slate-600">({pct}%)</span></span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-800">
                          <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Export buttons */}
          <Card>
            <CardHeader title={t('aud_export_reports')} subtitle={t('aud_export_reports_sub')} />
            <CardBody>
              <div className="space-y-3">
                {[
                  { label: t('aud_tools_report'), sub: t('aud_tools_report_sub'), fn: exportTools, count: derived?.tools.length },
                  { label: t('aud_emp_report'), sub: t('aud_emp_report_sub'), fn: exportEmployees, count: derived?.employees.length },
                  { label: t('aud_access_report'), sub: t('aud_access_report_sub'), fn: exportAccess, count: derived?.access.length },
                ].map(({ label, sub, fn, count }) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                    <div>
                      <div className="text-sm font-semibold text-white">{label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
                      {count !== undefined && <div className="text-xs text-slate-600 mt-0.5">{count} {t('aud_records')}</div>}
                    </div>
                    <Button size="sm" variant="secondary" onClick={fn}>
                      <Download className="h-4 w-4" /> {t('aud_export')}
                    </Button>
                  </div>
                ))}
                <div className="rounded-2xl border border-blue-600/30 bg-blue-600/10 p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">{t('full_audit_package')}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{t('all_three_reports')}</div>
                  </div>
                  <Button size="sm" onClick={exportAll}>
                    <Download className="h-4 w-4" /> {t('aud_export_all')}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Summary */}
        <Card>
          <CardHeader title={t('aud_audit_summary')} subtitle={t('aud_audit_summary_sub')} />
          <CardBody>
            {isLoading || !derived ? <SkeletonRow cols={4} /> : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[
                  { icon: "✅", title: t('aud_active_tools'), text: t('aud_active_tools_text').replace('{active}', derived.activeTools).replace('{total}', derived.tools.length), ok: true },
                  derived.unusedTools > 0 && { icon: "⚠️", title: t('aud_unused_tools'), text: t('aud_unused_tools_text').replace('{count}', derived.unusedTools), ok: false },
                  derived.highRiskCount > 0 && { icon: "🔴", title: t('aud_high_risk_tools'), text: t('aud_high_risk_text').replace('{count}', derived.highRiskCount), ok: false },
                  derived.formerEmpAccess > 0 && { icon: "🚨", title: t('aud_former_access'), text: t('aud_former_access_text').replace('{count}', derived.formerEmpAccess), ok: false },
                  derived.formerEmpAccess === 0 && { icon: "✅", title: t('aud_no_ghost'), text: t('aud_no_ghost_text'), ok: true },
                  { icon: "💰", title: t('aud_monthly_spend'), text: t('aud_spend_text').replace('{monthly}', formatMoney(derived.spend, null, language)).replace('{annual}', formatMoney(derived.spend * 12, null, language)), ok: true },
                ].filter(Boolean).map((item) => (
                  <div key={item.title} className={cx(
                    "rounded-xl border p-4 text-sm",
                    item.ok ? "border-emerald-800/40 bg-emerald-950/20" : "border-rose-800/40 bg-rose-950/20"
                  )}>
                    <div className="flex items-center gap-2 font-semibold text-white mb-1">
                      <span>{item.icon}</span>{item.title}
                    </div>
                    <div className="text-slate-400">{item.text}</div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </AppShell></PlanGate>
  );
}
