# Contributing to {project_name}

Thanks for contributing!

## Getting started

1. `uv sync`
2. `uv run train` to reproduce a training run.

## Tests

- Run `uv run pytest` before opening a PR.
- Add a test for every public function in `src/`.

## Pull request checklist

- [ ] `uv run pytest` green
- [ ] `uv run ruff check src/` green
- [ ] No secrets committed (`.env`, model checkpoints)
- [ ] Description explains what and why

## Conventions

- Type hints everywhere.
- Deterministic seeds for reproducible runs.
