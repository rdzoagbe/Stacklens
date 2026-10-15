// ── Who holds which Google licence, read from Google ───────────────────────
//
// The Enterprise License Manager API lists, per product, every user holding a
// licence and its SKU (e.g. "Gemini Business"). Stacklens reads that list in
// the browser with a token the Workspace admin grants for this one click, and
// compares it with the access records: who Google says has the licence and
// Stacklens has not recorded, and who Stacklens shows as licensed although
// Google has no licence for them.
//
// READ ONLY. Google offers no read-only licensing scope: `apps.licensing` also
// allows assigning and removing licences. Stacklens never does either; every
// request here is a GET, and googleLicences.test.js fails if one is not. The
// token and the list stay in memory for the page; nothing from Google is
// stored except what the person chooses to record (an access row, or which
// Stacklens tool a Google SKU is).
//
// The products asked about are the ones Google's "Product and SKU IDs" page
// documents for the License Manager API. A product the organisation does not
// have answers with an error, which only means "none here": it is skipped.
// The names shown (product, SKU) are the ones Google returns, never ours.

import { norm } from './eligibility';

export const LICENSING_SCOPE = 'https://www.googleapis.com/auth/apps.licensing';
export const DIRECTORY_SCOPE = 'https://www.googleapis.com/auth/admin.directory.user.readonly';
const LICENSING_API = 'https://licensing.googleapis.com/apps/licensing/v1/product';
const DIRECTORY_API = 'https://admin.googleapis.com/admin/directory/v1/users';

/** Products whose licences are read. Ids from Google's License Manager documentation. */
export const GOOGLE_LICENCE_PRODUCTS = [
  { id: '101047', label: 'Gemini' },
  { id: '101068', label: 'Gemini (Business edition)' },
  { id: 'Google-Apps', label: 'Google Workspace' },
  { id: '101038', label: 'AppSheet' },
  { id: '101033', label: 'Google Voice' },
  { id: 'Google-Vault', label: 'Google Vault' },
  { id: '101040', label: 'Chrome Enterprise' },
];

const MAX_PER_PRODUCT = 50_000;

export class GoogleLicenceError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

async function getJson(fetchImpl, url, token) {
  const res = await fetchImpl(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

/** The organisation's Google customer id (C0…), which the licensing API requires. */
export async function fetchCustomerId(token, fetchImpl = fetch) {
  const url = `${DIRECTORY_API}?customer=my_customer&maxResults=1&fields=users(customerId)`;
  const r = await getJson(fetchImpl, url, token);
  if (r.status === 401) throw new GoogleLicenceError('unauthorised', 'The Google sign-in expired or was not granted. Try again and accept both permissions.');
  if (r.status === 403) throw new GoogleLicenceError('not_admin', 'Google refused: the account must be a Google Workspace administrator.');
  if (!r.ok) throw new GoogleLicenceError('directory', r.body?.error?.message || `HTTP ${r.status}`);
  const id = r.body?.users?.[0]?.customerId;
  if (!id) throw new GoogleLicenceError('no_customer', 'Google did not return the organisation id.');
  return id;
}

/**
 * Every licence assignment for the products asked about.
 * Returns { assignments: [{ email, productId, productName, skuId, skuName }], skipped: [productId] }.
 */
export async function fetchLicenceAssignments(token, customerId, products = GOOGLE_LICENCE_PRODUCTS, fetchImpl = fetch) {
  const assignments = []; const skipped = [];
  for (const product of products) {
    let pageToken = ''; let count = 0;
    do {
      const url = new URL(`${LICENSING_API}/${encodeURIComponent(product.id)}/users`);
      url.searchParams.set('customerId', customerId);
      url.searchParams.set('maxResults', '1000');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const r = await getJson(fetchImpl, url.toString(), token);
      if (r.status === 401) throw new GoogleLicenceError('unauthorised', 'The Google sign-in expired or was not granted. Try again and accept both permissions.');
      if (!r.ok) { skipped.push(product.id); break; }   // the organisation does not have this product
      for (const it of r.body?.items || []) {
        if (!it?.userId) continue;
        assignments.push({
          email: String(it.userId).toLowerCase(),
          productId: it.productId || product.id,
          productName: it.productName || product.label,
          skuId: it.skuId || '',
          skuName: it.skuName || it.skuId || product.label,
        });
        count++;
      }
      pageToken = r.body?.nextPageToken || '';
    } while (pageToken && count < MAX_PER_PRODUCT);
  }
  return { assignments, skipped };
}

/** One entry per SKU, most holders first. */
export function groupBySku(assignments) {
  const by = new Map();
  for (const a of assignments || []) {
    const key = `${a.productId}|${a.skuId}`;
    if (!by.has(key)) by.set(key, { productId: a.productId, productName: a.productName, skuId: a.skuId, skuName: a.skuName, emails: new Set() });
    by.get(key).emails.add(a.email);
  }
  return [...by.values()]
    .map((s) => ({ ...s, emails: [...s.emails].sort() }))
    .sort((a, b) => b.emails.length - a.emails.length || a.skuName.localeCompare(b.skuName));
}

/** The Stacklens tool a SKU belongs to: the one linked to it, else one with the same name. */
export function toolForSku(tools, sku) {
  const list = (tools || []).filter((t) => t.status !== 'decommissioned');
  return list.find((t) => t.google_sku?.skuId === sku.skuId && t.google_sku?.productId === sku.productId)
    || list.find((t) => norm(t.name) === norm(sku.skuName))
    || null;
}

const HELD = new Set(['active', 'pending_revocation']);

/**
 * Google's list for one SKU against Stacklens's records for one tool:
 *   toRecord     people Google licenses whom Stacklens does not show with the tool
 *   notInGoogle  active access rows for the tool whose person Google does not license
 *   unknown      licensed addresses nobody in Stacklens has (a person to add, or a shared mailbox)
 */
export function reconcileSku(db, sku, tool) {
  const licensed = new Set(sku.emails.map((e) => norm(e)));
  const people = db?.employees || [];
  const byEmail = new Map(people.filter((e) => e.email).map((e) => [norm(e.email), e]));
  const rows = (db?.access || []).filter((a) => tool && a.tool_id === tool.id && HELD.has(a.status || 'active'));
  const emailOf = (a) => norm(a.employee_email || people.find((e) => e.id === a.employee_id)?.email || '');
  const recorded = new Set(rows.map(emailOf).filter(Boolean));

  const toRecord = []; const unknown = [];
  for (const email of licensed) {
    const emp = byEmail.get(email);
    if (!emp) { unknown.push(email); continue; }
    if (!recorded.has(email)) toRecord.push(emp);
  }
  const notInGoogle = rows.filter((a) => {
    const email = emailOf(a);
    return email && !licensed.has(email);
  });
  return { toRecord, notInGoogle, unknown };
}

/**
 * A token for this one read: the directory (for the organisation id) and the
 * licensing scope. Asked for with the consent screen each time, kept in memory.
 */
export function requestLicensingToken(clientId) {
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: `${DIRECTORY_SCOPE} ${LICENSING_SCOPE}`,
      callback: (resp) => {
        if (resp.error) reject(new GoogleLicenceError('denied', resp.error_description || resp.error));
        else resolve(resp.access_token);
      },
      error_callback: (err) => reject(new GoogleLicenceError('popup', err.type || 'Google sign-in was closed')),
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}
