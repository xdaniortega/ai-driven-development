# AI-driven Development Workflow

A small, importable workflow for delivering changes as **reviewed vertical slices**.
Your main session becomes the **brain**; four roles do focused work:

| Role | Does | Can |
|---|---|---|
| `scout` | Finds repository and documentation facts | read, search the web |
| `oracle` | Advises on one architecture, sequencing, or tradeoff decision | read |
| `executor` | Implements one authorized phase across the layers it needs | read, edit, run commands |
| `reviewer` | Gives a fresh, independent verdict on the exact changed source | read |

The `/crew` skill ties them together: plan in thin end-to-end phases, stop for your agreement, implement
one phase, re-check it, review it, correct it (at most twice), accept it, record lasting decisions in your
project's `AGENTS.md`, and resume later from files on disk.

## Planning: vertical slicing

With horizontal slicing, progress means completing a technical layer. With vertical slicing, progress means
delivering a working behavior through the layers it needs.

This demo pretends to demonstrate other ways of planning. In this case, for full MVP demos, vertical slicing
gives earlier integration feedback and something useful to demonstrate. Horizontal tasks still make sense
for changes genuinely confined to one layer, such as a database migration or compiler upgrade.

Plans are cut by **user behavior**, not by layer. Phase 1 is a thin walking skeleton from the real entry
point (UI, API, or CLI) through every layer, and each later phase adds one capability to that path. The
template enforces it: outcomes read "A <user> can <action> and sees <result>", each phase has a demo
script, and a boundary check rejects layer-named phases.

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
