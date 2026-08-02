import { test } from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { ROLES, CATALOG, modelFor, fallbackFor, BUDGETS } from "../src/model-catalog.js"
import { buildTeam, renderSlimJsonc, renderOpenCodeJson, renderAgentsMd, renderRequirementsMd, renderManifestYaml, renderArmadaCommand } from "../src/generator.js"
import { parseManifestYaml } from "../src/manifest.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

const baseManifest = {
  project: {
    name: "test-project",
    budget: "balanced",
    browserTesting: true,
    devcontainer: true,
    useAgentBrowser: true,
    stack: { frontend: "react", backend: "node-express", database: "postgres", testing: "playwright", srcDirs: ["src"], languages: ["typescript"] },
  },
  team: ROLES.map((role) => ({ role, model: modelFor(role, "balanced"), variant: null, enabled: true })),
  playbook: {},
}

test("catalog has expected model IDs per role", () => {
  assert.deepStrictEqual(ROLES, ["orchestrator", "backend-dev", "frontend-dev", "qa", "adversary", "security", "docs", "architect"])
  assert.deepStrictEqual(
    Object.fromEntries(ROLES.map((r) => [r, { primary: CATALOG[r].primary, fallback: CATALOG[r].fallback, free: CATALOG[r].free, power: CATALOG[r].power }])),
    {
      orchestrator: { primary: "opencode-go/minimax-m3", fallback: "openrouter/z-ai/glm-5.2", free: "opencode-go/hy3", power: "openrouter/anthropic/claude-sonnet-4.6" },
      "backend-dev": { primary: "opencode-go/deepseek-v4-pro", fallback: "openrouter/deepseek/deepseek-v4-pro", free: "opencode/deepseek-v4-flash-free", power: "openrouter/z-ai/glm-5.2" },
      "frontend-dev": { primary: "opencode-go/minimax-m3", fallback: "openrouter/minimax/minimax-m3", free: "opencode/mimo-v2.5-free", power: "openrouter/minimax/minimax-m3" },
      qa: { primary: "opencode/mimo-v2.5-free", fallback: "openrouter/xiaomi/mimo-v2.5", free: "opencode/mimo-v2.5-free", power: "openrouter/xiaomi/mimo-v2.5" },
      adversary: { primary: "opencode-go/deepseek-v4-pro", fallback: "openrouter/deepseek/deepseek-v4-pro", free: "opencode/deepseek-v4-flash-free", power: "openrouter/deepseek/deepseek-v4-pro" },
      security: { primary: "opencode/big-pickle", fallback: "openrouter/deepseek/deepseek-v4-pro", free: "opencode/big-pickle", power: "openrouter/deepseek/deepseek-v4-pro" },
      docs: { primary: "opencode/deepseek-v4-flash-free", fallback: "openrouter/minimax/minimax-m3", free: "opencode/deepseek-v4-flash-free", power: "openrouter/minimax/minimax-m3" },
      architect: { primary: "opencode/big-pickle", fallback: "openrouter/z-ai/glm-5.2", free: "opencode/big-pickle", power: "openrouter/z-ai/glm-5.2" },
    }
  )
})

test("every catalog model exists on live providers (fixture)", () => {
  // Fixture captured from `opencode models` on the user's providers. Regenerate
  // with: opencode models > tests/fixtures/live-models.txt
  // Guards against catalog drift — a model ID that doesn't exist on a live
  // provider breaks every team that scaffolds with that budget tier.
  const live = new Set(
    readFileSync(join(__dirname, "fixtures", "live-models.txt"), "utf8")
      .split("\n").map((s) => s.trim()).filter(Boolean)
  )
  const missing = []
  for (const r of ROLES) {
    const e = CATALOG[r]
    for (const field of ["primary", "fallback", "free", "power"]) {
      const id = e[field]
      if (id && !live.has(id)) missing.push(`${r}.${field}: ${id}`)
    }
  }
  assert.deepStrictEqual(missing, [], "catalog entries not available on live providers")
})

