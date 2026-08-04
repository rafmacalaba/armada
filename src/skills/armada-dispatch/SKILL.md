---
name: armada-dispatch
description: Dispatch subagents in parallel with disjoint file scope. Use when facing 2+ independent tasks, multiple files, or parallel phases. Triggers on: parallelize, dispatch subagents, run in parallel.
---

# Armada: Parallel Subagent Dispatch

When two or more tasks are independent, dispatch them as parallel subagents. The key constraint: parallel tasks must write disjoint files. Shared files force serialization.

## Rules

1. Build a dependency graph from the phase list. Independent phases (no shared deps) can run in parallel.
2. Check file scope: two phases can run in parallel only if they never write the same file. Prefer per-phase file isolation (e.g. `src/<feature>.js` + its test).
3. Backend-dev and frontend-dev within the same phase can run in parallel when the API contract is fixed first, since they write different source trees.
4. Wait for all dispatched subagents to return before gating the phase. Do not end your turn with background work outstanding.
5. When NOT to parallelize: shared output file, sequential dependency between tasks, or one task's output is the other's input. Serialize writers on a reused subagent session.

Example: Phase 2 (API) and Phase 3 (UI) are independent and write `src/api/` vs `src/ui/` — dispatch both as parallel background subagents.
