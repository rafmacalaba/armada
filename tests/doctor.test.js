import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runDoctor } from "../src/doctor.js"
import { makeBin } from "./helpers.js"

const SH = "#!/bin/sh\ncase \"$1\" in\n  --version) echo 1.18.11 ;;\n  *) echo ok ;;\nesac\n"

function envWith(binDir, extra = {}) {
  return { ...process.env, PATH: `${binDir}:${process.env.PATH}`, ...extra }
}

test("all checks pass on healthy env", async () => {
  const binDir = makeBin({ opencode: SH })
  const cfgDir = mkdtempSync(join(tmpdir(), "armada-cfg-"))
  writeFileSync(join(cfgDir, "opencode.json"),
    JSON.stringify({ plugin: ["./plugins/oh-my-opencode-slim/plugin.js"] }))
  const checks = await runDoctor({
    configPath: join(cfgDir, "opencode.json"),
    env: envWith(binDir, { OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: "true" }),
  })
  assert.deepStrictEqual(checks.map((c) => c.status), ["pass", "pass", "pass", "pass", "pass"])
})

test("fails when omo-slim plugin missing", async () => {
  const binDir = makeBin({ opencode: SH })
  const cfgDir = mkdtempSync(join(tmpdir(), "armada-cfg-"))
  writeFileSync(join(cfgDir, "opencode.json"), JSON.stringify({ plugin: [] }))
  const checks = await runDoctor({
    configPath: join(cfgDir, "opencode.json"),
    env: envWith(binDir, { OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: "true" }),
  })
  const plugin = checks.find((c) => c.name === "omo-slim plugin")
  assert.strictEqual(plugin.status, "fail")
})

test("background dispatch reports omo-slim responsible", async () => {
  const binDir = makeBin({ opencode: SH })
  const cfgDir = mkdtempSync(join(tmpdir(), "armada-cfg-"))
  writeFileSync(join(cfgDir, "opencode.json"), JSON.stringify({ plugin: ["./plugins/oh-my-opencode-slim/plugin.js"] }))
  const checks = await runDoctor({ configPath: join(cfgDir, "opencode.json"), env: envWith(binDir) })
  const bg = checks.find((c) => c.name === "background dispatch")
  assert.strictEqual(bg.status, "pass")
  assert.match(bg.detail, /omo-slim/)
})

test("background dispatch fails when omo-slim plugin missing", async () => {
  const binDir = makeBin({ opencode: SH })
  const cfgDir = mkdtempSync(join(tmpdir(), "armada-cfg-"))
  writeFileSync(join(cfgDir, "opencode.json"), JSON.stringify({ plugin: [] }))
  const checks = await runDoctor({
    configPath: join(cfgDir, "opencode.json"),
    env: envWith(binDir, { OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: "true" }),
  })
  const bg = checks.find((c) => c.name === "background dispatch")
  assert.strictEqual(bg.status, "fail")
})

test("background dispatch reports native flag when env enabled", async () => {
  const binDir = makeBin({ opencode: SH })
  const cfgDir = mkdtempSync(join(tmpdir(), "armada-cfg-"))
  writeFileSync(join(cfgDir, "opencode.json"), JSON.stringify({ plugin: ["./plugins/oh-my-opencode-slim/plugin.js"] }))
  const checks = await runDoctor({
    configPath: join(cfgDir, "opencode.json"),
    env: envWith(binDir, { OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: "true" }),
  })
  const bg = checks.find((c) => c.name === "background dispatch")
  assert.strictEqual(bg.status, "pass")
  assert.match(bg.detail, /OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS/)
})

test("fails when opencode missing", async () => {
  const empty = mkdtempSync(join(tmpdir(), "armada-nobin-"))
  const checks = await runDoctor({
    configPath: "/nonexistent.json",
    env: { ...process.env, PATH: empty },
  })
  assert.deepStrictEqual(
    checks.map((c) => ({ name: c.name, status: c.status })),
    [
      { name: "opencode CLI", status: "fail" },
      { name: "providers auth", status: "fail" },
      { name: "omo-slim plugin", status: "fail" },
      { name: "background dispatch", status: "fail" },
      { name: "node", status: "pass" },
    ]
  )
})

test("strips JSONC comments from opencode.json", async () => {
  const binDir = makeBin({ opencode: SH })
  const cfgDir = mkdtempSync(join(tmpdir(), "armada-cfg-"))
  writeFileSync(join(cfgDir, "opencode.json"), `{
    // this is a comment
    "plugin": ["./plugins/oh-my-opencode-slim/plugin.js"]
    /* block comment */
  }`)
  const checks = await runDoctor({
    configPath: join(cfgDir, "opencode.json"),
    env: envWith(binDir),
  })
  const plugin = checks.find((c) => c.name === "omo-slim plugin")
  assert.strictEqual(plugin.status, "pass")
})
