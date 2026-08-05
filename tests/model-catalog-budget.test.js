import { test } from "node:test"
import assert from "node:assert"
import { CATALOG, ROLES, modelFor, fallbackFor, BUDGETS } from "../src/model-catalog.js"

test("all 8 roles are in CATALOG", () => {
  for (const role of ROLES) {
    assert.ok(CATALOG[role], `CATALOG must contain entry for ${role}`)
  }
})

test("every role entry has required fields", () => {
  for (const role of ROLES) {
    const entry = CATALOG[role]
    assert.ok(entry.label, `${role}: label missing`)
    assert.ok(entry.primary, `${role}: primary model missing`)
    assert.ok(entry.fallback, `${role}: fallback model missing`)
    assert.ok(entry.free, `${role}: free model missing`)
    assert.ok(entry.power, `${role}: power model missing`)
    assert.ok(entry.reasoning, `${role}: reasoning missing`)
  }
})

test("every model ID uses provider/model format", () => {
  const keys = ["primary", "fallback", "free", "power"]
  for (const role of ROLES) {
    const entry = CATALOG[role]
    for (const key of keys) {
      const model = entry[key]
      const parts = model.split("/")
      assert.ok(parts.length >= 2, `${role}.${key}: "${model}" must be provider/model (got ${parts.length} parts)`)
      assert.ok(parts[0].length > 0, `${role}.${key}: provider part empty`)
      assert.ok(parts.slice(1).join("/").length > 0, `${role}.${key}: model part empty`)
    }
  }
})

test("free budget returns the free model for each role", () => {
  for (const role of ROLES) {
    const model = modelFor(role, "free")
    assert.strictEqual(model, CATALOG[role].free, `${role}: free budget mismatch`)
  }
})

test("balanced budget returns the primary model for each role", () => {
  for (const role of ROLES) {
    const model = modelFor(role, "balanced")
    assert.strictEqual(model, CATALOG[role].primary, `${role}: balanced budget mismatch`)
  }
})

test("power budget returns the power model for each role", () => {
  for (const role of ROLES) {
    const model = modelFor(role, "power")
    assert.strictEqual(model, CATALOG[role].power, `${role}: power budget mismatch`)
  }
})

test("unknown role throws", () => {
  assert.throws(() => modelFor("nonexistent", "balanced"), /Unknown role/)
  assert.throws(() => modelFor("", "balanced"), /Unknown role/)
})

test("unknown budget defaults to balanced (primary)", () => {
  for (const role of ROLES) {
    const model = modelFor(role, "premium") // unknown budget
    assert.strictEqual(model, CATALOG[role].primary, `${role}: unknown budget should fall back to primary`)
  }
})

test("fallbackFor returns the declared fallback", () => {
  for (const role of ROLES) {
    assert.strictEqual(fallbackFor(role), CATALOG[role].fallback, `${role}: fallback mismatch`)
  }
})

test("BUDGETS array has exactly 3 entries", () => {
  assert.deepStrictEqual(BUDGETS, ["free", "balanced", "power"])
})

test("balanced tier uses opencode-go as primary for at least 3 developer roles", () => {
  const devRoles = ["orchestrator", "backend-dev", "frontend-dev", "adversary"]
  const count = devRoles.filter((r) => CATALOG[r].primary.startsWith("opencode-go/")).length
  assert.ok(count >= 3, `balanced tier must use opencode-go for at least 3 dev roles, got ${count}`)
})

// Preset YAML consistency — cross-check catalog against preset files
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import YAML from "yaml"

test("presets/free.yaml models match catalog free models", () => {
  const preset = YAML.parse(readFileSync(resolve("presets/free.yaml"), "utf8"))
  assert.strictEqual(preset.budget, "free")
  for (const role of ROLES) {
    const presetModel = preset.agents[role]?.model
    const catModel = CATALOG[role].free
    assert.strictEqual(presetModel, catModel, `${role}: preset free "${presetModel}" !== catalog free "${catModel}"`)
  }
})

test("presets/balanced.yaml models match catalog primary models", () => {
  const preset = YAML.parse(readFileSync(resolve("presets/balanced.yaml"), "utf8"))
  assert.strictEqual(preset.budget, "balanced")
  for (const role of ROLES) {
    const presetModel = preset.agents[role]?.model
    const catModel = CATALOG[role].primary
    assert.strictEqual(presetModel, catModel, `${role}: preset balanced "${presetModel}" !== catalog primary "${catModel}"`)
  }
})

test("presets/power.yaml models match catalog power models", () => {
  const preset = YAML.parse(readFileSync(resolve("presets/power.yaml"), "utf8"))
  assert.strictEqual(preset.budget, "power")
  for (const role of ROLES) {
    const presetModel = preset.agents[role]?.model
    const catModel = CATALOG[role].power
    assert.strictEqual(presetModel, catModel, `${role}: preset power "${presetModel}" !== catalog power "${catModel}"`)
  }
})
