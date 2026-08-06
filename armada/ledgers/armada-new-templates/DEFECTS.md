# armada/ledgers/armada-new-templates/DEFECTS.md — defect ledger

All defects live in `armada/ledgers/armada-new-templates/DEFECTS.md`, one entry per defect,
newest first. Writer: **qa** (create, close, reopen). Nobody else edits it, ever.

Format, exactly:

    ## DEF-001: Short title

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

## DEF-001: null bytes in project name cause unhandled crash

- Status: OPEN
- Severity: LOW
- Found by: qa
- Phase: 3

Steps to reproduce:
1. Run `armada new "bad\x00name"` via CLI, or call `runNew({ name: "bad\x00name", yes: true, cwd: tmp })`.

Expected: Clear error message (e.g. "invalid project name: must not contain null bytes") and exit code 1.
Actual: Node.js throws `ERR_INVALID_ARG_VALUE` at `mkdirSync` inside `renderCookiecutterTemplate`, crashing the process with an unhandled error. The name validation in `runNew` (lines 229-248 of `src/new-command.js`) checks for `/`, `..`, leading `/`, and leading `-`, but does not check for null bytes (`\0`).

History:
- qa: opened
