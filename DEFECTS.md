
## DEF-030: Integration test for vscode/cursor hint path

- Status: CLOSED
- Severity: LOW
- Found by: orchestrator (ADV-047)
- Phase: 2

Steps to reproduce:
1. Call openTerminal with TERM_PROGRAM=vscode, platform=darwin.
2. Observe: no integration test verifies the hint result from openTerminal.

Expected: Test in tests/terminal-open.test.js that calls openTerminal with TERM_PROGRAM=vscode and asserts opened=false, mode=hint, hint contains the attach command.
Actual: No integration test for vscode/cursor hint path through openTerminal.

History:
- orchestrator: opened (DEF-030 task, 6-defect batch)
- qa: closed — DEF-030: openTerminal with TERM_PROGRAM=vscode returns hint (opened=false, mode=hint, hint set); asserts vscode hint path returns opened=false and attach command in hint

## DEF-029: Clean up dead placeholder in pickAttachStrategy hint

- Status: CLOSED
- Severity: LOW
- Found by: orchestrator (ADV-046)
- Phase: 2

Steps to reproduce:
1. Inspect pickAttachStrategy for vscode rule (Rule 4).
2. Observe strategy.hint = "tmux attach -t <name>".
3. Trace usage: openTerminal always builds hint from buildAttachCommand(name), never reads strategy.hint.

Expected: hint field removed from strategy return (openTerminal computes hint from session name).
Actual: Dead placeholder "tmux attach -t <name>" sits in strategy but is never used.

History:
- orchestrator: opened (DEF-029 task, 6-defect batch)
- qa: closed — c5 test (terminal-open-tab.test.js:114) asserts s.hint === null; dead placeholder removed from pickAttachStrategy return

## DEF-028: KONSOLE_VERSION detection for konsole tab

- Status: CLOSED
- Severity: MEDIUM
- Found by: orchestrator (ADV-045)
- Phase: 2

Steps to reproduce:
1. Set env KONSOLE_VERSION="24.02.0" on Linux.
2. Call pickAttachStrategy or openTerminal.
3. Observe: konsole falls through to classic pickTerminal, opens new window.

Expected: KONSOLE_VERSION triggers konsole --new-tab (mode=tab, kind=konsole).
Actual: No KONSOLE_VERSION detection; konsole always opens new window.

History:
- orchestrator: opened (DEF-028 task, 6-defect batch)
- qa: closed — DEF-028a/b (terminal-open-tab.test.js:245/260) + DEF-028 integration (terminal-open.test.js:561) all pass; KONSOLE_VERSION triggers --new-tab, no KONSOLE_VERSION falls through to classic

## DEF-027: Unit test asserts broken argv shape for macOS classic

- Status: CLOSED
- Severity: LOW
- Found by: orchestrator (ADV-044)
- Phase: 2

Steps to reproduce:
1. Read tests/terminal-open-tab.test.js c5 test.
2. Observe assertion: s.template.argv equals ["open", "-a", "Terminal"].

Expected: Template is { kind: "macos-window", app: "Terminal" } (new shape).
Actual: Test asserts the old argv-subst shape that cannot carry the attach command.

History:
- orchestrator: opened (DEF-027 task, 6-defect batch)
- qa: closed — c5 test (terminal-open-tab.test.js:114) asserts template.kind === "macos-window" and template.app === "Terminal" (new shape, not old argv)

## DEF-026: openTerminal test should capture exec args

- Status: CLOSED
- Severity: MEDIUM
- Found by: orchestrator (ADV-043)
- Phase: 2

Steps to reproduce:
1. Read tests/terminal-open.test.js line 520 (Phase 2 macOS no TERM_PROGRAM test).
2. Observe: uses makeFakeExec("success") which accepts any args without capturing.

Expected: Test captures exec argv and asserts osascript is called with the attach command.
Actual: Test only checks result.opened/mode/hint, does not verify the attach command reached exec.

History:
- orchestrator: opened (DEF-026 task, 6-defect batch)
- qa: closed — DEF-025 test (terminal-open.test.js:520) captures execCalls array, asserts osascript bin and argv contains tmux attach command; covers DEF-026 requirement

