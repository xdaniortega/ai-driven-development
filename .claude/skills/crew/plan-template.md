# <Change name>

<!--
Canonical /crew plan template. Keep every top-level section, in this order.
Write facts you verified; record unknowns as Variables or open decisions, never as invented facts.
Delete these comments when you write a real plan.
-->

## Problem

<!-- What is wrong or missing today, for whom, and the evidence (paths, issues, specification references). -->

## Solution

<!-- The intended outcome in a few bullets. Name the specification requirements (R1, R2, ...) this change must satisfy so phases can trace back to them. -->

## Variables

<!-- Unknowns and open decisions. For each: what is unknown, why it matters, how it will be resolved (Scout fact, Oracle advice, user decision), and its current state. -->

## Constraints/Invariants

<!-- Rules that must hold throughout: existing behavior to preserve, security and data rules, AGENTS.md decisions, network/deployment limits (no mainnet broadcasts unless explicitly agreed). -->

## Implementation Notes

<!-- Relevant existing architecture, reusable code, Scout facts (with path:line), Oracle recommendations, and accepted decisions. -->

## Workflow

Baseline: <!-- how the starting source state was captured, e.g. `.crew/baseline.json` -->

Phases are **vertical slices**: each delivers one thin, observable outcome across only the layers it needs
(database/contract, service/API, frontend, validation). Layers are subtasks inside a phase, never separate phases.
Fold enabling work into the first phase that needs it. Tests belong to the phase whose behavior they establish.

### P1 — <observable outcome, phrased as what a user or caller can now do>

- **Outcome:** <what can be demonstrated when this phase is accepted>
- **Satisfies:** <requirement IDs / accepted decisions>
- **Scope:** <included; explicitly excluded>
- **Subtasks:**
  - [ ] <layer>: <thin change needed for this outcome>
  - [ ] <layer>: <...>
  - [ ] checks: <tests or scripted checks that prove the integrated outcome>
- **Depends on:** <earlier phases, or "baseline">; **Open decisions:** <none | variable IDs>
- **Acceptance criteria:**
  1. <observable behavior, including relevant failure behavior>
- **Checks/evidence:** <exact commands or observations that prove each criterion end to end>
- **Regression coverage:** <how previously accepted behavior stays covered>
- **Status:** pending <!-- pending | current | implemented | accepted | blocked -->
- **Evidence:** <filled in on acceptance: check results, review verdict, scope fingerprint>

### P2 — <next outcome>

<!-- Same fields. Prefer more, thinner phases over one large phase. -->

### Phase boundary check (complete before asking for agreement)

- [ ] Every phase is demonstrable on its own; none waits for a later "integration" or "testing" phase.
- [ ] No phase is a single layer (schema-only, API-only, UI-only) unless the change genuinely has only that layer.
- [ ] Every requirement in Solution maps to at least one phase.
- [ ] Dependencies run forward only, and each phase lists regression coverage for earlier ones.

## Deliverables

<!-- Concrete files, behaviors, docs, and AGENTS.md knowledge updates expected at the end. -->

## Definition of Done

<!-- Every phase accepted; cumulative checks pass; integrated review PASS over the whole change; AGENTS.md updated with accepted durable decisions only. -->

## Validation

<!-- Cumulative checks to run at the end across all phases, and how the integrated review is scoped (baseline → final). -->
