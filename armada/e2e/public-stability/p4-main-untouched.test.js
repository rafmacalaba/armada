/**
 * P4 - Main checkout unchanged.
 *
 * Before and after every e2e test, `git status` of the main checkout
 * must be unchanged. This test captures the baseline, runs a series of
 * operations in temp dirs, and verifies the main checkout is untouched.
 */

import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

import { makeTempGitRepo, makeBin, runCli } from "../../../tests/helpers.js"
import { ROLES, modelFor } from "../../../src/model-catalog.js"
import { buildTeam, renderManifestYaml } from "../../../src/generator.js"

const MAIN_REPO = join(process.cwd(), "../..")

function manifestYaml() {
  const m = {
    project: {
      name: "main-untouched-test",
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

function gitStatus(dir) {
  const r = spawnSync("git", ["status", "--short"], { cwd: dir, encoding: "utf8" })
  return r.stdout.trim()
}

test("P4 main untouched: operations in temp dirs do not change main checkout", async () => {
  // Capture baseline
  const baseline = gitStatus(MAIN_REPO)

  // Create a temp dock and run operations
  const dir = makeTempGitRepo({ "armada/armada.yaml": manifestYaml() })
  const env = { ...process.env }
  const manifestPath = join(dir, "armada/armada.yaml")

  // Init
  const initR = await runCli(["init", "--from-armada", manifestPath, "--target", dir, "--yes"], { env })
  assert.strictEqual(initR.code, 0)

  // Doctor (uses mock)
  const binDir = makeBin({
    opencode: `#!/bin/sh
case "$1" in
  --version) echo "1.18.11" ;;
  providers) echo "openrouter" ;;
  auth) echo "openrouter" ;;
  *) echo "ok" ;;
esac
`,
    armada: "#!/bin/sh\necho v0.9.2\n",
  })
  const doctorEnv = { ...env, PATH: `${binDir}:${process.env.PATH}` }
  const docR = await runCli(["doctor"], { cwd: dir, env: doctorEnv })
  assert.strictEqual(docR.code, 0)

  // Uninstall
  const unR = await runCli(["uninstall", "--target", dir], { env })
  assert.strictEqual(unR.code, 0)

  // Verify main checkout unchanged
  const after = gitStatus(MAIN_REPO)
  assert.strictEqual(after, baseline, "main checkout git status must not change after e2e operations")
})

test("P4 main untouched: concurrent operations do not dirty main", async () => {
  const baseline = gitStatus(MAIN_REPO)

  const env = { ...process.env }

  // Create two docks and init concurrently
  const dockA = makeTempGitRepo({ "armada/armada.yaml": manifestYaml() })
  const dockB = makeTempGitRepo({ "armada/armada.yaml": manifestYaml() })
  const manifestA = join(dockA, "armada/armada.yaml")
  const manifestB = join(dockB, "armada/armada.yaml")

  const [rA, rB] = await Promise.all([
    runCli(["init", "--from-armada", manifestA, "--target", dockA, "--yes"], { env }),
    runCli(["init", "--from-armada", manifestB, "--target", dockB, "--yes"], { env }),
  ])
  assert.strictEqual(rA.code, 0)
  assert.strictEqual(rB.code, 0)

  // Uninstall both
  await Promise.all([
    runCli(["uninstall", "--target", dockA], { env }),
    runCli(["uninstall", "--target", dockB], { env }),
  ])

  const after = gitStatus(MAIN_REPO)
  assert.strictEqual(after, baseline, "main checkout must not change after concurrent operations")
})

test("P4 main untouched: --restart does not dirty main", async () => {
  const baseline = gitStatus(MAIN_REPO)

  const dir = makeTempGitRepo({ "armada/armada.yaml": manifestYaml() })
  const env = { ...process.env }
  const manifestPath = join(dir, "armada/armada.yaml")

  // Init then restart
  await runCli(["init", "--from-armada", manifestPath, "--target", dir, "--yes"], { env })
  const r = await runCli(["init", "--from-armada", manifestPath, "--target", dir, "--yes", "--restart"], { env })
  assert.strictEqual(r.code, 0)

  const after = gitStatus(MAIN_REPO)
  assert.strictEqual(after, baseline, "main checkout must not change after --restart")
})
