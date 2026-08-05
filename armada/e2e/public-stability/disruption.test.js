/**
 * Disruption - Interruption, parallel docks, main-untouched.
 *
 * Covers: resume/reconcile after interruption, two parallel docks
 * operating independently, and main checkout staying clean during
 * all operations.
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
import { reconcile } from "../../../src/reconcile.js"

// Mock opencode binary
const MOCK_OPENCODE = `#!/bin/sh
case "$1" in
  --version) echo "1.18.11" ;;
  providers) echo "openrouter" ;;
  auth) echo "openrouter" ;;
  *) echo "ok" ;;
esac
`

function manifestYaml(name = "disruption-test") {
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

// --- Interruption / resume --------------------------------------------------

test("interruption: resume with no active feature reports nothing to do", async () => {
  const dir = makeTempGitRepo({
    "armada/armada.yaml": manifestYaml(),
  })

  const r = await runCli(["resume"], { cwd: dir })
  assert.strictEqual(r.code, 0, `resume should succeed: ${r.stderr}`)
  assert.match(r.stdout, /no active feature/)
})

test("interruption: resume with active feature but no drifts reports clean", async () => {
  const dir = makeTempGitRepo({
    "armada/armada.yaml": manifestYaml(),
  })

  // Create a valid active state with a simple contract
  const stateDir = join(dir, "armada", "state")
  mkdirSync(stateDir, { recursive: true })

  const contractPath = "armada/REQUIREMENTS.md"
  const contractMd = `# Test Contract

## Goal

Test goal.

## Final criteria

- [ ] Criterion 1
  Evidence: docs/stability/test-evidence.md

## phase-1 - Implementation

- **Depends on:** none
- **Goal:** Implement.
- **Success criteria:**
  - [ ] Criterion 1
`
  writeFileSync(join(dir, contractPath), contractMd, "utf8")

  const active = {
    feature: "test-feature",
    contract: contractPath,
    phaseGraph: {
      phases: [{
        id: "phase-1",
        title: "Implementation",
        dependsOn: [],
        status: "in_progress",
        criteria: [{
          id: "c1",
          text: "Criterion 1",
          evidence: null,
        }],
      }],
    },
    evidence: [],
    nextAction: "",
    prUrl: null,
    updatedAt: new Date().toISOString(),
  }
  writeFileSync(join(stateDir, "active.json"), JSON.stringify(active, null, 2), "utf8")

  // Run resume
  const r = await runCli(["resume"], { cwd: dir })
  assert.match(r.stdout, /resume: feature test-feature/)
})

test("interruption: reconcile detects evidence-missing drift", async () => {
  const dir = makeTempGitRepo({
    "armada/armada.yaml": manifestYaml(),
  })

  const stateDir = join(dir, "armada", "state")
  mkdirSync(stateDir, { recursive: true })

  const contractPath = "armada/REQUIREMENTS.md"
  const contractMd = `# Test Contract

## Final criteria

- [ ] Criterion 1
  Evidence: docs/stability/missing-evidence.md

## phase-1 - Implementation

- **Success criteria:**
  - [ ] Criterion 1
`
  writeFileSync(join(dir, contractPath), contractMd, "utf8")

  const active = {
    feature: "drift-test",
    contract: contractPath,
    phaseGraph: {
      phases: [{
        id: "phase-1",
        title: "Implementation",
        dependsOn: [],
        status: "in_progress",
        criteria: [{
          id: "c1",
          text: "Criterion 1",
          evidence: { kind: "test", ref: "docs/stability/missing-evidence.md" },
        }],
      }],
    },
    evidence: [{ phase: "phase-1", criterion: "c1", kind: "test", ref: "docs/stability/missing-evidence.md" }],
    nextAction: "",
    prUrl: null,
    updatedAt: new Date().toISOString(),
  }
  writeFileSync(join(stateDir, "active.json"), JSON.stringify(active, null, 2), "utf8")

  // Run reconcile directly to check drift detection
  const plan = reconcile(stateDir, dir)
  assert.ok(plan.drifts.length > 0, "should detect evidence-missing drift")
  assert.strictEqual(plan.drifts[0].kind, "evidence-missing")
})

test("interruption: resume after providing evidence shows no drifts", async () => {
  const dir = makeTempGitRepo({
    "armada/armada.yaml": manifestYaml(),
  })

  const stateDir = join(dir, "armada", "state")
  mkdirSync(stateDir, { recursive: true })

  const contractPath = "armada/REQUIREMENTS.md"
  const contractMd = `# Test Contract

## Final criteria

- [ ] Criterion 1
  Evidence: docs/stability/evidence-file.md

## phase-1 - Implementation

- **Success criteria:**
  - [ ] Criterion 1
`
  writeFileSync(join(dir, contractPath), contractMd, "utf8")

  // Create the evidence file
  mkdirSync(join(dir, "docs/stability"), { recursive: true })
  writeFileSync(join(dir, "docs/stability/evidence-file.md"), "All tests pass\n", "utf8")

  const active = {
    feature: "evidence-test",
    contract: contractPath,
    phaseGraph: {
      phases: [{
        id: "phase-1",
        title: "Implementation",
        dependsOn: [],
        status: "in_progress",
        criteria: [{
          id: "c1",
          text: "Criterion 1",
          evidence: { kind: "test", ref: "docs/stability/evidence-file.md" },
        }],
      }],
    },
    evidence: [{ phase: "phase-1", criterion: "c1", kind: "test", ref: "docs/stability/evidence-file.md" }],
    nextAction: "",
    prUrl: null,
    updatedAt: new Date().toISOString(),
  }
  writeFileSync(join(stateDir, "active.json"), JSON.stringify(active, null, 2), "utf8")

  const plan = reconcile(stateDir, dir)
  assert.strictEqual(plan.drifts.length, 0, "should have no drifts after evidence provided")
})

test("interruption: interrupted voyage can be resumed (resume exits 0)", async () => {
  const dir = makeTempGitRepo({
    "armada/armada.yaml": manifestYaml(),
  })

  const stateDir = join(dir, "armada", "state")
  mkdirSync(stateDir, { recursive: true })

  // Create active state with in-progress phase
  const contractPath = "armada/REQUIREMENTS.md"
  writeFileSync(join(dir, contractPath), `# Contract

## Final criteria

- [ ] Done
  Evidence: docs/stability/done.md

## phase-1 - Work

- **Success criteria:**
  - [ ] Done
`, "utf8")

  mkdirSync(join(dir, "docs/stability"), { recursive: true })
  writeFileSync(join(dir, "docs/stability/done.md"), "PASS\n", "utf8")

  const active = {
    feature: "resume-test",
    contract: contractPath,
    phaseGraph: {
      phases: [{
        id: "phase-1",
        title: "Work",
        dependsOn: [],
        status: "in_progress",
        criteria: [{
          id: "c1",
          text: "Done",
          evidence: { kind: "test", ref: "docs/stability/done.md" },
        }],
      }],
    },
    evidence: [{ phase: "phase-1", criterion: "c1", kind: "test", ref: "docs/stability/done.md" }],
    nextAction: "",
    prUrl: null,
    updatedAt: new Date().toISOString(),
  }
  writeFileSync(join(stateDir, "active.json"), JSON.stringify(active, null, 2), "utf8")

  // Resume should succeed with no drifts
  const r = await runCli(["resume"], { cwd: dir })
  assert.strictEqual(r.code, 0, `resume should exit 0: ${r.stderr}`)
  assert.match(r.stdout, /resume: feature resume-test/)
})

// --- Parallel docks ---------------------------------------------------------

test("parallel docks: two independent docks init and uninstall without conflict", async () => {
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

test("parallel docks: concurrent init does not corrupt either dock", async () => {
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

// --- Main untouched ---------------------------------------------------------

const MAIN_REPO = join(process.cwd(), "../..")

function gitStatus(dir) {
  const r = spawnSync("git", ["status", "--short"], { cwd: dir, encoding: "utf8" })
  return r.stdout.trim()
}

test("main untouched: operations in temp dirs do not change main checkout", async () => {
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

test("main untouched: concurrent operations do not dirty main", async () => {
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

test("main untouched: --restart does not dirty main", async () => {
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
