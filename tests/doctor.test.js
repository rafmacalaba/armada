import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runDoctor } from "../src/doctor.js"
import { makeBin } from "./helpers.js"

const SH = "#!/bin/sh\ncase \"$1\" in\n  --version) echo 1.18.11 ;;\n  auth) echo openrouter ;;\n  *) echo ok ;;\nesac\n"

function envWith(binDir, extra = {}) {
  return { ...process.env, PATH: `${binDir}:${process.env.PATH}`, ...extra }
}

test("all checks pass on healthy env", async () => {
  const binDir = makeBin({ opencode: SH })
  const checks = await runDoctor({
    env: envWith(binDir, { OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: "true" }),
  })
  assert.deepStrictEqual(checks.map((c) => c.status), ["pass", "pass", "pass", "pass", "pass"])
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
      { name: "openrouter auth", status: "fail" },
      { name: "background dispatch", status: "pass" },
      { name: "node", status: "pass" },
    ]
  )
})

test("openrouter auth passes when credential present", async () => {
  const binDir = makeBin({ opencode: SH })
  const checks = await runDoctor({ env: envWith(binDir) })
  const or = checks.find((c) => c.name === "openrouter auth")
  assert.strictEqual(or.status, "pass")
  assert.match(or.detail, /openrouter/i)
})

test("openrouter auth fails when missing with remediation", async () => {
  const binDir = makeBin({ opencode: "#!/bin/sh\necho nope\n" })
  const checks = await runDoctor({ env: envWith(binDir) })
  const or = checks.find((c) => c.name === "openrouter auth")
  assert.strictEqual(or.status, "fail")
  assert.match(or.detail, /openrouter|OPENROUTER_API_KEY/i)
})

test("supervision plugin check only when enabled", async () => {
  const binDir = makeBin({ opencode: SH })
  const dir = mkdtempSync(join(tmpdir(), "armada-dr-sup-"))
  // not enabled -> no check emitted
  let checks = await runDoctor({ env: envWith(binDir), project: { supervision: { plugin: false } }, targetDir: dir })
  assert.ok(!checks.some((c) => c.name === "supervision plugin"))
  // enabled but file missing -> fail
  checks = await runDoctor({ env: envWith(binDir), project: { supervision: { plugin: true } }, targetDir: dir })
  const missing = checks.find((c) => c.name === "supervision plugin")
  assert.strictEqual(missing.status, "fail")
  assert.match(missing.detail, /re-run armada init/)
  // enabled + file present -> pass
  mkdirSync(join(dir, ".opencode/plugins"), { recursive: true })
  writeFileSync(join(dir, ".opencode/plugins/armada-supervision.js"), "// plugin")
  checks = await runDoctor({ env: envWith(binDir), project: { supervision: { plugin: true } }, targetDir: dir })
  const present = checks.find((c) => c.name === "supervision plugin")
  assert.strictEqual(present.status, "pass")
})

test("fleet tracker plugin check only when enabled", async () => {
  const binDir = makeBin({ opencode: SH })
  const dir = mkdtempSync(join(tmpdir(), "armada-dr-flt-"))
  // not enabled -> no check emitted
  let checks = await runDoctor({ env: envWith(binDir), project: { supervision: { fleet: false } }, targetDir: dir })
  assert.ok(!checks.some((c) => c.name === "fleet tracker plugin"))
  // enabled but file missing -> fail
  checks = await runDoctor({ env: envWith(binDir), project: { supervision: { fleet: true } }, targetDir: dir })
  const missing = checks.find((c) => c.name === "fleet tracker plugin")
  assert.strictEqual(missing.status, "fail")
  assert.match(missing.detail, /re-run armada init/)
  // enabled + file present -> pass
  mkdirSync(join(dir, ".opencode/plugins"), { recursive: true })
  writeFileSync(join(dir, ".opencode/plugins/armada-fleet.js"), "// plugin")
  checks = await runDoctor({ env: envWith(binDir), project: { supervision: { fleet: true } }, targetDir: dir })
  const present = checks.find((c) => c.name === "fleet tracker plugin")
  assert.strictEqual(present.status, "pass")
})
