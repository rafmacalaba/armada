# opencode-armada — Session Journal

Project: reproducible AI-engineer multi-agent team generator for opencode, built on
oh-my-opencode-slim. Repo: `~/WBG/opencode-armada`. v0.1 committed (4e23425).

## Architecture (one line each)

- `src/cli.js` — entry: `init` / `models` / `doctor` / `ping` / `help`
- `src/model-catalog.js` — 8 roles × provider × budget (free/balanced/power)
- `src/stack-detect.js` — auto-detect stack from manifests + instruction files
- `src/questionnaire.js` — interactive setup (zero-dep readline)
- `src/generator.js` — pure renderers (slim jsonc, opencode.json, AGENTS.md, REQUIREMENTS.md, armada.yaml)
- `src/scaffold.js` — writes files into target repo, no-clobber on user files, fills prompts
- `agents/<role>/prompt.template.md` — stack-aware prompts w/ `{placeholders}`, terse output contracts
- `presets/*.yaml` — free / balanced / power

## Current state

- 19 tests passing: `node --test 'tests/*.test.js'`
- CLI verified end-to-end (`init --from-armada` idempotent, `models`, `ping`, `doctor`)
- Stack detection verified against `~/WBG/data-ai-chatbot` (fastapi+nextjs) and `~/WBG/data360-mcp` (python-fastapi+pytest)
- NOT a plugin (generator only); omo-slim is the required runtime engine
- caveman-terse prompts for token mitigation; background orchestration = omo-slim native

## Next task (see TODO.md)

1. Validate in `~/WBG/data-ai-chatbot`: `armada init` → `ping all agents` → background orchestration smoke test. Record in `docs/validation.md`.
2. Real `armada models --refresh` (shell out to `opencode models`, merge live availability).
3. Real `armada doctor` (spawn checks, read `~/.config/opencode/opencode.json` plugin[]).
4. Replace regex manifest parser with real YAML parser.

## Commands

```bash
node src/cli.js help
node --test 'tests/*.test.js'    # run tests
node src/cli.js init --from-armada armada.yaml   # re-scaffold
```

## Notes

- bun not installed on this machine; node v23 works everywhere.
- OpenCode Go authed (`opencode-go/...`); OpenRouter needs key (`/connect`).
- Background orchestration needs `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true opencode`.
