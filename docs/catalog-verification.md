# Model catalog verification

Run date: 2026-08-03
Harness: `node --test 'tests/smoke/catalog.live.test.js'`

## Result

All 11 unique catalog IDs verified live. Zero NOT FOUND.

### Per-ID table

| ID | Source | Result | Roles |
|---|---|---|---|
| opencode-go/minimax-m3 | opencode | OK | orchestrator, frontend-dev |
| openrouter/z-ai/glm-5.2 | opencode binary | OK | orchestrator, backend-dev, architect |
| opencode-go/hy3 | opencode | OK | orchestrator |
| openrouter/anthropic/claude-sonnet-4.6 | opencode binary | OK | orchestrator |
| opencode-go/deepseek-v4-pro | opencode | OK | backend-dev, adversary |
| openrouter/deepseek/deepseek-v4-pro | opencode binary | OK | backend-dev, adversary, security |
| opencode/deepseek-v4-flash-free | opencode | OK | backend-dev, adversary, docs |
| openrouter/minimax/minimax-m3 | opencode binary | OK | frontend-dev, docs |
| opencode/mimo-v2.5-free | opencode | OK | frontend-dev, qa |
| openrouter/xiaomi/mimo-v2.5 | opencode binary | OK | qa |
| opencode/big-pickle | opencode | OK | security, architect |

**Summary: 11 OK, 0 SKIP, 0 NOT FOUND, 0 ERROR (11 total unique IDs)**

## OpenRouter secondary verification

OpenRouter API key absent on this machine. OpenRouter IDs verified via `opencode models`
(the opencode provider exposes `openrouter/*` slugs). All 5 catalog openrouter slugs confirmed:

```
$ opencode models | grep -E 'openrouter/(z-ai/glm-5\.2|anthropic/claude-sonnet-4\.6|deepseek/deepseek-v4-pro|minimax/minimax-m3|xiaomi/mimo-v2\.5)$'

openrouter/anthropic/claude-sonnet-4.6
openrouter/deepseek/deepseek-v4-pro
openrouter/minimax/minimax-m3
openrouter/xiaomi/mimo-v2.5
openrouter/z-ai/glm-5.2
```

## Catalog vs contract discrepancy

Contract (`armada/REQUIREMENTS.md` lines 12-16) lists `opencode-go/deepseek-v4-flash`
as a "to verify" ID. Catalog (`src/model-catalog.js`) does not use this ID; it uses
`opencode/deepseek-v4-flash-free` instead (for backend-dev, adversary, docs roles).

Both IDs are live on the opencode provider:

```
$ opencode models | grep 'deepseek-v4-flash'
opencode/deepseek-v4-flash-free
opencode-go/deepseek-v4-flash
```

**Status: no action taken.** Contract is a snapshot; catalog is runtime source of truth.
Catalog's choice (`opencode/deepseek-v4-flash-free`) is live and provides free-tier access.
If `opencode-go/deepseek-v4-flash` was intended for a specific role, this needs a contract
amendment. See contract notes below.

## Generator audit: openrouter.models fallbacks

`src/generator.js` `renderOpenCodeJson()` iterates all roles and collects every
`openrouter/*` ID from `model`, `fallback`, `free`, and `power` tiers. Deduplicated
set matches catalog's union of all openrouter slugs:

| Catalog openrouter slug | In renderer output? |
|---|---|
| z-ai/glm-5.2 | Yes (orchestrator fallback, backend-dev power, architect fallback/power) |
| anthropic/claude-sonnet-4.6 | Yes (orchestrator power) |
| deepseek/deepseek-v4-pro | Yes (backend-dev/adversary/security fallback, adversary/security power) |
| minimax/minimax-m3 | Yes (frontend-dev fallback/power, docs fallback/power) |
| xiaomi/mimo-v2.5 | Yes (qa fallback/power) |

**Result: PASS.** No missing fallbacks. All 5 catalog openrouter slugs appear in
rendered `opencode.json` `provider.openrouter.models` with `allow_fallbacks: true`.

## Fast suite

```
node --test 'tests/*.test.js'
```

313 pass, 0 fail. All existing catalog shape and renderer tests green.

## Contract notes for user decision

1. **`opencode-go/deepseek-v4-flash` in contract but not in catalog:**
   Contract lists it as a "to verify" ID. Catalog uses `opencode/deepseek-v4-flash-free`
   instead. Both live. If the contract intended `opencode-go/deepseek-v4-flash` for a
   specific role (e.g., orchestrator or as a paid-tier alternative), update
   `src/model-catalog.js` accordingly and re-verify.

2. **All IDs verified live.** No `NOT FOUND` and no stale IDs to fix in Phase 2.

## How to re-run

```
node --test 'tests/smoke/catalog.live.test.js'
```

The openrouter portion skips when no OpenRouter credential is set (`OPENROUTER_API_KEY` or
`opencode /connect openrouter`); the opencode portion requires the `opencode` binary on PATH.
