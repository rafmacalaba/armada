# P6 — Final Security Review Evidence

Reviewer: security (frigate). Session: phase-6 final patrol.
Scope: fresh review of every change in master..feat/public-stability, plus
whole-surface checks (shared auth, secrets, CI, dependencies).

## What was reviewed

- Full diff source audit: src/cli.js, src/doctor.js, src/scaffold.js,
  src/state/atomic.js, src/state/versioned.js, src/voyage/isolation.js,
  src/voyage/lifecycle.js, src/voyage/worktree.js; related pre-existing code
  (src/resume-cli.js, src/reconcile.js, src/new-command.js).
- Injection: no eval, no shell-string exec in new code; all child processes use
  argument arrays (spawnSync git/tmux, execFile opencode).
- Command injection: voyage/worktree spawnSync("git", [...]) with user-derived
  names — array form, no shell. tmux session names go through bootLane args.
- Path handling: --state-dir/--repo in resume-cli are read-only reconcile
  inputs; reconcile join(repoRoot, ref) reads only.
- Secrets scan: no keys/tokens in source, tests, docs, workflows; only
  OPENROUTER_API_KEY env references (src/doctor.js:211, tests/smoke/*).
- Supply chain: package.json adds only peerDependencies (opencode ^1.18.0,
  non-installing) + test:packed script; no postinstall/prepare scripts;
  tests/run-packed-test.js packs + installs into mktemp prefix, cleans up
  (tgz + prefix removed).
- CI/CD: .github/workflows/armada-evidence.yml (new), ci.yml, release.yml.
  No pull_request_target, no secrets in the new workflow, npm ci not curl|sh.
- Runtime check: src/cli.js checkNodeRuntime blocks Node < 20 before main.
- Test run: node --test 'tests/*.test.js' — 612 pass, 0 fail.

## Findings

- SEC-001 MEDIUM — CI actions unpinned (mutable @v4 tags), no permissions block.
- SEC-002 MEDIUM — dirty-cleanup refusal guard (src/voyage/isolation.js) dead
  code; uninstall --all deletes armada/state unconditionally
  (src/scaffold.js:485-494).
- SEC-003 MEDIUM — atomic/versioned state + voyage lifecycle layer imported
  only by tests; resume/reconcile in src/cli.js still uses pre-existing
  read-only engine; exactly-once resume (final criterion 5) not enforced by
  the binary.
- SEC-004 LOW — recordCompletedAction read-modify-write TOCTOU
  (src/voyage/lifecycle.js:80-90).
- SEC-005 LOW — `armada new` name traversal via `..` (src/new-command.js:157-159);
  lane added only `--` prefix rejection (src/cli.js:171-181).

## Summary

No HIGH findings. Three MEDIUM (fail-open / dead-guard / CI hardening) and two
LOW. No secrets, no injection, no privilege issues. All findings recorded in
armada/ledgers/public-stability/SECURITY_FINDINGS.md as OPEN.

References: armada/ledgers/public-stability/SECURITY_FINDINGS.md;
test evidence: node --test run, 612 pass (this lane, commit 4fa3794).
