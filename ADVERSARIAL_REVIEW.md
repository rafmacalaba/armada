# opencode-armada — Adversarial review findings

Adversary writes entries. Orchestrator fills Disposition. Nobody else.

## ADV-027: Round-trip test re-parses only, not YAML text

- Session: final
- Suggested severity: LOW

What I did: Read `tests/manifest.test.js` "round-trips through renderManifestYaml with overrides preserving new fields". It calls `parseManifestYaml` twice (input + re-rendered) and asserts structural equality.
Expected: Test might also assert text equality for the with-overrides case.
Actual: Test only re-parses, not text equality. The no-overrides case (`round-trips through renderManifestYaml`) already asserts text equality, so coverage exists.
Screenshot: n/a

Disposition: REJECTED - re-parse is a stronger structural check than text equality; the no-override text-identity case is already covered by the original round-trip test. No defect.

## ADV-026: Instructions append spacing varies by template trailing newline

- Session: final
- Suggested severity: LOW

What I did: Verified all bundled prompt templates end with `\n`; with `\n\n` separator, the result is consistently 2 blank lines for the bundled path. A custom template without trailing newline gets 1 blank line.
Expected: N/A (cosmetic).
Actual: Cosmetic variation only; bundled case is stable.
Screenshot: n/a

Disposition: REJECTED - bundled templates are consistent; custom-template authors own their own formatting. Cosmetic, not a defect.

## ADV-025: deepMerge scalar override replaces subtree — doc could be clearer

- Session: final
- Suggested severity: LOW

What I did: Read `src/generator.js:11-23` (`deepMerge`) and `docs/using-armada.md:280-348`.
Expected: Doc might explicitly state that a scalar at a path where base has an object replaces the entire subtree.
Actual: Doc says "user leaf values replace base values key-by-key" and "Your rules win", which is accurate.
Screenshot: n/a

Disposition: REJECTED - the doc accurately describes "user rules win"; the merge implementation is consistent with the documented behavior. Doc wording is honest. Not a defect.

## ADV-024: Symlink at custom prompt path bypasses directory containment

- Session: final
- Suggested severity: LOW

What I did: Traced `scaffold.js:101-110` and `scaffold.js:65-77` (`validateTargetDir`).
Expected: Symlink at the custom prompt path could let a user point at a file outside the repo.
Actual: `validateTargetDir` only blocks symlinks at the top-level target and `.opencode/`. A symlink at the custom prompt path is followed.
Screenshot: n/a

Disposition: REJECTED - the threat model is "user pastes a bad manifest" (armada init runs as the user themselves). A symlink in the user's own repo is the user's own choice. `validateTargetDir` already guards the more sensitive paths. No real-world risk in this model.

## ADV-023: prompt: "." or prompt: "./" passes validation, EISDIR crash

- Session: final
- Suggested severity: MEDIUM

What I did: Tested `prompt: "."` against `parseManifestYaml` + `scaffold`. Validation passes (non-empty, no `..`, not absolute, resolves inside target). `readFileSync` then throws `EISDIR: illegal operation on a directory`.
Expected: Clear error: "prompt must be a file path, not a directory" before the read.
Actual: Cryptic EISDIR from readFileSync. Hard to diagnose for a user.
Screenshot: n/a

Disposition: REJECTED - out of scope for lane-drive; defer to follow-up audit lane.

`src/cli.js:170-173` — the `BUDGETS.includes(args[budgetIdx + 1])` guard silently ignores invalid values. `renderManifestYaml` writes `budget: balanced` which then round-trips as "balanced" on re-scaffold. User thinks they chose a custom budget but gets default.

---

## ADV-002: Empty model string silently accepted

- Session: final
- Suggested severity: HIGH

What I did: `armada.yaml` with `model: ""` for a team member
Expected: Parse error "model must not be empty"
Actual: Writes `"model": ""` into slim JSONC and armada.yaml. opencode will fail to start with empty model.
Screenshot: n/a

Disposition: REJECTED - out of scope for lane-drive; defer to follow-up audit lane.

`src/manifest.js:19-24` — no validation on `t.model`. `src/cli.js:157-162` — catches parse errors but empty-string model is not a parse error. Generated `oh-my-opencode-slim.jsonc` contains `"model": ""` which causes runtime failure.

---

## ADV-003: Duplicate role names silently accepted (first wins)

- Session: final
- Suggested severity: MEDIUM

What I did: `armada.yaml` with two team entries both having `role: qa` with different models
Expected: Error "duplicate role: qa" or warning
Actual: Exit 0, only first entry used, second silently discarded. No indication to user.
Screenshot: n/a

Disposition: REJECTED - out of scope for lane-drive; defer to follow-up audit lane.

`src/manifest.js:19` — no duplicate check. `src/generator.js:100` — `manifest.team.some((t) => t.role === role ...)` finds the first match, second entry has no effect. `renderManifestYaml` writes both entries back out (src/generator.js:343-347), creating a misleading armada.yaml where only the first duplicate takes effect.

---

## ADV-004: `enabled: 0` (number) treated as enabled

- Session: final
- Suggested severity: LOW

What I did: YAML `enabled: 0` in team entry (YAML number 0, expected falsy)
Expected: `enabled: false` (0 is falsy in YAML bool contexts)
Actual: `enabled: true` — role is enabled
Screenshot: n/a

Disposition: REJECTED - out of scope for lane-drive; defer to follow-up audit lane.

`src/manifest.js:23` — only checks `t.enabled === false || t.enabled === "false"`. Number `0` is neither, defaults to `true`. Should use truthy check: `Boolean(t.enabled) !== false` or explicit `t.enabled === 0` handling. Note: YAML spec treats `0` as not-boolean, but user expectation is that `0` means disabled.

---

## ADV-005: Read-only filesystem errors dump full stack trace

- Session: final
- Suggested severity: MEDIUM

What I did: `chmod 500 .opencode/` then `armada init --from-armada armada/armada.yaml`
Expected: Clean error "Cannot write to .opencode/: permission denied"
Actual: Full Node.js stack trace with absolute paths (EACCES) dumped to stderr
Screenshot: n/a

Disposition: REJECTED - out of scope for lane-drive; defer to follow-up audit lane.

`src/cli.js:140-143` — `main().catch(err => console.error(err))` prints full Error object including stack. `src/scaffold.js:63` — `writeFileSync` throws on permission denied, no try/catch in scaffold. Error propagates to catch handler unformatted. Absolute path `/Users/rafaelmacalaba/...` leaked in stack.

---

## ADV-006: Uninstall requires manifest — no fallback cleanup

- Session: final
- Suggested severity: MEDIUM (known gap — STILL BROKEN)

What I did: `armada init`, then `rm armada/armada.yaml`, then `armada uninstall`
Expected: Uninstall should still clean up generated files, or at least offer `--force` flag
Actual: "Manifest not found: armada/armada.yaml" exit 1. All generated artifacts remain. No way to clean up.
Screenshot: n/a

Disposition: REJECTED - out of scope for lane-drive; defer to follow-up audit lane.

`src/cli.js:268-274` — uninstall always requires a manifest. If user deletes `armada/armada.yaml` (e.g., by accident or git clean), there is no path to remove: `.opencode/oh-my-opencode-slim.jsonc`, `.opencode/oh-my-opencode-slim/*.md`, `.opencode/commands/armada.md`. Suggestion: add `--force` flag that removes all known armada artifacts without reading manifest.

---

## ADV-007: `init --from-armada --budget free` treats `--budget` as filename

- Session: final
- Suggested severity: LOW

What I did: `armada init --from-armada --budget free`
Expected: Parse error about missing file argument after `--from-armada`
Actual: "Manifest not found: --budget" — confusing error, the flag `--budget` is consumed as the file path
Screenshot: n/a

Disposition: REJECTED - out of scope for lane-drive; defer to follow-up audit lane.

`src/cli.js:151` — no `file.startsWith("--")` guard on the `--from-armada` value. Compare `src/cli.js:271` where `uninstall` has this guard: `if (!file || file.startsWith("--") || !existsSync(...))`. Missing guard on `init --from-armada` causes confusing error message instead of "missing file argument for --from-armada".

---

## ADV-008: `opencode.json` model ignores budget tier

- Session: final
- Suggested severity: LOW

What I did: Manifest with `budget: free` and orchestrator `model: opencode-go/minimax-m3` (balanced-tier model)
Expected: opencode.json model should match the budget-adjusted model (hy3 for free tier)
Actual: opencode.json gets `"model": "opencode-go/minimax-m3"` while slim JSONC gets `"model": "opencode-go/hy3"` — inconsistency
Screenshot: n/a

Disposition: REJECTED - out of scope for lane-drive; defer to follow-up audit lane.

`src/generator.js:164` — `renderOpenCodeJson` reads `manifest.team.find(t => t.role === "orchestrator")?.model` from raw manifest, not from `buildTeam` budget-adjusted output. If user sets `budget: free` but leaves a power/balanced model for orchestrator, opencode.json uses the expensive model while armada-orchestrator in slim JSONC uses the free model. Should use `modelFor("orchestrator", manifest.project.budget)` for consistency.

---

## ADV-009: CLI writes through `.opencode` symlinks without warning

- Session: final
- Suggested severity: LOW

What I did: `ln -sf target/ .opencode` then `armada init`
Expected: Warning or error about `.opencode` being a symlink
Actual: Silently follows symlink, writes all files to symlink target. Could be exploited to write outside expected directory.
Screenshot: n/a

Disposition: REJECTED - out of scope for lane-drive; defer to follow-up audit lane.

