import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Check, CheckCircle, Eye, EyeOff, Loader, Plug, RefreshCw, Search, Send, Users, X } from 'lucide-react';
import { useLang } from '../../contexts/LangContext';
import { useTranslation } from '../../translations';
import { useDbQuery, useDbMutations } from '../../hooks/useDbQuery';
import { AppShell } from '../../components/AppShell';
import { submitContactForm } from '../../lib/contact';
import { track } from '../../lib/analytics';
import { integrationCall } from '../../firebase-config';
import { purgeLegacyCredentials } from '../../lib/legacyCredentials';

// ── Google Workspace OAuth + Directory API ────────────────────────────────
const GWS_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GWS_SCOPE = 'https://www.googleapis.com/auth/admin.directory.user.readonly';
const DIR_API = 'https://admin.googleapis.com/admin/directory/v1/users';

function loadGIS() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const fail = () => {
      document.getElementById('gis-script')?.remove();
      reject(new Error('Google Identity Services failed to load. Check your network or browser extensions.'));
    };
    if (document.getElementById('gis-script')) {
      // Script tag already injected — poll until ready or timeout
      const deadline = Date.now() + 10_000;
      const poll = setInterval(() => {
        if (window.google?.accounts?.oauth2) { clearInterval(poll); resolve(); return; }
        if (Date.now() > deadline) { clearInterval(poll); fail(); }
      }, 50);
      return;
    }
    const s = document.createElement('script');
    const timeout = window.setTimeout(fail, 10_000);
    s.id = 'gis-script';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => { clearTimeout(timeout); resolve(); };
    s.onerror = () => { clearTimeout(timeout); fail(); };
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
      if (res.status === 401) throw new Error('Unauthorised. The OAuth token has expired or lacks admin.directory.user.readonly scope. Please reconnect.');
      if (res.status === 403) throw new Error('Permission denied. The authorising account must be a Google Workspace admin with Directory read access.');
      if (res.status === 404) throw new Error('Google Directory API endpoint not found. Ensure the Admin SDK API is enabled in your Google Cloud project.');
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
const SLACK_CHANNEL_KEY = 'sg_slack_channel';
const SLACK_SYNC_KEY    = 'sg_slack_last_sync';

// ── Microsoft 365 / Azure AD via MSAL ────────────────────────────────────
const M365_CLIENT_ID  = import.meta.env.VITE_AZURE_CLIENT_ID;
const GRAPH_SCOPES    = ['https://graph.microsoft.com/User.Read.All'];
const GRAPH_USERS_API = 'https://graph.microsoft.com/v1.0/users';
const M365_SYNC_KEY   = 'sg_m365_last_sync';

let _msalApp = null;

export async function getMSALApp() {
  if (_msalApp) return _msalApp;
  const { PublicClientApplication } = await import('@azure/msal-browser');
  const app = new PublicClientApplication({
    auth: {
      clientId: M365_CLIENT_ID,
      authority: 'https://login.microsoftonline.com/organizations',
      redirectUri: window.location.origin + '/auth-redirect.html',
    },
    cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false },
    system: { loggerOptions: { loggerCallback: () => {}, logLevel: 3 } },
  });
  await app.initialize();
  _msalApp = app;
  return app;
}

function clearMSALInteractionState() {
  // Remove stale 'msal.interaction.status' left by a previously aborted popup.
  // Without this MSAL throws interaction_in_progress on the next call.
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith('msal.') && key.includes('interaction')) {
      sessionStorage.removeItem(key);
    }
  }
}

// `scopes` is a parameter so write-back can request User.ReadWrite.All
// incrementally — a customer who only syncs their directory is never asked to
// grant Stacklens permission to change their tenant.
export async function acquireMSToken(scopes = GRAPH_SCOPES) {
  const app = await getMSALApp();
  const accounts = app.getAllAccounts();
  if (accounts.length) {
    try {
      const r = await app.acquireTokenSilent({ scopes, account: accounts[0] });
      return r.accessToken;
    } catch { /* consent not yet granted for these scopes — fall through */ }
    try {
      const r = await app.acquireTokenPopup({ scopes, account: accounts[0] });
      return r.accessToken;
    } catch (err) {
      if (err.errorCode !== 'interaction_in_progress') throw err;
      clearMSALInteractionState();
      const r = await app.acquireTokenPopup({ scopes, account: accounts[0] });
      return r.accessToken;
    }
  }
  try {
    const r = await app.loginPopup({ scopes });
    return r.accessToken;
  } catch (err) {
    if (err.errorCode === 'interaction_in_progress') {
      clearMSALInteractionState();
      const r = await app.loginPopup({ scopes });
      return r.accessToken;
    }
    throw err;
  }
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
    status:     u.accountEnabled !== false ? 'active' : 'offboarded',
    start_date: '',
    end_date:   '',
  };
}

// ── Asana PAT + workspace users ──────────────────────────────────────────
const ASANA_WORKSPACE_KEY = 'sg_asana_workspace';
const ASANA_SYNC_KEY      = 'sg_asana_last_sync';

// ── Asana PAT modal ───────────────────────────────────────────────────────
const ASANA_STEPS = [
  { n: 1, text: 'Go to app.asana.com → click your profile picture → My Settings → Apps' },
  { n: 2, text: 'Click "Manage Developer Apps" → "+ New access token"' },
  { n: 3, text: 'Give it a name (e.g. "Stacklens") and click Create token' },
  { n: 4, text: 'Copy the token immediately — it is only shown once' },
  { n: 5, text: 'Paste it below — Stacklens will auto-detect your workspace' },
];

