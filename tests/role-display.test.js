import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(__dirname, "..", "src", "role-display.js")

const DISPLAY_MAP = {
  orchestrator: "Commodore",
  "backend-dev": "Galleon",
  "frontend-dev": "Clipper",
  qa: "Corvette",
  adversary: "Xebec",
  security: "Frigate",
  docs: "Caravel",
  architect: "Bark",
}

const ROLES = Object.keys(DISPLAY_MAP)

describe("role-display module", () => {
  let mod

  it("loads without error", async () => {
    mod = await import(SRC)
  })

  it("exports DISPLAY frozen map with all 8 roles", () => {
    assert.ok(mod.DISPLAY, "DISPLAY export missing")
    assert.ok(Object.isFrozen(mod.DISPLAY), "DISPLAY not frozen")
    assert.equal(Object.keys(mod.DISPLAY).length, 8, "DISPLAY should have exactly 8 keys")
    for (const [role, expected] of Object.entries(DISPLAY_MAP)) {
      assert.equal(mod.DISPLAY[role], expected, `${role} -> ${expected}`)
    }
  })

  it("exports displayFor() that returns correct display names", () => {
    for (const role of ROLES) {
      assert.equal(mod.displayFor(role), DISPLAY_MAP[role], `displayFor("${role}")`)
    }
  })

  it("displayFor() throws on unknown role", () => {
    assert.throws(() => mod.displayFor("pirate"), /Unknown role/)
    assert.throws(() => mod.displayFor(""), /Unknown role/)
    assert.throws(() => mod.displayFor("ORCHESTRATOR"), /Unknown role/)
  })

  it("exports ROLES array with all 8 role keys", () => {
    assert.ok(Array.isArray(mod.ROLES), "ROLES export missing or not array")
    assert.equal(mod.ROLES.length, 8, "ROLES should have exactly 8 entries")
    const sorted = [...mod.ROLES].sort()
    assert.deepEqual(sorted, [...ROLES].sort(), "ROLES keys mismatch")
  })

  it("is pure: no I/O imports in source", () => {
    const srcText = readFileSync(SRC, "utf8")
    const ioModules = ["node:fs", "node:os", "node:path", "node:child_process", "node:net", "node:http", "node:dns"]
    for (const mod of ioModules) {
      assert.ok(
        !srcText.includes(`from "${mod}"`) && !srcText.includes(`require("${mod}")`),
        `source imports ${mod} — module is not pure`
      )
    }
  })

  it("is pure: no side-effect imports that touch filesystem", () => {
    const srcText = readFileSync(SRC, "utf8")
    // No 'import' that isn't from a local module (relative path only)
    const importLines = srcText.split("\n").filter(l => l.trim().startsWith("import "))
    for (const line of importLines) {
      const match = line.match(/from\s+["']([^"']+)["']/)
      if (match) {
        const src = match[1]
        assert.ok(
          src.startsWith("./") || src.startsWith("../"),
          `non-relative import found: ${src}`
        )
      }
    }
  })

  it("is pure: loads without side effects in a clean eval", async () => {
    // Dynamically import twice — second load should be cached and produce same result
    const mod2 = await import(SRC)
    assert.strictEqual(mod2.displayFor("orchestrator"), "Commodore")
    assert.strictEqual(mod2.DISPLAY, mod.DISPLAY, "multiple imports produce same DISPLAY object")
  })

  it("exports agentNameFor as a function", () => {
    assert.ok(mod.agentNameFor, "agentNameFor export missing")
    assert.equal(typeof mod.agentNameFor, "function", "agentNameFor is not a function")
  })

  it("agentNameFor returns lowercase display name for every role", () => {
    for (const role of ROLES) {
      assert.equal(
        mod.agentNameFor(role),
        DISPLAY_MAP[role].toLowerCase(),
        `agentNameFor("${role}") should be "${DISPLAY_MAP[role].toLowerCase()}"`
      )
    }
  })

  it("agentNameFor returns all 8 expected ship names literally", () => {
    const expected = {
      orchestrator: "commodore",
      "backend-dev": "galleon",
      "frontend-dev": "clipper",
      qa: "corvette",
      adversary: "xebec",
      security: "frigate",
      docs: "caravel",
      architect: "bark",
    }
    for (const [role, ship] of Object.entries(expected)) {
      assert.equal(mod.agentNameFor(role), ship, `agentNameFor("${role}") expected "${ship}"`)
    }
  })

  it("agentNameFor throws on unknown role", () => {
    assert.throws(() => mod.agentNameFor("pirate"), /Unknown role/)
    assert.throws(() => mod.agentNameFor(""), /Unknown role/)
  })
})
