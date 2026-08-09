# Voyage Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make main Commodore automatically launch approved voyages while tmux Voyage Commodore owns all implementation inside its sandbox, without adding commands, skills, or CLI surfaces.

**Architecture:** Embed delivery-mode guidance in generated orchestrator prompts. Reuse existing `armada feature new`, `armada init`, and `armada voyage` launch paths, adding only narrow orchestrator permission allowances. Make existing voyage launch connect `Status: APPROVED` contracts to current snapshot approval state before tmux boot; keep main and sandbox files isolated.

**Tech Stack:** Node.js ESM, Node test runner, generated Markdown/config artifacts, Git worktrees, tmux handshake seam.

## Global Constraints

- Do not add commands, skills, or CLI tools.
- Main Commodore decides mode, approves contract, launches voyage, and reviews result; it does not implement voyage work.
- Voyage Commodore owns implementation, phase gates, QA, evidence, and PR inside one sandbox.
- Voyage must never use main checkout as cwd or direct implementation writes there.
- Invalid approval must prevent worktree/session launch.
- Contract snapshot must complete before tmux boot and remain byte-identical.
- Use TDD: each production change follows a failing focused test.
- Do not commit changes unless explicitly requested by user.

---

## File Map

- Modify `src/generator.js`: generated main/voyage prompt context and narrow orchestrator command permissions.
- Modify `src/cli.js`: connect approved contract status to existing approval/snapshot launch path and make launch ordering transactional.
- Modify `src/voyage/contract-snapshot.js` only if existing snapshot API needs the smallest approval-state bridge.
- Modify `src/drive.js` only if existing boot prompt arguments need explicit voyage ownership metadata.
- Modify generated artifacts through existing rendering/scaffolding path or update their source templates consistently.
- Create `tests/voyage-workflow.test.js`: focused generated prompt, permission, launch-order, contract propagation, and isolation tests.
- Remove runtime triage references from `agents/orchestrator/prompt.template.md`, generated artifacts, and stale tests/docs only where required by existing consistency guards.

## Task 1: Add Failing Workflow Contract Tests

**Files:**
- Create: `tests/voyage-workflow.test.js`
- Read: `src/generator.js`, `src/cli.js`, `src/voyage/contract-snapshot.js`, `src/drive.js`

**Interfaces:**
- Tests consume existing pure renderers and existing launch/snapshot seams.
- Tests produce named failures that define required prompt, permission, approval, ordering, and isolation behavior before implementation changes.

- [ ] **Step 1: Write failing generated-prompt tests**

  Add tests with exact behavior names:

  ```js
  test("main Commodore prompt embeds delivery mode and automatic voyage launch")
  test("main Commodore prompt does not depend on process triage document")
  test("voyage prompt assigns sandbox implementation ownership without re-triage")
  ```

  Assert rendered prompt text contains main/voyage ownership rules, automatic launch after approval, and no `docs/process/triage.md` runtime reference.

- [ ] **Step 2: Write failing permission tests**

  Assert generated orchestrator permissions allow existing `armada feature new`, `armada init`, `armada voyage`, and `armada voyage-handoff` invocations while preserving source edit denial and arbitrary Bash denial.

- [ ] **Step 3: Write failing launch and snapshot tests**

  Use temporary directories and the existing fake execution seams. Add tests named:

  ```js
  test("approved main contract snapshots before voyage tmux boot")
  test("draft contract refuses before worktree and tmux creation")
  test("changed approved contract refuses before tmux boot")
  test("tmux voyage cwd and prompt target sandbox")
  test("snapshot failure does not leave running voyage session")
  ```

  Record Git/tmux calls and assert ordering: approval validation, worktree creation, snapshot, lane setup, tmux creation, prompt send.

- [ ] **Step 4: Write failing isolation tests**

  Assert sandbox contract and simulated implementation writes do not change main contract or main source files.

- [ ] **Step 5: Run focused tests and verify expected failures**

  Run:

  ```bash
  node --test tests/voyage-workflow.test.js
  ```

  Expected: failures identify missing delivery context, missing launch permissions, missing approval bridge, incorrect ordering, or missing isolation behavior. Fix test setup errors until failures are behavior failures.

## Task 2: Embed Main and Voyage Delivery Context

**Files:**
- Modify: `src/generator.js` prompt renderers around `renderOrchestratorPrompt` and `renderArmadaVoyageCommand`.
- Modify: `agents/orchestrator/prompt.template.md` if generated source requires synchronized template text.
- Modify: generated prompt artifacts through the repository’s normal renderer/scaffold mechanism.
- Test: `tests/voyage-workflow.test.js`

**Interfaces:**
- `renderOrchestratorPrompt(manifest, ...)` emits main Commodore mode rules.
- `renderArmadaVoyageCommand()` emits launch instructions and passes explicit voyage identity.

