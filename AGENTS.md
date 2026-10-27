# ai-driven-development

Importable Claude Code resource: four subagents (scout, oracle, executor, reviewer), the `/crew` skill, a
vertical-phase plan template, and a small initializer distributed through npm and by cloning.

## Architecture

- **One canonical resource set.** The files under `.claude/agents/` and `.claude/skills/crew/` are what
  both the clone route and the npm package install. `RESOURCES` in `lib/installer.mjs` and `files` in
  `package.json` must list the same installed files; `npm run check` enforces the publish boundary.
- **Explicit initialization only.** No npm lifecycle scripts. `init`/`update`/`remove` change a host
  project only when called, refuse to write on any conflict, and track installed hashes in
  `.claude/ai-driven-development.json` so user edits are never overwritten or deleted.
- **Native Claude Code only.** No runtime orchestration, daemons, or extensions. Read-only roles are
  enforced with `tools` allowlists; other workflow rules are instructions and documented as such.
- **Review identity is content.** `snapshot.mjs` fingerprints file contents (tracked and untracked, with or
  without commits); names, HEAD, and diff stats are not identity.
- **Host knowledge belongs to the host.** This file is not copied into projects; the brain writes the
  host's `AGENTS.md` from that project's evidence.

## Constraints

- Node >= 20, zero runtime dependencies.
- Every README has a **Next steps** section; optional machinery goes there, not into the default.
- No sample application, transcripts, verification fixtures, credentials, or personal paths in the repo
  or package. Verification evidence lives outside the repository.
- The default never commits, pushes, branches, or broadcasts to mainnet.
- Publishing to npm is a manual owner action; no publish automation.

## Commands

- `npm test` — installer and snapshot tests (temporary projects with spaces in paths)
- `npm run check` — tests plus `npm pack --dry-run` boundary check
