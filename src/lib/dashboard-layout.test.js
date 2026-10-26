import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { translations } from '../translations';

// ── The dashboard, on the design system ────────────────────────────────────
//
// It used to carry a "critical alerts" panel and an "action inbox" that said
// the same things twice and disagreed on the rest, four headline tiles, a
// quick-actions row repeating the sidebar, and its own emerald and gradient
// colours. Now: one priority band, three figures, one ranked to-do list and
// the spend breakdown, in the design-system tokens.
const page = readFileSync(resolve(process.cwd(), 'src/pages/DashboardPage.jsx'), 'utf8');
const shell = readFileSync(resolve(process.cwd(), 'src/components/AppShell.jsx'), 'utf8');

describe('the dashboard layout', () => {
  it('has one to-do list, not an alerts panel beside an action inbox', () => {
    expect(page).not.toMatch(/t\('critical_alerts'\)|t\('action_inbox'\)|t\('quick_actions'\)/);
    expect(page.match(/data-testid="dash-todo"/g)).toHaveLength(1);
  });

  it('shows three figures, each from the shared definition', () => {
    const figures = page.slice(page.indexOf('KEY FIGURES'), page.indexOf('TO-DO + SPEND'));
    expect(figures).toMatch(/computeWaste\(db\)/);
    expect(figures).toMatch(/previousMonthSpend\(db\)/);
    expect(figures).toMatch(/computeSecurityScore\(/);
    expect(figures.match(/<Link to=/g)).toHaveLength(3);
  });

  it('labels every level in five languages', () => {
    for (const lang of ['en', 'fr', 'de', 'es', 'pt']) {
      for (const level of ['critical', 'high', 'medium']) {
        expect(translations[lang][`dash_level_${level}`], `${lang} ${level}`).toBeTruthy();
      }
    }
  });

  it('uses the design tokens, not its own colours', () => {
    expect(page).not.toMatch(/emerald-|gradient|from-blue|text-white/);
    const nav = shell.slice(shell.indexOf('export function Sidebar'), shell.indexOf('export function SidebarFooter'));
    expect(nav).toMatch(/bg-brand-soft text-brand-text/);
    expect(nav).not.toMatch(/emerald|bg-blue-600\/15/);
    expect(nav).toMatch(/aria-current=\{active \? "page" : undefined\}/);
  });
});
