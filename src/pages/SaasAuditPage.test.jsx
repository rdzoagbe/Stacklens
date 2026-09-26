import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

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
  await act(async () => { root.render(<MemoryRouter><SaasAuditPage /></MemoryRouter>); });
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
    const [firm, client] = [...document.querySelectorAll('input')];
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

  it('leaves out lines the reader said are not software', async () => {
    const first = document.querySelector('tbody tr td .font-medium').textContent;
    await click(buttons().find((b) => b.textContent.trim() === 'Not software'));
    await open();
    const printed = document.getElementById('print-report').textContent;
    expect(printed).not.toContain(first + '');
    expect(printed).toContain('1 recurring line(s) reviewed as not software are excluded.');
  });
});
