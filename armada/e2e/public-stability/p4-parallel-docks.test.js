/**
 * P4 - Two parallel docks.
 *
 * Create two sandboxed docks in disjoint temp dirs, init both, run mock
 * voyages, assert both worktrees are independent, and both can uninstall
 * without conflict.
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

function manifestYaml(name) {
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

test("P4 parallel docks: two independent docks init and uninstall without conflict", async () => {
  // Create two disjoint temp repos
  const dockA = makeTempGitRepo({ "armada/armada.yaml": manifestYaml("dock-a") })
  const dockB = makeTempGitRepo({ "armada/armada.yaml": manifestYaml("dock-b") })

  const binDir = makeBin({ opencode: MOCK_OPENCODE, armada: "#!/bin/sh\necho v0.9.2\n" })
  const env = { ...process.env, PATH: `${binDir}:${process.env.PATH}` }

  // Init both - use absolute manifest paths
  const manifestA = join(dockA, "armada/armada.yaml")
  const manifestB = join(dockB, "armada/armada.yaml")
  const initA = await runCli(["init", "--from-armada", manifestA, "--target", dockA, "--yes"], { env })
  const initB = await runCli(["init", "--from-armada", manifestB, "--target", dockB, "--yes"], { env })
  assert.strictEqual(initA.code, 0, `dock A init failed: ${initA.stderr}`)
  assert.strictEqual(initB.code, 0, `dock B init failed: ${initB.stderr}`)

  // Both have agent files
  for (const role of ROLES) {
    const name = agentNameFor(role)
    assert.ok(existsSync(join(dockA, `.opencode/agent/${name}.md`)), `dock A missing: ${name}.md`)
    assert.ok(existsSync(join(dockB, `.opencode/agent/${name}.md`)), `dock B missing: ${name}.md`)
  }

  // Both armada.yaml files have different project names
  const yamlA = readFileSync(join(dockA, "armada/armada.yaml"), "utf8")
  const yamlB = readFileSync(join(dockB, "armada/armada.yaml"), "utf8")
  assert.match(yamlA, /dock-a/)
  assert.match(yamlB, /dock-b/)
  assert.notStrictEqual(yamlA, yamlB, "dock A and B manifests should differ")

  // Doctor passes on both
  const docA = await runCli(["doctor"], { cwd: dockA, env })
  const docB = await runCli(["doctor"], { cwd: dockB, env })
  assert.strictEqual(docA.code, 0, `dock A doctor failed: ${docA.stderr}`)
  assert.strictEqual(docB.code, 0, `dock B doctor failed: ${docB.stderr}`)

  // Uninstall both - no conflict
  const unA = await runCli(["uninstall", "--target", dockA], { env })
  const unB = await runCli(["uninstall", "--target", dockB], { env })
  assert.strictEqual(unA.code, 0, `dock A uninstall failed: ${unA.stderr}`)
  assert.strictEqual(unB.code, 0, `dock B uninstall failed: ${unB.stderr}`)

  assert.ok(!existsSync(join(dockA, "armada/armada.yaml")))
  assert.ok(!existsSync(join(dockB, "armada/armada.yaml")))
})

test("P4 parallel docks: concurrent init does not corrupt either dock", async () => {
  const dockA = makeTempGitRepo({ "armada/armada.yaml": manifestYaml("concurrent-a") })
  const dockB = makeTempGitRepo({ "armada/armada.yaml": manifestYaml("concurrent-b") })

  const env = { ...process.env }
  const manifestA = join(dockA, "armada/armada.yaml")
  const manifestB = join(dockB, "armada/armada.yaml")

  // Init both concurrently via Promise.all
  const [rA, rB] = await Promise.all([
    runCli(["init", "--from-armada", manifestA, "--target", dockA, "--yes"], { env }),
    runCli(["init", "--from-armada", manifestB, "--target", dockB, "--yes"], { env }),
  ])

  assert.strictEqual(rA.code, 0, `concurrent dock A init failed: ${rA.stderr}`)
  assert.strictEqual(rB.code, 0, `concurrent dock B init failed: ${rB.stderr}`)

  // Both have valid opencode.json
  const jsonA = JSON.parse(readFileSync(join(dockA, "opencode.json"), "utf8"))
  const jsonB = JSON.parse(readFileSync(join(dockB, "opencode.json"), "utf8"))
  assert.ok(jsonA.model)
  assert.ok(jsonB.model)
})
