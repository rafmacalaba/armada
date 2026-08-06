import { test } from "node:test"
import assert from "node:assert"
import YAML from "yaml"
import { parseManifestYaml } from "../src/manifest.js"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { buildTeam, renderManifestYaml } from "../src/generator.js"

function makeManifest() {
  return {
    project: {
      name: "t", budget: "balanced", browserTesting: false,
      devcontainer: false, useAgentBrowser: false,
      stack: { frontend: "nextjs", backend: "python-fastapi", database: "postgres",
        testing: "playwright", srcDirs: ["src", "backend"], languages: ["typescript", "python"] },
    },
    team: ROLES.map((r) => ({ role: r, model: modelFor(r, "balanced"), fallback: null, enabled: true })),
    playbook: {},
  }
}

test("round-trips through renderManifestYaml", () => {
  const m = makeManifest()
  const parsed = parseManifestYaml(renderManifestYaml(m, buildTeam(m)))
  assert.strictEqual(parsed.project.name, "t")
  assert.strictEqual(parsed.project.budget, "balanced")
  assert.strictEqual(parsed.project.stack.backend, "python-fastapi")
  assert.strictEqual(parsed.project.stack.srcDirs.length, 2)
  assert.strictEqual(parsed.team.length, ROLES.length)
  assert.ok(parsed.team.every((t) => t.enabled === true))
})

test("parses null stack fields", () => {
  const m = makeManifest()
  m.project.stack = {}
  const parsed = parseManifestYaml(renderManifestYaml(m, buildTeam(m)))
  assert.strictEqual(parsed.project.stack.frontend, null)
})

test("rejects invalid yaml", () => {
  assert.throws(() => parseManifestYaml("project: [unclosed"), Error)
})

test("rejects missing project section", () => {
  assert.throws(() => parseManifestYaml("team:\n  - role: backend-dev\n    model: x\n    enabled: true"), /project/)
})

test("rejects missing team", () => {
  assert.throws(() => parseManifestYaml("project:\n  name: x\n  budget: balanced\nteam: []"), /team is empty/)
})

test("rejects non-list team", () => {
  assert.throws(() => parseManifestYaml("project:\n  name: x\nteam: {}"), /team must be a list/)
})

test("coerces quoted string booleans for enabled", () => {
  const yaml = [
    "project:",
    "  name: t",
    "  budget: free",
    "team:",
    "  - role: qa",
    "    model: x",
    '    enabled: "false"',
    "",
  ].join("\n")
  const parsed = parseManifestYaml(yaml)
  assert.strictEqual(parsed.team.length, 1)
  assert.strictEqual(parsed.team[0].enabled, false)
})

test("parses headless flag", () => {
  const m = makeManifest()
  m.project.headless = true
  const parsed = parseManifestYaml(renderManifestYaml(m, buildTeam(m)))
  assert.strictEqual(parsed.project.headless, true)
})

test("headless defaults to false", () => {
  const parsed = parseManifestYaml(renderManifestYaml(makeManifest(), buildTeam(makeManifest())))
  assert.strictEqual(parsed.project.headless, false)
})

test("parses requirementsFile (default + custom)", () => {
  const parsed = parseManifestYaml(renderManifestYaml(makeManifest(), buildTeam(makeManifest())))
  assert.strictEqual(parsed.project.requirementsFile, "armada/REQUIREMENTS.md")
  const m = makeManifest()
  m.project.requirementsFile = "REQUIREMENTS-admin-dashboard.md"
  const parsed2 = parseManifestYaml(renderManifestYaml(m, buildTeam(m)))
  assert.strictEqual(parsed2.project.requirementsFile, "REQUIREMENTS-admin-dashboard.md")
})

