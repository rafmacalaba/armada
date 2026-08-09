---
name: armada-task-spec
description: Task spec template for commodore dispatches to specialists (galleon, clipper, etc.)
---

# Task spec — filled by commodore, executed by specialist

## Meta
- Phase: <id>
- Task: <id, short title>
- Role: backend-dev | frontend-dev | qa | adversary | security | docs | architect
- Risk: low | medium | high
- Files to touch: <list>

## Scope
<What to build, 2-5 bullets. What is OUT of scope.>

## Contract (if API change)
<Endpoint signatures, request/response shapes, error codes. Immutable.>

## Pattern files
<1-2 file excerpts from the same module, ~30-60 lines each, showing the style to match. Commod reads + embeds.>

## Evidence requirements
- [ ] Lint + typecheck: <command>
- [ ] Unit tests: <command>
- [ ] TDD red->green transcript
- [ ] API: real request/response
- [ ] Persistence: restart + confirm (if data change)
- [ ] Project-specific: <other>

## Test depth
- low: smoke
- medium: unit + 1 negative
- high: unit + integration + multi negative

## Hard rules reminder
- No claim without pasted evidence
- No new dep without approval
- Diff > 400 lines -> split, surface
- No type-system escape hatches

## Receipt
Status:
Files:
Evidence:
Result:
Risks:
Next:
