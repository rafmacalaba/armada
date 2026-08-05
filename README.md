# opencode-armada

**Evidence-gated AI engineering teams for [opencode](https://opencode.ai) — a crew that ships only on proof, reproducible from a single manifest.** MIT-licensed.

- **Evidence-gated phases.** A phase unlocks on passing tests + evidence; a defect closes only when qa retests it.
- **11 commands, 4 slash commands, 4 user-facing skills.** A small, grep-able surface.
- **One name per job.** Role keys (`orchestrator`, `backend-dev`, ...) are canonical; no command, skill, or role has two names.
- **Round-trip safe.** `armada init --from-armada armada.yaml` rebuilds the identical team; init → parse → init is byte-identical.

## Start here

```bash
npx opencode-armada new my-app --type web-app --beginner --yes   # new project (or: bunx ...)
cd my-app
opencode                              # the team loads; you delegate
```

Existing repo: `npx opencode-armada init`, then `opencode`. Verify the harness with `armada doctor`; see where the fleet is with `armada status`.

## What you get

```
your-repo/
├── opencode.json                     # model + default_agent (never clobbers existing)
├── AGENTS.md                         # playbook: team roles, defect ledger, phase gates
├── armada.yaml                       # manifest — source of truth, re-runnable
├── armada/
│   ├── REQUIREMENTS.md               # contract: phases + success criteria (co-written)
│   ├── state/                        # loop memory — restart-proof, written by the fleet
│   │   ├── active.json               # active feature, phase graph, evidence, next action
│   │   └── features/                 # per-feature contracts + index
│   ├── ledgers/<feature>/            # DEFECTS.md, ADVERSARIAL_REVIEW.md, SECURITY_FINDINGS.md
│   ├── e2e/<feature>/                # per-feature e2e evidence (qa-owned)
│   └── screenshots/<feature>/        # per-feature screenshot evidence
└── .opencode/
    ├── agent/                        # 8 native agents: mode/model/permission frontmatter
    └── commands/                     # 4 slash commands: /armada, /armada-scout, /armada-voyage, /armada-resume
```

## The 11 commands

| Command | What it does |
|---|---|
| `armada init` | scaffold the team into an existing repo; re-scaffold from manifest |
| `armada new <name>` | cookiecutter-style: new project from a curated starter |
| `armada doctor` | environment health check |
| `armada status [--feature <name>]` | where the fleet is: active feature, phase, next action |
| `armada fleet [session]` | per-lane progress dashboard |
| `armada voyage <lane>` | boot a lane session for feature work |
| `armada feature <new\|list\|close>` | per-feature contract management |
| `armada models [budget]` | curated model catalog |
| `armada resume` | resume after an interrupted session |
| `armada uninstall` | remove armada-generated artifacts |
| `armada help` | usage (also `armada --version`) |

Every command's flags live in the operator manual, not here.

## Operator manual

README is the pitch; [docs/using-armada.md](./docs/using-armada.md) is the practice — install and upgrade, the 11 commands in detail with the full flag table, the contract co-write flow, multi-feature work, observability, lifecycle, the role roster, the model catalog, the four user-facing skills, and fleet terminology.

## Deeper dives

- [ARCHITECTURE.md](./ARCHITECTURE.md) — how armada works.
- [SPEC.md](./SPEC.md) — design decisions; [TODO.md](./TODO.md) — the roadmap.
- [docs/RELEASING.md](./docs/RELEASING.md) — cutting a release.

## License

MIT. See [LICENSE](./LICENSE).

---

> Cosmetic aliases only: commodore, galleon, clipper, corvette, xebec, frigate, caravel, bark — agent file names; the manifest role keys are the source of truth.
