// Generator: renders the per-repo config files from the manifest, catalog,
// detected stack, and the agent/prompt templates. Pure functions — no I/O.

import { isDeepStrictEqual } from "node:util"
import { ROLES, CATALOG, modelFor, fallbackFor } from "./model-catalog.js"
import { displayFor, agentNameFor, DISPLAY } from "./role-display.js"
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
      "armada/REQUIREMENTS.md": "allow",
      "armada/state/active.json": "allow",
      "armada/state/features/*": "allow",
      "armada/state/contract-approval.json": "allow",
      "armada.yaml": "allow",
      "TODO.md": "allow",
      "armada/ledgers/*/DEFECTS.md": "allow",
      "armada/ledgers/*/ADVERSARIAL_REVIEW.md": "allow",
    },
    bash: {
      "*": "ask",
      "git status*": "allow",
      "git diff*": "allow",
      "git log*": "allow",
      "git branch*": "allow",
      "git rev-parse*": "allow",
      "ls*": "allow",
      "cat*": "allow",
      "find*": "allow",
      "pwd": "allow",
      "echo*": "allow",
      "read*": "allow",
      "armada feature new *": "allow",
      "armada init *": "allow",
      "armada voyage *": "allow",
      "armada voyage-handoff *": "allow",
    },
    skill: "allow",
  },
  "backend-dev": {
    edit: {
      "armada/ledgers/*/DEFECTS.md": "deny",
      "armada/ledgers/*/ADVERSARIAL_REVIEW.md": "deny",
      "armada/ledgers/*": "deny",
      "armada/e2e/*": "deny",
      "armada/screenshots/*": "deny",
      "armada/state/*": "deny",
      "REQUIREMENTS.md": "deny",
      "AGENTS.md": "deny",
      ".opencode/*": "deny",
      "opencode.json": "deny",
      "DEFECTS.md": "deny",
      "ADVERSARIAL_REVIEW.md": "deny",
      "armada/*": "deny",
    },
    skill: "allow",
  },
  "frontend-dev": {
    edit: {
      "armada/ledgers/*/DEFECTS.md": "deny",
      "armada/ledgers/*/ADVERSARIAL_REVIEW.md": "deny",
      "armada/ledgers/*": "deny",
      "armada/e2e/*": "deny",
      "armada/screenshots/*": "deny",
      "armada/state/*": "deny",
      "REQUIREMENTS.md": "deny",
      "AGENTS.md": "deny",
      ".opencode/*": "deny",
      "opencode.json": "deny",
      "DEFECTS.md": "deny",
      "ADVERSARIAL_REVIEW.md": "deny",
      "armada/*": "deny",
    },
    skill: "allow",
  },
  qa: {
    edit: {
      "*": "deny",
      "armada/e2e/*": "allow",
      "armada/ledgers/*": "allow",
      "armada/screenshots/*": "allow",
    },
    bash: { "*": "ask", "git status*": "allow", "git diff*": "allow", "git log*": "allow" },
    skill: "allow",
  },
  adversary: {
    edit: {
      "*": "deny",
      "armada/ledgers/*/ADVERSARIAL_REVIEW.md": "allow",
      "armada/screenshots/*": "allow",
    },
  },
  security: {
    edit: {
      "*": "deny",
      "armada/ledgers/*/SECURITY_FINDINGS.md": "allow",
      "armada/screenshots/*": "allow",
    },
    webfetch: "allow",
  },
  docs: {
    edit: { "*": "allow", ".opencode/*": "deny", "armada/ledgers/*": "deny", "armada/e2e/*": "deny" },
    bash: "deny",
  },
  architect: {
    edit: { "*": "deny" },
  },
}

// Top-level keys armada owns in opencode.json. mergeOpenCodeJson overwrites only
// these keys; all other user keys survive verbatim. renderOpenCodeJson emits only
// these top-level keys. The Set iteration order (model, default_agent, permission,
// provider) is the canonical merge order — owned keys appended last.
export const ARMADA_OWNED_KEYS = Object.freeze(new Set([
  "model",
  "default_agent",
  "permission",
  "provider",
]))

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
    description: `${displayFor(agent.role)} \u2014 ${CATALOG[agent.role].label}`,
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
// Outputs only top-level keys in ARMADA_OWNED_KEYS.
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
    model: modelFor("orchestrator", manifest.project?.budget ?? "balanced"),
    permission,
    default_agent: agentNameFor("orchestrator"),
    ...(Object.keys(openrouterModels).length
      ? { provider: { openrouter: { models: openrouterModels } } }
      : {}),
  }
}

