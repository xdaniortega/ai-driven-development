# AI-driven development resources

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

## Why vertical slices

Plans are cut by **user behavior**, not by layer. Phase 1 is a thin walking skeleton from the real entry
point (UI, API, or CLI) through every layer, and each later phase adds one capability to that path. The
template enforces it: outcomes read "A  can  and sees ", each phase has a demo script, and a
boundary check rejects layer-named phases.

Why: every accepted phase works end to end and can be demoed, so integration problems surface in the first
phase instead of the last, reviews cover one small observable change, and cancelling later work still
leaves something usable.

This repository is a resource to import and adapt, not an application or a security audit. Read the
files; they are short. Role rules live in [`.claude/agents/`](.claude/agents/README.md), workflow rules in
[`.claude/skills/crew/`](.claude/skills/crew/README.md).

## Prerequisites

- Claude Code **2.1.277 or later** (reads `AGENTS.md` natively; verified with 2.1.311) and a working login.
- Node.js **20 or later** (used only by the initializer and the snapshot helper).

## Quickstart

### 1. Get the resource

```bash
git clone https://github.com/xdaniortega/ai-driven-development.git <kit-dir>
```

### 2. Initialize your project

```bash
cd <your-project>
node <kit-dir>/bin/ai-driven-development.mjs init
```

### 3. Check that it loaded

`/crew` appears when you type `/`.

## How to use (example)

### 4. Prompt the feature you want to develop

```text
/crew Build a tip jar dApp, local only (Hardhat/Anvil, no mainnet or testnet deploys).                                                                                                                                                 
   - Solidity contract TipJar: anyone can tip ETH with a short message; the owner can withdraw; emit a Tipped event.                                                                                                                     
   - Tests covering tipping, empty-tip revert, owner-only withdraw, and event emission.
   - Minimal Vite + viem frontend: connect wallet, send a tip, list recent tips from events. 
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

## Update or remove

```bash
node <kit-dir>/bin/ai-driven-development.mjs update     # refresh files you have not modified
node <kit-dir>/bin/ai-driven-development.mjs remove     # remove files you have not modified; undo merged settings
```

Neither command touches
`AGENTS.md`, your plans, or `.crew/`. Files you edited are reported and kept.

## Repository map

| Path | What |
|---|---|
| `.claude/agents/` | The four role definitions (installed) |
| `.claude/skills/crew/` | `/crew` skill, plan template, snapshot helper (installed) |
| `bin/`, `lib/` | The `init`/`update`/`remove` command |
| `AGENTS.md` | This repository's own decisions (not copied into your project) |

## Next steps

- Run the example on a real but low-risk change in your project and read every review packet.
- Tune per-role models and tools (see [.claude/agents/README.md](.claude/agents/README.md)).
- Add your domain constraints to `AGENTS.md` so every role and review uses them.
- Pick extensions only when you feel the gap: hooks, checkpoint commits, broader review
([.claude/skills/crew/README.md](.claude/skills/crew/README.md)).
