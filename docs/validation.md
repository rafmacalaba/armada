# Validation

Evidence from validating armada against real repos. This document is the restored home for the
results that older TODO entries referenced as `docs/validation.md`.

## Real-repo validation (`data-ai-chatbot`, 2026-08-03)

Validated against `~/WBG/data-ai-chatbot` (FastAPI + Next.js): stack detection, native agent
load (`opencode agent list`), background orchestration
(`OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true`), and prompt tuning against real
conventions. Live re-scaffold + on-screen walkthrough remain user-side steps.

## Restart-proof resume

Verified in a generated repo: after init, open a feature, kill the session mid-phase,
`armada reconcile` (/`armada-resume`) prints the resume line + drift list, resume completes
with no state loss. Shipped in `feat/real-repo-validation` (#53); walkthrough at
`armada/state/evidence/phase-2/manual-walkthrough.md`.

## 5-phase dependency graph

End-to-end run of the dependency-ordered phase graph (dependency gating, collision-aware
serialization, parallel qa/adversary gate work; 5/5 tests). Since the live tree stays pristine,
full results are filed under the validation feature's state/evidence.

## Skills self-load

A qa subagent in a sandbox (which ships zero skills) loaded the global
`verification-before-completion` skill — proof that the `skill` tool + global skill discovery
work in generated repos. See [TODO.md "Skills integration"](../TODO.md).

## See also

- [docs/armada-improves-armada.md](./armada-improves-armada.md) — self-improvement loop
- [docs/process/triage.md](./process/triage.md) — voyage vs. in-window
- [TODO.md](../TODO.md) — shipped-validation entries that point here