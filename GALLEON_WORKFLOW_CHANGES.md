# Galleon Workflow Changes — Local Notes

**Date:** 2026-08-09
**Status:** Proposed, not yet applied
**Scope:** galleon.md prompt rewrite + task spec template + orchestrator-subagent flow

## Context

User and commodore reviewed the galleon backend agent prompt. Identified gaps:
- No team context (galleon did not know its work feeds qa, frontend, adversary).
- Re-discovery duplication: galleon was told to read REQUIREMENTS.md, the stack, source dir, adjacent files — work the orchestrator (frontier model) should pre-load.
- Vague verification ("exercise the changed API for real") with no requirement to paste evidence.
- No constraint checklist (type-system escape hatches, debug prints, magic numbers).
- "Shipnames title format" section duplicated in every agent prompt; belongs in root AGENTS.md or the plugin.
- No self-review step.
- No risk-to-test-depth rule.
- Defect flow did not require evidence.

Decisions:
- Galleon is execution-only. Commod (orchestrator, frontier) does the planning and pre-loads a task spec with scope, contract, pattern files, evidence requirements, risk tier.
- Galleon prompt shrinks; spec carries the project specifics.
- New skill `armada-task-spec` (template + flow) so every dispatch has consistent shape.
- Shipnames section dropped from all 8 agent prompts; rule moves to root AGENTS.md.

## Proposed galleon.md (final)

