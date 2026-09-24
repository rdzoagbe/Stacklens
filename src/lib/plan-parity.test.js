import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { TRIAL_DAYS, resolvePlan, PLAN_LIMITS, TEAM_INVITE_LIMIT, CLIENT_WORKSPACE_LIMIT, TRIAL_CLIENT_WORKSPACES } from './plan';
import { MODULE_PLANS } from '../components/gates';
import { SUPPORTED_CURRENCIES } from './currency';

/* eslint-disable security/detect-non-literal-regexp --
   the pattern is built from a constant name declared in this file, not input. */

// ── The client and the server must agree about entitlements ────────────────
//
// functions/ deploys as its own npm package, so it cannot import src/lib. Every
// rule duplicated across that boundary has drifted at least once:
//
//   Trial expiry     resolvePlan() applies it; the endpoints read the raw
//                    Firestore field. Nothing ever rewrites plan from 'trial'
//                    to 'free', so an expired trial kept its allowance of
//                    client workspaces indefinitely while the customer's own
//                    screen showed the trial-expired banner.
//
//   API access       Settings > API had no gate; the endpoint required an
//                    Enterprise plan. A free user could mint a key, copy the
//                    curl example, and get 403 on every call.
//
//   Currency         Chosen in the browser and stored in localStorage, which
//                    the server cannot read, so every scheduled email
//                    hardcoded a euro sign whatever the workspace had picked.
//
// Each is now one rule with two copies that this test holds together.

const require_ = createRequire(import.meta.url);
const server = require_('../../functions/workspace-write.js');
const functionsSource = readFileSync(
  resolve(process.cwd(), 'functions/index.js'), 'utf8'
);

/** A Set literal in functions/index.js, e.g. API_PLANS. */
function serverSet(name) {
  const m = new RegExp(`const ${name} = new Set\\(\\[([^\\]]*)\\]\\)`).exec(functionsSource);
  if (!m) return null;
  return m[1].split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

describe('the trial expires on both sides', () => {
  it('both packages use the same trial length', () => {
    expect(server.TRIAL_DAYS,
      'functions/workspace-write.js and src/lib/plan.js disagree on how long a ' +
      'trial lasts, so the server and the browser will expire it on different days.'
    ).toBe(TRIAL_DAYS);
  });

  it('agree that a fresh trial is a trial', () => {
    const startedAt = Date.now() - 2 * 24 * 60 * 60 * 1000;
    expect(server.effectivePlan({ plan: 'trial', trial_started_at: startedAt })).toBe('trial');
    expect(resolvePlan({ plan: 'trial', trial_started_at: startedAt })).toBe('trial');
  });

  it('agree that an expired trial is free', () => {
    const startedAt = Date.now() - (TRIAL_DAYS + 2) * 24 * 60 * 60 * 1000;
    expect(server.effectivePlan({ plan: 'trial', trial_started_at: startedAt })).toBe('free');
    expect(resolvePlan({ plan: 'trial', trial_started_at: startedAt })).toBe('free');
  });

  it('agree that a trial with no start date is invalid', () => {
    expect(server.effectivePlan({ plan: 'trial' })).toBe('free');
    expect(resolvePlan({ plan: 'trial' })).toBe('free');
  });

  it('the server reads a Firestore Timestamp, not just a number', () => {
    // trial_started_at is written with serverTimestamp(), so it comes back as
    // a Timestamp object. Date.now() - {seconds,nanoseconds} is NaN, and
    // NaN < TRIAL_MS is false — which would silently expire every live trial.
    const ms = Date.now() - 2 * 24 * 60 * 60 * 1000;
    for (const stamp of [
      { toMillis: () => ms },
      { toDate: () => new Date(ms) },
      { seconds: Math.floor(ms / 1000), nanoseconds: 0 },
      new Date(ms).toISOString(),
    ]) {
      expect(server.effectivePlan({ plan: 'trial', trial_started_at: stamp })).toBe('trial');
    }
  });
});

describe('API access is gated the same way in both places', () => {
  it('the client gate matches what the endpoint enforces', () => {
    const serverPlans = serverSet('API_PLANS');
    expect(serverPlans, 'API_PLANS not found in functions/index.js').toBeTruthy();
    // ModuleGate admits any trial on top of its list, so the server has to
    // accept one too or the tab is offering something the API refuses.
    const clientAllows = [...MODULE_PLANS.api, 'trial'].sort();
    expect(serverPlans.slice().sort(),
      'Settings > API is gated on a different plan list than the endpoint ' +
      'enforces, so the tab either offers a key the API will refuse or hides ' +
      'one it would accept.').toEqual(clientAllows);
  });
});

describe('the server can render the workspace currency', () => {
  it('knows every currency the app offers', () => {
    const codes = SUPPORTED_CURRENCIES.map(c => c.code).sort();
    expect(Object.keys(server.CURRENCY_SYMBOLS).sort(),
      'A currency the user can pick has no symbol on the server, so scheduled ' +
      'emails would fall back to euros for it.').toEqual(codes);
  });

  it('uses the same symbol the app shows', () => {
    for (const { code, symbol } of SUPPORTED_CURRENCIES) {
      expect(server.currencySymbol({ user: { currency: code } }),
        `The server renders ${code} differently from the app.`).toBe(symbol);
    }
  });

  it('falls back rather than printing an empty symbol', () => {
    for (const bad of [undefined, {}, { user: {} }, { user: { currency: 'JPY' } }]) {
      expect(server.currencySymbol(bad)).toBe('€');
    }
  });
});

describe('sharing and client-workspace caps are the ones the server enforces', () => {
  /** A numeric constant in functions/index.js, e.g. MAX_WORKSPACE_MEMBERS. */
  function serverNumber(name) {
    const m = new RegExp(`const ${name} = (\\d+);`).exec(functionsSource);
    expect(m, `${name} not found in functions/index.js — if it was renamed, ` +
      'update this guard rather than deleting it').toBeTruthy();
    return Number(m[1]);
  }

  it('the invite cap on the plan cards is the server cap', () => {
    expect(TEAM_INVITE_LIMIT).toBe(serverNumber('MAX_WORKSPACE_MEMBERS'));
  });

  it('the client-workspace caps on the plan cards are the server caps', () => {
    expect(CLIENT_WORKSPACE_LIMIT).toBe(serverNumber('MAX_CLIENT_ORGS'));
    expect(TRIAL_CLIENT_WORKSPACES).toBe(serverNumber('TRIAL_CLIENT_ORGS'));
  });

  it('free and trial cannot invite anyone, and the server says the same', () => {
    expect(PLAN_LIMITS.free.teamInvites).toBe(0);
    expect(PLAN_LIMITS.trial.teamInvites).toBe(0);
    expect(functionsSource).toMatch(/\['free', 'trial'\]\.includes\(plan\)[\s\S]{0,120}Team sharing requires a paid plan/);
    for (const id of ['starter', 'hr_finance', 'pro', 'enterprise']) {
      expect(PLAN_LIMITS[id].teamInvites, id).toBe(TEAM_INVITE_LIMIT);
    }
  });

  it('Starter can open the People pages its card sells', () => {
    expect(MODULE_PLANS.people).toContain('starter');
  });
});