test("enforces schema: project types", () => {
  assert.throws(() => parseManifestYaml("project:\n  name: 42\n  budget: balanced\nteam:\n  - role: backend-dev\n    model: x\n    enabled: true"), /schema/)
  assert.throws(() => parseManifestYaml("project:\n  name: t\n  budget: ultra\nteam:\n  - role: backend-dev\n    model: x\n    enabled: true"), /schema/)
  assert.throws(() => parseManifestYaml("project:\n  name: t\n  budget: balanced\n  stack: string\nteam:\n  - role: backend-dev\n    model: x\n    enabled: true"), /schema/)
  assert.throws(() => parseManifestYaml("project:\n  name: t\n  budget: balanced\n  browserTesting: no\nteam:\n  - role: backend-dev\n    model: x\n    enabled: true"), /schema/)
})

test("enforces schema: team entries", () => {
  assert.throws(() => parseManifestYaml("project:\n  name: t\n  budget: balanced\nteam:\n  - role: 123\n    model: x\n    enabled: true"), /schema/)
  assert.throws(() => parseManifestYaml("project:\n  name: t\n  budget: balanced\nteam:\n  - role: unknown\n    model: x\n    enabled: true"), /schema/)
  assert.throws(() => parseManifestYaml("project:\n  name: t\n  budget: balanced\nteam:\n  - role: backend-dev\n    model: 1\n    enabled: true"), /schema/)
})

test("rejects duplicate team roles", () => {
  assert.throws(() => parseManifestYaml("project:\n  name: t\n  budget: balanced\nteam:\n  - role: backend-dev\n    model: x\n    enabled: true\n  - role: backend-dev\n    model: y\n    enabled: true"), /duplicate/)
})

test("rejects empty model string", () => {
  assert.throws(() => parseManifestYaml("project:\n  name: t\n  budget: balanced\nteam:\n  - role: backend-dev\n    model: ''\n    enabled: true"), /schema/)
})

test("strictly parses enabled: 0 and no as invalid", () => {
  assert.throws(() => parseManifestYaml("project:\n  name: t\n  budget: balanced\nteam:\n  - role: backend-dev\n    model: x\n    enabled: 0"), /schema/)
  assert.throws(() => parseManifestYaml("project:\n  name: t\n  budget: balanced\nteam:\n  - role: backend-dev\n    model: x\n    enabled: no"), /schema/)
})

// -- Phase 1: new optional fields --

test("parses permissions, instructions, prompt via YAML round-trip", () => {
  const manifest = {
    project: { name: "t", budget: "balanced", stack: {} },
    team: [{
      role: "backend-dev",
      model: "test/model",
      fallback: null,
      enabled: true,
      permissions: { edit: { "*": "allow", "e2e/*": "deny" }, bash: { "*": "ask" } },
      instructions: "extra prompt for backend",
      prompt: "templates/custom.md",
    }],
  }
  const yaml = YAML.stringify(manifest)
  const parsed = parseManifestYaml(yaml)
  assert.strictEqual(parsed.team.length, 1)
  const t = parsed.team[0]
  assert.strictEqual(t.role, "backend-dev")
  assert.strictEqual(t.instructions, "extra prompt for backend")
  assert.strictEqual(t.prompt, "templates/custom.md")
  assert.deepStrictEqual(t.permissions, { edit: { "*": "allow", "e2e/*": "deny" }, bash: { "*": "ask" } })
})

test("rejects invalid permission leaf value", () => {
  assert.throws(
    () => parseManifestYaml(
      "project:\n  name: t\n  budget: balanced\nteam:\n  - role: backend-dev\n    model: x\n    enabled: true\n    permissions:\n      edit:\n        '*': maybe"
    ),
    /armada\.yaml: schema violation: backend-dev permissions\.edit\.\* must be "allow", "deny", or "ask"/
  )
})

test("rejects instructions: empty string", () => {
  assert.throws(
    () => parseManifestYaml(
      "project:\n  name: t\n  budget: balanced\nteam:\n  - role: backend-dev\n    model: x\n    enabled: true\n    instructions: ''"
    ),
    /armada\.yaml: schema violation: backend-dev instructions must be a non-empty string/
  )
})

test("rejects instructions: non-string", () => {
  assert.throws(
    () => parseManifestYaml(
      "project:\n  name: t\n  budget: balanced\nteam:\n  - role: backend-dev\n    model: x\n    enabled: true\n    instructions: 42"
    ),
    /armada\.yaml: schema violation: backend-dev instructions must be a non-empty string/
  )
})

