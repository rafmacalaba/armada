# Interactive setup UX — arrow-key pickers

Date: 2026-08-02

## Problem

`armada init`'s first-time setup (`src/questionnaire.js`) leans on plain
Y/N `confirm()` prompts and free-text input where a picker would be clearer:

- 8 separate "Include <role>?" Y/N prompts for team selection
- budget tier is free-text with a default
- no visual grouping, no final review before writing files

## Goals

- Replace Y/N and selectable free-text prompts with an arrow-key selector
- One interaction for team selection instead of eight
- Full polish: colors, section grouping, keyboard hints, final setup summary
- Keep the zero-runtime-dependency contract in AGENTS.md
- Non-TTY safe: `--yes`, `--headless`, CI, piped stdin never hang on raw mode

## Approach

New `src/ui.js` module with three primitives, hand-rolled on `node:readline`
raw mode + ANSI escapes. No new dependencies. `questionnaire.js` keeps
orchestration only.

### Primitives (`src/ui.js`)

All accept `{ input, output }` for test injection.

- `select(title, options, { defaultIndex })` — single choice
  - options: `{ label, value, hint? }`
  - ↑/↓ move `▸`, Enter picks, returns `value`
- `multiSelect(title, options, { defaults })` — team selection
  - ↑/↓ move, Space toggles `☑`/`☐`, Enter finishes, `a` = all, `n` = none
  - returns `[values]` of selected options
- `confirm(title, dflt)` — built on `select` with Yes/No options, returns bool

**TTY detection:** if `!input.isTTY`, every primitive falls back to the
existing line-based behavior (`ask`/Y-N parse) so CI and piped runs work
unchanged. `--yes`/`--headless` already bypass the questionnaire entirely.

**Colors:** ANSI colors enabled only when output is a TTY and `NO_COLOR`
is unset. Plain text otherwise. Hint line under multi-select shows the
shortcuts.

### Call sites (`src/questionnaire.js`)

1. **Budget tier** — `select` over free/balanced/power, default balanced.
   Replaces free-text `ask`.
2. **Team roles** — one `multiSelect` over the 8 roles, all default
   selected. Replaces the 8 `confirm` loops.
3. **Model customization** — `confirm` per role (arrow-key Yes/No),
   unchanged questions.
4. **Browser/e2e + devcontainer** — `confirm`.
5. **Summary screen** — after all input, render a compact table of the
   choices (name, budget, roles, per-role model, browser), then
   `confirm("Write this configuration?")`. Only then does scaffolding write.

### Flow sketch

```
=== opencode-armada setup ===
Detected stack: Next.js 15 + TypeScript

Project name [my-app]:

▸ Budget tier
    balanced
    free
    power

Team roles (↑/↓ move, space=select, a=all, n=none, enter=done)
  ☑ orchestrator
  ☑ backend-dev
  ☑ frontend-dev
  ☑ qa
  ☐ adversary
  ...

Customize model for orchestrator? ▸ Yes / No

── Summary ─────────────────────────────
name:        my-app
budget:      balanced
team:        orchestrator, backend-dev, frontend-dev, qa (4 roles)
browser:     e2e enabled
─────────────────────────────────────────
Write this configuration? ▸ Yes
```

### Tests (`tests/ui.test.js`)

Injected streams (pass `{ input, output }`); no real TTY needed for the
happy path by providing a fake keypress feed:

- select: arrow-down then Enter returns second option
- select: Enter immediately returns default
- multiSelect: space toggles off, Enter returns remaining
- multiSelect: `a` selects all, `n` selects none
- non-TTY input: primitives fall back to line-based behavior
- colors disabled when output is not a TTY / `NO_COLOR` set
- questionnaire: budget picker returns expected budget; team multiSelect
  drives enabled roles

Existing questionnaire tests in `tests/scaffold.test.js` / CLI e2e updated
for new signatures. Non-TTY paths keep the existing behavior exactly.

### Error handling

- Ctrl-C during raw mode: restore terminal, exit cleanly (nonzero)
- Non-TTY fallback covers CI; `--yes`/`--headless` bypass questionnaire
- Redraw loop uses `\r` + cursor-up clears to avoid scrolling flicker

## Out of scope

- Replacing `pickModel`'s numbered picker with the arrow selector (kept;
  it already works and is one interaction)
- Config file UI, live model probing, other CLIs
