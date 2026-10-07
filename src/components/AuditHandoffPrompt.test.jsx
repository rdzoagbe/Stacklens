import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null),
  logConsent: vi.fn(), callAI: vi.fn(),
  workspaceWrite: vi.fn().mockResolvedValue({ ok: true }), workspaceRead: vi.fn().mockResolvedValue({ data: {} }),
}));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
const auth = { isDemo: false };
vi.mock('../hooks/useAuth', () => ({ useAuth: () => auth }));

import toast from 'react-hot-toast';
import { track } from '../lib/analytics';
import { loadDb } from '../lib/db';
import { needsReview } from '../lib/toolReview';
import { AuditHandoffPrompt } from './AuditHandoffPrompt';

// ── After sign-up: the list from the free audit, offered, never assumed ────

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host, root;
function Where() { const l = useLocation(); return <div data-testid="where" hidden>{l.pathname}</div>; }
const here = () => document.querySelector('[data-testid="where"]').textContent;
const byText = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const click = (el) => act(async () => { el.click(); });
const listed = () => [...document.querySelectorAll('[data-testid="handoff-list"] li')].map((li) => li.textContent);

function seed({ user = {}, tools = [], handoffAgeMin = 5 } = {}) {
  localStorage.clear();
  localStorage.setItem('language', 'en');
  localStorage.setItem('accessguard_v1', JSON.stringify({
    user: { is_authenticated: true, is_demo: false, plan: 'trial', trial_started_at: Date.now(), role: 'owner', ...user },
    tools, employees: [], access: [], contracts: [], invoices: [], licenses: [], audit_log: [],
    rejected_vendors: ['qonto abonnement'],
  }));
  localStorage.setItem('stacklens_audit_handoff', JSON.stringify({
    v: 1, created_at: new Date(Date.now() - handoffAgeMin * 60_000).toISOString(),
    subscriptions: [
      { vendor: 'Slack', category: 'Communication', cadence: 'monthly', monthly: 1250, last: '2026-09-10', charges: 9, reviewed: true },
      { vendor: 'Figma', category: 'Design', cadence: 'irregular', monthly: 100, last: '2026-09-21', charges: 12, reviewed: false },
      { vendor: 'Notion', category: 'Productivity', cadence: 'monthly', monthly: 104, last: '2026-09-05', charges: 9, reviewed: false },
      { vendor: 'Qonto Abonnement', category: 'Software (unverified)', cadence: 'monthly', monthly: 29, last: '2026-09-01', charges: 9, reviewed: false },
    ],
  }));
}

async function mount() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/dashboard']}><AuditHandoffPrompt /><Where /></MemoryRouter></QueryClientProvider>);
  });
  for (let i = 0; i < 20 && !document.querySelector('[data-testid="handoff-list"]'); i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
  }
}

beforeEach(() => { auth.isDemo = false; track.mockClear(); toast.success.mockClear(); });
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; });

describe('the import offered after sign-up', () => {
  it('lists what would be added, and what is already there or was rejected here', async () => {
    seed({ tools: [{ id: 'x', name: 'Notion', cost_per_month: 104 }] });
    await mount();
    const rows = listed();
    expect(rows.some((r) => r.startsWith('Slack'))).toBe(true);
    expect(rows.some((r) => r.startsWith('Figma'))).toBe(true);
    expect(rows).toContain('Notionalready in your tools');
    expect(rows).toContain('Qonto Abonnementmarked as not software here');
    expect(byText('Import 2 tool(s)')).toBeTruthy();
  });

  it('writes nothing until Import, then only the ticked lines, and clears the list', async () => {
    seed();
    await mount();
    expect(loadDb().tools).toEqual([]);
    const figma = [...document.querySelectorAll('[data-testid="handoff-list"] li')].find((li) => li.textContent.startsWith('Figma'));
    await click(figma.querySelector('input[type=checkbox]'));
    await click(byText('Import 2 tool(s)'));
    const tools = loadDb().tools;
    expect(tools.map((t) => t.name).sort()).toEqual(['Notion', 'Slack']);
    expect(tools.find((t) => t.name === 'Slack')).toMatchObject({ origin: 'audit', reviewed: 'confirmed', cost_per_month: 1250, last_used_date: '' });
    expect(needsReview(tools.find((t) => t.name === 'Notion'))).toBe(true);
    expect(localStorage.getItem('stacklens_audit_handoff')).toBeNull();
    expect(here()).toBe('/tools');
    expect(toast.success.mock.calls[0][0]).toContain('2 tool(s) imported from the free audit');
    expect(track.mock.calls.find(([n]) => n === 'audit_handoff_imported')[1]).toEqual({ added: 2, left: 0 });
  });

  it('Ignore deletes the list and adds nothing', async () => {
    seed();
    await mount();
    await click(byText('Ignore'));
    expect(localStorage.getItem('stacklens_audit_handoff')).toBeNull();
    expect(loadDb().tools).toEqual([]);
    expect(document.querySelector('[data-testid="handoff-list"]')).toBeNull();
  });

  it('starts with the costliest ticked up to the plan\'s room, and says so before importing', async () => {
    seed({ user: { plan: 'free', trial_started_at: null }, tools: Array.from({ length: 9 }, (_, i) => ({ id: `t${i}`, name: `Tool ${i}` })) });
    await mount();
    const { getPlanLimits } = await import('../lib/plan');
    expect(getPlanLimits('free').tools, 'the free allowance this test assumes').toBe(10);
    const room = document.querySelector('[data-testid="handoff-room"]');
    expect(room.textContent).toContain('room for 1 more tool(s) and this list has 3');
    const ticked = [...document.querySelectorAll('[data-testid="handoff-list"] input')].map((i) => i.checked);
    expect(ticked).toEqual([true, false, false]);            // Slack, the costliest
    await click(byText('Import 1 tool(s)'));
    expect(loadDb().tools).toHaveLength(10);
    expect(loadDb().tools.some((t) => t.name === 'Slack')).toBe(true);
    expect(toast.success.mock.calls[0][0]).not.toContain('did not fit');
  });

  it('even if more boxes are ticked, never imports past the room', async () => {
    seed({ user: { plan: 'free', trial_started_at: null }, tools: Array.from({ length: 9 }, (_, i) => ({ id: `t${i}`, name: `Tool ${i}` })) });
    await mount();
    for (const box of [...document.querySelectorAll('[data-testid="handoff-list"] input')].filter((i) => !i.checked)) await click(box);
    await click(byText('Import 1 tool(s)'));
    expect(loadDb().tools).toHaveLength(10);
  });

  it('never in the demo, and not for an expired list', async () => {
    seed();
    auth.isDemo = true;
    await mount();
    expect(document.querySelector('[data-testid="handoff-list"]')).toBeNull();
    await act(async () => root.unmount());
    auth.isDemo = false;
    seed({ handoffAgeMin: 121 });
    await mount();
    expect(document.querySelector('[data-testid="handoff-list"]')).toBeNull();
    expect(localStorage.getItem('stacklens_audit_handoff')).toBeNull();
  });

  it('a viewer sees the list but cannot import it', async () => {
    seed({ user: { role: 'viewer' } });
    await mount();
    expect(listed().length).toBeGreaterThan(0);
    expect(byText('Import 3 tool(s)')).toBeUndefined();
  });
});
