import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PULSE_EVENTS, cleanCampaign, pageOf, pulseField, pulseDay, pulseRows } from './pulse.js';
import { PULSE_EVENTS as BROWSER_EVENTS, campaignFrom, pulseByCampaign } from '../src/lib/pulse.js';

// ── The anonymous visit counter counts, and knows nobody ────────────────────
//
// The privacy policy says the counter keeps a daily total per page, campaign
// tag and action, and no IP address, browser details or identifier, with
// nothing stored in the browser. These tests hold the code to that sentence.

// eslint-disable-next-line security/detect-non-literal-fs-filename
const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('what the server counts', () => {
  it('a visit names its page and campaign', () => {
    expect(pulseField({ e: 'visit', c: 'nl', p: '/experts-comptables' })).toBe('visit__accountants__nl');
    expect(pulseField({ e: 'visit', p: '/audit-saas/' })).toBe('visit__audit__direct');
    expect(pulseField({ e: 'visit', c: 'fr', p: '/dashboard?x=1' })).toBe('visit__other__fr');
  });

  it('an action names its campaign only', () => {
    expect(pulseField({ e: 'audit_run', c: 'be-lu' })).toBe('audit_run__be-lu');
  });

  it('drops anything not on its lists', () => {
    expect(pulseField({ e: 'drop_table', c: 'nl' })).toBeNull();
    expect(pulseField(null)).toBeNull();
    expect(pulseField('visit')).toBeNull();
    expect(cleanCampaign('<script>')).toBe('direct');
    expect(cleanCampaign('a'.repeat(25))).toBe('direct');
    expect(cleanCampaign('a__b')).toBe('direct');
    expect(cleanCampaign('NL')).toBe('nl');
    expect(pageOf('/unknown')).toBe('other');
  });

  it('files counts by UTC day and reads them back as rows', () => {
    expect(pulseDay(new Date('2026-11-12T23:30:00Z'))).toBe('2026-11-12');
    const rows = pulseRows([{ day: '2026-11-12', counts: { visit__home__nl: 3, audit_run__nl: 1 } }]);
    expect(rows).toContainEqual({ day: '2026-11-12', event: 'visit', page: 'home', campaign: 'nl', count: 3 });
    expect(rows).toContainEqual({ day: '2026-11-12', event: 'audit_run', page: '', campaign: 'nl', count: 1 });
  });
});

describe('the browser and the server agree', () => {
  it('on the events', () => {
    expect([...BROWSER_EVENTS].sort()).toEqual([...PULSE_EVENTS].sort());
  });

  it('on what a campaign tag may be', () => {
    expect(campaignFrom('?c=NL')).toBe('nl');
    expect(campaignFrom('?utm_campaign=uk-ie')).toBe('uk-ie');
    expect(campaignFrom('?c=bad tag')).toBe('');
    expect(campaignFrom('?c=a__b')).toBe('');
  });
});

describe('the endpoint keeps nothing about the sender', () => {
  const src = read('functions/index.js');
  const start = src.indexOf('exports.pulse = onRequest');
  const body = src.slice(start, src.indexOf('\nexports.', start + 1));

  it('reads no address, header or identity', () => {
    expect(start).toBeGreaterThan(-1);
    expect(body).not.toMatch(/req\.(ip|ips|headers|get\(|socket|connection)/);
    expect(body).not.toMatch(/verifyAuth|uid/);
  });

  it('writes only an increment to the day', () => {
    expect(body).toMatch(/collection\('pulse_counts'\)\.doc\(pulseDay\(\)\)/);
    expect(body).toMatch(/FieldValue\.increment\(1\)/);
    expect(body).not.toMatch(/\.add\(/);
  });

  it('is closed to every browser in the rules', () => {
    const rules = read('firestore.rules');
    expect(rules).not.toMatch(/pulse_counts/);
    expect(rules).toMatch(/match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
  });
});

describe('the browser half stores nothing and sends no params', () => {
  const mod = read('src/lib/pulse.js');
  const analytics = read('src/lib/analytics.js');

  it('uses no cookie or storage', () => {
    expect(mod).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
  });

  it('sends only the event, the campaign and a page', () => {
    expect(mod).toMatch(/JSON\.stringify\(\{ e: event, c: campaign, \.\.\.\(page \? \{ p: page \} : \{\}\) \}\)/);
    expect(analytics).toMatch(/pulse\(event\);/);
    expect(analytics).not.toMatch(/pulse\(event, params/);
  });

  it('runs on the live site only', () => {
    expect(mod).toMatch(/LIVE_HOSTS = \['stacklens\.fr', 'www\.stacklens\.fr'\]/);
  });
});

describe('the founder screen', () => {
  it('adds up each campaign over thirty days', () => {
    const rows = [
      { day: '2026-11-12', event: 'visit', page: 'home', campaign: 'nl', count: 3 },
      { day: '2026-11-11', event: 'visit', page: 'audit', campaign: 'nl', count: 2 },
      { day: '2026-11-11', event: 'audit_portfolio_run', page: '', campaign: 'nl', count: 1 },
      { day: '2026-11-11', event: 'audit_run', page: '', campaign: 'nl', count: 1 },
      { day: '2026-09-01', event: 'visit', page: 'home', campaign: 'old', count: 9 },
    ];
    const [nl, ...rest] = pulseByCampaign(rows, 30, new Date('2026-11-12T12:00:00Z'));
    expect(rest).toEqual([]);
    expect(nl.visit).toBe(5);
    expect(nl.audit_run).toBe(2);
    expect(nl.pages).toEqual({ home: 3, audit: 2 });
  });
});
