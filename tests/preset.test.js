import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseManifestYaml } from "../src/manifest.js"
import { parsePresetYaml, applyPreset } from "../src/preset-command.js"

const POWER_YAML = `# power — strongest models on every role (paid)
budget: power

agents:
  orchestrator: { model: openrouter/anthropic/claude-sonnet-4.6 }
  backend-dev: { model: openrouter/z-ai/glm-5.2 }
  frontend-dev: { model: openrouter/minimax/minimax-m3 }
  qa: { model: openrouter/xiaomi/mimo-v2.5 }
  adversary: { model: openrouter/deepseek/deepseek-v4-pro }
  security: { model: openrouter/deepseek/deepseek-v4-pro }
  docs: { model: openrouter/minimax/minimax-m3 }
  architect: { model: openrouter/z-ai/glm-5.2 }
`

const BALANCED_YAML = `# balanced — free workers, paid reviewers (default)
budget: balanced

agents:
  orchestrator: { model: opencode-go/minimax-m3, variant: thinking }
  backend-dev: { model: opencode-go/deepseek-v4-pro }
  frontend-dev: { model: opencode-go/minimax-m3 }
  qa: { model: opencode/mimo-v2.5-free }
  adversary: { model: opencode-go/deepseek-v4-pro }
  security: { model: opencode/big-pickle }
  docs: { model: opencode/deepseek-v4-flash-free }
  architect: { model: opencode/big-pickle }
`

function makeFixtureArmadaYaml(overrides = {}) {
  return `# armada.yaml — opencode-armada manifest (source of truth)
# Regenerate identical config with: armada init --from-armada armada/armada.yaml

project:
  name: "test-persist"
  budget: "${overrides.budget || "balanced"}"
  browserTesting: false
  devcontainer: false
  useAgentBrowser: false
  headless: false
  yolo: false
  requirementsFile: "armada/REQUIREMENTS.md"
  supervision:
    plugin: false
  stack:
    frontend: null
    backend: null
    database: null
    testing: null
    srcDirs: ["src"]
    languages: ["typescript"]

team:
  - role: "orchestrator"
    model: "${overrides.orchModel || "opencode-go/minimax-m3"}"
    fallback: "openrouter/z-ai/glm-5.2"
    enabled: ${overrides.orchEnabled !== false}
  - role: "backend-dev"
    model: "${overrides.beModel || "opencode-go/deepseek-v4-pro"}"
    fallback: "openrouter/deepseek/deepseek-v4-pro"
    enabled: ${overrides.beEnabled !== false}
  - role: "qa"
    model: "${overrides.qaModel || "opencode/mimo-v2.5-free"}"
    fallback: "openrouter/xiaomi/mimo-v2.5"
    enabled: ${overrides.qaEnabled !== false}
  - role: "docs"
    model: "${overrides.docsModel || "opencode/deepseek-v4-flash-free"}"
    fallback: "openrouter/minimax/minimax-m3"
    enabled: ${overrides.docsEnabled !== false}
`
}

function setupFixture(opts = {}) {
  const dir = mkdtempSync(join(tmpdir(), "armada-preset-"))
  const presetsDir = mkdtempSync(join(tmpdir(), "armada-presets-"))
  const armadaDir = join(dir, "armada")
  mkdirSync(armadaDir, { recursive: true })

  const armadaYaml = opts.armadaYaml || makeFixtureArmadaYaml(opts)
  writeFileSync(join(armadaDir, "armada.yaml"), armadaYaml, "utf8")

  // Write preset files into the temp presets dir
  writeFileSync(join(presetsDir, "power.yaml"), POWER_YAML, "utf8")
  writeFileSync(join(presetsDir, "balanced.yaml"), BALANCED_YAML, "utf8")

  return { dir, presetsDir, armadaDir }
}

