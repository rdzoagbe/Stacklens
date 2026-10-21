import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

// ── A button that says "billing" opens Billing ─────────────────────────────
//
// Several buttons used to go to /settings and, 100 ms later, click the Billing
// tab if it was on the page. Settings is loaded on demand, so on the first
// visit the page was not there yet when the timer fired: the click found
// nothing and the person landed on the General tab. Settings already reads
// ?tab=billing, so every button uses that and nothing needs a timer.

/* eslint-disable security/detect-non-literal-fs-filename --
   every path here is a file of this repository named in this test. */
const root = process.cwd();
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const files = execFileSync('git', ['ls-files', 'src'], { cwd: root, encoding: 'utf8' })
  .split('\n').filter((f) => /\.(jsx?|mjs)$/.test(f) && !/\.test\./.test(f));
const sources = files.map((f) => ({ f, s: read(f) }));
const VALID_TABS = JSON.parse(/VALID_TABS = (\[[^\]]+\])/.exec(read('src/pages/SettingsPage.jsx'))[1].replace(/'/g, '"'));

describe('buttons that open a Settings tab', () => {
  it('none clicks a tab after a delay: the page may not be loaded yet', () => {
    for (const { f, s } of sources) {
      if (f === 'src/pages/SettingsPage.jsx') continue;
      expect(s, `${f} clicks a Settings tab with a timer; link to /settings?tab=… instead`)
        .not.toMatch(/querySelector\(\s*['"]\[data-tab=/);
    }
  });

  it('none goes to /settings without saying which tab', () => {
    for (const { f, s } of sources) {
      expect(s, `${f} navigates to /settings with no ?tab=`).not.toMatch(/navigate\(\s*['"`]\/settings['"`]\s*\)/);
      expect(s, `${f} links to /settings with no ?tab=`).not.toMatch(/\bto=["']\/settings["']/);
    }
  });

  it('every ?tab= it names is a tab Settings has', () => {
    const used = new Set();
    for (const { s } of sources) for (const m of s.matchAll(/\/settings\?tab=(\w+)/g)) used.add(m[1]);
    expect(used.size).toBeGreaterThan(3);
    for (const tab of used) expect(VALID_TABS, `/settings?tab=${tab}`).toContain(tab);
  });

  it('the old /billing and /integrations addresses land on their tab', () => {
    const app = read('src/App.jsx');
    expect(app).toContain('path="/billing" element={<Navigate to="/settings?tab=billing" replace />}');
    expect(app).toContain('path="/integrations" element={<Navigate to="/settings?tab=integrations" replace />}');
  });

  it('the upgrade buttons open Billing', () => {
    const gates = read('src/components/gates.jsx');
    expect((gates.match(/navigate\('\/settings\?tab=billing'\)/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(read('src/components/AppShell.jsx')).toContain("navigate('/settings?tab=billing')");
  });
});
