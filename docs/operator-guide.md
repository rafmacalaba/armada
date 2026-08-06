# Operator guide

Install, upgrade, uninstall, rollback, and the full CLI reference. This is the day-to-day
manual; [user-guide.md](./user-guide.md) is the quickstart.

## Requirements

- Node.js >= 20 (`package.json:29`). Older runtimes are not supported.
- opencode CLI installed and on PATH — `armada doctor` verifies it (`src/doctor.js:86-91`).
- A provider credential: OpenCode Go by default (free tier available); OpenRouter optional
  for power-tier models. See [auth-and-cost.md](./auth-and-cost.md).
- The only runtime dependency of the armada package itself is `yaml` (`package.json:42`).

## Install

Two equivalent ways to get the `armada` binary:

```bash
npm install -g @rafmacalaba/armada    # global install; bin is `armada`
npx @rafmacalaba/armada <command>     # no install; package has a single bin, npx uses it
```

Verify:

```bash
armada --version      # print installed version
armada doctor         # all checks pass
```

The published package ships `src`, `template`, `starter`, `agents`, `presets`, `docs`
(`package.json:12-19`). The npm pack smoke (P0) confirmed the tarball installs to an isolated
prefix and the `armada` bin runs (`docs/stability/P0/npm-pack-smoke.md`).

## Upgrade

Two steps:

1. Upgrade the package:

   ```bash
   npm install -g @rafmacalaba/armada@latest
   ```

2. Re-scaffold each armed repo from its manifest:

   ```bash
   cd your-repo
   armada init --from-armada armada/armada.yaml --restart
   ```

   `--restart` forces the re-scaffold: armada-owned files (`armada.yaml`, `.opencode/`,
   `opencode.json`) are regenerated from the manifest, and the armada section of `AGENTS.md`
   is marker-merged in place (`src/scaffold.js:360-401`). User content outside the
   `<!-- armada:start -->` / `<!-- armada:end -->` block in `AGENTS.md` is preserved;
   `REQUIREMENTS.md` is never overwritten once it exists. Manual edits to `opencode.json`
   outside the manifest are not carried over — put them in `armada.yaml` instead.

3. Re-verify: `armada doctor`.

If `armada/armada.yaml` is missing, run `armada init` first, then upgrade.

## Changing models or provider

Models live in three places:

- `opencode.json` top-level `model`
- `.opencode/agent/<role>.md` per-role `model:` frontmatter
- `provider.openrouter.models` (or other provider blocks) in `opencode.json`
  (`src/generator.js:202-238`, `docs/auth-and-cost.md:116`)

How to change:

1. Edit `armada.yaml` per-role `model:` / `fallback:` — recommended; the manifest is the
   source of truth.
2. Hand-edit `opencode.json` `provider.<x>.models` (or a `provider.<x>` block) for a
   provider switch.
3. Hand-edit `.opencode/agent/<role>.md` `model:` frontmatter for a one-off tweak.

