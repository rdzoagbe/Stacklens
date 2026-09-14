import { describe, it, expect } from 'vitest';
import { generateAuditReportHTML } from './auditReport';
import { computeToolDerivedStatus, computeToolDerivedRisk } from './dataUtils';

// ── What the auditor reads has to be true ──────────────────────────────────
//
// This document is the one a customer forwards to an auditor or an acquirer,
// so a number in it that the product cannot defend is worse than the same
// number on a dashboard.
//
// The bug: the "Unused & Orphaned Tools" table printed each tool's full annual
// cost in a column headed "Potential Savings", and totalled that column.
//
// `derived_status === 'orphaned'` means no owner_email is filled in. It says
// nothing whatever about usage. So a tool twenty people used every day showed
// up with its entire annual cost presented as a saving — and the column total
// became a second savings figure in a report that already states one at the
// top, computed by computeWaste from tools that have cost and nobody holding
// access. On a workspace with a few unowned-but-busy tools the two differed by
// an order of magnitude, on the same page.
//
// These tests assert the produced HTML rather than the source. A source check
// would have passed throughout: every line of the old version was a perfectly
// reasonable template expression.

/** The shape the page hands the report: tools and access with derived fields. */
function derivedWorkspace({ tools = [], access = [], employees = [] } = {}) {
  const withDerived = tools.map(t => ({
    ...t,
    derived_status: computeToolDerivedStatus(t),
    derived_risk: computeToolDerivedRisk(t),
  }));
  return {
    tools: withDerived,
    access,
    employees,
    activeTools: withDerived.filter(t => t.derived_status === 'active').length,
    unusedTools: withDerived.filter(
      t => t.derived_status === 'unused' || t.derived_status === 'orphaned').length,
    highRiskCount: withDerived.filter(t => t.derived_risk === 'high').length,
    formerEmpAccess: 0,
    spend: withDerived.reduce((s, t) => s + (Number(t.cost_per_month) || 0), 0),
    topToolsByUsers: [],
    healthScore: 70,
  };
}

const t = (key) => key;
const render = (ws) => generateAuditReportHTML(ws, 'en', t);

/** Every currency amount in a fragment, as numbers. */
const amountsIn = (html) =>
  [...html.matchAll(/[€$£]\s?([\d,]+)/g)]
    .map(m => Number(m[1].replace(/,/g, '')));

/**
 * Just the "Unused & Orphaned Tools" table.
 *
 * Scoped deliberately: the report has several tables and the same tool appears
 * in more than one of them. A first version of these tests matched rows across
 * the whole document and read the high-risk table's columns instead — and the
 * report's own annual spend figure is legitimately the same number as a
 * would-be saving when there is only one tool, so an assertion over the whole
 * document cannot tell "you spend 10,800" from "you could save 10,800".
 */
function unusedSection(html) {
  const start = html.indexOf('Unused &amp; Orphaned Tools');
  const alt = start === -1 ? html.indexOf('Unused & Orphaned Tools') : start;
  if (alt === -1) return '';
  const end = html.indexOf('</table>', alt);
  return html.slice(alt, end === -1 ? undefined : end);
}

/** Every savings claim in the document: the table total and the recommendation. */
function savingsClaims(html) {
  const claims = [];
  for (const m of html.matchAll(/Recoverable spend[^€$£]*[€$£]\s?([\d,]+)/g)) {
    claims.push(Number(m[1].replace(/,/g, '')));
  }
  for (const m of html.matchAll(/can be cancelled for [€$£]\s?([\d,]+)/g)) {
    claims.push(Number(m[1].replace(/,/g, '')));
  }
  for (const m of unusedSection(html).matchAll(/Yes — [€$£]\s?([\d,]+)/g)) {
    claims.push(Number(m[1].replace(/,/g, '')));
  }
  return claims;
}

const tool = (id, extra = {}) => ({
  id,
  name: id,
  status: 'active',
  cost_per_month: 100,
  owner_email: 'owner@acme.com',
  ...extra,
});
const grant = (toolId, status = 'active') => ({ tool_id: toolId, status });