/**
 * Merge an existing user opencode.json with armada's owned-key defaults.
 *
 * @param {object} existing - parsed user opencode.json or {} if absent
 * @param {object} manifest - parsed armada manifest (yolo + budget)
 * @param {Array}  team     - built team array (openrouter model map)
 * @returns {object} a new object preserving all non-owned user keys verbatim,
 *                   with ARMADA_OWNED_KEYS overwritten from renderOpenCodeJson.
 *
 * Rules:
 * - Non-owned keys (e.g. $schema, theme, mcp, agent, share, keybinds,
 *   plugin) survive byte-for-byte.
 * - permission: always sets external_directory: "deny". When yolo,
 *   sets ["*"]: "allow". When yolo is off, a pre-existing user ["*"] is
 *   left alone — armada never removes user permission entries.
 * - provider: armada owns only openrouter.models. Other provider entries
 *   (anthropic, groq, etc.) survive untouched.
 * - Byte-stable: if existing already equals the merged result, returns
 *   existing as-is (same reference, no reordering, no new keys).
 * - Idempotent: merge(merge(existing, m, t), m, t) === merge(existing, m, t).
 */
export function mergeOpenCodeJson(existing, manifest, team) {
  const defaults = renderOpenCodeJson(manifest, team)
  const result = {}

  // Pass 1: preserve all non-owned keys in their original iteration order,
  // skipping prototype-polluting keys (defense in depth).
  const SKIP_KEYS = new Set(["__proto__", "constructor", "prototype"])
  for (const key of Object.keys(existing)) {
    if (!ARMADA_OWNED_KEYS.has(key) && !SKIP_KEYS.has(key)) {
      result[key] = existing[key]
    }
  }

  // Pass 2: owned keys in canonical order (Set iteration order)
  // model — direct overwrite
  result.model = defaults.model

  // default_agent — direct overwrite
  result.default_agent = defaults.default_agent

  // permission — merge: start from user values, overlay armada entries
  const existingPerm =
    existing.permission && typeof existing.permission === "object" && !Array.isArray(existing.permission)
      ? { ...existing.permission }
      : {}
  existingPerm.external_directory = defaults.permission.external_directory
  if (defaults.permission["*"] !== undefined) {
    existingPerm["*"] = defaults.permission["*"]
  }
  result.permission = existingPerm

  // provider — merge: armada owns only openrouter.models
  if (defaults.provider !== undefined) {
    const existingProv =
      existing.provider && typeof existing.provider === "object" && !Array.isArray(existing.provider)
        ? { ...existing.provider }
        : {}
    existingProv.openrouter = {
      ...(existingProv.openrouter && typeof existingProv.openrouter === "object" && !Array.isArray(existingProv.openrouter)
        ? existingProv.openrouter
        : {}),
      models: defaults.provider.openrouter.models,
    }
    result.provider = existingProv
  } else if (existing.provider !== undefined) {
    // No armada openrouter models, keep user's provider as-is
    result.provider = existing.provider
  }

  // Byte-stable: return existing reference when nothing changed
  if (isDeepStrictEqual(existing, result)) {
    return existing
  }
  return result
}