`src/scaffold.js:60-66` — `write()` uses `mkdirSync` and `writeFileSync` without symlink detection. If `.opencode` is a symlink to another location, armada files are written there. In practice this requires user action (creating the symlink), so severity LOW, but a `realpath` check or warning would be defense-in-depth.

---

## ADV-010: `init` hardcodes `targetDir = "."` — no `--target` flag

- Session: final
- Suggested severity: LOW

What I did: Running `armada init` from any directory always scaffolds to CWD
Expected: `--target <dir>` flag to specify output directory
Actual: `manifest.targetDir = "."` hardcoded at `src/cli.js:187`. No way to scaffold into a different directory.
Screenshot: n/a

Disposition: REJECTED - out of scope for lane-drive; defer to follow-up audit lane.

This is a design limitation, not a bug. Users who want to scaffold into a specific directory must `cd` first. A `--target` flag would improve scripting/CI workflows and match user expectation from other scaffolding tools.

---

## Summary

| # | Severity | Area | Finding |
|---|----------|------|---------|
| ADV-001 | MEDIUM | cli.js:170 | Invalid budget silently accepted |
| ADV-002 | HIGH | manifest.js:19 | Empty model string generates broken config |
| ADV-003 | MEDIUM | manifest.js:19 | Duplicate roles silently accepted |
| ADV-004 | LOW | manifest.js:23 | `enabled: 0` treated as true |
| ADV-005 | MEDIUM | cli.js:140 | Stack traces leak on filesystem errors |
| ADV-006 | MEDIUM | cli.js:268 | Uninstall requires manifest — STILL BROKEN |
| ADV-007 | LOW | cli.js:151 | Missing `--` guard on `--from-armada` arg |
| ADV-008 | LOW | generator.js:164 | opencode.json model ignores budget tier |
| ADV-009 | LOW | scaffold.js:60 | Symlinks followed without warning |
| ADV-010 | LOW | cli.js:187 | No `--target` flag for output directory |
| ADV-011 | MEDIUM | reconcile.js:20 | `/\d+ failing/` false positive on "0 failing" |
| ADV-012 | MEDIUM | reconcile.js:71 | Uppercase `X` in checkboxes not parsed |
| ADV-013 | LOW | reconcile.js:286 | Inconsistent activeFeature/resumeLine with no phases |
| ADV-014 | LOW | reconcile.js:104-111 | Directory evidence flagged as `evidence-missing` |
| ADV-021 | LOW | generator.js:383 | Fallback instruction unreachable in generated repos |
| ADV-022 | LOW | docs/validation.md:480 | Live validation ran fallback, not primary path |

`main() returns undefined` / exit code propagation: **FIXED** — `main()` is async, returns Promise. Resolved promise with `undefined` value exits 0. On rejection, catch handler sets `process.exitCode = 1`. Commands that set `process.exitCode` inline (unknown command, missing manifest) exit correctly.

---

## ADV-011: `/\d+ failing/` regex triggers false positive on "0 failing"

---

Disposition: ACCEPTED -> DEF-001

---

## ADV-028: Array.isArray guard at reconcile.js:229 has zero test coverage

- Session: phase-3 gate
- Suggested severity: MEDIUM

What I did: Read `src/reconcile.js:229` — `const criteria = Array.isArray(phase.criteria) ? phase.criteria : []`. Grepped `tests/reconcile.test.js` and `e2e/reconcile.test.js` for `null`, `undefined`, `non-array`, `defensive`, `missing.*criteria`. Zero matches. Test helper `phase()` at `tests/reconcile.test.js:31` defaults `criteria` to `[]`, and every test case passes an explicit array.

Expected: At least one test case exercising the non-array path (e.g., `criteria: null`, `criteria: undefined`, `criteria: "string"`) to prove the guard works.

Actual: Guard code path has 0% coverage. `docs/validation.md:592` claims "Existing reconcile unit tests still pass (313 green). No new test needed — guard is defensive; existing tests already cover the iterable case." This misses the point: the iterable case is the happy path. The guard exists precisely for the non-iterable case, which is untested.

Disposition: ACCEPTED -> fixed in 0ae33ff
History:
- orchestrator: ACCEPTED -> fixed in 0ae33ff

---

## ADV-029: active.json p3-all-tests-green evidence ref is command string, not file path

- Session: phase-3 gate
- Suggested severity: MEDIUM

What I did: Read `armada/state/active.json:130-134`. Criterion `p3-all-tests-green` has `evidence.ref: "node --test tests/*.test.js — 313 pass, 0 fail"`. Every other evidence ref in the file is a relative filesystem path (e.g., `armada/state/evidence/phase-2/tests-pass.txt`).

Expected: Evidence ref is a filesystem path. Reconcile engine passes it to `path.join(repoRoot, ref)` then `fs.existsSync(fullPath)` — works for file paths, fails for command strings.

Actual: `ref` is a shell command string. `checkEvidence("test", "node --test tests/*.test.js — 313 pass, 0 fail", repoRoot, fs)` at `reconcile.js:97` would call `path.join(repoRoot, "node --test tests/*.test.js — 313 pass, 0 fail")` — produces a valid (but nonexistent) path, `existsSync` returns false, drifts as `evidence-missing`. The actual evidence file (`tests-pass.txt`) sits at a different path entirely.

Disposition: ACCEPTED -> fixed in 0ae33ff
History:
- orchestrator: ACCEPTED -> fixed in 0ae33ff

---

## ADV-030: reconcile.js:226 — no null guard on individual phase entries in phases array

- Session: phase-3 gate
- Suggested severity: MEDIUM

What I did: Read `src/reconcile.js:226-227` — `for (const phase of phases)` followed immediately by `phase.id`. Same class of bug as the `Array.isArray` guard at line 229. If `phases` array contains a null/undefined entry (from malformed `active.json`), crashes at `phase.id`.

Expected: Same defensive pattern as line 229 — `if (!phase || typeof phase !== 'object') continue`.

Actual: No guard. `phases` is sourced from `active.phaseGraph?.phases || []` at line 206 — user-controlled, untrusted input. A single `null` in the array crashes the entire reconcile engine.

Disposition: ACCEPTED -> fixed in 0ae33ff
History:
- orchestrator: ACCEPTED -> fixed in 0ae33ff

---

## ADV-031: reconcile.js checkEvidence crashes on undefined evidence.ref

- Session: phase-3 gate
- Suggested severity: MEDIUM

What I did: Traced `checkEvidence` call at `reconcile.js:233` with a truthy `crit.evidence` object that lacks a `ref` field (e.g., `{kind: "test"}`). Verified Node.js behavior: `path.join('/foo', undefined)` throws `TypeError: The "path" argument must be of type string. Received undefined`.

Expected: Graceful handling — either skip the criterion with missing ref, or report `evidence-missing` drift without crashing.

Actual: `reconcile.js:97` — `const fullPath = join(repoRoot, ref)`. If `ref` is `undefined` (evidence object present but ref field missing), `path.join` throws TypeError. Uncaught crash. Same class of bug as line 229 — state file shape not validated before use. The `Array.isArray` guard at line 229 fixed the `criteria` array shape but the contents of each criterion (specifically `evidence.ref`) are still unvalidated.

Disposition: ACCEPTED -> fixed in 0ae33ff
History:
- orchestrator: ACCEPTED -> fixed in 0ae33ff

---

## ADV-032: active.json top-level evidence array inconsistent across phases

- Session: phase-3 gate
- Suggested severity: LOW

What I did: Read `armada/state/active.json:140-165`. Top-level `evidence` array has 4 entries — all `phase: "phase-2"`. Phase 1 has 6 criteria with evidence refs, phase 3 has 3 criteria with evidence refs, but neither appears in the top-level `evidence` array.

Expected: Either all phases populate the top-level `evidence` array, or none do. Consistency across phases.

Actual: Only phase-2 evidence is duplicated in the top-level array. Phase 1 and phase 3 evidence exists only in `criteria[].evidence`. This inconsistency makes the schema ambiguous — does the top-level array matter? The reconcile engine does not read it (it iterates `phase.criteria[].evidence`), but the array's existence implies it should be authoritative. If a future tool reads it, it would incorrectly report zero evidence for phases 1 and 3.

Disposition: ACCEPTED -> fixed in 0ae33ff
History:
- orchestrator: ACCEPTED -> fixed in 0ae33ff

---

## ADV-033: manual-walkthrough.md assumes `npm install -g opencode-armada` publishes to npm

- Session: phase-3 gate
- Suggested severity: LOW

What I did: Read `armada/state/evidence/phase-2/manual-walkthrough.md:11` — `npm install -g opencode-armada`. As of 2026-08-03, no `opencode-armada` package is registered on npm.

Expected: Walkthrough includes a fallback for installing from local path: `npm install -g .` from the armada source tree, or `npm link`.

Actual: Step 1 of pre-flight gives a command that fails with npm 404. A user following the walkthrough on a fresh machine hits an error at the very first actionable step. The doc later notes at line 82 "If armada binary is not on PATH, the fallback... won't work" but doesn't address how to get the binary in the first place.

Disposition: ACCEPTED -> fixed in 0ae33ff
History:
- orchestrator: ACCEPTED -> fixed in 0ae33ff

---

## ADV-034: manual-walkthrough.md Step 2 expects specific scratch contract shape

- Session: phase-3 gate
- Suggested severity: LOW

What I did: Read `armada/state/evidence/phase-2/manual-walkthrough.md:44-45` — "criteria has one entry 'All tests pass' with evidence: null". This assumes `armada feature new scratch-resume-walkthrough` produces a contract with exactly one criterion labeled "All tests pass".

