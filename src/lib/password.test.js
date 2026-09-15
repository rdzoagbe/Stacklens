import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MIN_PASSWORD_LENGTH, SUGGESTED_LENGTH,
  passwordProblem, isAcceptablePassword, suggestPassword,
} from './password';

// ── A length rule on its own is a loophole ─────────────────────────────────
//
// The form accepted 8 characters. Raising that to 12 is the easy half; the
// half worth testing is that 12 characters actually has to mean something.
// `password1234` is twelve characters. So is `aaaaaaaaaaaa`. A rule that
// accepts those has not raised the floor, it has moved where people trip.
//
// No composition rules here, deliberately — no "must contain a digit". Those
// produce Password1! and shrink the search space; NIST 800-63B advises against
// them. So these tests assert that a long passphrase of plain lowercase words
// IS accepted, which is the behaviour a composition rule would break.

describe('the floor is 12 characters', () => {
  it('rejects anything shorter, including the old 8-character minimum', () => {
    for (const pw of ['', 'a', 'shortpw', 'eightch8', 'elevenchar!']) {
      expect(passwordProblem(pw), pw).toBe('lp_password_min');
    }
  });

  it('accepts exactly 12', () => {
    expect(passwordProblem('gravelBadger')).toBe(null);
  });

  it('is the number the rest of the app should read', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12);
  });

  it('survives rubbish instead of throwing', () => {
    // It runs on every keystroke in a form; a crash here blocks signup.
    for (const bad of [null, undefined, 0, {}, [], NaN]) {
      expect(() => passwordProblem(bad)).not.toThrow();
    }
  });
});

describe('a long passphrase is a good password', () => {
  it('accepts plain lowercase words with no digits or symbols', () => {
    // The case a composition rule would reject and an attacker would struggle
    // with. If this ever starts failing, someone has added "must contain a
    // number" and made the product worse while appearing to harden it.
    expect(passwordProblem('correct horse battery staple')).toBe(null);
    expect(passwordProblem('gravel badger kettle')).toBe(null);
  });

  it('accepts non-ASCII, since length is what is being measured', () => {
    expect(passwordProblem('château fenêtre café')).toBe(null);
  });
});

describe('twelve characters of nothing is still nothing', () => {
  it('rejects the top-of-every-breach-corpus words, padded or not', () => {
    for (const pw of ['password1234', 'mypassword123', 'Password2026', 'motdepasse01',
      'qwertyqwerty', 'azerty123456', 'letmein12345', 'changeme1234',
      'stacklens123', 'iloveyou1234']) {
      expect(passwordProblem(pw), pw).toBe('lp_password_common');
    }
  });

  it('rejects one character repeated to reach the length', () => {
    expect(passwordProblem('aaaaaaaaaaaa')).toBe('lp_password_repetitive');
    expect(passwordProblem('............')).toBe('lp_password_repetitive');
  });

  it('rejects a short sequence repeated to reach the length', () => {
    // Twelve characters with four characters of entropy.
    expect(passwordProblem('abcabcabcabc')).toBe('lp_password_repetitive');
    expect(passwordProblem('xyzwxyzwxyzw')).toBe('lp_password_repetitive');
  });

  it('rejects a long run padded with something else', () => {
    expect(passwordProblem('aaaaaaaaaaaab')).toBe('lp_password_repetitive');
  });

  it('does not mistake an ordinary password for a repetition', () => {
    // Over-rejecting is the other failure: a rule that refuses good passwords
    // teaches people to fight the form.
    expect(passwordProblem('gravel badger kettle')).toBe(null);
    expect(passwordProblem('aardvark tunnels')).toBe(null);   // doubled letters, not a repeat
  });
});

