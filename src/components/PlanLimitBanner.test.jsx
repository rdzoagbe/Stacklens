import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null),
  logConsent: vi.fn(), callAI: vi.fn(),
}));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: {}, isDemo: false }) }));

import { PlanLimitBanner } from './gates';
import { LanguageContext } from '../contexts/LangContext';

// ── The "limit reached" banner speaks the visitor's language ───────────────
//
// It used to splice the raw resource key and the English word "plan" into the
// sentence: « tools limite atteinte — Free plan ».

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;

async function mount(language) {
  localStorage.clear();
  localStorage.setItem('language', language);
  localStorage.setItem('accessguard_v1', JSON.stringify({
    user: { is_authenticated: true, is_demo: false, plan: 'free' },
    tools: Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, name: `Tool ${i}` })), employees: [], access: [],
  }));
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<LanguageContext.Provider value={{ language, setLanguage: () => {} }}><QueryClientProvider client={new QueryClient()}><MemoryRouter><PlanLimitBanner resource="tools" /></MemoryRouter></QueryClientProvider></LanguageContext.Provider>);
  });
  for (let i = 0; i < 20 && !document.body.textContent; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; document.body.innerHTML = ''; });

describe('PlanLimitBanner', () => {
  it('in French, no English noun and no English "plan"', async () => {
    await mount('fr');
    const text = document.body.textContent;
    expect(text).toContain('Outils : limite atteinte');
    expect(text).toContain('forfait Free');
    expect(text).toContain('sur 10 outils');
    expect(text).not.toMatch(/\btools\b|\bplan\b/);
  });

  it('in English it reads as one sentence', async () => {
    await mount('en');
    expect(document.body.textContent).toContain('Tools: limit reached');
    expect(document.body.textContent).toContain('Free plan');
  });
});