// Build `AGENTS.md` playbook content from the manifest + team.
export function renderAgentsMd(manifest, team, featureName) {
  // Phase 2: when project.feature is set, substitute its value into paths.
  // When absent (lane scaffold case), keep the literal {feature} token.
  const hasExplicitFeature = manifest.project.feature && typeof manifest.project.feature === "string" && manifest.project.feature.trim()
  const pathToken = hasExplicitFeature ? manifest.project.feature.trim() : "{feature}"
  const ledgersDir = `armada/ledgers/${pathToken}/`
  const e2eDir = `armada/e2e/${pathToken}/`
  const screenshotsDir = `armada/screenshots/${pathToken}/`
  const pb = { ...DEFAULT_PLAYBOOK, ...(manifest.playbook || {}) }
  // Resolve {feature} token in playbook file paths — uses pathToken so lane case stays literal
  const defectFile = (pb.defectLedger.file || "armada/ledgers/{feature}/DEFECTS.md").replace(/\{feature\}/g, () => pathToken)
  const adversarialFile = (pb.adversarialLedger.file || "armada/ledgers/{feature}/ADVERSARIAL_REVIEW.md").replace(/\{feature\}/g, () => pathToken)
  const securityFile = (pb.securityLedger?.file || "armada/ledgers/{feature}/SECURITY_FINDINGS.md").replace(/\{feature\}/g, () => pathToken)
  const enabled = team.filter((a) => a.enabled)
  const roles = enabled
    .map(
      (a) =>
        `- **${a.role}** — ${CATALOG[a.role].label}. Model \`${a.model}\`.`
    )
    .join("\n")

  const requirementsFile = manifest.project.requirementsFile ?? "armada/REQUIREMENTS.md"
  const body = `# ${manifest.project.name} — Build Rules

These rules apply to every agent working on this project. Generated by armada.

## The job

Build exactly as specified in [${requirementsFile}](./${requirementsFile}). That document is the
contract: its phases, success criteria and final criteria decide when work is done. When in
doubt, ${requirementsFile} wins.

## The team

${roles}

Role boundaries are enforced by permissions and are absolute. Do not work around them with
shell commands: if the edit tool would deny a file, do not modify that file any other way.

## Repository conventions

- End-to-end tests live under \`${e2eDir}\`. Only qa writes there.
- Screenshots live under \`${screenshotsDir}\`.
- ${pb.conventions.noEmojisInCode ? "No emojis in code, comments, print statements or logging." : ""}
- ${pb.conventions.keepItSimple ? "Keep it simple: small modules, clear names, no defensive programming, no overengineering." : ""}
- ${pb.conventions.preferPopularLibraries ? "Prefer popular, well-supported libraries over custom code." : ""}
- **Shipnames title format**: When invoking \`task\`, set \`description\` to the work-only title. Do not manually prefix \`<Ship>\` or \`[role]\`; the shipnames plugin auto-prefixes them.
- **Evidence-based receipts**: Subagent tasks require pasted evidence in the receipt \`Evidence\` block. No claim of done is accepted without evidence.


## Adaptive delivery

- Commodore infers risk; QA always active; evidence depth follows risk. Other roles stay standby.
- Ask user risk override only for ambiguity, high consequence, contract conflict, or downgrade.
- Dependency-ready phases and separate voyages run parallel; serialize shared writers. Group findings before fixes; only \`BLOCKING\` stops work. Use compact receipts.

## ${defectFile} — the defect ledger

All defects live in \`${defectFile}\`, one entry per defect, newest
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
    Screenshot: ${screenshotsDir}def-001.png (optional)

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

## ${adversarialFile} — the adversary's findings

All adversary findings live in \`${adversarialFile}\`. Writers: **adversary** (create
entries) and **orchestrator** (fill Disposition). Nobody else.

Format, exactly:

    ## ADV-001: Short title

    - Session: phase-3 gate | final
    - Suggested severity: HIGH | MEDIUM | LOW

    What I did: ...
    Expected: ...
    Actual: ...
    Screenshot: ${screenshotsDir}adv-001.png (optional)

    Disposition: PENDING

The orchestrator replaces PENDING with either \`ACCEPTED -> DEF-NNN\` or \`REJECTED - reason\`.
Accepted findings are reproduced and filed in ${defectFile} by qa. No entry may remain PENDING
when the final phase completes.

## ${securityFile} — security findings

All security findings live in \`${securityFile}\`. Writer: **security** (create findings).
Statuses: OPEN, ACCEPTED, REJECTED, MITIGATED. Orchestrator sets Disposition. Nobody else edits.

Format, exactly:

    ## SEC-###: Title

    - Status: OPEN
    - Severity: HIGH | MEDIUM | LOW
    - Found by: security
    - Phase: N

    What I found: ...
    Expected: ...
    Actual: ...
    Screenshot: ${screenshotsDir}sec-###.png (optional)

    History:
    - security: opened

Statuses and who may set them:

| Status | Meaning | Set by |
|--------|---------|--------|
| OPEN | New finding, pending review | security |
| ACCEPTED | Finding confirmed, fix planned | orchestrator |
| REJECTED | Not a vulnerability / not in scope | orchestrator |
| MITIGATED | Fix applied and verified | orchestrator |

Every status change appends a History line. A finding is never done because security says
so — it is done when the orchestrator closes it.

## Phase gates

A phase in ${manifest.project.requirementsFile ?? "armada/REQUIREMENTS.md"} passes only when its
success criteria are demonstrated by evidence — a passing test run, a screenshot, or both. A
phase starts as soon as the phases it depends on have passed; independent phases run in
parallel as background subagents.
`

  return `<!-- armada:start -->
<!-- Generated by armada. Do not edit this section manually. -->

${body}
<!-- armada:end -->
`
}

