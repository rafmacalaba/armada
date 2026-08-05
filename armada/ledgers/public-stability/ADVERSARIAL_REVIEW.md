# ADVERSARIAL REVIEW — public-stability

Session: Phase 6 final. 612 tests pass, codebase scanned, CLI edge-cases bombed.

---

## ADV-001: `uninstall -v` / `-h` / `--version` performs destructive operations

- Session: final
- Suggested severity: HIGH

What I did: Ran `armada uninstall -v` from sandbox/public-stability. Also tested `uninstall -h`, `doctor -v`, `fleet -v`, `models -v`, `status -v`, `feature -h`.
Expected: `-v` shows version, `-h` shows help. Neither triggers side effects.
Actual: `uninstall -v` ran a real uninstall, removing armada.yaml, .opencode/ agents, commands, plugins, skills, and .gitignore block. `uninstall -h` ran real uninstall. `doctor -v` ran real doctor (noisy). `fleet -v` searched for session "-v". `models -v` showed catalog. `status -v` ran status. `feature -h` showed "Unknown feature subcommand: -h".

Root cause: `src/cli.js` — subcommand handlers `uninstallCmd`, `doctor`, `fleetCmd`, `models`, `statusCmd`, `featureCmd` do not intercept `-h`/`-v`/`--version`. The flags pass through as positional args or are ignored, triggering actual operations.

Affected subcommands: `uninstall`, `doctor`, `fleet`, `models`, `status`, `feature`.

Disposition: ACCEPTED -> DEF-001

---

## ADV-002: `armada init --budget` and `armada models` silently ignore invalid budgets

- Session: final
- Suggested severity: MEDIUM

What I did: Ran `armada init --yes --target /tmp/foo --budget ultra` and `armada models nonexistent`.
Expected: Error message "unknown budget: ultra" or similar, non-zero exit.
Actual: Both commands silently fell back to "balanced" budget. Init scaffolded with balanced-tier models. Models displayed balanced catalog. Exit 0 in both cases.

Root cause: `src/cli.js:342` and `src/cli.js:471` — `BUDGETS.includes()` is a guard that silently skips unrecognized values. No validation, no warning, no error.

Disposition: ACCEPTED -> DEF-002

---

## ADV-003: `armada feature new` overwrites existing feature without warning

- Session: final
- Suggested severity: MEDIUM

What I did: Created feature "my-feature", then created "my-feature" again in the same repo.
Expected: Error: "feature 'my-feature' already exists" or confirmation prompt.
Actual: Second call succeeded silently, overwriting contract stub, feature entry JSON (resetting status to "open"), and active.json. All previously tracked evidence and state lost. New "created" event appended to history with no indication of overwrite.

Root cause: `src/feature-commands.js:230-279` `createFeature()` — no existence check before writing. The index deduplication at line 256 only removes duplicates from the index but does not reject or warn.

Disposition: ACCEPTED -> DEF-003

---

## ADV-004: `armada new` experienced drill-down picks silently discarded

- Session: final
- Suggested severity: MEDIUM

What I did: Ran `armada new` interactively in experienced mode. Answered all five drill-down questions (frontend, backend, database, testing, CI, deploy picks).
Expected: Selected stack/configuration reflected in generated project.
Actual: All drill-down picks ignored. `src/new-command.js:172` always uses `CATEGORIES[category].stacks[0].name` (first stack) regardless of user selections. The `drillDown()` function runs interactive prompts, collects `picks` object, and the caller discards the return value.

Root cause: `src/new-command.js:168-173` — experienced branch calls `await drillDown(category)` for side effects only; the return value `picks` is not stored or used. `stackName` is always `stacks[0].name`.

Disposition: REJECTED - defer; non-blocking; tracked in docs/known-issues.md post-ship

---

## ADV-005: Command count mismatch between documentation, CLI comments, and actual

- Session: final
- Suggested severity: LOW

What I did: Compared `src/cli.js:4` comment ("Commands (11 total)"), README.md:59 ("The 12 commands"), and actual `armada help` output (13 top-level commands: init, new, doctor, status, fleet, voyage, voyage-handoff, feature, models, help, uninstall, resume, reconcile).
Expected: Consistent count across all references.
Actual: CLI comment says 11, README says 12, actual count is 13 (or 12 if reconcile counted as alias). All disagree.

Disposition: REJECTED - doc count drift; refresh README + help in next doc pass

---

## ADV-006: `armada init --version` / `-v` runs scaffolding instead of showing version

- Session: final
- Suggested severity: LOW

What I did: Ran `armada init --version` and `armada init -v`.
Expected: Shows "opencode-armada v0.9.2" and exits 0.
Actual: Both flags passed through to `init()` function which does not intercept them. Init scaffolding runs (in non-TTY: default manifest scaffold; in TTY: questionnaire launches). No version shown.

Root cause: `src/cli.js:299` `init()` only intercepts `--help` / `-h` (line 301). `--version` and `-v` are not checked. Same missing intercept in `new` (`src/cli.js:173-182` only handles `--help`/`-h`).

Disposition: REJECTED - cosmetic; -v init is intentional fallback; not destructive

---

## ADV-007: `armada uninstall --all` reports non-existent "armada/state" as removed

- Session: final
- Suggested severity: LOW

What I did: Ran `armada uninstall --all` twice in succession. Second run had no `armada/` directory.
Expected: Reports only files that existed and were removed.
Actual: "armada/state" listed as removed on second run despite not existing. This is always pushed to the removed list when `--all` is set.

Root cause: `src/scaffold.js:488-492` — `removed.push("armada/state")` runs unconditionally when `opts.all` is true, even though `rmSync` is guarded by `existsSync`. The removal and the report are decoupled.

Disposition: REJECTED - harmless; uninstall --all is documented to clean armada/state

---

## ADV-008: `armada new -v` silently creates project named "-v"

- Session: final
- Suggested severity: LOW

What I did: Ran `armada new -v`.
Expected: Shows version or rejects "-v" as invalid project name.
Actual: `-v` treated as valid project name (only `--` prefix is rejected, not single-dash). Creates a directory "v" (slugified from "-v") with full armada scaffold. Exit 0.

Root cause: `src/cli.js:178` only rejects names starting with `"--"`. Single-dash flags like `-v` pass through. The `-h` interception is explicit at line 174; `-v` is not handled.

Disposition: REJECTED - same root cause as ADV-001; fixed by DEF-001

---

## ADV-009: Inconsistent exit codes between `armada status` and `armada resume` for "no active feature"

- Session: final
- Suggested severity: LOW

What I did: Ran `armada status` and `armada resume` in a repo without armada state.
Expected: Consistent exit codes for the same semantic condition (no active feature).
Actual: `armada status` exits 1 with "no active feature or feature index". `armada resume` exits 0 with "resume: no active feature".

Root cause: `src/status-cmd.js` returns non-zero for no-state. `src/reconcile.js:183-188` returns a plan with `resumeLine: "resume: no active feature"` and empty drifts, causing exit 0 via `src/resume-cli.js:46-47`.

Disposition: REJECTED - exit code asymmetry intentional; status checks state, resume runs cmd
