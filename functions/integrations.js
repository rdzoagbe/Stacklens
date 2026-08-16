// ── Directory integrations: credentials held server-side ────────────────────
//
// Every integration used to call its vendor's API straight from the browser,
// which meant the vendor token lived in localStorage where any XSS could read
// it. These tokens are long-lived and admin-scoped — an Okta API token or a
// GitHub PAT is worth as much as a password.
//
// Credentials now live in /integration_credentials/{uid}, a collection with an
// explicit `allow read, write: if false` in firestore.rules. The browser posts
// them once and thereafter only asks this module to sync; it can never read
// them back, even as their owner.
//
// One module, one shape. Each vendor supplies `connect` validation and a
// `listUsers` implementation; everything else — auth, rate limiting, storage,
// normalisation — is shared, so a sixth vendor is a single entry in VENDORS
// rather than another endpoint.

const USER_AGENT = 'Stacklens-Integrations';

/** Employee statuses the app actually understands. */
const ACTIVE = 'active';
const GONE = 'offboarded';

class IntegrationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'IntegrationError';
    this.httpStatus = status;
  }
}

async function readJson(res) {
  return res.json().catch(() => ({}));
}

/** Fail with the vendor's own wording where there is one — it is more useful. */
async function ensureOk(res, fallback, overrides = {}) {
  if (res.ok) return;
  const body = await readJson(res);
  if (overrides[res.status]) throw new IntegrationError(overrides[res.status], 400);
  const msg =
    body?.error?.message ||
    body?.errorSummary ||
    body?.error_description ||
    (Array.isArray(body) ? body[0]?.message : null) ||
    body?.message ||
    `${fallback} (HTTP ${res.status})`;
  throw new IntegrationError(msg, 400);
}

// ── Vendors ─────────────────────────────────────────────────────────────────
// `required` names the credential fields the client must post.
// `listUsers(creds)` returns already-normalised employee records, so no client
// ever has to know a vendor's response shape — and every status value is one
// of the app's own. The old browser-side mappers emitted 'inactive', which is
// not a valid employee status, for Slack, Okta, Zoom and Microsoft alike.