// Build the requirements file (default REQUIREMENTS.md) — the contract scaffold.
// Only written when absent. Co-write it with the orchestrator (the session
// driver): it is the armada delivery lead, you approve.
export function renderRequirementsMd(manifest) {
  return `# ${manifest.project.name} — Requirements

> The contract. Generated by armada.
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

## Adaptive workflow

- QA is always active. Low risk uses smoke, medium targeted, and high full evidence.
- Non-required agents stay standby. Risk override is optional and only for ambiguity, consequence, contract conflict, or evidence downgrade.
- Dependency-ready phases and separate voyages run in parallel; shared writers serialize. Group findings before fixes; only \`BLOCKING\` stops implementation.

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
- [ ] This work lands as \`gh pr create --base master\` from the lane branch — never \`git merge\` locally, never push master directly.
`
}

// Build the `.opencode/commands/armada.md` command descriptor.
export function renderArmadaCommand() {
  return `---
description: armada — team status, roles, regenerate
subtask: true
---
You are the armada helper. Report: the configured team (from .opencode/agent/),
the active preset, and how to regenerate (armada init --from-armada armada/armada.yaml).
When reporting the team, use the display names (Commodore, Galleon, Clipper, Corvette,
Xebec, Frigate, Caravel, Bark). Keep it terse.
`
}


// Build the `.opencode/commands/armada-scout.md` command descriptor.
export function renderArmadaScoutCommand() {
  return `---
description: armada — read-only investigation dispatch
subtask: true
agent: ${agentNameFor("orchestrator")}
---
Dispatch a read-only investigation of the requested area. Route to the xebec
(hostile review) or bark (architecture risk) as appropriate. Never write files,
never change code, never open a PR. Deliver a findings report in chat.
`
}

// Build the `.opencode/commands/armada-resume.md` command descriptor.
export function renderArmadaResumeCommand() {
  return `---
description: armada — resume after an interrupted session
subtask: true
agent: ${agentNameFor("orchestrator")}
---
Run \`armada resume\` and print the resume line plus any drift list. If \`armada\` is not on PATH, report the missing binary.
`
}


