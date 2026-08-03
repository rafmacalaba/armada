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