## DEF-025: macOS no-TERM_PROGRAM opens Terminal.app but attach command never executed

- Status: CLOSED
- Severity: HIGH
- Found by: qa
- Phase: 2

Steps to reproduce:
1. Call openTerminal({ name: "my-lane", platform: "darwin", env: { PATH: "/usr/bin:/bin" }, exec: captureExec }) with no TERM_PROGRAM set.
2. Observe the exec call arguments.
3. Observe the result.

Expected: The attach command is included in the arguments passed to exec (via osascript do script).
Actual: _classicPickTerminal returns argv: ["open", "-a", "Terminal"] with no __ATTACH_CMD__. Terminal.app opens but tmux attach never runs.

History:
- qa: opened
- orchestrator: reopened as DEF-025 batch; fix introduces macos-window template kind with osascript do script
- qa: closed — DEF-025 test (terminal-open.test.js:520) passes; osascript exec'd with bin="osascript", argv contains "tmux attach -t 'my-lane'" and "do script"

## DEF-024: env undefined/null not covered by tests

- Status: CLOSED
- Severity: LOW
- Found by: adversary (ADV-041)
- Phase: 1

Steps to reproduce:
1. Call `pickAttachStrategy` without `env` key at all.
2. Call `pickAttachStrategy` with `env: null`.
3. Observe test coverage — no tests for either edge case.

Expected: Both calls should not throw; should fall through to rule 6 (delegate to pickTerminal) and return mode="window".
Actual: Code is correct (uses `env?.TERM_PROGRAM`, null-safe). Tests do not cover these paths.

History:
- qa: opened
- qa: closed — DEF-024a/024b: env undefined falls through to rule 6, env null does not throw; both return mode="window" kind from pickTerminal

## DEF-023: TERM_PROGRAM="" empty string not covered by tests

- Status: CLOSED
- Severity: LOW
- Found by: adversary (ADV-040)
- Phase: 1

Steps to reproduce:
1. Call `pickAttachStrategy` with `env: { TERM_PROGRAM: "" }`.
2. Observe test coverage — no test for empty TERM_PROGRAM.

Expected: Empty string does not match Apple_Terminal (rule 1), falls through to rule 6 → pickTerminal → iTerm/gnome-terminal. mode="window".
Actual: Code is correct (strict equality checks). No test covers this path.

History:
- qa: opened
- qa: closed — DEF-023: TERM_PROGRAM="" falls through to rule 6, returns mode="window" kind from pickTerminal

## DEF-022: Rules 1-3 vs rule 5 precedence not covered by tests

- Status: CLOSED
- Severity: LOW
- Found by: adversary (ADV-039)
- Phase: 1

Steps to reproduce:
1. Call `pickAttachStrategy` with TERM_PROGRAM="Apple_Terminal" AND hasWeztermServer=true.
2. Call `pickAttachStrategy` with TERM_PROGRAM="iTerm.app" AND hasWeztermServer=true.
3. Call `pickAttachStrategy` with TERM_PROGRAM="WezTerm" AND hasWeztermServer=true.

Expected: Rules 1-3 fire first, ignoring hasWeztermServer (rule 5). Correct terminal tab strategy returned for each.
Actual: Code is correct (rules are evaluated top-to-bottom before rule 5). No tests cover rule 5 being skipped when a higher rule matches.

History:
- qa: opened
- qa: closed — DEF-022a/b/c: rules 1-3 fire before rule 5; Apple_Terminal+iTerm return tab strategies, WezTerm returns wezterm tab; all 3 sub-tests pass

## DEF-021: Windows + hasWeztermServer=true not covered by tests

- Status: CLOSED
- Severity: LOW
- Found by: adversary (ADV-038)
- Phase: 1

Steps to reproduce:
1. Call `pickAttachStrategy` with os="windows" and hasWeztermServer=true.
2. Observe test coverage — no Windows test with hasWeztermServer.

