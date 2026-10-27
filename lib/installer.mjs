// Explicit, conservative importer for the crew workflow resources.
// It never runs on npm install; it only runs when the user calls the CLI.

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'));

export const RESOURCES = [
  '.claude/agents/scout.md',
  '.claude/agents/oracle.md',
  '.claude/agents/executor.md',
  '.claude/agents/reviewer.md',
  '.claude/skills/crew/SKILL.md',
  '.claude/skills/crew/README.md',
  '.claude/skills/crew/plan-template.md',
  '.claude/skills/crew/scripts/snapshot.mjs',
];
export const AGENT_NAMES = ['scout', 'oracle', 'executor', 'reviewer'];
export const SKILL_NAME = 'crew';
export const MANIFEST = '.claude/ai-driven-development.json';
export const SETTINGS = '.claude/settings.json';
export const REQUIRED_ENV = { CLAUDE_CODE_FORK_SUBAGENT: '0' };
const BLOCK_START = '# >>> ai-driven-development >>>';
const BLOCK_END = '# <<< ai-driven-development <<<';
const MD_START = '<!-- >>> ai-driven-development >>> -->';
const MD_END = '<!-- <<< ai-driven-development <<< -->';

// Imports resolve relative to the file that contains them.
const agentsImport = (claudeMdPath) => (claudeMdPath.startsWith('.claude/') ? '../AGENTS.md' : 'AGENTS.md');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const read = (p) => (existsSync(p) ? readFileSync(p) : null);
const readText = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

