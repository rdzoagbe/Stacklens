import React, { useState, useMemo, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Check, CheckCircle, Eye, EyeOff, Loader, Plug, RefreshCw, Search, Users, X } from 'lucide-react';
import { useLang } from '../../contexts/LangContext';
import { useTranslation } from '../../translations';
import { useDbQuery, useDbMutations } from '../../hooks/useDbQuery';
import { AppShell } from '../../components/AppShell';

// ── Google Workspace OAuth + Directory API ────────────────────────────────
const GWS_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GWS_SCOPE = 'https://www.googleapis.com/auth/admin.directory.user.readonly';
const DIR_API = 'https://admin.googleapis.com/admin/directory/v1/users';

function loadGIS() {
  return new Promise((resolve) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    if (document.getElementById('gis-script')) {
      // Script tag already injected, wait for it
      const poll = setInterval(() => {
        if (window.google?.accounts?.oauth2) { clearInterval(poll); resolve(); }
      }, 50);
      return;
    }
    const s = document.createElement('script');
    s.id = 'gis-script';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

async function fetchAllWorkspaceUsers(accessToken) {
  const users = [];
  let pageToken = '';
  do {
    const url = new URL(DIR_API);
    url.searchParams.set('customer', 'my_customer');
    url.searchParams.set('maxResults', '500');
    url.searchParams.set('orderBy', 'email');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.error?.message || `HTTP ${res.status}`;
      if (res.status === 403) throw new Error('Permission denied. The authorising account must be a Google Workspace admin with Directory read access.');
      throw new Error(msg);
    }
    const data = await res.json();
    if (data.users) users.push(...data.users);
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return users;
}

function mapGoogleUser(u) {
  return {
    full_name:  u.name?.fullName || u.primaryEmail.split('@')[0],
    email:      u.primaryEmail,
    department: u.organizations?.[0]?.department || u.orgUnitPath?.replace(/^\//, '').split('/')[0] || '',
    role:       u.organizations?.[0]?.title || '',
    status:     u.suspended ? 'inactive' : 'active',
    start_date: u.creationTime ? u.creationTime.slice(0, 10) : '',
    end_date:   '',
  };
}

// ── Slack Bot Token + users.list ─────────────────────────────────────────
const SLACK_API = 'https://slack.com/api';
const SLACK_TOKEN_KEY   = 'sg_slack_token';
const SLACK_CHANNEL_KEY = 'sg_slack_channel';
const SLACK_SYNC_KEY    = 'sg_slack_last_sync';

async function fetchAllSlackUsers(token) {
  const members = [];
  let cursor = '';
  do {
    const params = new URLSearchParams({ limit: '200', include_locale: 'false' });
    if (cursor) params.set('cursor', cursor);
    const res = await fetch(`${SLACK_API}/users.list?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.ok) {
      if (data.error === 'missing_scope') throw new Error('Bot token needs users:read and users:read.email scopes. Re-create the token with both scopes enabled.');
      if (data.error === 'invalid_auth' || data.error === 'not_authed') throw new Error('Invalid Bot Token. Check that you copied the full xoxb-… token.');
      throw new Error(data.error || 'Slack API error');
    }
    const real = (data.members || []).filter(m => !m.is_bot && !m.deleted && m.id !== 'USLACKBOT');
    members.push(...real);
    cursor = data.response_metadata?.next_cursor || '';
  } while (cursor);
  return members;
}

function mapSlackUser(u) {
  const p = u.profile || {};
  return {
    full_name:  p.real_name || p.display_name || u.name || '',
    email:      p.email || '',
    department: p.fields?.['Xf...']?.value || '',
    role:       p.title || '',
    status:     u.deleted ? 'inactive' : 'active',
    start_date: '',
    end_date:   '',
  };
}

// ── Microsoft 365 / Azure AD via MSAL ────────────────────────────────────
const M365_CLIENT_ID  = import.meta.env.VITE_AZURE_CLIENT_ID;
const GRAPH_SCOPES    = ['https://graph.microsoft.com/User.Read.All'];
const GRAPH_USERS_API = 'https://graph.microsoft.com/v1.0/users';
const M365_SYNC_KEY   = 'sg_m365_last_sync';

let _msalApp = null;

async function getMSALApp() {
  if (_msalApp) return _msalApp;
  const { PublicClientApplication } = await import('@azure/msal-browser');
  const app = new PublicClientApplication({
    auth: {
      clientId: M365_CLIENT_ID,
      authority: 'https://login.microsoftonline.com/organizations',
      redirectUri: window.location.origin,
    },
    cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false },
    system: { loggerOptions: { loggerCallback: () => {}, logLevel: 3 } },
  });
  await app.initialize();
  _msalApp = app;
  return app;
}

async function acquireMSToken() {
  const app = await getMSALApp();
  const accounts = app.getAllAccounts();
  if (accounts.length) {
    try {
      const r = await app.acquireTokenSilent({ scopes: GRAPH_SCOPES, account: accounts[0] });
      return r.accessToken;
    } catch { /* fall through to popup */ }
  }
  const r = await app.loginPopup({ scopes: GRAPH_SCOPES });
  return r.accessToken;
}

async function fetchAllGraphUsers(accessToken) {
  const users = [];
  let url = `${GRAPH_USERS_API}?$select=displayName,mail,userPrincipalName,department,jobTitle,accountEnabled&$top=999`;
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) throw new Error('Permission denied. The signing-in user must be a Global Administrator and the app needs User.Read.All admin consent.');
      throw new Error(body.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data.value) users.push(...data.value.filter(u => u.mail || u.userPrincipalName));
    url = data['@odata.nextLink'] || null;
  }
  return users;
}

function mapMicrosoftUser(u) {
  return {
    full_name:  u.displayName || (u.mail || u.userPrincipalName).split('@')[0],
    email:      u.mail || u.userPrincipalName,
    department: u.department || '',
    role:       u.jobTitle || '',
    status:     u.accountEnabled !== false ? 'active' : 'inactive',
    start_date: '',
    end_date:   '',
  };
}

// ── GitHub PAT + org members ─────────────────────────────────────────────
const GITHUB_TOKEN_KEY = 'sg_github_token';
const GITHUB_ORG_KEY   = 'sg_github_org';
const GITHUB_SYNC_KEY  = 'sg_github_last_sync';
const GITHUB_API       = 'https://api.github.com';

async function fetchAllGitHubMembers(token, org) {
  const members = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${GITHUB_API}/orgs/${encodeURIComponent(org)}/members?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    });
    if (!res.ok) {
      if (res.status === 404)  throw new Error(`Organisation "${org}" not found. Check the org name (no spaces, use the URL slug).`);
      if (res.status === 403)  throw new Error('Access denied. Ensure the token has read:org scope and that your account is a member of the organisation (required if member visibility is private).');
      if (res.status === 401)  throw new Error('Invalid token. Check that you copied the full ghp_… token.');
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `HTTP ${res.status}`);
    }
    const page_members = await res.json();
    if (!page_members.length) break;
    members.push(...page_members);
    if (page_members.length < 100) break;
    page++;
  }
  return members;
}

async function enrichGitHubMember(token, login) {
  const res = await fetch(`${GITHUB_API}/users/${encodeURIComponent(login)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) return null;
  return res.json();
}

function mapGitHubUser(member, detail) {
  return {
    full_name:  detail?.name || member.login,
    email:      detail?.email || '',
    department: '',
    role:       detail?.bio?.slice(0, 60) || '',
    status:     'active',
    start_date: '',
    end_date:   '',
  };
}

// ── GitHub PAT modal ─────────────────────────────────────────────────────
const GITHUB_STEPS = [
  { n: 1, text: 'Go to github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)' },
  { n: 2, text: 'Click "Generate new token (classic)"' },
  { n: 3, text: 'Give it a note (e.g. "Stacklens") and select scope: read:org' },
  { n: 4, text: 'Click "Generate token" and copy it (starts with ghp_)' },
  { n: 5, text: 'Enter your GitHub organisation slug below (the name in the URL, e.g. "acme-corp")' },
];

function GitHubTokenModal({ onSubmit, onClose, loading }) {
  const [token, setToken] = useState('');
  const [org, setOrg]     = useState(localStorage.getItem(GITHUB_ORG_KEY) || '');
  const [showToken, setShowToken] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
      <div className="bg-slate-900 rounded-3xl border border-slate-700 p-8 max-w-lg w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🐙</span>
            <div>
              <h3 className="text-xl font-bold text-white">Connect GitHub</h3>
              <p className="text-sm text-slate-400">One-time configuration required</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>
        <ol className="space-y-3 mb-6">
          {GITHUB_STEPS.map(item => (
            <li key={item.n} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{item.n}</span>
              <span className="text-sm text-slate-300">{item.text}</span>
            </li>
          ))}
        </ol>
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-300 mb-2">Personal Access Token</label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="ghp_…"
              className="w-full pr-10 pl-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 font-mono text-sm"
            />
            <button type="button" onClick={() => setShowToken(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">Stored locally in your browser. Never sent to Stacklens servers.</p>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-300 mb-2">Organisation slug</label>
          <input
            type="text"
            value={org}
            onChange={e => setOrg(e.target.value)}
            placeholder="acme-corp"
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 text-sm"
          />
          <p className="text-xs text-slate-500 mt-1.5">The slug from your GitHub org URL: github.com/&lt;slug&gt;</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold text-slate-300 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(token.trim(), org.trim())}
            disabled={!token.trim() || !org.trim() || loading}
            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
            {loading ? <><Loader className="h-4 w-4 animate-spin" /> Syncing…</> : 'Connect & Sync'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Slack token input modal ───────────────────────────────────────────────
const SLACK_STEPS = [
  { n: 1, text: 'Go to api.slack.com/apps → Create New App → From scratch' },
  { n: 2, text: 'Name the app (e.g. "Stacklens") and choose your workspace' },
  { n: 3, text: 'Go to OAuth & Permissions → Bot Token Scopes → Add: users:read, users:read.email, and chat:write' },
  { n: 4, text: 'Click "Install to Workspace" and approve the permissions' },
  { n: 5, text: 'Invite the bot to your alerts channel: /invite @Stacklens' },
  { n: 6, text: 'Copy the Bot User OAuth Token (starts with xoxb-)' },
];

function SlackTokenModal({ onSubmit, onClose, loading }) {
  const [token, setToken] = useState('');
  const [channel, setChannel] = useState(localStorage.getItem(SLACK_CHANNEL_KEY) || '#renewals');
  const [showToken, setShowToken] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
      <div className="bg-slate-900 rounded-3xl border border-slate-700 p-8 max-w-lg w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">💬</span>
            <div>
              <h3 className="text-xl font-bold text-white">Connect Slack</h3>
              <p className="text-sm text-slate-400">One-time configuration required</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>
        <ol className="space-y-3 mb-6">
          {SLACK_STEPS.map(item => (
            <li key={item.n} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{item.n}</span>
              <span className="text-sm text-slate-300">{item.text}</span>
            </li>
          ))}
        </ol>
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-300 mb-2">Bot User OAuth Token</label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="xoxb-…"
              className="w-full pr-10 pl-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono text-sm"
            />
            <button type="button" onClick={() => setShowToken(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">Stored locally in your browser. Never sent to Stacklens servers.</p>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-300 mb-2">Alerts channel</label>
          <input
            type="text"
            value={channel}
            onChange={e => setChannel(e.target.value)}
            placeholder="#renewals"
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 text-sm"
          />
          <p className="text-xs text-slate-500 mt-1.5">Renewal alerts will be sent here. The bot must be invited to the channel first.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold text-slate-300 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(token.trim(), channel.trim() || '#renewals')}
            disabled={!token.trim() || loading}
            className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
            {loading ? <><Loader className="h-4 w-4 animate-spin" /> Syncing…</> : 'Connect & Sync'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Setup instructions modal ──────────────────────────────────────────────
function SetupModal({ integration, onClose }) {
  const steps = {
    'google-workspace': [
      { n: 1, text: 'Go to console.cloud.google.com → APIs & Services → Library' },
      { n: 2, text: 'Search for "Admin SDK API" and enable it' },
      { n: 3, text: 'Go to APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application)' },
      { n: 4, text: 'Add your app domain to Authorised JavaScript origins (e.g. https://stacklens.fr)' },
      { n: 5, text: 'Copy the Client ID and add it as VITE_GOOGLE_CLIENT_ID in your .env file' },
      { n: 6, text: 'On the OAuth consent screen add scope: admin.directory.user.readonly' },
      { n: 7, text: 'The user who authorises must be a Google Workspace admin' },
    ],
    'microsoft-365': [
      { n: 1, text: 'Go to portal.azure.com → Azure Active Directory → App registrations → New registration' },
      { n: 2, text: 'Name: "Stacklens", Supported account types: "Accounts in this organizational directory only"' },
      { n: 3, text: 'Redirect URI: choose "Single-page application (SPA)" and add your app domain' },
      { n: 4, text: 'Go to API permissions → Add a permission → Microsoft Graph → Delegated → User.Read.All' },
      { n: 5, text: 'Click "Grant admin consent for [your org]" (requires Global Administrator role)' },
      { n: 6, text: 'Copy the Application (client) ID and add it as VITE_AZURE_CLIENT_ID in your .env file' },
    ],
  };
  const notes = {
    'google-workspace': (
      <p className="text-xs text-amber-300">
        <strong>Note:</strong> <code className="bg-black/30 px-1 rounded">admin.directory.user.readonly</code> is a restricted Google scope.
        For internal use it works immediately. For a public app, Google requires an OAuth app verification review.
      </p>
    ),
    'microsoft-365': (
      <p className="text-xs text-amber-300">
        <strong>Note:</strong> <code className="bg-black/30 px-1 rounded">User.Read.All</code> requires tenant admin consent.
        The first user to connect must be a Global Administrator — they'll see a consent screen covering all users in the org.
      </p>
    ),
  };
  const items = steps[integration?.id] || [];
  const note  = notes[integration?.id] || null;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
      <div className="bg-slate-900 rounded-3xl border border-slate-700 p-8 max-w-lg w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{integration?.icon}</span>
            <div>
              <h3 className="text-xl font-bold text-white">Set up {integration?.name}</h3>
              <p className="text-sm text-slate-400">One-time configuration required</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>
        <ol className="space-y-3 mb-6">
          {items.map(item => (
            <li key={item.n} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{item.n}</span>
              <span className="text-sm text-slate-300">{item.text}</span>
            </li>
          ))}
        </ol>
        {note && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">{note}</div>
        )}
        <button onClick={onClose} className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold text-slate-300 transition-colors">
          Close — I'll set it up
        </button>
      </div>
    </div>
  );
}

// ── Sync result banner ────────────────────────────────────────────────────
function SyncResult({ result, onDismiss }) {
  if (!result) return null;
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${result.error ? 'border-rose-500/30 bg-rose-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>
      {result.error
        ? <X className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
        : <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        {result.error
          ? <p className="text-sm font-semibold text-rose-400">Sync failed: {result.error}</p>
          : (
            <>
              <p className="text-sm font-semibold text-emerald-400">
                {{ 'slack': 'Slack', 'microsoft-365': 'Microsoft 365', 'github': 'GitHub' }[result.source] || 'Google Workspace'} sync complete
              </p>
              <p className="text-xs text-emerald-300/80 mt-0.5">
                {result.added} new · {result.updated} updated · {result.skipped} unchanged — {result.total} users total
              </p>
            </>
          )}
      </div>
      <button onClick={onDismiss} className="text-slate-500 hover:text-white flex-shrink-0"><X className="h-4 w-4" /></button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export function IntegrationConnectors() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db } = useDbQuery();
  const muts = useDbMutations();

  const _savedConnected = (() => {
    try { return JSON.parse(localStorage.getItem('sg_connected_integrations') || '[]'); }
    catch { return []; }
  })();
  const [connectedIntegrations, setConnectedIntegrations] = useState(_savedConnected);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [connecting, setConnecting] = useState(null);
  const [setupModal, setSetupModal] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [slackTokenModal, setSlackTokenModal]   = useState(false);
  const [slackSyncing, setSlackSyncing]         = useState(false);
  const [githubTokenModal, setGithubTokenModal] = useState(false);
  const [githubSyncing, setGithubSyncing]       = useState(false);

  // Preload GIS and MSAL so popups fire synchronously on click
  useEffect(() => {
    if (GWS_CLIENT_ID) loadGIS().catch(() => {});
    if (M365_CLIENT_ID) getMSALApp().catch(() => {});
  }, []);

  const integrations = [
    {
      id: 'google-workspace',
      name: 'Google Workspace',
      description: 'Import users from your Google Workspace directory — name, email, department, job title, and status synced automatically.',
      icon: '🔵',
      category: 'Identity & Directory',
      features: ['User Sync', 'Department & role import', 'Active / suspended status'],
      status: 'available',
      setupTime: '5 min',
      requiresSetup: !GWS_CLIENT_ID,
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Import workspace members into your employee directory — name, email, and job title synced automatically.',
      icon: '💬',
      category: 'Communication',
      features: ['User Sync', 'Email & name import', 'Active member filtering'],
      status: 'available',
      setupTime: '5 min',
    },
    {
      id: 'microsoft-365',
      name: 'Microsoft 365',
      description: 'Import users from Azure Active Directory — display name, email, department, job title, and account status synced automatically.',
      icon: '🟦',
      category: 'Identity & Directory',
      features: ['Azure AD User Sync', 'Department & job title import', 'Enabled/disabled status'],
      status: 'available',
      setupTime: '10 min',
      requiresSetup: !M365_CLIENT_ID,
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'Import organisation members into your employee directory — display name, email, and bio synced automatically.',
      icon: '🐙',
      category: 'Development',
      features: ['Org member sync', 'Name & email import', 'Active member filtering'],
      status: 'available',
      setupTime: '3 min',
    },
    {
      id: 'okta',
      name: 'Okta',
      description: 'SSO integration, user provisioning, app discovery',
      icon: '🔐',
      category: 'Identity & Directory',
      features: ['SSO', 'User Provisioning', 'App Discovery'],
      status: 'coming-soon',
      setupTime: '10 min',
    },
    {
      id: 'salesforce',
      name: 'Salesforce',
      description: 'Track licenses, monitor usage, optimize seats',
      icon: '☁️',
      category: 'CRM',
      features: ['License Tracking', 'Usage Monitoring', 'Cost Optimization'],
      status: 'coming-soon',
      setupTime: '5 min',
    },
    {
      id: 'zoom',
      name: 'Zoom',
      description: 'Track meeting licenses, monitor usage',
      icon: '📹',
      category: 'Communication',
      features: ['License Management', 'Usage Analytics'],
      status: 'coming-soon',
      setupTime: '3 min',
    },
    {
      id: 'asana',
      name: 'Asana',
      description: 'Project management tool tracking',
      icon: '📊',
      category: 'Productivity',
      features: ['Seat Tracking', 'Usage Reports'],
      status: 'coming-soon',
      setupTime: '3 min',
    },
  ];

  // ── Google Workspace real OAuth + Directory sync ──────────────────────
  const handleGoogleWorkspaceConnect = useCallback(async () => {
    if (!GWS_CLIENT_ID) {
      setSetupModal(integrations.find(i => i.id === 'google-workspace'));
      return;
    }

    setConnecting('google-workspace');
    setSyncResult(null);

    try {
      await loadGIS();

      const accessToken = await new Promise((resolve, reject) => {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GWS_CLIENT_ID,
          scope: GWS_SCOPE,
          callback: (resp) => {
            if (resp.error) reject(new Error(resp.error_description || resp.error));
            else resolve(resp.access_token);
          },
          error_callback: (err) => reject(new Error(err.type || 'OAuth error')),
        });
        client.requestAccessToken({ prompt: 'consent' });
      });

      const gwsUsers = await fetchAllWorkspaceUsers(accessToken);
      const incoming = gwsUsers.map(mapGoogleUser);

      // Merge: compare against existing employees by email
      const existingByEmail = Object.fromEntries(
        (db?.employees || []).map(e => [(e.email || '').toLowerCase(), e])
      );

      const toAdd = [];
      const toUpdate = [];
      let skipped = 0;

      for (const u of incoming) {
        const key = u.email.toLowerCase();
        const existing = existingByEmail[key];
        if (!existing) {
          toAdd.push(u);
        } else {
          // Only update fields that came from GWS previously (don't overwrite manual edits to other fields)
          const patch = {};
          if (u.full_name && u.full_name !== existing.full_name) patch.full_name = u.full_name;
          if (u.department && !existing.department) patch.department = u.department;
          if (u.role && !existing.role) patch.role = u.role;
          if (u.status !== existing.status) patch.status = u.status;
          if (Object.keys(patch).length > 0) toUpdate.push({ id: existing.id, patch });
          else skipped++;
        }
      }

      // Bulk import new employees (respects plan limits)
      if (toAdd.length > 0) {
        await muts.bulkImport.mutateAsync({ kind: 'employees', records: toAdd });
      }

      // Apply updates to existing employees
      for (const { id, patch } of toUpdate) {
        await muts.updateEmployee.mutateAsync({ id, patch });
      }

      const next = connectedIntegrations.includes('google-workspace')
        ? connectedIntegrations
        : [...connectedIntegrations, 'google-workspace'];
      setConnectedIntegrations(next);
      localStorage.setItem('sg_connected_integrations', JSON.stringify(next));
      localStorage.setItem('sg_gws_last_sync', new Date().toISOString());

      setSyncResult({
        total: incoming.length,
        added: toAdd.length,
        updated: toUpdate.length,
        skipped,
      });
    } catch (err) {
      if (err.message === 'popup_closed_by_user' || err.message === 'access_denied') {
        // User cancelled — silent
        return;
      }
      setSyncResult({ error: err.message });
      toast.error('Google Workspace sync failed');
    } finally {
      setConnecting(null);
    }
  }, [db?.employees, connectedIntegrations, muts]);

  const handleSlackTokenSubmit = useCallback(async (token, channel = '#renewals') => {
    if (!token) return;
    setSlackSyncing(true);
    setSyncResult(null);
    try {
      const slackUsers = await fetchAllSlackUsers(token);
      const incoming = slackUsers.map(mapSlackUser).filter(u => u.email);

      const existingByEmail = Object.fromEntries(
        (db?.employees || []).map(e => [(e.email || '').toLowerCase(), e])
      );

      const toAdd = [];
      const toUpdate = [];
      let skipped = 0;

      for (const u of incoming) {
        const key = u.email.toLowerCase();
        const existing = existingByEmail[key];
        if (!existing) {
          toAdd.push(u);
        } else {
          const patch = {};
          if (u.full_name && u.full_name !== existing.full_name) patch.full_name = u.full_name;
          if (u.role && !existing.role) patch.role = u.role;
          if (u.status !== existing.status) patch.status = u.status;
          if (Object.keys(patch).length > 0) toUpdate.push({ id: existing.id, patch });
          else skipped++;
        }
      }

      if (toAdd.length > 0) {
        await muts.bulkImport.mutateAsync({ kind: 'employees', records: toAdd });
      }
      for (const { id, patch } of toUpdate) {
        await muts.updateEmployee.mutateAsync({ id, patch });
      }

      // Persist token, channel, and connected state
      localStorage.setItem(SLACK_TOKEN_KEY, token);
      localStorage.setItem(SLACK_CHANNEL_KEY, channel);
      localStorage.setItem(SLACK_SYNC_KEY, new Date().toISOString());
      const next = connectedIntegrations.includes('slack')
        ? connectedIntegrations
        : [...connectedIntegrations, 'slack'];
      setConnectedIntegrations(next);
      localStorage.setItem('sg_connected_integrations', JSON.stringify(next));

      setSlackTokenModal(false);
      setSyncResult({
        source: 'slack',
        total: incoming.length,
        added: toAdd.length,
        updated: toUpdate.length,
        skipped,
      });
    } catch (err) {
      setSyncResult({ source: 'slack', error: err.message });
      toast.error('Slack sync failed');
    } finally {
      setSlackSyncing(false);
    }
  }, [db?.employees, connectedIntegrations, muts]);

  const handleSlackResync = useCallback(async () => {
    const token = localStorage.getItem(SLACK_TOKEN_KEY);
    if (!token) { setSlackTokenModal(true); return; }
    await handleSlackTokenSubmit(token);
  }, [handleSlackTokenSubmit]);

  const handleGitHubTokenSubmit = useCallback(async (token, org) => {
    if (!token || !org) return;
    setGithubSyncing(true);
    setSyncResult(null);
    try {
      const members = await fetchAllGitHubMembers(token, org);

      // Enrich up to 100 members with full profile (name + email)
      // GitHub's /orgs/{org}/members returns minimal data; /users/{login} has the rest
      const ENRICH_LIMIT = 100;
      const enriched = await Promise.all(
        members.slice(0, ENRICH_LIMIT).map(m => enrichGitHubMember(token, m.login))
      );
      const incoming = members.map((m, i) => mapGitHubUser(m, enriched[i] || null));

      const existingByEmail = Object.fromEntries(
        (db?.employees || []).map(e => [(e.email || '').toLowerCase(), e])
      );
      // Also index by GitHub login for members without email
      const existingByLogin = Object.fromEntries(
        (db?.employees || []).map(e => [e.github_login || '', e]).filter(([k]) => k)
      );

      const toAdd = [], toUpdate = [];
      let skipped = 0;
      for (let i = 0; i < incoming.length; i++) {
        const u = { ...incoming[i], github_login: members[i].login };
        const byEmail   = u.email ? existingByEmail[u.email.toLowerCase()] : null;
        const byLogin   = existingByLogin[members[i].login];
        const existing  = byEmail || byLogin;
        if (!existing) {
          toAdd.push(u);
        } else {
          const patch = {};
          if (u.full_name && u.full_name !== members[i].login && u.full_name !== existing.full_name) patch.full_name = u.full_name;
          if (u.email && !existing.email) patch.email = u.email;
          if (!existing.github_login) patch.github_login = members[i].login;
          if (Object.keys(patch).length > 0) toUpdate.push({ id: existing.id, patch });
          else skipped++;
        }
      }

      if (toAdd.length > 0) await muts.bulkImport.mutateAsync({ kind: 'employees', records: toAdd });
      for (const { id, patch } of toUpdate) await muts.updateEmployee.mutateAsync({ id, patch });

      localStorage.setItem(GITHUB_TOKEN_KEY, token);
      localStorage.setItem(GITHUB_ORG_KEY, org);
      localStorage.setItem(GITHUB_SYNC_KEY, new Date().toISOString());
      const next = connectedIntegrations.includes('github')
        ? connectedIntegrations
        : [...connectedIntegrations, 'github'];
      setConnectedIntegrations(next);
      localStorage.setItem('sg_connected_integrations', JSON.stringify(next));

      setGithubTokenModal(false);
      setSyncResult({ source: 'github', total: incoming.length, added: toAdd.length, updated: toUpdate.length, skipped });
    } catch (err) {
      setSyncResult({ source: 'github', error: err.message });
      toast.error('GitHub sync failed');
    } finally {
      setGithubSyncing(false);
    }
  }, [db?.employees, connectedIntegrations, muts]);

  const handleGitHubResync = useCallback(async () => {
    const token = localStorage.getItem(GITHUB_TOKEN_KEY);
    const org   = localStorage.getItem(GITHUB_ORG_KEY);
    if (!token || !org) { setGithubTokenModal(true); return; }
    await handleGitHubTokenSubmit(token, org);
  }, [handleGitHubTokenSubmit]);

  const handleMicrosoftConnect = useCallback(async () => {
    if (!M365_CLIENT_ID) {
      setSetupModal(integrations.find(i => i.id === 'microsoft-365'));
      return;
    }
    setConnecting('microsoft-365');
    setSyncResult(null);
    try {
      const accessToken = await acquireMSToken();
      const msUsers = await fetchAllGraphUsers(accessToken);
      const incoming = msUsers.map(mapMicrosoftUser);

      const existingByEmail = Object.fromEntries(
        (db?.employees || []).map(e => [(e.email || '').toLowerCase(), e])
      );
      const toAdd = [], toUpdate = [];
      let skipped = 0;
      for (const u of incoming) {
        const key = u.email.toLowerCase();
        const existing = existingByEmail[key];
        if (!existing) {
          toAdd.push(u);
        } else {
          const patch = {};
          if (u.full_name && u.full_name !== existing.full_name) patch.full_name = u.full_name;
          if (u.department && !existing.department) patch.department = u.department;
          if (u.role && !existing.role) patch.role = u.role;
          if (u.status !== existing.status) patch.status = u.status;
          if (Object.keys(patch).length > 0) toUpdate.push({ id: existing.id, patch });
          else skipped++;
        }
      }

      if (toAdd.length > 0) await muts.bulkImport.mutateAsync({ kind: 'employees', records: toAdd });
      for (const { id, patch } of toUpdate) await muts.updateEmployee.mutateAsync({ id, patch });

      const next = connectedIntegrations.includes('microsoft-365')
        ? connectedIntegrations
        : [...connectedIntegrations, 'microsoft-365'];
      setConnectedIntegrations(next);
      localStorage.setItem('sg_connected_integrations', JSON.stringify(next));
      localStorage.setItem(M365_SYNC_KEY, new Date().toISOString());

      setSyncResult({ source: 'microsoft-365', total: incoming.length, added: toAdd.length, updated: toUpdate.length, skipped });
    } catch (err) {
      if (err.errorCode === 'user_cancelled' || err.message?.includes('user_cancelled') || err.message?.includes('popup_closed')) return;
      setSyncResult({ source: 'microsoft-365', error: err.message });
      toast.error('Microsoft 365 sync failed');
    } finally {
      setConnecting(null);
    }
  }, [db?.employees, connectedIntegrations, muts]);

  const handleDisconnect = (integrationId) => {
    const next = connectedIntegrations.filter(id => id !== integrationId);
    setConnectedIntegrations(next);
    localStorage.setItem('sg_connected_integrations', JSON.stringify(next));
    if (integrationId === 'google-workspace') {
      localStorage.removeItem('sg_gws_last_sync');
      setSyncResult(null);
    }
    if (integrationId === 'slack') {
      localStorage.removeItem(SLACK_TOKEN_KEY);
      localStorage.removeItem(SLACK_CHANNEL_KEY);
      localStorage.removeItem(SLACK_SYNC_KEY);
      setSyncResult(null);
    }
    if (integrationId === 'microsoft-365') {
      localStorage.removeItem(M365_SYNC_KEY);
      _msalApp = null;
      setSyncResult(null);
    }
    if (integrationId === 'github') {
      localStorage.removeItem(GITHUB_TOKEN_KEY);
      localStorage.removeItem(GITHUB_ORG_KEY);
      localStorage.removeItem(GITHUB_SYNC_KEY);
      setSyncResult(null);
    }
  };

  const handleConnect = (integration) => {
    if (connectedIntegrations.includes(integration.id)) {
      handleDisconnect(integration.id);
      return;
    }
    if (integration.id === 'google-workspace') { handleGoogleWorkspaceConnect(); return; }
    if (integration.id === 'slack')            { setSlackTokenModal(true); return; }
    if (integration.id === 'microsoft-365')    { handleMicrosoftConnect(); return; }
    if (integration.id === 'github')           { setGithubTokenModal(true); return; }
    // Others not yet implemented
  };

  const isConnected = (id) => connectedIntegrations.includes(id);
  const lastGWSSync    = localStorage.getItem('sg_gws_last_sync');
  const lastSlackSync  = localStorage.getItem(SLACK_SYNC_KEY);
  const lastM365Sync   = localStorage.getItem(M365_SYNC_KEY);
  const lastGitHubSync = localStorage.getItem(GITHUB_SYNC_KEY);

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
      {/* Sync result banner */}
      <SyncResult result={syncResult} onDismiss={() => setSyncResult(null)} />

      {/* Setup modal */}
      {setupModal && <SetupModal integration={setupModal} onClose={() => setSetupModal(null)} />}

      {/* Slack token modal */}
      {slackTokenModal && (
        <SlackTokenModal
          loading={slackSyncing}
          onSubmit={handleSlackTokenSubmit}
          onClose={() => setSlackTokenModal(false)}
        />
      )}

      {/* GitHub token modal */}
      {githubTokenModal && (
        <GitHubTokenModal
          loading={githubSyncing}
          onSubmit={handleGitHubTokenSubmit}
          onClose={() => setGithubTokenModal(false)}
        />
      )}

      {/* Stats header */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-4 bg-blue-500/20 rounded-2xl">
            <Plug className="h-8 w-8 text-blue-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-black text-white">{t("integration_marketplace")}</h2>
            <p className="text-slate-400">Connect your tools to automate SaaS management</p>
          </div>
          <div className="flex items-center gap-2">
            {isConnected('google-workspace') && lastGWSSync && (
              <button onClick={handleGoogleWorkspaceConnect} disabled={connecting === 'google-workspace'}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-colors disabled:opacity-50">
                {connecting === 'google-workspace'
                  ? <Loader className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                Re-sync Google
              </button>
            )}
            {isConnected('slack') && lastSlackSync && (
              <button onClick={handleSlackResync} disabled={slackSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-colors disabled:opacity-50">
                {slackSyncing
                  ? <Loader className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                Re-sync Slack
              </button>
            )}
            {isConnected('microsoft-365') && lastM365Sync && (
              <button onClick={handleMicrosoftConnect} disabled={connecting === 'microsoft-365'}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-colors disabled:opacity-50">
                {connecting === 'microsoft-365'
                  ? <Loader className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                Re-sync M365
              </button>
            )}
            {isConnected('github') && lastGitHubSync && (
              <button onClick={handleGitHubResync} disabled={githubSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-colors disabled:opacity-50">
                {githubSyncing
                  ? <Loader className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                Re-sync GitHub
              </button>
            )}
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
            <div className="text-sm text-slate-400 mt-1">Available</div>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-4 text-center border border-slate-800">
            <div className="text-xl md:text-3xl font-black text-orange-400">{comingSoonCount}</div>
            <div className="text-sm text-slate-400 mt-1">{t('coming_soon_label')}</div>
          </div>
        </div>
      </div>

      {/* Search and filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input type="text" placeholder={t('search_integrations')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500" />
          </div>
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
            className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500">
            {categories.map(cat => <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>)}
          </select>
          <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}
            className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500">
            <option value="all">{t('all_status')}</option>
            <option value="connected">{t('connected')}</option>
            <option value="available">Available</option>
            <option value="coming-soon">{t('coming_soon_label')}</option>
          </select>
        </div>
      </div>

      {/* Integration cards */}
      {filteredIntegrations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIntegrations.map(integration => {
            const connected = isConnected(integration.id);
            const comingSoon = integration.status === 'coming-soon';
            const isConnecting = connecting === integration.id;
            const needsSetup = integration.requiresSetup;

            return (
              <div key={integration.id}
                className="relative bg-slate-900 border rounded-2xl p-6 flex flex-col min-h-[380px] transition-all hover:shadow-lg"
                style={{
                  borderColor: connected ? 'rgba(16, 185, 129, 0.5)' : comingSoon ? 'rgba(71, 85, 105, 1)' : 'rgba(30, 41, 59, 1)',
                  backgroundColor: connected ? 'rgba(16, 185, 129, 0.05)' : 'rgb(15, 23, 42)',
                  opacity: comingSoon ? 0.7 : 1,
                }}>
                {/* Badge */}
                <div className="absolute top-4 right-4">
                  {connected && (
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Connected
                    </span>
                  )}
                  {comingSoon && (
                    <span className="px-3 py-1 bg-slate-700 text-slate-400 text-xs font-bold rounded-full">Coming Soon</span>
                  )}
                  {!connected && !comingSoon && needsSetup && (
                    <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-full">Setup Required</span>
                  )}
                </div>

                {/* Icon & title */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-2xl md:text-5xl">{integration.icon}</div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-white">{integration.name}</h4>
                    <div className="text-xs text-slate-500 mt-1">⏱️ {integration.setupTime} setup</div>
                  </div>
                </div>

                <p className="text-sm text-slate-400 mb-4">{integration.description}</p>

                {/* Last sync info */}
                {connected && integration.id === 'google-workspace' && lastGWSSync && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                    <RefreshCw className="h-3 w-3" />
                    Last synced {new Date(lastGWSSync).toLocaleString()}
                  </div>
                )}
                {connected && integration.id === 'slack' && lastSlackSync && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <RefreshCw className="h-3 w-3" />
                    Last synced {new Date(lastSlackSync).toLocaleString()}
                  </div>
                )}
                {connected && integration.id === 'slack' && localStorage.getItem(SLACK_CHANNEL_KEY) && (
                  <div className="flex items-center gap-1.5 text-xs text-purple-400 mb-3">
                    <span className="font-mono">🔔 alerts → {localStorage.getItem(SLACK_CHANNEL_KEY)}</span>
                  </div>
                )}
                {connected && integration.id === 'microsoft-365' && lastM365Sync && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                    <RefreshCw className="h-3 w-3" />
                    Last synced {new Date(lastM365Sync).toLocaleString()}
                  </div>
                )}
                {connected && integration.id === 'github' && lastGitHubSync && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                    <RefreshCw className="h-3 w-3" />
                    Last synced {new Date(lastGitHubSync).toLocaleString()}
                  </div>
                )}
                {connected && integration.id === 'github' && localStorage.getItem(GITHUB_ORG_KEY) && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
                    <span className="font-mono">🐙 org: {localStorage.getItem(GITHUB_ORG_KEY)}</span>
                  </div>
                )}
                {connected && ['google-workspace', 'slack', 'microsoft-365', 'github'].includes(integration.id) && db?.employees?.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 mb-3">
                    <Users className="h-3 w-3" />
                    {db.employees.length} employees in directory
                  </div>
                )}

                {/* Features */}
                <div className="space-y-2 mb-4 flex-grow">
                  {integration.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-slate-300">
                      <Check className="h-4 w-4 text-blue-400 flex-shrink-0" />
                      {feature}
                    </div>
                  ))}
                </div>

                {/* Action button */}
                {comingSoon ? (
                  <button disabled className="w-full py-3 rounded-xl font-bold text-slate-400 bg-slate-700 cursor-not-allowed">
                    {t('coming_soon_label')}
                  </button>
                ) : connected ? (
                  <div className="space-y-2">
                    {integration.id === 'google-workspace' && (
                      <button onClick={() => handleConnect(integration)} disabled={isConnecting}
                        className="w-full py-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm transition-colors flex items-center justify-center gap-2">
                        {isConnecting ? <><Loader className="h-4 w-4 animate-spin" /> Syncing…</> : <><RefreshCw className="h-4 w-4" /> Sync now</>}
                      </button>
                    )}
                    {integration.id === 'slack' && (
                      <button onClick={handleSlackResync} disabled={slackSyncing}
                        className="w-full py-2.5 rounded-xl font-bold bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm transition-colors flex items-center justify-center gap-2">
                        {slackSyncing ? <><Loader className="h-4 w-4 animate-spin" /> Syncing…</> : <><RefreshCw className="h-4 w-4" /> Sync now</>}
                      </button>
                    )}
                    {integration.id === 'microsoft-365' && (
                      <button onClick={handleMicrosoftConnect} disabled={isConnecting}
                        className="w-full py-2.5 rounded-xl font-bold bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm transition-colors flex items-center justify-center gap-2">
                        {isConnecting ? <><Loader className="h-4 w-4 animate-spin" /> Syncing…</> : <><RefreshCw className="h-4 w-4" /> Sync now</>}
                      </button>
                    )}
                    {integration.id === 'github' && (
                      <button onClick={handleGitHubResync} disabled={githubSyncing}
                        className="w-full py-2.5 rounded-xl font-bold bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm transition-colors flex items-center justify-center gap-2">
                        {githubSyncing ? <><Loader className="h-4 w-4 animate-spin" /> Syncing…</> : <><RefreshCw className="h-4 w-4" /> Sync now</>}
                      </button>
                    )}
                    <button onClick={() => handleDisconnect(integration.id)}
                      className="w-full py-2 rounded-xl font-semibold bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors">
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button onClick={() => handleConnect(integration)} disabled={isConnecting}
                    className="w-full py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors flex items-center justify-center gap-2">
                    {isConnecting ? <><Loader className="h-4 w-4 animate-spin" /> Connecting…</> : needsSetup ? '⚙️ View setup steps' : 'Connect'}
                  </button>
                )}
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

      {/* Footer links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-2">{t('need_different_int')}</h3>
          <p className="text-slate-400 mb-4 text-sm">Let us know which tools you'd like us to support.</p>
          <a href={"mailto:hello@stacklens.fr?subject=" + encodeURIComponent("Integration Request — Stacklens")}
            className="block w-full px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-all text-center">
            Request Integration
          </a>
        </div>
        <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-2">{t('need_help')}</h3>
          <p className="text-slate-400 mb-4 text-sm">Our team is here to help you set up your integrations.</p>
          <a href={"mailto:hello@stacklens.fr?subject=" + encodeURIComponent("Support Request — Stacklens")}
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
