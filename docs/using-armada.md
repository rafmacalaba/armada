# Using armada on any repository

The default use case. You have a project — a landing page, a CLI, a service, or an existing
codebase — and you want a reproducible AI-engineer team to build features in it, or to audit
it. You run `armada init` to scaffold the team into the project, steer the orchestrator, ship.

This is the inverse of [docs/armada-improves-armada.md](./armada-improves-armada.md) — that
doc covers using armada on **armada itself** (dock worktrees); this one covers using armada
on **anything else**.

## Why this works

- **No infra to set up.** The scaffold produces `.opencode/`, `opencode.json`,
  the 8 role prompts, and the fleet CLI (`status`/`scout`/`reconcile`/`fleet`) in one shot.
- **Opinionated team by default.** The `balanced` preset is sane for most
  projects: free workers, paid reviewers where they matter.
- **Contract-driven.** `armada/REQUIREMENTS.md` is the source of truth; phases
  declare dependencies, parallel work runs as background subagents.
- **Built-in accountability.** The per-feature ledgers
  (`armada/ledgers/<feature>/DEFECTS.md` and `.../ADVERSARIAL_REVIEW.md`) keep
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
`armada status` reports where the fleet is.

The orchestrator dispatches the team in **parallel** as opencode-native background subagents:
independent phases, and `backend-dev ∥ frontend-dev` within a phase.

## How you steer it (the co-write conversation)

You don't write code — you talk to the orchestrator. It is the only agent you address; it
delegates everything else.

1. **Attach to the orchestrator.** If you launched `opencode` directly, you're already in it.
   If armada is running on a detached ship (a tmux session — e.g. in a `sandbox/` worktree),
   attach with `tmux attach -t <ship>`. You'll see `Orchestrator · <model>` at the bottom.
2. **Describe what you want.** Say it in plain language — scope, what "done" means, any
   constraints. You can paste a TODO item, a bug report, or a raw wish.
3. **Co-write the contract.** The orchestrator reads `armada/REQUIREMENTS.md` (the current
   feature contract). If it's blank, it **does not build** — it asks you one question at a time
   (scope, users, data, pages), drafts the phases + success criteria, and iterates until you
   **explicitly approve**. No implementation starts against an unapproved contract.
4. **Watch it delegate.** Once approved, the orchestrator dispatches subagents in parallel as
   background jobs. You can watch the panel (`ctrl+x`), but you don't have to — it reports when
   phases pass or it needs a decision.
5. **It comes back to you only for judgment.** Phase gates pass on evidence (tests/screenshots).
   It escalates to you for: contract approval, a real decision it can't make, or a permission
   override. Everything else it resolves itself.

**`--yolo` changes permissions, not this conversation.** Autonomous mode auto-approves *tool*
permission prompts — but the *product decision* (what to build) is still co-written with you,
one question at a time, explicit approval before building. This is the recommended way to run:
`armada init --yolo`, leave the contract blank, and let the orchestrator lead the requirements
interview.

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

Run these in your terminal, not the opencode TUI:

| Command | What it does |
|---------|--------------|
| `armada status [--json]` | Active features, status, next action |
| `armada scout <area>` | Print investigation brief for a code area |
| `armada reconcile` | Resume after an interrupted session (drift list) |
| `armada fleet [session]` | Per-lane progress dashboard |

**Fleet status file (`.opencode/fleet-status.md`):** written by the orchestrator so a killed
session can be resumed. Format: YAML frontmatter (`active_phases`, `last_update`, `next_action`)
plus a short markdown body — one line per active phase (phase, evidence in, status). The
orchestrator reads it on session start (hard rule 3) and on `armada status` / `armada reconcile`.

### Resume after a crash

A killed session — crash, power loss, `SIGKILL`, closed laptop — resumes from state, not from
memory. `armada/state/` is written at every phase transition, so the next session reconciles
and carries on. Run `armada reconcile` whenever you reopen opencode after an interruption,
**before** dispatching anything new: it reports where the fleet stopped and what is outstanding.
It is read-only — reconcile never mutates state.

`armada reconcile` prints one resume line naming the active feature (`<slug>`), the current
phase (`<phase-id>`), and the next action, followed
by one line per evidence drift. Output format per the contract spec (`armada/REQUIREMENTS.md`,
Phase 1):

```
resume: feature demo, phase phase-2 (in_progress), evidence 1 in, next action finish phase 2 criteria

drift: evidence-missing    phase-2 criterion c1    evidence/phase-2/c1.md not found
drift: evidence-failed     phase-2 criterion c2    evidence command exited non-zero
drift: criterion-unticked  phase-2 criterion c3    contract line 12 still unchecked
```

