import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { protectionActive, watermarkText, isCaptureShortcut, isEditableTarget } from './screenProtection';
import { FOUNDER_EMAILS } from './constants';

// ── What the protection decides, held to the rules in the header ───────────

describe('who it applies to', () => {
  const on = { screen_protection: true };
  it('only when the workspace turned it on', () => {
    expect(protectionActive({ workspaceUser: on, viewerEmail: 'claire@acme.fr' })).toBe(true);
    expect(protectionActive({ workspaceUser: {}, viewerEmail: 'claire@acme.fr' })).toBe(false);
    expect(protectionActive({ workspaceUser: { screen_protection: 'yes' }, viewerEmail: 'a@b.fr' })).toBe(false);
    expect(protectionActive({ viewerEmail: 'a@b.fr' })).toBe(false);
  });
  it('never for the founder, by flag or by address', () => {
    expect(protectionActive({ workspaceUser: on, viewerEmail: 'x@y.fr', isFounderFlag: true })).toBe(false);
    expect(protectionActive({ workspaceUser: on, viewerEmail: FOUNDER_EMAILS[0] })).toBe(false);
    expect(protectionActive({ workspaceUser: on, viewerEmail: FOUNDER_EMAILS[0].toUpperCase() })).toBe(false);
  });
  it('never for whoever can switch it off, only for the people they invite', () => {
    expect(protectionActive({ workspaceUser: on, viewerEmail: 'owner@acme.fr', canSwitchOff: true })).toBe(false);
    expect(protectionActive({ workspaceUser: on, viewerEmail: 'member@acme.fr', canSwitchOff: false })).toBe(true);
  });
  it('the component asks the same question as the Settings switch', () => {
    const comp = readFileSync(resolve(process.cwd(), 'src/components/ScreenProtection.jsx'), 'utf8');
    const tab = readFileSync(resolve(process.cwd(), 'src/pages/settings/SecurityTab.jsx'), 'utf8');
    expect(comp).toMatch(/canSwitchOff: !shared && hasRole\('admin'\)/);
    expect(tab).toMatch(/const canChange = hasRole\('admin'\) && !shared;/);
  });
  it('never in the demo', () => {
    expect(protectionActive({ workspaceUser: on, viewerEmail: 'a@b.fr', isDemo: true })).toBe(false);
    expect(protectionActive({ workspaceUser: { ...on, is_demo: true }, viewerEmail: 'a@b.fr' })).toBe(false);
  });
});

describe('the watermark', () => {
  it('names the viewer and the minute, so a leaked image can be dated', () => {
    expect(watermarkText('claire@acme.fr', new Date(2026, 9, 7, 15, 4))).toBe('claire@acme.fr · 2026-10-07 15:04');
  });
  it('still says something when there is no email', () => {
    expect(watermarkText('', new Date(2026, 0, 2, 3, 4))).toMatch(/^workspace member · 2026-01-02 03:04$/);
  });
});

describe('capture shortcuts', () => {
  it('recognises Print Screen, the macOS family and Win+Shift+S', () => {
    expect(isCaptureShortcut({ key: 'PrintScreen' })).toBe(true);
    for (const key of ['3', '4', '5']) expect(isCaptureShortcut({ key, metaKey: true, shiftKey: true })).toBe(true);
    expect(isCaptureShortcut({ key: 'S', metaKey: true, shiftKey: true })).toBe(true);
  });
  it('leaves ordinary typing and copy alone', () => {
    expect(isCaptureShortcut({ key: 'c', metaKey: true })).toBe(false);
    expect(isCaptureShortcut({ key: '4' })).toBe(false);
    expect(isCaptureShortcut({ key: 's', ctrlKey: true })).toBe(false);
    expect(isCaptureShortcut(null)).toBe(false);
  });
});

describe('text fields keep working', () => {
  it('inputs, textareas, selects and editable content are not refused', () => {
    document.body.innerHTML = '<div id="d"><span id="s">x</span></div><input id="i"><textarea id="t"></textarea><select id="se"></select><div contenteditable="true"><b id="c">y</b></div>';
    for (const id of ['i', 't', 'se', 'c']) expect(isEditableTarget(document.getElementById(id)), id).toBe(true);
    for (const id of ['d', 's']) expect(isEditableTarget(document.getElementById(id)), id).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('it promises nothing it cannot do, and sends nothing anywhere', () => {
  const src = (p) => readFileSync(resolve(__dirname, '../..', p), 'utf8');
  it('makes no network call and keeps nothing in storage', () => {
    for (const f of ['src/lib/screenProtection.js', 'src/components/ScreenProtection.jsx']) {
      expect(src(f), f).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|track\(/);
    }
  });
  it('the setting says it cannot block a screenshot, in English and French', () => {
    const tr = src('src/translations.js');
    expect(tr).toMatch(/screen_prot_limits: "A web page cannot stop the system's screenshot/);
    expect(tr).toMatch(/screen_prot_limits: "Une page web ne peut pas empêcher la capture/);
    expect(tr).not.toMatch(/screen_prot_[a-z0-9_]+: "[^"]*(impossible to screenshot|cannot be screenshot|prevents? (all )?screenshots?)/i);
  });
});
