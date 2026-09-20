// ── Activation evidence ────────────────────────────────────────────────────
//
// The Innov'up dossier has to show, with numbers, that data goes in and an
// insight comes out — and how long that takes. GA4 already counts sessions
// and returning users; what it cannot know is *when the product first told
// this workspace something*, because that is a fact about the data, not
// about the page. These four notes close the gap:
//
//   noteDataArrived        stamps the first time data entered the workspace
//                          (import, sync, or a hand-added record)
//   noteFirstInsight       fires `first_insight` ONCE, the first time the
//                          dashboard has at least one alert to show, carrying
//                          minutes since sign-up and since data arrival
//   noteVisit              fires `return_after_insight` on the first visit of
//                          any LATER day, once the insight has been seen
//   noteRecommendationActed / noteRecommendationsShown
//                          which action-inbox items are seen and acted on,
//                          by kind and severity — never by name or by tool
//
// Every event carries counts, minutes and kind labels only. The
// analytics-privacy test checks the call sites; this module was written to
// pass it, not to be exempt from it. The stamps live in localStorage keyed
// per user, like sg_onboarded_, so two accounts on one browser do not share a
// first-insight; the user id is a key suffix here and is never sent anywhere.
// Storage that throws (private mode, full quota) degrades to "no stamp": the
// note is skipped, the app is not.

import { track } from './analytics';

const KEY = {
  data: 'sg_act_data_at',
  insight: 'sg_act_insight_at',
  visit: 'sg_act_visit_day',
  shown: 'sg_act_shown',
};

const scoped = (key, scope) => (scope ? `${key}_${scope}` : key);
const read = (store, key) => { try { return store.getItem(key); } catch { return null; } };
const write = (store, key, value) => { try { store.setItem(key, value); } catch { /* no stamp */ } };
const local = () => (typeof localStorage === 'undefined' ? null : localStorage);
const session = () => (typeof sessionStorage === 'undefined' ? null : sessionStorage);
const minutes = (from, to) => Math.max(0, Math.round((to - from) / 60_000));
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * Data entered the workspace. Only the FIRST arrival is stamped; later ones
 * leave it alone, so time-to-insight is measured from the start.
 */
export function noteDataArrived({ scope, now = Date.now() } = {}) {
  const store = local();
  if (!store) return false;
  const key = scoped(KEY.data, scope);
  if (read(store, key)) return false;
  write(store, key, String(now));
  return true;
}

/**
 * The dashboard has something to say. Fires once per user, and only when
 * there is at least one alert — an empty inbox is not an insight.
 */
export function noteFirstInsight({ alerts = 0, critical = 0 } = {}, { scope, signupAt = 0, now = Date.now() } = {}) {
  if (!(alerts > 0)) return false;
  const store = local();
  if (!store) return false;
  const key = scoped(KEY.insight, scope);
  if (read(store, key)) return false;
  write(store, key, String(now));
  if (!read(store, key)) return false; // storage refused the stamp: do not fire an event we cannot dedupe
  const params = { alerts, critical };
  const dataAt = Number(read(store, scoped(KEY.data, scope)));
  if (dataAt > 0) params.minutes_since_data = minutes(dataAt, now);
  if (signupAt > 0) params.minutes_since_signup = minutes(signupAt, now);
  track('first_insight', params);
  return true;
}

/**
 * A visit on a later calendar day than the last one, after the first insight.
 * The day the insight was seen never counts as a return.
 */
export function noteVisit({ scope, now = Date.now() } = {}) {
  const store = local();
  if (!store) return false;
  const insightAt = Number(read(store, scoped(KEY.insight, scope)));
  if (!(insightAt > 0)) return false;
  const key = scoped(KEY.visit, scope);
  const today = dayOf(now);
  const last = read(store, key);
  write(store, key, today);
  if (!last || last === today) return false;
  track('return_after_insight', { days_since_first_insight: Math.round((now - insightAt) / 86_400_000) });
  return true;
}

/** Someone clicked the action on an inbox item. Kind and severity only. */
export function noteRecommendationActed(kind, severity) {
  if (!kind) return false;
  track('recommendation_acted', { kind, severity });
  return true;
}

/**
 * Which alert kinds the dashboard showed, once per browser session, so
 * "acted" has a denominator. `kinds` are the stable alert ids from
 * buildRiskAlerts, never titles.
 */
export function noteRecommendationsShown(kinds = [], { scope } = {}) {
  if (!kinds.length) return false;
  const store = session();
  if (!store) return false;
  const key = scoped(KEY.shown, scope);
  if (read(store, key)) return false;
  write(store, key, '1');
  if (!read(store, key)) return false;
  const counts = {};
  for (const k of kinds) counts[k] = (counts[k] || 0) + 1;
  track('recommendations_shown', { total: kinds.length, ...counts });
  return true;
}

export const ACTIVATION_KEYS = KEY;