Drifts are reported, never auto-failed: the phase stays open until a human acts. Interpretation
and the one-line fix per kind:

| Drift | Meaning | Fix |
|---|---|---|
| `evidence-missing` | The evidence file a criterion points at is not on disk | Re-run the verification and write the evidence to the referenced path |
| `evidence-failed` | The evidence command for a criterion exited non-zero | Fix the cause, re-run the command until it exits 0 |
| `criterion-unticked` | A criterion on a passed phase is unchecked in the contract | Finish the work, tick the box, re-verify; re-open the phase if work regressed |

Usage:

```
armada reconcile [--json] [--state-dir <path>] [--repo <path>]
```

| Flag | Meaning |
|---|---|
| `--json` | Print the raw `ResumePlan` as JSON instead of the human summary |
| `--state-dir <path>` | Read state from `<path>` instead of `<repo>/armada/state` |
| `--repo <path>` | Repo root for resolving the contract and evidence paths (default: cwd) |

Exit codes: `0` — no drifts, or no active feature (nothing to resume); `2` — one or more
evidence drifts reported. Default (human) output is the resume line plus the drift list;
`--json` emits the raw plan `{ activeFeature, currentPhase, drifts, resumeLine, generatedAt }`.
Reconcile is read-only in all modes.

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

### Per-role configurability

Every `team:` entry accepts three optional fields that tailor a role for this project:
`permissions`, `instructions`, and `prompt`. All three are optional — a manifest without them
scaffolds exactly as before (byte-identical default output, no regression).

**`permissions`** — deep-merged over the role's built-in permission set (`BASE_PERMISSIONS`).
Your rules win; base keys you don't override survive. Values are `"allow"`, `"deny"`, or
`"ask"`, nested to mirror the base structure:

```yaml
team:
  - role: qa
    model: opencode/mimo-v2.5-free
    enabled: true
    permissions:
      bash:
        "npm test*": "allow"
      edit:
        "*": "deny"
```

**`instructions`** — extra prompt text appended to the role's rendered prompt, after the
template body:

```yaml
team:
  - role: docs
    model: opencode/deepseek-v4-flash-free
    enabled: true
    instructions: "Cite file:line for every claim. No emojis."
```

**`prompt`** — path to a custom `prompt.template.md` override, relative to the repo root.
Absent field = bundled template. Missing file = scaffold fails with a clear error
(`custom prompt template not found: <path> (for role <role>)`). Paths stay inside the repo:
no `..` segments, no absolute paths (rejected at schema validation):

```yaml
team:
  - role: security
    model: opencode/big-pickle
    enabled: true
    prompt: custom/security.prompt.template.md
```

All three at once:

```yaml
team:
  - role: backend-dev
    model: opencode-go/deepseek-v4-pro
    fallback: openrouter/deepseek/deepseek-v4-pro
    enabled: true
    permissions:
      bash:
        "npm test*": "allow"
    instructions: "Write the failing test first. Cite file:line in every summary."
    prompt: custom/backend-dev.prompt.template.md
```

**Merge precedence.** `permissions` is a deep merge: your leaf values replace base values
key-by-key, base keys you don't mention survive untouched, and keys only you define are added.
Merge order is stable. The rendered `.opencode/agent/<role>.md` frontmatter carries the merged
`permission` block only — base and override are never visible separately.

**Round-trip.** `armada init --from-armada armada/armada.yaml` preserves all three fields
exactly. Re-scaffold from a configured manifest and you get the same overrides back,
byte-for-byte.

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

### Parallel phases — write disjoint files

The orchestrator runs independent phases as parallel background subagents. The one thing that
forces serialization is **two phases writing the same file** — parallel writers would clobber
each other. When you write the contract, give each phase its own file(s) and independent phases
stay parallel:

```
Phase 1: /about  -> backend-dev writes src/routes/about.js  ∥  frontend-dev writes public/about.html
Phase 2: /admin  -> backend-dev writes src/routes/admin.js  ∥  frontend-dev writes public/admin.html
Phase 3 (depends 1): src/routes/about-team.js
Phase 4 (depends 2): src/routes/admin-settings.js
```

Phases 1 and 2 run in parallel (disjoint files); 3 waits for 1, 4 waits for 2. If phases *must*
share a file, the orchestrator serializes the writers on a reused subagent session and gates each
phase in order — it will say so. The contract names the shape; the orchestrator handles the
collision either way.

