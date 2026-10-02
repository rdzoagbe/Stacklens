import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../firebase-config', () => ({ callAI: vi.fn() }));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));
vi.mock('../lib/contact', () => ({ submitContactForm: vi.fn(), mailtoFallback: vi.fn() }));

import { track } from '../lib/analytics';
import { submitContactForm, mailtoFallback } from '../lib/contact';
import { AccountantsPage } from './AccountantsPage';
import { EARLY_ACCESS } from '../lib/earlyAccess';
import { CLIENT_WORKSPACE_LIMIT } from '../lib/plan';

// ── Applying for early access ──────────────────────────────────────────────
//
// The form has one job: get a firm's application to the founder. It must not
// send until the firm has said who they are and agreed to be contacted, it
// must fall back to the visitor's own mail app if the form provider fails,
// and analytics must hear a bucket and a role, never a name or an email.

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host, root;
const type = (el, v) => act(async () => {
  const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
    : el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  el.dispatchEvent(new window.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
});
const section = () => document.getElementById('acces-anticipe');
const submitButton = () => section().querySelector('button[type="submit"]');

async function fill({ consent = true } = {}) {
  const [name, email, firm] = section().querySelectorAll('input:not([type="checkbox"])');
  const [clients, role] = section().querySelectorAll('select');
  await type(name, 'Claire Martin');
  await type(email, 'claire@cabinet-martin.fr');
  await type(firm, 'Cabinet Martin');
  await type(clients, '20-50');
  await type(role, 'expert_comptable');
  if (consent) await act(async () => { section().querySelector('input[type="checkbox"]').click(); });
}

beforeEach(async () => {
  track.mockClear(); submitContactForm.mockReset(); mailtoFallback.mockReset();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<MemoryRouter><AccountantsPage /></MemoryRouter>); });
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = '';
});

describe('the size question', () => {
  it('ends its buckets at the plan cap, and says so past it', async () => {
    const clients = section().querySelectorAll('select')[0];
    const values = [...clients.options].map((o) => o.value);
    expect(values).toEqual(['', '<20', `20-${CLIENT_WORKSPACE_LIMIT}`, `>${CLIENT_WORKSPACE_LIMIT}`]);
    expect(section().querySelector('[data-testid="ea-over-cap"]')).toBeNull();
    await type(clients, `>${CLIENT_WORKSPACE_LIMIT}`);
    expect(section().querySelector('[data-testid="ea-over-cap"]').textContent).toContain(`up to ${CLIENT_WORKSPACE_LIMIT} client workspaces`);
  });
});

describe('the early-access offer', () => {
  it('states the numbers the grant actually gives', () => {
    const text = section().textContent;
    expect(text).toContain(`${EARLY_ACCESS.SPOTS} accounting firms`);
    expect(text).toContain(`${EARLY_ACCESS.MONTHS} months of Pro free`);
    expect(text).toContain(`${EARLY_ACCESS.CALLS} conversations of ${EARLY_ACCESS.CALL_MINUTES} minutes`);
    expect(text).toContain('moves to the free plan');
    expect(text).toContain('No card');
  });

  it('will not send until the form is complete and consent is given', async () => {
    expect(submitButton().disabled).toBe(true);
    await fill({ consent: false });
    expect(submitButton().disabled).toBe(true);
    await act(async () => { section().querySelector('input[type="checkbox"]').click(); });
    expect(submitButton().disabled).toBe(false);
  });

  it('sends the application to the founder and says so', async () => {
    submitContactForm.mockResolvedValue(undefined);
    await fill();
    await act(async () => { submitButton().click(); });
    expect(submitContactForm).toHaveBeenCalledTimes(1);
    const payload = submitContactForm.mock.calls[0][0];
    expect(payload).toMatchObject({ name: 'Claire Martin', email: 'claire@cabinet-martin.fr', subject: 'early-access' });
    expect(payload.message).toContain('Firm: Cabinet Martin');
    expect(section().textContent).toContain('Thank you, it has arrived');
  });

  it('falls back to the visitor\'s own mail app if the form provider fails', async () => {
    submitContactForm.mockRejectedValue(new Error('down'));
    await fill();
    await act(async () => { submitButton().click(); });
    expect(mailtoFallback).toHaveBeenCalledTimes(1);
    expect(mailtoFallback.mock.calls[0][0].message).toContain('Cabinet Martin');
  });

  it('tells analytics a bucket and a role, never who applied', async () => {
    submitContactForm.mockResolvedValue(undefined);
    await fill();
    await act(async () => { submitButton().click(); });
    const [, params] = track.mock.calls.find(([name]) => name === 'early_access_applied');
    expect(params).toEqual({ clients: '20-50', role: 'expert_comptable' });
    expect(JSON.stringify(track.mock.calls)).not.toMatch(/Claire|claire@|Cabinet Martin/);
  });
});
