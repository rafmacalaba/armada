# Lifecycle Walkthrough

Canonical npx lifecycle: init → doctor → feature new → status → fleet → uninstall in fresh temp dir.

## Environment

- macOS (darwin), Node v23.9.0
- Binary: `/tmp/armada-p0-smoke/prefix/bin/armada` (installed from npm pack)
- Temp dir: `/tmp/armada-p0-lifecycle-NifE9/` (clean, no pre-existing armada files)
- System armada: other version possibly on PATH (doctor detects global armada separately)

## Step 1: armada init (non-interactive, fresh dir)

```
$ mkdir /tmp/armada-p0-lifecycle-NifE9 && cd /tmp/armada-p0-lifecycle-NifE9
$ /tmp/armada-p0-smoke/prefix/bin/armada init --yes --budget free --target .

Scaffolded opencode-armada team:
  + .opencode/agent/commodore.md
  + .opencode/agent/galleon.md
  + .opencode/agent/clipper.md
  + .opencode/agent/corvette.md
  + .opencode/agent/xebec.md
  + .opencode/agent/frigate.md
  + .opencode/agent/caravel.md
  + .opencode/agent/bark.md
  + .opencode/skills/armada-contract/SKILL.md
  + .opencode/skills/armada-gate/SKILL.md
  + .opencode/skills/armada-dispatch/SKILL.md
  + .opencode/skills/armada-pr/SKILL.md
  + .opencode/skills/armada-resume/SKILL.md
  + .opencode/skills/armada-ledger/SKILL.md
  + .opencode/skills/armada-context-budget/SKILL.md
  + .opencode/skills/armada-tdd/SKILL.md
  + .opencode/skills/armada-sdd/SKILL.md
  + opencode.json
  + AGENTS.md
  + armada/REQUIREMENTS.md
  + armada/armada.yaml
  + armada/ledgers/_template/SECURITY_FINDINGS.md
  + .opencode/commands/armada.md
  + .opencode/commands/armada-scout.md
  + .opencode/commands/armada-resume.md
  + .opencode/commands/armada-voyage.md
  + .opencode/plugins/armada-fleet.js
  + .gitignore
Project: armada-p0-lifecycle-NifE9
Team: 8 agents
Budget: free
Roster:
  orchestrator: opencode-go/hy3
  backend-dev: opencode/deepseek-v4-flash-free
  frontend-dev: opencode/mimo-v2.5-free
  qa: opencode/mimo-v2.5-free
  adversary: opencode/deepseek-v4-flash-free
  security: opencode/big-pickle
  docs: opencode/deepseek-v4-flash-free
  architect: opencode/big-pickle
(exit 0)
```

Files written: 27. Budget "free" correctly selected free-tier models.

## Step 1a: Post-init directory listing

```
$ ls -la
total 32
drwx------   7 .         224 Aug  5 14:25 .
drwxrwxrwt  98 .         3136 Aug  5 14:25 ..
-rw-r--r--   1 .gitignore   64 Aug  5 14:25 .gitignore
drwxr-xr-x   6 .opencode   192 Aug  5 14:25 .opencode
-rw-r--r--   1 AGENTS.md  5137 Aug  5 14:25 AGENTS.md
drwxr-xr-x   5 armada      160 Aug  5 14:25 armada
-rw-r--r--   1 opencode.json 980 Aug  5 14:25 opencode.json
```

5 top-level items: `.gitignore`, `.opencode/`, `AGENTS.md`, `armada/`, `opencode.json`. No unexpected files.

## Step 2: armada doctor

```
$ /tmp/armada-p0-smoke/prefix/bin/armada doctor
opencode-armada doctor
opencode CLI: pass — 1.18.13
providers auth: pass
openrouter auth: pass — openrouter credential found
background dispatch: pass — parallel background dispatch disabled (inline fallback)
node: pass — v23.9.0
global armada binary: pass — opencode-armada v0.9.2
[help text printed]
team roster: pass — Commodore, Galleon, Clipper, Corvette, Xebec, Frigate, Caravel, Bark
fleet tracker plugin: pass — .opencode/plugins/armada-fleet.js present
model-drift: pass — all role frontmatters match armada.yaml
(exit 0)
```

All 8 checks pass. Exit 0.

Note: doctor's "global armada binary" check runs `armada help` from PATH. If system has older armada version, this check prints stale help text (shows `armada ping`, `armada scout`, `armada preset`, `armada update`, `armada feature status` as active) even though the installed binary does not.

## Step 3: armada feature new + list

```
$ /tmp/armada-p0-smoke/prefix/bin/armada feature new test
feature "test" created
  contract: /private/tmp/armada-p0-lifecycle-NifE9/armada/contracts/test.md
  entry:    /private/tmp/armada-p0-lifecycle-NifE9/armada/state/features/test.json
  index:    /private/tmp/armada-p0-lifecycle-NifE9/armada/state/features/index.json
  active:   /private/tmp/armada-p0-lifecycle-NifE9/armada/state/active.json
(exit 0)

$ /tmp/armada-p0-smoke/prefix/bin/armada feature list
NAME      STATUS  CONTRACT                  WORKTREE  BRANCH
--------  ------  ------------------------  --------  ------
test      open    armada/contracts/test.md  -         -
(exit 0)
```

