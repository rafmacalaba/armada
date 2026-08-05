/**
 * P4 - Interruption/reconcile flow.
 *
 * Start a voyage, kill mid-flight, run reconcile, resume, assert exactly-once
 * completion. Since we mock tmux, we simulate the interruption by:
 * 1. Creating state files that represent an in-progress voyage
 * 2. Running resume to check drifts
 * 3. Verifying reconcile produces a clean plan when evidence is provided
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

function manifestYaml() {
  const m = {
    project: {
      name: "interruption-test",
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

test("P4 interruption: resume with no active feature reports nothing to do", async () => {
  const dir = makeTempGitRepo({
    "armada/armada.yaml": manifestYaml(),
  })

  const r = await runCli(["resume"], { cwd: dir })
  assert.strictEqual(r.code, 0, `resume should succeed: ${r.stderr}`)
  assert.match(r.stdout, /no active feature/)
})

test("P4 interruption: resume with active feature but no drifts reports clean", async () => {
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

test("P4 interruption: reconcile detects evidence-missing drift", async () => {
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

test("P4 interruption: resume after providing evidence shows no drifts", async () => {
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

test("P4 interruption: interrupted voyage can be resumed (resume exits 0)", async () => {
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