describe('a password must not be the person guessing it', () => {
  const me = { email: 'amina.dupont@acme.com', name: 'Amina Dupont' };

  it('rejects the email name and the display name', () => {
    // The first two things anybody trying would type.
    expect(passwordProblem('amina.dupont2026', me)).toBe('lp_password_personal');
    expect(passwordProblem('DupontDupont42', me)).toBe('lp_password_personal');
  });

  it('does not reject a password for containing the company domain', () => {
    // Everyone at the company shares it, so it identifies nobody — and
    // rejecting it would refuse good passwords for an accident of spelling.
    expect(passwordProblem('acme gravel badger', me)).toBe(null);
  });

  it('ignores identity fragments too short to mean anything', () => {
    // A three-letter name would otherwise reject most passwords containing it.
    const shortName = { email: 'al@acme.com', name: 'Al B' };
    expect(passwordProblem('alphabet gravel kettle', shortName)).toBe(null);
  });

  it('works with no identity supplied at all', () => {
    // Called from places that do not know who is typing.
    expect(passwordProblem('gravel badger kettle')).toBe(null);
    expect(passwordProblem('gravel badger kettle', {})).toBe(null);
    expect(passwordProblem('gravel badger kettle', { email: null, name: undefined })).toBe(null);
  });
});

describe('isAcceptablePassword is the same rule', () => {
  it('agrees with passwordProblem on every case', () => {
    // Two entry points, one rule — a button enabled by a laxer check than the
    // submit handler uses is how a form starts lying to people.
    for (const pw of ['', 'short', 'password1234', 'aaaaaaaaaaaa', 'gravel badger kettle']) {
      expect(isAcceptablePassword(pw), pw).toBe(passwordProblem(pw) === null);
    }
  });
});

// ── The suggestion has to be worth taking ──────────────────────────────────
//
// A "suggest a strong password" button that produces something weak is worse
// than no button, because the label is a promise. Two properties carry that:
// it comes from a CSPRNG, and it satisfies the policy it is offered under.

describe('the suggested password', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('is long enough, and longer than the floor', () => {
    const pw = suggestPassword();
    expect(pw.length).toBe(SUGGESTED_LENGTH);
    expect(SUGGESTED_LENGTH).toBeGreaterThan(MIN_PASSWORD_LENGTH);
  });

  it('always passes the policy it is offered under', () => {
    // Including the rejections: a suggestion the form then refuses would be
    // absurd, and a random draw can land on a run of one character.
    for (let i = 0; i < 200; i++) {
      expect(passwordProblem(suggestPassword())).toBe(null);
    }
  });

  it('is different every time', () => {
    const seen = new Set();
    for (let i = 0; i < 100; i++) seen.add(suggestPassword());
    expect(seen.size).toBe(100);
  });

  it('avoids the characters people misread', () => {
    // These get copied by hand and dictated over the phone. A password nobody
    // can transcribe gets replaced with Summer2026! — so an unambiguous
    // alphabet is a security property, not a nicety.
    const all = Array.from({ length: 300 }, () => suggestPassword()).join('');
    for (const ch of ['O', 'o', '0', 'l', 'I', '1']) {
      expect(all, `ambiguous character ${ch} appeared`).not.toContain(ch);
    }
  });

  it('never falls back to Math.random when crypto is unavailable', () => {
    // The whole point. A weak password behind a "strong" label is worse than
    // no button — so the caller gets null and hides it.
    vi.stubGlobal('crypto', undefined);
    expect(suggestPassword()).toBe(null);
    vi.stubGlobal('crypto', {});
    expect(suggestPassword()).toBe(null);
  });

  it('discards the biased tail instead of folding it', () => {
    // Modulo bias is the quiet kind of weakness: `byte % 60` maps bytes 240-255
    // back onto the first 16 characters, so those become 25% likelier and the
    // password loses entropy without looking any different.
    //
    // Testing it needs care. My first attempt fed ONLY high bytes and asserted
    // null — which passed whether or not they were discarded, because a folded
    // draw produces one repeated character, the policy rejects that, and the
    // bounded retry returns null anyway. It agreed with the bug.
    //
    // So: one usable byte per draw, the rest in the biased tail. Discarding
    // them yields one distinct character per pass and a 16-character password.
    // Folding them yields fifteen copies of a single character, which the
    // repetition rule rejects — so a folding implementation returns null here.
    let next = 0;
    vi.stubGlobal('crypto', {
      getRandomValues: (arr) => {
        arr.fill(255);              // the biased tail
        arr[0] = next++ % 60;       // one byte that must be used
        return arr;
      },
    });

    const pw = suggestPassword();
    expect(pw, 'a folding implementation cannot build this password').not.toBe(null);
    expect(pw.length).toBe(SUGGESTED_LENGTH);
    expect(new Set(pw).size, 'every character came from a distinct usable byte')
      .toBe(SUGGESTED_LENGTH);
  });

  it('respects a longer requested length but never goes below the floor', () => {
    expect(suggestPassword(24).length).toBe(24);
    expect(suggestPassword(4).length).toBe(MIN_PASSWORD_LENGTH);
    expect(suggestPassword(0).length).toBe(SUGGESTED_LENGTH);
  });
});

