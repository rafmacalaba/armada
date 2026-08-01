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

test("warns when background subagents flag unset", async () => {
  const binDir = makeBin({ opencode: SH })
  const cfgDir = mkdtempSync(join(tmpdir(), "armada-cfg-"))
  writeFileSync(join(cfgDir, "opencode.json"), JSON.stringify({ plugin: ["x"] }))
  const checks = await runDoctor({ configPath: join(cfgDir, "opencode.json"), env: envWith(binDir) })
  const bg = checks.find((c) => c.name === "background subagents")
  assert.strictEqual(bg.status, "warn")
})

test("fails when opencode missing", async () => {
  const empty = mkdtempSync(join(tmpdir(), "armada-nobin-"))
  const checks = await runDoctor({
    configPath: "/nonexistent.json",
    env: { ...process.env, PATH: empty },
  })
  assert.strictEqual(checks.find((c) => c.name === "opencode CLI").status, "fail")
})
