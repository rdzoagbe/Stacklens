import React, { useState, useMemo } from 'react';
import { Check, CheckCircle, Plug, Search } from 'lucide-react';
import { useLang } from '../../contexts/LangContext';
import { useTranslation } from '../../translations';
import { AppShell } from '../../components/AppShell';

export function IntegrationConnectors() {
  const { language } = useLang();
  const t = useTranslation(language);
  const _savedConnected = (() => { try { return JSON.parse(localStorage.getItem('sg_connected_integrations') || '["google-workspace","slack"]'); } catch { return ['google-workspace','slack']; } })();
  const [connectedIntegrations, setConnectedIntegrations] = useState(_savedConnected);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const integrations = [
    { id: 'google-workspace', name: 'Google Workspace', description: 'Import users, track licenses, scan Gmail for invoices', icon: '🔵', category: 'Identity & Directory', features: ['User Sync', 'License Detection', 'Invoice Scanning'], status: 'available', setupTime: '5 min' },
    { id: 'slack', name: 'Slack', description: 'Send alerts, track usage, manage members', icon: '💬', category: 'Communication', features: ['User Sync', 'Usage Analytics', 'Alert Notifications'], status: 'available', setupTime: '3 min' },
    { id: 'microsoft-365', name: 'Microsoft 365', description: 'Azure AD sync, license tracking, usage monitoring', icon: '🟦', category: 'Identity & Directory', features: ['Azure AD Sync', 'License Management', 'Usage Reports'], status: 'available', setupTime: '5 min' },
    { id: 'github', name: 'GitHub', description: 'Track seats, monitor activity, manage team access', icon: '🐙', category: 'Development', features: ['Seat Tracking', 'Activity Monitoring', 'Team Management'], status: 'available', setupTime: '2 min' },
    { id: 'okta', name: 'Okta', description: 'SSO integration, user provisioning, app discovery', icon: '🔐', category: 'Identity & Directory', features: ['SSO', 'User Provisioning', 'App Discovery'], status: 'available', setupTime: '10 min' },
    { id: 'salesforce', name: 'Salesforce', description: 'Track licenses, monitor usage, optimize seats', icon: '☁️', category: 'CRM', features: ['License Tracking', 'Usage Monitoring', 'Cost Optimization'], status: 'available', setupTime: '5 min' },
    { id: 'zoom', name: 'Zoom', description: 'Track meeting licenses, monitor usage', icon: '📹', category: 'Communication', features: ['License Management', 'Usage Analytics'], status: 'coming-soon', setupTime: '3 min' },
    { id: 'asana', name: 'Asana', description: 'Project management tool tracking', icon: '📊', category: 'Productivity', features: ['Seat Tracking', 'Usage Reports'], status: 'coming-soon', setupTime: '3 min' },
  ];

  const handleConnect = (integrationId) => {
    const next = connectedIntegrations.includes(integrationId)
      ? connectedIntegrations.filter(id => id !== integrationId)
      : [...connectedIntegrations, integrationId];
    setConnectedIntegrations(next);
    localStorage.setItem('sg_connected_integrations', JSON.stringify(next));
  };

  const isConnected = (id) => connectedIntegrations.includes(id);

  const filteredIntegrations = useMemo(() => {
    return integrations.filter(integration => {
      const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           integration.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || integration.category === selectedCategory;
      const matchesStatus = selectedStatus === 'all' ||
                           (selectedStatus === 'connected' && isConnected(integration.id)) ||
                           (selectedStatus === 'available' && integration.status === 'available' && !isConnected(integration.id)) ||
                           (selectedStatus === 'coming-soon' && integration.status === 'coming-soon');
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [searchQuery, selectedCategory, selectedStatus, connectedIntegrations]);

  const categories = ['all', ...new Set(integrations.map(i => i.category))];
  const connectedCount = connectedIntegrations.length;
  const availableCount = integrations.filter(i => i.status === 'available' && !isConnected(i.id)).length;
  const comingSoonCount = integrations.filter(i => i.status === 'coming-soon').length;

  return (
    <div className="space-y-6 w-full min-w-0">
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-4 bg-blue-500/20 rounded-2xl">
            <Plug className="h-8 w-8 text-blue-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-black text-white">{t("integration_marketplace")}</h2>
            <p className="text-slate-400">Connect your tools to automate SaaS management</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 rounded-xl p-4 text-center border border-slate-800">
            <div className="text-xl md:text-3xl font-black text-blue-400">{integrations.length}</div>
            <div className="text-sm text-slate-400 mt-1">Total</div>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-4 text-center border border-slate-800">
            <div className="text-xl md:text-3xl font-black text-emerald-400">{connectedCount}</div>
            <div className="text-sm text-slate-400 mt-1">{t('connected')}</div>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-4 text-center border border-slate-800">
            <div className="text-xl md:text-3xl font-black text-purple-400">{availableCount}</div>
            <div className="text-sm text-slate-400 mt-1">{'Available'}</div>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-4 text-center border border-slate-800">
            <div className="text-xl md:text-3xl font-black text-orange-400">{comingSoonCount}</div>
            <div className="text-sm text-slate-400 mt-1">{t('coming_soon_label')}</div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input type="text" placeholder={t('search_integrations')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500" />
          </div>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500">
            {categories.map(cat => <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>)}
          </select>
          <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500">
            <option value="all">{t('all_status')}</option>
            <option value="connected">{t('connected')}</option>
            <option value="available">{'Available'}</option>
            <option value="coming-soon">{t('coming_soon_label')}</option>
          </select>
        </div>
      </div>

      {filteredIntegrations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIntegrations.map(integration => {
            const connected = isConnected(integration.id);
            const comingSoon = integration.status === 'coming-soon';
            return (
              <div key={integration.id} className="relative bg-slate-900 border rounded-2xl p-6 flex flex-col min-h-[380px] transition-all hover:shadow-lg"
                style={{ borderColor: connected ? 'rgba(16, 185, 129, 0.5)' : comingSoon ? 'rgba(71, 85, 105, 1)' : 'rgba(30, 41, 59, 1)', backgroundColor: connected ? 'rgba(16, 185, 129, 0.05)' : 'rgb(15, 23, 42)', opacity: comingSoon ? 0.7 : 1 }}>
                <div className="absolute top-4 right-4">
                  {connected && <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full flex items-center gap-1"><CheckCircle className="h-3 w-3" />Connected</span>}
                  {comingSoon && <span className="px-3 py-1 bg-slate-700 text-slate-400 text-xs font-bold rounded-full">Coming Soon</span>}
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-2xl md:text-5xl">{integration.icon}</div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-white">{integration.name}</h4>
                    <div className="text-xs text-slate-500 mt-1">⏱️ {integration.setupTime} setup</div>
                  </div>
                </div>
                <p className="text-sm text-slate-400 mb-4">{integration.description}</p>
                <div className="space-y-2 mb-4 flex-grow">
                  {integration.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-slate-300">
                      <Check className="h-4 w-4 text-blue-400 flex-shrink-0" />
                      {feature}
                    </div>
                  ))}
                </div>
                <button onClick={() => !comingSoon && handleConnect(integration.id)} disabled={comingSoon}
                  className="w-full py-3 rounded-xl font-bold transition-all"
                  style={{ backgroundColor: connected ? 'rgb(71, 85, 105)' : comingSoon ? 'rgb(71, 85, 105)' : 'rgb(37, 99, 235)', color: comingSoon ? 'rgb(148, 163, 184)' : 'white', cursor: comingSoon ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={(e) => { if (!comingSoon) e.currentTarget.style.backgroundColor = connected ? 'rgb(51, 65, 85)' : 'rgb(29, 78, 216)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = connected ? 'rgb(71, 85, 105)' : comingSoon ? 'rgb(71, 85, 105)' : 'rgb(37, 99, 235)'; }}>
                  {connected ? 'Disconnect' : comingSoon ? t('coming_soon_label') : 'Connect'}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="text-2xl md:text-5xl mb-4">🔍</div>
          <h3 className="text-xl font-bold text-white mb-2">{t('no_integrations_found')}</h3>
          <p className="text-slate-400">{t('filter_adjust')}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-2">{t('need_different_int')}</h3>
          <p className="text-slate-400 mb-4 text-sm">Let us know which tools you'd like us to support.</p>
          <a href={"mailto:hello@stacklens.fr?subject=" + encodeURIComponent("Integration Request — Stacklens") + "&body=" + encodeURIComponent("Hi Stacklens Team,\n\nI would like to request integration support for the following application(s):\n\nApp Name: \nApp URL: \nCategory (e.g. CRM, HR, Engineering): \nApprox. # of users: \nPriority (High / Medium / Low): \n\n---\n(Add more apps below if needed)\n\nApp Name: \nApp URL: \nCategory: \nApprox. # of users: \nPriority: \n\n---\n\nAdditional context:\n\n\nThank you!")}
            className="block w-full px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-all text-center">
            Request Integration
          </a>
        </div>
        <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-2">{t('need_help')}</h3>
          <p className="text-slate-400 mb-4 text-sm">Our team is here to help you optimize your integrations.</p>
          <a href={"mailto:hello@stacklens.fr?subject=" + encodeURIComponent("Support Request — Stacklens") + "&body=" + encodeURIComponent("Hi Stacklens Support,\n\nI need help with:\n\n[ ] Integration setup\n[ ] Data import / sync issues\n[ ] Billing question\n[ ] Bug report\n[ ] Feature request\n[ ] Other\n\nDescription of the issue:\n\n\nSteps to reproduce (if bug):\n1. \n2. \n3. \n\nBrowser: " + navigator.userAgent.split(' ').pop() + "\nAccount: " + (JSON.parse(localStorage.getItem('accessguard_v1') || '{}')?.user?.email || 'N/A') + "\n\nThank you!")}
            className="block w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all text-center">
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}

export function IntegrationsPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  return (
    <AppShell title={t("nav_integrations")}>
      <IntegrationConnectors />
    </AppShell>
  );
}
