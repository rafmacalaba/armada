# P5 — 60-second path verification

Verifies the README's 60-second path against actual source. No shell in this phase; every
command below was checked against `src/cli.js` dispatch and handlers. Expected outputs are
quoted from the source, not from execution.

## The path (README "Start here — 60 seconds")

### New project

```
npx opencode-armada new my-app --type web-app --beginner --yes
cd my-app
opencode
```

Command existence check:

| Step | Exists? | Source |
|---|---|---|
| `new` dispatch | yes | `src/cli.js:156-177` (case "new" -> runNew) |
| `--type web-app` | yes | `src/cli.js:168-171`; category validated in `src/new-command.js:143-147` |
| `--beginner` | yes | `src/cli.js:172` |
| `--yes` | yes | `src/cli.js:174` |
| team scaffolded inside new | yes | `src/new-command.js:211-214` (scaffold() on the fresh repo) |

Expected output after `new`: a `my-app/` directory, the rendered starter, the scaffolded
file list (`+ .opencode/agent/commodore.md` etc., `+ opencode.json`, `+ AGENTS.md`,
`+ armada/armada.yaml`), then the next-steps block: `cd my-app`, `opencode`,
`armada status` (`src/new-command.js:216-223`).

`opencode` (the runtime, not an armada command) boots into the default agent — the
orchestrator, `default_agent: "commodore"` (`src/generator.js:232`; generated
`opencode.json:7`). Because the team is already scaffolded, the TUI shows the fleet
immediately. Contract is blank, so the orchestrator co-writes it before building.

### Existing repo

```
cd your-repo
npx opencode-armada init --yes --yolo
opencode
```

| Step | Exists? | Source |
|---|---|---|
| `init` dispatch | yes | `src/cli.js:143-144` (case "init" -> init) |
| `--yes` | yes | `src/cli.js:318` (non-interactive path) |
| `--yolo` | yes | `src/cli.js:342-344` (manifest.project.yolo = true; emits `permission: { "*": "allow" }`) |
| `--help`/`-h` on init | yes | `src/cli.js:284-288` |

Expected output after `init --yes --yolo`: the scaffolded file list (`+ .opencode/...`,
`+ opencode.json`, `+ AGENTS.md`, `+ armada/...`), then the init summary with project name,
team count (8 agents), budget (balanced), cost hint, per-role roster, and next steps
(`src/init-summary.js:10-34`; printed at `src/cli.js:409-411`).

### Verify

```
armada doctor
armada status
```

| Step | Exists? | Source |
|---|---|---|
| `doctor` dispatch | yes | `src/cli.js:147-148` |
| `status` dispatch | yes | `src/cli.js:207-208` |

Expected output: doctor prints one line per check — opencode CLI, providers auth, openrouter
auth, background dispatch, node, global armada binary, team roster, plugin presence, model
drift (`src/doctor.js:82-225`) — with `pass`/`fail`/`warn` status per line, exit 1 if any
fail (`src/cli.js:500-505`). `status` prints the active feature, phase, and next action from
`armada/state/` (`src/status-cmd.js`).

### Commands referenced elsewhere in README

| Command in README | Exists? | Source |
|---|---|---|
| `armada init --from-armada armada/armada.yaml` | yes | `src/cli.js:295-316` |
| `armada init --from-armada ... --restart` | yes | `src/cli.js:290` (force) |
| `armada --version` | yes | `src/cli.js:203-206` |
| `armada help` | yes | `src/cli.js:211-215` |
| `armada voyage` | yes | `src/cli.js:186-187` |
| `armada voyage-handoff <name>` | yes | `src/cli.js:209-210` |
| `armada feature new\|list\|close` | yes | `src/cli.js:178-179` |
| `armada models [budget]` | yes | `src/cli.js:145-146` |
| `armada resume` | yes | `src/cli.js:180-181` |
| `armada uninstall` | yes | `src/cli.js:149-150` |
| `armada fleet [session]` | yes | `src/cli.js:184-185` |
| `armada reconcile` (alias) | yes | `src/cli.js:182-183` |

## Defect check

Every command in the new README exists in `src/cli.js` dispatch with the flags shown; no
README command is missing or has wrong flags. **No defect filed** (the P5 instruction to file
a defect in armada/ledgers/public-stability/DEFECTS.md applies only if a README command is
wrong).

## Open items (not defects, but release gates)

1. `npx opencode-armada` resolving the single `armada` bin is npm's single-bin rule, not
   verified by execution here. npm-pack-smoke proved the packed bin runs
   (`docs/stability/P0/npm-pack-smoke.md`, `--version` -> `opencode-armada v0.9.2`); the
   `npx opencode-armada --version` check is a pack-time release gate (release-checklist.md).
2. `opencode` must already be installed (README Requirements). Doctor's first check catches
   a missing runtime (`src/doctor.js:86-91`).
3. Timing: the flow is 2-3 commands, but the "60 seconds" claim depends on a clean machine
   with opencode preinstalled. The README claims the flow, not a measured wall-clock time.

## Verdict

PATH VERIFIED AGAINST SOURCE: all commands exist with correct flags; expected outputs
quoted from handlers. Timing unmeasured (no shell) — flagged, not claimed.

## Self-check

Files read: `src/cli.js` (949 lines, full dispatch + handlers), `src/new-command.js:125-224`,
`src/init-summary.js` (35 lines), `src/doctor.js:82-225`, `src/generator.js:229-236`
(opencode.json render, via P0 evidence), generated `opencode.json` (49 lines), the new
README.md (this phase).

Verdict: PASS — every README command verified against source; no defect filed.
Date: 2026-08-05.
