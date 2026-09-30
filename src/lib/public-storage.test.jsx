import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Firebase: nobody is signed in, and signing out succeeds.
vi.mock('../firebase-config', () => ({
  onAuthChange: (cb) => { setTimeout(() => cb(null), 0); return () => {}; },
  signInWithGoogle: vi.fn(), signOutUser: vi.fn().mockResolvedValue(), startTrial: vi.fn(),
  getUserPlanFromFirestore: vi.fn(), saveUserData: vi.fn().mockResolvedValue(1),
  loadUserData: vi.fn().mockResolvedValue(null), logConsent: vi.fn(),
}));
vi.mock('./analytics', () => ({ track: vi.fn() }));

import { readDb, buildSeedDb, seedDbIfEmpty, loadDb } from './db';
import { useDbQuery } from '../hooks/useDbQuery';
import { useAuth } from '../hooks/useAuth';

// ── A visitor who signs in to nothing leaves nothing behind ────────────────
//
// Reading the app's data on a public page used to save the whole demo
// company into the visitor's browser: the data hook, the sign-in listener
// and sign-out all wrote it. The free audit promises it keeps nothing, and a
// workspace of fictional employees sitting in someone's browser was the
// exception nobody had asked for. Now the demo is built in memory and saved
// only by the paths that mean it: starting the demo, signing in, a change.

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

beforeEach(() => localStorage.clear());
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; });

async function mount(Component) {
  root = createRoot(document.createElement('div'));
  await act(async () => { root.render(<QueryClientProvider client={new QueryClient()}><Component /></QueryClientProvider>); });
  await settle();
}

describe('reading the workspace', () => {
  it('with none in this browser, shows the demo company without saving it', () => {
    const db = readDb();
    expect(db.tools.length).toBeGreaterThan(0);
    expect(db.user.is_authenticated).toBe(false);
    expect(localStorage.getItem('accessguard_v1')).toBeNull();
  });

  it('with one, returns it untouched', () => {
    localStorage.setItem('accessguard_v1', JSON.stringify({ user: { is_authenticated: true }, tools: [{ id: 'x', name: 'Mine' }] }));
    expect(readDb().tools).toEqual([{ id: 'x', name: 'Mine' }]);
  });

  it('building the demo writes nothing; seeding it, for the demo, does', () => {
    buildSeedDb();
    expect(localStorage.getItem('accessguard_v1')).toBeNull();
    seedDbIfEmpty();
    expect(loadDb().tools.length).toBeGreaterThan(0);
  });
});

describe('a public page, as the app runs it', () => {
  it('the data hook and the sign-in listener write nothing for a visitor', async () => {
    let seen;
    function Page() { const { data } = useDbQuery(); const auth = useAuth(); seen = { data, auth }; return null; }
    await mount(Page);
    expect(seen.data.tools.length).toBeGreaterThan(0);   // the demo is still there to show
    expect(seen.auth.isAuthed).toBe(false);
    expect(localStorage.getItem('accessguard_v1')).toBeNull();
  });

  it('an ended session is still marked signed out', async () => {
    localStorage.setItem('accessguard_v1', JSON.stringify({ user: { is_authenticated: true, is_demo: false }, tools: [] }));
    function Page() { useAuth(); return null; }
    await mount(Page);
    expect(loadDb().user.is_authenticated).toBe(false);
  });

  it('signing out leaves neither the account nor a demo behind', async () => {
    localStorage.setItem('accessguard_v1', JSON.stringify({ user: { is_authenticated: true, is_demo: true }, tools: [{ id: 't', name: 'Slack' }] }));
    let auth;
    function Page() { auth = useAuth(); return null; }
    await mount(Page);
    await act(async () => { await auth.logout(true); });
    await settle();
    expect(localStorage.getItem('accessguard_v1')).toBeNull();
  });

  it('starting the demo is what saves it', async () => {
    let auth;
    function Page() { auth = useAuth(); return null; }
    await mount(Page);
    await act(async () => { auth.startDemo(); });
    expect(loadDb().user.is_demo).toBe(true);
    expect(loadDb().tools.length).toBeGreaterThan(0);
  });
});
