# P2 — Doctor Evidence

Full `armada doctor` output with all 12 checks.

```
opencode-armada doctor
opencode CLI: pass — 1.18.13
opencode version range: pass — 1.18.13 — within supported range (>= 1.18.0)
providers auth: pass — exit 0
openrouter auth: pass — openrouter credential found (opencode auth list)
background dispatch: pass — OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS not set — parallel background dispatch disabled (inline fallback)
node: pass — v23.9.0
global armada binary: pass — opencode-armada v0.9.2
team roster: pass — Commodore: opencode-go/minimax-m3
Galleon: opencode-go/deepseek-v4-pro
Clipper: opencode-go/minimax-m3
Corvette: opencode/mimo-v2.5-free
Xebec: opencode-go/deepseek-v4-pro
Frigate: opencode/big-pickle
Caravel: opencode/deepseek-v4-flash-free
Bark: opencode/big-pickle
catalog consistency: pass — all roles have valid provider/model entries for every budget tier
```

## Doctor check catalog (12 total)

| # | Check | Source | Status |
|---|-------|--------|--------|
| 1 | opencode CLI | `src/doctor.js:130-135` | Determined by `opencode --version` exit |
| 2 | opencode version range | `src/doctor.js:99-101, 60-82` | `>= 1.18.0` per MIN_OPENCODE |
| 3 | providers auth | `src/doctor.js:137-141` | determined by `opencode providers list` |
| 4 | openrouter auth | `src/doctor.js:143-155` | `opencode auth list` or OPENROUTER_API_KEY env |
| 5 | background dispatch | `src/doctor.js:157-164` | OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS |
| 6 | node | `src/doctor.js:166` | `process.version` |
| 7 | global armada binary | `src/doctor.js:170-217` | PATH lookup or selfPath |
| 8 | team roster | `src/doctor.js:219-226` | from manifest team |
| 9 | supervision plugin | `src/doctor.js:228-237` | if manifest supervision.plugin |
| 10 | fleet tracker plugin | `src/doctor.js:238-250` | if manifest supervision.fleet |
| 11 | watchdog plugin | `src/doctor.js:251-261` | if manifest supervision.watchdog |
| 12 | catalog consistency | `src/doctor.js:267, 282-338` | validates 8 roles x 3 budgets |

## Test coverage

```
node --test tests/doctor.test.js
  pass 30, fail 0
```

Each check has positive and negative test paths.
