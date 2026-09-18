import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sendMail, mailConfigured, classifyKey } from './mailer.js';

// ── Nothing reaches SendGrid unless a key is configured ───────────────────
//
// The five call sites used to do this inline:
//
//   const sgMail = require('@sendgrid/mail');
//   sgMail.setApiKey(SENDGRID_API_KEY.value());
//   await sgMail.send({ to: someonesEmailAddress, ... });
//
// With no key configured that still POSTs to sendgrid.net with a recipient's
// address in the body. The request fails and the address has already been
// transmitted — which is why external-services.test.js would not let SendGrid
// come off the published sub-processor list while those call sites existed.
// A dead billing account does not undo a live code path.
//
// So the decision moved in front of the request. These tests CALL the gate
// rather than reading the source, because it is ordinary logic and can be.

const read = (p) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const index = () => read('functions/index.js');

afterEach(() => vi.restoreAllMocks());

describe('the key is classified without being used', () => {
  it('treats nothing as absent, which is the expected state right now', () => {
    for (const nothing of [undefined, null, '', '   ', '\n']) {
      expect(classifyKey(nothing)).toBe('absent');
    }
  });

  it('treats a non-SendGrid value as misconfigured, not as absent', () => {
    // The distinction is the point: "off" is deliberate, "wrong" is an
    // outage, and collapsing them is how a broken key reads as a setting.
    expect(classifyKey('hunter2')).toBe('invalid');
    expect(classifyKey('a-long-enough-string-but-not-a-key')).toBe('invalid');
    expect(classifyKey('SG')).toBe('invalid');
  });

  it('accepts something shaped like a real key', () => {
    expect(classifyKey('SG.' + 'x'.repeat(40))).toBe('ok');
    expect(mailConfigured('SG.' + 'x'.repeat(40))).toBe(true);
  });

  it('mailConfigured is false for everything else', () => {
    expect(mailConfigured('')).toBe(false);
    expect(mailConfigured(undefined)).toBe(false);
    expect(mailConfigured('not-a-key-but-long-enough')).toBe(false);
  });
});

