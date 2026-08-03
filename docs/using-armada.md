# Using armada on any repository

The default use case. You have a project — a landing page, a CLI, a service, or an existing
codebase — and you want a reproducible AI-engineer team to build features in it, or to audit
it. You run `armada init` to scaffold the team into the project, drive the orchestrator, ship.

This is the inverse of [docs/armada-improves-armada.md](./armada-improves-armada.md) — that
doc covers using armada on **armada itself** (sandbox worktrees); this one covers using armada
on **anything else**.

## Why this works

- **No infra to set up.** The scaffold produces `.opencode/`, `opencode.json`,
  the 8 role prompts, and the `/armada` command in one shot.
- **Opinionated team by default.** The `balanced` preset is sane for most
  projects: free workers, paid reviewers where they matter.
- **Contract-driven.** `armada/REQUIREMENTS.md` is the source of truth; phases
  declare dependencies, parallel work runs as background subagents.
- **Built-in accountability.** `DEFECTS.md` and `ADVERSARIAL_REVIEW.md` keep
  QA and the adversary honest. No phase closes without evidence.
- **Repeatable.** `armada init --from-armada armada/armada.yaml` regenerates
  the exact same config. Tearing down and re-scaffolding is one command.

## Where to put the project

For an external project, scaffold into a sibling directory **outside** the
opencode-armada repo. Don't put an unrelated project inside the repo — the
scaffolder writes `armada.yaml`, `opencode.json`, and a team of role prompts
that belong to the project being built, not to armada.

If what you're building is an improvement *to* armada itself, use
`sandbox/<name>/` inside the repo instead — see [docs/sandbox.md](./sandbox.md).
This doc covers the external case only.

Convention used for external projects:

```
~/WBG/
├── opencode-armada/                # the scaffolder
├── <sibling>/                      # any sibling directory
│   └── <project>/                  # one project per subdirectory
│       ├── armada/
│       │   ├── armada.yaml
│       │   └── REQUIREMENTS.md
│       ├── .opencode/
│       ├── opencode.json
│       └── AGENTS.md
```

Pick a sibling name that scopes your experiments, e.g. `~/WBG/scratch/` or
`~/code/armada-builds/`. Keep it outside the opencode-armada working tree.

## The trigger

Opening `opencode` inside a scaffolded project **is** the trigger. The orchestrator is a native
primary agent (`.opencode/agent/orchestrator.md`) whose prompt is the full self-contained
delivery protocol; `opencode.json` sets `default_agent: "orchestrator"` so the TUI boots
straight into it. No separate "start armada" step — the protocol is live when the session opens.
`/armada` only reports status.

The orchestrator dispatches the team in **parallel** as opencode-native background subagents:
independent phases, and `backend-dev ∥ frontend-dev` within a phase.

## Build features in the project

### 1. Create the project directory

Pick a sibling of the opencode-armada repo and create a fresh subdirectory for
the new project. No `git init` needed unless you want one.

```bash
mkdir -p ../<sibling>/<project>
cd ../<sibling>/<project>
```

### 2. Choose a manifest

Two ways:

**A. Start from a preset** (fastest, balanced/free/power):

```bash
mkdir -p armada
# copy the preset you want from the armada repo
cp ../../opencode-armada/presets/balanced.yaml armada/armada.yaml
```

Then translate the preset's `agents:` schema to the manifest's `team:` schema
(or just run `armada init --budget balanced --stack <stack>` from the new
project directory and let the scaffolder generate `armada/armada.yaml` for
you — see step 3 option B).

### OpenRouter

Armada uses OpenRouter as the cross-provider model layer: fallbacks in `balanced`,
the whole `power` preset. A scaffolded `opencode.json` registers every OpenRouter model armada
references (with `allow_fallbacks: true`), so they work even if opencode's preloaded OpenRouter
list lags.

- **One-time auth:** in opencode run `/connect` → **OpenRouter** → paste your key, or set
  `OPENROUTER_API_KEY`.
- **Check:** `armada doctor` — an `openrouter auth` check reports the credential (the `power`
  preset needs it).
- **Override a role's model:** in `armada/armada.yaml`, `agents.<role>.model: "openrouter/<slug>"`
  (e.g. `openrouter/~anthropic/claude-sonnet-latest` for the latest alias).
- **Budget tiers:** `armada init --budget free|balanced|power`.

### Fleet commands

Every scaffold ships four in-session commands under `.opencode/commands/`:

| Command | What it does |
|---|---|
| `/armada` | Team status, roles, how to regenerate |
| `/armada-status` | Read `.opencode/fleet-status.md` — active phases, last update, next action |
| `/armada-scout` | Dispatch a read-only investigation (adversary/architect), no writes, no PR |
| `/armada-resume` | Read `.opencode/fleet-status.md`, summarize pending phases, ask the next action |