test("rejects prompt: '../escape'", () => {
  assert.throws(
    () => parseManifestYaml(
      "project:\n  name: t\n  budget: balanced\nteam:\n  - role: backend-dev\n    model: x\n    enabled: true\n    prompt: '../escape'"
    ),
    /armada\.yaml: schema violation: backend-dev prompt must not contain '\.\.'/
  )
})

test("rejects prompt: '/abs'", () => {
  assert.throws(
    () => parseManifestYaml(
      "project:\n  name: t\n  budget: balanced\nteam:\n  - role: backend-dev\n    model: x\n    enabled: true\n    prompt: '/abs'"
    ),
    /armada\.yaml: schema violation: backend-dev prompt must be a relative path/
  )
})

test("rejects prompt: empty string", () => {
  assert.throws(
    () => parseManifestYaml(
      "project:\n  name: t\n  budget: balanced\nteam:\n  - role: backend-dev\n    model: x\n    enabled: true\n    prompt: ''"
    ),
    /armada\.yaml: schema violation: backend-dev prompt must be a non-empty string/
  )
})

test("rejects prompt: escapes target directory", () => {
  assert.throws(
    () => parseManifestYaml(
      "project:\n  name: t\n  budget: balanced\nteam:\n  - role: backend-dev\n    model: x\n    enabled: true\n    prompt: '../../etc/passwd'",
      "/tmp/role-config-test"
    ),
    /armada\.yaml: schema violation: backend-dev prompt must not contain '\.\.'/
  )
})

test("no overrides still parses to same shape (nulls for new fields)", () => {
  const yaml = [
    "project:",
    "  name: t",
    "  budget: free",
    "team:",
    "  - role: qa",
    "    model: x",
    "    enabled: true",
    "",
  ].join("\n")
  const parsed = parseManifestYaml(yaml)
  assert.strictEqual(parsed.team.length, 1)
  assert.strictEqual(parsed.team[0].permissions, null)
  assert.strictEqual(parsed.team[0].instructions, null)
  assert.strictEqual(parsed.team[0].prompt, null)
  assert.strictEqual(parsed.team[0].role, "qa")
  assert.strictEqual(parsed.team[0].model, "x")
  assert.strictEqual(parsed.team[0].enabled, true)
})

// -- Phase 2: round-trip identity with overrides --

test("round-trips through renderManifestYaml with overrides preserving new fields", () => {
  const m = makeManifest()
  // Override the backend-dev entry with the three new fields
  m.team = m.team.map((t) =>
    t.role === "backend-dev"
      ? { ...t, permissions: { edit: { "*": "allow", "e2e/*": "deny" }, bash: { "*": "ask" } },
          instructions: "extra prompt for backend",
          prompt: "templates/custom.md" }
      : t
  )
  const yaml = renderManifestYaml(m, buildTeam(m))
  const parsed = parseManifestYaml(yaml)
  const t = parsed.team.find((r) => r.role === "backend-dev")
  assert.strictEqual(t.instructions, "extra prompt for backend")
  assert.strictEqual(t.prompt, "templates/custom.md")
  assert.deepStrictEqual(t.permissions, { edit: { "*": "allow", "e2e/*": "deny" }, bash: { "*": "ask" } })
  // Other roles are untouched
  const qa = parsed.team.find((r) => r.role === "qa")
  assert.strictEqual(qa.permissions, null)
  assert.strictEqual(qa.instructions, null)
  assert.strictEqual(qa.prompt, null)
})

