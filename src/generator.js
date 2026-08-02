// Generator: renders the per-repo config files from the manifest, catalog,
// detected stack, and the agent/prompt templates. Pure functions — no I/O.

import { ROLES, CATALOG, modelFor, fallbackFor } from "./model-catalog.js"
import { DEFAULT_PLAYBOOK } from "./manifest.js"

// Permission model shared by every role. Mirrors the personal-space pattern:
// strict file ownership enforced at SDK level (not just prompt). Keys are
// opencode permission globs.
const BASE_PERMISSIONS = {
  orchestrator: {
    edit: {
      "*": "deny",
      "*.md": "allow",
      "REQUIREMENTS.md": "deny",
      "AGENTS.md": "deny",
      ".opencode/*": "deny",
      "armada/*": "deny",
      "DEFECTS.md": "allow",
      "ADVERSARIAL_REVIEW.md": "allow",
    },
    bash: { "*": "ask", "git status*": "allow", "git diff*": "allow", "git log*": "allow" },
  },
  "backend-dev": {
    edit: {
      "DEFECTS.md": "deny",
      "ADVERSARIAL_REVIEW.md": "deny",
      "REQUIREMENTS.md": "deny",
      "AGENTS.md": "deny",
      ".opencode/*": "deny",
      "armada/*": "deny",
      "e2e/*": "deny",
    },
  },
  "frontend-dev": {
    edit: {
      "DEFECTS.md": "deny",
      "ADVERSARIAL_REVIEW.md": "deny",
      "REQUIREMENTS.md": "deny",
      "AGENTS.md": "deny",
      ".opencode/*": "deny",
      "armada/*": "deny",
      "e2e/*": "deny",
    },
  },
  qa: {
    edit: {
      "*": "deny",
      "e2e/*": "allow",
      "DEFECTS.md": "allow",
      "ADVERSARIAL_REVIEW.md": "deny",
      "screenshots/*": "allow",
    },
    bash: { "*": "ask", "git status*": "allow", "git diff*": "allow", "git log*": "allow" },
  },
  adversary: {
    edit: {
      "*": "deny",
      "ADVERSARIAL_REVIEW.md": "allow",
      "screenshots/*": "allow",
    },
  },
  security: {
    edit: { "*": "deny" },
    webfetch: "allow",
  },
  docs: {
    edit: { "*": "allow", ".opencode/*": "deny", "e2e/*": "deny" },
    bash: "deny",
  },
  architect: {
    edit: { "*": "deny" },
  },
}

// orchestratorPrompt: injected into the OMO-slim session orchestrator to teach it
// when to delegate to each armada role. Kept terse (caveman-style) to reduce token burn.
const ROUTING = {
  orchestrator: "",
  "backend-dev":
    "@backend-dev\n- Role: server, API, storage, seed data, backend unit tests.\n- **Delegate when:** backend/API/storage work, backend unit tests, backend defects.\n- **Don't delegate when:** UI, e2e, docs, design decisions.",
  "frontend-dev":
    "@frontend-dev\n- Role: UI/UX implementation, visual polish, frontend unit tests.\n- **Delegate when:** UI/features/components, frontend tests, visual defects.\n- **Don't delegate when:** server/API/storage, e2e suite, docs.",
  qa:
    "@qa\n- Role: e2e tests, screenshots, DEFECTS.md owner, retesting.\n- **Delegate when:** verify a feature, write/run e2e, close defects, capture screenshots.\n- **Don't delegate when:** implementing or fixing product code (read-only on product).",
  adversary:
    "@adversary\n- Role: hostile user simulation, break running app, ADVERSARIAL_REVIEW.md.\n- **Delegate when:** phase gate passes, pre-release, features just landed.\n- **Don't delegate when:** implementation is mid-flight.",
  security:
    "@security\n- Role: vulnerability audit, auth/authz, data exposure, dependency risk.\n- **Delegate when:** auth/security-sensitive code, before release, dependency review.\n- **Don't delegate when:** pure feature implementation.",
  docs:
    "@docs\n- Role: README, API docs, changelog, maintainable docs.\n- **Delegate when:** docs drift, new API surface, release notes.\n- **Don't delegate when:** product code changes.",
  architect:
    "@architect\n- Role: architecture, refactor risk, cross-cutting design, review.\n- **Delegate when:** architecture decisions, risky refactors, pre/post big changes.\n- **Don't delegate when:** bounded single-file edits.",
}

