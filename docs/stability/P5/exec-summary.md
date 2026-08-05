# P5 — Public docs + release packaging: exec summary

Phase 5 of the public-stability voyage. Docs-only work; no `src/*` edits. Date: 2026-08-05.

## What changed

Rewrote the public documentation surface so docs, help, generated artifacts, package
metadata, and actual behavior agree. README now delivers a 60-second path; six new docs cover
user, operator, contributor, support, auth/cost, and troubleshooting; SPEC and ARCHITECTURE
drift fixed; using-armada.md marked superseded; TODO.md appended with the ship item.

## Files added

- `docs/user-guide.md` — quickstart + every command, one-line purpose + one example
- `docs/operator-guide.md` — install, upgrade, uninstall, rollback, full flag table, exit
  codes, file ownership, state paths
- `docs/contributor-guide.md` — dev setup, test loop, release flow, contract workflow
- `docs/support.md` — where to ask/file, expected response, status, support window
- `docs/auth-and-cost.md` — providers, model selection, cost, rate limits, recovery
- `docs/troubleshooting.md` — common errors with canonical fixes (cited to src/cli.js +
  src/doctor.js)
- `docs/stability/P5/exec-summary.md` — this file
- `docs/stability/P5/60-second-path-verification.md` — README path walked against source
- `docs/stability/P5/release-checklist.md` — release artifacts, ticked against current state

## Files modified

- `README.md` — rewritten (60-second path, prerequisites, 12-command table, corrected tree,
  fleet table with ship-name mapping, docs index, support section)
- `ARCHITECTURE.md` — module map expanded 11 -> 27 modules, plugin-default statement
  corrected, tools list + doc pointers updated
- `SPEC.md` — sections 1.2, 2, 4, 5, 6, 7, 8, 9 corrected (see drift items below)
- `TODO.md` — appended public-stability ship line
- `docs/using-armada.md` — marked SUPERSEDED with a banner listing the sections that
  contradicted current code (kept for history; operator manual moved to operator-guide.md)

## P0 drift items closed (docs-vs-code-alignment.md)

| ID | Item | Closed by |
|---|---|---|
| A-01 | agent file names are ship names | README tree + fleet table, user-guide roles table |
| A-02 | default_agent is commodore | README fleet section, user-guide quickstart |
| A-03 | "no role has two names" claim | README (claim removed; both names tabulated) |
| A-04 | ship-name to role mapping undocumented | README fleet table, user-guide roles-and-ship-names |
| B-01 | "4 user-facing skills" vs 9 shipped | README tree, user-guide skills table (9 shipped: 4 user-facing + 5 fleet-internal) |
| C-01 | fleet tracker default-on vs docs "opt-in" | operator-guide Fleet tracker section, ARCHITECTURE, README tree |
| D-01 | SPEC "never writes AGENTS.md if exists" | SPEC section 4 (marker-merge documented) |
| D-02 | SPEC "--refresh is a stub" | SPEC section 6 (implemented: refresh/cache/list-openrouter) |
| D-03 | SPEC "opencode/go-zen" | SPEC sections 1.2, 2, 6 (opencode-go/opencode IDs) |
| D-04 | devcontainer gated on browserTesting | SPEC section 7 (gated on project.devcontainer) |
| D-05 | SPEC layout lists nonexistent commands/ | SPEC section 8 (starter/, template/, skills/; no commands/) |
| D-06 | orchestrator "ledgers allow" overbroad | SPEC section 5 (DEFECTS.md + ADVERSARIAL_REVIEW.md only) |
| E-01 | flag table gaps | operator-guide CLI reference (all flags incl. --no-browser, --restart, --no-track, attach, --cache, --remove, --target, --from-armada, --dry-run) |
| E-02 | reconcile absent from help deprecated list | closed in code by P1 (reconcile now documented alias in HELP); docs match |
| E-03 | "11 commands" misses voyage-handoff | README 12-command table + user-guide command reference |
| E-04 | "--help is canonical list" claim | operator-guide + user-guide (global help block documented); stale claim removed from using-armada banner |
| E-05 | "drive is a hidden alias" | operator-guide deprecated-alias table (public, listed in help) |
| E-06 | slash-command naming mismatch | user-guide slash-command table (scout routes xebec/bark; resume runs armada resume) |
| G-01 | README tree omits permission/provider keys | README tree (opencode.json: model, default_agent, permission, provider) |
| G-02 | README tree implies ledgers scaffolded | README tree (ledgers runtime-written; only SECURITY template scaffolded) |
| G-03 | ARCHITECTURE module map incomplete | ARCHITECTURE (27 modules) |

