---
name: armada-resume
description: Resume a killed or interrupted armada session. Use on session start or when nextAction is non-empty. Triggers on: resume, reconcile, killed session, /armada-resume.
---

# Armada: Session Resume

When a session is interrupted (crash, timeout, kill), resume from the last saved state. Do not re-execute completed work. Surface any drift between state and reality.

## Rules

1. On session start, read `armada/state/active.json`. If it exists, the session is being resumed.
2. Run `armada reconcile` (or `node src/cli.js reconcile`) to detect drift: phases whose status differs from what is on disk.
3. Print the resume line and drift list. The resume line shows the active feature, last phase, and next action.
4. Continue execution from `nextAction`. Do not re-dispatch phases whose status is `"passed"`.
5. If `phaseGraph.phases[*].status` is `"dispatched"`, check if the subagent returned evidence. If not, re-dispatch that phase.

Example: `armada reconcile` shows Phase 2 `dispatched` but no evidence on disk — re-dispatch Phase 2.
