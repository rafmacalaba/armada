# Support

Where to ask questions, where to file bugs and feature requests, what to include, and what response to expect.

## Where to ask

- **GitHub issues** — the single public channel for both questions and bugs:
  <https://github.com/rafmacalaba/armada/issues>
- **Security findings** — open an issue and mark it security-related in the title/body. Do not post exploit details in a public thread before maintainers have had a chance to respond.

There is no private support channel, no chat server, and no paid support tier. This is an MIT-licensed open-source project maintained by its contributors.

## What to include in a bug report

A good report lets a maintainer reproduce without asking follow-ups:

1. `armada --version` output.
2. OS and Node version (`node --version`).
3. The output of `armada doctor` — it reports opencode presence, provider auth, openrouter auth, background dispatch, and environment health.
4. The exact command you ran and its full output.
5. Expected vs actual behavior.
6. Whether the problem reproduces in a fresh repo (`armada init --yes --yolo` in an empty directory) or only in your repo.

## Expected response

- **Bugs:** triaged by severity. HIGH (data loss, broken upgrade, cannot init/use at all) gets a response within a few days; MEDIUM/LOW when a maintainer picks them up. Response time is best-effort.
- **Feature requests:** acknowledged and triaged into [TODO.md](../TODO.md) when accepted.

## Project status and support window

- **Version support:** only the latest published release is supported.
- **Supported platforms:** macOS and Linux, Node >= 22.
- **EOL:** this project provides no long-term-support window; upgrading to the latest release is the supported path.

## Reporting a defect in a running fleet

If a fleet run inside an armed repo trips on something armada itself should fix (a template that misled an agent, a generator bug, a prompt stall), the armada-side path is: record it in the repo's defect ledger (`armada/ledgers/<feature>/DEFECTS.md`, qa-owned), then file an upstream issue with the details — see the "What to include" checklist above.
