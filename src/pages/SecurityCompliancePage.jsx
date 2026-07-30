import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, Boxes, Shield, UserMinus, X } from 'lucide-react';
import { buildRiskAlerts, computeToolDerivedRisk } from '../lib/dataUtils';
import { useDbQuery } from '../hooks/useDbQuery';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Button } from '../components/ui';
import { PlanGate } from '../components/gates';
import { AppShell } from '../components/AppShell';
import { AuditTabContent } from './AuditPage';

export function SecurityCompliancePage() {
  const [secActiveTab, setSecActiveTab] = useState('security');
  const { language } = useLang();
  const t = useTranslation(language);
  return (
    <PlanGate requires="growth" feature={t('feat_security_compliance')}><AppShell title={t('security_title')}
      right={
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
            {[
              { id: 'security', label: t('nav_security') },
              { id: 'audit',    label: t('feat_audit_export') },
            ].map(tab => (
              <button key={tab.id} onClick={() => setSecActiveTab(tab.id)}
                className={"px-4 py-1.5 rounded-lg text-sm font-semibold transition-all " + (secActiveTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {secActiveTab === 'security' && (
        <SecurityTabContent />
      )}
      {secActiveTab === 'audit' && (
        <AuditTabContent />
      )}
    </AppShell></PlanGate>
  );
}

function SecurityTabContent() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db } = useDbQuery();
  const navigate = useNavigate();

  const tools = db?.tools || [];
  const access = db?.access || [];
  const employees = db?.employees || [];

  const orphanedTools = tools.filter(t => t.status === 'active' && !t.owner_email).length;
  const highRiskTools = tools.filter(t => computeToolDerivedRisk(t) === 'high').length;
  const activeTools = tools.filter(t => t.status === 'active').length;
  const formerAccess = access.filter(a => {
    const emp = employees.find(e => e.id === a.employee_id);
    return emp && (emp.status === 'offboarding' || emp.status === 'inactive') && a.status === 'active';
  }).length;
  const mfaCoverage = activeTools > 0 ? Math.round(((activeTools - orphanedTools) / activeTools) * 100) : 100;
  const securityScore = Math.max(0, Math.min(100, 100 - (orphanedTools * 10) - (highRiskTools * 5) - (formerAccess * 8)));
  const scoreColor = securityScore >= 80 ? '#10b981' : securityScore >= 60 ? '#f59e0b' : '#ef4444';
  const scoreLabel = securityScore >= 80 ? 'Good' : securityScore >= 60 ? 'Needs Work' : 'Critical';

  const alerts = buildRiskAlerts({ tools, access, employees }, t);
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const highAlerts = alerts.filter(a => a.severity === 'high');
  const mediumAlerts = alerts.filter(a => a.severity === 'medium');

  const isRealUser = db?.user?.is_authenticated && !db?.user?.is_demo;

  if (isRealUser && tools.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5">
          <Shield className="h-8 w-8 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{t('security_no_tools_title')}</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-6">{t('security_no_tools_body')}</p>
        <Link to="/tools" className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold text-white transition-colors">
          {t('security_add_tools')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Row 1: Security Score + Key Metrics ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">

        {/* Security Score — the hero */}
        <div className="lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="text-center">
            <div className="relative w-40 h-40 mx-auto mb-4">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="6"/>
                <circle cx="50" cy="50" r="42" fill="none"
                  stroke={scoreColor}
                  strokeWidth="6"
                  strokeDasharray={`${2*Math.PI*42}`}
                  strokeDashoffset={`${2*Math.PI*42*(1-securityScore/100)}`}
                  strokeLinecap="round"/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-white">{securityScore}</span>
                <span className="text-sm text-slate-500">/ 100</span>
              </div>
            </div>
            <div className="text-base font-semibold" style={{color: scoreColor}}>{scoreLabel}</div>
            <p className="text-sm text-slate-500 mt-1">{t("security_overall_posture")}</p>
          </div>
        </div>

        {/* Key Metrics — 2x2 grid */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("kpi_critical")}</span>
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <div className="text-3xl font-black text-red-400">{criticalAlerts.length}</div>
            <div className="text-sm text-slate-500 mt-1">{t("hc_require_immediate_action") || "Require immediate action"}</div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("kpi_former_access")}</span>
              <UserMinus className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-3xl font-black text-amber-400">{formerAccess}</div>
            <div className="text-sm text-slate-500 mt-1">{t("hc_ex_employees_with_access") || "Ex-employees with active access"}</div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("kpi_orphaned")}</span>
              <Boxes className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-3xl font-black text-purple-400">{orphanedTools}</div>
            <div className="text-sm text-slate-500 mt-1">{t("hc_no_owner_assigned") || "No owner assigned"}</div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("kpi_mfa_coverage")}</span>
              <Shield className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-emerald-400">{mfaCoverage}%</div>
            <div className="text-sm text-slate-500 mt-1">{activeTools - orphanedTools} of {activeTools} tools secured</div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Risk Alerts — grouped by severity ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-white">{t('security_alerts') || 'Security Alerts'}</h2>
            <p className="text-sm text-slate-500">{alerts.length} active alerts across your SaaS stack</p>
          </div>
          <div className="flex items-center gap-2">
            {criticalAlerts.length > 0 && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">{criticalAlerts.length} critical</span>}
            {highAlerts.length > 0 && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">{highAlerts.length} high</span>}
            {mediumAlerts.length > 0 && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">{mediumAlerts.length} medium</span>}
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl p-5 bg-emerald-500/5 border border-emerald-500/20">
            <BadgeCheck className="h-6 w-6 text-emerald-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-emerald-400">{t("security_all_clear")}</div>
              <div className="text-xs text-slate-500 mt-0.5">{t("security_all_clear_sub")}</div>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {alerts.map((alert, idx) => {
              const tone = alert.severity === 'critical' ? 'red' : alert.severity === 'high' ? 'amber' : 'blue';
              const AlertIcon = alert.action?.icon || Shield;
              return (
                <div key={idx} className={`flex items-start gap-4 rounded-xl p-4 border transition-colors hover:border-slate-700 ${
                  tone === 'red' ? 'bg-red-500/5 border-red-500/20' :
                  tone === 'amber' ? 'bg-amber-500/5 border-amber-500/20' :
                  'bg-blue-500/5 border-blue-500/20'
                }`}>
                  <div className={`p-2 rounded-lg flex-shrink-0 ${
                    tone === 'red' ? 'bg-red-500/10' :
                    tone === 'amber' ? 'bg-amber-500/10' : 'bg-blue-500/10'
                  }`}>
                    <AlertIcon className={`h-4 w-4 ${
                      tone === 'red' ? 'text-red-400' :
                      tone === 'amber' ? 'text-amber-400' : 'text-blue-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-white">{alert.title}</span>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        tone === 'red' ? 'bg-red-500/20 text-red-400' :
                        tone === 'amber' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>{alert.severity}</span>
                    </div>
                    <div className="text-sm text-slate-400">{alert.body || alert.description}</div>
                  </div>
                  {alert.action && (
                    <Button variant="secondary" size="sm" onClick={() => navigate(alert.action.to)} className="flex-shrink-0">
                      {alert.action.label} →
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Row 3: Compliance + Tool Security Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">

        {/* Compliance Status */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <h2 className="text-base font-semibold text-white mb-4">{t("security_compliance")}</h2>
          <div className="space-y-3">
            {[
              { name: 'GDPR', status: 'compliant', desc: 'General Data Protection Regulation' },
              { name: 'SOC 2 Type II', status: 'review', desc: 'On our roadmap — not yet certified' },
              { name: 'ISO 27001', status: 'review', desc: 'On our roadmap — not yet certified' },
              { name: 'HIPAA', status: 'non-compliant', desc: 'Not supported' },
            ].map((c) => (
              <div key={c.name} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950/30">
                <div>
                  <div className="text-sm font-semibold text-white">{c.name}</div>
                  <div className="text-xs text-slate-500">{c.desc}</div>
                </div>
                {c.status === 'compliant' ? (
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <BadgeCheck className="h-4 w-4" />
                    <span className="text-xs font-semibold">{t('sec_compliant')}</span>
                  </div>
                ) : c.status === 'review' ? (
                  <div className="flex items-center gap-1.5 text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-xs font-semibold">{t('sec_review_needed')}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-red-400">
                    <X className="h-4 w-4" />
                    <span className="text-xs font-semibold">{t('sec_non_compliant')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tool Security Breakdown */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <h2 className="text-base font-semibold text-white mb-4">{t("security_tool_breakdown")}</h2>
          {(() => {
            const riskGroups = {
              'Critical': tools.filter(t => t.criticality === 'critical' && t.status === 'active'),
              'High Risk': tools.filter(t => computeToolDerivedRisk(t) === 'high' && t.status === 'active'),
              'Orphaned': tools.filter(t => t.status === 'active' && !t.owner_email),
              'Secured': tools.filter(t => t.status === 'active' && t.owner_email && computeToolDerivedRisk(t) !== 'high'),
            };
            const total = tools.filter(t => t.status === 'active').length || 1;
            const colors = { 'Critical': '#ef4444', 'High Risk': '#f59e0b', 'Orphaned': '#8b5cf6', 'Secured': '#10b981' };
            return (
              <div className="space-y-4">
                {/* Stacked bar */}
                <div className="flex h-4 rounded-full overflow-hidden bg-slate-800">
                  {Object.entries(riskGroups).map(([label, items]) => (
                    items.length > 0 && <div key={label} className="h-full transition-all" style={{width: `${(items.length/total)*100}%`, background: colors[label]}} title={`${label}: ${items.length}`} />
                  ))}
                </div>
                {/* Legend + counts */}
                <div className="space-y-2.5">
                  {Object.entries(riskGroups).map(([label, items]) => (
                    <div key={label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{background: colors[label]}} />
                        <span className="text-sm text-slate-300">{label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-white">{items.length}</span>
                        <span className="text-xs text-slate-500 w-10 text-right">{Math.round((items.length/total)*100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Top risky tools list */}
                {riskGroups['High Risk'].length > 0 && (
                  <div className="pt-3 border-t border-slate-800">
                    <div className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wider">{t("security_high_risk_tools")}</div>
                    {riskGroups['High Risk'].slice(0,3).map(tool => (
                      <div key={tool.id} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-slate-300">{tool.name}</span>
                        <button onClick={() => navigate('/tools')} className="text-xs text-blue-400 hover:text-blue-300">{t('sec_review_arrow')}</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
