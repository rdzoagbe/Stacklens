// ── The anonymous visit counter (browser half; server: functions/pulse.js) ──
//
// Google Analytics counts only visitors who accept its cookies. This counts
// everyone, by sending nothing that identifies anyone: an event name, the
// campaign tag of the link the visitor arrived by (`?c=nl`, or utm_campaign)
// and, for a visit, the page. No cookie and no browser storage of any kind:
// the campaign is kept in this module's memory, so it lasts as long as the
// page is open and is gone after. The server keeps one number per day.
//
// It only runs on the live site, so development and tests send nothing.

const ENDPOINT = 'https://us-central1-accessguard-v2.cloudfunctions.net/pulse';
const LIVE_HOSTS = ['stacklens.fr', 'www.stacklens.fr'];

// Must match PULSE_EVENTS in functions/pulse.js (pulse.test.js holds them equal).
export const PULSE_EVENTS = [
  'visit', 'audit_run', 'audit_portfolio_run', 'cta_click',
  'sign_up', 'trial_started', 'checkout_started', 'checkout_completed',
];

let campaign = '';

/** Read the campaign tag from the address the visitor arrived at. */
export function campaignFrom(search) {
  try {
    const q = new URLSearchParams(search || '');
    const c = (q.get('c') || q.get('utm_campaign') || '').trim().toLowerCase();
    return /^[a-z0-9_-]{1,24}$/.test(c) && !c.includes('__') ? c : '';
  } catch {
    return '';
  }
}

function isLive() {
  try { return LIVE_HOSTS.includes(window.location.hostname); } catch { return false; }
}

/** Count one event. Never throws, never waits. */
export function pulse(event, page) {
  try {
    if (!PULSE_EVENTS.includes(event) || !isLive()) return;
    const body = JSON.stringify({ e: event, c: campaign, ...(page ? { p: page } : {}) });
    if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, body)) return;
    fetch(ENDPOINT, { method: 'POST', keepalive: true, body }).catch(() => {});
  } catch { /* counting must never break the app */ }
}

/** Once, at page load: remember the campaign and count the visit. */
export function startPulse() {
  try {
    campaign = campaignFrom(window.location.search);
    pulse('visit', window.location.pathname);
  } catch { /* never */ }
}

// For the founder's screen (components/PulseCard.jsx): the server's rows
// turned into one line per campaign, over the last `days` days.
/** Rows from the server → one line per campaign, newest days only. */
export function pulseByCampaign(rows, days = 30, today = new Date()) {
  const from = new Date(today.getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const by = new Map();
  for (const r of rows || []) {
    if (r.day < from) continue;
    const event = r.event === 'audit_portfolio_run' ? 'audit_run' : r.event;
    const line = by.get(r.campaign) || { campaign: r.campaign, pages: {} };
    line[event] = (line[event] || 0) + r.count;
    if (r.event === 'visit') line.pages[r.page] = (line.pages[r.page] || 0) + r.count;
    by.set(r.campaign, line);
  }
  return [...by.values()].sort((a, b) => (b.visit || 0) - (a.visit || 0));
}
