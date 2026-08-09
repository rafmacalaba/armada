# Voyage Orchestration Design

## Goal

Make main-window and tmux voyage orchestration explicit without adding commands,
skills, or CLI surfaces. Main Commodore decides delivery mode and launches a
voyage. Voyage Commodore owns implementation inside its sandbox.

## Scope

This change covers:

- Main Commodore mode selection and automatic voyage launch after contract approval.
- Removal of runtime dependence on `docs/process/triage.md`.
- Existing voyage command and permission wiring.
- Approved contract propagation from main checkout to sandbox.
- Explicit ownership prompt for tmux Voyage Commodore.
- Focused tests for permissions, prompts, launch ordering, contract snapshots, and isolation.

This change does not add:

- A new command, skill, or CLI tool.
- Live phase-state synchronization between main and voyage state.
- Automatic merging or direct pushes to `master`.

## Ownership Model

### Main Commodore

Main window owns:

1. Classifying requests as in-window work or voyage work.
2. Co-writing the main `armada/REQUIREMENTS.md` contract.
3. Obtaining explicit user contract approval.
4. Marking the approved contract and invoking the existing voyage flow.
5. Reporting sandbox and tmux session details.
6. Reviewing final evidence and PR result.

Main Commodore must not implement voyage work in the main checkout.

### Voyage Commodore

Tmux session owns:

1. Worktree-local contract and implementation.
2. Specialist dispatch.
3. Phase gates, QA, evidence, and adversarial review.
4. PR creation from the voyage branch.

Voyage Commodore must not re-triage, launch another voyage, or modify the main
checkout. User may attach to the tmux session for observation or intervention,
but attachment does not change ownership.

## Delivery Mode Context

Triage policy is embedded in the generated orchestrator prompt rather than
loaded from `docs/process/triage.md` at runtime.

Main-window guidance:

- Questions, reviews, investigations, small low-risk edits, and ledger maintenance stay in-window.
- Net-new multi-file work, independent contract/evidence/PR work, or work needing fleet orchestration becomes a voyage.
- Ask at most one scope clarification.
- After contract approval, launch existing voyage flow automatically.
- Do not implement voyage work in the main checkout.

Voyage guidance:

- This session is Voyage Commodore for one named sandbox.
- Do not re-triage or create another voyage.
- Dispatch workers only inside the named sandbox.
- Own phase gates, QA, evidence, and PR.
- Never modify the main checkout.

## Existing Launch Flow

Use existing surfaces in this order:

1. Main Commodore co-writes and approves main contract.
2. Existing voyage setup creates `feat/<name>` and `sandbox/<name>`.
3. Existing launch path validates approved contract.
4. Approved main contract is copied into sandbox and verified byte-for-byte.
5. Existing lane initialization runs without replacing the approved snapshot.
6. Existing tmux boot starts `opencode` with sandbox as cwd.
7. Existing drive handshake sends Voyage Commodore ownership prompt.

Invalid approval must stop launch before tmux boot. Failed snapshot must not
leave a running voyage session.

The existing contract approval state remains the implementation mechanism. The
normal workflow connects contract `Status: APPROVED` to that state internally
during existing voyage launch; no separate approval command is introduced.

## Permissions

Extend only main orchestrator permission allowlists for existing launch forms:

- `armada feature new ...`
- `armada init ...`
- `armada voyage ...`
- `armada voyage-handoff ...`
- Exact `node src/cli.js <same command>` fallback forms if required by the generated command.

Arbitrary Bash remains denied. Main orchestrator source edits remain denied.
Worker restrictions remain unchanged.

## Test Strategy

Tests are scoped to observable workflow boundaries and use existing project test
patterns. No real browser or persistent tmux dependency is required.

### Generated Prompt Tests

Verify generated main prompt:

- embeds delivery-mode rules;
- contains automatic launch after approval;
- forbids implementation of voyage work in main checkout;
- does not reference `docs/process/triage.md`.

Verify generated voyage prompt:

- identifies Voyage Commodore and exact sandbox;
- assigns implementation, gates, QA, evidence, and PR ownership;
- forbids re-triage, nested voyage launch, and main-checkout writes.

### Permission Tests

Verify main orchestrator can invoke existing voyage setup commands while it
still cannot edit source files or run arbitrary Bash.

### Contract and Launch Tests

Using temporary repositories and fake Git/tmux executables or existing injected
execution seams, verify:

- approved main contract is copied byte-for-byte into sandbox;
- sandbox approval hash matches copied contract;
- DRAFT contract refuses before worktree/session creation;
- changed approved contract refuses before tmux boot;
- snapshot failure produces no running tmux session;
- tmux cwd is sandbox, never main checkout;
- voyage prompt references sandbox contract.

### Isolation Tests

Verify sandbox contract and simulated implementation writes do not alter main
checkout. Verify generated voyage instructions never direct writes to main paths.

### Regression Command

Run the focused workflow suite and the complete existing suite:

```bash
node --test tests/voyage-workflow.test.js
node --test 'tests/*.test.js'
```

## Success Criteria

1. Main Commodore can automatically launch an approved voyage using existing commands.
2. Voyage Commodore receives explicit sandbox ownership and does not re-triage.
3. Approved contract reaches sandbox before tmux boot and remains byte-identical.
4. Invalid approval prevents worktree/session launch.
5. Main source remains protected from voyage implementation.
6. Focused workflow tests fail before fixes and pass after fixes.
7. Existing test suite remains green.
