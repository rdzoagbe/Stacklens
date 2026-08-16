import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const { VENDORS, IntegrationError } = require_('./integrations.js');

// These run server-side against real vendor APIs that cannot be reached from
// a test, so what is pinned is the part a bug would corrupt: the shape and
// enum values written into a customer's employee directory, and the refusals.

const ok = (body, status = 200, headers = {}) => ({
  ok: status < 300, status,
  json: async () => body,
  headers: { get: (k) => headers[k] ?? null },
});

let calls;
beforeEach(() => {
  calls = [];
  global.fetch = vi.fn(async (url, init) => {
    calls.push({ url: String(url), init });
    return global.__next.shift() ?? ok({});
  });
  global.__next = [];
});
afterEach(() => { delete global.__next; });

const VALID_STATUSES = ['active', 'offboarding', 'offboarded'];

describe('every vendor returns records the app can actually store', () => {
  const cases = {
    slack: {
      creds: { token: 't' },
      responses: [ok({ ok: true, members: [
        { name: 'noah', deleted: false, profile: { real_name: 'Noah Petit', email: 'noah@acme.com', title: 'Growth' } },
        { name: 'gone', deleted: true,  profile: { real_name: 'Old Hand', email: 'old@acme.com' } },
        { name: 'bot',  is_bot: true,   profile: { email: 'bot@acme.com' } },
        { name: 'noemail', profile: {} },
      ] })],
      expect: (users) => {
        expect(users.map(u => u.email)).toEqual(['noah@acme.com', 'old@acme.com']); // bot and email-less dropped
        expect(users[1].status).toBe('offboarded'); // was 'inactive', which the app does not accept
      },
    },
    okta: {
      creds: { token: 't', domain: 'acme.okta.com' },
      responses: [ok([
        { status: 'ACTIVE',      profile: { firstName: 'Amina', lastName: 'Dupont', email: 'amina@acme.com', department: 'Security', title: 'Lead' } },
        { status: 'DEPROVISIONED', profile: { email: 'ex@acme.com' } },
      ])],
      expect: (users) => {
        expect(users[0]).toMatchObject({ full_name: 'Amina Dupont', department: 'Security', role: 'Lead', status: 'active' });
        expect(users[1].status).toBe('offboarded');
      },
    },
    github: {
      creds: { token: 't', org: 'acme' },
      responses: [
        ok([{ login: 'octo' }]),
        ok({ name: 'Octo Cat', email: 'octo@acme.com', bio: 'Engineer' }),
      ],
      expect: (users) => expect(users[0]).toMatchObject({ full_name: 'Octo Cat', email: 'octo@acme.com', status: 'active' }),
    },
    asana: {
      creds: { token: 't' },
      responses: [
        ok({ data: [{ gid: 'ws1' }] }),
        ok({ data: [{ name: 'Emma Girard', email: 'emma@acme.com' }, { name: 'No Email' }] }),
      ],
      expect: (users) => {
        expect(users).toHaveLength(1); // the email-less row is dropped
        expect(users[0].email).toBe('emma@acme.com');
      },
    },
    salesforce: {
      creds: { clientId: 'c', refreshToken: 'r', instanceUrl: 'https://acme.my.salesforce.com' },
      responses: [
        ok({ access_token: 'at' }),
        ok({ records: [{ Name: 'Karim Benali', Email: 'karim@acme.com', Department: 'Sales', Title: 'Manager', CreatedDate: '2024-03-01T00:00:00.000+0000' }] }),
      ],
      expect: (users) => expect(users[0]).toMatchObject({ full_name: 'Karim Benali', department: 'Sales', start_date: '2024-03-01' }),
    },
    zoom: {
      creds: { accountId: 'a', clientId: 'c', clientSecret: 's' },
      responses: [
        ok({ access_token: 'at' }),
        ok({ users: [{ first_name: 'Lea', last_name: 'Fontaine', email: 'lea@acme.com', status: 'active', dept: 'HR' }] }),
      ],
      expect: (users) => expect(users[0]).toMatchObject({ full_name: 'Lea Fontaine', department: 'HR', status: 'active' }),
    },
  };

  for (const [vendor, c] of Object.entries(cases)) {
    it(`${vendor}: normalises to the app's own record shape`, async () => {
      global.__next = [...c.responses];
      const users = await VENDORS[vendor].listUsers(c.creds);
      for (const u of users) {
        expect(Object.keys(u).sort()).toEqual(
          ['department', 'email', 'end_date', 'full_name', 'role', 'start_date', 'status']
        );
        expect(VALID_STATUSES).toContain(u.status);
        expect(u.email).toBeTruthy();
      }
      c.expect(users);
    });
  }
});

