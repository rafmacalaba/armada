# Native Mode — Drop the omo-slim Dependency

Status: approved for implementation. Date: 2026-08-02.

## 1. Problem

armada's team currently depends on the `oh-my-opencode-slim` (omo-slim) plugin at runtime. That
dependency is fragile and mostly vestigial:

- The generated `opencode.json` already emits the full `agent:` block natively (mode, model,
  per-role permissions); omo-slim's `config` hook — which is supposed to inject agents from
  `.opencode/oh-my-opencode-slim.jsonc` — is **un-called** in opencode 1.18.11. The jsonc is
  inert for agent injection.
- Keeping omo-slim alive requires a locally patched copy (`oh-my-opencode-slim@2.2.8-patched`)
  with a full `node_modules/`, because upstream crashes on load. Every omo-slim/opencode release
  is a footgun.
- Every scaffold carries `.opencode/node_modules/`.

The capability omo-slim contributes — background job tracking, `cancel_task`, `wait_for_user` —
is **native to opencode** (background `task` subagents behind
`OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true`; `cancel_task` and `wait_for_user` are built-in
tools). omo-slim's job board is an enhanced panel over the native mechanism, not a separate
engine.

Decision: **replace omo-slim entirely.** armada becomes a zero-plugin, fully-native opencode team
generator. This removes the fragile dependency chain and sharpens the positioning ("native
opencode teams, no plugins").

## 2. Goals

- Emit a fully native opencode team: `.opencode/agent/*.md` + minimal `opencode.json`.
- Self-contained orchestrator prompt (no base prompt supplied by a plugin).
- Parallel dispatch via opencode-native background `task` subagents, inline fallback for
  headless/one-shot runs.
- Close the audit findings that live in the same code paths (see §7).
- Keep the working workflow identical: contract co-writing, gated phases, defect ledger,
  adversary triage, boundaries, reproducibility.

## 3. Non-goals

- No machine-tracked status ledger / `/armada` board enrichment (separate iteration).
- No multi-repo / fleet support.
- No firstmate-style visible tmux crew.
- No omo-slim compatibility mode (`--runtime omo`). The old layout is pruned on re-scaffold.

## 4. Generated artifacts

New layout produced by `armada init` / `armada new`:

```
your-repo/
├── opencode.json                     # minimal
├── AGENTS.md                         # playbook (unchanged)
├── armada/
│   ├── REQUIREMENTS.md               # contract (unchanged)
│   └── armada.yaml                   # manifest (unchanged)
└── .opencode/
    ├── agent/
    │   ├── orchestrator.md           # mode: primary, color: cyan
    │   ├── backend-dev.md            # mode: subagent
    │   ├── frontend-dev.md
    │   ├── qa.md / adversary.md / security.md / docs.md / architect.md
    └── commands/armada.md            # /armada (unchanged)
```

Each `.opencode/agent/<role>.md`:

- YAML frontmatter: `description`, `mode` (`primary` for orchestrator, `subagent` for the rest),
  `model` (from budget tier, honoring manifest overrides), `permission` (the per-role maps in
  `BASE_PERMISSIONS`, with `headless` scoping applied for the orchestrator). Native frontmatter
  also supports `variant`; unknown fields route into `options`.
- Body: the full role prompt (stack-filled). The 7 specialist prompts move verbatim; the
  orchestrator becomes a merged full prompt (see §5).
- Verified native fields: `name`, `model`, `variant`, `description`, `mode`, `hidden`, `color`,
  `steps`, `options`, `permission`, `disable`, `temperature`, `top_p`. There is **no
  `displayName`** in native opencode (that was omo-slim-specific); the internal name stays
  `orchestrator`, which routing depends on. Use `color` for TUI distinction.

`opencode.json`:

- `$schema`, top-level `model` (orchestrator model from budget), `permission:
  external_directory: deny`, and `default_agent: "orchestrator"` so the TUI boots into the
  orchestrator (verified config key).
- The `agent:` block is **removed** (roster lives in `.md` frontmatter). This also retires the
  old unscoped `bash: allow` / `edit: allow` finding — the file shrinks to the above.

### Dropped / pruned

- `.opencode/oh-my-opencode-slim.jsonc`
- `.opencode/oh-my-opencode-slim/` directory (incl. `orchestrator_append.md`)
- Re-scaffold over an old layout prunes these stale files (cleanly, without touching user files).

## 5. Orchestrator prompt (self-contained)

Merge `agents/orchestrator/append.template.md` plus a compact orchestration base into one full
prompt `agents/orchestrator/prompt.template.md`:

1. **Identity** — armada delivery lead for the project; coordination only, never writes code.
2. **Contract co-writing** — unchanged: blank phases/criteria → elicit one question at a time,
   draft, iterate to consensus, explicit approval before building.
3. **Planning** — build the dependency graph from REQUIREMENTS phases.
4. **Delegation** — route to the 7 specialists via native `task` subagents (background when
   available, inline fallback).
5. **Gating** — evidence at every gate (passing tests / screenshots); nothing ships on a word.
6. **Defect ledger + adversary triage** — unchanged rules (only qa closes; REJECTED with reason;
   no PENDING at final phase).
7. **Cost discipline + output contract** — unchanged (terse, path:line refs).

The 7 specialist prompts keep their current content; only their container changes (file + name).

## 6. Parallel dispatch

- Orchestrator prompt instructs native background `task` dispatch for parallel phases, enabled
  via `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true`.
- Fall back to **inline** subagent dispatch when background is unavailable (headless / one-shot
  `opencode run`) — same behavior as today's `--headless` mode.
- README documents the env var as recommended, not required.

## 7. Same-path hardening (audit findings in these code paths)

- Path traversal via `requirementsFile` → `resolve` + assert result stays under target dir.
- Empty `model: ""` → reject / coerce to budget default at parse.
- Duplicate role names in `team[]` → reject at parse.
- YAML/JSONC injection → agents no longer in JSON/YAML (mostly moot); `armada.yaml` scalars
  (`name`, `requirementsFile`) get proper YAML quoting.
- `main()` returns an exit-code int; I/O errors wrapped (no raw stack traces unless `DEBUG=1`).
- Symlink target dir → warn / reject on scaffold.
- Honoring manifest model overrides + `fallback` + `variant` in `buildTeam` (currently
  recomputed from budget).

## 8. doctor / uninstall / /armada

- **`armada doctor`**: drop omo-slim `plugin[]` check. Check opencode installed/version,
  providers/models reachable, background env var (warn if unset).
- **`armada uninstall`**: remove armada-written `.opencode/agent/` role files (8 by name) +
  stale omo-slim artifacts if present; preserve user agent files. Fix custom-contract removal
  and no-manifest cleanup.
- **`/armada` command**: read roster from `.opencode/agent/` instead of the jsonc.

## 9. Tests

- Generator: `.opencode/agent/*.md` emitted with correct frontmatter; no slim jsonc; no
  `orchestrator_append.md`; `opencode.json` minimal (no `agent:` block, has `default_agent`).
- Scaffold: no-clobber preserved (opencode.json / AGENTS.md / REQUIREMENTS); stale omo artifacts
  pruned on re-scaffold; uninstall removes role files but keeps user agents.
- Round-trip: init → parse → init identical output preserved.
- Doctor: new checks.
- Hardening: path traversal, empty model, duplicate roles, YAML quoting.
- `node --test 'tests/*.test.js'` stays the gate; suite stays fast/deterministic (no network).

## 10. Docs

- README: prerequisites drop the omo-slim install step; add the background env var note.
- SPEC.md: §1/§3/§7 artifact tables rewritten (native layout, no plugin); dependencies table.
- ARCHITECTURE.md: module map + data flow updated (generator emits `.md` files).
- AGENTS.md (project rules): drop omo-slim conventions + patched-plugin notes.

## 11. Risks / open questions

- **Background reconciliation** still needs a live TUI (per TODO): one-shot runs use inline
  dispatch. Acceptable — same as today.
- **`name` vs `displayName`**: orchestrator keeps internal name `orchestrator`; TUI shows
  `orchestrator` (color-coded) rather than `armada-orchestrator`. Cosmetic.
- **Frontmatter YAML serializer**: the existing `yaml` dependency (manifest parsing) is reused to
  emit frontmatter safely.
