import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runDoctor, checkModelDrift, checkCatalogConsistency } from "../src/doctor.js"
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
  assert.deepStrictEqual(checks.map((c) => c.status), ["pass", "pass", "pass", "pass", "pass", "pass", "pass", "pass", "pass"])
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
      { name: "opencode version range", status: "fail" },
      { name: "providers auth", status: "fail" },
      { name: "openrouter auth", status: "fail" },
      { name: "background dispatch", status: "pass" },
      { name: "node", status: "pass" },
      { name: "global armada binary", status: "fail" },
      { name: "team roster", status: "pass" },
      { name: "catalog consistency", status: "pass" },
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

test("fleet tracker plugin check when explicitly disabled", async () => {
  const binDir = makeBin({ opencode: SH })
  const dir = mkdtempSync(join(tmpdir(), "armada-dr-flt-"))
  // explicitly disabled -> check emitted with pass/disabled status
  let checks = await runDoctor({ env: envWith(binDir), project: { supervision: { fleet: false } }, targetDir: dir })
  const disabledCheck = checks.find((c) => c.name === "fleet tracker plugin")
  assert.ok(disabledCheck, "check present when fleet is explicitly false")
  assert.strictEqual(disabledCheck.status, "pass")
  assert.match(disabledCheck.detail, /disabled by user/)
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

test("watchdog plugin check only when enabled", async () => {
  const binDir = makeBin({ opencode: SH })
  const dir = mkdtempSync(join(tmpdir(), "armada-dr-wd-"))
  // not enabled -> no check emitted
  let checks = await runDoctor({ env: envWith(binDir), project: { supervision: { watchdog: false } }, targetDir: dir })
  assert.ok(!checks.some((c) => c.name === "watchdog plugin"))
  // enabled but file missing -> fail
  checks = await runDoctor({ env: envWith(binDir), project: { supervision: { watchdog: true } }, targetDir: dir })
  const missing = checks.find((c) => c.name === "watchdog plugin")
  assert.strictEqual(missing.status, "fail")
  assert.match(missing.detail, /re-run armada init/)
  // enabled + file present -> pass
  mkdirSync(join(dir, ".opencode/plugins"), { recursive: true })
  writeFileSync(join(dir, ".opencode/plugins/armada-watchdog.js"), "// plugin")
  checks = await runDoctor({ env: envWith(binDir), project: { supervision: { watchdog: true } }, targetDir: dir })
  const present = checks.find((c) => c.name === "watchdog plugin")
  assert.strictEqual(present.status, "pass")
})

test("shipnames plugin check pass when present and valid", async () => {
  const binDir = makeBin({ opencode: SH })
  const dir = mkdtempSync(join(tmpdir(), "armada-dr-sn-"))
  mkdirSync(join(dir, ".opencode/plugins"), { recursive: true })
  writeFileSync(join(dir, ".opencode/plugins/armada-shipnames.js"), "export const ArmadaShipnames = async ({ client }) => ({ 'tool.execute.before': async () => {} })\n")
  const checks = await runDoctor({
    env: envWith(binDir),
    project: { supervision: { shipnames: true } },
    targetDir: dir,
  })
  const sn = checks.find((c) => c.name === "shipnames plugin")
  assert.ok(sn, "shipnames plugin check present")
  assert.strictEqual(sn.status, "pass")
})

test("shipnames plugin check fail when present but unparseable", async () => {
  const binDir = makeBin({ opencode: SH })
  const dir = mkdtempSync(join(tmpdir(), "armada-dr-sn2-"))
  mkdirSync(join(dir, ".opencode/plugins"), { recursive: true })
  writeFileSync(join(dir, ".opencode/plugins/armada-shipnames.js"), "// corrupted file\n")
  const checks = await runDoctor({
    env: envWith(binDir),
    project: { supervision: { shipnames: true } },
    targetDir: dir,
  })
  const sn = checks.find((c) => c.name === "shipnames plugin")
  assert.ok(sn, "shipnames plugin check present")
  assert.strictEqual(sn.status, "fail")
})

test("shipnames plugin check skip when file absent", async () => {
  const binDir = makeBin({ opencode: SH })
  const dir = mkdtempSync(join(tmpdir(), "armada-dr-sn3-"))
  const checks = await runDoctor({
    env: envWith(binDir),
    project: { supervision: { shipnames: true } },
    targetDir: dir,
  })
  const sn = checks.find((c) => c.name === "shipnames plugin")
  assert.ok(sn, "shipnames plugin check present")
  assert.strictEqual(sn.status, "skip")
})

test("no shipnames plugin check when supervision absent", async () => {
  const binDir = makeBin({ opencode: SH })
  const dir = mkdtempSync(join(tmpdir(), "armada-dr-sn4-"))
  const checks = await runDoctor({
    env: envWith(binDir),
    project: { supervision: { fleet: true } },
    targetDir: dir,
  })
  assert.ok(!checks.some((c) => c.name === "shipnames plugin"), "no shipnames check when not enabled")
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
  assert.match(ga.detail, /npm link|~\/WBG\/armada/)
})

test("global armada binary handles broken and valid symlink chains", async () => {
  // broken symlink
  const tmp = mkdtempSync(join(tmpdir(), "armada-broken-"))
  symlinkSync(join(tmp, "nonexistent-cli.js"), join(tmp, "armada"))
  let checks = await runDoctor({ env: { ...process.env, PATH: `${tmp}:${process.env.PATH}` } })
  let ga = checks.find((c) => c.name === "global armada binary")
  assert.strictEqual(ga.status, "fail")
  assert.match(ga.detail, /npm link|~\/WBG\/armada/)

  // valid two-hop symlink
  const dirA = mkdtempSync(join(tmpdir(), "armada-hop-a-"))
  const dirB = mkdtempSync(join(tmpdir(), "armada-hop-b-"))
  writeFileSync(join(dirB, "cli.js"), "#!/bin/sh\necho v0.6.2\n", { mode: 0o755 })
  symlinkSync(join(dirB, "cli.js"), join(dirA, "armada"))
  checks = await runDoctor({ env: { ...process.env, PATH: `${dirA}:${process.env.PATH}` } })
  ga = checks.find((c) => c.name === "global armada binary")
  assert.strictEqual(ga.status, "pass")
  assert.match(ga.detail, /v0\.6\.2/)
})

test("team roster check appears with display names when team is provided", async () => {
  const binDir = makeBin({ opencode: SH })
  const team = [
    { role: "orchestrator", model: "opencode-go/minimax-m3", enabled: true },
    { role: "backend-dev", model: "opencode-go/deepseek-v4-pro", enabled: true },
  ]
  const checks = await runDoctor({ env: envWith(binDir), team })
  const roster = checks.find((c) => c.name === "team roster")
  assert.strictEqual(roster.status, "pass")
  assert.match(roster.detail, /Commodore: opencode-go\/minimax-m3/)
  assert.match(roster.detail, /Galleon: opencode-go\/deepseek-v4-pro/)
  assert.ok(!roster.detail.includes("orchestrator:"), "roster must not contain bare role key orchestrator:")
  assert.ok(!roster.detail.includes("backend-dev:"), "roster must not contain bare role key backend-dev:")
})

test("team roster shows 'no team' when team is empty or not provided", async () => {
  const binDir = makeBin({ opencode: SH })
  let checks = await runDoctor({ env: envWith(binDir) })
  let roster = checks.find((c) => c.name === "team roster")
  assert.strictEqual(roster.status, "pass")
  assert.strictEqual(roster.detail, "no team")

  checks = await runDoctor({ env: envWith(binDir), team: [] })
  roster = checks.find((c) => c.name === "team roster")
  assert.strictEqual(roster.status, "pass")
  assert.strictEqual(roster.detail, "no team")
})

test("team roster omits disabled roles", async () => {
  const binDir = makeBin({ opencode: SH })
  const team = [
    { role: "orchestrator", model: "opencode-go/minimax-m3", enabled: true },
    { role: "security", model: "opencode/big-pickle", enabled: false },
  ]
  const checks = await runDoctor({ env: envWith(binDir), team })
  const roster = checks.find((c) => c.name === "team roster")
  assert.match(roster.detail, /Commodore: opencode-go\/minimax-m3/)
  assert.ok(!roster.detail.includes("Frigate:"), "roster must omit disabled Frigate role")
  assert.ok(!roster.detail.includes("security:"), "roster must omit disabled security role")
})

test("model-drift pass when all frontmatters match armada.yaml", async () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-dr-drift-"))
  mkdirSync(join(dir, "armada"), { recursive: true })
  mkdirSync(join(dir, ".opencode", "agent"), { recursive: true })

  writeFileSync(join(dir, "armada", "armada.yaml"), [
    "project:",
    "  name: test",
    "  budget: balanced",
    "team:",
    "  - role: orchestrator",
    "    model: opencode-go/minimax-m3",
    "    enabled: true",
    "  - role: backend-dev",
    "    model: opencode-go/deepseek-v4-pro",
    "    enabled: true",
  ].join("\n"))
  writeFileSync(join(dir, ".opencode", "agent", "commodore.md"), [
    "---",
    "model: opencode-go/minimax-m3",
    "mode: Orchestrator",
    "---",
    "# prompt",
  ].join("\n"))
  writeFileSync(join(dir, ".opencode", "agent", "galleon.md"), [
    "---",
    "model: opencode-go/deepseek-v4-pro",
    "mode: Backend",
    "---",
    "# prompt",
  ].join("\n"))

  const results = await checkModelDrift(dir)
  assert.strictEqual(results.length, 1)
  assert.strictEqual(results[0].name, "model-drift")
  assert.strictEqual(results[0].status, "pass")
  assert.match(results[0].detail, /all role frontmatters match/)
})

test("model-drift warn when frontmatter model differs from armada.yaml", async () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-dr-drift2-"))
  mkdirSync(join(dir, "armada"), { recursive: true })
  mkdirSync(join(dir, ".opencode", "agent"), { recursive: true })

  writeFileSync(join(dir, "armada", "armada.yaml"), [
    "project:",
    "  name: test",
    "  budget: balanced",
    "team:",
    "  - role: orchestrator",
    "    model: opencode-go/minimax-m3",
    "    enabled: true",
  ].join("\n"))
  writeFileSync(join(dir, ".opencode", "agent", "commodore.md"), [
    "---",
    "model: oldprovider/old-model",
    "mode: Orchestrator",
    "---",
    "# prompt",
  ].join("\n"))

  const results = await checkModelDrift(dir)
  assert.strictEqual(results.length, 1)
  assert.strictEqual(results[0].name, "model-drift")
  assert.strictEqual(results[0].status, "warn")
  assert.match(results[0].detail, /armada\.yaml says "opencode-go\/minimax-m3" but/)
  assert.match(results[0].detail, /commodore\.md says "oldprovider\/old-model"/)
})

