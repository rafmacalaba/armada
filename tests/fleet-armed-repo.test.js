/**
 * Integration test: a fresh `armada init` in a third-party repo produces a
 * fleet-tracked, dashboard-ready repo. Validates Phase A of the
 * oob-thirdparty contract: fleet on by default, /armada-fleet path is clean
 * (no source-checkout fallback), opt-out via --no-fleet-tracker works.
 *
 * Uses ARMADA_RUNS_DIR isolation so the user's real ~/.armada/runs/ is
 * never touched.
 */

import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

import { writeRun, defaultRunEntry } from "../src/fleet-tracker.js"

const REPO = resolve(".")
const CLI = join(REPO, "src/cli.js")

function cli(args, opts = {}) {
  const env = { ...process.env, ...(opts.env ?? {}) }
  return spawnSync("node", [CLI, ...args], {
    cwd: opts.cwd ?? REPO,
    env,
    encoding: "utf8",
  })
}

test("fleet-armed-repo: fresh init produces default-on fleet plugin and clean /armada-fleet body", () => {
  const projectDir = mkdtempSync(join(tmpdir(), "oob-fleet-fresh-"))
  const runsDir = mkdtempSync(join(tmpdir(), "oob-fleet-runs-"))
  const prevRuns = process.env.ARMADA_RUNS_DIR
  process.env.ARMADA_RUNS_DIR = runsDir
  try {
    const r = cli(["init", "--yes", "--target", projectDir])
    assert.equal(r.status, 0, `init failed: ${r.stderr}`)

    const fleetCmd = readFileSync(join(projectDir, ".opencode/commands/armada-fleet.md"), "utf8")
    assert.match(fleetCmd, /armada fleet/, "command body must reference armada fleet")
    assert.doesNotMatch(fleetCmd, /node src\/cli\.js/, "command body must not reference source-checkout path")

    const pluginPath = join(projectDir, ".opencode/plugins/armada-fleet.js")
    assert.ok(existsSync(pluginPath), "fleet plugin must be written by default")
    const pluginContent = readFileSync(pluginPath, "utf8")
    assert.ok(pluginContent.length > 0, "fleet plugin must be non-empty")
  } finally {
    if (prevRuns === undefined) delete process.env.ARMADA_RUNS_DIR
    else process.env.ARMADA_RUNS_DIR = prevRuns
    rmSync(projectDir, { recursive: true, force: true })
    rmSync(runsDir, { recursive: true, force: true })
  }
})

test("fleet-armed-repo: --no-fleet-tracker suppresses the plugin", () => {
  const projectDir = mkdtempSync(join(tmpdir(), "oob-fleet-no-"))
  try {
    const r = cli(["init", "--yes", "--no-fleet-tracker", "--target", projectDir])
    assert.equal(r.status, 0, `init failed: ${r.stderr}`)
    const pluginPath = join(projectDir, ".opencode/plugins/armada-fleet.js")
    assert.ok(!existsSync(pluginPath), "fleet plugin must NOT be written when --no-fleet-tracker is set")
  } finally {
    rmSync(projectDir, { recursive: true, force: true })
  }
})

test("fleet-armed-repo: a recorded run shows up in armada fleet output", async () => {
  const projectDir = mkdtempSync(join(tmpdir(), "oob-fleet-show-"))
  const runsDir = mkdtempSync(join(tmpdir(), "oob-fleet-runs2-"))
  const prevRuns = process.env.ARMADA_RUNS_DIR
  process.env.ARMADA_RUNS_DIR = runsDir
  try {
    const r = cli(["init", "--yes", "--target", projectDir])
    assert.equal(r.status, 0, `init failed: ${r.stderr}`)

    const entry = defaultRunEntry({
      session: "test-session-001",
      cwd: projectDir,
      branch: "main",
      contractPath: "armada/REQUIREMENTS.md",
    })
    await writeRun(entry, { storeDir: runsDir })

    const fleet = cli(["fleet"], { env: { ARMADA_RUNS_DIR: runsDir } })
    assert.equal(fleet.status, 0, `fleet failed: ${fleet.stderr}`)
    assert.match(fleet.stdout, /test-session-001/, "fleet output must show the recorded session")
  } finally {
    if (prevRuns === undefined) delete process.env.ARMADA_RUNS_DIR
    else process.env.ARMADA_RUNS_DIR = prevRuns
    rmSync(projectDir, { recursive: true, force: true })
    rmSync(runsDir, { recursive: true, force: true })
  }
})
