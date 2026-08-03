# Using armada to improve armada

The recurring loop: armada's own team audits and builds armada itself. Everything happens in a
`sandbox/<name>/` worktree so the live repo stays pristine. Two lanes share one skeleton:

- **Lane A — Audit** (recurring): the team reviews armada's code, files findings.
- **Lane B — Feature** (one-off): the team implements a TODO item or feature.

This doc supersedes the old `docs/self-dogfood.md`. For using armada on **other** repos, see
[docs/using-armada.md](./using-armada.md).

> **Currency note (2026-08-02):** this flow now targets the **per-feature contract + on-disk
> state** direction in `TODO.md` — each feature is its own contract (the end-goal spec of what
> the user wants), scaffolded into a worktree, driven autonomously with `--yolo`. As armada
> becomes session-based (state/, restart-proof), this loop is what it uses to keep improving
> itself across sessions.

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

## The contract — the end-goal spec

A feature contract **is the end goal of what the user wants to implement**, written before any
code. It lives at `armada/REQUIREMENTS.md` (today) and will move to `armada/contracts/<feature>.md`
as per-feature contracts ship (see `TODO.md` — implementation/session-based armada). A contract has:

- **Goal** — what the user wants, in their words, refined by the orchestrator.
- **Phases** — each with `Depends on:`, `Goal:`, `Success criteria:` (measurable, evidence-gated).
- **Final criteria** — what "done" means across the whole feature.
- **Constraints** — non-functional requirements (a11y, no deps, perf, etc.).

Rules that make it the end goal rather than a vague wish:

- The orchestrator **co-writes** it with you, one question at a time, until consensus.
- **No implementation starts against an unapproved contract.**
- **Done only when every final criterion is demonstrably true** (test run / screenshot / file:line).

## Shared skeleton

```bash
# 1. worktree (from repo root)
git worktree add -b feat/<name> sandbox/<name>
cd sandbox/<name>

# 2. scaffold the team — --yolo = autonomous, no permission prompts
#    (--headless scopes orchestrator bash for headless runs; --yolo is the strict superset)
node ../../src/cli.js init --yes --yolo --budget balanced

# 3. write the contract (or leave blank to co-write with the orchestrator)
#    armada/REQUIREMENTS.md  <- the end-goal spec of the feature

# 4. drive it — boots into the orchestrator (default_agent)
opencode
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
node ../../src/cli.js init --yes --yolo --budget balanced
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

> Lane B uses `armada drive` (Phase 1) to boot the team and hand it the contract — no more manual
> `tmux new-session` + `sleep` + `send-keys` dance.

Anything in `TODO.md`: a new command like `armada feature`, a state schema, a bugfix — each is
a feature with its own contract (the end-goal spec).

### Run it

```bash
git worktree add -b feat/<name> sandbox/<name>
cd sandbox/<name>
node ../../src/cli.js init --yes --yolo --budget balanced
```

Write the contract at `armada/REQUIREMENTS.md` — either hand-drafted from the TODO item / spec
(the end-goal spec of the feature), or left blank so the orchestrator co-writes it with you
(blank phases → it asks, drafts, iterates, gets approval; no implementation before approval).

Then:

```bash
# 4. drive it — boots into the orchestrator, waits until the TUI is ready,
#    then sends the drive prompt. Safe to re-run; attaches if the session exists.
node ../../src/cli.js drive sandbox/lane-drive
```

`armada drive` is a subcommand of the existing `armada` binary, so a global install can just run
`armada drive sandbox/lane-drive`. It creates the tmux session (idempotent — attaches if present),
polls `tmux capture-pane` until the TUI shows its prompt bar, sends the drive prompt, verifies it
registered (the pane flips to the orchestrator's `thinking` indicator, resending once if not), and
on timeout prints the captured pane tail and exits non-zero.

Once the session is up, `armada drive` auto-opens a visible terminal attached to it: macOS opens
Terminal.app (or iTerm if installed), Linux opens the default X terminal emulator
(`gnome-terminal`, `konsole`, or `x-terminal-emulator`; `wezterm start` fallback if installed;
requires `DISPLAY`), and Windows opens Windows Terminal with a new tab (wezterm fallback if
installed). wezterm is optional — never required. If no terminal can be opened (headless, missing
binary, no `DISPLAY`), it prints `tmux attach -t <name>` and continues — the drive never fails.
Pass `--no-open` to skip the auto-open for CI/headless use.

If you're already running in a terminal (the common case — you ran `armada drive` from one),
`armada drive` opens a **tab in that terminal** instead of a fresh window. Detection uses
`TERM_PROGRAM` (Apple_Terminal, iTerm.app, WezTerm) on macOS and `KONSOLE_VERSION` on Linux;
wezterm's daemon reuses the existing instance. vscode / cursor users get a `tmux attach`
hint instead (their integrated terminal can't be addressed from outside). The success message
reflects what happened: `auto-attached in tab of Terminal.app` vs `auto-attached in new window
of Terminal.app` vs `auto-attach skipped: ... — attach manually: tmux attach -t <name>`.

Phase gates: a phase closes only with evidence — passing test run, screenshot, or file/line
citation. `DEFECTS.md` and `ADVERSARIAL_REVIEW.md` are append-only; only qa closes a defect.

### Driving it yourself (the co-write interview)

`armada drive` creates the tmux session and hands off to the attach automatically — the TUI is
yours when the drive prompt lands. To drive the co-write interview yourself, attach manually:

```bash
tmux attach -t <session>        # you're now IN the orchestrator's TUI
```

The orchestrator is the only agent you address. To co-write a feature you're driving:

1. **Start a blank contract** — leave `armada/REQUIREMENTS.md` as the stub (don't hand-author
   phases). That's the signal to co-write.
2. **Say what you want**, e.g. *"Let's co-write the contract for <feature>. Ask me one question
   at a time."*
3. **Answer its questions one at a time** — it drafts phases + success criteria as you go and
   iterates until you **explicitly approve**. No building before approval.
4. **Detach when you're done** (`Ctrl+b` then `d`) — the session keeps running, the fleet
   dispatches, and the orchestrator holds its turn on the evidence gates.
5. **Re-attach anytime** (`tmux attach -t <session>`) to answer a question, approve a gate, or
   watch the subagent panel (`ctrl+x`).

This is the canonical armada interaction: **you steer via questions and approvals; the fleet
executes.** `--yolo` only auto-approves tool permissions — the contract co-write is still
yours.

### Finish

```bash
# from sandbox: tests must be green
node --test 'tests/*.test.js'