Expected: Walkthrough step is agnostic to contract content — references the active.json schema directly (e.g., "phase-1 criteria array has at least one entry, each with id, text, and evidence fields").

Actual: Step hardcodes a specific contract template assumption. If the scratch feature template changes (e.g., generates different criterion text, or multiple criteria), the user's expected output won't match and the walkthrough fails silently.

Disposition: ACCEPTED -> fixed in 0ae33ff
History:
- orchestrator: ACCEPTED -> fixed in 0ae33ff

---

## ADV-035: validation.md claims in-lane probe of live repo despite `external_directory: deny`

- Session: phase-3 gate
- Suggested severity: LOW

What I did: Read `docs/validation.md:583-585` — "Read-only probe of ~/WBG/data-ai-chatbot confirms the live repo's stack detected correctly." The lane's `opencode.json` has `permission: {external_directory: "deny"}`.

Expected: Either the doc clarifies this was a user-side manual step, or the lane got a one-time external exception and documents it.

Actual: The doc reads as though the lane itself probed the live repo. The `external_directory: deny` permission means no tool (read, bash, glob) could access `~/WBG/`. A user reading this might assume the lane automated the probe and be confused when their own lane can't touch external directories. The contradiction isn't resolved in the text — the reader must infer it was manual.

---

## ADV-019: `applyPreset` drops `stack.instructions` from armada.yaml

- Session: final
- Suggested severity: MEDIUM

What I did: armada.yaml with `stack.instructions: [".cursor/rules", "CLAUDE.md"]`. Ran `armada preset power --target <dir>`.
Expected: `instructions` field preserved in the rewritten armada.yaml (preset only changes budget + team models).
Actual: `instructions` silently dropped from output. Post-preset armada.yaml has zero `instructions` lines. Data loss on preset apply.
Screenshot: n/a

Disposition: ACCEPTED -> DEF-009

`src/preset-command.js:56-98` — local `renderArmadaYaml` template at lines 87-92 doesn't include `instructions` field. The canonical `renderManifestYaml` in `src/generator.js:530` does include `instructions`. The local copy diverges: it supports `variant` (generator doesn't) but drops `instructions` (generator includes them). Fix: either use `renderManifestYaml(buildTeam(...))` as the contract specifies, or keep the local renderer in sync.

---

## ADV-020: `applyPreset` local renderer silently drops any future manifest fields

- Session: final
- Suggested severity: MEDIUM

What I did: armada.yaml with any field not in the local `renderArmadaYaml` template (e.g., `stack.instructions`, or any future `project.` field).
Expected: Non-model/budget fields pass through unchanged (preset only overrides budget + team models/variants).
Actual: Any field not explicitly in `renderArmadaYaml`'s template is silently dropped. The contract for Phase 3 says "writes back via renderManifestYaml(buildTeam(manifest))" but the code uses a locally-maintained copy. Schema evolution creates a maintenance fork.
Screenshot: n/a

Disposition: ACCEPTED -> DEF-010

`src/preset-command.js:56-98` — `renderArmadaYaml` is a local copy distinct from the canonical `renderManifestYaml` in `src/generator.js:501-536`. Differences: local supports variant but drops instructions; canonical supports instructions but drops variant. Any schema change must be mirrored in both places.

---

## ADV-021: Fallback instruction unreachable in generated repos

- Session: final
- Suggested severity: LOW

What I did: Read the rendered command body from `renderArmadaResumeCommand()` (generator.js:383-389). The body says:
`Run \`armada reconcile\` ... If the global \`armada\` binary is not on PATH, fall back to \`node src/cli.js reconcile\`.`

In a generated repo (e.g. `~/WBG/data-ai-chatbot`), `src/cli.js` does not exist — only the armada source tree has that file. The command body is rendered identically for both source-tree and generated-repo contexts (`renderArmadaResumeCommand()` takes zero arguments). An orchestrator in a generated repo without the global binary would follow the fallback instruction and get `Error: Cannot find module '.../src/cli.js'` — silent failure, no resume line.

Expected: Command body is either context-aware (mentions fallback only for source tree) or clarifies that the in-tree path exists only inside the armada source tree.

Actual: Both paths rendered unconditionally. Fallback is unreachable in generated repos.

Screenshot: n/a


Contract says fallback is "in-tree" (`armada/REQUIREMENTS.md:19` — "fall back to the in-tree `node src/cli.js reconcile`"). The command body text is correct per the contract, but the context (generated repo vs source tree) is lost by the time the orchestrator reads it. The orchestrator has no way to know the fallback won't work.

Disposition: ACCEPTED -> fixed in `src/generator.js:388` (command body now conditions the fallback on `src/cli.js` existing in cwd; generated-repo orchestrator that loses the global binary gets a clear "missing binary" report instead of a confusing module-not-found error)

---

## ADV-022: Live validation ran fallback path, not primary path

- Session: final
- Suggested severity: LOW

What I did: Read `docs/validation.md:480-535`. The Phase 2 live-validation criterion says (REQUIREMENTS.md:35-38): "init there, open a feature, kill a session mid-phase, run `armada reconcile` from the generated repo."

The validation ran `node src/cli.js reconcile` (fallback), not `armada reconcile` (primary), because `command -v armada` returned not-found (line 500-501). The doc also used a clone of the target repo instead of the live checkout (lines 524-529), with rationale documented.

Expected: Live validation exercises the primary path (`armada reconcile`) on a real global install, or explicitly documents that it was skipped and why.

Actual: Doc is honest — it states the global binary is not installed and the fallback was used (line 518-522). The e2e test (`e2e/armada-resume-command.test.js`) covers the primary path with a fake binary. The combination (e2e primary + live fallback) covers both paths fully. The doc correctly notes "For a true end-to-end test of the primary path on this machine, install armada globally" (line 521-522).

Screenshot: n/a


This is a documentation gap, not a code gap. The e2e test proves the primary path works (fake bin → real CLI reconcile → exit 0 + resume line). The live validation proves the fallback works on real state. The contract says "run `armada reconcile` from the generated repo" — this was not done with a real global install. The doc is transparent about the limitation.