opencode reads these files on session start; there is no live reload on session exit.
Changes take effect on the next `opencode` launch in the repo. If the project is on a
manifest, run `armada init --from-armada armada/armada.yaml --restart` first (see the
[Upgrade](#upgrade) flow above); user-owned `opencode.json` keys are preserved by
`mergeOpenCodeJson` (`src/generator.js:240-260`). No daemon to restart, no env to export.

Example — switch openrouter to opencode-go/zen: set the provider block in `armada.yaml`,
re-run `armada init --restart`. armada owns only `provider.openrouter` under `provider`
(`src/generator.js:291-306`); a hand-added `provider.zen` block is not in the owned-key
set and is preserved across re-scaffolds.

## Rollback

1. Install the previous version:

   ```bash
   npm install -g @rafmacalaba/armada@0.9.2  # or whatever the previous release was
   ```

2. Re-scaffold: `armada init --from-armada armada/armada.yaml --restart` (as above).
3. `armada doctor` to confirm the older binary is consistent with the manifest.

Version compatibility: the manifest schema is backward-compatible across the current 0.x line;
`armada init --from-armada` validates the manifest (`src/cli.js:310-316`) and fails with a
clear parse error if it cannot read it.

## Uninstall

```bash
armada uninstall                       # armada-owned files only
armada uninstall --all                 # also AGENTS.md, opencode.json, armada/state
armada uninstall --dry-run             # print what would be removed
armada uninstall --target <dir>        # operate on a different repo root
armada uninstall --from-armada <file>  # read ownership from a specific manifest
```

What uninstall removes by default (`src/scaffold.js:479-554`):

- `armada/armada.yaml`, the requirements file (default `armada/REQUIREMENTS.md`), the
  SECURITY_FINDINGS template, and `armada/state/` only with `--all`
- `.opencode/commands/` (4 files), `.opencode/plugins/` (3 plugin files),
  `.opencode/agent/` (8 ship-named files), `.opencode/skills/` (9 skill files)
- the managed `.gitignore` block, and `.devcontainer/` when the manifest enables it

Never removed: user files. If `.opencode/` still contains non-armada files after cleanup it
is left in place with a warning (`src/scaffold.js:527-539`). `opencode.json` and `AGENTS.md`
are removed only with `--all` (`src/scaffold.js:545-549`).

## CLI reference

All 12 commands plus the documented alias. Every flag below is implemented in `src/cli.js`
(the dispatch switch is `src/cli.js:139-221`). Note: `armada <cmd> --help` prints the same
global help block; the canonical reference is this table.

| Command | Flag | Meaning |
|---|---|---|
| `armada init` | `--stack <hint>` | overlay stack tokens (nextjs, fastapi, postgres, ...) |
| | `--budget <free\|balanced\|power>` | budget tier (selects per-role models) |
| | `--from-armada <file>` | regenerate from manifest |
| | `--requirements <file>` | contract file (default `armada/REQUIREMENTS.md`) |
| | `--target <dir>` | scaffold into a directory (default cwd) |
| | `--yes` | non-interactive defaults |
| | `--yolo` | autonomous: `permission: { "*": "allow" }`, no permission prompts |
| | `--headless` | CI-safe: orchestrator bash allowed (for `opencode run`) |
| | `--dry-run` | print files without writing |
| | `--no-browser` | disable browser testing + agent-browser flags |
| | `--restart` | force re-scaffold; overwrites armada-owned files, preserves user files |
| | `--supervision-plugin` | opt-in supervision plugin (`armada-supervision.js`) |
| | `--no-fleet-tracker` | opt out of the default-on fleet-tracker plugin |
| | `--watchdog` | opt-in subagent watchdog plugin |
| `armada new <name>` | — | interactive questionnaire (6 categories); non-TTY defaults to `blank` |
| | `--blank` | skip questionnaire, use `blank` template |
| | `--template <url\|path>` | external Cookiecutter template (git URL or local path) |
| | `--config <file.json>` | vars from JSON (overrides prompts) |
| | `--yes` | skip prompts |
| `armada doctor` | — | |
| `armada status` | `--json` | machine output |
| | `--feature <name>` | one feature's row |
| `armada fleet [session]` | `--json` | machine output |
| | `--open` | open the dashboard in a terminal window |
| `armada voyage <lane>` | `--name <session>` | tmux session name (default: lane basename) |
| | `--prompt <text>` | drive prompt (default: the standard voyage prompt) |
| | `--timeout <ms>` | TUI-ready timeout (default 30000) |
| | `--no-open` | skip auto-attach |
| | `--no-track` | skip fleet-tracker recording |
| | `--print-attach` | print the attach command instead of booting |
| | `--heartbeat` | keep the fleet entry fresh (30s heartbeat) |
| | `attach <name>` | subcommand: print the attach command for a session |
| `armada voyage-handoff <name> [<name>...]` | — | print handoff block for roles |
| `armada feature` | `new <name>` | create contract + state, set active |
| | `new <name> --worktree` | isolate in a git worktree |
| | `list` | all features (table) |
| | `close <name>` | evidence-gated close |
| | `close <name> --remove` | also remove the worktree |
| | `--target <dir>` | operate on a different repo root (new/list/close) |
| `armada models` | `[budget]` | catalog for `free`/`balanced`/`power` (default balanced) |
| | `--refresh` | merge live provider availability into the cache |
| | `--cache <path>` | custom cache path for `--refresh` |
| | `--list-openrouter` | live OpenRouter model list |
| `armada resume` | `--json` | raw resume plan as JSON |
| | `--state-dir <path>` | read state from `<path>` (default `<repo>/armada/state`) |
| | `--repo <path>` | repo root for contract + evidence paths (default cwd) |
| `armada uninstall` | `--all` | also AGENTS.md, opencode.json, armada/state |
| | `--dry-run` | print what would be removed |
| | `--target <dir>` | operate on a different repo root |
| | `--from-armada <file>` | read ownership from a specific manifest |
| `armada help` | — | usage; `armada --version` for the version |
| `armada reconcile` | (alias for resume) | same flags as resume |

### Deprecated aliases (exit 1, removed in v2.0)

| Alias | Canonical |
|---|---|
| `armada drive <lane>` | `armada voyage <lane>` |
| `armada update` | `armada init --from-armada --restart` |
| `armada preset <name>` | `armada init --budget <name>` |
| `armada feature status [name]` | `armada status --feature <name>` |

Each prints a deprecation hint on stderr, runs the underlying action, and exits non-zero
(`src/cli.js:147-201`; behavior verified in P1, `docs/stability/P1/aliases-audit.md`).

### Removed commands

- `armada scout` — removed; use `/armada-scout` inside the opencode TUI.
- `armada ping` — removed; use `armada help` to confirm the binary works.

Both now report "Unknown command" (P1 removed the switch branches) but remain listed in the
help text for discoverability (`src/cli.js:87-89`).

## Exit codes

| Command | 0 | 1 | 2 |
|---|---|---|---|
| `armada init` | ok | manifest not found/invalid, permission error | — |
| `armada new` | ok | missing name, unknown category, dir exists | — |
| `armada doctor` | all checks pass | any check failed (`src/cli.js:504`) | — |
| `armada status` | ok | no state files / error | — |
| `armada fleet` | ok | session not found | — |
| `armada voyage` | ok | lane not found, timeout, invalid session name | — |
| `armada voyage-handoff` | ok | no names given | — |
| `armada feature` | ok | name required, error | — |
| `armada models` | ok | refresh/cache failure | — |
| `armada resume` | no drift | error | evidence drifts reported |
| `armada reconcile` | no drift | error | evidence drifts reported |
| `armada uninstall` | ok | manifest parse error, permission error | — |
| deprecated aliases | — | always (deprecation) | — |
| `armada help` | ok | — | — |

## File ownership

| Path | Owner | Written |
|---|---|---|
| `armada.yaml` | armada | always (re-written) |
| `.opencode/` (agents, commands, skills, plugins) | armada | always (re-written) |
| `opencode.json` | armada | only if absent, unless `--restart` (`src/scaffold.js:360-364`) |
| `AGENTS.md` | armada + user | marker-merged: armada section replaced in place, user content preserved (`src/scaffold.js:366-391`) |
| `REQUIREMENTS.md` | user | only if absent (`src/scaffold.js:393-398`) |
| `armada/state/`, `armada/ledgers/`, `armada/e2e/`, `armada/screenshots/` | fleet (runtime) | written by the fleet, not the scaffolder |
| `.gitignore` | armada + user | managed block appended, marker-based, removed on uninstall |

## State and run storage

- Repo state: `armada/state/active.json` + `armada/state/features/` index
  (`src/status-cmd.js:23-24`).
- Fleet run store: `~/.armada/runs/`, overridable with `$ARMADA_RUNS_DIR`
  (`src/fleet-tracker.js:193`).
- Models availability cache: `~/.armada/models.cache.json` (`src/model-catalog.js:116-118`),
  overridable with `armada models --refresh --cache <path>`.

## Fleet tracker plugin (default-on)

The fleet-tracker plugin (`armada-fleet.js`) is written by default; opt out with
`armada init --no-fleet-tracker` (`src/scaffold.js:420-423`). It records per-lane run
heartbeats so `armada fleet` shows live progress and marks lanes STALLED after 2 minutes
without a heartbeat. The supervision (`--supervision-plugin`) and watchdog (`--watchdog`)
plugins remain opt-in (`src/cli.js:345-359`). `armada doctor` reports plugin presence
(`src/doctor.js:184-219`).

## See also

- [user-guide.md](./user-guide.md) — quickstart and one-example-per-command reference
- [auth-and-cost.md](./auth-and-cost.md) — providers, budgets, rate limits, recovery
- [troubleshooting.md](./troubleshooting.md) — common errors and canonical fixes
- [support.md](./support.md) — where to ask and file
- [RELEASING.md](./RELEASING.md) — cutting a release
- [contributor-guide.md](./contributor-guide.md) — developing armada itself

## Self-check

Files read to verify every claim:

- `src/cli.js` (949 lines) — dispatch switch (139-221), HELP (44-90), flag parsing for
  init/new/doctor/voyage/fleet/feature/models/resume/uninstall, exit codes.
- `src/scaffold.js` (556 lines) — ownership (360-401), plugins (415-428), devcontainer
  (430-438), gitignore block (440-444), uninstall surface (449-556).
- `src/doctor.js` (226 lines) — check list (82-225).
- `src/status-cmd.js:23-24`, `src/fleet-tracker.js:193`, `src/model-catalog.js:116-118` —
  state paths (referenced via P0 evidence).
- `package.json` — version, engines, bin, files, dependencies.
- `docs/stability/P0/npm-pack-smoke.md` — packed install + bin verified.
- `docs/stability/P1/aliases-audit.md` + `docs/stability/P1/exec-summary.md` — alias and
  exit-code behavior changed in P1.
- `docs/stability/P0/commands-inventory.md` — cross-checked; superseded where P1 changed
  behavior (reconcile exit codes, ping/scout removal).

Verdict: PASS — install, upgrade, rollback, uninstall, flag table, exit codes, and ownership
all match current source.
Date: 2026-08-05.
