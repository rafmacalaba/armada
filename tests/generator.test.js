import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { ROLES, CATALOG, modelFor, fallbackFor, BUDGETS } from "../src/model-catalog.js"
import { buildTeam, renderSlimJsonc, renderOpenCodeJson, renderAgentsMd, renderRequirementsMd, renderManifestYaml } from "../src/generator.js"
import { detectStack, formatStack } from "../src/stack-detect.js"

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

test("catalog covers every role", () => {
  assert.deepStrictEqual(ROLES, ["orchestrator", "backend-dev", "frontend-dev", "qa", "adversary", "security", "docs", "architect"])
  for (const r of ROLES) {
    assert.ok(CATALOG[r].primary, `${r}.primary`)
    assert.ok(CATALOG[r].fallback, `${r}.fallback`)
    assert.ok(CATALOG[r].free, `${r}.free`)
    assert.ok(CATALOG[r].power, `${r}.power`)
  }
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

test("buildTeam non-headless keeps orchestrator bash ask", () => {
  const team = buildTeam(baseManifest)
  const orch = team.find((a) => a.role === "orchestrator")
  assert.strictEqual(orch.permissions.bash["*"], "ask")
})

test("buildTeam headless loosens orchestrator bash to allow", () => {
  const m = structuredClone(baseManifest)
  m.project.headless = true
  const team = buildTeam(m)
  const orch = team.find((a) => a.role === "orchestrator")
  assert.deepStrictEqual(orch.permissions.bash, { "*": "allow" })
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

test("renderOpenCodeJson uses orchestrator model + deny external_directory", () => {
  const team = buildTeam(baseManifest)
  const cfg = renderOpenCodeJson(baseManifest, team)
  assert.strictEqual(cfg.model, modelFor("orchestrator", "balanced"))
  assert.strictEqual(cfg.permission.external_directory, "deny")
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
  assert.match(yaml, /name: test-project/)
  assert.match(yaml, /budget: balanced/)
  assert.match(yaml, /role: backend-dev/)
})

test("stack detect parses package.json and pyproject", async (t) => {
  await t.test("node/next", () => {
    const dir = makeTempRepo({
      "package.json": JSON.stringify({ dependencies: { next: "15", react: "19", jest: "29" } }),
    })
    const s = detectStack(dir)
    assert.strictEqual(s.frontend, "nextjs")
    assert.strictEqual(s.testing, "jest")
    assert.ok(s.languages.includes("typescript"))
  })
  await t.test("python/fastapi", () => {
    const dir = makeTempRepo({ "requirements.txt": "fastapi\nsqlalchemy\npytest" })
    const s = detectStack(dir)
    assert.strictEqual(s.backend, "python-fastapi")
    assert.strictEqual(s.testing, "pytest")
    assert.strictEqual(s.database, "sqlalchemy")
  })
  await t.test("empty repo -> minimal", () => {
    const dir = makeTempRepo({})
    const s = detectStack(dir)
    assert.strictEqual(formatStack(s).split("|").length, 1)
  })
})

function makeTempRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), "armada-test-"))
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel)
    mkdirSync(join(dir, rel.split("/").slice(0, -1).join("/")), { recursive: true })
    writeFileSync(p, content, "utf8")
  }
  return dir
}
