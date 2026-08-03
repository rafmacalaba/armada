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

Disposition: ACCEPTED -> fixed in 0ae33ff
History:
- orchestrator: ACCEPTED -> fixed in 0ae33ff
