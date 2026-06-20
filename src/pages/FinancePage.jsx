import React, { useState } from 'react';
import {
  buildRiskAlerts, computeToolDerivedRisk,
} from '../lib/dataUtils';
import { useDbQuery } from '../hooks/useDbQuery';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { PlanGate } from '../components/gates';
import { AppShell } from '../components/AppShell';

// ── Tab-level code splitting ────────────────────────────────────────────
const LazyExecutiveDashboard = React.lazy(() => import('./finance/ExecutiveDashboard').then(m => ({ default: m.ExecutiveDashboard })));
const LazyOverviewTab   = React.lazy(() => import('./finance/OverviewTab').then(m => ({ default: m.FinanceOverviewTab })));
const LazyCostTab       = React.lazy(() => import('./finance/CostTab').then(m => ({ default: m.CostTabContent })));
const LazyAnalyticsTab  = React.lazy(() => import('./finance/AnalyticsTab').then(m => ({ default: m.AnalyticsTabContent })));
const LazyLicensesTab   = React.lazy(() => import('./finance/LicensesTab').then(m => ({ default: m.LicenseManagement })));
const LazyRenewalAlerts = React.lazy(() => import('./finance/RenewalsTab').then(m => ({ default: m.RenewalAlerts })));
const LazyContractsTab  = React.lazy(() => import('./finance/RenewalsTab').then(m => ({ default: m.ContractsTabContent })));

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function ExecutivePageWrapper() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db } = useDbQuery();
  if (!db) return <div className="flex items-center justify-center h-screen"><div className="text-white">{t('loading')}</div></div>;
  
  const derived = {
    tools: db.tools.map(t => ({ ...t, derived_risk: computeToolDerivedRisk(t) })),
    employees: db.employees || [],
    access: db.access || [],
    alerts: buildRiskAlerts({ tools: db.tools, access: db.access || [], employees: db.employees || [] })
  };
  
  return (
    <AppShell title={t("nav_executive")}>
      <PlanGate requires="professional" feature="Executive Dashboard">
        <React.Suspense fallback={<TabLoader />}><LazyExecutiveDashboard data={derived} /></React.Suspense>
      </PlanGate>
    </AppShell>
  );
}

export function FinanceDashboard() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db } = useDbQuery();
  const [finTab, setFinTab] = useState('overview');
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showReclaimModal, setShowReclaimModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  // Compute real financial data from tools — use reactive db (TanStack Query)
  // to avoid showing demo data during Firestore hydration race
  const _fReal = db?.user?.is_authenticated && !db?.user?.is_demo;
  const _tools = db?.tools || [];
  const _totalSpend = _fReal ? _tools.reduce((s, t) => s + (t.cost_per_month || t.cost_monthly || t.cost || 0), 0) : 47850;
  const _byCategory = _fReal ? Object.values(_tools.reduce((acc, tool) => {
    const cat = tool.category || 'Other';
    if (!acc[cat]) acc[cat] = { name: cat, spend: 0, count: 0, budget: 0 };
    acc[cat].spend += (tool.cost_per_month || tool.cost_monthly || tool.cost || 0);
    acc[cat].count += 1;
    return acc;
  }, {})) : [{name:'CRM',spend:12400,budget:15000,count:3},{name:'Communication',spend:8200,budget:10000,count:5},{name:'Development',spend:14300,budget:18000,count:8},{name:'Design',spend:6800,budget:8000,count:4},{name:'Analytics',spend:6150,budget:4000,count:3}];
  const _months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const _now = new Date();
  const _trend = Array.from({length:6},(_,i)=>{ const d=new Date(_now.getFullYear(),_now.getMonth()-5+i,1); return {month:_months[d.getMonth()],spend:_fReal?_totalSpend*(0.9+i*0.02):[42100,43800,45200,44600,46900,47850][i]}; });
  const _bills = _fReal ? _tools.filter(t=>t.renewal_date).sort((a,b)=>new Date(a.renewal_date)-new Date(b.renewal_date)).slice(0,5).map(t=>({app:t.name,amount:t.cost_per_month?t.cost_per_month*12:t.cost_monthly?t.cost_monthly*12:(t.cost||0),dueDate:t.renewal_date,status:'pending',category:t.category||'Other'})) : [{app:'Salesforce',amount:12400,dueDate:'2026-03-01',status:'pending',category:'CRM'},{app:'Adobe Creative Cloud',amount:5400,dueDate:'2026-03-20',status:'pending',category:'Design'}];
  // Budget cap — read from db (persisted to Firestore) with localStorage fallback
  const _savedBudgetCap = db?.user?.budget_cap || parseInt(localStorage.getItem('sg_budget_cap') || '0') || 0;
  const [budgetCap, setBudgetCap] = useState(_savedBudgetCap);
  // Keep budgetCap in sync when db hydrates from Firestore
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (db?.user?.budget_cap && db.user.budget_cap !== budgetCap) setBudgetCap(db.user.budget_cap);
  }, [db?.user?.budget_cap]);
  const _financialData = {totalMonthlySpend:_totalSpend,budgetLimit:budgetCap||0,lastMonthSpend:_totalSpend*0.95||45200,upcomingBills:_bills,byCategory:_byCategory,monthlyTrend:_trend,isReal:_fReal,toolCount:_tools.filter(t=>t.status!=='archived').length};

  const TABS = [
    { id: 'overview',   label: t('fin_tab_overview') || 'Overview' },
    { id: 'cost',       label: t('fin_tab_cost') || 'Cost' },
    { id: 'licenses',   label: t('nav_licenses') || 'Licenses' },
    { id: 'renewals',   label: t('renewals_tab') || 'Renewals' },
    { id: 'contracts',  label: t('contracts_tab') || 'Contracts' },
    { id: 'analytics',  label: t('fin_tab_reports') || 'Reports' },
  ];

  return (
    <PlanGate requires="growth" feature="Finance Dashboard"><AppShell title={t("finance_title") || "Finance"}
      right={
        <div className="flex gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto [&::-webkit-scrollbar]:h-0">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setFinTab(tab.id)}
              className={"px-3 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap " + (finTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}>
              {tab.label}
            </button>
          ))}
        </div>
      }
    >
      {finTab === 'overview' && <React.Suspense fallback={<TabLoader />}><LazyOverviewTab financialData={_financialData} showBudgetModal={showBudgetModal} setShowBudgetModal={setShowBudgetModal} budgetCap={budgetCap} setBudgetCap={setBudgetCap} selectedBill={selectedBill} setSelectedBill={setSelectedBill} showReclaimModal={showReclaimModal} setShowReclaimModal={setShowReclaimModal} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} setFinTab={setFinTab} /></React.Suspense>}
      {finTab === 'cost' && <React.Suspense fallback={<TabLoader />}><LazyCostTab setFinTab={setFinTab} /></React.Suspense>}
      {finTab === 'licenses' && <React.Suspense fallback={<TabLoader />}><LazyLicensesTab /></React.Suspense>}
      {finTab === 'renewals' && <React.Suspense fallback={<TabLoader />}><LazyRenewalAlerts /></React.Suspense>}
      {finTab === 'contracts' && <React.Suspense fallback={<TabLoader />}><LazyContractsTab /></React.Suspense>}
      {finTab === 'analytics' && <React.Suspense fallback={<TabLoader />}><LazyAnalyticsTab /></React.Suspense>}
    </AppShell></PlanGate>
  );
}

