import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const {
  MEMBER_WRITABLE_KEYS,
  MAX_ITEMS_PER_COLLECTION,
  WorkspaceWriteError,
  findMembership,
  assertCanWrite,
  buildSafeUpdate,
} = require_('./workspace-write.js');

// These cover the part of the tenant boundary that moved out of
// firestore.rules when membership stopped being read-only. The rules have 40
// tests behind them; this is the equivalent for the decisions now made in
// function code — who may write, and what of their payload is trusted.

const membership = (over = {}) => ({
  owner_uid: 'owner1', member_uid: 'member1',
  member_email: 'm@acme.com', role: 'editor', ...over,
});

describe('who is recognised as a member', () => {
  it('matches a membership bound to the caller uid', () => {
    const m = findMembership([membership()], { callerUid: 'member1', callerEmail: '' });
    expect(m?.member_uid).toBe('member1');
  });

  it('matches an unbound invite by verified email', () => {
    const m = findMembership([membership({ member_uid: null })], {
      callerUid: 'member1', callerEmail: 'm@acme.com',
    });
    expect(m).toBeTruthy();
  });

  it('does not match a stranger', () => {
    expect(findMembership([membership()], { callerUid: 'someone-else', callerEmail: 'x@y.com' }))
      .toBeNull();
  });

  it('never matches without a caller uid, even if the email lines up', () => {
    // An unauthenticated or malformed token must not resolve to a membership.
    expect(findMembership([membership({ member_uid: null })], {
      callerUid: '', callerEmail: 'm@acme.com',
    })).toBeNull();
  });

  it('does not match on an empty email against a record with no email', () => {
    expect(findMembership([{ owner_uid: 'o', member_uid: null, member_email: '', role: 'editor' }], {
      callerUid: 'member1', callerEmail: '',
    })).toBeNull();
  });

  it('survives junk rows rather than throwing', () => {
    expect(() => findMembership([null, undefined, {}, membership()], {
      callerUid: 'member1', callerEmail: '',
    })).not.toThrow();
  });
});

describe('who may write', () => {
  it('an editor may', () => {
    expect(assertCanWrite(membership({ role: 'editor' }))).toBe('editor');
  });

  it('a viewer may not', () => {
    expect(() => assertCanWrite(membership({ role: 'viewer' }))).toThrow(/read-only/);
  });

  it('a non-member may not', () => {
    expect(() => assertCanWrite(null)).toThrow(/Not a member/);
  });

  it('an unrecognised role is treated as viewer, not as permission', () => {
    // Fail closed: a typo, a future role, or an injected value must not grant
    // write access.
    for (const role of ['owner', 'admin', 'EDITOR', 'editor ', '', null, undefined, 1, true]) {
      expect(() => assertCanWrite(membership({ role })), String(role)).toThrow(/read-only/);
    }
  });

  it('refuses with 403, so the endpoint answers 403 rather than 500', () => {
    try { assertCanWrite(membership({ role: 'viewer' })); } catch (e) {
      expect(e).toBeInstanceOf(WorkspaceWriteError);
      expect(e.httpStatus).toBe(403);
    }
  });
});

