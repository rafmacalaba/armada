# P0 — Docs-versus-code alignment (fresh, 2026-08-05)

Fresh inventory per armada/REQUIREMENTS.md Phase 0 (line 18). No baseline drawn from stale
AUDIT.md / ADVERSARIAL_REVIEW.md / DEFECTS.md / TODO.md (contract line 15). Alignment drift
only — no fixes proposed.

## Method

- Read every doc file in the live tree (source of truth): README.md, AGENTS.md, ARCHITECTURE.md,
  SPEC.md, docs/{using-armada,sandbox,RELEASING,validation,armada-improves-armada}.md, plus the
  contract (sandbox armada/REQUIREMENTS.md).
- Read implementation: src/{cli,generator,scaffold,model-catalog,role-display,doctor,
  init-summary,stack-detect,manifest,fleet-cmd,fleet-tracker,status-cmd}.js,
  src/skills/index.js, package.json.
- Generated-output sample: live repo .opencode/ (8 agent files, 6 command files, 9 skills,
  1 plugin), armada/armada.yaml, opencode.json.
- No bash — fresh scaffold into /tmp not possible (see Open questions). Live repo .opencode is
  the generated sample; noted where stale.
- Sandbox was mid-mutation by the npm-pack-smoke lane while read; live tree used instead.

## Alignment drift

### A. Agent file names and default_agent

## A-01: Agent file names are ship names, not role keys
note: Doc says role-key filenames; code writes ship names.
doc: AGENTS.md:62-64 — "Agents are native `.opencode/agent/<role>.md` files".
code: scaffold.js:297-298 — writes `.opencode/agent/${agentNameFor(role)}.md`; role-display.js:25-27
  maps role to lowercase display name (orchestrator -> commodore.md). Live .opencode/agent has
  bark.md, caravel.md, clipper.md, commodore.md, corvette.md, frigate.md, galleon.md, xebec.md.

## A-02: default_agent is commodore, not orchestrator
note: Doc says orchestrator; generated config says commodore.
doc: AGENTS.md:62-64 — "`default_agent: "orchestrator"`".
code: generator.js:232 — `default_agent: agentNameFor("orchestrator")` = "commodore";
  live opencode.json:4 — `"default_agent": "commodore"`.

## A-03: "no role has two names" contradicts alias list
note: Every role has two names.
doc: README:7 — "no command, skill, or role has two names".
code: role-display.js:6-15 — DISPLAY maps each of 8 roles to a second name; README:74 itself
  lists the 8 aliases.

## A-04: Ship-name to role-key mapping undocumented
note: No user doc maps alias to role.
doc: README:74, using-armada.md:395 — alias list only, no mapping; generated AGENTS.md:125-132
  roster uses role keys; .opencode/agent/ files are ship names. Only commodore.md:168 (generated
  prompt) pairs them, via "Galleon [backend-dev]" narration rule.

### B. Skills count

## B-01: "4 user-facing skills" vs 9 shipped
note: Docs say 4; generator ships 9.
doc: README:6 — "4 user-facing skills"; using-armada.md:369-381 — "The skills (4 user-facing)",
  "the rest are orchestrator-internal and never appear in user copy".
code: scaffold.js:322-338 — default writes all 9 skillRegistry skills to .opencode/skills/;
  skills/index.js:31-41 — 9 entries. Live .opencode/skills has 9 dirs.

### C. Fleet-tracker plugin default

## C-01: Fleet tracker is default-on, docs call it opt-in
note: Docs say opt-in; code defaults it on.
doc: using-armada.md:276 — "the opt-in fleet-tracker plugin (`armada init --fleet-tracker`)";
  armada-improves-armada.md:88-90 — "The opt-in fleet plugin".
code: scaffold.js:420-423 — plugin written unless `supervision.fleet === false`;
  cli.js:343-345 — `--fleet-tracker` only prints "now the default"; cli.js:418 — default
  manifest `fleet: true`; armada.yaml:25 — `fleet: true`.