test("modelFor respects budget", () => {
  assert.notStrictEqual(modelFor("orchestrator", "free"), modelFor("orchestrator", "power"))
  assert.strictEqual(modelFor("qa", "free"), "opencode/mimo-v2.5-free")
})

test("buildTeam includes all roles with permissions", () => {
  const team = buildTeam(baseManifest)
  assert.strictEqual(team.length, ROLES.length)
  const qa = team.find((a) => a.role === "qa")
  assert.strictEqual(qa.permissions.edit["*"], "deny")
  assert.strictEqual(qa.permissions.edit["e2e/*"], "allow")
})

test("buildTeam honors manifest per-role model, variant, fallback", () => {
  const m = structuredClone(baseManifest)
  m.team = ROLES.map((role) => ({
    role,
    model: role === "backend-dev" ? "custom/model" : modelFor(role, "balanced"),
    variant: role === "backend-dev" ? "thinking" : null,
    fallback: role === "backend-dev" ? "custom/fallback" : fallbackFor(role),
    enabled: true,
  }))
  const team = buildTeam(m)
  const backend = team.find((a) => a.role === "backend-dev")
  assert.strictEqual(backend.model, "custom/model")
  assert.strictEqual(backend.variant, "thinking")
  assert.strictEqual(backend.fallback, "custom/fallback")
  const orchestrator = team.find((a) => a.role === "orchestrator")
  assert.strictEqual(orchestrator.model, modelFor("orchestrator", "balanced"))
})

test("buildTeam non-headless keeps orchestrator bash ask", () => {
  const team = buildTeam(baseManifest)
  const orch = team.find((a) => a.role === "orchestrator")
  assert.strictEqual(orch.permissions.bash["*"], "ask")
})

test("buildTeam disabled role is reflected in enabled flag", () => {
  const m = structuredClone(baseManifest)
  m.team = m.team.map((t) => ({ ...t, enabled: t.role !== "qa" }))
  const team = buildTeam(m)
  const qa = team.find((a) => a.role === "qa")
  assert.strictEqual(qa.enabled, false)
  const backend = team.find((a) => a.role === "backend-dev")
  assert.strictEqual(backend.enabled, true)
})

test("buildTeam browser false path leaves browser false", () => {
  const m = structuredClone(baseManifest)
  m.project.browserTesting = false
  m.project.useAgentBrowser = false
  const team = buildTeam(m)
  for (const a of team) assert.strictEqual(a.browser, false)
})

test("buildTeam headless scopes orchestrator bash to git and read", () => {
  const m = structuredClone(baseManifest)
  m.project.headless = true
  const team = buildTeam(m)
  const orch = team.find((a) => a.role === "orchestrator")
  assert.strictEqual(orch.permissions.bash["*"], "deny")
  assert.strictEqual(orch.permissions.bash["git status*"], "allow")
  assert.strictEqual(orch.permissions.bash["cat*"], "allow")
  const qa = team.find((a) => a.role === "qa")
  assert.strictEqual(qa.permissions.edit["*"], "deny", "other role boundaries unchanged")
})

test("renderManifestYaml emits headless flag", () => {
  const m = structuredClone(baseManifest)
  m.project.headless = true
  const yaml = renderManifestYaml(m, buildTeam(m))
  assert.match(yaml, /headless: true/)
})

test("slim jsonc is valid JSONC with preset", () => {
  const team = buildTeam(baseManifest)
  const out = renderSlimJsonc(baseManifest, team)
  assert.match(out, /"preset": "balanced"/)
  assert.match(out, /"backgroundJobs"/)
  // no template placeholders left dangling
  assert.ok(!/\{[a-z_]+\}/.test(out), "no dangling placeholders")
})

test("slim jsonc marks orchestrator with armada-orchestrator displayName", () => {
  const team = buildTeam(baseManifest)
  const out = renderSlimJsonc(baseManifest, team)
  const stripped = out.replace(/^\s*\/\/.*$/gm, "").trim()
  const cfg = JSON.parse(stripped)
  assert.strictEqual(cfg.presets.balanced.orchestrator.displayName, "armada-orchestrator")
})

