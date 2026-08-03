import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runDoctor } from "../src/doctor.js"
import { makeBin } from "./helpers.js"

const SH = "#!/bin/sh\ncase \"$1\" in\n  --version) echo 1.18.11 ;;\n  auth) echo openrouter ;;\n  *) echo ok ;;\nesac\n"

function envWith(binDir, extra = {}) {
  return { ...process.env, PATH: `${binDir}:${process.env.PATH}`, ...extra }
}

test("all checks pass on healthy env", async () => {
  const binDir = makeBin({ opencode: SH, armada: "#!/bin/sh\necho v0.6.2\n" })
  const checks = await runDoctor({
    env: envWith(binDir, { OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: "true" }),
  })
  assert.deepStrictEqual(checks.map((c) => c.status), ["pass", "pass", "pass", "pass", "pass", "pass"])
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
      { name: "global armada binary", status: "fail" },
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

test("global armada binary pass when resolvable", async () => {
  const binDir = makeBin({ opencode: SH, armada: "#!/bin/sh\necho v0.6.2\n" })
  const checks = await runDoctor({
    env: envWith(binDir, { OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: "true" }),
  })
  const ga = checks.find((c) => c.name === "global armada binary")
  assert.strictEqual(ga.status, "pass")
  assert.match(ga.detail, /v0\.6\.2/)
})

test("global armada binary fail when missing", async () => {
  const empty = mkdtempSync(join(tmpdir(), "armada-nobin-"))
  const checks = await runDoctor({ env: { ...process.env, PATH: empty } })
  const ga = checks.find((c) => c.name === "global armada binary")
  assert.strictEqual(ga.status, "fail")
  assert.match(ga.detail, /npm link|~\/WBG\/opencode-armada/)
})

test("global armada binary fail on broken symlink", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "armada-broken-"))
  const target = join(tmp, "nonexistent-cli.js")
  const link = join(tmp, "armada")
  symlinkSync(target, link)
  const checks = await runDoctor({ env: { ...process.env, PATH: `${tmp}:${process.env.PATH}` } })
  const ga = checks.find((c) => c.name === "global armada binary")
  assert.strictEqual(ga.status, "fail")
  assert.match(ga.detail, /npm link|~\/WBG\/opencode-armada/)
})

test("global armada binary resolves a valid two-hop symlink chain", async () => {
  const dirA = mkdtempSync(join(tmpdir(), "armada-hop-a-"))
  const dirB = mkdtempSync(join(tmpdir(), "armada-hop-b-"))
  const realScript = join(dirB, "cli.js")
  writeFileSync(realScript, "#!/bin/sh\necho v0.6.2\n", { mode: 0o755 })
  symlinkSync(realScript, join(dirA, "armada"))
  const checks = await runDoctor({ env: { ...process.env, PATH: `${dirA}:${process.env.PATH}` } })
  const ga = checks.find((c) => c.name === "global armada binary")
  assert.strictEqual(ga.status, "pass")
  assert.match(ga.detail, /v0\.6\.2/)
})
