# What gets imported into your project

The initializer (`init`) copies a fixed set of files and merges three small settings. It never runs on `npm install`, never replaces a whole file you own, and writes nothing if it finds a conflict.

## Copied

| Path in your project | Purpose |
|---|---|
| `.claude/agents/scout.md`, `oracle.md`, `executor.md`, `reviewer.md` | The four subagents |
| `.claude/skills/crew/SKILL.md` | The `/crew` workflow the brain follows |
| `.claude/skills/crew/plan-template.md` | Canonical vertical-phase plan template |
| `.claude/skills/crew/README.md` | How to use `/crew` |
| `.claude/skills/crew/scripts/snapshot.mjs` | Content fingerprints for review identity |
| `.claude/ai-driven-development.json` | Record of installed file hashes and merges, used by `update`/`remove` |

**Not copied:** this repository's `AGENTS.md`, its `.claude/settings.json`, READMEs outside the skill, docs, tests, and anything under `verification-results`. Your project's `AGENTS.md` is written by the brain from *your* project, not from this kit.

## Merged

| File | Change | Why |
|---|---|---|
| `.claude/settings.json` | adds `env.CLAUDE_CODE_FORK_SUBAGENT = "0"` if unset | Lets the brain wait for each subagent's result. Since Claude Code 2.1.302 fork mode is on by default, and while it is on an interactive session cannot wait for a subagent ([docs](https://code.claude.com/docs/en/sub-agents#let-claude-wait-for-a-subagent)). |
| `.claude/settings.json` | appends missing `permissions.allow` rules: `Read`, `Glob`, `Grep`, `Edit`, `Write`, and common build/test/Foundry/Hardhat and read-only git `Bash` commands; and `permissions.deny` rules for `git commit/push/checkout/branch/reset/stash`, `npm publish`, `sudo`, `rm -rf`, piped `curl`/`wget`, and `.env`/`.pem`/`.key` reads | Once you approve a plan, the executor edits and runs checks without prompts. Anything not listed still asks you, and `deny` always wins. `remove` deletes only the rules `init` added. Permissions are project-wide, so read-only roles stay read-only through their `tools` allowlists. |
| `.gitignore` | appends a marked block ignoring `.crew/` | Workflow records stay local |
| `CLAUDE.md` or `.claude/CLAUDE.md` (only if one exists, or if only `CLAUDE.local.md` exists) | appends a marked import of the root `AGENTS.md` (`@AGENTS.md`, or `@../AGENTS.md` from `.claude/`) | Claude reads `AGENTS.md` automatically only when no `CLAUDE.md`/`CLAUDE.local.md` exists ([docs](https://code.claude.com/docs/en/memory#agents-md)) |

Existing keys, permissions, hooks, and text are preserved. When `settings.json` needs a change it is rewritten as 2-space JSON, so array formatting may change; values do not. If you already set `CLAUDE_CODE_FORK_SUBAGENT` to another value, `init` leaves it and prints a warning.

## Conflicts

`init` stops, lists every conflict, and writes nothing when:

- a file it would copy already exists with different content that it did not install,
- another file in `.claude/agents/` declares `name: scout|oracle|executor|reviewer`,
- another skill or `.claude/commands/crew.md` defines `crew`,
- `.claude/settings.json` is not a valid JSON object (with an object `env`, if present).

Resolve by renaming or removing your file, or deliberately replace same-path files with `init --overwrite` (each replaced file is backed up as `<file>.bak-<timestamp>`). To keep your own `reviewer`, rename yours (file and `name:`) before importing. Project agents take precedence over agents with the same name in `~/.claude/agents/`.

## Update and remove

`update` refreshes only files whose hash still matches the install record; edited files are conflicts. `remove` deletes only unmodified installed files, removes the merged env key and the marked blocks you have not edited (edited blocks are reported and kept), and keeps `AGENTS.md`, plans, and `.crew/`. It only ever deletes the files listed above, whatever the install record says.

## Next steps

- **Customize roles in place.** Edit the agent files; `update` will then report them as yours instead of overwriting them.
- **Project-level policy.** Add `permissions.deny` rules (for example `Bash(git push *)`) in your settings to enforce rules the workflow only states.
- **Team defaults.** Commit `.claude/` so the whole team gets the same roles; keep personal overrides in `.claude/settings.local.json`.
