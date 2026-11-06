import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  SSO_PROVIDERS, SSO_FIELD, isSsoProvider, signInProviderOf, ssoRequiredFor, providerKind,
  subscribeSsoBlock, currentSsoBlock, raiseSsoBlock, clearSsoBlock, isSsoRefusal,
} from './sso';

const require_ = createRequire(import.meta.url);
const server = require_(resolve(process.cwd(), 'functions/sso-policy.js'));

// ── Mandatory company sign-in: the browser's half ──────────────────────────

describe('parity with the server', () => {
  it('names the same providers, the same field and the same refusal code', () => {
    expect(SSO_PROVIDERS).toEqual(server.SSO_PROVIDERS);
    expect(server.SSO_CODE).toBe('sso_required');
    expect(SSO_FIELD).toBe('sso_required');
    // And the rules name them too, literally: the rules cannot import.
    const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
    expect(rules).toContain(`in ['${SSO_PROVIDERS.join("', '")}']`);
    expect(rules).toMatch(/data\.get\('sso_required', false\) == true/);
  });
  it('reads the session provider from the token result, like the server reads the token', () => {
    expect(signInProviderOf({ signInProvider: 'google.com' })).toBe('google.com');
    expect(signInProviderOf(null)).toBe('');
    expect(isSsoProvider('microsoft.com')).toBe(true);
    expect(isSsoProvider('password')).toBe(false);
    expect(ssoRequiredFor({ sso_required: true })).toBe(true);
    expect(ssoRequiredFor({ sso_required: 1 })).toBe(false);
  });
  it('sorts a provider into a word for the screen', () => {
    expect(providerKind('google.com')).toBe('sso');
    expect(providerKind('password')).toBe('password');
    expect(providerKind('')).toBe('other');
    expect(providerKind('phone')).toBe('other');
  });
});

describe('the sign-in screen store', () => {
  it('raises, tells subscribers, and clears', () => {
    clearSsoBlock();
    const seen = [];
    const off = subscribeSsoBlock((b) => seen.push(b));
    expect(raiseSsoBlock({ scope: 'shared', owner: 'claire@acme.fr', signedInWith: 'password' }))
      .toEqual({ scope: 'shared', owner: 'claire@acme.fr', signedInWith: 'password' });
    expect(currentSsoBlock().scope).toBe('shared');
    expect(raiseSsoBlock({ scope: 'nonsense' }).scope).toBe('own');
    clearSsoBlock();
    clearSsoBlock(); // idempotent: no second notification
    expect(seen).toHaveLength(3);
    expect(seen[2]).toBeNull();
    off();
  });
  it('recognises the server’s refusal and nothing else', () => {
    const err = Object.assign(new Error('x'), { status: 403, code: 'sso_required' });
    expect(isSsoRefusal(err)).toBe(true);
    expect(isSsoRefusal(Object.assign(new Error('x'), { status: 403 }))).toBe(false);
    expect(isSsoRefusal(null)).toBe(false);
    vi.restoreAllMocks();
  });
});

describe('where the browser applies it', () => {
  const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');
  it('the auth hook reads the policy before loading anything, and loads nothing when refused', () => {
    const src = read('src/hooks/useAuth.js');
    const check = src.indexOf('ssoRequired && !isSsoProvider(signInProviderOf(tokenResult))');
    expect(check).toBeGreaterThan(-1);
    expect(src.slice(check, check + 800)).toMatch(/raiseSsoBlock\(\{ scope: 'own'[\s\S]*?return;/);
    expect(check).toBeLessThan(src.indexOf('await hydrateFromFirestore(fbUser.uid)'));
    expect(check).toBeLessThan(src.indexOf('setFirestoreUid(fbUser.uid)'));
    // A session that passes, and signing out, take the screen down.
    expect(src.match(/clearSsoBlock\(\)/g)).toHaveLength(2);
  });
  it('a shared workspace refused for the policy shows the screen, not an error toast', () => {
    const src = read('src/hooks/useClientWorkspaces.js');
    expect(src).toMatch(/if \(isSsoRefusal\(err\)\) raiseSsoBlock\(\{ scope: 'shared'/);
  });
  it('the screen is mounted once, in App, like the second-step prompt', () => {
    const app = read('src/App.jsx');
    expect(app).toMatch(/<SecondFactorPrompt \/>\s*<CompanySignInRequired \/>/);
  });
});
