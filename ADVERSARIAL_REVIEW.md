# ADVERSARIAL_REVIEW.md

Adversarial review of opencode-armada CLI contract. Scope: `src/cli.js`, `src/scaffold.js`, `src/manifest.js`, `src/generator.js`.

## ADV-001: Invalid budget silently accepted (exit 0)

- Session: final
- Suggested severity: MEDIUM

What I did: `armada init --yes --budget ultra_mega --no-browser`
Expected: Non-zero exit with error message "unknown budget: ultra_mega"
Actual: Exit 0, scaffolds with budget "balanced" (default). No warning to user.
Screenshot: n/a

Disposition: PENDING

`src/cli.js:170-173` — the `BUDGETS.includes(args[budgetIdx + 1])` guard silently ignores invalid values. `renderManifestYaml` writes `budget: balanced` which then round-trips as "balanced" on re-scaffold. User thinks they chose a custom budget but gets default.

---

## ADV-002: Empty model string silently accepted

- Session: final
- Suggested severity: HIGH

What I did: `armada.yaml` with `model: ""` for a team member
Expected: Parse error "model must not be empty"
Actual: Writes `"model": ""` into slim JSONC and armada.yaml. opencode will fail to start with empty model.
Screenshot: n/a

Disposition: PENDING

`src/manifest.js:19-24` — no validation on `t.model`. `src/cli.js:157-162` — catches parse errors but empty-string model is not a parse error. Generated `oh-my-opencode-slim.jsonc` contains `"model": ""` which causes runtime failure.

---

## ADV-003: Duplicate role names silently accepted (first wins)

- Session: final
- Suggested severity: MEDIUM

What I did: `armada.yaml` with two team entries both having `role: qa` with different models
Expected: Error "duplicate role: qa" or warning
Actual: Exit 0, only first entry used, second silently discarded. No indication to user.
Screenshot: n/a

Disposition: PENDING

`src/manifest.js:19` — no duplicate check. `src/generator.js:100` — `manifest.team.some((t) => t.role === role ...)` finds the first match, second entry has no effect. `renderManifestYaml` writes both entries back out (src/generator.js:343-347), creating a misleading armada.yaml where only the first duplicate takes effect.

---

## ADV-004: `enabled: 0` (number) treated as enabled

- Session: final
- Suggested severity: LOW

What I did: YAML `enabled: 0` in team entry (YAML number 0, expected falsy)
Expected: `enabled: false` (0 is falsy in YAML bool contexts)
Actual: `enabled: true` — role is enabled
Screenshot: n/a

Disposition: PENDING

`src/manifest.js:23` — only checks `t.enabled === false || t.enabled === "false"`. Number `0` is neither, defaults to `true`. Should use truthy check: `Boolean(t.enabled) !== false` or explicit `t.enabled === 0` handling. Note: YAML spec treats `0` as not-boolean, but user expectation is that `0` means disabled.

---

## ADV-005: Read-only filesystem errors dump full stack trace

- Session: final
- Suggested severity: MEDIUM

What I did: `chmod 500 .opencode/` then `armada init --from-armada armada/armada.yaml`
Expected: Clean error "Cannot write to .opencode/: permission denied"
Actual: Full Node.js stack trace with absolute paths (EACCES) dumped to stderr
Screenshot: n/a

Disposition: PENDING

`src/cli.js:140-143` — `main().catch(err => console.error(err))` prints full Error object including stack. `src/scaffold.js:63` — `writeFileSync` throws on permission denied, no try/catch in scaffold. Error propagates to catch handler unformatted. Absolute path `/Users/rafaelmacalaba/...` leaked in stack.

---

## ADV-006: Uninstall requires manifest — no fallback cleanup

- Session: final
- Suggested severity: MEDIUM (known gap — STILL BROKEN)

What I did: `armada init`, then `rm armada/armada.yaml`, then `armada uninstall`
Expected: Uninstall should still clean up generated files, or at least offer `--force` flag
Actual: "Manifest not found: armada/armada.yaml" exit 1. All generated artifacts remain. No way to clean up.
Screenshot: n/a

Disposition: PENDING