export function buildTeam(manifest) {
  const { budget, browserTesting } = manifest.project ?? {}
  const headless = manifest.project?.headless ?? false
  return ROLES.map((role) => {
    const enabled = manifest.team.some((t) => t.role === role && t.enabled !== false)
    const permissions = structuredClone(BASE_PERMISSIONS[role] || {})
    if (headless && role === "orchestrator") {
      // Non-interactive runs (opencode run / CI) auto-reject `ask` permissions,
      // which stalls the orchestrator's git-status/diff/log + inspection calls.
      // Headless mode allows orchestrator bash so it can plan, delegate and
      // reconcile without a human approving every command.
      permissions.bash = { "*": "allow" }
    }
    return {
      role,
      model: modelFor(role, budget),
      fallback: fallbackFor(role),
      variant: CATALOG[role].variant || null,
      permissions,
      orchestratorPrompt: ROUTING[role],
      browser: browserTesting && ["qa", "adversary", "frontend-dev"].includes(role),
      enabled,
    }
  })
}

// Build the `.opencode/oh-my-opencode-slim.jsonc` content.
export function renderSlimJsonc(manifest, team) {
  const agents = {}
  for (const a of team) {
    if (!a.enabled) continue
    const entry = {
      model: a.model,
      ...(a.variant ? { variant: a.variant } : {}),
      ...(a.orchestratorPrompt ? { orchestratorPrompt: a.orchestratorPrompt } : {}),
      ...(Object.keys(a.permissions).length
        ? { permission: a.permissions }
        : {}),
    }
    // A compact, stack-aware system prompt override lives in the prompt dir;
    // keep the config lean. The orchestrator reads the append file.
    // The orchestrator is the omo-slim primary; armada surfaces it in the TUI
    // as "armada-orchestrator" without breaking the primary slot + background
    // job board, which both require the internal name to stay "orchestrator".
    if (a.role === "orchestrator") entry.displayName = "armada-orchestrator"
    agents[a.role] = entry
  }

  return `{
  // Generated by opencode-armada. Edit freely; regenerate with:
  //   armada init --from-armada armada/armada.yaml
  "$schema": "https://unpkg.com/oh-my-opencode-slim@latest/oh-my-opencode-slim.schema.json",
  "preset": "${manifest.project.budget}",
  "disabled_agents": [],
  "presets": {
    "${manifest.project.budget}": ${JSON.stringify(agents, null, 2)}
  },
  "backgroundJobs": {
    "continueOnIdle": false
  }
}
`
}

// Build the per-repo `opencode.json` (project-level overrides). Merges over the
// global config; only sets what armada manages. plugin[] is NOT touched here —
// omo-slim is installed globally.
export function renderOpenCodeJson(manifest) {
  const model = manifest.team.find((t) => t.role === "orchestrator")?.model
  return {
    $schema: "https://opencode.ai/config.json",
    ...(model ? { model } : {}),
    permission: {
      edit: "allow",
      bash: "allow",
      webfetch: "allow",
      websearch: "allow",
      skill: "allow",
      task: "allow",
      external_directory: "deny",
    },
  }
}

