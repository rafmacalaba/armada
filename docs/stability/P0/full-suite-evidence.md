# Full Suite Evidence

## Unit + CLI E2E Suite

Command: `node --test 'tests/*.test.js'`
Workdir: `/Users/rafaelmacalaba/WBG/opencode-armada/sandbox/public-stability`

```
tests 499
suites 4
pass 499
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 17851.288333
```

Verdict: PASS — 499/499 green, zero skips, zero failures.

## Smoke Suite (live OpenRouter)

Command: `node --test 'tests/smoke/*.test.js'`

```
tests 4
suites 0
pass 3
fail 0
cancelled 0
skipped 1
todo 0
duration_ms 3682.357292
```

Skipped test: `command-body-abstraction live` — requires `RUN_LIVE=1` env var and `opencode` on PATH. This is opt-in by design.

Verdict: PASS — 3/3 live tests green, 1 opt-in skip.

## Determinism

Full suite: deterministic — no network calls, no env-dependent output, runs in ~18s.

Smoke suite: partially deterministic — `openrouter live` tests hit real API. Catalog ID resolution is deterministic given the fixture. `command-body-abstraction` requires live opencode session.

## Env Notes

- Node: v23.9.0
- Platform: macOS arm64 (Darwin 25.5.0)
- OpenCode CLI: 1.18.13
- armada: v0.9.2
- OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: not set (parallel dispatch disabled)

Evidence check: file written, 499 pass confirmed.