function frontmatterName(text) {
  if (!text?.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  const block = end === -1 ? '' : text.slice(3, end);
  const line = block.split(/\r?\n/).find((l) => /^name\s*:/.test(l));
  if (!line) return null;
  const raw = line.replace(/^name\s*:\s*/, '');
  const quoted = raw.match(/^(["'])(.*?)\1/);
  return (quoted ? quoted[2] : raw.replace(/\s+#.*$/, '')).trim() || null;
}

function loadManifest(target) {
  const text = readText(join(target, MANIFEST));
  return text ? JSON.parse(text) : null;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function appendBlock(text, block) {
  const base = text ?? '';
  const sep = base === '' || base.endsWith('\n\n') ? '' : base.endsWith('\n') ? '\n' : '\n\n';
  const added = `${sep}${block}\n`;
  return { text: `${base}${added}`, added };
}

/** Compute every intended change without writing anything. */
export function plan(targetDir, { overwrite = false, mode = 'init' } = {}) {
  const target = resolve(targetDir);
  const manifest = loadManifest(target);
  const actions = [];
  const conflicts = [];
  const warnings = [];
  if (!existsSync(target)) throw new Error(`Target directory does not exist: ${target}`);
  if (mode === 'update' && !manifest) throw new Error(`No ${MANIFEST} found in ${target}. Run "init" first.`);

  // 1. Resource files.
  for (const rel of RESOURCES) {
    const source = readFileSync(join(PACKAGE_ROOT, rel));
    const dest = join(target, rel);
    const current = read(dest);
    const recorded = manifest?.files?.[rel];
    if (!current) actions.push({ kind: 'create', path: rel, hash: sha256(source) });
    else if (sha256(current) === sha256(source)) actions.push({ kind: 'unchanged', path: rel, hash: sha256(source) });
    else if (recorded && recorded === sha256(current)) actions.push({ kind: 'update', path: rel, hash: sha256(source) });
    else if (overwrite) actions.push({ kind: 'replace', path: rel, hash: sha256(source) });
    else conflicts.push(`${rel} exists with different content${recorded ? ' (modified since it was installed)' : ' (not installed by this tool)'}`);
  }

  // 2. Name collisions with differently named files that would shadow or be shadowed by ours.
  const agentsDir = join(target, '.claude/agents');
  if (existsSync(agentsDir)) {
    for (const file of readdirSync(agentsDir)) {
      if (!file.endsWith('.md') || AGENT_NAMES.includes(file.slice(0, -3))) continue;
      const name = frontmatterName(readText(join(agentsDir, file)));
      if (AGENT_NAMES.includes(name)) conflicts.push(`.claude/agents/${file} already defines an agent named "${name}"; rename it or remove it first`);
    }
  }
  const skillsDir = join(target, '.claude/skills');
  if (existsSync(skillsDir)) {
    for (const dir of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!dir.isDirectory() || dir.name === SKILL_NAME) continue;
      const name = frontmatterName(readText(join(skillsDir, dir.name, 'SKILL.md')));
      if (name === SKILL_NAME) conflicts.push(`.claude/skills/${dir.name}/SKILL.md already defines a skill named "${SKILL_NAME}"`);
    }
  }
  if (existsSync(join(target, '.claude/commands/crew.md'))) conflicts.push('.claude/commands/crew.md already defines a /crew command');

  // 3. Settings: merge only the env keys the workflow needs.
  const settingsPath = join(target, SETTINGS);
  const settingsText = readText(settingsPath);
  let settings = {};
  if (settingsText !== null) {
    try {
      settings = JSON.parse(settingsText);
    } catch {
      settings = undefined;
    }
    const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    if (!isObject(settings) || (settings.env !== undefined && !isObject(settings.env))) {
      conflicts.push(`${SETTINGS} is not a valid JSON object with an object "env"; fix it or add the env settings manually`);
      settings = null;
    }
  }
  const addedEnv = { ...(manifest?.settings?.addedEnv ?? {}) };
  if (settings) {
    for (const [key, value] of Object.entries(REQUIRED_ENV)) {
      const existing = settings.env?.[key];
      if (existing === undefined) {
        actions.push({ kind: settingsText === null ? 'create-settings' : 'merge-settings', path: SETTINGS, key, value });
        addedEnv[key] = value;
      } else if (existing !== value) {
        warnings.push(`${SETTINGS} sets env.${key}="${existing}"; left unchanged. /crew needs "${value}" so the brain can wait for subagents (see .claude/README.md).`);
      }
    }
  }

  // 4. .gitignore: local workflow records stay out of Git.
  const gitignore = readText(join(target, '.gitignore'));
  const ignored = gitignore?.split(/\r?\n/).some((l) => ['.crew', '.crew/', '/.crew', '/.crew/'].includes(l.trim()));
  if (!ignored) actions.push({ kind: gitignore === null ? 'create-gitignore' : 'merge-gitignore', path: '.gitignore' });

  // 5. Instructions: make sure AGENTS.md is loaded when a CLAUDE.md takes precedence over it.
  const claudeCandidates = ['CLAUDE.md', '.claude/CLAUDE.md'];
  const claudeMd = claudeCandidates.find((p) => existsSync(join(target, p)));
  if (claudeMd) {
    const text = readText(join(target, claudeMd));
    if (!new RegExp(`^\\s*@(\\./)?${escapeRe(agentsImport(claudeMd))}\\s*$`, 'm').test(text)) {
      actions.push({ kind: 'merge-claude-md', path: claudeMd });
    }
  } else if (existsSync(join(target, 'CLAUDE.local.md'))) {
    actions.push({ kind: 'create-claude-md', path: 'CLAUDE.md' });
  }

  return { target, manifest, actions, conflicts, warnings, addedEnv };
}

/** Apply a plan. Refuses to write anything when conflicts exist. */
export function apply(result) {
  const { target, manifest, actions, conflicts, addedEnv } = result;
  if (conflicts.length) return { written: false };
  const files = { ...(manifest?.files ?? {}) };
  const created = { ...(manifest?.created ?? {}) };
  const blocks = { ...(manifest?.blocks ?? {}) };
  const addBlock = (dest, rel, block) => {
    const { text, added } = appendBlock(readText(dest), block);
    writeFileSync(dest, text);
    blocks[rel] = added;
  };
  const backups = [];
  for (const action of actions) {
    const dest = join(target, action.path);
    switch (action.kind) {
      case 'create':
      case 'update':
      case 'replace':
        if (action.kind === 'replace') {
          const backup = `${dest}.bak-${Date.now()}`;
          copyFileSync(dest, backup);
          backups.push(backup);
        }
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(join(PACKAGE_ROOT, action.path), dest);
        files[action.path] = action.hash;
        break;
      case 'unchanged':
        files[action.path] = action.hash;
        break;
      case 'create-settings':
      case 'merge-settings': {
        const settings = JSON.parse(readText(dest) ?? '{}');
        settings.env = { ...(settings.env ?? {}), [action.key]: action.value };
        mkdirSync(dirname(dest), { recursive: true });
        if (action.kind === 'create-settings' && !existsSync(dest)) created.settings = true;
        writeFileSync(dest, `${JSON.stringify(settings, null, 2)}\n`);
        break;
      }
      case 'create-gitignore':
      case 'merge-gitignore':
        if (action.kind === 'create-gitignore') created.gitignore = true;
        addBlock(dest, action.path, `${BLOCK_START}\n.crew/\n${BLOCK_END}`);
        break;
      case 'create-claude-md':
      case 'merge-claude-md':
        if (action.kind === 'create-claude-md') created.claudeMd = action.path;
        addBlock(dest, action.path, `${MD_START}\n@${agentsImport(action.path)}\n${MD_END}`);
        break;
      default:
        throw new Error(`Unknown action ${action.kind}`);
    }
  }
  const data = {
    package: PKG.name,
    version: PKG.version,
    files,
    settings: { addedEnv },
    created,
    blocks,
  };
  mkdirSync(join(target, '.claude'), { recursive: true });
  writeFileSync(join(target, MANIFEST), `${JSON.stringify(data, null, 2)}\n`);
  return { written: true, backups };
}

/** Remove only what this tool installed and the user has not modified. */
export function remove(targetDir, { dryRun = false } = {}) {
  const target = resolve(targetDir);
  const manifest = loadManifest(target);
  if (!manifest) throw new Error(`No ${MANIFEST} found in ${target}; nothing to remove.`);
  const removed = [];
  const kept = [];
  const op = (fn) => (dryRun ? undefined : fn());

  for (const [rel, hash] of Object.entries(manifest.files ?? {})) {
    if (!RESOURCES.includes(rel)) {
      kept.push(`${rel} (listed in ${MANIFEST} but not a file this tool installs; ignored)`);
      continue;
    }
    const dest = join(target, rel);
    const current = read(dest);
    if (!current) continue;
    if (sha256(current) === hash) {
      op(() => rmSync(dest));
      removed.push(rel);
    } else kept.push(`${rel} (modified after install)`);
  }
  for (const dir of ['.claude/skills/crew/scripts', '.claude/skills/crew', '.claude/skills', '.claude/agents']) {
    const abs = join(target, dir);
    if (!dryRun && existsSync(abs) && readdirSync(abs).length === 0) rmdirSync(abs);
  }

  const settingsPath = join(target, SETTINGS);
  const settingsText = readText(settingsPath);
  if (settingsText) {
    try {
      const settings = JSON.parse(settingsText);
      let changed = false;
      for (const [key, value] of Object.entries(manifest.settings?.addedEnv ?? {})) {
        if (settings.env?.[key] === value) {
          delete settings.env[key];
          changed = true;
          removed.push(`${SETTINGS} env.${key}`);
        }
      }
      if (settings.env && Object.keys(settings.env).length === 0) delete settings.env;
      if (changed) {
        const empty = Object.keys(settings).filter((k) => k !== '$schema').length === 0;
        op(() => (empty && manifest.created?.settings ? rmSync(settingsPath) : writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`)));
      }
    } catch {
      kept.push(`${SETTINGS} (not valid JSON; remove env keys manually)`);
    }
  }

  const strip = (rel, start, end, createdFlag) => {
    const abs = join(target, rel);
    const text = readText(abs);
    if (!text || !text.includes(start)) return;
    const added = manifest.blocks?.[rel];
    if (!added || !text.includes(added)) {
      kept.push(`${rel} (managed block was edited or not recorded; remove it manually)`);
      return;
    }
    const next = text.replace(added, '');
    removed.push(`${rel} (managed block)`);
    op(() => (createdFlag && next.trim() === '' ? rmSync(abs) : writeFileSync(abs, next)));
  };
  strip('.gitignore', BLOCK_START, BLOCK_END, manifest.created?.gitignore);
  for (const rel of ['CLAUDE.md', '.claude/CLAUDE.md']) strip(rel, MD_START, MD_END, manifest.created?.claudeMd === rel);

  op(() => rmSync(join(target, MANIFEST)));
  for (const keep of ['AGENTS.md', '.crew', 'plan.md']) if (existsSync(join(target, keep))) kept.push(`${keep} (project data; not removed)`);
  return { removed, kept };
}
