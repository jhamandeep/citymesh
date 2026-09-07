#!/usr/bin/env node
// Runs the root-level *.test.mjs suites and aggregates their exit codes.
//
// The suites are plain Node programs that throw on failure, so before this
// runner existed they had to be invoked one at a time by hand and nothing
// reported an overall pass/fail. CI needs a single non-zero exit.
//
//   node scripts/run-tests.mjs               unit suites (default)
//   node scripts/run-tests.mjs --integration integration suites only
//   node scripts/run-tests.mjs --all         everything
//
// Integration suites talk to a real workerd/D1/R2 server on localhost:3000 and
// fail with `fetch failed` when it is not running. They are listed explicitly
// rather than detected by filename, because the split does not follow the
// -api / -controls naming: two of the `-controls` suites are integration.

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const INTEGRATION = new Set([
  'observations-api.test.mjs',
  'shared-api.test.mjs',
  'shared-photos-api.test.mjs',
  'shared-photos-controls.test.mjs',
  'shared-surveys-api.test.mjs',
  'shared-surveys-controls.test.mjs',
]);

// Suites with a known, tracked failure that is not a defect in the code under
// test. They still run in CI, in a job that reports without gating merges, so
// the failure stays visible instead of being deleted or silently retried.
// Empty this set as the issues close.
//
//   network-controls.test.mjs — passes locally, times out in CI at the
//   whole-network "Export 30-site BIM" assertion even with a 90s ceiling,
//   while ifc-portfolio.test.mjs exercises the same export logic directly and
//   passes in 2.5s on the same runner. The export itself is therefore fine;
//   something about the jsdom UI path is environment-specific. See the
//   repository issues.
const QUARANTINE = new Set(['network-controls.test.mjs']);

const TIMEOUT_MS = 10 * 60 * 1000;

function run(file) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(
      process.execPath,
      ['--experimental-strip-types', file],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
    );

    let output = '';
    child.stdout.on('data', (c) => (output += c));
    child.stderr.on('data', (c) => (output += c));

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      output += `\n[runner] timed out after ${TIMEOUT_MS / 1000}s\n`;
    }, TIMEOUT_MS);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ file, code: code ?? 1, output, ms: Date.now() - started });
    });
  });
}

const args = new Set(process.argv.slice(2));
const mode = args.has('--all')
  ? 'all'
  : args.has('--integration')
    ? 'integration'
    : args.has('--quarantine')
      ? 'quarantine'
      : 'unit';

const all = (await readdir(ROOT)).filter((f) => f.endsWith('.test.mjs')).sort();

const selected = all.filter((f) => {
  if (mode === 'all') return true;
  if (mode === 'quarantine') return QUARANTINE.has(f);
  if (QUARANTINE.has(f)) return false;
  return mode === 'integration' ? INTEGRATION.has(f) : !INTEGRATION.has(f);
});

if (selected.length === 0) {
  console.error(`No ${mode} suites found.`);
  process.exit(1);
}

// Sequentially: several suites bind fake-indexeddb globals or share the
// single localhost:3000 server, so parallel runs interfere.
console.log(`Running ${selected.length} ${mode} suite(s)\n`);
const results = [];
for (const file of selected) {
  const result = await run(file);
  results.push(result);
  const secs = (result.ms / 1000).toFixed(1);
  if (result.code === 0) {
    console.log(`  PASS  ${file} (${secs}s)`);
  } else {
    console.log(`  FAIL  ${file} (${secs}s, exit ${result.code})`);
  }
}

const failed = results.filter((r) => r.code !== 0);

if (failed.length > 0) {
  console.log(`\n${'='.repeat(70)}`);
  for (const r of failed) {
    console.log(`\n--- ${r.file} (exit ${r.code}) ---`);
    console.log(r.output.trimEnd());
  }
  console.log(`${'='.repeat(70)}`);
}

const passed = results.length - failed.length;
console.log(`\n${passed}/${results.length} ${mode} suite(s) passed`);

if (failed.length > 0 && mode === 'integration') {
  console.log(
    '\nIntegration suites need a built app and a running server:\n' +
      '  npm run build && npm run db:migrate && npm start   # then, elsewhere:\n' +
      '  npm run test:integration',
  );
}

process.exit(failed.length > 0 ? 1 : 0);
