import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PAGE_SEO, SITE_ORIGIN, titleFor, canonicalFor, descriptionFor, applySeo, normalisePath,
} from './seo';

// The paths passed here are literals declared in this file, not input.
// eslint-disable-next-line security/detect-non-literal-fs-filename
const readRepo = (rel) => readFileSync(resolve(process.cwd(), rel), 'utf8');

// ── The sitemap and the head must not contradict each other ───────────────
//
// index.html hardcoded one canonical pointing at the homepage and nothing
// changed it per route. Being a single-page app, that HTML was served for
// every path — so sitemap.xml submitted nine URLs and eight of them carried
// `canonical: https://stacklens.fr/`, which tells Google they are duplicates
// of the homepage and should be dropped.
//
// Two files, each individually reasonable, giving opposite instructions.
// Nothing failed, nothing logged, and the pages simply never appeared.

describe('every submitted URL is a page in its own right', () => {
  const sitemapUrls = () =>
    [...readRepo('public/sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map(m => m[1].replace(SITE_ORIGIN, '') || '/');

  it('the sitemap is not empty', () => {
    expect(sitemapUrls().length).toBeGreaterThan(1);
  });

  it('every sitemap URL has its own title, description and canonical', () => {
    const missing = sitemapUrls().filter(p => !PAGE_SEO[normalisePath(p)]);
    expect(missing, 'Submitted to Google in sitemap.xml but with no entry in ' +
      'PAGE_SEO, so it would serve the homepage\'s canonical and be dropped ' +
      'as a duplicate.').toEqual([]);
  });

  it('every page with SEO metadata is actually submitted', () => {
    const urls = new Set(sitemapUrls().map(normalisePath));
    const unsubmitted = Object.keys(PAGE_SEO).filter(p => !urls.has(p));
    expect(unsubmitted, 'Has its own metadata but is absent from sitemap.xml.')
      .toEqual([]);
  });

  it('each canonical points at its own path, never the homepage', () => {
    // The precise failure being guarded: /privacy must not canonicalise to /.
    for (const path of Object.keys(PAGE_SEO)) {
      const canonical = canonicalFor(path);
      expect(canonical).toBe(path === '/' ? SITE_ORIGIN + '/' : SITE_ORIGIN + path);
      if (path !== '/') expect(canonical).not.toBe(SITE_ORIGIN + '/');
    }
  });
});

describe('titles and descriptions distinguish the pages', () => {
  it('no two pages share a title', () => {
    const titles = Object.keys(PAGE_SEO).map(titleFor);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('no two pages share a description', () => {
    const descriptions = Object.keys(PAGE_SEO).map(descriptionFor);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it('every page names the product, so a bare result is not anonymous', () => {
    for (const path of Object.keys(PAGE_SEO)) {
      expect(titleFor(path)).toContain('Stacklens');
    }
  });

  it('descriptions are long enough to be used and short enough to survive', () => {
    for (const [path, page] of Object.entries(PAGE_SEO)) {
      expect(page.description.length, `${path} description too short`).toBeGreaterThan(70);
      expect(page.description.length, `${path} description too long`).toBeLessThan(320);
    }
  });
});

describe('paths that are not public pages are left alone', () => {
  it('an authenticated route gets no canonical at all', () => {
    // Giving /dashboard the homepage canonical is the original bug; giving it
    // its own would invite indexing a page that redirects to sign-in.
    for (const path of ['/dashboard', '/settings', '/finance', '/tools']) {
      expect(canonicalFor(path)).toBeNull();
      expect(titleFor(path)).toBeNull();
    }
  });

  it('robots.txt disallows the routes with no metadata', () => {
    const robots = readRepo('public/robots.txt');
    for (const path of ['/dashboard', '/settings', '/finance', '/tools', '/employees']) {
      expect(robots, `${path} is neither indexable nor disallowed`).toContain(`Disallow: ${path}`);
    }
  });
});

describe('a URL variant must not become a second page', () => {
  it('trailing slashes and casing resolve to one canonical', () => {
    expect(canonicalFor('/privacy/')).toBe(SITE_ORIGIN + '/privacy');
    expect(canonicalFor('/PRIVACY')).toBe(SITE_ORIGIN + '/privacy');
    expect(canonicalFor('/')).toBe(SITE_ORIGIN + '/');
  });

  it('query strings and fragments never reach the canonical', () => {
    // ?utm_source=... would otherwise mint a new URL for every campaign.
    expect(canonicalFor('/about?utm_source=linkedin')).toBe(SITE_ORIGIN + '/about');
    expect(canonicalFor('/about#team')).toBe(SITE_ORIGIN + '/about');
  });
});

describe('applying it to the document', () => {
  beforeEach(() => {
    document.head.innerHTML = '<link rel="canonical" href="https://stacklens.fr/" />';
    document.title = 'stale';
  });

  it('rewrites the canonical that index.html shipped', () => {
    expect(applySeo('/dpa')).toBe(true);
    expect(document.querySelector('link[rel="canonical"]').getAttribute('href'))
      .toBe(SITE_ORIGIN + '/dpa');
    expect(document.title).toContain('Data Processing Agreement');
  });

  it('creates the meta tags when they are absent', () => {
    applySeo('/terms');
    expect(document.querySelector('meta[name="description"]').getAttribute('content'))
      .toContain('terms');
    expect(document.querySelector('meta[property="og:url"]').getAttribute('content'))
      .toBe(SITE_ORIGIN + '/terms');
  });

  it('leaves a non-public route untouched rather than mislabelling it', () => {
    applySeo('/dashboard');
    expect(document.title).toBe('stale');
    expect(document.querySelector('link[rel="canonical"]').getAttribute('href'))
      .toBe('https://stacklens.fr/');
  });
});