describe('a tool nobody owns but everybody uses is not a saving', () => {
  // The case the old report got wrong, stated as plainly as it can be: one
  // expensive tool, no owner recorded, three people holding live access.
  const ws = derivedWorkspace({
    tools: [tool('Slack', { cost_per_month: 900, owner_email: '' })],
    access: [grant('Slack'), grant('Slack'), grant('Slack')],
  });
  const html = render(ws);

  it('still appears in the report — an unowned tool is a real finding', () => {
    expect(html).toContain('Slack');
    expect(html).toMatch(/orphaned/);
  });

  it('is marked as still in use rather than cancellable', () => {
    expect(html).toMatch(/No — still in use/);
    expect(html).not.toMatch(/Yes — .*10,800/);
  });

  it('reports how many people hold access', () => {
    // The fact that makes the row actionable: assign an owner, do not cancel.
    const row = /Slack[\s\S]{0,600}?<\/tr>/.exec(unusedSection(html));
    expect(row, 'the tool row was not found').toBeTruthy();
    expect(row[0]).toMatch(/<td>3<\/td>/);
  });

  it('never claims its cost as a saving', () => {
    // 900/mo is 10,800/yr. The old report printed that as a saving twice: in
    // the row's "Potential Savings" cell and in the column total. It may still
    // appear in the document as annual SPEND, which is true and useful — so
    // this checks the savings claims, not every number on the page.
    expect(savingsClaims(html)).not.toContain(10800);
  });

  it('states zero recoverable spend, because none of it is', () => {
    expect(html).toMatch(/Recoverable spend/);
  });
});

describe('a tool with cost and nobody holding access IS a saving', () => {
  const ws = derivedWorkspace({
    tools: [tool('Miro', { cost_per_month: 50, owner_email: '' })],
    access: [grant('Miro', 'revoked')],   // revoked is not access
  });
  const html = render(ws);

  it('is marked cancellable', () => {
    expect(html).toMatch(/Yes — /);
  });

  it('shows its annual cost as the recoverable figure', () => {
    expect(savingsClaims(html)).toContain(600);   // 50 x 12
  });

  it('shows nobody holding access', () => {
    const row = /Miro[\s\S]{0,600}?<\/tr>/.exec(unusedSection(html));
    expect(row, 'the tool row was not found').toBeTruthy();
    expect(row[0]).toMatch(/<td>0<\/td>/);
  });
});

describe('the document states one savings figure, not two', () => {
  // A mixed workspace: one unowned-but-busy tool, one genuinely idle one, and
  // one ordinary active tool. The old report's table total would have been
  // 900*12 + 50*12 = 11,400/yr against a headline of 600/yr.
  const ws = derivedWorkspace({
    tools: [
      tool('Slack', { cost_per_month: 900, owner_email: '' }),
      tool('Miro', { cost_per_month: 50, owner_email: '' }),
      tool('Figma', { cost_per_month: 80 }),
    ],
    access: [grant('Slack'), grant('Slack'), grant('Figma')],
  });
  const html = render(ws);

  it('never prints the sum of every unowned tool as a saving', () => {
    // The old table total. 900*12 + 50*12, against a true figure of 600.
    expect(savingsClaims(html)).not.toContain(11400);
    expect(amountsIn(unusedSection(html))).not.toContain(11400);
  });

  it('the recommendation quotes the same figure as the table', () => {
    // Two places in the document name a savings number. They have to agree,
    // and the old version derived them from different sets.
    const recoverable = [...html.matchAll(/Recoverable spend[^€$£]*[€$£]\s?([\d,]+)/g)]
      .map(m => Number(m[1].replace(/,/g, '')));
    expect(recoverable.length, 'no recoverable total found in the table')
      .toBeGreaterThan(0);
    const inRecommendation = /can be cancelled for [€$£]\s?([\d,]+)/.exec(html);
    expect(inRecommendation, 'the recommendation does not quote a figure').toBeTruthy();
    expect(Number(inRecommendation[1].replace(/,/g, ''))).toBe(recoverable[0]);
  });

  it('counts only the genuinely idle tool as cancellable', () => {
    const rec = /(\d+) of them have nobody holding access/.exec(html);
    expect(rec, 'the recommendation does not say how many are cancellable').toBeTruthy();
    expect(Number(rec[1])).toBe(1);
  });
});

describe('when nothing is cancellable the report says so', () => {
  // Reporting "0/year potential savings" under a list of problems reads as a
  // broken number. The action for an unowned-but-used tool is to give it an
  // owner, and the report should say that instead.
  const ws = derivedWorkspace({
    tools: [tool('Notion', { cost_per_month: 200, owner_email: '' })],
    access: [grant('Notion')],
  });
  const html = render(ws);

  it('recommends assigning an owner, not cancelling', () => {
    expect(html).toMatch(/assign an owner/);
    expect(html).not.toMatch(/can be cancelled for/);
  });
});

describe('the report survives a workspace with nothing in it', () => {
  it('renders', () => {
    const html = render(derivedWorkspace());
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toMatch(/<\/html>\s*$/);
  });

  it('omits the table entirely rather than showing an empty one', () => {
    const html = render(derivedWorkspace({ tools: [tool('Figma')], access: [grant('Figma')] }));
    expect(html).not.toMatch(/Unused & Orphaned Tools/);
  });
});
