import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';

vi.mock('../firebase-config', () => ({ callAI: vi.fn() }));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));

import { track } from '../lib/analytics';
import { SaasAuditPage } from './SaasAuditPage';

// ── The free audit, clicked through ────────────────────────────────────────
//
// Review a line, watch the totals move, send the corrections, print the
// client report. Two promises are checked on the way: sending corrections
// only ever opens the reader's own mail app, and analytics only ever hears
// counts.

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host, root, assign;
// Where the page has sent the reader (MemoryRouter never touches window.location).
function Where() { const l = useLocation(); return <div data-testid="where" hidden>{l.pathname + l.search}</div>; }
const here = () => document.querySelector('[data-testid="where"]').textContent;
const buttons = () => [...document.querySelectorAll('button')];
const button = (text) => buttons().find((b) => b.textContent.trim() === text);
const click = (el) => act(async () => { el.click(); });
const kpi = (label) => [...document.querySelectorAll('div')].find((d) => d.textContent === label)?.nextElementSibling?.textContent;

beforeEach(async () => {
  track.mockClear();
  assign = '';
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { get href() { return assign; }, set href(v) { assign = v; } },
  });
  window.print = vi.fn();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<MemoryRouter><SaasAuditPage /><Where /></MemoryRouter>); });
  await click(button('Try with sample data'));
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = '';
  document.body.className = '';
});

describe('reviewing lines', () => {
  it('"Not software" drops the line from the count and offers to send the correction', async () => {
    const before = Number(kpi('Subscriptions found'));
    expect(before).toBeGreaterThan(0);
    expect(button('Email my corrections')).toBeFalsy();
    await click(buttons().find((b) => b.textContent.trim() === 'Not software'));
    expect(Number(kpi('Subscriptions found'))).toBe(before - 1);
    expect(document.body.textContent).toContain('1 line(s) reviewed');
    expect(button('Email my corrections')).toBeTruthy();
  });

  it('Undo puts the line back', async () => {
    await click(buttons().find((b) => b.textContent.trim() === 'Not software'));
    await click(buttons().find((b) => b.textContent.trim() === 'Undo'));
    expect(document.body.textContent).not.toContain('line(s) reviewed');
  });

  it('sending the corrections opens a mailto and nothing else', async () => {
    await click(buttons().find((b) => b.textContent.trim() === 'Not software'));
    await click(button('Email my corrections'));
    expect(assign.startsWith('mailto:hello@stacklens.fr?subject=')).toBe(true);
    expect(decodeURIComponent(assign)).toContain('NOT SOFTWARE |');
    // Analytics hears how many, not which.
    const sent = track.mock.calls.find(([name]) => name === 'audit_review_sent');
    expect(sent[1]).toEqual({ confirmed: 0, rejected: 1, renamed: 0, added: 0 });
  });
});

describe('the client report', () => {
  const open = () => click(button('Client report (PDF)'));

  it('carries the firm and client names, and prints only while open', async () => {
    await open();
    expect(document.body.classList.contains('printing-report')).toBe(true);
    const [firm, client] = [...document.querySelectorAll('input:not([type=checkbox])')];
    const type = (el, v) => act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    await type(firm, 'Cabinet Martin');
    await type(client, 'Boulangerie Dupont');
    const printed = document.getElementById('print-report');
    expect(printed.parentElement).toBe(document.body);
    expect(printed.textContent).toContain('Cabinet Martin');
    expect(printed.textContent).toContain('Prepared for Boulangerie Dupont');
    expect(printed.textContent).toContain('stacklens.fr');
    await click(button('Print or save as PDF'));
    expect(window.print).toHaveBeenCalled();
    await click(button('Close'));
    expect(document.body.classList.contains('printing-report')).toBe(false);
    expect(document.getElementById('print-report')).toBeNull();
  });

  it('remembers the firm name on this device only when asked, and never the client', async () => {
    const type = (el, v) => act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    localStorage.clear();
    await open();
    let [firm, client] = [...document.querySelectorAll('input:not([type=checkbox])')];
    const remember = () => document.querySelector('input[type=checkbox]');
    await type(firm, 'Cabinet Martin');
    await type(client, 'Boulangerie Dupont');
    expect(localStorage.length, 'nothing kept until the box is ticked').toBe(0);
    await click(remember());
    expect(localStorage.getItem('stacklens_audit_firm')).toBe('Cabinet Martin');
    await type(firm, 'Cabinet Martin & Associés');
    expect(localStorage.getItem('stacklens_audit_firm')).toBe('Cabinet Martin & Associés');
    expect(JSON.stringify({ ...localStorage })).not.toContain('Boulangerie');

    // Closed and reopened: the firm is back, the client is not.
    await click(button('Close'));
    await open();
    [firm, client] = [...document.querySelectorAll('input:not([type=checkbox])')];
    expect(firm.value).toBe('Cabinet Martin & Associés');
    expect(client.value).toBe('');
    expect(remember().checked).toBe(true);

    await click(remember());
    expect(localStorage.getItem('stacklens_audit_firm')).toBeNull();
  });

  it('leaves out lines the reader said are not software', async () => {
    const first = document.querySelector('tbody tr td .font-medium').textContent;
    await click(buttons().find((b) => b.textContent.trim() === 'Not software'));
    await open();
    const printed = document.getElementById('print-report').textContent;
    expect(printed).not.toContain(first + '');
    expect(printed).toContain('1 recurring line(s) reviewed as not software are excluded.');
  });
});

