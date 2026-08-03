// Generator: renders the per-repo config files from the manifest, catalog,
// detected stack, and the agent/prompt templates. Pure functions — no I/O.

import { ROLES, CATALOG, modelFor, fallbackFor } from "./model-catalog.js"
import { DEFAULT_PLAYBOOK } from "./manifest.js"
import YAML from "yaml"

// Deep-merge override into base. Base keys not overridden survive; user leaf
// values replace base values. Merge order is stable: base keys first, then
// override-only keys. Both arguments must be plain objects (null-safe).
export function deepMerge(base, override) {
  if (override === null || override === undefined) return base
  if (typeof override !== "object" || Array.isArray(override)) return override
  if (base === null || base === undefined || typeof base !== "object" || Array.isArray(base)) return override
  const result = {}
  for (const key of Object.keys(base)) {
    result[key] = key in override ? deepMerge(base[key], override[key]) : base[key]
  }
  for (const key of Object.keys(override)) {
    if (!(key in base)) result[key] = override[key]
  }
  return result
}

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

// routingPrompt: delegation hints embedded in each specialist's prompt so the orchestrator knows when to route to them.
function routingPrompt(role) {
  if (role === "orchestrator") return ""
  const reasoning = CATALOG[role]?.reasoning
  if (!reasoning) return ""
  return `@${role}\n- Role: ${reasoning}.\n- **Delegate when:** ${reasoning} work, related tasks, and defects.\n- **Don't delegate when:** work outside this scope.`
}

export function buildTeam(manifest) {
  const { budget, browserTesting } = manifest.project ?? {}
  const headless = manifest.project?.headless ?? false
  const yolo = manifest.project?.yolo ?? false
  const teamByRole = Object.fromEntries((manifest.team || []).map((t) => [t.role, t]))
  return ROLES.map((role) => {
    const override = teamByRole[role]
    const enabled = override ? override.enabled !== false : false
    const permissions = deepMerge(structuredClone(BASE_PERMISSIONS[role] || {}), override?.permissions)
    if (headless && role === "orchestrator") {
      // Non-interactive runs (opencode run / CI) auto-reject `ask` permissions,
      // which stalls the orchestrator's git-status/diff/log + inspection calls.
      // Headless mode scopes orchestrator bash to git and read-only commands
      // so it can plan, delegate and reconcile without a human approving.
      permissions.bash = {
        "*": "deny",
        "git status*": "allow",
        "git diff*": "allow",
        "git log*": "allow",
        "git branch*": "allow",
        "git rev-parse*": "allow",
        "cat*": "allow",
        "ls*": "allow",
        "read*": "allow",
        "find*": "allow",
        "pwd": "allow",
        "echo*": "allow",
      }
    }
    if (yolo && ["orchestrator", "qa"].includes(role)) {
      // Autonomous mode: the orchestrator approves its own inspection commands and
      // qa approves its test/screenshot commands, so the fleet never stalls on a
      // permission prompt. Edit boundaries stay (both still delegate/own their
      // slices); only bash becomes allow.
      permissions.bash = { "*": "allow" }
    }
    return {
      role,
      model: override?.model ?? modelFor(role, budget),
      fallback: override?.fallback ?? fallbackFor(role),
      variant: override?.variant ?? CATALOG[role].variant ?? null,
      permissions,
      instructions: override?.instructions ?? null,
      prompt: override?.prompt ?? null,
      orchestratorPrompt: routingPrompt(role),
      browser: browserTesting && ["qa", "adversary", "frontend-dev"].includes(role),
      enabled,
    }
  })
}

// Render one native opencode agent file: YAML frontmatter + prompt body.
// Native opencode has no `displayName`; the orchestrator keeps its internal
// name and a color for TUI distinction. Mode/model/permission live in the
// frontmatter so the roster works without any plugin.
export function renderAgentFile(agent, promptText) {
  const frontmatter = {
    description: CATALOG[agent.role].label,
    mode: agent.role === "orchestrator" ? "primary" : "subagent",
    ...(agent.model ? { model: agent.model } : {}),
    ...(agent.variant ? { variant: agent.variant } : {}),
    ...(agent.role === "orchestrator" ? { color: "#00bcd4" } : {}),
    ...(Object.keys(agent.permissions || {}).length ? { permission: agent.permissions } : {}),
  }
  const yaml = YAML.stringify(frontmatter).trim()
  return `---\n${yaml}\n---\n\n${promptText}`
}

