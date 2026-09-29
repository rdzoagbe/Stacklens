// ── Who the monthly report may go to ───────────────────────────────────────
//
// The browser's copy of the rule functions/monthly-report.js enforces, so
// Settings → Notifications can say which addresses will be refused before
// saving. The server's copy is the one that counts: the settings are stored
// in the client-written workspace, and the server checks every address again
// against the account's Firebase Auth email. report-recipients-parity.test.js
// keeps the two identical.

export const MAX_EXTRA_RECIPIENTS = 3;
const PUBLIC_MAIL = /^(gmail\.com|googlemail\.com|yahoo\.[a-z.]+|ymail\.com|hotmail\.[a-z.]+|outlook\.[a-z.]+|live\.[a-z.]+|msn\.com|icloud\.com|me\.com|mac\.com|aol\.com|proton\.me|protonmail\.com|pm\.me|gmx\.[a-z.]+|mail\.com|zoho\.com|yandex\.[a-z.]+|laposte\.net|orange\.fr|wanadoo\.fr|free\.fr|sfr\.fr|bbox\.fr|neuf\.fr|numericable\.fr|web\.de|t-online\.de)$/;
// No nested quantifier (security/detect-unsafe-regex): split, then check each part.
const isEmail = (s) => { const [local, domain, ...rest] = String(s).split('@'); const labels = String(domain || '').split('.'); return !rest.length && /^[^\s@<>(),;:"]+$/.test(local || '') && labels.length >= 2 && labels.every((l) => /^[a-z0-9-]+$/.test(l)) && /^[a-z]{2,}$/.test(labels[labels.length - 1]); };

/** { to, rejected }: the account first, then accepted colleagues. */
export function reportRecipients(accountEmail, extras) {
  const own = String(accountEmail || '').trim().toLowerCase();
  if (!isEmail(own)) return { to: [], rejected: [] };
  const domain = own.split('@')[1];
  const allowExtras = !PUBLIC_MAIL.test(domain);
  const to = [own]; const rejected = [];
  for (const raw of Array.isArray(extras) ? extras : []) {
    const e = String(raw || '').trim().toLowerCase();
    if (!e || to.includes(e)) continue;
    if (!allowExtras || !isEmail(e) || e.split('@')[1] !== domain || to.length > MAX_EXTRA_RECIPIENTS) {
      rejected.push(e);
      continue;
    }
    to.push(e);
  }
  return { to, rejected };
}

/** Can this account add colleagues at all? (Not from a public mail domain.) */
export const canAddColleagues = (accountEmail) => {
  const own = String(accountEmail || '').trim().toLowerCase();
  return isEmail(own) && !PUBLIC_MAIL.test(own.split('@')[1]);
};
