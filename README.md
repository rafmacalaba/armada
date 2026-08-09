<p align="center">
  <img src="./docs/logo.png" alt="armada" width="180" />
</p>

<h1 align="center">armada</h1>

<p align="center">
  <strong>Stop prompting LLMs. Start doing loops.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rafamacalaba/armada"><img src="https://img.shields.io/npm/v/%40rafamacalaba%2Farmada" alt="npm version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" alt="Node.js >= 22" /></a>
  <a href="https://github.com/rafmacalaba/armada/actions"><img src="https://github.com/rafmacalaba/armada/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
</p>

---

## How it works

You write the goal. armada runs the loop.

```
   contract  →  dispatch  →  build  →  test  →  review  →  PR
        ↑                                                       |
        └────── evidence gates every step ──────────────────────┘
```

A written contract becomes a sequence of evidence-gated phases, each handled by a specialist agent, each producing artifacts you can read. The loop runs to a merged Pull Request. No babysitting the model, no prompt engineering — just a goal, a contract, and a PR at the end.

[Why this works →](./docs/WHY.md)

## Install

```bash
npm install -g @rafamacalaba/armada
```

Requires Node.js 22+ and an authenticated [opencode](https://opencode.ai) install. No daemon. No runtime dependency on armada after init.

## Start here

- **[Website tour](https://rafmacalaba.github.io/armada/)** — visual walkthrough of the loop, the fleet, and what each phase produces.
- **[Getting started](./docs/getting-started.md)** — your first feature, end to end.
- **[User guide](./docs/user-guide.md)** — fleet concepts, roles, day-to-day usage.
- **[Why armada?](./docs/WHY.md)** — the case for loop engineering over prompting.

## License

MIT. See [LICENSE](./LICENSE).
