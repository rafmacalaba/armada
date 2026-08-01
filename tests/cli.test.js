import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { buildTeam, renderManifestYaml } from "../src/generator.js"
import { runCli, makeTempRepo, makeBin } from "./helpers.js"

function manifestYaml() {
  const m = { project: { name: "e2e", budget: "free", browserTesting: false, devcontainer: false,
    useAgentBrowser: false, stack: {} },
    team: ROLES.map((r) => ({ role: r, model: modelFor(r, "free"), fallback: null, enabled: true })) }
  return renderManifestYaml(m, buildTeam(m))
}

test("ping returns ok", async () => {
  const r = await runCli(["ping"])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /armada ok/)
})

test("init --from-armada scaffolds full team", async () => {
  const dir = makeTempRepo({ "armada.yaml": manifestYaml() })
  const r = await runCli(["init", "--from-armada", "armada.yaml"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  for (const f of ["armada.yaml", "opencode.json", "AGENTS.md", "REQUIREMENTS.md",
    ".opencode/oh-my-opencode-slim.jsonc", ".opencode/commands/armada.md"])
    assert.ok(existsSync(join(dir, f)), `missing ${f}`)
})

test("init --dry-run writes nothing", async () => {
  const dir = makeTempRepo({ "armada.yaml": manifestYaml() })
  const r = await runCli(["init", "--from-armada", "armada.yaml", "--dry-run"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /dry-run/)
  assert.ok(!existsSync(join(dir, ".opencode")))
})

test("init --yes --budget free --no-browser works without TTY", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["init", "--yes", "--budget", "free", "--no-browser"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  const yaml = readFileSync(join(dir, "armada.yaml"), "utf8")
  assert.match(yaml, /budget: free/)
  assert.match(yaml, /browserTesting: false/)
})

test("init --from-armada missing manifest exits 1", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["init", "--from-armada", "nope.yaml"], { cwd: dir })
  assert.strictEqual(r.code, 1)
})

test("models --refresh merges availability via fake opencode", async () => {
  const binDir = makeBin({ opencode: "#!/bin/sh\necho \"opencode/big-pickle\nopencode/mimo-v2.5-free\"\n" })
  const cache = join(makeTempRepo({}), "cache.json")
  const r = await runCli(["models", "--refresh", "--cache", cache], { env: { PATH: `${binDir}:${process.env.PATH}` } })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /✓/)
  assert.match(r.stdout, /✗/)
})

test("uninstall CLI removes generated files, keeps user files", async () => {
  const dir = makeTempRepo({ "armada.yaml": manifestYaml(), "AGENTS.md": "# custom\n" })
  await runCli(["init", "--from-armada", "armada.yaml"], { cwd: dir })
  const r = await runCli(["uninstall"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  assert.ok(!existsSync(join(dir, "armada.yaml")))
  assert.ok(!existsSync(join(dir, ".opencode")))
  assert.strictEqual(readFileSync(join(dir, "AGENTS.md"), "utf8"), "# custom\n")
  assert.ok(existsSync(join(dir, "opencode.json")))
})

test("uninstall CLI --all also removes generated user-facing files", async () => {
  const dir = makeTempRepo({ "armada.yaml": manifestYaml() })
  await runCli(["init", "--from-armada", "armada.yaml"], { cwd: dir })
  const r = await runCli(["uninstall", "--all"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  assert.ok(!existsSync(join(dir, "AGENTS.md")))
  assert.ok(!existsSync(join(dir, "opencode.json")))
  assert.ok(!existsSync(join(dir, "armada.yaml")))
})

test("uninstall CLI --dry-run removes nothing", async () => {
  const dir = makeTempRepo({ "armada.yaml": manifestYaml() })
  await runCli(["init", "--from-armada", "armada.yaml"], { cwd: dir })
  const r = await runCli(["uninstall", "--dry-run"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /dry-run/)
  assert.ok(existsSync(join(dir, ".opencode")))
  assert.ok(existsSync(join(dir, "armada.yaml")))
})

test("uninstall CLI missing manifest exits 1", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["uninstall", "--from-armada", "nope.yaml"], { cwd: dir })
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /Manifest not found/)
})
