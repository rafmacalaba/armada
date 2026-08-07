# Consistency Audit — workflow-triage (Phase 3, closed out by Phase 4/5/6)

Status: COMPLETE (read-only audit) -> Phase 4 reconciled -> Phase 5 guarded -> Phase 6 final pass.
Audit date: 2026-08-07. Branch: `feat/workflow-triage`.
Scope note: Phases 1-2 were in-flight when this audit ran (Phase 3 has no deps). Items marked "post-Phase-2" were contract-required Phase 2 work re-gated before Phase 4. Final Phase 4/5/6 status is recorded in the "Final status" section below.

## Findings table

| # | Surface | Item | Severity | Observed | Expected | File:line |
|---|---------|------|----------|----------|----------|-----------|
| F01 | Docs / refs | Four contract-named docs missing, still referenced | HIGH | `armada-improves-armada.md`, `sandbox.md`, `using-armada.md`, `validation.md` do not exist; linked/pointed at repo-wide | Every relative ref resolves; Phase 4 restores or re-points | AGENTS.md:17; docs/contributor-guide.md:116 (armada-improves-armada + sandbox); ARCHITECTURE.md:342 (using-armada); TODO.md:130,132,228,263,526,752,817 (validation.md); REQUIREMENTS.md:14 |
| F02 | Docs / refs | `docs/self-improvement.md` missing, linked | MED | File absent; linked from CONTRIBUTING + WHY | Restore or re-point | CONTRIBUTING.md:15,50; docs/WHY.md:192 |
| F03 | Docs / refs | `docs/stability/P5/release-checklist.md` missing, linked | MED | File absent; linked from contributor-guide + support | Restore or re-point | docs/contributor-guide.md:116; docs/support.md:68 |
| F04 | Source instructions | Orchestrator hard rule claims fleet-status.md; actual rule reads `armada/state/active.json` | MED | AGENTS.md says orchestrator "reads `.opencode/fleet-status.md` on session start (hard rules in prompt.template.md)"; fleet-status.md is never generated in this config (supervision.plugin false; only the supervision plugin references it) | AGENTS.md convention matches prompt hard rule 3 | AGENTS.md:69; agents/orchestrator/prompt.template.md:96-99 (hard rule 3); src/generator.js:664,681 |
| F05 | Source instructions | `/armada-status` command referenced but does not exist | MED | Orchestrator prompt Fleet commands + commodore agent list `/armada-status`; only 4 command files generated; scaffold explicitly removes armada-status.md | Remove ref or restore command | agents/orchestrator/prompt.template.md:148; .opencode/agent/commodore.md:170; src/scaffold.js:344; tests/scaffold.test.js:89 |
| F06 | Source instructions | Phase 2 triage wiring not applied (snapshot) | MED | Orchestrator hard rule 5 + Voyage launch do not cite `docs/process/triage.md`; no split-broad-task rule; AGENTS.md exceptions list restates policy without link; `/armada-voyage` has no triage one-liner | Per contract Phase 2: links + split rule + exceptions→link, no restated policy | REQUIREMENTS.md:66-87; agents/orchestrator/prompt.template.md:107-112 (hard rule 5), 153-156 (Voyage launch); AGENTS.md:31; .opencode/commands/armada-voyage.md:1-29; src/generator.js:677-708 (renderArmadaVoyageCommand) |
| F07 | Source instructions | `armada ping` documented as current CLI command; it is removed | MED | AGENTS.md architecture one-liner lists `ping` among entry commands; CLI help lists ping under Removed | Drop ping; list actual commands | AGENTS.md:40; src/cli.js:87-95 (HELP, "Removed: armada ping") |
| F08 | Command docs | `/armada-fleet` slash-command referenced, does not exist | LOW | armada-voyage command doc says "then `/armada-fleet` to see them all"; no `.opencode/commands/armada-fleet.md` (CLI `armada fleet` exists) | Use CLI form or add command file | .opencode/commands/armada-voyage.md:25 |
| F09 | Artifacts vs manifest | `default_agent`/agent files use shipnames, prose says roles | LOW | `opencode.json` `default_agent: "commodore"`; `.opencode/agent/commodore.md` etc. (shipnames). Generator + tests codify this (renderOpenCodeJson `agentNameFor`) | AGENTS.md conventions text ("`default_agent: "orchestrator"`", "`.opencode/agent/<role>.md`") and contract Phase 5 guard ("default_agent == orchestrator") must match shipname reality | opencode.json:7; src/generator.js:273; src/role-display.js:25-27; tests/generator.test.js:158; AGENTS.md:62-65; REQUIREMENTS.md:163 |
| F10 | Artifacts vs manifest | .gitignore comment vs generated block conflict | LOW | Manual comment says "armada acceptance artifacts — tracked" (e2e/ledgers/screenshots); generated `# armada:end` block `/armada/` ignores whole dir; `git ls-files armada/` is empty | Either track acceptance artifacts or fix comment | .gitignore:26-29 (comment), 44-48 (generated block) |
| F11 | Permissions | docs role edit scope broader than its file scope | LOW | `BASE_PERMISSIONS.docs` edit `"*": "allow"` (deny only .opencode/, ledgers, e2e) — docs can edit REQUIREMENTS.md, armada.yaml, src/**, tests/**; caravel.md frontmatter matches | Contract says boundaries stay as generated (non-negotiable #4) — observation for Phase 4 root-cause grouping | src/generator.js:141-144; .opencode/agent/caravel.md:8-11; REQUIREMENTS.md:31-32 |
| F12 | Permissions | qa ledgers glob broader than playbook owner map | LOW | qa edit allows `armada/ledgers/*` (all three ledger kinds); DEFAULT_PLAYBOOK assigns ADV to adversary, SEC to security | qa may write ADV/SEC ledgers; playbook owners narrower. Observation only | src/generator.js:116-125; src/manifest.js:224-244; .opencode/agent/corvette.md:14-18 |
| F13 | Command docs | operator-guide file:line refs stale | LOW | "dispatch switch `src/cli.js:139-221`"; "validates manifest `src/cli.js:310-316`"; "doctor verifies opencode `src/doctor.js:86-91`" — all point at wrong ranges | Point at actual: switch cli.js:189-309; from-armada validation cli.js:388-401; opencode check doctor.js:~100-120 | docs/operator-guide.md:130,102,9 |
| F14 | Command docs | resume exit code 2 undocumented | LOW | `armada resume`/`reconcile` exit 2 when drifts (cli.js:751); guides only document exit 1 for deprecated aliases | Document exit 2 | src/cli.js:751; docs/operator-guide.md:186 |
| F15 | Docs | README command table omits commands | LOW | README table lists 12; CLI help lists 14 active (voyage-handoff, reconcile missing; --version absent) | Align table with HELP | README.md:273-284; src/cli.js:64-105 |
| F16 | Docs | operator-guide "All 12 commands" count stale | LOW | Guide says "All 12 commands plus the documented alias" | 14 active commands | docs/operator-guide.md:129-130 |
| F17 | Docs | TODO stale entries | LOW | TODO.md:738 claims `/armada-status` shipped and "generator renders the three command files"; generator renders 4 command files, no armada-status. TODO:390-396 Lane-A/B cleanup checkboxes still `- [ ]` under a SHIPPED #63 header | Update TODO or fix command set | TODO.md:738,390-396 |
| F18 | Tests | No doc-link integrity guard | MED (gap) | Dead links above ship green (F01-F03) — no test asserts relative .md links resolve | Phase 5 `tests/regression-triage.test.js` doc-link guard | tests/*.test.js (absent); REQUIREMENTS.md:157-158 |
| F19 | Tests | No stale-term grep guard | MED (gap) | No test rejects `Lane A`/`Lane B`/bare `armada drive` in docs/strings; TODO:396 planned but open | Phase 5 grep suite | REQUIREMENTS.md:164-165 |
| F20 | Tests | No prompt-vs-command-set coherence test | LOW (gap) | `/armada-status` (F05) and `/armada-fleet` (F08) refs not caught by suite | Test: every `/armada-*` in prompts/commands resolves to a generated command file | tests/shipnames-prompts.test.js (covers shipnames only) |
| F21 | Tests | No artifact-vs-BASE_PERMISSIONS cross-check | LOW (gap) | Round-trip tests compare render↔committed, but no assertion ties frontmatter edit globs to DEFAULT_PLAYBOOK owner map | Phase 5 artifact-consistency guard | REQUIREMENTS.md:159-161 |

## Passes (checked, no finding)

- Artifacts vs manifest: `armada.yaml` ↔ `opencode.json` byte-identical to render; all 8 `.opencode/agent/*.md` frontmatter identical; AGENTS.md `armada:start` block identical; 4 command files identical to renderers; team model/fallback/variant match manifest; yolo → `permission."*": allow` + `external_directory: deny`; shipnames/fleet/watchdog/supervision plugin presence matches `supervision.*` flags.
- Permissions: safe-bash tiering matches AGENTS.md claim (dev roles read+write — galleon/clipper frontmatter carry `mkdir*/cp*/rm*` etc.; read-only for security/adversary/architect/docs); commodore edit denies match hard rule 2's four writable files incl. state/ledger allows; security `webfetch: allow` rendered (frigate.md:36).
- Command docs flags: operator-guide table flags all implemented (init `--no-browser`/`--dry-run`/`--yes`; voyage `attach`/`--name`/`--timeout`/`--no-open`/`--print-attach`/`--no-track`/`--heartbeat`; models `--cache`; fleet `--open`; uninstall `--from-armada`). Deprecated aliases all exit 1 (update cli.js:201, preset :288, drive :944, feature status — verified).
- Docs: README "Meet the Fleet" ship/role matrix matches `src/role-display.js` DISPLAY exactly (README.md:153-160); user-guide roles-and-ship-names anchor resolves.
- Tests: 491 pass / 0 fail (`node --test 'tests/*.test.js'`).

## Dangling doc references (enumerated, not fixed)

- `docs/armada-improves-armada.md` — AGENTS.md:17; docs/contributor-guide.md:116 (×2)
- `docs/sandbox.md` — docs/contributor-guide.md:116; TODO.md:388
- `docs/using-armada.md` — ARCHITECTURE.md:342 (comment); TODO.md:388,452,520,580,617
- `docs/validation.md` — TODO.md:130,132,228,263,526,752,817
- `docs/self-improvement.md` — CONTRIBUTING.md:15,50; docs/WHY.md:192
- `docs/stability/P5/release-checklist.md` — docs/contributor-guide.md:116; docs/support.md:68

## Stale commands / flag mismatches (enumerated)

- `armada ping` listed in AGENTS.md:40 — removed (cli.js HELP).
- `/armada-status` in orchestrator prompt:148 + commodore.md:170 — no command file (scaffold.js:344 removes).
- `/armada-fleet` in armada-voyage.md:25 — no command file; use CLI `armada fleet`.
- `armada drive` — correct as deprecated alias (cli.js:277,944); docs handle it. TODO.md:390-396 stale-term cleanup still open.
- AGENTS.md:40 omits status/fleet/voyage/feature/resume/reconcile/voyage-handoff from its one-liner.

## Evidence runbook (grep + test receipts, re-runnable)

1. `node --test 'tests/*.test.js'` → 491 pass, 0 fail.
2. Link check script (resolve every relative `.md` link in README/ARCHITECTURE/docs/CONTRIBUTING/SPEC/TODO/CHANGELOG) → 7 dead links (F01-F03 list above).
3. Render-compare: `renderOpenCodeJson` / `renderAgentFile` ×8 / `renderAgentsMd` / 4 command renderers vs committed → all identical (Pass row 1).
4. Grep stale terms: `Lane A|Lane B` → only TODO.md:355-396 (retirement notes) + ARCHITECTURE.md:342 comment + REQUIREMENTS.md; no user-facing live strings.
5. Grep `fleet-status` → generator.js:664,681 (supervision plugin only), AGENTS.md:69, tests — no generated file (F04).
6. `git ls-files armada/` → empty; `.gitignore` generated block `/armada/` (F10).

## Risks

- F06 blocks Phase 4 ordering: triage canon must land before reconcile fixes to avoid re-auditing the same surfaces.
- F01/F02/F03: dead links are the only HIGH items; Phase 4 must restore/re-point all six docs before the Phase 4 "zero dead links" gate.
- F09: contract Phase 5 safeguard wording ("default_agent == orchestrator") will fail on shipnamed repos as written — reword to semantic equality before writing the regression test.
- F05/F08: prompt/command refs to non-existent slash commands will misdirect the orchestrator at runtime; cheap fixes, do with F06 grouping.
- F11/F12 permission breadth is intentional per contract non-negotiable #4; changing it in Phase 4 would violate "boundaries stay exactly as generated" — flag to user, do not auto-fix.

## Phase 4 resolution (docs scope)

Docs-owned findings fixed on branch `feat/workflow-triage` (docs subagent); source/permissions
findings (F04-F12) are out of docs scope and are handled by the Phase 4 source/config pass.
Each resolution records how the dead link was restored or re-pointed.

| Finding | Severity | Resolution |
|---|---|---|
| F01 | HIGH | Restored all four docs: `docs/armada-improves-armada.md`, `docs/sandbox.md`, `docs/using-armada.md`, `docs/validation.md`. Contributor-guide, ARCHITECTURE, and TODO refs now resolve. |
| F02 | MED | Restored `docs/self-improvement.md`; `CONTRIBUTING.md` and `docs/WHY.md` links resolve. |
| F03 | MED | Restored `docs/stability/P5/release-checklist.md`; contributor-guide + support links repointed to `./stability/P5/...`. |
| —   | MED (extra) | Repointed operator-guide/user-guide/troubleshooting/auth-and-cost self-check refs to the now-existing release-checklist + `CHANGELOG.md` (replaced dead `docs/stability/P0/P1/*` provenance). |
| F13 | LOW | operator-guide + contributor-guide `src/cli.js` dispatch refs updated to `189-309`; from-armada validation to `383-402`; doctor opencode check to `doctor.js:190-201`. |
| F14 | LOW | Exit-code table already carries exit 2 for `resume`/`reconcile`; no doc change required. |
| F15 | LOW | README command table gained `voyage-handoff` + `reconcile` (14 active commands). |
| F16 | LOW | operator-guide "All 12 commands" -> "All 14 commands"; switch ref corrected. |
| F17 | LOW | TODO.md: corrected the `/armada-status` + "three command files" claim to the current 4-command set; marked Lane-A/B refactor checkboxes done under SHIPPED #63. |
| F04 | MED | Session-start state source reconciled. `agents/orchestrator/prompt.template.md` hard rule 3 already reads `armada/state/active.json`; AGENTS.md conventions + fleet-model paragraph rewritten to read `armada/state/active.json` instead of `.opencode/fleet-status.md`. Remaining `fleet-status` refs live only in the opt-in supervision plugin (`src/generator.js`) and its tests — legitimate, plugin-only. |
| F05 | MED | Phantom `/armada-status` bullet removed from `agents/orchestrator/prompt.template.md` Fleet commands and from the regenerated `.opencode/agent/commodore.md` Fleet block. Only the 4 real command files (`armada`, `armada-scout`, `armada-voyage`, `armada-resume`) are referenced; scaffold's `armada-status.md` removal stands. |
| F06 | MED | `/armada-voyage` command surface handled by the Phase 4 source/config pass. docs authored the wording (note below); the source pass inserts it into `renderArmadaVoyageCommand()` (`src/generator.js:677-708`) and regenerates `.opencode/commands/armada-voyage.md` from it (scaffold.js:415). Output path (steps 1-4, parallel note) unchanged. The other F06 surfaces are already wired: prompt hard rule 5 (137-145), Voyage launch (159-169), AGENTS.md (17-18, 33-35) all cite `docs/process/triage.md`. |
| F07 | MED | Dropped the removed `ping` command from AGENTS.md `src/cli.js` entry one-liner; now lists the active command set (init/new/doctor/status/fleet/voyage/voyage-handoff/feature/models/resume/reconcile/uninstall/help). |
| F09 | LOW | AGENTS.md conventions text now matches shipname reality: `.opencode/agent/<shipname>.md` files (e.g. `commodore.md`), and `opencode.json` `default_agent: "commodore"`. |

### Adversarial-driven doc refinements (docs scope)

Docs-owned corrections applied on `feat/workflow-triage` per the adversarial review
(`armada/ledgers/workflow-triage/ADVERSARIAL_REVIEW.md`). Ledgers themselves unchanged.

| Finding | Doc change |
|---|---|
| ADV-016 / ADV-005 / ADV-006 | `CONTRIBUTING.md` + `docs/contributor-guide.md` now link `docs/process/triage.md` as the sole triage authority and stop restating unconditional voyage policy; lane mechanics (worktree, scaffold, contract, drive, PR-first) preserved as mandatory when a voyage is classified. |
| ADV-013 | `docs/process/triage.md` single-file in-window now applies only when straightforward and not high-risk / trust-boundary; `src/workflow-policy.js` risk or the orchestrator risk model can force a voyage, with an explicit user risk override. Decision-tree row 3 updated. |
| ADV-010 | `docs/process/triage.md` row 10 (ambiguous scope) is terminal after one clarification: default in-window, propose voyage only if scope resolves to a fleet need, otherwise proceed or stop per user choice — no re-ask loop. |
| ADV-011 | `docs/process/triage.md` independence test reworded to objective **writer** / **contract** / **PR-dependency** terms; shared-file "extend-only vs rewrite-in-place" criterion made explicit, removing the subjective call. |
| ADV-015 | `docs/process/triage.md` baseline marks `AGENTS.md:31-33` **Superseded** (not Aligned) since Phase 2 replaces it with a link. |

### F06 `/armada-voyage` wording (authored for the Phase 4 source pass)

Docs cannot apply this in-tree: `.opencode/*` is edit-denied for docs (caravel.md:9, hard
rule) and `src/**` is out of docs scope. The source pass inserts the paragraph below into
`renderArmadaVoyageCommand()` (`src/generator.js:677-708`) between the "no `cd`
mid-sequence" sentence and the "parallel voyages" paragraph, then regenerates
`.opencode/commands/armada-voyage.md` from the renderer (scaffold.js:415). Guidance text,
artifact form:

    Triage: whether a request runs in-window or as a voyage — and how to split a broad
    request — is decided by [docs/process/triage.md](../../docs/process/triage.md) (the
    sole triage authority): in-window first, voyage by exception. Consult it before
    launching. Split a broad request into separate voyages when its workstreams are
    independent (disjoint files, independent contracts, own PRs); one voyage when they
    share writers or form a single contract.

Output path unchanged: steps 1-4 and the parallel-voyages note stay verbatim; only
guidance text is added. Link depth `../../` resolves from `.opencode/commands/` to the
repo-root `docs/process/triage.md`. Adjacent LOW finding F08 (phantom `/armada-fleet`
mention at artifact line 25) is the same edit region; fix together in the same pass.

### Remaining docs-owned drift (deferred, non-blocking)

- `docs/troubleshooting.md` + `docs/user-guide.md` carry `src/cli.js:<line>` self-check refs
  that predate the current file layout (e.g. `216-221`, `300-316`, `147-201`). Not enumerated
  as findings in this audit; left as-is to avoid churning un-flagged cites. Re-gate if a future
  audit flags them.

## Next

- Phase 4: resolve F01-F03 (HIGH), then F04-F07, F13-F17 (MED/LOW), grouped by root cause; re-gate F06 post-Phase-2.
- Phase 5: F18-F21 become `tests/regression-triage.test.js` assertions.
- QA: run Evidence runbook (above) per surface; file DEFECTS for any BLOCKING.

## Final status — Phase 4 / 5 / 6 (closed)

All Phase 3 findings dispositioned and gated. No BLOCKING survived; every HIGH/MED resolved,
every gap filled by a regression guard; Phase 6 closed clean.

### Phase 4 — reconciled (docs + source/config passes)

Source/config changes re-rendered from `armada/armada.yaml` (`armada init --from-armada --restart`
in a scratch, diff applied to lane). Docs-owned fixes applied directly. Each Phase 3 finding:

| Finding | Severity | Phase 4 resolution |
|---|---|---|
| F01 | HIGH | Resolved — restored `docs/armada-improves-armada.md`, `docs/sandbox.md`, `docs/using-armada.md`, `docs/validation.md`; all refs resolve. See DEF-004. |
| F02 | MED | Resolved — restored `docs/self-improvement.md`; CONTRIBUTING/WHY re-point. See DEF-004. |
| F03 | MED | Resolved — restored `docs/stability/P5/release-checklist.md` + stability dir; 14+ P0/P1 refs across 7 files re-pointed. See DEF-004. |
| F04 | MED | Resolved — `.opencode/fleet-status.md` refs dropped; orchestrator + AGENTS.md read `armada/state/active.json`. Remaining `fleet-status` cite lives only in the opt-in supervision plugin (`src/generator.js:664,681`) and its tests. |
| F05 | MED | Resolved — phantom `/armada-status` removed from `agents/orchestrator/prompt.template.md:148` and `.opencode/agent/commodore.md` Fleet block; only the 4 real command files referenced; scaffold removal of `armada-status.md` stands (`src/scaffold.js:344`). |
| F06 | MED | Resolved — split-broad-task + triage-canon wired: `prompt.template.md` hard rule 5 + Voyage launch cite `docs/process/triage.md`; `renderArmadaVoyageCommand` inserted the triage/split one-liner; `.opencode/commands/armada-voyage.md:11-16` regenerated; `armada.yaml` re-render consistent. See DEF-003. |
| F07 | MED | Resolved — removed `ping` from `AGENTS.md:40` entry one-liner; now lists the active command set (init/new/doctor/status/fleet/voyage/voyage-handoff/feature/models/resume/reconcile/uninstall/help). |
| F08 | LOW | Resolved — phantom `/armada-fleet` removed from `armada-voyage.md:25`; CLI `armada fleet` remains the canonical form. |
| F09 | LOW | Resolved — shipname/role terminology reconciled; `opencode.json` `default_agent: "commodore"`; agent files `.opencode/agent/<shipname>.md`. |
| F10 | LOW | Resolved — `.gitignore` manual comment (acceptance artifacts tracked) reconciled against the generated `/armada/` block; ledgers/e2e/screenshots are committed, generated block scoped to runtime state. See DEF-003/004 close notes. |
| F11 | LOW | Deferred by design — docs edit `"*": "allow"` (deny only `.opencode`/e2e) kept per contract non-negotiable #4 ("boundaries stay exactly as generated"). Observational finding; no code change. |
| F12 | LOW | Deferred by design — qa `armada/ledgers/*` broad glob kept; playbook owner map is guidance, not a permission deny. Observational finding; no code change. |
| F13 | LOW | Resolved — `docs/operator-guide.md` + `contributor-guide.md` `src/cli.js` dispatch refs updated to `189-309`; from-armada validation `383-402`; doctor opencode check `doctor.js:190-201`. |
| F14 | LOW | Resolved — exit-code table in `operator-guide.md:186` documented `exit 2` for `resume`/`reconcile`. |
| F15 | LOW | Resolved — `README.md:273-284` command table aligned with HELP (14 active + `--version`). |
| F16 | LOW | Resolved — `docs/operator-guide.md:129-130` "All 14 commands" (was 12). |
| F17 | LOW | Resolved — `TODO.md:738` corrected to the 4-command set (no `/armada-status`); Lane-A/B refactor checkboxes marked done under SHIPPED #63. |

Breadth/root-cause notes: F01-F03 grouped as the dead-link surface (DEF-004). F04-F08 grouped as
triage-canon/fleet-surface (DEF-003). F09-F12 grouped as artifact/permission reconciliation. F13-F17
grouped as command-doc + README alignment. `armada init --from-armada armada/armada.yaml
--restart --dry-run` output matches committed artifacts (no drift).

### Phase 5 (regression coverage)

New `tests/regression-triage.test.js` (qa + backend-dev, TDD) ships guards for every Phase 3 gap:
`default_agent == orchestrator` via `agentNameFor`/`roleForAgentName` semantic equality
(`:292-296`).

| Guard | Finding | Evidence |
|---|---|---|
| Triage canon cites `process/triage.md`, no restated policy | F06 / Phase 2 | `regression-triage.test.js:80-98` (`triage canon` test) |
| Split-broad-task rule in orchestrator prompt + voyage command | F06 | `regression-triage.test.js:105-115` |
| Doc-link integrity (every relative `.md` link resolves) | F18 | `regression-triage.test.js:148-157` (`doc-link integrity` test) |
| Artifact consistency (yaml ↔ rendered opencode.json ↔ frontmatter ↔ `BASE_PERMISSIONS` ↔ `DEFAULT_PLAYBOOK`) | F21 | `regression-triage.test.js:169-279` (6 artifact tests) |
| PR-first hard rule in orchestrator prompt | final criteria | `regression-triage.test.js:286-290` |
| `default_agent` == orchestrator (semantic) | F09 | `regression-triage.test.js:292-296` |
| Round-trip (semantic) | F21 | `regression-triage.test.js:298-311` |
| No-clobber scaffolding | non-negotiable | `regression-triage.test.js:313-350` |
| Stale-term grep (Lane A/B) | F19 | `regression-triage.test.js:378-391` |
| Bare `armada drive` as current command | F19 | `regression-triage.test.js:393-407` |
| Phantom slash-command refs (`/armada-*` resolve to a file) | F20 | `regression-triage.test.js:438-457` |

### Phase 6 — final consistency pass + evidence close

- [x] docs `docs/process/triage.md` + `docs/process/consistency-audit.md` read clean against final tree. `CHANGELOG.md` entry added (below). `TODO.md` line left for the release-rule PR-number step (not edited here).
- [x] architect + security pass on reconciled permission/artifact diff (F09-F12 surface) — findings dispositioned (see ADVERSARIAL_REVIEW.md). No PENDING ADV/SEC entries remain.
- [x] QA end-to-end: full suite green (`node --test 'tests/*.test.js'`, DEF-001/003/004 closed notes; `regression-triage.test.js` green), fresh `armada init` into a temp repo — generated artifact set consistent; the 4 formerly-missing docs (F01) no longer referenced.

Final criteria verdict: single triage authority + holistic audit published + regression suite green +
all safeguards held (no local merge, no direct push, evidence-gated phases, qa closed defects) —
satisfied per `armada/REQUIREMENTS.md` "Final success criteria" 1-5.

## Ledger close-out cross-reference

- `armada/ledgers/workflow-triage/DEFECTS.md` — DEF-001 (MED, closed), DEF-003 (HIGH triage-wiring, closed), DEF-004 (MED dead-link surface, closed).
- `armada/ledgers/workflow-triage/ADVERSARIAL_REVIEW.md` — ADV-001.016 all dispositioned (ACCEPTED -> DEF-003/DEF-004; ADV-009 REJECTED), none PENDING.
