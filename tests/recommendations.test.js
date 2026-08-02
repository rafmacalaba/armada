// tests/recommendations.test.js
import { test } from "node:test"
import assert from "node:assert"
import { CATEGORIES } from "../src/recommendations.js"

test("CATEGORIES is an object with entries", () => {
  assert.ok(typeof CATEGORIES === "object")
  assert.ok(Object.keys(CATEGORIES).length >= 3)
})

test("every category has label, stacks, and layers", () => {
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    assert.ok(typeof cat.label === "string", `${key}: missing label`)
    assert.ok(Array.isArray(cat.stacks), `${key}: stacks not an array`)
    assert.ok(cat.stacks.length > 0, `${key}: stacks empty`)
    assert.ok(typeof cat.layers === "object", `${key}: missing layers`)
  }
})

test("first stack in every category is recommended", () => {
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    assert.strictEqual(cat.stacks[0].recommended, true,
      `${key}: first stack not recommended`)
  }
})

test("every stack has required fields", () => {
  const required = ["name", "label", "lang"]
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    for (const stack of cat.stacks) {
      for (const field of required) {
        assert.ok(stack[field] !== undefined,
          `${key}/${stack.name}: missing ${field}`)
      }
    }
  }
})

test("every category has at least 2 stacks", () => {
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    assert.ok(cat.stacks.length >= 2,
      `${key}: only ${cat.stacks.length} stack(s)`)
  }
})

test("only one stack per category has recommended: true", () => {
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    const count = cat.stacks.filter((s) => s.recommended).length
    assert.strictEqual(count, 1, `${key}: ${count} recommended stacks`)
  }
})

test("stack names are unique within a category", () => {
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    const names = cat.stacks.map((s) => s.name)
    assert.strictEqual(new Set(names).size, names.length,
      `${key}: duplicate stack names`)
  }
})

test("web-app layers cover frontend, backend, database, testing, ci, deploy", () => {
  const layers = CATEGORIES["web-app"].layers
  assert.ok(Array.isArray(layers.frontend), "frontend not array")
  assert.ok(Array.isArray(layers.backend), "backend not array")
  assert.ok(Array.isArray(layers.database), "database not array")
  assert.ok(Array.isArray(layers.testing), "testing not array")
  assert.ok(Array.isArray(layers.ci), "ci not array")
  assert.ok(Array.isArray(layers.deploy), "deploy not array")
  assert.ok(layers.frontend.length > 0, "frontend empty")
})
