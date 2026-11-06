import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SSO_PROVIDERS, SSO_CODE, signInProvider, isSsoProvider, ssoRequired, ssoRefusal } from './sso-policy.js';

// ── Mandatory company sign-in, on the server ───────────────────────────────

const google = { uid: 'u', firebase: { sign_in_provider: 'google.com' } };
const microsoft = { uid: 'u', firebase: { sign_in_provider: 'microsoft.com' } };
const password = { uid: 'u', firebase: { sign_in_provider: 'password' } };

describe('the policy', () => {
  it('names Google and Microsoft, and nothing else', () => {
    expect(SSO_PROVIDERS).toEqual(['google.com', 'microsoft.com']);
    expect(isSsoProvider('google.com')).toBe(true);
    expect(isSsoProvider('password')).toBe(false);
    expect(isSsoProvider('')).toBe(false);
    expect(isSsoProvider(undefined)).toBe(false);
  });
  it('reads the session provider from the token, and tolerates a token without one', () => {
    expect(signInProvider(google)).toBe('google.com');
    expect(signInProvider({ uid: 'u' })).toBe('');
    expect(signInProvider(null)).toBe('');
  });
  it('is off unless the field is exactly true', () => {
    expect(ssoRequired({ sso_required: true })).toBe(true);
    expect(ssoRequired({ sso_required: 'true' })).toBe(false);
    expect(ssoRequired({})).toBe(false);
    expect(ssoRequired(null)).toBe(false);
  });
});

describe('the refusal', () => {
  it('lets anyone through while the policy is off', () => {
    expect(ssoRefusal({}, password)).toBeNull();
    expect(ssoRefusal(null, { uid: 'u' })).toBeNull();
  });
  it('lets a Google or Microsoft session through and refuses a password one', () => {
    expect(ssoRefusal({ sso_required: true }, google)).toBeNull();
    expect(ssoRefusal({ sso_required: true }, microsoft)).toBeNull();
    const r = ssoRefusal({ sso_required: true }, password);
    expect(r).toMatchObject({ code: SSO_CODE, providers: SSO_PROVIDERS, signed_in_with: 'password' });
    expect(r.error).toMatch(/Google or Microsoft/);
  });
  it('refuses a session whose token names no provider at all', () => {
    expect(ssoRefusal({ sso_required: true }, { uid: 'u' })).toMatchObject({ code: 'sso_required', signed_in_with: 'unknown' });
  });
});

describe('where the workspace function applies it', () => {
  const src = readFileSync(resolve(__dirname, 'index.js'), 'utf8');
  const fn = src.slice(src.indexOf('exports.workspace = onRequest('), src.indexOf('\nexports.', src.indexOf('exports.workspace = onRequest(') + 1));
  const block = (action) => {
    const start = fn.indexOf(`if (action === '${action}')`);
    expect(start, `no ${action} action`).toBeGreaterThan(-1);
    const next = fn.indexOf("\n      if (action === '", start + 1);
    return fn.slice(start, next === -1 ? fn.length : next);
  };
  it('every path to a workspace’s data asks the gate before touching it', () => {
    for (const action of ['read', 'write', 'audit', 'auditchain']) {
      const b = block(action);
      const gate = b.indexOf('await ssoGate(');
      expect(gate, `${action} never calls ssoGate`).toBeGreaterThan(-1);
      const data = b.search(/assembleUserdata|appendToChain|readChain/);
      expect(gate, `${action}: the gate must run before the data is read or written`).toBeLessThan(data);
    }
  });
  it('the gate applies the owner’s policy, or the agency’s for a client workspace, and answers 403 with the code', () => {
    const gate = fn.slice(fn.indexOf('const ssoGate = async'), fn.indexOf('const ssoGate = async') + 900);
    expect(gate).toMatch(/org\?\.owner_uid \|\| target/);
    expect(gate).toMatch(/collection\('users'\)\.doc\(policyUid\)/);
    expect(gate).toMatch(/ssoRefusal\(/);
    expect(gate).toMatch(/status\(403\)\.json\(refusal\)/);
  });
  it('is one import away from the policy module', () => {
    expect(src).toMatch(/require\('\.\/sso-policy'\)/);
  });
});
