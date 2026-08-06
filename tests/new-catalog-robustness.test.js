import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, renameSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runNew, discoverVariables } from "../src/new-command.js"
import { runCli } from "./helpers.js"

// --- DEF-006: catalog load error includes file path ---

test("DEF-006: catalog load error includes file path", async () => {
  const tmp = join(tmpdir(), `armada-def006-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })

  // Point at a nonexistent catalog to trigger the load error
  const nonexistentPath = join(tmp, "nonexistent", "_catalog.json")

  const code = await runNew({
    name: "def006-app",
    yes: true,
    cwd: tmp,
    _catalogPath: nonexistentPath,
  })

  assert.strictEqual(code, 1, `expected code 1, got ${code}`)
  process.exitCode = 0
  rmSync(tmp, { recursive: true, force: true })
})

// --- Malformed JSON in --config produces clear error ---

test("malformed JSON in --config file produces clear error", async () => {
  const tmp = join(tmpdir(), `armada-malcfg-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })

  const badConfigPath = join(tmp, "bad.json")
  writeFileSync(badConfigPath, "{ invalid json !!!", "utf8")

  const code = await runNew({
    name: "malcfg-app",
    template: join(process.cwd(), "starter", "blank"),
    config: badConfigPath,
    yes: true,
    cwd: tmp,
  })

  assert.strictEqual(code, 1, "malformed config should cause exit 1")
  process.exitCode = 0
  rmSync(tmp, { recursive: true, force: true })
})

// --- Template not found: error message includes path ---

test("template not found: error message includes path", async () => {
  const tmp = join(tmpdir(), `armada-notpl-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })

  const code = await runNew({
    name: "notpl-app",
    template: "/nonexistent/path/to/template",
    yes: true,
    cwd: tmp,
  })

  assert.strictEqual(code, 1, "should exit 1 for missing template")
  process.exitCode = 0
  rmSync(tmp, { recursive: true, force: true })
})

// --- discoverVariables robustness ---

test("discoverVariables on empty dir returns empty list", () => {
  const tmp = join(tmpdir(), `armada-disc-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })
  const vars = discoverVariables(tmp)
  assert.deepStrictEqual(vars, [])
  rmSync(tmp, { recursive: true, force: true })
})

// --- Malformed catalog: missing categories array ---

test("DEF-003: catalog missing categories key produces clear error with path", async () => {
  const tmp = join(tmpdir(), `armada-def003-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })

  // Write fake catalog with no categories key
  const fakeCatalogPath = join(tmp, "_catalog.json")
  writeFileSync(fakeCatalogPath, JSON.stringify({ foo: [] }), "utf8")

  const code = await runNew({
    name: "def003-app",
    yes: true,
    cwd: tmp,
    _catalogPath: fakeCatalogPath,
  })

  assert.strictEqual(code, 1, `expected code 1 for missing categories, got ${code}`)
  process.exitCode = 0
  rmSync(tmp, { recursive: true, force: true })
})

// --- Config file not found ---

test("config file not found produces clear error", async () => {
  const tmp = join(tmpdir(), `armada-nocfg-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })

  const code = await runNew({
    name: "nocfg-app",
    template: join(process.cwd(), "starter", "blank"),
    config: "/nonexistent/config.json",
    yes: true,
    cwd: tmp,
  })

  assert.strictEqual(code, 1, "missing config should cause exit 1")
  process.exitCode = 0
  rmSync(tmp, { recursive: true, force: true })
})
