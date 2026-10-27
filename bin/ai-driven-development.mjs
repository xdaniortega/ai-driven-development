#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { apply, MANIFEST, PACKAGE_ROOT, plan, remove, RESOURCES } from '../lib/installer.mjs';

const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'));
const HELP = `${pkg.name} ${pkg.version}
Import the /crew workflow (scout, oracle, executor, reviewer + vertical-phase plan template)
into a Claude Code project. Nothing is changed until you run one of these commands.

Usage:
  ${pkg.name} init   [--target <dir>] [--dry-run] [--overwrite]
  ${pkg.name} update [--target <dir>] [--dry-run] [--overwrite]
  ${pkg.name} remove [--target <dir>] [--dry-run]
  ${pkg.name} --help | --version

Commands:
  init     Copy the roles and /crew skill into <dir>/.claude, merge the required settings and permissions,
           ignore .crew/, and import AGENTS.md from an existing CLAUDE.md. Safe to repeat.
  update   Refresh installed files you have not modified (same rules as init).
  remove   Delete installed files you have not modified and undo the merged settings/blocks.
           Never removes AGENTS.md, plan files, or .crew/.

Options:
  --target <dir>  Project directory (default: current directory)
  --dry-run       Show what would change and write nothing
  --overwrite     Replace conflicting files with the packaged version, keeping a .bak-<time> copy
`;

function parse(argv) {
  const opts = { target: process.cwd(), dryRun: false, overwrite: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--target' || a === '-t') opts.target = argv[++i];
    else if (a.startsWith('--target=')) opts.target = a.slice(9);
    else if (a === '--dry-run' || a === '-n') opts.dryRun = true;
    else if (a === '--overwrite') opts.overwrite = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--version' || a === '-v') opts.version = true;
    else rest.push(a);
  }
  if (!opts.target) throw new Error('--target requires a directory');
  return { command: rest[0], extra: rest.slice(1), opts };
}

const LABELS = {
  create: 'create',
  update: 'update',
  replace: 'replace (backup kept)',
  unchanged: 'unchanged',
  'create-settings': 'create',
  'merge-settings': 'merge',
  'create-settings-permissions': 'create',
  'merge-permissions': 'merge',
  'create-gitignore': 'create',
  'merge-gitignore': 'append',
  'create-claude-md': 'create',
  'merge-claude-md': 'append',
};

function describe(action) {
  const label = (LABELS[action.kind] ?? action.kind).padEnd(22);
  if (action.rules) return `  ${label}${action.path}  permissions: ${action.rules.allow.length} allow, ${action.rules.deny.length} deny rules`;
  if (action.key) return `  ${label}${action.path}  env.${action.key}="${action.value}"`;
  if (action.kind.endsWith('gitignore')) return `  ${label}${action.path}  ignore .crew/ (managed block)`;
  if (action.kind.endsWith('claude-md')) return `  ${label}${action.path}  @AGENTS.md import (managed block)`;
  return `  ${label}${action.path}`;
}

function main() {
  const { command, extra, opts } = parse(process.argv.slice(2));
  if (opts.version) return console.log(pkg.version), 0;
  if (opts.help || !command) return console.log(HELP), command || opts.help ? 0 : 1;
  if (extra.length) throw new Error(`Unexpected argument: ${extra[0]}`);

  if (command === 'init' || command === 'update') {
    const result = plan(opts.target, { overwrite: opts.overwrite, mode: command });
    console.log(`${opts.dryRun ? 'Preview' : command} for ${result.target}`);
    result.actions.forEach((a) => console.log(describe(a)));
    result.warnings.forEach((w) => console.log(`warning: ${w}`));
    if (result.conflicts.length) {
      console.error('\nConflicts (nothing was written):');
      result.conflicts.forEach((c) => console.error(`  - ${c}`));
      console.error('\nResolve them, or re-run with --overwrite to replace conflicting files (backups are kept).');
      return 2;
    }
    if (opts.dryRun) return console.log('\nDry run: nothing was written.'), 0;
    const { backups } = apply(result);
    backups.forEach((b) => console.log(`  backup                ${b}`));
    console.log(`\nDone. Installed ${RESOURCES.length} files; record kept in ${MANIFEST}.`);
    console.log('Next: start a new Claude Code session in this project (settings load at startup), run /agents to');
    console.log('confirm scout, oracle, executor, reviewer, then try: /crew <describe the change you want>');
    return 0;
  }
  if (command === 'remove') {
    const { removed, kept } = remove(opts.target, { dryRun: opts.dryRun });
    removed.forEach((r) => console.log(`  ${opts.dryRun ? 'would remove' : 'removed'}  ${r}`));
    kept.forEach((k) => console.log(`  kept          ${k}`));
    if (opts.dryRun) console.log('\nDry run: nothing was written.');
    return 0;
  }
  throw new Error(`Unknown command "${command}". Run with --help.`);
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
}
