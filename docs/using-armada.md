# Using armada

A guide to an armada-armed repo: the day-to-day commands, the fleet terminology, and the
observability dashboard. This is the restored home for fleet-dashboard and terminology usage
that previously lived in `docs/using-armada.md`.

## The fleet terminology

The 8-role roster displays as one ship name each. The role key is the internal function; the
ship name is cosmetic (display-layer only, see `src/role-display.js`).

| Role key | Ship name |
|---|---|
| orchestrator | Commodore |
| backend-dev | Galleon |
| frontend-dev | Clipper |
| qa | Corvette |
| adversary | Xebec |
| security | Frigate |
| docs | Caravel |
| architect | Bark |

Older `Lane A` / `Lane B` terms are **patrol** (audit) and **voyage** (feature). `armada drive`
is a deprecated alias for `armada voyage`.

## The observability dashboard

Track what the fleet is doing at a glance:

```bash
armada fleet             # per-lane progress dashboard (table)
armada fleet --json      # machine output
armada fleet --open      # open in a terminal
armada fleet discover    # list/register untracked voyage worktrees
armada status            # active feature, phase, next step
```

Each lane's progress lives in `armada/state/active.json`; the cross-repo dashboard reads the
fleet-tracker store (`~/.armada/runs/`, `$ARMADA_RUNS_DIR` override), written by the default-on
`armada-fleet.js` plugin and the `armada voyage` heartbeat.

## Day-to-day commands

```bash
armada init                   # scaffold the team into a repo (re-run to re-scaffold)
armada doctor                 # verify setup
armada status                 # what's happening now
armada voyage sandbox/<name>  # boot a lane session
armada resume                 # pick up an interrupted session
```

See [docs/operator-guide.md](./operator-guide.md) for the full command + flag reference, and
[user-guide.md](./user-guide.md) for fleet concepts.

## See also

- [docs/process/triage.md](./process/triage.md) — voyage vs. in-window
- [docs/armada-improves-armada.md](./armada-improves-armada.md) — self-improvement loop
- [README.md](../README.md) — "Meet the Fleet" roster
- [docs/operator-guide.md](./operator-guide.md) — full CLI reference