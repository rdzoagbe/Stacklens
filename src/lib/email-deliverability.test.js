import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── The mail goes to Junk, so the app has to say so ───────────────────────
//
// Measured over two days, not assumed:
//
//   SendGrid, from noreply@stacklens.fr, DMARC passing  -> Junk, SCL 5
//   Firebase's own sender, Google infrastructure         -> Junk
//
// Two senders at opposite ends of the reputation scale, same folder. So the
// sender was never the variable, and there is nothing left to buy: the paid
// option was measured against the free one and did no better.
//
// What the app was doing meanwhile: "We sent a verification link to <you>.
// Click the link to activate your account." A description of a happy path that
// demonstrably was not happening. Somebody signs up, looks in their inbox,
// finds nothing, and leaves — no error, nothing broken, no way to know where
// to look. The same family as everything else fixed this week, except here the
// thing that appears to work is a sentence.
//
// Three screens tell somebody an email is coming. All three now name the
// folder it actually lands in.

const strip = (raw) => raw
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

const app = () => strip(readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8'));
const page = () => strip(readFileSync(resolve(process.cwd(), 'src/pages/TrialPage.jsx'), 'utf8'));
const tr = () => readFileSync(resolve(process.cwd(), 'src/translations.js'), 'utf8');

describe('every screen that promises an email mentions the spam folder', () => {
  it('the email verification wall does', () => {
    const src = app();
    const at = src.indexOf('function EmailVerificationWall');
    expect(at, 'the wall was not found').toBeGreaterThan(-1);
    const wall = src.slice(at, src.indexOf('function RequireAuth'));
    expect(wall, 'this is the screen a new signup is trapped on when the ' +
      'verification mail is in Junk').toMatch(/verify_check_spam_title/);
    expect(wall).toMatch(/verify_check_spam_body/);
  });

  it('the magic-link confirmation does', () => {
    // Load-bearing for the fix shipped in #274: the popup-blocked message
    // tells anyone in an iOS in-app browser to use the magic link, so this is
    // where that person lands. Sending them here without the warning puts a
    // hole straight through that fix.
    const src = page();
    const at = src.indexOf('lp_magic_link_note');
    expect(at, 'the magic-link sent panel was not found').toBeGreaterThan(-1);
    expect(src.slice(at, at + 900)).toMatch(/verify_check_spam_title/);
  });

  it('the password-reset confirmation does', () => {
    // A toast, so it disappears — the hint has to be inside the sentence
    // rather than beside it.
    const en = /password_reset_sent: "([^"]+)"/.exec(tr());
    expect(en, 'password_reset_sent not found').toBeTruthy();
    expect(en[1].toLowerCase(), 'a toast that vanishes must carry the hint itself')
      .toMatch(/spam/);
  });

  it('all three share one piece of copy, not three', () => {
    // The wall and the magic-link panel use the same two keys on purpose. Two
    // copies of this warning drift, and then one of them is wrong.
    const both = app() + page();
    expect((both.match(/verify_check_spam_title/g) || []).length)
      .toBeGreaterThanOrEqual(2);
  });

  it('the copy exists in English, French and Spanish', () => {
    for (const key of ['verify_check_spam_title', 'verify_check_spam_body', 'resend_in']) {
      expect(tr().split(key + ':').length - 1,
        `${key} is rendered by the wall; a missing string shows the raw key`)
        .toBeGreaterThanOrEqual(3);
    }
  });

  it('and the reset hint is translated everywhere that string exists', () => {
    // It is a user-facing sentence in five languages. An English clause bolted
    // onto a French toast is worse than no clause.
    const all = [...tr().matchAll(/password_reset_sent: "([^"]+)"/g)].map(m => m[1]);
    expect(all.length, 'expected the reset toast in several languages')
      .toBeGreaterThanOrEqual(5);
    const hints = { en: 'spam', fr: 'spams', de: 'Spam-Ordner', es: 'spam', pt: 'spam' };
    for (const value of all) {
      const mentions = Object.values(hints).some(w => value.toLowerCase().includes(w.toLowerCase()));
      expect(mentions, `"${value}" does not mention the spam folder`).toBe(true);
    }
  });

  it('does not hardcode the sender address anywhere in the copy', () => {
    // noreply@accessguard-v2.firebaseapp.com is today's sender and changes the
    // moment custom SMTP goes back on in the console. A hardcoded address is a
    // line of copy that silently becomes a lie — which is the exact failure
    // this screen exists to prevent. "Search for Stacklens" holds regardless,
    // because the subject line always carries the name.
    expect(app() + page() + tr(), 'the sender address must not be baked into copy')
      .not.toMatch(/firebaseapp\.com/);
  });
});

// ── Resend has to work more than once ─────────────────────────────────────
//
// It was `disabled={resending || sent}` and `sent` was never reset, so the
// button worked exactly once and was then dead for the life of the screen —
// dead at 50% opacity, with no explanation, on the very screen where the mail
// lands in Junk and a second copy is the obvious next thing to want. A page
// reload was the only way back.
//
// Same family as the Continue button in #270: an affordance that looks
// pressable, is not, and says nothing about why.
describe('the resend button recovers', () => {
  const wall = () => {
    const src = app();
    return src.slice(src.indexOf('function EmailVerificationWall'), src.indexOf('function RequireAuth'));
  };

  it('is not permanently disabled by having been used', () => {
    expect(wall(), 'a resend gated on `sent` can only ever fire once')
      .not.toMatch(/disabled=\{resending \|\| sent\}/);
  });

  it('uses a cooldown that counts down instead', () => {
    expect(wall()).toMatch(/disabled=\{resending \|\| cooldown > 0\}/);
    expect(wall(), 'the cooldown must actually decrease, or it never re-enables')
      .toMatch(/setCooldown\(c => c - 1\)/);
  });

  it('says how long is left rather than just looking dead', () => {
    expect(wall(), 'a disabled button with no label is what made the last one ' +
      'read as broken').toMatch(/resend_in/);
    expect(wall()).toMatch(/\$\{cooldown\}s/);
  });

  it('the cooldown is long enough to matter and short enough to be usable', () => {
    const m = /RESEND_COOLDOWN_SECONDS = (\d+)/.exec(app());
    expect(m, 'the cooldown constant was not found').toBeTruthy();
    const seconds = Number(m[1]);
    expect(seconds, 'below ~30s this is not rate limiting').toBeGreaterThanOrEqual(30);
    expect(seconds, 'above a couple of minutes people reload the page instead')
      .toBeLessThanOrEqual(180);
  });

  it('both buttons on the screen look disabled when they are', () => {
    // These are raw <button>s, not the shared Button primitive, so they missed
    // the disabled styling fixed in #270: 50% opacity on this dark theme still
    // reads as pressable, and hover still lit up.
    expect(wall()).not.toMatch(/disabled:opacity-50/);
    expect((wall().match(/disabled:opacity-40/g) || []).length,
      'both the check and the resend button need it').toBeGreaterThanOrEqual(2);
    expect((wall().match(/disabled:cursor-not-allowed/g) || []).length)
      .toBeGreaterThanOrEqual(2);
    expect((wall().match(/disabled:hover:bg-/g) || []).length,
      'hover must not light up a button that cannot be pressed')
      .toBeGreaterThanOrEqual(2);
  });

  it('guards the handler as well as the button', () => {
    // Disabling the element is not enough on its own: a stray call, an Enter
    // key on a focused button, or a future caller would still fire the send.
    expect(wall()).toMatch(/if \(resending \|\| cooldown > 0\) return/);
  });
});
