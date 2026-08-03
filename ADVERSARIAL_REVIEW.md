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
