# P0 — Public presentation audit (fresh, 2026-08-05)

Audit of the public-facing surface: README 60-second path, `armada help` clarity, support
signal, auth/cost/recovery doc presence. Gaps enumerated only — no fixes. Scope per
armada/REQUIREMENTS.md Phase 0 (line 21) and Phase 5 preview (lines 70-74).

## 1. README 60-second path

Target: does a new user reach "I have a working team" in 60 seconds?

Start-here flow (README.md:10-18):
- New project: `npx opencode-armada new my-app --type web-app --beginner --yes` then `cd` then
  `opencode` (3 commands, README:12-16).
- Existing repo: `npx opencode-armada init`, then `opencode` (README:18).

Gaps:

## P-01: No prerequisites stated
note: Node version and opencode install absent.
doc: README.md:1-74 — no "Requirements" section; Node >=20 only in package.json:28-30;
  opencode runtime never listed as a dependency in README (only SPEC.md:26-28). First-time
  user cannot know what to install first.

## P-02: npx package-name vs bin mismatch unverified
note: Package bin is armada, docs use npx opencode-armada.
doc: README.md:13,18 — `npx opencode-armada ...`; package.json:6-8 — bin is `"armada"` only.
  npm single-bin fallback behavior not verifiable without execution (see Open questions).

## P-03: "Working team" milestone unverifiable
note: No success check after opencode boots.
doc: README.md:15 — "the team loads; you delegate" — no "you should see X" check; doctor/status
  verification steps appear only in the existing-repo line (README:18), not the new-project path.

## P-04: Round-trip jargon in pitch
note: "init -> parse -> init" unexplained.
doc: README.md:8 — "init → parse → init is byte-identical" — parser jargon in a 60-second pitch;
  no elaboration until using-armada.md:289.

## P-05: No version or upgrade pointer in README
note: Upgrade path only in operator manual.
doc: README.md — no mention of `--version` or upgrades; buried in using-armada.md:13-30.

## P-06: README tree omits generated keys
note: opencode.json shown with two keys only.
doc: README.md:24 — "model + default_agent"; actual emitted keys include permission +
  provider.openrouter.models (generator.js:229-236, live opencode.json:5-48).

## 2. `armada help` clarity

HELP block: src/cli.js:44-86 — usage, deprecated, removed sections. Structure is clear.

Gaps:

## P-07: Help omits implemented flags
note: Supported flags never in help text.
code: src/cli.js:48-60 — init lines omit `--no-browser` (implemented cli.js:324) and
  `--dry-run` (cli.js:378); cli.js:63-65 — voyage line shows only `[--heartbeat]`, omits
  --name/--prompt/--timeout/--no-open/--print-attach (cli.js:631-684); models line omits
  --cache (cli.js:446); feature close omits --remove (cli.js:899).

## P-08: Deprecated list incomplete
note: reconcile alias missing from help.
code: src/cli.js:77-81 — deprecated section: drive/update/preset/feature-status; reconcile is
  a live deprecated alias (cli.js:170-171, 548-560) documented at using-armada.md:144.

## P-09: Exit codes undocumented
note: resume/reconcile exit codes not in help or docs.
code: src/cli.js:75 — resume "exit 2 if drifts" (only mention in help); reconcile forces exit 1
  (cli.js:553) — absent from help and using-armada.md:144.
  using-armada.md:134-136 documents resume exit 2 correctly (doc-side OK).

## P-10: Help has no pointer to docs
note: Help ends without doc links.
code: src/cli.js:86 — HELP ends after Removed section; no "see docs/using-armada.md" pointer.

## P-11: Per-command help claim false
note: All --help print global block.
doc: using-armada.md:294 — "`armada <cmd> --help` is always the canonical list".
code: src/cli.js:275-278, 535-537, 606-613 — every --help prints the identical global HELP.

## 3. Support signal

## P-12: No repository URL anywhere
note: No repo link in README or package.json.
doc: README.md:1-74 — only external link is opencode.ai (README:3); package.json:1-44 — no
  repository, bugs, or homepage fields; .github/ contains only workflows/ (no issue templates,
  no CONTRIBUTING).

## P-13: No "where to ask" section
note: No issues/discussions/support channel.
doc: README.md — no Support/Questions/Issues/Contributing section; README:66 "Deeper dives"
  links internal docs only. No mention of where to file bugs or ask questions.

