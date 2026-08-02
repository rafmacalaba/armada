import { test } from "node:test"
import assert from "node:assert"
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
