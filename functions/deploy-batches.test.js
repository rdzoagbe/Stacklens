import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

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

  it('counts the workflow itself as a function change', () => {
    const job = deployFunctionsJob();
    // This workflow carries the batch list, so editing it without redeploying
    // can leave a newly-added function never deployed.
    expect(job).toMatch(/functions\/ \.github\/workflows\/build\.yml/);
  });

  it('does not treat all of firebase.json as function config', () => {
    // The behaviour is asserted by running the gate, further down. This only
    // pins the shape: the whole file must NOT sit in the pathspec, because
    // that is what redeployed twenty services for a hosting-headers edit.
    const job = deployFunctionsJob();
    expect(job, 'firebase.json back in the pathspec means any hosting or ' +
      'firestore edit restarts every Cloud Run service again')
      .not.toMatch(/-- functions\/ firebase\.json/);
    expect(job, 'it must be compared by its functions key instead')
      .toMatch(/jq -S -c '\.functions \/\/ null'/);
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

// ── A check that can only be red teaches you to skim past red ──────────────
//
// The preview job deploys a Firebase Hosting preview channel, which needs the
// service-account secret. GitHub withholds repository secrets from workflows
// triggered by Dependabot and from pull requests opened off a fork, so the
// secret arrives as an empty string and the deploy ends in
//
//     Error: Failed to authenticate, have you run firebase login?
//
// continue-on-error kept that from blocking a merge, but the check still
// reported `failure`, so every untouched Dependabot pull request carried a red
// X for a reason that had nothing to do with its contents. That is worse than
// no check at all: the habit it builds is skimming past red, and the next red
// one is a real failure.
//
// So the job is skipped in the cases where credentials cannot exist. These
// checks exist because the condition is easy to "simplify" back into
// something that looks equivalent and is not.
describe('the preview job does not run where it cannot possibly authenticate', () => {
  const workflow = read('.github/workflows/build.yml');
  const previewBlock = (() => {
    const start = workflow.indexOf('  preview:');
    expect(start, 'the preview job was not found').toBeGreaterThan(-1);
    return workflow.slice(start, workflow.indexOf('\n  deploy:', start));
  })();
  const condition = (() => {
    const m = /if:\s*>-\s*\n([\s\S]*?)\n\s{4}steps:/.exec(previewBlock)
      || /if:\s*(.+)/.exec(previewBlock);
    expect(m, 'no if: condition on the preview job').toBeTruthy();
    return m[1].replace(/\s+/g, ' ').trim();
  })();

  it('still only runs on pull requests', () => {
    expect(condition).toMatch(/github\.event_name == 'pull_request'/);
  });

  it('skips Dependabot-triggered runs', () => {
    expect(condition, 'Dependabot runs get no secrets, so the preview deploy '
      + 'can only fail — skip it rather than let it report red')
      .toMatch(/github\.actor != 'dependabot\[bot\]'/);
  });

  it('tests the triggering actor, not the pull request author', () => {
    // These differ the moment somebody pushes to or updates a Dependabot
    // branch, and at that point secrets ARE available and the preview works.
    // Keying off the author would skip a preview that would have succeeded —
    // observed directly: updating #253's branch made its preview pass.
    expect(condition, 'use github.actor (who triggered the run), not '
      + 'github.event.pull_request.user.login (who opened it)')
      .not.toMatch(/pull_request\.user\.login/);
  });

  it('skips pull requests from a fork', () => {
    // Same missing secrets, same guaranteed failure, and nobody has opened one
    // yet — which is exactly why it would be a surprise rather than a known
    // quirk when it happens.
    expect(condition, 'a fork pull request gets no secrets either')
      .toMatch(/github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  });

  it('is still non-blocking for a genuine preview failure', () => {
    // Skipping the impossible cases is not a reason to start gating merges on
    // the possible ones: a hosting preview is a convenience, and `build` is
    // the check that decides whether the code is sound.
    expect(previewBlock).toMatch(/continue-on-error:\s*true/);
  });

  it('does not gate the jobs that legitimately need secrets on main', () => {
    // deploy and deploy-functions run on a push to main, where secrets are
    // always available. Copying the actor condition onto them would skip a
    // real deploy.
    for (const job of ['deploy', 'deploy-functions']) {
      const start = workflow.indexOf(`  ${job}:`);
      expect(start, `${job} not found`).toBeGreaterThan(-1);
      const end = workflow.indexOf('\n  ', workflow.indexOf('steps:', start));
      const block = workflow.slice(start, end > start ? end : undefined);
      expect(block, `${job} must not be skipped for Dependabot — it runs on main`)
        .not.toMatch(/dependabot/);
    }
  });
});


// ── The gate is asserted by RUNNING it, not by reading it ──────────────────
//
// Every test above this point checks the workflow's TEXT. That is how run
// #663 happened: the gate said "functions/ firebase.json ...", the text test
// matched it and passed, and the behaviour was wrong — a commit that changed
// only the hosting cache headers in firebase.json redeployed all twenty Cloud
// Run services, and batch 4 then failed on "Quota exceeded for total
// allowable CPU per project per region".
//
// Nothing about that was visible in the source. firebase.json is four configs
// in one file, and the gate treated the file as indivisible.
//
// So these extract the step's shell out of the workflow and execute it
// against throwaway git repositories. If the decision is wrong, the test is
// wrong with it — which is the only version of this test worth having.
describe('the gate decides correctly when actually run', () => {
  const gateScript = () => {
    const wf = read('.github/workflows/build.yml');
    const at = wf.indexOf('- name: Decide whether functions need deploying');
    expect(at, 'the gate step was renamed — this suite tests nothing')
      .toBeGreaterThan(-1);
    const runAt = wf.indexOf('run: |', at);
    expect(runAt, 'the gate step no longer has a run block').toBeGreaterThan(-1);
    const lines = wf.slice(runAt).split('\n').slice(1);
    const indent = lines[0].match(/^\s*/)[0].length;
    const body = [];
    for (const line of lines) {
      if (line.trim() === '') { body.push(''); continue; }
      if (line.match(/^\s*/)[0].length < indent) break;
      body.push(line.slice(indent));
    }
    const script = body.join('\n');
    expect(script, 'the extracted script does not look like the gate')
      .toMatch(/GITHUB_OUTPUT/);
    return script;
  };

  const dirs = [];
  const newRepo = (files) => {
    const dir = mkdtempSync(join(tmpdir(), 'deploy-gate-'));
    dirs.push(dir);
    const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
    git('init', '-q');
    git('config', 'user.email', 'gate@test');
    git('config', 'user.name', 'gate');
    git('config', 'commit.gpgsign', 'false');
    const write = (rel, body) => {
      const full = join(dir, rel);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, body);
    };
    const commit = (set) => {
      for (const [rel, body] of Object.entries(set)) write(rel, body);
      git('add', '-A');
      git('commit', '-q', '-m', 'x');
      return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir }).toString().trim();
    };
    const before = commit(files);
    return { dir, commit, before };
  };

  // Enough of the real thing for the gate to have something to compare.
  const BASE = {
    'firebase.json': JSON.stringify({
      hosting: { public: 'dist', headers: [{ source: '**', headers: [] }] },
      firestore: { rules: 'firestore.rules' },
      functions: [{ source: 'functions', codebase: 'default' }],
    }, null, 2) + '\n',
    'functions/index.js': 'exports.ai = 1;\n',
    'functions/deploy-batches.test.js': '// a test\n',
    '.github/workflows/build.yml': 'name: Build\n',
    'src/App.jsx': 'export default 1;\n',
  };

  const decide = (repo, after) => {
    const out = join(repo.dir, 'gh-output');
    writeFileSync(out, '');
    const script = join(repo.dir, 'gate.sh');
    writeFileSync(script, gateScript());
    execFileSync('bash', [script], {
      cwd: repo.dir,
      env: { ...process.env, BEFORE: repo.before, AFTER: after, GITHUB_OUTPUT: out },
      stdio: 'pipe',
    });
    const kv = {};
    for (const line of readFileSync(out, 'utf8').split('\n')) {
      const i = line.indexOf('=');
      if (i > 0) kv[line.slice(0, i)] = line.slice(i + 1);
    }
    return kv;
  };

  afterAll(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  it('does NOT deploy for a hosting-only change to firebase.json', () => {
    // This is run #663, reproduced. Before the fix this returned true.
    const repo = newRepo(BASE);
    const fb = JSON.parse(BASE['firebase.json']);
    fb.hosting.headers[0].headers.push({ key: 'Cache-Control', value: 'no-store' });
    const after = repo.commit({ 'firebase.json': JSON.stringify(fb, null, 2) + '\n' });
    const d = decide(repo, after);
    expect(d.deploy, `gate said deploy (${d.reason}) for a hosting header edit`)
      .toBe('false');
  });

  it('does NOT deploy for a firestore-only change to firebase.json', () => {
    const repo = newRepo(BASE);
    const fb = JSON.parse(BASE['firebase.json']);
    fb.firestore.indexes = 'firestore.indexes.json';
    const after = repo.commit({ 'firebase.json': JSON.stringify(fb, null, 2) + '\n' });
    expect(decide(repo, after).deploy).toBe('false');
  });

  it('DOES deploy when firebase.json’s functions block changes', () => {
    // The reason the whole file was in the pathspec. Narrowing it must not
    // lose this: function config that never deploys is the dangerous
    // direction.
    const repo = newRepo(BASE);
    const fb = JSON.parse(BASE['firebase.json']);
    fb.functions[0].runtime = 'nodejs22';
    const after = repo.commit({ 'firebase.json': JSON.stringify(fb, null, 2) + '\n' });
    const d = decide(repo, after);
    expect(d.deploy, 'function config would have shipped undeployed').toBe('true');
    expect(d.reason).toMatch(/firebase\.json:functions/);
  });

  it('DOES deploy when firebase.json stops being readable JSON', () => {
    // Fail toward deploying. A file jq cannot parse must never read as
    // "unchanged".
    const repo = newRepo(BASE);
    const after = repo.commit({ 'firebase.json': '{ this is not json\n' });
    expect(decide(repo, after).deploy).toBe('true');
  });

  it('DOES deploy for a change to functions source', () => {
    const repo = newRepo(BASE);
    const after = repo.commit({ 'functions/index.js': 'exports.ai = 2;\n' });
    expect(decide(repo, after).deploy).toBe('true');
  });

  it('DOES deploy for a change to this workflow', () => {
    const repo = newRepo(BASE);
    const after = repo.commit({ '.github/workflows/build.yml': 'name: Build2\n' });
    expect(decide(repo, after).deploy).toBe('true');
  });

  it('does NOT deploy for a functions test file alone', () => {
    const repo = newRepo(BASE);
    const after = repo.commit({ 'functions/deploy-batches.test.js': '// two\n' });
    expect(decide(repo, after).deploy).toBe('false');
  });

  it('does NOT deploy for a src-only change', () => {
    // The common case: nearly every merge. Getting this wrong costs seven
    // minutes and, twice now, a red deploy.
    const repo = newRepo(BASE);
    const after = repo.commit({ 'src/App.jsx': 'export default 2;\n' });
    expect(decide(repo, after).deploy).toBe('false');
  });

  it('deploys when there is no previous commit to compare against', () => {
    const repo = newRepo(BASE);
    const after = repo.commit({ 'src/App.jsx': 'export default 3;\n' });
    const out = join(repo.dir, 'gh-output');
    writeFileSync(out, '');
    const script = join(repo.dir, 'gate.sh');
    writeFileSync(script, gateScript());
    execFileSync('bash', [script], {
      cwd: repo.dir,
      env: {
        ...process.env,
        BEFORE: '0000000000000000000000000000000000000000',
        AFTER: after,
        GITHUB_OUTPUT: out,
      },
      stdio: 'pipe',
    });
    expect(readFileSync(out, 'utf8')).toMatch(/deploy=true/);
  });
});


// ── The allocation has to fit the region's CPU ceiling ─────────────────────
//
// Run #663 failed on purgeClientOrgs with
//
//   Could not create or update Cloud Run service purgeclientorgs,
//   Container Healthcheck failed. Quota exceeded for total allowable CPU
//   per project per region.
//
// and the cause was arithmetic, not luck. firebase-functions gives every
// gen2 function a full vCPU by default ("Defaults to 1 for functions with
// <= 2GB RAM", v2/options.d.ts), twenty functions therefore hold 20,000
// milli vCPU, and "Total CPU allocation, in milli vCPU, per project per
// region" for us-central1 IS 20,000. The deploy sat exactly on the ceiling.
//
// GCP will not lift it. The console answers "Based on your service usage
// history, you are not eligible for a quota increase at this time" with the
// field capped at the current value, checked 2026-09-16. So the ceiling is a
// fixed constant and the allocation is the only side that can move.
//
// This computes what a deploy actually asks for and fails the build if it no
// longer fits — because the alternative is finding out from a red deploy,
// which is how we found out the first three times.
describe('the functions fit the regional CPU quota', () => {
  // us-central1, Cloud Run Admin API, screenshotted 2026-09-16: value 20,000,
  // "Adjustable: Yes" but not for this project.
  const QUOTA_MILLI = 20000;

  const globalCpu = () => {
    const src = read('functions/index.js');
    const m = /setGlobalOptions\(\{([^}]*)\}\)/.exec(src);
    expect(m, 'setGlobalOptions call not found — cannot check the allocation')
      .toBeTruthy();
    const cpu = /cpu:\s*([0-9.]+|'gcf_gen1')/.exec(m[1]);
    // No cpu set means the library default, which is the bug: a full vCPU each.
    if (!cpu) return 1;
    return cpu[1] === "'gcf_gen1'" ? 0.167 : Number(cpu[1]);
  };

  const largestBatch = () => {
    const wf = read('.github/workflows/build.yml');
    return Math.max(...[...wf.matchAll(/--only (functions:[^\s]+)/g)]
      .map(m => m[1].split(',').length));
  };

  it('does not set a full vCPU per function', () => {
    expect(globalCpu(), 'One vCPU x twenty functions is exactly the 20,000 ' +
      'milli quota, so every deploy races the instances draining behind it. ' +
      'This is what failed run #663.').toBeLessThan(1);
  });

  it('the warm allocation fits inside the quota', () => {
    const warm = exportedFunctions().length * globalCpu() * 1000;
    expect(warm, `${exportedFunctions().length} functions x ${globalCpu()} ` +
      `vCPU = ${warm} milli, against a ${QUOTA_MILLI} milli ceiling.`)
      .toBeLessThan(QUOTA_MILLI);
  });

  it('and so does a deploy, with the draining revisions on top', () => {
    // What actually breaks. During a batch each new revision boots a container
    // while the revision it replaces is still holding instances, so the peak
    // is the warm allocation plus roughly two revisions per function in the
    // batch. At cpu 1 this came to 30,000 against 20,000 — #663.
    const cpu = globalCpu();
    const warm = exportedFunctions().length * cpu * 1000;
    const peak = warm + 2 * largestBatch() * cpu * 1000;
    expect(peak, `Peak during a deploy of the largest batch ` +
      `(${largestBatch()} functions) is about ${peak} milli vCPU, against a ` +
      `${QUOTA_MILLI} milli ceiling. Lower cpu, shrink the batches, or ` +
      `deploy fewer functions.`).toBeLessThan(QUOTA_MILLI);
  });

  it('no function quietly opts back into a full vCPU', () => {
    // A per-function override is allowed, but not one that puts a single
    // service back on a whole core while the global setting says otherwise.
    const src = read('functions/index.js');
    const overrides = [...src.matchAll(/cpu:\s*([0-9.]+)/g)]
      .map(m => Number(m[1]));
    for (const c of overrides) {
      expect(c, `A cpu: ${c} override. Keep every function below a full ` +
        `vCPU or the regional ceiling comes back.`).toBeLessThan(1);
    }
  });

  it('records why concurrency is now 1 and not 80', () => {
    // cpu < 1 forces concurrency to 1 ("Concurrency cannot be set to any
    // value other than 1 if cpu is less than 1"). That is a real behaviour
    // change and the next person needs to find it written down next to the
    // setting, not in a pull request.
    const src = read('functions/index.js');
    const at = src.indexOf('setGlobalOptions({');
    const preamble = src.slice(Math.max(0, at - 3000), at);
    expect(preamble, 'the concurrency cost of cpu < 1 must be recorded ' +
      'beside setGlobalOptions').toMatch(/concurrency/i);
  });
});
