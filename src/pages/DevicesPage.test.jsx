import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null),
  logConsent: vi.fn(), callAI: vi.fn(),
  workspaceWrite: vi.fn().mockResolvedValue({ ok: true }), workspaceRead: vi.fn().mockResolvedValue({ data: {} }),
}));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));
vi.mock('../lib/dataUtils', async (importOriginal) => ({ ...(await importOriginal()), downloadText: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../components/AppShell', () => ({ AppShell: ({ children, right }) => <div>{right}{children}</div> }));

import { loadDb } from '../lib/db';
import { downloadText, parseCsv } from '../lib/dataUtils';
import { DevicesPage } from './DevicesPage';
import { OffboardingPage } from './OffboardingPage';

// ── The hardware register, and the device step of an offboarding ──────────

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host, root;
const buttons = () => [...document.querySelectorAll('button')];
const byText = (text) => buttons().find((b) => b.textContent.trim() === text);
const click = (el) => act(async () => { el.click(); });
const rows = () => [...document.querySelectorAll('[data-testid="device-row"]')];
const stored = () => loadDb().assets;

// React listens for the native setter, not a plain assignment.
async function type(el, value) {
  const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
    : el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  await act(async () => { el.dispatchEvent(new window.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
}

const PEOPLE = [
  { id: 'e1', full_name: 'Jane Smith', email: 'jane@co.com', status: 'active' },
  { id: 'e2', full_name: 'Tom Brown', email: 'tom@co.com', status: 'offboarding', end_date: '2099-01-10' },
];

function seed({ role = 'owner', assets } = {}) {
  localStorage.clear();
  localStorage.setItem('language', 'en');
  localStorage.setItem('accessguard_v1', JSON.stringify({
    user: { is_authenticated: true, is_demo: false, plan: 'trial', trial_started_at: Date.now(), role },
    tools: [], employees: PEOPLE, access: [], contracts: [], invoices: [], licenses: [], audit_log: [],
    assets: assets ?? [
      { id: 'a1', kind: 'laptop', name: 'MacBook Air', serial: 'C02AAA', status: 'in_use', assigned_to: 'e2', assigned_name: 'Tom Brown', assigned_email: 'tom@co.com', coverage_end: '2099-12-31' },
      { id: 'a2', kind: 'monitor', name: 'Dell U27', serial: 'CN0BBB', status: 'in_use', assigned_to: 'e1', assigned_name: 'Jane Smith', assigned_email: 'jane@co.com' },
      { id: 'a3', kind: 'phone', name: 'Old phone', serial: 'X1', status: 'in_use', assigned_to: 'gone', assigned_name: 'Ex Person', assigned_email: 'ex@co.com' },
    ],
  }));
}

async function mount(element, path = '/devices') {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[path]}>{element}</MemoryRouter></QueryClientProvider>);
  });
  // The workspace is read through a query: let it resolve.
  const loaded = () => document.querySelector('[data-testid="device-row"]')
    || document.body.textContent.includes('No devices yet')
    || document.querySelector('[data-testid="offb-devices"]');
  for (let i = 0; i < 200 && !loaded(); i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
  }
}

beforeEach(() => { window.confirm = vi.fn(() => true); });
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; });

