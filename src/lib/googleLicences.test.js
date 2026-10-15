import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  fetchCustomerId, fetchLicenceAssignments, groupBySku, toolForSku, reconcileSku,
  LICENSING_SCOPE, GOOGLE_LICENCE_PRODUCTS, GoogleLicenceError,
} from './googleLicences';

// ── Reading who holds which Google licence ─────────────────────────────────

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** A fake Google: answers per URL, records every request. */
function fakeGoogle(routes) {
  const calls = [];
  const fetchImpl = vi.fn(async (url, init) => {
    calls.push({ url: String(url), init });
    for (const [match, answer] of routes) if (String(url).includes(match)) return typeof answer === 'function' ? answer(String(url)) : answer;
    return reply(404, { error: { message: 'not found' } });
  });
  return { fetchImpl, calls };
}

describe('the organisation id', () => {
  it('is read from the directory', async () => {
    const g = fakeGoogle([['/directory/v1/users', reply(200, { users: [{ customerId: 'C0abc' }] })]]);
    expect(await fetchCustomerId('tok', g.fetchImpl)).toBe('C0abc');
    expect(g.calls[0].url).toContain('customer=my_customer');
    expect(g.calls[0].init.headers.Authorization).toBe('Bearer tok');
  });

  it('says plainly when the account is not an admin, or the sign-in lapsed', async () => {
    await expect(fetchCustomerId('t', fakeGoogle([['/users', reply(403, {})]]).fetchImpl)).rejects.toMatchObject({ code: 'not_admin' });
    await expect(fetchCustomerId('t', fakeGoogle([['/users', reply(401, {})]]).fetchImpl)).rejects.toBeInstanceOf(GoogleLicenceError);
  });
});

describe('the licence list', () => {
  const page1 = { items: [
    { userId: 'Ana@acme.fr', productId: '101047', productName: 'Gemini', skuId: '1010470003', skuName: 'Gemini Business' },
    { userId: 'ben@acme.fr', productId: '101047', productName: 'Gemini', skuId: '1010470003', skuName: 'Gemini Business' },
  ], nextPageToken: 'p2' };
  const page2 = { items: [{ userId: 'cle@acme.fr', productId: '101047', productName: 'Gemini', skuId: '1010470001', skuName: 'Gemini Enterprise - Legacy' }] };

  it('follows every page, asks with the organisation id, and keeps Google\'s own names', async () => {
    const g = fakeGoogle([['/product/101047/users', (url) => reply(200, url.includes('pageToken=p2') ? page2 : page1)]]);
    const { assignments, skipped } = await fetchLicenceAssignments('t', 'C0abc', [{ id: '101047', label: 'Gemini' }, { id: 'Google-Vault', label: 'Vault' }], g.fetchImpl);
    expect(assignments.map((a) => a.email)).toEqual(['ana@acme.fr', 'ben@acme.fr', 'cle@acme.fr']);
    expect(assignments[2].skuName).toBe('Gemini Enterprise - Legacy');
    expect(g.calls.every((c) => c.url.includes('customerId=C0abc'))).toBe(true);
    // A product the organisation does not have is skipped, not an error.
    expect(skipped).toEqual(['Google-Vault']);
  });

  it('a lapsed sign-in stops the read', async () => {
    const g = fakeGoogle([['/product/', reply(401, {})]]);
    await expect(fetchLicenceAssignments('t', 'C0', [{ id: '101047' }], g.fetchImpl)).rejects.toMatchObject({ code: 'unauthorised' });
  });

  it('asks about Gemini and Google Workspace among others', () => {
    const ids = GOOGLE_LICENCE_PRODUCTS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['101047', 'Google-Apps']));
  });

  it('groups by SKU, most holders first, one person counted once', () => {
    const skus = groupBySku([
      { email: 'a', productId: 'p', productName: 'P', skuId: '1', skuName: 'One' },
      { email: 'a', productId: 'p', productName: 'P', skuId: '1', skuName: 'One' },
      { email: 'b', productId: 'p', productName: 'P', skuId: '2', skuName: 'Two' },
      { email: 'c', productId: 'p', productName: 'P', skuId: '2', skuName: 'Two' },
    ]);
    expect(skus.map((s) => [s.skuName, s.emails.length])).toEqual([['Two', 2], ['One', 1]]);
  });
});

describe('comparing with Stacklens', () => {
  const sku = { productId: '101047', skuId: '1010470003', skuName: 'Gemini Business', emails: ['ana@acme.fr', 'ben@acme.fr', 'shared@acme.fr'] };
  const db = {
    employees: [
      { id: 'ana', email: 'ana@acme.fr', status: 'active' },
      { id: 'ben', email: 'BEN@acme.fr', status: 'active' },
      { id: 'dan', email: 'dan@acme.fr', status: 'active' },
    ],
    tools: [{ id: 'gem', name: 'Gemini Business' }, { id: 'old', name: 'Gemini Business', status: 'decommissioned' }],
    access: [
      { id: 'a1', tool_id: 'gem', employee_id: 'ana', employee_email: 'ana@acme.fr', status: 'active' },
      { id: 'a2', tool_id: 'gem', employee_id: 'dan', employee_email: 'dan@acme.fr', status: 'active' },
      { id: 'a3', tool_id: 'gem', employee_id: 'ben', employee_email: 'ben@acme.fr', status: 'revoked' },
    ],
  };

  it('finds the tool by the link, else by the same name, never a decommissioned one', () => {
    expect(toolForSku(db.tools, sku).id).toBe('gem');
    const linked = [{ id: 'x', name: 'Something else', google_sku: { productId: '101047', skuId: '1010470003' } }, ...db.tools];
    expect(toolForSku(linked, sku).id).toBe('x');
    expect(toolForSku([{ id: 'old', name: 'Gemini Business', status: 'decommissioned' }], sku)).toBeNull();
  });

  it('who to record, who Google does not license, and who is not among your people', () => {
    const r = reconcileSku(db, sku, db.tools[0]);
    expect(r.toRecord.map((e) => e.id)).toEqual(['ben']);          // revoked row does not count as held
    expect(r.notInGoogle.map((a) => a.id)).toEqual(['a2']);
    expect(r.unknown).toEqual(['shared@acme.fr']);
  });
});

describe('it only reads', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/lib/googleLicences.js'), 'utf8');
  const card = readFileSync(resolve(process.cwd(), 'src/components/GoogleLicencesCard.jsx'), 'utf8');

  it('every request to Google is a GET, and nothing is kept in the browser', () => {
    expect(src).not.toMatch(/method:\s*'(POST|PUT|PATCH|DELETE)'/i);
    expect((src.match(/fetchImpl\(/g) || []).length).toBe(1);
    expect(src).toMatch(/method: 'GET'/);
    for (const f of [src, card]) expect(f).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  });

  it('asks for the licensing scope and says why it is broader than reading', () => {
    expect(LICENSING_SCOPE).toBe('https://www.googleapis.com/auth/apps.licensing');
    const tr = readFileSync(resolve(process.cwd(), 'src/translations.js'), 'utf8');
    expect(tr).toMatch(/gl_readonly: "Read only: Stacklens never assigns or removes a licence in Google/);
    expect(tr).toMatch(/gl_readonly: "Lecture seule : Stacklens n'attribue ni ne retire jamais de licence dans Google/);
  });
});
