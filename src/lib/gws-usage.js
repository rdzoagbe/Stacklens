// ── Google Workspace app-usage sync ──────────────────────────────────────
// Reads the Admin Reports API "token" activity log: every time an employee
// signs in to a third-party app with their work Google account, an event is
// recorded. That gives us (a) observed last-use dates for tools we already
// track and (b) discovery of apps nobody declared (shadow IT).
// Requires the authorising account to be a Workspace admin.

export const GWS_REPORTS_SCOPE = 'https://www.googleapis.com/auth/admin.reports.audit.readonly';
const REPORTS_API = 'https://admin.googleapis.com/admin/reports/v1/activity/users/all/applications/token';

export function loadGIS() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const fail = () => {
      document.getElementById('gis-script')?.remove();
      reject(new Error('Google Identity Services failed to load. Check your network or browser extensions.'));
    };
    if (document.getElementById('gis-script')) {
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

export function requestReportsToken(clientId) {
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GWS_REPORTS_SCOPE,
      callback: (resp) => {
        if (resp.error) reject(new Error(resp.error_description || resp.error));
        else resolve(resp.access_token);
      },
      error_callback: (err) => reject(new Error(err.type || 'OAuth error')),
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

export async function fetchTokenActivities(accessToken, days = 180) {
  const start = new Date();
  start.setDate(start.getDate() - days);
  const items = [];
  let pageToken = '';
  do {
    const url = new URL(REPORTS_API);
    url.searchParams.set('startTime', start.toISOString());
    url.searchParams.set('maxResults', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.error?.message || `HTTP ${res.status}`;
      if (res.status === 401) throw new Error('Unauthorised. The OAuth token expired or lacks the admin.reports.audit.readonly scope. Please retry and accept the consent screen.');
      if (res.status === 403) throw new Error('Permission denied. The authorising account must be a Google Workspace admin, and the Admin SDK API must be enabled in your Google Cloud project.');
      throw new Error(msg);
    }
    const data = await res.json();
    if (data.items) items.push(...data.items);
    pageToken = data.nextPageToken || '';
  } while (pageToken && items.length < 20000);
  return items;
}

// Collapse raw activity items into one row per third-party app.
export function aggregateAppUsage(items) {
  const apps = {};
  (items || []).forEach(item => {
    const time = item.id?.time || '';
    const email = (item.actor?.email || '').toLowerCase();
    (item.events || []).forEach(ev => {
      const app = (ev.parameters || []).find(p => p.name === 'app_name')?.value;
      if (!app) return;
      if (!apps[app]) apps[app] = { app, users: new Set(), events: 0, lastSeen: '' };
      apps[app].events += 1;
      if (email) apps[app].users.add(email);
      if (time > apps[app].lastSeen) apps[app].lastSeen = time;
    });
  });
  return Object.values(apps)
    .map(a => ({ app: a.app, users: a.users.size, events: a.events, lastSeen: a.lastSeen }))
    .sort((a, b) => b.users - a.users || b.events - a.events);
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// Google's own surfaces and platform noise — not tools anyone pays for.
const NOISE = /^(google|gmail|chrome|android|ios account|macos account|windows account|firebase|apple)/i;

// Split observed apps into updates for tools we already track vs discoveries.
export function matchAppsToTools(apps, tools) {
  const byNorm = [];
  (tools || []).forEach(t => { const n = norm(t.name); if (n) byNorm.push({ n, tool: t }); });
  const matched = [];
  const discovered = [];
  apps.forEach(a => {
    const an = norm(a.app);
    if (!an) return;
    const hit = byNorm.find(({ n }) =>
      n === an || (n.length >= 4 && an.includes(n)) || (an.length >= 4 && n.includes(an)));
    if (hit) matched.push({ tool: hit.tool, ...a });
    else if (!NOISE.test(a.app)) discovered.push(a);
  });
  return { matched, discovered };
}
