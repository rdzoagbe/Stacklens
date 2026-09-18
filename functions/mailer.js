/**
 * The one door to SendGrid, and it is shut unless a key is configured.
 *
 * WHY THIS EXISTS
 *
 * Five functions used to do this inline:
 *
 *   const sgMail = require('@sendgrid/mail');
 *   sgMail.setApiKey(SENDGRID_API_KEY.value());
 *   await sgMail.send({ to: someonesEmailAddress, ... });
 *
 * With no key configured, that still POSTs to sendgrid.net with a recipient's
 * address in the body. The request fails — and the address has already been
 * transmitted. A dead account does not undo a live code path, which is why
 * external-services.test.js refused to let SendGrid come off the published
 * sub-processor list while these call sites existed.
 *
 * So the decision moves BEFORE the request. When no usable key is present,
 * nothing is sent, nothing is contacted, and @sendgrid/mail is not even
 * loaded — the require sits inside the configured branch on purpose.
 *
 * WHAT IT DOES NOT DO
 *
 * It does not make SendGrid stop being a sub-processor. The capability is one
 * secret away from active, so the published list still names it. What the gate
 * buys is that "we are not using it" is true of the running system rather than
 * true only of the billing account.
 */

// Every SendGrid key starts with this. A value that does not is a
// misconfiguration, not an absence, and the two are reported differently
// below — "no key" is expected right now, "wrong key" never is.
const SENDGRID_KEY_PREFIX = 'SG.';
const MIN_KEY_LENGTH = 20;

/**
 * Classifies the key without using it.
 *   'ok'       a plausible SendGrid key
 *   'absent'   nothing configured — the expected state while email is off
 *   'invalid'  something configured that is not a SendGrid key
 */
function classifyKey(raw) {
  const key = String(raw || '').trim();
  if (!key) return 'absent';
  if (key.length < MIN_KEY_LENGTH) return 'invalid';
  if (!key.startsWith(SENDGRID_KEY_PREFIX)) return 'invalid';
  return 'ok';
}

/** True only when a send would actually be attempted. */
function mailConfigured(raw) {
  return classifyKey(raw) === 'ok';
}

/**
 * Sends one message, or refuses without contacting SendGrid.
 *
 * Returns { sent, skipped, status, error } and never throws: every caller
 * here is either an HTTP handler that must answer or a scheduled job that
 * must keep going through the rest of its loop.
 *
 *   sent: true                     delivered to SendGrid
 *   skipped: 'email-not-configured'  no key — nothing was transmitted
 *   skipped: 'email-misconfigured'   a key is set but is not a SendGrid key
 *   error: <string>                SendGrid was reached and refused
 */
async function sendMail(raw, message) {
  const state = classifyKey(raw);

  if (state === 'absent') {
    return { sent: false, skipped: 'email-not-configured', status: null, error: null };
  }
  if (state === 'invalid') {
    // Loud on purpose. Silently treating a malformed key as "email is off"
    // is how a real outage gets mistaken for a deliberate setting.
    console.error('mailer: SENDGRID_API_KEY is set but does not look like a ' +
      'SendGrid key (expected the "SG." prefix). No mail will be sent.');
    return { sent: false, skipped: 'email-misconfigured', status: null, error: null };
  }

  // Required here rather than at module scope: when email is off, the library
  // is never loaded and no code path can reach sendgrid.net.
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(String(raw).trim());
  try {
    const [resp] = await sgMail.send(message);
    return { sent: true, skipped: null, status: resp?.statusCode ?? null, error: null };
  } catch (err) {
    // SendGrid puts the useful detail on err.response.body, not on err.message.
    const body = err?.response?.body;
    return {
      sent: false,
      skipped: null,
      status: err?.code ?? null,
      error: body?.errors?.map(e => e.message).join('; ') || err?.message || 'Unknown mail error',
    };
  }
}

module.exports = { sendMail, mailConfigured, classifyKey, SENDGRID_KEY_PREFIX, MIN_KEY_LENGTH };