Disposition: ACCEPTED -> fixed by `npm link` (`/opt/homebrew/bin/armada` -> lane's `bin/armada.js`); live validation re-ran against the `~/WBG/data-ai-chatbot` clone via the primary `armada reconcile` invocation. Same resume line, same exit 0. Recorded in `docs/validation.md` (2026-08-03 re-run section).

---

## ADV-023: `--name` value starting with single dash (`-`) breaks tmux

- Session: phase-1 gate
- Suggested severity: HIGH

What I did: `armada drive . --name=-foo` or `armada drive . --name -foo`
Expected: Session name `-foo` rejected with clear error, or correctly handled.
Actual: `tmux has-session -t -foo` — tmux interprets `-foo` as a flag, not a session name. Command may fail silently or with a confusing tmux error. The guard at `src/cli.js:467` only checks `.startsWith("--")`, not `.startsWith("-")`. Single-dash session names are valid strings but invalid tmux session-name args when passed directly after `-t`/`-s`.
Disposition: ACCEPTED -> DEF-011

Disposition: ACCEPTED -> DEF-011

`src/cli.js:467-469` — `!args[nameIdx + 1].startsWith("--")` allows values like `-foo`, `-x`, `-n`. `src/drive.js:53` — the name is passed directly to `tmux has-session -t <name>`. tmux interprets anything starting with `-` after `-t` as flags. Fix: validate that name doesn't start with `-`, or prepend `=` to the flag (e.g., `-t=-foo` works in tmux).

---

## ADV-024: `--timeout` with non-numeric value produces NaN deadline

- Session: phase-1 gate
- Suggested severity: MEDIUM

What I did: `armada drive . --timeout abc` or `armada drive . --timeout ""`
Expected: Parse error "timeout must be a positive integer".
Actual: `parseInt("abc", 10)` returns `NaN`. `driveCmd` passes `timeoutMs: NaN` to `bootLane`. Because the key `timeoutMs` is explicitly in the object, the default `timeoutMs = 30000` in the destructured parameter is NOT triggered. `Date.now() + NaN` = `NaN`. The while-loop condition `Date.now() < NaN` is always `false`, so the poll loop never runs. Error message: `"TUI not ready after NaNms"` — confusing.
Disposition: ACCEPTED -> DEF-012

Disposition: ACCEPTED -> DEF-012

`src/cli.js:480-481` — `parseInt(args[timeoutIdx + 1], 10)` can return `NaN` (non-numeric string) or `0` (string `"0"`). Neither is validated. `src/drive.js:72` — `Date.now() + timeoutMs` produces `NaN`. Destructured default only triggers when the key is absent, not when the value is `NaN`. Fix: validate `Number.isFinite(timeoutMs) && timeoutMs > 0`, otherwise error.

---

## ADV-025: Newline in `--prompt` sent as literal Enter keystroke

- Session: phase-1 gate
- Suggested severity: MEDIUM

What I did: Pass a prompt containing `\n` characters, e.g., `--prompt $'line1\nline2'` in bash.
Expected: Either the newline is escaped/stripped, or the command errors out with "prompt must not contain newlines".
Screenshot: n/a

Disposition: REJECTED - `send-keys -l` is documented as "send keys literally"; user is responsible for prompt content. Default prompt has no newline. Out of contract scope.

`src/drive.js:95` — `spawn("tmux", ["send-keys", "-t", name, "-l", prompt])`. The `-l` flag sends literal keystrokes; newlines ARE Enter. `src/cli.js:472` — the DEFAULT_PROMPT has no newlines, so the default path is safe. Custom `--prompt` values (scripts, CI pipelines, multi-line strings from files) are vulnerable. Fix: either strip/replace newlines before passing, or fail with a clear error if the prompt contains them.

---

## ADV-026: `bootLane` returns success when register never detected after resend

- Session: phase-1 gate
- Suggested severity: HIGH

What I did: Create a scenario where the opencode TUI never shows the `thinking` indicator after the prompt is sent (slow model load, broken install, model error).
Actual: `src/drive.js:117-125` — after `checkRegister()` returns `false`, the prompt is resent, `checkRegister()` is called a second time. If it still returns `false`, `registered` remains `false`, but the function **returns `{ name, attached: false }`** — success. No error is thrown, no warning logged. `src/cli.js:512` prints `"armada drive: session \"<name>\" ready, prompt registered."` — falsely claiming registration succeeded.
Screenshot: n/a

Disposition: ACCEPTED -> DEF-013

`src/drive.js:117-125`:
```js
let registered = await checkRegister()
if (!registered) {
    log("resending prompt")
    await sendPrompt()
    registered = await checkRegister()
}
return { name, attached: false }  // registered could still be false!
```
The contract (REQUIREMENTS.md:27-28) says: "It verifies the prompt registered ... and resends once if not." After the resend, if register still fails, that's a failed verification — it should throw a DriveError. The current code silently succeeds. The test at `tests/drive.test.js:198-214` (resend-only) covers the case where resend succeeds but never tests the double-failure case. 

---

## ADV-027: CLI prints "prompt registered" when session was reattached (no prompt sent)

- Session: phase-1 gate
- Suggested severity: MEDIUM

Expected: Message clarifies that the session was reattached, no new prompt was sent.
Actual: `src/cli.js:512` prints the same success message regardless of `attached` status: `"armada drive: session ... ready, prompt registered."` When `attached: true`, `bootLane` returned at `src/drive.js:54-55` without sending any prompt. The message is misleading — no prompt was registered by this invocation.
Screenshot: n/a

Disposition: ACCEPTED -> DEF-014

`src/cli.js:503-513` — the `catch` block is the only branch. The success path always prints the same message. `bootLane` returns `{ name, attached: true }` for reattach or `{ name, attached: false }` for new boot, but `driveCmd` ignores `attached`. Fix: branch the message on `result.attached` — "session already running, attach with ..." vs "session ready, prompt registered."

---

## ADV-028: `--name` with no value silently falls back to basename default

- Session: phase-1 gate
- Suggested severity: MEDIUM
What I did: `armada drive . --name` (flag present but no value) or `armada drive . --name --timeout 5000`
Expected: Error "`--name` requires a value" or similar.
Actual: `src/cli.js:467-469` — `args[nameIdx + 1]` is either `undefined` (end of args) or the next flag like `--timeout`. The `&&` short-circuits on the falsy/flag case, and `name` defaults to `basename(resolve(lanePath))`. The user's `--name` flag is silently consumed with no value. No error, no warning.
Screenshot: n/a

Disposition: REJECTED - use `--name=foo` (equals form) to disambiguate. Standard CLI convention. Names like `--prompt` not realistic.

`src/cli.js:467-469` — same pattern as `--timeout` (line 480) and `--prompt` (line 474). All silently fall back when the next arg is missing or starts with `--`. For `--name` this is particularly confusing because the session gets named after the lane directory, not what the user intended. Fix: validate that the value is present and not flag-like; error if missing.

---

## ADV-029: Session names with spaces produce broken `tmux attach` hint

- Session: phase-1 gate

What I did: `armada drive "my lane"` (lane directory has a space in the name).
Expected: The attach hint escapes or quotes the session name: `tmux attach -t "my lane"`.
Actual: `src/cli.js:512` — `tmux attach -t ${name}`. If name is `my lane`, the printed command is `tmux attach -t my lane`. A user copy-pasting this into a shell would get an error — tmux sees `my` as the session name and `lane` as an extra argument, not a session name.
Screenshot: n/a

Disposition: REJECTED - tmux session names with spaces technically allowed but practically unused; user can quote. Out of scope.

`src/cli.js:512` — no quoting around `${name}`. Fix: wrap in quotes or use `JSON.stringify(name)` for safe shell output.

---

## ADV-030: `--no-open` informational note uses `console.error` (stderr)

- Suggested severity: LOW

What I did: `armada drive . --no-open` with stdout piped, e.g., `armada drive . --no-open 2>/dev/null`
Expected: The informational `--no-open` note appears on stdout with the rest of the output.
Actual: `src/cli.js:500` — `console.error(...)` sends it to stderr. Piping stdout discards the note. In a CI pipeline where stderr is monitored for errors, this informational line shows up as noise.
Screenshot: n/a

Disposition: REJECTED - stderr is conventional channel for informational/diagnostic CLI output. Not a defect.

`src/cli.js:499-501` — `console.error` for a non-error informational message. Other drive output (success, attach hint) goes to `console.log`. Inconsistency. Fix: use `console.log` or pass a `log` callback.

---

## ADV-031: Pane tail in DriveError message may leak secrets from opencode TUI
- Session: phase-1 gate
- Suggested severity: MEDIUM

What I did: Trigger a TUI-ready timeout. The pane tail (last 2000 chars of TUI output) is included in the error message and printed to stderr.
Expected: The pane tail is logged at a debug level, or redacted before being included in the error message. The error message summarizes the failure without raw pane content.
Actual: `src/drive.js:87-91` — `new DriveError(message, tail)` includes `paneOutput.slice(-2000)` in the error message. If opencode's TUI displays API keys, environment variables, or credential prompts in the pane, those are included in the error output. `src/cli.js:515-516` — `console.error(err.message)` prints the full message including pane tail to stderr.
Screenshot: n/a

Disposition: REJECTED - contract Phase 1 c4 explicitly requires printing pane tail on timeout. The "leak" is by design — users control TUI content.

`src/drive.js:88-91` — the pane tail is the diagnostic tool, but it's embedded in the user-visible error message. On a CI runner, stderr is often captured in logs. Fix: log the pane tail separately (warn/debug), keep the error message short, or make the pane tail an opt-in detail behind `DEBUG=1`.

---


## ADV-032: `--prompt` value starting with `--` silently falls back to default
- Session: phase-1 gate
- Suggested severity: LOW

What I did: `armada drive . --prompt "--check"` (custom prompt text that happens to start with `--`).
Expected: Prompt `--check` is used as-is. The literal `--check` is a reasonable prompt string.
Actual: `src/cli.js:474` — `!args[promptIdx + 1].startsWith("--")` rejects the value. The prompt silently falls back to DEFAULT_PROMPT. No error or warning. The user's custom prompt is discarded.
Screenshot: n/a

Disposition: ACCEPTED -> DEF-015

`src/cli.js:473-476` — the anti-flag guard on the value prevents legitimate prompt strings that start with `--`. Same issue exists for `--name` (ADV-023/028) but for `--prompt` it's more likely to hit real use: any prompt starting with `--` (e.g., `--verbose`, `--strict`, or a command-like string) is swallowed. Fix: use `=` syntax (`--prompt=...`) or allow the value unconditionally (the positional arg search already handled by `!a.startsWith("--")` filter; flag values don't need a second filter).

---

## Drive Phase 1 Summary

| # | Severity | Area | Finding |
|---|----------|------|---------|
| ADV-023 | HIGH | cli.js:467 | `--name` with single-dash value breaks tmux |
| ADV-024 | MEDIUM | cli.js:481 | `--timeout` non-numeric produces NaN deadline |
| ADV-025 | MEDIUM | drive.js:95 | Newline in prompt sent as Enter keystroke |
| ADV-026 | HIGH | drive.js:117-125 | bootLane succeeds when register never detected |
| ADV-027 | MEDIUM | cli.js:512 | "prompt registered" message when reattaching |
| ADV-028 | MEDIUM | cli.js:467 | `--name` with no value silently ignored |
| ADV-029 | LOW | cli.js:512 | Spaces in session name break attach hint |
| ADV-030 | LOW | cli.js:500 | `--no-open` note on stderr |
| ADV-031 | MEDIUM | drive.js:88-91 | Pane tail leaks secrets in error message |
| ADV-032 | LOW | cli.js:474 | `--prompt` starting with `--` silently ignored |
---

## Phase 2 — Auto-open visible terminal

## ADV-033: AppleScript injection via `--name` session name on macOS (arbitrary code execution)

- Session: phase-2 gate
- Suggested severity: HIGH

What I did: Traced the data flow from `driveCmd` through `openTerminal` to the AppleScript template. `buildAttachCommand(name)` at line 30-35 only quotes names containing whitespace. Shell metacharacters (including `"`) pass through unescaped. The AppleScript at line 147 uses template literal:
```
`tell application "${appName}" to do script "${attachCmd}"`
```
If `attachCmd` contains a `"` character, it breaks out of the AppleScript string literal.

Reproduction on macOS:
```
armada drive . --name='foo"; do shell script "touch /tmp/pwned" #'
```
The AppleScript becomes:
Disposition: ACCEPTED -> DEF-016
tell application "Terminal" to do script "tmux attach -t foo"; do shell script "touch /tmp/pwned" #""
```
The `do shell script "touch /tmp/pwned"` runs arbitrary code. Any shell command, file read, or network request is possible.

Expected: Session name is validated/sanitized to prevent AppleScript injection. Characters like `"`, `\`, backticks are rejected or escaped.

