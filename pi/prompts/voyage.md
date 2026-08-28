---
description: Co-write, approve, and launch an armada voyage for a feature (isolated worktree, evidence-gated phases)
argument-hint: "<feature-name>"
---
You are running the armada loop. Load the `armada-contract` and `armada-voyage-finish` skills first, then:

1. Draft the contract for the feature "$1" with me, one question at a time (goal, stack constraints, phases, per-phase success criteria, final criteria).
2. Write it to `armada/REQUIREMENTS.md` with `Status: DRAFT`. Do not start implementation until I approve it (then set `Status: APPROVED`).
3. Once approved, run: `armada voyage "$1"`
4. After the voyage boots, monitor it with the `armada_fleet` tool and gate phase transitions per the `armada-gate` skill — evidence only (passing test runs, screenshots, file:line citations). Never advance on a claim.
