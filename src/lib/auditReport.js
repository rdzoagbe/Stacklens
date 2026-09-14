// ── The audit report an SMB hands to its auditor ───────────────────────────
//
// Moved out of AuditPage.jsx so its output can be asserted directly. What
// matters about this document is what the auditor reads, and only the produced
// HTML shows that — a source-matching check would have passed while the report
// presented every unowned tool's full annual cost as a saving, which is what
// it did.
//
// Pure: it takes the derived workspace, the language and the translator, and
// returns a string. No React, no DOM, no Firestore.

import { formatMoney } from './dataUtils';
import { computeWaste, activeGrantsByTool } from './waste';

const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function generateAuditReportHTML(derived, language, t) {
  const fm = (n) => formatMoney(n, null, language);
  // The report is a standalone document — its language must follow the app's,
  // including the lang attribute and the date format.
  const localeTag = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES', pt: 'pt-PT' }[language] || 'en-GB';
  const today = new Date().toLocaleDateString(localeTag, { day: 'numeric', month: 'long', year: 'numeric' });
  const hScore = derived.healthScore;
  const hColor = hScore >= 80 ? '#10b981' : hScore >= 60 ? '#f59e0b' : '#ef4444';
  const hLabel = hScore >= 80 ? t('rep_healthy') : hScore >= 60 ? t('rep_needs_attention') : t('rep_at_risk');
  const waste = computeWaste(derived);
  const wastedSpend = Math.round(waste.recoverable);
  const annualSavings = wastedSpend * 12;
  const topSpend = [...derived.tools].filter(t => t.cost_per_month > 0).sort((a, b) => b.cost_per_month - a.cost_per_month).slice(0, 10);
  const highRiskTools = derived.tools.filter(t => t.derived_risk === 'high');
  const unusedTools = derived.tools.filter(t => t.derived_status === 'unused' || t.derived_status === 'orphaned');
  // How many people actually hold a live grant on each of them.
  //
  // This table used to print each tool's full annual cost in a column headed
  // "Potential Savings", and total that column. Two things were wrong with it
  // in a document a customer hands to an auditor.
  //
  // `derived_status === 'orphaned'` means no owner_email is filled in. It says
  // nothing about usage — so a tool twenty people use every day appeared here
  // with its whole annual cost presented as a saving. You cannot cancel it;
  // you can assign it an owner.
  //
  // And the column total was a second savings figure in a report that already
  // states one at the top from computeWaste, which counts only tools with cost
  // and no active grants. The two could differ by an order of magnitude on the
  // same page.
  //
  // So the list stays — an unowned or long-unused tool is a real governance
  // finding — and it now reports what is true of each row: how many people
  // hold access, and whether that makes it recoverable. The one savings figure
  // in the document is the one at the top.
  const grantsByTool = activeGrantsByTool(derived);
  const recoverableIds = new Set(waste.unusedTools.map(x => x.id));
  const categorySpend = {};
  derived.tools.forEach(t => { const c = t.category || 'Other'; categorySpend[c] = (categorySpend[c] || 0) + (t.cost_per_month || 0); });
  const catRows = Object.entries(categorySpend).sort((a, b) => b[1] - a[1]);

  return `<!DOCTYPE html>
<html lang="${language || 'en'}">
<head>
<meta charset="UTF-8">
<title>${t('rep_title')} — Stacklens</title>
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
    <button onclick="window.print()">${t('rep_print')}</button>
    <button class="secondary" onclick="window.close()">${t('rep_close')}</button>
  </div>

  <h2>${t('rep_exec_summary')}</h2>
  <div class="health-box">
    <div class="health-score" style="background:${hColor}">${hScore}</div>
    <div class="health-detail">
      <div class="health-label" style="color:${hColor}">${hLabel}</div>
      <div class="health-desc">
        ${t('rep_summary_sentence').replace('{tools}', derived.tools.length).replace('{emp}', derived.employees.filter(e => e.status === 'active').length).replace('{acc}', derived.access.filter(a => a.status === 'active').length)}
        ${derived.highRiskCount > 0 ? t('rep_high_risk_note').replace('{n}', derived.highRiskCount) : t('rep_no_high_risk')}
        ${derived.formerEmpAccess > 0 ? t('rep_former_note').replace('{n}', derived.formerEmpAccess) : ''}
      </div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-value">${derived.tools.length}</div>
      <div class="kpi-label">${t('rep_total_tools')}</div>
      <div class="kpi-sub">${derived.activeTools} ${t('rep_active')}, ${derived.unusedTools} ${t('rep_unused')}</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${fm(derived.spend)}</div>
      <div class="kpi-label">${t('rep_monthly_spend')}</div>
      <div class="kpi-sub">${fm(derived.spend * 12)}${t('rep_per_year')}</div>
    </div>
    <div class="kpi">
      <div class="kpi-value" style="color:${derived.highRiskCount > 0 ? '#dc2626' : '#16a34a'}">${derived.highRiskCount}</div>
      <div class="kpi-label">${t('rep_high_risk_tools')}</div>
      <div class="kpi-sub">${derived.formerEmpAccess} ${t('rep_former_access')}</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${derived.employees.length}</div>
      <div class="kpi-label">${t('rep_employees')}</div>
      <div class="kpi-sub">${derived.employees.filter(e => e.status === 'active').length} ${t('rep_active')}</div>
    </div>
  </div>

  ${wastedSpend > 0 ? `
  <div class="savings-box">
    <div class="savings-value">${fm(annualSavings)}</div>
    <div class="savings-label">${t('rep_savings_label')}</div>
  </div>` : ''}

  <h2>${t('rep_spend_by_category')}</h2>
  <table>
    <thead><tr><th>${t('rep_category')}</th><th>${t('rep_monthly_cost')}</th><th>${t('rep_annual_cost')}</th><th>${t('rep_pct_of_total')}</th><th>${t('rep_distribution')}</th></tr></thead>
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
  <h2>${t('rep_high_risk_tools')}</h2>
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
  <p style="color:#64748b;font-size:13px;margin-bottom:12px">Unused means no recorded activity for 90 days or more. Orphaned means no owner is assigned, which is a governance finding on its own and says nothing about whether the tool is in use. Cancel only the rows marked cancellable; for the rest, assign an owner or confirm the tool is still needed.</p>
  <table>
    <thead><tr><th>Tool</th><th>Monthly Cost</th><th>Status</th><th>Last Used</th><th>People with access</th><th>Cancellable</th></tr></thead>
    <tbody>
      ${unusedTools.map(tool => {
        const users = grantsByTool.get(tool.id) || 0;
        const cancellable = recoverableIds.has(tool.id);
        return `<tr>
        <td><strong>${escHtml(tool.name)}</strong></td>
        <td>${fm(tool.cost_per_month || 0)}</td>
        <td><span class="pill ${tool.derived_status === 'orphaned' ? 'pill-red' : 'pill-amber'}">${escHtml(tool.derived_status)}</span></td>
        <td>${escHtml(tool.last_used_date || 'Never')}</td>
        <td>${users}</td>
        <td style="${cancellable ? 'color:#16a34a;font-weight:600' : 'color:#64748b'}">${cancellable ? `Yes — ${fm((tool.cost_per_month || 0) * 12)}/yr` : 'No — still in use'}</td>
      </tr>`;
      }).join('')}
      <tr style="font-weight:700;border-top:2px solid #e2e8f0">
        <td colspan="5">Recoverable spend (tools with cost and nobody holding access)</td>
        <td style="color:#16a34a">${fm(annualSavings)}/yr</td>
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
    ${unusedTools.length > 0 ? `<li><strong>Review ${unusedTools.length} unowned or long-unused tools</strong> — ${recoverableIds.size > 0 ? `${recoverableIds.size} of them have nobody holding access and can be cancelled for ${fm(annualSavings)}/year.` : 'all of them still have people holding access, so the action is to assign an owner or confirm the tool is still needed, not to cancel.'}</li>` : ''}
    ${derived.tools.filter(t => !t.mfa_enabled && !t.mfa_required).length > 0 ? `<li><strong>Enable MFA on ${derived.tools.filter(t => !t.mfa_enabled && !t.mfa_required).length} tools</strong> — Multi-factor authentication should be required for all business-critical applications.</li>` : ''}
    <li><strong>Schedule quarterly access reviews</strong> — Regular reviews prevent permission creep and ensure least-privilege access.</li>
    <li><strong>Consolidate overlapping tools</strong> — Review tools in the same category for consolidation opportunities.</li>
  </ol>

  <div class="footer">
    <p>${t('rep_generated_by')}</p>
    <p>stacklens.fr · ${today}</p>
  </div>
</div>
</body>
</html>`;
}
