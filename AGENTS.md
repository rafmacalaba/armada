# opencode-armada — Agent Rules

opencode-armada generates reproducible AI-engineer multi-agent teams for opencode, natively —
no plugin. This file is the rules for agents working ON armada itself. Not a session
journal — session progress lives in commits and PRs.

## Commands

- Test suite: `node --test 'tests/*.test.js'` — must stay green before committing
- Smoke (live OpenRouter, opt-in, skipped without a credential): `npm run test:smoke`
- CLI smoke: `node src/cli.js help`
- Scaffold a team into a repo: `node src/cli.js init --from-armada armada.yaml`

## Feature work must run through armada (mandatory)

Any feature or implementation request — new command, new module, multi-file change, "ship a TODO
item" — runs through the armada voyage flow (`docs/armada-improves-armada.md`). Do not implement
features directly in this working tree.

Mandatory steps:

1. Create the dock: `git worktree add -b feat/<name> sandbox/<name>`
2. Scaffold the team into it: `node ../../src/cli.js init --yes --yolo --budget balanced` (from the sandbox)
3. Write the feature contract at `sandbox/<name>/armada/REQUIREMENTS.md` (leave blank to co-write)
4. Set sail: `tmux new-session -d -s <name> -c sandbox/<name> 'opencode'` — the orchestrator boots and dispatches
5. Verify evidence (tests green), then **push the branch and open a PR** — never merge locally.
   Ask the user to merge; after merge, `git worktree remove sandbox/<name>`

The live repo stays pristine — never scaffolded, never edited by feature work.

Exceptions that may be edited directly in the live tree (no dock): small doc/process edits
(README, TODO, this file), defect ledger maintenance, and single-file bug fixes. If a request
implies net-new functionality and you are not in a dock, stop and propose the dock before
editing any source.

## Architecture

Module map + data flow in [ARCHITECTURE.md](./ARCHITECTURE.md). One-liners:

- `src/cli.js` — entry: new / init / models / doctor / uninstall / ping / help
- `src/manifest.js` — manifest schema, default playbook, YAML parser (`parseManifestYaml`)
- `src/model-catalog.js` — roles, curated model recommendations, budget tiers, table renderer, models cache
- `src/stack-detect.js` — stack detection from manifests + instruction files (recurses subdirs for monorepos)
- `src/questionnaire.js` — interactive setup (node readline, zero deps)
- `src/generator.js` — pure renderers (team, native agent files, opencode.json, AGENTS.md, REQUIREMENTS.md, armada.yaml, commands, opt-in supervision plugin)
- `src/scaffold.js` — file I/O, prompt filling, no-clobber, `uninstall`
- `src/doctor.js` — environment health checks (spawns opencode, providers + openrouter auth, background dispatch, supervision-plugin presence)
- `src/new-command.js` + `starter/<category>/` — `armada new` repo generator
- `agents/<role>/prompt.template.md` — per-role prompts with `{placeholders}`
- `presets/*.yaml` — budget presets (free / balanced / power)

## Conventions

- ESM everywhere; imports use explicit `.js` extensions. Node >= 20.
- `yaml` is the only runtime dependency. The questionnaire stays zero-dep.
- Generator is pure (zero I/O); scaffold owns I/O.
- Never clobber user files: `opencode.json`, `AGENTS.md`, `REQUIREMENTS.md` are written only if
  absent. `armada.yaml` and `.opencode/` are armada-owned, always rewritten.
- Prompt templates use `{placeholder}` syntax; a test asserts no dangling placeholders.
- Model IDs are `provider/model` (e.g. `opencode-go/minimax-m3`), never bare names.
- Agent prompts ship terse/caveman output contracts to reduce token burn.
- Agents are native `.opencode/agent/<role>.md` files (frontmatter carries `mode`/`model`/
  `permission`); `opencode.json` stays minimal (`model` + `default_agent: "orchestrator"` +
  `permission.external_directory: deny`, plus `provider.openrouter` for model availability).
  No plugin is required.
- The core fleet model is **subagents + orchestrator, runnable in parallel**: orchestrator
  delegates writes, workers own their slice, independent phases run as background subagents,
  evidence-gated delivery. The orchestrator never ends its turn with background work
  outstanding, never writes code directly, and reads `.opencode/fleet-status.md` on session
  start (hard rules in `agents/orchestrator/prompt.template.md`).
- **Parallel phases need disjoint files.** The orchestrator prompt prefers per-phase file
  isolation (`src/<feature>.js` + its test) so independent phases run in parallel; when a file
  must be shared it serializes writers on a reused subagent session and says so.
- **Autonomous mode:** `armada init --yolo` (or `armada.yaml` `project.yolo: true`) emits
  `permission: { "*": "allow" }` in `opencode.json` + `bash: allow` for orchestrator/qa — no
  permission prompts. Role `edit` boundaries are kept (SDK resolves the most specific rule
  first), so the orchestrator still delegates writes and security/architect stay read-only.
- Opt-in supervision: `armada init --supervision-plugin` (or `armada.yaml`
  `supervision.plugin: true`) emits one `.opencode/plugins/armada-supervision.js` file
  (session.created resume nudge, session.idle no-blind-stop, tool.execute.before shell-redirect
  guard). Default init stays plugin-free.