### Autonomous mode (`--yolo`)

By default the fleet asks before running shell commands (the orchestrator and qa use `ask`). For
a hands-off run, scaffold with `--yolo` — no permission prompts:

```bash
armada init --yolo
# or set in armada.yaml:
#   yolo: true
```

What it changes:
- Generated `opencode.json` gets `permission: { "*": "allow" }` (auto-approve everything not
  explicitly denied) — so `opencode run` needs no `--auto` flag.
- Orchestrator and qa `bash` become `allow` — the fleet never stalls on a prompt.
- **Boundaries are kept.** The orchestrator still cannot edit code (its `edit: { "*": "deny" }`
  stays — it delegates writes), and security/architect stay read-only. The SDK checks the most
  specific rule first, so the role boundaries survive the catch-all allow.

Run it: `opencode run --agent orchestrator "run armada/REQUIREMENTS.md"` — or launch the TUI and
work hands-on while the fleet dispatches in the background.

### 5. Set sail

Interactive:

```bash
OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true opencode
# then: armada status  # where the fleet is (in another terminal)
```

Then describe the goal in plain language — the orchestrator reads the contract, dispatches
phases, and reconciles results. `armada status` shows where the fleet is.

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

`armada/ledgers/<feature>/DEFECTS.md` and `armada/ledgers/<feature>/ADVERSARIAL_REVIEW.md`
are append-only per-feature ledgers; nothing closes without qa retest or orchestrator
disposition. See [AGENTS.md](../../AGENTS.md) (generated into the project) for the formats.

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

## Fleet dashboard

Every dock you boot with `armada voyage` writes a small JSON progress file under
`~/.armada/runs/<session>.json` (or `$ARMADA_RUNS_DIR` if set). `armada fleet` turns those
files into one table of every active dock:

```
armada fleet            # one row per active dock: ship, dock, phase, status, age, cost
armada fleet --json     # machine-readable, for scripts
armada fleet <session>  # one dock's full detail (state + last pane tail)
```

A heartbeat keeps an entry fresh. Three ways to keep it fresh:

- `armada voyage --heartbeat` — for one-off runs.
- `armada init --fleet-tracker` — opt-in plugin (`.opencode/plugins/armada-fleet.js`) that hooks
  opencode's session lifecycle, so entries stay fresh without extra flags.
- `armada.yaml`: `project.supervision.fleet: true` — same as the flag, set at scaffold time.

A dock shows STALLED when no heartbeat has arrived in the last 2 minutes — the ship likely
died. Re-attach with `tmux attach -t <name>` or restart it with `armada voyage <dock>`.

## Security ledger

Alongside the per-feature `DEFECTS.md` and `ADVERSARIAL_REVIEW.md`, the security role keeps
a third ledger for security findings. Style and shape mirror the
`## armada/ledgers/{feature}/DEFECTS.md — the defect ledger` section in the generated
[AGENTS.md](../../AGENTS.md) (same format block, same status table); the entries are
filed by the security reviewer and disposed by the orchestrator.

- **File location** — `armada/ledgers/<feature>/SECURITY_FINDINGS.md`, one per active
  feature (parallel to `DEFECTS.md` and `ADVERSARIAL_REVIEW.md`). A fresh repo gets the
  same shape under `armada/ledgers/_template/`.
- **Entry format** — `SEC-###` with a short title, one entry per finding, newest first:

    ## SEC-001: Short title

    - Status: OPEN
    - Severity: HIGH | MEDIUM | LOW
    - Found by: security
    - Phase: N

    What I found: ...
    Expected: ...
    Actual: ...
    Screenshot: armada/screenshots/<feature>/sec-001.png (optional)

    History:
    - security: opened

- **Status lifecycle** — OPEN → ACCEPTED → MITIGATED, with REJECTED as the off-ramp.
  The lifecycle:

  | Status | Meaning | Set by |
  |--------|---------|--------|
  | OPEN | New finding, pending review | security |
  | ACCEPTED | Finding confirmed, fix planned | orchestrator |
  | REJECTED | Not a vulnerability / out of scope | orchestrator |
  | MITIGATED | Fix applied and verified | orchestrator |

  Every status change appends a `History:` line. A finding is not closed because the
  reviewer says so — it is closed when the orchestrator marks it MITIGATED (after qa
  retest) or REJECTED with a written reason.

- **Who writes** — **security (frigate) only**. No other agent, including qa or the
  orchestrator, creates entries. The frigate's role prompt and frontmatter `permission`
  grant it write access to `armada/ledgers/*/SECURITY_FINDINGS.md` and nothing else.
