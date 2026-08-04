---
name: armada-tdd
description: Test-driven development for armada workers. Use before writing any implementation. Triggers on: TDD, failing test, test first, write a test.
---

# Armada: Test-Driven Development

Write the test first. Watch it fail. Write the minimal implementation to pass. Refactor. Never skip the failing-test step. This is the only acceptable workflow for implementation code.

## Rules

1. Write a failing test before any implementation. The test must exercise the desired behavior, not the implementation details.
2. Run the test and confirm it fails for the right reason (feature missing, not a syntax error). Never skip this step.
3. Write the minimal code to make the test pass. Do not add features, error handling, or performance optimizations that the test does not demand.
4. Refactor only after all tests are green. Remove duplication, improve names, but add no behavior.
5. One test per behavior. Tests live in `tests/*.test.js` next to the source. If a bug is found, write a failing test that reproduces it before fixing.

Example: To add `validateSkillName(name)`: write `test("rejects names with uppercase")`, run it (fail), write the `^[a-z]` regex, run it (pass).