## Testing

- `node --test 'tests/*.test.js'` — unit + CLI e2e.
- CLI e2e spawns the real CLI (`tests/helpers.js` `runCli`); fake `opencode` binaries are
  injected via PATH (`makeBin`).
- Round-trip: init → parse armada.yaml → init must produce identical output (guards the parser).
- Dogfood: scaffolding over this repo's instruction files must not clobber them.
- Fixture corpus under `tests/fixtures/` exercises stack detection.
- Keep the suite fast and deterministic; no network calls in tests.

## Working here

- TDD: write the failing test first, then implement.
- Roadmap and open work: [TODO.md](./TODO.md). Design decisions: [SPEC.md](./SPEC.md).

## Environment notes

- The team is native opencode agents (`.opencode/agent/*.md`); no plugin is required.

## Superpowers

Do NOT auto-invoke the `subagent-driven-development` (SDD) skill. Ask before using it.
Other superpowers skills (brainstorming, writing-plans, etc.) remain as-is.

<!-- armada:start -->
<!-- Generated by opencode-armada. Do not edit this section manually. -->

# armada-language — Build Rules

These rules apply to every agent working on this project. Generated by opencode-armada.

## The job

Build exactly as specified in [armada/REQUIREMENTS.md](./armada/REQUIREMENTS.md). That document is the
contract: its phases, success criteria and final criteria decide when work is done. When in
doubt, armada/REQUIREMENTS.md wins.

## The team

- **orchestrator** — Delivery lead / scheduler. Model `opencode-go/minimax-m3`.
- **backend-dev** — Backend implementation. Model `opencode-go/deepseek-v4-pro`.
- **frontend-dev** — Frontend implementation. Model `opencode-go/minimax-m3`.
- **qa** — Quality assurance. Model `opencode/mimo-v2.5-free`.
- **adversary** — Adversarial reviewer. Model `opencode-go/deepseek-v4-pro`.
- **security** — Security auditor. Model `opencode/big-pickle`.
- **docs** — Technical writer. Model `opencode/deepseek-v4-flash-free`.
- **architect** — Architecture / code review. Model `opencode/big-pickle`.

Role boundaries are enforced by permissions and are absolute. Do not work around them with
shell commands: if the edit tool would deny a file, do not modify that file any other way.

## Repository conventions

- End-to-end tests live under `armada/e2e/armada-language/`. Only qa writes there.
- Screenshots live under `armada/screenshots/armada-language/`.
- No emojis in code, comments, print statements or logging.
- Keep it simple: small modules, clear names, no defensive programming, no overengineering.
- Prefer popular, well-supported libraries over custom code.

## armada/ledgers/armada-language/DEFECTS.md — the defect ledger

All defects live in `armada/ledgers/armada-language/DEFECTS.md`, one entry per defect, newest
first. Writers: **qa** (create, close, reopen) and **orchestrator** (record developer
responses, reject). Nobody else edits it, ever.

Format, exactly:

    ## DEF-001: Short title

    - Status: OPEN
    - Severity: HIGH | MEDIUM | LOW
    - Found by: qa | adversary (ADV-003)
    - Phase: 3

    Steps to reproduce:
    1. Numbered, specific, starting from app launch.

    Expected: What should happen.
    Actual: What happens instead.
    Screenshot: armada/screenshots/armada-language/def-001.png (optional)

    History:
    - qa: opened

Statuses and who may set them:

| Status | Meaning | Set by |
|--------|---------|--------|
| OPEN | Filed, or reopened after a failed retest or a bounced dispute | qa |
| FIX-READY | A developer reports a fix is in | orchestrator, relaying the developer |
| DISPUTED | A developer reports CANNOT REPRODUCE or WORKING AS INTENDED | orchestrator, relaying verbatim |
| CLOSED | qa retested and confirmed the fix, or accepted the dispute | qa only |
| REJECTED | Will not fix, with a written reason | orchestrator only |

Every status change appends a History line. A defect is never done because a developer says
so — it is done when qa closes it.

## armada/ledgers/armada-language/ADVERSARIAL_REVIEW.md — the adversary's findings

All adversary findings live in `armada/ledgers/armada-language/ADVERSARIAL_REVIEW.md`. Writers: **adversary** (create
entries) and **orchestrator** (fill Disposition). Nobody else.

Format, exactly:

    ## ADV-001: Short title

    - Session: phase-3 gate | final
    - Suggested severity: HIGH | MEDIUM | LOW

    What I did: ...
    Expected: ...
    Actual: ...
    Screenshot: armada/screenshots/armada-language/adv-001.png (optional)

    Disposition: PENDING

The orchestrator replaces PENDING with either `ACCEPTED -> DEF-NNN` or `REJECTED - reason`.
Accepted findings are reproduced and filed in armada/ledgers/armada-language/DEFECTS.md by qa. No entry may remain PENDING
when the final phase completes.

## Phase gates

A phase in armada/REQUIREMENTS.md passes only when its
success criteria are demonstrated by evidence — a passing test run, a screenshot, or both. A
phase starts as soon as the phases it depends on have passed; independent phases run in
parallel as background subagents.

<!-- armada:end -->