## C-02: AGENTS.md frames --fleet-tracker as opt-in
note: AGENTS.md opt-in framing stale.
doc: AGENTS.md:78-84 — "Opt-in supervision: ... Also `--fleet-tracker` for `armada-fleet.js`".
code: cli.js:339-342 — opt-out is `--no-fleet-tracker`; plugin default-on (scaffold.js:421).

### D. SPEC.md drift

## D-01: AGENTS.md "never writes if exists" is wrong
note: SPEC says absent-only; code marker-merges.
doc: SPEC.md:87-88 — "armada init never writes `opencode.json` / `AGENTS.md` / `REQUIREMENTS.md`
  if they already exist (no clobber)".
code: scaffold.js:375-391 — AGENTS.md is written on every init: armada:start..armada:end section
  replaced in place, user content preserved; REQUIREMENTS.md absent-only (scaffold.js:396-398);
  opencode.json absent-only (scaffold.js:362).

## D-02: "--refresh is a stub" is stale
note: Refresh fully implemented, not stub.
doc: SPEC.md:113-114 — "`armada models --refresh` is a stub for merging live provider
  availability (see TODO)".
code: cli.js:452-459 — refreshModels + availability merge; validation.md:85-86 — live run evidence.

## D-03: "opencode/go-zen" provider name nonexistent
note: Provider name not in code.
doc: SPEC.md:112-113 — "Primary = opencode/go-zen (free where available)".
code: model-catalog.js:37-96 — IDs use `opencode-go/...` and `opencode/...`; no "go-zen" anywhere.

## D-04: Devcontainer gated on browserTesting, not devcontainer
note: SPEC says browserTesting; code uses devcontainer.
doc: SPEC.md:138 — "`.devcontainer/*` | armada | only when browser testing enabled".
code: scaffold.js:431-438 — written when `manifest.project.devcontainer` true; manifest field
  devcontainer independent of browserTesting (cli.js:411-415 default false).

## D-05: SPEC layout lists nonexistent commands/ dir
note: Layout lists dir that does not exist.
doc: SPEC.md:149-153 — directory layout includes `commands/`; omits `starter/`.
code: repo root has src/, agents/, presets/, template/, starter/, tests/, docs/ — no commands/.

## D-06: Orchestrator "ledgers allow" overbroad
note: Only two ledger files allowed, not all.
doc: SPEC.md:96 — orchestrator permissions "ledgers allow".
code: generator.js:39-40 — edit allow only for DEFECTS.md and ADVERSARIAL_REVIEW.md;
  SECURITY_FINDINGS.md not in orchestrator allow set.

### E. Commands, flags, help

## E-01: Flag table gaps vs code
note: Operator manual misses implemented flags.
doc: using-armada.md:296-333 — flag table lacks: init `--no-browser` (cli.js:324), init
  `--restart` (cli.js:280), voyage `--no-track` (cli.js:641), voyage `attach` subcommand
  (cli.js:616-625), models `--cache` (cli.js:446-449), feature close `--remove` (cli.js:899),
  feature `--target` (cli.js:815-818), uninstall `--from-armada` (cli.js:500-501).
  README:56 — "Every command's flags live in the operator manual, not here."
  HELP (cli.js:44-86) also omits --no-browser, --no-track, --cache, --remove, attach, and the
  init `--dry-run` flag (cli.js:378).

## E-02: Reconcile deprecated but absent from HELP deprecated list
note: Live deprecated alias not in help.
doc: using-armada.md:144 — "`armada reconcile` — deprecated; use `armada resume`".
code: cli.js:77-81 — HELP "Deprecated" section lists drive/update/preset/feature-status only;
  reconcile live at cli.js:170-171, 548-560 (prints deprecation, forces exit 1 at cli.js:553).

