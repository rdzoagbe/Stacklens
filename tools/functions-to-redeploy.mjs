// ── Which Cloud Functions a manual redeploy updates ────────────────────────
//
// A function keeps the secret version it was deployed with: putting a new
// Brevo key in Secret Manager changes nothing until the functions that use it
// are deployed again. The Build & Deploy workflow only deploys functions when
// their code changes, so the "Redeploy functions" workflow
// (.github/workflows/redeploy-functions.yml) runs this to know what to deploy.
//
// The list is read from functions/index.js every time, never typed in the
// workflow, so a new function that uses a secret is included on its own.
//
//   node tools/functions-to-redeploy.mjs BREVO_API_KEY      the functions using that secret
//   node tools/functions-to-redeploy.mjs all                every function
//   node tools/functions-to-redeploy.mjs sendInvite,founderops
//
// Prints one line per batch, ready for `firebase deploy --only`: at most five
// functions each, because deploying many at once exceeded the region's CPU
// quota (see the batch comment in build.yml).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export const BATCH_SIZE = 5;

/** Every exported function, in file order. */
export function exportedFunctions(src) {
  return [...src.matchAll(/^exports\.([A-Za-z][A-Za-z0-9]*)\s*=/gm)].map((m) => m[1]);
}

/** Secret name -> the variable that holds it, from defineSecret('NAME'). */
export function secretVariables(src) {
  const out = {};
  for (const m of src.matchAll(/const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*defineSecret\(\s*['"]([A-Z0-9_]+)['"]\s*\)/g)) {
    out[m[2]] = m[1];
  }
  return out;
}

/**
 * The functions whose options name the secret. A function's options are the
 * text between `exports.x = onRequest(` / `onSchedule(` and its handler.
 */
export function functionsUsingSecret(src, secret) {
  const variable = secretVariables(src)[secret];
  if (!variable) return [];
  const starts = [...src.matchAll(/^exports\.([A-Za-z][A-Za-z0-9]*)\s*=/gm)];
  const out = [];
  starts.forEach((m, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].index : src.length;
    const chunk = src.slice(m.index, end);
    const handler = chunk.search(/async\s*\(/);
    const options = handler === -1 ? chunk : chunk.slice(0, handler);
    const secrets = options.match(/secrets\s*:\s*\[([^\]]*)\]/);
    if (secrets && new RegExp(`\\b${variable}\\b`).test(secrets[1])) out.push(m[1]);
  });
  return out;
}

/** Resolve the workflow's choice into function names, or throw with a sentence. */
export function selectFunctions(src, which) {
  const choice = String(which || '').trim();
  const all = exportedFunctions(src);
  if (choice === 'all') return all;
  if (/^[A-Z][A-Z0-9_]*$/.test(choice)) {
    const list = functionsUsingSecret(src, choice);
    if (!list.length) throw new Error(`No function uses the secret ${choice}.`);
    return list;
  }
  const names = choice.split(',').map((s) => s.trim()).filter(Boolean);
  if (!names.length) throw new Error('Nothing to redeploy: name a secret, "all", or functions separated by commas.');
  const unknown = names.filter((n) => !all.includes(n));
  if (unknown.length) throw new Error(`Not exported by functions/index.js: ${unknown.join(', ')}.`);
  return [...new Set(names)];
}

/** `firebase deploy --only` arguments, BATCH_SIZE functions each. */
export function onlyArguments(names, size = BATCH_SIZE) {
  const out = [];
  for (let i = 0; i < names.length; i += size) {
    out.push(names.slice(i, i + size).map((n) => `functions:${n}`).join(','));
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const src = readFileSync(resolve(root, 'functions/index.js'), 'utf8');
  try {
    for (const line of onlyArguments(selectFunctions(src, process.argv[2]))) console.log(line);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
