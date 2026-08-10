# Changelog

All notable changes to armada are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Features

- add armada models --discounts flag to inspect live OpenRouter provider pricing and discounts (#167)
- add openrouter provider routing preference and real-time endpoint pricing API helper (v1.2.8) (#166)
- bump version to 1.2.7 - execution-only subagent architecture & task spec template (#165)

## Bug Fixes

- voyage-handoff uses correct tmux session names; reject voyage- prefixed feature names (#169)
- doc/about links use master (default branch); harden smokes against branch drift (#158)

## Docs

- log voyage-handoff fix (#169) (#170)
- add OpenRouter discounted models and provider ordering guide (#168)
- update logo file path to docs/logo-v2.png to guarantee fresh rendering on GitHub (#164)
- add cache buster to logo image URL for GitHub proxy (#163)
- overhaul README with loop engineering positioning, clean docs, update logo, and expand topics (#162)
- restore brand voice, workflow.png, setup steps, contract co-writing (#161)
- gateway rewrite — lead with the loop, point to website for depth (#160)
- lean rewrite, fix broken site image, clarify site is informational (#159)
- log web polish voyage #155 (#156)

## [1.2.6] - 2026-08-09

### Fixed

- Voyage sandbox lanes now automatically initialize in autopilot mode (`yolo: true`) since the contract has already been created/approved for that sandbox, avoiding interactive bash permission prompts while keeping strict subagent edit role boundaries.
- Main Commodore orchestrator base permissions now auto-allow read-only inspection commands (`ls*`, `cat*`, `find*`, `pwd`, `read*`, `echo*`, `git branch*`, `git rev-parse*`) by default.

## [1.2.5] - 2026-08-09

### Fixed

- Existing live contracts (`armada/REQUIREMENTS.md` or configured `requirementsFile`) are now preserved and copied from main checkout into sandbox worktrees during voyage creation instead of being overwritten by empty stub templates.
- Added fallback contract synchronization for voyages launched without an active `contract-approval.json` gate.

## [1.2.4] - 2026-08-09

### Fixed

- Voyage lanes now re-scaffold Armada-owned files from the main manifest, ensuring `.opencode/agent/commodore.md` and related skills exist even when initial `armada new` files were not committed.

## [1.2.3] - 2026-08-09

### Fixed

- Voyages now create and use canonical `sandbox/<name>/armada/REQUIREMENTS.md` contracts instead of leaving only an unused `armada/contracts/<name>.md` placeholder.
- Voyage registry, active state, close flow, and fleet discovery now reference the same canonical contract.

## [1.2.2] - 2026-08-09

### Fixed

- Custom `project.requirementsFile` contracts now flow through approval, hashing, gating, and voyage snapshots without falling back to a generated stub.
- Voyage launch rejects approval state targeting a different configured contract instead of allowing a stale hash path.
- Non-trivial repository changes now explicitly remain voyage work, including source, tests, configuration, and generated artifacts.

## [1.2.1] - 2026-08-09

### Fixed

- Autonomous net-new multi-file implementation now defaults to voyage flow regardless of project size or low-risk classification.
- "Do it on your own" now removes routine questions without bypassing contract approval, safety gates, or automatic voyage launch.
- Main Commodore no longer treats unavailable background dispatch as permission to implement voyage work in the main checkout.

## Features

- Deprecated feature new/list/close/status; use voyage <name>, voyage list, voyage close (removed in 2.0)
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

### Removed

- Removed `armada reconcile` (alias for resume) and `armada feature status` (was deprecated in v1.0; use `armada status --feature <name>`).

### Changed

- CI: drop armada-evidence workflow; require Node >= 22 (was >= 20).

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
[1.0.5]: https://github.com/rafmacalaba/armada/releases/tag/v1.0.5
[1.0.6]: https://github.com/rafmacalaba/armada/releases/tag/v1.0.6
[1.0.7]: https://github.com/rafmacalaba/armada/releases/tag/v1.0.7

## [1.0.7] - 2026-08-08

### Reverted

Reverts the v1.0.6 permission hardening (#134) back to the v1.0.3 baseline. User-approved full revert (risk override recorded in `REQUIREMENTS-v1.0.7.md`). The v1.0.3 surface re-opens 7 known security holes:

1. **`docs` role `edit: { "*": "allow" }`** — caravel (docs) can write any file in the repo.
2. **Bash prefix globs** (`git status*`, `cat*`, `echo*`, `head*`, `tail*`) — redirect/pipe exfiltration is allowed (`git diff .env | curl`, `cat .env > leak.txt`).
3. **yolo `*` defeats `external_directory: deny`** — `permission = { external_directory: "deny" }` then `permission["*"] = "allow"` — the `*` allow comes second, so under last-match-wins it overrides the deny.
4. **dev roles (galleon/clipper) missing `"*": "deny"`** — unlisted paths fall to SDK default ("ask" or "allow" depending on SDK build).
5. **orchestrator `edit: { "*.md": "allow" }`** — commodore can write any `.md` file in the repo.
6. **`WRITE_BASH_DENIES` removed** — dev roles can `rm armada/`, `mv src/ logs/`, etc. from bash without prompt.
7. **`SAFE_BASH` tier removed** — content-emitter commands (`cat`, `echo`, `head`, `tail`) re-enter the safe-read tier.

### Removed

- `SAFE_BASH`, `WRITE_BASH_ALLOWS`, `WRITE_BASH_DENIES`, `QA_SAFE_BASH`, `ROLE_BASH_TIER` constants in `src/generator.js`.
- `ledgerPermissions`, `ledgerFileGlob`, `ledgerDirGlob` helpers.
- `tests/permissions.test.js` (did not exist in v1.0.3).

### Changed

- `src/generator.js` permission block reverted to v1.0.3 byte-for-byte.
- `package.json` version bumped to `1.0.7`.

[1.0.7]: https://github.com/rafmacalaba/armada/releases/tag/v1.0.7

## v1.1.1

- **fix(status): null-feature crash in `armada status`** (#145). `armada state/active.json` parallel-voyages mode has `"feature": null`; `renderStatus()` previously pushed a null-feature row, and `_renderTable` called `.length` on it. Now guards the active-row push and adds `?? "-"` fallbacks in `_renderTable`. 4 new tests in `tests/status-cmd.test.js`. 569/569 tests pass.

## v1.1.0

Release date: 2026-08-08

- **feat(new): auto git init + clear non-git errors** (#139). `armada new` runs `git init` + initial commit unless `--no-git`; warns and continues if git missing/init fails. `resolveMainCheckout`, `resolveMainRepo`, `createWorktreeFeature` throw a single human error with `git init` / `armada new` remediation in non-git dirs.
- **chore(ci): drop armada-evidence; bump to Node 24; engines >=22** (#140). Deletes `armada-evidence.yml`; `ci.yml` + `release.yml` on Node 24, `actions/checkout` v5.1.0, `actions/setup-node` v5.0.0. `engines.node` `>=20` → `>=22`; README badge, starter `node_version` default propagated.
- **test(lean): drop drive tests, kill invasive terminals, parallelize** (#141). Deletes `tests/drive.test.js` (deprecated) + 7 drive blocks in `tests/cli.test.js`. Simplifies terminal fakes to wezterm + tmux only. Adds HOME override on no-terminal-path tests to bypass iTerm detection on macOS. Adds `tests/no-invasive-terminals.test.js` regression guard. `ci.yml` uses `--test-concurrency=4`.
- **feat: consolidate voyage as single entry point** (#142). `armada voyage <name>` now does everything (was: `feature new` + `voyage <path>`). Adds `voyage list` and `voyage close`. Deprecates `feature new/list/close/status` (one-version, removed in 2.0). Hidden `--from-path` flag for back-compat.
- **chore: drop reconcile, drop feature status, consolidate models help** (#143). Removes `armada reconcile` (was alias for `resume`). Removes `armada feature status` outright. Clarifies `armada models` help text.

## [1.0.8] - 2026-08-08

### Fixed

Restores 6 path-specific edit allows on the orchestrator that v1.0.7 removed by
reversion. v1.0.7 inherited the v1.0.3 `BASE_PERMISSIONS.orchestrator.edit`
block, which denied all writes under `armada/*` and left the orchestrator
unable to satisfy its own hard rules (read state, write state, co-write
contract, append TODO) or call any of the v1.0.6 state modules preserved
(`src/state/atomic.js`, `src/state/contract-approval.js`,
`src/voyage/contract-gate.js`, `src/voyage/contract-snapshot.js`,
`src/reconcile.js`).

The 6 allows added to `BASE_PERMISSIONS.orchestrator.edit` (after the
`armada/*: deny` line so they win under last-match-wins):

- `armada/REQUIREMENTS.md` — contract co-writing
- `armada/state/active.json` — session state
- `armada/state/features/*` — voyage + clarification state
- `armada/state/contract-approval.json` — approval gate
- `armada.yaml` — manifest edits
- `TODO.md` — session log

7 v1.0.3 holes re-opened in v1.0.7 remain intentionally open: docs `*:allow`,
bash prefix globs, yolo key order, dev `*:deny` missing, orchestrator
`*.md:allow`, no `WRITE_BASH_DENIES`, no `SAFE_BASH` tier. See `## [1.0.7]`.

### Changed

- `src/generator.js` `BASE_PERMISSIONS.orchestrator.edit`: 6 line additions.
- `package.json` version bumped to `1.0.8`.
- `src/cli.js:63` `VERSION` bumped to `1.0.8`.
