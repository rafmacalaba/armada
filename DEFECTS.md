# DEFECTS.md

All defects live here, one entry per defect, newest first.
Writers: qa (create, close, reopen) and orchestrator (record developer responses, reject).

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

## DEF-003: criterion-unticked drift on `- [X]`-ticked markdown

- Status: CLOSED
- Severity: MEDIUM
- Found by: adversary (ADV-012)
- Phase: 1

Steps to reproduce:
1. Create a tmp dir. Write `armada/state/active.json` with feature "feat", contract "armada/contracts/feat.md", phase "phase-1" status "passed", one criterion `c1` with evidence pointing to existing file.
2. Write `armada/contracts/feat.md` with `- [X] All tests pass` (uppercase X in checkbox).
3. Write the evidence file.
4. Call `reconcile(stateDir, repoRoot)`.

Expected: No drift — `- [X]` counts as ticked per contract spec; phase is passed, criterion is satisfied.
Actual (before fix): Criterion line not parsed (regex `[ x]` misses uppercase X), criterion invisible to engine.
Actual (after fix): `drifts: []` — `[X]` correctly parsed as ticked.
Screenshot: n/a

History:
- qa: opened
- backend-dev: FIX READY — fixed in src/reconcile.js:71, regex character class `[ xX]`
- qa: closed — regression test "Bug B — uppercase [X] checkbox parsed as ticked, no false unticked drift" (tests/reconcile.test.js:652) passes; engine output `drifts:[]` for `[X]`-ticked contract

## DEF-004: "no active feature" resume line when feature is set but phaseGraph is empty

- Status: CLOSED
- Severity: LOW
- Found by: adversary (ADV-013)
- Phase: 1

Steps to reproduce:
1. Create a tmp dir. Write `armada/state/active.json` with `feature: "feat"`, `contract: "armada/contracts/feat.md"`, `phaseGraph: { phases: [] }`, empty evidence array.
2. Call `reconcile(stateDir, repoRoot)`.

Expected: `plan.activeFeature === "feat"` and `plan.resumeLine` reflects an active feature with no phases (e.g. "resume: feature feat, phase (none)").
Actual (before fix): `plan.activeFeature === "feat"` but `plan.resumeLine === "resume: no active feature"`. Plan fields contradict.
Actual (after fix): `plan.resumeLine === "resume: feature x, phase <none>, evidence 0 in, drift 0, next <bootstrap phase graph>"`.
Screenshot: n/a

History:
- qa: opened
- backend-dev: FIX READY — fixed in src/reconcile.js:296-299, resumeLine separates null-phase from null-feature case
- qa: closed — regression test "Bug C — active feature with empty phases gives meaningful resume line" (tests/reconcile.test.js:705) passes; engine output resume line contains "feature x" and does not contain "no active feature"

## DEF-005: evidence-missing drift on a directory evidence path

- Status: CLOSED
- Severity: LOW
- Found by: adversary (ADV-014)
- Phase: 1

Steps to reproduce:
1. Create a tmp dir. Write `armada/state/active.json` with feature "feat", phase "phase-1" status "in_progress", one criterion with `evidence: { kind: "test", ref: "tests/somedir" }`.
2. Create directory `tests/somedir` (do NOT create a file — the ref is a directory).
3. Call `reconcile(stateDir, repoRoot)`.

Expected: Engine either treats directory as existing evidence (no drift) or reports a distinct `evidence-is-directory` drift — not `evidence-missing`.
Actual (before fix): `existsSync` returns true, `readFileSync` throws EISDIR, caught as `evidence-missing`. Misleading.
Actual (after fix): `evidence-missing` drift with `detail: "path is a directory: tests/somedir"` — user understands why.
Screenshot: n/a

History:
- qa: opened
- backend-dev: FIX READY — fixed in src/reconcile.js:96-111, statSync().isDirectory() check with detail field
- qa: closed — regression test "Bug D — directory as evidence path reports useful drift" (tests/reconcile.test.js:733) passes; engine output includes `detail: "path is a directory: tests/not-a-file"`

## DEF-006: parseManifestYaml drops `variant` field — lost on re-scaffold

- Status: CLOSED
- Severity: MEDIUM
- Found by: adversary (ADV-015)
- Phase: 4

Steps to reproduce:
1. Create armada.yaml with `variant: thinking` on the orchestrator team entry.
2. Parse armada.yaml with `parseManifestYaml`.
3. Inspect the parsed team entry for the orchestrator role.
4. Run `armada init --from-armada armada.yaml`, then `armada init --from-armada armada.yaml` again (re-scaffold).

Expected: The parsed team entry includes `variant: "thinking"` and the value survives the round-trip through parse → render → parse.
Actual: `variant` is validated at manifest.js:65 but not included in the returned team entry object (lines 66-71). The field is always `undefined` in parseManifestYaml output. On re-scaffold, `buildTeam` reads `override?.variant` → undefined → falls back to CATALOG[role].variant. A custom variant would be silently replaced with the catalog default.
Screenshot: n/a

History:
- qa: opened
- qa: closed — fixed (parseManifestYaml returns `variant`; renderManifestYaml serializes it); retested 323/323, variant round-trip test added

## DEF-007: Duplicate next-steps sections in `armada init` output

- Status: CLOSED
- Severity: LOW
- Found by: adversary (ADV-016)
- Phase: 4

Steps to reproduce:
1. Run `armada init --yes --headless` in a project directory.
2. Examine stdout output.

Expected: One "Next steps:" section is printed after scaffolding.
Actual: Two identical sections appear — "Next:" from cli.js:293-296 AND "Next steps:" from the renderInitSummary output (init-summary.js:27-32). Both contain the same three steps (run opencode, use /armada, ping agents).
Screenshot: n/a

History:
- qa: opened
- qa: closed — fixed (old "Next:" block removed; renderInitSummary is the single source); retested 323/323

## DEF-008: renderOpenRouterModels crashes on null/undefined `id` or `name`

- Status: CLOSED
- Severity: MEDIUM
- Found by: adversary (ADV-017)
- Phase: 1

Steps to reproduce:
1. From Node REPL or a script, import renderOpenRouterModels from src/model-catalog.js.
2. Call `renderOpenRouterModels([{ id: 'test/foo', name: null }])`.
3. Also call `renderOpenRouterModels([{ id: null, name: 'Test' }])`.

Expected: Graceful rendering with an empty string for the missing field, or a defensive guard preventing crash.
Actual: `TypeError: Cannot read properties of null (reading 'length')` at m.id.length (line 194) or m.name.length (line 195). Uncaught crash with no recovery.
Screenshot: n/a

History:
- qa: opened
- qa: closed — fixed (String() coercion with null-safe default); retested 323/323, null id/name render test added

## DEF-009: applyPreset drops `stack.instructions` from armada.yaml

- Status: CLOSED
- Severity: MEDIUM
- Found by: adversary (ADV-019)
- Phase: 3

Steps to reproduce:
1. Create armada.yaml with `stack.instructions: [".cursor/rules", "CLAUDE.md"]`.
2. Run `armada preset power --target <dir>` (or any preset).
3. Inspect the rewritten armada.yaml in the target directory.

Expected: The `instructions` field is preserved in the rewritten armada.yaml (preset only changes budget + team models).
Actual: The `instructions` field is silently dropped from the output. The post-preset armada.yaml has zero `instructions` lines. Data loss on preset apply.
Screenshot: n/a

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
