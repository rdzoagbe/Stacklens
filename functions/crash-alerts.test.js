import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  fingerprint, shouldAlert, recordAlert, COOLDOWN_MS, MAX_PER_HOUR, HOUR_MS,
} from './crash-alerts.js';

// ── An alerting system that cries wolf gets switched off ────────────────────
//
// Browser crashes have been landing in /client_errors for months with nothing
// reading them. The fix is to email the founder — and the entire difficulty is
// volume, because a bad deploy does not produce one crash. It produces one per
// visitor per page.
//
// Four hundred emails about one bug is worse than no alerting at all: the next
// real one arrives in a mailbox that has already been trained to ignore. So
// these tests are mostly about NOT sending.

const now = 1_700_000_000_000;      // a fixed clock; nothing here should need the real one

describe('crashes that are the same bug collapse to one key', () => {
  it('ignores the per-deploy content hash in a bundle name', () => {
    // The reason this matters: every deploy renames main-XXXX.js. Without
    // normalisation the same bug is a brand-new fingerprint after every
    // release, and the cooldown protects nothing.
    const a = fingerprint('TypeError: x is undefined at https://stacklens.fr/assets/main-CGm4mxX7.js:1:2345');
    const b = fingerprint('TypeError: x is undefined at https://stacklens.fr/assets/main-Zq9bbb12.js:9:88');
    expect(a).toBe(b);
  });

  it('ignores ids and line numbers that differ per visitor', () => {
    expect(fingerprint('Failed to load user 88213 at line 42'))
      .toBe(fingerprint('Failed to load user 99871 at line 7'));
  });

  it('ignores a hex blob', () => {
    expect(fingerprint('chunk a3f9c8e21b04 failed'))
      .toBe(fingerprint('chunk ff0021aa9c73 failed'));
  });

  it('still tells genuinely different bugs apart', () => {
    // Over-normalising is the opposite failure: one bug's alert then suppresses
    // every other bug for a day.
    expect(fingerprint('Cannot read properties of undefined'))
      .not.toBe(fingerprint('Network request failed'));
  });

  it('is case- and whitespace-insensitive', () => {
    expect(fingerprint('  Boom   Happened ')).toBe(fingerprint('boom happened'));
  });

  it('is bounded', () => {
    // It becomes a Firestore map key, and the document has a 1MB ceiling.
    expect(fingerprint('x'.repeat(5000)).length).toBeLessThanOrEqual(200);
  });

  it('survives rubbish', () => {
    for (const bad of [null, undefined, '', 0, {}, []]) {
      expect(() => fingerprint(bad)).not.toThrow();
    }
  });
});

describe('the first time a crash appears, somebody is told', () => {
  it('alerts on an empty state', () => {
    const d = shouldAlert({}, 'TypeError: boom', now);
    expect(d.alert).toBe(true);
    expect(d.reason).toBe('new crash');
  });

  it('does not alert on an empty message', () => {
    expect(shouldAlert({}, '', now).alert).toBe(false);
    expect(shouldAlert({}, null, now).alert).toBe(false);
  });

  it('survives a corrupt state document', () => {
    // The state is read from Firestore and could be anything.
    for (const junk of [null, undefined, 'nope', 42, { seen: 'no' }, { sent: 'no' }]) {
      expect(() => shouldAlert(junk, 'boom', now)).not.toThrow();
    }
    expect(shouldAlert({ seen: 'no' }, 'boom', now).alert).toBe(true);
  });
});

describe('the same bug is not reported twice in a day', () => {
  const first = shouldAlert({}, 'TypeError: boom', now);
  const state = recordAlert({}, first.fp, now);

  it('suppresses the next four hundred copies of it', () => {
    // A broken deploy, played out: the same crash from many visitors, seconds
    // apart. One email went out; none of these should.
    for (const offset of [1, 1000, 60_000, 3 * HOUR_MS, COOLDOWN_MS - 1000]) {
      const d = shouldAlert(state, 'TypeError: boom', now + offset);
      expect(d.alert, `offset ${offset}`).toBe(false);
      expect(d.reason).toMatch(/cooldown/);
    }
  });

  it('reports it again once the day has passed', () => {
    // A bug still happening tomorrow is worth one more mention.
    expect(shouldAlert(state, 'TypeError: boom', now + COOLDOWN_MS + 1).alert).toBe(true);
  });

  it('does not suppress a different bug', () => {
    expect(shouldAlert(state, 'Network request failed', now + 1000).alert).toBe(true);
  });
});

