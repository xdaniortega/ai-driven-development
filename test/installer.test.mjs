import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { RESOURCES, MANIFEST, PACKAGE_ROOT } from '../lib/installer.mjs';

const CLI = resolve(PACKAGE_ROOT, 'bin/ai-driven-development.mjs');

function project(name = 'host project') {
  // Paths contain spaces on purpose.
  const dir = join(mkdtempSync(join(tmpdir(), 'add crew ')), name);
  mkdirSync(dir, { recursive: true });
  return dir;
}
function run(args, cwd) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
}
const text = (dir, rel) => readFileSync(join(dir, rel), 'utf8');
const json = (dir, rel) => JSON.parse(text(dir, rel));
function write(dir, rel, content) {
  mkdirSync(join(dir, rel, '..'), { recursive: true });
  writeFileSync(join(dir, rel), content);
}

test('--help and --version work without touching the project', () => {
  const dir = project();
  const help = run(['--help'], dir);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /init/);
  assert.equal(run(['--version'], dir).stdout.trim(), json(PACKAGE_ROOT, 'package.json').version);
  assert.equal(existsSync(join(dir, '.claude')), false);
});

test('fresh project: init installs everything, dry-run writes nothing', () => {
  const dir = project();
  const preview = run(['init', '--dry-run', '--target', dir], tmpdir());
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(existsSync(join(dir, '.claude')), false);

  const res = run(['init', '--target', dir], tmpdir());
  assert.equal(res.status, 0, res.stderr);
  for (const rel of RESOURCES) assert.equal(text(dir, rel), text(PACKAGE_ROOT, rel), rel);
  assert.deepEqual(json(dir, '.claude/settings.json'), { env: { CLAUDE_CODE_FORK_SUBAGENT: '0' } });
  assert.match(text(dir, '.gitignore'), /^\.crew\/$/m);
  assert.equal(existsSync(join(dir, 'CLAUDE.md')), false, 'no CLAUDE.md is created when none is needed');
  assert.equal(existsSync(join(dir, 'AGENTS.md')), false, 'AGENTS.md belongs to the brain, not the installer');
});

test('configured project: existing settings and instructions are preserved and merged once', () => {
  const dir = project();
  const settings = { permissions: { allow: ['Bash(npm test)'] }, env: { FOO: 'bar' } };
  write(dir, '.claude/settings.json', JSON.stringify(settings));
  write(dir, 'CLAUDE.md', '# House rules\n\nUse tabs.\n');
  write(dir, 'AGENTS.md', '# Agents\n\nRun npm test.\n');
  write(dir, '.gitignore', 'node_modules\n');
  write(dir, '.claude/agents/linter.md', '---\nname: linter\ndescription: lints\n---\nLint.\n');

  assert.equal(run(['init'], dir).status, 0);
  const merged = json(dir, '.claude/settings.json');
  assert.deepEqual(merged.permissions, settings.permissions);
  assert.deepEqual(merged.env, { FOO: 'bar', CLAUDE_CODE_FORK_SUBAGENT: '0' });
  assert.ok(text(dir, 'CLAUDE.md').startsWith('# House rules\n\nUse tabs.\n'));
  assert.match(text(dir, 'CLAUDE.md'), /^@AGENTS\.md$/m);
  assert.equal(text(dir, 'AGENTS.md'), '# Agents\n\nRun npm test.\n');
  assert.ok(text(dir, '.gitignore').startsWith('node_modules\n'));
  assert.equal(text(dir, '.claude/agents/linter.md'), '---\nname: linter\ndescription: lints\n---\nLint.\n');

  // Repeat run: nothing duplicated, nothing changed.
  const snapshot = ['CLAUDE.md', '.gitignore', '.claude/settings.json', MANIFEST].map((r) => text(dir, r));
  const again = run(['init'], dir);
  assert.equal(again.status, 0, again.stderr);
  assert.deepEqual(['CLAUDE.md', '.gitignore', '.claude/settings.json', MANIFEST].map((r) => text(dir, r)), snapshot);
  assert.equal(text(dir, 'CLAUDE.md').match(/@AGENTS\.md/g).length, 1);
});

test('CLAUDE.md that already imports AGENTS.md is left alone', () => {
  const dir = project();
  write(dir, 'CLAUDE.md', '@AGENTS.md\n');
  assert.equal(run(['init'], dir).status, 0);
  assert.equal(text(dir, 'CLAUDE.md'), '@AGENTS.md\n');
});

