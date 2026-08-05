# Using armada

> **SUPERSEDED (2026-08-05).** This doc is kept for historical reference only. The operator
> manual moved to [operator-guide.md](./operator-guide.md) (install/upgrade/uninstall/rollback,
> full flag table, exit codes, file ownership) and [user-guide.md](./user-guide.md) (quickstart,
> every command with an example). Sections below that contradict the current code:
> - "surgically merges the armada-owned keys into opencode.json" (lines 24-27) is wrong —
>   `opencode.json` is regenerated only with `--restart` (`src/scaffold.js:360-364`);
> - "11 commands" counts are stale — there are 12 commands plus the `reconcile` alias;
> - "opt-in fleet-tracker plugin" (line 276) is wrong — the fleet tracker is default-on,
>   opt out with `--no-fleet-tracker` (`src/scaffold.js:420-423`);
> - "4 user-facing skills" (lines 369-381) — 9 skills ship (`src/skills/index.js:31-41`);
> - "`armada <cmd> --help` is always the canonical list" (line 294) — every `--help` prints
>   the same global block; the canonical reference is operator-guide.md#cli-reference;
> - "`armada drive` remains a hidden alias" (line 159) — drive is a public deprecated alias
>   listed in help (`src/cli.js:81-85`);
> - reconcile is a documented alias of resume, not deprecated (`docs/stability/P1/aliases-audit.md`).

The operator manual (superseded). README pitches; this doc ran the day-to-day: install and
upgrade, the 12 commands in detail, the contract co-write flow, multi-feature work,
observability, lifecycle, the full flag table, the role roster, the model catalog, the
bundled skills, and fleet terminology.

For running armada on armada itself (dock worktrees in `sandbox/<name>/`), see
[docs/armada-improves-armada.md](./armada-improves-armada.md) instead.

## Install / upgrade

```bash
npm install -g opencode-armada        # or: bun add -g opencode-armada
armada --version
armada doctor                         # environment health check
```

Upgrade an armed repo in two steps:

1. `npm install -g opencode-armada@latest` (or bump in your package manager).
2. `armada init --from-armada armada/armada.yaml` — re-scaffolds `.opencode/` and `armada.yaml`
   from the manifest and surgically merges the armada-owned keys into `opencode.json` (`model`,
   `default_agent`, `permission`, `provider.openrouter.models`); every other `opencode.json` key
   survives byte-for-byte.

Verify with `armada doctor` after upgrading. If `armada/armada.yaml` is missing, run
`armada init` first.

## The 11 commands in detail

### armada init

Interactive questionnaire; detects your stack from `package.json` / `pyproject.toml` /
`requirements.txt` / `Dockerfile` and scaffolds the team into the repo. Ends with a summary:
team size, budget, cost hint, per-role model roster, next steps. Never clobbers an existing
`opencode.json` or `AGENTS.md`.

```bash
armada init                          # interactive
armada init --stack nextjs-fastapi --budget balanced   # declarative
armada init --from-armada armada/armada.yaml           # regenerate from manifest
armada init --yes --yolo             # non-interactive, autonomous
armada init --headless               # CI-safe (orchestrator bash allowed)
```

- `armada update` — deprecated; use `armada init --from-armada --restart` (one-version alias, removed in v2.0).
- `armada preset` — deprecated; use `armada init --budget <name>` (one-version alias, removed in v2.0).

### armada new

Cookiecutter-style: pick a curated starter, scaffold the directory, run `init` inside. Three
categories ship today: `web-app` (Next.js 15 + Tailwind 4 + TypeScript), `ml-training`
(Python + PyTorch + uv), `research-paper` (LaTeX + Makefile).

```bash
armada new my-app                                     # interactive
armada new my-app --type web-app --beginner --yes     # non-interactive
```

### armada doctor

Environment health check: opencode presence, providers + openrouter auth, background dispatch,
supervision-plugin presence, and model drift between `armada.yaml` and the rendered agent
frontmatter.

### armada status

The canonical "where am I". Reads `armada/state/active.json` plus the features index and prints
the active feature, phase, and next action.

```bash
armada status                        # human table
armada status --json                 # machine output
armada status --feature <name>       # one feature's row
```

- `armada feature status` — deprecated; use `armada status --feature <name>` (one-version alias, removed in v2.0).

### armada fleet

Cross-repo per-lane progress dashboard. Reads the run files under `~/.armada/runs/`
(`$ARMADA_RUNS_DIR` if set) written by `armada voyage --heartbeat` or the fleet-tracker plugin.