describe("parsePresetYaml", () => {
  it("parses power preset with all known roles", () => {
    const preset = parsePresetYaml(POWER_YAML)
    assert.strictEqual(preset.budget, "power")
    assert.ok(typeof preset.agents === "object")
    assert.strictEqual(preset.agents.orchestrator.model, "openrouter/anthropic/claude-sonnet-4.6")
    assert.strictEqual(preset.agents["backend-dev"].model, "openrouter/z-ai/glm-5.2")
    assert.strictEqual(preset.agents.qa.model, "openrouter/xiaomi/mimo-v2.5")
    assert.strictEqual(preset.agents.architect.model, "openrouter/z-ai/glm-5.2")
  })

  it("parses a preset with variant", () => {
    const preset = parsePresetYaml(BALANCED_YAML)
    assert.strictEqual(preset.budget, "balanced")
    assert.strictEqual(preset.agents.orchestrator.model, "opencode-go/minimax-m3")
    assert.strictEqual(preset.agents.orchestrator.variant, "thinking")
  })

  it("rejects unknown role in agents", () => {
    const bad = `budget: power\nagents:\n  unknown-role: { model: x }`
    assert.throws(() => parsePresetYaml(bad), /Unknown role/)
  })

  it("rejects missing budget", () => {
    const bad = `agents:\n  orchestrator: { model: x }`
    assert.throws(() => parsePresetYaml(bad), /budget/)
  })

  it("rejects invalid budget value", () => {
    const bad = `budget: mega\nagents:\n  orchestrator: { model: x }`
    assert.throws(() => parsePresetYaml(bad), /budget/)
  })

  it("rejects non-string model", () => {
    const bad = `budget: power\nagents:\n  orchestrator: { model: 123 }`
    assert.throws(() => parsePresetYaml(bad), /must be a non-empty string/)
  })

  it("rejects empty model string", () => {
    const bad = `budget: power\nagents:\n  orchestrator: { model: "" }`
    assert.throws(() => parsePresetYaml(bad), /must be a non-empty string/)
  })

  it("rejects missing agents section", () => {
    const bad = `budget: power\n`
    assert.throws(() => parsePresetYaml(bad), /agents/)
  })

  it("rejects non-object agents section", () => {
    const bad = `budget: power\nagents: [1, 2, 3]`
    assert.throws(() => parsePresetYaml(bad), /agents/)
  })

  it("rejects agent entry that is not an object", () => {
    const bad = `budget: power\nagents:\n  orchestrator: "just a string"`
    assert.throws(() => parsePresetYaml(bad), /must be an object/)
  })

  it("rejects non-string variant", () => {
    const bad = `budget: power\nagents:\n  orchestrator: { model: x, variant: 1 }`
    assert.throws(() => parsePresetYaml(bad), /variant/)
  })
})

