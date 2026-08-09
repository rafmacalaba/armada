# Sandbox — isolated feature lanes

A **sandbox** (`sandbox/<name>/`) is a dedicated worktree lane where armada runs a feature voyage, keeping the live tree pristine. An isolated directory for one fleet-drive run. See [self-improvement.md](./self-improvement.md) for how voyages run.

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
2. Scaffold the team: `node ../../src/cli.js init --yes --yolo --budget balanced` (from the sandbox).
3. Write the contract at `sandbox/<name>/armada/REQUIREMENTS.md`.
4. Drive it: `armada voyage sandbox/<name>`.

## Finish

A lane is done only when it opens a reviewed PR and lands — never a local merge, never a direct push to `master`.

## See also

- [self-improvement.md](./self-improvement.md) — self-improvement loop & voyage workflow
- [user-guide.md](./user-guide.md) — fleet concepts and day-to-day commands
- [README.md](../README.md) — parallel feature work