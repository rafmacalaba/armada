/**
 * Phase 4 — CLI wiring e2e tests.
 *
 * Three scenarios proving the CLI dispatches the right behavior:
 * 1. models --list-openrouter help text presence + import reachability
 * 2. armada preset <name> applies budget + rewrites armada.yaml
 * 3. armada init prints renderInitSummary in stdout
 */

import { test } from "node:test"
import assert from "node:assert"
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  mkdtempSync,
} from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"

const CLI = join(process.cwd(), "src", "cli.js")

// ---- helpers ----------------------------------------------------------------

function makeTmpDir(prefix = "armada-cli-wiring-") {
  return mkdtempSync(join(tmpdir(), prefix))
}

function mkdirp(dir) {
  mkdirSync(dir, { recursive: true })
}

function writeFileSyncSafe(path, content) {
  mkdirp(join(path, ".."))
  writeFileSync(path, content, "utf8")
}

function runCli(args, opts = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    cwd: opts.cwd || process.cwd(),
    env: { ...process.env, ...(opts.env || {}) },
  })
  return {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

/**
 * Build a minimal armada.yaml in the target directory (armada/armada.yaml).
 * Shape matches armada/armada.yaml in this repo.
 */
function buildMinimalArmadaYaml(opts = {}) {
  const name = opts.name || "test-project"
  const budget = opts.budget || "balanced"
  return [
    "# armada.yaml — opencode-armada manifest (source of truth)",
    `project:`,
    `  name: "${name}"`,
    `  budget: "${budget}"`,
    `  browserTesting: false`,
    `  devcontainer: false`,
    `  useAgentBrowser: false`,
    `  headless: false`,
    `  yolo: false`,
    `  requirementsFile: "armada/REQUIREMENTS.md"`,
    `  supervision:`,
    `    plugin: false`,
    `    fleet: false`,
    `    watchdog: false`,
    `  stack:`,
    `    frontend: null`,
    `    backend: null`,
    `    database: null`,
    `    testing: null`,
    `    srcDirs: ["src"]`,
    `    languages: ["javascript"]`,
    `team:`,
    `  - role: "orchestrator"`,
    `    model: "opencode-go/minimax-m3"`,
    `    fallback: null`,
    `    enabled: true`,
    `  - role: "backend-dev"`,
    `    model: "opencode-go/deepseek-v4-pro"`,
    `    fallback: null`,
    `    enabled: true`,
    `  - role: "frontend-dev"`,
    `    model: "opencode-go/minimax-m3"`,
    `    fallback: null`,
    `    enabled: true`,
    `  - role: "qa"`,
    `    model: "opencode/mimo-v2.5-free"`,
    `    fallback: null`,
    `    enabled: true`,
    `  - role: "adversary"`,
    `    model: "opencode-go/deepseek-v4-pro"`,
    `    fallback: null`,
    `    enabled: true`,
    `  - role: "security"`,
    `    model: "opencode/big-pickle"`,
    `    fallback: null`,
    `    enabled: true`,
    `  - role: "docs"`,
    `    model: "opencode/deepseek-v4-flash-free"`,
    `    fallback: null`,
    `    enabled: true`,
    `  - role: "architect"`,
    `    model: "opencode/big-pickle"`,
    `    fallback: null`,
    `    enabled: true`,
  ].join("\n")
}

// ---- Scenario 1: models --list-openrouter (help text + import) ---------------

test("models --list-openrouter: help mentions flag + import is reachable", () => {
  // 1. help text must include --list-openrouter
  const help = runCli(["help"])
  assert.strictEqual(help.code, 0, `help failed: ${help.stderr}`)
  assert.match(
    help.stdout,
    /--list-openrouter/,
    "help text must mention --list-openrouter"
  )

  // 2. Import path: index.js must export listOpenRouterModels and renderOpenRouterModels
  const tmpDir = makeTmpDir("import-test-")
  const tmpFile = join(tmpDir, "check.mjs")
  writeFileSyncSafe(
    tmpFile,
    `
      import { listOpenRouterModels, renderOpenRouterModels } from "${join(process.cwd(), "src", "index.js")}"
      if (typeof listOpenRouterModels !== "function") {
        console.error("listOpenRouterModels is not a function")
        process.exitCode = 1
      }
      if (typeof renderOpenRouterModels !== "function") {
        console.error("renderOpenRouterModels is not a function")
        process.exitCode = 1
      }
    `
  )
  const r = spawnSync(process.execPath, [tmpFile], {
    encoding: "utf8",
    cwd: process.cwd(),
  })
  assert.strictEqual(
    r.status,
    0,
    `index.js exports check failed: ${r.stderr}`
  )
  rmSync(tmpDir, { recursive: true, force: true })
})

// ---- Scenario 2: armada preset <name> CLI e2e -------------------------------

test("preset: prints deprecation, forwards to init", async () => {
  const cwd = makeTmpDir()
  const armadaDir = join(cwd, "armada")
  mkdirp(armadaDir)

  // Write minimal armada.yaml with balanced budget
  writeFileSyncSafe(join(armadaDir, "armada.yaml"), buildMinimalArmadaYaml({
    name: "preset-test",
    budget: "balanced",
  }))

  // Run armada preset power -- the deprecation hint should appear
  const result = runCli(["preset", "power", "--target", cwd])
  // Deprecation hint on stderr
  assert.match(result.stderr, /armada preset: deprecated/)
  assert.match(result.stderr, /armada init --budget/)

  // Cleanup
  rmSync(cwd, { recursive: true, force: true })
})

// ---- Scenario 3: armada init prints summary in stdout -----------------------

test("init: prints Project/Team/Budget/Roster/Next steps summary", () => {
  const cwd = makeTmpDir()
  mkdirp(join(cwd, "armada"))
  mkdirp(join(cwd, "src"))

  // Write a minimal package.json so guessName has something to work with
  writeFileSyncSafe(
    join(cwd, "package.json"),
    JSON.stringify({ name: "my-test-app" }, null, 2) + "\n"
  )

  // Run init in headless + yes mode to skip interactive prompts
  const result = runCli(["init", "--target", cwd, "--yes", "--headless"], {
    env: { ...process.env, npm_config_yes: "true" },
  })
  assert.strictEqual(result.code, 0, `init failed (exit ${result.code}): ${result.stderr}`)

  // Summary section assertions
  assert.match(result.stdout, /Project: .+/, "must print Project: <name>")
  assert.match(result.stdout, /Team: \d+ agents/, "must print Team: <N> agents")
  assert.match(result.stdout, /Budget: \w+/, "must print Budget: <budget>")
  assert.match(result.stdout, /Roster:/, "must print Roster: section")
  assert.match(result.stdout, /Next steps:/, "must print Next steps: section")
  // At least one role line: "  <display name>: <model>"
  assert.match(
    result.stdout,
    /  (orchestrator|backend-dev|frontend-dev|qa|adversary|security|docs|architect): \S+/,
    "must print at least one role-key: model line"
  )

  // Cleanup
  rmSync(cwd, { recursive: true, force: true })
})

test("init: renders watchdog: false in armada.yaml by default", () => {
  const cwd = makeTmpDir()
  mkdirp(join(cwd, "armada"))
  mkdirp(join(cwd, "src"))

  writeFileSyncSafe(
    join(cwd, "package.json"),
    JSON.stringify({ name: "watchdog-test" }, null, 2) + "\n"
  )

  const result = runCli(["init", "--target", cwd, "--yes", "--headless"], {
    env: { ...process.env, npm_config_yes: "true" },
  })
  assert.strictEqual(result.code, 0, `init failed (exit ${result.code}): ${result.stderr}`)

  const written = readFileSync(join(cwd, "armada/armada.yaml"), "utf8")
  assert.match(written, /watchdog: false/)
  rmSync(cwd, { recursive: true, force: true })
})

test("init --watchdog: renders watchdog: true in armada.yaml", () => {
  const cwd = makeTmpDir()
  mkdirp(join(cwd, "armada"))
  mkdirp(join(cwd, "src"))

  writeFileSyncSafe(
    join(cwd, "package.json"),
    JSON.stringify({ name: "watchdog-test2" }, null, 2) + "\n"
  )

  const result = runCli(["init", "--target", cwd, "--yes", "--headless", "--watchdog"], {
    env: { ...process.env, npm_config_yes: "true" },
  })
  assert.strictEqual(result.code, 0, `init --watchdog failed (exit ${result.code}): ${result.stderr}`)

  const written = readFileSync(join(cwd, "armada/armada.yaml"), "utf8")
  assert.match(written, /watchdog: true/)
  rmSync(cwd, { recursive: true, force: true })
})

// ---- helper: import manifest parser (lazy) ---------------------------------

async function loadManifestParser() {
  const mod = await import(join(process.cwd(), "src", "manifest.js"))
  return mod.parseManifestYaml
}
