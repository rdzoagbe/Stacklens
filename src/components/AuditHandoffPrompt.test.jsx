import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null),
  logConsent: vi.fn(), callAI: vi.fn(),
  workspaceWrite: vi.fn().mockResolvedValue({ ok: true }), workspaceRead: vi.fn().mockResolvedValue({ data: {} }),
  workspaceMine: vi.fn().mockResolvedValue({ workspaces: [] }), workspaceListOrgs: vi.fn().mockResolvedValue({ orgs: [], deleted: [], retention_days: 90 }),
  workspaceCreateOrg: vi.fn().mockResolvedValue({ org: { org_id: 'org_abc', name: 'Boulangerie Martin' } }),
}));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
const auth = { isDemo: false };
vi.mock('../hooks/useAuth', () => ({ useAuth: () => auth }));

import toast from 'react-hot-toast';
import { track } from '../lib/analytics';
import { loadDb } from '../lib/db';
import { needsReview } from '../lib/toolReview';
import { workspaceCreateOrg, workspaceRead, workspaceWrite } from '../firebase-config';
import { invalidateWorkspaceCaches } from '../hooks/useClientWorkspaces';
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

// ── An accountant's audit lands in a client workspace, not the firm's ──────

const typeInto = (input, value) => act(async () => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
});
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('into a client workspace', () => {
  beforeEach(() => { invalidateWorkspaceCaches(); auth.firebaseUser = { uid: 'u1' }; auth.user = { plan: 'cabinet' }; });
  afterEach(() => { delete auth.firebaseUser; delete auth.user; });

  it('a free account is not offered a client workspace', async () => {
    auth.user = { plan: 'free' };
    seed({ user: { plan: 'free', trial_started_at: null } });
    await mount();
    await settle();
    expect(document.querySelector('[data-testid="handoff-destination"]')).toBeNull();
  });

  it('a paid account chooses a new client, names it, and the tools go there, never into its own workspace', async () => {
    seed({ user: { plan: 'cabinet' } });
    await mount();
    await settle();
    const dest = document.querySelector('[data-testid="handoff-destination"]');
    expect(dest).not.toBeNull();
    await click(dest.querySelectorAll('input[type="radio"]')[1]);
    expect(byText('Create the client with 3 tool(s)').disabled).toBe(true);     // no name yet
    await typeInto(document.getElementById('handoff-client-name'), 'Boulangerie Martin');
    await click(byText('Create the client with 3 tool(s)'));
    await settle();
    expect(workspaceCreateOrg).toHaveBeenCalledWith('Boulangerie Martin');
    expect(workspaceRead).toHaveBeenCalledWith('org_abc');
    const [orgId, payload] = workspaceWrite.mock.calls.at(-1);
    expect(orgId).toBe('org_abc');
    expect(payload.tools.map((x) => x.name).sort()).toEqual(['Figma', 'Notion', 'Slack']);
    expect(payload.tools.every((x) => x.origin === 'audit')).toBe(true);
    expect(loadDb().tools).toEqual([]);                                      // own workspace untouched
    expect(localStorage.getItem('stacklens_audit_handoff')).toBeNull();
    expect(toast.success.mock.calls[0][0]).toContain('Client workspace “Boulangerie Martin” created with 3 tool(s)');
    expect(here()).toBe('/clients');
  });

  it('a refusal from the server is shown and the list is kept', async () => {
    workspaceCreateOrg.mockRejectedValueOnce(new Error('A trial covers 3 client workspaces. Subscribe to add more.'));
    seed({ user: { plan: 'cabinet' } });
    await mount();
    await settle();
    await click(document.querySelector('[data-testid="handoff-destination"]').querySelectorAll('input[type="radio"]')[1]);
    await typeInto(document.getElementById('handoff-client-name'), 'X');
    await click(byText('Create the client with 3 tool(s)'));
    await settle();
    expect(toast.error).toHaveBeenCalledWith('A trial covers 3 client workspaces. Subscribe to add more.');
    expect(localStorage.getItem('stacklens_audit_handoff')).not.toBeNull();
    expect(workspaceWrite).not.toHaveBeenCalled();
  });

  it('"Into my own workspace" still imports locally and writes nothing to a client', async () => {
    seed({ user: { plan: 'cabinet' } });
    await mount();
    await settle();
    expect(document.querySelector('[data-testid="handoff-destination"] input[type="radio"]').checked).toBe(true);
    await click(byText('Import 3 tool(s)'));
    expect(loadDb().tools).toHaveLength(3);
    expect(workspaceCreateOrg).not.toHaveBeenCalled();
  });
});
