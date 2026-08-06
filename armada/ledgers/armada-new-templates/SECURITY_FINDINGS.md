# armada/ledgers/armada-new-templates/SECURITY_FINDINGS.md — security findings

All security findings live in `armada/ledgers/armada-new-templates/SECURITY_FINDINGS.md`, one entry
per finding, newest first. Writer: **security** (create findings). Statuses: OPEN, ACCEPTED,
REJECTED, MITIGATED. The orchestrator sets Disposition. Nobody else edits.

Format, exactly:

    ## SEC-###: Title

    - Status: OPEN
    - Severity: HIGH | MEDIUM | LOW
    - Found by: security
    - Phase: N

    What I found: ...
    Expected: ...
    Actual: ...
    Screenshot: armada/screenshots/armada-new-templates/sec-###.png (optional)

    History:
    - security: opened

Statuses and who may set them:

| Status | Meaning | Set by |
|--------|---------|--------|
| OPEN | New finding, pending review | security |
| ACCEPTED | Finding confirmed, fix planned | orchestrator |
| REJECTED | Not a vulnerability / not in scope | orchestrator |
| MITIGATED | Fix applied and verified | orchestrator |

Every status change appends a History line.