- **Who reads** — **corvette (qa) and commodore (orchestrator)**. The commodore
  dispositions: ACCEPT (route to a fix), REJECT (not a real finding, with reason), or
  MITIGATED (after the fix lands and retest passes). The corvette reads to verify the
  fix when a finding flips to MITIGATED. Other roles do not need to read it.

For deeper detail (template rendering, no-clobber, multi-feature isolation) see
`armada/ledgers/{feature}/SECURITY_FINDINGS.md — security findings` in the generated
AGENTS.md of an armed project.

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

## Upgrading an armed repo

For a repo already scaffolded with an older armada, run **`armada update`**. It brings
the repo fully current in one shot: re-scaffolds the armada-owned files (`.opencode/`,
`armada.yaml`) from the manifest AND surgically updates `opencode.json`.

### 1. Update the binary

```bash
npm install -g opencode-armada@latest
# or bump in your package manager
```

### 2. Run `armada update`

```bash
armada update --yes
```

What it does:

- **Re-scaffolds** `.opencode/` (agents, commands, voyage, display names) and `armada.yaml`
  from `armada/armada.yaml`. Same output as `armada init --from-armada` for these files.
- **Merges** only the armada-owned keys into `opencode.json`:
  `model`, `default_agent`, `permission`, and `provider.openrouter.models`.
  **Every other key survives byte-for-byte** — your `$schema`, `theme`, `mcp`, `agent`,
  `keybinds`, etc. are not touched. This is why `armada update` fixes a repo like
  `data-ai-chatbot` that boots `agent=undefined` and dies on a dead top-level model
  without disturbing the rest of the config.

Flags:

| Flag | Effect |
|---|---|
| `--yes` | Apply the changes without prompting. Use in CI / scripts. |
| `--dry-run` | Print the planned changes and exit 0. Writes nothing. |
| `--repo <path>` | Operate on a different repo root (default: cwd). |

The default (no `--yes`, no `--dry-run`) prints the planned changes and asks for
confirmation on a TTY. If stdin is not a TTY and `--yes` is not given, it falls back
to a dry-run + warning so scripts never silently clobber a config.

If `armada/armada.yaml` is missing, the command exits non-zero with a clear message
telling you to run `armada init` first. If `opencode.json` is unparseable, it exits
non-zero without writing — your file is never overwritten with garbage.

### 3. Verify

```bash
armada --version
armada doctor
```

`armada doctor` reports the new state. Re-run the contract to confirm the merge was
clean (or use `armada update --dry-run` first as a preview).

### Conservative alternative: re-scaffold only

If you only want to refresh `.opencode/` + `armada.yaml` and **leave `opencode.json`
untouched**, the older escape hatch still works:

```bash
armada init --from-armada armada/armada.yaml
```

`init` never overwrites an existing `opencode.json` (no-clobber). Use `armada update`
when the `opencode.json` drift is the actual problem; use `armada init --from-armada`
when the opencode.json in the repo is already correct and you just want the rest
brought current.

## Agent identity vs manifest role

The TUI shows an agent's file name as its identity. Armada ships native agents with
the ship name as the file name (`commodore`, `galleon`, `clipper`, `corvette`,
`xebec`, `frigate`, `caravel`, `bark`). The manifest `team[].role` keys stay as the
stable identifiers (`orchestrator`, `backend-dev`, `frontend-dev`, `qa`, `adversary`,
`security`, `docs`, `architect`).

Display names (Commodore, Galleon, etc.) come from `src/role-display.js` `DISPLAY`
map. The ship-name file identity is `DISPLAY[role].toLowerCase()` — see
`agentNameFor()`.

Example: TUI shows "Commodore" because the file is `.opencode/agent/commodore.md`;
the manifest still says `role: orchestrator`.

## See also

- [docs/armada-improves-armada.md](./armada-improves-armada.md) — using armada on *armada itself* (dock worktrees).
- [docs/sandbox.md](./sandbox.md) — venue details: worktrees, scaffold, lifecycle, cleanup.
- [SPEC.md](../../SPEC.md) — manifest schema and contract format.
- [TODO.md](../../TODO.md) — current roadmap.
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — module map and data flow.

> Improving armada itself? Don't use this doc — put it in `sandbox/<name>/` per
> [docs/armada-improves-armada.md](./armada-improves-armada.md). It stays inside the repo,
> ignores cleanly, and skips external-directory permission friction.
