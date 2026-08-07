# Changelog

All notable changes to armada are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
