# Self-dogfood: using armada to improve armada

The fastest way to find armada's gaps is to run armada on its own repo and let its own team
tear it apart. This repo does exactly that. Here is the proven loop.

## Why

- **Dogfooding catches real bugs.** The first run found `buildTeam` dropping per-role model
  overrides, `formatStack` crashing on an empty stack, and `opencode/deepseek-v4-pro` not
  existing on live providers.
- **The team is stack-aware and opinionated.** Have architect/security review armada's own
  `src/` — they know what multi-agent code should look like.
- **Zero friction.** `armada init --headless` + `opencode run` gives a CI-friendly loop.

## Prerequisites

```bash
# one-time
npx oh-my-opencode-slim@latest install --preset=opencode-go   # runtime engine (bun absent? npx works)
opencode auth login                                           # provider auth (opencode-go for free models)
export OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true        # background orchestration
```

Verify: `node src/cli.js doctor` → `omo-slim plugin: pass`.

## The loop

### 1. Scaffold the team into this repo (transient)

```bash
node src/cli.js init --yes --headless --budget balanced
```

- Writes `.opencode/` (team config + 8 role prompts + `/armada` command), `armada.yaml`,
  `opencode.json`, `REQUIREMENTS.md`.
- `--headless` sets `project.headless: true` → the orchestrator's bash becomes `allow` instead
  of `ask`, so non-interactive `opencode run` doesn't stall on permission prompts.
- **`AGENTS.md` is never touched** (no-clobber). `git status` shows exactly what was created.

### 2. Interactive orchestration (live TUI)

```bash
OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true opencode
```

Then: `/armada` for team status, `ping all agents`, or give the orchestrator a task like
*"have security + architect review src/cli.js, then qa verifies"*. Background subagents run in
child sessions; you approve `ask`-level permissions live.

### 3. Headless one-shot orchestration (CI-friendly)

```bash
OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true opencode run \
  "Dispatch architect as a subagent to review src/cli.js and return findings in its response.
   Wait inline, then write the top 3 findings to smoke-findings.md."
```

- In one-shot `run` mode, use **inline** subagent dispatch so the orchestrator gets results in
  the same turn and can reconcile + write evidence files.
- Background-jobs reconciliation (`continueOnIdle: false`) resolves after the turn ends, so it
  only works in the live TUI. See [Limitations](#limitations).

### 4. Capture findings → fix → test

1. Read the findings file (`cat smoke-findings.md`).
2. File each real one in `TODO.md` with a fix note.
3. Fix with TDD (`node --test 'tests/*.test.js'` must stay green).
4. Append the outcome to `docs/validation.md`.

### 5. Clean up (restore the pristine repo)

```bash
node src/cli.js uninstall            # removes armada.yaml + armada-owned .opencode/ files
rm opencode.json REQUIREMENTS.md     # files THIS session created (uninstall --all would also
                                     # delete AGENTS.md — don't use --all here)
rm -rf .opencode                     # if uninstall kept it for a non-armada file
git status                           # expect: clean (plus your intended changes)
```

## Record of runs

- **2026-08-01** — first self-dogfood. Roster loads (8 agents), parallel background dispatch
  of security + architect works, role permission boundaries hold. Headless mode added after
  the orchestrator stalled on `ask`-gated bash in `opencode run`. Full results in
  `docs/validation.md` § Self-dogfood.
- **2026-08-01** — headless one-shot. Orchestrator ran `git status`/`ls`/`wc`, dispatched
  architect inline, wrote `smoke-findings.md`. Findings filed in `TODO.md`:
  - `buildTeam` silently drops per-role model overrides from the questionnaire
  - `uninstall` requires an existing manifest (can't clean a deleted-manifest repo)
  - `main()` returns `undefined` — programmatic callers can't distinguish success/error

## Limitations

- **Background-jobs reconciliation needs the TUI.** In one-shot `opencode run`, background
  subagent results land after the orchestrator's turn ends. Use inline dispatch for one-shots.
- **Read-only reviewers stay read-only.** security/architect have `edit: deny` by design, so
  they report findings in-session; the orchestrator (or a dev role) writes them to files.
- **`external_directory: deny`** in generated `opencode.json` blocks agents from writing
  `/tmp`; have them write repo-relative files instead.
- **Interactive `ask` prompts** (non-headless) need a human in the loop — that's the default,
  and `--headless` is the explicit opt-out for automation.