test("renderManifestYaml omits new fields when null for byte-identical default output", () => {
  const m = makeManifest()
  const yaml = renderManifestYaml(m, buildTeam(m))
  // Team entries must not have any of the three new fields when null.
  // Use quoted-string pattern to avoid matching stack-level arrays.
  assert.doesNotMatch(yaml, /    permissions:\n/)
  assert.doesNotMatch(yaml, /    instructions: "/)
  assert.doesNotMatch(yaml, /    prompt: "/)
})

// -- Phase 4: supervision.fleet --
test("parses supervision.fleet: true alongside plugin: false", () => {
  const yaml = [
    "project:",
    "  name: t",
    "  budget: balanced",
    "  supervision:",
    "    plugin: false",
    "    fleet: true",
    "team:",
    "  - role: qa",
    "    model: x",
    "    enabled: true",
  ].join("\n")
  const parsed = parseManifestYaml(yaml)
  assert.strictEqual(parsed.project.supervision.plugin, false)
  assert.strictEqual(parsed.project.supervision.fleet, true)
})

test("rejects supervision.fleet non-boolean", () => {
  const yaml = [
    "project:",
    "  name: t",
    "  budget: balanced",
    "  supervision:",
    "    fleet: \"yes\"",
    "team:",
    "  - role: qa",
    "    model: x",
    "    enabled: true",
  ].join("\n")
  assert.throws(
    () => parseManifestYaml(yaml),
    /supervision\.fleet.*boolean/
  )
})

test("parses missing supervision block defaults fleet to true", () => {
  const yaml = [
    "project:",
    "  name: t",
    "  budget: balanced",
    "team:",
    "  - role: qa",
    "    model: x",
    "    enabled: true",
  ].join("\n")
  const parsed = parseManifestYaml(yaml)
  assert.strictEqual(parsed.project.supervision.plugin, false)
  assert.strictEqual(parsed.project.supervision.fleet, true)
  assert.strictEqual(parsed.project.supervision.watchdog, false)
})

test("parses supervision.watchdog: true alongside plugin: false, fleet: false", () => {
  const yaml = [
    "project:",
    "  name: t",
    "  budget: balanced",
    "  supervision:",
    "    plugin: false",
    "    fleet: false",
    "    watchdog: true",
    "team:",
    "  - role: qa",
    "    model: x",
    "    enabled: true",
  ].join("\n")
  const parsed = parseManifestYaml(yaml)
  assert.strictEqual(parsed.project.supervision.plugin, false)
  assert.strictEqual(parsed.project.supervision.fleet, false)
  assert.strictEqual(parsed.project.supervision.watchdog, true)
})

test("rejects supervision.watchdog non-boolean", () => {
  assert.throws(
    () => parseManifestYaml(
      "project:\n  name: t\n  budget: balanced\n  supervision:\n    watchdog: 42\nteam:\n  - role: qa\n    model: x\n    enabled: true"
    ),
    /armada\.yaml: schema violation: project\.supervision\.watchdog must be a boolean/
  )
})

test("parses missing watchdog defaults to false", () => {
  const yaml = [
    "project:",
    "  name: t",
    "  budget: balanced",
    "  supervision:",
    "    plugin: true",
    "team:",
    "  - role: qa",
    "    model: x",
    "    enabled: true",
  ].join("\n")
  const parsed = parseManifestYaml(yaml)
  assert.strictEqual(parsed.project.supervision.plugin, true)
  assert.strictEqual(parsed.project.supervision.fleet, true)
  assert.strictEqual(parsed.project.supervision.watchdog, false)
})

// -- Phase 2: per-feature ledger paths --

test("DEFAULT_PLAYBOOK defectLedger and adversarialLedger have per-feature paths", async () => {
  // Import the module to access DEFAULT_PLAYBOOK
  const mod = await import("../src/manifest.js")
  assert.match(mod.DEFAULT_PLAYBOOK.defectLedger.file, /armada\/ledgers\/\{feature\}\/DEFECTS\.md/)
  assert.match(mod.DEFAULT_PLAYBOOK.adversarialLedger.file, /armada\/ledgers\/\{feature\}\/ADVERSARIAL_REVIEW\.md/)
  assert.strictEqual(mod.DEFAULT_PLAYBOOK.defectLedger.shared, "armada/ledgers/shared/DEFECTS.md")
  assert.strictEqual(mod.DEFAULT_PLAYBOOK.adversarialLedger.shared, "armada/ledgers/shared/ADVERSARIAL_REVIEW.md")
})

test("parseManifestYaml accepts optional project.feature", () => {
  const yaml = [
    "project:",
    "  name: t",
    "  budget: free",
    "  feature: my-feature",
    "team:",
    "  - role: qa",
    "    model: x",
    "    enabled: true",
    "",
  ].join("\n")
  const parsed = parseManifestYaml(yaml)
  assert.strictEqual(parsed.project.feature, "my-feature")
})

test("parseManifestYaml rejects empty project.feature", () => {
  assert.throws(
    () => parseManifestYaml(
      "project:\n  name: t\n  budget: free\n  feature: ''\nteam:\n  - role: qa\n    model: x\n    enabled: true"
    ),
    /schema/
  )
})

test("parseManifestYaml rejects project.feature with path separators", () => {
  assert.throws(
    () => parseManifestYaml(
      "project:\n  name: t\n  budget: free\n  feature: 'foo/bar'\nteam:\n  - role: qa\n    model: x\n    enabled: true"
    ),
    /schema/
  )
  assert.throws(
    () => parseManifestYaml(
      "project:\n  name: t\n  budget: free\n  feature: 'foo\\bar'\nteam:\n  - role: qa\n    model: x\n    enabled: true"
    ),
    /schema/
  )
})

test("parseManifestYaml rejects project.feature with .. traversal", () => {
  assert.throws(
    () => parseManifestYaml(
      "project:\n  name: t\n  budget: free\n  feature: '../escape'\nteam:\n  - role: qa\n    model: x\n    enabled: true"
    ),
    /schema/
  )
})

// -- Phase 2: skills field --

test("parseManifestYaml defaults skills to undefined when omitted", () => {
  const yaml = [
    "project:",
    "  name: t",
    "  budget: free",
    "team:",
    "  - role: qa",
    "    model: x",
    "    enabled: true",
    "",
  ].join("\n")
  const parsed = parseManifestYaml(yaml)
  assert.strictEqual(parsed.project.skills, undefined)
})

test("parseManifestYaml accepts empty skills list", () => {
  const yaml = [
    "project:",
    "  name: t",
    "  budget: free",
    "  skills: []",
    "team:",
    "  - role: qa",
    "    model: x",
    "    enabled: true",
    "",
  ].join("\n")
  const parsed = parseManifestYaml(yaml)
  assert.deepStrictEqual(parsed.project.skills, [])
})

test("parseManifestYaml parses skills list with entries", () => {
  const yaml = [
    "project:",
    "  name: t",
    "  budget: free",
    "  skills:",
    "    - armada-contract",
    "    - armada-gate",
    "team:",
    "  - role: qa",
    "    model: x",
    "    enabled: true",
    "",
  ].join("\n")
  const parsed = parseManifestYaml(yaml)
  assert.deepStrictEqual(parsed.project.skills, ["armada-contract", "armada-gate"])
})

test("parseManifestYaml parses custom skills list", () => {
  const yaml = [
    "project:",
    "  name: t",
    "  budget: free",
    "  skills:",
    "    - armada-contract",
    "team:",
    "  - role: qa",
    "    model: x",
    "    enabled: true",
    "",
  ].join("\n")
  const parsed = parseManifestYaml(yaml)
  assert.deepStrictEqual(parsed.project.skills, ["armada-contract"])
})

test("parseManifestYaml rejects non-array skills", () => {
  assert.throws(
    () => parseManifestYaml(
      "project:\n  name: t\n  budget: free\n  skills: 'armada-contract'\nteam:\n  - role: qa\n    model: x\n    enabled: true"
    ),
    /skills.*must be a list/
  )
})

test("parseManifestYaml rejects skills with non-string element", () => {
  assert.throws(
    () => parseManifestYaml(
      "project:\n  name: t\n  budget: free\n  skills:\n    - 42\nteam:\n  - role: qa\n    model: x\n    enabled: true"
    ),
    /skills.*must be strings/
  )
})

test("skills survives parse -> render -> parse round-trip", () => {
  const yaml = [
    "project:",
    "  name: t",
    "  budget: balanced",
    "  skills:",
    "    - armada-contract",
    "  stack:",
    "    frontend: null",
    "    backend: null",
    "    database: null",
    "    testing: null",
    "    srcDirs: []",
    "    languages: []",
    "    instructions: []",
    "team:",
    "  - role: qa",
    "    model: x",
    "    fallback: null",
    "    enabled: true",
    "",
  ].join("\n")
  const parsed = parseManifestYaml(yaml)
  assert.deepStrictEqual(parsed.project.skills, ["armada-contract"])
  const yaml2 = renderManifestYaml(parsed, buildTeam(parsed))
  const parsed2 = parseManifestYaml(yaml2)
  assert.deepStrictEqual(parsed2.project.skills, ["armada-contract"])
})

test("skills empty list survives round-trip", () => {
  const yaml = [
    "project:",
    "  name: t",
    "  budget: balanced",
    "  skills: []",
    "  stack:",
    "    frontend: null",
    "    backend: null",
    "    database: null",
    "    testing: null",
    "    srcDirs: []",
    "    languages: []",
    "    instructions: []",
    "team:",
    "  - role: qa",
    "    model: x",
    "    fallback: null",
    "    enabled: true",
    "",
  ].join("\n")
  const parsed = parseManifestYaml(yaml)
  assert.deepStrictEqual(parsed.project.skills, [])
  const yaml2 = renderManifestYaml(parsed, buildTeam(parsed))
  const parsed2 = parseManifestYaml(yaml2)
  assert.deepStrictEqual(parsed2.project.skills, [])
})

// -- Phase 2: supervision.shipnames --
test("parses supervision.shipnames: true alongside fleet + watchdog", () => {
  const yaml = [
    "project:",
    "  name: t",
    "  budget: balanced",
    "  supervision:",
    "    fleet: true",
    "    watchdog: false",
    "    shipnames: true",
    "team:",
    "  - role: qa",
    "    model: x",
    "    enabled: true",
  ].join("\n")
  const parsed = parseManifestYaml(yaml)
  assert.strictEqual(parsed.project.supervision.shipnames, true)
  assert.strictEqual(parsed.project.supervision.fleet, true)
  assert.strictEqual(parsed.project.supervision.watchdog, false)
})

test("parses supervision.shipnames: false explicit", () => {
  const yaml = [
    "project:",
    "  name: t",
    "  budget: balanced",
    "  supervision:",
    "    shipnames: false",
    "team:",
    "  - role: qa",
    "    model: x",
    "    enabled: true",
  ].join("\n")
  const parsed = parseManifestYaml(yaml)
  assert.strictEqual(parsed.project.supervision.shipnames, false)
})

test("supervision.shipnames defaults to true when missing", () => {
  const yaml = [
    "project:",
    "  name: t",
    "  budget: balanced",
    "  supervision:",
    "    plugin: false",
    "team:",
    "  - role: qa",
    "    model: x",
    "    enabled: true",
  ].join("\n")
  const parsed = parseManifestYaml(yaml)
  assert.strictEqual(parsed.project.supervision.shipnames, true)
})

test("rejects supervision.shipnames non-boolean", () => {
  assert.throws(
    () => parseManifestYaml(
      "project:\n  name: t\n  budget: balanced\n  supervision:\n    shipnames: \"yes\"\nteam:\n  - role: qa\n    model: x\n    enabled: true"
    ),
    /armada\.yaml: schema violation: project\.supervision\.shipnames must be a boolean/
  )
})

test("shipnames round-trips through renderManifestYaml", () => {
  const m = makeManifest()
  m.project.supervision = { shipnames: true, fleet: false, watchdog: true }
  const yaml = renderManifestYaml(m, buildTeam(m))
  const parsed = parseManifestYaml(yaml)
  assert.strictEqual(parsed.project.supervision.shipnames, true)
  assert.strictEqual(parsed.project.supervision.fleet, false)
  assert.strictEqual(parsed.project.supervision.watchdog, true)
})

test("skills omitted round-trips (stays undefined, not rendered)", () => {
  const m = makeManifest()
  const yaml = renderManifestYaml(m, buildTeam(m))
  assert.doesNotMatch(yaml, /skills:/)
  const parsed = parseManifestYaml(yaml)
  assert.strictEqual(parsed.project.skills, undefined)
})

// -- Phase: yaml-field-comments --

test("renderManifestYaml emits field comments above every YAML key", () => {
  const m = makeManifest()
  m.project.feature = "my-feature"
  m.project.skills = ["armada-contract"]
  m.project.headless = true
  m.project.yolo = true
  m.playbook = { securityLedger: { file: "ledgers/my-sec.md", shared: "ledgers/shared.md", owner: "security" } }
  const yaml = renderManifestYaml(m, buildTeam(m))

  // project fields
  assert.match(yaml, /# Display name of the project \(used in dashboards/)
  assert.match(yaml, /# Model budget tier: free \| balanced \(default\) \| power/)
  assert.match(yaml, /# Enable agent-browser for e2e testing/)
  assert.match(yaml, /# Emit \.devcontainer\/ config for sandboxed dev/)
  assert.match(yaml, /# Use opencode's agent-browser tool for e2e tests/)
  assert.match(yaml, /# CI-safe: orchestrator bash set to allow/)
  assert.match(yaml, /# Autonomous: no permission prompts/)
  assert.match(yaml, /# Path to the contract file/)
  assert.match(yaml, /# \(optional\) Active feature name/)
  assert.match(yaml, /# \(optional\) Skills to load into the orchestrator prompt/)
  // supervision
  assert.match(yaml, /# Emit \.opencode\/plugins\/armada-supervision\.js/)
  assert.match(yaml, /# Emit per-lane fleet dashboard/)
  assert.match(yaml, /# Emit subagent watchdog plugin/)
  // stack
  assert.match(yaml, /# Frontend framework \(nextjs/)
  assert.match(yaml, /# Backend framework \(express/)
  assert.match(yaml, /# Database \(postgres/)
  assert.match(yaml, /# Test runner \(vitest/)
  assert.match(yaml, /# Source directories the agents should focus on/)
  assert.match(yaml, /# Primary languages in the codebase/)
  assert.match(yaml, /# Project instruction files agents should read/)
  // team fields (sampled — every role gets same comment set)
  assert.match(yaml, /# Role name: orchestrator/)
  assert.match(yaml, /# Primary model ID \(provider\/model format\)/)
  assert.match(yaml, /# Fallback model if primary unavailable \(or null\)/)
  assert.match(yaml, /# Whether this role is active in the team/)
  // playbook
  assert.match(yaml, /# Path to the security findings ledger/)
  assert.match(yaml, /# \(optional\) Shared ledger path/)
  assert.match(yaml, /# \(optional\) Owner agent for the ledger/)
})

test("comments survive parse -> render round-trip", () => {
  const m = makeManifest()
  m.project.feature = "my-feature"
  m.project.skills = ["armada-contract"]
  m.playbook = { securityLedger: { file: "ledgers/sec.md" } }
  const yaml1 = renderManifestYaml(m, buildTeam(m))
  const parsed = parseManifestYaml(yaml1)
  const yaml2 = renderManifestYaml(parsed, buildTeam(parsed))

  // Comments must be present in both renders
  for (const comment of [
    "# Display name of the project",
    "# Model budget tier",
    "# Enable agent-browser",
    "# CI-safe",
    "# Path to the contract file",
    "# (optional) Active feature name",
    "# (optional) Skills to load into the orchestrator prompt",
    "# Emit .opencode/plugins",
    "# Frontend framework",
    "# Source directories",
    "# Role name:",
    "# Primary model ID",
    "# Fallback model",
    "# Whether this role is active in the team",
    "# Path to the security findings ledger",
  ]) {
    assert.match(yaml1, new RegExp(comment.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&")), `comment missing in first render: ${comment}`)
    assert.match(yaml2, new RegExp(comment.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&")), `comment missing in second render: ${comment}`)
  }

  // Values survive round-trip
  assert.strictEqual(parsed.project.name, "t")
  assert.strictEqual(parsed.project.feature, "my-feature")
  assert.strictEqual(parsed.project.skills.length, 1)
  assert.strictEqual(parsed.playbook.securityLedger.file, "ledgers/sec.md")
})
