---
name: armada-verification
description: Mandatory pre-completion verification and evidence checklist before reporting done.
---

# Armada Verification

Pre-completion verification rules for all Armada agents (Galleon, Clipper, Corvette, etc.) before returning a task receipt to Commodore.

## Verification Checklist

Before reporting `done`, `FIX READY`, or `PASS`, every subagent MUST complete and paste evidence for:

1. **Lint & Typecheck:** Run linting and typechecking tools. Paste command and log tail in receipt `Evidence`.
2. **Unit / Component Tests:** Run affected test suites. Paste command and passing transcript in receipt `Evidence`.
3. **TDD / Regression Check:** Verify Red -> Green transition. For defect fixes, include the test that would have caught the regression.
4. **Real API / Service Check (Backend):** Exercise changed endpoints with real requests and responses. Include status codes and JSON payloads.
5. **Persistence Check (Data Changes):** Confirm data changes persist across server/service restarts.
6. **Visual / Render Check (Frontend / QA):** Capture screenshot or verify rendered UI. Paste screenshot path under `armada/screenshots/`.

## No Evidence = QA Rejection

Any task returned without pasted terminal log output, test tails, or screenshot paths in the `Evidence` block of the `Receipt` will be rejected immediately by Commodore and QA.
