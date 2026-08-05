# opencode-armada

**Evidence-gated AI engineering teams for [opencode](https://opencode.ai) — a crew that ships
only on proof, reproducible from a single manifest. MIT-licensed.**

Point armada at a repository and it generates a team of native opencode agents — one
orchestrator you talk to, backed by specialist subagents it dispatches in parallel. Phases
advance only on evidence (a passing test run, a screenshot, a file:line citation); defects
close only when qa retests them. No plugin required; opencode is the only runtime.

- **Evidence-gated.** A phase unlocks on passing tests + evidence; a defect closes only when qa retests it.
- **Native opencode.** The team is `.opencode/agent/*.md` files with `mode`/`model`/`permission` frontmatter — loaded and enforced by opencode itself.
- **Reproducible.** `armada init --from-armada armada/armada.yaml` regenerates the identical team anywhere.
- **12 commands, 4 slash commands, 9 bundled skills.** A small, grep-able surface.
- **Boundaries enforced by the SDK.** The orchestrator physically cannot edit code; security and architect are read-only. Not a prompt promise — a config fact.

## Requirements

- **Node.js >= 20** (`package.json` engines, `package.json:29`)
- **opencode CLI** — the runtime. Install it first: <https://opencode.ai>
- A provider credential. The default is **OpenCode Go** (free tier available);
  OpenRouter is optional for power-tier models. See [docs/auth-and-cost.md](./docs/auth-and-cost.md).

## Start here — 60 seconds

**New project** (scaffolds a starter repo with the team already inside):

```bash
npx opencode-armada new my-app --type web-app --beginner --yes
cd my-app
opencode
```

**Existing repo** (scaffolds the team into it):

```bash
cd your-repo
npx opencode-armada init --yes --yolo
opencode
```

`opencode` boots straight into the orchestrator. The contract
(`armada/REQUIREMENTS.md`) is blank, so it asks you one question at a time — scope, users,
phases, success criteria — and does not build until you explicitly approve it. Then it
dispatches independent phases in parallel and comes back only for judgment.

**Verify the harness** (in a terminal, not the TUI):

```bash
armada doctor     # all checks pass: opencode, providers, openrouter auth, global binary
armada status     # active feature, phase, next action
```

Prefer a global install over npx for day-to-day use: `npm install -g opencode-armada`, then
use `armada <command>` directly. Either way the binary is `armada`. Check the version with
`armada --version`; upgrade instructions in
[docs/operator-guide.md#upgrade](./docs/operator-guide.md#upgrade).

## The 12 commands

| Command | What it does |
|---|---|
| `armada init` | scaffold the team into an existing repo; regenerate from the manifest |
| `armada new <name>` | new project from a curated starter template |
| `armada doctor` | environment health check |
| `armada status [--feature <name>]` | where the fleet is: active feature, phase, next action |
| `armada fleet [session]` | per-lane progress dashboard (cross-repo) |
| `armada voyage <lane>` | boot a lane session and send the voyage prompt |
| `armada voyage-handoff <name>` | print a handoff block for dispatched voyages |
| `armada feature new\|list\|close` | per-feature contract management |
| `armada models [budget]` | curated model catalog |
| `armada resume` | resume after an interrupted session (exit 2 if evidence drifts) |
| `armada uninstall` | remove armada-generated artifacts |
| `armada help` | usage (also `armada --version`) |

`armada reconcile` is a documented alias for `armada resume`. Deprecated aliases (`drive`,
`update`, `preset`, `feature status`) print a hint and exit non-zero. Every command with its
full flag table: [docs/operator-guide.md#cli-reference](./docs/operator-guide.md#cli-reference).

## What you get

```
your-repo/
├── opencode.json                     # model, default_agent, permission, provider (never clobbers existing)
├── AGENTS.md                         # playbook: team roster, defect ledger, phase gates (marker-merged, user content preserved)
├── armada.yaml                       # manifest — source of truth, re-runnable
├── armada/
│   ├── REQUIREMENTS.md               # contract: phases + success criteria (co-written; never clobbered)
│   ├── state/                        # loop memory — restart-proof, written by the fleet
│   │   ├── active.json               # active feature, phase graph, evidence, next action
│   │   └── features/                 # per-feature contracts + index
│   ├── ledgers/<feature>/            # DEFECTS.md, ADVERSARIAL_REVIEW.md, SECURITY_FINDINGS.md
│   │                                 # (written by the fleet at runtime; only the SECURITY template is scaffolded)
│   ├── e2e/<feature>/                # per-feature e2e evidence (qa-owned)
│   └── screenshots/<feature>/        # per-feature screenshot evidence
└── .opencode/
    ├── agent/                        # 8 native agents, ship-named files (commodore.md, galleon.md, ...)
    ├── commands/                     # 4 slash commands: /armada, /armada-scout, /armada-voyage, /armada-resume
    ├── skills/                       # 9 bundled skills (4 user-facing, 5 fleet-internal)
    └── plugins/                      # armada-fleet.js (default-on) + optional supervision/watchdog
```

## The fleet

8 roles, governed by SDK permissions in the agent frontmatter. Role keys are the stable
identifier; ship names are cosmetic agent-file names and TUI labels.

| Role key | Ship name | Job | Writes code? |
|---|---|---|---|
| `orchestrator` | commodore | delivery lead: plans, delegates, gates phases | No — delegates all writes |
| `backend-dev` | galleon | server, API, storage, backend tests | Yes (backend files) |
| `frontend-dev` | clipper | UI/UX implementation, frontend tests | Yes (frontend files) |
| `qa` | corvette | e2e tests, screenshots, owns the defect ledger, closes defects | armada/e2e, armada/screenshots, armada/ledgers only |
| `adversary` | xebec | hostile review, breaks the running app | No — read-only |
| `security` | frigate | vulnerability/authz audit, security findings | No — read-only |
| `docs` | caravel | README, API docs, changelog | Docs only |
| `architect` | bark | architecture, refactor risk, review | No — read-only |

The default agent is the orchestrator (`default_agent: "commodore"` in the generated
`opencode.json`), so `opencode` boots into the fleet lead. The model catalog (primary +
fallback per budget tier) is in [docs/auth-and-cost.md#model-selection](./docs/auth-and-cost.md#model-selection).

## Documentation

| Doc | For |
|---|---|
| [docs/user-guide.md](./docs/user-guide.md) | first voyage end-to-end: every command, one example each |
| [docs/operator-guide.md](./docs/operator-guide.md) | install, upgrade, uninstall, rollback, full flag table, exit codes |
| [docs/auth-and-cost.md](./docs/auth-and-cost.md) | providers, budgets, cost expectations, rate limits, recovery |
| [docs/troubleshooting.md](./docs/troubleshooting.md) | common errors and their canonical fix |
| [docs/contributor-guide.md](./docs/contributor-guide.md) | dev setup, test loop, release flow |
| [docs/support.md](./docs/support.md) | where to ask, where to file, what to include |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | how armada works, module map |
| [SPEC.md](./SPEC.md) | design decisions |
| [TODO.md](./TODO.md) | the roadmap |
| [docs/RELEASING.md](./docs/RELEASING.md) | cutting a release |

## Support

- **File a bug or feature request:** <https://github.com/rafmacalaba/opencode-armada/issues>
- **Ask a question / report a problem:** open an issue with your `armada --version`, OS, Node
  version, and the output of `armada doctor`.
- **Security:** report privately via a GitHub issue marked security; see
  [docs/support.md](./docs/support.md).
- Project status, support window, and expected response times:
  [docs/support.md](./docs/support.md).

## License

MIT. See [LICENSE](./LICENSE).
