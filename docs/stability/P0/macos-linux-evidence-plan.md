# macOS + Linux Evidence Plan

## Current platform

```
Darwin Rafaels-MacBook-Pro.local 25.5.0 Darwin Kernel Version 25.5.0: Mon Apr 27 20:41:26 PDT 2026; root:xnu-12377.121.6~2/RELEASE_ARM64_T8132 arm64
```

macOS arm64. Node v23.9.0. OpenCode 1.18.13.

## What differs for Linux

- Binary paths: `/opt/homebrew/bin/armada` becomes `/usr/local/bin/armada` or `~/.local/bin/armada`.
- tmux: must be pre-installed on Linux (macOS can use wezterm fallback).
- Terminal detection: Linux uses `$TERM` and xterm-family; macOS uses `open` command.
- File permissions: Linux is stricter on symlink detection.
- No major Node API differences for Node >=20.

## Phase-by-phase evidence plan

### Phase 0 (current)

| Command | macOS | Linux | Gate |
|---------|-------|-------|------|
| `node --test 'tests/*.test.js'` | docs/stability/P0/full-suite-evidence.md | Cross-ref, Linux run appended | 499 pass, 0 fail |
| `npm run test:smoke` | docs/stability/P0/full-suite-evidence.md | Cross-ref | 3 pass, 1 skip |
| `armada init --yes --budget free` | docs/stability/P0/lifecycle-verification.md | Linux run appended | 28 files scaffolded |
| `armada doctor` | docs/stability/P0/lifecycle-verification.md | Linux run appended | All checks pass |
| `armada status` | docs/stability/P0/lifecycle-verification.md | Linux run appended | Exit 1, no feature |
| `armada uninstall` | docs/stability/P0/lifecycle-verification.md | Linux run appended | User files preserved |

### Phase 1 — Setup safety + deduplication

| Command | macOS | Linux | Gate |
|---------|-------|-------|------|
| `armada init` (all flag combos) | armada/e2e/public-stability/p1-init-flags.md | Linux run appended | All combos correct |
| `armada init --restart` | armada/e2e/public-stability/p1-restart.md | Linux run appended | Overwrites armada-owned, preserves user |
| `armada uninstall` (all combos) | armada/e2e/public-stability/p1-uninstall.md | Linux run appended | Clean removal |
| `armada init` (idempotent) | armada/e2e/public-stability/p1-idempotent.md | Linux run appended | Identical output on re-run |

### Phase 2 — Runtime/provider compatibility

| Command | macOS | Linux | Gate |
|---------|-------|-------|------|
| `armada doctor` (full checks) | armada/e2e/public-stability/p2-doctor.md | Linux run appended | All checks pass |
| `armada models` (all budgets) | armada/e2e/public-stability/p2-models.md | Linux run appended | Correct models per tier |
| `armada models --refresh` | armada/e2e/public-stability/p2-models-refresh.md | Linux run appended | Live models merge |
| Node version range test | armada/e2e/public-stability/p2-version.md | Linux run appended | Unsupported error if Node<20 |

### Phase 3 — Voyage/worktree/state reliability

| Command | macOS | Linux | Gate |
|---------|-------|-------|------|
| `armada voyage <lane>` | armada/e2e/public-stability/p3-voyage.md | Linux run appended | tmux session boots |
| `armada status --feature` | armada/e2e/public-stability/p3-status.md | Linux run appended | Correct feature row |
| `armada resume` | armada/e2e/public-stability/p3-resume.md | Linux run appended | Drift detection works |
| Worktree isolation | armada/e2e/public-stability/p3-worktree.md | Linux run appended | Main untouched |

### Phase 4 — Generated-repo acceptance

| Command | macOS | Linux | Gate |
|---------|-------|-------|------|
| Full lifecycle clean HOME | armada/e2e/public-stability/p4-acceptance.md | Linux run appended | init->doctor->voyage->uninstall |
| Two parallel docks | armada/e2e/public-stability/p4-parallel.md | Linux run appended | No conflict |

### Phase 5 — Public docs + release packaging

| Command | macOS | Linux | Gate |
|---------|-------|-------|------|
| `npm pack` contents | armada/e2e/public-stability/p5-packaging.md | Linux run appended | Package matches manifest |
| README walkthrough | armada/e2e/public-stability/p5-readme.md | Linux run appended | 60-second path works |

### Phase 6 — Final patrol

| Command | macOS | Linux | Gate |
|---------|-------|-------|------|
| Full suite re-run | armada/e2e/public-stability/p6-final.md | Linux run appended | 499 pass, 0 fail |
| Security review | armada/e2e/public-stability/p6-security.md | Linux run appended | No OPEN findings |
| Adversarial review | armada/e2e/public-stability/p6-adversarial.md | Linux run appended | No PENDING findings |

## Available environments

| Env | macOS | Linux | Notes |
|-----|-------|-------|-------|
| Local dev (this machine) | Yes | No | arm64, Node 23.9.0 |
| GitHub Actions | Possible | Possible | ubuntu-latest / macos-latest |
| Docker (local) | Possible | Possible | Need Linux image with Node>=20, tmux, opencode |
| CI (custom) | Unknown | Unknown | Need commodore confirmation |

## Gaps

1. No Linux env confirmed. Need commodore to authorize GitHub Actions or Docker.
2. tmux availability on Linux CI. Must be in image/Dockerfile.
3. OpenCode CLI on Linux. Must be in PATH for doctor/voyage.
4. OpenRouter credential in CI. Must be secret for smoke suite.
5. Terminal detection path differs. Linux fallback needs verification.

Evidence check: file written, 5 gaps identified, 6 phases planned.