`src/cli.js:268-274` — uninstall always requires a manifest. If user deletes `armada/armada.yaml` (e.g., by accident or git clean), there is no path to remove: `.opencode/oh-my-opencode-slim.jsonc`, `.opencode/oh-my-opencode-slim/*.md`, `.opencode/commands/armada.md`. Suggestion: add `--force` flag that removes all known armada artifacts without reading manifest.

---

## ADV-007: `init --from-armada --budget free` treats `--budget` as filename

- Session: final
- Suggested severity: LOW

What I did: `armada init --from-armada --budget free`
Expected: Parse error about missing file argument after `--from-armada`
Actual: "Manifest not found: --budget" — confusing error, the flag `--budget` is consumed as the file path
Screenshot: n/a

Disposition: PENDING

`src/cli.js:151` — no `file.startsWith("--")` guard on the `--from-armada` value. Compare `src/cli.js:271` where `uninstall` has this guard: `if (!file || file.startsWith("--") || !existsSync(...))`. Missing guard on `init --from-armada` causes confusing error message instead of "missing file argument for --from-armada".

---

## ADV-008: `opencode.json` model ignores budget tier

- Session: final
- Suggested severity: LOW

What I did: Manifest with `budget: free` and orchestrator `model: opencode-go/minimax-m3` (balanced-tier model)
Expected: opencode.json model should match the budget-adjusted model (hy3 for free tier)
Actual: opencode.json gets `"model": "opencode-go/minimax-m3"` while slim JSONC gets `"model": "opencode-go/hy3"` — inconsistency
Screenshot: n/a

Disposition: PENDING

`src/generator.js:164` — `renderOpenCodeJson` reads `manifest.team.find(t => t.role === "orchestrator")?.model` from raw manifest, not from `buildTeam` budget-adjusted output. If user sets `budget: free` but leaves a power/balanced model for orchestrator, opencode.json uses the expensive model while armada-orchestrator in slim JSONC uses the free model. Should use `modelFor("orchestrator", manifest.project.budget)` for consistency.

---

## ADV-009: CLI writes through `.opencode` symlinks without warning

- Session: final
- Suggested severity: LOW

What I did: `ln -sf target/ .opencode` then `armada init`
Expected: Warning or error about `.opencode` being a symlink
Actual: Silently follows symlink, writes all files to symlink target. Could be exploited to write outside expected directory.
Screenshot: n/a

Disposition: PENDING

`src/scaffold.js:60-66` — `write()` uses `mkdirSync` and `writeFileSync` without symlink detection. If `.opencode` is a symlink to another location, armada files are written there. In practice this requires user action (creating the symlink), so severity LOW, but a `realpath` check or warning would be defense-in-depth.

---

## ADV-010: `init` hardcodes `targetDir = "."` — no `--target` flag

- Session: final
- Suggested severity: LOW

What I did: Running `armada init` from any directory always scaffolds to CWD
Expected: `--target <dir>` flag to specify output directory
Actual: `manifest.targetDir = "."` hardcoded at `src/cli.js:187`. No way to scaffold into a different directory.
Screenshot: n/a

Disposition: PENDING

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
| ADV-023 | MEDIUM | reconcile.js:229 | Array.isArray guard untested — 0% coverage for non-iterable path |
| ADV-024 | MEDIUM | active.json:133 | p3 evidence ref is command string, not fs path |
| ADV-025 | MEDIUM | reconcile.js:226 | No null guard on phase entries in phases array |
| ADV-026 | MEDIUM | reconcile.js:97 | checkEvidence crashes on undefined evidence.ref |
| ADV-027 | LOW | active.json:140 | Top-level evidence array only populated for phase-2 |
| ADV-028 | LOW | manual-walkthrough.md:11 | Assumes `npm install -g opencode-armada` (unpublished) |
| ADV-029 | LOW | manual-walkthrough.md:45 | Expects specific scratch contract template shape |
| ADV-030 | LOW | docs/validation.md:584 | Claims in-lane probe of live repo; lane has external_directory: deny |

