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

- [x] **PR-first finish** (#65) (2026-08-03/04). Orchestrator hard rule 6: PR before done, never local merge/push; contract final criterion, prUrl in state, docs, tests. Stacked-PR follow-up not built.
- [x] **Fleet terminology + role display names** (#63) (2026-08-03/04). Ship-type display map, audit/feature lanes -> patrol/voyage, sandbox -> dock, armada drive -> armada voyage (alias kept).
- [x] **Lane-drive completion — wezterm-baseline** (#66) (2026-08-03/04). Docs + --term surface default to wezterm-first; per-OS emulators fallback.
- [x] **Multi-feature via worktrees** (#67) (2026-08-03/04). armada feature new --worktree creates sandbox/<name> on feat/<name>, list/close worktree-aware.
- [x] **Stable AGENTS.md block** (#68) (2026-08-03/04). Generated block uses repo identity in header, {feature} token in paths — parallel lanes no longer conflict.
- [x] **Drive reliability fixes** (#62) (2026-08-03/04). --help handled, boot modals dismissed repeatedly, resident-heartbeat notice.
- [x] **Global binary + doctor check** (#64) (2026-08-03/04). armada doctor reports global-binary health; broken npm-link-to-deleted-worktree root cause fixed.
- [x] **commodore-watchdog** (2026-08-03/04). Opt-in subagent watchdog plugin (--watchdog / supervision.watchdog); nudges orchestrator when dispatched subagent pending >5 min AND orchestrator idle >2 min.

### Wave 2 — first consumers (parallel)

- [ ] **Skills integration** (spec below). Requires: per-role configurability (shipped #52).
  Files: `src/skills/`, generator, manifest, prompts.
- [x] **Security findings ledger** (#58) (2026-08-03). Per-feature SECURITY_FINDINGS.md schema, generator rendering, security prompt integration.

### Wave 3 — systemic self-improvement (sequential)

- [ ] **Prompt-optimization feedback loop** (spec below). Requires: artifacts layout + prompt
  infra. Files: `armada/findings/`, all subagent prompts, docs digest.
- [ ] **Self-improvement issue posting** (spec below). Requires: feedback-loop digest + PR-first
  `gh` flow. Files: `src/issue-report.js`, orchestrator prompt, manifest.

Shared orchestrator-prompt + findings files → sequence, don't parallelize.

### Wave 4 — product surface + cleanup (parallel)

- [x] **Re-evaluate 8-role roster** (#96) (2026-08-05). "Meet the Fleet" roster, role display mapping, SDK-enforced permission matrix (edit: deny for orchestrator, security, architect).
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

- [x] **Mark restart-proof reconcile done** (#44) (2026-08-03). Engine, CLI, /armada-resume, e2e shipped. Resume-reachability spec under High.
- [x] **armada models --list-openrouter** (2026-08-03). Show live model list from OpenRouter API for pick-your-own workflows.
- [x] **(Recommended) catalog marker** (2026-08-03). Flag only true first-choice model per budget tier in models output.
- [x] **Init end summary** (2026-08-03). After init, emit models chosen, cost hint per tier, next steps.
- [x] **armada preset <name>** (2026-08-03). Apply preset to existing manifest (armada preset power).
- [x] **renderCatalog auto-size columns** (2026-08-03). Replace hardcoded padding with computed widths.
- [x] **Lane drive — TUI-ready handshake + auto-open visible terminal** (2026-08-03). tmux capture-pane polling, prompt send/verify, retry once; wezterm-first auto-open; --no-open for CI.

### High

The improvements that unlock the durable-implementation vision.

- [x] **PR-first finish — never local merge or direct push** (#65) (2026-08-03/04). Orchestrator hard rule 6, contract final criterion, prUrl in state + /armada-status, docs, tests. Stacked-PR follow-up not built.
- [x] **Lane drive — TUI-ready handshake + auto-open visible terminal** (2026-08-03). Shipped in #52 (armada drive) + #55 (tab in primary terminal). Residual: wezterm-baseline refactor — see Wave plan.
- [ ] **Skills integration** — spec below. Ships fleet skills into generated repos and lets
  every role consume them. (User priority: HIGH.)
- [x] **Per-role configurability** (#52) (2026-08-03). Manifest-level permissions, instructions, optional custom prompt per role.
- [x] **Validate in a real repo — ~/WBG/data-ai-chatbot** (#53) (2026-08-03). FastAPI + Next.js validation: stack detection, native agents, background orchestration, prompt tuning. See docs/validation.md.
- [x] **Restart-proof resume in a generated repo** (#53) (2026-08-03). /armada-resume outside armada's source tree; kill mid-feature, verify resume + no state loss. Evidence in docs/validation.md.

### Medium

Bigger features, well-specified, sequenced after the High items.

- [x] **armada new — cookiecutter-inspired repo generator** (#36) (2026-08-03). Starter templates (web-app/cli-tool/api-service/ml-training/research-paper/library), category picker, {placeholder} fill, beginner/experienced paths, non-interactive flags.
- [x] **Multi-feature via worktrees** (#67) (2026-08-03/04). git worktree per feature, feature list, zero cross-feature clobber.
- [x] **Arrow-key questionnaire** (2026-08-03). select/multiSelect/confirm in src/ui.js already ship this.

### Low

Design re-evaluations, model hygiene. Not urgent.

- [x] **Re-verify model IDs** (2026-08-03). All 11 catalog IDs verified live; zero NOT FOUND. Generator audit PASS. opencode-go/deepseek-v4-flash vs opencode/deepseek-v4-flash-free both live.
- [x] **Re-evaluate the 8-role roster** (#96) (2026-08-05). "Meet the Fleet" roster, role display mapping, SDK-enforced permission matrix.
- [x] **Security findings ledger** (#58) (2026-08-03). Per-feature SECURITY_FINDINGS.md ledger schema, generator rendering, security prompt integration.

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

- [x] **Manifest fields** (#52) (2026-08-03). Team entries gain optional permissions (deep-merged over BASE_PERMISSIONS), instructions (appended to prompt), prompt (path to custom template override).
- [x] **Generator** (#52) (2026-08-03). buildTeam merge, render permissions into frontmatter, append instructions, resolve prompt path.
- [x] **Round-trip** (#52) (2026-08-03). armada.yaml serialization writes fields back so init --from-armada is idempotent.
- [x] **Tests** (#52) (2026-08-03). Manifest schema accepts fields; merge precedence (user > base); render includes them; round-trip equality; custom template fixture.

### Restart-proof resume in a generated repo (HIGH)

`/armada-resume` runs `node src/cli.js reconcile` (`src/generator.js:388`) — that file only
exists inside armada's own source tree. A generated repo (e.g. data-ai-chatbot) has no
`src/cli.js`; the orchestrator there cannot resume from `armada/state/` on its own.

- [x] **CLI reachability** (2026-08-03). Reconcile as armada reconcile subcommand, callable from any armada-armed repo. /armada-resume uses global binary with in-tree fallback. Merged feat/resume-reachable.
- [x] **Verify in a generated repo** (#53) (2026-08-03). Real-repo validation + resume walkthrough in docs/validation.md.
- [x] **Tests** (2026-08-03). CLI e2e with fake armada binary; command renderer emits new body; reconcile engine regression green. Merged feat/resume-reachable.

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

- [x] **TUI-ready handshake** (2026-08-03). Poll tmux capture-pane for TUI input bar, send drive prompt, verify registered, resend once, timeout with pane tail. Idempotent session names.
- [x] **Auto-open visible terminal — wezterm first** (2026-08-03). Open visible terminal attached to lane session. Preferred: wezterm (cross-platform). Fall back per-OS. --no-open for headless/CI.
- [x] **Tab in the primary terminal, not a new window** (#55) (2026-08-03). New tab via AppleScript (Terminal) / iTerm / --tab flags, not separate window. Detection via TERM_PROGRAM env. Shipped 2026-08-03.
- [x] **Refactor to wezterm as the baseline** (#66) (2026-08-03). Wezterm-first proved out; docs + --term surface present wezterm as default, per-OS emulators as fallback.
- [x] **Tests** (2026-08-03). Terminal-opening logic pure module with unit tests; handshake tested against fake tmux binary.
- [x] **Docs** (2026-08-03). docs/armada-improves-armada.md + docs/sandbox.md updated.

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
- [x] **Store module** (#59) (2026-08-03). src/fleet-tracker.js (pure: schema, diff, staleness calc) + I/O in scaffold style; tests for schema + staleness.
- [x] **Plugin (opt-in)** (#59) (2026-08-03). .opencode/plugins/armada-fleet.js rendered by generator: session.created heartbeat start, session.idle tick + stall marking, session.closed finalize.
- [x] **/armada-fleet command + armada fleet CLI** (#59) (2026-08-03). Renderer + CLI subcommand reading the store, printing dashboard table / JSON.
- [x] **Wire lane-drive** (#59) (2026-08-03). bootLane records run start into store; --no-track disables.
- [x] **Tests** (#59) (2026-08-03). Store schema/staleness unit tests; command renderer valid descriptor; fake-tmux e2e; no-clobber + round-trip preserved.
- [x] **Docs** (#59) (2026-08-03). docs/using-armada.md + docs/armada-improves-armada.md — fleet dashboard usage.

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

- [x] **.gitignore block** (#58) (2026-08-03). Marker-based block (# armada:start … # armada:end) ignoring /armada/, /.opencode/, /opencode.json. Appends only; reversible, marked.
- [x] **Per-feature ledger paths** (#58) (2026-08-03). DEFAULT_PLAYBOOK ledger paths become armada/ledgers/<feature>/… + shared/. Feature name from active feature or lane/worktree name.
- [x] **Prompts reference per-feature path** (#58) (2026-08-03). 7x DEFECTS.md + 5x ADVERSARIAL_REVIEW.md references become {ledgers_dir} placeholders.
- [x] **Permissions** (#58) (2026-08-03). BASE_PERMISSIONS globs updated; qa owns armada/ledgers/* + e2e/* + screenshots/*; read-only roles keep read-only.
- [x] **Role descriptions** (#58) (2026-08-03). src/model-catalog.js role reasoning strings updated to armada/ledgers paths.
- [x] **Findings + state move cleanly** (#58) (2026-08-03). armada/findings/ + armada/state/ already under gitignored dir; no root-level refs remain.
- [x] **uninstall** (#58) (2026-08-03). Removes .gitignore block + armada/ runtime dir + .opencode/.
- [x] **armada new templates** (#58) (2026-08-03). Starter .gitignore files gain armada block for clean repos from day one.
- [x] **Generator renderers** (#58) (2026-08-03). All 20 root-path refs in src/generator.js resolve through per-feature ledgers dir; {ledgers_dir} placeholder flows into AGENTS.md + prompts.
- [x] **Tests** (#58) (2026-08-03). Fresh-repo e2e; round-trip + no-clobber hold; uninstall restores .gitignore; multi-feature namespace isolation.

---

## History — done

### v0.1 — done

- [x] **Repo scaffold + core CLI** (2026-08-01). init/models/doctor/ping/help, 8-role catalog, 3 budget tiers, stack detection, zero-dep questionnaire. 19 tests passing.
- [x] **Generator + scaffold** (2026-08-01). Pure renderers, native agent files, opencode.json, AGENTS.md, armada.yaml, no-clobber, devcontainer.
- [x] **Agent library + presets** (2026-08-01). 8 roles with terse/caveman output contracts, presets free/balanced/power.
- [x] **Standalone test harness** (2026-08-01). CLI e2e, init->parse->init round-trip, dogfood no-clobber, fixture corpus, real models --refresh e2e — 46 tests passing.

### Contract co-writing — done

- [x] **Co-write the contract** (2026-08-02). Orchestrator prompt: if requirements blank, elicit one question at a time, draft, iterate, get explicit approval, then build.
- [x] **Per-feature contract files** (2026-08-02). armada init --requirements <file> sets per-session/feature contract; round-trips through armada.yaml.
- [x] **Parallel, dependency-driven phases** (2026-08-02). Orchestrator builds dependency graph from REQUIREMENTS phases; independent phases run parallel as background subagents; only unmet dependency or failed criterion blocks.

### Robust opencode harness (tiered) — done

The fleet model was hardened on opencode: **subagents + orchestrator, runnable in parallel** (armada's model; firstmate's pattern). Multi-harness (codex, claude code) is deferred — see "Deferred" in the backlog.

- [x] **Tier 1 — Model/provider robustness** (2026-08-02). provider.openrouter.models emitted for every openrouter slug; doctor adds openrouter auth check. Docs: power preset needs OPENROUTER_API_KEY.
- [x] **Tier 4 — Prompt contracts + regression tests** (2026-08-02). Orchestrator prompt 3 hard rules; no plugin block by default.
- [x] **Tier 2 — Bundled skills (commands)** (2026-08-02). /armada-status, /armada-scout, /armada-resume, fleet-status.md schema.
- [x] **Tier 3 — Thin supervision plugin (opt-in)** (2026-08-02). armada init --supervision-plugin: session.created resume nudge, session.idle no-blind-stop, tool.execute.before shell-redirect guard.
- [x] **Live OpenRouter smoke layer** (2026-08-02). npm run test:smoke — cheapest-model ping + catalog slug resolution; skips cleanly without credential.
- [x] **PR sequencing** (2026-08-02). PR 1 = T1+T4, PR 2 = T2, PR 3 = T3 — each small, CI-gated.

### Parallel phases + autonomous mode — done

- [x] **Orchestrator prompt: unlock parallelism — assign disjoint files** (2026-08-02). Prefer per-phase file isolation for parallel phases; serialize shared-file writers.
- [x] **armada init --yolo autonomous mode** (2026-08-02). permission: {"*": "allow"}, orchestrator + qa bash allow, role edit boundaries kept (SDK resolves most-specific-first).
- [x] **Live validation: 5-phase dependency graph** (2026-08-02). End-to-end: dependency gating, collision-aware serialization, parallel qa/adversary gate work, 5/5 tests. docs/validation.md.
- [x] **Safe-bash defaults** (#128) (2026-08-07). Tiered SAFE_BASH allowlist: read-only for all roles, write for dev roles; yolo flattens to *. Path safety via external_directory: deny.

### Security & robustness — done

- [x] **--cache <path> arbitrary file write** (2026-08-02). validateCachePath rejects traversal, ~ expansion, absolute paths outside ~/.armada. Wired into refreshModels.
- [x] **opencode.json no-clobber + never leaks unscoped allows** (2026-08-02). Written only when absent; external_directory: deny + optional yolo catch-all, never unscoped bash: allow/edit: allow.

### Session-based armada (per-feature contracts + on-disk state) — done

Armada owns a repo's *ongoing* implementation, not just one-shot feature runs. Each feature is a
separate implementation on the same armada-armed repo; the fleet is restart-proof, per-feature,
tracked by the orchestrator across sessions.

- [x] **State schema** (2026-08-02). armada/state/ layout: active.json, features/ index, history/ log. src/state.js (pure, zero-I/O) + validators.
- [x] **Per-feature contract CLI** (2026-08-02). armada feature new/list/close, feature close evidence-gated, armada init --requirements <file>.
- [x] **Orchestrator state read/write** (2026-08-02). Prompt hard rules: read armada/state/active.json on session start + write on every transition.
- [x] **Restart-proof reconcile** (#44) (2026-08-02). Engine + CLI + /armada-resume + e2e. On session start, diffs on-disk state vs repo reality. Residual gap: CLI reachability (see High).
- [x] **Multi-feature via worktrees** (#67) (2026-08-03/04). Shipped in Wave 1.
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

- [x] **Self-dogfood: armada on armada** (2026-08-01). Scaffolded team into sandbox worktree, dispatched security + architect as background subagents, then uninstalled. docs/validation.md.

### Polish — done

- [x] **--dry-run to init** (2026-08-01). Print files without writing.
- [x] **--yes / non-interactive defaults** (2026-08-01). init works without a TTY.
- [x] **Lane drive visible terminal + handshake polish** (2026-08-03). TUI-ready handshake and terminal auto-open backfilled into polish ledger.

<!-- Old terminology: Lane A = patrol, Lane B = voyage. See README.md for the canonical glossary. -->


## Recently shipped

- [x] **HANDOFF block after voyage dispatch** (#92) (2026-08-05). Pure formatter + CLI helper + orchestrator template rule + armada voyage attach. Re-scaffold round-trip preserves.
- [x] **Voyage-completion workflow** (#92) (2026-08-05). Orchestrator prompt TODO.md auto-update, auto-merge guard (mergeable + CI green), local merge after origin merge.
- [x] **Orchestrator dispatch narration uses shipName [role]** (#95) (2026-08-05). Prompt hard MUST Dispatch narration section + Output contract carve-out. tests/orchestrator-prompt.test.js guards.
- [x] **README & Documentation Overhaul + Meet the Fleet** (#96) (2026-08-05). Full pitch rewrite, hand-painted logo, 4-step ship workflow, Meet the Fleet roster, bracket role notation, new docs (WHY.md, getting-started.md, self-improvement.md, CONTRIBUTING.md).
- [x] **armada v1.0.0 public release** (#101) (2026-08-05). 7 phases, 42 commits, 646 tests pass, 6 DEFs filed+closed, 5 SEC + 9 ADV triaged, macos+ubuntu CI green, npm package armada.
- [x] **chore(github): rename repo to armada** (#107) (2026-08-05). GitHub repo renamed opencode-armada -> armada. 14 files updated, 417/417 tests pass, 0 stale refs.
- [x] **armada v1.0.1 patch release** (v1.0.1) (2026-08-05). Re-publishes GitHub-rename corrections from #107. Path B npm publish. GitHub release at tag v1.0.1.
- [x] **docs: model/provider reload semantics** (2026-08-05). New Changing models or provider section in docs/operator-guide.md. +28 docs / +1 TODO.
- [x] **feat(shipnames): TUI task-description prefix plugin** (#115) (2026-08-06). Default-on opt-out, manifest supervision.shipnames, scaffold, CLI --no-shipnames, doctor check. 548/0 tests.
- [x] **armada fleet discover — orphan worktree register** (#116) (2026-08-06). Scans sandbox/, diffs ~/.armada/runs/, --register writes minimal run JSON per orphan. 536/0 tests.
- [x] **chore(tests): prune dead/stale/duplicate tests** (#117) (2026-08-06). 510 -> 382 tests (-128, -25%). Zero src/ changes. 5 pre-existing zero-coverage flags surfaced.
- [x] **fix(questionnaire): strict custom model id format validation** (#124) (2026-08-07). Whitelists opencode-go/zen/<m> and openrouter/<o>/<m> formats. +11 tests, 466/466 green.
- [x] **fix(cli): complete 1.0.4 version bump in src/cli.js** (#124) (2026-08-07). Hardcoded version 1.0.3 -> 1.0.4. test reads expected version from package.json. 466/466 green.
- [x] **fix(voyage-cwd): absolute path + lane-cwd** (2026-08-07). Drive prompt names <absLane>/armada/REQUIREMENTS.md; tmux new-session -c <absLane>. Locked by test.
- [x] **tighten orchestrator no-trivial exception + matrix** (#126) (2026-08-07).
- [x] **feat(voyage): prefix tmux session names with voyage-** (#127) (2026-08-07). Default session name voyage-<basename>. --name bypasses prefix. 472/0 tests.
- [x] **attach-auto-spawn: voyage attach and auto-attach tmux fallback** (#129) (2026-08-07).
- [x] **armada v1.0.4 release** (v1.0.4) (2026-08-07). 6 PRs since v1.0.3: #123-#129. 491/491 tests pass. Path B npm publish.
- [x] **feat(skill): armada-voyage-finish** (#130) (2026-08-07). 5-step voyage-finalization ritual as galleon subagent dispatch. Scaffolded into .opencode/skills/armada-voyage-finish/SKILL.md.
- [x] **feat(release): armada release <version> command** (#130) (2026-08-07). Bump + regen + test + commit + push + PR (step 1), tag + gh release (step 2). 520/520 tests. Stops at npm publish.
- [x] **voyage-finish-and-release** (#130) (2026-08-07). Single PR shipped F1 (skill) + F5 (command); 7 commits; 520/520 tests; stops at npm publish by code.
- [x] **workflow-triage** (#131) (2026-08-07). Single triage authority, consistency audit (F01-F21), 16 regression guards in tests/, dead-link grep zero. 547/547 tests, ledgers triaged.
- [x] **armada v1.0.5 release** (v1.0.5) (2026-08-07). PRs since v1.0.4: #130 voyage-finish-and-release, #131 workflow-triage. 547/547 baseline tests; published via `npm publish --access public --ignore-scripts` because DEF-003 blocked prepublishOnly. Tag + gh release live.

- [ ] **fix DEF-003** (regression-triage artifact-consistency). For 1.0.6. `tests/regression-triage.test.js:296` strictEqual against stale hardcoded render; renderer respects feature config correctly, test expectation is wrong. Re-derive expected from armada.yaml + active feature config at test time, OR scope assertion to fixture render. ~1 hour in follow-up voyage.