describe('a catastrophic release cannot empty the mailbox', () => {
  it('stops at the hourly cap however many distinct bugs appear', () => {
    let state = {};
    const sent = [];
    // Twenty genuinely different crashes in the same minute — a release that
    // broke several pages at once. Each one is a new fingerprint, so the
    // cooldown does not apply and only the cap stands between this and twenty
    // emails.
    for (let i = 0; i < 20; i++) {
      const d = shouldAlert(state, `distinct failure number ${'x'.repeat(i)}`, now + i * 1000);
      if (d.alert) {
        sent.push(d.fp);
        state = recordAlert(state, d.fp, now + i * 1000);
      }
    }
    expect(sent.length).toBe(MAX_PER_HOUR);
  });

  it('says why it stopped', () => {
    let state = {};
    for (let i = 0; i < MAX_PER_HOUR; i++) {
      const d = shouldAlert(state, `bug ${'y'.repeat(i)}`, now + i);
      state = recordAlert(state, d.fp, now + i);
    }
    const blocked = shouldAlert(state, 'yet another bug', now + 100);
    expect(blocked.alert).toBe(false);
    expect(blocked.reason).toMatch(/cap/);
  });

  it('lets alerts through again once the hour rolls off', () => {
    // A cap that never releases is an off switch, not a cap.
    let state = {};
    for (let i = 0; i < MAX_PER_HOUR; i++) {
      const d = shouldAlert(state, `bug ${'z'.repeat(i)}`, now + i);
      state = recordAlert(state, d.fp, now + i);
    }
    expect(shouldAlert(state, 'a new bug', now + HOUR_MS + 1000).alert).toBe(true);
  });
});

describe('the state document does not grow forever', () => {
  it('forgets fingerprints older than the cooldown', () => {
    // One entry per distinct bug, kept for the life of the project, in a
    // document with a 1MB ceiling. Entries past the cooldown cannot change a
    // decision, so keeping them only risks the write failing one day.
    const old = { seen: { 'ancient bug': now - COOLDOWN_MS - 1 }, sent: [] };
    const next = recordAlert(old, 'fresh bug', now);
    expect(Object.keys(next.seen)).toEqual(['fresh bug']);
  });

  it('keeps fingerprints still inside the cooldown', () => {
    const recent = { seen: { 'yesterday evening': now - 1000 }, sent: [] };
    const next = recordAlert(recent, 'fresh bug', now);
    expect(Object.keys(next.seen).sort()).toEqual(['fresh bug', 'yesterday evening']);
  });

  it('forgets send times older than the rolling hour', () => {
    const state = { seen: {}, sent: [now - HOUR_MS - 1, now - 1000] };
    const next = recordAlert(state, 'bug', now);
    expect(next.sent.length).toBe(2);            // the recent one, plus this send
    expect(next.sent.every(ms => now - ms < HOUR_MS)).toBe(true);
  });

  it('reads timestamps stored as ISO strings as well as numbers', () => {
    // Firestore round-trips are not always the type you wrote, and a
    // misparsed timestamp reads as "never alerted" — which quietly turns the
    // cooldown off.
    const iso = { seen: { bug: new Date(now - 1000).toISOString() }, sent: [] };
    expect(shouldAlert(iso, 'bug', now).alert).toBe(false);
  });
});

// ── The endpoint has to actually use it ────────────────────────────────────
//
// The logic above being right is necessary and not sufficient: this repository
// has shipped a correct guard wired up wrongly more than once. Checked against
// the source with comments stripped, because a previous source check in this
// codebase was satisfied by the comment describing the code.
describe('the crash endpoint alerts, and never at the expense of the record', () => {
  const body = (() => {
    const src = readFileSync(resolve(process.cwd(), 'functions/index.js'), 'utf8');
    const start = src.indexOf('exports.clientErrors');
    expect(start, 'clientErrors not found').toBeGreaterThan(-1);
    const end = src.indexOf('\nexports.', start + 10);
    return src.slice(start, end === -1 ? undefined : end)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
  })();

  it('calls the decision rather than mailing on every crash', () => {
    expect(body).toMatch(/shouldAlert\(/);
    expect(body).toMatch(/recordAlert\(/);
  });

  it('decides inside a transaction', () => {
    // A bad deploy delivers these in parallel. Two concurrent crashes reading
    // the same state would both find no record of the fingerprint and both
    // send — so the read and the write have to be one atomic unit.
    const tx = body.indexOf('runTransaction');
    expect(tx, 'the decision must be transactional').toBeGreaterThan(-1);
    expect(body.indexOf('shouldAlert(')).toBeGreaterThan(tx);
  });

  it('has the mail secret bound, or it could never send', () => {
    expect(body).toMatch(/secrets:\s*\[SENDGRID_API_KEY\]/);
  });

  it('cannot let a failed alert lose the crash report', () => {
    // The caller is a browser that has just crashed. The one thing it must get
    // back is a 200 so the crash is recorded — a broken secret, a SendGrid
    // outage or a failed transaction must cost a notification, not the record.
    const write = body.indexOf("collection('client_errors').add");
    const alerting = body.indexOf('runTransaction');
    expect(write, 'the crash must still be recorded').toBeGreaterThan(-1);
    expect(alerting, 'alerting not found').toBeGreaterThan(write);
    const after = body.slice(write, alerting + 4000);
    expect(after, 'the alerting block must be wrapped in its own try/catch')
      .toMatch(/try\s*\{[\s\S]*runTransaction[\s\S]*\}\s*catch/);
  });

  it('logs why it did not alert', () => {
    // "Why did nobody tell me" must be answerable from the logs, or the first
    // instinct will be to assume the whole thing is broken.
    expect(body).toMatch(/suppressed/);
  });
});
