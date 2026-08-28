import { test } from "node:test"
import assert from "node:assert"

import { buildTeam, renderPiAgentFile, renderPiSettings, renderManifestYaml } from "../src/generator.js"
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

test("renderPiAgentFile maps roles to their OpenRouter model", () => {
  const team = buildTeam(makeManifest("."))
  const backend = team.find((a) => a.role === "backend-dev")
  // Primary is opencode-go (unusable in pi); the catalog fallback is OpenRouter.
  assert.strictEqual(backend.model, "opencode-go/deepseek-v4-pro")
  assert.strictEqual(backend.fallback, "openrouter/deepseek/deepseek-v4-pro")
  const file = renderPiAgentFile(backend, "# Galleon body\n\nDo backend work.")
  assert.match(file, /^model: openrouter\/deepseek\/deepseek-v4-pro$/m)
  assert.match(file, new RegExp(`name: ${agentNameFor("backend-dev")}`))
  assert.match(file, /description: Galleon — Backend implementation/)
  assert.match(file, /# Galleon body/)
})

test("renderPiAgentFile keeps explicit openrouter model and appends edit boundaries", () => {
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

test("renderPiSettings defaults orchestrator session to OpenRouter", () => {
  const team = buildTeam(makeManifest("."))
  const settings = renderPiSettings(makeManifest("."), team)
  // orchestrator balanced: opencode-go/minimax-m3 -> openrouter fallback
  assert.deepStrictEqual(settings, {
    defaultProvider: "openrouter",
    defaultModel: "openrouter/z-ai/glm-5.2",
  })
  // No openrouter model anywhere -> no settings written
  const custom = team.map((a) => ({ ...a, model: "opencode/big-pickle", fallback: null }))
  assert.strictEqual(renderPiSettings(makeManifest("."), custom), null)
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
    // Project settings default the whole fleet (orchestrator session) to OpenRouter
    const settings = JSON.parse(readFileSync(join(dir, ".pi", "settings.json"), "utf8"))
    assert.strictEqual(settings.defaultProvider, "openrouter")
    assert.strictEqual(settings.defaultModel, "openrouter/z-ai/glm-5.2")

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

test("uninstall removes pi agent files and settings model keys", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-pi-harness-"))
  try {
    const manifest = makeManifest(dir, { harnesses: ["pi"] })
    scaffold(manifest, manifest.project.stack)
    assert.ok(existsSync(join(dir, ".pi", "agents", `${agentNameFor("qa")}.md`)))
    const settingsPath = join(dir, ".pi", "settings.json")
    assert.ok(existsSync(settingsPath))
    uninstall(manifest, {})
    assert.ok(!existsSync(join(dir, ".pi", "agents", `${agentNameFor("qa")}.md`)))
    assert.ok(!existsSync(join(dir, ".pi", "agents")))
    // armada-owned model keys removed; file removed when nothing else remains
    assert.ok(!existsSync(settingsPath))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
