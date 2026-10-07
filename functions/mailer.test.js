import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sendMail, mailConfigured, classifyKey, toBrevoPayload, BREVO_SEND_URL } from './mailer.js';

// ── Nothing reaches the email provider unless a key is configured ──────────
//
// Brevo since 2026-10-07 (SendGrid before: its free allowance ran out). The
// call sites used to contact the provider inline; with no key configured that
// still transmitted a recipient's address before failing. So the decision
// sits in front of the request. These tests CALL the gate rather than reading
// the source, because it is ordinary logic and can be.

const read = (p) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const index = () => read('functions/index.js');

afterEach(() => vi.restoreAllMocks());

describe('the key is classified without being used', () => {
  it('treats nothing as absent, which is the expected state while email is off', () => {
    for (const nothing of ['', '   ', undefined, null]) {
      expect(classifyKey(nothing)).toBe('absent');
    }
  });

  it('treats a non-Brevo value as misconfigured, not as absent', () => {
    // A SendGrid key left in the secret is the likely mistake.
    expect(classifyKey('SG.' + 'x'.repeat(40))).toBe('invalid');
    expect(classifyKey('hunter2')).toBe('invalid');
    expect(classifyKey('a-long-enough-string-but-not-a-key')).toBe('invalid');
    expect(classifyKey('xkeysib-')).toBe('invalid');
  });

  it('accepts something shaped like a real key', () => {
    expect(classifyKey('xkeysib-' + 'x'.repeat(40))).toBe('ok');
    expect(mailConfigured('xkeysib-' + 'x'.repeat(40))).toBe(true);
  });

  it('mailConfigured is false for everything else', () => {
    expect(mailConfigured('')).toBe(false);
    expect(mailConfigured(undefined)).toBe(false);
    expect(mailConfigured('not-a-key-but-long-enough')).toBe(false);
  });
});

describe('sendMail refuses before contacting anyone', () => {
  it('reports email-not-configured when no key is set, and makes no request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const r = await sendMail('', { to: 'a@b.co' });
    expect(r.sent).toBe(false);
    expect(r.skipped).toBe('email-not-configured');
    expect(r.error).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports email-misconfigured, loudly, for a key that is not one', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const r = await sendMail('SG.' + 'x'.repeat(40), { to: 'a@b.co' });
    expect(r.skipped).toBe('email-misconfigured');
    expect(err, 'a malformed key must not look like "email is off"').toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('never throws, because every caller has to carry on', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(sendMail(undefined, { to: 'a@b.co' })).resolves.toBeTruthy();
    await expect(sendMail('nope', { to: 'a@b.co' })).resolves.toBeTruthy();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    const r = await sendMail('xkeysib-' + 'x'.repeat(40), { to: 'a@b.co', subject: 's', html: '<p>h</p>' });
    expect(r).toEqual({ sent: false, skipped: null, status: null, error: 'network down' });
  });
});

describe('a configured send', () => {
  const key = 'xkeysib-' + 'x'.repeat(40);
  const message = { to: 'daf@acme.fr', from: { email: 'hello@stacklens.fr', name: 'Stacklens' }, subject: 'Hi', html: '<p>hi</p>', text: 'hi' };

  it('is one request to Brevo, with the key in the header and the message in its shape', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 201, json: async () => ({ messageId: 'm' }) });
    const r = await sendMail(key, message);
    expect(r).toEqual({ sent: true, skipped: null, status: 201, error: null });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(BREVO_SEND_URL);
    expect(init.headers['api-key']).toBe(key);
    expect(JSON.parse(init.body)).toEqual({
      sender: { email: 'hello@stacklens.fr', name: 'Stacklens' }, to: [{ email: 'daf@acme.fr' }],
      subject: 'Hi', htmlContent: '<p>hi</p>', textContent: 'hi',
    });
  });

  it('several recipients, as the monthly report sends them', () => {
    expect(toBrevoPayload({ to: ['a@x.fr', 'b@x.fr'], subject: 's' }).to).toEqual([{ email: 'a@x.fr' }, { email: 'b@x.fr' }]);
  });

  it("reports Brevo's refusal as an error, not as a send", async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 401, json: async () => ({ code: 'unauthorized', message: 'Key not found' }) });
    const r = await sendMail(key, message);
    expect(r).toEqual({ sent: false, skipped: null, status: 401, error: 'Key not found' });
  });

  it('the gate returns before any request in the source too', () => {
    const src = readFileSync(resolve(__dirname, 'mailer.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const fetchAt = src.indexOf('await fetch(');
    const absentAt = src.indexOf("'email-not-configured'");
    expect(fetchAt).toBeGreaterThan(-1);
    expect(absentAt).toBeGreaterThan(-1);
    expect(absentAt, 'the absent branch must return before the request').toBeLessThan(fetchAt);
    expect(src).not.toMatch(/sendgrid|@sendgrid\/mail/i);
  });
});

// ── Every call site goes through the gate ─────────────────────────────────
//
// A gate one function bypasses is not a gate. Source checks, because these
// live inside deployed handlers with no harness.
describe('no function talks to the email provider directly', () => {
  const src = () => index()
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('nothing requires a mail library or calls Brevo outside the gate', () => {
    expect(src()).not.toMatch(/require\('@sendgrid\/mail'\)|api\.brevo\.com|sgMail/);
  });

  it('the gate is imported where the secret is defined', () => {
    expect(src()).toMatch(/const BREVO_API_KEY = defineSecret\('BREVO_API_KEY'\)/);
    expect(src()).toMatch(/require\('\.\/mailer'\)/);
  });

  it('every send passes the secret to the gate', () => {
    const calls = src().match(/sendMail\(/g) || [];
    const guarded = src().match(/sendMail\(BREVO_API_KEY\.value\(\)/g) || [];
    expect(calls.length).toBeGreaterThan(3);
    expect(guarded.length).toBe(calls.length);
  });
});
