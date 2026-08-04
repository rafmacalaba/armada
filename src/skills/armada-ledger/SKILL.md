---
name: armada-ledger
description: Pick the right ledger for a finding. Use when writing defects, adversarial findings, or security findings. Triggers on: ledger, defect, adversarial, security finding, DEF-001, ADV-001, SEC-001.
---

# Armada: Ledger Routing

Every finding goes to exactly one ledger. Write to the wrong ledger and it will be ignored. Per-feature ledgers live under `armada/ledgers/<feature>/`.

## Rules

1. **DEFECTS.md** — for test failures, regression bugs, UI defects. Found by corvette (qa) during testing. Format: DEF-001, status OPEN, steps to reproduce.
2. **ADVERSARIAL_REVIEW.md** — for hostile review findings. Found by xebec (adversary) during gate review. Format: ADV-001, Disposition PENDING.
3. **SECURITY_FINDINGS.md** — for security vulnerabilities, injection vectors, auth bypasses. Found by frigate (security). Format: SEC-001, severity + CWE.
4. **Lifecycle:** DEFECTS: OPEN -> FIX-READY -> CLOSED (corvette only). ADVERSARIAL: PENDING -> ACCEPTED/DISPATCHED -> CLOSED (via corvette). SECURITY: OPEN -> FIX-READY -> CLOSED.
5. Only qa writes to DEFECTS.md (except orchestrator for status updates). Only adversary writes to ADVERSARIAL_REVIEW.md. Only security writes to SECURITY_FINDINGS.md.

Example: A failing unit test goes to `armada/ledgers/my-feature/DEFECTS.md` as DEF-003. An injection vector goes to `armada/ledgers/my-feature/SECURITY_FINDINGS.md` as SEC-001.