## E-03: "11 commands" misses voyage-handoff
note: HELP has 12th command, docs count 11.
doc: README:6 and README:42-54 (11-row table), cli.js:4-15 (11-item comment), ARCHITECTURE:161 —
  "11 subcommands"; voyage-handoff absent from every doc table.
code: cli.js:65 — HELP lists `armada voyage-handoff <name> [<name>...]`; dispatch at cli.js:199-200.

## E-04: "--help is canonical list" claim is global help
note: No per-command help exists.
doc: using-armada.md:294 — "`armada <cmd> --help` is always the canonical list".
code: cli.js:275-278 (init), 535-537 (resume), 606-613 (voyage) — every `--help` prints the
  same global HELP block; no per-command help.

## E-05: "drive is a hidden alias" vs printed in help
note: Alias is public, not hidden.
doc: using-armada.md:159 — "`armada drive` remains a hidden alias".
code: cli.js:78 — drive listed in HELP deprecated section; cli.js:176-178 — deprecation message,
  exit 1.

## E-06: Slash-command table naming mismatch
note: Docs use role keys; commands use ship names.
doc: using-armada.md:171 — /armada-scout "dispatch a read-only investigation (adversary/architect)".
code: generator.js:543-544 — routes to "xebec (hostile review) or bark (architecture risk)".
  Also using-armada.md:173 — /armada-resume "resume a killed session"; generator.js:556 — command
  body runs deprecated `armada reconcile`.

## E-07: AGENTS.md command list stale
note: Lists removed ping, omits six commands.
doc: AGENTS.md:40 — "entry: new / init / models / doctor / uninstall / ping / help".
code: cli.js:150-153 — ping removed (exit 1); missing from list: status, fleet, voyage, feature,
  resume, reconcile (all live, cli.js:166-175, 193-200).

### F. Generated-output sample (live repo)

## F-01: Live .opencode/commands has 2 retired files
note: Generated tree stale; generator emits 4.
doc: README:37 — ".opencode/commands/ # 4 slash commands".
code: scaffold.js:340-358 — armada-status.md + armada-fleet.md retired in v0.9.0+ and removed on
  re-scaffold; generator writes exactly 4 (scaffold.js:409-413). Live .opencode/commands has 6
  files (armada-fleet.md, armada-status.md still present) — live repo not re-scaffolded since.

## F-02: Generated commodore.md references retired command
note: Generated prompt stale until re-scaffold.
code: .opencode/agent/commodore.md:139-140 — Fleet commands list includes `/armada-status`;
  current generator emits no armada-status command (scaffold.js:341-344).
  (Doc-side 4-command table matches current generator — this is generated-output staleness only.)

### G. README tree and module map

## G-01: README tree omits permission/provider keys
note: opencode.json has four owned keys.
doc: README:24 — "opencode.json # model + default_agent (never clobbers existing)".
code: generator.js:229-236 — renderOpenCodeJson also emits permission + provider.openrouter.models
  (live opencode.json:5-48).

## G-02: README tree implies ledgers scaffolded
note: Only SECURITY_FINDINGS template written at init.
doc: README:32 — "ledgers/<feature>/ # DEFECTS.md, ADVERSARIAL_REVIEW.md, SECURITY_FINDINGS.md".
code: scaffold.js:403-407 — init writes only armada/ledgers/_template/SECURITY_FINDINGS.md;
  DEFECTS.md / ADVERSARIAL_REVIEW.md created by fleet at runtime, not scaffolded.

## G-03: ARCHITECTURE module map incomplete
note: Tree omits 15 modules.
doc: ARCHITECTURE:159-176 — src/ tree lists 11 files.
code: src/ also has drive.js, fleet-cmd.js, fleet-tracker.js, heartbeat.js, handoff.js,
  init-summary.js, ledgers.js, recommendations.js, reconcile.js, resume-cli.js, role-display.js,
  skills/, status-cmd.js, terminal-open.js, ui.js.

## Verified-aligned (spot list)