# from the live repo (PR, never merge locally)
git push origin feat/<name>
gh pr create --base master --head feat/<name> --title "..." --body "..."

# ask the user to merge; after merge, clean up
git worktree remove sandbox/<name>
git branch -d feat/<name>
```

Rule: a lane is done when its PR is merged by the user — never `git merge` locally, never push
master directly. Every armada feature lands as a reviewed PR.

### Self-modification rule (learned in the first Lane B run)

When a Lane B feature touches armada's **own** generators or templates (e.g. the orchestrator
prompt, command renderers, scaffold output), the fleet edits the **tracked source**
(`agents/**`, `src/**`), not just the sandbox's generated `.opencode/` copies — those are
gitignored and lost on re-scaffold. Add a gate to such contracts: after the change, run
`armada init --from-armada armada/armada.yaml` and verify the generated output still reflects
the change (survives re-scaffold). The first run missed this and the fix had to be ported
manually (see `8e0fab3`).

## Shared mechanics

- **Sandbox worktree:** isolated branch + working tree; live repo never scaffolded. See
  [docs/sandbox.md](./sandbox.md) for the venue details (worktree vs plain copy).
- **Read-only reviewers stay read-only.** security/architect/adversary `edit: deny` by design;
  they report in-session and the orchestrator writes files. See the generated `AGENTS.md`.
- **TUI required for background parallel dispatch.** Background-job reconciliation only works
  in the live TUI. One-shot `opencode run` uses **inline** subagent dispatch (results land after
  the orchestrator's turn ends). With `--yolo`, `opencode run` is fully autonomous (no prompts).
- **`--yolo`** sets `permission: { "*": "allow" }` in `opencode.json` + orchestrator/qa bash to
  `allow`, so the fleet never stalls on a prompt — the default for self-improvement lanes.
  Role `edit` boundaries are kept (the orchestrator still delegates writes).
- **`--headless`** (older) scopes orchestrator bash for CI; `--yolo` is the strict superset.
- **`external_directory: deny`** in generated `opencode.json` blocks writing outside the repo;
  have agents write repo-relative files.
- **State (landing soon):** the fleet will track features in `armada/state/` (per-feature
  contracts, phase graph, evidence, next action) so a killed session resumes — see
  `TODO.md` "implementation/session-based armada".

## See also

- [docs/sandbox.md](./sandbox.md) — venue: worktrees, scaffold, lifecycle, cleanup.
- [docs/using-armada.md](./using-armada.md) — using armada on **other** repos (build or audit).
- [docs/validation.md](./validation.md) — recorded outcomes of past runs.
- [TODO.md](../../TODO.md) — the roadmap this loop feeds.
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — module map and data flow.
