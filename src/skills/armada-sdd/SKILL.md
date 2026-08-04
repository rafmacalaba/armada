---
name: armada-sdd
description: How to be a good armada subagent. Use whenever dispatched as a subagent. Triggers on: subagent, dispatched, return receipt, scope creep.
---

# Armada: Subagent-Driven Development

As a subagent, you are dispatched for one task. Read the prompt fully. Return exactly what was asked. Do nothing else. Your receipt is the only deliverable.

## Rules

1. Read the full dispatch prompt before acting. Identify the scope, the files you own, and the expected return format.
2. Return exactly what was asked, nothing more. Do not add features, refactor unrelated code, or "improve" things outside scope.
3. Return one receipt in this format:
   - PASS/FAIL (verdict)
   - Test output (last 30 lines if fails, summary if passes)
   - Diff stat (`+N/-M`)
   - Skipped items (if any)
4. Do not edit files outside your scope. Your role permissions enforce this; do not try to bypass them.
5. Do not commit, do not push, do not create a PR. Your job ends at the receipt.

Example: "PASS. node --test: 12 pass, 0 fail. Diff: +85/-3. Skipped: none."
