# Using armada to improve armada

The recurring loop: armada's own team audits and builds armada itself. Everything happens in a
`sandbox/<name>/` worktree so the live repo stays pristine. Two lanes share one skeleton:

- **Lane A — Audit** (recurring): the team reviews armada's code, files findings.
- **Lane B — Feature** (one-off): the team implements a TODO item or design spec.

This doc supersedes the old `docs/self-dogfood.md`. For using armada on **other** repos, see
[docs/using-armada.md](./using-armada.md).

## Why

- **Dogfooding catches real bugs.** Prior runs found `buildTeam` dropping per-role model
  overrides, `formatStack` crashing on an empty stack, and catalog drift on live providers.
- **The team is stack-aware and opinionated.** Have architect/security review armada's own
  `src/` — they know what multi-agent code should look like.
- **Sandbox keeps the live repo clean.** `sandbox/` is gitignored; worktrees share `.git` so
  merge is a fast-forward. The live repo is never scaffolded.

## The trigger

Opening `opencode` inside a scaffolded sandbox **is** the trigger. The orchestrator is a native
primary agent (`.opencode/agent/orchestrator.md`) whose prompt is the full self-contained
delivery protocol; `opencode.json` sets `default_agent: "orchestrator"` so the TUI boots
straight into it. There is no separate "start armada" step — the protocol is live the moment the
session opens. `/armada` only reports status.

The orchestrator dispatches the team in **parallel** as opencode-native background subagents:
independent phases, and `backend-dev ∥ frontend-dev` within a phase.

## Shared skeleton

```bash
# 1. worktree (from repo root)
git worktree add -b feat/<name> sandbox/<name>
cd sandbox/<name>

# 2. scaffold the team (headless = bash allow, no ask-stalls)
node ../../src/cli.js init --yes --headless --budget balanced

# 3. drive it
opencode        # boots into the orchestrator (default_agent)
```

`git worktree list` shows all sandboxes. Cleanup when done:
`git worktree remove sandbox/<name>` (merge first for features).

## Lane A — Recurring audit

The audit is read-only: the team reviews the code, the orchestrator writes findings. No code
changes.

### Run it

```bash
git worktree add -b feat/audit sandbox/audit
cd sandbox/audit
node ../../src/cli.js init --yes --headless --budget balanced
opencode
```

Then hand the orchestrator the audit task:

```
Audit opencode-armada for self-improvement. Scope: src/, tests/, agents/, docs/.

Dispatch in parallel:
- security → vulnerability/authz audit of src/
- architect → cross-cutting review of src/generator.js, src/scaffold.js, src/cli.js
- adversary → hostile review of the CLI contract (flags, exit codes, error paths)
- qa → run `node --test 'tests/*.test.js'`, verify the suite is green and meaningful

Each returns findings in-response (security/architect/adversary are read-only and cannot
write files). Reconcile: file each real finding in AUDIT.md with severity + file:line,
separating bugs from improvements. Do not change code.
```

### Capture → fix → test

1. Read `AUDIT.md`.
2. File each real finding in `TODO.md` — bugs vs improvements. (Bugs are usually a feature
   lane: "fix the bug" is a small contract.)
3. Fix with TDD (`node --test 'tests/*.test.js'` must stay green).
4. Append the outcome to `docs/validation.md`.

## Lane B — Feature implementation

Anything in `TODO.md` or a design spec (kept locally under `docs/superpowers/specs/`,
gitignored): a new command like `armada new`, a landing page, a bugfix.

### Run it

```bash
git worktree add -b feat/<name> sandbox/<name>
cd sandbox/<name>
node ../../src/cli.js init --yes --headless --budget balanced
```

Write the contract at `armada/REQUIREMENTS.md` — either hand-drafted from the TODO item / spec,
or left blank so the orchestrator co-writes it with you (blank phases → it asks, drafts,
iterates, gets approval; no implementation before approval).

Then:

```bash
opencode
# "Drive the contract in armada/REQUIREMENTS.md. Phase-gate on evidence.
#  Run independent phases in parallel. Don't advance a phase without passing its criteria."
```

Phase gates: a phase closes only with evidence — passing test run, screenshot, or file/line
citation. `DEFECTS.md` and `ADVERSARIAL_REVIEW.md` are append-only; only qa closes a defect.

### Finish

```bash
# from sandbox: tests must be green
node --test 'tests/*.test.js'

# from the live repo (merge + clean)
git merge feat/<name>
git worktree remove sandbox/<name>
```

## Shared mechanics

- **Sandbox worktree:** isolated branch + working tree; live repo never scaffolded. See
  [docs/sandbox.md](./sandbox.md) for the venue details (worktree vs plain copy).
- **Read-only reviewers stay read-only.** security/architect/adversary `edit: deny` by design;
  they report in-session and the orchestrator writes files. See the generated `AGENTS.md`.
- **TUI required for background parallel dispatch.** Background-job reconciliation only works
  in the live TUI. One-shot `opencode run` uses **inline** subagent dispatch (results land after
  the orchestrator's turn ends).
- **`--headless`** sets orchestrator bash to `allow`, so `opencode run` doesn't stall on `ask`.
- **`external_directory: deny`** in generated `opencode.json` blocks writing outside the repo;
  have agents write repo-relative files.

## See also

- [docs/sandbox.md](./sandbox.md) — venue: worktrees, scaffold, lifecycle, cleanup.
- [docs/using-armada.md](./using-armada.md) — using armada on **other** repos (build or audit).
- [docs/validation.md](./validation.md) — recorded outcomes of past runs.
- [TODO.md](../../TODO.md) — the roadmap this loop feeds.
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — module map and data flow.