Closed: **21 of 25** (the P0 doc carries 25 numbered items A-01..G-03; the phase brief rounded
to 24). Remaining:

- **C-02** — AGENTS.md (repo rules) frames `--fleet-tracker` as opt-in. AGENTS.md is a
  blocked file for this phase; the correct framing is now documented everywhere else.
  Suggested owner: regenerate the live AGENTS.md armada block or edit by hand.
- **E-07** — AGENTS.md command list stale (lists removed ping, omits six commands). Same
  owner as C-02.
- **F-01 / F-02** — live repo `.opencode/commands/` has 2 retired files and the generated
  commodore.md references `/armada-status`. Generated-output staleness; fixed by re-scaffolding
  the live repo with `armada init --from-armada armada/armada.yaml`. Suggested owner: P2/P4.

## P0 presentation gaps closed (public-presentation.md)

P-01 (prerequisites), P-02 (npx single-bin documented; pack-time check in release
checklist), P-03 (success milestone: doctor + status), P-04 (round-trip jargon removed from
pitch), P-05 (version/upgrade pointer), P-06 (opencode.json keys in tree), P-08 (reconcile
now in help, P1), P-09 (exit-code table), P-11 (per-command help claim fixed), P-12 (repo
URL + issues link in README/support), P-13 (Support section), P-14 (public support vector),
P-15 (auth-and-cost.md), P-16 (cost hints in auth-and-cost.md), P-17 (recovery consolidated),
P-18 (troubleshooting.md), P-19 (skills count), P-20 (fleet-tracker default-on), P-21
(ship-name mapping).

Remaining, out of docs scope:

- **P-07** — HELP text omits implemented flags (`--no-browser`, `--dry-run`, `--cache`,
  `--remove`, voyage flags). Help text lives in `src/cli.js:44-90`. Suggested owner: P2.
- **P-10** — HELP has no pointer to docs. Same owner.

## Notes for the fleet

- P1 changed behavior after P0 was written: `reconcile` became a documented alias of `resume`
  (exit 0/1/2, not forced 1); `ping`/`scout` removed from the switch (now "Unknown command"
  but still listed in HELP Removed). All P5 docs reflect the P1 state, not P0.
- `src/cli.js:4-15` header comment still says "Commands (11 total)" while listing 12 —
  cosmetic src comment, out of docs scope.
- Live repo `.opencode/` is stale (F-01/F-02); re-scaffold before release so the generated
  sample matches the docs.

## Commit plan (docs, one per file)

1. `docs(readme): 60-second path, corrected tree + command table, support section`
2. `docs(user-guide): quickstart + every command with one example`
3. `docs(operator-guide): install/upgrade/uninstall/rollback + full flag table`
4. `docs(using-armada): mark superseded by operator-guide`
5. `docs(contributor-guide): dev setup, test loop, release flow`
6. `docs(support): public support channel, response expectations`
7. `docs(auth-and-cost): providers, budgets, cost, rate limits, recovery`
8. `docs(troubleshooting): common errors with canonical fixes`
9. `docs(architecture): full module map, plugin defaults, doc pointers`
10. `docs(spec): fix D-01..D-06 drift sections`
11. `docs(todo): append public-stability ship line`
12. `docs(stability): P5 evidence (exec summary, 60-second verification, release checklist)`

Note: this agent has no shell access; the commit sequence is executed by the lane driver /
meta-orchestrator on approval.

## Evidence checks

- evidence-check: PASS — every doc claim cross-checked against src/cli.js, src/doctor.js,
  src/scaffold.js, src/model-catalog.js, src/skills/index.js, src/new-command.js,
  package.json, .git/config (repo URL), .github/workflows.
- evidence-check: PASS — drift item IDs referenced verbatim from
  docs/stability/P0/docs-vs-code-alignment.md; gap IDs from docs/stability/P0/public-presentation.md.
- evidence-check: FAIL — live 60-second timed run not executed (no shell). See
  60-second-path-verification.md.