describe('what of a member payload is trusted', () => {
  const owner = () => ({
    user: {
      email: 'owner@acme.com', plan: 'pro', is_founder: false,
      trial_started_at: 1234, budget_cap: 5000, role: 'owner',
      stripe_customer_id: 'cus_123',
    },
    tools: [{ id: 't1', name: 'Slack' }],
    employees: [{ id: 'e1' }],
    access: [],
    some_future_collection: [{ id: 'x' }],
  });

  it('applies the collections a member is allowed to change', () => {
    const out = buildSafeUpdate(owner(), { tools: [{ id: 't2', name: 'Notion' }] });
    expect(out.tools).toEqual([{ id: 't2', name: 'Notion' }]);
  });

  it('NEVER takes the user record from a member', () => {
    // The read action hands the member a user object cut down to six safe
    // fields. Accepting it back would wipe the owner's plan, trial stamp and
    // budget cap.
    const out = buildSafeUpdate(owner(), {
      user: { email: 'attacker@evil.com', plan: 'enterprise', is_founder: true },
      tools: [],
    });
    expect(out.user).toEqual(owner().user);
    expect(out.user.plan).toBe('pro');
    expect(out.user.is_founder).toBe(false);
    expect(out.user.trial_started_at).toBe(1234);
    expect(out.user.stripe_customer_id).toBe('cus_123');
  });

  it('preserves keys it has never heard of instead of dropping them', () => {
    // A collection added to the schema later must survive a member's write
    // even though this module predates it.
    const out = buildSafeUpdate(owner(), { tools: [] });
    expect(out.some_future_collection).toEqual([{ id: 'x' }]);
  });

  it('keeps the owner value for a writable key the member omitted', () => {
    const out = buildSafeUpdate(owner(), { tools: [] });
    expect(out.employees).toEqual([{ id: 'e1' }]);
  });

  it('refuses a payload trimmed to fit browser storage', () => {
    // saveDb archives the oldest access records when localStorage fills and
    // flags the blob. Syncing that up would delete the owner's history.
    expect(() => buildSafeUpdate(owner(), { _trimmed: true, access: [] }))
      .toThrow(/trimmed/);
  });

  it('strips the internal keys the persistence layer owns', () => {
    const out = buildSafeUpdate(owner(), {
      tools: [], _shared_view: { owner_uid: 'owner1' }, _uid: 'member1',
      _chunks: { employees: 99 }, _saved_at: 1, _updatedAt: 2,
    });
    for (const k of ['_shared_view', '_uid', '_chunks', '_saved_at', '_updatedAt', '_trimmed']) {
      expect(out, k).not.toHaveProperty(k);
    }
  });

  it('rejects a non-array where a collection is expected', () => {
    // Including null and undefined. A client sending either for a collection
    // is a bug, and quietly falling back to the owner's value would hide it
    // while appearing to have saved.
    for (const bad of [{}, 'x', 5, true, null, undefined]) {
      expect(() => buildSafeUpdate(owner(), { tools: bad }), String(bad)).toThrow(/must be an array/);
    }
  });

  it('rejects an implausibly large collection', () => {
    const huge = new Array(MAX_ITEMS_PER_COLLECTION + 1).fill({ id: 'x' });
    expect(() => buildSafeUpdate(owner(), { tools: huge })).toThrow(/exceeds/);
  });

  it('rejects a payload that is not an object', () => {
    for (const bad of [null, undefined, 'x', 5, []]) {
      expect(() => buildSafeUpdate(owner(), bad), String(bad)).toThrow(/payload is required/);
    }
  });

  it('an empty collection from a member genuinely empties it', () => {
    // Deleting every tool is a legitimate edit, and must not be mistaken for
    // an absent key.
    const out = buildSafeUpdate(owner(), { tools: [] });
    expect(out.tools).toEqual([]);
  });

  it('does not invent a user record when the owner has none', () => {
    const out = buildSafeUpdate({ tools: [] }, { user: { plan: 'enterprise' }, tools: [] });
    expect(out).not.toHaveProperty('user');
  });

  it('the writable allowlist is the data domain, and excludes user', () => {
    expect(MEMBER_WRITABLE_KEYS).not.toContain('user');
    expect(MEMBER_WRITABLE_KEYS).toContain('tools');
    expect(MEMBER_WRITABLE_KEYS).toContain('employees');
    expect(MEMBER_WRITABLE_KEYS).toContain('access');
  });
});

// ── Client workspaces owned by an agency (Phase 2) ──────────────────────────
// A client workspace has no owning user, so access rests entirely on the
// /client_orgs record. firestore.rules cannot help here — `isOwner(uid)` can
// never match an "org_..." id — so these decisions are the whole boundary.

const {
  ORG_ID_PREFIX, MAX_ORG_NAME,
  isClientOrgId, newClientOrgId, cleanOrgName, resolveWorkspaceAccess,
} = require_('./workspace-write.js');

describe('client workspace ids', () => {
  it('accepts an id this module generated', () => {
    const id = newClientOrgId('a1b2c3d4e5f6a7b8c9d0e1f2');
    expect(isClientOrgId(id)).toBe(true);
    expect(id.startsWith(ORG_ID_PREFIX)).toBe(true);
  });

  it('rejects anything that is not one, including an auth uid', () => {
    // The whole design rests on a client-org id never colliding with a real
    // uid, because that is what keeps isOwner(uid) from ever matching.
    for (const bad of [
      'abc123', 'org_', 'org_short', 'ORG_A1B2C3D4E5F6A7B8C9D0',
      'org_a1b2c3d4e5f6a7b8c9d0e', 'xorg_a1b2c3d4e5f6a7b8c9d0',
      '', null, undefined, 42, {},
    ]) {
      expect(isClientOrgId(bad), String(bad)).toBe(false);
    }
  });

  it('refuses to mint an id from thin randomness', () => {
    for (const weak of ['', 'abc', null, undefined, '1234567890']) {
      expect(() => newClientOrgId(weak), String(weak)).toThrow(/randomness/);
    }
  });

  it('ids are distinct for distinct randomness', () => {
    const a = newClientOrgId('a1b2c3d4e5f6a7b8c9d0');
    const b = newClientOrgId('0d9c8b7a6f5e4d3c2b1a');
    expect(a).not.toBe(b);
  });
});

