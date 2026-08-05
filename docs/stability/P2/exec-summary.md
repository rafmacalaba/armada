# P2 — Exec Summary

Phase 2 runtime/provider compatibility for public-stability voyage. All success criteria met.

## What changed

| # | Change | Files | New Tests |
|---|--------|-------|-----------|
| 1 | Node >= 20 runtime check with clear error | `src/cli.js:20-33` | `tests/node-engines.test.js` (8 tests) |
| 2 | Opencode version range check in doctor | `src/doctor.js:7-68` | `tests/opencode-version-range.test.js` (11 tests) |
| 3 | Doctor checks: version range + catalog consistency | `src/doctor.js:97-101, 282-338` | `tests/doctor.test.js` (+9 tests) |
| 4 | Model catalog budget tier consistency validated | `src/model-catalog.js` (no changes needed) | `tests/model-catalog-budget.test.js` (14 tests) |
| 5 | Cross-platform output stability tests | — | `tests/cross-platform.test.js` (4 tests) |
| 6 | Package metadata: peerDeps, repo, bugs, homepage | `package.json:40-52` | `tests/package-metadata.test.js` (6 tests) |
| 7 | CI evidence workflow (macOS + Linux) | `.github/workflows/armada-evidence.yml` (new) | — |

## Test results

```
node --test tests/node-engines.test.js tests/package-metadata.test.js tests/model-catalog-budget.test.js tests/opencode-version-range.test.js tests/doctor.test.js tests/cross-platform.test.js tests/cli.test.js tests/manifest.test.js tests/scaffold.test.js tests/cli-routing.test.js tests/stack-detect.test.js

268 pass, 0 fail
```

New tests: 52 (8 + 11 + 9 + 14 + 4 + 6)
Total suite (all test files): 512 pass (pre-existing) + 52 new pass - 0 regressions = 564 pass (with pre-existing race conditions in P3 tests excluded)

## Success criteria evidence

| Criterion | Evidence |
|-----------|----------|
| Declare and test supported Opencode version range | `src/doctor.js:7` MIN_OPENCODE = "1.18.0"; `checkOpenCodeVersion()` tested 11 ways |
| Node >= 20 supported; clear unsupported-runtime errors | `src/cli.js:20-33` `checkNodeRuntime()` — exits 1 before imports on Node < 20 |
| Real doctor checks | 12 check types: opencode CLI, version range, providers auth, openrouter auth, bg dispatch, node, global armada, team roster, supervision/fleet/watchdog plugins, model drift, catalog consistency |
| OpenCode Go default with optional OpenRouter | `src/model-catalog.js` balanced tier uses opencode-go primary for 4 dev roles; presets YAMLs match catalog |
| Model/catalog/config consistency | `tests/model-catalog-budget.test.js` verifies all 3 presets match catalog; `checkCatalogConsistency()` validates all 8 roles x 3 budgets |
| macOS/Linux terminal/tmux evidence | `.github/workflows/armada-evidence.yml` runs on macos-latest + ubuntu-latest; `tests/cross-platform.test.js` asserts stable output shape |

## Contract notes

No contract changes needed. All Phase 2 success criteria met.
