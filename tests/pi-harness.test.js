import { test } from "node:test"
import assert from "node:assert"

import { buildTeam, renderPiAgentFile, renderManifestYaml } from "../src/generator.js"
import { parseManifestYaml } from "../src/manifest.js"
import { scaffold, uninstall } from "../src/scaffold.js"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { agentNameFor } from "../src/role-display.js"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

function makeManifest(dir, overrides = {}) {
  return {
    targetDir: dir,
    project: {
      name: "pi-harness-test",
      budget: "balanced",
      browserTesting: false,
      devcontainer: false,
      useAgentBrowser: false,
      stack: { srcDirs: ["src"], languages: ["typescript"] },
      ...overrides,
    },
    team: ROLES.map((role) => ({ role, model: modelFor(role, "balanced"), variant: null, enabled: true })),
    playbook: {},
  }
}

test("parseManifestYaml defaults harnesses to opencode", () => {
  const manifest = parseManifestYaml("project:\n  name: t\nteam:\n  - role: qa\n    model: openrouter/xiaomi/mimo-v2.5\n    enabled: true\n")
  assert.deepStrictEqual(manifest.project.harnesses, ["opencode"])
})

test("parseManifestYaml accepts and dedupes harnesses", () => {
  const manifest = parseManifestYaml(
    "project:\n  name: t\n  harnesses: [pi, opencode, pi]\nteam:\n  - role: qa\n    model: openrouter/xiaomi/mimo-v2.5\n    enabled: true\n",
  )
  assert.deepStrictEqual(manifest.project.harnesses, ["pi", "opencode"])
})

test("parseManifestYaml rejects invalid harnesses", () => {
  assert.throws(
    () => parseManifestYaml("project:\n  name: t\n  harnesses: [codex]\nteam:\n  - role: qa\n    model: openrouter/xiaomi/mimo-v2.5\n    enabled: true\n"),
    /harnesses/,
  )
  assert.throws(
    () => parseManifestYaml("project:\n  name: t\n  harnesses: []\nteam:\n  - role: qa\n    model: openrouter/xiaomi/mimo-v2.5\n    enabled: true\n"),
    /harnesses/,
  )
})

test("renderPiAgentFile emits pi frontmatter with openrouter model only", () => {
  const team = buildTeam(makeManifest("."))
  const backend = team.find((a) => a.role === "backend-dev")
  const file = renderPiAgentFile(backend, "# Galleon body\n\nDo backend work.")
  assert.match(file, /^---\n/)
  assert.match(file, new RegExp(`name: ${agentNameFor("backend-dev")}`))
  assert.match(file, /description: Galleon — Backend implementation/)
  // opencode-* model IDs do not exist in pi; openrouter fallback does not
  // apply here because primary is opencode-go — model must be omitted.
  assert.ok(!/^model:/m.test(file), "omits opencode-only model IDs")
  assert.match(file, /# Galleon body/)
})

test("renderPiAgentFile keeps openrouter model and appends edit boundaries", () => {
  const team = buildTeam(makeManifest("."))
  const qa = team.find((a) => a.role === "qa")
  qa.model = "openrouter/xiaomi/mimo-v2.5"
  const file = renderPiAgentFile(qa, "QA body.")
  assert.match(file, /^model: openrouter\/xiaomi\/mimo-v2\.5$/m)
  // qa edit allowlist becomes a prompt-level boundary (pi has no SDK globs)
  assert.match(file, /# Edit boundaries/)
  assert.match(file, /armada\/e2e\/\*/)
  assert.match(file, /QA body\./)
})

test("renderManifestYaml serializes harnesses", () => {
  const manifest = makeManifest(".", { harnesses: ["opencode", "pi"] })
  const yaml = renderManifestYaml(manifest, buildTeam(manifest))
  assert.match(yaml, /harnesses: \["opencode","pi"\]/)
})

test("scaffold writes .pi/agents when pi harness enabled, not otherwise", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-pi-harness-"))
  try {
    const withPi = makeManifest(dir, { harnesses: ["opencode", "pi"] })
    scaffold(withPi, withPi.project.stack)
    const qaFile = join(dir, ".pi", "agents", `${agentNameFor("qa")}.md`)
    assert.ok(existsSync(qaFile), "pi agent file written")
    const content = readFileSync(qaFile, "utf8")
    assert.match(content, /^name: corvette$/m)
    assert.match(content, /description: Corvette — Quality assurance/)

    const withoutPi = makeManifest(dir)
    withoutPi.project.harnesses = undefined
    const dir2 = mkdtempSync(join(tmpdir(), "armada-pi-harness-"))
    try {
      scaffold(withoutPi, withoutPi.project.stack)
      assert.ok(!existsSync(join(dir2, ".pi", "agents")), "no .pi/agents without pi harness")
    } finally {
      rmSync(dir2, { recursive: true, force: true })
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("uninstall removes pi agent files", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-pi-harness-"))
  try {
    const manifest = makeManifest(dir, { harnesses: ["pi"] })
    scaffold(manifest, manifest.project.stack)
    assert.ok(existsSync(join(dir, ".pi", "agents", `${agentNameFor("qa")}.md`)))
    uninstall(manifest, {})
    assert.ok(!existsSync(join(dir, ".pi", "agents", `${agentNameFor("qa")}.md`)))
    assert.ok(!existsSync(join(dir, ".pi", "agents")))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
