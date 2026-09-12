import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// ── CI must run a Node the dependencies actually support ────────────────────
//
// jsdom 30 declares engines ^22.22.2 || ^24.15.0 || >=26.0.0, and the undici
// it pulls in needs >=22.19.0. The workflow was pinned to Node 20, so the
// whole suite died before a single test body ran:
//
//   TypeError: webidl.util.markAsUncloneable is not a function
//     at new CacheStorage node_modules/undici/lib/web/cache/cachestorage.js
//     at Object.<anonymous> node_modules/jsdom/lib/api.js:12
//
// undici reads markAsUncloneable from node:worker_threads, which Node 20 does
// not export. Nothing in this repository was wrong; the runtime was too old
// for a dependency that had quietly raised its floor.
//
// That class of failure is invisible locally — whoever bumps the dependency is
// usually on a newer Node than CI pins, so it passes on their machine and
// fails in the pipeline. Worse, it fails with a stack trace about WebIDL
// internals rather than "wrong Node version", which is a slow thing to read.
//
// So the floor is asserted here instead, on every test run, in the only two
// places that can drift apart: what the workflow installs, and what the
// dependencies demand.

const require_ = createRequire(import.meta.url);
const repoRoot = resolve(__dirname, '../..');

const pkg = require_('../../package.json');
const workflow = readFileSync(
  resolve(repoRoot, '.github/workflows/build.yml'), 'utf8'
);

const workflowNodeVersions = () =>
  [...workflow.matchAll(/node-version:\s*'([^']+)'/g)].map(m => m[1]);

const majorOf = (v) => Number(String(v).replace(/^[^\d]*/, '').split('.')[0]);

// Which majors a package's `engines.node` range allows. Enough of semver to
// read the shapes that appear in practice: ^22.22.2, ~22.22.2, >=22.19.0, 22.
const allowedMajors = (range) => {
  const exact = new Set();
  let floor = Infinity;
  for (const clause of range.split('||').map(s => s.trim())) {
    const major = majorOf(clause);
    if (!Number.isFinite(major)) continue;
    if (/^[\^~]/.test(clause)) exact.add(major);
    else if (/^>=?/.test(clause)) floor = Math.min(floor, major);
    else exact.add(major);
  }
  return { exact, floor };
};

const permits = (range, major) => {
  const { exact, floor } = allowedMajors(range);
  return exact.has(major) || major >= floor;
};

describe('CI runs a Node version the dependencies support', () => {
  it('the workflow pins one Node version everywhere', () => {
    const pins = workflowNodeVersions();
    expect(pins.length, 'No node-version pins found in build.yml — has the ' +
      'workflow stopped using actions/setup-node?').toBeGreaterThan(0);
    expect([...new Set(pins)], 'Jobs in build.yml install different Node ' +
      'versions, so a suite can pass in one job and fail in another.')
      .toHaveLength(1);
  });

  it('package.json declares the floor', () => {
    expect(pkg.engines?.node, 'package.json has no engines.node, so nothing ' +
      'records which Node this app needs and npm cannot warn anyone.')
      .toBeTruthy();
  });

  it('the version CI installs satisfies that floor', () => {
    const pinned = majorOf(workflowNodeVersions()[0]);
    expect(permits(pkg.engines.node, pinned),
      `build.yml installs Node ${pinned} but package.json requires ` +
      `${pkg.engines.node}.`).toBe(true);
  });

  it('jsdom still supports the version CI installs', () => {
    // The drift guard. When a jsdom bump raises its floor past what the
    // workflow installs, this fails here rather than in CI with a WebIDL
    // stack trace. Bump node-version in .github/workflows/build.yml and the
    // engines floor in package.json to match.
    const jsdomRange = require_('jsdom/package.json').engines?.node;
    expect(jsdomRange, 'jsdom no longer declares engines.node').toBeTruthy();
    const pinned = majorOf(workflowNodeVersions()[0]);
    expect(permits(jsdomRange, pinned),
      `jsdom requires Node ${jsdomRange} but build.yml installs ` +
      `${pinned}. The suite will not start on that runner.`).toBe(true);
  });

  it('the Node running this suite satisfies the floor too', () => {
    expect(permits(pkg.engines.node, majorOf(process.version)),
      `This Node is ${process.version}, below the declared ` +
      `${pkg.engines.node}.`).toBe(true);
  });
});
