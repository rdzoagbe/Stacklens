import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── The server does not hand its own detail to the caller ──────────────────
//
// Two habits a reviewer flagged: a vendor paginator followed off its own host
// (which would carry the credential with it), and raw internal/vendor error
// messages returned to the client (one even named the Stripe account id). Both
// are source-level habits, so they are pinned at the source.

const src = readFileSync(resolve(__dirname, 'index.js'), 'utf8');

describe('the bank-feed paginator stays on Bridge', () => {
  it('passes an absolute next_uri through sameOrigin before following it', () => {
    expect(src).toMatch(/const \{ VENDORS, IntegrationError, sameOrigin \} = require\('\.\/integrations'\)/);
    expect(src).toMatch(/next\.startsWith\('http'\) \? sameOrigin\(next, 'https:\/\/api\.bridgeapi\.io'\)/);
    // The old unguarded form must not come back.
    expect(src).not.toMatch(/next\.startsWith\('http'\) \? next :/);
  });
});

describe('internal detail stays in the log, not the response', () => {
  it('billing, bank sync and integration failures answer with a generic sentence', () => {
    // The Stripe account id is logged for the operator, never returned.
    expect(src).toMatch(/console\.error\('Checkout error:', detail\)/);
    expect(src).not.toMatch(/res\.status\(500\)\.json\(\{ error: detail \}\)/);
    // No 500 handler echoes err.message to the caller any more.
    expect(src).not.toMatch(/res\.status\(500\)\.json\(\{ error: err\.message/);
  });
});