test('conflicts: same-path file, same agent name, or same skill name blocks all writes', () => {
  for (const [rel, content] of [
    ['.claude/agents/reviewer.md', '---\nname: reviewer\ndescription: mine\n---\nMine.\n'],
    ['.claude/agents/my-scout.md', '---\nname: scout\ndescription: mine\n---\nMine.\n'],
    ['.claude/skills/workflow/SKILL.md', '---\nname: crew\ndescription: mine\n---\nMine.\n'],
  ]) {
    const dir = project();
    write(dir, rel, content);
    const res = run(['init'], dir);
    assert.equal(res.status, 2, rel);
    assert.match(res.stderr, /Conflicts/);
    assert.equal(text(dir, rel), content);
    assert.equal(existsSync(join(dir, MANIFEST)), false);
    assert.equal(existsSync(join(dir, '.claude/skills/crew/SKILL.md')), false);
  }
});

test('--overwrite replaces a same-path conflict and keeps a backup', () => {
  const dir = project();
  write(dir, '.claude/agents/reviewer.md', '---\nname: reviewer\ndescription: mine\n---\nMine.\n');
  const res = run(['init', '--overwrite'], dir);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(text(dir, '.claude/agents/reviewer.md'), text(PACKAGE_ROOT, '.claude/agents/reviewer.md'));
  assert.match(res.stdout, /backup/);
});

test('invalid settings JSON is reported, not overwritten', () => {
  const dir = project();
  write(dir, '.claude/settings.json', '{ // comment\n}');
  const res = run(['init'], dir);
  assert.equal(res.status, 2);
  assert.equal(text(dir, '.claude/settings.json'), '{ // comment\n}');
});

test('a user value for fork mode is kept with a warning', () => {
  const dir = project();
  write(dir, '.claude/settings.json', JSON.stringify({ env: { CLAUDE_CODE_FORK_SUBAGENT: '1' } }));
  const res = run(['init'], dir);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /warning/);
  assert.equal(json(dir, '.claude/settings.json').env.CLAUDE_CODE_FORK_SUBAGENT, '1');
});

test('update refreshes pristine files and refuses user-modified ones', () => {
  const dir = project();
  assert.notEqual(run(['update'], dir).status, 0, 'update requires a prior init');
  assert.equal(run(['init'], dir).status, 0);

  // Simulate an older pristine install of scout.md.
  const manifest = json(dir, MANIFEST);
  write(dir, '.claude/agents/scout.md', 'old version\n');
  manifest.files['.claude/agents/scout.md'] = createHash('sha256').update('old version\n').digest('hex');
  write(dir, MANIFEST, JSON.stringify(manifest));
  // And a user edit of oracle.md.
  write(dir, '.claude/agents/oracle.md', 'my edits\n');

  const res = run(['update'], dir);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /oracle\.md exists with different content \(modified since it was installed\)/);
  assert.equal(text(dir, '.claude/agents/scout.md'), 'old version\n', 'nothing written while a conflict exists');
});

test('update applies when only pristine files differ', () => {
  const dir = project();
  assert.equal(run(['init'], dir).status, 0);
  const manifest = json(dir, MANIFEST);
  write(dir, '.claude/agents/scout.md', 'old version\n');
  manifest.files['.claude/agents/scout.md'] = createHash('sha256').update('old version\n').digest('hex');
  write(dir, MANIFEST, JSON.stringify(manifest));
  const res = run(['update'], dir);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /update\s+\.claude\/agents\/scout\.md/);
  assert.equal(text(dir, '.claude/agents/scout.md'), text(PACKAGE_ROOT, '.claude/agents/scout.md'));
});

test('remove deletes only pristine installed files and undoes merges', () => {
  const dir = project();
  write(dir, '.claude/settings.json', JSON.stringify({ permissions: { allow: ['Read'] } }));
  write(dir, 'CLAUDE.md', '# Rules\n');
  write(dir, '.gitignore', 'dist\n');
  write(dir, '.claude/agents/linter.md', '---\nname: linter\ndescription: lints\n---\n');
  assert.equal(run(['init'], dir).status, 0);
  write(dir, '.claude/agents/oracle.md', 'my edits\n');
  write(dir, 'AGENTS.md', '# Knowledge\n');

  const res = run(['remove'], dir);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(existsSync(join(dir, '.claude/agents/scout.md')), false);
  assert.equal(existsSync(join(dir, '.claude/skills/crew')), false);
  assert.equal(text(dir, '.claude/agents/oracle.md'), 'my edits\n');
  assert.equal(text(dir, '.claude/agents/linter.md'), '---\nname: linter\ndescription: lints\n---\n');
  assert.deepEqual(json(dir, '.claude/settings.json'), { permissions: { allow: ['Read'] } });
  assert.equal(text(dir, 'CLAUDE.md'), '# Rules\n');
  assert.equal(text(dir, '.gitignore'), 'dist\n');
  assert.equal(text(dir, 'AGENTS.md'), '# Knowledge\n');
  assert.equal(existsSync(join(dir, MANIFEST)), false);
});