function AsanaTokenModal({ onSubmit, onClose, loading }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const [token, setToken]       = useState('');
  const [showToken, setShowToken] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
      <div className="bg-slate-900 rounded-3xl border border-slate-700 p-8 max-w-lg w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📊</span>
            <div>
              <h3 className="text-xl font-bold text-white">Connect Asana</h3>
              <p className="text-sm text-slate-400">{t('int_pat_label')} — {t('int_one_time_setup')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>
        <ol className="space-y-3 mb-6">
          {ASANA_STEPS.map(item => (
            <li key={item.n} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{item.n}</span>
              <span className="text-sm text-slate-300">{item.text}</span>
            </li>
          ))}
        </ol>
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-300 mb-2">{t('int_pat_label')}</label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="1/…"
              className="w-full pr-10 pl-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 font-mono text-sm"
            />
            <button type="button" onClick={() => setShowToken(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">{t('int_stored_locally')}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold text-slate-300 transition-colors">
            {t('cancel')}
          </button>
          <button
            onClick={() => onSubmit(token.trim())}
            disabled={!token.trim() || loading}
            className="flex-1 py-2.5 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
            {loading ? <><Loader className="h-4 w-4 animate-spin" /> {t('int_syncing')}</> : t('int_connect_sync')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Zoom Server-to-Server OAuth + users ─────────────────────────────────
// Only the last-sync timestamp is kept locally; it isn't sensitive.
const ZOOM_SYNC_KEY           = 'sg_zoom_last_sync';

// Legacy credentials from older builds are purged app-wide on load by
// lib/legacyCredentials; imported here so disconnect can re-run it.

// ── Zoom credentials modal ────────────────────────────────────────────────
const ZOOM_STEPS = [
  { n: 1, text: 'Go to marketplace.zoom.us → Develop → Build App → Server-to-Server OAuth' },
  { n: 2, text: 'Create the app — name it "Stacklens" — and note the Account ID, Client ID, and Client Secret' },
  { n: 3, text: 'Go to Scopes and add: user:read:admin (lists all users in the account)' },
  { n: 4, text: 'Click "Activate your app" (top-right toggle) — the app must be active to issue tokens' },
  { n: 5, text: 'Paste the three credentials below' },
];

function ZoomCredentialsModal({ onSubmit, onClose, loading }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const [accountId,    setAccountId]    = useState('');
  const [clientId,     setClientId]     = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret,   setShowSecret]   = useState(false);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
      <div className="bg-slate-900 rounded-3xl border border-slate-700 p-8 max-w-lg w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📹</span>
            <div>
              <h3 className="text-xl font-bold text-white">Connect Zoom</h3>
              <p className="text-sm text-slate-400">{t('int_one_time_setup')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>
        <ol className="space-y-3 mb-6">
          {ZOOM_STEPS.map(item => (
            <li key={item.n} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{item.n}</span>
              <span className="text-sm text-slate-300">{item.text}</span>
            </li>
          ))}
        </ol>
        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">{t('int_account_id')}</label>
            <input type="text" value={accountId} onChange={e => setAccountId(e.target.value)}
              placeholder="abc123…"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">{t('int_client_id')}</label>
            <input type="text" value={clientId} onChange={e => setClientId(e.target.value)}
              placeholder="abc123…"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">{t('int_client_secret')}</label>
            <div className="relative">
              <input type={showSecret ? 'text' : 'password'} value={clientSecret} onChange={e => setClientSecret(e.target.value)}
                placeholder="••••••••"
                className="w-full pr-10 pl-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-sm" />
              <button type="button" onClick={() => setShowSecret(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">{t('int_stored_locally')}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold text-slate-300 transition-colors">
            {t('cancel')}
          </button>
          <button
            onClick={() => onSubmit(accountId.trim(), clientId.trim(), clientSecret.trim())}
            disabled={!accountId.trim() || !clientId.trim() || !clientSecret.trim() || loading}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
            {loading ? <><Loader className="h-4 w-4 animate-spin" /> {t('int_syncing')}</> : t('int_connect_sync')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Okta API token + users ───────────────────────────────────────────────
const OKTA_DOMAIN_KEY = 'sg_okta_domain';
const OKTA_SYNC_KEY   = 'sg_okta_last_sync';

// ── Okta API token modal ──────────────────────────────────────────────────
const OKTA_STEPS = [
  { n: 1, text: 'Go to your Okta Admin Console (admin.okta.com or your-org-admin.okta.com)' },
  { n: 2, text: 'Navigate to Security → API → Tokens → Create Token' },
  { n: 3, text: 'Name the token (e.g. "Stacklens") and click Create Token' },
  { n: 4, text: 'Copy the token immediately — it is only shown once' },
  { n: 5, text: 'Enter your Okta domain below (e.g. acme.okta.com — no https://)' },
];

function OktaTokenModal({ onSubmit, onClose, loading }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const [token, setToken]   = useState('');
  const [domain, setDomain] = useState(localStorage.getItem(OKTA_DOMAIN_KEY) || '');
  const [showToken, setShowToken] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
      <div className="bg-slate-900 rounded-3xl border border-slate-700 p-8 max-w-lg w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔐</span>
            <div>
              <h3 className="text-xl font-bold text-white">Connect Okta</h3>
              <p className="text-sm text-slate-400">{t('int_one_time_setup')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>
        <ol className="space-y-3 mb-6">
          {OKTA_STEPS.map(item => (
            <li key={item.n} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-700 text-white text-xs font-bold flex items-center justify-center mt-0.5">{item.n}</span>
              <span className="text-sm text-slate-300">{item.text}</span>
            </li>
          ))}
        </ol>
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-300 mb-2">API Token</label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="00…"
              className="w-full pr-10 pl-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
            <button type="button" onClick={() => setShowToken(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">{t('int_stored_locally')}</p>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-300 mb-2">{t('int_okta_domain_label')}</label>
          <input
            type="text"
            value={domain}
            onChange={e => setDomain(e.target.value)}
            placeholder="acme.okta.com"
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
          />
          <p className="text-xs text-slate-500 mt-1.5">Your Okta org domain — without https://</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold text-slate-300 transition-colors">
            {t('cancel')}
          </button>
          <button
            onClick={() => onSubmit(token.trim(), domain.trim().replace(/^https?:\/\//, ''))}
            disabled={!token.trim() || !domain.trim() || loading}
            className="flex-1 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
            {loading ? <><Loader className="h-4 w-4 animate-spin" /> {t('int_syncing')}</> : t('int_connect_sync')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── GitHub PAT + org members ─────────────────────────────────────────────
const GITHUB_ORG_KEY   = 'sg_github_org';
const GITHUB_SYNC_KEY  = 'sg_github_last_sync';

// ── GitHub PAT modal ─────────────────────────────────────────────────────
const GITHUB_STEPS = [
  { n: 1, text: 'Go to github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)' },
  { n: 2, text: 'Click "Generate new token (classic)"' },
  { n: 3, text: 'Give it a note (e.g. "Stacklens") and select scope: read:org' },
  { n: 4, text: 'Click "Generate token" and copy it (starts with ghp_)' },
  { n: 5, text: 'Enter your GitHub organisation slug below (the name in the URL, e.g. "acme-corp")' },
];

function GitHubTokenModal({ onSubmit, onClose, loading }) {
  const { language } = useLang();
  const t = useTranslation(language);
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
              <p className="text-sm text-slate-400">{t('int_one_time_setup')}</p>
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
          <label className="block text-sm font-semibold text-slate-300 mb-2">{t('int_pat_label')}</label>
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
          <p className="text-xs text-slate-500 mt-1.5">{t('int_stored_locally')}</p>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-300 mb-2">{t('int_org_slug')}</label>
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
            {t('cancel')}
          </button>
          <button
            onClick={() => onSubmit(token.trim(), org.trim())}
            disabled={!token.trim() || !org.trim() || loading}
            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
            {loading ? <><Loader className="h-4 w-4 animate-spin" /> {t('int_syncing')}</> : t('int_connect_sync')}
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
  const { language } = useLang();
  const t = useTranslation(language);
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
              <p className="text-sm text-slate-400">{t('int_one_time_setup')}</p>
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
          <label className="block text-sm font-semibold text-slate-300 mb-2">{t('int_bot_token')}</label>
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
          <p className="text-xs text-slate-500 mt-1.5">{t('int_stored_locally')}</p>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-300 mb-2">{t('int_alerts_channel')}</label>
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
            {t('cancel')}
          </button>
          <button
            onClick={() => onSubmit(token.trim(), channel.trim() || '#renewals')}
            disabled={!token.trim() || loading}
            className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
            {loading ? <><Loader className="h-4 w-4 animate-spin" /> {t('int_syncing')}</> : t('int_connect_sync')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Setup instructions modal ──────────────────────────────────────────────
function SetupModal({ integration, onClose }) {
  const { language } = useLang();
  const t = useTranslation(language);
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
    // Stacklens ships its own Azure app registration, so customers do not
    // register anything or touch environment variables — they just consent.
    'microsoft-365': [
      { n: 1, text: t('int_m365_step1') },
      { n: 2, text: t('int_m365_step2') },
      { n: 3, text: t('int_m365_step3') },
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
        The first user to connect must be a Global Administrator — they&apos;ll see a consent screen covering all users in the org.
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
              <h3 className="text-xl font-bold text-white">{t('int_set_up_title')} {integration?.name}</h3>
              <p className="text-sm text-slate-400">{t('int_one_time_setup')}</p>
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
          {t('int_setup_close')}
        </button>
      </div>
    </div>
  );
}

// ── Sync result banner ────────────────────────────────────────────────────
function SyncResult({ result, onDismiss }) {
  const { language } = useLang();
  const t = useTranslation(language);
  if (!result) return null;
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${result.error ? 'border-rose-500/30 bg-rose-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>
      {result.error
        ? <X className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
        : <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        {result.error
          ? <p className="text-sm font-semibold text-rose-400">{t('int_sync_failed')}: {result.error}</p>
          : (
            <>
              <p className="text-sm font-semibold text-emerald-400">
                {{ 'google-workspace': 'Google Workspace', 'slack': 'Slack', 'microsoft-365': 'Microsoft 365', 'github': 'GitHub', 'okta': 'Okta', 'zoom': 'Zoom', 'asana': 'Asana', 'salesforce': 'Salesforce' }[result.source] || result.source} {t('int_sync_complete')}
              </p>
              <p className="text-xs text-emerald-300/80 mt-0.5">
                {result.added} {t('int_sync_new')} · {result.updated} {t('int_sync_updated')} · {result.skipped} {t('int_sync_unchanged')} — {result.total} {t('int_sync_users_total')}
              </p>
            </>
          )}
      </div>
      <button onClick={onDismiss} className="text-slate-500 hover:text-white flex-shrink-0"><X className="h-4 w-4" /></button>
    </div>
  );
}

// ── Sync cancelled modal ─────────────────────────────────────────────────────
const SOURCE_NAMES = {
  'google-workspace': 'Google Workspace',
  'microsoft-365': 'Microsoft 365',
  'salesforce': 'Salesforce',
};

function SyncCancelledModal({ source, onRetry, onDismiss }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const name = SOURCE_NAMES[source] || source;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onDismiss}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          </div>
          <h3 className="text-base font-bold text-white">{t('ds_sync_not_completed')}</h3>
        </div>
        <p className="text-slate-300 text-sm mb-1">
          {t('ds_sync_cancelled_body_pre')}<strong>{name}</strong>{t('ds_sync_cancelled_body_post')}
        </p>
        <p className="text-slate-500 text-sm mb-5">{t('ds_sync_try_again_q')}</p>
        <div className="flex gap-3">
          <button
            onClick={() => { onDismiss(); onRetry(); }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> {t('ds_sync_try_again_btn')}
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-sm transition-colors border border-slate-700"
          >
            {t('ds_sync_cancel_btn')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Salesforce Connected App + PKCE OAuth ────────────────────────────────
const SF_CLIENT_ID_KEY  = 'sg_sf_client_id';
const SF_LOGIN_URL_KEY  = 'sg_sf_login_url';
const SF_INSTANCE_KEY   = 'sg_sf_instance_url';
const SF_SYNC_KEY       = 'sg_sf_last_sync';

function sfGenerateVerifier() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function sfGenerateChallenge(verifier) {
  const encoded = new TextEncoder().encode(verifier);
  const hash    = await crypto.subtle.digest('SHA-256', encoded);
  return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function sfAuthWithPKCE(clientId, loginUrl = 'https://login.salesforce.com') {
  const verifier    = sfGenerateVerifier();
  const challenge   = await sfGenerateChallenge(verifier);
  const redirectUri = window.location.origin + '/auth-redirect.html';

  const authUrl = new URL(`${loginUrl}/services/oauth2/authorize`);
  authUrl.searchParams.set('response_type',           'code');
  authUrl.searchParams.set('client_id',               clientId);
  authUrl.searchParams.set('redirect_uri',            redirectUri);
  authUrl.searchParams.set('scope',                   'api refresh_token');
  authUrl.searchParams.set('code_challenge',          challenge);
  authUrl.searchParams.set('code_challenge_method',   'S256');

  const popup = window.open(authUrl.toString(), 'sf_oauth', 'width=640,height=720,left=200,top=80');
  if (!popup) throw new Error('Popup blocked. Allow popups for this site and try again.');

  const code = await new Promise((resolve, reject) => {
    const iv = setInterval(() => {
      try {
        if (popup.closed) { clearInterval(iv); reject(new Error('popup_closed_by_user')); return; }
        const href = popup.location.href; // throws if still cross-origin (SF domain)
        if (href.startsWith(redirectUri)) {
          clearInterval(iv);
          popup.close();
          const params = new URL(href).searchParams;
          if (params.has('error')) reject(new Error(params.get('error_description') || params.get('error')));
          else resolve(params.get('code'));
        }
      } catch { /* cross-origin — popup still on Salesforce, keep polling */ }
    }, 300);
  });

  const tokenRes = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      client_id:     clientId,
      redirect_uri:  redirectUri,
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) {
    const body = await tokenRes.json().catch(() => ({}));
    throw new Error(body.error_description || body.error || `Token exchange failed (HTTP ${tokenRes.status})`);
  }
  const tokens = await tokenRes.json();
  return { accessToken: tokens.access_token, instanceUrl: tokens.instance_url, refreshToken: tokens.refresh_token };
}

const SF_STEPS = [
  { n: 1, text: 'In Salesforce Setup, search for "App Manager" → New Connected App' },
  { n: 2, text: 'Set App Name (e.g. "Stacklens"), API Name, and a Contact Email' },
  { n: 3, text: 'Check "Enable OAuth Settings". Set Callback URL to your app domain + /auth-redirect.html (e.g. https://stacklens.fr/auth-redirect.html)' },
  { n: 4, text: 'Add OAuth Scopes: "Access and manage your data (api)" + "Perform requests at any time (refresh_token)"' },
  { n: 5, text: 'Check "Enable PKCE Extension for Supported Authorization Flows"' },
  { n: 6, text: 'Under CORS → Trusted URLs, add your app domain' },
  { n: 7, text: 'Save and wait 2–10 min. Then copy the Consumer Key (not Consumer Secret) below' },
];

function SalesforceModal({ onSubmit, onClose, loading }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const [clientId,  setClientId]  = useState(localStorage.getItem(SF_CLIENT_ID_KEY)  || '');
  const [loginUrl,  setLoginUrl]  = useState(localStorage.getItem(SF_LOGIN_URL_KEY)  || 'https://login.salesforce.com');

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
      <div className="bg-slate-900 rounded-3xl border border-slate-700 p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">☁️</span>
            <div>
              <h3 className="text-xl font-bold text-white">Connect Salesforce</h3>
              <p className="text-sm text-slate-400">OAuth 2.0 PKCE — {t('int_one_time_setup')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>
        <ol className="space-y-3 mb-6">
          {SF_STEPS.map(item => (
            <li key={item.n} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-sky-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{item.n}</span>
              <span className="text-sm text-slate-300">{item.text}</span>
            </li>
          ))}
        </ol>
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">{t('int_consumer_key')}</label>
            <input
              type="text"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              placeholder="3MVG9…"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono text-sm"
            />
            <p className="text-xs text-slate-500 mt-1.5">Found in Setup → App Manager → your app → View → Consumer Key</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">{t('int_login_url')}</label>
            <input
              type="text"
              value={loginUrl}
              onChange={e => setLoginUrl(e.target.value)}
              placeholder="https://login.salesforce.com"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-sm"
            />
            <p className="text-xs text-slate-500 mt-1.5">Use https://test.salesforce.com for sandbox orgs</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold text-slate-300 transition-colors">
            {t('cancel')}
          </button>
          <button
            onClick={() => onSubmit(clientId.trim(), loginUrl.trim() || 'https://login.salesforce.com')}
            disabled={!clientId.trim() || loading}
            className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
            {loading ? <><Loader className="h-4 w-4 animate-spin" /> {t('int_authorising')}</> : t('int_authorise_sync')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Contact form modal (replaces mailto: links) ─────────────────────────
function ContactFormModal({ type, userName, userEmail, onClose, t }) {
  const [form, setForm] = useState({
    name: userName || '',
    email: userEmail || '',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const isIntegration = type === 'integration';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setSending(true);
    const subject = isIntegration ? 'integration' : 'support';
    const prefix = isIntegration ? 'Integration Request' : 'Support Request';
    try {
      await submitContactForm({ name: form.name, email: form.email, subject, message: `Type: ${prefix}\n\n${form.message}` });
      setSent(true);
    } catch {
      toast.error(t('contact_error') || 'Could not send. Please try again.');
    }
    setSending(false);
  };

  if (sent) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
        <div className="bg-slate-900 rounded-3xl border border-slate-700 p-8 max-w-lg w-full text-center">
          <div className="text-5xl mb-4">✉️</div>
          <h3 className="text-xl font-bold text-white mb-2">{t('contact_sent_title') || 'Message sent!'}</h3>
          <p className="text-slate-400 mb-6">{t('contact_sent_body') || "We'll get back to you soon."}</p>
          <button onClick={onClose}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold text-white transition-all">
            {t('close') || 'Close'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
      <div className="bg-slate-900 rounded-3xl border border-slate-700 p-8 max-w-lg w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{isIntegration ? '🔌' : '💬'}</span>
            <div>
              <h3 className="text-xl font-bold text-white">
                {isIntegration ? t('request_integration') : (t('int_contact_support') || 'Contact Support')}
              </h3>
              <p className="text-sm text-slate-400">
                {isIntegration ? t('int_need_different_sub') : t('int_need_help_sub')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">{t('contact_full_name') || 'Name'} *</label>
              <input type="text" required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">{t('contact_work_email') || 'Email'} *</label>
              <input type="email" required value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              {isIntegration
                ? (t('int_which_tools') || 'Which tools would you like us to support?')
                : (t('contact_message') || 'How can we help?')} *
            </label>
            <textarea required rows={4} value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder={isIntegration
                ? (t('int_tools_placeholder') || 'e.g. Jira, HubSpot, Notion…')
                : (t('int_support_placeholder') || 'Describe the issue or question…')}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold text-slate-300 transition-colors">
              {t('cancel')}
            </button>
            <button type="submit" disabled={sending || !form.message}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
              {sending ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? (t('sending') || 'Sending…') : (t('send') || 'Send')}
            </button>
          </div>
        </form>
      </div>
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
  const [syncCancelled, setSyncCancelled] = useState(null); // { source, retry }
  const [slackTokenModal, setSlackTokenModal]   = useState(false);
  const [slackSyncing, setSlackSyncing]         = useState(false);
  const [githubTokenModal, setGithubTokenModal] = useState(false);
  const [githubSyncing, setGithubSyncing]       = useState(false);
  const [oktaTokenModal, setOktaTokenModal]     = useState(false);
  const [oktaSyncing, setOktaSyncing]           = useState(false);
  const [zoomModal, setZoomModal]               = useState(false);
  const [zoomSyncing, setZoomSyncing]           = useState(false);
  const [asanaModal, setAsanaModal]             = useState(false);
  const [asanaSyncing, setAsanaSyncing]         = useState(false);
  const [sfModal, setSfModal]                   = useState(false);
  const [sfSyncing, setSfSyncing]               = useState(false);
  const [contactModal, setContactModal]         = useState(null);

  // Preload GIS and MSAL so popups fire synchronously on click
  useEffect(() => {
    if (GWS_CLIENT_ID) loadGIS().catch(() => {});
    if (M365_CLIENT_ID) getMSALApp().catch(() => {});
  }, []);

  const integrations = useMemo(() => [
    {
      id: 'google-workspace',
      name: 'Google Workspace',
      description: t('int_desc_gws'),
      icon: '🔵',
      category: t('int_cat_identity'),
      features: [t('int_ft_user_sync'), t('int_ft_department_role_import'), t('int_ft_active_suspended_status')],
      status: 'available',
      setupTime: '5 min',
      requiresSetup: !GWS_CLIENT_ID,
    },
    {
      id: 'slack',
      name: 'Slack',
      description: t('int_desc_slack'),
      icon: '💬',
      category: t('int_cat_communication'),
      features: [t('int_ft_user_sync'), t('int_ft_email_name_import'), t('int_ft_active_member_filtering')],
      status: 'available',
      setupTime: '5 min',
    },
    {
      id: 'microsoft-365',
      name: 'Microsoft 365',
      description: t('int_desc_m365'),
      icon: '🟦',
      category: t('int_cat_identity'),
      features: [t('int_ft_azure_ad_user_sync'), t('int_ft_department_job_title_import'), t('int_ft_enabled_disabled_status')],
      status: 'available',
      setupTime: '10 min',
      requiresSetup: !M365_CLIENT_ID,
    },
    {
      id: 'github',
      name: 'GitHub',
      description: t('int_desc_github'),
      icon: '🐙',
      category: t('int_cat_development'),
      features: [t('int_ft_org_member_sync'), t('int_ft_name_email_import'), t('int_ft_active_member_filtering')],
      status: 'available',
      setupTime: '3 min',
    },
    {
      id: 'okta',
      name: 'Okta',
      description: t('int_desc_okta'),
      icon: '🔐',
      category: t('int_cat_identity'),
      features: [t('int_ft_active_user_sync'), t('int_ft_department_title_import'), t('int_ft_active_inactive_status')],
      status: 'available',
      setupTime: '5 min',
    },
    {
      id: 'salesforce',
      name: 'Salesforce',
      description: t('int_desc_salesforce'),
      icon: '☁️',
      category: t('int_cat_crm'),
      features: [t('int_ft_active_user_sync'), t('int_ft_department_title_import'), t('int_ft_oauth_2_0_pkce_no_password_stored')],
      status: 'available',
      setupTime: '10 min',
    },
    {
      id: 'zoom',
      name: 'Zoom',
      description: t('int_desc_zoom'),
      icon: '📹',
      category: t('int_cat_communication'),
      features: [t('int_ft_licensed_user_sync'), t('int_ft_name_email_import'), t('int_ft_department_import')],
      status: 'available',
      setupTime: '3 min',
    },
    {
      id: 'asana',
      name: 'Asana',
      description: t('int_desc_asana'),
      icon: '📊',
      category: t('int_cat_productivity'),
      features: [t('int_ft_workspace_member_sync'), t('int_ft_name_email_import'), t('int_ft_auto_detects_workspace')],
      status: 'available',
      setupTime: '2 min',
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [language]);

  // ── Google Workspace real OAuth + Directory sync ──────────────────────
  const handleGoogleWorkspaceConnect = useCallback(async () => {
    if (!GWS_CLIENT_ID) {
      setSetupModal(integrations.find(i => i.id === 'google-workspace'));
      return;
    }

    setConnecting('google-workspace');
    setSyncResult(null);
    setSyncCancelled(null);

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
      const incoming = gwsUsers.map(mapGoogleUser).filter(u => u.email);

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
        source: 'google-workspace',
        total: incoming.length,
        added: toAdd.length,
        updated: toUpdate.length,
        skipped,
      });
      track('integration_sync_completed', { source: 'google-workspace', added: toAdd.length });
    } catch (err) {
      if (err.message === 'popup_closed' || err.message === 'popup_closed_by_user' || err.message === 'access_denied') {
        setSyncCancelled({ source: 'google-workspace', retry: handleGoogleWorkspaceConnect });
        return;
      }
      setSyncResult({ error: err.message });
      toast.error('Google Workspace sync failed');
    } finally {
      setConnecting(null);
    }
  }, [db?.employees, connectedIntegrations, muts, integrations]);

   
  // ── Directory sync ────────────────────────────────────────────────────────
  // Six vendors, one flow. Credentials are posted to the integrations endpoint
  // once; every sync after that asks the server, which holds the token and
  // returns already-normalised employee records. Nothing vendor-specific — and
  // no token — lives in the browser any more. This replaces six near-identical
  // handler pairs that each re-implemented the same reconcile loop.
  const SYNC_STATE = {
    slack:      { setBusy: setSlackSyncing,  openModal: () => setSlackTokenModal(true),  syncKey: SLACK_SYNC_KEY },
    github:     { setBusy: setGithubSyncing, openModal: () => setGithubTokenModal(true), syncKey: GITHUB_SYNC_KEY },
    okta:       { setBusy: setOktaSyncing,   openModal: () => setOktaTokenModal(true),   syncKey: OKTA_SYNC_KEY },
    zoom:       { setBusy: setZoomSyncing,   openModal: () => setZoomModal(true),        syncKey: ZOOM_SYNC_KEY },
    asana:      { setBusy: setAsanaSyncing,  openModal: () => setAsanaModal(true),  syncKey: ASANA_SYNC_KEY },
    salesforce: { setBusy: setSfSyncing,     openModal: () => setSfModal(true),          syncKey: SF_SYNC_KEY },
  };

   
  const reconcile = useCallback(async (vendor, users) => {
    const incoming = (users || []).filter(u => u.email);
    const existingByEmail = Object.fromEntries(
      (db?.employees || []).map(e => [(e.email || '').toLowerCase(), e])
    );
    const toAdd = [], toUpdate = [];
    let skipped = 0;
    for (const u of incoming) {
      const existing = existingByEmail[u.email.toLowerCase()];
      if (!existing) { toAdd.push(u); continue; }
      const patch = {};
      if (u.full_name && u.full_name !== existing.full_name) patch.full_name = u.full_name;
      if (u.department && !existing.department) patch.department = u.department;
      if (u.role && !existing.role) patch.role = u.role;
      if (u.status && u.status !== existing.status) patch.status = u.status;
      if (u.start_date && !existing.start_date) patch.start_date = u.start_date;
      if (Object.keys(patch).length > 0) toUpdate.push({ id: existing.id, patch });
      else skipped++;
    }
    if (toAdd.length) await muts.bulkImport.mutateAsync({ kind: 'employees', records: toAdd });
    for (const { id, patch } of toUpdate) await muts.updateEmployee.mutateAsync({ id, patch });

    localStorage.setItem(SYNC_STATE[vendor].syncKey, new Date().toISOString());
    setConnectedIntegrations(prev => {
      const next = prev.includes(vendor) ? prev : [...prev, vendor];
      localStorage.setItem('sg_connected_integrations', JSON.stringify(next));
      return next;
    });
    setSyncResult({ source: vendor, total: incoming.length, added: toAdd.length, updated: toUpdate.length, skipped });
  }, [db?.employees, muts]);

  /** First connect: the server validates the credentials before storing them. */
   
  const connectVendor = useCallback(async (vendor, credentials, closeModal) => {
    const st = SYNC_STATE[vendor];
    st.setBusy(true);
    setSyncResult(null);
    try {
      await integrationCall(vendor, 'connect', credentials);
      const { users } = await integrationCall(vendor, 'sync');
      await reconcile(vendor, users);
      closeModal?.();
    } catch (err) {
      setSyncResult({ source: vendor, error: err.message });
      toast.error(`${vendor} sync failed`);
    } finally {
      st.setBusy(false);
    }
  }, [reconcile]);

  /** Re-sync: the server already holds the credentials. */
   
  const resyncVendor = useCallback(async (vendor) => {
    const st = SYNC_STATE[vendor];
    st.setBusy(true);
    setSyncResult(null);
    try {
      const { connected } = await integrationCall(vendor, 'status');
      if (!connected) { st.openModal(); return; }
      const { users } = await integrationCall(vendor, 'sync');
      await reconcile(vendor, users);
    } catch (err) {
      setSyncResult({ source: vendor, error: err.message });
      toast.error(`${vendor} sync failed`);
    } finally {
      st.setBusy(false);
    }
  }, [reconcile]);

  const handleSlackTokenSubmit = useCallback((token, channel = '#renewals') => {
    // The channel is a notification preference, not a credential.
    localStorage.setItem(SLACK_CHANNEL_KEY, channel);
    return connectVendor('slack', { token }, () => setSlackTokenModal(false));
  }, [connectVendor]);
  const handleSlackResync = useCallback(() => resyncVendor('slack'), [resyncVendor]);

  const handleGitHubTokenSubmit = useCallback((token, org) =>
    connectVendor('github', { token, org }, () => setGithubTokenModal(false)), [connectVendor]);
  const handleGitHubResync = useCallback(() => resyncVendor('github'), [resyncVendor]);

  const handleOktaTokenSubmit = useCallback((token, domain) =>
    connectVendor('okta', { token, domain }, () => setOktaTokenModal(false)), [connectVendor]);
  const handleOktaResync = useCallback(() => resyncVendor('okta'), [resyncVendor]);

  const handleZoomSubmit = useCallback((accountId, clientId, clientSecret) =>
    connectVendor('zoom', { accountId, clientId, clientSecret }, () => setZoomModal(false)), [connectVendor]);
  const handleZoomResync = useCallback(() => resyncVendor('zoom'), [resyncVendor]);

  const handleAsanaTokenSubmit = useCallback((token) =>
    connectVendor('asana', { token }, () => setAsanaModal(false)), [connectVendor]);
  const handleAsanaResync = useCallback(() => resyncVendor('asana'), [resyncVendor]);

  // Salesforce still authorises in the browser — PKCE, so no client secret is
  // ever held there — but the refresh token it returns goes straight to the
  // server and is never written to localStorage.
   
  const handleSalesforceSubmit = useCallback(async (clientId, loginUrl) => {
    setSfSyncing(true);
    setSyncResult(null);
    try {
      const { instanceUrl, refreshToken } = await sfAuthWithPKCE(clientId, loginUrl);
      if (!refreshToken) throw new Error('Salesforce returned no refresh token. Enable the refresh_token scope on the Connected App.');
      await integrationCall('salesforce', 'connect', { clientId, refreshToken, instanceUrl, loginUrl });
      const { users } = await integrationCall('salesforce', 'sync');
      await reconcile('salesforce', users);
      setSfModal(false);
    } catch (err) {
      setSyncResult({ source: 'salesforce', error: err.message });
      toast.error('Salesforce sync failed');
    } finally {
      setSfSyncing(false);
    }
  }, [reconcile]);
  const handleSalesforceResync = useCallback(() => resyncVendor('salesforce'), [resyncVendor]);

  const handleMicrosoftConnect = useCallback(async () => {
    if (!M365_CLIENT_ID) {
      setSetupModal(integrations.find(i => i.id === 'microsoft-365'));
      return;
    }
    setConnecting('microsoft-365');
    setSyncResult(null);
    setSyncCancelled(null);
    try {
      const accessToken = await acquireMSToken();
      const msUsers = await fetchAllGraphUsers(accessToken);
      const incoming = msUsers.map(mapMicrosoftUser).filter(u => u.email);

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
      if (err.errorCode === 'user_cancelled' || err.message?.includes('user_cancelled') || err.message?.includes('popup_closed')) {
        setSyncCancelled({ source: 'microsoft-365', retry: handleMicrosoftConnect });
        return;
      }
      if (err.message?.includes('timed_out') || err.errorCode === 'monitor_popup_timeout') {
        setSyncResult({ source: 'microsoft-365', error: t('int_m365_popup_timeout') });
        toast.error(t('int_m365_popup_timeout_toast'));
        return;
      }
      setSyncResult({ source: 'microsoft-365', error: err.message });
      toast.error('Microsoft 365 sync failed');
    } finally {
      setConnecting(null);
    }
  }, [db?.employees, connectedIntegrations, muts, integrations]);

  // Disconnecting must clear BOTH sides: the credentials the server holds, and
  // any legacy copy still sitting in this browser from before the migration.
  const SERVER_HELD = ['slack', 'github', 'okta', 'zoom', 'asana', 'salesforce'];
  const LOCAL_SYNC_KEYS = {
    'google-workspace': 'sg_gws_last_sync',
    'microsoft-365': M365_SYNC_KEY,
    slack: SLACK_SYNC_KEY, github: GITHUB_SYNC_KEY, okta: OKTA_SYNC_KEY,
    zoom: ZOOM_SYNC_KEY, asana: ASANA_SYNC_KEY, salesforce: SF_SYNC_KEY,
  };

  const handleDisconnect = (integrationId) => {
    const next = connectedIntegrations.filter(id => id !== integrationId);
    setConnectedIntegrations(next);
    localStorage.setItem('sg_connected_integrations', JSON.stringify(next));

    if (SERVER_HELD.includes(integrationId)) {
      // Fire and forget: the local state is already cleared, and a failed
      // server delete must not leave the UI showing a connected integration.
      integrationCall(integrationId, 'disconnect').catch(() => {});
    }
    if (integrationId === 'microsoft-365') {
      // eslint-disable-next-line react-hooks/globals
      _msalApp = null; // module-level MSAL singleton, intentionally reset on disconnect
    }
    if (LOCAL_SYNC_KEYS[integrationId]) localStorage.removeItem(LOCAL_SYNC_KEYS[integrationId]);
    localStorage.removeItem(SLACK_CHANNEL_KEY);
    purgeLegacyCredentials();
    setSyncResult(null);
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
    if (integration.id === 'okta')             { setOktaTokenModal(true); return; }
    if (integration.id === 'zoom')             { setZoomModal(true); return; }
    if (integration.id === 'asana')            { setAsanaModal(true); return; }
    if (integration.id === 'salesforce')       { setSfModal(true); return; }
  };

  const isConnected = useCallback((id) => connectedIntegrations.includes(id), [connectedIntegrations]);
  const lastGWSSync    = localStorage.getItem('sg_gws_last_sync');
  const lastSlackSync  = localStorage.getItem(SLACK_SYNC_KEY);
  const lastM365Sync   = localStorage.getItem(M365_SYNC_KEY);
  const lastGitHubSync = localStorage.getItem(GITHUB_SYNC_KEY);
  const lastOktaSync   = localStorage.getItem(OKTA_SYNC_KEY);
  const lastZoomSync   = localStorage.getItem(ZOOM_SYNC_KEY);
  const lastAsanaSync  = localStorage.getItem(ASANA_SYNC_KEY);
  const lastSFSync     = localStorage.getItem(SF_SYNC_KEY);

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
  }, [searchQuery, selectedCategory, selectedStatus, integrations, isConnected]);

  const categories = ['all', ...new Set(integrations.map(i => i.category))];
  const connectedCount = connectedIntegrations.length;
  const availableCount = integrations.filter(i => i.status === 'available' && !isConnected(i.id)).length;
  const comingSoonCount = integrations.filter(i => i.status === 'coming-soon').length;

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* Sync result banner */}
      <SyncResult result={syncResult} onDismiss={() => setSyncResult(null)} />

      {/* Sync cancelled modal */}
      {syncCancelled && (
        <SyncCancelledModal
          source={syncCancelled.source}
          onRetry={syncCancelled.retry}
          onDismiss={() => setSyncCancelled(null)}
        />
      )}

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

      {/* Okta token modal */}
      {oktaTokenModal && (
        <OktaTokenModal
          loading={oktaSyncing}
          onSubmit={handleOktaTokenSubmit}
          onClose={() => setOktaTokenModal(false)}
        />
      )}

      {/* Asana token modal */}
      {asanaModal && (
        <AsanaTokenModal
          loading={asanaSyncing}
          onSubmit={handleAsanaTokenSubmit}
          onClose={() => setAsanaModal(false)}
        />
      )}

      {/* Salesforce OAuth modal */}
      {sfModal && (
        <SalesforceModal
          loading={sfSyncing}
          onSubmit={handleSalesforceSubmit}
          onClose={() => setSfModal(false)}
        />
      )}

      {/* Zoom credentials modal */}
      {zoomModal && (
        <ZoomCredentialsModal
          loading={zoomSyncing}
          onSubmit={handleZoomSubmit}
          onClose={() => setZoomModal(false)}
        />
      )}

      {contactModal && (
        <ContactFormModal
          type={contactModal}
          userName={db?.user?.displayName || ''}
          userEmail={db?.user?.email || ''}
          onClose={() => setContactModal(null)}
          t={t}
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
            <p className="text-slate-400">{t('int_connect_automate')}</p>
          </div>
          <div className="flex items-center gap-2">
            {isConnected('google-workspace') && lastGWSSync && (
              <button onClick={handleGoogleWorkspaceConnect} disabled={connecting === 'google-workspace'}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-colors disabled:opacity-50">
                {connecting === 'google-workspace'
                  ? <Loader className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                {t('int_resync')} Google
              </button>
            )}
            {isConnected('slack') && lastSlackSync && (
              <button onClick={handleSlackResync} disabled={slackSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-colors disabled:opacity-50">
                {slackSyncing
                  ? <Loader className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                {t('int_resync')} Slack
              </button>
            )}
            {isConnected('microsoft-365') && lastM365Sync && (
              <button onClick={handleMicrosoftConnect} disabled={connecting === 'microsoft-365'}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-colors disabled:opacity-50">
                {connecting === 'microsoft-365'
                  ? <Loader className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                {t('int_resync')} M365
              </button>
            )}
            {isConnected('github') && lastGitHubSync && (
              <button onClick={handleGitHubResync} disabled={githubSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-colors disabled:opacity-50">
                {githubSyncing
                  ? <Loader className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                {t('int_resync')} GitHub
              </button>
            )}
            {isConnected('okta') && lastOktaSync && (
              <button onClick={handleOktaResync} disabled={oktaSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-colors disabled:opacity-50">
                {oktaSyncing
                  ? <Loader className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                {t('int_resync')} Okta
              </button>
            )}
            {isConnected('zoom') && lastZoomSync && (
              <button onClick={handleZoomResync} disabled={zoomSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-colors disabled:opacity-50">
                {zoomSyncing
                  ? <Loader className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                {t('int_resync')} Zoom
              </button>
            )}
            {isConnected('asana') && lastAsanaSync && (
              <button onClick={handleAsanaResync} disabled={asanaSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-colors disabled:opacity-50">
                {asanaSyncing
                  ? <Loader className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                {t('int_resync')} Asana
              </button>
            )}
            {isConnected('salesforce') && lastSFSync && (
              <button onClick={handleSalesforceResync} disabled={sfSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-colors disabled:opacity-50">
                {sfSyncing
                  ? <Loader className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                {t('int_resync')} Salesforce
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 rounded-xl p-4 text-center border border-slate-800">
            <div className="text-xl md:text-3xl font-black text-blue-400">{integrations.length}</div>
            <div className="text-sm text-slate-400 mt-1">{t('int_total')}</div>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-4 text-center border border-slate-800">
            <div className="text-xl md:text-3xl font-black text-emerald-400">{connectedCount}</div>
            <div className="text-sm text-slate-400 mt-1">{t('connected')}</div>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-4 text-center border border-slate-800">
            <div className="text-xl md:text-3xl font-black text-purple-400">{availableCount}</div>
            <div className="text-sm text-slate-400 mt-1">{t('int_available')}</div>
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
            {categories.map(cat => <option key={cat} value={cat}>{cat === 'all' ? t('int_all_categories') : cat}</option>)}
          </select>
          <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}
            className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500">
            <option value="all">{t('all_status')}</option>
            <option value="connected">{t('connected')}</option>
            <option value="available">{t('int_available')}</option>
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
                {/* Badge — in normal flow, not absolutely positioned: it used to
                    overlap the card title, and worse in languages where the label
                    is longer than English ("Configuration requise"). */}
                {(connected || comingSoon || needsSetup) && (
                  <div className="flex justify-end mb-2">
                    {connected && (
                      <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> {t('connected')}
                      </span>
                    )}
                    {!connected && comingSoon && (
                      <span className="px-3 py-1 bg-slate-700 text-slate-400 text-xs font-bold rounded-full">{t('coming_soon_label')}</span>
                    )}
                    {!connected && !comingSoon && needsSetup && (
                      <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-full">{t('int_setup_required')}</span>
                    )}
                  </div>
                )}

                {/* Icon & title */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-2xl md:text-5xl">{integration.icon}</div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-white">{integration.name}</h4>
                    <div className="text-xs text-slate-500 mt-1">⏱️ {integration.setupTime} {t('int_setup_suffix')}</div>
                  </div>
                </div>

                <p className="text-sm text-slate-400 mb-4">{integration.description}</p>

                {/* Last sync info */}
                {connected && integration.id === 'google-workspace' && lastGWSSync && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                    <RefreshCw className="h-3 w-3" />
                    {t('int_last_synced')} {new Date(lastGWSSync).toLocaleString()}
                  </div>
                )}
                {connected && integration.id === 'slack' && lastSlackSync && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <RefreshCw className="h-3 w-3" />
                    {t('int_last_synced')} {new Date(lastSlackSync).toLocaleString()}
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
                    {t('int_last_synced')} {new Date(lastM365Sync).toLocaleString()}
                  </div>
                )}
                {connected && integration.id === 'github' && lastGitHubSync && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                    <RefreshCw className="h-3 w-3" />
                    {t('int_last_synced')} {new Date(lastGitHubSync).toLocaleString()}
                  </div>
                )}
                {connected && integration.id === 'github' && localStorage.getItem(GITHUB_ORG_KEY) && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
                    <span className="font-mono">🐙 org: {localStorage.getItem(GITHUB_ORG_KEY)}</span>
                  </div>
                )}
                {connected && integration.id === 'okta' && lastOktaSync && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                    <RefreshCw className="h-3 w-3" />
                    {t('int_last_synced')} {new Date(lastOktaSync).toLocaleString()}
                  </div>
                )}
                {connected && integration.id === 'okta' && localStorage.getItem(OKTA_DOMAIN_KEY) && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
                    <span className="font-mono">🔐 {localStorage.getItem(OKTA_DOMAIN_KEY)}</span>
                  </div>
                )}
                {connected && integration.id === 'zoom' && lastZoomSync && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                    <RefreshCw className="h-3 w-3" />
                    {t('int_last_synced')} {new Date(lastZoomSync).toLocaleString()}
                  </div>
                )}
                {connected && integration.id === 'asana' && lastAsanaSync && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                    <RefreshCw className="h-3 w-3" />
                    {t('int_last_synced')} {new Date(lastAsanaSync).toLocaleString()}
                  </div>
                )}
                {connected && integration.id === 'asana' && localStorage.getItem(ASANA_WORKSPACE_KEY) && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
                    <span className="font-mono">📊 {localStorage.getItem(ASANA_WORKSPACE_KEY)}</span>
                  </div>
                )}
                {connected && integration.id === 'salesforce' && lastSFSync && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                    <RefreshCw className="h-3 w-3" />
                    {t('int_last_synced')} {new Date(lastSFSync).toLocaleString()}
                  </div>
                )}
                {connected && integration.id === 'salesforce' && localStorage.getItem(SF_INSTANCE_KEY) && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
                    <span className="font-mono text-[11px]">☁️ {localStorage.getItem(SF_INSTANCE_KEY).replace('https://', '')}</span>
                  </div>
                )}
                {connected && ['google-workspace', 'slack', 'microsoft-365', 'github', 'okta', 'zoom', 'asana', 'salesforce'].includes(integration.id) && db?.employees?.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 mb-3">
                    <Users className="h-3 w-3" />
                    {db.employees.length} {t('int_employees_in_dir')}
                  </div>
                )}

                {/* Features */}
                <div className="space-y-2 mb-4 flex-grow">
                  {integration.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm text-slate-300">
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
                        {isConnecting ? <><Loader className="h-4 w-4 animate-spin" /> {t('int_syncing')}</> : <><RefreshCw className="h-4 w-4" /> {t('int_sync_now')}</>}
                      </button>
                    )}
                    {integration.id === 'slack' && (
                      <button onClick={handleSlackResync} disabled={slackSyncing}
                        className="w-full py-2.5 rounded-xl font-bold bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm transition-colors flex items-center justify-center gap-2">
                        {slackSyncing ? <><Loader className="h-4 w-4 animate-spin" /> {t('int_syncing')}</> : <><RefreshCw className="h-4 w-4" /> {t('int_sync_now')}</>}
                      </button>
                    )}
                    {integration.id === 'microsoft-365' && (
                      <button onClick={handleMicrosoftConnect} disabled={isConnecting}
                        className="w-full py-2.5 rounded-xl font-bold bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm transition-colors flex items-center justify-center gap-2">
                        {isConnecting ? <><Loader className="h-4 w-4 animate-spin" /> {t('int_syncing')}</> : <><RefreshCw className="h-4 w-4" /> {t('int_sync_now')}</>}
                      </button>
                    )}
                    {integration.id === 'github' && (
                      <button onClick={handleGitHubResync} disabled={githubSyncing}
                        className="w-full py-2.5 rounded-xl font-bold bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm transition-colors flex items-center justify-center gap-2">
                        {githubSyncing ? <><Loader className="h-4 w-4 animate-spin" /> {t('int_syncing')}</> : <><RefreshCw className="h-4 w-4" /> {t('int_sync_now')}</>}
                      </button>
                    )}
                    {integration.id === 'okta' && (
                      <button onClick={handleOktaResync} disabled={oktaSyncing}
                        className="w-full py-2.5 rounded-xl font-bold bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm transition-colors flex items-center justify-center gap-2">
                        {oktaSyncing ? <><Loader className="h-4 w-4 animate-spin" /> {t('int_syncing')}</> : <><RefreshCw className="h-4 w-4" /> {t('int_sync_now')}</>}
                      </button>
                    )}
                    {integration.id === 'zoom' && (
                      <button onClick={handleZoomResync} disabled={zoomSyncing}
                        className="w-full py-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm transition-colors flex items-center justify-center gap-2">
                        {zoomSyncing ? <><Loader className="h-4 w-4 animate-spin" /> {t('int_syncing')}</> : <><RefreshCw className="h-4 w-4" /> {t('int_sync_now')}</>}
                      </button>
                    )}
                    {integration.id === 'asana' && (
                      <button onClick={handleAsanaResync} disabled={asanaSyncing}
                        className="w-full py-2.5 rounded-xl font-bold bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white text-sm transition-colors flex items-center justify-center gap-2">
                        {asanaSyncing ? <><Loader className="h-4 w-4 animate-spin" /> {t('int_syncing')}</> : <><RefreshCw className="h-4 w-4" /> {t('int_sync_now')}</>}
                      </button>
                    )}
                    {integration.id === 'salesforce' && (
                      <button onClick={handleSalesforceResync} disabled={sfSyncing}
                        className="w-full py-2.5 rounded-xl font-bold bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm transition-colors flex items-center justify-center gap-2">
                        {sfSyncing ? <><Loader className="h-4 w-4 animate-spin" /> {t('int_syncing')}</> : <><RefreshCw className="h-4 w-4" /> {t('int_sync_now')}</>}
                      </button>
                    )}
                    <button onClick={() => handleDisconnect(integration.id)}
                      className="w-full py-2 rounded-xl font-semibold bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors">
                      {t('disconnect')}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => handleConnect(integration)} disabled={isConnecting}
                    className="w-full py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors flex items-center justify-center gap-2">
                    {isConnecting ? <><Loader className="h-4 w-4 animate-spin" /> {t('int_connecting')}</> : needsSetup ? `⚙️ ${t('int_view_setup_steps')}` : t('connect')}
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <h3 className="text-xl font-bold text-white mb-2">{t('need_different_int')}</h3>
          <p className="text-slate-400 mb-6 text-sm">{t('int_need_different_sub')}</p>
          <button onClick={() => setContactModal('integration')}
            className="block w-full px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white text-base rounded-xl font-bold transition-all text-center tracking-wide">
            {t('request_integration')}
          </button>
        </div>
        <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-8">
          <h3 className="text-xl font-bold text-white mb-2">{t('need_help')}</h3>
          <p className="text-slate-400 mb-6 text-sm">{t('int_need_help_sub')}</p>
          <button onClick={() => setContactModal('support')}
            className="block w-full px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-base rounded-xl font-bold transition-all text-center tracking-wide">
            {t('int_contact_support')}
          </button>
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