test("model-drift warn when agent file is missing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-dr-drift3-"))
  mkdirSync(join(dir, "armada"), { recursive: true })
  mkdirSync(join(dir, ".opencode", "agent"), { recursive: true })

  writeFileSync(join(dir, "armada", "armada.yaml"), [
    "project:",
    "  name: test",
    "  budget: balanced",
    "team:",
    "  - role: backend-dev",
    "    model: opencode-go/deepseek-v4-pro",
    "    enabled: true",
  ].join("\n"))
  // intentionally no galleon.md file

  const results = await checkModelDrift(dir)
  assert.strictEqual(results.length, 1)
  assert.strictEqual(results[0].name, "model-drift")
  assert.strictEqual(results[0].status, "warn")
  assert.match(results[0].detail, /galleon\.md not found/)
})

test("model-drift skips disabled roles", async () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-dr-drift4-"))
  mkdirSync(join(dir, "armada"), { recursive: true })
  mkdirSync(join(dir, ".opencode", "agent"), { recursive: true })

  writeFileSync(join(dir, "armada", "armada.yaml"), [
    "project:",
    "  name: test",
    "  budget: balanced",
    "team:",
    "  - role: orchestrator",
    "    model: opencode-go/minimax-m3",
    "    enabled: true",
    "  - role: security",
    "    model: opencode/big-pickle",
    "    enabled: false",
  ].join("\n"))
  writeFileSync(join(dir, ".opencode", "agent", "commodore.md"), [
    "---",
    "model: opencode-go/minimax-m3",
    "mode: Orchestrator",
    "---",
    "# prompt",
  ].join("\n"))
  // no frigate.md intentionally, but security is disabled so shouldn't matter

  const results = await checkModelDrift(dir)
  assert.strictEqual(results.length, 1)
  assert.strictEqual(results[0].name, "model-drift")
  assert.strictEqual(results[0].status, "pass")
})

