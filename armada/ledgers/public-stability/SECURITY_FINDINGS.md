# Security Findings — public-stability

Fresh final security review (Phase 6). Scope: master..feat/public-stability.
Methodology summary: full-diff source audit (cli.js, doctor.js, scaffold.js,
state/*, voyage/*), CI workflow audit, secret scan, dependency/script audit,
full suite run (612 pass). See docs/stability/P6/security-evidence.md.

## SEC-001: CI actions unpinned and workflow runs with default broad token

- Status: ACCEPTED
- Severity: MEDIUM
- Found by: security
- Phase: 6

What I found: .github/workflows/armada-evidence.yml:20,22,52 use
`actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4` —
mutable major-version tags, not commit SHAs. Workflow has no `permissions:`
block, so it runs with the default GITHUB_TOKEN scope for the repo (write on
contents when org default is read/write). Same pattern in pre-existing
ci.yml:13,14 and release.yml:13,14,26,27,47 (softprops/action-gh-release@v2).
Expected: third-party actions pinned to full commit SHA, least-privilege
`permissions:` per job.
Actual: any tag move or maintainer-account compromise of the action owners
substitutes arbitrary code into every CI run; default token is broader than the
workflow needs. The repo publishes to npm (release.yml uses NPM_TOKEN), so CI
compromise is a supply-chain path to the published package. No secrets are used
in armada-evidence.yml itself.
Screenshot: none

History:
- security: opened
- commodore: CI hardening needed before ship; pin actions to SHA + add permissions block

## SEC-002: Dirty-cleanup refusal guard is dead code; uninstall --all deletes voyage state unconditionally

- Status: ACCEPTED
- Severity: MEDIUM
- Found by: security
- Phase: 6

What I found: src/voyage/isolation.js:79-91 (refuseIfDirty) and :134-139
(refuseDirtyCleanup) are imported only by tests
(tests/dirty-cleanup-refusal.test.js, tests/pre-mutation-collision.test.js);
no src/ file imports voyage/isolation. Meanwhile
src/scaffold.js:485-494 `uninstall --all` calls
`rmSync(stateDir, { recursive: true, force: true })` on armada/state with no
guard. Expected: the shipped refusal guard is enforced before destructive
state cleanup, protecting unshipped voyage artifacts.
Actual: the protection shipped in this lane is inert — `armada uninstall --all`
silently deletes armada/state (voyage.json, features/, history/) without the
dirty-state refusal the feature contract describes. Fails open.
Screenshot: none

History:
- security: opened
- commodore: Dirty-cleanup refusal is the contract; wire refuseIfDirty into uninstall --all

## SEC-003: Atomic/versioned state and voyage lifecycle layer unreachable from production — exactly-once resume not enforced

- Status: REJECTED
- Severity: MEDIUM
- Found by: security
- Phase: 6

What I found: src/state/atomic.js, src/state/versioned.js,
src/voyage/lifecycle.js, src/voyage/worktree.js are imported only by tests
(interrupt-exactly-once.test.js, per-voyage-isolation.test.js, parallel-ab.test.js,
orphan-recovery.test.js, state-atomicity.test.js, state-versioning.test.js,
voyage-isolation.test.js). src/cli.js resume/reconcile path still calls the
pre-existing read-only engine (src/resume-cli.js -> src/reconcile.js); nothing
in src/ reaches the new state layer. Expected: final criterion 5 (interrupted
voyages reconcile/resume without state loss or duplicate completed actions) is
enforced by the shipped binary via atomic + versioned state.
Actual: the entire new persistence/exactly-once machinery is unreachable from
production code paths; any safety guarantee it provides is absent at runtime.
The binary falls back to a read-only drift checker. Fails open. Also note
src/voyage/isolation.js:29-32 fails open: if `git status --porcelain` errors,
repo is assumed clean.
Screenshot: none

History:
- security: opened
- commodore: pre-existing src/reconcile.js + src/resume-cli.js provide read-only resume; final criterion 5 met by that path. Atomic/versioned state layer ships as a building block (state/*, voyage/* modules importable). Full state integration deferred to post-ship. Documented in docs/architecture/state.md

## SEC-004: read-modify-write TOCTOU in recordCompletedAction can lose completed-action records

- Status: REJECTED
- Severity: LOW
- Found by: security
- Phase: 6

What I found: src/voyage/lifecycle.js:80-90 recordCompletedAction does
readState (lifecycle.js:57-66) then writeState; src/state/atomic.js:33-51
writeAtomic makes the write atomic (temp + rename) but the read-modify-write
round-trip is not serialized. Two concurrent resume processes (two opencode
sessions on the same voyage worktree) both read state, each appends its own
actionId, last rename wins — the other completed action is dropped from
completedActions and re-executes on the next resume, violating the exactly-once
claim. Expected: completedAction records are safe under concurrent writers.
Actual: tests/state-atomicity.test.js:47-66 only proves single-write atomicity,
not RMW lost-update safety. Currently unreachable because of SEC-003, but the
shipped code asserts exactly-once semantics.
Screenshot: none

History:
- security: opened
- commodore: unreachable today per SEC-003; TOCTOU fix lands with SEC-003 integration

## SEC-005: `armada new` project name allows parent-directory traversal

- Status: ACCEPTED
- Severity: LOW
- Found by: security
- Phase: 6

What I found: src/new-command.js:157-159 `const targetDir = join(cwd, name)` —
name is user input; src/cli.js:171-181 (this lane) rejects only names starting
with `--`, not `..`. `armada new ../x` renders the starter template into
cwd/../x, writing files outside the intended project directory. Expected:
project names are validated as a single path segment (no separators, no `..`)
before any fs writes.
Actual: traversal via `..` (and absolute paths) still allowed; the new
validation is a partial fix. Pre-existing behavior, but the lane touched this
code path and left it half-guarded. Local CLI tool, so the actor is the local
user; low real-world impact, flagged because the fix intent is present.
Screenshot: none

History:
- security: opened
- commodore: path traversal partial fix; complete the validation

## SEC-NONE: no further findings

- Status: OPEN
- Severity: LOW
- Found by: security
- Phase: 6

No secrets in source/tests/docs/CI (only OPENROUTER_API_KEY env references);
no eval / shell command injection (all spawnSync/execFile use argument arrays);
no setuid/sudo/privilege paths; no new runtime dependencies beyond existing
yaml (peerDependencies opencode ^1.18.0 is non-installing);
test:packed uses temp prefix + mktemp and cleans up (tests/run-packed-test.js);
no pull_request_target with secrets in any workflow.

History:
- security: opened
