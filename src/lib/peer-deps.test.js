import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// ── A dependency nothing imports may still be required ─────────────────────
//
// `react-is` sits in dependencies and appears in no source file. It looks
// exactly like the dead direct dependency @babel/parser was, and removing it
// on that reasoning broke the build outright:
//
//   Rolldown failed to resolve import "react-is"
//     from node_modules/recharts/es6/util/ReactUtils.js
//
// It is a peerDependency of recharts, which imports it directly. A peer
// dependency is satisfied by the consuming application, not by the library
// that declares it — so it belongs in our manifest precisely because none of
// our code mentions it. Grepping the source is the wrong instrument: the
// answer was never going to be there.
//
// Every chart on the Dashboard, Finance and Executive screens comes from
// recharts, so the blast radius was all of them.
//
// This asserts the invariant directly: whatever our direct dependencies
// declare as a required peer, we must declare ourselves.

const require_ = createRequire(import.meta.url);
const pkg = require_(resolve(process.cwd(), 'package.json'));

const declared = () => ({ ...pkg.dependencies, ...pkg.devDependencies });

/** Required (non-optional) peers of one installed package. */
function requiredPeersOf(name) {
  let dep;
  try {
    dep = require_(`${name}/package.json`);
  } catch {
    // Not installed or its package.json is not exported. Nothing to check.
    return [];
  }
  const peers = dep.peerDependencies || {};
  const meta = dep.peerDependenciesMeta || {};
  return Object.keys(peers)
    .filter(peer => !meta[peer]?.optional)
    .map(peer => ({ peer, range: peers[peer] }));
}

describe('every required peer dependency is one we declare', () => {
  it('finds dependencies to check', () => {
    expect(Object.keys(declared()).length).toBeGreaterThan(10);
  });

  it('leaves no required peer for npm to guess at', () => {
    const ours = new Set(Object.keys(declared()));
    const missing = [];
    for (const name of ours) {
      for (const { peer, range } of requiredPeersOf(name)) {
        if (!ours.has(peer)) missing.push(`${name} requires peer ${peer}@${range}`);
      }
    }
    expect(missing, 'A direct dependency declares a required peer that this ' +
      'package.json does not. It may resolve today by luck of hoisting and ' +
      'fail on a clean install, or fail the build outright — which is what ' +
      'removing react-is did.').toEqual([]);
  });

  it('still declares react-is, which recharts imports and no source file does', () => {
    // Named explicitly because this one is guaranteed to look removable to
    // anyone auditing dependencies by searching the source.
    const ours = declared();
    expect(ours['react-is'], 'recharts imports react-is directly and declares ' +
      'it as a peer. Removing it fails the build at ReactUtils.js.').toBeTruthy();
    const peers = requiredPeersOf('recharts').map(p => p.peer);
    expect(peers).toContain('react-is');
  });
});