Expected: Rule 5 os guard `(os === "linux" || os === "macos")` excludes Windows. Should fall through to rule 6 → classic pickTerminal. mode="window", kind NOT "wezterm".
Actual: Code is correct. No test for Windows + hasWeztermServer.

History:
- qa: opened
- qa: closed — DEF-021: Windows + hasWeztermServer=true excludes wezterm via os guard, falls through to pickTerminal; mode="window", kind from pickTerminal

## DEF-020: TODO.md lane-drive entry missing at time of prior verification (race condition)

- Status: CLOSED
- Severity: LOW
- Found by: qa
- Phase: 3

Steps to reproduce:
1. Re-verify TODO.md for lane-drive entries at lines 30 (Quick wins) and 283 (Polish — done).
2. Confirm `- [x]` checkboxes are present for the lane-drive feature.

Expected: Both TODO.md entries exist with `- [x]` checked — lane-drive is documented as done.
Actual: Both entries confirmed present — line 30 (`Lane drive — TUI-ready handshake + auto-open visible terminal`) and line 283 (`Lane drive visible terminal + handshake polish`). Prior verification failed due to race: docs entry was written AFTER qa read the file.
Screenshot: n/a

History:
- qa: opened
- qa: closed — TODO.md has lane-drive entries at lines 30 (Quick wins) and 283 (Polish — done); race in prior verification (docs wrote after qa read).

## DEF-019: iTerm detection hardcoded to /Applications/

- Status: CLOSED
- Severity: MEDIUM
- Found by: adversary (ADV-037)
- Phase: 2

Steps to reproduce:
1. Install iTerm.app to `~/Applications/iTerm.app` instead of `/Applications/`.
2. Run `armada drive <lane>` on macOS.

Expected: iTerm is detected and used (kind: "iTerm").
Actual (before fix): `whichResults.iTerm` is null (hardcoded `/Applications/iTerm.app` check fails).
Actual (after fix): `detectITerm(home)` checks both `/Applications/iTerm.app` and `${HOME}/Applications/iTerm.app`.
Screenshot: n/a

History:
- qa: opened
- backend-dev: FIX READY — detectITerm checks both paths
- qa: closed — regression test "DEF-019: detectITerm finds iTerm from HOME/Applications" (tests/terminal-open.test.js:403) passes; detectITerm checks both /Applications/iTerm.app and ~/Applications/iTerm.app

## DEF-018: Wayland not detected on Linux

- Status: CLOSED
- Severity: MEDIUM
- Found by: adversary (ADV-035)
- Phase: 2

Steps to reproduce:
1. Set `WAYLAND_DISPLAY=wayland-0`, unset `DISPLAY`.
2. Call `openTerminal` on Linux with PATH containing `gnome-terminal`.

Expected: hasDisplay=true; terminal opens.
Actual (before fix): `Boolean(env.DISPLAY)` is false; misclassified as headless; prints attach hint.
Actual (after fix): checks `env.DISPLAY || env.WAYLAND_DISPLAY`.
Screenshot: n/a

History:
- qa: opened
- backend-dev: FIX READY — hasDisplay checks both DISPLAY and WAYLAND_DISPLAY
- qa: closed — regression test "DEF-018: openTerminal uses WAYLAND_DISPLAY when DISPLAY absent" (tests/terminal-open.test.js:363) passes; hasDisplay checks DISPLAY || WAYLAND_DISPLAY

## DEF-017: Shell injection via session name on Linux/Windows

- Status: CLOSED
- Severity: HIGH
- Found by: adversary (ADV-034)
- Phase: 2

Steps to reproduce:
1. `armada drive --name='foo; rm -rf /' /tmp/foo` on Linux.

Expected: The `;` is escaped or the name is rejected; no code execution.
Actual (before fix): `buildAttachCommand` only quotes whitespace; name with `;` is unquoted. Substituted into `bash -c "tmux attach -t foo; rm -rf /; exec bash"`. RCE.
Actual (after fix): `buildAttachCommand` always single-quotes the name with POSIX `'\''` escaping.
Screenshot: n/a