test('remove on a fresh install leaves no installer-created files', () => {
  const dir = project();
  assert.equal(run(['init'], dir).status, 0);
  assert.equal(run(['remove'], dir).status, 0);
  for (const rel of ['.claude/settings.json', '.gitignore', '.claude/agents', '.claude/skills', MANIFEST]) {
    assert.equal(existsSync(join(dir, rel)), false, rel);
  }
});

test('CLAUDE.local.md alone gets a CLAUDE.md import so AGENTS.md still loads', () => {
  const dir = project();
  write(dir, 'CLAUDE.local.md', 'personal\n');
  assert.equal(run(['init'], dir).status, 0);
  assert.match(text(dir, 'CLAUDE.md'), /^@AGENTS\.md$/m);
  assert.equal(run(['remove'], dir).status, 0);
  assert.equal(existsSync(join(dir, 'CLAUDE.md')), false);
  assert.equal(text(dir, 'CLAUDE.local.md'), 'personal\n');
});

test('remove keeps managed blocks the user edited', () => {
  const dir = project();
  write(dir, 'CLAUDE.md', '# Rules\n');
  assert.equal(run(['init'], dir).status, 0);
  write(dir, '.gitignore', text(dir, '.gitignore').replace('.crew/\n', '.crew/\nsecrets/\n'));
  write(dir, 'CLAUDE.md', text(dir, 'CLAUDE.md').replace('@AGENTS.md\n', '@AGENTS.md\nAlways run npm test.\n'));
  const res = run(['remove'], dir);
  assert.equal(res.status, 0, res.stderr);
  assert.match(text(dir, '.gitignore'), /secrets\//);
  assert.match(text(dir, 'CLAUDE.md'), /Always run npm test\./);
  assert.match(res.stdout, /managed block was edited/);
});

test('remove ignores manifest entries outside the installed resources', () => {
  const dir = project();
  assert.equal(run(['init'], dir).status, 0);
  write(dir, 'AGENTS.md', 'knowledge\n');
  write(dir, '../sentinel.txt', 'outside\n');
  const manifest = json(dir, MANIFEST);
  const h = (s) => createHash('sha256').update(s).digest('hex');
  manifest.files['AGENTS.md'] = h('knowledge\n');
  manifest.files['../sentinel.txt'] = h('outside\n');
  write(dir, MANIFEST, JSON.stringify(manifest));
  const res = run(['remove'], dir);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(text(dir, 'AGENTS.md'), 'knowledge\n');
  assert.equal(text(dir, '../sentinel.txt'), 'outside\n');
  assert.match(res.stdout, /not a file this tool installs/);
});

test('.claude/CLAUDE.md gets a relative ../AGENTS.md import, once, and removal restores it', () => {
  const dir = project();
  write(dir, '.claude/CLAUDE.md', '# Nested rules\n');
  assert.equal(run(['init'], dir).status, 0);
  assert.match(text(dir, '.claude/CLAUDE.md'), /^@\.\.\/AGENTS\.md$/m);
  assert.equal(run(['init'], dir).status, 0);
  assert.equal(text(dir, '.claude/CLAUDE.md').match(/AGENTS\.md/g).length, 1);
  assert.equal(run(['remove'], dir).status, 0);
  assert.equal(text(dir, '.claude/CLAUDE.md'), '# Nested rules\n');
});

test('agent names with YAML comments or quotes still count as collisions', () => {
  for (const line of ['name: scout # custom agent', 'name: "scout" # quoted', "name: 'reviewer'"]) {
    const dir = project();
    write(dir, '.claude/agents/mine.md', `---\n${line}\ndescription: mine\n---\nMine.\n`);
    const res = run(['init'], dir);
    assert.equal(res.status, 2, line);
    assert.equal(existsSync(join(dir, MANIFEST)), false, line);
  }
});

test('settings that are not a JSON object are refused before any write', () => {
  for (const content of ['true', '[]', '{"env": ["x"]}']) {
    const dir = project();
    write(dir, '.claude/settings.json', content);
    const res = run(['init'], dir);
    assert.equal(res.status, 2, content);
    assert.equal(text(dir, '.claude/settings.json'), content);
    assert.equal(existsSync(join(dir, '.claude/agents')), false, content);
  }
});
