# Commands Inventory

Fresh executable inventory for opencode-armada v0.9.2. Source: `package.json` + `src/cli.js` + live `armada help` output. No stale docs consulted.

## Binary entry

- `package.json:6-8` — `"bin": { "armada": "./src/cli.js" }`
- Entry point: `src/cli.js:1` (`#!/usr/bin/env node`)
- Main dispatch: `src/cli.js:135` (`main()`)
- Version: `src/cli.js:42` (`VERSION = "0.9.2"`)

## Canonical commands (11 active)

### 1. armada init

- Handler: `src/cli.js:139` (`case "init"` → `init(args)` at `src/cli.js:273`)
- Purpose: interactive or declarative setup, scaffolds team config
- Options: `--stack <s>`, `--budget <b>`, `--headless`, `--yolo`, `--supervision-plugin`, `--no-fleet-tracker`, `--watchdog`, `--requirements <file>`, `--target <dir>`, `--from-armada <file>`, `--restart`, `--no-browser`, `--yes`, `--dry-run`, `--help`
- Exit codes: 0 (ok), 1 (manifest not found/invalid, permissions)

### 2. armada new <name>

- Handler: `src/cli.js:154` (`case "new"` → `runNew()` at `src/new-command.js:125`)
- Purpose: create new project from curated starter template
- Options: `--type <c>` (category: web-app, ml-training, research-paper), `--beginner`, `--experienced`, `--yes`
- Exit codes: 0 (ok)

### 3. armada doctor

- Handler: `src/cli.js:143` (`case "doctor"` → `doctor()` at `src/cli.js:471`; checks in `src/doctor.js:82`)
- Purpose: environment health check (opencode, providers, dispatch, node, global armada, roster, supervision plugin, model drift)
- Options: none
- Exit codes: 0 (pass), 1 (any check failed)

### 4. armada status

- Handler: `src/cli.js:193` (`case "status"` → `statusCmd(args)` at `src/cli.js:795`; render from `src/status-cmd.js:126`)
- Purpose: feature status from armada/state (table by default)
- Options: `--json`, `--feature <name>`
- Exit codes: 0 (ok), non-zero on error (no state files)

### 5. armada fleet [session]

- Handler: `src/cli.js:172` (`case "fleet"` → `fleetCmd(args)` at `src/cli.js:752`; table from `src/fleet-cmd.js:24`)
- Purpose: per-lane progress dashboard (table by default)
- Options: `--json`, `--open`
- Exit codes: 0 (ok), 1 (session not found)

### 6. armada voyage <lane-path>

- Handler: `src/cli.js:174` (`case "voyage"` → `driveCmd(args, "voyage")` at `src/cli.js:602`; boots via `src/drive.js:52`)
- Purpose: boot lane session and send voyage prompt (TUI-ready handshake)
- Options: `--heartbeat`, `--name <s>`, `--prompt <text>`, `--timeout <ms>`, `--no-open`, `--no-track`, `--print-attach`, subcommand `attach <name>`
- Exit codes: 0 (ok), 1 (lane not found, timeout, session name invalid)

### 7. armada voyage-handoff <name> [<name>...]

- Handler: `src/cli.js:199` (`case "voyage-handoff"` → `voyageHandoffCmd(names)` at `src/cli.js:806`; format via `src/handoff.js:1`)
- Purpose: print handoff block for dispatched voyages
- Options: none
- Exit codes: 0 (ok), 1 (no names given)

### 8. armada feature new <name>

- Handler: `src/cli.js:166` (`case "feature"` → `featureCmd(args)` at `src/cli.js:814` → sub `"new"` at `src/cli.js:823`; creates via `src/feature-commands.js`)
- Purpose: create per-feature contract + register
- Options: `--worktree`, `--target <dir>`
- Exit codes: 0 (ok), 1 (name required, error)

### 9. armada feature list

- Handler: `src/cli.js:166` → `featureCmd(args)` → sub `"list"` at `src/cli.js:856`
- Purpose: list open/in-progress/shipped features
- Options: `--target <dir>`
- Exit codes: 0 (ok), 1 (error)

### 10. armada feature close <name>

- Handler: `src/cli.js:166` → `featureCmd(args)` → sub `"close"` at `src/cli.js:892`
- Purpose: verify evidence + mark shipped
- Options: `--remove` (remove worktree), `--target <dir>`
- Exit codes: 0 (ok), 1 (name required, error)

### 11. armada models [budget]

- Handler: `src/cli.js:141` (`case "models"` → `models(args)` at `src/cli.js:431`)
- Purpose: show curated model catalog
- Options: `--refresh`, `--list-openrouter`, `--cache <path>`, budget arg: `free`|`balanced`|`power`
- Exit codes: 0 (ok), 1 (refresh failed, permissions)

## Support commands

### armada help / -h / --help

- Handler: `src/cli.js:201-204` (also `--help` flag within `init()` at line 275)
- Purpose: print help text
- No exit code set (exits 0)

### armada --version / -v

- Handler: `src/cli.js:189-192`
- Purpose: print version to stdout
- Exit: 0

### armada resume

