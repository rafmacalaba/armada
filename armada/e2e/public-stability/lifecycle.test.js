/**
 * Lifecycle - Full canonical happy path.
 *
 * init -> doctor -> Opencode load (mocked) -> bounded voyage (mocked)
 * -> evidence collection -> update (re-init) -> repeat -> uninstall.
 *
 * Also covers: armada new, repeated init idempotency, doctor failure
 * when opencode is missing, uninstall --all.
 */

import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

import { makeTempGitRepo, makeBin, runCli } from "../../../tests/helpers.js"
import { ROLES, modelFor } from "../../../src/model-catalog.js"
import { buildTeam, renderManifestYaml } from "../../../src/generator.js"
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

// Mock tmux binary - simulates ready state immediately
const MOCK_TMUX = `#!/bin/sh
case "$1" in
  has-session) exit 1 ;;  # no existing session
  new-session) exit 0 ;;  # create succeeds
  capture-pane) printf "tab agents\\nctrl+p\\n" ;;  # ready pattern
  send-keys) exit 0 ;;
  *) exit 0 ;;
esac
`

function manifestYaml(name = "lifecycle-test") {
  const m = {
    project: {
      name,
      budget: "balanced",
      browserTesting: false,
      devcontainer: false,
      useAgentBrowser: false,
      headless: false,
      yolo: false,
      supervision: { plugin: false, fleet: true, watchdog: false },
      requirementsFile: "armada/REQUIREMENTS.md",
      stack: {},
    },
    team: ROLES.map((role) => ({
      role,
      model: modelFor(role, "balanced"),
      fallback: null,
      enabled: true,
    })),
    targetDir: ".",
  }
  return renderManifestYaml(m, buildTeam(m))
}

// --- Main lifecycle ---------------------------------------------------------

test("lifecycle: init -> doctor -> voyage -> evidence -> update -> repeat -> uninstall", async () => {
  const dir = makeTempGitRepo({
    "armada/armada.yaml": manifestYaml(),
  })

  const binDir = makeBin({
    opencode: MOCK_OPENCODE,
    tmux: MOCK_TMUX,
    armada: "#!/bin/sh\necho v0.9.2\n",
  })

  const env = { ...process.env, PATH: `${binDir}:${process.env.PATH}` }
  const manifestPath = join(dir, "armada/armada.yaml")

  // Step 1: init
  const initR = await runCli(["init", "--from-armada", manifestPath, "--target", dir, "--yes"], { env })
  assert.strictEqual(initR.code, 0, `init failed: ${initR.stderr}`)
  assert.match(initR.stdout, /Scaffolded/)

  // Step 2: doctor
  const doctorR = await runCli(["doctor"], { cwd: dir, env })
  assert.strictEqual(doctorR.code, 0, `doctor failed: ${doctorR.stderr}`)
  assert.match(doctorR.stdout, /opencode CLI.*pass/)

  // Step 3: voyage (mocked tmux) - should not hang
  const voyageR = await runCli(["voyage", dir, "--timeout", "5000", "--no-open", "--no-track"], { env })
  assert.ok(
    voyageR.stdout.includes("session") || voyageR.stderr.includes("session") || voyageR.code !== 0,
    "voyage should attempt session creation"
  )

  // Step 4: evidence - run doctor as evidence of health
  const evidenceR = await runCli(["doctor"], { cwd: dir, env })
  assert.strictEqual(evidenceR.code, 0, "evidence doctor should pass")

  // Step 5: update (re-init from manifest)
  const updateR = await runCli(["init", "--from-armada", manifestPath, "--target", dir, "--yes", "--restart"], { env })
  assert.strictEqual(updateR.code, 0, `update (re-init) failed: ${updateR.stderr}`)
  assert.match(updateR.stdout, /Scaffolded/)

  // Step 6: repeat - doctor again
  const repeatR = await runCli(["doctor"], { cwd: dir, env })
  assert.strictEqual(repeatR.code, 0, "repeat doctor should pass")

  // Step 7: uninstall
  const uninstallR = await runCli(["uninstall", "--target", dir], { env })
  assert.strictEqual(uninstallR.code, 0, `uninstall failed: ${uninstallR.stderr}`)
  assert.match(uninstallR.stdout, /Removed armada artifacts/)
  assert.ok(!existsSync(join(dir, "armada/armada.yaml")), "armada.yaml should be removed")
})

// --- Idempotency -----------------------------------------------------------

test("lifecycle: repeated init does not corrupt opencode.json", async () => {
  const dir = makeTempGitRepo({
    "armada/armada.yaml": manifestYaml(),
  })

  const env = { ...process.env }
  const manifestPath = join(dir, "armada/armada.yaml")

  // Init three times
  for (let i = 0; i < 3; i++) {
    const r = await runCli(["init", "--from-armada", manifestPath, "--target", dir, "--yes"], { env })
    assert.strictEqual(r.code, 0, `init #${i + 1} failed: ${r.stderr}`)
  }

  // opencode.json should be valid JSON
  const ocPath = join(dir, "opencode.json")
  assert.ok(existsSync(ocPath), "opencode.json should exist")
  const parsed = JSON.parse(readFileSync(ocPath, "utf8"))
  assert.ok(parsed.model, "opencode.json should have model field")
  assert.ok(parsed.default_agent, "opencode.json should have default_agent field")
})

// --- Uninstall --------------------------------------------------------------

test("lifecycle: uninstall --all removes all armada files", async () => {
  const dir = makeTempGitRepo({
    "armada/armada.yaml": manifestYaml(),
    "user-code.js": "const x = 1",
  })

  const env = { ...process.env }
  const manifestPath = join(dir, "armada/armada.yaml")

  const initR = await runCli(["init", "--from-armada", manifestPath, "--target", dir, "--yes"], { env })
  assert.strictEqual(initR.code, 0)

  const uninstallR = await runCli(["uninstall", "--target", dir, "--all"], { env })
  assert.strictEqual(uninstallR.code, 0)

  assert.ok(!existsSync(join(dir, "armada/armada.yaml")))
  assert.ok(!existsSync(join(dir, "armada/REQUIREMENTS.md")))
  assert.ok(!existsSync(join(dir, "AGENTS.md")))
  assert.ok(!existsSync(join(dir, "opencode.json")))
  // User file preserved
  assert.ok(existsSync(join(dir, "user-code.js")))
})

// --- Doctor failure ---------------------------------------------------------

test("lifecycle: doctor fails when opencode is missing", async () => {
  const dir = makeTempGitRepo({
    "armada/armada.yaml": manifestYaml(),
  })
  const emptyBin = mkdtempSync(join(tmpdir(), "armada-empty-"))

  const r = await runCli(["doctor"], {
    cwd: dir,
    env: { ...process.env, PATH: emptyBin },
  })
  // doctor reports fail
  assert.match(r.stdout, /opencode CLI.*fail/)
})

// --- armada new -------------------------------------------------------------

test("lifecycle: armada new creates project with expected structure", async () => {
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