`main() returns undefined` / exit code propagation: **FIXED** — `main()` is async, returns Promise. Resolved promise with `undefined` value exits 0. On rejection, catch handler sets `process.exitCode = 1`. Commands that set `process.exitCode` inline (unknown command, missing manifest) exit correctly.

---

## ADV-011: `/\d+ failing/` regex triggers false positive on "0 failing"

- Session: phase-3 gate
- Suggested severity: MEDIUM

What I did: Wrote evidence file containing `Tests: 25 passed, 0 failing, 0 skipped` (a common passing test summary), then ran `reconcile()` with `kind: "test"` pointing at it.
Expected: No drift — "0 failing" means everything passed.
Actual: Drift `evidence-failed` reported.
Screenshot: n/a

Disposition: ACCEPTED -> DEF-002

`src/reconcile.js:20` — `/\d+ failing/` matches `0 failing`. Fix: change to `/^[1-9]\d* failing/m` or `/\b[1-9]\d* failing\b/`. Reproduce:
```js
// evidence file: 'Tests: 25 passed, 0 failing, 0 skipped\n'
// regex /\d+ failing/ matches '0 failing' -> evidence-failed
```

---

## ADV-012: Uppercase `X` in checkboxes not parsed as ticked

- Session: phase-3 gate
- Suggested severity: MEDIUM

What I did: Contract markdown with `- [X] Test A` (uppercase X in checkbox). Phase status `passed`, evidence exists on disk.
Expected: Criterion recognized as ticked per contract spec (`- [X]` counts as ticked). No drift.
Actual: Regex at `src/reconcile.js:71` (`/^-\s+\[([ x])\]\s+(.+)/`) only captures `[ ]` and `[x]`. Uppercase `[X]` is silently ignored — the criterion line is not parsed at all. `contractCriteria` for that phase is empty, so `criterion-unticked` check never fires. The criterion is invisible.

Disposition: ACCEPTED -> DEF-003

`src/reconcile.js:71` — change character class from `[ x]` to `[ xX]`. The contract spec (`armada/REQUIREMENTS.md`) explicitly says `- [X]` should count as ticked.

---

## ADV-013: Active feature with empty/null phaseGraph reports "no active feature" in resumeLine

- Session: phase-3 gate
- Suggested severity: LOW

What I did: `active.json` with `feature: "feat"` and `phaseGraph: null` (or `phaseGraph.phases: []`). Ran `reconcile()`.
Expected: `resumeLine` reflects there is an active feature but no phases (e.g. "resume: feature feat, phase (none)").
Actual: `plan.activeFeature === "feat"` but `plan.resumeLine === "resume: no active feature"`. JSON fields are internally inconsistent — the plan says there IS an active feature (`activeFeature: "feat"`) while the resume line says there isn't.
Screenshot: n/a

Disposition: ACCEPTED -> DEF-004

`src/reconcile.js:286-288` — `resumeLine` uses `currentPhase` as a proxy for "has active feature". When `findCurrentPhase` returns `null` (empty phases array), the line defaults to "no active feature" even though `active.feature` is set. Fix: separate the null-phase case from the null-feature case.

---

## ADV-014: Evidence path pointing to directory flagged as `evidence-missing`

- Session: phase-3 gate
- Suggested severity: LOW

What I did: Evidence ref `tests/somedir` is a directory that exists on disk (not a missing file). Ran `reconcile()`.
Expected: Either recognize directory as existing evidence (no drift), or report a distinct drift like `evidence-is-directory`.
Actual: `existsSync()` returns true for directories, then `readFileSync()` throws (EISDIR), caught by `try/catch` → `evidence-missing`. User sees "evidence-missing" for a path that definitely exists — misleading.
Screenshot: n/a

Disposition: ACCEPTED -> DEF-005

`src/reconcile.js:96-117` — `checkEvidence` does not distinguish a missing file from a directory. Add an `fs.statSync(fullPath).isFile()` check after `existsSync`, or handle the `EISDIR` error code in the catch block.

---

## ADV-015: `parseManifestYaml` drops `variant` field — lost on re-scaffold

- Session: final
- Suggested severity: MEDIUM

