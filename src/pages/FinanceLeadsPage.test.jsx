import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../firebase-config', () => ({ callAI: vi.fn() }));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));

import { FinanceLeadsPage } from './FinanceLeadsPage';
import { LanguageProvider } from '../contexts/LangContext';
import { cheapestPlanFor } from '../components/gates';
import { TRIAL_DAYS } from '../lib/plan';

// ── /direction-financiere says which plan its screens need ─────────────────
//
// Every screen the page names is in the Finance module. The page used to
// leave the reader to find that out after signing up.

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;

async function render(lang) {
  localStorage.clear();
  localStorage.setItem('language', lang);
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<LanguageProvider><MemoryRouter><FinanceLeadsPage /></MemoryRouter></LanguageProvider>); });
}

afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; document.body.innerHTML = ''; });

describe('the plan line', () => {
  it('names the cheapest plan with Finance, its price and the trial, in English and French', async () => {
    const plan = cheapestPlanFor('finance');
    await render('en');
    const en = document.querySelector('[data-testid="fin-plan-note"]').textContent;
    expect(en).toContain(`€${plan.monthly} a month`);
    expect(en).toContain(`${TRIAL_DAYS}-day trial`);
    expect(en).not.toMatch(/\{\w+\}/);
    await act(async () => root.unmount()); root = null; document.body.innerHTML = '';
    await render('fr');
    const fr = document.querySelector('[data-testid="fin-plan-note"]').textContent;
    expect(fr).toContain(`${plan.monthly} € par mois`);
    expect(fr).toContain(`essai de ${TRIAL_DAYS} jours`);
  });
});
