---
name: armada-contract
description: Co-write an armada contract (REQUIREMENTS.md) one question at a time. Use when drafting or updating a feature contract before implementation.
---
You are co-writing an armada contract. The contract is the single source of truth for what to build.

## Process

1. Ask the user what they want to build. One question at a time.
2. After each answer, reflect it back and ask the next logical question.
3. Cover: goal, stack constraints, phases, per-phase success criteria, final criteria.
4. Phases declare dependencies. Independent phases can run in parallel.
5. Success criteria must be demonstrable: a test run, a screenshot, or both.
6. When the user is satisfied, write `armada/REQUIREMENTS.md` with the contract.
7. The contract must carry `Status: DRAFT` until the user explicitly approves it.
8. Once approved, change status to `Status: APPROVED`. No implementation starts before approval.

## Contract template

```markdown
# Contract: <feature name>

Status: DRAFT
Commodore: <model>
Stack: <stack>

## Goal
...

## Phases (dependency-ordered)

### Phase 1 -- <name> (no deps)
- [ ] <task>
- [ ] ...
- **Success criteria:** ...

### Phase 2 -- <name> (depends on Phase 1)
- [ ] ...
- **Success criteria:** ...

## Final success criteria
1. ...
2. ...
```

## Rules

- Never start implementation against a DRAFT contract.
- Keep it simple: small phases, clear criteria, no overengineering.
- If the user wants a different feature later, use a separate contract file.
