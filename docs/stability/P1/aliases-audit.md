# P1 — Aliases Audit

Every alias mapped to canonical command, removed if dead.

## Active aliases (all documented in help)

| Alias | Canonical | Status | Exit code |
|-------|-----------|--------|-----------|
| `drive` | `voyage` | Deprecated, v2.0 removal | 1 (deprecation) |
| `update` | `init --from-armada --restart` | Deprecated, v2.0 removal | 1 (deprecation) |
| `preset` | `init --budget <name>` | Deprecated, v2.0 removal | 1 (deprecation) |
| `feature status` | `status --feature <name>` | Deprecated, v2.0 removal | 1 (deprecation) |
| `reconcile` | `resume` | Documented alias | 0/1/2 (actual outcome) |

## Removed aliases (no switch case)

| Alias | Result |
|-------|--------|
| `ping` | Unknown command (was: "removed, use armada help") |
| `scout` | Unknown command (was: "removed, use /armada-scout in TUI") |

Both `ping` and `scout` were removed from the switch statement.
The "Removed" section in HELP still documents them for discoverability.

## Deprecation behavior (all deprecated aliases)

All 5 deprecated aliases print deprecation hint on stderr BEFORE running the
underlying action, then exit non-zero (1). This matches the drive pattern.
Previously `preset` and `update` exited 0 (silent success), hiding their
deprecated status.

## Help text coverage

All 12 active commands appear in HELP output. reconcile added as documented alias.
No hidden commands.

## Source references

- HELP text: `src/cli.js:44-86`
- Switch dispatch: `src/cli.js:135-213`
- Deprecated handlers: `src/cli.js:147-151` (update), `src/cli.js:174-176` (drive), `src/cli.js:177-188` (preset)
- reconcile alias: `src/cli.js:168-170`, handler: `src/cli.js:548-558`