describe('creating a workspace from the results', () => {
  it('keeps nothing until the click, then the list only, and opens the sign-up', async () => {
    localStorage.clear();
    // Reviewing, opening the report, typing: none of it stores anything.
    await click(buttons().find((b) => b.textContent.trim() === 'Not software'));
    expect(localStorage.length).toBe(0);
    const card = document.querySelector('[data-testid="audit-handoff"]');
    const n = Number(kpi('Subscriptions found'));
    const btn = [...card.querySelectorAll('button')][0];
    expect(btn.textContent).toContain(`Create my workspace with these ${n} subscriptions`);
    expect(card.textContent).toContain('in this browser for 2 hours');
    await click(btn);
    const kept = JSON.parse(localStorage.getItem('stacklens_audit_handoff'));
    expect(kept.subscriptions).toHaveLength(n);
    expect(Object.keys({ ...localStorage })).toEqual(['stacklens_audit_handoff']);
    expect(here()).toBe('/?signup=true');
    const started = track.mock.calls.find(([name]) => name === 'audit_handoff_started');
    expect(started[1]).toEqual({ count: n });
  });
});

describe('several clients at once', () => {
  const rows = () => [...document.querySelectorAll('[data-testid="pf-row"]')];
  const openSample = async () => {
    await click(button('Audit another file'));
    await click(button('Try with 3 sample clients'));
  };

  it('shows one row per client, the portfolio total, and counts only to analytics', async () => {
    await openSample();
    expect(document.body.textContent).toContain('Portfolio: 3 client(s)');
    expect(rows().map((r) => r.querySelector('td').textContent)).toEqual(['Boulangerie Dupont', 'Atelier Martin Architectes', 'Studio Lumière']);
    expect(document.body.textContent).toContain('Clients with points to check');
    const run = track.mock.calls.find(([n]) => n === 'audit_portfolio_run');
    expect(run[1]).toEqual({ source: 'sample', clients: 3, failed: 0, dropped: 0 });
  });

  it("opens a client's full report, with the name on the client report, and comes back", async () => {
    await openSample();
    await click([...rows()[1].querySelectorAll('button')].find((b) => b.textContent.includes('Report')));
    expect(document.body.textContent).toContain('Atelier Martin Architectes');
    expect(document.body.textContent).toContain('FEC');
    await click(button('Client report (PDF)'));
    const [, client] = [...document.querySelectorAll('input:not([type=checkbox])')];
    expect(client.value).toBe('Atelier Martin Architectes');
    // A client's subscriptions are not offered for import into the accountant's own workspace.
    expect(document.querySelector('[data-testid="audit-handoff"]')).toBeNull();
    await click(document.querySelector('[data-testid="pf-back"]'));
    expect(rows()).toHaveLength(3);
  });

  it("a client's review is kept when coming back, and changes its row", async () => {
    await openSample();
    const subsOf = () => Number(rows().find((r) => r.querySelector('td').textContent === 'Boulangerie Dupont').querySelectorAll('td')[2].textContent);
    const before = subsOf();
    await click([...rows()[0].querySelectorAll('button')].find((b) => b.textContent.includes('Report')));
    await click(buttons().find((b) => b.textContent.trim() === 'Not software'));
    await click(document.querySelector('[data-testid="pf-back"]'));
    expect(subsOf()).toBe(before - 1);
    // …and reopening the client shows the review it was given. (The table
    // re-sorts by spend, so the client is found by name, not position.)
    const dupont = rows().find((r) => r.querySelector('td').textContent === 'Boulangerie Dupont');
    await click([...dupont.querySelectorAll('button')].find((b) => b.textContent.includes('Report')));
    expect(document.body.textContent).toContain('Boulangerie Dupont');
    expect(document.body.textContent).toContain('1 line(s) reviewed');
  });

  it('takes 25 files at most and says how many were left out', async () => {
    await click(button('Audit another file'));
    const text = 'Date;Libellé;Débit;Crédit\n05/01/2026;CB SLACK;10,00;\n05/02/2026;CB SLACK;10,00;\n';
    const input = document.querySelector('input[type=file]');
    Object.defineProperty(input, 'files', { configurable: true,
      value: Array.from({ length: 27 }, (_, i) => new File([text], `client-${i}.csv`, { type: 'text/csv' })) });
    await act(async () => { input.dispatchEvent(new window.Event('change', { bubbles: true })); });
    for (let i = 0; i < 40 && !document.querySelector('[data-testid="portfolio"]'); i++) {
      await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    }
    expect(rows()).toHaveLength(25);
    expect(document.querySelector('[data-testid="pf-errors"]').textContent).toContain('2 more file(s) left out: 25 at most at once.');
  });

  it('reads several dropped files, names each after its file, and says which could not be read', async () => {
    await click(button('Audit another file'));
    const file = (name, text) => new File([text], name, { type: 'text/csv' });
    const input = document.querySelector('input[type=file]');
    Object.defineProperty(input, 'files', { configurable: true, value: [
      file('boulangerie_dupont.csv', 'Date;Libellé;Débit;Crédit\n05/01/2026;CB SLACK;10,00;\n05/02/2026;CB SLACK;10,00;\n05/03/2026;CB SLACK;10,00;\n'),
      file('notes.txt', 'nothing to see\n'),
    ] });
    await act(async () => { input.dispatchEvent(new window.Event('change', { bubbles: true })); });
    for (let i = 0; i < 20 && !document.querySelector('[data-testid="portfolio"]'); i++) {
      await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    }
    expect(rows().map((r) => r.querySelector('td').textContent)).toEqual(['Boulangerie dupont']);
    expect(document.querySelector('[data-testid="pf-errors"]').textContent).toContain('notes.txt: not read');
  });

  it('a client can be renamed', async () => {
    await openSample();
    await click(rows()[0].querySelector('button[aria-label="Rename the client"]'));
    const input = rows()[0].querySelector('input');
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'Dupont & Fils');
    await act(async () => { input.form.requestSubmit(); });
    expect(rows().map((r) => r.querySelector('td').textContent)).toContain('Dupont & Fils');
  });
});

