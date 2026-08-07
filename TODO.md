# armada — TODO / Roadmap

Living backlog. Pick up the next item in the next session. Add new ideas at the bottom and
link them to an issue/PR when relevant.

---

## Wave plan — implementation order (dependency-first)

Execution plan for the **open** backlog, ordered by dependencies not priority. Each wave lands
before the next; lanes within a wave run in parallel (disjoint files). Exhaustive list of what is
still unimplemented (all items below still have open `[ ]` specs — shipped items are marked in the
sections further down).

### Wave 0 — shipped (2026-08-03)

All in-flight lanes merged. `feat/fleet-dashboard` (#59), `feat/artifacts-under-armada` (#58),
`feat/landing-page-armada` (#15), `feat/audit` (#17), `feat/real-repo-validation` (#53).

### Wave 1 — foundations (shipped 2026-08-03/04)

- [x] **PR-first finish** (#65). Orchestrator hard rule 6 (PR before done, never local
  merge/push), contract final criterion, `prUrl` in state + status output, docs Finish section,
  tests. Stacked-PR part of the spec not built (gh-stack extension still unmanaged).
- [x] **Fleet terminology + role display names** (#63). Ship-type display map
  (`src/role-display.js`: Commodore/Galleon/Clipper/Corvette/Xebec/Frigate/Caravel/Bark),
  the old two-mode names (audit/feature lanes) -> patrol/voyage, sandbox -> dock,
  `armada drive` -> `armada voyage` (alias kept).
- [x] **Lane-drive completion — wezterm-baseline** (#66). Docs + `--term` surface default to
  wezterm-first; per-OS emulators fallback. Terminal-open logic was already wezterm-preferred.
- [x] **Multi-feature via worktrees** (#67). `armada feature new --worktree` creates
  `sandbox/<name>` on `feat/<name>`, list/close worktree-aware.
- [x] **Stable AGENTS.md block** (#68). Generated armada block uses repo identity in the header,
  `{feature}` token in paths — parallel lanes no longer conflict on AGENTS.md.
- [x] **Drive reliability fixes** (#62). `--help` handled, boot modals dismissed repeatedly,
  resident-heartbeat notice.
- [x] **Global binary + doctor check** (#64). `armada doctor` reports global-binary health;
  broken npm-link-to-deleted-worktree root cause fixed.
- [x] **commodore-watchdog** — opt-in subagent watchdog plugin (`--watchdog` /
  `supervision.watchdog`); nudges the orchestrator when a dispatched subagent has been pending
  past `TIMEOUT_MS` (5 min) AND the orchestrator has been idle for `STALENESS_WINDOW_MS`
  (2 min).

### Wave 2 — first consumers (parallel)

- [ ] **Skills integration** (spec below). Requires: per-role configurability (shipped #52).
  Files: `src/skills/`, generator, manifest, prompts.
- [x] **Security findings ledger** (#58). Shipped in `feat/artifacts-under-armada` + `src/ledgers.js`.
  Per-feature `SECURITY_FINDINGS.md` schema, generator rendering, and security prompt integration.

### Wave 3 — systemic self-improvement (sequential)

- [ ] **Prompt-optimization feedback loop** (spec below). Requires: artifacts layout + prompt
  infra. Files: `armada/findings/`, all subagent prompts, docs digest.
- [ ] **Self-improvement issue posting** (spec below). Requires: feedback-loop digest + PR-first
  `gh` flow. Files: `src/issue-report.js`, orchestrator prompt, manifest.

Shared orchestrator-prompt + findings files → sequence, don't parallelize.

### Wave 4 — product surface + cleanup (parallel)

- [x] **Re-evaluate 8-role roster** (#96). Shipped: "Meet the Fleet" roster, role display mapping,
  and SDK-enforced permission matrix (`edit: deny` for orchestrator, security, architect).
- [ ] **Dashboard `--watch` TUI follow-up** (fleet-dashboard spec). Requires: fleet-dashboard
  (shipped #59) + wezterm baseline (shipped #66). Files: `src/fleet-tracker.js`,
  `armada fleet --watch`.

### Wave 5 — deferred

- [ ] **Multi-harness** (spec below). Last by design; nothing depends on it. Note: spec body to
  write.

---

## Backlog — prioritized

Open work, ordered by value. Pick up the top item in each band first. Sections further down
are history.

### Quick wins

Small, low-risk, high-leverage. Do first.

- [x] **Mark restart-proof reconcile done.** PR #44 (`4b2c17b`) shipped the engine, CLI,
  `/armada-resume`, e2e. Update the ledger (done below) and confirm the generated-repo path —
  see the resume-reachability spec under High.
- [x] **`armada models --list-openrouter`** — show the live model list from the OpenRouter API
  for pick-your-own workflows. Shipped 2026-08-03.
- [x] **`(Recommended)` catalog marker** — flag only the true first-choice model per budget
  tier in `models` output, not every option. Shipped 2026-08-03.
- [x] **Init end summary** — after `init`, emit models chosen, cost hint per tier, next steps.
  Shipped 2026-08-03.
- [x] **`armada preset <name>`** — apply a preset to an existing manifest (`armada preset power`).
  Shipped 2026-08-03.
- [x] **`renderCatalog` auto-size columns** — replace hardcoded padding with computed widths.
  Shipped 2026-08-03.
- [x] **Lane drive — TUI-ready handshake + auto-open visible terminal.** New
  `armada drive <lane-path>` subcommand: boots a tmux session, polls the TUI prompt
  bar, sends the drive prompt, verifies registration, retries once. Auto-opens a
  visible terminal (Terminal.app/iTerm, gnome-terminal/konsole/x-terminal-emulator
  /wezterm, Windows Terminal/wezterm). `--no-open` for CI; headless falls back to
  a `tmux attach` hint without failing the drive. Shipped 2026-08-03.

### High

The improvements that unlock the durable-implementation vision.

- [x] **PR-first finish — never local merge or direct push after a feature lane.** After a
  feature implementation runs, the lane's work must end in a **pull request** — not a local
  `git merge`, not a direct push to master, not "done" without a PR. Shipped in #65: orchestrator
  hard rule 6 (PR before done, never local merge/push), contract final criterion, `prUrl` in
  state + `/armada-status`, docs Finish section, tests. Stacked-PR follow-up (gh-stack) not built.
- [x] **Lane drive — TUI-ready handshake + auto-open visible terminal** — spec below. Drive a
  lane without swallowing the prompt (poll `tmux capture-pane` for the TUI input bar, verify the
  drive prompt registered, resend once) and auto-open a visible terminal attached to the
  session. **Use wezterm (https://github.com/wezterm/wezterm) before anything else if possible** —
  it is the one cross-platform (macOS/Linux/Windows) terminal that can host an attached tmux
  session; prefer it when installed, fall back to per-OS defaults
  (Terminal.app/iTerm, x-terminal-emulator, Windows Terminal), `--no-open` for headless.
  Shipped in #52 (`armada drive`) + #55 (tab in primary terminal). Residual: wezterm-baseline
  refactor — see the Wave plan.
- [ ] **Skills integration** — spec below. Ships fleet skills into generated repos and lets
  every role consume them. (User priority: HIGH.)
- [x] **Per-role configurability** — spec below. Manifest-level `permissions`, `instructions`,
  optional custom `prompt` per role. Closes the "are the prompts optimal?" gap.
  Shipped in #52.
- [x] **Validate in a real repo — `~/WBG/data-ai-chatbot`** (fastapi + nextjs). Confirm stack
  detection, native agents load (`opencode agent list`), background orchestration
  (`OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true`), tune prompts against real conventions,
  verify `/armada` shows the team. File results in `docs/validation.md`.
  Shipped in `feat/real-repo-validation`; live-target re-scaffold + walkthrough is a user-side
  step; see `docs/validation.md` "Real-repo validation".
- [x] **Restart-proof resume in a generated repo** — spec below. Make `/armada-resume` work
  outside armada's own source tree; then kill a session mid-feature in data-ai-chatbot and
  verify resume + no state loss.
  Shipped in `feat/real-repo-validation`; in-tree reconcile verified, evidence-target reconcile
  verified, manual walkthrough at `armada/state/evidence/phase-2/manual-walkthrough.md`.

### Medium

Bigger features, well-specified, sequenced after the High items.

- [x] **`armada new` — cookiecutter-inspired repo generator.** Replace the stub. Template set
  `starter/<category>/` (AGENTS.md, README, LICENSE, .gitignore, CI, test bootstrap,
  package.json/pyproject.toml, optional devcontainer, `starter.yaml` metadata);
  `armada new <name>` with category picker (web-app / cli-tool / api-service / ml-training /
  research-paper / library) + `{placeholder}` fill; beginner (curated defaults) vs experienced
  (drill-down: package manager, monorepo, auth, deploy target, CI) paths; non-interactive
  `--type <cat> --beginner|--yes`; post-scaffold handoff (`armada init` team flow into the
  fresh repo); tests (template render with no dangling placeholders, catalog integrity, CLI
  e2e: new repo → detectStack → team scaffolds). Shipped in #36 (`src/new-command.js` +
  `starter/{web-app,ml-training,research-paper}/`).
- [x] **Multi-feature via worktrees** — `armada feature new --worktree` creates a
  `git worktree` per feature (`git worktree add sandbox/<feature>`, per-feature branch);
  `feature list` shows each worktree; zero cross-feature clobber. Shipped in #67
  (`src/feature-commands.js` + `src/cli.js` `featureCmd` + e2e under `armada/e2e/worktree-features/`).
- [x] **Arrow-key questionnaire** — `select`/`multiSelect`/`confirm` in `src/ui.js` already ship
  this; questionnaire uses them. Shipped 2026-08-03.

### Low

Design re-evaluations, model hygiene. Not urgent.

- [x] **Re-verify model IDs** against current opencode / OpenRouter availability before the next
  publish. Catalog: `opencode-go/minimax-m3`, `opencode-go/deepseek-v4-pro`,
  `opencode/mimo-v2.5-free`, `opencode/deepseek-v4-flash-free`, `opencode/big-pickle`,
  `opencode-go/hy3`, `opencode-go/deepseek-v4-flash`. OpenRouter fallbacks: `z-ai/glm-5.2`,
  `minimax/minimax-m3`, `xiaomi/mimo-v2.5`, `deepseek/deepseek-v4-pro`, `anthropic/claude-sonnet-4.6`.
  Shipped 2026-08-03. All 11 catalog IDs verified live; zero NOT FOUND.
  Generator audit PASS. No catalog edits required. Contract listed `opencode-go/deepseek-v4-flash`;
  catalog uses `opencode/deepseek-v4-flash-free` (both live; contract text is a snapshot from
  before the catalog was finalized).
- [x] **Re-evaluate the 8-role roster** against real multi-agent sessions — shipped in #96:
  "Meet the Fleet" roster, role display mapping, and SDK-enforced permission matrix (`edit: deny` for orchestrator, security, architect).
- [x] **Security findings ledger** — shipped in #58 (`feat/artifacts-under-armada` + `src/ledgers.js`):
  per-feature `SECURITY_FINDINGS.md` ledger schema, generator rendering, and security prompt integration.

### Deferred

- [ ] **Multi-harness support** (codex, claude code). When tackled: per-harness renderers
  (`renderOpencodeAgent` / `renderCodexAgent` / `renderClaudeCodeAgent`) + `--harness <name>`.
  Reference (OpenRouter cookbook): `codex-cli`, `opencode-integration`,
  `claude-code-integration`. The robust-opencode tiers make opencode the reference
  implementation; multi-harness layers on top without weakening it.

---

## Backlog specs — new improvements

### Skills integration (HIGH)

Armada ignores opencode's skill system: generated repos ship no `.opencode/skills/`, no prompt
mentions skills, no role sets `permission.skill`. All agents (incl. subagents) already get the
`skill` tool by default and can load skills on demand via `skill({name})`, so this is latent
capability waiting for wiring.

**Live evidence (2026-08-03, lane-drive):** a qa subagent in the sandbox (which ships zero
skills — `.opencode/skills/` does not exist) independently loaded the globally-installed
`verification-before-completion` skill from `~/.config/opencode/skills/`. The plumbing already
works for free: agents self-select the right skill the moment one exists. The gap is purely that
armada ships no armada-specific skills and never steers roles toward them.

- [ ] **Targeted implementation built on that evidence.** Because the `skill` tool + global
  skill discovery already work with zero armada wiring, the minimal high-value move is: ship the
  starter set and let the orchestrator steer — no need to invent discovery. The
  `verification-before-completion`-style self-selection is the proof: an agent loads a skill
  whose `description` matches its task. So armada's job is (a) make its own skills available,
  (b) mention them in prompts so they get picked, (c) pin `permission.skill` only where we want
  to deny. Everything else is already opencode's default.
- [ ] **Starter skill set.** `src/skills/` ships 2–3 armada-specific SKILL.md files (each with
  valid `name` + `description` frontmatter), e.g. `armada-contract` (co-write / iterate a
  requirements contract one question at a time) and `armada-gate` (evidence-gate checklist:
  test run + screenshot per success criterion). Generator renders them into
  `.opencode/skills/<name>/SKILL.md`.
- [ ] **Manifest control.** `armada.yaml` gains `skills:` (list of skill names to ship; default
  ON with the starter set, off when the list is empty). Round-trips through
  `armada init --from-armada`.
- [ ] **Per-role `permission.skill`.** Explicitly set in `BASE_PERMISSIONS`: orchestrator +
  workers + qa `allow`; read-only roles (docs/architect/security) default (opencode enables all
  tools unless denied — only pin where we want `deny`/`ask`).
- [ ] **Prompts reference the skills.** Orchestrator prompt: "dispatch specialists with the fleet
  skill loaded when it applies (`armada-contract` for contract work, `armada-gate` when gating
  a phase)". Workers: read the SKILL.md when the task matches.
- [ ] **Tests.** Renderer emits valid SKILL.md (name matches `^[a-z0-9]+(-[a-z0-9]+)*$`,
  description present, no dangling placeholders); round-trip preserves `skills:`; generated
  agent frontmatter carries `permission.skill` where set; dogfood no-clobber still holds.
- [ ] **Acceptance evidence.** A generated-repo run where a worker self-loads an armada skill
  (mirror the observed lane-drive behavior) — captured in `docs/validation.md`.

### Per-role configurability (HIGH)

The gap behind "are the prompts optimal?": prompt text is one fixed template per role,
permissions are hardcoded in `BASE_PERMISSIONS` (`src/generator.js:11`), and armada.yaml
serializes only role/model/fallback/enabled (`src/generator.js:503`).

- [x] **Manifest fields.** `team:` entries gain optional:
  - `permissions:` — deep-merged over `BASE_PERMISSIONS[role]` (user rules win; e.g.
    `edit: { "scripts/*": "deny" }`, `bash: "deny"`)
  - `instructions:` — extra prompt text appended to the role's prompt (per-project
    conventions, e.g. backend-dev: "use FastAPI, keep handlers in src/")
  - `prompt:` — path to a custom `prompt.template.md` override (falls back to the bundled
    template)
- [x] **Generator.** Merge in `buildTeam` (`structuredClone` base, apply overrides in order),
  render `permissions` into agent frontmatter, append `instructions` to the prompt body,
  resolve `prompt` path.
- [x] **Round-trip.** armada.yaml serialization writes these fields back so
  `init --from-armada` is idempotent.
- [x] **Tests.** Manifest schema accepts the fields; merge precedence (user > base); render
  includes them; round-trip equality; a fixture with a custom template.

### Restart-proof resume in a generated repo (HIGH)

`/armada-resume` runs `node src/cli.js reconcile` (`src/generator.js:388`) — that file only
exists inside armada's own source tree. A generated repo (e.g. data-ai-chatbot) has no
`src/cli.js`; the orchestrator there cannot resume from `armada/state/` on its own.

- [x] **CLI reachability.** Make reconcile a subcommand of the installed/global `armada` binary
  (`armada reconcile`), callable from any armada-armed repo. `/armada-resume` command body uses
  `armada reconcile` (global) with `node src/cli.js reconcile` as the in-tree fallback. Merged
  2026-08-03 (feat/resume-reachable).
- [x] **Verify in a generated repo.** In `~/WBG/data-ai-chatbot`: init, open a feature, kill the
  session mid-phase, `armada reconcile` prints the resume line + drift list, resume completes,
  no state loss. Shipped in #53 (real-repo validation + resume walkthrough, docs/validation.md).
- [x] **Tests.** CLI e2e with a fake `armada` binary on PATH (existing `makeBin` pattern);
  command renderer emits the new body; reconcile engine regression stays green. Merged
  2026-08-03 (feat/resume-reachable).

### PR-first finish — no local merge, no direct push after a feature lane (HIGH)

A feature lane is done only when its work is a **reviewed pull request**, never a local
`git merge` or a direct push to master. The docs already say this (`docs/armada-improves-armada.md`
Finish: "never `git merge` locally, never push master directly… every armada feature lands as a
reviewed PR"), but the fleet keeps finishing lanes without the PR step — the orchestrator ends
with tests green and either merges locally or calls it done, so work lands unreviewed. Make
PR-first the enforced final gate, not a documented wish.

- [ ] **PR is a phase/final gate in the contract.** Contracts that build armada itself get a
  final criterion: "work lands as `gh pr create --base master` from the lane branch — never
  `git merge` locally, never push master." The orchestrator prompt adds a hard rule: when a
  feature's final criteria are met, the last step before reporting done is creating the PR (or
  explicitly flagging "PR blocked: <reason>" if the remote isn't reachable). No "done" without
  a PR URL or a stated blocker.
- [ ] **Evidence is the PR.** The `docs/armada-improves-armada.md` Finish section changes so the
  orchestrator/qa's final evidence includes the PR link. `/armada-status` and the fleet-status
  file report the PR URL once opened.
- [ ] **Guard against local merge/push.** A grep/script test (or orchestrator hard rule) that no
  armada-armed repo ends a feature lane with a local `git merge` into master or a direct `git
  push origin master`. If a human merges, that's theirs — the fleet never does it.
- [ ] **Docs + TODO reflect the rule.** `docs/armada-improves-armada.md` and `AGENTS.md` already
  carry it; tighten the orchestrator prompt and add the tracker note so the PR URL is visible in
  the fleet dashboard (job-visibility spec below).
- [ ] **Tests.** Prompt test asserts the PR-first hard rule exists; docs grep test that the
  Finish section says "PR" not "merge locally"; e2e that a completed lane prints a PR URL or a
  blocker before finishing.
- [ ] **Stacked PRs (GitHub-native).** GitHub ships stacked PRs — a chain of dependent PRs where
  each targets the branch below it, mergeable bottom-up (docs: about-stacked-prs,
  stacked-prs-quickstart). The `gh stack` extension (public preview) manages the local flow:
  `gh extension install github/gh-stack`, then `gh stack init/add/submit/sync/rebase/merge`
  (reference: stacked-prs-cli-commands). For armada's parallel lanes (each its own branch on
  master), this is a natural fit when lanes depend on each other — e.g. lane-drive builds on
  resume-reachable, which already merged; a future chain would be
  `feat/lane-drive → feat/fleet-tracker`, each base = the branch below. Considerations:
  - Armada's lanes today are independent branches off master (parallel, not dependent). Stacking
    only applies when lane B depends on lane A's unmerged code — otherwise independent PRs stay
    independent.
  - `gh stack submit --auto` opens a PR per branch + links them into a stack; `gh stack merge`
    merges bottom-up in one all-or-nothing op (cannot bypass branch protection).
  - PR-first finish spec above gains: when lanes are dependent, open them as a stack (`gh stack
    init` + `submit`) instead of sequential PRs; when independent, plain `gh pr create` each.
    The orchestrator PR gate says "stacked when dependent, separate when not".
  - Fleet-agent note: GitHub advertises a `gh-stack` skill for agents (agents can create/manage
    stacks programmatically) — evaluate wiring it into the orchestrator's PR-first step.

### Lane drive — TUI-ready handshake + auto-open visible terminal (HIGH)

Driving a lane is manual + racy: `tmux new-session -d` → `sleep` → `send-keys` swallows the
drive prompt if the TUI isn't up yet, and the lane is invisible until someone attaches. Make
lane driving reliable and watchable. Live lane: `feat/lane-drive` in `sandbox/lane-drive`.

- [x] **TUI-ready handshake.** A drive script/command polls `tmux capture-pane` until the opencode
  TUI's input bar is visible (footer shows `tab agents` / `ctrl+p`), with a timeout; then sends
  the drive prompt; verifies it registered (pane flips to `thinking`); resends once on miss;
  exits non-zero with the pane tail on timeout. Idempotent session names (never clobber an
  existing session).
- [x] **Auto-open visible terminal — wezterm first.** Open a visible terminal attached to the
  lane session. **Preferred: wezterm** (https://github.com/wezterm/wezterm) — the one terminal
  that's truly cross-platform (macOS/Linux/Windows) and can host an attached tmux session. Use it
  whenever it's installed. Fall back per-OS: macOS Terminal.app/iTerm, Linux
  `x-terminal-emulator`/`gnome-terminal`/`konsole`, Windows Terminal. `--no-open` (headless/CI)
  prints the `tmux attach -t <name>` hint instead — never fails the drive.
- [x] **Tab in the primary terminal, not a new window.** The current auto-open *spawns a fresh
  terminal window* (macOS `osascript do script`, Linux `gnome-terminal`/`konsole` launch) — which
  looks like a rogue process popping a window (the "virus installation vibes"). If the user is
  already sitting in a terminal (they almost always are — they ran the drive command from one),
  the right move is to open a **new tab in that primary terminal**, not a second window:
  - macOS: AppleScript `tell application "Terminal" to do script ... in front window` (tab) when
    Terminal is already the frontmost app, or iTerm's `--title`/tab handling; fall back to a new
    window only when no terminal is open.
  - Linux: `x-terminal-emulator --tab` / `gnome-terminal --tab` / `konsole --new-tab` when the
    emulator is already running; `wezterm` natively reuses its daemon (`wezterm start` with an
    existing server spawns a tab in the current wezterm instance).
  - Windows: `wt new-tab` (already a tab — keep).
  - Detection rule: if the drive command is running under a terminal we can address (TERM_PROGRAM
    env: `iTerm.app`, `WezTerm`, `vscode`, etc.), target that; otherwise fall back to current
    behavior. This keeps it invisible-and-native instead of spawning windows.
  Shipped 2026-08-03.
- [x] **Refactor to wezterm as the baseline** — wezterm-first proved out; docs + `--term`
  surface now present wezterm as the default recommendation, per-OS emulators as fallback.
  Shipped in #66 (`docs/armada-improves-armada.md`, `docs/sandbox.md`, `DRIVE_HELP`).
- [x] **Tests.** Terminal-opening logic is a pure module (OS detect + command builder) with unit
  tests; the handshake is tested against a fake `tmux` binary on PATH (`makeBin` pattern) or
  marked integration-only if unfakeable.
- [x] **Docs.** `docs/armada-improves-armada.md` + `docs/sandbox.md` updated to the new drive step.

### Fleet terminology (glossary) — retire "Lane A" / "Lane B" (SHIPPED #63)

Shipped 2026-08-03 in `feat/armada-language` (#63): the old audit/feature lane names -> voyage
and patrol, sandbox/<name> -> dock, `armada drive` -> `armada voyage` (alias kept). Docs +
user-facing strings refactored; glossary table in README. Spec below retained for reference.

Old terminology: the repo names the two self-improvement modes **Lane A (audit)** and **Lane B (feature)**.
The metaphor is generic and the naming doesn't echo the armada/fleet identity the tool actually
ships. Ideate a coined set and refactor docs + code to it.

Candidate vocabularies (pick or blend):

- **Ships / voyages.** A lane → a **ship** (or **vessel**); the worktree it runs in → its
  **harbor/slip** (`sandbox/<name>`); driving it → **casting off**; the run → a **voyage**;
  completing a lane → **docking**; a killed-then-resumed run → **returning to port**; the
  orchestrator → **captain**; the fleet → **the armada** (already). Audit runs →
  **inspection/patrol voyage**; feature runs → **construction voyage**.
- **Deployments / missions.** A lane → a **mission**; the worktree → the **launchpad**; driving
  → **launching**; the audit → a **patrol**; the feature → a **build mission**.
- **Regiments / patrols.** A lane → a **patrol**; feature work → **deployment**; audit →
  **inspection**. Weaker fit; armada/fleet metaphor already saturates the domain.

Suggested target (blend of the top candidates):

- Old terminology: `Lane B` → **voyage** (a feature-implementation run)
- Old terminology: `Lane A` → **patrol** (a recurring audit run)
- `sandbox/<name>` → **dock** (docs still say "sandbox"; `dock` is a drop-in)
- `drive the contract` → **set sail** (or keep "drive" — less jokey)
- tmux session name → **ship name** (already the feature name)

Refactor scope:

- [ ] **Docs.** `docs/armada-improves-armada.md` (two-mode skeleton, patrol / voyage sections),
  `docs/sandbox.md`, `docs/using-armada.md`, `README.md`, `AGENTS.md` — swap the coined terms,
  keep a one-line glossary for the old names.
- [ ] **Code.** (Old terminology) Any user-facing strings ("lane", "Lane B") in `src/` (commands, help text,
  scaffold output) and the orchestrator prompt (`agents/orchestrator/prompt.template.md`).
  Keep CLI flags/commands stable (`armada feature`, worktree branches) — renaming the *concept*,
  not the plumbing.
- [ ] **Decide, don't bikeshed.** Pick the term set in one brainstorming pass, then refactor
  mechanical. If the fleet itself builds this, it's a small docs+strings contract.
- [ ] **Tests.** (Old terminology) Grep-based test that no doc or generated artifact still says "Lane A"/"Lane B"
  after the refactor (or a documented glossary exemption).

### Team role names — armada terms for the roster (SHIPPED #63)

Shipped 2026-08-03 in `feat/armada-language` (#63): ship-type display map in
`src/role-display.js` — Commodore/Galleon/Clipper/Corvette/Xebec/Frigate/Caravel/Bark for
orchestrator/backend-dev/frontend-dev/qa/adversary/security/docs/architect. Display-layer only;
role keys untouched. Spec below retained for reference.

The 8-role roster is plain-engineering: `orchestrator`, `backend-dev`, `frontend-dev`, `qa`,
`adversary`, `security`, `docs`, `architect`. Clear, but it reads like a generic agent library,
not an armada. Pairing this with the fleet-terminology spec above, ideate coined role names so
the whole product — roster, lanes, worktree — speaks one language. Roles are the product
surface (init output, `/armada`, agent browser), so this is user-visible, not just docs.

Candidate vocabularies (pick or blend):

- **Navy rank / function.** orchestrator → **captain**; backend-dev → **engineer** (or **first
  mate** for a co-owner); frontend-dev → **navigator** (or **helmsman**); qa → **harbor master**;
  adversary → **boarding party** (hostile inspection); security → **sentry** (or **armorer**);
  docs → **scribe**; architect → **master builder** (or **naval architect**).
- **Ship's crew.** orchestrator → **captain**; backend-dev → **engineer**; frontend-dev →
  **helmsman**; qa → **inspector**; adversary → **ship's doctor** (no — adversarial, so more
  like **rival captain**); security → **watchman**; docs → **chronicler**; architect → **naval
  architect** (already armada-flavored).
- **Fleet operations.** orchestrator → **commander**; workers → **crew**; qa → **dockmaster**;
  adversary → **raider**; security → **coast guard**; docs → **cartographer**; architect →
  **planner**.

Suggested target (navy-rank blend — strongest echo of "armada"):

- `orchestrator` → **captain** (role name AND the `default_agent`; `mode: primary`)
- `backend-dev` → **engineer**
- `frontend-dev` → **navigator**
- `qa` → **dockmaster** (owns gates/evidence, like a harbor check before a ship sails)
- `adversary` → **raider** (hostile attack pass on the build)
- `security` → **sentry**
- `docs` → **scribe**
- `architect` → **naval architect**

**The coined name is the AESTHETIC / UI name only — a display-layer abstraction.** Role keys,
file names, manifest entries, frontmatter, prompt template dirs, `AGENTS.md` roster — all
plumbing — stay exactly as they are (`orchestrator`, `backend-dev`, …). Only what a user *sees*
changes: init output, `/armada` status, agent-browser labels, help text, `armada models` table.
This is a pure display mapping, so it is LOW RISK: no manifest renames, no alias map, no
round-trip breakage, no dogfood/no-clobber impact. The internal identity stays
`orchestrator`; the UI calls it *captain*. Think of it like a CSS display name — the DOM id
doesn't move.

Refactor scope (all display-layer only):

- [ ] **Display-name map.** A single `src/role-display.js` (or a field on each CATALOG entry,
  e.g. `display: "captain"`) mapping `role key -> display name`. Pure, zero-I/O, unit-tested.
- [ ] **UI surface.** Use the display map in: init summary output, `/armada` status renderer,
  `armada models` table, agent-browser name, `help`/command text. Everything user-facing.
- [ ] **Docs glossary.** One-line table in `docs/using-armada.md` / README: `orchestrator`
  (captain) etc., noting the display name is cosmetic and the key is the stable identifier.
- [ ] **Prompts.** `agents/<role>/prompt.template.md` openers can reference the display name in
  prose ("You are the captain …") while the frontmatter `name:`/`model:` keys stay unchanged.
  Optional — prose only, never the identifier.
- [ ] **Decision rule.** One brainstorming pass to lock the display set, then mechanical. The
  fleet can build this as a small docs+display-map contract.
- [ ] **Tests.** Display map covers all 8 roles; every UI surface renders through it (grep test
  that init/`/armada`/`models` output never prints a bare role key where a display name exists);
  no change to manifest/round-trip/catalog-shape tests.

### Job visibility tracker — per-lane progress extension (IDEATION, HIGH)

Today each lane's progress lives in `armada/state/active.json` inside its own worktree — a human
must `tmux attach` into each session and read state files per lane to see anything. With several
parallel lanes (resume-reachable, reverify-models, lane-drive), there is no single view of "what
is every fleet doing right now". Goal: an opencode extension (plugin + command) that tracks each
tmux lane run and gives one dashboard of all lanes' progress.

Design sketch:

- **Per-lane run state** (extension-owned, outside each worktree). One tracker store, e.g.
  `~/.armada/runs/<session>.json`, holding per run: session name, lane/branch, contract path,
  phase statuses, last `nextAction`, last evidence refs, last heartbeat, tmux pane tail snapshot,
  elapsed + cost if available. Written by the orchestrator on state transitions (same triggers as
  `armada/state/active.json` today) AND by a heartbeat poller so a wedged/idle lane is visible
  even if the orchestrator never writes again.
- **Heartbeat from the driver.** The lane-drive script (`src/drive.js`) records run start + owns
  the tracker file for its session; the extension (or a `tool.execute.before`/`session.idle`
  hook) updates last-activity. Killed session → heartbeat stalls → dashboard shows STALLED.
- **`/armada-fleet` command.** One read-only view rendered in-chat (and/or a TUI dashboard):
  table of every active lane with phase, status, nextAction, age, cost. Also a `armada fleet`
  CLI subcommand for headless. The extension is opt-in like the supervision plugin — same
  one-file pattern, `armada init --fleet-tracker` (or `armada.yaml` `supervision.fleet: true`).
- **Kill detection.** A `session.idle`/`session.closed` hook marks the lane's run COMPLETE or
  STALLED. Resume (via `/armada-resume`) re-attaches the run to its tracker entry instead of
  starting a new one.
- **Cross-lane, cross-repo.** Tracker keyed by session name; works whether lanes are armada
  worktrees or external repos (`~/WBG/data-ai-chatbot`), since the store lives in `~/.armada/`.

Open questions to ideate before building:

- Dashboard surface: in-chat table vs a terminal TUI (`blessed`/`ink`?) vs both. Keep zero-dep
  (plain table in chat + `armada fleet --json`) unless a TUI is clearly worth a dependency.
- Heartbeat cadence + staleness threshold (e.g. 2 min idle → STALLED).
- Whether the tracker should also capture subagent-level activity (per-agent turn state) or stay
  at lane/phase granularity. Start lane/phase; subagent detail later.
- Reuse the lane-drive wezterm auto-open to pop the dashboard terminal, not just the lane.

Refactor scope (draft):

- [ ] **Live TUI board (`armada fleet --watch`)** — a persistent dashboard that redraws every
  N seconds from the `~/.armada/runs/` store, so the "board" is a thing you look at, not a
  command you re-run. A dedicated terminal tab (wezterm-first auto-open) runs it and shows all
  active lanes live: phase, status, age, cost, STALLED blink. Trade-off: needs a terminal
  renderer dependency (e.g. `blessed`) + a redraw loop; the plain-table `armada fleet` stays the
  zero-dep default. Keys: redraw interval (e.g. 2s), stall blink threshold, `q` to quit.
  When tackled: `armada fleet --open` (shipped #59) becomes `armada fleet --watch` (live).
- [x] **Store module.** `src/fleet-tracker.js` (pure: schema, diff, staleness calc) + I/O in
  scaffold style; tests for schema + staleness.
- [x] **Plugin (opt-in).** One `.opencode/plugins/armada-fleet.js` file rendered by the generator
  (mirror `renderArmadaSupervisionPlugin`): session.created heartbeat start, session.idle
  heartbeat tick + stall marking, session.closed finalize. Rendered only with the new flag.
- [x] **`/armada-fleet` command + `armada fleet` CLI.** Renderer + CLI subcommand reading the
  store, printing the dashboard table / JSON.
- [x] **Wire lane-drive.** `bootLane` records run start into the store; `--no-track` disables.
- [x] **Tests.** Store schema/staleness unit tests; command renderer emits valid descriptor;
  fake-`tmux` e2e that a drive boot writes a run entry; no-clobber + round-trip preserved.
- [x] **Docs.** `docs/using-armada.md` + `docs/armada-improves-armada.md` — fleet dashboard usage.

Shipped in #59 (`feat/fleet-dashboard`): 4 phases, 511/511 tests green.

### Self-improvement issue posting — armada files issues back to armada (IDEATION, HIGH)

Armada improves itself in-band today (patrol, voyage, `docs/validation.md`), but
there's no out-of-band channel: when a fleet run on ANY armada-armed repo (e.g.
`~/WBG/data-ai-chatbot`) hits something it cannot resolve — a template that misled it, a
generator bug, a prompt that stalled the orchestrator, a missing command — there's no way for
that repo's fleet to hand the finding back to armada's maintainers. It just dies in a local
ledger. Goal: a git-enabled issue-posting path wired into armada-armed repos that creates an
issue on armada's own repo (by asking the user first), so the tool improves itself from real
field failures.

Design sketch:

- **Trigger points.** Two explicit moments the fleet asks to file: (a) feature completion —
  the orchestrator reports "this run tripped on X" as part of the final summary; (b) unresolved
  blocker — a phase cannot pass, a defect cannot be reproduced, a contract conflict the fleet
  can't settle. Both are orchestrator-owned decisions; it dispatches a subagent to do the
  filing.
- **User consent always.** Never file silently. The orchestrator drafts the issue body, shows
  it, and asks the user to approve/merge before anything is created. The issue is the *human's*
  contribution to armada, filed under their identity, on their behalf — armada just makes it a
  one-keystroke job.
- **What gets posted.** A structured issue: repo + stack, feature/lane, what tripped (template
  text, prompt section, generator error), expected vs actual, reproduction steps, and a
  suggested armada-side fix (e.g. "orchestrator prompt step 5 lacks a security dispatch —
  consider gating it like adversary"). Severity + file:line where applicable.
- **Subagent assignment.** The orchestrator dispatches `docs` (or a dedicated role) to draft +
  file via `gh issue create` against the armada repo (remote URL from the manifest or a config).
  The subagent reads the armada repo's issue template if present.
- **Cross-repo wiring.** Armada-armed repos know their own repo; armada's repo URL ships in
  armada.yaml (`project.upstreamRepo` or similar, default `rafmacalaba/armada`),
  overridable. `gh` must be authed (doctor already checks provider auth); no gh → the draft is
  written to a local file the user can paste.
- **Relation to audit lane.** This is the *distributed* half of patrol: audits are armada's own
  fleet reviewing itself; issue-posting lets any customer's fleet report back too.

Open questions to ideate before building:

- Should the issue auto-tag (e.g. `field-report`) and reference the armada version
  (`VERSION` in `src/cli.js`)? Yes, cheap + lets maintainers triage.
- One-shot per session, or a per-repo dedup (don't file the same finding twice)? Start with a
  dedup hash of the template/error text in the run's state.
- Does this compose with the prompt-feedback loop (below)? Yes — an unresolved prompt stall is
  exactly the kind of finding that should surface as an issue.

Refactor scope (draft):

- [ ] **Draft/filing module.** `src/issue-report.js` (pure: build the issue body from run state
  + tripped item) + a `gh issue create` caller; `--dry-run` prints the draft.
- [ ] **Orchestrator prompt rules.** On completion or unresolved blocker: "if something
  tripped that armada should fix, draft an issue, show the user, file on approval." A subagent
  (docs) does the drafting/filing; the orchestrator never files directly.
- [ ] **Manifest field.** `project.upstreamRepo` (default armada's repo), round-trips.
- [ ] **Command.** `armada issue` (draft + file) and/or `/armada-issue` command descriptor.
- [ ] **Tests.** Body builder unit tests; dedup; no-gh fallback; CLI e2e with a fake `gh`
  binary on PATH (`makeBin` pattern).
- [ ] **Docs.** `docs/using-armada.md` — how field findings become armada issues.

### Prompt-optimization feedback loop — notable-findings ledger (IDEATION, HIGH)

There is no measurement of prompt quality today: validation runs are one-shot, nothing closes the
loop back into the templates, and `armada/state/history/` only records state transitions. This
loop makes the templates learn from real fleet runs. Designed to be **non-blocking and
low-burden**: it never interferes with the running process, and the human sees one compact digest
at the end, not a log stream.

Design (Approach B — both sides capture, docs digests):

- [ ] **Notable-findings capture (non-blocking).** Every subagent prompt gains: "if something
  tripped you notably — a misleading prompt section, a tool failure, a misunderstanding that
  cost a re-dispatch — append one line to `armada/findings/<run>-raw.log`: your role, what
  tripped, the prompt section implicated, severity (GOOD-TO-ENFORCE | BAD-TO-FIX). Otherwise
  stay silent." The orchestrator writes dispatch-outcome lines to the same log only when notable
  (stall, re-dispatch, surprising success). **Never blocks the process** — log-and-recover,
  fire-and-forget. Silent when nothing is notable.
- [ ] **Gitignored.** `armada/findings/` is a runtime artifact, gitignored (like state) — armada
  does not own the user's repo, and raw findings are clutter if committed. The digest is the only
  human-facing artifact, and it too is gitignored (reviewed in-session, not committed).
- [ ] **End-of-implementation digest (offloaded, compact).** When the feature's final criteria
  are met, the orchestrator dispatches **docs** (not itself — cost discipline) to read the raw
  log, cluster recurring entries, and write `armada/findings/<run>-digest.md`: each finding, how
  often it recurred, the implicated prompt/template, and a proposed edit. The user sees one
  compact digest.
- [ ] **Issue posting — orchestrator's discretion, always asks.** After the digest, the
  orchestrator decides whether any finding rises to "armada should fix this" — its judgment,
  entirely optional. If yes: it drafts an issue body from the digest entry, **shows the user**,
  and files only on approval (`gh issue create` against armada's repo, or a paste-able local
  draft when no `gh`/remote). Never silent, never automatic. If it judges nothing worth filing,
  nothing is filed. Composes with the self-improvement issue-posting spec above.
- [ ] **Periodic template edits.** A recurring review pass (the existing patrol audit) reads
  accumulated digests across runs; recurring clusters become template-edit PRs, human-reviewed
  and merged.
- [ ] **Tests + docs.** Prompt tests assert every subagent carries the findings rule and the
  log path; docs/using-armada.md documents the loop and that findings are gitignored.

Constraints: zero runtime dependency, ESM + `.js`, Node >= 20, no emojis. The findings write must
not be permission-guarded to the point it stalls — every role that runs can append to
`armada/findings/` (low-risk append-only, gitignored).

### Runtime artifacts under armada/ + per-feature ledgers + gitignore (HIGH)

Today `armada init` writes **no `.gitignore`** (verified in a fresh temp repo: after init, `git
status` shows `?? .opencode/ ?? AGENTS.md ?? armada/ ?? opencode.json`), and the fleet's runtime
files land at the repo root: `DEFECTS.md`, `ADVERSARIAL_REVIEW.md`, `e2e/`, `screenshots/`. In
armada's own repo those are tracked by design (dogfooding); in a **user's repo** they are clutter
armada doesn't own and shouldn't force onto their git status. Multi-feature makes it worse: the
ledgers are **global, not per-feature** — `DEFECTS.md` / `ADVERSARIAL_REVIEW.md` are single
root files (manifest.js DEFAULT_PLAYBOOK), so DEF-001 from feature A and feature B collide, and
`feature close` evidence is ambiguous. Contracts/state are already per-feature
(`armada/contracts/<name>.md`, `armada/state/features/<name>.json`); ledgers/e2e/screenshots
are the laggards.

Goal: **everything armada generates at runtime lives under `armada/` (gitignored as a whole),
ledgers/e2e/screenshots/findings are per-feature (per lane/voyage), and `armada init` appends a
marker-based `.gitignore` block so the user's repo stays clean.**

Worktree-aware design (decided): with worktree-per-feature, each worktree's `armada/` is
naturally isolated — worktree = feature = its own ledgers. The `.gitignore` block is tracked
(shared across worktrees), so it is appended **once per repo** and covers every worktree. In the
same-checkout mode (today), features share `armada/`, so ledgers are namespaced per feature
under it. Both modes use the same layout:

```
armada/
├── armada.yaml                    # manifest (armada-owned, always rewritten)
├── contracts/<feature>.md         # per-feature contract (existing)
├── state/                         # active / features/<name>.json / history (existing)
├── findings/                      # notable-findings ledger (specced, gitignored)
├── ledgers/
│   ├── <feature>/DEFECTS.md            # per-feature defect ledger
│   ├── <feature>/ADVERSARIAL_REVIEW.md # per-feature adversary findings
│   └── shared/                         # cross-feature defects (regressions that span features)
├── e2e/<feature>/                 # per-feature e2e tests (qa-owned)
└── screenshots/<feature>/         # per-feature evidence
```

Refactor scope (shipped in #58, `feat/artifacts-under-armada`):

- [x] **`.gitignore` block.** `armada init` + `armada new` append a marker-based block
  (`# armada:start` … `# armada:end`, same merge pattern AGENTS.md uses) ignoring `/armada/`,
  `/.opencode/`, `/opencode.json`. Appends only — never rewrites an existing `.gitignore`; if the
  file is absent, create it. `uninstall` removes the block. Ask-once at init unless `--yes`/
  `--yolo` (matches no-clobber posture: modifying a user file, but reversible + marked).
- [x] **Per-feature ledger paths.** `DEFAULT_PLAYBOOK` ledger paths become
  `armada/ledgers/<feature>/…` (+ `shared/` for cross-feature). Feature name resolves from the
  active feature (state active.json) or the lane/worktree name.
- [x] **Prompts reference the per-feature path.** The 7× `DEFECTS.md` + 5× `ADVERSARIAL_REVIEW.md`
  references in `agents/*/prompt.template.md` become `{ledgers_dir}` placeholders (already have
  placeholder machinery + a no-dangling-placeholder test).
- [x] **Permissions.** `BASE_PERMISSIONS` globs `"DEFECTS.md": allow/deny` become
  `"armada/ledgers/*"` rules; qa owns `armada/ledgers/*` + `armada/e2e/*` + `armada/screenshots/*`;
  read-only roles keep read-only under `armada/`. (All in `src/generator.js` BASE_PERMISSIONS +
  the supervision plugin's deny mirrors.)
- [x] **Role descriptions.** `src/model-catalog.js` role `reasoning` strings reference the old
  paths ("e2e tests, screenshots, DEFECTS.md ownership", "ADVERSARIAL_REVIEW.md") — update to
  the armada/ledgers paths (feeds routing prompt + `/armada` output).
- [x] **Findings + state move cleanly.** `armada/findings/` (specced) and existing
  `armada/state/` already live under the gitignored dir — confirm nothing references a root-level
  path anymore.
- [x] **uninstall.** Removes the `.gitignore` block + the whole `armada/` runtime dir (already
  removes armada/ recursively) + `.opencode/`.
- [x] **armada new templates.** Starter `.gitignore` files gain the armada block so a fresh repo
  is clean from day one.
- [x] **Generator renderers.** Every root-path reference in `src/generator.js` (20 refs: 5×
  DEFECTS.md, 5× ADVERSARIAL_REVIEW.md, 5× e2e/, 5× screenshots/ — across BASE_PERMISSIONS,
  AGENTS.md playbook renderer, requirements renderer, supervision-plugin deny mirrors) resolves
  through the per-feature ledgers dir. The `DEFAULT_PLAYBOOK` ledger file fields
  (`src/manifest.js`) become per-feature paths; `{ledgers_dir}` placeholder flows into the
  generated AGENTS.md + agent prompts.
- [x] **Tests.** Fresh-repo e2e: after init, `git status` shows no armada files as untracked;
  ledgers render under `armada/ledgers/<feature>/`; round-trip + no-clobber still hold; uninstall
  restores the user's `.gitignore`; multi-feature: two features → two ledger namespaces, no
  DEF collision; placeholder test still green.

---

## History — done

### v0.1 — done

- [x] Repo scaffold (package.json, tsconfig, LICENSE, .gitignore)
- [x] CLI: `init` / `models` / `doctor` / `ping` / `help`
- [x] Model catalog: 8 roles, primary (opencode) + fallback (openrouter), 3 budget tiers
- [x] Stack detection (package.json / pyproject / requirements / Dockerfile / instruction files)
- [x] Interactive questionnaire (zero-dep readline) + `--from-armada` + flags
- [x] Generator (pure): native agent files, opencode.json, AGENTS.md, REQUIREMENTS.md, armada.yaml
- [x] Scaffold: writes all artifacts, no-clobber on user files, devcontainer copy
- [x] Agent library: 8 roles with terse/caveman output contracts
- [x] Presets: free / balanced / power
- [x] Devcontainer + agent-browser wiring (template)
- [x] Tests: 19 passing (generator, scaffold, stack-detect)
- [x] Docs: README, SPEC, ARCHITECTURE, TODO
- [x] Standalone test harness: CLI e2e (spawns real CLI), init→parse→init round-trip, dogfood
  no-clobber, fixture corpus, real `models --refresh` e2e — 46 tests passing

### Contract co-writing — done

- [x] **Co-write the contract, don't hand-author it.** Orchestrator prompt now: if the
  requirements file's phases/criteria are blank, do NOT build — elicit requirements from the
  user one question at a time, draft, iterate to consensus, get explicit approval, then build.
- [x] **Per-feature contract files.** `armada init --requirements <file>` sets a
  per-session/feature requirements file (default `REQUIREMENTS.md`). Starting a second feature
  no longer means silently replacing the first contract. Round-trips through `armada.yaml`.
- [x] **Parallel, dependency-driven phases.** Orchestrator prompt: build the dependency graph
  from REQUIREMENTS phases; a phase starts as soon as the phases it depends on pass; independent
  phases run in parallel as background subagents (backend-dev ∥ frontend-dev per phase). Nothing
  blocks a phase except an unmet dependency or a failed success criterion.

### Robust opencode harness (tiered) — done

The fleet model was hardened on opencode: **subagents + orchestrator, runnable in parallel** (armada's model; firstmate's pattern). Multi-harness (codex, claude code) is deferred — see "Deferred" in the backlog.

- [x] **Tier 1 — Model/provider robustness.** Generated `opencode.json` emits `provider.openrouter.models` for every openrouter slug the catalog uses (each with `options.provider.allow_fallbacks: true`). `armada doctor` adds an `openrouter auth` check with a remediation hint. Docs: power preset needs `OPENROUTER_API_KEY` / `/connect` openrouter.
- [x] **Tier 4 — Prompt contracts + regression tests** (shipped in the Tier 1 PR). Orchestrator prompt gained three hard rules: (a) no blind stop, (b) writes route through subagents, (c) read `.opencode/fleet-status.md` on session start. Tests assert the three rules + assert generated `opencode.json` has no `plugin` block by default.
- [x] **Tier 2 — Bundled skills (commands).** Added `/armada-status` (read fleet status), `/armada-scout` (read-only investigation dispatch), `/armada-resume` (pick up killed session). Shipped the `.opencode/fleet-status.md` schema. Generator renders the three command files; `uninstall` removes them.
- [x] **Tier 3 — Thin supervision plugin (opt-in).** Single `.opencode/plugins/armada-supervision.js`, opt-in via `armada init --supervision-plugin` or `armada.yaml` `supervision.plugin: true`. Three handlers: `session.created` → resume nudge from fleet-status, `session.idle` → no-blind-stop guard (with `skipNextIdle` recursion guard), `tool.execute.before` for `bash` → deny shell-redirect writes to files in the orchestrator's `permission.edit` deny set. Default `armada init` does NOT emit a plugin (the "no plugin" promise holds).
- [x] **Live OpenRouter smoke layer.** `tests/smoke/` (`npm run test:smoke`) — cheapest-model ping + catalog slug resolution; skipped cleanly without a credential.
- [x] **PR sequencing delivered:** PR 1 = T1 + T4, PR 2 = T2, PR 3 = T3 (each small, CI-gated, merged to master).

### Parallel phases + autonomous mode — done

- [x] **Orchestrator prompt: "Unlock parallelism — assign disjoint files."** Prefer per-phase file
  isolation (`src/<feature>.js` + its test) so independent phases run in parallel; when a file
  must be shared, serialize writers on a reused subagent session and say so.
- [x] **`armada init --yolo` autonomous mode.** `opencode.json` gets `permission: { "*": "allow" }`
  (no `--auto` flag needed); orchestrator + qa `bash` become allow; role `edit` boundaries kept
  (SDK resolves most-specific-first). Verified live: headless run with zero permission prompts.
- [x] **Live validation: 5-phase dependency graph** ran end-to-end (dependency gating, collision-aware
  serialization, parallel qa∥adversary gate work, 5/5 tests). Recorded in `docs/validation.md`.

### Security & robustness — done

- [x] **`--cache <path>` arbitrary file write.** `validateCachePath` now rejects traversal,
  `~` expansion, and absolute paths outside `~/.armada` (relative filenames resolve under cwd).
  Wired into `refreshModels`; tested.
- [x] **`opencode.json` no-clobber + never leaks unscoped allows.** Verified: written only when
  absent; the generated config carries `external_directory: deny` (+ optional `yolo` catch-all),
  never unscoped `bash: allow`/`edit: allow`.

### Session-based armada (per-feature contracts + on-disk state) — done

Armada owns a repo's *ongoing* implementation, not just one-shot feature runs. Each feature is a
separate implementation on the same armada-armed repo; the fleet is restart-proof, per-feature,
tracked by the orchestrator across sessions.

- [x] **State schema.** `armada/state/` layout shipped: `active.json` (feature + phase graph +
  evidence + next action), `features/` index, `history/` log. `src/state.js` (pure, zero-I/O) +
  validators.
- [x] **Per-feature contract CLI.** `armada feature new/list/close` shipped
  (`src/feature-commands.js`). `feature close` is evidence-gated (refuses without a passing
  criterion). `armada init --requirements <file>` wires the active feature.
- [x] **Orchestrator state read/write.** Prompt hard rules 3+4 read `armada/state/active.json` on
  session start + write state on every transition (never end a turn with unsaved state).
- [x] **Restart-proof reconcile.** Engine + CLI + `/armada-resume` + e2e shipped in PR #44
  (`4b2c17b`). On session start, the orchestrator diffs on-disk state vs repo reality (what
  shipped, what changed) and reports "resume: feature X phase 2, evidence in, next action Y".
  Residual gap: the CLI is only reachable inside armada's own source tree — see the
  resume-reachability spec under High.
- [x] Multi-feature via worktrees — shipped in #67 (see Wave 1 above).
- [ ] Live validation in a real repo — open, in Backlog → High.

#### Finding from the first voyage run (2026-08-02)

The fleet implemented the session-based state feature end-to-end (~26m, $0.18, autonomous
`--yolo`) — but it edited its sandbox's **generated** `.opencode/agent/*.md` + command copies,
which are **gitignored**. The **tracked sources** (`agents/orchestrator/prompt.template.md`,
`src/generator.js` command renderers) kept the old fleet-status references, so the state
behavior would have been lost on re-scaffold. Fixed in `8e0fab3` (ported rules to sources +
fixed test portability).

**Lesson for self-improvement:** when armada improves itself, the contract must require edits to
the **tracked source templates** (e.g. `agents/**`, `src/**`), and the fleet should verify the
change survives `armada init --from-armada` (re-scaffold round-trip), not just the live
`.opencode/` config. Add a "verify via re-scaffold" gate to voyage contracts that touch armada's
own generators/templates.

#### `--yolo` still co-writes

Autonomous mode auto-approves *permissions* — it does NOT skip the **contract co-write**. The
orchestrator still: reads the contract, and if phases/criteria are blank, elicits requirements
one question at a time, drafts, iterates to consensus, and gets explicit approval before
building. `--yolo` means no permission prompts for *tools*; the *product decision* (what to
build) is still co-authored with the user. Try it on the next feature: leave the contract blank,
launch `--yolo`, and let the orchestrator walk you through the requirements before it starts.

### Validate in a real repo — self-dogfood

- [x] **Self-dogfood: armada on armada** (2026-08-01) — scaffolded the team into a sandbox
  worktree, dispatched security + architect as background subagents, then uninstalled to a
  pristine repo. Results in `docs/validation.md`. The unified two-mode workflow (audit +
  feature) now lives in `docs/armada-improves-armada.md`.

### Polish — done

- [x] Add `--dry-run` to `init` (print files without writing)
- [x] Add `--yes` / non-interactive defaults so `init` works without a TTY
- [x] **Lane drive visible terminal + handshake polish** — the `armada drive` quick win
  (above) covers the TUI-ready handshake and terminal auto-open; backfilled into the
  polish ledger with the rest of the lane-drive feature. Shipped 2026-08-03.

<!-- Old terminology: Lane A = patrol, Lane B = voyage. See README.md for the canonical glossary. -->


## Recently shipped

- [x] **HANDOFF block after voyage dispatch** (#92) (2026-08-05). Pure formatter `src/handoff.js` + `armada voyage-handoff` CLI helper + orchestrator template rule + `armada voyage attach <name>` subcommand. Re-scaffold round-trip preserves the rule.
- [x] **Voyage-completion workflow** (#92) (2026-08-05). Orchestrator prompt template gained a `## Voyage completion` section: TODO.md auto-update, auto-merge guard (`mergeable` + CI green), local merge after origin merge. No new CLI commands — pure prompt rules.

- [x] **Orchestrator dispatch narration uses shipName [role]** (#95) (2026-08-05). Orchestrator prompt template gained a hard MUST `## Dispatch narration` section + carve-out from the Output contract. New `tests/orchestrator-prompt.test.js` (3 regex assertions) guards the rule. Round-trip re-scaffold preserves it.

- [x] **README & Documentation Overhaul + Meet the Fleet** (#96) (2026-08-05). Full pitch rewrite in README.md, hand-painted logo & 4-step ship workflow mechanism artwork, simplified quickstart (`armada new my-app`), Meet the Fleet roster & permissions matrix, Cookiecutter/Harness/Loop engineering section, manifest path alignment (`armada/armada.yaml`), bracket role notation (`[role]`), and new docs (`WHY.md`, `getting-started.md`, `self-improvement.md`, `CONTRIBUTING.md`).
- [x] **public-stability — armada v1.0.0 public release** (#101) (2026-08-05). 7 phases, 42 commits, 646 tests pass, 6 DEFs filed+closed, 5 SEC + 9 ADV triaged, macos+ubuntu×node 20+22 CI green, npm package renamed to armada, ship target: full public.
- [x] **chore(github): rename repo to armada** (#107) (2026-08-05). GitHub repo renamed `opencode-armada` → `armada`; npm package already `@rafmacalaba/armada`. Updated 14 files (package.json URLs, docs, LICENSE, AGENTS.md, SPEC.md, template, scaffold test, TODO release log). 417/417 tests pass, 0 stale refs.
- [x] **armada v1.0.1 patch release** (v1.0.1) (2026-08-05). Re-publishes the GitHub-rename corrections from #107 so the npm tarball matches origin HEAD. v1.0.0's tarball had stale `github.com/rafmacalaba/opencode-armada` URLs (issues link 404'd); v1.0.1 ships corrected files. Manually published via `npm publish --access public` (Path B per `docs/RELEASING.md`). Local `armada` swapped from `opencode-armada v0.9.2` global to npm-link of v1.0.1 source. GitHub release: https://github.com/rafmacalaba/armada/releases/tag/v1.0.1.

- [x] **docs: model/provider reload semantics** (#TBD) (2026-08-05). New `## Changing models or provider` section in `docs/operator-guide.md:63-89` closes the gap surfaced in chat — opencode reads `opencode.json` + per-agent frontmatter on session start (no live reload on exit); manifest-driven changes flow through `armada init --from-armada armada/armada.yaml --restart` with `mergeOpenCodeJson` preserving user-owned `opencode.json` keys. 510/0 tests pass, diff: +28 docs / +1 TODO.

- [x] **feat(shipnames): TUI task-description prefix plugin** (#115) (2026-08-06). Default-on opt-out plugin (parallel to fleet/watchdog): renderer bakes `DISPLAY` map at generate time; manifest gains `supervision.shipnames` (default true); scaffold writes `.opencode/plugins/armada-shipnames.js`; CLI flag `--no-shipnames`; doctor adds a `shipnames plugin` check (pass/fail/skip); init-summary lists the plugin. 8 agent prompt templates carry the shipnames title-format rule (full rule for dispatching roles, one-liner for read-only). `src/role-display.js` gets `roleForAgentName` + `prefixForRole`. 4 phases, 1 DEF (DEF-001 import regression) opened+closed, 548/0 tests pass, macos+ubuntu×node 20+22 CI green. PR opened, awaiting user merge.

- [x] **armada fleet discover — orphan worktree register** (#116) (2026-08-06). New `armada fleet discover [--json] [--register] [--repo <p>]` subcommand scans `sandbox/`, diffs against `~/.armada/runs/`, surfaces untracked worktrees. `--register` writes a minimal run JSON per orphan (idempotent, ACTIVE, with `lastNextAction: "registered via fleet discover — no live session"`). 151-line `src/fleet-discover.js` (pure) + 26 tests + 536/0 total green.

- [x] **chore(tests): prune dead/stale/duplicate tests** (#117) (2026-08-06). 3-phase test-only refactor: Phase 1 (3 dead + 2 stale + 1 doc line), Phase 2 (13 within-file merge clusters), Phase 3 (10 cross-file dedup decisions). 510 -> 382 tests (-128, -25%), +568/-1533 lines, zero `src/` changes, suite green. 5 pre-existing zero-coverage flags surfaced (`--no-fleet-tracker`, `--restart`, status `--feature`, fleet `--open`, `voyage-handoff`) — flagged for follow-up.

- [x] **fix(questionnaire): strict custom model id format validation** (#124) (2026-08-07). Follow-up to #123: pickModel now whitelists exactly two custom formats — `opencode-go/zen/<model>` and `openrouter/<owner>/<model>`. Anything else returns `null` from `parseModelChoice` and re-prompts in `pickModel` — no silent fallback to default. Closes the parseInt-greediness gap (`"123-abc"`, `"1.5"`, `"v1-model"`), rejects bare `opencode-go/<m>` / `opencode/<m>` catalog prefixes, and the prompt now advertises the custom format. +11 tests (valid formats, invalid formats, pickModel re-prompt); 20/20 questionnaire tests pass, 466/466 full suite green.

- [x] **fix(cli): complete 1.0.4 version bump in src/cli.js** (#124) (2026-08-07). The release commit f0cc6e8 bumped `package.json` to 1.0.4 but left `src/cli.js:62` hardcoded at "1.0.3", making `tests/version-flag.test.js` and the doctor test red. Also updated `tests/cli.test.js:713` to read the expected version from `package.json` (mirroring `tests/version-flag.test.js:8`) so future release bumps don't require a test edit. 466/466 suite green.

- [x] **fix(voyage-cwd): absolute path + lane-cwd** (#<pending>). Default drive prompt now names `<absLane>/armada/REQUIREMENTS.md`; tmux `new-session -c <absLane>` puts the team in the worktree. Locked by `tests/voyage-prompt-cwd.test.js`.