**Fleet status file (`.opencode/fleet-status.md`):** written by the orchestrator so a killed
session can be resumed. Format: YAML frontmatter (`active_phases`, `last_update`, `next_action`)
plus a short markdown body — one line per active phase (phase, evidence in, status). The
orchestrator reads it on session start (hard rule 3) and on `/armada-status` / `/armada-resume`.

### Opt-in supervision plugin (advanced)

Default `armada init` is plugin-free. For firstmate-grade supervision, enable a single thin
plugin that opencode auto-loads from `.opencode/plugins/` (no install):

```bash
armada init --supervision-plugin
# or set in armada.yaml:
#   supervision:
#     plugin: true
```

It adds one file, `.opencode/plugins/armada-supervision.js`, with three handlers:

| Hook | What it does |
|---|---|
| `session.created` | If `.opencode/fleet-status.md` exists, inject it so a fresh session resumes mid-fleet |
| `session.idle` | Once per session, remind the orchestrator not to end its turn with background work outstanding (no blind stop) |
| `tool.execute.before` | Deny `bash` redirects (`>`, `>>`, `tee`, `sed -i`) targeting files in the orchestrator's `permission.edit` deny set — closes the shell-bypass gap the SDK can't reach |

`armada doctor` reports the plugin's presence when enabled. `armada uninstall` removes it.
The plugin needs no API key and makes no network calls.

**B. Hand-author the manifest** (full control):

```yaml
# armada/armada.yaml
project:
  name: my-project
  budget: balanced
  browserTesting: false
  devcontainer: false
  useAgentBrowser: false
  headless: false
  requirementsFile: armada/REQUIREMENTS.md
  stack:
    frontend: "nextjs"   # or null / "static-html" / "vue" / etc.
    backend: "node"
    database: null
    testing: null
    srcDirs: ["src", "app"]
    languages: ["typescript", "javascript"]
    instructions: []

team:
  - role: orchestrator
    model: opencode-go/minimax-m3
    fallback: openrouter/z-ai/glm-5.2
    enabled: true
  - role: backend-dev
    model: opencode-go/deepseek-v4-pro
    fallback: openrouter/deepseek/deepseek-v4-pro
    enabled: true
  - role: frontend-dev
    model: opencode-go/minimax-m3
    fallback: openrouter/minimax/minimax-m3
    enabled: true
  - role: qa
    model: opencode/mimo-v2.5-free
    fallback: openrouter/xiaomi/mimo-v2.5
    enabled: true
  - role: adversary
    model: opencode-go/deepseek-v4-pro
    fallback: openrouter/deepseek/deepseek-v4-pro
    enabled: true
  - role: security
    model: opencode/big-pickle
    fallback: openrouter/deepseek/deepseek-v4-pro
    enabled: true
  - role: docs
    model: opencode/deepseek-v4-flash-free
    fallback: openrouter/deepseek/deepseek-v4-flash
    enabled: true
  - role: architect
    model: opencode/big-pickle
    fallback: openrouter/deepseek/deepseek-v4-pro
    enabled: true
```

Required roles are `orchestrator` + at least one specialist. Disable the rest
with `enabled: false` if you don't need them.

### 3. Scaffold the team

From the new project directory:

```bash
# from a hand-authored manifest
node /path/to/opencode-armada/src/cli.js init --from-armada armada/armada.yaml

# OR let the scaffolder generate the manifest from presets + stack detection
node /path/to/opencode-armada/src/cli.js init --stack <stack> --budget balanced
```

What you get:

```
.opencode/agent/<role>.md                # 8 native agents (mode/model/permission in frontmatter)
.opencode/commands/armada.md             # /armada slash command
opencode.json                            # model + default_agent + external_directory deny
AGENTS.md                                # team rulebook
armada/armada.yaml                       # source of truth
armada/REQUIREMENTS.md                   # contract (draft, you co-write)
```

Verify:

```bash
node /path/to/opencode-armada/src/cli.js doctor   # env health
node /path/to/opencode-armada/src/cli.js ping     # sanity
```

### 4. Co-write the contract

`armada/REQUIREMENTS.md` is the contract. The scaffolder writes a stub; you and
the orchestrator iterate until it's approved. **No implementation starts
against an unapproved contract.**

A good contract has:

- **Success criteria** — measurable, per phase and at the end.
- **Phases** — each with `Depends on:`, `Goal:`, and a checklist of
  `Success criteria:`. Independent phases run in parallel.
- **Final criteria** — what "done" means across the whole project.
- **Constraints** — non-functional requirements (a11y score, no deps,
  response time, etc.).

Template:

```markdown
# my-project — Requirements

> The contract. Co-write with the orchestrator.

## Success criteria
- [ ] ...

## Phases

### Phase 1 — Foundation
- **Depends on:** none
- **Goal:** ...
- **Success criteria:**
  - [ ] ...

### Phase 2 — ...
- **Depends on:** Phase 1
- **Goal:** ...
- **Success criteria:**
  - [ ] ...

## Final criteria
- [ ] Every phase success criterion is demonstrably true.
```

