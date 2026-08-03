import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, readFileSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { scaffold } from "../src/scaffold.js"
import { parseManifestYaml } from "../src/manifest.js"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { buildTeam, renderManifestYaml } from "../src/generator.js"

function manifest(dir) {
  const m = { targetDir: dir, project: { name: "rt", budget: "power", browserTesting: true,
    devcontainer: true, useAgentBrowser: true,
    stack: { frontend: "nextjs", backend: "python-fastapi", database: "postgres", testing: "playwright",
      srcDirs: ["src", "backend"], languages: ["typescript", "python"] } },
    team: ROLES.map((r) => ({ role: r, model: modelFor(r, "power"), fallback: null, enabled: true })) }
  return { m, yaml: renderManifestYaml(m, buildTeam(m)) }
}

function listFiles(dir) {
  const out = []
  const walk = (p) => {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      const f = join(p, e.name)
      if (e.isDirectory()) walk(f)
      else out.push(f.slice(dir.length + 1))
    }
  }
  walk(dir)
  return out.sort()
}

test("variant survives parse -> render -> parse round-trip", () => {
  const m = {
    targetDir: "/tmp",
    project: { name: "rt-variant", budget: "balanced", browserTesting: false,
      devcontainer: false, useAgentBrowser: false,
      stack: { frontend: "react", backend: "node-express", database: null, testing: null,
        srcDirs: ["src"], languages: ["typescript"] } },
    team: ROLES.map((r) => ({ role: r, model: modelFor(r, "balanced"), fallback: null,
      variant: r === "backend-dev" ? "thinking" : null, enabled: true })),
  }
  const yaml = renderManifestYaml(m, buildTeam(m))
  const parsed = parseManifestYaml(yaml)
  assert.strictEqual(parsed.team.find((t) => t.role === "backend-dev").variant, "thinking")
  assert.strictEqual(parsed.team.find((t) => t.role === "qa").variant, null)
  // second pass is stable: re-render from the parsed manifest keeps the variant
  const yaml2 = renderManifestYaml(parsed, buildTeam(parsed))
  const parsed2 = parseManifestYaml(yaml2)
  assert.strictEqual(parsed2.team.find((t) => t.role === "backend-dev").variant, "thinking")
})

test("init -> parse -> init produces identical file tree and contents", () => {
  const d1 = mkdtempSync(join(tmpdir(), "armada-rt-"))
  const { m, yaml } = manifest(d1)
  scaffold(m, m.project.stack)
  const parsed = parseManifestYaml(yaml)
  const d2 = mkdtempSync(join(tmpdir(), "armada-rt-"))
  scaffold({ ...parsed, targetDir: d2 }, parsed.project.stack)
  const a = listFiles(d1)
  const b = listFiles(d2)
  assert.deepStrictEqual(a, b)
  for (const f of a) {
    const ra = readFileSync(join(d1, f), "utf8")
    const rb = readFileSync(join(d2, f), "utf8")
    assert.strictEqual(ra, rb, `differs: ${f}`)
  }
})
