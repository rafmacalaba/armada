/**
 * P4 - New repo flow.
 *
 * Create a new project from `armada new` in a temp directory, run init,
 * doctor, and uninstall to validate the new-project lifecycle.
 */

import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

import { makeBin, runCli } from "../../../tests/helpers.js"
import { ROLES, modelFor } from "../../../src/model-catalog.js"
import { agentNameFor } from "../../../src/role-display.js"

// Mock opencode binary
const MOCK_OPENCODE = `#!/bin/sh
case "$1" in
  --version) echo "1.18.11" ;;
  providers) echo "openrouter" ;;
  auth) echo "openrouter" ;;
  *) echo "ok" ;;
esac
`

test("P4 new repo: armada new creates project with expected structure", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "armada-new-workspace-"))
  // Initialize git so armada new works
  spawnSync("git", ["init", "-b", "main"], { cwd: workspace, encoding: "utf8" })
  spawnSync("git", ["config", "user.email", "t@t"], { cwd: workspace, encoding: "utf8" })
  spawnSync("git", ["config", "user.name", "t"], { cwd: workspace, encoding: "utf8" })

  const r = await runCli(["new", "my-new-app", "--yes"], { cwd: workspace })
  assert.strictEqual(r.code, 0, `armada new should succeed: ${r.stderr}`)
  assert.match(r.stdout, /Created my-new-app/)

  const projectDir = join(workspace, "my-new-app")
  assert.ok(existsSync(projectDir), "project directory should exist")
  assert.ok(existsSync(join(projectDir, "armada/armada.yaml")), "armada.yaml should exist")
  assert.ok(existsSync(join(projectDir, "AGENTS.md")), "AGENTS.md should exist")

  // Agent files present
  for (const role of ROLES) {
    const name = agentNameFor(role)
    assert.ok(existsSync(join(projectDir, `.opencode/agent/${name}.md`)), `missing: .opencode/agent/${name}.md`)
  }
})

test("P4 new repo: init --from-armada works on new project", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "armada-new-init-"))
  spawnSync("git", ["init", "-b", "main"], { cwd: workspace, encoding: "utf8" })
  spawnSync("git", ["config", "user.email", "t@t"], { cwd: workspace, encoding: "utf8" })
  spawnSync("git", ["config", "user.name", "t"], { cwd: workspace, encoding: "utf8" })

  // Create project
  await runCli(["new", "test-proj", "--yes"], { cwd: workspace })
  const projectDir = join(workspace, "test-proj")

  // Re-init from manifest using absolute path
  const manifestPath = join(projectDir, "armada/armada.yaml")
  const r = await runCli(["init", "--from-armada", manifestPath, "--target", projectDir, "--yes"])
  assert.strictEqual(r.code, 0, `re-init should succeed: ${r.stderr}`)
  assert.match(r.stdout, /Scaffolded/)
})

test("P4 new repo: doctor passes on new project with mock opencode", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "armada-new-doctor-"))
  spawnSync("git", ["init", "-b", "main"], { cwd: workspace, encoding: "utf8" })
  spawnSync("git", ["config", "user.email", "t@t"], { cwd: workspace, encoding: "utf8" })
  spawnSync("git", ["config", "user.name", "t"], { cwd: workspace, encoding: "utf8" })

  await runCli(["new", "doc-proj", "--yes"], { cwd: workspace })
  const projectDir = join(workspace, "doc-proj")
  const binDir = makeBin({ opencode: MOCK_OPENCODE, armada: "#!/bin/sh\necho v0.9.2\n" })

  const r = await runCli(["doctor"], {
    cwd: projectDir,
    env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` },
  })
  assert.strictEqual(r.code, 0, `doctor should succeed: ${r.stderr}`)
  assert.match(r.stdout, /opencode CLI.*pass/)
})

test("P4 new repo: uninstall cleans up new project", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "armada-new-uninstall-"))
  spawnSync("git", ["init", "-b", "main"], { cwd: workspace, encoding: "utf8" })
  spawnSync("git", ["config", "user.email", "t@t"], { cwd: workspace, encoding: "utf8" })
  spawnSync("git", ["config", "user.name", "t"], { cwd: workspace, encoding: "utf8" })

  await runCli(["new", "uninstall-proj", "--yes"], { cwd: workspace })
  const projectDir = join(workspace, "uninstall-proj")
  assert.ok(existsSync(join(projectDir, "armada/armada.yaml")))

  const r = await runCli(["uninstall", "--target", projectDir])
  assert.strictEqual(r.code, 0, `uninstall should succeed: ${r.stderr}`)
  assert.match(r.stdout, /Removed armada artifacts/)
  assert.ok(!existsSync(join(projectDir, "armada/armada.yaml")), "armada.yaml should be gone")
})