describe("applyPreset", () => {
  it("applies power preset and returns changed > 0", () => {
    const { dir, presetsDir } = setupFixture()
    const res = applyPreset(dir, "power", { presetsDir })
    assert.ok(res.changed > 0, "should have changed some entries")
    assert.strictEqual(res.budget, "power")
    assert.ok(res.manifest, "should return manifest")
  })

  it("updates project.budget and per-role model in the manifest", () => {
    const { dir, presetsDir } = setupFixture()
    const res = applyPreset(dir, "power", { presetsDir })
    assert.strictEqual(res.manifest.project.budget, "power")
    const backendDev = res.manifest.team.find((t) => t.role === "backend-dev")
    assert.strictEqual(backendDev.model, "openrouter/z-ai/glm-5.2")
    const orchestrator = res.manifest.team.find((t) => t.role === "orchestrator")
    assert.strictEqual(orchestrator.model, "openrouter/anthropic/claude-sonnet-4.6")
  })

  it("writes the changes to armada.yaml on disk", () => {
    const { dir, presetsDir, armadaDir } = setupFixture()
    applyPreset(dir, "power", { presetsDir })
    const written = readFileSync(join(armadaDir, "armada.yaml"), "utf8")
    const parsed = parseManifestYaml(written)
    assert.strictEqual(parsed.project.budget, "power")
    assert.strictEqual(parsed.team.find((t) => t.role === "orchestrator").model, "openrouter/anthropic/claude-sonnet-4.6")
  })

  it("preserves enabled on every team entry", () => {
    const { dir, presetsDir } = setupFixture({ docsEnabled: false, beEnabled: false })
    const res = applyPreset(dir, "power", { presetsDir })
    const docs = res.manifest.team.find((t) => t.role === "docs")
    assert.strictEqual(docs.enabled, false)
    const be = res.manifest.team.find((t) => t.role === "backend-dev")
    assert.strictEqual(be.enabled, false)
    const orch = res.manifest.team.find((t) => t.role === "orchestrator")
    assert.strictEqual(orch.enabled, true)
  })

  it("preserves fallback on every team entry", () => {
    const { dir, presetsDir } = setupFixture()
    const res = applyPreset(dir, "power", { presetsDir })
    const orch = res.manifest.team.find((t) => t.role === "orchestrator")
    assert.strictEqual(orch.fallback, "openrouter/z-ai/glm-5.2")
    const be = res.manifest.team.find((t) => t.role === "backend-dev")
    assert.strictEqual(be.fallback, "openrouter/deepseek/deepseek-v4-pro")
  })

  it("throws Unknown preset for missing preset file", () => {
    const { dir, presetsDir } = setupFixture()
    assert.throws(
      () => applyPreset(dir, "nonexistent", { presetsDir }),
      /Unknown preset: nonexistent/
    )
  })

  it("round-trips: re-parsed armada.yaml equals returned manifest", () => {
    const { dir, presetsDir, armadaDir } = setupFixture()
    const res = applyPreset(dir, "power", { presetsDir })
    const written = readFileSync(join(armadaDir, "armada.yaml"), "utf8")
    const roundTripped = parseManifestYaml(written)
    assert.strictEqual(roundTripped.project.budget, res.manifest.project.budget)
    assert.strictEqual(roundTripped.project.name, res.manifest.project.name)
    assert.strictEqual(roundTripped.team.length, res.manifest.team.length)
    for (const rt of roundTripped.team) {
      const orig = res.manifest.team.find((t) => t.role === rt.role)
      assert.ok(orig, `role ${rt.role} missing from returned manifest`)
      assert.strictEqual(rt.model, orig.model)
      assert.strictEqual(rt.enabled, orig.enabled)
      assert.strictEqual(rt.fallback, orig.fallback)
    }
  })

  it("disabled roles remain disabled after applyPreset", () => {
    const { dir, presetsDir } = setupFixture({ docsEnabled: false })
    const res = applyPreset(dir, "power", { presetsDir })
    const docs = res.manifest.team.find((t) => t.role === "docs")
    assert.strictEqual(docs.enabled, false)
  })

  it("applies variant from balanced preset to team entries", () => {
    const { dir, presetsDir, armadaDir } = setupFixture()
    applyPreset(dir, "balanced", { presetsDir })
    const written = readFileSync(join(armadaDir, "armada.yaml"), "utf8")
    assert.ok(written.includes("variant"))
  })

  it("does not change entries for roles missing from preset", () => {
    // Create a preset with only orchestrator + backend-dev
    const partialPreset = `budget: free\nagents:\n  orchestrator: { model: opencode-go/hy3 }\n  backend-dev: { model: opencode/deepseek-v4-flash-free }`
    const { dir, presetsDir } = setupFixture()
    writeFileSync(join(presetsDir, "partial.yaml"), partialPreset, "utf8")
    const res = applyPreset(dir, "partial", { presetsDir })
    const qa = res.manifest.team.find((t) => t.role === "qa")
    assert.strictEqual(qa.model, "opencode/mimo-v2.5-free", "qa model should not change")
    const docs = res.manifest.team.find((t) => t.role === "docs")
    assert.strictEqual(docs.model, "opencode/deepseek-v4-flash-free", "docs model should not change")
  })

  it("armada.yaml hexdump persists raw variant to disk", () => {
    const { dir, presetsDir, armadaDir } = setupFixture()
    applyPreset(dir, "balanced", { presetsDir })
    const written = readFileSync(join(armadaDir, "armada.yaml"), "utf8")
    const lines = written.split("\n")
    const orchVariant = lines.find((l) => l.trim().startsWith("variant:"))
    assert.ok(orchVariant, "variant line should exist")
    assert.ok(orchVariant.includes("thinking"), "variant should be 'thinking'")
  })

  it("preserves stack.instructions and custom variant through applyPreset", () => {
    const armadaYaml = `# armada.yaml — opencode-armada manifest (source of truth)
# Regenerate identical config with: armada init --from-armada armada/armada.yaml

project:
  name: "test-instr"
  budget: "balanced"
  browserTesting: false
  devcontainer: false
  useAgentBrowser: false
  headless: false
  yolo: false
  requirementsFile: "armada/REQUIREMENTS.md"
  supervision:
    plugin: false
  stack:
    frontend: null
    backend: null
    database: null
    testing: null
    srcDirs: ["src"]
    languages: ["typescript"]
    instructions: ["CLAUDE.md"]

team:
  - role: "orchestrator"
    model: "opencode-go/minimax-m3"
    fallback: "openrouter/z-ai/glm-5.2"
    variant: "thinking"
    enabled: true
  - role: "backend-dev"
    model: "opencode-go/deepseek-v4-pro"
    fallback: "openrouter/deepseek/deepseek-v4-pro"
    enabled: true
`
    const { dir, presetsDir, armadaDir } = setupFixture({ armadaYaml })
    const res = applyPreset(dir, "power", { presetsDir })
    assert.strictEqual(res.manifest.project.budget, "power")
    const written = readFileSync(join(armadaDir, "armada.yaml"), "utf8")
    const reparsed = parseManifestYaml(written)
    assert.deepStrictEqual(reparsed.project.stack.instructions, ["CLAUDE.md"])
    assert.strictEqual(reparsed.team.find((t) => t.role === "orchestrator").variant, "thinking")
    assert.strictEqual(reparsed.team.find((t) => t.role === "orchestrator").model, "openrouter/anthropic/claude-sonnet-4.6")
    assert.strictEqual(reparsed.team.find((t) => t.role === "backend-dev").model, "openrouter/z-ai/glm-5.2")
  })

  it("throws when armada.yaml is missing in target dir", () => {
    const emptyDir = mkdtempSync(join(tmpdir(), "armada-empty-"))
    const presetsDir = mkdtempSync(join(tmpdir(), "armada-presets-"))
    writeFileSync(join(presetsDir, "power.yaml"), POWER_YAML, "utf8")
    assert.throws(
      () => applyPreset(emptyDir, "power", { presetsDir }),
      /armada.yaml not found/
    )
  })
})
