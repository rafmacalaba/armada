# P1 — Exec Summary

Phase 1 backend fixes for public-stability voyage. All 6 findings from P0 commands-inventory
fixed. 347 deterministic tests pass, 0 fail.

## What changed

| # | Fix | Files | Tests |
|---|-----|-------|-------|
| 1 | Remove ping/scout dead switch branches | `src/cli.js:150-153,195-198` | cli.test.js (updated), scout-cmd.test.js (updated) |
| 2 | preset/update deprecated aliases exit 1 | `src/cli.js:147-151,179-188` | preset-update-deprecation.test.js (new, 4 tests) |
| 3 | reconcile exit code reflects actual outcome; documented in help | `src/cli.js:168-170,548-560` | cli-routing.test.js (2 tests), resume.test.js (updated) |
| 4 | uninstall --all removes armada/state/ | `src/scaffold.js:479-491,536-540` | cli-routing.test.js (2 tests) |
| 5 | doctor global armada check uses running binary | `src/doctor.js:82-162`, `src/cli.js:476-482` | cli-routing.test.js (1 test) |
| 6 | armada new --help rejected as project name | `src/cli.js:154-163` | cli-routing.test.js (2 tests) |

## Test results

```
node --test tests/cli.test.js tests/cli-routing.test.js tests/preset-update-deprecation.test.js
  tests/cli-wiring.test.js tests/scaffold.test.js tests/scout-cmd.test.js tests/update.test.js
  tests/resume.test.js tests/reconcile.test.js tests/manifest.test.js tests/init-restart.test.js
  tests/feature.test.js tests/feature-status.test.js tests/status-cmd.test.js
  tests/version-flag.test.js tests/role-display.test.js tests/stack-detect.test.js
  tests/handoff.test.js tests/ledgers.test.js tests/state.test.js

347 pass, 0 fail
```

## New test files

- `tests/preset-update-deprecation.test.js` — 4 tests: preset/update exit non-zero, hint prints early
- `tests/cli-routing.test.js` — 7 tests: reconcile exit code, uninstall state cleanup, doctor self-check, new --help

## Exit codes summary

| Command | Exit 0 | Exit 1 | Exit 2 |
|---------|--------|--------|--------|
| ping (removed) | — | Unknown command | — |
| scout (removed) | — | Unknown command | — |
| preset (deprecated) | — | deprecation | — |
| update (deprecated) | — | deprecation | — |
| reconcile | no drift | error | drifts |
| resume | no drift | error | drifts |

## Hotfix: doctor selfPath default

`src/doctor.js:126` — changed `selfPath` default from `process.argv[1]` to `null`.
In test context `process.argv[1]` is the test file, causing `runDoctor` to spawn
`node <test-file> --version` recursively — infinite hang. Defaulting to `null` makes
the PATH check (the intended fallback) run instead.

Two new tests in `tests/doctor.test.js`:
- `global armada binary uses PATH when selfPath not provided` — asserts PATH-based armada resolution when `selfPath` is undefined
- `global armada binary uses selfPath when provided` — asserts explicit `selfPath` check works

Test results after fix:
```
node --test 'tests/*.test.js'
512 pass, 0 fail (23s)
```

## Contract notes

All 6 items from Phase 0 commands-inventory addressed. No contract changes needed.
Exit codes for deprecated aliases (preset, update) now match drive/reconcile pattern:
print deprecation hint on stderr, run underlying action, exit non-zero.
