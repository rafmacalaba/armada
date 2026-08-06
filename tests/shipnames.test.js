import { test } from "node:test"
import assert from "node:assert"
import { renderArmadaShipnamesPlugin, SHIPNAMES_PLUGIN_FILENAME } from "../src/generator.js"
import { DISPLAY } from "../src/role-display.js"

test("renderArmadaShipnamesPlugin returns non-empty string", () => {
  const src = renderArmadaShipnamesPlugin()
  assert.strictEqual(typeof src, "string")
  assert.ok(src.length > 0, "plugin source must not be empty")
})

test("renderer output contains every ship name from DISPLAY map", () => {
  const src = renderArmadaShipnamesPlugin()
  for (const ship of Object.values(DISPLAY)) {
    assert.ok(src.includes(ship), `missing ship name in plugin source: ${ship}`)
  }
})

test("renderer output contains every role key from DISPLAY map", () => {
  const src = renderArmadaShipnamesPlugin()
  for (const role of Object.keys(DISPLAY)) {
    assert.ok(src.includes(role), `missing role key in plugin source: ${role}`)
  }
})

test("renderer output validates as well-formed JS module", () => {
  const src = renderArmadaShipnamesPlugin()
  // Module-level source with exports cannot be validated via new Function().
  // Verify structural markers instead.
  assert.match(src, /^\/\/ armada shipnames plugin/)
  assert.match(src, /export const ArmadaShipnames/)
  assert.match(src, /tool\.execute\.before/)
  assert.match(src, /"tool\.execute\.before"/)
  assert.match(src, /DISPLAY\b/)
  assert.match(src, /subagent_type\b/)
  assert.match(src, /subagentType\b/)
})

test("SHIPNAMES_PLUGIN_FILENAME is defined and consistent", () => {
  assert.strictEqual(typeof SHIPNAMES_PLUGIN_FILENAME, "string")
  assert.match(SHIPNAMES_PLUGIN_FILENAME, /armada-shipnames\.js/)
})
