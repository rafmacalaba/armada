import { test } from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import YAML from "yaml"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { buildTeam, renderAgentFile } from "../src/generator.js"
import { agentNameFor } from "../src/role-display.js"

function parseFrontmatter(frontmatterYaml) {
  return YAML.parse(frontmatterYaml)
}

function frontmatterPerms(agentContent) {
  const fm = agentContent.slice(agentContent.indexOf("---") + 3, agentContent.indexOf("---\n", 3))
  const cfg = parseFrontmatter(fm)
  return cfg.permission?.edit ?? {}
}

function skillPermFromAgentFile(agent, promptText) {
  const out = renderAgentFile(agent, promptText)
  // skill is nested under permission: in the YAML, so lines are indented (e.g. "  skill: allow")
  return out.includes("skill: allow") ? "allow" : undefined
}

const baseManifest = {
  project: {
    name: "test-project",
    budget: "balanced",
    browserTesting: false,
    devcontainer: false,
    useAgentBrowser: false,
    stack: { frontend: null, backend: null, database: null, testing: null, srcDirs: [], languages: [] },
  },
  team: ROLES.map((role) => ({ role, model: modelFor(role, "balanced"), variant: null, enabled: true })),
  playbook: {},
}

// --- Security-ledger lane: frigate SECURITY_FINDINGS.md permissions ---

test("frigate frontmatter edit permissions allow SECURITY_FINDINGS.md", async () => {
  const { fillTemplate } = await import("../src/scaffold.js")

  const manifest = {
    project: {
      name: "test-frigate",
      budget: "balanced",
      stack: {},
    },
    team: ROLES.map((role) => ({ role, model: modelFor(role, "balanced"), variant: null, enabled: true })),
  }
  const team = buildTeam(manifest)
  const frigate = team.find((a) => a.role === "security")

  // Read the real prompt template and fill it
  const promptPath = join(process.cwd(), "agents", "security", "prompt.template.md")
  const promptTemplate = readFileSync(promptPath, "utf8")
  const filledPrompt = fillTemplate(promptTemplate, manifest, manifest.project.stack)
  const content = renderAgentFile(frigate, filledPrompt)

  const edit = frontmatterPerms(content)

  assert.strictEqual(edit["armada/ledgers/*/SECURITY_FINDINGS.md"], "allow",
    "frigate must allow SECURITY_FINDINGS.md")
  assert.strictEqual(edit["*"], "deny",
    "frigate must deny *")
})

// --- Skills-integration lane: skill: allow permissions ---

// Roles that must have skill: allow
const SKILL_ROLES = ["orchestrator", "backend-dev", "frontend-dev", "qa"]

// Roles that must NOT have skill rule
const NO_SKILL_ROLES = ["security", "docs", "architect"]

test("commodore, galleon, clipper, corvette frontmatter has skill: allow", () => {
  const team = buildTeam(baseManifest)
  for (const roleKey of SKILL_ROLES) {
    const agent = team.find((a) => a.role === roleKey)
    assert.ok(agent, `agent not found: ${roleKey}`)
    const skill = skillPermFromAgentFile(agent, `prompt for ${roleKey}`)
    assert.strictEqual(skill, "allow", `${roleKey} (${agentNameFor(roleKey)}) must have skill: allow`)
  }
})

test("caravel, bark, frigate frontmatter has no skill rule", () => {
  const team = buildTeam(baseManifest)
  for (const roleKey of NO_SKILL_ROLES) {
    const agent = team.find((a) => a.role === roleKey)
    assert.ok(agent, `agent not found: ${roleKey}`)
    const skill = skillPermFromAgentFile(agent, `prompt for ${roleKey}`)
    assert.strictEqual(skill, undefined, `${roleKey} (${agentNameFor(roleKey)}) must NOT have skill rule`)
  }
})

test("adversary (xebec) has no skill rule", () => {
  const team = buildTeam(baseManifest)
  const agent = team.find((a) => a.role === "adversary")
  assert.ok(agent)
  const skill = skillPermFromAgentFile(agent, "prompt for adversary")
  assert.strictEqual(skill, undefined, "adversary (xebec) must NOT have skill rule")
})