Actual: `buildAttachCommand` at `src/terminal-open.js:30-35` only checks `/[\s]/` — ignores all other shell/AppleScript metacharacters. No validation in `driveCmd` either (`src/cli.js:501` only rejects names starting with `-`).

Screenshots: n/a

Disposition: ACCEPTED -> DEF-016

`src/terminal-open.js:147` — AppleScript template literal embeds unsanitized `attachCmd`.
`src/terminal-open.js:30-35` — `buildAttachCommand` only quotes on whitespace, never escapes `"`.
`src/cli.js:498-499` — no name validation beyond `startsWith("-")`. The `--name` flag value flows directly into `openTerminal`.

---

## ADV-034: Shell injection via `--name` in bash -c on Linux/Windows (arbitrary command execution)

- Session: phase-2 gate
- Suggested severity: HIGH

What I did: On Linux, `pickTerminal` produces argv templates like `["gnome-terminal", "--", "bash", "-c", "__ATTACH_CMD__; exec bash"]`. At line 158, `__ATTACH_CMD__` is substituted with the return of `buildAttachCommand(name)`. If `name = "foo;id"` (no whitespace, no quoting triggered), the final argv element becomes:
```
bash -c "tmux attach -t foo;id; exec bash"
```
bash parses `-c` with this string and executes three commands: `tmux attach -t foo`, then `id`, then `exec bash`. The `id` command is attacker-controlled arbitrary execution.

Same vector for names with `"` — even when the name has whitespace:
```
name = 'foo"; rm -rf / #'
buildAttachCommand returns: tmux attach -t "foo"; rm -rf / #"
```
Disposition: ACCEPTED -> DEF-017
```
bash -c "tmux attach -t "foo"; rm -rf / #"; exec bash"
```
The shell closes the first `"` after `-t `, leaving `; rm -rf /` as a free command.

Expected: Session name characters are restricted (alphanumeric, dash, underscore, dot per tmux conventions) or the value is properly escaped for the target shell context.

Actual: `buildAttachCommand` at `src/terminal-open.js:30-35` only quotes on `/[\s]/` — no shell metacharacter escaping. `driveCmd` imposes no name restrictions beyond `startsWith("-")`.

Screenshots: n/a

Disposition: ACCEPTED -> DEF-017

`src/terminal-open.js:158` — unsafe string substitution into shell -c argument.
`src/terminal-open.js:30-35` — `buildAttachCommand` is a quoting function that only considers whitespace, not shell metacharacters.
`src/cli.js:498-499` — no `--name` validation.
Windows path (lines 66-71) has same issue: `cmd /k "__ATTACH_CMD__"` with unsanitized input.

---

## ADV-035: Wayland `DISPLAY` check misses `WAYLAND_DISPLAY` — graphical users classified as headless

- Session: phase-2 gate
- Suggested severity: MEDIUM
Disposition: ACCEPTED -> DEF-018
What I did: Examined `openTerminal` line 131:
```js
const hasDisplay = os === "macos" ? true : Boolean(env?.DISPLAY)
```
On Wayland-only Linux sessions, `DISPLAY` is often unset (Wayland uses `WAYLAND_DISPLAY`). A user running a modern GNOME or KDE Plasma Wayland session with `WAYLAND_DISPLAY=wayland-0` but no `DISPLAY` fallback gets `hasDisplay: false`, causing `pickTerminal` to return `{ kind: "none", reason: "no display (headless or SSH)" }`.

Expected: Wayland display detected via `WAYLAND_DISPLAY` env var, or at minimum the reason message is accurate ("no X11 display; try setting DISPLAY or installing wezterm") rather than "headless or SSH".

Actual: User has a graphical session but is told they are headless. Falls back to the `tmux attach -t <name>` hint. Auto-open silently skipped.

Screenshots: n/a

Disposition: ACCEPTED -> DEF-018

`src/terminal-open.js:131` — `hasDisplay` only checks `DISPLAY`, not `WAYLAND_DISPLAY` or `XDG_SESSION_TYPE=wayland`.

---

## ADV-036: wezterm detected but never selected on macOS — dead code path
Disposition: REJECTED - contract c1 explicitly says "macOS: Terminal.app (or iTerm if present)"; wezterm not in macOS priority list. Dead code by design, not a bug.
- Session: phase-2 gate
- Suggested severity: MEDIUM

What I did: Traced `openTerminal` execution. At lines 120-129, `which("wezterm", dirs)` is called for ALL platforms including macOS. The result is stored in `whichResults.wezterm`. However, `pickTerminal` on macOS (lines 38-44) only checks `whichResults.iTerm` and falls through to `Terminal.app`. It never checks `whichResults.wezterm`.

So a macOS user who has wezterm installed but no iTerm gets Terminal.app — not wezterm. The `which("wezterm", dirs)` call on macOS is dead code: the result is computed but never consumed.

Expected: Either wezterm is intentionally excluded on macOS (remove the dead `which` call), or wezterm is checked as a fallback between iTerm and Terminal.app.

Actual: wezterm on macOS is detected (cost: one `accessSync` per PATH entry) but silently ignored. The contract says "wezterm is optional, never required" — but the current behavior means it's effectively excluded on macOS regardless of user preference.

Screenshots: n/a

Disposition: REJECTED - contract c1 explicitly says "macOS: Terminal.app (or iTerm if present)"; wezterm not in macOS priority list. Dead code by design, not a bug.

`src/terminal-open.js:38-44` — `pickTerminal` macOS branch missing wezterm check.
`src/terminal-open.js:120` — `which("wezterm", ...)` runs on macOS but result is dead.

---

## ADV-037: iTerm.app only detected in `/Applications` — Homebrew and user-local installs missed

Disposition: ACCEPTED -> DEF-019
- Suggested severity: LOW

What I did: Examined iTerm detection `src/terminal-open.js:114`:
```js
accessSync("/Applications/iTerm.app", constants.F_OK)
```
Hardcoded path. Homebrew on Apple Silicon installs iTerm to `/opt/homebrew/Caskroom/iterm2/` (symlinked from `/Applications` in most cases, so this usually works). But if a user installs iTerm manually to `~/Applications/iTerm.app`, uses a different volume, or has a non-standard setup, the detection fails silently. The user falls back to Terminal.app with no indication.

Expected: iTerm detection checks multiple common paths, or uses `mdfind`/`lsregister` for a robust check, or at minimum logs a warning when wezterm is available but iTerm is not at the expected path.

Actual: Single hardcoded path. No fallback detection. No logging when iTerm is absent.

Screenshots: n/a

Disposition: ACCEPTED -> DEF-019

`src/terminal-open.js:114` — hardcoded `/Applications/iTerm.app`.

---

## Phase 2 Summary

| # | Severity | Area | Finding |
|---|----------|------|---------|
| ADV-033 | HIGH | terminal-open.js:147 | AppleScript injection via `--name` on macOS |
| ADV-034 | HIGH | terminal-open.js:30-35,158 | Shell injection via `--name` in bash -c on Linux/Windows |
| ADV-035 | MEDIUM | terminal-open.js:131 | Wayland `DISPLAY` check ignores `WAYLAND_DISPLAY` |
| ADV-036 | MEDIUM | terminal-open.js:38-44 | wezterm detected but never selected on macOS |
| ADV-037 | LOW | terminal-open.js:114 | iTerm only checked in /Applications |


---

## Phase 1 Tab — `pickAttachStrategy` review

## ADV-038: `hasWeztermServer=true` on Windows excluded — os guard untested

- Session: phase-1 gate
- Suggested severity: MEDIUM

What I did: Traced rule 5 line 124: `hasWeztermServer && (os === "macos" || os === "linux")`. No test supplies `hasWeztermServer: true` with `os: "windows"`. The guard correctly excludes Windows per spec c6 ("Linux/macOS"), but the exclusion is invisible to the test suite.

Expected: Test verifies `hasWeztermServer: true` + `os: "windows"` falls through to rule 6 (classic pickTerminal), not rule 5 (wezterm tab).

Actual: No test for this combination. If the `(os === "macos" || os === "linux")` guard were accidentally removed in a future refactor, Windows behavior would silently change and no test would catch it.

Disposition: ACCEPTED -> DEF-021

`src/terminal-open.js:124` — os guard on rule 5 untested for Windows exclusion.

---

## ADV-039: Rule 1-3 TERM_PROGRAM precedence over rule 5 (hasWeztermServer) — untested

- Session: phase-1 gate
- Suggested severity: MEDIUM

What I did: Verified rule 4 (vscode) precedence over rule 5 is tested (test c6). But no test verifies that rules 1-3 (Apple_Terminal, iTerm.app, WezTerm) also short-circuit BEFORE rule 5 when `hasWeztermServer: true`.

Expected: Tests for these three edge cases:
- `TERM_PROGRAM: "Apple_Terminal"` + `hasWeztermServer: true` + `os: "macos"` → rule 1 wins (Terminal.app tab), not wezterm tab from rule 5.
- `TERM_PROGRAM: "iTerm.app"` + `hasWeztermServer: true` + `os: "macos"` → rule 2 wins (iTerm tab), not wezterm tab from rule 5.
- `TERM_PROGRAM: "WezTerm"` + `hasWeztermServer: true` → rule 3 wins (wezterm tab via TERM_PROGRAM match).

Actual: None of these three precedence combos tested. If rules were reordered, behavior could change silently. Code is correct (rules 1-3 return before rule 5 is reached) but unverified.

Disposition: ACCEPTED -> DEF-022

`src/terminal-open.js:101-113` (rules 1-3) + `src/terminal-open.js:124` (rule 5) — no precedence test for these combinations.

---

