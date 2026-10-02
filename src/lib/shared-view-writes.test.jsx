import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const saveUserData = vi.fn().mockResolvedValue(1);
vi.mock('../firebase-config', () => ({
  saveUserData: (...a) => saveUserData(...a), loadUserData: vi.fn().mockResolvedValue(null), logConsent: vi.fn(),
  workspaceWrite: vi.fn().mockResolvedValue({ ok: true }), workspaceRead: vi.fn().mockResolvedValue({ data: {} }),
}));

import { saveOwnWorkspaceNow, enterSharedView } from './db';

// ── Someone else's workspace never lands in your own account ───────────────
//
// In a shared workspace (a teammate's) or a client workspace (an
// accountant's), the browser holds that other company's data. Five settings
// screens wrote "the workspace in this browser" straight to the viewer's own
// cloud document, so toggling a notification inside a client's workspace
// overwrote the accountant's account with the client's employees, which then
// outlived the client's deletion and its purge.

beforeEach(() => { localStorage.clear(); saveUserData.mockClear(); });

describe('saveOwnWorkspaceNow', () => {
  it('saves the account\'s own workspace', async () => {
    expect(await saveOwnWorkspaceNow('u1', { tools: [] })).toBe(true);
    expect(saveUserData).toHaveBeenCalledWith('u1', { tools: [] });
  });

  it('refuses a shared copy, by its flag or by what the browser holds', async () => {
    expect(await saveOwnWorkspaceNow('u1', { tools: [], _shared_view: { owner_uid: 'o' } })).toBe(false);
    enterSharedView({ tools: [{ id: 'x' }], user: {} }, { owner_uid: 'o', role: 'editor' });
    expect(await saveOwnWorkspaceNow('u1', { tools: [] })).toBe(false);
    expect(saveUserData).not.toHaveBeenCalled();
  });

  it('refuses without an account', async () => {
    expect(await saveOwnWorkspaceNow(undefined, { tools: [] })).toBe(false);
  });
});

describe('no screen writes the browser\'s workspace to the account directly', () => {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- walking this repo's src/
  const walk = (d) => readdirSync(d).flatMap((e) => { const f = join(d, e); return statSync(f).isDirectory() ? walk(f) : /\.jsx?$/.test(e) && !/\.test\./.test(e) ? [f] : []; });
  it('only firebase-config, lib/db (saveOwnWorkspaceNow, the sign-out flush) and onboarding (which reads the cloud copy first) call saveUserData', () => {
    const SRC = resolve(process.cwd(), 'src');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- files found by walking src/
    const callers = walk(SRC).filter((f) => /\bsaveUserData\(/.test(readFileSync(f, 'utf8'))).map((f) => relative(SRC, f)).sort();
    expect(callers).toEqual(['firebase-config.js', 'lib/db.js', 'pages/OnboardingPage.jsx']);
  });
});

describe('the Data tab bulk deletes', () => {
  const tab = () => readFileSync(resolve(process.cwd(), 'src/pages/settings/DataTab.jsx'), 'utf8');
  it('are written to the audit log, which promises every change to tools, people and access', () => {
    expect(tab().match(/appendAudit\(cur, \{ action: 'data\.deleted'/g)).toHaveLength(2);
  });
  it("refuse a viewer of someone else's workspace before touching anything", () => {
    const src = tab();
    const guards = src.match(/if \(getSharedView\(\) && getSharedView\(\)\.role !== 'editor'\) \{ toast\.error\(t\('set_shared_readonly'\)\); return; \}/g);
    expect(guards).toHaveLength(2);
    for (const at of [...src.matchAll(/set_shared_readonly/g)].map((m) => m.index)) {
      expect(src.indexOf('cur.tools = []', at) === -1 || src.indexOf('cur.employees = []', at) > at).toBe(true);
    }
  });
});

describe('signing in again inside a shared workspace', () => {
  it('keeps the owner’s plan for a colleague’s workspace, refreshes the agency’s own for a client one', () => {
    const auth = readFileSync(resolve(process.cwd(), 'src/hooks/useAuth.js'), 'utf8');
    const patch = auth.slice(auth.indexOf('cur.user = {\n          ...cur.user,\n          is_authenticated:   true'), auth.indexOf('saveDb(cur, { cloudSync: false });'));
    expect(patch).toMatch(/\.\.\.\(cur\._shared_view && !cur\.user\?\.is_client_org \? \{\} : \{\s*plan:\s+effectivePlan,/);
    // Every plan field is inside that condition, none before it.
    const before = patch.slice(0, patch.indexOf('...(cur._shared_view'));
    for (const field of ['plan:', 'stripe_customer_id:', 'subscription_status:', 'is_founder:', 'trial_started_at:', 'plan_grant_until:']) {
      expect(before, field).not.toContain(field);
    }
  });
});
