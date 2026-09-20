import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./analytics', () => ({ track: vi.fn() }));
import { track } from './analytics';
import {
  noteDataArrived, noteFirstInsight, noteVisit,
  noteRecommendationActed, noteRecommendationsShown, ACTIVATION_KEYS,
} from './activation';

// ── The activation events the grant dossier quotes ─────────────────────────
//
// docs/grants/innovup/05-kpis-and-measurement.md says "median time from data
// import to first actionable insight" is measured by `first_insight`, once
// per user, in minutes since data arrival. If that event fired twice, fired
// with no alert to show, or fired in demo mode, the KPI would be wrong in a
// way nobody would notice from the GA4 dashboard. So the behaviour is pinned
// here, against a real (jsdom) localStorage.

const T0 = Date.parse('2026-09-20T10:00:00Z');
const MIN = 60_000, DAY = 86_400_000;

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); track.mockClear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('first insight', () => {
  it('fires once, with minutes since data arrival and since sign-up', () => {
    noteDataArrived({ scope: 'u1', now: T0 });
    expect(noteFirstInsight({ alerts: 3, critical: 1 }, { scope: 'u1', signupAt: T0 - 30 * MIN, now: T0 + 5 * MIN })).toBe(true);
    expect(track).toHaveBeenCalledWith('first_insight', {
      alerts: 3, critical: 1, minutes_since_data: 5, minutes_since_signup: 35,
    });
    expect(noteFirstInsight({ alerts: 3, critical: 1 }, { scope: 'u1', now: T0 + 6 * MIN })).toBe(false);
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('does not fire on an empty inbox', () => {
    expect(noteFirstInsight({ alerts: 0 }, { scope: 'u1', now: T0 })).toBe(false);
    expect(noteFirstInsight({}, { scope: 'u1', now: T0 })).toBe(false);
    expect(track).not.toHaveBeenCalled();
    expect(localStorage.getItem(`${ACTIVATION_KEYS.insight}_u1`)).toBeNull();
  });

  it('omits the minutes it cannot know rather than sending zero', () => {
    noteFirstInsight({ alerts: 1, critical: 0 }, { scope: 'u1', now: T0 });
    expect(track).toHaveBeenCalledWith('first_insight', { alerts: 1, critical: 0 });
  });

  it('keeps one user’s insight from silencing another on the same browser', () => {
    noteFirstInsight({ alerts: 1 }, { scope: 'u1', now: T0 });
    expect(noteFirstInsight({ alerts: 2 }, { scope: 'u2', now: T0 })).toBe(true);
    expect(track).toHaveBeenCalledTimes(2);
  });

  it('only stamps the first data arrival', () => {
    expect(noteDataArrived({ scope: 'u1', now: T0 })).toBe(true);
    expect(noteDataArrived({ scope: 'u1', now: T0 + DAY })).toBe(false);
    noteFirstInsight({ alerts: 1 }, { scope: 'u1', now: T0 + DAY + 10 * MIN });
    expect(track.mock.calls[0][1].minutes_since_data).toBe(24 * 60 + 10);
  });

  it('fires nothing when storage refuses the stamp, so it can never fire twice', () => {
    vi.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    expect(() => noteFirstInsight({ alerts: 1 }, { scope: 'u1', now: T0 })).not.toThrow();
    expect(track).not.toHaveBeenCalled();
  });
});

describe('return after insight', () => {
  it('counts the first visit of a later day, not the same day, not before the insight', () => {
    expect(noteVisit({ scope: 'u1', now: T0 })).toBe(false);           // no insight yet
    noteFirstInsight({ alerts: 1 }, { scope: 'u1', now: T0 });
    expect(noteVisit({ scope: 'u1', now: T0 })).toBe(false);           // the insight day
    expect(noteVisit({ scope: 'u1', now: T0 + 3 * MIN })).toBe(false); // still that day
    expect(noteVisit({ scope: 'u1', now: T0 + 2 * DAY })).toBe(true);  // a later day
    expect(track).toHaveBeenLastCalledWith('return_after_insight', { days_since_first_insight: 2 });
    expect(noteVisit({ scope: 'u1', now: T0 + 2 * DAY + MIN })).toBe(false); // same later day
    expect(track).toHaveBeenCalledTimes(2); // first_insight + one return
  });
});

describe('recommendations', () => {
  it('acted carries kind and severity only', () => {
    expect(noteRecommendationActed('former_access', 'critical')).toBe(true);
    expect(track).toHaveBeenCalledWith('recommendation_acted', { kind: 'former_access', severity: 'critical' });
    expect(noteRecommendationActed('', 'high')).toBe(false);
  });

  it('shown fires once per session with a count per kind', () => {
    expect(noteRecommendationsShown(['orphaned_tools', 'needs_review', 'orphaned_tools'], { scope: 'u1' })).toBe(true);
    expect(track).toHaveBeenCalledWith('recommendations_shown', { total: 3, orphaned_tools: 2, needs_review: 1 });
    expect(noteRecommendationsShown(['orphaned_tools'], { scope: 'u1' })).toBe(false);
    expect(noteRecommendationsShown([], { scope: 'u2' })).toBe(false);
    expect(track).toHaveBeenCalledTimes(1);
  });
});

// ── The call sites, so the events cannot quietly stop firing ──────────────
//
// The functions above are only evidence if the app calls them. A refactor of
// the dashboard could drop the effect and every test here would still pass.
// These read the two call sites and pin the three facts the KPI document
// relies on: the dashboard fires the notes from an effect, it skips demo
// data, and the import event carries the record count.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('the call sites', () => {
  /* eslint-disable-next-line security/detect-non-literal-fs-filename --
     the two paths are literals in this file, not user input */
  const src = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

  it('the dashboard notes first insight, visits and shown recommendations from one effect, never in demo', () => {
    const page = src('src/pages/DashboardPage.jsx');
    const at = page.indexOf('noteFirstInsight(');
    expect(at, 'DashboardPage no longer calls noteFirstInsight').toBeGreaterThan(-1);
    const effect = page.slice(page.lastIndexOf('useEffect(', at), at);
    expect(effect, 'the demo guard must sit in the same effect, before the note').toMatch(/is_demo\) return;/);
    const body = page.slice(at, at + 400);
    expect(body).toMatch(/noteVisit\(/);
    expect(body).toMatch(/noteRecommendationsShown\(derived\.alerts\.map\(a => a\.id\)/);
  });

  it('every action-inbox item carries a kind and every action path notes it', () => {
    const page = src('src/pages/DashboardPage.jsx');
    const inbox = page.slice(page.indexOf('ROW 3: Action Inbox'), page.indexOf('ROW 4: Quick Actions'));
    const kinds = [...inbox.matchAll(/kind: '([a-z_]+)'/g)].map(m => m[1]);
    expect(kinds).toEqual(['former_access', 'no_owner', 'no_mfa', 'budget', 'idle_spend']);
    expect((inbox.match(/noteRecommendationActed\(item\.kind, item\.severity\)/g) || []).length,
      'assign-owner button, revoke button and the link must each note the action').toBe(3);
  });

  it('the import event carries how many records arrived, and stamps the arrival', () => {
    const hook = src('src/hooks/useDbQuery.js');
    const at = hook.indexOf("track('csv_import_completed'");
    expect(at).toBeGreaterThan(-1);
    expect(hook.slice(at, at + 160)).toMatch(/records: Array\.isArray\(vars\?\.records\) \? vars\.records\.length : undefined/);
    expect(hook.slice(at - 120, at)).toMatch(/stampArrival\(\);/);
    expect(hook).toMatch(/if \(u && !u\.is_demo\) noteDataArrived\(\{ scope: u\.uid \}\);/);
  });
});