describe('client names', () => {
  it('trims and keeps a normal name', () => {
    expect(cleanOrgName('  Acme Ltd  ')).toBe('Acme Ltd');
  });

  it('rejects empty, whitespace and non-strings', () => {
    for (const bad of ['', '   ', null, undefined, 5, {}, []]) {
      expect(() => cleanOrgName(bad), String(bad)).toThrow(/required/);
    }
  });

  it('rejects an oversized name', () => {
    expect(() => cleanOrgName('x'.repeat(MAX_ORG_NAME + 1))).toThrow(/characters or fewer/);
  });
});

describe('who may reach a workspace', () => {
  const org = { owner_uid: 'msp1', name: 'Acme' };

  it('the agency that owns a client workspace gets editor', () => {
    const a = resolveWorkspaceAccess({ clientOrg: org, memberships: [], callerUid: 'msp1', callerEmail: '' });
    expect(a).toEqual({ role: 'editor', via: 'client_org' });
  });

  it('ANOTHER agency gets nothing, even though the workspace exists', () => {
    // The failure that would matter most: one MSP reading another MSP's
    // client. There is no rule behind this — only this check.
    expect(resolveWorkspaceAccess({
      clientOrg: org, memberships: [], callerUid: 'msp2', callerEmail: 'msp2@x.com',
    })).toBeNull();
  });

  it('falls through to membership for an ordinary workspace', () => {
    const a = resolveWorkspaceAccess({
      clientOrg: null,
      memberships: [{ owner_uid: 'o1', member_uid: 'u1', role: 'editor' }],
      callerUid: 'u1', callerEmail: '',
    });
    expect(a).toEqual({ role: 'editor', via: 'membership' });
  });

  it('honours a viewer membership rather than promoting it', () => {
    const a = resolveWorkspaceAccess({
      clientOrg: null,
      memberships: [{ owner_uid: 'o1', member_uid: 'u1', role: 'viewer' }],
      callerUid: 'u1', callerEmail: '',
    });
    expect(a.role).toBe('viewer');
  });

  it('an unrecognised membership role falls closed to viewer', () => {
    for (const role of ['owner', 'admin', 'EDITOR', '', null]) {
      const a = resolveWorkspaceAccess({
        clientOrg: null,
        memberships: [{ owner_uid: 'o1', member_uid: 'u1', role }],
        callerUid: 'u1', callerEmail: '',
      });
      expect(a.role, String(role)).toBe('viewer');
    }
  });

  it('grants nothing without a caller uid', () => {
    expect(resolveWorkspaceAccess({ clientOrg: org, memberships: [], callerUid: '', callerEmail: 'msp1@x.com' })).toBeNull();
    expect(resolveWorkspaceAccess({ clientOrg: null, memberships: [], callerUid: null, callerEmail: '' })).toBeNull();
  });

  it('grants nothing when neither an org nor a membership matches', () => {
    expect(resolveWorkspaceAccess({ clientOrg: null, memberships: [], callerUid: 'u1', callerEmail: 'u1@x.com' })).toBeNull();
  });

  it('an empty caller uid never matches an empty owner_uid', () => {
    // Found by mutation testing: removing the callerUid guard left every other
    // test green, because findMembership guards itself. This is the case that
    // makes the guard load-bearing — two empty strings comparing equal would
    // hand an unauthenticated caller editor rights on a malformed record.
    expect(resolveWorkspaceAccess({
      clientOrg: { owner_uid: '' }, memberships: [], callerUid: '', callerEmail: '',
    })).toBeNull();
    expect(resolveWorkspaceAccess({
      clientOrg: { owner_uid: undefined }, memberships: [], callerUid: undefined, callerEmail: '',
    })).toBeNull();
    expect(resolveWorkspaceAccess({
      clientOrg: { owner_uid: null }, memberships: [], callerUid: null, callerEmail: '',
    })).toBeNull();
  });

  it('a malformed client-org record does not grant access', () => {
    for (const bad of [{}, { owner_uid: null }, { owner_uid: undefined }, { owner_uid: '' }]) {
      expect(resolveWorkspaceAccess({
        clientOrg: bad, memberships: [], callerUid: 'msp1', callerEmail: '',
      }), JSON.stringify(bad)).toBeNull();
    }
  });
});
