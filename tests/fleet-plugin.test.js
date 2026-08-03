import { test } from "node:test"
import assert from "node:assert"
import { renderArmadaFleetPlugin } from "../src/generator.js"

test("renderArmadaFleetPlugin starts with header comment", () => {
  const src = renderArmadaFleetPlugin()
  assert.match(src, /^\/\/ opencode-armada fleet plugin/)
})

test("renderArmadaFleetPlugin exports ArmadaFleet", () => {
  const src = renderArmadaFleetPlugin()
  assert.match(src, /export const ArmadaFleet/)
})

test("renderArmadaFleetPlugin contains three handler hooks", () => {
  const src = renderArmadaFleetPlugin()
  assert.match(src, /session\.created/)
  assert.match(src, /session\.idle/)
  assert.match(src, /session\.closed/)
})

test("renderArmadaFleetPlugin contains INTERVAL_MS and 30_000", () => {
  const src = renderArmadaFleetPlugin()
  assert.match(src, /INTERVAL_MS/)
  assert.match(src, /30_000/)
})

test("renderArmadaFleetPlugin imports startHeartbeat, tickHeartbeat, listRuns", () => {
  const src = renderArmadaFleetPlugin()
  assert.match(src, /startHeartbeat/)
  assert.match(src, /tickHeartbeat/)
  assert.match(src, /listRuns/)
  assert.match(src, /getStoreDir/)
  assert.match(src, /\.\.\/\.\.\/\.\.\/src\/heartbeat\.js/)
  assert.match(src, /\.\.\/\.\.\/\.\.\/src\/fleet-tracker\.js/)
})

test("renderArmadaFleetPlugin resolves STORE_DIR from env and homedir", () => {
  const src = renderArmadaFleetPlugin()
  assert.match(src, /process\.env\.ARMADA_RUNS_DIR/)
  assert.match(src, /homedir\(\)/)
  assert.match(src, /\.armada.*runs/)
})

test("renderArmadaFleetPlugin is deterministic for same input", () => {
  const a = renderArmadaFleetPlugin()
  const b = renderArmadaFleetPlugin()
  assert.strictEqual(a, b)
})

test("renderArmadaFleetPlugin has active Map for interval tracking", () => {
  const src = renderArmadaFleetPlugin()
  assert.match(src, /active = new Map/)
})

test("renderArmadaFleetPlugin logs errors as warn level", () => {
  const src = renderArmadaFleetPlugin()
  assert.match(src, /level: "warn"/)
  assert.match(src, /service: "armada-fleet"/)
})