## ADV-040: TERM_PROGRAM="" (empty string) untested — falls through correctly

- Session: phase-1 gate
- Suggested severity: LOW

What I did: `env: { TERM_PROGRAM: "" }` — empty string won't match rules 1-4 (exact string comparison). Falls through to rule 5 (hasWeztermServer) then rule 6 (classic pickTerminal). Behavior is correct — empty string effectively treated as "no TERM_PROGRAM".

Expected: Test covering empty-string TERM_PROGRAM to confirm distinct from missing TERM_PROGRAM key. No rule incorrectly fires on empty string.

Actual: No test for empty string. No test distinguishing `{ TERM_PROGRAM: "" }` (key present, empty value) from `{}` (key absent). `env?.TERM_PROGRAM` returns `""` in first case, `undefined` in second. Both behave identically through rules 1-5, but path differentiation uncovered.

Disposition: ACCEPTED -> DEF-023

`src/terminal-open.js:98` — `env?.TERM_PROGRAM` returns `""` when field exists with empty-string value. `===` comparisons against non-empty strings fail correctly. Rule 4 `isVSCode` is false. Path untested.

---

## ADV-041: `env` parameter undefined/null — untested, handled by optional chaining

- Session: phase-1 gate
- Suggested severity: LOW

What I did: Called `pickAttachStrategy` with `env: undefined` and `env: null`. `env?.TERM_PROGRAM` at line 98 returns undefined in both cases via optional chaining. `env?.VSCODE_IPC_HOOK_CLI` at line 117 likewise safe. All rules behave correctly — no TERM_PROGRAM match, no vscode IPC hook, fall through to rule 5/6.

Expected: Explicit test for undefined/null env to protect against future regressions where optional chaining might be refactored away (e.g., changed to `env.TERM_PROGRAM` which throws TypeError on undefined).

Actual: No test for these cases. Code handles both correctly, but the safety depends entirely on the `?.` operator replacement-resistant.

Disposition: ACCEPTED -> DEF-024

`src/terminal-open.js:98` — `env?.TERM_PROGRAM` guards against undefined/null. `src/terminal-open.js:117` — `env?.VSCODE_IPC_HOOK_CLI` same. No test.

---

## Phase 1 Tab Summary

| # | Severity | Area | Finding |
|---|----------|------|---------|
| ADV-038 | MEDIUM | terminal-open.js:124 | hasWeztermServer+Windows untested os guard |
| ADV-039 | MEDIUM | terminal-open.js:101-124 | Rules 1-3 precedence over rule 5 untested |
| ADV-040 | LOW | terminal-open.js:98 | TERM_PROGRAM="" edge case untested |
| ADV-041 | LOW | terminal-open.js:98,117 | env undefined/null untested |

## ADV-038: hasWeztermServer + Windows — no test proves the os guard

- Session: lane-drive-tab phase-1 gate
- Suggested severity: MEDIUM

What I did: Reviewed `pickAttachStrategy` for Windows + hasWeztermServer=true.
Expected: Windows is excluded from rule 5 (wezterm fallback) — falls through to pickTerminal.
Actual: `terminal-open.js:124` has `os === "linux" || os === "macos"` guard, which excludes Windows. But no test asserts this — if the guard is accidentally relaxed, Windows behavior changes silently.

Disposition: ACCEPTED -> DEF-021 (regression test).

---

## ADV-039: Rules 1-3 vs rule 5 precedence not all tested

- Session: lane-drive-tab phase-1 gate
- Suggested severity: MEDIUM

What I did: Reviewed precedence between rules 1-3 (Apple_Terminal/iTerm.app/WezTerm) and rule 5 (hasWeztermServer).
Expected: Rules 1-3 short-circuit before rule 5 (TERMINAL-specific TERM_PROGRAM wins over generic wezterm server detection).
Actual: Only rule 4 (vscode) precedence over rule 5 is tested (`c6`). Three missing tests:
- Apple_Terminal + hasWeztermServer=true → Terminal.app tab (rule 1 wins)
- iTerm.app + hasWeztermServer=true → iTerm tab (rule 2 wins)
- WezTerm + hasWeztermServer=true → wezterm tab (rule 3 wins; both agree)

Disposition: ACCEPTED -> DEF-022 (regression tests).

---

## ADV-040: TERM_PROGRAM="" (empty string) untested

- Session: lane-drive-tab phase-1 gate
- Suggested severity: LOW

What I did: Reviewed behavior when `env.TERM_PROGRAM=""` (empty string).
Expected: Empty string doesn't match any rule, falls through to rule 6 (classic pickTerminal).
Actual: Code handles this correctly (`=== "Apple_Terminal"` fails for empty string), but no test asserts it. Distinct from missing key.

Disposition: ACCEPTED -> DEF-023 (regression test).

---

## ADV-041: env undefined/null not tested

- Session: lane-drive-tab phase-1 gate
- Suggested severity: LOW

What I did: Reviewed behavior when env parameter is undefined or null.
Expected: Optional chaining `env?.TERM_PROGRAM` handles both — falls through to rule 6.
Actual: Code uses `env?.` correctly, but no test guards against future refactors that remove the `?.` (would throw TypeError on undefined access).

Disposition: ACCEPTED -> DEF-024 (regression tests).


---

## Phase 2 Tab — `openTerminal` wiring of `pickAttachStrategy`

## ADV-042: macOS no-TERM_PROGRAM regression — attach command not run after `open -a Terminal`

- Session: lane-drive-tab phase-2 gate
- Suggested severity: HIGH

What I did: Traced the full code path for macOS with no `TERM_PROGRAM` set through `openTerminal`:

**Old code (pre-Phase 2)** at `openTerminal`:
```js
// macOS: use AppleScript to open the terminal and run attach command
if (os === "macos") {
    const appName = choice.kind === "iTerm" ? "iTerm" : "Terminal"
    const appleScript = `tell application "${appName}" to do script "${escapeAppleScript(attachCmd)}"`
    await run("osascript", ["-e", appleScript], { env })
    return { opened: true, kind: choice.kind, hint: null }
}
```
ALL macOS paths ran `osascript` with the attach command — regardless of `TERM_PROGRAM`. Terminal.app opened AND `tmux attach` ran inside it.

**New code (Phase 2)** at `src/terminal-open.js:204-218` and `src/terminal-open.js:221-229`:
1. `pickAttachStrategy` falls through rules 1-5 (no TERM_PROGRAM match) → rule 6
2. `_classicPickTerminal` returns `{ kind: "Terminal.app", argv: ["open", "-a", "Terminal"], ... }`
3. Rule 6 wraps it: `{ mode: "window", template: { kind: "argv-subst", argv: ["open", "-a", "Terminal"] } }`
4. In `openTerminal`, `strategy.template?.kind === "macos-tab"` is FALSE — AppleScript path NOT entered
5. `strategy.template?.kind === "argv-subst"` is TRUE — enters argv-subst path
6. `strategy.template.argv.map((a) => a.replace(/__ATTACH_CMD__/g, attachCmd))` — NO `__ATTACH_CMD__` in `["open", "-a", "Terminal"]` → substitution is a no-op
7. `open -a Terminal` is spawned — Terminal.app opens but `tmux attach` is NEVER run

Expected: Like pre-Phase 2, the attach command is executed in Terminal.app via AppleScript, even when `TERM_PROGRAM` is not set. The new-window case should still run `tmux attach`.

Actual: Terminal.app opens a fresh shell window. No `tmux attach -t <name>` runs. User sees a blank terminal. They must manually type `tmux attach -t <name>` to connect to the lane.

Screenshot: n/a (code-path analysis)

Disposition: ACCEPTED -> DEF-025

`src/terminal-open.js:128-130` — rule 6 produces `{ template: { kind: "argv-subst", argv: ["open", "-a", "Terminal"] } }`. The `argv` has no `__ATTACH_CMD__` placeholder — unlike Linux gnome-terminal argv which correctly includes it (line 70). The old blanket `if (os === "macos")` AppleScript branch was removed and not replaced with an equivalent path for the no-TERM_PROGRAM case.

```
old: if (os === "macos") → osascript with attachCmd  ← ALWAYS ran
new: if (template.kind === "macos-tab") → osascript    ← only with TERM_PROGRAM
     if (template.kind === "argv-subst") → open -a Terminal  ← NO __ATTACH_CMD__
```

The `argv: ["open", "-a", "Terminal"]` is also verified as the intentional (but broken) template by test `c5` at `terminal-open-tab.test.js:127`: `assert.deepStrictEqual(s.template.argv, ["open", "-a", "Terminal"])`.

---

## ADV-043: Test for macOS no-TERM_PROGRAM path does not verify attach command in spawned argv

- Session: lane-drive-tab phase-2 gate
- Suggested severity: MEDIUM

What I did: Examined the Phase 2 integration test at `terminal-open.test.js:520-531`:

```js
test("Phase 2: openTerminal returns mode=window for classic pickTerminal fallback (macOS no TERM_PROGRAM)", async () => {
  const result = await openTerminal({
    name: "my-lane",
    platform: "darwin",
    env: { PATH: "/usr/bin:/bin" },
    exec: makeFakeExec("success"),   // ← ignores all bin/args!!!
  })
  assert.strictEqual(result.opened, true)
  assert.strictEqual(result.mode, "window")
  assert.strictEqual(result.hint, null)
  assert.strictEqual(result.reason, null)
})
```

`makeFakeExec("success")` returns `{ code: 0 }` regardless of what `bin` or `args` are passed. The test never inspects `execCalls` or validates that the spawned command contains `tmux attach -t 'my-lane'`.

