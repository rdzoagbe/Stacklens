import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { escapeHtml } from './html-escape.js';
import {
  renewalAlertLine, budgetAlertLine, securityAlertLine, weeklyRenewalRow, insightHtml,
} from './alert-email.js';
import { deviceAlertLine } from './device-alerts.js';

// ── A name typed into a workspace must reach the owner's inbox as text ─────
//
// Tool, department and employee names come from forms, CSV imports and
// directories, and a team editor may write them into the owner's workspace.
// The daily alert and the weekly summary used to put them into the email's
// HTML as they were, so a name could carry markup and a link, in a message
// from hello@stacklens.fr. Device lines and the monthly report already
// escaped; the rest did not.

const HOSTILE = [
  '<img src=x onerror=alert(1)>',
  '"><a href="https://evil.example/login">Sign in again</a>',
  '</div><script>steal()</script>',
  "' onmouseover='x()",
];
const fmt = (n) => String(Math.round(n));

// No tag, and no quote that could close an attribute, survives.
const inert = (html) => !/[<>"']/.test(html.replace(/<\/?(?:tr|td)[^>]*>/g, '').replace(/style="[^"]*"/g, ''));

describe('escapeHtml', () => {
  it('turns the five characters that matter into entities, and nothing into text "undefined"', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });
});

describe.each(HOSTILE)('the daily email lines, for the name %s', (bad) => {
  it('renewal: name and date', () => {
    const [title, detail] = renewalAlertLine({ name: bad, date: bad, days: 3, annual: 1200 }, '€', fmt);
    expect(inert(title)).toBe(true);
    expect(inert(detail)).toBe(true);
    expect(detail).toContain('€1200/yr');
  });
  it('budget: department', () => {
    const [title, detail] = budgetAlertLine({ department: bad, pct: 90, spent: 900, budget: 1000 }, '€', fmt);
    expect(inert(title)).toBe(true);
    expect(detail).toBe('90% of annual budget consumed (€900 of €1000)');
  });
  it('security: employee name', () => {
    const [title] = securityAlertLine({ name: bad, count: 2 });
    expect(inert(title)).toBe(true);
  });
  it('device lines stay escaped once, not twice', () => {
    const [title] = deviceAlertLine({ name: bad, type: 'lease', date: '2026-10-20', days: 3, holder: bad });
    expect(inert(title)).toBe(true);
    expect(title).toBe(escapeHtml(bad));
  });
});

describe('the weekly summary', () => {
  it.each(HOSTILE)('the renewals row and the AI insight are text, for %s', (bad) => {
    const row = weeklyRenewalRow({ name: bad, renewal_date: bad }, 5, bad, '#ef4444');
    expect(row.match(/<td /g)).toHaveLength(4);            // the markup is ours alone
    expect(inert(row)).toBe(true);
    expect(inert(insightHtml(bad))).toBe(true);
  });

  it('numbers and normal names read as before', () => {
    expect(weeklyRenewalRow({ name: 'Slack & Co', renewal_date: '2026-11-01' }, 12, '€1,200/yr', '#f59e0b'))
      .toContain('>Slack &amp; Co<');
    expect(renewalAlertLine({ name: 'Notion', date: '2026-10-21', days: 3, annual: 0 }, '€', fmt))
      .toEqual(['Notion', 'renews 2026-10-21 (3 days)']);
    expect(securityAlertLine({ name: 'Ana', count: 1 })[1]).toBe('no longer active but still holds 1 access grant');
  });
});

describe('index.js hands every customer-typed value to these builders', () => {
  // Reading the source is how the repository holds the other emails
  // (notifications.test.jsx): the scheduled functions cannot be run here.
  const src = readFileSync(resolve(process.cwd(), 'functions/index.js'), 'utf8');
  // From the email's markup on: the state keys above it (budget_<year>_<department>) are not HTML.
  const dailyAll = src.slice(src.indexOf('exports.dailyAlerts'), src.indexOf('exports.weeklySummary'));
  const daily = dailyAll.slice(dailyAll.indexOf('const html = `'));
  const weekly = src.slice(src.indexOf('exports.weeklySummary'), src.indexOf('exports.weeklySummary') + 9000);

  it('daily: no name, department or date is interpolated into the HTML directly', () => {
    for (const bad of ['${r.name}', '${r.date}', '${b.department}', '${s.name}', 'line(r.name', 'line(b.department', 'line(s.name']) {
      expect(daily, bad).not.toContain(bad);
    }
    expect(daily).toContain('renewalAlertLine(r, cur, fmt)');
  });

  it('weekly: no tool name, date or insight is interpolated into the HTML directly', () => {
    for (const bad of ['${t.name}', '${t.renewal_date}', '${insight}']) expect(weekly, bad).not.toContain(bad);
    expect(weekly).toContain('insightHtml(insight)');
  });
});
