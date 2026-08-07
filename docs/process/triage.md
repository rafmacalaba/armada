# Triage: voyage vs. in-window, and voyage splitting

Single source of truth for deciding how incoming armada work runs. This document is the
authority. Every other mention of the decision lives in `AGENTS.md`, the orchestrator
prompt, `/armada-voyage`, or `README.md` and either links here or is this file (see
[Baseline](#baseline-existing-triage-statements)).

Two decisions live here:

1. **Voyage vs. in-window** — does the work get a dedicated worktree lane (voyage), or does
   it run directly in the current tree (in-window)?
2. **Voyage splitting** — when a broad task does run as voyage(s), is it one lane or several
   independent lanes?

Both answers follow the same default: **in-window first, voyage by exception.** A voyage is
a deliberate, proportionate choice — never an automatic reaction to any request.

## The principle: in-window first, voyage by exception

The default answer to "does this go in a voyage" is **no**. Most work belongs in-window.

- **In-window** = work done directly in the current tree, under the documented exceptions,
  without a new worktree lane, contract, or dedicated evidence/PR flow.
- **Voyage** = dedicated lane (`sandbox/<name>` + `feat/<name>`), scaffolded team, approved
  contract at `armada/REQUIREMENTS.md`, evidence-gated phases, PR-first finish.

A voyage is recommended **only when fleet orchestration is necessary or materially
beneficial**. It is **never automatic** — a voyage recommendation must be articulated,
proportionate to the request, and confirmable by the user. When in doubt, default in-window
and escalate to a voyage proposal only if the ambiguity resolves toward fleet orchestration
being worth the ceremony. **Ambiguous scope is terminal after one clarification:** ask at most
one scoping question, then default in-window (or propose a voyage if the answer points to a
fleet need) — never re-ask in a loop.

### Default in-window

Run the following in-window (do not propose a lane):

- **Questions, investigations, and reviews** — read-only work, answers, or assessments.
- **Trivial or straightforward single-file fixes** — a small, well-understood bug fix or edit
  whose scope does not exceed one file **and** whose risk surface is low: no trust boundary,
  auth/crypto, security, or critical-path correctness change (e.g. a typo, a label, a
  non-critical message). A single-file change that alters a trust boundary or critical path
  is **not** in-window by default. This doc does not override risk classification: if
  `src/workflow-policy.js` (or the orchestrator's adaptive-staffing risk model) flags the
  change HIGH risk, it does not stay in-window. The user may still grant an **explicit risk
  override** — stating "run this in-window despite the risk" — after the risk is named.
- **Small docs/process edits** — README, TODO, AGENTS.md, this contract; process-note drift
  correction. Not a doc set rewrite, just a small edit.
- **Defect ledger maintenance** — opening, closing, dispositioning DEFECTS / ADVERSARIAL /
  SECURITY entries.
- **Work already inside an approved lane** — dispatch it to a subagent in-tree (in window);
  never spin up a fresh voyage for work the current lane owns.

If the request matches any of these, do it in-window and move on. No escalation.

### When to recommend a voyage

Recommend a voyage only when fleet orchestration is necessary or materially beneficial:

- **Net-new multi-file functionality** — a feature spanning several files, modules, or roles
  where the live tree would be altered at scale.
- **An independent contract + evidence + PR** — work that will land as its own reviewed PR
  with its own approval and QA chain.
- **"Ship a TODO item" whose ownership, evidence, or PR scope exceeds the current lane** —
  the TODO spans the fleet, needs its own gates, or would otherwise overrun the in-window
  path.

When recommending a voyage, articulate it: name the lane, say why fleet orchestration is
worth it, and make it confirmable by the user. Never present it as automatic.

## Voyage splitting: separate voyages vs. a single voyage

A broad task decomposes by its workstreams:

- **Separate voyages** when the workstreams are **independent** — disjoint writers (no shared
  source), their own contracts, their own PRs (no ordering dependency). Each lane runs and
  lands on its own foundations.
- **One voyage** when workstreams **share writers** or form a **single contract** — they
  serialize on shared files/roles, so one lane keeps the fleet honest.

The independence test is three-part, each objective — **writer**, **contract**, **PR
dependency**:

1. **Disjoint writers?** Is there any source file, config key, or module that two workstreams
   must *write* (not merely read)? A shared file is only compatible with a split if exactly one
   of them owns it and the other reads it, or the shared file is *extend-only* (append its own
   clearly-delimited partition, no touch to the other partition). If two writers must modify the
   same file — even to "extend" a shared module in overlapping regions — that fails: the writer
   is shared, so it serializes, which couples the streams.
2. **Independent contracts?** Each workstream could be specified, evidenced, and accepted on its
   own, with its own criteria and reviewers.
3. **Own PRs?** Each lands on `main` separately with no mutual ordering dependency. If PR B
   cannot merge until PR A is in, they are not independent.

**Shared-file test (writer, objective):** a trivially partitionable shared file (e.g.
`config.json` where each stream appends its own top-level key) stays independent; a file two
streams both *rewrite in place* (e.g. a shared `data-access.ts` logical layer both restructure)
does not. Criterion: does the second stream's edit touch a region the first already wrote or
will soon write? If yes → shared writer.

If all hold, split. If a writer is shared or the contracts/PRs depend in either direction, one
voyage, and its orchestrator serializes the shared writer.

## Decision tree

Concrete cases, asked in order. First match wins; when ambiguous, default in-window.

| # | Case | Answer | Why |
|---|------|--------|-----|
| 1 | "What does this function do?" / "Is X a bug?" | **In-window** | Question/investigation, read-only. |
| 2 | "Review this PR / this diff." | **In-window** | Review, read-only. |
| 3 | "The auth check rejects valid tokens." (one file, known cause) | **Risk-classified** | In-window only if not a trust boundary / HIGH risk; otherwise voyage or explicit risk override. A typo or label is in-window; a JWT/crypto/security change is not blanketed in-window (see [Default in-window](#default-in-window)). |
| 4 | "Fix a typo / update README / TODO note." | **In-window** | Small docs/process edit. |
| 5 | "Reopen DEF-003; the fix regressed." | **In-window** | Ledger maintenance. |
| 6 | Current lane owns a sub-feature; "finish it". | **In-window** | Already inside an approved lane; dispatch in-tree. |
| 7 | "Add payment, plus webhooks, plus a dashboard." (independent, own PRs) | **Three separate voyages** | Disjoint files, independent contracts, own PRs. |
| 8 | "Add a module that touches shared `config.json`, used by two features." | **One voyage** | Shared writer on one file. |
| 9 | "Ship TODO item: new CLI command + parser + tests." | **Voyage** (one) | Net-new multi-file. Split only if internally independent. |
| 10 | "Just make it work." (ambiguous scope) | **In-window, clarify once** | Ask one scoping question. On the reply: if the scope resolves to a fleet need (multi-file, orchestration worthwhile), propose a voyage; otherwise proceed in-window. If still ambiguous after that one clarification, terminate: default in-window and ask the user to choose, or stop and let the user pick — do not loop re-asking. |

## Worked example: splitting a broad task

**Request:** "Add billing (invoices, payments) and a usage dashboard to the product."

**Independence test:**

1. **Disjoint writers?** Yes — `billing/` and `dashboard/` touch no shared source; only
   `config.json` would be shared, and it is extend-only (each appends its own top-level key,
   no overlapping region).
2. **Independent contracts?** Yes — each has its own features, criteria, and reviewers.
3. **Own PRs?** Yes — each lands on `main` separately with no ordering dependency.

**Decision:** two separate voyages — `billing/invoices-payments` and
`dashboard/usage`. Each gets its own `sandbox/<name>` + `feat/<name>` lane, contract,
evidence gates, and PR.

**Variant:** the same request lands on top of a shared `data-access.ts` both features must
rewrite. Writer on `data-access.ts` is shared → the independence test fails on part 1. **One
voyage**, and its orchestrator serializes writers on that one file.

## Baseline: existing triage statements

Every pre-existing triage statement and its location, marked **superseded** (replaced by
this doc) or **aligned** (consistent with this doc). Baseline captured during Phase 1 of the
`workflow-triage` voyage.

| File:line | Statement (summary) | Status |
|---|---|---|
| `AGENTS.md:17-18` | "Feature work must run through armada"; references `docs/armada-improves-armada.md` for the flow. | **Superseded** — policy now alive only here; that doc is dangling and does not exist in the checkout (Phase 3/4 drift fix). |
| `AGENTS.md:31-33` | Exceptions editable directly in-tree: small docs/process edits, defect ledger, single-file bug fixes. | **Superseded** — Phase 2 replaces the restated list with a link to this doc. |
| `agents/orchestrator/prompt.template.md:137-142` | Hard rule 5: "Feature work runs through docks, never the live tree." | **Superseded** — a voyage fork of the dock rule; Phase 2 cites this doc as the authority. |
| `agents/orchestrator/prompt.template.md:152-154` | `/armada-voyage` launches a feature voyage (lane, arm, boot). | **Aligned** — a launch mechanism, not a triage decision. |
| `agents/orchestrator/prompt.template.md:156-163` | "Voyage launch" — parallel voyages allowed; start each independent lane. | **Aligned** — consistent with voyage-splitting by independence. |
| `.opencode/commands/armada-voyage.md:6-28` | Voyage launch sequence; parallel voyages, PR-first. | **Aligned** — a launch sequence, not a triage decision. |
| `README.md:81-85` | "Isolate feature work" — `armada voyage sandbox/my-feature`. | **Aligned** — describes the voyage mechanism. |
| `README.md:186` | Each feature voyage runs in its own worktree for parallel isolation. | **Aligned** — consistent with split-by-independence. |
| `README.md:194` | "A voyage is done only when it opens a reviewed PR." | **Aligned** — PR-first safeguard. |
| `README.md:210` | "Independent voyages use separate worktrees… shared-file writers serialize." | **Aligned** — consistent with this doc's split rule. |

Aligned statements do not restate triage policy — they describe mechanisms and invariants
that hold under this doctrine. Superseded statements are the ones that decided voyage-vs-
in-window on their own; from now on that decision is this document's alone.

## Revisions

- **Phase 1 (workflow-triage):** initial canonical doctrine; baseline recorded. Phases 2-6
  wire the fleet to this doc.