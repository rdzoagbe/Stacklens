import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Every function must be in exactly one deploy batch ──────────────────────
//
// `firebase deploy --only functions` updates all nineteen in parallel. Each
// one being updated starts a container to pass a Cloud Run health check, and
// each of those needs real CPU, so nineteen at once exceeded "Total allowable
// CPU per project per region" and fifteen failed to start.
//
// The workflow now deploys them in batches of five, which needs a fifth of the
// concurrent headroom. That fixes the quota problem and introduces a worse
// failure mode in its place: a function absent from every batch is never
// deployed, with no error anywhere. The deploy goes green, the code ships to
// hosting, and one endpoint silently keeps running last month's version.
//
// So the batch list is checked against the actual exports on every build.

// eslint-disable-next-line security/detect-non-literal-fs-filename
const read = (p) => readFileSync(resolve(__dirname, '..', p), 'utf8');

const exportedFunctions = () => {
  const src = read('functions/index.js');
  return [...src.matchAll(/^exports\.([A-Za-z][A-Za-z0-9]*)\s*=/gm)].map(m => m[1]);
};

const batchedFunctions = () => {
  const wf = read('.github/workflows/build.yml');
  return [...wf.matchAll(/functions:([A-Za-z][A-Za-z0-9]*)/g)].map(m => m[1]);
};

describe('the batched functions deploy covers everything', () => {
  it('every exported function appears in a batch', () => {
    const exported = exportedFunctions();
    const batched = new Set(batchedFunctions());
    const missing = exported.filter(f => !batched.has(f));
    expect(missing, 'Exported but in no deploy batch, so it would never ship. ' +
      'Add it to one of the "Deploy Cloud Functions (batch n/4)" steps in ' +
      '.github/workflows/build.yml.').toEqual([]);
  });

  it('no batch names a function that does not exist', () => {
    const exported = new Set(exportedFunctions());
    const batched = batchedFunctions();
    const unknown = batched.filter(f => !exported.has(f));
    expect(unknown, 'Named in a deploy batch but not exported — a rename or a ' +
      'deletion left the workflow behind, and firebase will fail the deploy on ' +
      'an unknown function.').toEqual([]);
  });

  it('no function is deployed twice', () => {
    const batched = batchedFunctions();
    const dupes = batched.filter((f, i) => batched.indexOf(f) !== i);
    expect([...new Set(dupes)], 'Listed in more than one batch: wasted deploy ' +
      'time and two revisions of the same service in one run.').toEqual([]);
  });

  it('batches stay small enough to fit the CPU headroom', () => {
    const wf = read('.github/workflows/build.yml');
    const steps = [...wf.matchAll(/--only (functions:[^\s]+)/g)].map(m => m[1]);
    expect(steps.length, 'No batched deploy steps found — has the workflow ' +
      'reverted to deploying everything at once?').toBeGreaterThan(1);
    for (const step of steps) {
      const count = step.split(',').length;
      expect(count, `A batch of ${count} functions. Keep batches at or below ` +
        `six, or the concurrent CPU problem returns.`).toBeLessThanOrEqual(6);
    }
  });

  it('there are the functions we think there are', () => {
    // A sanity anchor: if this number moves, someone added or removed a
    // function and should have thought about which batch it belongs in.
    expect(exportedFunctions()).toHaveLength(19);
  });
});
