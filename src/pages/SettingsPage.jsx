import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bell, CreditCard, Download, Plug, Shield, Users, Wrench, Zap,
} from 'lucide-react';
import {
  getUserPlanFromFirestore, syncClaimsFromServer,
} from '../firebase-config';
import { loadDb, saveDb, seedDbIfEmpty } from '../lib/db';
import { useDbQuery } from '../hooks/useDbQuery';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Card, CardHeader, CardBody } from '../components/ui';
import { RoleGate } from '../components/gates';
import { AppShell } from '../components/AppShell';
import { TeamTab } from './settings/TeamTab';
import { NotificationsTab } from './settings/NotificationsTab';
import { SecurityTab } from './settings/SecurityTab';
import { ApiKeysTab } from './settings/ApiKeysTab';
import { DataTab } from './settings/DataTab';

const LazyBillingPage          = React.lazy(() => import('./settings/BillingTab').then(m => ({ default: m.BillingPage })));
const LazyIntegrationConnectors = React.lazy(() => import('./settings/IntegrationsTab').then(m => ({ default: m.IntegrationConnectors })));

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function SettingsPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db } = useDbQuery();
  const qc = useQueryClient();
  const { isDemo, firebaseUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('general');
  const [saveMsg, setSaveMsg] = useState('');
  const [stripeMsg, setStripeMsg] = useState('');

  useEffect(() => {
    const success = searchParams.get('success');
    const cancelled = searchParams.get('cancelled');
    // Deep-link to a specific tab, e.g. /settings?tab=billing from "Upgrade now".
    const tabParam = searchParams.get('tab');
    const VALID_TABS = ['general', 'team', 'billing', 'notifications', 'integrations', 'security', 'api', 'data'];
    if (tabParam && VALID_TABS.includes(tabParam)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(tabParam);
    }
    if (success === 'true') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab('billing');
      setStripeMsg('success');
      if (firebaseUser?.uid) {
        syncClaimsFromServer().then(() =>
          getUserPlanFromFirestore(firebaseUser.uid)
        ).then((planData) => {
          if (planData) {
            const cur = loadDb() || seedDbIfEmpty();
            cur.user = { ...cur.user, ...planData };
            saveDb(cur);
            qc.invalidateQueries({ queryKey: ['db'] });
          }
        }).catch(() => {});
      }
      setSearchParams({}, { replace: true });
    } else if (cancelled === 'true') {
      setActiveTab('billing');
      setStripeMsg('cancelled');
      setSearchParams({}, { replace: true });
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const saved = JSON.parse(localStorage.getItem('sg_general') || '{}');
  const [orgName, setOrgName] = useState(saved.orgName || 'My Organisation');
  const [timezone, setTimezone] = useState(saved.timezone || 'Europe/London');
  const [currency] = useState(saved.currency || 'GBP (£)');
  const [dateFormat, setDateFormat] = useState(saved.dateFormat || 'DD/MM/YYYY');

  const save = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
    setSaveMsg(t('saved_msg'));
    setTimeout(() => setSaveMsg(''), 2000);
  };

  const tabs = [
    { id: 'general',       label: t('settings_general'),       icon: Wrench, group: 'core' },
    { id: 'team',          label: t('settings_team'),          icon: Users,  group: 'core' },
    { id: 'billing',       label: t('nav_billing'),            icon: CreditCard, group: 'core' },
    { id: 'notifications', label: t('settings_notifications'), icon: Bell,   group: 'core' },
    { id: 'integrations',  label: t('nav_integrations'),       icon: Plug, group: 'advanced' },
    { id: 'security',      label: t('settings_security'),      icon: Shield, group: 'advanced' },
    { id: 'api',           label: t('settings_api'),           icon: Zap,    group: 'advanced' },
    { id: 'data',          label: t('settings_data'),          icon: Download, group: 'advanced' },
  ];
  const coreTabs = tabs.filter(tab => tab.group === 'core');
  const advancedTabs = tabs.filter(tab => tab.group === 'advanced');

  return (
    <AppShell title={t('settings_title')} right={
      <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
        {coreTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} data-tab={tab.id}
              className={"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap " + (activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}>
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
        <div className="w-px h-5 bg-slate-700 mx-1" />
        {advancedTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} data-tab={tab.id}
              className={"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap " + (activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}>
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>
    }>
      <div>
        <div className="flex-1 min-w-0 space-y-4">

          {activeTab === 'general' && (
            <Card>
              <CardHeader title={t('general_settings')} subtitle={t('general_settings_sub')} />
              <CardBody>
                <div className="space-y-5 max-w-2xl">
                  {[
                    { label: t('org_name_label'), el: <input value={orgName} onChange={e=>setOrgName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500 transition-colors" placeholder="Acme Corp" /> },
                    { label: t('time_zone_label'), el: <select value={timezone} onChange={e=>setTimezone(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none"><option>Europe/London</option><option>UTC</option><option>America/New_York</option><option>America/Los_Angeles</option><option>Europe/Paris</option><option>Asia/Tokyo</option></select> },
                    { label: t('date_format_label'), el: <select value={dateFormat} onChange={e=>setDateFormat(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none"><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></select> },
                  ].map(({ label, el }) => (
                    <div key={label}>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
                      {el}
                    </div>
                  ))}
                  <div className="flex items-center gap-3 pt-2">
                    <button onClick={() => save('sg_general', { orgName, timezone, currency, dateFormat })}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm transition-colors">
                      Save Changes
                    </button>
                    {saveMsg && <span className="text-sm text-emerald-400 font-semibold">{saveMsg}</span>}
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {activeTab === 'team' && <TeamTab db={db} firebaseUser={firebaseUser} t={t} />}

          {activeTab === 'notifications' && <NotificationsTab firebaseUser={firebaseUser} qc={qc} t={t} />}

          {activeTab === 'security' && <SecurityTab t={t} />}

          {activeTab === 'api' && <ApiKeysTab t={t} />}

          {activeTab === 'data' && <DataTab db={db} firebaseUser={firebaseUser} isDemo={isDemo} qc={qc} t={t} />}

          {activeTab === 'billing' && (
            <div className="space-y-4">
              {stripeMsg === 'success' && (
                <div className="flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3">
                  <span className="text-lg mt-0.5">🎉</span>
                  <div>
                    <p className="text-sm font-semibold text-green-400">{t('stripe_success_title')}</p>
                    <p className="text-xs text-green-300/80 mt-0.5">{t('stripe_success_sub')}</p>
                  </div>
                  <button onClick={() => setStripeMsg('')} className="ml-auto text-green-400/60 hover:text-green-400 text-lg leading-none">×</button>
                </div>
              )}
              {stripeMsg === 'cancelled' && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                  <span className="text-lg mt-0.5">💡</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-400">{t('stripe_cancelled_title')}</p>
                    <p className="text-xs text-amber-300/80 mt-0.5">{t('stripe_cancelled_sub')}</p>
                  </div>
                  <button onClick={() => setStripeMsg('')} className="ml-auto text-amber-400/60 hover:text-amber-400 text-lg leading-none">×</button>
                </div>
              )}
              <RoleGate requires="owner" fallback={
                <Card><CardBody>
                  <div className="text-center py-8">
                    <div className="text-3xl mb-3">🔒</div>
                    <h3 className="text-lg font-semibold text-white mb-1">Owner Access Required</h3>
                    <p className="text-slate-400 text-sm">Only the account owner can manage billing and subscriptions.</p>
                  </div>
                </CardBody></Card>
              }>
                <React.Suspense fallback={<TabLoader />}><LazyBillingPage noShell={true} /></React.Suspense>
              </RoleGate>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-4">
              <Card>
                <CardHeader title={t('nav_integrations')} subtitle="Connect Stacklens to your tools for automatic discovery and user sync" />
                <CardBody>
                  <React.Suspense fallback={<TabLoader />}><LazyIntegrationConnectors /></React.Suspense>
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
