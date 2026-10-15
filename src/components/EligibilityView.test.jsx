import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null), logConsent: vi.fn(),
}));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { loadDb } from '../lib/db';
import { useDbQuery, useDbMutations } from '../hooks/useDbQuery';
import { LanguageContext } from '../contexts/LangContext';
import { EligibilityView } from './EligibilityView';

// ── Access → Eligibility, as an IT lead uses it ────────────────────────────

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;

// The test drives the same mutations the app's forms and syncs use.
const handle = {};
function Host({ expose }) {
  const { data } = useDbQuery();
  const muts = useDbMutations();
  useEffect(() => { expose(muts); });
  return data ? <EligibilityView db={data} /> : null;
}

const people = [
  { id: 'ana', full_name: 'Ana Lopez', email: 'ana@acme.fr', department: 'marketing', role: 'Growth Manager', status: 'active' },
  { id: 'ben', full_name: 'Ben Roy', email: 'ben@acme.fr', department: 'engineering', role: 'Developer', status: 'active' },
  { id: 'cle', full_name: 'Cléo Petit', email: 'cleo@acme.fr', department: 'engineering', role: 'QA Lead', status: 'active' },
  { id: 'dan', full_name: 'Dan Faure', email: 'dan@acme.fr', department: 'sales', role: 'Account Executive', status: 'offboarded' },
];

async function mount({ role = 'owner', rule = null, access = [], language = 'en' } = {}) {
  localStorage.clear();
  localStorage.setItem('accessguard_v1', JSON.stringify({
    user: { is_authenticated: true, is_demo: false, plan: 'pro', role },
    employees: people,
    tools: [{ id: 'gem', name: 'Gemini', cost_per_month: 200, seats: 10, status: 'active', ...(rule ? { eligibility: rule } : {}) }],
    access, contracts: [], invoices: [], licenses: [], audit_log: [],
  }));
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<LanguageContext.Provider value={{ language, setLanguage: () => {} }}><QueryClientProvider client={new QueryClient()}><Host expose={(m) => { handle.muts = m; }} /></QueryClientProvider></LanguageContext.Provider>);
  });
  await settle();
}
const settle = async () => { for (let i = 0; i < 15; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const button = (re, scope = document) => [...scope.querySelectorAll('button')].find((b) => re.test(b.textContent.trim()));
const click = async (el) => { await act(async () => { el.click(); }); await settle(); };
const names = (testid) => [...document.querySelectorAll(`[data-testid="${testid}"] li`)].map((li) => li.textContent);
const openTool = () => click(button(/^Gemini/));

beforeEach(() => { vi.clearAllMocks(); });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; document.body.innerHTML = ''; });

describe('setting a rule', () => {
  it('a tool starts with no rule; the editor previews who it covers and saves it', async () => {
    await mount();
    expect(document.body.textContent).toContain('No rule yet');
    await click(button(/^Set a rule$/));
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain('Who should have Gemini?');
    // Departments offered are the ones active people are in: not the person who left.
    const depts = [...dialog.querySelectorAll('[data-testid="elig-departments"] label')].map((l) => l.textContent);
    expect(depts.join('|')).toMatch(/Engineering.*\(2\)/);
    expect(depts.join('|')).not.toMatch(/Sales/);
    const eng = [...dialog.querySelectorAll('[data-testid="elig-departments"] input')][0];
    await click(eng);
    expect(document.querySelector('[data-testid="elig-preview"]').textContent).toBe('2 of 3 people are eligible');
    await click(button(/^Save the rule$/));
    expect(loadDb().tools[0].eligibility).toMatchObject({ mode: 'match', departments: ['engineering'] });
    expect(document.body.textContent).toContain('2 to grant');
  });

  it('job-title words in the editor', async () => {
    await mount();
    await click(button(/^Set a rule$/));
    const input = document.getElementById('elig-titles');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'developer, growth');
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    expect(document.querySelector('[data-testid="elig-preview"]').textContent).toBe('2 of 3 people are eligible');
  });
});

