import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync } from "node:fs"
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
  const checks = await runDoctor({
    env: envWith(binDir, { OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: "true" }),
  })
  assert.deepStrictEqual(checks.map((c) => c.status), ["pass", "pass", "pass", "pass"])
})

test("background dispatch reports the native flag when enabled", async () => {
  const binDir = makeBin({ opencode: SH })
  const checks = await runDoctor({ env: envWith(binDir, { OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: "true" }) })
  const bg = checks.find((c) => c.name === "background dispatch")
  assert.strictEqual(bg.status, "pass")
  assert.match(bg.detail, /OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true/)
})

test("background dispatch stays pass but notes disabled when env unset", async () => {
  const binDir = makeBin({ opencode: SH })
  const checks = await runDoctor({ env: envWith(binDir) })
  const bg = checks.find((c) => c.name === "background dispatch")
  assert.strictEqual(bg.status, "pass")
  assert.match(bg.detail, /disabled/)
})

test("fails when opencode missing", async () => {
  const empty = mkdtempSync(join(tmpdir(), "armada-nobin-"))
  const checks = await runDoctor({ env: { ...process.env, PATH: empty } })
  assert.deepStrictEqual(
    checks.map((c) => ({ name: c.name, status: c.status })),
    [
      { name: "opencode CLI", status: "fail" },
      { name: "providers auth", status: "fail" },
      { name: "background dispatch", status: "pass" },
      { name: "node", status: "pass" },
    ]
  )
})
