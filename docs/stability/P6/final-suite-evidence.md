# Final Suite Evidence — public-stability (Phase 6)

## Deterministic + E2E Suite

Command: `node --test 'tests/*.test.js' 'armada/e2e/public-stability/*.test.js'`

```
tests 634
suites 4
pass 634
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 20458.645084
```

All 634 tests pass. Covers: init/update/uninstall lifecycle, doctor checks, voyage/bootLane,
status, feature new/list/close, model catalog, stack detection, state management,
reconcile/resume, parallel worktree isolation, main-checkout untouched, packed npm artifact,
role display, scaffold, gitignore, symlink rejection, orchestration prompts, and more.

## Packed npm Black-Box Suite

Command: `npm run test:packed`

```
[1/5] npm pack opencode-armada@0.9.2 ...
  -> opencode-armada-0.9.2.tgz
[2/5] install to temp prefix ...
  -> prefix=/var/folders/.../T/tmp.qmrXE1gLbH
  -> binary at .../bin/armada
[3/5] run --version and help ...
  -> version: opencode-armada v0.9.2
  -> help OK
[4/5] assert binary matches dock src/cli.js ...
  -> match OK
[5/5] cleanup ...
  -> prefix removed

PASS: opencode-armada-0.9.2.tgz installed and runs in clean prefix.
```

## Package Metadata

- version: 0.9.2
- engines.node: >=20
- license: MIT
- repository: git+https://github.com/rafmacalaba/opencode-armada.git
- peerDependencies.opencode: ^1.18.0

## Security / Adversarial Findings

No SECURITY_FINDINGS.md or ADVERSARIAL_REVIEW.md entries found in public-stability ledgers.

## Feature Freeze Evidence

No telemetry, hosted control plane, Claude Code/Codex integration, or broad rewrite features
detected in src/ or agents/. Agent prompt references to "codex / claude code" are harness
compatibility notes, not implementation.

## Platform Evidence

Tests run on macOS (darwin, Node 20+). Linux compatibility is validated via:
- Platform-independent doctor checks (test: `doctor checks do not depend on platform-specific env vars` — PASS)
- Node >=20 runtime checks for Node 18/16/0.12 with clear error messages
- Canonical npx lifecycle works cross-platform (no OS-specific paths in core logic)