Compare with the gnome-terminal test (line 266) and wezterm test (line 463) which DO capture and inspect `execCalls`. The wezterm test at least checks `bash -c` and `exec bash` in the args.

Expected: Test captures exec call args and asserts `tmux attach -t 'my-lane'` is present in the spawned command, or asserts the AppleScript is invoked.

Actual: Test passes even though the attach command is never passed to the spawned process (ADV-042).

Disposition: ACCEPTED -> DEF-026

`tests/terminal-open.test.js:520-531` — `makeFakeExec("success")` ignores arguments. Regression ADV-042 was in the code when the test was written, and the test did not catch it.

---

## ADV-044: pickAttachStrategy test c5 asserts broken macOS argv — baked-in regression

- Session: lane-drive-tab phase-2 gate
- Suggested severity: MEDIUM

What I did: Examined test `c5` at `terminal-open-tab.test.js:114-128`:

```js
test("c5: no TERM_PROGRAM, os=macos delegates to pickTerminal — mode=window, kind=Terminal.app", () => {
  const s = pickAttachStrategy({ env: {}, os: "macos", whichResults: {}, hasDisplay: true, hasWeztermServer: false })
  assert.deepStrictEqual(s.template.argv, ["open", "-a", "Terminal"])
})
```

This test explicitly asserts that the argv is `["open", "-a", "Terminal"]` — which has NO `__ATTACH_CMD__` placeholder. Compare with test c8 at line 228-241 which asserts gnome-terminal's template DOES contain `__ATTACH_CMD__`:

```js
assert.ok(s.template.argv.some((a) => a.includes("__ATTACH_CMD__")))
```

