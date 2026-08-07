# armada improves armada

The two-mode workflow by which armada uses itself to build itself. This document is the
restored home for the two-mode self-improvement narrative; the **triage decision** (voyage vs.
in-window, and voyage splitting) now lives in [docs/process/triage.md](./process/triage.md),
which is the single authority for *whether and how* a request runs.

## The two modes

armada improves itself in one of two modes:

- **Patrol (audit)** — the fleet reviews armada's own code and documents, files findings against
  a ledger, and proposes fixes. Read-only; the fix itself ships as a feature.
- **Voyage (feature)** — the fleet implements armada's next feature in a dedicated lane
  (`sandbox/<name>/` worktree, `feat/<name>` branch, contract at `armada/REQUIREMENTS.md`,
  evidence gates, PR-first finish) so the live repo stays clean.

## The loop

1. A request arrives. Triage decides: in-window (question, review, small doc/process edit,
   ledger maintenance, work already in an approved lane) or a voyage (net-new multi-file
   functionality, independent contract + evidence + PR). See
   [docs/process/triage.md](./process/triage.md).
2. Approved voyages scaffold a team, co-write the contract, run evidence-gated phases, and
   finish PR-first — never a local merge or a direct push to `master`.
3. Patrol audits feed the backlog; recurring clusters become template-edit PRs.

## Glossary note

Older armada docs used **Lane A** (audit) and **Lane B** (feature). The canonical terms are
**patrol** and **voyage** (shipped #63). `armada drive` is a deprecated alias for
`armada voyage`.

## See also

- [docs/process/triage.md](./process/triage.md) — voyage vs. in-window, and voyage splitting
- [docs/self-improvement.md](./self-improvement.md) — pitch-level overview of the loop
- [docs/sandbox.md](./sandbox.md) — what a lane worktree is and how it isolates work
- [ARCHITECTURE.md](../ARCHITECTURE.md) — "The self-improvement loop"
- [TODO.md](../TODO.md) — roadmap and shipped self-improvement items

---

*Last updated 2026-08-07 by the workflow-triage docs reconciliation.*