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

// ── Storing the name is not the same as keeping it ─────────────────────────
//
// The name fix shipped and the modal still appeared. Storing it was
// necessary and not sufficient, and the second half is the same shape as the
// verification-button bug above: a value set in one place never reaching the
// place that reads it.
//
// The sequence:
//
//   1. registerWithEmail stores the name (Auth profile + /users doc)
//   2. TrialPage writes it into the local blob
//   3. TrialPage does window.location.replace('/dashboard') — a full reload
//   4. useAuth's onAuthStateChanged runs on that fresh load and rebuilds
//      cur.user, overwriting displayName from fbUser
//   5. the Auth user restored from persistence carries no displayName
//   6. so the blob's name is replaced with undefined, and NameGate — reading
//      a blob with no name — asks for the name that was just given
//
// Step 4 is the bug. The spread brings the existing blob in and the explicit
// key then clobbers it.
describe('the stored name survives the next page load', () => {
  const hook = (() => {
    const raw = readFileSync(resolve(process.cwd(), 'src/hooks/useAuth.js'), 'utf8');
    return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  })();

  it('does not overwrite a known name with an unknown one', () => {
    // Asserted on the assignment itself: the fallback to the existing blob
    // has to be part of THIS expression, since that is what runs on the
    // reload that was erasing it.
    const m = /displayName:\s*fbUser\.displayName[\s\S]{0,200}?,\n/.exec(hook);
    expect(m, 'the displayName assignment was not found').toBeTruthy();
    expect(m[0], 'must fall back to the name already in the blob')
      .toMatch(/cur\.user\?\.displayName/);
  });

  it('still prefers what Firebase Auth reports when it has one', () => {
    // A Google user who renames their Google account should see that name,
    // so the fallback must come last, not first.
    const m = /displayName:\s*fbUser\.displayName[\s\S]{0,200}?,\n/.exec(hook);
    expect(m[0].indexOf('fbUser.displayName'))
      .toBeLessThan(m[0].indexOf('cur.user?.displayName'));
  });

  it('the signup page writes the name into the blob in the first place', () => {
    // The other half of the chain. If this stops happening there is nothing
    // for the fallback to preserve.
    const page = readFileSync(resolve(process.cwd(), 'src/pages/TrialPage.jsx'), 'utf8');
    expect(page).toMatch(/displayName: authName/);
  });
});

// ── An exit that is offered has to work ────────────────────────────────────
//
// The "What's your name?" gate rendered a ✕ Close button and a clickable
// backdrop, both wired to `onClose={() => {}}`. So it showed the way out
// twice and provided it neither time.
//
// Same species as the verification button: an affordance that says it does
// something and does not. The gate is meant to be mandatory, so the honest
// fix is to stop drawing the exit rather than to make it work.
describe('a modal only offers a Close button when it closes', () => {
  const ui = (() => {
    const raw = readFileSync(resolve(process.cwd(), 'src/components/ui.jsx'), 'utf8');
    return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  })();
  const shell = (() => {
    const raw = readFileSync(resolve(process.cwd(), 'src/components/AppShell.jsx'), 'utf8');
    return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  })();

  it('decides from whether onClose is actually a function', () => {
    // Not from a separate `dismissible` prop a caller could forget to pass:
    // derived from the handler itself, so the button and the behaviour cannot
    // disagree.
    expect(ui).toMatch(/const dismissible = typeof onClose === 'function';/);
  });

  it('renders no Close button without a handler', () => {
    // Asserted on the Close render ITSELF, not on a slice of the file. A first
    // version sliced between two class-name strings whose first occurrences
    // land elsewhere in the file, so it was matching `dismissible ?` from the
    // backdrop line and passed with the button made unconditional again.
    expect(ui, 'the Close button must be inside the dismissible conditional')
      .toMatch(/dismissible \? \(\s*<Button[\s\S]{0,200}?Close/);
  });

  it('does not let the backdrop pretend to dismiss either', () => {
    // The other half. A backdrop that swallows clicks silently is the same
    // lie with no label on it.
    expect(ui).toMatch(/onClick=\{dismissible \? onClose : undefined\}/);
  });

  it('the name gate passes no handler, so it is honestly mandatory', () => {
    const gate = shell.slice(shell.indexOf('export function NameGate'), shell.indexOf('export function DemoBanner'));
    expect(gate, 'a no-op onClose is what drew the button that did nothing')
      .not.toMatch(/onClose=\{\(\) => \{\}\}/);
    expect(gate).toMatch(/<Modal open title=\{t\('name_gate_title'\)\}/);
  });

  it('EVERY other modal in the app still has a working handler', () => {
    // The change must not silently remove Close from modals people rely on.
    //
    // Checked per modal, not once per file. A first version asserted that the
    // file contained an onClose somewhere, which ToolsPage satisfied from its
    // other two modals while the first one had lost its handler.
    //
    // Literal paths: a variable trips security/detect-non-literal-fs-filename.
    // Bounded to the OPENING TAG, by scanning to the first `>` outside braces.
    // A fixed-size window does not work: a first version took 400 characters
    // from each `<Modal`, which on ToolsPage ran into the NEXT modal's tag, so
    // removing the first modal's handler still passed on its neighbour's.
    // Brace depth matters because `() => setOpen(false)` contains a `>`.
    const openingTag = (src, at) => {
      let depth = 0;
      for (let i = at; i < src.length; i++) {
        const c = src[i];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '>' && depth === 0) return src.slice(at, i + 1);
      }
      return src.slice(at);
    };
    const eachModalHasOnClose = (src, where) => {
      let from = 0;
      let seen = 0;
      for (;;) {
        const at = src.indexOf('<Modal', from);
        if (at === -1) break;
        seen++;
        expect(openingTag(src, at), `a <Modal in ${where} has no onClose`)
          .toMatch(/onClose=/);
        from = at + 6;
      }
      expect(seen, `no modal found in ${where}`).toBeGreaterThan(0);
    };
    eachModalHasOnClose(
      readFileSync(resolve(process.cwd(), 'src/pages/ToolsPage.jsx'), 'utf8'), 'ToolsPage');
    eachModalHasOnClose(
      readFileSync(resolve(process.cwd(), 'src/pages/EmployeesPage.jsx'), 'utf8'), 'EmployeesPage');
  });
});