const VENDORS = {
  slack: {
    required: ['token'],
    async listUsers({ token }) {
      const out = [];
      let cursor = '';
      for (let i = 0; i < 20; i++) {
        const params = new URLSearchParams({ limit: '200' });
        if (cursor) params.set('cursor', cursor);
        const res = await fetch(`https://slack.com/api/users.list?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        await ensureOk(res, 'Could not list Slack members');
        const data = await readJson(res);
        // Slack returns HTTP 200 with ok:false for auth failures.
        if (!data.ok) throw new IntegrationError(data.error || 'Slack rejected the token');
        for (const u of data.members || []) {
          if (u.is_bot || u.id === 'USLACKBOT') continue;
          const p = u.profile || {};
          const email = p.email || '';
          if (!email) continue;
          out.push({
            full_name: p.real_name || p.display_name || u.name || '',
            email, department: '', role: p.title || '',
            status: u.deleted ? GONE : ACTIVE, start_date: '', end_date: '',
          });
        }
        cursor = data.response_metadata?.next_cursor || '';
        if (!cursor) break;
      }
      return out;
    },
  },

  okta: {
    required: ['token', 'domain'],
    async listUsers({ token, domain }) {
      const out = [];
      let url = `https://${domain}/api/v1/users?filter=status+eq+%22ACTIVE%22&limit=200`;
      for (let i = 0; i < 20 && url; i++) {
        const res = await fetch(url, {
          headers: { Authorization: `SSWS ${token}`, Accept: 'application/json' },
        });
        await ensureOk(res, 'Could not list Okta users', {
          401: 'Invalid API token. Check you copied it in full and that it has not expired.',
          403: 'Permission denied. The token needs the okta.users.read scope (or the Read-only Admin role).',
          404: `Domain "${domain}" not found. Use the form your-org.okta.com, without https://.`,
        });
        const data = await readJson(res);
        for (const u of Array.isArray(data) ? data : []) {
          const p = u.profile || {};
          const email = p.email || p.login || '';
          if (!email) continue;
          out.push({
            full_name: [p.firstName, p.lastName].filter(Boolean).join(' ') || email.split('@')[0],
            email, department: p.department || '', role: p.title || '',
            status: u.status === 'ACTIVE' ? ACTIVE : GONE, start_date: '', end_date: '',
          });
        }
        url = (res.headers.get('Link') || '').match(/<([^>]+)>;\s*rel="next"/)?.[1] || null;
      }
      return out;
    },
  },

  github: {
    required: ['token', 'org'],
    async listUsers({ token, org }) {
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': USER_AGENT,
      };
      const members = [];
      for (let page = 1; page <= 10; page++) {
        const res = await fetch(
          `https://api.github.com/orgs/${encodeURIComponent(org)}/members?per_page=100&page=${page}`,
          { headers }
        );
        await ensureOk(res, 'Could not list organisation members', {
          401: 'Invalid GitHub token.',
          403: 'Permission denied. The token needs the read:org scope.',
          404: `Organisation "${org}" not found, or the token cannot see it.`,
        });
        const batch = await readJson(res);
        if (!Array.isArray(batch) || !batch.length) break;
        members.push(...batch);
        if (batch.length < 100) break;
      }
      // GitHub only exposes name/email on the per-user endpoint. Cap the fan-out
      // so a large org cannot hold the function open.
      const out = [];
      for (const m of members.slice(0, 300)) {
        let detail = {};
        try {
          const r = await fetch(`https://api.github.com/users/${encodeURIComponent(m.login)}`, { headers });
          if (r.ok) detail = await readJson(r);
        } catch { /* a missing profile must not fail the whole sync */ }
        out.push({
          full_name: detail.name || m.login,
          email: detail.email || '',
          department: '', role: (detail.bio || '').slice(0, 60),
          status: ACTIVE, start_date: '', end_date: '',
        });
      }
      return out;
    },
  },

  asana: {
    required: ['token'],
    async listUsers({ token }) {
      const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
      const wsRes = await fetch('https://app.asana.com/api/1.0/workspaces', { headers });
      await ensureOk(wsRes, 'Could not read Asana workspaces', {
        401: 'Invalid Asana personal access token.',
      });
      const workspace = (await readJson(wsRes)).data?.[0];
      if (!workspace) throw new IntegrationError('No Asana workspace is visible to this token.');

      const out = [];
      let offset = '';
      for (let i = 0; i < 20; i++) {
        const params = new URLSearchParams({ opt_fields: 'name,email', limit: '100' });
        if (offset) params.set('offset', offset);
        const res = await fetch(
          `https://app.asana.com/api/1.0/workspaces/${workspace.gid}/users?${params}`, { headers }
        );
        await ensureOk(res, 'Could not list Asana users');
        const data = await readJson(res);
        for (const u of data.data || []) {
          if (!u.email) continue;
          out.push({
            full_name: u.name || '', email: u.email,
            department: '', role: '', status: ACTIVE, start_date: '', end_date: '',
          });
        }
        offset = data.next_page?.offset || '';
        if (!offset) break;
      }
      return out;
    },
  },

  salesforce: {
    // The refresh token is the long-lived secret; the access token is derived
    // on each sync and never stored.
    required: ['clientId', 'refreshToken', 'instanceUrl'],
    async listUsers({ clientId, refreshToken, instanceUrl, loginUrl }) {
      const tokenRes = await fetch(`${loginUrl || 'https://login.salesforce.com'}/services/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, refresh_token: refreshToken }),
      });
      await ensureOk(tokenRes, 'Salesforce refused to refresh the session', {
        400: 'Salesforce rejected the saved credentials. Reconnect to authorise again.',
      });
      const accessToken = (await readJson(tokenRes)).access_token;
      if (!accessToken) throw new IntegrationError('Salesforce returned no access token.');

      const soql = encodeURIComponent(
        "SELECT Id,Name,Email,Department,Title,IsActive,CreatedDate FROM User WHERE IsActive=true AND UserType='Standard'"
      );
      const out = [];
      let url = `${instanceUrl}/services/data/v59.0/query?q=${soql}`;
      for (let i = 0; i < 20 && url; i++) {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        });
        await ensureOk(res, 'Could not query Salesforce users', {
          403: 'Permission denied. The Connected App needs the "api" scope and the user needs API access.',
        });
        const data = await readJson(res);
        for (const u of data.records || []) {
          if (!u.Email) continue;
          out.push({
            full_name: u.Name || '', email: u.Email,
            department: u.Department || '', role: u.Title || '',
            status: ACTIVE,
            start_date: u.CreatedDate ? String(u.CreatedDate).slice(0, 10) : '',
            end_date: '',
          });
        }
        url = data.nextRecordsUrl ? `${instanceUrl}${data.nextRecordsUrl}` : null;
      }
      return out;
    },
  },

  zoom: {
    // Server-to-Server OAuth: the client secret is admin-scoped over the whole
    // Zoom account and never expires.
    required: ['accountId', 'clientId', 'clientSecret'],
    async listUsers({ accountId, clientId, clientSecret }) {
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const tokRes = await fetch(
        `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
        { method: 'POST', headers: { Authorization: `Basic ${basic}` } }
      );
      await ensureOk(tokRes, 'Zoom rejected those credentials');
      const accessToken = (await readJson(tokRes)).access_token;
      if (!accessToken) throw new IntegrationError('Zoom returned no access token.');

      const out = [];
      let next = '';
      for (let i = 0; i < 10; i++) {
        const url = `https://api.zoom.us/v2/users?status=active&page_size=300${next ? `&next_page_token=${encodeURIComponent(next)}` : ''}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        await ensureOk(res, 'Could not fetch Zoom users');
        const data = await readJson(res);
        for (const u of data.users || []) {
          if (!u.email) continue;
          out.push({
            full_name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.display_name || u.email.split('@')[0],
            email: u.email, department: u.dept || '', role: u.role_name || '',
            status: u.status === 'active' ? ACTIVE : GONE,
            start_date: u.created_at ? String(u.created_at).slice(0, 10) : '',
            end_date: '',
          });
        }
        next = data.next_page_token || '';
        if (!next) break;
      }
      return out;
    },
  },
};

module.exports = { VENDORS, IntegrationError, ACTIVE, GONE };
