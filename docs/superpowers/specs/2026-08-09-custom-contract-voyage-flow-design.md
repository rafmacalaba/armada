# Custom Contract Voyage Flow

## Goal

Make `project.requirementsFile` authoritative throughout contract approval and voyage launch, while keeping non-trivial repository changes inside voyages by default.

## Design

The main checkout may use a configured relative contract path such as `armada/REQUIREMENTS-brand-assets.md`. Approval state records that path and hashes that exact file. Contract gates and snapshots resolve the same path from approval state, validate it, and copy its bytes into the sandbox's canonical `armada/REQUIREMENTS.md`, because the generated voyage agents and ledgers already use that canonical lane-local location.

The sandbox approval metadata retains the original source path for auditability, while its contract hash must match the canonical snapshot. No agent may repair approval state or snapshots manually. A mismatch fails launch before a voyage session starts.

The CLI voyage launch path passes configured contract identity into gate and snapshot functions. Legacy state with the default path continues to work. Invalid or missing custom paths fail with explicit errors rather than silently generating or using a stub.

The Commodore policy treats any clear net-new multi-file repository implementation as voyage work regardless of risk or size. Only isolated, genuinely small single-file changes may remain in-window. Low risk changes receive lighter staffing and evidence, not a different execution boundary.

## Testing

- Regression test approval and snapshot with a multi-section custom contract.
- Regression test that the custom source path is recorded and the canonical sandbox snapshot hashes identically.
- Regression test that the generated Commodore policy retains voyage-default behavior for multi-file work.
- Preserve existing default-contract, draft-contract, approval, isolation, and full-suite coverage.

## Non-goals

- No blanket `/tmp` access.
- No manual state repair path.
- No new CLI command or public workflow mode.
- No removal of existing custom `--requirements` support.