describe('the Devices page', () => {
  it('says plainly that it records and never acts on a device', async () => {
    seed(); await mount(<DevicesPage />);
    expect(document.body.textContent).toContain('A register, not a remote control');
    expect(document.body.textContent).toContain('It does not lock, wipe, locate or install anything on a device.');
  });

  it('lists every device with its holder; one held by someone no longer listed says so', async () => {
    seed(); await mount(<DevicesPage />);
    expect(rows()).toHaveLength(3);
    const old = rows().find((r) => r.textContent.includes('Old phone'));
    expect(old.textContent).toContain('Ex Person');
    expect(old.textContent).toContain('not in the people list');
  });

  it('asks for the leaver\'s device back, and marking it returned records it in stock with the day', async () => {
    seed(); await mount(<DevicesPage />);
    expect(document.body.textContent).toContain('1 device(s) to get back');
    await click(byText('Mark returned'));
    const a1 = stored().find((a) => a.id === 'a1');
    expect(a1).toMatchObject({ status: 'in_stock', assigned_to: '', assigned_email: '' });
    expect(a1.returned_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(loadDb().audit_log.some((e) => e.action === 'asset.returned' && e.details.includes('MacBook Air'))).toBe(true);
    expect(document.body.textContent).not.toContain('device(s) to get back');
  });

  it('adds a device handed to someone', async () => {
    seed({ assets: [] }); await mount(<DevicesPage />);
    expect(document.body.textContent).toContain('No devices yet');
    await click(byText('Add a device'));
    const dialog = document.querySelector('[role="dialog"]');
    await type(dialog.querySelector('input'), 'ThinkPad T14');
    await type(dialog.querySelectorAll('select')[1], 'e1');
    await click(byText('Save'));
    expect(stored()).toHaveLength(1);
    expect(stored()[0]).toMatchObject({ name: 'ThinkPad T14', kind: 'laptop', status: 'in_use', assigned_to: 'e1', assigned_name: 'Jane Smith' });
    expect(loadDb().audit_log.some((e) => e.action === 'asset.created')).toBe(true);
  });

  it('refuses a device with neither name nor serial', async () => {
    seed({ assets: [] }); await mount(<DevicesPage />);
    await click(byText('Add a device'));
    await click(byText('Save'));
    expect(stored()).toEqual([]);
  });

  it('imports a CSV, and a serial already there updates that device', async () => {
    seed(); await mount(<DevicesPage />);
    await click(byText('Import CSV'));
    const area = document.querySelector('[role="dialog"] textarea');
    await type(area, 'name,serial,assigned_email,coverage_end\nPixel 8,GA0NEW,jane@co.com,2027-01-01\n,C02AAA,,2030-06-30\n');
    expect(document.querySelector('[data-testid="device-import-preview"]').textContent).toContain('2 device(s) ready to import.');
    await click(byText('Import 2 device(s)'));
    expect(stored()).toHaveLength(4);
    expect(stored().find((a) => a.serial === 'GA0NEW')).toMatchObject({ assigned_to: 'e1', status: 'in_use' });
    // Only the end date changed on the MacBook; it is still with Tom.
    expect(stored().find((a) => a.id === 'a1')).toMatchObject({ coverage_end: '2030-06-30', assigned_to: 'e2', name: 'MacBook Air' });
  });

  it('a viewer reads the register but has no buttons to change it', async () => {
    seed({ role: 'viewer' }); await mount(<DevicesPage />);
    expect(rows()).toHaveLength(3);
    expect(byText('Add a device')).toBeUndefined();
    expect(byText('Import CSV')).toBeUndefined();
    expect(byText('Mark returned')).toBeUndefined();
  });

  it('anyone who reads the register can export it, and the file holds every device', async () => {
    seed({ role: 'viewer' }); await mount(<DevicesPage />);
    await click(byText('Export CSV'));
    const [filename, text] = downloadText.mock.calls.at(-1);
    expect(filename).toMatch(/^stacklens_devices_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(parseCsv(text).map((r) => r.serial).sort()).toEqual(stored().map((a) => a.serial).sort());
  });

  it('no export button while the register is empty', async () => {
    seed({ assets: [] }); await mount(<DevicesPage />);
    expect(byText('Export CSV')).toBeUndefined();
  });
});

describe('the Offboarding page asks for the devices back', () => {
  it('lists what the leaver holds and records the return', async () => {
    seed();
    await mount(<OffboardingPage />, '/offboarding?employee=e2');
    for (let i = 0; i < 20 && !document.querySelector('[data-testid="offb-devices"]'); i++) {
      await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    }
    const block = document.querySelector('[data-testid="offb-devices"]');
    expect(block.textContent).toContain('Devices to get back (1)');
    expect(block.textContent).toContain('MacBook Air');
    expect(block.textContent).not.toContain('Dell U27');
    await click([...block.querySelectorAll('button')].find((b) => b.textContent.includes('Mark returned')));
    expect(stored().find((a) => a.id === 'a1').status).toBe('in_stock');
    for (let i = 0; i < 200 && document.querySelector('[data-testid="offb-devices"]'); i++) {
      await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    }
    expect(document.querySelector('[data-testid="offb-devices"]')).toBeNull();
  });

  it('shows nothing about devices for someone who holds none', async () => {
    seed({ assets: [] });
    await mount(<OffboardingPage />, '/offboarding?employee=e2');
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(document.querySelector('[data-testid="offb-devices"]')).toBeNull();
  });
});
