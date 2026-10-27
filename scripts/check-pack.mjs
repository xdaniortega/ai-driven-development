#!/usr/bin/env node
// Verifies the npm publish boundary: required runtime assets are packed, private material is not.
import { execFileSync } from 'node:child_process';
import { RESOURCES } from '../lib/installer.mjs';

const [report] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8' }));
const files = report.files.map((f) => f.path);
const required = [...RESOURCES, 'bin/ai-driven-development.mjs', 'lib/installer.mjs', 'package.json', 'README.md', 'LICENSE'];
const forbidden = [/^\.crew\//, /plan\.md$/, /^test\//, /^docs\//, /^scripts\//, /^verification/, /\.env/, /\.pem$/, /\.key$/, /\.tgz$/, /settings(\.local)?\.json$/, /^AGENTS\.md$/, /^CLAUDE/];

const missing = required.filter((f) => !files.includes(f));
const leaked = files.filter((f) => forbidden.some((re) => re.test(f)) && !required.includes(f));
console.log(`${report.name}@${report.version}: ${files.length} files, ${report.size} bytes packed`);
files.forEach((f) => console.log(`  ${f}`));
if (missing.length || leaked.length) {
  missing.forEach((f) => console.error(`missing: ${f}`));
  leaked.forEach((f) => console.error(`must not be packed: ${f}`));
  process.exit(1);
}
console.log('pack boundary OK');
