import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '../contexts/LangContext';
import { Modal } from './ui';

// ── Pop-ups speak the visitor's language ───────────────────────────────────
//
// Every pop-up in the app closed with "Close" in English, whatever language
// the rest of the screen was in.

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; localStorage.clear(); });

async function openIn(language) {
  localStorage.setItem('language', language);
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<LanguageProvider><Modal open title="T" onClose={() => {}}>x</Modal></LanguageProvider>);
  });
  return [...document.querySelectorAll('button')].map((b) => b.textContent.trim());
}

describe('the close button', () => {
  it.each([['fr', 'Fermer'], ['en', 'Close'], ['de', 'Schließen'], ['es', 'Cerrar']])('in %s: %s', async (lang, label) => {
    expect(await openIn(lang)).toContain(label);
  });
});

describe('a dialog to the keyboard and to screen readers', () => {
  async function openWith(onClose) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(<LanguageProvider><Modal open title="Supprimer l’outil" onClose={onClose}>x</Modal></LanguageProvider>);
    });
    return document.querySelector('[role="dialog"]');
  }

  it('is a modal dialog named by its title, and takes the focus', async () => {
    const dialog = await openWith(() => {});
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')).textContent).toBe('Supprimer l’outil');
    expect(document.activeElement).toBe(dialog);
  });

  it('closes on Escape', async () => {
    let closed = 0;
    await openWith(() => { closed += 1; });
    await act(async () => { document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(closed).toBe(1);
  });

  it('a dialog without a close action ignores Escape', async () => {
    await openWith(undefined);
    await act(async () => { document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
  });
});
