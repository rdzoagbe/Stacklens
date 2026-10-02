import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null), logConsent: vi.fn(),
  sendMonthlyReportNow: vi.fn(),
}));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));
vi.mock('../components/SlackNotifications', () => ({ SlackNotifications: () => null }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { saveUserData } from '../firebase-config';
import { loadDb } from './db';
import { translations } from '../translations';
import { NOTIFICATION_SWITCHES } from './notifications';
import { NotificationsTab } from '../pages/settings/NotificationsTab';

// ── Settings → Notifications: every switch changes an email ────────────────
//
// Six switches here once saved to a browser key nothing read. What is left
// must each name a db.user field that the scheduled emails check, and the
// page must write that field to the account.

const root_ = resolve(__dirname, '../..');
const functionsSrc = readFileSync(resolve(root_, 'functions/index.js'), 'utf8');

describe('each switch is read by the server', () => {
  it('every field is checked by a scheduled email', () => {
    for (const { field } of NOTIFICATION_SWITCHES) {
      const checked = [`data?.user?.${field} === false`, `data?.user?.${field} !== false`].some((c) => functionsSrc.includes(c));
      expect(checked, `${field} is read by no scheduled email`).toBe(true);
    }
  });

  it('each kind of daily alert sits behind its own switch', () => {
    const daily = functionsSrc.slice(functionsSrc.indexOf('exports.dailyAlerts'), functionsSrc.indexOf('const total = alerts.renewals.length'));
    expect(daily).toMatch(/renewal_alerts !== false\) \{\s*\(data\.tools/);
    expect(daily).toMatch(/budget_alerts === false \? \[\]\s*: \(data\.budgets/);
    expect(daily).toMatch(/access_alerts === false \? \[\] : \(data\.access/);
    // Three kinds of alert, three pushes, nothing else sent.
    expect([...daily.matchAll(/alerts\.(\w+)\.push/g)].map((m) => m[1]).sort()).toEqual(['budgets', 'renewals', 'security']);
  });

  it('every switch has its words in English and French', () => {
    for (const { label, sub } of NOTIFICATION_SWITCHES) {
      for (const lang of ['en', 'fr']) {
        expect(translations[lang][label], `${lang}.${label}`).toBeTruthy();
        expect(translations[lang][sub], `${lang}.${sub}`).toBeTruthy();
      }
    }
  });
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const t = (k) => translations.en[k] || k;
let root;
const qc = { invalidateQueries: vi.fn() };
const switches = () => [...document.querySelectorAll('[data-testid="notification-switches"] [role="switch"]')];

async function mount(user = {}, extra = {}) {
  localStorage.clear();
  localStorage.setItem('accessguard_v1', JSON.stringify({
    user: { is_authenticated: true, email: 'daf@acme.fr', ...user }, tools: [], employees: [], access: [], ...extra,
  }));
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<NotificationsTab firebaseUser={{ uid: 'u1' }} qc={qc} t={t} />); });
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; document.body.innerHTML = ''; });

describe('the Notifications tab', () => {
  it('shows one switch per entry, on by default', async () => {
    await mount();
    expect(switches()).toHaveLength(NOTIFICATION_SWITCHES.length);
    expect(switches().map((s) => s.getAttribute('aria-checked'))).toEqual(NOTIFICATION_SWITCHES.map(() => 'true'));
    expect(document.body.textContent).not.toMatch(/Orphaned tool|High-risk|Compliance/);
  });

  it('turning one off writes its field to the account', async () => {
    await mount();
    const i = NOTIFICATION_SWITCHES.findIndex((n) => n.key === 'access');
    await act(async () => { switches()[i].click(); });
    expect(loadDb().user.access_alerts).toBe(false);
    expect(saveUserData).toHaveBeenCalled();
    expect(switches()[i].getAttribute('aria-checked')).toBe('false');
  });

  it('reads the account setting, not only this browser', async () => {
    await mount({ budget_alerts: false });
    const i = NOTIFICATION_SWITCHES.findIndex((n) => n.key === 'budget');
    expect(switches()[i].getAttribute('aria-checked')).toBe('false');
  });

  it('in a shared workspace, the owner’s settings are left alone', async () => {
    await mount({ role: 'editor' }, { _shared_view: { owner_uid: 'owner', role: 'editor' } });
    const i = NOTIFICATION_SWITCHES.findIndex((n) => n.key === 'renewal');
    await act(async () => { switches()[i].click(); });
    expect(loadDb().user.renewal_alerts).toBeUndefined();
    expect(saveUserData).not.toHaveBeenCalled();
  });
});