## P-14: Support vector is internal only
note: Fleet self-improvement docks undocumented publicly.
doc: docs/armada-improves-armada.md:1-274 — dock/patrol flow is internal; no user-facing
  "how to report a bug in armada" path exists in README or using-armada.md.

## 4. Auth / cost / recovery docs

## P-15: Auth documented only in doctor section
note: Auth depth lives in operator manual only.
doc: using-armada.md:63-67 — doctor "providers + openrouter auth"; README.md:18 mentions doctor
  once. No dedicated auth/connect section anywhere (SPEC.md:27-28 is the only requirements
  statement).

## P-16: Cost info never documented
note: Cost hint exists only in init output.
code: src/init-summary.js:4-8 — COST_HINTS (free/balanced/power) printed at init end; not
  reproduced in README or using-armada.md; SPEC.md:120-122 has budget semantics, no cost.
  Phase 5 contract line 73 requires "Support/auth/cost/recovery docs" — cost section absent.

## P-17: Recovery documented but split
note: Resume covered; reconcile alias undocumented nuance.
doc: using-armada.md:131-144 — resume + reconcile alias documented; forced exit 1 on reconcile
  (cli.js:553) and help omission (P-08) not surfaced. Recovery doc present overall.

## P-18: No troubleshooting section
note: No failure-mode doc beyond resume.
doc: README.md, using-armada.md — no troubleshooting / common-failure section; doctor exit
  codes (cli.js:493-494) and resume exit 2 (using-armada.md:134-136) are the only signals.

## 5. Consistency notes (affects public trust)

## P-19: "4 user-facing skills" vs 9 shipped
note: Count mismatch visible to users.
doc: README.md:6, using-armada.md:369-381 — 4 user-facing; scaffold.js:322-338 ships 9 to
  .opencode/skills/ (skills/index.js:31-41).

## P-20: Fleet-tracker framed opt-in, is default
note: README-adjacent docs say opt-in.
doc: using-armada.md:276, armada-improves-armada.md:88-90 — "opt-in fleet-tracker plugin";
  scaffold.js:420-423 default-on, cli.js:343-345 warns.

## P-21: Ship names vs role keys unmapped
note: Alias list without mapping confuses.
doc: README.md:74, using-armada.md:395 — 8 aliases listed, no role-key mapping; generated
  .opencode/agent/ files are ship names (scaffold.js:297-298) while AGENTS.md roster uses role
  keys (generator.js:334).

## 60-second path verdict

Verdict: NOT DEMONSTRATED. Flow exists and is short (README.md:10-18), but no prerequisites
(P-01), no install/runtime version statement, unverifiable success milestone (P-03), and the
npx bin mapping (P-02) needs pack-time verification. Cannot confirm 60 seconds without a
clean-machine execution.

## Evidence checks

- evidence-check: PASS — README.md (74 lines) read; 60-second path, tree, command table, links audited.
- evidence-check: PASS — src/cli.js (938 lines) read; HELP text lines 44-86, flag parsing audited.
- evidence-check: PASS — package.json read; bin/engines/repository fields verified absent.
- evidence-check: PASS — .github/ listed; only workflows/ present.
- evidence-check: PASS — docs/using-armada.md read; flag table, skills, model, terminology sections audited.
- evidence-check: PASS — src/init-summary.js read; cost hints confirmed in init output only.
- evidence-check: PASS — src/doctor.js (1-200) read; auth checks confirmed.
- evidence-check: PASS — src/scaffold.js, src/generator.js, src/role-display.js, src/skills/index.js read; skill count, plugin default, naming verified.
- evidence-check: FAIL — live 60-second timed run not executed (no bash, no clean env). Timing claim unverified.

## Open questions (for commodore)

1. Verify `npx opencode-armada` resolves the single "armada" bin on npm 7+ (P-02) — pack-smoke lane can execute.
2. Does Phase 0 want the live repo re-scaffolded (`init --from-armada`) so the generated sample stops being stale, or is F-01/F-02 (docs-vs-code) accepted as generated-output staleness?
3. Scope question: are AGENTS.md (repo rules) drift items in scope for public presentation, or user-facing docs only?
4. Where should the support channel live once decided — package.json metadata, README section, GitHub issue templates?
