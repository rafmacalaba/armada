# Phase 0 — Current-truth + setup/lifecycle baseline

Status: PASS

Date: 2026-08-05
Contract: armada/REQUIREMENTS.md (public-stability, APPROVED)
Branch: feat/public-stability
Worktree: sandbox/public-stability
Platform: macOS arm64 (Darwin 25.5.0); Node v23.9.0; OpenCode 1.18.13

## Success criteria

> Fresh evidence files under `docs/stability/` and passing commands cited as evidence for every task above; no conclusion drawn from stale baseline files.

| Task | Evidence file | Bytes | Status |
|------|---------------|-------|--------|
| Fresh executable command/artifact inventory | docs/stability/P0/commands-inventory.md | 9,273 | PASS |
| Docs-versus-code/generated-output alignment | docs/stability/P0/docs-vs-code-alignment.md | 14,292 | PASS (24 drift items enumerated) |
| Packed npm install smoke | docs/stability/P0/npm-pack-smoke.md | 2,350 | PASS (`opencode-armada-0.9.2.tgz`, 115.6 kB, 91 files) |
| Canonical npx lifecycle walkthrough | docs/stability/P0/lifecycle-walkthrough.md | 8,613 | PASS |
| Lifecycle verification (independent re-run) | docs/stability/P0/lifecycle-verification.md | 3,067 | PASS (no drift vs primary) |
| Public presentation/support baseline | docs/stability/P0/public-presentation.md | 8,498 | PASS (21 gaps enumerated) |
| macOS/Linux evidence plan | docs/stability/P0/macos-linux-evidence-plan.md | 5,170 | PASS |

**Total evidence:** 51,263 bytes across 8 files. No stale baseline consulted.

## Suite state

- `node --test 'tests/*.test.js'` — 499 pass, 0 fail, 0 skipped, 17.8s
- `npm run test:smoke` — 3 pass, 0 fail, 1 skipped (opt-in `RUN_LIVE=1`), 3.7s

## Findings (forwarded to later phases, not Phase 0 defects)

These are inputs to P1–P6 work, not Phase 0 blockers. Phase 0 is about evidence, not fixing.

### Backend / CLI (from commands-inventory.md)
- `reconcile` hidden command (`src/cli.js:170`), always exits non-zero
- `ping`/`scout` still in switch as "removed", exit 1 with hint
- `preset`/`update` print deprecation hint AFTER running full scaffold (order bug)
- `uninstall --all` leaves `armada/state/` and empty `opencode/` dirs
- Doctor "global armada binary" check runs `armada help` from PATH (stale risk)
- `armada new --help` treats `--help` as project name (creates `--help/`)

### Docs alignment (24 drifts across 7 groups)
- A: agent file naming (scaffold.js:298, role key vs ship name)
- B: default_agent mismatch (generator.js:232 — "commodore" vs "orchestrator")
- C: skill count (9 ship vs "4 user-facing" claim)
- D: fleet-tracker default-on vs "opt-in" docs
- E: SPEC.md stale (`--refresh` stub, `go-zen` provider, AGENTS.md no-clobber)
- F: live tree generated sample stale (`.opencode/commands` has 2 retired files; `commodore.md:139` references retired `/armada-status`)
- G: live `AGENTS.md:113` armada block names "ux-revamp" — stale from prior lane

### Public presentation (21 gaps)
- P-01..P-06: 60-second path not demonstrated
- P-07..P-11: help clarity gaps
- P-12..P-14: support channel absent
- P-15..P-18: auth/cost/recovery doc gaps
- P-19..P-21: consistency gaps

### CI/Linux env (open question)
- No Linux runner confirmed. Phase 1–6 need authorization for GitHub Actions or Docker.
- tmux must be pre-installed on Linux CI image.
- OpenRouter credential in CI required for smoke suite.

## Defects filed

- `armada/ledgers/public-stability/DEFECTS.md` created (0 entries). No P0 defects.

## Gating decision

Phase 0 PASSES. Unblocks P1, P2, P3, P5 (all depend on P0).

## Next action

Dispatch P1, P2, P3 in parallel as background subagents (galleon-led slices with disjoint file scope), and P5 (caravel-led, docs-only) in parallel. P4 awaits P1+P2+P3. P6 final patrol awaits P1+P2+P3+P4+P5.

Sequencing P1/P2/P3 within the dock is a meta-orchestration call: P1 owns `src/cli.js` command routing and the new `src/commands/*` tree; P2 owns `src/doctor.js`, `src/model-catalog.js`, `package.json` engines; P3 owns `src/cli.js` voyage commands and the new state module. Because P1 and P3 both touch `src/cli.js`, the safe shape is: P1 first (one shared writer on `src/cli.js`), then P2 || P3 || P5 in parallel after P1 lands. Awaiting commodore confirmation.
