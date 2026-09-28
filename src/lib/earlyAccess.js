// ── The early-access programme ─────────────────────────────────────────────
//
// Ten accounting firms get the Pro plan free for six months in exchange for
// three short calls and honest feedback. Everything the offer page states is
// read from here, and the founder's "Grant early access" button grants
// exactly this, so the page cannot promise a longer period, a different plan
// or more places than the product gives.
//
// When the ten places are taken, set OPEN to false: the form is replaced by a
// note that the programme is full. Nothing counts applications automatically.

export const EARLY_ACCESS = Object.freeze({
  OPEN: true,
  SPOTS: 10,
  PLAN: 'pro',
  MONTHS: 6,
  CALLS: 3,
  CALL_MINUTES: 20,
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** Six calendar months from `from`, as a ms timestamp. */
export function earlyAccessUntil(from = Date.now()) {
  const d = new Date(from);
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + EARLY_ACCESS.MONTHS, d.getUTCDate()));
  return end.getTime() || from + EARLY_ACCESS.MONTHS * 30 * DAY_MS;
}
