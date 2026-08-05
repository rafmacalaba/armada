import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runCli } from "./helpers.js"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { buildTeam, renderManifestYaml } from "../src/generator.js"

function makeManifestYaml() {
  const m = {
    targetDir: ".",
    project: {
      name: "restart-test",
      budget: "free",
      browserTesting: false,
      devcontainer: false,
      useAgentBrowser: false,
      stack: {},
    },
    team: ROLES.map((r) => ({
      role: r,
      model: modelFor(r, "free"),
      fallback: null,
      enabled: true,
    })),
  }
  return renderManifestYaml(m, buildTeam(m))
}

// DEF-001: --restart is documented in init --help
test("init --help documents --restart", async () => {
  const r = await runCli(["init", "--help"])
  assert.match(r.stdout, /--restart/)
})

// DEF-001: --restart is recognized and forces re-scaffold of armada-owned files
test("init --restart overwrites armada-owned agent files", async () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-restart-"))

  // Write an armada.yaml manifest
  const manifestContent = makeManifestYaml()
  writeFileSync(join(dir, "armada.yaml"), manifestContent, "utf8")

  // Pre-create an agent file with known content
  const agentDir = join(dir, ".opencode", "agent")
  mkdirSync(agentDir, { recursive: true })
  writeFileSync(join(agentDir, "galleon.md"), "---\nold-content\n---", "utf8")

  // Run init with --restart
  const r = await runCli(["init", "--from-armada", "armada.yaml", "--restart", "--target", dir], { cwd: dir })

  assert.strictEqual(r.code, 0)
  // Agent file should be overwritten (not old content)
  const agentContent = readFileSync(join(agentDir, "galleon.md"), "utf8")
  assert.ok(!agentContent.includes("old-content"), "agent file should be overwritten, but old content remains")
  assert.match(agentContent, /backend/)
})

// DEF-001: without --restart, opencode.json (user file) is preserved
test("init without --restart preserves opencode.json", async () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-norestart-"))

  const manifestContent = makeManifestYaml()
  writeFileSync(join(dir, "armada.yaml"), manifestContent, "utf8")

  // First init: creates opencode.json
  const r1 = await runCli(["init", "--from-armada", "armada.yaml", "--target", dir], { cwd: dir })
  assert.strictEqual(r1.code, 0)
  const firstContent = readFileSync(join(dir, "opencode.json"), "utf8")

  // Modify opencode.json to simulate user edit (replace the model field name)
  const modified = firstContent.replace(/"model":\s*"[^"]+"/, '"model": "custom-model-id"')
  writeFileSync(join(dir, "opencode.json"), modified, "utf8")

  // Second init without --restart: should preserve user's opencode.json
  const r2 = await runCli(["init", "--from-armada", "armada.yaml", "--target", dir], { cwd: dir })
  assert.strictEqual(r2.code, 0)
  const preservedContent = readFileSync(join(dir, "opencode.json"), "utf8")
  assert.ok(preservedContent.includes("custom-model-id"), "opencode.json should be preserved without --restart")
})

// DEF-001: with --restart, opencode.json is overwritten
test("init with --restart overwrites opencode.json", async () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-restart-json-"))

  const manifestContent = makeManifestYaml()
  writeFileSync(join(dir, "armada.yaml"), manifestContent, "utf8")

  // First init
  const r1 = await runCli(["init", "--from-armada", "armada.yaml", "--target", dir], { cwd: dir })
  assert.strictEqual(r1.code, 0)

  // Modify opencode.json
  const firstContent = readFileSync(join(dir, "opencode.json"), "utf8")
  const modified = firstContent.replace(/"model":\s*"[^"]+"/, '"model": "custom-model-id"')
  writeFileSync(join(dir, "opencode.json"), modified, "utf8")

  // Second init with --restart: should overwrite opencode.json
  const r2 = await runCli(["init", "--from-armada", "armada.yaml", "--restart", "--target", dir], { cwd: dir })
  assert.strictEqual(r2.code, 0)
  const overwrittenContent = readFileSync(join(dir, "opencode.json"), "utf8")
  assert.ok(!overwrittenContent.includes("custom-model-id"), "opencode.json should be overwritten with --restart")
})
