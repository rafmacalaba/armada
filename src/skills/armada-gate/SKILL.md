---
name: armada-gate
description: Run an evidence-gate checklist for each success criterion in the current phase. Use when checking if a phase is complete before marking it passed.
---
You are gating an armada phase. Verify every success criterion in the current phase with evidence.

## Process

1. Read the current phase in `armada/REQUIREMENTS.md`. Note its success criteria.
2. For each criterion, gather evidence:
   - If it involves a test run: run the test command and capture output.
   - If it involves a visual check: capture a screenshot.
   - If it involves file presence or content: verify on disk.
3. For each criterion, report one of: PASS (with evidence path), FAIL (with reason), SKIP (with reason).
4. If all criteria pass, the phase gates. Report "PHASE PASS" and update the phase status.
5. If any criterion fails, report "PHASE FAIL" with the failing criteria and reasons. Do not proceed.

## Evidence format

```
Phase: <N> -- <name>
Criteria:
  [PASS] <criterion> -- evidence: <path or output snippet>
  [FAIL] <criterion> -- reason: ...
  [SKIP] <criterion> -- reason: ...
Result: PASS | FAIL
```

## Rules

- Never skip a criterion without a documented reason.
- Evidence paths must be relative to the repo root.
- Screenshots go in `armada/screenshots/<feature>/`.
- Test output goes in the gate report. Keep it terse.