describe('a subscription that stopped', () => {
  // The sample statement's Zoom line ends in March; the file runs to June.
  it('is listed apart with its last charge, and counted nowhere else', async () => {
    const panel = document.querySelector('[data-testid="audit-stopped"]');
    expect(panel.textContent).toContain('Stopped subscriptions (1)');
    expect(panel.textContent).toContain('Zoom');
    expect(panel.textContent).toMatch(/Last charged .*2026/);
    const table = [...document.querySelectorAll('tbody tr td .font-medium')].map((td) => td.textContent);
    expect(table).not.toContain('Zoom');
  });

  it('is named in the client report as excluded from the totals', async () => {
    await click(button('Client report (PDF)'));
    expect(document.getElementById('print-report').textContent).toMatch(/Stopped, excluded from the totals: Zoom \(.*2026\)\./);
  });

  it('can still be marked as not software', async () => {
    const panel = document.querySelector('[data-testid="audit-stopped"]');
    await click([...panel.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Not software'));
    expect(document.querySelector('[data-testid="audit-stopped"]')).toBeNull();
    expect(document.body.textContent).toContain('1 line(s) reviewed');
  });
});

describe('an FEC instead of a bank statement', () => {
  it('is recognised, says how it was read, and trusts the ledger account', async () => {
    expect(button('Read them the other way'), 'the bank sample offers the flip').toBeTruthy();
    await click(button('Audit another file'));
    await click(button('Try with a sample FEC'));
    const text = document.body.textContent;
    expect(text).toContain('FEC · beta');
    expect(text).toContain('Amounts exclude VAT');
    // Dates in an FEC are unambiguous: no day/month flip to offer.
    expect(button('Read them the other way')).toBeFalsy();
    const rows = [...document.querySelectorAll('tbody tr')].map((r) => r.textContent);
    expect(rows.some((r) => r.includes('Zeendoc') && r.includes('account 6512'))).toBe(true);
    expect(rows.some((r) => /GOOGLE IRELAND|QONTO|MONDAY CAFE/.test(r))).toBe(false);
  });
});