Expected: Either the macOS argv should contain `__ATTACH_CMD__` (but `open -a` can't accept a command argument — need AppleScript), or the template should be `macos-tab` for new-window (not `in front window`).

Actual: Test was written to match the broken behavior. If the code is fixed, this test MUST change.

Disposition: ACCEPTED -> DEF-027

`tests/terminal-open-tab.test.js:127` — asserts `["open", "-a", "Terminal"]` without `__ATTACH_CMD__`.

---

## ADV-045: Linux gnome-terminal/konsole tab not implemented — always opens new window

- Session: lane-drive-tab phase-2 gate
- Suggested severity: MEDIUM

What I did: Checked Phase 2 requirements c4/c5 against implementation:

- c4: "Linux gnome-terminal primary-tab: argv becomes `gnome-terminal --tab -- bash -c ...`"
- c5: "Linux konsole primary-tab: argv becomes `konsole --new-tab -e bash -c ...`"

Implementation in `_classicPickTerminal` (called via rule 6):
```js
// gnome-terminal — no --tab
{ kind: "gnome-terminal", argv: ["gnome-terminal", "--", "bash", "-c", "__ATTACH_CMD__; exec bash"], ... }

// konsole — no --new-tab
{ kind: "konsole", argv: ["konsole", "-e", "bash", "-c", "__ATTACH_CMD__; exec bash"], ... }
```

Additionally, `pickAttachStrategy` has no TERM_PROGRAM rule to detect that the user is running inside gnome-terminal or konsole (there are rules for Apple_Terminal, iTerm.app, WezTerm, vscode/cursor — but none for gnome-terminal's TERM_PROGRAM value or konsole's). Both always fall through to rule 6 which uses `_classicPickTerminal`.

Test c8 at line 228-241 verifies the current (non-tab) behavior:
```js
assert.ok(s.template.argv.some((a) => a.includes("__ATTACH_CMD__")))
```
This test checks for `__ATTACH_CMD__` presence but does NOT assert that `--tab` or `--new-tab` flags are present.

Expected: When gnome-terminal is the chosen terminal, `--tab` flag is included. When konsole, `--new-tab`. At minimum, the non-tab templates should include `--tab`/`--new-tab` in `_classicPickTerminal` (as a conservative always-tab approach for Linux).

Actual: Neither `--tab` nor `--new-tab` appears anywhere in the argv templates. Both terminals open new windows.

Disposition: ACCEPTED -> DEF-028

`src/terminal-open.js:70` — gnome-terminal argv lacks `--tab`.
`src/terminal-open.js:73` — konsole argv lacks `--new-tab`.
`src/terminal-open.js:97-131` — no TERM_PROGRAM rules for gnome-terminal or konsole detection.
`tests/terminal-open-tab.test.js:228-241` — c8 test checks for `__ATTACH_CMD__` but not `--tab`.

---

## ADV-046: pickAttachStrategy vscode hint is dead placeholder — overwritten by openTerminal

- Session: lane-drive-tab phase-2 gate
- Suggested severity: LOW

What I did: Traced the hint value through the vscode/cursor path.

`pickAttachStrategy` rule 4 (line 120):
```js
return { ..., hint: "tmux attach -t <name>" }
```
The hint is a placeholder string — NOT the actual attach command.

`openTerminal` at line 195-197:
```js
if (!strategy.available) {
    log?.("[terminal] no terminal available: ${strategy.reason}")
    return { opened: false, kind: "none", mode: "hint", hint: attachCmd, reason: strategy.reason }
}
```
The return OVERWRITES `strategy.hint` with `attachCmd` (which is `buildAttachCommand(name)` — the actual command like `tmux attach -t 'my-lane'`). The placeholder in `pickAttachStrategy` is never used by any caller.

Expected: Either `pickAttachStrategy` returns `hint: null` and `openTerminal` fills it in (separation of concerns), or `pickAttachStrategy` returns the actual attach command (but it doesn't have access to `name`).

Actual: `pickAttachStrategy` returns a placeholder string that looks meaningful but is always discarded. Makes the function's contract confusing — callers must read `openTerminal` source to know the hint is a lie.

Disposition: ACCEPTED -> DEF-029

`src/terminal-open.js:120` — placeholder hint in strategy.
`src/terminal-open.js:197` — actual hint overwrites it.
`tests/terminal-open-tab.test.js:75` — test asserts the placeholder: `assert.strictEqual(s.hint, "tmux attach -t <name>")`.

---

## ADV-047: openTerminal vscode hint path has no integration test

- Session: lane-drive-tab phase-2 gate
- Suggested severity: MEDIUM

What I did: Searched `terminal-open.test.js` and `terminal-open-tab.test.js` for tests that exercise the vscode/cursor hint path end-to-end through `openTerminal` (not just through `pickAttachStrategy`).

`terminal-open-tab.test.js` tests `pickAttachStrategy` directly (unit level) — c4/c4b/c4c test the strategy function returns `mode: "hint"`.

`terminal-open.test.js` Phase 2 tests exercise `openTerminal` for:
- macOS Apple_Terminal tab (line 420)
- macOS iTerm tab (line 441)
- Linux wezterm (line 463, 496)
- macOS no TERM_PROGRAM fallback (line 520)

NO test sets `TERM_PROGRAM: "vscode"` (or `"cursor"`) and calls `openTerminal` to verify the full return shape: `{ opened: false, kind: "none", mode: "hint", hint: attachCmd, reason: /vscode integrated terminal/ }`.

Expected: Integration test for vscode/cursor hint path through `openTerminal` to verify:
- `opened: false`
- `mode: "hint"`
- `hint` is the actual attach command (not the placeholder from ADV-046)
- `reason` matches the vscode message
- No `exec` is called

Actual: The vscode path is only tested at the strategy level, not through `openTerminal`. The overwrite behavior (ADV-046) could break silently.

Disposition: ACCEPTED -> DEF-030

`tests/terminal-open.test.js` — no `openTerminal` test with `TERM_PROGRAM: "vscode"` or `TERM_PROGRAM: "cursor"`.
`tests/terminal-open-tab.test.js:62-110` — tests strategy only.


---

## Phase 2 Tab Summary

| # | Severity | Area | Finding |
|---|----------|------|---------|
| ADV-042 | HIGH | terminal-open.js:128-130,204-229 | macOS no-TERM_PROGRAM: attach cmd not run after `open -a Terminal` |
| ADV-043 | MEDIUM | terminal-open.test.js:520-531 | Test doesn't verify attach command in spawned argv |
| ADV-044 | MEDIUM | terminal-open-tab.test.js:127 | Test asserts broken macOS argv without __ATTACH_CMD__ |
| ADV-045 | MEDIUM | terminal-open.js:70,73,97-131 | gnome-terminal/konsole tab flags not implemented |
| ADV-046 | LOW | terminal-open.js:120,197 | vscode hint placeholder overwritten by openTerminal |
| ADV-047 | MEDIUM | terminal-open.test.js | No integration test for vscode/cursor hint path |

## ADV-042: macOS no-TERM_PROGRAM regression — Terminal opens but attach never runs

- Session: lane-drive-tab phase-2 gate
- Suggested severity: HIGH

What I did: Trace `openTerminal` on macOS with no TERM_PROGRAM set.
Expected: `do script` opens Terminal.app and runs `tmux attach -t <name>`.
Actual: `_classicPickTerminal` returns `argv: ["open", "-a", "Terminal"]` (no `__ATTACH_CMD__` placeholder). New `openTerminal` does `argv-subst` (no-op) and runs `open -a Terminal`. Terminal.app opens but the attach command never executes.

Disposition: ACCEPTED -> DEF-025 (regression test + fix).

---

## ADV-043: openTerminal test doesn't capture exec args

- Session: lane-drive-tab phase-2 gate
- Suggested severity: MEDIUM

What I did: Reviewed the new Phase 2 tests in `tests/terminal-open.test.js`.
Expected: Tests capture the exec args and assert the attach command is in the spawned argv.
Actual: `terminal-open.test.js:520` uses `makeFakeExec("success")` which returns a generic success without capturing args. The regression in DEF-025 went undetected.

Disposition: ACCEPTED -> DEF-026 (regression test).

---

## ADV-044: unit test asserts broken argv shape

- Session: lane-drive-tab phase-2 gate
- Suggested severity: MEDIUM

What I did: Reviewed `tests/terminal-open-tab.test.js` for the classic fallback test.
Expected: Test asserts the macOS no-TERM_PROGRAM path uses AppleScript.
Actual: `terminal-open-tab.test.js:127` asserts `argv: ["open", "-a", "Terminal"]` (the broken shape that doesn't run the attach command).

Disposition: ACCEPTED -> DEF-027 (update test).

---

## ADV-045: gnome-terminal / konsole --tab / --new-tab not implemented

- Session: lane-drive-tab phase-2 gate
- Suggested severity: MEDIUM

What I did: Reviewed `_classicPickTerminal` for Linux terminals.
Expected: When user is in gnome-terminal, argv uses `--tab`; when in konsole, uses `--new-tab`.
Actual: Both always produce new-window argv. No detection of which terminal the user is in.

Disposition: ACCEPTED -> DEF-028 (add KONSOLE_VERSION detection; defer gnome-terminal detection with a comment).

---

## ADV-046: dead placeholder in pickAttachStrategy hint

- Session: lane-drive-tab phase-2 gate
- Suggested severity: LOW

What I did: Reviewed pickAttachStrategy hint return.
Expected: The hint template is clean.
Actual: The strategy's hint is overwritten by `openTerminal` in some paths; in others, a `"tmux attach -t <name>"` placeholder is set but openTerminal uses its own buildAttachCommand output. Confusing.

Disposition: ACCEPTED -> DEF-029 (clean up the dead placeholder).

---

## ADV-047: no integration test for vscode/cursor hint path

- Session: lane-drive-tab phase-2 gate
- Suggested severity: MEDIUM

What I did: Reviewed openTerminal tests for the vscode/cursor hint case.
Expected: Test asserts openTerminal returns `{ opened: false, kind: "none", mode: "hint", hint: <attachCmd>, reason: <strategy.reason> }`.
Actual: No integration test. The unit test on `pickAttachStrategy` covers the strategy but not the openTerminal integration.

Disposition: ACCEPTED -> DEF-030 (regression test).

---

## ADV-048: README references root-level e2e/, DEFECTS.md, ADVERSARIAL_REVIEW.md — stale after per-feature migration

- Session: final
- Suggested severity: MEDIUM

What I did: Read README.md. Lines 30, 60, 63, 65, 278, 281, 282 reference root-level paths (`e2e/`, `DEFECTS.md`, `ADVERSARIAL_REVIEW.md`). The "What gets generated" tree at lines 213-233 omits `armada/ledgers/`, `armada/e2e/`, `armada/screenshots/`.

Expected: README reflects per-feature paths: `armada/ledgers/<feature>/DEFECTS.md`, `armada/e2e/<feature>/`, `armada/screenshots/<feature>/`. Generated tree shows new directories.

Actual: README not updated for per-feature layout. User-facing documentation contradicts actual output.

Screenshot: n/a

Disposition: ACCEPTED -> DEF-031

`README.md:30,60,63,65,278,281,282,213-233` — root-path references stale; generated tree incomplete.

---

## ADV-049: slugify drops non-ASCII characters silently (e.g., CJK)

- Session: final
- Suggested severity: LOW

What I did: Called `slugify("unicode-日本語")` → `"unicode"`. `slugify("Café")` → `"caf"`. Non-ASCII stripped by `[^a-z0-9]+` regex without warning.

Expected: Document the ASCII-only convention. Or transliterate (e.g. "cafe"), or warn when chars are dropped.

Actual: Characters silently dropped. `"unicode-日本語"` and `"unicode"` produce identical ledger dir — collision risk.

Screenshot: n/a

Disposition: ACCEPTED -> DEF-032

`src/scaffold.js:136-142` — `slugify()` regex `/^[a-z0-9]+/g` strips non-ASCII, no transliteration, no warning.

---

## ADV-050: slugify produces unlimited-length slugs — risks filesystem ENAMETOOLONG

- Session: final
- Suggested severity: MEDIUM

What I did: Slugified 500+ char project name. Path `armada/ledgers/<500+char-slug>/DEFECTS.md` would fail `mkdir` with ENAMETOOLONG on macOS (255-char limit), ext4, NTFS.

Expected: Slug truncated to safe length (e.g., 100 chars) or mkdir error caught with clear message.

Actual: No truncation. `scaffold` crashes with cryptic ENAMETOOLONG when writing ledger/e2e/screenshots dirs.

Screenshot: n/a

Disposition: ACCEPTED -> DEF-033

`src/scaffold.js:136-142` — `slugify()` no length limit. Used for `{ledgers_dir}`, `{e2e_dir}`, `{screenshots_dir}`.

---

## ADV-051: P4 — fleet e2e tests not moved to tests/; all 5 test product behavior

- Session: final
- Suggested severity: MEDIUM

What I did: Reviewed `e2e/*.test.js` (5 files, 1248 lines). All test product CLI behavior: reconcile, resume command, CLI wiring, validation, round-trip. They complement but don't duplicate `tests/` coverage.

Expected: Per REQUIREMENTS.md:88-89: "Any fleet-written e2e test that genuinely tests the PRODUCT (i.e. would run in CI) is moved into tests/ where it belongs and is wired into the suite."

Actual: All 5 remain in `e2e/`, untracked via `.gitignore` process block. Not moved to `tests/`. Not wired into `npm test`. Product e2e tests siloed from CI.

Screenshot: n/a

Disposition: ACCEPTED -> DEF-034

`e2e/cli-wiring.test.js`, `e2e/reconcile.test.js`, `e2e/validation.test.js`, `e2e/armada-resume-command.test.js`, `e2e/armada-resume-roundtrip.test.js` — should be in `tests/`.

---

## ADV-052: P4 — untrack-process-artifacts.sh fails silently from subdirectory

- Session: final
- Suggested severity: MEDIUM

What I did: Created temp git repo with tracked DEFECTS.md etc. Ran script from subdirectory. All 8 files report "Already untracked (skip)". Files remain tracked in index.

Root cause: `git ls-files --error-unmatch "DEFECTS.md"` resolves path relative to cwd (subdir), not repo root. Exit 1 causes skip branch. `git rm --cached` same issue.

Expected: Script cd's to repo root (`git rev-parse --show-toplevel`) or errors clearly when run from wrong directory.

Actual: Silent false success. User thinks artifacts untracked but they stay in git index.

Screenshot: n/a

Disposition: ACCEPTED -> DEF-035

`scripts/untrack-process-artifacts.sh:19-39` — relative paths resolved relative to cwd by git commands. No `cd $(git rev-parse --show-toplevel)`.

---

## Summary — new findings

| # | Severity | Area | Finding |
|---|----------|------|---------|
| ADV-048 | MEDIUM | README.md:30,60,63,65,278,281,282 | Stale root paths in user-facing docs |
| ADV-049 | LOW | scaffold.js:136 | slugify drops non-ASCII silently |
| ADV-050 | MEDIUM | scaffold.js:136 | slugify no truncation, ENAMETOOLONG risk |
| ADV-051 | MEDIUM | e2e/*.test.js (5 files) | Product e2e tests not moved to tests/ |
| ADV-052 | MEDIUM | scripts/untrack-process-artifacts.sh:19 | Fails silently from subdirectory |

## No-finding areas

- **`.gitignore` marker block**: P1 `# armada:start`/`# armada:end` survives `--yes` init, idempotent, uninstall restores correctly. Coexists with P4 `# armada:process`/`# armada:process:end` — different markers, different lifecycles, `removeGitignoreBlock` only touches `# armada:start`/`# armada:end` block.
- **Per-feature ledgers**: All 8 agent prompts correctly use `{ledgers_dir}`, `{e2e_dir}`, `{screenshots_dir}`. `renderAgentsMd()` resolves to per-feature paths. `model-catalog.js` reasoning strings updated for qa/adversary.
- **`{ledgers_dir}` placeholder**: `fillTemplate()` resolves correctly. `resolveFeatureName()` defensive: empty/whitespace/null → `slugify(name)` → "default". `project.feature` takes precedence. No dangling placeholders in rendered output.
- **Permission globs**: `BASE_PERMISSIONS` correctly scoped. qa owns `armada/ledgers/*`, `armada/e2e/*`, `armada/screenshots/*`. adversary owns `armada/ledgers/*/ADVERSARIAL_REVIEW.md`. orchestrator allows specific ledger files, denies rest of armada/. backend-dev/frontend-dev deny all ledgers/e2e/state. No cross-role leaks.
- **Multi-feature collision**: `renderAgentsMd` per-feature DEF-001 numbering; two features → separate namespaces. Verified by `scaffold.test.js:679`.
- **Backwards compatibility**: `init --from-armada` round-trip byte-identical (roundtrip.test.js). New fields don't break re-scaffold.
- **Tests**: 478/478 pass. New tests substantive — gitignore lifecycle, placeholder resolution, permission assertions, multi-feature isolation, script validation. No tautologies.
- **Agent prompt templates**: No stale root paths in any of 8 prompt files.
- **P4 deliverables**: `scripts/untrack-process-artifacts.sh` exists + executable. `docs/process-artifacts.md` written. `.gitignore` `# armada:process` block appended. `tests/scripts.test.js` 13 tests pass.