- 11-command table (README:42-54) matches main() dispatch (cli.js:138-211) minus voyage-handoff.
- Model catalog table (using-armada.md:358-367) matches armada.yaml:44-110 and
  model-catalog.js:37-96 (all 8 role primary/fallback pairs).
- 4 slash commands (using-armada.md:164-174) match current generator output (scaffold.js:409-413).
- STALLED 2-minute threshold (using-armada.md:274-275) matches fleet-tracker.js:117.
- Stack detection file list (using-armada.md:36-37) matches stack-detect.js:82-138.
- opencode.json no-clobber (README:24) matches scaffold.js:362.
- State paths active.json + features/index.json (README:29-31) match status-cmd.js:23-24.
- Fleet run store ~/.armada/runs/ + $ARMADA_RUNS_DIR (using-armada.md:84-85) matches
  fleet-tracker.js:193.
- RELEASING.md two-version rule (RELEASING.md:21-23) matches package.json:3 + cli.js:42.
- Doctor check list (using-armada.md:65-67) matches doctor.js:86-200.
- docs/validation.md explicitly self-marks historical layout records (validation.md:5-8).

## Evidence checks

- evidence-check: PASS — README.md (74 lines) read; claims cross-checked against src/cli.js, src/generator.js, src/scaffold.js, package.json.
- evidence-check: PASS — AGENTS.md (297 lines) read; armada-owned section lines 1-108 cross-checked.
- evidence-check: PASS — docs/using-armada.md (403 lines) read; flag table and command sections cross-checked against src/cli.js.
- evidence-check: PASS — docs/sandbox.md, docs/RELEASING.md, docs/validation.md, docs/armada-improves-armada.md read.
- evidence-check: PASS — ARCHITECTURE.md (319 lines) read; module map vs actual src/ listing.
- evidence-check: PASS — SPEC.md (164 lines) read; sections 5, 6, 7, 8 cross-checked.
- evidence-check: PASS — src/cli.js (938 lines) read; HELP text, dispatch switch, flag parsing.
- evidence-check: PASS — src/generator.js (1089 lines) read; renderers, permissions, opencode.json.
- evidence-check: PASS — src/scaffold.js (547 lines) read; write/uninstall paths, command retirement.
- evidence-check: PASS — src/role-display.js, src/skills/index.js, src/model-catalog.js (1-120), src/init-summary.js, src/doctor.js (1-200), src/status-cmd.js, src/fleet-cmd.js, src/fleet-tracker.js, src/stack-detect.js, src/manifest.js read (grep-verified).
- evidence-check: PASS — package.json, opencode.json (generated), armada/armada.yaml read.
- evidence-check: PASS — generated sample .opencode/agent/commodore.md + caravel.md, .opencode/commands (6), .opencode/skills (9), .opencode/plugins (1) listed/read.
- evidence-check: FAIL — fresh scaffold run into /tmp/armada-p0-docs-check not executed (no bash); live repo .opencode used as generated-output sample instead. See Open questions.

## Open questions (for commodore)

1. Fresh scaffold comparison (task step) not run — no bash. Packed-tarball lane (npm-pack-smoke) can scaffold into /tmp and diff README/AGENTS vs source; request that lane to emit the comparison.
2. `npx opencode-armada` (README:13,18) vs single bin "armada" (package.json:6-8) — npm single-bin fallback unverified without execution. Verify at pack time.
3. Live repo .opencode/commands has 2 retired files + generated commodore.md references /armada-status (F-01/F-02). Re-scaffold the live tree with `init --from-armada` to refresh sample, or confirm live tree is intentionally pre-v0.9.0.
4. Live AGENTS.md armada:start block names "ux-revamp" (AGENTS.md:113) — stale from a prior lane. Regenerate or remove.
5. AGENTS.md (repo rules) is internal, not user-facing — confirm whether its drift (A-01/A-02/C-02/E-07) is in scope for Phase 0, or only user-facing docs.
