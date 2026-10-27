import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PACKAGE_ROOT } from '../lib/installer.mjs';

const SNAP = resolve(PACKAGE_ROOT, '.claude/skills/crew/scripts/snapshot.mjs');
const snap = (cwd, ...args) => spawnSync(process.execPath, [SNAP, ...args], { cwd, encoding: 'utf8' });

function fixture({ git = true, commit = false } = {}) {
  const dir = join(mkdtempSync(join(tmpdir(), 'snap probe ')), 'repo');
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'src/app.js'), 'export const limit = 10;\n');
  writeFileSync(join(dir, 'plan.md'), '# Plan\n');
  writeFileSync(join(dir, '.env'), 'SECRET=1\n');
  if (git) {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    writeFileSync(join(dir, '.gitignore'), '.env\ndata.db\n');
    if (commit) {
      execFileSync('git', ['add', '.'], { cwd: dir });
      execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init'], { cwd: dir });
    }
  }
  return dir;
}

for (const mode of [{ git: true, commit: false }, { git: true, commit: true }, { git: false }]) {
  test(`same-size content change invalidates a review scope (${JSON.stringify(mode)})`, () => {
    const dir = fixture(mode);
    assert.equal(snap(dir, 'capture', '.crew/base.json', '--exclude', 'plan.md').status, 0);
    const base = JSON.parse(readFileSync(join(dir, '.crew/base.json'), 'utf8'));
    assert.equal(base.files['.env'], undefined, 'secrets are never hashed');
    assert.equal(base.files['plan.md'], undefined, 'plan is excluded from source');

    writeFileSync(join(dir, 'src/app.js'), 'export const limit = 20;\n');
    writeFileSync(join(dir, 'src/new.js'), 'export const added = true;\n'); // untracked addition
    writeFileSync(join(dir, 'data.db'), 'runtime');
    const scope = snap(dir, 'scope', '.crew/base.json', '.crew/scope.json', '--criteria', 'plan.md');
    assert.equal(scope.status, 0, scope.stderr);
    assert.match(scope.stdout, /modified src\/app\.js/);
    assert.match(scope.stdout, /added\s+src\/new\.js/);
    if (mode.git) assert.doesNotMatch(scope.stdout, /data\.db/, 'git-ignored runtime files are not source');
    assert.equal(snap(dir, 'verify', '.crew/scope.json').status, 0);

    // Probe: same name, same line count, same byte length.
    writeFileSync(join(dir, 'src/app.js'), 'export const limit = 99;\n');
    const probe = snap(dir, 'verify', '.crew/scope.json');
    assert.equal(probe.status, 1);
    assert.match(probe.stdout, /content differs from reviewed source: src\/app\.js/);

    // Restore and the original verdict's scope matches again.
    writeFileSync(join(dir, 'src/app.js'), 'export const limit = 20;\n');
    assert.equal(snap(dir, 'verify', '.crew/scope.json').status, 0);

    // Criteria changes and new out-of-scope files are detected too.
    writeFileSync(join(dir, 'plan.md'), '# Plan v2\n');
    assert.match(snap(dir, 'verify', '.crew/scope.json').stdout, /criteria changed: plan\.md/);
    assert.equal(snap(dir, 'verify', '.crew/scope.json', '--source-only').status, 0, 'plan status edits do not invalidate source');
    writeFileSync(join(dir, 'src/app.js'), 'export const limit = 99;\n');
    assert.equal(snap(dir, 'verify', '.crew/scope.json', '--source-only').status, 1, 'source edits still do');
    writeFileSync(join(dir, 'src/app.js'), 'export const limit = 20;\n');
    writeFileSync(join(dir, 'plan.md'), '# Plan\n');
    writeFileSync(join(dir, 'src/extra.js'), 'x\n');
    assert.match(snap(dir, 'verify', '.crew/scope.json').stdout, /new change outside reviewed scope: src\/extra\.js/);
  });
}

for (const git of [false, true]) {
  test(`retargeting a symlink invalidates the scope (git: ${git})`, () => {
    const dir = fixture({ git });
    writeFileSync(join(dir, 'src/a.js'), 'export default 1;\n');
    writeFileSync(join(dir, 'src/b.js'), 'export default 2;\n');
    assert.equal(snap(dir, 'capture', '.crew/base.json', '--exclude', 'plan.md').status, 0);
    symlinkSync('a.js', join(dir, 'src/entry.js'));
    assert.equal(snap(dir, 'scope', '.crew/base.json', '.crew/scope.json').status, 0);
    assert.equal(snap(dir, 'verify', '.crew/scope.json').status, 0);
    rmSync(join(dir, 'src/entry.js'));
    symlinkSync('b.js', join(dir, 'src/entry.js'));
    const res = snap(dir, 'verify', '.crew/scope.json');
    assert.equal(res.status, 1);
    assert.match(res.stdout, /src\/entry\.js/);
  });
}

for (const git of [false, true]) {
  test(`same-content retarget and symlink/file swaps are detected (git: ${git})`, () => {
    const dir = fixture({ git });
    writeFileSync(join(dir, 'src/a.js'), 'same\n');
    writeFileSync(join(dir, 'src/b.js'), 'same\n');
    symlinkSync('a.js', join(dir, 'src/entry.js'));
    assert.equal(snap(dir, 'capture', '.crew/base.json').status, 0);
    rmSync(join(dir, 'src/entry.js'));
    symlinkSync('b.js', join(dir, 'src/entry.js'));
    assert.match(snap(dir, 'scope', '.crew/base.json', '.crew/s1.json').stdout, /modified src\/entry\.js/, 'retarget to identical content');

    // Replace the symlink with a regular file whose bytes spell the old link encoding.
    rmSync(join(dir, 'src/entry.js'));
    for (const lookalike of ['symlink\0b.js', 'symlink:b.js', 'b.js']) {
      rmSync(join(dir, 'src/entry.js'), { force: true });
      writeFileSync(join(dir, 'src/entry.js'), lookalike);
      assert.equal(snap(dir, 'verify', '.crew/s1.json').status, 1, `symlink replaced by look-alike file ${JSON.stringify(lookalike)}`);
    }
  });

  test(`a symlinked plan is judged by its contents (git: ${git})`, () => {
    const dir = fixture({ git });
    mkdirSync(join(dir, 'docs'));
    writeFileSync(join(dir, 'docs/plan.md'), '# Plan\n');
    rmSync(join(dir, 'plan.md'));
    symlinkSync('docs/plan.md', join(dir, 'plan.md'));
    assert.equal(snap(dir, 'capture', '.crew/base.json', '--exclude', 'plan.md', '--exclude', 'docs/plan.md').status, 0);
    assert.equal(snap(dir, 'scope', '.crew/base.json', '.crew/scope.json', '--criteria', 'plan.md').status, 0);
    writeFileSync(join(dir, 'docs/plan.md'), '# Plan, changed criteria\n');
    const res = snap(dir, 'verify', '.crew/scope.json');
    assert.equal(res.status, 1);
    assert.match(res.stdout, /criteria changed: plan\.md/);
  });
}

test('an old-format baseline is refused rather than compared', () => {
  const dir = fixture({ git: false });
  writeFileSync(join(dir, 'old.json'), JSON.stringify({ version: 1, files: {} }));
  const res = snap(dir, 'scope', 'old.json', 'scope.json');
  assert.equal(res.status, 2);
  assert.match(res.stderr, /capture a new baseline/);
});