describe('the two lists and what the buttons record', () => {
  const rule = { mode: 'match', departments: ['engineering'] };
  const held = (id, employee_id, extra = {}) => ({ id, tool_id: 'gem', tool_name: 'Gemini', employee_id, status: 'active', ...extra });

  it('shows who should get a licence and who holds one outside the rule, with the money', async () => {
    await mount({ rule, access: [held('a1', 'ben'), held('a2', 'ana'), held('a3', 'dan')] });
    await openTool();
    expect(names('elig-to-grant')).toHaveLength(1);
    expect(names('elig-to-grant')[0]).toContain('Cléo Petit');
    expect(names('elig-outside')).toHaveLength(1);
    expect(names('elig-outside')[0]).toContain('Ana Lopez');
    // Dan left: the Offboarding page's job, not listed here.
    expect(document.querySelector('[data-testid="elig-detail"]').textContent).not.toContain('Dan Faure');
    expect(document.body.textContent).toMatch(/About .?20.?\/month more/);
    expect(document.body.textContent).toContain('do not change anything in the tool itself');
  });

  it('"Mark as granted" records an access row, and the person leaves the list', async () => {
    await mount({ rule, access: [held('a1', 'ben')] });
    await openTool();
    await click(button(/^Mark as granted$/));
    const row = loadDb().access.find((a) => a.employee_id === 'cle');
    expect(row).toMatchObject({ tool_id: 'gem', status: 'active', origin: 'eligibility', employee_email: 'cleo@acme.fr' });
    expect(names('elig-to-grant')).toHaveLength(0);
    expect(loadDb().audit_log.some((e) => e.action === 'access.granted')).toBe(true);
  });

  it('"Not needed" keeps the person off the list without recording a licence', async () => {
    await mount({ rule, access: [held('a1', 'ben')] });
    await openTool();
    await click(button(/^Not needed$/));
    expect(loadDb().tools[0].eligibility.excluded_ids).toEqual(['cle']);
    expect(loadDb().access.some((a) => a.employee_id === 'cle')).toBe(false);
    expect(names('elig-to-grant')).toHaveLength(0);
  });

  it('"Mark as removed" revokes; "Keep as an exception" keeps the licence and the list clears', async () => {
    await mount({ rule, access: [held('a2', 'ana'), held('a4', 'cle'), held('a1', 'ben')] });
    await openTool();
    await click(button(/^Keep as an exception$/));
    expect(loadDb().access.find((a) => a.id === 'a2')).toMatchObject({ status: 'active', eligibility_exception: expect.any(Object) });
    expect(names('elig-outside')).toHaveLength(0);
    expect(document.body.textContent).toContain('1 kept as exceptions');
  });

  it('"Mark as removed" revokes the access row', async () => {
    await mount({ rule, access: [held('a2', 'ana'), held('a1', 'ben'), held('a4', 'cle')] });
    await openTool();
    await click(button(/^Mark as removed$/));
    expect(loadDb().access.find((a) => a.id === 'a2').status).toBe('revoked');
  });

  it('a viewer reads the lists and has no buttons', async () => {
    await mount({ role: 'viewer', rule, access: [held('a2', 'ana')] });
    expect(button(/^Edit the rule$/)).toBeUndefined();
    await openTool();
    expect(names('elig-to-grant')).toHaveLength(2);
    expect(button(/^Mark as granted$/)).toBeUndefined();
    expect(button(/^Mark as removed$/)).toBeUndefined();
  });

  it('reads in French', async () => {
    await mount({ rule, language: 'fr' });
    expect(document.body.textContent).toContain('Qui doit avoir chaque outil');
    expect(document.body.textContent).toContain('2 à attribuer');
  });
});

describe('joiners and movers, through the real write path', () => {
  const rule = { mode: 'match', departments: ['engineering'] };
  const changes = () => [...document.querySelectorAll('[data-testid="people-change"]')];

  it('nothing shows until somebody joins or moves', async () => {
    await mount({ rule });
    expect(document.querySelector('[data-testid="people-changes"]')).toBeNull();
  });

  it('a person moved by an edit gets a to-do: grant the new team\'s tool, then Done closes it', async () => {
    await mount({ rule });
    await act(async () => { handle.muts.updateEmployee.mutate({ id: 'ana', patch: { department: 'engineering' } }); });
    await settle();
    expect(loadDb().employees.find((e) => e.id === 'ana').people_change).toMatchObject({ kind: 'mover', from: { department: 'marketing' }, to: { department: 'engineering' } });
    expect(changes()).toHaveLength(1);
    const card = changes()[0];
    expect(card.textContent).toContain('Ana Lopez');
    expect(card.textContent).toContain('Changed role');
    expect(card.textContent).toMatch(/Marketing → Engineering/);
    expect(card.textContent).toContain('Should get Gemini');
    await click(button(/^Mark as granted$/, card));
    expect(loadDb().access.some((a) => a.employee_id === 'ana' && a.tool_id === 'gem' && a.status === 'active')).toBe(true);
    expect(changes()[0].textContent).toContain('Nothing left for the rules to ask.');
    await click(button(/^Done$/, changes()[0]));
    expect(loadDb().employees.find((e) => e.id === 'ana').people_change.done_at).toBeTruthy();
    expect(document.querySelector('[data-testid="people-changes"]')).toBeNull();
  });

  it('a joiner added by hand appears, and moving out of the rule asks to take the licence back', async () => {
    await mount({ rule, access: [{ id: 'x', tool_id: 'gem', employee_id: 'ben', status: 'active' }] });
    await act(async () => { handle.muts.createEmployee.mutate({ full_name: 'Zoé Martin', email: 'zoe@acme.fr', department: 'engineering', role: 'Dev', status: 'active' }); });
    await act(async () => { handle.muts.updateEmployee.mutate({ id: 'ben', patch: { department: 'sales' } }); });
    await settle();
    const text = changes().map((c) => c.textContent).join(' | ');
    expect(text).toMatch(/Zoé Martin.*Joined.*Should get Gemini/);
    expect(text).toMatch(/Ben Roy.*Changed role.*No longer covered for Gemini/);
  });

  it('a viewer sees the to-dos without buttons', async () => {
    await mount({ role: 'viewer', rule });
    await act(async () => { handle.muts.updateEmployee.mutate({ id: 'ana', patch: { department: 'engineering' } }); });
    await settle();
    expect(changes()).toHaveLength(1);
    expect(button(/^Mark as granted$/, changes()[0])).toBeUndefined();
    expect(button(/^Done$/, changes()[0])).toBeUndefined();
  });
});