// Build `AGENTS.md` playbook content from the manifest + team.
export function renderAgentsMd(manifest, team) {
  const pb = { ...DEFAULT_PLAYBOOK, ...(manifest.playbook || {}) }
  const enabled = team.filter((a) => a.enabled)
  const roles = enabled
    .map(
      (a) =>
        `- **${a.role}** — ${CATALOG[a.role].label}. Model \`${a.model}\`.`
    )
    .join("\n")

  const requirementsFile = manifest.project.requirementsFile ?? "armada/REQUIREMENTS.md"
  const body = `# ${manifest.project.name} — Build Rules

These rules apply to every agent working on this project. Generated by opencode-armada.

## The job

Build exactly as specified in [${requirementsFile}](./${requirementsFile}). That document is the
contract: its phases, success criteria and final criteria decide when work is done. When in
doubt, ${requirementsFile} wins.

## The team

${roles}

Role boundaries are enforced by permissions and are absolute. Do not work around them with
shell commands: if the edit tool would deny a file, do not modify that file any other way.

## Repository conventions

- End-to-end tests and their configuration live under \`e2e/\`. Only qa writes there.
- Screenshots live under \`screenshots/\`.
- ${pb.conventions.noEmojisInCode ? "No emojis in code, comments, print statements or logging." : ""}
- ${pb.conventions.keepItSimple ? "Keep it simple: small modules, clear names, no defensive programming, no overengineering." : ""}
- ${pb.conventions.preferPopularLibraries ? "Prefer popular, well-supported libraries over custom code." : ""}

## ${pb.defectLedger.file} — the defect ledger

All defects live in \`${pb.defectLedger.file}\` at the repo root, one entry per defect, newest
first. Writers: **qa** (create, close, reopen) and **orchestrator** (record developer
responses, reject). Nobody else edits it, ever.

Format, exactly:

    ## DEF-001: Short title

    - Status: OPEN
    - Severity: HIGH | MEDIUM | LOW
    - Found by: qa | adversary (ADV-003)
    - Phase: 3

    Steps to reproduce:
    1. Numbered, specific, starting from app launch.

    Expected: What should happen.
    Actual: What happens instead.
    Screenshot: screenshots/def-001.png (optional)

    History:
    - qa: opened

Statuses and who may set them:

| Status | Meaning | Set by |
|--------|---------|--------|
| OPEN | Filed, or reopened after a failed retest or a bounced dispute | qa |
| FIX-READY | A developer reports a fix is in | orchestrator, relaying the developer |
| DISPUTED | A developer reports CANNOT REPRODUCE or WORKING AS INTENDED | orchestrator, relaying verbatim |
| CLOSED | qa retested and confirmed the fix, or accepted the dispute | qa only |
| REJECTED | Will not fix, with a written reason | orchestrator only |

Every status change appends a History line. A defect is never done because a developer says
so — it is done when qa closes it.

## ${pb.adversarialLedger.file} — the adversary's findings

All adversary findings live in \`${pb.adversarialLedger.file}\`. Writers: **adversary** (create
entries) and **orchestrator** (fill Disposition). Nobody else.

Format, exactly:

    ## ADV-001: Short title

    - Session: phase-3 gate | final
    - Suggested severity: HIGH | MEDIUM | LOW

    What I did: ...
    Expected: ...
    Actual: ...
    Screenshot: screenshots/adv-001.png (optional)

    Disposition: PENDING

The orchestrator replaces PENDING with either \`ACCEPTED -> DEF-NNN\` or \`REJECTED - reason\`.
Accepted findings are reproduced and filed in DEFECTS.md by qa. No entry may remain PENDING
when the final phase completes.

## Phase gates

A phase in ${manifest.project.requirementsFile ?? "armada/REQUIREMENTS.md"} passes only when its
success criteria are demonstrated by evidence — a passing test run, a screenshot, or both. A
phase starts as soon as the phases it depends on have passed; independent phases run in
parallel as background subagents.
`

  return `<!-- armada:start -->
<!-- Generated by opencode-armada. Do not edit this section manually. -->

${body}
<!-- armada:end -->
`
}

// Build the requirements file (default REQUIREMENTS.md) — the contract scaffold.
// Only written when absent. Co-write it with the orchestrator (the session
// driver): it is the armada delivery lead, you approve.
export function renderRequirementsMd(manifest) {
  return `# ${manifest.project.name} — Requirements

> The contract. Generated by opencode-armada.
>
> **Co-write this with the orchestrator.** Tell it what you want to build; it will ask
> clarifying questions (one at a time), draft the phases + success criteria, and iterate with
> you until you approve. No implementation starts against an unapproved contract. If you later
> want a different feature, use a separate contract file (e.g. REQUIREMENTS-<feature>.md) and
> re-scaffold with \`armada init --requirements <file>\`.
>
> Phases declare what they depend on. A phase starts as soon as its dependencies pass —
> independent phases run in parallel as background subagents. Nothing blocks a phase except an
> unmet dependency or a failed success criterion.

## Success criteria

- [ ] Define measurable success criteria per phase.

## Phases

### Phase 1 — Foundation

- **Depends on:** none
- **Goal:** ...
- **Success criteria:**
  - [ ] ...
  - [ ] ...

### Phase 2 — ...

- **Depends on:** Phase 1
- **Goal:** ...
- **Success criteria:**
  - [ ] ...


## Final criteria

- [ ] Every phase success criterion is demonstrably true (test run and/or screenshot).
`
}

// Build `armada.yaml` manifest content (serialized).
export function renderManifestYaml(manifest, team) {
  const teamLines = team
    .map(
      (a) =>
        `  - role: ${a.role}\n    model: ${a.model}\n    fallback: ${a.fallback}\n    enabled: ${a.enabled}`
    )
    .join("\n")
  const s = manifest.project.stack || {}
  return `# armada.yaml — opencode-armada manifest (source of truth)
# Regenerate identical config with: armada init --from-armada armada/armada.yaml

project:
  name: ${manifest.project.name}
  budget: ${manifest.project.budget}
  browserTesting: ${manifest.project.browserTesting ?? false}
  devcontainer: ${manifest.project.devcontainer ?? false}
  useAgentBrowser: ${manifest.project.useAgentBrowser ?? false}
  headless: ${manifest.project.headless ?? false}
  requirementsFile: ${manifest.project.requirementsFile ?? "armada/REQUIREMENTS.md"}
  stack:
    frontend: ${s.frontend || "null"}
    backend: ${s.backend || "null"}
    database: ${s.database || "null"}
    testing: ${s.testing || "null"}
    srcDirs: [${(s.srcDirs || []).map((d) => `"${d}"`).join(", ")}]
    languages: [${(s.languages || []).map((l) => `"${l}"`).join(", ")}]

team:
${teamLines}
`
}
