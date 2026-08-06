# Getting started with armada

*From zero to a working AI engineering team in under 5 minutes.*

---

## Prerequisites

- **[opencode](https://opencode.ai)** installed and authenticated
- **Node.js >= 20**
- A terminal (wezterm recommended for lane sessions; any terminal works for setup)

> **Note:** armada currently generates teams for opencode. Support for Claude Code and Codex
> is on the roadmap — same team, different runtime.

---

## Install

```bash
npm install -g armada                 # or: bun add -g armada
armada --version                      # confirm the binary works
armada doctor                         # environment health check
```

`armada doctor` verifies everything: opencode presence, provider authentication, model
availability, and background subagent dispatch. Run it after every install or upgrade.

---

## Option A: New project

The fastest path — interactive questionnaire picks a starter, fills vars, scaffolds the team:

```bash
armada new my-app
cd my-app
opencode                              # boots into the Commodore
```

`armada new` already runs `armada init`, so the team is ready the moment it finishes — do not
run `armada init` again. In a non-TTY (scripted) context it defaults to the `blank` template.

Skip the questionnaire with the flags (`--blank`, `--config ./vars.json`, `--yes`) or use an
external Cookiecutter template with `--template <url|path>`.

Six first-party categories ship today:

| Category | Stack |
|---|---|
| `blank` | (empty) |
| `web-app` | TypeScript + Vite + React |
| `ml-training` | Python 3 |
| `research-paper` | LaTeX |
| `api-service` | TypeScript + Express |
| `cli-tool` | TypeScript + commander |

---

## Option B: Existing repo

Already have a codebase? armada detects your stack and scaffolds the team around it.

```bash
cd your-repo
armada init                           # interactive: detects stack, picks budget, scaffolds
opencode                              # boots into the Commodore
```

Declarative alternative (skip the questionnaire):

```bash
armada init --stack nextjs-fastapi --budget balanced --yes
```

Fully autonomous (no permission prompts, agents run without asking):

```bash
armada init --yes --yolo
```

### What gets written

armada writes its own files and **never clobbers yours**:

| File | Written if... |
|---|---|
| `.opencode/agent/<role>.md` | Always (armada-owned, re-writable) |
| `.opencode/commands/*.md` | Always (armada-owned) |
| `armada/armada.yaml` | Always (the manifest, source of truth) |
| `armada/REQUIREMENTS.md` | Only if absent |
| `opencode.json` | Only if absent |
| `AGENTS.md` | Only if absent |

If `opencode.json` or `AGENTS.md` already exist, armada respects them and only writes the
keys it owns.

---

## Your first feature

### 1. Address the Commodore

```bash
opencode                              # boots into the Commodore (orchestrator)
```

As the **Admiral** (user), you command the fleet through the **Commodore**. The Commodore is the only agent you ever talk to — it plans, delegates, and gates, but never writes code itself.

### 2. Describe what you want

Type your feature request in plain language:

> "Add a /settings page where users can update their display name and email."

The Commodore reads the contract (`armada/REQUIREMENTS.md`). If it's blank, it does **not**
start building. Instead, it co-writes the contract with you:

1. Asks one question at a time — scope, users, auth, data model, pages
2. Drafts phases with success criteria
3. Iterates until you explicitly approve

**No implementation starts without your approval.**

### 3. Watch it build

Once you approve, the Commodore:

1. Dispatches backend-dev (Galleon) and frontend-dev (Clipper) as parallel background subagents
2. Reviews their evidence (diffs, test output, screenshots)
3. Sends QA (Corvette) for end-to-end tests
4. Sends the adversary (Xebec) on a hostile review pass
5. Gates every phase on passing success criteria

You'll see the dispatches and evidence in the opencode TUI. The Commodore comes back to
you (the Admiral) only for judgment calls — ambiguous decisions, permission overrides, or contract changes.

### 4. Resume if interrupted

Session crashed? No problem:

```bash
opencode                              # boots into the orchestrator
# It reads armada/state/active.json and reports:
# "Resume: feature X, phase 2, evidence in, next action Y."
```

Or from the CLI:

```bash
armada resume                         # drift list + resume line
armada status                         # where the fleet is right now
```

---

## Multi-feature work

Each feature is its own contract + state file. For true parallel isolation, use git worktrees:

```bash
armada feature new settings --worktree    # creates sandbox/settings + feat/settings branch
armada voyage sandbox/settings            # boots the lane in a tmux session
armada fleet                              # dashboard: one row per active lane
```

Features in separate worktrees cannot collide. Features in the same checkout rely on the
disjoint-files rule (each phase writes its own files).

### Steering live voyages with Tmux

Background voyages run inside dedicated `tmux` sessions ("ships"). As the Admiral, you are never locked out of an active run:

```bash
armada voyage sandbox/settings            # boots and auto-attaches terminal
tmux attach -t settings                   # attach to any session manually from any shell
```

While attached:
- Watch the Commodore dispatch specialists and run quality gates live
- Answer clarifying questions or approve contract adjustments on the fly
- Detach cleanly (`Ctrl+B` then `D`) at any time — the voyage continues running safely in the background

---

## Observability

```bash
armada status                         # active feature, phase, next action
armada status --json                  # machine-readable
armada fleet                          # cross-lane dashboard (all active lanes)
armada doctor                         # environment health check
armada resume                         # drift report after a crash
```

---

## Upgrade

```bash
npm install -g armada@latest
armada init --from-armada armada/armada.yaml   # re-scaffold from manifest
armada doctor                                  # verify
```

The re-scaffold merges armada-owned keys into `opencode.json` surgically — every other key
survives byte-for-byte.

---

## Teardown

```bash
armada uninstall                      # removes armada-owned files only
armada uninstall --all                # also removes generated AGENTS.md, opencode.json, contract
armada uninstall --dry-run            # preview what would be removed
```

---

## Next steps

- [Operator Manual](./using-armada.md) — the 11 commands in detail, full flag table, model catalog
- [Architecture](../ARCHITECTURE.md) — how armada works under the hood
- [Why armada?](./WHY.md) — the full narrative: problem, solution, proof
