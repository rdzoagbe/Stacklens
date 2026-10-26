import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null), logConsent: vi.fn(),
}));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { loadDb } from '../lib/db';
import { useDbQuery } from '../hooks/useDbQuery';
import { LanguageContext } from '../contexts/LangContext';
import { AccessReviewsView } from './AccessReviewsView';

// ── Access → Reviews, as an IT lead runs one ───────────────────────────────

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;

function Host() {
  const { data } = useDbQuery();
  return data ? <AccessReviewsView db={data} /> : null;
}

const people = [
  { id: 'ana', full_name: 'Ana Lopez', email: 'ana@acme.fr', department: 'sales', status: 'active' },
  { id: 'ben', full_name: 'Ben Roy', email: 'ben@acme.fr', department: 'engineering', status: 'active' },
  { id: 'dan', full_name: 'Dan Faure', email: 'dan@acme.fr', department: 'sales', status: 'offboarded' },
];
const access = [
  { id: 'a1', employee_id: 'ana', tool_id: 'slack', access_level: 'viewer', status: 'active' },
  { id: 'a2', employee_id: 'ben', tool_id: 'gh', access_level: 'admin', status: 'active' },
  { id: 'a4', employee_id: 'dan', tool_id: 'slack', access_level: 'viewer', status: 'active' },
];

async function mount({ role = 'owner', language = 'en', reviews = [] } = {}) {
  localStorage.clear();
  localStorage.setItem('accessguard_v1', JSON.stringify({
    user: { is_authenticated: true, is_demo: false, plan: 'pro', role, email: 'claire@acme.fr', displayName: 'Claire Martin', company: 'Acme' },
    employees: people, tools: [{ id: 'slack', name: 'Slack', status: 'active', owner_email: 'it@acme.fr' }, { id: 'gh', name: 'GitHub', status: 'active', owner_email: 'it@acme.fr' }],
    access, access_reviews: reviews, contracts: [], invoices: [], licenses: [], audit_log: [],
  }));
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<LanguageContext.Provider value={{ language, setLanguage: () => {} }}><QueryClientProvider client={new QueryClient()}><Host /></QueryClientProvider></LanguageContext.Provider>);
  });
  await settle();
}
const settle = async () => { for (let i = 0; i < 15; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const button = (re, scope = document) => [...scope.querySelectorAll('button')].find((b) => re.test(b.textContent.trim()));
const click = async (el) => { await act(async () => { el.click(); }); await settle(); };
const box = (id) => document.querySelector(`[data-testid="${id}"]`);
const rows = () => [...document.querySelectorAll('[data-testid="review-rows"] tr')];
const choose = async (select, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(select, value);
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  await settle();
};

beforeEach(() => { vi.clearAllMocks(); });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; document.body.innerHTML = ''; document.body.className = ''; });

describe('running a review', () => {
  it('starts over one tool, lists its accesses, and the start form is gone while one is open', async () => {
    await mount();
    expect(box('review-open')).toBeNull();
    await choose(box('review-start').querySelector('select'), 'tool');
    await choose(box('review-target'), 'gh');
    await click(button(/^Start a review of 1 access/));
    expect(box('review-open').textContent).toContain('Review: GitHub');
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain('Ben Roy');
    expect(box('review-start')).toBeNull();
    expect(loadDb().access_reviews[0]).toMatchObject({ scope: 'tool', target: 'gh', started_by: 'claire@acme.fr' });
    expect(loadDb().audit_log[0].action).toBe('access.review.started');
  });

  it('decisions are saved; Sign off waits for every line; signing applies and records the evidence', async () => {
    await mount();
    await click(button(/^Start a review of 3 access/));
    expect(button(/^Sign off$/).disabled).toBe(true);
    const dan = rows().find((r) => r.textContent.includes('Dan Faure'));
    expect(dan.textContent).toContain('Former employee');
    await click(button(/^Revoke$/, dan));
    expect(box('review-progress').textContent).toBe('1 of 3 decided');
    expect(loadDb().access_reviews[0].rows.find((r) => r.access_id === 'a4').decision).toBe('revoke');
    await click(button(/^Keep all remaining$/));
    expect(box('review-progress').textContent).toBe('3 of 3 decided');
    expect(button(/^Sign off$/).disabled).toBe(false);
    await click(button(/^Sign off$/));
    const dialog = box('review-sign-dialog');
    expect(dialog.textContent).toContain('2 access(es) kept, 1 revoked');
    expect(dialog.querySelector('input').value).toBe('Claire Martin');
    await click(button(/^Sign and apply$/));
    const db = loadDb();
    expect(db.access.find((a) => a.id === 'a4').status).toBe('revoked');
    expect(db.access.find((a) => a.id === 'a1').last_reviewed_date).toBe(new Date().toISOString().slice(0, 10));
    expect(db.access_reviews[0].signed_off.name).toBe('Claire Martin');
    expect(db.audit_log.map((e) => e.action)).toEqual(expect.arrayContaining(['access.review.signed', 'access.revoked']));
    // The evidence opens itself, with the attestation and the company.
    const ev = box('print-review');
    expect(ev.textContent).toContain('Reviewed and signed by Claire Martin');
    expect(ev.textContent).toContain('Acme');
    expect(ev.textContent).toContain('3 access(es) reviewed: 2 kept, 1 revoked');
    expect(document.body.classList.contains('printing-report')).toBe(true);
    expect(box('review-history').textContent).toContain('Signed reviews (1)');
    // And the start form is back for the next one.
    expect(box('review-start')).not.toBeNull();
  });

  it('a decision can be undone before signing', async () => {
    await mount();
    await click(button(/^Start a review of 3 access/));
    const ana = rows().find((r) => r.textContent.includes('Ana Lopez'));
    await click(button(/^Keep$/, ana));
    expect(box('review-progress').textContent).toBe('1 of 3 decided');
    await click(button(/^Keep$/, rows().find((r) => r.textContent.includes('Ana Lopez'))));
    expect(box('review-progress').textContent).toBe('0 of 3 decided');
  });

  it('a viewer reads an open review and its history but has no buttons', async () => {
    const open = { id: 'r1', scope: 'all', target: '', label: '', started_at: '2026-10-20T09:00:00Z', started_by: 'x', signed_off: null,
      rows: [{ access_id: 'a1', employee_id: 'ana', employee_name: 'Ana Lopez', tool_id: 'slack', tool_name: 'Slack', access_level: 'viewer', risk: 'none', decision: 'keep' }] };
    await mount({ role: 'viewer', reviews: [open] });
    expect(box('review-open')).not.toBeNull();
    expect(button(/^Sign off$/)).toBeUndefined();
    expect(button(/^Revoke$/)).toBeUndefined();
    expect(box('review-start')).toBeNull();
    expect(rows()[0].textContent).toContain('Keep');
  });

  it('reads in French', async () => {
    await mount({ language: 'fr' });
    expect(document.body.textContent).toContain('Revues des accès');
    expect(button(/^Lancer une revue de 3 accès$/)).toBeTruthy();
  });
});