describe('a broken random source hides the button rather than crashing', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('gives up instead of recursing for ever', () => {
    // Found by writing the bias test above, not by design: a byte source that
    // always maps to the same character yields a repetitive password, which
    // the policy rejects, which retried — for ever. An unbounded retry in a
    // signup form is a blank page, so the retry is capped and the caller gets
    // null like every other "cannot do this safely" path.
    vi.stubGlobal('crypto', {
      // Passes the bias filter (below 240) but always the same character.
      getRandomValues: (arr) => { arr.fill(7); return arr; },
    });
    expect(() => suggestPassword()).not.toThrow();
    expect(suggestPassword()).toBe(null);
  });
});

// ── The form has to actually use the rule ──────────────────────────────────
//
// The logic above being right is necessary and not sufficient. This repository
// has shipped a correct guard wired up wrongly more than once, so the signup
// form is checked against its source, with comments stripped — a source check
// here was once satisfied by the comment describing the code.
describe('the signup form uses this rule and reveals what is typed', () => {
  const src = (() => {
    const raw = readFileSync(resolve(process.cwd(), 'src/pages/TrialPage.jsx'), 'utf8');
    return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  })();

  it('validates with passwordProblem rather than its own length check', () => {
    expect(src).toMatch(/passwordProblem\(/);
    expect(src, 'a hand-rolled length check is how the form and the rule drift apart')
      .not.toMatch(/authPassword\.length\s*<\s*\d+/);
  });

  it('blocks submission on the problem the rule reports', () => {
    // Not just displaying a hint: the submit handler has to refuse.
    expect(src).toMatch(/if\s*\(pwProblem\)\s*\{\s*setAuthError/);
  });

  it('offers a generated password', () => {
    expect(src).toMatch(/suggestPassword\(/);
    expect(src).toMatch(/lp_suggest_password/);
  });

  it('can reveal the password on BOTH signup fields', () => {
    // The gap that was reported: sign-IN had a reveal toggle, sign-UP did not
    // — and sign-up is where a password is invented, typed blind, and typed
    // blind again into a confirm box whose only feedback was "they differ".
    const reveals = src.match(/setShowNewPassword\(v => !v\)/g) || [];
    expect(reveals.length, 'password and confirm each need their own toggle')
      .toBeGreaterThanOrEqual(2);
    expect(src).toMatch(/type=\{showNewPassword \? 'text' : 'password'\}/);
  });

  it('does not reveal the sign-in password when revealing the new one', () => {
    // Two separate fields on two separate tabs; one shared flag would expose
    // the wrong secret.
    expect(src).toMatch(/const \[showPassword, setShowPassword\]/);
    expect(src).toMatch(/const \[showNewPassword, setShowNewPassword\]/);
  });
});