### 5. Drive the team

Interactive:

```bash
OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true opencode
# then: /armada
```

Then either describe the goal in plain language (the orchestrator will read the
contract, dispatch phases, and reconcile results) or run an explicit
`/armada <phase>` to drive a specific phase.

Headless / CI-safe:

```bash
armada init --headless                     # writes headless: true into the manifest
OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true opencode run \
  "Read armada/REQUIREMENTS.md, run Phase 1, write evidence to evidence/phase-1.md."
```

In `opencode run` (one-shot), use **inline** subagent dispatch — background
results land after the orchestrator's turn ends, so they don't reconcile in
the same session. The `worktrees` and `deepwork` skills are not needed here;
this is a single-repo project.

### 6. Phase gates

Each phase closes only when its success criteria have evidence:

- A passing test run (`node --test`, `pytest`, `go test`, etc.).
- A screenshot (visual changes).
- A file/line citation (research phases).
- A command transcript (operational phases).

Evidence goes under `evidence/<phase>/` (or wherever the contract specifies).
The orchestrator won't advance a phase without it.

`DEFECTS.md` and `ADVERSARIAL_REVIEW.md` are append-only ledgers; nothing
closes without qa retest or orchestrator disposition. See
[AGENTS.md](../../AGENTS.md) (generated into the project) for the formats.

### 7. Ship and clean up

When the contract's final criteria are met:

```bash
# tear down the team (optional — the project is yours to keep)
node /path/to/opencode-armada/src/cli.js uninstall
# keep the project; remove only the scaffolding if you want
git init && git add . && git commit -m "feat: initial scaffold"
```

`uninstall` removes `armada.yaml` and armada-owned `.opencode/` files. It does
not touch `opencode.json` or `AGENTS.md` (no-clobber for user files). For a
hard reset:

```bash
node /path/to/opencode-armada/src/cli.js uninstall --all
```

## Audit an existing repo

Same scaffold, different intent: the team reviews the codebase and files findings — no code
changes. Works on any repo you can `armada init` into.

### Run it

```bash
# from the target repo root
node /path/to/opencode-armada/src/cli.js init --yes --headless --budget balanced
opencode
```

Then hand the orchestrator the audit task:

```
Audit this repository for quality and security. Scope: <src dirs, key files>.

Dispatch in parallel:
- security → vulnerability/authz audit
- architect → cross-cutting review of the core modules
- adversary → hostile review of the public surface (CLI flags, API, error paths)
- qa → run the test suite, verify it is green and meaningful

Each returns findings in-response (read-only reviewers cannot write files).
Reconcile: file each real finding in AUDIT.md with severity + file:line,
separating bugs from improvements. Do not change code.
```

Read `AUDIT.md`, file real findings in your own issue tracker or TODO, fix with TDD. Clean up
with `uninstall` when done.

### Audit vs build

| | Build | Audit |
|---|---|---|
| Contract | co-write `armada/REQUIREMENTS.md` | none — read-only |
| Deliverable | code + evidence | `AUDIT.md` findings |
| Team | all roles per phase | security/architect/adversary/qa, parallel |
| Cleanup | keep or `uninstall` | `uninstall` |

## Variants

- **Budget tier** — `free` for zero-cost runs, `balanced` (default) for the
  recommended mix, `power` when the work justifies paid models for every role.
- **Stack detection** — pass `--stack <s>` to let the scaffolder pick sensible
  roles and tools. Omit it to use whatever is in the manifest.
- **Headless** — `--headless` for CI / `opencode run`; orchestrator bash goes
  from `ask` to `allow` and no human gates are needed.
- **Browser testing** — `--browser-testing` enables the `qa` agent's
  screenshot tooling (Playwright/Puppeteer).
- **Devcontainer** — `--devcontainer` writes a `.devcontainer/` so the project
  opens identically in Codespaces or local Docker.

## Worked example

End-to-end: pick a small side project (a CLI tool, a static site, a one-off
script) and run through this doc once. Start at step 1, end at `uninstall`.
Repeat until the loop feels mechanical.

## See also

- [docs/armada-improves-armada.md](./armada-improves-armada.md) — using armada on *armada itself* (sandbox worktrees).
- [docs/sandbox.md](./sandbox.md) — venue details: worktrees, scaffold, lifecycle, cleanup.
- [SPEC.md](../../SPEC.md) — manifest schema and contract format.
- [TODO.md](../../TODO.md) — current roadmap.
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — module map and data flow.

> Improving armada itself? Don't use this doc — put it in `sandbox/<name>/` per
> [docs/armada-improves-armada.md](./armada-improves-armada.md). It stays inside the repo,
> ignores cleanly, and skips external-directory permission friction.
