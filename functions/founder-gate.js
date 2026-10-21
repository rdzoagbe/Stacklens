// ── Who counts as the founder, on the server ────────────────────────────────
//
// founderops (index.js) lets the founder grant plans, read any account and
// send test mail, so who passes this gate is the most valuable decision in the
// functions. A founder is one of the allow-listed uids, an account carrying
// the is_founder flag, or someone signed in with a founder's email address —
// and only if Firebase has VERIFIED that address. A token's email claim is
// also present for an email/password account whose owner never proved the
// mailbox, so on its own it proves nothing. The Firestore rules say the same
// (firestore.rules, isFounderEmail); src/lib/firestore-rules.test.js holds
// them to it.

/**
 * `decoded` is the verified ID token, `userDoc` the caller's /users document
 * data (or null), `founderUids` and `founderEmails` the allow-lists.
 */
function isFounderCaller({ decoded, userDoc, founderUids = [], founderEmails = [] }) {
  if (!decoded) return false;
  if (founderUids.includes(decoded.uid)) return true;
  if (userDoc && userDoc.is_founder === true) return true;
  const email = String(decoded.email || '').toLowerCase();
  return decoded.email_verified === true && !!email && founderEmails.includes(email);
}

module.exports = { isFounderCaller };