History:
- qa: opened
- backend-dev: FIX READY — buildAttachCommand always single-quotes, escapes embedded single quotes
- qa: closed — regression tests "buildAttachCommand: dangerous chars inside single quotes" and "buildAttachCommand: name with single-quote escaped POSIX-style" (tests/terminal-open.test.js:68-73) pass; always single-quotes with POSIX escaping

## DEF-016: AppleScript injection via session name on macOS

- Status: CLOSED
- Severity: HIGH
- Found by: adversary (ADV-033)
- Phase: 2

Steps to reproduce:
1. `armada drive --name='foo"; do shell script "echo PWNED' /tmp/foo` on macOS.

Expected: The `"` is escaped; no code execution.
Actual (before fix): AppleScript becomes `tell application "Terminal" to do script "tmux attach -t foo"; do shell script "echo PWNED"`. RCE.
Actual (after fix): `escapeAppleScript` backslash-escapes `\` and `"` before AppleScript interpolation.
Screenshot: n/a

History:
- qa: opened
- backend-dev: FIX READY — escapeAppleScript helper called before osascript argv assembly
- qa: closed — regression test "DEF-016: AppleScript escaping — injection chars escaped" (tests/terminal-open.test.js:326) passes; escapeAppleScript escapes \ and " before osascript interpolation

# DEFECTS.md

---

# opencode-armada — Defect ledger

All defects, newest first. Writers: qa (create, close, reopen), orchestrator (record developer responses, reject). Nobody else.

## DEF-015: --prompt starting with -- silently ignored

- Status: CLOSED
- Severity: LOW
- Found by: adversary (ADV-032)
- Phase: 1

Steps to reproduce:
1. Run `armada drive --prompt -- /tmp/foo` (user wants prompt literally "--").
2. Observe: the `--` value is rejected by anti-flag guard, falls back to DEFAULT_PROMPT.

Expected: Error "error: --prompt value cannot start with "--"" and exit 1.
Actual: After fix: clear error + exit 1. Before: silent fallback to default prompt.
Screenshot: n/a

History:
- qa: opened
- backend-dev: FIX READY — added guard in driveCmd, test in cli.test.js
- qa: closed — regression test "drive --prompt starting with -- exits 1" (tests/cli.test.js:405) passes; stderr matches /--prompt value cannot start with/

## DEF-014: CLI prints "prompt registered" when reattaching (no prompt sent)

- Status: CLOSED
- Severity: MEDIUM
- Found by: adversary (ADV-027)
- Phase: 1

Steps to reproduce:
1. Start a lane session via `armada drive /tmp/foo`.
2. Run `armada drive /tmp/foo` again (same lane path).
3. Observe output message.

Expected: Message says "already running (reattached)", not "prompt registered".
Actual: After fix: branches on result.attached. Before: same misleading message for both paths.
Screenshot: n/a

History:
- qa: opened
- backend-dev: FIX READY — driveCmd branches message on result.attached
- qa: closed — regression test "drive on existing session says already running" (tests/cli.test.js:392) passes; stdout matches /already running|reattach/, does not match /prompt registered/

## DEF-013: bootLane succeeds when register never detected after resend

- Status: CLOSED
- Severity: HIGH
- Found by: adversary (ADV-026)
- Phase: 1

Steps to reproduce:
1. Fake tmux where capture-pane shows ready pattern but NEVER shows thinking/register pattern.
2. Call bootLane with the fake tmux.
3. Observe: after resend+recheck, registered still false, but function returns success.

Expected: DriveError thrown with "did not register" message.
Actual: After fix: throws DriveError. Before: returned { name, attached: false } silently.
Screenshot: n/a

History:
- qa: opened
- backend-dev: FIX READY — added throw after second checkRegister fails
- qa: closed — regression test "register-never: throws DriveError after prompt resend fails" (tests/drive.test.js:256) passes; bootLane rejects with name "DriveError" and message matching /did not register/

## DEF-012: --timeout non-numeric produces NaN deadline

- Status: CLOSED
- Severity: MEDIUM
- Found by: adversary (ADV-024)
- Phase: 1

Steps to reproduce:
1. `armada drive --timeout=abc /tmp/foo`
2. `armada drive --timeout=0 /tmp/foo`

