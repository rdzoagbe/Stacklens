// ── Telling somebody when the live site breaks ─────────────────────────────
//
// Uncaught errors from the browser already reach /client_errors, and have for
// months. Nothing reads them. A bad deploy could break every page on
// stacklens.fr and the only way to find out was to open it yourself, or for a
// customer to write in.
//
// Sentry is configured and receives the same crashes, but its alert rules are
// set in Sentry's own web interface. This is the half that can live in the
// repository, and it has the advantage of not depending on a third party's
// plan limits: it uses the SendGrid account the product already sends invoices
// and digests through.
//
// The whole problem is volume. A broken deploy does not produce one crash, it
// produces one per visitor per page. An alerting system that mails each of
// them is worse than no alerting, because the mailbox becomes something to
// ignore — the same failure as the preview check that could only ever be red.
//
// So two limits, and they are the reason this file exists separately from the
// endpoint: they are pure decisions about state and time, and those are worth
// testing without a Firestore or a mail server anywhere near them.
//
//   fingerprint   crashes that are "the same bug" collapse to one key, so a
//                 deploy that breaks a page for four hundred people sends one
//                 email, not four hundred
//   cooldown      a fingerprint already reported is not reported again for a
//                 day, so a bug that persists does not re-mail every hour
//   cap           a hard ceiling on alerts per rolling hour regardless of how
//                 many distinct bugs appear, so a catastrophic release cannot
//                 empty a SendGrid quota or bury the one useful message

/** Do not re-alert the same crash within this window. */
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Never send more than this many alerts in one rolling hour, of any kind. */
const MAX_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Collapse a crash message to a key that groups "the same bug".
 *
 * Minified bundle names carry a content hash that changes on every deploy, and
 * messages carry ids, URLs and numbers that differ per user. Left in, every
 * visitor's crash is a distinct fingerprint and the cooldown protects nothing
 * — which is the failure mode this function exists to avoid, not a detail.
 */
function fingerprint(message) {
  return String(message || '')
    .toLowerCase()
    // URLs and file paths, including the per-deploy content hash in chunk names.
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/\/[\w.-]+\.(?:js|jsx|css|map)\b/g, '/<file>')
    // Hex blobs, uuids, and anything that looks like an id or a number.
    .replace(/\b[0-9a-f]{8,}\b/g, '<hex>')
    .replace(/\b\d+\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/** Alert timestamps inside the rolling window, oldest first. */
function recentSends(state, now) {
  const sent = Array.isArray(state?.sent) ? state.sent : [];
  return sent
    .map(v => (typeof v === 'number' ? v : Date.parse(v)))
    .filter(ms => Number.isFinite(ms) && now - ms < HOUR_MS)
    .sort((a, b) => a - b);
}

/**
 * Should this crash produce an email?
 *
 * Returns a reason either way. The endpoint logs it, because "we did not
 * alert" is exactly as important to be able to explain as "we did" — an
 * alerting system nobody can reason about gets switched off.
 */
function shouldAlert(state, message, now = Date.now()) {
  const fp = fingerprint(message);
  if (!fp) return { alert: false, fp, reason: 'empty message' };

  const seen = (state && typeof state.seen === 'object' && state.seen) || {};
  const last = typeof seen[fp] === 'number' ? seen[fp] : Date.parse(seen[fp]);
  if (Number.isFinite(last) && now - last < COOLDOWN_MS) {
    return { alert: false, fp, reason: 'already reported within the cooldown' };
  }

  const recent = recentSends(state, now);
  if (recent.length >= MAX_PER_HOUR) {
    return { alert: false, fp, reason: `hourly cap of ${MAX_PER_HOUR} reached` };
  }

  return { alert: true, fp, reason: 'new crash' };
}

/**
 * The state to store after sending an alert.
 *
 * Prunes as it goes: `seen` would otherwise grow one entry per distinct bug
 * for the life of the project, in a document with a 1MB ceiling. Entries older
 * than the cooldown cannot affect a decision, so they are not kept.
 */
function recordAlert(state, fp, now = Date.now()) {
  const seen = {};
  const prior = (state && typeof state.seen === 'object' && state.seen) || {};
  for (const [key, value] of Object.entries(prior)) {
    const ms = typeof value === 'number' ? value : Date.parse(value);
    if (Number.isFinite(ms) && now - ms < COOLDOWN_MS) seen[key] = ms;
  }
  seen[fp] = now;
  return { seen, sent: [...recentSends(state, now), now] };
}

module.exports = {
  COOLDOWN_MS,
  MAX_PER_HOUR,
  HOUR_MS,
  fingerprint,
  recentSends,
  shouldAlert,
  recordAlert,
};
