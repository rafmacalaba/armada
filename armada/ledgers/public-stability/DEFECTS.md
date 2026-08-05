# DEFECTS — public-stability

## DEF-001: uninstall -v / -h / --version performs destructive operations

- Status: OPEN
- Severity: HIGH
- Found by: adversary (ADV-001)
- Phase: 6

Steps to reproduce:
1. From the dock root, run `node src/cli.js uninstall -v` (or `-h` or `--version`).

Expected: prints version/help and exits 0 without side effects.
Actual: real uninstall runs, removing armada.yaml, .opencode/ agents, commands, plugins, skills, .gitignore block. No confirmation prompt. No safety check.
Root cause: src/cli.js — subcommand handlers do not intercept -h/-v/--version before calling the uninstall function.

History:
- qa: opened

## DEF-002: armada init --budget and armada models silently ignore invalid budgets

- Status: OPEN
- Severity: MEDIUM
- Found by: adversary (ADV-002)
- Phase: 6

Steps to reproduce:
1. Run `node src/cli.js init --yes --target /tmp/foo --budget ultra`.
2. Run `node src/cli.js models nonexistent`.

Expected: error "unknown budget: ultra" and non-zero exit.
Actual: silently falls back to "balanced", exits 0.
Root cause: src/cli.js:342 and src/cli.js:471 — BUDGETS.includes() is a guard that silently skips invalid values.

History:
- qa: opened

## DEF-003: armada feature new overwrites existing feature without warning

- Status: OPEN
- Severity: MEDIUM
- Found by: adversary (ADV-003)
- Phase: 6

Steps to reproduce:
1. In any repo with a feature index, run `node src/cli.js feature new <existing-name>`.

Expected: error or confirmation prompt.
Actual: overwrites contract stub, feature entry JSON (resets status to "open"), active.json; evidence lost.
Root cause: src/feature-commands.js:230-279 createFeature() — no existence check.

History:
- qa: opened

## DEF-004: CI actions unpinned and workflow runs with default broad token

- Status: OPEN
- Severity: MEDIUM
- Found by: security (SEC-001)
- Phase: 6

Steps to reproduce:
1. Read `.github/workflows/armada-evidence.yml:20,22,52`, `ci.yml:13,14`, `release.yml:13,14,26,27,47`.

Expected: actions pinned to full commit SHA; `permissions:` block per job limiting GITHUB_TOKEN scope.
Actual: mutable major-version tags used; no permissions block; default GITHUB_TOKEN scope broader than needed.

History:
- qa: opened

## DEF-005: Dirty-cleanup refusal guard is dead code; uninstall --all deletes voyage state unconditionally

- Status: OPEN
- Severity: MEDIUM
- Found by: security (SEC-002)
- Phase: 6

Steps to reproduce:
1. Create an unshipped feature in armada/state/.
2. Run `node src/cli.js uninstall --all`.

Expected: refuseIfDirty / refuseDirtyCleanup is called, asks for confirmation, preserves voyage state unless forced.
Actual: src/scaffold.js:485-494 calls rmSync(stateDir, recursive+force) with no guard; voyage artifacts lost.

History:
- qa: opened

## DEF-006: armada new project name allows parent-directory traversal

- Status: OPEN
- Severity: LOW
- Found by: security (SEC-005)
- Phase: 6

Steps to reproduce:
1. From a temp dir, run `node src/cli.js new ../escape`.

Expected: error "invalid project name".
Actual: creates the project at the parent dir, files written outside intended location.
Root cause: src/new-command.js:157-159 + src/cli.js:171-181 — only rejects `--` prefix, not `..` or absolute paths.

History:
- qa: opened
