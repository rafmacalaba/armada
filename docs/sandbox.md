# Sandbox — isolated feature lanes

A **sandbox** (`sandbox/<name>/`) is a dedicated worktree lane where armada runs a feature
voyage, keeping the live tree pristine. "Sandbox" (and the older term "dock") describe the same
thing: an isolated directory for one fleet-drive run. See
[process/triage.md](./process/triage.md) for the voyage-vs-in-window decision that decides
when a lane is created.

## Anatomy

```
sandbox/<name>/
├── armada/
│   ├── REQUIREMENTS.md     # the contract (phases + success criteria)
│   ├── armada.yaml         # manifest (armada-owned, regenerated)
│   ├── ledgers/<feature>/  # DEFECTS / ADVERSARIAL_REVIEW / SECURITY_FINDINGS
│   ├── e2e/<feature>/      # qa-owned end-to-end evidence
│   ├── screenshots/<feature>/
│   └── state/              # restart-proof per-feature state
└── opencode.json, AGENTS.md, .opencode/    # the scaffolded team
```

## How a lane is created

1. Create the lane: `git worktree add -b feat/<name> sandbox/<name>`.
2. Scaffold the team: `node ../../src/cli.js init --yes --yolo --budget balanced` (from the
   sandbox).
3. Write the contract at `sandbox/<name>/armada/REQUIREMENTS.md`.
4. Drive it: `tmux new-session -d -s <name> -c sandbox/<name> 'opencode'`, or
   `armada voyage sandbox/<name>`.

For the triage rule that decides when work earns a lane (vs. running in-window), see
[docs/process/triage.md](./process/triage.md).

## Finish

A lane is done only when it opens a reviewed PR and lands — never a local merge, never a direct
push to `master`.

## See also

- [docs/process/triage.md](./process/triage.md) — voyage vs. in-window decision, voyage splitting
- [README.md](../README.md) — "Isolate feature work", "Independent voyages"
- [docs/getting-started.md](./getting-started.md) — first feature walkthrough