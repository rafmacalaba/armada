import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, rmSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import YAML from "yaml"

import { ROLES, modelFor } from "../src/model-catalog.js"

function parseFrontmatter(frontmatterYaml) {
  return YAML.parse(frontmatterYaml)
}

function frontmatterPerms(agentContent) {
  const fm = agentContent.slice(agentContent.indexOf("---") + 3, agentContent.indexOf("---\n", 3))
  const cfg = parseFrontmatter(fm)
  return cfg.permission?.edit ?? {}
}

test("frigate frontmatter edit permissions allow SECURITY_FINDINGS.md", async () => {
  // Defer scaffold import so fillTemplate machinery is ready
  const { fillTemplate } = await import("../src/scaffold.js")
  const { buildTeam, renderAgentFile } = await import("../src/generator.js")

  // Build frigate agent directly (no I/O needed for frontmatter test)
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
  const { readFileSync } = await import("node:fs")
  const { join } = await import("node:path")
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