// Build the `.opencode/commands/armada-voyage.md` command descriptor.
export function renderArmadaVoyageCommand() {
  return `---
description: armada — launch a feature voyage (creates the lane, arms it, boots the ship)
subtask: true
agent: ${agentNameFor("orchestrator")}
---
You are the main Commodore launching a feature voyage. Parse the feature name from the request
(kebab-case, no spaces). The main contract must be approved before launch. Refuse if cwd is already inside a worktree
(\`git rev-parse --show-toplevel\` differs from the main checkout, or a \`sandbox/<name>\`
ancestor exists) — tell the user to run the command from the main repo.

Resolve the armada binary: prefer \`armada\` on PATH; if missing and \`src/cli.js\` exists in
the current checkout, fall back to \`node src/cli.js\`. If neither, report the missing binary
and stop.

Then run, in order:
1. \`armada feature new <name> --worktree\` — creates \`feat/<name>\` and \`sandbox/<name>\`.
2. \`armada init --yes --yolo --target sandbox/<name>\` to arm the lane.
3. \`armada voyage <name>\` to boot the ship (detached tmux session).
4. Report the lane path (\`sandbox/<name>\`) and that the contract at
   \`sandbox/<name>/armada/REQUIREMENTS.md\` was snapshotted from the approved main contract.

All paths are relative to the main repo. The steps can be run in any order or in separate
bash invocations — there is no \`cd\` mid-sequence.

The user may ask for several voyages in parallel — repeat the steps per name. The launched tmux
session is the Voyage Commodore: it owns implementation, phase gates, QA, evidence, and PR inside
its sandbox. Do not re-triage or launch another voyage. Do not implement voyage work in the main
repo. Do not merge anything locally — final delivery is \`gh pr create --base master\` from the lane
branch. Keep it terse.
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
  return `// armada supervision plugin (opt-in). Generated by armada init
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

// Build the opt-in `.opencode/plugins/armada-fleet.js` fleet tracker plugin.
// Single file, auto-loaded by opencode from the project plugin directory (no
// install). Handlers:
//   - session.created   -> discover run for this session via listRuns(), if found
//                          start a heartbeat interval (one per session tracked)
//   - session.idle       -> tick heartbeat for every tracked session (catches
//                          STALLED when tmux session dies)
//   - session.closed     -> stop heartbeat and remove from tracked set
//   - session.deleted    -> same as closed
//   - session.completed  -> same as closed
export function renderArmadaFleetPlugin() {
  return `// armada fleet plugin (opt-in). Generated by armada init
// --fleet-tracker (or armada.yaml project.supervision.fleet: true).
// Auto-loaded by opencode from .opencode/plugins/ — no install required.

import { join } from "node:path"
import { homedir } from "node:os"
import { existsSync, mkdirSync } from "node:fs"
import { startHeartbeat, tickHeartbeat } from "../../../src/heartbeat.js"
import { listRuns, getStoreDir } from "../../../src/fleet-tracker.js"

const STORE_DIR = process.env.ARMADA_RUNS_DIR ?? join(homedir(), ".armada", "runs")
const INTERVAL_MS = 30_000

// Ensure the store directory exists so listRuns / readRun don't fail on missing dir.
if (!existsSync(STORE_DIR)) mkdirSync(STORE_DIR, { recursive: true })

// Map<sessionName, { stop, session }>
const active = new Map()

export const ArmadaFleet = async ({ client }) => {
  return {
    event: async ({ event }) => {
      const type = event.type
      const props = event.properties ?? {}

      if (type === "session.created") {
        try {
          const runs = await listRuns({ storeDir: STORE_DIR })
          const sessionName = props.info?.title ?? props.sessionID
          if (!sessionName) return
          const run = runs.find((r) => r.session === sessionName)
          if (!run) return
          if (active.has(sessionName)) {
            active.get(sessionName).stop()
            active.delete(sessionName)
          }
          const hb = await startHeartbeat({
            session: sessionName,
            intervalMs: INTERVAL_MS,
            storeDir: STORE_DIR,
          })
          active.set(sessionName, { stop: hb.stop, session: sessionName })
        } catch (err) {
          await client.app.log({
            body: { service: "armada-fleet", level: "warn", message: String(err?.message ?? err) },
          })
        }
        return
      }

      if (type === "session.idle") {
        for (const [, h] of active) {
          try {
            await tickHeartbeat({ session: h.session, storeDir: STORE_DIR })
          } catch (err) {
            await client.app.log({
              body: { service: "armada-fleet", level: "warn", message: String(err?.message ?? err) },
            })
          }
        }
        return
      }

      if (type === "session.closed" || type === "session.deleted" || type === "session.completed") {
        const sessionName = props.info?.title ?? props.sessionID
        if (!sessionName) return
        const h = active.get(sessionName)
        if (!h) return
        try {
          h.stop()
        } catch (err) {
          await client.app.log({
            body: { service: "armada-fleet", level: "warn", message: String(err?.message ?? err) },
          })
        }
        active.delete(sessionName)
      }
    },
  }
}
`
}

// Build the opt-in `.opencode/plugins/armada-watchdog.js` watchdog plugin.
// Single file, auto-loaded by opencode from the project plugin directory (no
// install). Handlers:
//   - session.created    -> capture orchestrator title at first event with no
//                           parentID; track children whose title differs
//   - session.idle       -> if orchestrator idle and any child pending > 5 min,
//                           nudge orchestrator once per session (recursion guard)
//   - session.completed  -> clear child from tracking
//   - session.closed     -> clear child from tracking
//   - session.deleted    -> clear child from tracking
export function renderArmadaWatchdogPlugin() {
  return `// armada watchdog plugin (opt-in). Generated by armada init
// --watchdog (or armada.yaml project.supervision.watchdog: true).
// Auto-loaded by opencode from .opencode/plugins/ — no install required.
//
// Two-gate logic before nudging:
//   Gate 1 — orchestrator-idle: No orchestrator event for STALENESS_WINDOW_MS (120s).
//            Tracked via lastOrchestratorEventAt, updated on every non-idle event
//            for the orchestrator session (title match).
//   Gate 2 — subagent-stale: Tracked child pending > TIMEOUT_MS (300s).
//   Both gates must be true to nudge. If either gate fails, no nudge.
//   Constants: STALENESS_WINDOW_MS = 120_000, TIMEOUT_MS = 300_000

const TIMEOUT_MS = 300_000
const STALENESS_WINDOW_MS = 120_000

let orchestratorTitle = null
let orchestratorSessionID = null
// Start at Date.now() so the first orchestrator-idle after session.created
// does not immediately pass Gate 1. The window applies from init, not from 0.
let lastOrchestratorEventAt = Date.now()
const children = new Map()
let skipNextIdle = false
const nudgedSessions = new Set()

function pendingCount() {
  const now = Date.now()
  let count = 0
  for (const [, c] of children) {
    if (now - c.startedAt > TIMEOUT_MS) count++
  }
  return count
}

// Sanitize child titles to prevent prompt injection via control characters
// and long strings (defense-in-depth: plugin is internal but cheap to harden).
function sanitizeTitle(title) {
  return title
    .replace(/[\\x00-\\x1f\\x7f]/g, " ")
    .replace(/[\\s]+/g, " ")
    .trim()
    .replace(/^(.{80}).+$/, "$1...")
}

function pendingSummary() {
  const now = Date.now()
  const names = []
  for (const [, c] of children) {
    if (now - c.startedAt > TIMEOUT_MS) names.push(sanitizeTitle(c.title))
  }
  return names
}

export const ArmadaWatchdog = async ({ client }) => {
  return {
    event: async ({ event }) => {
      const type = event.type
      const props = event.properties ?? {}
      const sessionID = props.sessionID ?? props.info?.id
      const title = props.info?.title ?? sessionID

      // Update orchestrator last-event timestamp on every non-idle orchestrator event
      if (title === orchestratorTitle && type !== "session.idle") {
        lastOrchestratorEventAt = Date.now()
      }

      if (type === "session.created") {
        if (orchestratorTitle === null && !props.parentID) {
          orchestratorTitle = title
          orchestratorSessionID = sessionID
          lastOrchestratorEventAt = Date.now()
        } else if (title !== orchestratorTitle) {
          children.set(sessionID, { title, startedAt: Date.now(), orchestratorSessionID })
        }
        return
      }

      if (type === "session.idle") {
        if (title !== orchestratorTitle) return
        if (skipNextIdle) { skipNextIdle = false; return }
        if (!sessionID || nudgedSessions.has(sessionID)) return

        // Gate 1 — orchestrator-idle: must be quiet for STALENESS_WINDOW_MS
        if (Date.now() - lastOrchestratorEventAt < STALENESS_WINDOW_MS) return

        // Gate 2 — subagent-stale: at least one child pending > TIMEOUT_MS
        const count = pendingCount()
        if (count === 0) return

        const names = pendingSummary()
        try {
          await client.session.promptAsync({
            path: { id: sessionID },
            body: { parts: [{ type: "text", text: "Watchdog: " + count + " subagent(s) pending >5min. Investigate or cancel: " + names.join(", ") }] },
          })
          nudgedSessions.add(sessionID)
          skipNextIdle = true
        } catch (err) {
          await client.app.log({ body: { service: "armada-watchdog", level: "error", message: String(err?.message ?? err) } })
        }
        return
      }

      if (type === "session.completed" || type === "session.closed" || type === "session.deleted") {
        const child = children.get(sessionID)
        if (!child) return
        children.delete(sessionID)
        // Re-arm: if all children of this orchestrator are now clear, allow future nudges
        let anyRemaining = false
        for (const [, c] of children) {
          if (c.orchestratorSessionID === child.orchestratorSessionID) { anyRemaining = true; break }
        }
        if (!anyRemaining) nudgedSessions.delete(child.orchestratorSessionID)
      }
    },
  }
}
`
}

// Build the default-on `.opencode/plugins/armada-shipnames.js` shipnames plugin.
// Single file, auto-loaded by opencode from the project plugin directory (no
// install). Prefixes task tool descriptions with <Ship> [<role>] for TUI
// readability. Default-on: skipped only when supervision.shipnames === false.
export const SHIPNAMES_PLUGIN_FILENAME = ".opencode/plugins/armada-shipnames.js"

export function renderArmadaShipnamesPlugin() {
  const entries = Object.entries(DISPLAY).map(([role, ship]) => `  ${JSON.stringify(role)}: ${JSON.stringify(ship)}`).join(",\n")
  const roleKeys = Object.keys(DISPLAY).map((r) => JSON.stringify(r)).join(", ")
  return `// armada shipnames plugin (default-on). Generated by armada init.
// --no-shipnames skips it. Auto-loaded by opencode from .opencode/plugins/ —
// no install required.
// Prefixes task tool descriptions with <Ship> [<role>] for TUI readability.

const DISPLAY = {
${entries}
}

const ROLES = [${roleKeys}]

export const ArmadaShipnames = async ({ client }) => {
  return {
    "tool.execute.before": async ({ tool, args }) => {
      if (tool !== "task") return

      const role = args?.subagent_type || args?.subagentType
      if (!role || !DISPLAY[role]) return

      const description = args?.description
      if (typeof description !== "string") return

      // Idempotent: skip if already prefixed by any armada role
      for (const r of ROLES) {
        const prefix = DISPLAY[r] + " [" + r + "] "
        if (description.startsWith(prefix)) return
      }

      const ship = DISPLAY[role]
      args.description = ship + " [" + role + "] " + description
    },
  }
}
`
}

// Render a single security finding entry in the canonical SEC-FINDINGS format.
// Used by tests and future auto-generation. Mirrors securityFindingEntry in
// src/ledgers.js but lives in generator as a pure renderer alongside the other
// ledger-format renderers.
export function renderSecurityFinding(feature, finding = {}) {
  const n = String(finding.num ?? 1).padStart(3, "0")
  const lines = [`## SEC-${n}: ${finding.title ?? "Untitled"}`, ""]
  lines.push(`- Status: ${finding.status ?? "OPEN"}`)
  lines.push(`- Severity: ${finding.severity ?? "MEDIUM"}`)
  lines.push(`- Found by: ${finding.foundBy ?? "security"}`)
  lines.push(`- Phase: ${finding.phase ?? "N"}`)
  lines.push("")
  lines.push(`What I found: ${finding.found ?? "..."}`)
  lines.push(`Expected: ${finding.expected ?? "..."}`)
  lines.push(`Actual: ${finding.actual ?? "..."}`)
  if (finding.screenshot) {
    lines.push(`Screenshot: ${finding.screenshot}`)
  }
  lines.push("")
  lines.push("History:")
  const history = finding.history ?? ["security: opened"]
  for (const h of history) {
    lines.push(`- ${h}`)
  }
  return lines.join("\n")
}

// Render the canonical SECURITY_FINDINGS.md template file content.
// Written once at armada/ledgers/_template/SECURITY_FINDINGS.md on init;
// never clobbered on re-scaffold.
export function renderSecurityFindingsTemplate() {
  return `# armada/ledgers/{feature}/SECURITY_FINDINGS.md — security findings

All security findings live in \`armada/ledgers/{feature}/SECURITY_FINDINGS.md\`, one entry
per finding, newest first. Writer: **security** (create findings). Statuses: OPEN, ACCEPTED,
REJECTED, MITIGATED. The orchestrator sets Disposition. Nobody else edits.

Format, exactly:

    ## SEC-###: Title

    - Status: OPEN
    - Severity: HIGH | MEDIUM | LOW
    - Found by: security
    - Phase: N

    What I found: ...
    Expected: ...
    Actual: ...
    Screenshot: armada/screenshots/{feature}/sec-###.png (optional)

    History:
    - security: opened

Statuses and who may set them:

| Status | Meaning | Set by |
|--------|---------|--------|
| OPEN | New finding, pending review | security |
| ACCEPTED | Finding confirmed, fix planned | orchestrator |
| REJECTED | Not a vulnerability / not in scope | orchestrator |
| MITIGATED | Fix applied and verified | orchestrator |

Every status change appends a History line.
`
}

// Render a skill file into its target path `.opencode/skills/<name>/SKILL.md`.
// The skill object has `name`, `description`, and `body` (full SKILL.md content).
// Pure function, no I/O.
export function renderSkillFile(skill) {
  return skill.body
}

// Build `armada.yaml` manifest content (serialized).
export function renderManifestYaml(manifest, team) {
  const q = (v) => JSON.stringify(v)
  const teamByRole = Object.fromEntries((manifest.team || []).map((t) => [t.role, t]))
  const teamLines = team
    .map(
      (a) => {
        const mt = teamByRole[a.role]
        let lines = `  - # Role name: orchestrator, backend-dev, frontend-dev, qa, adversary, security, docs, architect\n    role: ${q(a.role)}\n    # Primary model ID (provider/model format)\n    model: ${q(a.model)}\n    # Fallback model if primary unavailable (or null)\n    fallback: ${a.fallback === null ? "null" : q(a.fallback)}\n`
        if (a.variant !== null && a.variant !== undefined) lines += `    # (optional) Model variant — e.g. 'thinking' for extended reasoning\n    variant: ${q(a.variant)}\n`
        if (mt?.permissions !== null && mt?.permissions !== undefined) {
          lines += `    # (optional) Per-role bash/permission overrides\n`
          const permYaml = YAML.stringify(mt.permissions).trim()
          lines += `    permissions:\n${permYaml.split("\n").map((l) => "      " + l).join("\n")}\n`
        }
        if (mt?.instructions !== null && mt?.instructions !== undefined) {
          lines += `    # (optional) Extra instructions appended to the role's prompt\n    instructions: ${q(mt.instructions)}\n`
        }
        if (mt?.prompt !== null && mt?.prompt !== undefined) {
          lines += `    # (optional) Path to a custom prompt template (relative to repo root)\n    prompt: ${q(mt.prompt)}\n`
        }
        lines += `    # Whether this role is active in the team\n    enabled: ${a.enabled}`
        return lines
      }
    )
    .join("\n")
  const s = manifest.project.stack || {}
  const str = (v) => v === null || v === undefined ? "null" : q(v)
  let yaml = `# armada.yaml — armada manifest (source of truth)
# Regenerate identical config with: armada init --from-armada armada/armada.yaml

project:
  # Display name of the project (used in dashboards + prompt headers)
  name: ${q(manifest.project.name)}
  # Model budget tier: free | balanced (default) | power
  budget: ${q(manifest.project.budget)}
  # Enable agent-browser for e2e testing
  browserTesting: ${manifest.project.browserTesting ?? false}
  # Emit .devcontainer/ config for sandboxed dev
  devcontainer: ${manifest.project.devcontainer ?? false}
  # Use opencode's agent-browser tool for e2e tests
  useAgentBrowser: ${manifest.project.useAgentBrowser ?? false}
  # CI-safe: orchestrator bash set to allow (for opencode run)
  headless: ${manifest.project.headless ?? false}
  # Autonomous: no permission prompts (strict superset of headless)
  yolo: ${manifest.project.yolo ?? false}
  # Path to the contract file (default: armada/REQUIREMENTS.md)
  requirementsFile: ${q(manifest.project.requirementsFile ?? "armada/REQUIREMENTS.md")}
${manifest.project.feature ? `  # (optional) Active feature name; sets armada/state/features/<name>.json\n  feature: ${q(manifest.project.feature)}\n` : ""}${manifest.project.skills !== undefined ? `  # (optional) Skills to load into the orchestrator prompt\n  skills: [${(manifest.project.skills || []).map((s) => q(s)).join(", ")}]\n` : ""}  supervision:
    # Emit .opencode/plugins/armada-supervision.js
    plugin: ${manifest.project.supervision?.plugin ?? false}
    # Emit per-lane fleet dashboard (default: true)
    fleet: ${manifest.project.supervision?.fleet ?? true}
    # Emit subagent watchdog plugin
    watchdog: ${manifest.project.supervision?.watchdog ?? false}
    # Emit shipnames TUI-prefix plugin (default: true)
    shipnames: ${manifest.project.supervision?.shipnames ?? true}
  stack:
    # Frontend framework (nextjs, vite, etc.) or null
    frontend: ${str(s.frontend)}
    # Backend framework (express, fastapi, etc.) or null
    backend: ${str(s.backend)}
    # Database (postgres, sqlite, etc.) or null
    database: ${str(s.database)}
    # Test runner (vitest, jest, etc.)
    testing: ${str(s.testing)}
    # Source directories the agents should focus on
    srcDirs: [${(s.srcDirs || []).map((d) => q(d)).join(", ")}]
    # Primary languages in the codebase
    languages: [${(s.languages || []).map((l) => q(l)).join(", ")}]
    # Project instruction files agents should read
    instructions: [${(s.instructions || []).map((i) => q(i)).join(", ")}]

team:
${teamLines}
`
  // Phase 1: securityLedger round-trip — append playbook section when securityLedger is set.
  const secLedger = manifest.playbook?.securityLedger
  if (secLedger) {
    yaml += "\nplaybook:\n"
    yaml += "  securityLedger:\n"
    if (typeof secLedger === "object") {
      yaml += `    # Path to the security findings ledger\n    file: ${q(secLedger.file)}\n`
      if (secLedger.shared) yaml += `    # (optional) Shared ledger path\n    shared: ${q(secLedger.shared)}\n`
      if (secLedger.owner) yaml += `    # (optional) Owner agent for the ledger\n    owner: ${q(secLedger.owner)}\n`
    } else {
      yaml += `    # Path to the security findings ledger\n    file: ${q(secLedger)}\n`
    }
  }
  return yaml
}