// Build the per-repo `opencode.json` (project-level overrides). Merges over the
// global config; only sets what armada manages. plugin[] is NOT touched here.
// Agents now ship as native `.opencode/agent/<role>.md` files (renderAgentFile);
// no `agent` block is needed in opencode.json. `default_agent` boots the TUI
// straight into the orchestrator.
export function renderOpenCodeJson(manifest, team) {
  const openrouterModels = {}
  for (const a of team) {
    for (const id of [a.model, a.fallback, CATALOG[a.role]?.free, CATALOG[a.role]?.power]) {
      if (typeof id !== "string") continue
      if (!id.startsWith("openrouter/")) continue
      const slug = id.slice("openrouter/".length)
      if (!slug) continue
      openrouterModels[slug] = {
        options: { provider: { allow_fallbacks: true } },
      }
    }
  }
  const yolo = manifest.project?.yolo ?? false
  const permission = { external_directory: "deny" }
  if (yolo) {
    // Autonomous mode: auto-approve everything not explicitly denied. Agent-level
    // edit boundaries (orchestrator denies code writes, security/architect are
    // read-only) still hold — the SDK checks the most specific rule first.
    permission["*"] = "allow"
  }
  return {
    $schema: "https://opencode.ai/config.json",
    model: modelFor("orchestrator", manifest.project?.budget ?? "balanced"),
    permission,
    default_agent: "orchestrator",
    ...(Object.keys(openrouterModels).length
      ? { provider: { openrouter: { models: openrouterModels } } }
      : {}),
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

// Build the `.opencode/commands/armada.md` command descriptor.
export function renderArmadaCommand() {
  return `---
description: opencode-armada — team status, roles, regenerate
---
You are the armada helper. Report: the configured team (from .opencode/agent/),
the active preset, and how to regenerate (armada init --from-armada armada/armada.yaml). Keep it terse.
`
}

// Build the `.opencode/commands/armada-status.md` command descriptor.
export function renderArmadaStatusCommand() {
  return `---
description: opencode-armada — fleet status, active feature, next action
agent: orchestrator
---
Read armada/state/active.json + armada/state/features/index.json if they exist. Report the
active feature, pending phases (status != "passed"), and the next action. If no state exists,
say "no active fleet". Keep it terse.
`
}

// Build the `.opencode/commands/armada-scout.md` command descriptor.
export function renderArmadaScoutCommand() {
  return `---
description: opencode-armada — read-only investigation dispatch
agent: orchestrator
---
Dispatch a read-only investigation of the requested area. Route to the adversary
(hostile review) or architect (architecture risk) as appropriate. Never write files,
never change code, never open a PR. Deliver a findings report in chat.
`
}

// Build the `.opencode/commands/armada-resume.md` command descriptor.
export function renderArmadaResumeCommand() {
  return `---
description: opencode-armada — resume after an interrupted session
agent: orchestrator
---
Run \`armada reconcile\` and print the resume line plus any drift list. If the global \`armada\` binary is not on PATH AND \`src/cli.js\` exists in the cwd (i.e. you are in the armada source checkout), fall back to \`node src/cli.js reconcile\`. Otherwise report the missing binary. Keep it terse.
`
}

// Deny globs the supervision plugin guards against shell-redirect writes. The
// orchestrator's permission.edit deny set is the source of truth; this mirrors it
// so `bash: echo x > REQUIREMENTS.md` cannot bypass the SDK-level edit deny.
function supervisionDenyTargets(team) {
  const orch = team.find((a) => a.role === "orchestrator")
  const edit = orch?.permissions?.edit
  if (!edit) return []
  return Object.entries(edit)
    .filter(([, v]) => v === "deny")
    .map(([g]) => g)
    .filter((g) => g !== "*")
}

// Build the opt-in `.opencode/plugins/armada-supervision.js` supervision plugin.
// Single file, auto-loaded by opencode from the project plugin directory (no
// install). Handlers:
//   - session.created   -> if .opencode/fleet-status.md exists, inject its contents
//                          so a fresh session resumes mid-fleet (firstmate nudge pattern)
//   - session.idle      -> if a fleet status is present but no background work is
//                          outstanding and no nudge has been emitted this session,
//                          inject a "no blind stop" reminder (skipNextIdle guards recursion)
//   - tool.execute.before -> deny bash redirects (>, >>, tee, sed -i) that target a file
//                          in the orchestrator's permission.edit deny set
export function renderArmadaSupervisionPlugin(team) {
  const deny = supervisionDenyTargets(team)
  const denyList = deny.map((g) => JSON.stringify(g)).join(", ")
  return `// opencode-armada supervision plugin (opt-in). Generated by armada init
// --supervision-plugin (or armada.yaml project.supervision.plugin: true).
// Auto-loaded by opencode from .opencode/plugins/ — no install required.

import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const FLEET_STATUS = join(process.cwd(), ".opencode", "fleet-status.md")
const DENY = [${denyList}]

function matchesAny(target) {
  return DENY.some((g) => {
    if (g.endsWith("/*")) return target.startsWith(g.slice(0, -1))
    return target === g
  })
}

// Extract a redirect target from a bash command: "> FILE", ">> FILE", "tee FILE",
// "sed -i SCRIPT FILE". Returns the first match or null.
function redirectTarget(cmd) {
  if (/^\\s*sed\\s+-i\\b/.test(cmd)) {
    const tokens = cmd.trim().split(/\\s+/)
    const last = tokens[tokens.length - 1]
    return last || null
  }
  const m = /(?:>>|>|tee)\\s+["']?([^\\s"'|&;]+)["']?/.exec(cmd)
  return m ? m[1] : null
}

let skipNextIdle = false
const nudgedSessions = new Set()

export const ArmadaSupervision = async ({ client }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.created") {
        if (existsSync(FLEET_STATUS)) {
          try {
            const text = readFileSync(FLEET_STATUS, "utf8")
            await client.session.promptAsync({
              path: { id: event.properties?.sessionID ?? event.properties?.info?.id },
              body: { parts: [{ type: "text", text: "Fleet status (resuming):\\n" + text }] },
            })
          } catch (err) {
            await client.app.log({ body: { service: "armada-supervision", level: "error", message: String(err?.message ?? err) } })
          }
        }
      }
      if (event.type === "session.idle") {
        if (skipNextIdle) { skipNextIdle = false; return }
        const sessionID = event.properties?.sessionID
        if (!sessionID) return
        if (nudgedSessions.has(sessionID) || !existsSync(FLEET_STATUS)) return
        // Fleet status exists -> work may be mid-flight. Remind once per session,
        // then never again for that session (avoids a nag loop).
        nudgedSessions.add(sessionID)
        try {
          await client.session.promptAsync({
            path: { id: sessionID },
            body: { parts: [{ type: "text", text: "Reminder: do not end the turn while background work is outstanding. Confirm every dispatched subagent has returned before finishing." }] },
          })
          skipNextIdle = true
        } catch (err) {
          await client.app.log({ body: { service: "armada-supervision", level: "error", message: String(err?.message ?? err) } })
        }
      }
    },
    "tool.execute.before": async (hookArgs) => {
      const { input, output } = hookArgs ?? {}
      if (input?.tool !== "bash") return
      const command = output?.args?.command
      if (typeof command !== "string") return
      const target = redirectTarget(command)
      if (target && matchesAny(target)) {
        throw new Error("denied by armada-supervision: redirecting to " + target + " (in orchestrator permission deny set). Dispatch a subagent instead.")
      }
    },
  }
}
`
}

// Build `armada.yaml` manifest content (serialized).
export function renderManifestYaml(manifest, team) {
  const q = (v) => JSON.stringify(v)
  const teamByRole = Object.fromEntries((manifest.team || []).map((t) => [t.role, t]))
  const teamLines = team
    .map(
      (a) => {
        const mt = teamByRole[a.role]
        let lines = `  - role: ${q(a.role)}\n    model: ${q(a.model)}\n    fallback: ${a.fallback === null ? "null" : q(a.fallback)}\n`
        if (a.variant !== null && a.variant !== undefined) lines += `    variant: ${q(a.variant)}\n`
        if (mt?.permissions !== null && mt?.permissions !== undefined) {
          const permYaml = YAML.stringify(mt.permissions).trim()
          lines += `    permissions:\n${permYaml.split("\n").map((l) => "      " + l).join("\n")}\n`
        }
        if (mt?.instructions !== null && mt?.instructions !== undefined) {
          lines += `    instructions: ${q(mt.instructions)}\n`
        }
        if (mt?.prompt !== null && mt?.prompt !== undefined) {
          lines += `    prompt: ${q(mt.prompt)}\n`
        }
        lines += `    enabled: ${a.enabled}`
        return lines
      }
    )
    .join("\n")
  const s = manifest.project.stack || {}
  const str = (v) => v === null || v === undefined ? "null" : q(v)
  return `# armada.yaml — opencode-armada manifest (source of truth)
# Regenerate identical config with: armada init --from-armada armada/armada.yaml

project:
  name: ${q(manifest.project.name)}
  budget: ${q(manifest.project.budget)}
  browserTesting: ${manifest.project.browserTesting ?? false}
  devcontainer: ${manifest.project.devcontainer ?? false}
  useAgentBrowser: ${manifest.project.useAgentBrowser ?? false}
  headless: ${manifest.project.headless ?? false}
  yolo: ${manifest.project.yolo ?? false}
  requirementsFile: ${q(manifest.project.requirementsFile ?? "armada/REQUIREMENTS.md")}
  supervision:
    plugin: ${manifest.project.supervision?.plugin ?? false}
  stack:
    frontend: ${str(s.frontend)}
    backend: ${str(s.backend)}
    database: ${str(s.database)}
    testing: ${str(s.testing)}
    srcDirs: [${(s.srcDirs || []).map((d) => q(d)).join(", ")}]
    languages: [${(s.languages || []).map((l) => q(l)).join(", ")}]
    instructions: [${(s.instructions || []).map((i) => q(i)).join(", ")}]

team:
${teamLines}
`
}
