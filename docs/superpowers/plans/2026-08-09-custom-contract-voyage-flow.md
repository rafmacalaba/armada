# Custom Contract Voyage Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make configured custom contracts safe to approve and snapshot, and enforce voyage-default execution for non-trivial repository changes.

**Architecture:** Approval state is the source of truth for the selected main-checkout contract path and hash. Gate and snapshot resolve that path from state, then copy the approved bytes to canonical `sandbox/<name>/armada/REQUIREMENTS.md` for existing lane tooling. Generated Commodore policy keeps source implementation out of main checkout and routes multi-file changes through voyages.

**Tech Stack:** Node.js ESM, built-in `node:test`, YAML manifest rendering, Git worktrees.

## Global Constraints

- Preserve default `armada/REQUIREMENTS.md` behavior.
- Reject absolute and traversal contract paths.
- Never bypass approval, hash validation, or voyage isolation.
- Do not grant blanket external-directory or `/tmp` access.
- Main Commodore cannot edit product source files.

---

### Task 1: Add Custom Contract Regression Coverage

**Files:**
- Modify: `tests/voyage-workflow.test.js`
- Modify: `tests/contract-snapshot.test.js` or the existing contract snapshot test file identified by the test suite

**Interfaces:**
- Consumes: `approveContract`, `ensureApprovalState`, `checkContractApproval`, and `snapshotContract`.
- Produces: failing tests proving custom source path and canonical sandbox snapshot behavior.

- [ ] **Step 1: Add a failing custom-contract snapshot test**

Create a temporary repository containing `armada/REQUIREMENTS-brand-assets.md` with multiple sections and no default contract stub. Create approval state that names this file, then call the gate and snapshot APIs. Assert that the sandbox canonical `armada/REQUIREMENTS.md` exists, is byte-identical to the custom source, and has the approved hash.

- [ ] **Step 2: Add a failing custom-path gate test**

Assert that approval validation reads the configured custom file rather than silently checking `armada/REQUIREMENTS.md`.

- [ ] **Step 3: Run focused tests and verify expected failure**

Run: `node --test tests/contract-snapshot.test.js tests/voyage-workflow.test.js`

Expected: new custom-contract assertions fail because current gate and snapshot code hardcode `armada/REQUIREMENTS.md`.

### Task 2: Propagate Contract Path Through Approval and Snapshot

**Files:**
- Modify: `src/state/contract-approval.js`
- Modify: `src/voyage/contract-gate.js`
- Modify: `src/voyage/contract-snapshot.js`
- Modify: `src/cli.js`

**Interfaces:**
- Consumes: approval state field `contractPath`, relative project paths, and existing default behavior.
- Produces: `checkContractApproval(repoDir, contractPath?)`, `ensureApprovalState(repoDir, contractPath?)`, and `snapshotContract(repoDir, sandboxDir, contractPath?)` behavior that resolves one validated source path and writes canonical lane snapshots.

- [ ] **Step 1: Extend approval state creation to preserve selected contract path**

Store the validated relative source path in approval state. Default to `armada/REQUIREMENTS.md` when omitted. Keep hash calculation against the exact selected file bytes.

- [ ] **Step 2: Make gate resolve the selected contract**

Read `contractPath` from approval state when present, validate it as an in-repository relative path, and use it for existence, hash, and symlink checks. Accept an explicit path only when initializing state; never let a caller bypass the persisted approved path during later verification.

- [ ] **Step 3: Make snapshot copy selected source to canonical lane path**

Read the approved source path, verify its hash, copy it to `sandbox/armada/REQUIREMENTS.md`, and write sandbox approval metadata retaining `contractPath`. Preserve the existing post-copy byte and hash checks.

- [ ] **Step 4: Pass manifest requirements path from CLI launch**

Resolve `manifest.project.requirementsFile` from the main checkout before approval initialization and snapshot. Use default path when manifest is absent or omits the field. Refuse launch with an explicit error if configured path is missing or inconsistent.

- [ ] **Step 5: Run focused tests and verify green**

Run: `node --test tests/contract-snapshot.test.js tests/voyage-workflow.test.js`

Expected: all existing and new custom-contract tests pass.

### Task 3: Tighten Voyage-Default Commodore Policy

**Files:**
- Modify: `agents/orchestrator/prompt.template.md`
- Modify: `src/generator.js` only if rendered policy assertions require source-template changes
- Modify: `tests/voyage-workflow.test.js`

**Interfaces:**
- Consumes: existing generated policy and voyage command flow.
- Produces: policy that routes source, test, configuration, generated-artifact, or multi-file behavior changes to voyages, while allowing isolated single-file edits.

- [ ] **Step 1: Add a failing prompt regression assertion**

Assert the rendered Commodore prompt explicitly names source, tests, configuration, and generated artifacts as voyage-default work and forbids manual approval/snapshot repair.

- [ ] **Step 2: Update the policy wording**

State that any clear net-new multi-file repository implementation is voyage work regardless of project size or inferred risk. State that in-window work is limited to isolated single-file changes without cross-file behavior. State that approval and snapshot state must only be changed by the existing contract/voyage flow.

- [ ] **Step 3: Run focused prompt tests**

Run: `node --test tests/voyage-workflow.test.js`

Expected: all prompt and voyage workflow tests pass.

### Task 4: Full Verification

**Files:**
- No production files unless tests reveal a directly related regression.

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: zero failures.

- [ ] **Step 2: Verify generated artifacts**

Run: `npm pack --dry-run` and confirm package metadata remains unchanged except for intended source/test/docs changes.

- [ ] **Step 3: Review diff and worktree**

Run: `git diff --check` and `git status --short`. Confirm no generated `node_modules`, package tarball, or temporary contract state is included.