Expected: Non-numeric falls back to 30000. Zero or negative exits 1 with error.
Actual: After fix: NaN falls back to 30000; 0 exits 1 with "timeout must be a positive integer".
Screenshot: n/a

History:
- qa: opened
- backend-dev: FIX READY — NaN fallback, zero validation in driveCmd
- qa: closed — regression tests "drive --timeout=abc falls back to default 30000" (tests/cli.test.js:374) and "drive --timeout=0 exits 1 with error" (tests/cli.test.js:385) both pass; abc falls back to 30000 (exit 0), 0 exits 1 with /timeout must be a positive integer/

## DEF-011: --name with single-dash value breaks tmux argv

- Status: CLOSED
- Severity: HIGH
- Found by: adversary (ADV-023)
- Phase: 1

Steps to reproduce:
1. `armada drive --name=-foo /tmp/foo`
2. Observe: `-foo` is passed to tmux as `-t -foo`, parsed as flag.

Expected: Error "session name cannot start with "-"" and exit 1.
Actual: After fix: clear error + exit 1.
Screenshot: n/a

History:
- qa: opened
- backend-dev: FIX READY — added guard after name extraction in driveCmd
- qa: closed — regression test "drive --name=-foo exits 1 with clear error" (tests/cli.test.js:367) passes; exit code 1, stderr matches /session name cannot start with/

## DEF-001: Bootstrap exception — orchestrator wrote .opencode/* under user authorization

- Status: CLOSED
- Severity: LOW
- Found by: orchestrator
- Phase: 3

What happened: Phase 3 of `armada/REQUIREMENTS.md` requires editing
`.opencode/agent/orchestrator.md` + `.opencode/commands/armada-status.md` +
`.opencode/commands/armada-resume.md`. Every role in the team (orchestrator, backend-dev,
frontend-dev, docs) has `.opencode/*: deny` in its permission block. The docs agent correctly
refused and produced a verbatim edit payload + a regression test. No subagent could apply
the edits. The orchestrator (per system prompt hard rule "Writes route through subagents")
also could not route the work further.

Resolution: User explicitly authorized the one-time exception via the question tool:
"Apply edits via orchestrator (one-time exception)". The orchestrator applied the payload
via bash (orchestrator bash is `* : allow`), bypassing the AGENTS.md "no shell workaround"
rule under explicit user override. Edits applied:
- `.opencode/agent/orchestrator.md` rule 3 + rule 4 + fleet commands block (lines 93-107)
- `.opencode/commands/armada-status.md` body (line 5)
- `.opencode/commands/armada-resume.md` body (line 5)

Followup formatting fix: phrase "ask the user for the next action before resuming" was
wrapped across two lines; collapsed onto one line so the regression regex matches. Same
exception applies.

Verification: `tests/orchestrator-prompt.test.js` 3/3 pass; full suite 243/243 pass.

History:
- orchestrator: opened + closed (bootstrap, no developer handoff)

## DEF-002: false evidence-failed drift on "0 failing" passing test output

- Status: CLOSED
- Severity: MEDIUM
- Found by: adversary (ADV-011)
- Phase: 1

Steps to reproduce:
1. Create a tmp dir. Write `armada/state/active.json` with feature "feat", contract "armada/contracts/feat.md", phase "phase-1" status "in_progress", one criterion with `evidence: { kind: "test", ref: "tests/output.log" }`.
2. Write `armada/contracts/feat.md` with phase-1 success criteria `- [ ] All tests pass`.
3. Write `tests/output.log` containing `Tests: 25 passed, 0 failing, 0 skipped`.
4. Call `reconcile(stateDir, repoRoot)`.

Expected: No `evidence-failed` drift — "0 failing" means all tests passed.
Actual (before fix): Drift `{ kind: "evidence-failed" }` reported because `/\d+ failing/` matches "0 failing".
Actual (after fix): `drifts: []` — no false positive.
Screenshot: n/a

