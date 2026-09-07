#!/usr/bin/env node
// Applies every drizzle-generated migration to the LOCAL D1 emulator, in
// journal order, so the integration suites have a schema to talk to.
//
//   npm run build && npm run db:migrate
//
// Requires a prior `npm run build`: wrangler reads dist/server/wrangler.json
// for the D1 binding. State is kept project-local under .wrangler/state, which
// is gitignored, so this never touches a deployed database.
//
// These are drizzle SQL files rather than wrangler's own migrations format, so
// they are executed directly instead of via `wrangler d1 migrations apply`.
// The statements are idempotent enough to re-run on an existing local database
// only if it is empty; delete .wrangler/state to start clean.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = join(ROOT, 'dist', 'server', 'wrangler.json');
const WRANGLER = join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

if (!existsSync(CONFIG)) {
  console.error(
    `Missing ${CONFIG}\nRun \`npm run build\` first — wrangler needs the built config for the D1 binding.`,
  );
  process.exit(1);
}

// Prefer the journal's recorded order; fall back to filename order.
let files;
const journalPath = join(ROOT, 'drizzle', 'meta', '_journal.json');
if (existsSync(journalPath)) {
  const journal = JSON.parse(await readFile(journalPath, 'utf8'));
  files = journal.entries
    .sort((a, b) => a.idx - b.idx)
    .map((e) => `${e.tag}.sql`);
} else {
  files = (await readdir(join(ROOT, 'drizzle')))
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

console.log(`Applying ${files.length} migration(s) to the local D1 emulator`);

let applied = 0;
let skipped = 0;

for (const file of files) {
  process.stdout.write(`  ${file} ... `);
  // Invoke wrangler's JS entrypoint with the current node binary rather than
  // the npx shim: Node refuses to spawn .cmd files without shell:true, so the
  // shim fails silently on Windows. This path behaves the same on Linux CI.
  const result = spawnSync(
    process.execPath,
    [
      WRANGLER,
      'd1',
      'execute',
      'DB',
      '--local',
      '--file',
      join('drizzle', file),
      '--config',
      CONFIG,
      '--persist-to',
      '.wrangler/state',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );

  const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  if (result.status !== 0) {
    // The drizzle SQL uses bare CREATE TABLE / CREATE INDEX, so re-running a
    // migration on a database that already has it is an error rather than a
    // no-op. Treat that specific case as "already applied" so the script is
    // safe to re-run against an existing local database; anything else fails.
    if (/already exists/i.test(combined)) {
      console.log('already applied');
      skipped += 1;
      continue;
    }
    console.log('FAILED');
    console.error(combined.trim() || `wrangler exited ${result.status}`);
    console.error(
      '\nTo rebuild the local database from scratch, delete .wrangler/state and re-run.',
    );
    process.exit(result.status ?? 1);
  }
  console.log('ok');
  applied += 1;
}

console.log(
  `Local D1 schema ready (${applied} applied, ${skipped} already present).`,
);
