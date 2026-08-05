# armada — Specification

Transparent design spec. What this is, what it isn't, how it works, and the decisions behind
it. If you change behavior, update this file.

---

## 1. What it is

`armada` is a **configuration generator** for building reproducible AI-engineer
multi-agent teams in [opencode](https://opencode.ai). It generates per-project native opencode
agents, prompts, and playbooks that a human (or another agent) runs with opencode itself.

### 1.1 What it is NOT

- **Not a plugin.** It does not hook opencode events, register tools, or run at runtime. It
  writes files. See §3 for why.
- **Not an orchestration engine.** opencode is the runtime. armada emits the team.
- **Not a runtime dependency.** armada runs once at setup; the repo doesn't need it installed
  afterward.

### 1.2 Dependencies

| Dependency | Role | Required |
|---|---|---|
| opencode | host + runtime (agents, permissions, background subagents) | yes |
| OpenCode Go / Zen auth | free model provider | yes for free tier |
| OpenRouter auth | fallback / power model provider | optional |

---

## 2. Design goals

1. **Reproducible, on-demand, per project.** `armada.yaml` is the manifest; `armada init
   --from-armada armada.yaml` reproduces the identical team anywhere.
2. **Configurable via setup questionnaire, manifest, or repo learning.** The questionnaire
   asks; the manifest overrides; stack detection + existing instruction files (AGENTS.md,
   CLAUDE.md, DEVELOPER.md) provide defaults.
3. **Model choice per role with recommendations.** Primary = opencode/go-zen (free where
   available); fallback = equivalent OpenRouter model. Budget tiers free / balanced / power.
4. **Browser/e2e ready when needed.** Optional devcontainer + agent-browser wiring for qa and
   adversary.
5. **Token-lean.** Terse (caveman-style) output contracts in every agent prompt; orchestrator
   stays coordination-only.
6. **Enforced boundaries.** SDK-level file permissions per role; boundaries are absolute and
   not bypassable via shell.

---

## 3. Why it is not a plugin

**armada is a generator; opencode is the runtime. Armada emits native opencode agents and
commands; no plugin is required.** Two roles, cleanly split:

- **opencode is the runtime.** It hosts agents, enforces per-role permissions, and dispatches
  background subagents. Nothing to install beyond opencode itself.
- **armada is a generator.** Its entire job is writing native agent files and commands. It runs
  once at setup, before opencode launches; it never touches opencode's runtime.

If armada were a plugin, it would hook opencode's runtime to do work that is plain file-writing.
The scaffolder/runtime split (create-react-app vs Next.js) is the correct mental model.

**Consequence:** the generated `.opencode/agent/*.md` files and `.opencode/commands/*.md` are
native opencode input — loaded and enforced by opencode with no plugin.

---

## 4. Configuration precedence

OpenCode merges config sources (never replaces). Precedence (later wins):

```
remote (.well-known/opencode)
  → global (~/.config/opencode/opencode.json)
  → custom (OPENCODE_CONFIG)
  → project (opencode.json)
  → .opencode dirs (agents, commands, plugins)
  → inline (OPENCODE_CONFIG_CONTENT)
  → managed (admin, highest)
```

**What armada guarantees:**

- Project agents live in `.opencode/agent/`; no name collisions (unique role names).
- Project config overrides global **only on conflicting keys**.
- Each repo controls its team's behavior via its own agent files and playbook.
- `armada init` never writes `opencode.json` / `AGENTS.md` / `REQUIREMENTS.md` if they already
  exist (no clobber). It always (re)writes `armada.yaml` and the `.opencode/` artifacts it owns.

---

## 5. The team and boundaries

| Role | Permissions (edit) | Notes |
|---|---|---|
| orchestrator | `*` deny; `*.md` allow; REQUIREMENTS/AGENTS/.opencode/armada deny; ledgers allow | plan/delegate/review only |
| backend-dev | product code; deny armada/ledgers, armada/e2e, armada/screenshots, armada/state, REQUIREMENTS, AGENTS, .opencode, opencode.json, armada | server/API/storage |
| frontend-dev | product code; deny same set | UI/UX |
| qa | `*` deny; armada/e2e, armada/ledgers, armada/screenshots allow | owns defect lifecycle; read-only on product |
| adversary | `*` deny; armada/ledgers/*/ADVERSARIAL_REVIEW.md, armada/screenshots allow | hostile-user testing |
| security | `*` deny; webfetch allow | read-only audit |
| docs | `*` allow; deny .opencode, armada/ledgers, armada/e2e; bash deny | writer |
| architect | `*` deny | read-only review |

Permissions are enforced by the opencode SDK (same mechanism the personal-space repo uses).
The playbook in AGENTS.md reiterates: a developer's word never closes a defect — only qa does.

---

## 6. Model catalog

Curated static catalog in `src/model-catalog.js` — roles × provider (opencode/go-zen +
openrouter) × budget tier (free/balanced/power). `armada models --refresh` is a stub for
merging live provider availability (see TODO).

Budget semantics:

| Tier | Policy |
|---|---|
| free | opencode `*-free` models only |
| balanced (default) | free workers, paid/strong judges (orchestrator, adversary) |
| power | strongest models on every role (OpenRouter) |

See README §Model catalog for the current table.

---

## 7. Generated artifacts

| File | Owner | Written if... |
|---|---|---|
| `.opencode/agent/<role>.md` | armada | always (re-written) |
| `.opencode/commands/armada.md` | armada | always (re-written) |
| `armada.yaml` | armada | always (re-written) |
| `opencode.json` | armada | only if absent |
| `AGENTS.md` | armada | only if absent |
| `REQUIREMENTS.md` | armada | only if absent |
| `.devcontainer/*` | armada | only when browser testing enabled |

---

## 8. Directory layout

```
opencode-armada/
├── src/               CLI + library (model-catalog, stack-detect, questionnaire,
│                      generator, scaffold)
├── agents/            reusable agent library (prompt templates, one dir per role)
├── presets/           budget presets (free/balanced/power yaml)
├── template/          static template files (devcontainer)
├── commands/          in-session opencode command scaffold
├── tests/             node:test suites
└── docs               (this spec + architecture + todo)
```

---

## 9. Non-goals (v0)

- Runtime hooks / custom opencode tools (armada writes files; opencode owns the runtime).
- Auto-generating REQUIREMENTS.md content from a PRD (single scaffold only).
- Training or fine-tuning models.
- Multi-repo fleet management / scheduling beyond one repo at a time.
- Live model availability probing (stub only, see TODO).
