# armada/ledgers/armada-new-templates/ADVERSARIAL_REVIEW.md — adversary findings

All adversary findings live in `armada/ledgers/armada-new-templates/ADVERSARIAL_REVIEW.md`,
one entry per finding, newest first. Writer: **adversary** (create entries) and
**orchestrator** (fill Disposition). Nobody else.

Format, exactly:

    ## ADV-001: Short title

    - Session: phase-3 gate | final
    - Suggested severity: HIGH | MEDIUM | LOW

    What I did: ...
    Expected: ...
    Actual: ...
    Screenshot: armada/screenshots/armada-new-templates/adv-001.png (optional)

    Disposition: PENDING

The orchestrator replaces PENDING with either `ACCEPTED -> DEF-NNN` or `REJECTED - reason`.
Accepted findings are reproduced and filed in armada/ledgers/armada-new-templates/DEFECTS.md by qa.
No entry may remain PENDING when the final phase completes.
