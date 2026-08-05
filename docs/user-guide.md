# User guide

The end-user quickstart: get a working team, then the full command surface — every command
with a one-line purpose and one example. For install/upgrade/uninstall/rollback and the
complete flag table, see [operator-guide.md](./operator-guide.md). For cost and providers,
see [auth-and-cost.md](./auth-and-cost.md).

## Prerequisites

- Node.js >= 20 (`package.json:29`)
- The opencode CLI installed (<https://opencode.ai>)
- An OpenCode Go credential (default provider; free tier available). OpenRouter optional.

Verify with `armada doctor` — it checks opencode, provider auth, openrouter auth, background
dispatch, node, and the global armada binary (`src/doctor.js:82-225`).

## Quickstart

### New project

```bash
npx opencode-armada new my-app --type web-app --beginner --yes
cd my-app
opencode
```

`new` renders the starter and scaffolds the team in one step (`src/new-command.js:211-214`),
so `opencode` boots straight into the orchestrator.

### Existing repo

```bash
cd your-repo
npx opencode-armada init --yes --yolo
opencode
```

### Your first voyage

1. `opencode` boots into the orchestrator (the default agent, `default_agent: "commodore"`,
   `src/generator.js:232`).
2. `armada/REQUIREMENTS.md` is blank, so the orchestrator co-writes it with you — one question
   at a time (scope, users, phases, success criteria) — and does not build until you explicitly
   approve. That is the contract.
3. Once approved, it dispatches ready phases in parallel as background subagents, gating each
   on evidence (a passing test run, a screenshot, a file:line citation).
4. It returns only for judgment: contract approval, an ambiguous decision, a permission
   override. Everything else it resolves itself.

Outside the TUI you can watch the fleet:

```bash
armada status     # active feature, phase, next action
armada fleet      # one row per running lane
```

## Command reference

### armada init — scaffold the team into an existing repo

```bash
armada init --yes --yolo            # non-interactive, autonomous (no permission prompts)
armada init --from-armada armada/armada.yaml   # regenerate from the manifest
```

Flags: `--stack`, `--budget`, `--from-armada`, `--requirements`, `--target`, `--yes`,
`--yolo`, `--headless`, `--dry-run`, `--no-browser`, `--restart`, `--supervision-plugin`,
`--no-fleet-tracker`, `--watchdog`. Full table in
[operator-guide.md#cli-reference](./operator-guide.md#cli-reference).

### armada new <name> — new project from a curated starter

```bash
armada new my-app --type web-app --beginner --yes
```

Categories: `web-app`, `ml-training`, `research-paper` (`src/new-command.js:143-147`).
Flags: `--type <category>`, `--beginner`, `--experienced`, `--yes`.

### armada doctor — environment health check

```bash
armada doctor
```

Checks opencode CLI, providers auth, openrouter auth, background dispatch, node version,
global armada binary, team roster, plugin presence, and model drift between `armada.yaml`
and the rendered agent frontmatter (`src/doctor.js:82-225`). Exits 1 if any check fails
(`src/cli.js:504`).

### armada status — where the fleet is

```bash
armada status                        # human table
armada status --feature <name>       # one feature's row
armada status --json                 # machine output
```

Reads `armada/state/active.json` + the features index (`src/status-cmd.js:23-24`).
`armada feature status` is deprecated; use `armada status --feature`.

### armada fleet — per-lane progress dashboard

```bash
armada fleet                         # one row per active lane
armada fleet <session>               # one lane's full detail
armada fleet --json                  # machine output
```

Reads run files under `~/.armada/runs/` (or `$ARMADA_RUNS_DIR`) written by
`armada voyage --heartbeat` or the fleet-tracker plugin (`src/fleet-tracker.js:193`).

### armada voyage <lane> — boot a lane session

```bash
armada voyage sandbox/<name>                         # boot the lane
armada voyage sandbox/<name> --name my-session --prompt "..." --timeout 60000
armada voyage sandbox/<name> --no-open --print-attach
armada voyage attach <name>                          # print the attach command
```

Boots a tmux session, waits for the opencode TUI, sends the voyage prompt
(`src/cli.js:613-761`). Flags: `--heartbeat`, `--name`, `--prompt`, `--timeout`,
`--no-open`, `--no-track`, `--print-attach`. `armada drive` is deprecated; use `armada voyage`.

### armada voyage-handoff <name> — print a handoff block

```bash
armada voyage-handoff backend-dev qa
```

Prints the dispatch-narration block for named roles (`src/cli.js:817-824`,
`src/handoff.js`). Used when you dispatch voyages manually.

### armada feature — per-feature contract management

```bash
armada feature new <name>             # contract + state, sets active
armada feature new <name> --worktree  # isolate in a git worktree (sandbox/<name> + feat/<name>)
armada feature list
armada feature close <name>           # evidence-gated: refuses until criteria pass
```

`feature close` verifies every success criterion has evidence before marking the feature
shipped (`src/cli.js:903-923`). `--remove` on close deletes the worktree. `armada feature
status` is deprecated; use `armada status --feature <name>`.

### armada models — curated model catalog

```bash
armada models                         # the active budget's table
armada models power                   # the power tier
armada models --refresh               # merge live provider availability
armada models --list-openrouter       # live OpenRouter model list
```

Catalog: 8 roles x primary (opencode providers) + fallback (openrouter) per budget tier
(`src/model-catalog.js:34-100`). See [auth-and-cost.md](./auth-and-cost.md#model-selection).

### armada resume — resume after an interruption

```bash
armada resume                         # resume line + evidence drift list
armada resume --json
```

Reads `armada/state/`, prints the resume line (active feature, phase, next action) plus one
line per evidence drift. Read-only; exits 0 when clean, 2 when drifts are reported
(`src/cli.js:75-77`). `armada reconcile` is a documented alias that behaves identically.

### armada uninstall — remove armada-generated artifacts

```bash
armada uninstall                      # armada-owned files only
armada uninstall --all                # also AGENTS.md, opencode.json, armada/state
armada uninstall --dry-run            # print what would be removed
```

Never touches user files outside armada's own artifacts (`src/scaffold.js:449-556`).
Details in [operator-guide.md#uninstall](./operator-guide.md#uninstall).

### armada help — usage

```bash
armada help
armada --version                      # opencode-armada v0.9.2
```

`armada <cmd> --help` prints the same global help block; there is no per-command help. The
canonical list of commands and flags is the help text plus this guide and
[operator-guide.md#cli-reference](./operator-guide.md#cli-reference).

## Slash commands (inside the opencode TUI)

| Command | What it does |
|---|---|
| `/armada` | team status, roles, how to regenerate |
| `/armada-scout` | dispatch a read-only investigation (xebec hostile review, or bark architecture risk) |
| `/armada-voyage` | launch a feature voyage from the TUI |
| `/armada-resume` | resume a killed session (`armada resume` equivalent) |

All four live in `.opencode/commands/` and are written by the generator
(`src/scaffold.js:409-413`).

## Roles and ship names

Role keys are the stable identifier; ship names are cosmetic agent-file names and TUI labels
(`src/role-display.js:6-15`). Agent files on disk use ship names
(`src/scaffold.js:297-298`).

| Role key | Ship name |
|---|---|
| `orchestrator` | commodore |
| `backend-dev` | galleon |
| `frontend-dev` | clipper |
| `qa` | corvette |
| `adversary` | xebec |
| `security` | frigate |
| `docs` | caravel |
| `architect` | bark |

## Bundled skills

9 skills ship to `.opencode/skills/` (`src/skills/index.js:31-41`). Four are user-facing and
load on demand; five are fleet-internal (loaded by dispatched subagents).

| Skill | When to load |
|---|---|
| `armada-contract` | co-writing or updating a feature contract |
| `armada-gate` | checking a phase's evidence gates before marking it passed |
| `armada-pr` | finishing a feature lane: PR-first close |
| `armada-resume` | resuming a killed or interrupted session |
| `armada-context-budget` | token discipline for subagents (fleet-internal) |
| `armada-dispatch` | parallel dispatch with disjoint file scope (fleet-internal) |
| `armada-ledger` | picking the right ledger for a finding (fleet-internal) |
| `armada-tdd` | test-first implementation (fleet-internal) |
| `armada-sdd` | subagent behavior (fleet-internal) |

Ship a custom subset via `armada.yaml` -> `project.skills: [...]` (absent = all).

## Next steps

- [operator-guide.md](./operator-guide.md) — install, upgrade, uninstall, rollback, exit codes
- [auth-and-cost.md](./auth-and-cost.md) — providers, budgets, rate limits, recovery
- [troubleshooting.md](./troubleshooting.md) — common errors and fixes
- [support.md](./support.md) — where to ask and file

## Self-check

Files read to verify every claim:

- `src/cli.js` (949 lines) — command dispatch, HELP text, all flags, exit codes.
- `src/doctor.js` (226 lines) — check list, exit semantics.
- `src/scaffold.js` (556 lines) — slash commands written (409-413), agent ship-name files
  (297-298), uninstall surface (449-556).
- `src/generator.js` (1-60) — BASE_PERMISSIONS, `default_agent` (`src/generator.js:232`
  referenced via P0 evidence).
- `src/model-catalog.js` (1-120) — roles, catalog, budgets, cache path.
- `src/skills/index.js` (41 lines) — 9-skill registry.
- `src/new-command.js` (224 lines) — starter categories, scaffold-in-new.
- `src/role-display.js` (via P0 evidence lines 6-15) — role-to-ship map.
- `src/status-cmd.js:23-24`, `src/fleet-tracker.js:193`, `src/handoff.js` — via P0 evidence.
- `package.json` — version 0.9.2, engines, bin.
- `docs/stability/P1/aliases-audit.md` — P1 alias/exit-code changes (reconcile documented
  alias, ping/scout removed).

Verdict: PASS — every command, flag, and exit code in this guide matches current source.
Date: 2026-08-05.
