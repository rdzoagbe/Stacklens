// ── Escaping text that goes into an email's HTML ────────────────────────────
//
// Tool, department and employee names are typed by people, imported from a CSV
// or read from a directory, and a team editor may write them into the owner's
// workspace. Put into an email's HTML as they are, a name can carry markup and
// a link, in a message that arrives from hello@stacklens.fr. Every value that
// did not come from our own code goes through this before it is interpolated
// (alert-email.test.js holds the alert and digest emails to it).

/** Escape text for HTML element content and quoted attribute values. */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = { escapeHtml };
