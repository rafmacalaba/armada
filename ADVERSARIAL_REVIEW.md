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

`main() returns undefined` / exit code propagation: **FIXED** — `main()` is async, returns Promise. Resolved promise with `undefined` value exits 0. On rejection, catch handler sets `process.exitCode = 1`. Commands that set `process.exitCode` inline (unknown command, missing manifest) exit correctly.
