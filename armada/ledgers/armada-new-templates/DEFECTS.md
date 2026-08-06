# armada/ledgers/armada-new-templates/DEFECTS.md — defect ledger

All defects live in `armada/ledgers/armada-new-templates/DEFECTS.md`, one entry per defect,
newest first. Writer: **qa** (create, close, reopen). Nobody else edits it, ever.

Format, exactly:

    ## DEF-NNN: Short title

    - Status: OPEN
    - Severity: HIGH | MEDIUM | LOW
    - Found by: qa
    - Phase: 3

    Steps to reproduce:
    1. Numbered, specific, starting from app launch.

    Expected: What should happen.
    Actual: What happens instead.
    Screenshot: armada/screenshots/armada-new-templates/def-001.png (optional)

    History:
    - qa: opened

Statuses and who may set them:

| Status | Meaning | Set by |
|--------|---------|--------|
| OPEN | Filed, or reopened after a failed retest or a bounced dispute | qa |
| FIX-READY | A developer reports a fix is in | orchestrator, relaying the developer |
| DISPUTED | A developer reports CANNOT REPRODUCE or WORKING AS INTENDED | orchestrator, relaying verbatim |
| CLOSED | qa retested and confirmed the fix, or accepted the dispute | qa only |
| REJECTED | Will not fix, with a written reason | orchestrator only |

Every status change appends a History line.

## DEF-011: cloneTemplate temp dir not cleaned on error paths

- Status: CLOSED
- Severity: MEDIUM
- Found by: qa
- Phase: 3

Steps to reproduce:
1. Trigger an error after `cloneTemplate` creates a temp dir (e.g. bad template path after clone).

Expected: Temp dir cleaned up after error.
Actual: Temp dir left behind on disk.

History:
- qa: opened
- qa: retest passed (test: DEF-011: cloneTemplate temp dir cleaned on error path)

## DEF-010: template gitignore not shipped for npm compat

- Status: CLOSED
- Severity: MEDIUM
- Found by: qa
- Phase: 3

Steps to reproduce:
1. Run `armada new` with a template that includes `.gitignore`.
2. Check if `.gitignore` appears in output.

Expected: `.gitignore` present in scaffolded project.
Actual: npm packlist excludes `.gitignore`; template ships as `dot.gitignore` and is renamed on copy.

History:
- qa: opened
- qa: retest passed (fix: starter templates renamed to dot.gitignore, new-command.js renames on copy)

## DEF-009: --template with file path gives unclear error

- Status: CLOSED
- Severity: LOW
- Found by: qa
- Phase: 3

Steps to reproduce:
1. Run `armada new foo --template /path/to/file.txt --yes`.

Expected: Clear error: "not a directory".
Actual: Unclear error message.

History:
- qa: opened
- qa: retest passed (test: DEF-009: --template with a file path errors with 'not a directory')

## DEF-008: template symlinks followed during render

- Status: CLOSED
- Severity: MEDIUM
- Found by: qa
- Phase: 3

Steps to reproduce:
1. Create template with a symlink entry.
2. Run `armada new` with that template.

Expected: Symlinks skipped during render.
Actual: Symlinks followed, potentially escaping template dir.

History:
- qa: opened
- qa: retest passed (test: DEF-008: template symlinks are not followed during render)

## DEF-007: cookiecutter vars that break JSON not rejected

- Status: CLOSED
- Severity: MEDIUM
- Found by: qa
- Phase: 3

Steps to reproduce:
1. Provide a config with a value containing `"` or `\` that breaks JSON structure.

Expected: Clear rejection error.
Actual: Malformed JSON written.

History:
- qa: opened
- qa: retest passed (test: DEF-007: malicious variable values that break JSON are rejected)

## DEF-006: catalog load error missing file path

- Status: CLOSED
- Severity: LOW
- Found by: qa
- Phase: 3

Steps to reproduce:
1. Corrupt or delete `_catalog.json`.
2. Run `armada new` non-interactively.

Expected: Error message includes file path.
Actual: Error message omits path.

History:
- qa: opened
- qa: retest passed (test: DEF-006: catalog load error includes file path)

## DEF-005: out-of-range numeric in category picker not rejected

- Status: CLOSED
- Severity: LOW
- Found by: qa
- Phase: 3

Steps to reproduce:
1. In TTY category picker, enter a number outside the valid range.

Expected: Reject and re-prompt.
Actual: Accepted without validation.

History:
- qa: opened
- qa: retest passed (test: DEF-005: pickCategory TTY out-of-range number rejects and re-prompts)

## DEF-004: defaultVars from catalog not applied as fallback

- Status: CLOSED
- Severity: MEDIUM
- Found by: qa
- Phase: 3

Steps to reproduce:
1. Use a catalog template with defaultVars defined.
2. Omit those vars from config.

Expected: defaultVars used as fallback.
Actual: Vars left unresolved.

History:
- qa: opened
- qa: retest passed (test: DEF-004: resolveVariables applies defaultVars as fallback for unresolved vars)

## DEF-003: catalog missing categories key gives unclear error

- Status: CLOSED
- Severity: LOW
- Found by: qa
- Phase: 3

Steps to reproduce:
1. Remove `categories` key from `_catalog.json`.
2. Run `armada new` non-interactively.

Expected: Clear error with file path.
Actual: Unclear or missing error.

History:
- qa: opened
- qa: retest passed (test: DEF-003: catalog missing categories key produces clear error with path)

## DEF-002: --template/--config with no value not rejected

- Status: CLOSED
- Severity: LOW
- Found by: qa
- Phase: 3

Steps to reproduce:
1. Run `armada new foo --template --yes` (no value after --template).
2. Run `armada new foo --config --yes` (no value after --config).

Expected: Clear error for missing value.
Actual: Unclear behavior or crash.

History:
- qa: opened
- qa: retest passed (tests: DEF-002: --template with no value errors, DEF-002: --config with no value errors)

## DEF-001: null bytes in project name cause unhandled crash

- Status: CLOSED
- Severity: LOW
- Found by: qa
- Phase: 3

Steps to reproduce:
1. Run `armada new "bad\x00name"` via CLI, or call `runNew({ name: "bad\x00name", yes: true, cwd: tmp })`.

Expected: Clear error message (e.g. "invalid project name: must not contain null bytes") and exit code 1.
Actual: Node.js throws `ERR_INVALID_ARG_VALUE` at `mkdirSync` inside `renderCookiecutterTemplate`, crashing the process with an unhandled error. The name validation in `runNew` (lines 229-248 of `src/new-command.js`) checks for `/`, `..`, leading `/`, and leading `-`, but does not check for null bytes (`\0`).

History:
- qa: opened
- qa: retest passed (test: rejects null bytes in project name (DEF-001))
