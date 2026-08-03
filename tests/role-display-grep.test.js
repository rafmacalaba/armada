import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { renderInitSummary } from "../src/init-summary.js"
import { renderCatalog } from "../src/model-catalog.js"

const DISPLAY_NAMES = [
  "Commodore",
  "Galleon",
  "Clipper",
  "Corvette",
  "Xebec",
  "Frigate",
  "Caravel",
  "Bark",
]

const ROLE_KEYS = [
  "orchestrator",
  "backend-dev",
  "frontend-dev",
  "qa",
  "adversary",
  "security",
  "docs",
  "architect",
]

const allRolesManifest = {
  project: { name: "test", budget: "balanced" },
  team: [
    { role: "orchestrator", model: "opencode-go/minimax-m3", enabled: true },
    { role: "backend-dev", model: "opencode-go/deepseek-v4-pro", enabled: true },
    { role: "frontend-dev", model: "opencode-go/minimax-m3", enabled: true },
    { role: "qa", model: "opencode/mimo-v2.5-free", enabled: true },
    { role: "adversary", model: "opencode-go/deepseek-v4-pro", enabled: true },
    { role: "security", model: "opencode/big-pickle", enabled: true },
    { role: "docs", model: "opencode/deepseek-v4-flash-free", enabled: true },
    { role: "architect", model: "opencode/big-pickle", enabled: true },
  ],
}

describe("Phase 2 grep: init summary uses display names, not role keys", () => {
  const out = renderInitSummary(allRolesManifest)

  it("contains all 8 display names in roster lines", () => {
    for (const name of DISPLAY_NAMES) {
      assert.ok(out.includes(`  ${name}:`), `init summary missing display name "${name}"`)
    }
  })

  it("does NOT contain bare role keys as the roster column label", () => {
    for (const key of ROLE_KEYS) {
      assert.ok(
        !out.includes(`  ${key}: `) && !out.includes(`  ${key}:`),
        `init summary contains bare role key "${key}" as column label`
      )
    }
  })
})

describe("Phase 2 grep: renderCatalog uses display names, not role keys", () => {
  const out = renderCatalog("balanced")

  it("contains all 8 display names in first column", () => {
    for (const name of DISPLAY_NAMES) {
      const padded = name.padEnd(Math.max("display name".length, name.length))
      assert.ok(out.includes(padded), `catalog missing display name "${name}"`)
    }
  })

  it("header column is 'display name' not 'role'", () => {
    assert.ok(out.startsWith("display name"), `catalog header should be 'display name', got: ${out.split("\n")[0]}`)
  })

  it("does NOT contain bare role keys as first-column data", () => {
      for (const key of ROLE_KEYS) {
        // Look for the key padded to column width — it would appear as left-aligned column data
        // Key followed by spaces then "  " (the gutter) means it's a first-column value
        const paddedPattern = key.padEnd(Math.max("display name".length, key.length))
        assert.ok(
          !out.includes(paddedPattern),
          `catalog contains bare role key "${key}" as column data`
        )
      }
    })
})

describe("p_rename: old navy-rank names absent from catalog output", () => {
  const OLD_NAMES = [
    "captain",
    "engineer",
    "navigator",
    "dockmaster",
    "raider",
    "sentry",
    "scribe",
    "naval architect",
  ]

  const out = renderCatalog("balanced")

  it("contains all 8 new vessel names in first column", () => {
    for (const name of DISPLAY_NAMES) {
      const padded = name.padEnd(Math.max("display name".length, name.length))
      assert.ok(out.includes(padded), `catalog missing new display name "${name}"`)
    }
  })

  it("does NOT contain any of the 8 old navy-rank names as column labels", () => {
    for (const old of OLD_NAMES) {
      const padded = old.padEnd(Math.max("display name".length, old.length))
      assert.ok(
        !out.includes(padded),
        `catalog still contains old display name "${old}" as column label`
      )
    }
  })
})
