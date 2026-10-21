import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ── The Content-Security-Policy that holds the page ────────────────────────
//
// `script-src 'unsafe-inline'` lets any inline script run, which is exactly
// what a cross-site-scripting bug needs; with it in the policy the rest of the
// header protects very little. The one inline script the page had (the Google
// consent defaults) now lives in public/consent-init.js, so the policy can
// refuse the lot. `https://*.workers.dev` let a script reach any Cloudflare
// Worker on the internet, to send data out; the Worker route it was for was
// removed long ago (src/firebase-config.js).

/* eslint-disable security/detect-non-literal-fs-filename --
   every path here is a file of this repository named in this test. */
const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');
const config = JSON.parse(read('firebase.json'));
const rule = (source) => config.hosting.headers.find((h) => h.source === source);
const csp = rule('**').headers.find((h) => h.key === 'Content-Security-Policy').value;
const directive = (name) => (csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) || '').split(/\s+/).slice(1);

describe('the policy', () => {
  it('lets no inline script and no eval run', () => {
    const scripts = directive('script-src');
    expect(scripts).toContain("'self'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(scripts.some((s) => s === '*' || s === 'https:' || s === 'data:')).toBe(false);
  });

  it('names every host a page may call, with no wildcard that reaches the whole internet', () => {
    const connect = directive('connect-src');
    expect(connect).not.toContain('https://*.workers.dev');
    expect(connect.some((s) => s === '*' || s === 'https:' || s === 'http:')).toBe(false);
  });

  it('still refuses framing, objects and a changed base', () => {
    expect(directive('default-src')).toEqual(["'none'"]);
    expect(directive('object-src')).toEqual(["'none'"]);
    expect(directive('base-uri')).toEqual(["'self'"]);
    expect(directive('frame-ancestors')).toEqual(["'none'"]);
  });
});

describe('index.html fits the policy', () => {
  const html = read('index.html');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map((m) => ({ attrs: m[1], body: m[2] }));

  it('has no inline script that runs: only data blocks, and files', () => {
    for (const { attrs, body } of scripts) {
      const data = /type="application\/ld\+json"/.test(attrs);
      const file = /\bsrc="/.test(attrs) && !body.trim();
      expect(data || file, `inline script would be refused: ${(attrs + body).trim().slice(0, 80)}`).toBe(true);
    }
  });

  it('has no inline event handler and no javascript: link', () => {
    expect(html).not.toMatch(/<[a-z][^>]*\son[a-z]+\s*=/i);
    expect(html).not.toMatch(/javascript:/i);
  });

  it('loads the consent script first, as a blocking script, before the app', () => {
    expect(existsSync(resolve(process.cwd(), 'public/consent-init.js'))).toBe(true);
    const consent = html.indexOf('<script src="/consent-init.js"></script>');
    const app = html.indexOf('<script type="module"');
    expect(consent, 'consent-init.js must be a plain <script src> (no defer, async or module)').toBeGreaterThan(-1);
    expect(app).toBeGreaterThan(consent);
  });
});

describe('the consent script is in the repository', () => {
  it('is not swallowed by the public/* rule in .gitignore, which would ship a site without its consent script', () => {
    const ignore = read('.gitignore');
    expect(ignore).toContain('!public/consent-init.js');
  });
});

describe('the consent script file is served fresh', () => {
  it('under the same no-cache header as the page, so a consent change reaches everyone', () => {
    const cache = rule('**').headers.find((h) => h.key === 'Cache-Control').value;
    expect(cache).toMatch(/no-cache|no-store/);
    // /assets/** is the only path cached for a year, and the file is not in it.
    expect(rule('/assets/**')).toBeTruthy();
    expect('/consent-init.js'.startsWith('/assets/')).toBe(false);
  });
});
