import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── The signup path must not trap the person walking it ────────────────────
//
// Two bugs found by actually walking it, both of the same species: a step
// that appears to work and does not. Neither throws, neither logs, and
// neither is visible from reading the happy path.
//
//   the name was collected and discarded, so the app immediately asked for
//   the name that had just been given
//
//   "I've verified — continue" did nothing, on the only screen with no other
//   way out
//
// Guards are against the source with comments stripped: a source check in
// this repo was once satisfied by the comment describing the code, and I
// repeated that mistake twice while writing these.


// ── The only way off the verification screen has to work ───────────────────
//
// Reported from a real signup: "when I click on I've verified nothing
// happens". It was not a rendering glitch. The handler read
//
//   await firebaseUser.reload();
//   // If verified, the onAuthStateChanged will re-render with updated user
//   if (!firebaseUser.emailVerified) setError(...)
//
// and that comment is the bug. onAuthStateChanged fires on sign-in and
// sign-out; it does not fire on reload(). So for the person who HAD clicked
// the link, no error was set, no state changed, and the wall stayed. The
// button did nothing — on the one screen where doing nothing traps the
// account, because there is no other way out of it.
//
// Two things had to change, and both are asserted here: ask the SERVER
// whether the address is verified, and report the answer to the component
// that owns the gate, since state set inside the wall re-renders only the
// wall.
describe('the email verification gate', () => {
  const src = (() => {
    const raw = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8');
    return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  })();

  it('asks the server rather than re-reading a cached flag', () => {
    expect(src).toMatch(/refreshEmailVerified\(/);
    expect(src, 'reload() alone does not re-render anything')
      .not.toMatch(/firebaseUser\.reload\(\)/);
  });

  it('no longer relies on onAuthStateChanged firing', () => {
    // The comment that justified the bug. If it comes back, so has the bug.
    expect(src).not.toMatch(/onAuthStateChanged will re-render/);
  });

  it('reports the result up to the component that owns the gate', () => {
    // The wall is a child of RequireAuth. State the wall sets cannot clear a
    // gate RequireAuth is rendering — that is the whole mechanism of the bug.
    expect(src, 'the wall must accept a callback').toMatch(/EmailVerificationWall\(\{ email, onVerified \}\)/);
    expect(src, 'and call it on success').toMatch(/if \(verified\) onVerified\(\)/);
    // Asserted against the GATE CONDITION, not the identifier. A first
    // version matched /justVerified/, which the useState declaration
    // satisfied on its own — so dropping the flag from the condition still
    // passed, and the gate ignored the callback entirely.
    expect(src, 'the gate itself must honour it')
      .toMatch(/emailVerified === false && !justVerified/);
    expect(src, 'and RequireAuth must own the state')
      .toMatch(/const \[justVerified, setJustVerified\] = useState\(false\)/);
    expect(src).toMatch(/onVerified=\{\(\) => setJustVerified\(true\)\}/);
  });

  it('still shows a message when the address is not verified yet', () => {
    // The other half: a button that silently succeeds and a button that
    // silently fails look identical to the person clicking it.
    expect(src).toMatch(/else setError\(/);
    expect(src).toMatch(/email_not_verified_yet/);
  });

  it('forces a token refresh once verified, for the Cloud Functions', () => {
    // They read the claims. Without this the next call still carries a token
    // minted before verification.
    const cfg = readFileSync(resolve(process.cwd(), 'src/firebase-config.js'), 'utf8');
    const fn = cfg.slice(cfg.indexOf('export async function refreshEmailVerified'));
    expect(fn.slice(0, 700)).toMatch(/getIdToken\([^)]*true\)/);
  });
});

// ── The name the form asks for has to be kept ──────────────────────────────
//
// registerWithEmail took its third parameter as `_displayName` — this repo's
// ESLint convention for a parameter deliberately unused — and dropped it. So
// somebody typed "Jay tester", pressed Continue, and the very next screen was
// a modal asking "What's your name?". They had just answered that.
//
// Reported exactly that way: "asking me this while when I was creating the
// account I entered this already".
describe('the name collected at signup is stored', () => {
  const cfg = (() => {
    const raw = readFileSync(resolve(process.cwd(), 'src/firebase-config.js'), 'utf8');
    return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  })();

  const registerFn = cfg.slice(
    cfg.indexOf('export async function registerWithEmail'),
    cfg.indexOf('export async function signInWithEmail'),
  );

  it('does not take the name as a deliberately-unused parameter', () => {
    // The underscore was the whole bug, and it is the kind of thing that
    // reads as intentional to the next person.
    expect(registerFn, 'the underscore marks it unused — that is how it was lost')
      .not.toMatch(/_displayName/);
    expect(registerFn).toMatch(/registerWithEmail\(email, password, displayName\)/);
  });

  it('persists it through the helper that writes both places', () => {
    // saveDisplayName sets the Firebase Auth profile AND the /users doc.
    // Setting only the Auth profile would leave the founder view without a
    // name, which is what that helper exists to prevent.
    expect(registerFn).toMatch(/saveDisplayName\(displayName\)/);
  });

  it('stores it before sending the verification email', () => {
    // So the name is on the account even if the send fails, and Firebase's
    // own template can use it.
    expect(registerFn.indexOf('saveDisplayName'))
      .toBeLessThan(registerFn.indexOf('sendEmailVerification'));
  });

  it('does not fail the registration if the name cannot be stored', () => {
    // The account exists by this point. Losing a signup over a name would be
    // a far worse outcome than falling back to the gate.
    expect(registerFn).toMatch(/try\s*\{\s*await saveDisplayName[\s\S]*?\}\s*catch/);
  });

  it('the signup form still passes the name it collected', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/TrialPage.jsx'), 'utf8');
    expect(page).toMatch(/registerWithEmail\(authEmail, authPassword, authName\)/);
  });

  it('NameGate remains as the fallback for accounts with no name', () => {
    // Magic-link signups and OAuth accounts that return no name still need
    // it. The fix narrows who sees it; it does not remove the safety net.
    const shell = readFileSync(resolve(process.cwd(), 'src/components/AppShell.jsx'), 'utf8');
    expect(shell).toMatch(/export function NameGate/);
    expect(shell).toMatch(/const needsName = /);
  });
});
