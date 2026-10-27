# Skills

A skill is a folder with a `SKILL.md` that Claude Code offers as a `/command` and can also load when
relevant ([docs](https://code.claude.com/docs/en/skills)). This kit ships one:

| Skill | Invoke | Purpose |
|---|---|---|
| [crew](crew/README.md) | `/crew <request>`, `/crew resume`, `/crew status` | Plan in vertical phases, deliver one authorized phase at a time through executor and reviewer, keep `AGENTS.md` current |

Type `/` in a session to see it. Supporting files (`plan-template.md`, `scripts/snapshot.mjs`) are
referenced from `SKILL.md` and read only when needed.

## Next steps

- Add skills for repeatable **procedures** (release checklist, migration recipe, deploy-to-testnet steps)
  rather than facts. Facts about your project belong in `AGENTS.md`.
- Keep each skill short and link supporting files instead of inlining them.
- If a skill should only run when you ask, set `disable-model-invocation: true` in its frontmatter.
