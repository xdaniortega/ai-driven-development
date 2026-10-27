# Roles

The main session is the **brain**: it owns intent, the plan, delegation, acceptance, and `AGENTS.md`.
The four files here are Claude Code [subagents](https://code.claude.com/docs/en/sub-agents). Each starts
with a fresh context: it sees its definition, the delegation message, and project instructions, never
the brain's conversation.

| Role | When the brain uses it | It returns |
|---|---|---|
| [scout](scout.md) | A fact about the repo or docs is uncertain | Facts marked verified/assumed with references, relevant files, patterns, risks, unknowns |
| [oracle](oracle.md) | A consequential choice is open: architecture, data model, phase boundaries, sequencing | Recommendation, rationale, alternatives, risks, open questions |
| [executor](executor.md) | A phase is authorized | Changed files, real check results, assumptions, unverified behavior, risks |
| [reviewer](reviewer.md) | Every phase, and the integrated change at the end | `PASS`, `REVISION_NEEDED`, or `BLOCKED` with distinct findings |

The oracle advises; the brain decides. Do not use the oracle to restate settled facts.

## Enforced versus agreed

**Enforced by Claude Code** (the `tools` field is an allowlist):

- scout, oracle, and reviewer have no `Edit`, `Write`, or `Bash`, so they cannot change files or run commands.
- No role has the `Agent` tool, so no role can start other agents.

**Agreed in instructions only** (the model follows them; nothing technically prevents a breach):

- the executor is the only writer of application source and implements only the authorized phase;
- nobody commits or pushes; the brain does not implement source itself;
- the brain owns the plan, `.crew/`, and `AGENTS.md`.

Your permission mode still applies to the executor's edits and commands.

## Models

Each role pins a model and effort in its frontmatter, matching the tiers in `.pi/model-tiers.json`
(frontier for judgment roles, smaller for fact-gathering and implementation):

| Role | `model` | `effort` |
|---|---|---|
| scout | `sonnet` | `medium` |
| oracle | `opus` | `xhigh` |
| executor | `sonnet` | `medium` |
| reviewer | `sonnet` | `xhigh` |

Available models and effort levels depend on your plan. If an alias is unavailable, set that role to
`model: inherit` (and drop `effort:`) to run on your session's model. To see what a subagent ran on,
use `/tasks`. Note: `CLAUDE_CODE_SUBAGENT_MODEL`, if set, overrides these per-role models.

## Next steps

- **Domain knowledge.** Preload a project skill into a role with the `skills:` field, or add a short
  domain section to its file (for example contract-security checks for the reviewer).
- **Narrower access.** Drop `WebFetch`/`WebSearch` from scout for offline projects; give executor a
  `permissionMode` or hooks that block risky commands.
- **Extra roles** only when justified, for example a `security-reviewer` used on authorization or
  contract phases. Add it to the `/crew` skill's role table so the brain knows when to call it.
