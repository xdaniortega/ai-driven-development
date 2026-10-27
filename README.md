# AI-driven development with Claude Code roles

A small, importable Claude Code setup for delivering changes as **reviewed vertical slices**.
Your main session becomes the **brain**; four subagents do focused work:

| Role | Does | Can |
|---|---|---|
| `scout` | Finds repository and documentation facts | read, search the web |
| `oracle` | Advises on one architecture, sequencing, or tradeoff decision | read |
| `executor` | Implements one authorized phase across the layers it needs | read, edit, run commands |
| `reviewer` | Gives a fresh, independent verdict on the exact changed source | read |

The `/crew` skill ties them together: plan in thin end-to-end phases, stop for your agreement, implement
one phase, re-check it, review it, correct it (at most twice), accept it, record lasting decisions in your
project's `AGENTS.md`, and resume later from files on disk.

This repository is a resource to import and adapt, not an application or a security audit. Read the
files; they are short. Role rules live in [`.claude/agents/`](.claude/agents/README.md), workflow rules in
[`.claude/skills/crew/`](.claude/skills/crew/README.md).

## Prerequisites

- Claude Code **2.1.277 or later** (reads `AGENTS.md` natively; verified with 2.1.311) and a working login.
- Node.js **20 or later** with npm (used only by the initializer and the snapshot helper).

## The journey

### 1. Get the resource

Choose one route. Both install the same files.

**npm.** The package is not yet on the public registry. Until it is, install the release tarball you
were given (or build one with `npm pack` in a clone):

```bash
cd <your-project>
npm install --save-dev <path-to>/ai-driven-development-0.1.0.tgz
npx ai-driven-development init --dry-run     # preview: nothing is written
npx ai-driven-development init
```

After publication the first line becomes `npm install --save-dev ai-driven-development`.
Installing the package alone changes nothing in your project; `init` does.

**Clone.**

```bash
git clone https://github.com/xdaniortega/ai-driven-development.git <kit-dir>
cd <your-project>
node <kit-dir>/bin/ai-driven-development.mjs init --dry-run
node <kit-dir>/bin/ai-driven-development.mjs init
```

### 2. Inspect what changed

`init` prints every action. It adds `.claude/agents/{scout,oracle,executor,reviewer}.md`,
`.claude/skills/crew/`, sets `env.CLAUDE_CODE_FORK_SUBAGENT="0"` in `.claude/settings.json` (merged, not
replaced) together with permissive allow rules and safety deny rules (no commits, pushes, publishing, or secret reads), ignores `.crew/` in `.gitignore`, and, only if you have a `CLAUDE.md`, appends an `@AGENTS.md`
import so your project knowledge loads. It stops without writing anything if a file or role name
conflicts with yours. Details: [.claude/README.md](.claude/README.md).

### 3. Check that it loaded

Start a **new** `claude` session in your project (settings are read at startup), then:

```text
/agents        → scout, oracle, executor, reviewer are listed under project agents
/memory        → your CLAUDE.md and/or AGENTS.md are listed
```

`/crew` appears when you type `/`.

### 4. Establish project knowledge

```text
/crew Establish project knowledge only: use scout to map this repository's architecture and how it is
tested, then create or update AGENTS.md with concise, verified project knowledge. Do not plan or change
any source yet.
```

Expect a scout report and a short `## Project knowledge (maintained by /crew)` section in `AGENTS.md`.
Existing text in `AGENTS.md` is kept. Read it; correct anything wrong yourself or ask the brain to.

### 5. Request a change

```text
/crew <describe the feature and its requirements>. Plan it in vertical phases using the crew plan
template, consult oracle on the phase boundaries, and stop for my agreement before implementing.
```

The brain uses `scout` for facts, asks `oracle` about consequential choices, writes `plan.md`, and
**stops**. Nothing in your source has changed yet.

### 6. Agree the phases

Open `plan.md`. Each phase should be a thin outcome you could demonstrate on its own (for example "a user
can add a tag to a note and see it in the list"), with subtasks across layers, acceptance criteria, checks,
and regression coverage. Reply with changes, or authorize:

```text
The plan is agreed, including your proposed defaults for the open decisions. Implement P1 only.
```

To change a decision, say so in the same message (for example "…agreed, but V2 should reject empty
segments").

### 7. Let one slice run

The brain snapshots the source, hands P1 to `executor`, inspects the diff, re-runs the checks itself,
freezes a content fingerprint, writes a review packet in `.crew/reviews/`, and asks a fresh `reviewer` for a
verdict. Blocking findings go back for correction (at most two rounds). P1 is accepted only with `PASS`,
passing checks, and an unchanged fingerprint. Nothing is committed.

Inspect: `git diff`, `plan.md` (P1 status and evidence), `.crew/reviews/P1-r*.md`, and the `AGENTS.md`
changes the reviewer approved with the code.

### 8. Resume in a fresh session

Close Claude Code, start a new session, and continue from disk:

```text
/crew resume. P2 is authorized; implement it.
```

After the last phase the brain reruns all checks and has `reviewer` assess the integrated change.

More prompts, grouped by intent: [docs/README.md](docs/README.md). The prompts in steps 4–8 are the ones
used in the verification run.

## Update or remove

```bash
npx ai-driven-development update     # refresh files you have not modified
npx ai-driven-development remove     # remove files you have not modified; undo merged settings
```

Use `node <kit-dir>/bin/ai-driven-development.mjs …` for the clone route. Neither command touches
`AGENTS.md`, your plans, or `.crew/`. Files you edited are reported and kept.

## Repository map

| Path | What |
|---|---|
| `.claude/agents/` | The four role definitions (installed) |
| `.claude/skills/crew/` | `/crew` skill, plan template, snapshot helper (installed) |
| `bin/`, `lib/` | The `init`/`update`/`remove` command |
| `docs/` | Prompt cookbook, verification notes, release guide |
| `AGENTS.md` | This repository's own decisions (not copied into your project) |
| `NOTICE.md` | Author and license notice |

## Next steps

- Run the journey on a real but low-risk change in your project and read every review packet.
- Tune per-role models and tools (see [.claude/agents/README.md](.claude/agents/README.md)).
- Add your domain constraints to `AGENTS.md` so every role and review uses them.
- Pick extensions only when you feel the gap: hooks, checkpoint commits, broader review
  ([.claude/skills/crew/README.md](.claude/skills/crew/README.md)).