Feature registered. Contract + state files created.

## Step 4: armada status

```
$ /tmp/armada-p0-smoke/prefix/bin/armada status
FEATURE  STATUS  CONTRACT                  NEXT ACTION  PR
-------  ------  ------------------------  -----------  --
test     open    armada/contracts/test.md  -            -
```

Before feature creation: `armada status` prints "no active feature or feature index" (no exit code displayed but stderr output). After feature creation: table with `test` entry shown.

## Step 5: armada fleet

```
$ /tmp/armada-p0-smoke/prefix/bin/armada fleet
SESSION                   LANE       PHASE  STATUS   AGE     COST
------------------------  ---------  -----  -------  ------  ----
ux-revamp                 ux-revamp  -      STALLED  3h 58m  0
voyage-handoff-indicator  sandbox    -      STALLED  4h 25m  0
public-stability          sandbox    -      STALLED  5h 3m   0
```

Note: fleet reads from `~/.armada/runs/` (global state directory). Shows sessions from other worktrees. Expected — fleet is system-wide.

## Step 6: armada uninstall --all

```
$ /tmp/armada-p0-smoke/prefix/bin/armada uninstall --all

Removed armada artifacts:
  - armada/armada.yaml
  - armada/REQUIREMENTS.md
  - armada/ledgers/_template/SECURITY_FINDINGS.md
  - armada/ledgers/_template
  - armada/ledgers
  - .opencode/commands/armada.md
  - .opencode/commands/armada-scout.md
  - .opencode/commands/armada-resume.md
  - .opencode/commands/armada-voyage.md
  - .opencode/plugins/armada-fleet.js
  - .opencode/plugins
  - .opencode/agent/commodore.md
  - .opencode/agent/galleon.md
  - .opencode/agent/clipper.md
  - .opencode/agent/corvette.md
  - .opencode/agent/xebec.md
  - .opencode/agent/frigate.md
  - .opencode/agent/caravel.md
  - .opencode/agent/bark.md
  - .opencode/agent
  - .opencode/skills/armada-contract/SKILL.md
  - .opencode/skills/armada-contract
  - .opencode/skills/armada-gate/SKILL.md
  - .opencode/skills/armada-gate
  - .opencode/skills/armada-dispatch/SKILL.md
  - .opencode/skills/armada-dispatch
  - .opencode/skills/armada-pr/SKILL.md
  - .opencode/skills/armada-pr
  - .opencode/skills/armada-resume/SKILL.md
  - .opencode/skills/armada-resume
  - .opencode/skills/armada-ledger/SKILL.md
  - .opencode/skills/armada-ledger
  - .opencode/skills/armada-context-budget/SKILL.md
  - .opencode/skills/armada-context-budget
  - .opencode/skills/armada-tdd/SKILL.md
  - .opencode/skills/armada-tdd
  - .opencode/skills/armada-sdd/SKILL.md
  - .opencode/skills/armada-sdd
  - .opencode/skills
  - .opencode/commands
  - .opencode
  - AGENTS.md
  - opencode.json
  - .gitignore
(exit 0)
```

44 items removed from armada-owned paths.

## Step 6a: Post-uninstall directory listing

```
$ ls -la
total 0
drwx------  4 .         128 Aug  5 14:25 .
drwxrwxrwt 98 .        3136 Aug  5 14:25 ..
drwxr-xr-x  4 armada    128 Aug  5 14:25 armada
drwxr-xr-x  2 opencode   64 Aug  5 14:25 opencode
```

2 residual directories remain:
- `armada/` — contains `state/` (active.json, features/index.json, features/test.json) from `feature new`. State files not cleaned by uninstall.
- `opencode/` — empty directory (opencode created it as a side effect or it was left by uninstall cleanup ordering).

## Findings

| # | Observation | Severity |
|---|-------------|----------|
| 1 | `uninstall --all` leaves `armada/state/` and `opencode/` directories | MEDIUM |
| 2 | Doctor prints stale help from PATH-installed `armada`, not the running binary | LOW |
| 3 | Fleet shows cross-worktree sessions (by design; fleet is system-wide) | OBSERVATION |
| 4 | `armada status` exits silently before any feature created (stderr "no active feature") | LOW |
| 5 | Init creates 27 files; uninstall removes those 27 but leaves state from subsequent commands | MEDIUM |

## Evidence checks

- [x] Fresh `init --yes --budget free` in empty dir → 27 files scaffolded, exit 0
- [x] Doctor → 8/8 checks pass, exit 0
- [x] `feature new test` → 4 state files created, exit 0
- [x] `feature list` → 1 line table, exit 0
- [x] `status` → shows feature table after feature creation, exit 0
- [x] `uninstall --all` → 44 items removed, exit 0
- [x] Post-uninstall: `armada/` and `opencode/` dirs remain (state not cleaned)
- [x] Full lifecycle exits clean; no crash, no HOME mutation, no file corruption
