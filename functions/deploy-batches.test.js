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
    expect(exportedFunctions()).toHaveLength(20);
  });
});

// ── The deploy only runs when it needs to, and skips only when it is sure ──
//
// Every merge to main redeployed all twenty functions whatever it touched. An
// SEO change that edited index.html and a sitemap created twenty new Cloud Run
// revisions, took seven minutes, and failed: it ran eight minutes after the
// previous deploy, whose fresh revisions still held CPU, so batch 1 exceeded
// "Total allowable CPU per project per region" and `ai` could not start.
//
// Gating it introduces the opposite risk, and the worse one: a skipped deploy
// that should have run ships hosting against server code that never went out,
// with nothing failing. So the gate must fail toward deploying, and all four
// batches must share one decision — a gate on three of four would half-deploy.

describe('the functions deploy is gated, and fails toward deploying', () => {
  const workflow = () => read('.github/workflows/build.yml');

  /** The deploy-functions job block, up to the next top-level job. */
  const deployFunctionsJob = () => {
    const wf = workflow();
    const start = wf.indexOf('  deploy-functions:');
    expect(start, 'deploy-functions job not found').toBeGreaterThan(-1);
    const next = wf.slice(start + 1).search(/\n {2}[a-z-]+:\n/);
    return next === -1 ? wf.slice(start) : wf.slice(start, start + 1 + next);
  };

  it('decides whether to deploy before deploying', () => {
    expect(deployFunctionsJob(), 'No step computes whether functions changed, ' +
      'so every merge redeploys all twenty.').toMatch(/id:\s*scope/);
  });

  it('checks out enough history to compare against', () => {
    // Without this the previous commit is absent, the comparison cannot run,
    // and the gate falls back to deploying every time — safe but pointless.
    expect(deployFunctionsJob()).toMatch(/fetch-depth:\s*0/);
  });

  it('gates every batch on the same decision', () => {
    const job = deployFunctionsJob();
    const batches = [...job.matchAll(/- name: Deploy Cloud Functions \(batch \d\/4\)\n(.*?)\n\s+run:/gs)];
    expect(batches.length, 'Deploy batch steps not found').toBe(4);
    for (const [, between] of batches) {
      expect(between, 'A deploy batch is not gated on steps.scope.outputs.deploy, ' +
        'so it would run while the others skip and leave half the functions ' +
        'on the old code.').toMatch(/if:\s*steps\.scope\.outputs\.deploy == 'true'/);
    }
  });

  it('treats every uncertain case as a reason to deploy', () => {
    const job = deployFunctionsJob();
    // Each fail-safe branch must set deploy=true. A branch that sets it false
    // on an error is how a needed deploy gets silently skipped.
    const trueCount = (job.match(/echo "deploy=true"/g) || []).length;
    const falseCount = (job.match(/echo "deploy=false"/g) || []).length;
    expect(trueCount, 'Expected several fail-safe paths that deploy anyway.')
      .toBeGreaterThanOrEqual(3);
    expect(falseCount, 'Exactly one path may decide not to deploy: the one ' +
      'that positively established nothing relevant changed.').toBe(1);
  });

  it('counts firebase.json and the workflow itself as function changes', () => {
    const job = deployFunctionsJob();
    // firebase.json carries function config; this workflow carries the batch
    // list, so editing either without redeploying leaves them unapplied.
    expect(job).toMatch(/functions\/ firebase\.json \.github\/workflows\/build\.yml/);
  });

  it('does not redeploy for a change to a test file', () => {
    // Test files under functions/ are not deployed. The first version of this
    // gate omitted that, so the merge introducing it redeployed all twenty
    // functions because it had touched functions/deploy-batches.test.js — and
    // failed on the quota the gate exists to avoid.
    expect(deployFunctionsJob(), 'The change detection must exclude ' +
      'functions/**/*.test.js, or editing a test restarts twenty Cloud Run ' +
      'services.').toMatch(/grep -v -E '\^functions\/\.\*\\\.test\\\.js\$'/);
  });

  it('lets each batch drain before starting the next', () => {
    const job = deployFunctionsJob();
    // Twenty functions at one vCPU each is exactly the 20 vCPU ceiling, so a
    // batch whose old revisions are still up leaves no room for the next.
    // Failures tracked cumulative activity within a run and landed on batch 4
    // twice, so the pause before batch 4 is the one that matters most.
    for (const n of [2, 3, 4]) {
      expect(job, `No drain before batch ${n}.`)
        .toMatch(new RegExp(`Let batch ${n - 1} drain before batch ${n}`));
    }
    const pauses = (job.match(/run: sleep \d+/g) || []).length;
    expect(pauses, 'Expected one drain before each batch after the first.').toBe(3);
  });

  it('says out loud when it skips', () => {
    // Four greyed-out steps and no explanation is how a skip goes unnoticed.
    expect(deployFunctionsJob()).toMatch(/deploy functions: \$\{\{ steps\.scope\.outputs\.deploy \}\}/);
  });
});