What I did: armada.yaml with `variant: thinking` on orchestrator team entry. Ran `parseManifestYaml`.
Expected: parsed team entry includes `variant: "thinking"`, survives round-trip.
Actual: `variant` is validated (line 65) but not returned in the team entry object (lines 66-71). `variant` is always `undefined` in parseManifestYaml output. On `init --from-armada`, `buildTeam` reads `override?.variant` → undefined → falls back to `CATALOG[role].variant`. This means preset-written variants only work by coincidence (balanced preset's `thinking` matches catalog default). A custom preset variant would be silently ignored.
Screenshot: n/a

Disposition: ACCEPTED -> DEF-006

`src/manifest.js:63-71` — validates variant at line 65 but the `return { role, model, fallback, enabled }` at lines 66-71 omits variant. `buildTeam` in `src/generator.js:125` reads `override?.variant` which is always undefined. `renderManifestYaml` in `src/generator.js:503-507` doesn't write variant either, so even a direct-to-YAML round-trip would drop it.

---

## ADV-016: Duplicate next-steps sections in `armada init` output

- Session: final
- Suggested severity: LOW

What I did: `armada init --yes --headless`, examined stdout.
Expected: One "Next steps:" section printed.
Actual: Two identical sections — "Next:" from `cli.js:293-296` AND "Next steps:" from `renderInitSummary` output (init-summary.js:27-32). Both contain the same three steps (opencode, /armada, ping all agents).

Disposition: ACCEPTED -> DEF-007

`src/cli.js:293-298` — explicit "Next:" block still printed before `renderInitSummary(manifest)`. `src/init-summary.js:27-32` — summary itself includes "Next steps:" with identical content. Remove the cli.js "Next:" block (lines 293-296) since renderInitSummary now covers it.

---

## ADV-017: `renderOpenRouterModels` crashes on null/undefined `id` or `name`

- Session: final
- Suggested severity: MEDIUM

What I did: `renderOpenRouterModels([{ id: 'test/foo', name: null }])` and `renderOpenRouterModels([{ id: null, name: 'Test' }])`
Expected: Graceful rendering with empty string for missing field, or defensive guard.
Actual: `TypeError: Cannot read properties of null (reading 'length')` at `m.id.length` (line 194) or `m.name.length` (line 195). Uncaught crash.
Screenshot: n/a

Disposition: ACCEPTED -> DEF-008

`src/model-catalog.js:194-195` — `m.id.length` and `m.name.length` assume both fields are strings. OpenRouter API contract says `{ id: string, name: string }` but a malformed response would crash. Fix: `(m.id || "").length` and `(m.name || "").length`.

---

## ADV-018: `listOpenRouterModels` misleading error for non-array `data` field

- Session: final
- Suggested severity: LOW

What I did: Fake-fetch that returns `ok: true` with `data: {x: 1}` (object, not array).
Expected: Error message indicating response format was unexpected (e.g., "data field is not an array").
Actual: `json.data.map is not a function — check network / OPENROUTER_API_KEY`. The `.map is not a function` error is wrapped with a network/auth hint that doesn't apply — this is a response format error, not a network/auth issue.
Screenshot: n/a

Disposition: REJECTED - "check network / OPENROUTER_API_KEY" is a general hint; the per-cause distinction is polish, not a contract violation.

`src/model-catalog.js:183-184` — `if (!json.data)` only checks falsy, not `Array.isArray(json.data)`. Add an `Array.isArray(json.data)` check and throw a distinct message like "data field is not an array" before `— check network / OPENROUTER_API_KEY`.

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

Disposition: PENDING

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

Disposition: PENDING

This is a documentation gap, not a code gap. The e2e test proves the primary path works (fake bin → real CLI reconcile → exit 0 + resume line). The live validation proves the fallback works on real state. The contract says "run `armada reconcile` from the generated repo" — this was not done with a real global install. The doc is transparent about the limitation.

Disposition: ACCEPTED -> fixed by `npm link` (`/opt/homebrew/bin/armada` -> lane's `bin/armada.js`); live validation re-ran against the `~/WBG/data-ai-chatbot` clone via the primary `armada reconcile` invocation. Same resume line, same exit 0. Recorded in `docs/validation.md` (2026-08-03 re-run section).

---

## ADV-023: Array.isArray guard at reconcile.js:229 has zero test coverage

- Session: phase-3 gate
- Suggested severity: MEDIUM

What I did: Read `src/reconcile.js:229` — `const criteria = Array.isArray(phase.criteria) ? phase.criteria : []`. Grepped `tests/reconcile.test.js` and `e2e/reconcile.test.js` for `null`, `undefined`, `non-array`, `defensive`, `missing.*criteria`. Zero matches. Test helper `phase()` at `tests/reconcile.test.js:31` defaults `criteria` to `[]`, and every test case passes an explicit array.

Expected: At least one test case exercising the non-array path (e.g., `criteria: null`, `criteria: undefined`, `criteria: "string"`) to prove the guard works.

Actual: Guard code path has 0% coverage. `docs/validation.md:592` claims "Existing reconcile unit tests still pass (313 green). No new test needed — guard is defensive; existing tests already cover the iterable case." This misses the point: the iterable case is the happy path. The guard exists precisely for the non-iterable case, which is untested.

Disposition: ACCEPTED -> fixed in 0ae33ff
History:
- orchestrator: ACCEPTED -> fixed in 0ae33ff

---

## ADV-024: active.json p3-all-tests-green evidence ref is command string, not file path

- Session: phase-3 gate
- Suggested severity: MEDIUM

What I did: Read `armada/state/active.json:130-134`. Criterion `p3-all-tests-green` has `evidence.ref: "node --test tests/*.test.js — 313 pass, 0 fail"`. Every other evidence ref in the file is a relative filesystem path (e.g., `armada/state/evidence/phase-2/tests-pass.txt`).

Expected: Evidence ref is a filesystem path. Reconcile engine passes it to `path.join(repoRoot, ref)` then `fs.existsSync(fullPath)` — works for file paths, fails for command strings.

Actual: `ref` is a shell command string. `checkEvidence("test", "node --test tests/*.test.js — 313 pass, 0 fail", repoRoot, fs)` at `reconcile.js:97` would call `path.join(repoRoot, "node --test tests/*.test.js — 313 pass, 0 fail")` — produces a valid (but nonexistent) path, `existsSync` returns false, drifts as `evidence-missing`. The actual evidence file (`tests-pass.txt`) sits at a different path entirely.

Disposition: ACCEPTED -> fixed in 0ae33ff
History:
- orchestrator: ACCEPTED -> fixed in 0ae33ff

---

## ADV-025: reconcile.js:226 — no null guard on individual phase entries in phases array

- Session: phase-3 gate
- Suggested severity: MEDIUM

What I did: Read `src/reconcile.js:226-227` — `for (const phase of phases)` followed immediately by `phase.id`. Same class of bug as the `Array.isArray` guard at line 229. If `phases` array contains a null/undefined entry (from malformed `active.json`), crashes at `phase.id`.

Expected: Same defensive pattern as line 229 — `if (!phase || typeof phase !== 'object') continue`.

Actual: No guard. `phases` is sourced from `active.phaseGraph?.phases || []` at line 206 — user-controlled, untrusted input. A single `null` in the array crashes the entire reconcile engine.

Disposition: ACCEPTED -> fixed in 0ae33ff
History:
- orchestrator: ACCEPTED -> fixed in 0ae33ff

---

## ADV-026: reconcile.js checkEvidence crashes on undefined evidence.ref

- Session: phase-3 gate
- Suggested severity: MEDIUM

What I did: Traced `checkEvidence` call at `reconcile.js:233` with a truthy `crit.evidence` object that lacks a `ref` field (e.g., `{kind: "test"}`). Verified Node.js behavior: `path.join('/foo', undefined)` throws `TypeError: The "path" argument must be of type string. Received undefined`.

Expected: Graceful handling — either skip the criterion with missing ref, or report `evidence-missing` drift without crashing.

Actual: `reconcile.js:97` — `const fullPath = join(repoRoot, ref)`. If `ref` is `undefined` (evidence object present but ref field missing), `path.join` throws TypeError. Uncaught crash. Same class of bug as line 229 — state file shape not validated before use. The `Array.isArray` guard at line 229 fixed the `criteria` array shape but the contents of each criterion (specifically `evidence.ref`) are still unvalidated.

Disposition: ACCEPTED -> fixed in 0ae33ff
History:
- orchestrator: ACCEPTED -> fixed in 0ae33ff

---

## ADV-027: active.json top-level evidence array inconsistent across phases

- Session: phase-3 gate
- Suggested severity: LOW

What I did: Read `armada/state/active.json:140-165`. Top-level `evidence` array has 4 entries — all `phase: "phase-2"`. Phase 1 has 6 criteria with evidence refs, phase 3 has 3 criteria with evidence refs, but neither appears in the top-level `evidence` array.

Expected: Either all phases populate the top-level `evidence` array, or none do. Consistency across phases.

Actual: Only phase-2 evidence is duplicated in the top-level array. Phase 1 and phase 3 evidence exists only in `criteria[].evidence`. This inconsistency makes the schema ambiguous — does the top-level array matter? The reconcile engine does not read it (it iterates `phase.criteria[].evidence`), but the array's existence implies it should be authoritative. If a future tool reads it, it would incorrectly report zero evidence for phases 1 and 3.

Disposition: ACCEPTED -> fixed in 0ae33ff
History:
- orchestrator: ACCEPTED -> fixed in 0ae33ff

---

## ADV-028: manual-walkthrough.md assumes `npm install -g opencode-armada` publishes to npm

- Session: phase-3 gate
- Suggested severity: LOW

What I did: Read `armada/state/evidence/phase-2/manual-walkthrough.md:11` — `npm install -g opencode-armada`. As of 2026-08-03, no `opencode-armada` package is registered on npm.

Expected: Walkthrough includes a fallback for installing from local path: `npm install -g .` from the armada source tree, or `npm link`.

Actual: Step 1 of pre-flight gives a command that fails with npm 404. A user following the walkthrough on a fresh machine hits an error at the very first actionable step. The doc later notes at line 82 "If armada binary is not on PATH, the fallback... won't work" but doesn't address how to get the binary in the first place.

Disposition: ACCEPTED -> fixed in 0ae33ff
History:
- orchestrator: ACCEPTED -> fixed in 0ae33ff

---

## ADV-029: manual-walkthrough.md Step 2 expects specific scratch contract shape

- Session: phase-3 gate
- Suggested severity: LOW

What I did: Read `armada/state/evidence/phase-2/manual-walkthrough.md:44-45` — "criteria has one entry 'All tests pass' with evidence: null". This assumes `armada feature new scratch-resume-walkthrough` produces a contract with exactly one criterion labeled "All tests pass".

Expected: Walkthrough step is agnostic to contract content — references the active.json schema directly (e.g., "phase-1 criteria array has at least one entry, each with id, text, and evidence fields").

Actual: Step hardcodes a specific contract template assumption. If the scratch feature template changes (e.g., generates different criterion text, or multiple criteria), the user's expected output won't match and the walkthrough fails silently.

Disposition: ACCEPTED -> fixed in 0ae33ff
History:
- orchestrator: ACCEPTED -> fixed in 0ae33ff

---

## ADV-030: validation.md claims in-lane probe of live repo despite `external_directory: deny`

- Session: phase-3 gate
- Suggested severity: LOW

What I did: Read `docs/validation.md:583-585` — "Read-only probe of ~/WBG/data-ai-chatbot confirms the live repo's stack detected correctly." The lane's `opencode.json` has `permission: {external_directory: "deny"}`.

Expected: Either the doc clarifies this was a user-side manual step, or the lane got a one-time external exception and documents it.

Actual: The doc reads as though the lane itself probed the live repo. The `external_directory: deny` permission means no tool (read, bash, glob) could access `~/WBG/`. A user reading this might assume the lane automated the probe and be confused when their own lane can't touch external directories. The contradiction isn't resolved in the text — the reader must infer it was manual.

Disposition: ACCEPTED -> fixed in 0ae33ff
History:
- orchestrator: ACCEPTED -> fixed in 0ae33ff