```bash
armada fleet                         # one row per active lane: lane, phase, status, age, cost
armada fleet --json                  # machine-readable
armada fleet <session>               # one lane's full detail
armada fleet --open                  # open the dashboard in a terminal window
```

### armada voyage

Boot a lane session and send the voyage prompt. The advanced path: feature work in an isolated
worktree, detached from your main session.

```bash
armada voyage sandbox/<name>
armada voyage sandbox/<name> --name my-session --prompt "..." --timeout 60000
armada voyage sandbox/<name> --no-open --print-attach
armada voyage sandbox/<name> --heartbeat
```

- `armada drive` — deprecated; use `armada voyage` (one-version alias, removed in v2.0).

### armada feature

Per-feature contract management.

```bash
armada feature new <name>            # contract + state, sets active
armada feature new <name> --worktree # isolate in a git worktree
armada feature list
armada feature close <name>          # evidence-gated: refuses until criteria pass
```

### armada models

Curated model catalog for the active budget. The first column prints role keys; the display-name
column is cosmetic (see [The fleet terminology](#the-fleet-terminology)).

```bash
armada models                        # curated table for the active budget
armada models power                  # the power-tier catalog
armada models --refresh              # merge live provider models
armada models --list-openrouter      # live OpenRouter model list
```

### armada resume

Resume after an interrupted session. Reads `armada/state/`, prints the resume line (active
feature, phase, next action) plus one line per evidence drift. Read-only in all modes; exits 0
when clean, 2 when drifts are reported. Drifts are reported, never auto-failed: the phase stays
open until a human acts.

```bash
armada resume                        # resume line + drift list
armada resume --json                 # raw ResumePlan as JSON
armada resume --state-dir <path> --repo <path>
```

- `armada reconcile` — deprecated; use `armada resume` (one-version alias, removed in v2.0).

### armada uninstall

Remove armada-generated artifacts. Never touches user files unless asked.

```bash
armada uninstall                     # armada-owned files only
armada uninstall --all               # also generated AGENTS.md / opencode.json / contract
armada uninstall --dry-run           # print what would be removed
armada uninstall --target <dir>      # operate on a different repo root
```

### armada help

Usage. Also `armada --version`. The one command to confirm the binary works.

- `armada scout` — removed; use `/armada-scout` inside the opencode TUI.
- `armada ping` — removed; use `armada help`.

### The four slash commands

Slash commands mirror a CLI subset; all live in `.opencode/commands/`.

| Command | What it does |
|---|---|
| `/armada` | team status, roles, how to regenerate |
| `/armada-scout` | dispatch a read-only investigation (adversary/architect) |
| `/armada-voyage` | launch a feature voyage from the TUI |
| `/armada-resume` | resume a killed session |

## The contract co-write flow

`armada/REQUIREMENTS.md` is the contract. The scaffolder writes a stub; you and the orchestrator
iterate until it is approved. **No implementation starts against an unapproved contract.**

1. Open `opencode` — it boots straight into the orchestrator.
2. Describe what you want in plain language (a TODO item, a bug report, a raw wish).
3. The orchestrator reads `armada/REQUIREMENTS.md`. If blank, it does not build — it asks one
   question at a time (scope, users, data, pages), drafts the phases + success criteria, and
   iterates until you explicitly approve.
4. Once approved, it dispatches ready phases in parallel as background subagents and gates each
   on evidence — a passing test run, a screenshot, a file:line citation.
5. It comes back to you only for judgment: contract approval, a decision it cannot make, or a
   permission override. Everything else it resolves itself.

A good contract has success criteria, phases (each with `Depends on:`, `Goal:`, and a
`Success criteria:` checklist), final criteria, and constraints.

```markdown
# my-project — Requirements

> The contract. Co-write with the orchestrator.

## Success criteria
- [ ] ...

## Phases

### Phase 1 — Foundation
- **Depends on:** none
- **Goal:** ...
- **Success criteria:**
  - [ ] ...

## Final criteria
- [ ] Every phase success criterion is demonstrably true.
```

### Parallel phases — write disjoint files

Independent phases run as parallel background subagents. The one thing that forces
serialization is two phases writing the same file. Give each phase its own file(s) and
independent phases stay parallel:

```
Phase 1: /about  -> backend-dev writes src/routes/about.js  ||  frontend-dev writes public/about.html
Phase 2: /admin  -> backend-dev writes src/routes/admin.js  ||  frontend-dev writes public/admin.html
Phase 3 (depends 1): src/routes/about-team.js
Phase 4 (depends 2): src/routes/admin-settings.js
```

Phases 1 and 2 run in parallel (disjoint files); 3 waits for 1, 4 waits for 2. If phases must
share a file, the orchestrator serializes the writers on a reused subagent session and says so.

### Autonomous mode

`armada init --yolo` — no permission prompts: the generated `opencode.json` gets
`permission: { "*": "allow" }` and orchestrator/qa bash becomes `allow`. Role boundaries are
kept (the SDK resolves the most specific rule first — the orchestrator still cannot edit code,
security/architect stay read-only). Then:

```bash
opencode run --agent orchestrator "run armada/REQUIREMENTS.md"
```

## Multi-feature work

Each feature is its own contract + state file under `armada/state/features/`.

- `armada feature new <name>` — create the contract + state, set it active.
- `armada feature list` — all features from the state index.
- `armada feature close <name>` — evidence-gated close.

For true parallel isolation, spawn a git worktree per feature:

```bash
armada feature new <name> --worktree   # creates sandbox/<name> + feat/<name> branch
armada voyage sandbox/<name>           # boot the lane
```

Separate working trees cannot collide, and merging is a per-feature fast-forward. Voyages are
serialized (`git worktree add` avoids `.git/index.lock` contention). Multiple features in one
checkout work too — they rely on the disjoint-files rule.

## Observability

**Fleet commands** (run in your terminal, not the TUI):

| Command | What it does |
|---|---|
| `armada status` | active feature, phase, next action |
| `armada fleet [session]` | per-lane progress dashboard |
| `armada doctor` | environment health check |
| `armada resume` | drift list after an interrupted session |

**Fleet status file (`.opencode/fleet-status.md`):** written by the orchestrator so a killed
session can be resumed — YAML frontmatter (`active_phases`, `last_update`, `next_action`) plus a
short body. The orchestrator reads it on session start and on `armada status` / `armada resume`.

**Heartbeat freshness:** `armada fleet` marks a lane STALLED when no heartbeat has arrived in
the last 2 minutes. Keep entries fresh with `armada voyage --heartbeat` (one-off) or the opt-in
fleet-tracker plugin (`armada init --fleet-tracker`).

**Supervision plugin (advanced):** default init is plugin-free. `armada init --supervision-plugin`
adds `.opencode/plugins/armada-supervision.js` (session-start resume nudge, no blind stop on
idle, bash-redirect guard). `--watchdog` nudges the orchestrator when a dispatched subagent has
been pending too long. `armada doctor` reports plugin presence; `armada uninstall` removes them.

## Lifecycle

- **Teardown:** `armada uninstall` removes `armada.yaml` and the armada-owned `.opencode/`
  files; it does not touch `opencode.json` or `AGENTS.md`. `armada uninstall --all` for a hard
  reset (also removes generated `AGENTS.md` / `opencode.json` / contract).
- **Re-scaffold:** `armada init --from-armada armada/armada.yaml` regenerates the identical
  team — init → parse → init is byte-identical.
- **Upgrade:** see [Install / upgrade](#install--upgrade).

## The CLI reference

Full flag table. `armada <cmd> --help` is always the canonical list.

| Command | Flag | Meaning |
|---|---|---|
| `armada init` | `--stack <hint>` | overlay stack tokens (nextjs, fastapi, postgres, ...) |
| | `--budget <free\|balanced\|power>` | budget tier |
| | `--from-armada <file>` | regenerate from manifest |
| | `--requirements <file>` | contract file (default `armada/REQUIREMENTS.md`) |
| | `--target <dir>` | scaffold into a directory (default cwd) |
| | `--yes` / `--yolo` | non-interactive / autonomous (no permission prompts) |
| | `--headless` | CI-safe (orchestrator bash allowed) |
| | `--dry-run` | print files without writing |
| | `--supervision-plugin` / `--watchdog` / `--no-fleet-tracker` | opt-in plugin toggles |
| `armada new <name>` | `--type <web-app\|ml-training\|research-paper>` | starter category |
| | `--beginner` / `--experienced` | recommended stack / per-layer drill-down |
| | `--yes` | skip prompts |
| `armada doctor` | — | |
| `armada status` | `--json` | machine output |
| | `--feature <name>` | one feature's row |
| `armada fleet [session]` | `--json` | machine output |
| | `--open` | open the dashboard in a terminal window |
| `armada voyage <lane>` | `--name <session>` | tmux session name (default: lane basename) |
| | `--prompt <text>` | drive prompt |
| | `--timeout <ms>` | ready timeout (default 30000) |
| | `--no-open` | skip auto-attach |
| | `--print-attach` | print the attach command |
| | `--heartbeat` | keep the fleet entry fresh |
| `armada feature` | `new <name> [--worktree]` | create contract (+ isolated worktree) |
| | `list` | all features |
| | `close <name>` | evidence-gated close |
| `armada models` | `[budget]` | curated catalog for a tier |
| | `--refresh` | merge live provider models |
| | `--list-openrouter` | live OpenRouter model list |
| `armada resume` | `--json` | raw `ResumePlan` as JSON |
| | `--state-dir <path>` | read state from `<path>` (default `<repo>/armada/state`) |
| | `--repo <path>` | repo root for contract + evidence paths (default cwd) |
| `armada uninstall` | `--all` | also generated user-adjacent files |
| | `--dry-run` | print what would be removed |
| | `--target <dir>` | operate on a different repo root |
| `armada help` | — | usage; `armada --version` |

## The role roster

| Role key | Job | Can it write code? |
|---|---|---|
| `orchestrator` | delivery lead: plans, delegates, gates phases | No — delegates all writes |
| `backend-dev` | server, API, storage, backend tests | Yes (backend files) |
| `frontend-dev` | UI/UX implementation, frontend tests | Yes (frontend files) |
| `qa` | e2e tests, screenshots, owns DEFECTS.md, closes defects | `armada/e2e/`, `armada/screenshots/`, `armada/ledgers/` only |
| `adversary` | hostile review, breaks the running app | No — read-only |
| `security` | vulnerability/authz audit | No — read-only |
| `docs` | README, API docs, changelog | Docs only |
| `architect` | architecture, refactor risk, review | No — read-only |

Boundaries are enforced by SDK permissions in the agent frontmatter, not by prompt politeness.
The SDK resolves the most specific rule first.

## The model catalog

Primary models run on the opencode providers; fallbacks are equivalent OpenRouter models.
`armada models [budget]` prints this table for the active tier. Override a role's model in
`armada/armada.yaml` → `agents.<role>.model: "openrouter/<slug>"`, then re-scaffold with
`armada init --from-armada armada/armada.yaml`.

| Role key | Primary (opencode) | Fallback (openrouter) |
|---|---|---|
| `orchestrator` | `opencode-go/minimax-m3` | `openrouter/z-ai/glm-5.2` |
| `backend-dev` | `opencode-go/deepseek-v4-pro` | `openrouter/deepseek/deepseek-v4-pro` |
| `frontend-dev` | `opencode-go/minimax-m3` | `openrouter/minimax/minimax-m3` |
| `qa` | `opencode/mimo-v2.5-free` | `openrouter/xiaomi/mimo-v2.5` |
| `adversary` | `opencode-go/deepseek-v4-pro` | `openrouter/deepseek/deepseek-v4-pro` |
| `security` | `opencode/big-pickle` | `openrouter/deepseek/deepseek-v4-pro` |
| `docs` | `opencode/deepseek-v4-flash-free` | `openrouter/minimax/minimax-m3` |
| `architect` | `opencode/big-pickle` | `openrouter/z-ai/glm-5.2` |

## The skills (4 user-facing)

Four skills are user-facing and loadable on demand; the rest are orchestrator-internal and
never appear in user copy. Ship a custom subset via `armada.yaml` → `project.skills: [...]`
(absent field = all bundled skills).

| Skill | When to load |
|---|---|
| `armada-contract` | co-writing or updating a feature contract |
| `armada-gate` | checking a phase's evidence gates before marking it passed |
| `armada-pr` | finishing a feature lane: `gh pr create`, PR-first close |
| `armada-resume` | resuming a killed or interrupted session |

## The fleet terminology

| Term | Meaning |
|---|---|
| fleet | the whole team: orchestrator + 7 specialists |
| voyage | a feature implementation run that ships as a reviewed PR |
| lane / dock | the `sandbox/<name>/` worktree a voyage runs in |
| ship | the tmux session a dock runs under |
| patrol | a recurring audit of armada's own code |
| contract | `armada/REQUIREMENTS.md` — phases + success criteria |
| evidence | a passing test run, screenshot, or file:line citation |
| gate | the point where a phase's evidence is checked |

**Display names (cosmetic):** commodore, galleon, clipper, corvette, xebec, frigate, caravel, bark — agent file names and TUI labels only; the role keys above are the source of truth.

## See also

- [docs/armada-improves-armada.md](./armada-improves-armada.md) — using armada on armada itself (dock worktrees).
- [docs/sandbox.md](./sandbox.md) — dock worktrees, lifecycle, cleanup.
- [SPEC.md](../SPEC.md) — manifest schema and contract format.
- [TODO.md](../TODO.md) — the roadmap.
- [ARCHITECTURE.md](../ARCHITECTURE.md) — how armada works.
