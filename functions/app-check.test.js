import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── App Check on the HTTP functions ────────────────────────────────────────
//
// Console enforcement reaches Firestore and Authentication only. An onRequest
// function verifies the X-Firebase-AppCheck header itself (verifyAppCheck),
// monitoring until APP_CHECK_ENFORCE is flipped. The danger is a browser-
// called endpoint left out: once the flag is true it would keep letting
// tokenless calls through, silently. So every endpoint that authenticates a
// browser must call the check, and the four that no browser calls must not.

const src = readFileSync(resolve(__dirname, 'index.js'), 'utf8');

/** Each `exports.name = onRequest(` block, up to the next export. */
function endpoints() {
  const out = {};
  const re = /^exports\.([A-Za-z][A-Za-z0-9]*)\s*=\s*onRequest\(/gm;
  const starts = [...src.matchAll(re)];
  starts.forEach((m, i) => {
    const end = src.indexOf('\nexports.', m.index + 1);
    out[m[1]] = src.slice(m.index, end === -1 ? src.length : end);
  });
  return out;
}

// No browser calls these: a customer's own server (api), Stripe, SendGrid's
// inbound door, and a crash report that may fire before App Check initialises.
const EXEMPT = ['api', 'stripeWebhook', 'invoiceInbound', 'clientErrors'];

describe('verifyAppCheck', () => {
  const fn = src.slice(src.indexOf('async function verifyAppCheck'), src.indexOf('async function checkRateLimit'));

  it('is a flag away from rejecting, and says so while it only monitors', () => {
    expect(src).toMatch(/^const APP_CHECK_ENFORCE = (true|false);$/m);
    expect(fn).toMatch(/if \(APP_CHECK_ENFORCE\) \{\s*res\.status\(401\)/);
    expect(fn).toMatch(/allowing \(monitoring mode\)/);
    // A token that fails verification is never treated as present-and-fine.
    expect(fn).toMatch(/catch \{ reason = 'invalid'; \}/);
  });

  it('is allowed through the CORS preflight', () => {
    expect(src).toMatch(/allowedHeaders: \['Content-Type', 'Authorization', 'X-Firebase-AppCheck'\]/);
  });
});

describe('which endpoints check it', () => {
  const eps = endpoints();

  it('every endpoint that authenticates a browser calls it before verifyAuth', () => {
    for (const [name, body] of Object.entries(eps)) {
      if (!/await verifyAuth\(req, res/.test(body)) continue;
      expect(body, `${name} authenticates a browser but never calls verifyAppCheck`).toMatch(/verifyAppCheck\(req, res\)/);
      expect(body.indexOf('verifyAppCheck(req, res)'), `${name}: App Check must run before the auth lookup`)
        .toBeLessThan(body.indexOf('await verifyAuth(req, res'));
    }
  });

  it('the four endpoints no browser calls are left alone', () => {
    for (const name of EXEMPT) {
      expect(eps[name], `${name} is no longer exported`).toBeTruthy();
      expect(eps[name], `${name} must not require App Check`).not.toMatch(/verifyAppCheck/);
    }
  });
});