- [ ] **Step 1: Implement minimal main-mode context**

  Embed concise rules for in-window work, voyage-by-exception, one clarification maximum, automatic launch after approval, and prohibition on implementing voyage work in main checkout. Remove runtime instruction to read `docs/process/triage.md`.

- [ ] **Step 2: Implement explicit Voyage Commodore context**

  Change launch prompt text so tmux session is identified as Voyage Commodore for named voyage and sandbox path. State no re-triage, no nested voyage, no main-checkout writes, and ownership of implementation/evidence/PR.

- [ ] **Step 3: Run prompt tests**

  Run:

  ```bash
  node --test tests/voyage-workflow.test.js
  ```

  Expected: prompt tests pass; launch/snapshot tests remain failing.

## Task 3: Permit Existing Launch Flow Without Broad Shell Access

**Files:**
- Modify: `src/generator.js` `BASE_PERMISSIONS.orchestrator` Bash rules.
- Modify: generated orchestrator frontmatter/config through normal rendering.
- Test: `tests/voyage-workflow.test.js`

**Interfaces:**
- Generated orchestrator Bash permission rules remain narrow and are consumed by opencode permission matching.

- [ ] **Step 1: Implement exact allow rules**

  Add allow entries for existing `armada feature new`, `armada init`, `armada voyage`, and `armada voyage-handoff` command forms. Add exact `node src/cli.js` fallback forms only if generated command fallback requires them. Do not allow generic `node`, generic shell, source edits, or arbitrary redirects.

- [ ] **Step 2: Run permission tests**

  Run:

  ```bash
  node --test tests/voyage-workflow.test.js
  ```

  Expected: permission tests pass without changing worker role permissions.

## Task 4: Make Existing Voyage Launch Propagate Approved Contract

**Files:**
- Modify: `src/cli.js` voyage launch path around contract validation, worktree creation, and snapshot.
- Modify: `src/voyage/contract-snapshot.js` only if required to create/validate current approval metadata from an approved contract.
- Test: `tests/voyage-workflow.test.js`, existing `tests/voyage-snapshot.test.js`

**Interfaces:**
- Existing `snapshotContract(repoDir, sandboxDir)` remains the byte-identity boundary.
- Existing voyage CLI returns nonzero and emits a clear error when contract is not approved or snapshot fails.

- [ ] **Step 1: Implement approved-status bridge**

  Connect main contract `Status: APPROVED` to existing approval state creation/validation internally during voyage launch. Preserve hash verification. Do not add a public approval command.

- [ ] **Step 2: Validate before side effects**

  Ensure DRAFT, missing, or hash-mismatched contracts fail before tmux boot. Prefer validation before worktree creation; if existing control flow requires creation first, remove the worktree on every pre-boot failure.

- [ ] **Step 3: Snapshot before boot**

  Ensure snapshot and byte/hash verification complete before calling `bootLane`. Pass sandbox cwd and sandbox contract path into boot prompt/tracker metadata.

- [ ] **Step 4: Run contract and launch tests**

  Run:

  ```bash
  node --test tests/voyage-workflow.test.js tests/voyage-snapshot.test.js
  ```

  Expected: approval, ordering, propagation, no-session-on-failure, and cwd tests pass.

## Task 5: Verify Generated Artifacts, Isolation, and Full Regression Suite

**Files:**
- Modify: generated artifacts only where renderer output requires regeneration.
- Modify: stale runtime references in docs/tests only when they contradict embedded prompt authority.
- Test: `tests/voyage-workflow.test.js` and all existing tests.

**Interfaces:**
- Generated artifacts must remain consistent with `src/generator.js` and manifest renderers.

- [ ] **Step 1: Run isolation tests**

  Run:

  ```bash
  node --test tests/voyage-workflow.test.js --test-name-pattern="isolation|sandbox"
  ```

  Expected: sandbox writes do not alter main checkout and voyage instructions contain no main-write route.

- [ ] **Step 2: Run generated artifact consistency checks**

  Run the repository’s existing generator/scaffold regression tests:

  ```bash
  node --test tests/generator.test.js tests/scaffold.test.js tests/regression-triage.test.js
  ```

  Expected: generated prompt/config artifacts match renderers; no stale triage authority or phantom command checks regress.

- [ ] **Step 3: Run complete suite**

  ```bash
  node --test 'tests/*.test.js'
  ```

  Expected: all tests pass with no warnings or unexpected failures.

- [ ] **Step 4: Inspect final diff and worktree**

  ```bash
  git diff --check
  git status --short
  ```

  Expected: only scoped workflow implementation, tests, generated artifacts, and required documentation changes remain.