History:
- qa: opened
- backend-dev: FIX READY — fixed in src/reconcile.js:20, regex `/\b[1-9]\d*\s+failing\b/`
- qa: closed — regression test "Bug A — 0 failing in evidence file does not trigger evidence-failed" (tests/reconcile.test.js:619) passes; engine output `drifts:[]` for "0 failing" evidence

## DEF-001: prompt: "." or "./" passes validation, crashes with EISDIR

- Status: CLOSED
- Severity: MEDIUM
- Found by: adversary (ADV-023)
- Phase: 3

Steps to reproduce:
1. Add `prompt: "."` (or `prompt: "./"`) to any team entry in `armada.yaml`.
2. Run `armada init --from-armada armada/armada.yaml` over a target where that path resolves to a directory.
3. `validatePrompt` in `src/manifest.js:64-82` passes (non-empty, no `..`, not absolute, resolves inside target).
4. `scaffold.js:101-110` calls `readFileSync` on a directory.

Expected: Clear error before the read: `prompt must be a file path, not a directory: <path> (for role <role>)`.
Actual: `Error: EISDIR: illegal operation on a directory, read '<path>'` from `readFileSync` — cryptic.

History:
- qa: opened
- qa: closed — fixed (applyPreset renders through generator.renderManifestYaml; generator now serializes stack.instructions); retested 323/323, instructions+variant preservation test added

## DEF-010: applyPreset local renderer silently drops any future manifest fields

- Status: CLOSED
- Severity: MEDIUM
- Found by: adversary (ADV-020)
- Phase: 3

Steps to reproduce:
1. Create armada.yaml with any field not in the local renderArmadaYaml template (e.g., `stack.instructions`, or any future `project.` field).
2. Run `armada preset power --target <dir>`.
3. Inspect the rewritten armada.yaml in the target directory.

Expected: Non-model/budget fields pass through unchanged (preset only overrides budget + team models/variants).
Actual: Any field not explicitly in the local renderArmadaYaml template is silently dropped. The canonical renderManifestYaml in generator.js includes instructions; the local copy in preset-command.js does not. Schema evolution creates a maintenance fork.
Screenshot: n/a

History:
- qa: opened
- qa: closed — fixed (renderArmadaYaml fork deleted; applyPreset uses the generator as single source of truth); retested 323/323


---

- qa: opened (filed by orchestrator from ADV-023)
- qa: CLOSED — fix confirmed at scaffold.js:106-108 (lstatSync.isDirectory check), unit test passes (scaffold.test.js:408-421), independent repro produces clear error `custom prompt template is a directory, not a file: templates (for role backend-dev)`, full suite green 338/338

## DEF-031: README.md references root-level e2e/DEFECTS/ADVERSARIAL_REVIEW after per-feature migration (stale docs)

- Status: CLOSED
- Severity: MEDIUM
- Found by: qa (ADV-048)
- Phase: 4

Steps to reproduce:
1. Read `README.md`.
2. Search for `e2e/`, `DEFECTS.md`, `ADVERSARIAL_REVIEW.md` (root).
3. Lines 30, 60, 63, 65, 278, 281, 282 reference root-level paths.
4. The "What gets generated" tree at lines 213-233 omits `armada/ledgers/`, `armada/e2e/`, `armada/screenshots/`.

Expected: README reflects per-feature paths: `armada/ledgers/<feature>/DEFECTS.md`, `armada/e2e/<feature>/`, `armada/screenshots/<feature>/`. Generated tree shows new directories.
Actual: README not updated for per-feature layout. User-facing documentation contradicts actual output.
Screenshot: n/a

History:
- qa: opened (filed by orchestrator from ADV-048)
- qa: closed — all README refs now per-feature (armada/e2e/<feature>/, armada/ledgers/<feature>/DEFECTS.md); tree includes new dirs; 0 naked root-level refs

## DEF-032: slugify() drops non-ASCII characters silently, collision risk

- Status: CLOSED
- Severity: LOW
- Found by: qa (ADV-049)
- Phase: 4

Steps to reproduce:
1. Call `slugify("unicode-日本語")` in `src/scaffold.js` — returns `"unicode"`.
2. Call `slugify("Café")` — returns `"caf"`.
3. Non-ASCII stripped by `[^a-z0-9]+` regex without warning.

