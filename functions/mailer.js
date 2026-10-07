/**
 * The one door to the email provider, and it is shut unless a key is configured.
 *
 * Brevo (Sendinblue, Paris) since 2026-10-07; Twilio SendGrid before that,
 * whose free allowance ran out ("Maximum credits exceeded") and which sat in
 * the USA. Brevo's transactional API is one HTTPS request, so no library is
 * loaded and nothing is contacted unless a usable key is present.
 *
 * WHY THIS EXISTS
 *
 * Five functions used to call the provider inline. With no key configured,
 * that still POSTed a recipient's address to the provider; the request failed,
 * and the address had already been transmitted. So the decision moves BEFORE
 * the request: when no usable key is present, nothing is sent and nothing is
 * contacted.
 *
 * SendGrid is still the inbound door: Inbound Parse posts the invoices people
 * forward to invoiceInbound. Nothing here contacts SendGrid's servers any more.
 */

// Every Brevo API key starts with this. A value that does not is a
// misconfiguration, not an absence, and the two are reported differently
// below — "no key" is expected while email is off, "wrong key" never is.
const BREVO_KEY_PREFIX = 'xkeysib-';
const MIN_KEY_LENGTH = 20;
const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Classifies the key without using it.
 *   'ok'       a plausible Brevo key
 *   'absent'   nothing configured — the expected state while email is off
 *   'invalid'  something configured that is not a Brevo key (a SendGrid
 *              key left in the secret, for instance)
 */
function classifyKey(raw) {
  const key = String(raw || '').trim();
  if (!key) return 'absent';
  if (key.length < MIN_KEY_LENGTH) return 'invalid';
  if (!key.startsWith(BREVO_KEY_PREFIX)) return 'invalid';
  return 'ok';
}

/**
 * Says what is wrong with the configured key, in words, WITHOUT repeating any
 * of it (only its length and the shape of its prefix). The founder's Test
 * email button shows this, so "off" and "wrong kind of key" read differently.
 * Brevo issues two look-alike secrets: API keys ("xkeysib-") and SMTP keys
 * ("xsmtpsib-"); only the first works on the REST endpoint used here.
 */
function describeKey(raw) {
  const key = String(raw || '').trim();
  if (!key) return 'BREVO_API_KEY is empty or was not available to this function. If you just created or changed the secret, redeploy the functions so they pick up the new version.';
  if (key.startsWith('xsmtpsib-')) return 'BREVO_API_KEY holds an SMTP key ("xsmtpsib-…"). Stacklens needs an API key ("xkeysib-…"): Brevo → SMTP & API → API Keys tab.';
  if (key.startsWith('SG.')) return 'BREVO_API_KEY still holds the previous provider key ("SG.…"). Put the Brevo API key ("xkeysib-…") in that secret.';
  if (!key.startsWith(BREVO_KEY_PREFIX)) return `BREVO_API_KEY (${key.length} characters) does not start with "${BREVO_KEY_PREFIX}", so it is not a Brevo API key.`;
  return `BREVO_API_KEY is only ${key.length} characters, too short for a Brevo API key.`;
}

/** True only when a send would actually be attempted. */
function mailConfigured(raw) {
  return classifyKey(raw) === 'ok';
}

const asList = (v) => (Array.isArray(v) ? v : [v]).filter(Boolean).map((x) => (typeof x === 'string' ? { email: x } : x));

/**
 * The message as the callers write it ({ to, from: { email, name }, subject,
 * html, text }) in Brevo's shape. Exported for the test.
 */
function toBrevoPayload(message) {
  const from = message.from || {};
  return {
    sender: { email: from.email || 'hello@stacklens.fr', name: from.name || 'Stacklens' },
    to: asList(message.to),
    subject: String(message.subject || ''),
    htmlContent: message.html || undefined,
    textContent: message.text || undefined,
  };
}

/**
 * Sends one message, or refuses without contacting the provider.
 *
 * Returns { sent, skipped, status, error } and never throws: every caller
 * here is either an HTTP handler that must answer or a scheduled job that
 * must keep going through the rest of its loop.
 *
 *   sent: true                       accepted by Brevo
 *   skipped: 'email-not-configured'  no key — nothing was transmitted
 *   skipped: 'email-misconfigured'   a key is set but is not a Brevo key
 *   error: <string>                  Brevo was reached and refused
 */
async function sendMail(raw, message) {
  const state = classifyKey(raw);

  if (state === 'absent') {
    return { sent: false, skipped: 'email-not-configured', status: null, error: null };
  }
  if (state === 'invalid') {
    // Loud on purpose. Silently treating a malformed key as "email is off"
    // is how a real outage gets mistaken for a deliberate setting.
    console.error('mailer: BREVO_API_KEY is set but does not look like a ' +
      'Brevo key (expected the "xkeysib-" prefix). No mail will be sent.');
    return { sent: false, skipped: 'email-misconfigured', status: null, error: null };
  }

  try {
    const res = await fetch(BREVO_SEND_URL, {
      method: 'POST',
      headers: { 'api-key': String(raw).trim(), 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(toBrevoPayload(message)),
    });
    if (res.ok) return { sent: true, skipped: null, status: res.status, error: null };
    // Brevo answers { code, message } on refusal.
    const body = await res.json().catch(() => ({}));
    return { sent: false, skipped: null, status: res.status, error: body?.message || body?.code || `HTTP ${res.status}` };
  } catch (err) {
    return { sent: false, skipped: null, status: null, error: err?.message || 'Unknown mail error' };
  }
}

module.exports = { sendMail, mailConfigured, classifyKey, describeKey, toBrevoPayload, BREVO_KEY_PREFIX, MIN_KEY_LENGTH, BREVO_SEND_URL };
