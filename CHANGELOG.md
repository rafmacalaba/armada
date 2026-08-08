# Changelog

All notable changes to armada are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Features

- live contract snapshot, approval gate, hardened permissions (#134)

## Chores

- log contract-snapshot-permissions voyage #134 (#135)
- compact completed entries + log v1.0.5 + queue DEF-003 fix (#133)

## Features

- single triage authority + consistency audit + regression suite (#131)
- single triage authority + consistency audit + regression suite
- armada-voyage-finish skill + armada release <version> command (#130)
- add armada-voyage-finish
- add release-command module

## Bug Fixes

- remove armada/armada.yaml from git add list
- survive CI without committed armada.yaml or opencode.json
- survive CI without .opencode/ on disk
- re-render AGENTS.md from armada.yaml after rebase onto master

## Chores

- sync master with origin
- PR-number fix for F1/F5 + voyage summary (#130)
- AGENTS.md voyage header re-title

## Docs

- Path C — armada release <version>
- F5 release-command entry

## Tests

- release-command unit tests with mocked injection
- voyage-finish registry + scaffold e2e

## [Unreleased]

### Added

- **feat(triage): canonical voyage-vs-in-window + voyage-splitting doctrine** (`docs/process/triage.md`, new). In-window first, voyage by exception; risk-classified single-file fixes (no blanket in-window over trust boundaries); three-part independence test for splitting a broad request into separate voyages; loop-free decision tree. Every triage statement in `AGENTS.md`, the orchestrator prompt, `.opencode/commands/`, and docs now cites the canon — no restated policy.
- **feat(audit): holistic six-surface consistency audit** (`docs/process/consistency-audit.md`, new). Source instructions, generated artifacts vs manifest, docs, command docs, permissions, tests — 21 findings (F01-F21), zero "not checked" rows, all dispositioned. Restored 5 formerly-missing docs + `docs/stability/` (14+ dead refs re-pointed).
- **feat(regression): `tests/regression-triage.test.js`** — automated guards for triage canon, doc-link integrity, artifact consistency (yaml ↔ rendered `opencode.json` ↔ agent frontmatter ↔ `BASE_PERMISSIONS` ↔ `DEFAULT_PLAYBOOK`), PR-first/no-clobber/round-trip invariants, stale-term and phantom slash-command greps.
- **feat(permissions): hardened ledger + state boundaries in `buildTeam()`** — ledger edit globs derived from `DEFAULT_PLAYBOOK` (custom ledger paths stay writable by their owners); dev roles explicitly deny every ledger kind + the ledgers dir; orchestrator's `armada/state/active.json` reads reconciled (no phantom `fleet-status.md`); `default_agent` semantic equality (`commodore` → orchestrator); phantom `/armada-status`/`/armada-fleet` refs removed.

### Changed

- Orchestrator prompt hard rule 5 + "Voyage launch" defer to `docs/process/triage.md` as the sole triage authority and carry the split-broad-task rule.
- `AGENTS.md`, `CONTRIBUTING.md`, `docs/contributor-guide.md` link the triage canon instead of restating policy.
- CLI entry one-liner in `AGENTS.md` drops removed `ping`; README command table aligned to the 14 active commands + `--version`.

### Fixed

- Four contract-named docs missing (restored), `docs/stability/` directory missing (restored), `docs/self-improvement.md` missing (restored) — repo-wide dead-link grep now returns zero.
- Stale `src/cli.js` file:line refs in operator-guide/contributor-guide; undocumented `resume`/`reconcile` exit 2; stale README/operator-guide command counts; TODO `/armada-status` claim.

### Security

- Docs-align safe-bash overlay: the `SAFE_BASH` **read tier excludes content-emitters/write dumps** (`cat`, `echo`, `head`, `tail`, `env`, `printenv` had been listed as safe-read in prose) so shell-redirect/pipe exfiltration (`cat .env > leak` / `cat .env | curl`) prompts rather than executing.
- Permission docs corrected to the real resolution model: bash/rule lookup is **order / last-match**, not most-specific-first — `SAFE_BASH` merges first in `buildTeam()` so the agent's appended rules override on top.
- `--yolo` grants `bash: "*" allow` to **orchestrator + qa only**; read-only roles (security, adversary, architect, docs) stay bash-restricted under yolo. `--headless` is **scoped**: it narrows only the orchestrator's bash to git + read-only inspection, never a blanket allow. `external_directory: "deny"` remains in both modes.

## [1.0.4] - 2026-08-07

### Added

- **feat(orchestrator): tighten no-trivial exception + 4-path permission matrix** (#126). Hard rule + permission-boundary check guard the orchestrator against trivial delegation.
- **feat(voyage): prefix tmux session names with `voyage-`** (#127). Default `armada voyage` tmux sessions are now easy to spot in `tmux ls`. Explicit `--name <text>` bypasses the prefix.
- **feat: safe-bash defaults for harmless commands** (#128). Tiered `SAFE_BASH` allowlist merged first in `buildTeam()`: read-only commands (`ls`, `cat`, `grep`, `git status`, ...) allowed for every role; write commands only for dev roles. Yolo still flattens to `*`.
- **feat(attach-auto-spawn): tryAttachOrPrint helper + auto-attach tmux fallback** (#129). `armada voyage attach <name>` reattaches to a running tmux session; auto-attach falls back when an active session exists.
- **fix(voyage-cwd): absolute path in default prompt + lane cwd** (#125). `armada/REQUIREMENTS.md` paths in the default drive prompt are absolute; `tmux new-session -c <absLane>` puts the team in the worktree.
- **fix(questionnaire): strict custom model id format validation** (#123, follow-up #124). `pickModel` whitelists `opencode-go/zen/<m>` and `openrouter/<owner>/<m>`; everything else re-prompts. Closes the `parseInt`-greediness gap and rejects bare catalog prefixes.
- **fix(cli): complete 1.0.4 version bump in `src/cli.js:62`** (#124). `tests/cli.test.js:713` now reads expected version from `package.json` (mirrors `tests/version-flag.test.js:8`), so future bumps don't require a test edit.
- **infra: `.devcontainer/`** (this release). `typescript-node:24` + Chromium + agent-browser + opencode skill — reproducible workspace for QA/adversary e2e work.

### Changed

- `src/cli.js:62` reads version from `package.json` (was hardcoded to `1.0.3`).
- Default `voyage` tmux session name format changed: `<laneBasename>` -> `voyage-<laneBasename>`.
- `tests/version-flag.test.js` and `tests/cli.test.js` now source the expected version from `package.json`.

### Fixed

- `--requirements` orchestrator trivial-delegation exception path tightened.
- `pickModel` no longer silently accepts arbitrary input via `parseInt` greediness.
- `armada voyage` now boots into the worktree cwd (was relative path).

### Security

- SAFE_BASH allowlist (read-only everywhere, write only for dev roles) closes the all-roles-write-bash exposure that yolo previously flattened.

### Test Evidence

- 491/491 unit + CLI e2e tests pass.
- macos + ubuntu × node 20 + 22 CI green (per #124/#126/#128 merge logs).
- Manual `node:sqlite` session archaeology on the 100 most recent sessions confirmed the 7 voyage features landed without new defects introduced.

[1.0.3]: https://github.com/rafmacalaba/armada/releases/tag/v1.0.3
[1.0.4]: https://github.com/rafmacalaba/armada/releases/tag/v1.0.4