- Handler: `src/cli.js:168` (`case "resume"` → `resumeCmd(args)` at `src/cli.js:534`; delegates to `src/resume-cli.js:17`)
- Purpose: check for evidence drifts against contract (exit 2 if drifts)
- Options: `--json`, `--state-dir <p>`, `--repo <p>`, `--help`
- Exit codes: 0 (ok), 1 (error), 2 (drifts)

### armada uninstall

- Handler: `src/cli.js:145` (`case "uninstall"` → `uninstallCmd(args)` at `src/cli.js:497`)
- Purpose: remove armada-generated artifacts
- Options: `--all`, `--dry-run`, `--target <dir>`, `--from-armada <file>`
- Exit codes: 0 (ok), 1 (manifest parse error, permissions)

## Deprecated commands (alias, prints warning then calls canonical)

### armada drive <lane-path>

- Handler: `src/cli.js:176` — prints deprecation hint, calls `driveCmd(rest, "drive")`
- Purpose: alias for `armada voyage`; removed in v2.0
- Exit: always non-zero (deprecation)

### armada update

- Handler: `src/cli.js:147` — prints deprecation hint, calls `init(rest)`
- Purpose: deprecated; use `armada init --from-armada --restart`

### armada preset <name>

- Handler: `src/cli.js:179` — prints deprecation hint, forwards to `init(["--budget", name])`
- Purpose: deprecated; use `armada init --budget <name>`

### armada feature status [name]

- Handler: `src/cli.js:166` → `featureCmd(args)` → sub `"status"` at `src/cli.js:914`
- Purpose: deprecated; use `armada status --feature <name>`
- Exit: always non-zero (deprecation)

### armada reconcile

- Handler: `src/cli.js:170` (`case "reconcile"` → `reconcileCmd(args)` at `src/cli.js:548`)
- Purpose: deprecated alias for `armada resume`; removed in v2.0
- Exit: always non-zero (deprecation)

## Removed commands (exits 1 with hint)

### armada ping

- Handler: `src/cli.js:150` — prints error + hint, exits 1
- Replaced by: `armada help`

### armada scout

- Handler: `src/cli.js:195` — prints error + hint, exits 1
- Replaced by: `/armada-scout` inside opencode TUI

## Hidden commands

### armada reconcile

- Present in switch (`src/cli.js:170`) but NOT listed in help text
- Always exits non-zero with deprecation message
- Invokes `resumeMain()` via `reconcileCmd()`

## No-command (bare armada)

- `src/cli.js:204` — `undefined` case falls through to `help`, prints HELP text
- Exit: 0

## Unknown command

- `src/cli.js:208` — default case prints "Unknown command: {cmd}" + help, exits 1

## npm scripts

From `package.json:20-26`:

| Script | Line | Command | Purpose |
|--------|------|---------|---------|
| `start` | 21 | `node src/cli.js` | Run CLI directly |
| `dev` | 22 | `node src/cli.js` | Alias for start |
| `test` | 23 | `node --test 'tests/*.test.js'` | Run full test suite |
| `test:smoke` | 24 | `node --test 'tests/smoke/*.test.js'` | Smoke tests (needs OpenRouter) |
| `test:node` | 25 | `node --test 'tests/*.test.js'` | Alias for test |
| `prepublishOnly` | 26 | `node --test 'tests/*.test.js'` | Test gate before publish |

## Package metadata

From `package.json`:

- Name: `opencode-armada` (`package.json:2`)
- Version: `0.9.2` (`package.json:3`)
- Engine: `node >= 20` (`package.json:29`)
- Dependency: `yaml ^2.9.0` (`package.json:42`; sole runtime dep)
- Files shipped: `src`, `template`, `starter`, `agents`, `presets`, `docs` (`package.json:15`)

## Key observations

1. `reconcile` — hidden command, not in help text but in switch; always exits non-zero
2. `drive` — deprecated alias, always exits non-zero even when successful
3. `feature status` — deprecated alias, always exits non-zero
4. `preset` — deprecated, runs full init scaffold before printing deprecation hint
5. `update` — deprecated, runs full init scaffold before printing deprecation hint
6. `ping`/`scout` — removed commands, still in switch, exit 1 with hint
7. `new --help` — treated `--help` as project name; creates `--help/` directory (defect)
8. npm `start` and `dev` are identical aliases
9. npm `test` and `test:node` are identical aliases

## Evidence checks

- [x] `node src/cli.js help` — prints 11 active commands + deprecated/removed sections; exit 0
- [x] `node src/cli.js --version` — prints `opencode-armada v0.9.2`; exit 0
- [x] `node src/cli.js -v` — same output as `--version`; exit 0
- [x] `node src/cli.js -h` — prints same help as `help`; exit 0
- [x] `node src/cli.js init --help` — prints same help (intercepted by init handler at line 275); exit 0
- [x] `node src/cli.js ping` — prints "removed" hint; exit 1
- [x] `node src/cli.js scout` — prints "removed" hint; exit 1
- [x] `node src/cli.js drive --help` — prints deprecation hint + help; exit 1
- [x] `node src/cli.js reconcile --help` — prints deprecation hint; exit 1
- [x] `node src/cli.js feature status test` — prints deprecation hint; exit 1
- [x] `node src/cli.js unknown-cmd` — prints "Unknown command" + help; exit 1
- [x] All handler file:line references verified against `src/cli.js` grep output
