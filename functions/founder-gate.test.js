import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isFounderCaller } from './founder-gate.js';

// ── Who the server lets into founderops ────────────────────────────────────
//
// A token's email claim is also there for an email/password account whose
// owner never proved the mailbox, so the founder's address opens the gate
// only when Firebase has verified it. Anything else that said "founder" is
// unchanged: the allow-listed uids and the is_founder flag.

const UIDS = ['founder_uid'];
const EMAILS = ['founder@example.com'];
const gate = (decoded, userDoc = null) => isFounderCaller({ decoded, userDoc, founderUids: UIDS, founderEmails: EMAILS });

describe('isFounderCaller', () => {
  it('an allow-listed uid is the founder, whatever its email says', () => {
    expect(gate({ uid: 'founder_uid' })).toBe(true);
    expect(gate({ uid: 'founder_uid', email: 'x@y.z', email_verified: false })).toBe(true);
  });

  it('the founder’s address counts when verified, in any case', () => {
    expect(gate({ uid: 'u', email: 'founder@example.com', email_verified: true })).toBe(true);
    expect(gate({ uid: 'u', email: 'Founder@Example.com', email_verified: true })).toBe(true);
  });

  it('the same address does not count unverified, or with no claim, or with a truthy non-true value', () => {
    expect(gate({ uid: 'u', email: 'founder@example.com', email_verified: false })).toBe(false);
    expect(gate({ uid: 'u', email: 'founder@example.com' })).toBe(false);
    expect(gate({ uid: 'u', email: 'founder@example.com', email_verified: 'true' })).toBe(false);
  });

  it('the is_founder flag on the user document still works, and only when exactly true', () => {
    expect(gate({ uid: 'u' }, { is_founder: true })).toBe(true);
    expect(gate({ uid: 'u' }, { is_founder: 'yes' })).toBe(false);
    expect(gate({ uid: 'u' }, {})).toBe(false);
  });

  it('nobody else, and nothing at all, is not the founder', () => {
    expect(gate({ uid: 'u', email: 'other@example.com', email_verified: true })).toBe(false);
    expect(gate({ uid: 'u' })).toBe(false);
    expect(gate(null)).toBe(false);
    expect(gate({ uid: 'u', email: '', email_verified: true })).toBe(false);
  });
});

describe('index.js uses the gate, and asks Firebase whether the session was revoked on the sensitive calls', () => {
  // Reading the source is how the repository holds the other server rules
  // (notifications.test.jsx): the HTTP functions cannot be run here.
  const src = readFileSync(resolve(process.cwd(), 'functions/index.js'), 'utf8');
  const body = (name, next) => src.slice(src.indexOf(`exports.${name} =`), src.indexOf(next));

  it('founderops no longer matches an email on its own', () => {
    const f = body('founderops', 'const { action, targetUid');
    expect(f).toContain('isFounderCaller({');
    expect(f).not.toMatch(/FOUNDER_EMAILS\.includes\(\(decoded\.email/);
    expect(f).toContain('checkRevoked: true');
  });

  it('billing calls check revocation', () => {
    for (const name of ['createCheckout', 'createPortal']) {
      const f = src.slice(src.indexOf(`exports.${name} =`), src.indexOf(`exports.${name} =`) + 1200);
      expect(f, name).toContain('verifyAuth(req, res, { checkRevoked: true })');
    }
  });

  it('the workspace actions that share, unshare or delete check revocation; plain reads and writes do not', () => {
    const m = /REVOCATION_CHECKED_ACTIONS = new Set\(\[([^\]]+)\]\)/.exec(src);
    const actions = m[1].split(',').map((a) => a.trim().replace(/'/g, ''));
    expect(actions.sort()).toEqual(['createorg', 'deleteaccount', 'deleteorg', 'invite', 'restoreorg', 'revoke', 'setrole']);
    for (const a of ['read', 'write', 'mine', 'listorgs', 'members']) expect(actions).not.toContain(a);
    expect(src).toContain('REVOCATION_CHECKED_ACTIONS.has(action)');
  });

  it('verifyAuth takes the option, and a plain call still does not pay for the lookup', () => {
    expect(src).toMatch(/async function verifyAuth\(req, res, \{ checkRevoked = false \} = \{\}\)/);
    expect(src).toContain('verifyIdToken(token, checkRevoked)');
  });
});

describe('the Firestore rules say the same about the founder’s address', () => {
  const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
  it('isFounderEmail requires email_verified', () => {
    const fn = rules.slice(rules.indexOf('function isFounderEmail()'), rules.indexOf('function isFounderUid()'));
    expect(fn).toContain("email_verified', false) == true");
  });
});