describe('credentials never leak into a URL', () => {
  it('sends secrets in headers or a POST body, never a query string', async () => {
    for (const [vendor, creds] of Object.entries({
      slack: { token: 'SECRET' },
      okta: { token: 'SECRET', domain: 'acme.okta.com' },
      asana: { token: 'SECRET' },
    })) {
      calls = [];
      global.__next = vendor === 'asana'
        ? [ok({ data: [{ gid: 'w' }] }), ok({ data: [] })]
        : [ok(vendor === 'slack' ? { ok: true, members: [] } : [])];
      await VENDORS[vendor].listUsers(creds);
      for (const { url } of calls) expect(url).not.toContain('SECRET');
    }
  });
});

describe('failures are reported, not swallowed', () => {
  it('Slack returns HTTP 200 with ok:false — that must still fail', async () => {
    global.__next = [ok({ ok: false, error: 'invalid_auth' })];
    await expect(VENDORS.slack.listUsers({ token: 'bad' })).rejects.toThrow('invalid_auth');
  });

  it('Okta 401 explains the token, not just the status code', async () => {
    global.__next = [ok({}, 401)];
    await expect(VENDORS.okta.listUsers({ token: 'bad', domain: 'acme.okta.com' }))
      .rejects.toThrow(/Invalid API token/);
  });

  it('Okta 404 tells the admin the domain format', async () => {
    global.__next = [ok({}, 404)];
    await expect(VENDORS.okta.listUsers({ token: 't', domain: 'https://acme.okta.com' }))
      .rejects.toThrow(/your-org\.okta\.com/);
  });

  it('GitHub 403 names the missing scope', async () => {
    global.__next = [ok({}, 403)];
    await expect(VENDORS.github.listUsers({ token: 't', org: 'acme' })).rejects.toThrow(/read:org/);
  });

  it('Asana with no visible workspace fails clearly', async () => {
    global.__next = [ok({ data: [] })];
    await expect(VENDORS.asana.listUsers({ token: 't' })).rejects.toThrow(/No Asana workspace/);
  });

  it('Salesforce rejecting the refresh token asks the user to reconnect', async () => {
    global.__next = [ok({ error: 'invalid_grant' }, 400)];
    await expect(VENDORS.salesforce.listUsers({ clientId: 'c', refreshToken: 'stale', instanceUrl: 'https://x' }))
      .rejects.toThrow(/Reconnect/);
  });

  it('a vendor error is an IntegrationError, so the endpoint answers 4xx not 500', async () => {
    global.__next = [ok({}, 401)];
    await expect(VENDORS.okta.listUsers({ token: 'x', domain: 'd' })).rejects.toBeInstanceOf(IntegrationError);
  });
});

describe('pagination terminates', () => {
  it('stops when Slack stops sending a cursor', async () => {
    global.__next = [
      ok({ ok: true, members: [{ name: 'a', profile: { email: 'a@x.com' } }], response_metadata: { next_cursor: 'c1' } }),
      ok({ ok: true, members: [{ name: 'b', profile: { email: 'b@x.com' } }] }),
    ];
    const users = await VENDORS.slack.listUsers({ token: 't' });
    expect(users.map(u => u.email)).toEqual(['a@x.com', 'b@x.com']);
    expect(calls).toHaveLength(2);
  });

  it('does not loop forever if a vendor keeps returning a cursor', async () => {
    global.__next = Array.from({ length: 40 }, () =>
      ok({ ok: true, members: [], response_metadata: { next_cursor: 'always' } }));
    await VENDORS.slack.listUsers({ token: 't' });
    expect(calls.length).toBeLessThanOrEqual(20);
  });
});

describe('the vendor registry', () => {
  it('declares required credentials for every vendor', () => {
    for (const [name, spec] of Object.entries(VENDORS)) {
      expect(Array.isArray(spec.required), name).toBe(true);
      expect(spec.required.length, name).toBeGreaterThan(0);
      expect(typeof spec.listUsers, name).toBe('function');
    }
  });

  it('covers exactly the six migrated vendors', () => {
    expect(Object.keys(VENDORS).sort())
      .toEqual(['asana', 'github', 'okta', 'salesforce', 'slack', 'zoom']);
  });
});