describe('sendMail refuses without contacting SendGrid', () => {
  it('reports email-not-configured when no key is set', async () => {
    const r = await sendMail('', { to: 'someone@example.com', subject: 'x' });
    expect(r.sent).toBe(false);
    expect(r.skipped).toBe('email-not-configured');
    expect(r.error).toBeNull();
  });

  it('reports email-misconfigured, loudly, for a key that is not one', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await sendMail('definitely-not-a-sendgrid-key', { to: 'a@b.co' });
    expect(r.skipped).toBe('email-misconfigured');
    expect(err, 'a malformed key must not look like "email is off"')
      .toHaveBeenCalled();
  });

  it('never throws, because every caller has to carry on', async () => {
    // Two HTTP handlers that must answer and three scheduled jobs that must
    // finish their loop. A throwing mailer breaks all five differently.
    await expect(sendMail(undefined, { to: 'a@b.co' })).resolves.toBeTruthy();
    await expect(sendMail('nope', { to: 'a@b.co' })).resolves.toBeTruthy();
  });

  it('does not even load @sendgrid/mail when unconfigured', () => {
    // The strongest form of the gate, and the reason the require sits inside
    // the configured branch: with no key there is no code path to the network
    // at all, not merely a request that fails.
    //
    // Comments stripped first. A previous version of this compared raw
    // positions and failed, because the header comment QUOTES the old inline
    // require — so indexOf found the comment, not the code. Third time that
    // exact mistake has been made in this repo's guards.
    const src = readFileSync(resolve(__dirname, 'mailer.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const requireAt = src.indexOf("require('@sendgrid/mail')");
    const absentAt = src.indexOf("'email-not-configured'");
    expect(requireAt, 'the require was not found in code').toBeGreaterThan(-1);
    expect(absentAt, 'the absent branch was not found').toBeGreaterThan(-1);
    expect(absentAt, 'the absent branch must return before the require')
      .toBeLessThan(requireAt);
    expect(src, 'no module-scope require of the mail library')
      .not.toMatch(/^const .*require\('@sendgrid\/mail'\)/m);
  });
});

// ── Every call site goes through the gate ─────────────────────────────────
//
// A gate one function bypasses is not a gate. Source checks, because these
// live inside deployed handlers with no harness.
describe('no function talks to SendGrid directly', () => {
  const src = () => index()
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('nothing requires @sendgrid/mail outside the gate', () => {
    expect(src(), 'index.js must go through mailer.js, which decides first')
      .not.toMatch(/require\('@sendgrid\/mail'\)/);
  });

  it('and nothing calls sgMail at all', () => {
    expect(src()).not.toMatch(/sgMail/);
  });

  it('the gate is imported where the secret is defined', () => {
    expect(src()).toMatch(/require\('\.\/mailer'\)/);
  });

  it('every function that holds the secret uses the gate', () => {
    // If a function declares secrets: [SENDGRID_API_KEY] it intends to send,
    // so it must reach sendMail or mailConfigured. A holder that does neither
    // either leaked past the gate or should not hold the secret.
    const raw = index();
    const holders = [...raw.matchAll(/^exports\.([A-Za-z][A-Za-z0-9]*)\s*=/gm)]
      .map(m => ({ name: m[1], at: m.index }));
    expect(holders.length, 'no exports found').toBeGreaterThan(10);

    const bodies = holders.map((h, i) => ({
      name: h.name,
      body: raw.slice(h.at, holders[i + 1]?.at ?? raw.length),
    }));
    // Matched on the secrets: [...] DECLARATION, not on any mention of the
    // name. A first version used includes('SENDGRID_API_KEY') and reported
    // refreshClaims as a holder, because the slice between it and the next
    // export swallows the module-level `const SENDGRID_API_KEY = defineSecret`
    // line that sits between them. It was accusing innocent code.
    const usesSecret = bodies.filter(b =>
      /secrets:\s*\[[^\]]*SENDGRID_API_KEY/.test(b.body));
    expect(usesSecret.length, 'expected several functions to send mail')
      .toBeGreaterThanOrEqual(5);

    for (const b of usesSecret) {
      expect(/sendMail\(|mailConfigured\(/.test(b.body),
        `${b.name} holds SENDGRID_API_KEY but never goes through the gate`)
        .toBe(true);
    }
  });

  it('the scheduled jobs decide before scanning the collection', () => {
    // Otherwise the job reads every userdata document, assembles each one, and
    // fails per user on a send that was never going to happen — a daily bill
    // and a daily pile of errors for nothing.
    const raw = index();
    for (const job of ['dailyAlerts', 'weeklySummary']) {
      const at = raw.indexOf(`exports.${job} =`);
      expect(at, `${job} not found`).toBeGreaterThan(-1);
      const head = raw.slice(at, raw.indexOf("collection('userdata')", at));
      expect(head, `${job} must check mailConfigured before the scan`)
        .toMatch(/mailConfigured\(/);
    }
  });

  it('a failed alert is not recorded as delivered', () => {
    // dailyAlerts remembers which alerts it has sent so it does not repeat
    // them. Recording an undelivered one suppresses it for ever, on a day
    // nobody was told anything.
    const raw = index();
    const at = raw.indexOf('exports.dailyAlerts =');
    const body = raw.slice(at, raw.indexOf('exports.', at + 10));
    expect(body).toMatch(/if \(!mail\.sent\)[\s\S]{0,300}?continue;/);
  });
});

// ── weeklySummary had never sent anything ────────────────────────────────
//
// Found while checking that the gate had not left an undefined sgMail behind:
// forcing `eslint --no-ignore` over functions/ reported
//
//   2261:45  error  'uid' is not defined  no-undef
//
// verifiedEmailForUid(uid) inside the weeklySummary loop, with uid never
// declared. Reading an undeclared variable throws a ReferenceError even in
// sloppy mode, so the loop died on its first document — every Monday, in
// silence. dailyAlerts has the identical line and does declare it.
//
// Nothing caught it because functions/ is excluded from ESLint, so no-undef
// has never run over the file that contains all twenty Cloud Functions.
describe('the scheduled jobs declare what they read', () => {
  it('weeklySummary declares uid before using it', () => {
    const raw = index();
    const at = raw.indexOf('exports.weeklySummary =');
    const body = raw.slice(at);
    const loopAt = body.indexOf('for (const docSnap of snapshot.docs)');
    const useAt = body.indexOf('verifiedEmailForUid(uid)');
    const declAt = body.indexOf('const uid', loopAt);
    expect(loopAt, 'the loop was not found').toBeGreaterThan(-1);
    expect(useAt, 'verifiedEmailForUid(uid) was not found').toBeGreaterThan(-1);
    expect(declAt, 'uid is never declared in the loop — ReferenceError on the ' +
      'first document, which is what made this job a no-op').toBeGreaterThan(loopAt);
    expect(declAt, 'uid must be declared before it is read').toBeLessThan(useAt);
  });

  it('dailyAlerts still does too', () => {
    const raw = index();
    const at = raw.indexOf('exports.dailyAlerts =');
    const body = raw.slice(at, raw.indexOf('exports.', at + 10));
    expect(body).toMatch(/const uid = docSnap\.id;/);
  });
});