test("global armada binary uses PATH when selfPath not provided", async () => {
  const binDir = makeBin({ opencode: SH, armada: "#!/bin/sh\necho v0.6.2\n" })
  const checks = await runDoctor({
    env: envWith(binDir),
  })
  const ga = checks.find((c) => c.name === "global armada binary")
  assert.strictEqual(ga.status, "pass")
  assert.match(ga.detail, /v0\.6\.2/)
})

test("global armada binary uses selfPath when provided", async () => {
  const binDir = makeBin({ opencode: SH })
  const tmp = mkdtempSync(join(tmpdir(), "armada-selfpath-"))
  writeFileSync(
    join(tmp, "cli.js"),
    "#!/usr/bin/env node\nif (process.argv.includes('--version')) { console.log('v2.0.0'); process.exit(0); }\nconsole.log('unknown');\n",
    { mode: 0o755 }
  )
  const checks = await runDoctor({
    env: envWith(binDir),
    selfPath: join(tmp, "cli.js"),
  })
  const ga = checks.find((c) => c.name === "global armada binary")
  assert.strictEqual(ga.status, "pass")
  assert.match(ga.detail, /v2\.0\.0/)
})

test("opencode version range check parametrized", async () => {
  for (const [label, versionOut, expectedStatus, expectedDetail] of [
    ["supported", "1.18.11", "pass", /within supported range/],
    ["unsupported", "1.17.0", "fail", /unsupported/],
    ["unparseable", "error", "fail", /unrecognized version format/],
    ["minimum", "1.18.0", "pass", /within supported range/],
    ["newer major", "2.1.0", "pass", /2\.1\.0/],
  ]) {
    const binDir = makeBin({
      opencode: `#!/bin/sh\necho ${versionOut}\n`,
      armada: "#!/bin/sh\necho v0.6.2\n",
    })
    const extra = label === "supported" ? { OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: "true" } : {}
    const checks = await runDoctor({ env: envWith(binDir, extra) })
    const vr = checks.find((c) => c.name === "opencode version range")
    assert.strictEqual(vr.status, expectedStatus, `version ${label} -> ${expectedStatus}`)
    assert.match(vr.detail, expectedDetail)
  }
})

test("catalog consistency passes via doctor and direct check", async () => {
  // via runDoctor
  const binDir = makeBin({ opencode: SH, armada: "#!/bin/sh\necho v0.6.2\n" })
  const checks = await runDoctor({ env: envWith(binDir) })
  const cc = checks.find((c) => c.name === "catalog consistency")
  assert.strictEqual(cc.status, "pass")
  assert.match(cc.detail, /all roles have valid/)
  // direct check
  const results = checkCatalogConsistency()
  assert.strictEqual(results.length, 1)
  assert.strictEqual(results[0].name, "catalog consistency")
  assert.strictEqual(results[0].status, "pass")
})


