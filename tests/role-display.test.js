import { test } from "node:test"
import assert from "node:assert"
import { DISPLAY, ROLES, displayFor, agentNameFor, roleForAgentName, prefixForRole } from "../src/role-display.js"

// --- roleForAgentName ---

test("roleForAgentName maps every ship name back to its role", () => {
  for (const [role, ship] of Object.entries(DISPLAY)) {
    assert.strictEqual(roleForAgentName(ship.toLowerCase()), role,
      `ship "${ship.toLowerCase()}" should map to role "${role}"`)
  }
})

test("roleForAgentName is case-insensitive", () => {
  assert.strictEqual(roleForAgentName("Galleon"), "backend-dev")
  assert.strictEqual(roleForAgentName("GALLEON"), "backend-dev")
  assert.strictEqual(roleForAgentName("galleon"), "backend-dev")
})

test("roleForAgentName returns null for unknown ship name", () => {
  assert.strictEqual(roleForAgentName("not-a-ship"), null)
})

test("roleForAgentName returns null for empty string", () => {
  assert.strictEqual(roleForAgentName(""), null)
})

test("roleForAgentName returns null for non-string inputs", () => {
  assert.strictEqual(roleForAgentName(null), null)
  assert.strictEqual(roleForAgentName(42), null)
  assert.strictEqual(roleForAgentName(undefined), null)
})

// --- prefixForRole ---

test("prefixForRole returns correct prefix for known roles", () => {
  assert.strictEqual(prefixForRole("backend-dev"), "Galleon [backend-dev]")
  assert.strictEqual(prefixForRole("orchestrator"), "Commodore [orchestrator]")
})

test("prefixForRole throws on unknown role", () => {
  assert.throws(() => prefixForRole("does-not-exist"), (err) => {
    assert.ok(err instanceof Error)
    assert.ok(err.message.includes("Unknown role"))
    return true
  })
})

// --- Round-trip ---

test("prefixForRole + roleForAgentName + agentNameFor round-trip for all roles", () => {
  for (const role of ROLES) {
    const shipName = agentNameFor(role)
    const mappedRole = roleForAgentName(shipName)
    assert.strictEqual(mappedRole, role,
      `roleForAgentName("${shipName}") should map back to "${role}"`)
    assert.strictEqual(prefixForRole(mappedRole), prefixForRole(role))
  }
})

// --- Existing exports ---

test("existing exports DISPLAY, ROLES, displayFor, agentNameFor are unchanged", () => {
  assert.ok(typeof DISPLAY === "object")
  assert.ok(Array.isArray(ROLES))
  assert.strictEqual(ROLES.length, 8)
  assert.strictEqual(displayFor("backend-dev"), "Galleon")
  assert.strictEqual(agentNameFor("backend-dev"), "galleon")
  assert.strictEqual(agentNameFor("orchestrator"), "commodore")
})