Expected: Document the ASCII-only convention. Or transliterate, or warn when chars are dropped. Avoid collision.
Actual: Characters silently dropped. `"unicode-日本語"` and `"unicode"` produce identical ledger dir — collision risk for per-feature DEF numbering.
Screenshot: n/a

History:
- qa: opened (filed by orchestrator from ADV-049)
- qa: closed — slugify("Café")="cafe-x7347", slugify("cafe")="cafe", slugify("日本語")="unicode-x7771"; three distinct outputs, collision resolved via hash suffix

## DEF-033: slugify() has no length limit, ENAMETOOLONG risk

- Status: CLOSED
- Severity: MEDIUM
- Found by: qa (ADV-050)
- Phase: 4

Steps to reproduce:
1. Slugify a 500+ char project name.
2. Path `armada/ledgers/<500+char-slug>/DEFECTS.md` would fail `mkdir` with ENAMETOOLONG on macOS (255-char limit), ext4, NTFS.

Expected: Slug truncated to safe length (e.g., 100 chars) or mkdir error caught with clear message.
Actual: No truncation. `scaffold` crashes with cryptic ENAMETOOLONG when writing ledger/e2e/screenshots dirs.
Screenshot: n/a

History:
- qa: opened (filed by orchestrator from ADV-050)
- qa: closed — slugify("a".repeat(500)).length === 100; truncated to safe length

## DEF-034: P4 — 5 fleet e2e tests are product but were untracked instead of moved to tests/

- Status: CLOSED
- Severity: MEDIUM
- Found by: qa (ADV-051)
- Phase: 4

Steps to reproduce:
1. Inspect `e2e/*.test.js` (5 files, ~1248 lines): `armada-resume-command.test.js`, `armada-resume-roundtrip.test.js`, `cli-wiring.test.js`, `reconcile.test.js`, `validation.test.js`.
2. Each tests product CLI behavior (reconcile, resume, scaffold, CLI dispatch, restart-proof).
3. None are wired into `npm test` (which runs only `tests/*.test.js`).
4. Per REQUIREMENTS.md Phase 4: "Any fleet-written e2e test that genuinely tests the PRODUCT (i.e. would run in CI) is moved into `tests/` where it belongs and is wired into the suite — it is product, not process."

Expected: Each of the 5 files moved to `tests/` (with relative path fix from `../tests/helpers.js` to `./helpers.js`), wired into `npm test`, and removed from the untrack script's list.
Actual: All 5 remain in `e2e/`, untracked via `.gitignore` process block. Not moved to `tests/`. Not wired into `npm test`. Product e2e tests siloed from CI.
Screenshot: n/a

History:
- qa: opened (filed by orchestrator from ADV-051)
- qa: closed — git ls-files e2e/ empty; all 5 files in tests/ (cli-wiring, reconcile-cli, validation, armada-resume-command, armada-resume-roundtrip); each passes individually; .gitignore has no /e2e/; 501/501 green

## DEF-035: untrack-process-artifacts.sh fails silently from subdirectory

- Status: CLOSED
- Severity: MEDIUM
- Found by: qa (ADV-052)
- Phase: 4

Steps to reproduce:
1. Create a temp git repo with tracked `DEFECTS.md`, etc.
2. Run `scripts/untrack-process-artifacts.sh` from a subdirectory.
3. Observe: all 8 files report "Already untracked (skip)". Files remain tracked in index.
4. Root cause: `git ls-files --error-unmatch` and `git rm --cached` resolve paths relative to cwd, not repo root.

Expected: Script `cd`s to repo root (`git rev-parse --show-toplevel`) or errors clearly when run from a non-root directory.
Actual: Silent false success. User thinks artifacts untracked but they stay in git index.
Screenshot: n/a

History:
- qa: opened (filed by orchestrator from ADV-052)
- qa: closed — script uses REPO_ROOT via git rev-parse --show-toplevel; test DEF-035 (scripts.test.js:134) runs from deeply/nested/sub/, DEFECTS.md untracked after; 501/501 green