test("renderOpenCodeJson uses orchestrator model + deny external_directory", () => {
  const team = buildTeam(baseManifest)
  const cfg = renderOpenCodeJson(baseManifest, team)
  assert.strictEqual(cfg.model, modelFor("orchestrator", "balanced"))
  assert.strictEqual(cfg.permission.external_directory, "deny")
  assert.strictEqual(cfg.permission.edit, undefined)
  assert.strictEqual(cfg.permission.bash, undefined)
})

test("renderOpenCodeJson model follows budget tier", () => {
  const m = structuredClone(baseManifest)
  m.project.budget = "free"
  const team = buildTeam(m)
  const cfg = renderOpenCodeJson(m, team)
  assert.strictEqual(cfg.model, modelFor("orchestrator", "free"))
})

test("AGENTS.md playbook mentions ledger and roles", () => {
  const team = buildTeam(baseManifest)
  const md = renderAgentsMd(baseManifest, team)
  assert.match(md, /DEFECTS\.md/)
  assert.match(md, /ADVERSARIAL_REVIEW\.md/)
  assert.match(md, /only qa closes it|qa closes it/)
  assert.match(md, /backend-dev/)
})

test("manifest round-trips through renderManifestYaml", () => {
  const team = buildTeam(baseManifest)
  const yaml = renderManifestYaml(baseManifest, team)
  assert.match(yaml, /name: "test-project"/)
  assert.match(yaml, /budget: "balanced"/)
  assert.match(yaml, /role: "backend-dev"/)
})

test("renderAgentsMd references custom requirements file", () => {
  const m = structuredClone(baseManifest)
  m.project.requirementsFile = "REQUIREMENTS-admin.md"
  const md = renderAgentsMd(m, buildTeam(m))
  assert.match(md, /REQUIREMENTS-admin\.md/)
})

test("renderManifestYaml emits requirementsFile", () => {
  const m = structuredClone(baseManifest)
  m.project.requirementsFile = "REQUIREMENTS-admin.md"
  const yaml = renderManifestYaml(m, buildTeam(m))
  assert.match(yaml, /requirementsFile: "REQUIREMENTS-admin\.md"/)
})

test("renderManifestYaml quotes scalars to survive round-trip", () => {
  const m = structuredClone(baseManifest)
  m.project.name = "weird\"name\n"
  m.project.requirementsFile = "REQUIREMENTS-admin.md"
  const yaml = renderManifestYaml(m, buildTeam(m))
  assert.doesNotThrow(() => parseManifestYaml(yaml))
  const reparsed = parseManifestYaml(yaml)
  assert.strictEqual(reparsed.project.name, "weird\"name\n")
  assert.strictEqual(reparsed.project.requirementsFile, "REQUIREMENTS-admin.md")
})

test("renderRequirementsMd invites co-writing the contract", () => {
  const md = renderRequirementsMd(baseManifest)
  assert.match(md, /Co-write this with the orchestrator/)
  assert.match(md, /--requirements <file>/)
})

test("renderRequirementsMd phases declare dependencies for parallel run", () => {
  const md = renderRequirementsMd(baseManifest)
  assert.match(md, /\*\*Depends on:\*\* none/)
  assert.match(md, /run in parallel as background subagents/)
})

test("renderAgentsMd phase gates are dependency-driven", () => {
  const md = renderAgentsMd(baseManifest, buildTeam(baseManifest))
  assert.match(md, /starts as soon as the phases it depends on have passed/i)
  assert.ok(!/Only then does the next phase start/i.test(md), "no rigid sequential gate wording")
})

test("renderArmadaCommand lives in generator.js and is pure", () => {
  const md = renderArmadaCommand()
  assert.match(md, /armada init --from-armada/)
  assert.match(md, /---/)
})
