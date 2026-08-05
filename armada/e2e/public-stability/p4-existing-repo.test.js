/**
 * P4 - Existing repo acceptance flow.
 *
 * The dock itself IS an existing repo. This test verifies that running
 * `armada init --from-armada` inside an already-initialized repo re-scaffolds
 * correctly without clobbering user files, and that `armada doctor` + `armada
 * uninstall` work end-to-end.
 */

import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { makeTempGitRepo, makeBin, runCli } from "../../../tests/helpers.js"
import { ROLES, modelFor } from "../../../src/model-catalog.js"
import { buildTeam, renderManifestYaml } from "../../../src/generator.js"
import { agentNameFor } from "../../../src/role-display.js"

// Mock opencode binary - succeeds with version, providers, auth.
const MOCK_OPENCODE = `#!/bin/sh
case "$1" in
  --version) echo "1.18.11" ;;
  providers) echo "openrouter" ;;
  auth) echo "openrouter" ;;
  *) echo "ok" ;;
esac
`

function makeManifest(dir) {
  return {
    project: {
      name: "existing-repo-test",
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
    targetDir: dir,
  }
}

function manifestYaml() {
  const m = makeManifest(".")
  return renderManifestYaml(m, buildTeam(m))
}

// --- Tests -------------------------------------------------------------------

test("P4 existing repo: init --from-armada re-scaffolds without clobbering user files", async () => {
  const dir = makeTempGitRepo({
    "armada/armada.yaml": manifestYaml(),
    "user-file.txt": "do not touch",
  })

  const manifestPath = join(dir, "armada/armada.yaml")
  const r = await runCli(["init", "--from-armada", manifestPath, "--target", dir, "--yes"])
  assert.strictEqual(r.code, 0, `init should succeed: ${r.stderr}`)
  assert.match(r.stdout, /Scaffolded/)
  // User file preserved
  assert.ok(existsSync(join(dir, "user-file.txt")), "user file should exist")
  assert.strictEqual(readFileSync(join(dir, "user-file.txt"), "utf8"), "do not touch")
  // Agent files present
  for (const role of ROLES) {
    const name = agentNameFor(role)
    assert.ok(existsSync(join(dir, `.opencode/agent/${name}.md`)), `missing: .opencode/agent/${name}.md`)
  }
  // armada.yaml present
  assert.ok(existsSync(join(dir, "armada/armada.yaml")))
  // AGENTS.md present
  assert.ok(existsSync(join(dir, "AGENTS.md")))
})

test("P4 existing repo: doctor passes with mock opencode", async () => {
  const dir = makeTempGitRepo({
    "armada/armada.yaml": manifestYaml(),
  })

  // First init to create the fleet tracker plugin (doctor checks for it)
  const manifestPath = join(dir, "armada/armada.yaml")
  await runCli(["init", "--from-armada", manifestPath, "--target", dir, "--yes"])

  const binDir = makeBin({ opencode: MOCK_OPENCODE, armada: "#!/bin/sh\necho v0.9.2\n" })

  const r = await runCli(["doctor"], {
    cwd: dir,
    env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` },
  })
  assert.strictEqual(r.code, 0, `doctor should succeed: ${r.stderr}`)
  assert.match(r.stdout, /opencode CLI.*pass/)
  assert.match(r.stdout, /opencode version range.*pass/)
})

test("P4 existing repo: uninstall removes armada artifacts, preserves user files", async () => {
  const dir = makeTempGitRepo({
    "armada/armada.yaml": manifestYaml(),
    "user-file.txt": "keep me",
  })

  // Scaffold first
  const manifestPath = join(dir, "armada/armada.yaml")
  const initR = await runCli(["init", "--from-armada", manifestPath, "--target", dir, "--yes"])
  assert.strictEqual(initR.code, 0)

  // Uninstall
  const r = await runCli(["uninstall", "--target", dir])
  assert.strictEqual(r.code, 0, `uninstall should succeed: ${r.stderr}`)
  assert.match(r.stdout, /Removed armada artifacts/)

  // armada files removed
  assert.ok(!existsSync(join(dir, "armada/armada.yaml")), "armada.yaml should be removed")
  assert.ok(!existsSync(join(dir, "armada/REQUIREMENTS.md")), "REQUIREMENTS.md should be removed")
  // User file preserved
  assert.ok(existsSync(join(dir, "user-file.txt")), "user file should be preserved")
  assert.strictEqual(readFileSync(join(dir, "user-file.txt"), "utf8"), "keep me")
})

test("P4 existing repo: doctor fails when opencode is missing", async () => {
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

test("P4 existing repo: idempotent init - run twice, same files", async () => {
  const dir = makeTempGitRepo({
    "armada/armada.yaml": manifestYaml(),
  })

  const manifestPath = join(dir, "armada/armada.yaml")
  const r1 = await runCli(["init", "--from-armada", manifestPath, "--target", dir, "--yes"])
  assert.strictEqual(r1.code, 0)
  const r2 = await runCli(["init", "--from-armada", manifestPath, "--target", dir, "--yes"])
  assert.strictEqual(r2.code, 0)

  // All agent files still present
  for (const role of ROLES) {
    const name = agentNameFor(role)
    assert.ok(existsSync(join(dir, `.opencode/agent/${name}.md`)), `missing after 2nd init: ${name}.md`)
  }
})
