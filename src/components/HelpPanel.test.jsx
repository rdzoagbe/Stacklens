import { describe, it, expect, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null),
  logConsent: vi.fn(), callAI: vi.fn(),
  workspaceWrite: vi.fn().mockResolvedValue({ ok: true }), workspaceRead: vi.fn().mockResolvedValue({ data: {} }),
}));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));

import { HelpPanel } from './HelpPanel';
import { PublicMenu } from './PublicMenu';
import { translations } from '../translations';

// ── The "?" help and the public menu, on screen ─────────────────────────────

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root, host;
const click = (el) => act(async () => { el.click(); });
async function type(el, value) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, value);
  await act(async () => { el.dispatchEvent(new window.Event('input', { bubbles: true })); });
}
function Where() { const l = useLocation(); return <div data-testid="where">{l.pathname + l.search}</div>; }

async function mount(ui, path = '/dashboard') {
  localStorage.setItem('language', 'en');
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={<>{ui}<Where /></>} /></Routes></MemoryRouter>);
  });
}
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; localStorage.clear(); });

describe('the help panel', () => {
  it('opens on a list of tasks, narrows as you type, and takes you to the screen', async () => {
    await mount(<HelpPanel />);
    expect(document.querySelector('[data-testid="help-results"]')).toBeNull();
    await click(document.querySelector('[data-testid="help-button"]'));
    expect(document.querySelector('[role="dialog"]').textContent).toContain('Where to find what');
    await type(document.querySelector('[data-testid="help-search"]'), 'laptop');
    const rows = [...document.querySelectorAll('[data-testid="help-results"] a')];
    expect(rows.map((a) => a.textContent)).toEqual([`${translations.en.hf_device_add}${translations.en.nav_devices}`]);
    await click(rows[0]);
    expect(document.querySelector('[data-testid="where"]').textContent).toBe('/devices');
    // The dialog fades out before it leaves the page.
    for (let i = 0; i < 100 && document.querySelector('[role="dialog"]'); i++) {
      await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    }
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('says so when nothing matches, and offers to write to us', async () => {
    await mount(<HelpPanel />);
    await click(document.querySelector('[data-testid="help-button"]'));
    await type(document.querySelector('[data-testid="help-search"]'), 'qwertyuiop');
    expect(document.querySelector('[data-testid="help-none"]').textContent).toBe(translations.en.hf_none);
    expect([...document.querySelectorAll('[role="dialog"] a')].some((a) => a.getAttribute('href') === '/contact')).toBe(true);
  });
});

describe('the public menu', () => {
  it('on another page, sign in, sign up and the demo go through the landing page', async () => {
    await mount(<PublicMenu t={(k) => translations.en[k]} />, '/experts-comptables');
    const menu = document.querySelector('[data-testid="public-menu"]');
    const hrefs = [...menu.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/audit-saas', '/experts-comptables', '/direction-financiere', '/#pricing', '/?demo=true', '/?signin=true', '/?signup=true']));
    expect(menu.querySelector('a[aria-current="page"]').getAttribute('href')).toBe('/experts-comptables');
  });

  it('on a phone, the menu button opens and closes the list', async () => {
    await mount(<PublicMenu t={(k) => translations.en[k]} />, '/about');
    const toggle = document.querySelector('[aria-controls="public-menu-panel"]');
    expect(document.querySelector('[data-testid="public-menu-panel"]')).toBeNull();
    await click(toggle);
    const panel = document.querySelector('[data-testid="public-menu-panel"]');
    expect(panel.textContent).toContain(translations.en.pm_audit);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await click(panel.querySelector('a[href="/audit-saas"]'));
    expect(document.querySelector('[data-testid="public-menu-panel"]')).toBeNull();
  });
});
