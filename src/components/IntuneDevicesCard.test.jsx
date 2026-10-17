import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null),
  logConsent: vi.fn(), callAI: vi.fn(),
  workspaceWrite: vi.fn().mockResolvedValue({ ok: true }), workspaceRead: vi.fn().mockResolvedValue({ data: {} }),
}));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { loadDb, saveDb } from '../lib/db';
import { translations } from '../translations';
import { IntuneDevicesCard } from './IntuneDevicesCard';

// ── Devices → Microsoft Intune, with Microsoft stood in for ────────────────

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const t = (k) => translations.en[k] ?? k;
let root, host;
const byText = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));
const click = (el) => act(async () => { el.click(); });

const PEOPLE = [
  { id: 'ana', full_name: 'Ana Silva', email: 'ana@acme.fr', status: 'active' },
  { id: 'ben', full_name: 'Ben Roy', email: 'ben@acme.fr', status: 'active' },
];
const RAW = [
  { id: 'dev-1', manufacturer: 'Lenovo', model: 'ThinkPad T14', serialNumber: 'PF4ABC', operatingSystem: 'Windows', userPrincipalName: 'ana@acme.fr', complianceState: 'noncompliant', isEncrypted: false, lastSyncDateTime: '2026-10-15T08:00:00Z' },
  { id: 'dev-2', model: 'iPhone 15', serialNumber: 'F2L1', operatingSystem: 'iOS', userPrincipalName: 'ben@acme.fr', complianceState: 'compliant', isEncrypted: true },
];

function seed(extra = {}) {
  localStorage.clear();
  localStorage.setItem('language', 'en');
  saveDb({
    user: { is_authenticated: true, is_demo: false, plan: 'trial', trial_started_at: Date.now() },
    tools: [], access: [], contracts: [], invoices: [], licenses: [], audit_log: [], employees: PEOPLE,
    assets: [{ id: 'a1', kind: 'laptop', name: 'My ThinkPad', serial: 'PF4-ABC', status: 'in_use', assigned_to: 'ben', assigned_name: 'Ben Roy', assigned_email: 'ben@acme.fr' }],
    ...extra,
  });
}

function Harness({ deps, canEdit = true }) {
  const db = loadDb();
  return <IntuneDevicesCard db={db} canEdit={canEdit} t={t} deps={deps} />;
}

async function mount(deps, canEdit) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<QueryClientProvider client={new QueryClient()}><Harness deps={deps} canEdit={canEdit} /></QueryClientProvider>); });
}

afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; });

describe('reading the devices from Intune', () => {
  it('reads nothing until clicked, then compares with the register', async () => {
    seed();
    const deps = { token: vi.fn(async () => 'tok'), read: vi.fn(async () => RAW) };
    await mount(deps);
    expect(deps.read).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="itn-readonly"]').textContent).toContain('It never locks, wipes, retires or sends anything to a device');
    await click(byText('Read the devices from Intune'));
    expect(deps.read).toHaveBeenCalledWith('tok');
    expect(document.querySelector('[data-testid="itn-summary"]').textContent).toBe('Intune lists 2 device(s): 1 not in the register yet, 1 already in it.');
    // The ThinkPad is with Ben in the register, with Ana in Intune.
    expect(document.querySelector('[data-testid="itn-holder-differs"]').textContent).toContain('Intune: Ana Silva · register: Ben Roy');
  });

  it('recording adds the new device and keeps the holder already recorded', async () => {
    seed();
    const deps = { token: async () => 'tok', read: async () => RAW };
    await mount(deps);
    await click(byText('Read the devices from Intune'));
    await click(byText('Record 1 new, update 1'));
    const assets = loadDb().assets;
    expect(assets).toHaveLength(2);
    expect(assets.find((a) => a.id === 'a1')).toMatchObject({ assigned_to: 'ben', mdm: { compliance: 'noncompliant', encrypted: false, id: 'dev-1' } });
    expect(assets.find((a) => a.serial === 'F2L1')).toMatchObject({ origin: 'intune', kind: 'phone', assigned_to: 'ben' });
    expect(loadDb().audit_log.some((e) => e.action === 'import.intune')).toBe(true);
  });

  it('the editor can take Intune\'s holder for one device', async () => {
    seed();
    const deps = { token: async () => 'tok', read: async () => RAW };
    await mount(deps);
    await click(byText('Read the devices from Intune'));
    await click(byText("Use Intune's"));
    expect(loadDb().assets.find((a) => a.id === 'a1')).toMatchObject({ assigned_to: 'ana', assigned_name: 'Ana Silva', status: 'in_use' });
  });

  it('shows Microsoft\'s refusal as it came', async () => {
    seed();
    await mount({ token: async () => 'tok', read: async () => { throw new Error('Tenant is not licensed for Intune.'); } });
    await click(byText('Read the devices from Intune'));
    expect(document.querySelector('[role="alert"]').textContent).toBe('Tenant is not licensed for Intune.');
  });

  it('a viewer sees the explanation but no button; the demo says it is not available', async () => {
    seed();
    await mount({ token: async () => 'tok', read: async () => RAW }, false);
    expect(byText('Read the devices from Intune')).toBeUndefined();
    await act(async () => root.unmount());
    seed({ user: { is_demo: true } });
    await mount({ token: async () => 'tok', read: async () => RAW });
    expect(byText('Read the devices from Intune')).toBeUndefined();
    expect(document.body.textContent).toContain('Not available in the demo');
  });
});
