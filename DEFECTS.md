# opencode-armada — Defect ledger

All defects, newest first. Writers: qa (create, close, reopen), orchestrator (record developer responses, reject). Nobody else.

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
- qa: opened (filed by orchestrator from ADV-023)
- qa: CLOSED — fix confirmed at scaffold.js:106-108 (lstatSync.isDirectory check), unit test passes (scaffold.test.js:408-421), independent repro produces clear error `custom prompt template is a directory, not a file: templates (for role backend-dev)`, full suite green 338/338
