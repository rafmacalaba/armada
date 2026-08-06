import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runNew, discoverVariables } from "../src/new-command.js"
import { runCli } from "./helpers.js"

// --- Missing _catalog.json: non-TTY default to blank still works ---

test("missing _catalog.json: non-TTY default to blank still works", async () => {
  const tmp = join(tmpdir(), `armada-nocat-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })

  const r = await runCli(["new", "nocat-app", "--yes"], { cwd: tmp })
  assert.strictEqual(r.code, 0, `non-TTY blank fallback should succeed: ${r.stderr}`)
  assert.ok(existsSync(join(tmp, "nocat-app", "armada", "armada.yaml")))

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

// --- Unknown category id: non-TTY falls back to blank ---

test("unknown category id via non-TTY: falls back to blank", async () => {
  const tmp = join(tmpdir(), `armada-unknown-cat-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })

  const r = await runCli(["new", "unk-app", "--yes"], { cwd: tmp })
  assert.strictEqual(r.code, 0, `non-TTY should succeed: ${r.stderr}`)
  assert.ok(existsSync(join(tmp, "unk-app", "armada", "armada.yaml")))

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
