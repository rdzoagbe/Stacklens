// ── What counts as an acceptable password, and one worth suggesting ────────
//
// The signup form accepted 8 characters and offered no help choosing one. Two
// separate problems: the floor was too low, and a person inventing a password
// under a form's impatience picks a bad one.
//
// LENGTH ONLY, deliberately. No "must contain an uppercase, a digit and a
// symbol". Composition rules push people towards Password1! — they satisfy a
// checker while shrinking the space an attacker has to search, and NIST
// 800-63B has recommended against them for years. Length is what actually
// costs an attacker, so the floor is 12 and nothing is demanded about shape.
//
// But length alone is not a rule, it is a loophole: `password12345` is
// thirteen characters and worthless, and so is `aaaaaaaaaaaa`. So three
// rejections sit beside the length check, each aimed at a password that would
// otherwise pass while being trivially guessable:
//
//   common      the handful that appear at the top of every breach corpus,
//               including their padded-to-length forms
//   repetitive  one character, or one short sequence, repeated to reach 12
//   personal    contains the person's own email name or their display name,
//               which is the first thing anyone guessing would try
//
// This is a CLIENT-SIDE policy. Firebase Authentication's own floor is six
// characters, so a caller talking to the REST API directly can still register
// a short password — closing that needs the Identity Platform password-policy
// feature, which is a paid upgrade and a console change, not a code change.
// Worth knowing before this is described to anyone as enforced.

/** The floor. Applies to new passwords; existing ones are not invalidated. */
export const MIN_PASSWORD_LENGTH = 12;

/** What a suggested password gets. Comfortably above the floor. */
export const SUGGESTED_LENGTH = 16;

/**
 * Passwords rejected however long they are.
 *
 * Not a breach corpus — that would be megabytes and belongs server-side. This
 * is the short list that a length-only rule most embarrassingly lets through,
 * matched as a substring so `mypassword123` is caught too.
 */
const COMMON = [
  'password', 'motdepasse', 'passwort', 'contrasena', 'senha',
  'qwerty', 'azerty', 'qwertz', 'letmein', 'welcome', 'admin',
  'iloveyou', 'monkey', 'dragon', 'football', 'baseball',
  'abc123', '123456', '111111', 'changeme', 'stacklens',
];

/**
 * Is this just one thing repeated?
 *
 * Catches `aaaaaaaaaaaa` and `abcabcabcabc` — both twelve characters, both
 * worth nothing. Any password that is some unit repeated to fill the length is
 * only as strong as the unit.
 */
function isRepetitive(pw) {
  for (let unit = 1; unit <= Math.floor(pw.length / 2); unit++) {
    if (pw.length % unit !== 0) continue;
    const head = pw.slice(0, unit);
    if (head.repeat(pw.length / unit) === pw) return true;
  }
  // A run of the same character covering most of the password, e.g. aaaaaaaaaaab.
  return /(.)\1{7,}/.test(pw);
}

/**
 * Words from the person's own identity that must not appear in the password.
 *
 * The email LOCAL PART only — the domain is shared by everyone at the company,
 * so rejecting it would reject a good password for containing "acme". Short
 * fragments are dropped: a two-letter name would reject almost everything.
 */
function personalWords({ email = '', name = '' } = {}) {
  const local = String(email).split('@')[0] || '';
  return [local, ...String(name).split(/\s+/)]
    .map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(w => w.length >= 4);
}

/**
 * Why this password is not acceptable, or null when it is.
 *
 * Returns a translation KEY rather than a sentence: every other message in
 * this form goes through t(), and a hardcoded English string here would be the
 * one that stayed English in French.
 */
export function passwordProblem(password, identity = {}) {
  const pw = String(password || '');
  if (pw.length < MIN_PASSWORD_LENGTH) return 'lp_password_min';

  const lower = pw.toLowerCase();
  if (COMMON.some(word => lower.includes(word))) return 'lp_password_common';
  if (isRepetitive(pw)) return 'lp_password_repetitive';
  if (personalWords(identity).some(word => lower.includes(word))) {
    return 'lp_password_personal';
  }
  return null;
}

/** Convenience for a disabled-button check. */
export function isAcceptablePassword(password, identity = {}) {
  return passwordProblem(password, identity) === null;
}

// The alphabet a suggestion is drawn from.
//
// Missing on purpose: 0 O o, 1 l I, and the pairs that look alike in the fonts
// people read passwords in. A suggested password gets copied by hand, read off
// a phone, or dictated to a colleague at least once — an unambiguous alphabet
// costs about four bits here and saves the "was that an ell or a one?" that
// makes someone give up and type `Summer2026!` instead.
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-_.+';

/**
 * A password worth suggesting, or null if this browser cannot generate one
 * safely.
 *
 * crypto.getRandomValues or nothing. Math.random is seeded predictably enough
 * that a password built from it is a liability, and offering a weak suggestion
 * under a "strong password" label would be worse than offering none — so the
 * caller gets null and hides the button.
 *
 * Rejection sampling rather than `% ALPHABET.length`: the modulo is biased
 * towards the start of the alphabet, which is exactly the kind of quiet
 * weakness nobody would ever notice here.
 */
export function suggestPassword(length = SUGGESTED_LENGTH, attemptsLeft = 8) {
  const size = Math.max(MIN_PASSWORD_LENGTH, Math.floor(length) || SUGGESTED_LENGTH);
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') return null;

  const limit = 256 - (256 % ALPHABET.length);
  let out = '';
  let guard = 0;
  while (out.length < size && guard < 1000) {
    guard++;
    const bytes = new Uint8Array(size);
    cryptoObj.getRandomValues(bytes);
    for (const b of bytes) {
      if (b >= limit) continue;             // biased tail — discard
      out += ALPHABET[b % ALPHABET.length];
      if (out.length === size) break;
    }
  }
  if (out.length < size) return null;

  // A random draw can still land on something the policy rejects (a run of one
  // character, or the person's own name by coincidence). Vanishingly unlikely,
  // and a suggestion the form then refuses would be absurd, so check.
  //
  // BOUNDED, and that bound is load-bearing rather than defensive. Writing the
  // modulo-bias test surfaced it: a source of bytes that always maps to the
  // same character produces a repetitive password, which fails the policy,
  // which retried — for ever, until the stack ran out. A broken CSPRNG should
  // hide the button, not crash the signup form, so exhausting the attempts
  // returns null like every other "cannot do this safely" path here.
  if (passwordProblem(out) === null) return out;
  return attemptsLeft > 1 ? suggestPassword(size, attemptsLeft - 1) : null;
}