```md
---
description: Galleon — Backend implementation
mode: subagent
model: opencode-go/deepseek-v4-pro
permission:
  edit:
    armada/ledgers/*/DEFECTS.md: deny
    armada/ledgers/*/ADVERSARIAL_REVIEW.md: deny
    armada/ledgers/*: deny
    armada/e2e/*: deny
    armada/screenshots/*: deny
    armada/state/*: deny
    REQUIREMENTS.md: deny
    AGENTS.md: deny
    .opencode/*: deny
    opencode.json: deny
    DEFECTS.md: deny
    ADVERSARIAL_REVIEW.md: deny
    armada/*: deny
  skill: allow
---

You are Galleon — backend specialist in a multi-agent team. You receive a task
spec from the commodore (pre-loaded: scope, contract, pattern files, evidence
requirements, risk tier) and build exactly what it says. Your output feeds
Corvette (qa), possibly Clipper (frontend) and Xebec (adversary). The commodore
owns the contract; you do not change it.

Do not re-read REQUIREMENTS.md, re-discover the stack, or reinterpret scope.
The spec is your contract.

## Method

- Work incrementally. Validate each step before next.
- Load `armada-tdd` before source, `armada-sdd` for return shape, `armada-context-budget` always, `armada-ledger` when scope unclear.
- If spec is wrong, incomplete, or ambiguous, surface to commodore BEFORE coding.

## Verify (before done)

- Lint + typecheck: paste command + tail in receipt `Evidence`.
- Unit tests: paste command + tail.
- TDD: red→green transcript.
- API: real request + response.
- Data changes: restart + confirm persistence.
- Per evidence checklist in spec.
- No pasted evidence = qa rejects.

## Self-review (before done)

Re-read your diff. Check: debug prints, commented code, naming, dead code,
hardcoded values, missing tests, contract criteria covered, type-system escape
hatches (any, as unknown as, @ts-ignore, type: ignore, bare except). Fix before
reporting.

If diff > 400 lines, split before reporting. Surface to commodore.

## Defects

When assigned a DEF entry:

1. Reproduce. Paste steps + observed in receipt `Evidence`.
2. Fix root cause. Paste after-fix. Add/adjust unit test that would have caught it.
3. One outcome: `FIX READY` | `CANNOT REPRODUCE` | `WORKING AS INTENDED` (with detail).

## Hard rules

- **Boundaries**: no edits to ledger, e2e, state, REQUIREMENTS, AGENTS, `.opencode/*`.
- **Defect status**: never mark/claim/imply closed. Done when qa retests.
- **Tests**: no e2e writes; no weakening/skipping/deleting.
- **Claims**: no done without pasted evidence.
- **Deps**: no new dep without orchestrator approval + receipt justification.
- **Style**: no emojis.

## Output contract

Lead with answer. path:line refs. ≤6 words per note. No narration.
```

## Reasoning per change

- **Team context paragraph**: tells galleon its work feeds other agents; motivates evidence, contract discipline, structured handoff. Sets authority chain (commodore owns contract; galleon surfaces, does not change).
- **Dropped "read REQUIREMENTS.md / stack / source dir"**: orchestrator pre-loads via spec. Eliminates doubling between frontier planning and specialist execution.
- **Dropped "read adjacent files"**: orchestrator embeds pattern file excerpts in spec. Model matches style from concrete examples, not from meta-instructions.
- **"Method" section restored**: user pushed back when removed. Work incrementally + load skills + surface ambiguity. Three lines, lean.
- **"Verify" replaces vague "exercise for real"**: explicit evidence-paste requirement per check. Receipt without evidence = qa rejects.
- **"Self-review" new section**: model critiques own diff before reporting. Constraint checklist catches common model sloppiness (escape hatches, debug prints, magic numbers). 400-line cap forces small PRs.
- **"Defects" flow tightened**: step 1 requires evidence of reproduction; step 2 requires after-fix evidence + regression test.
- **"Hard rules" grouped by category**: boundaries, defect status, tests, claims, deps, style. Two new rules (claims, deps) prevent sloppy outcomes.
- **Output contract preserved**: terse, leads with answer, path:line refs, no narration.
- **"Shipnames title format" section removed**: not needed in galleon prompt. Plugin handles auto-prefix. Belongs in root AGENTS.md or plugin docs. Drop from all 7 other agent prompts; single source of truth in AGENTS.md.
- **Frontmatter unchanged**: same model, same permissions, same role boundaries.

## Task spec template

**Location:** `.opencode/skills/armada-task-spec/SKILL.md` (commodore loads when dispatching).

**Content:**

```md
# Task spec — filled by commodore, executed by specialist

## Meta
- Phase: <id>
- Task: <id, short title>
- Role: backend-dev | frontend-dev
- Risk: low | medium | high
- Files to touch: <list>

## Scope
<What to build, 2-5 bullets. What is OUT of scope.>

## Contract (if API change)
<Endpoint signatures, request/response shapes, error codes. Immutable.>

## Pattern files
<1-2 file excerpts from the same module, ~30-60 lines each, showing the
style to match. Commod reads + embeds.>

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
```

**Flow:**
1. Commod reads `armada/REQUIREMENTS.md`, identifies phase.
2. Commod infers stack from `package.json` / `pyproject.toml` (no longer in agent prompt).
3. Commod reads 1-2 representative files in target module, embeds excerpts in spec.
4. Commod fills template, dispatches via `task` to galleon/clipper.
5. Specialist executes spec, fills Receipt block, returns.
6. Qa verifies against Evidence block + receipt.

**Benefits:**
- No re-discovery in specialist prompt.
- Pattern files = concrete examples.
- Evidence requirements explicit upfront; specialist cannot skip.
- Risk tier explicit; test depth determined once by commod.
- Consistent shape across all dispatches.

## Orchestrator <-> subagent flow

**Roles** (from `src/role-display.js`):
- orchestrator -> Commodore (commod, frontier model `opencode-go/minimax-m3`)
- backend-dev -> Galleon (`deepseek-v4-pro`)
- frontend-dev -> Clipper (`minimax-m3`)
- qa -> Corvette (`mimo-v2.5-free`)
- adversary -> Xebec (`deepseek-v4-pro`)
- security -> Frigate (`big-pickle`)
- docs -> Caravel (`deepseek-v4-flash-free`)
- architect -> Bark (`big-pickle`)

**Dispatch mechanics:**
1. Commod calls `task` tool with `subagent_type: "<role>"` (e.g. `galleon`).
2. `prompt` field = task spec (commod's message to the subagent).
3. `description` field = work-only title. The shipnames plugin auto-prefixes `<Ship> [<role>]` at the opencode layer.
4. Subagent loads: its agent file (system prompt) + commod's prompt + any skills matched by description.
5. Subagent runs in its own context window with its own permission set.
6. Subagent returns one compact receipt.

**Communication:**
- Commod -> subagent: task spec (in `prompt`)
- Subagent -> commod: receipt (Status, Files, Evidence, Result, Risks, Next)
- Subagent <-> subagent: none. All routing via commod. No shared memory.
- Commod -> user: decisions, questions, status
- User -> commod: contract input, approvals

**Permission boundaries** (per subagent, deny list in agent frontmatter):
- galleon: cannot edit ledger, e2e, state, REQUIREMENTS, AGENTS, `.opencode/*`
- corvette: writes e2e, screenshots, defects; cannot edit code
- xebec: writes adversarial findings; cannot edit code
- All: cannot edit `armada/*` (state + ledgers + e2e are off-limits except for their role)

**Lifecycle:**
1. User + commod co-write `armada/REQUIREMENTS.md` (contract).
2. Commod reads contract, builds phase graph, writes `armada/state/active.json`.
3. For each ready phase, commod dispatches implementer(s) in parallel (different files) or serial (shared file).
4. Implementer returns receipt; commod reviews.
5. Commod dispatches corvette for verification.
6. Conditionally dispatches xebec / frigate / bark based on risk.
7. Qa findings -> ledger -> fix loop.
8. Final phase -> commod opens PR, auto-merges if clean.

**Why galleon is a specialist, not a planner:**
- Galleon prompt is now execution-only: "build what spec says".
- Commod (frontier) does the thinking: which files to read, what patterns to match, how to scope.
- Commod pre-loads spec with: scope, contract, pattern files, evidence requirements, risk tier.
- Galleon does the doing: write code, run tests, paste evidence.
- No re-discovery in galleon. Doubling eliminated.

**Limits:**
- Subagent context resets between dispatches (no shared memory).
- Parallel only when file ownership disjoint; shared file = serial.
- Subagents cannot see each other's work except via commod.
- Skills auto-load by description match, not by name.

## Application path

Two options for applying galleon.md changes:
- (a) User applies manually. Commod cannot edit `.opencode/agent/galleon.md` directly (hard rule 2 exception list). User pastes the proposed content.
- (b) Dispatch non-galleon subagent to apply. Need to verify which role has `.opencode/*` write permission; likely none.

Recommendation: (a). Fastest and avoids permission ambiguity.

## Open items

- Task spec template location: `.opencode/skills/armada-task-spec/SKILL.md`. Confirm.
- Same pattern (team context + execution-only) for clipper.md, corvette.md, xebec.md: deferred for now.
- Shipnames rule: drop from all 7 remaining agent prompts; add once to root AGENTS.md.
- 100% Bark review for backend/frontend PRs (currently conditional in adaptive staffing).
- Risk->test depth matrix in `armada-gate` (low/medium/high test scoping) — deferred to separate voyage.
- Static + coverage gate in `armada-gate` — deferred.
- PR template + bar in voyage-finish — deferred.