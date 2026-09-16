import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Every deploy has to actually reach people ──────────────────────────────
//
// The SPA rewrites everything to /index.html:
//
//   "rewrites": [{ "source": "**", "destination": "/index.html" }]
//
// but Firebase Hosting matches header rules against the REQUEST path, not the
// file it ends up serving. So `/index.html` had `no-cache` and every real
// route — /dashboard, /settings, /founder-admin — matched only `**`, which set
// no Cache-Control at all. Firebase then applies its own default, and the CDN
// and browser hold that HTML for an hour, pointing at the PREVIOUS build's
// hashed asset names.
//
// Measured in the hosting emulator before the fix: /dashboard came back with
// no Cache-Control header whatsoever, while /index.html — a path nobody
// requests — got the rule.
//
// Two consequences, and the second is the serious one:
//
//   a fix can ship, deploy green, and still not be what somebody sees for up
//   to an hour, which is exactly the confusion that cost us three rounds on
//   the name modal
//
//   the App Check rollback is "set the flag false and deploy hosting". If
//   sign-in is down for every customer, an hour of stale HTML is an hour of
//   outage AFTER the fix has shipped. That was described as immediate and
//   was not.
//
// The `**` block now sets no-store, and `/assets/**` still sets immutable.
// Both halves verified in the emulator: SPA routes revalidate, hashed assets
// keep their year. The ORDER carries that — Firebase applies every matching
// rule and the later one wins for a repeated key — so the ordering is
// asserted here rather than trusted.
describe('hosting cache headers let a deploy reach people', () => {
  const cfg = JSON.parse(readFileSync(resolve(process.cwd(), 'firebase.json'), 'utf8'));
  const headers = cfg.hosting.headers;
  const cacheOf = (source) => {
    const entry = headers.find((h) => h.source === source);
    expect(entry, `no header rule for ${source}`).toBeTruthy();
    const cc = entry.headers.find((h) => h.key === 'Cache-Control');
    return cc ? cc.value : null;
  };
  const indexOfRule = (source) => headers.findIndex((h) => h.source === source);

  it('rewrites everything to index.html, which is why this matters', () => {
    expect(cfg.hosting.rewrites).toEqual([{ source: '**', destination: '/index.html' }]);
  });

  it('the catch-all forbids caching, so SPA routes always revalidate', () => {
    // Without this, /dashboard is served from cache with last hour's asset
    // hashes and the deploy might as well not have happened.
    expect(cacheOf('**'), 'the ** rule must set Cache-Control').toBeTruthy();
    expect(cacheOf('**')).toMatch(/no-store/);
    expect(cacheOf('**')).toMatch(/no-cache/);
  });

  it('hashed assets keep their long cache', () => {
    // The whole point of content hashing. Losing this would make every page
    // load re-download the bundle.
    expect(cacheOf('/assets/**')).toMatch(/immutable/);
    expect(cacheOf('/assets/**')).toMatch(/max-age=31536000/);
  });

  it('the assets rule comes AFTER the catch-all, or assets lose their cache', () => {
    // Firebase applies every matching rule and the later entry wins for a
    // repeated key. Reorder these two and /assets/** inherits no-store.
    expect(indexOfRule('/assets/**')).toBeGreaterThan(indexOfRule('**'));
  });

  it('the report path stays out of caches and out of search engines', () => {
    expect(cacheOf('/report/**')).toMatch(/no-store/);
  });
});
