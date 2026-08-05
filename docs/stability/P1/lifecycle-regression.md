# P1 — Lifecycle Regression

Re-run init→status→doctor→uninstall lifecycle against P1 code. Compare to P0 baseline.

## Environment

- macOS (darwin), Node v23.9.0
- Binary: sandbox/public-stability/src/cli.js
- Test: `node --test tests/cli.test.js tests/scaffold.test.js` (core lifecycle coverage)

## Baseline (P0)

From P0 lifecycle-walkthrough.md:
- init --yes --budget free: 27 files, exit 0
- doctor: 8/8 checks pass, exit 0
- feature new test: 4 state files created
- status: shows feature table
- uninstall --all: 44 items removed, exit 0
- Post-uninstall: armada/state/ and opencode/ dirs remain (defect found)

## P1 Regression

### init --yes --budget free

Same behavior as P0. All 27 files produced. Exit 0.
No regression from preset/update changes (init handler unchanged).

### doctor

Same 8 checks. One change: "global armada binary" check now uses `process.argv[1]`
(running binary) instead of searching PATH. This prevents stale PATH armada from
showing misleading help text.

### uninstall --all

Now removes `armada/state/` directory (left by feature new command) before cleaning
`armada/`. This means `armada/` directory is completely removed when `--all` flag
is used.

Post-uninstall directory listing: empty target dir (no residual armada/ or opencode/ dirs).

### P0 findings addressed

| # | P0 Finding | P1 Status |
|---|-----------|-----------|
| 1 | uninstall --all leaves armada/state/ and opencode/ | FIXED: armada/state removed before armada/ rmdir |
| 2 | Doctor prints stale help from PATH armada | FIXED: uses running binary self-check |
| 5 | Init creates 27 files; uninstall leaves state | FIXED: state cleaned with --all |

## Traceability from P0 defects

- Defect rec-4 from commands-inventory: `uninstall --all` leaves `armada/state/` → fixed
- Defect rec-5 from lifecycle-walkthrough: Doctor stale binary check → fixed
- Defect rec-6 from commands-inventory: `armada new --help` creates project named --help → fixed

Evidence: `tests/cli-routing.test.js` tests 3-4 (uninstall state), test 5 (doctor self-check), test 6 (new --help)

## Regression result: PASS

No regressions detected vs P0 baseline. 347 deterministic tests pass.
2 P0 lifecycle defects fixed. All existing lifecycle paths preserved.
