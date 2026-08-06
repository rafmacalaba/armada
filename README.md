<p align="center">
  <img src="./docs/logo.png" alt="armada" width="400" />
</p>

<h1 align="center">armada</h1>

<p align="center">
  <strong>Turn any repository into a self-organizing AI engineering team.<br/>
  One command. 8 specialists. Evidence-gated delivery.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rafamacalaba/armada"><img src="https://img.shields.io/npm/v/%40rafamacalaba%2Farmada" alt="npm version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node.js >= 20" /></a>
  <a href="https://github.com/rafmacalaba/armada/actions"><img src="https://github.com/rafmacalaba/armada/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
</p>

armada scaffolds a coordinated AI engineering fleet for [opencode](https://opencode.ai). The
Commodore orchestrator delegates work to specialist agents, keeps feature work in isolated Git
worktrees, and requires evidence before delivery.

## Requirements

- [opencode](https://opencode.ai) installed and authenticated
- Node.js >= 20

Support for Claude Code and Codex is planned.

## Quick start

### Install globally

The npm package is scoped, but its executable is still `armada`:

```bash
npm install -g @rafamacalaba/armada
armada --version
armada doctor
```

### Create a new project

```bash
armada new my-app
cd my-app
opencode
```

`armada new` asks which starter to use, creates the project, and runs `armada init` for you.
Use `--blank`, `--config ./vars.json`, or `--yes` for non-interactive setup.

### Initialize an existing repository

```bash
cd your-repo
armada init
opencode
```

armada detects the stack and scaffolds the fleet around your existing code. Use
`armada init --yes --yolo` for autonomous setup without permission prompts.

### Run without installing

```bash
npx @rafamacalaba/armada@latest new my-app
npx @rafamacalaba/armada@latest init
```

### Isolate feature work

```bash
armada feature new my-feature --worktree
armada voyage sandbox/my-feature
```

## Upgrade

Update a global installation with the latest published package:

```bash
npm install -g @rafamacalaba/armada@latest
armada --version
armada doctor
```

For a one-off latest run without changing your global installation:

```bash
npx @rafamacalaba/armada@latest <command>
```

After upgrading, re-scaffold initialized repositories from their manifest:

```bash
cd your-repo
armada init --from-armada armada/armada.yaml --restart
```

See the [operator guide](./docs/operator-guide.md) for rollback, uninstall, and upgrade details.

## What armada generates

`armada init` adds a reproducible team to your repository:

- Native `.opencode/agent/` specialist definitions and slash commands
- `AGENTS.md` playbook with roles, phase gates, and evidence rules
- `armada/armada.yaml` manifest and `armada/REQUIREMENTS.md` contract
- Restart-proof state, end-to-end evidence, screenshots, and defect ledgers

Armada-owned files can be re-generated. Existing `AGENTS.md`, `opencode.json`, and
`REQUIREMENTS.md` files are not clobbered.

## How it works

You describe the goal to the Commodore. It co-writes a requirements contract, dispatches backend,
frontend, QA, security, adversary, documentation, and architecture specialists as needed, then
opens a reviewed Pull Request when phase evidence passes. A crashed session can resume from its
persisted state.

## Documentation

| Guide | Covers |
|---|---|
| [Getting started](./docs/getting-started.md) | Detailed setup, first feature, worktrees, and observability |
| [Operator guide](./docs/operator-guide.md) | Full CLI reference, upgrades, rollback, and uninstall |
| [User guide](./docs/user-guide.md) | Fleet concepts, roles, and day-to-day usage |
| [Architecture](./ARCHITECTURE.md) | Generator, manifest, agents, and data flow |
| [Why armada?](./docs/WHY.md) | Problem, design rationale, and proof |
| [Auth and cost](./docs/auth-and-cost.md) | Providers, credentials, and model tiers |
| [Troubleshooting](./docs/troubleshooting.md) | Common setup and runtime failures |
| [Contributing](./CONTRIBUTING.md) | Development workflow and project conventions |
| [Support](./docs/support.md) | How to report issues and request help |

## License

MIT. See [LICENSE](./LICENSE).
