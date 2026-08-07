import { test } from "node:test"
import assert from "node:assert"
import { PassThrough } from "node:stream"
import { parseModelChoice, pickModel } from "../src/questionnaire.js"
import { modelFor, fallbackFor, CATALOG } from "../src/model-catalog.js"

// Build the same options array pickModel builds for a role, so the pure
// parser is exercised against realistic data.
function optionsFor(role) {
  const e = CATALOG[role]
  return [
    { label: `${modelFor(role, "balanced")} (Recommended)`, value: modelFor(role, "balanced"), variant: e.variant },
    { label: `free: ${modelFor(role, "free")}`, value: modelFor(role, "free") },
    { label: `fallback: ${fallbackFor(role)}`, value: fallbackFor(role) },
    { label: `power: ${e.power}`, value: e.power, variant: e.variant },
  ]
}

test("parseModelChoice: numeric 1-N returns the chosen option", () => {
  const options = optionsFor("orchestrator")
  const got = parseModelChoice("2", options, 0)
  assert.equal(got.model, options[1].value)
  assert.equal(got.variant, options[1].variant)
})

test("parseModelChoice: numeric out of range falls back to default", () => {
  const options = optionsFor("orchestrator")
  const got = parseModelChoice("9", options, 0)
  assert.equal(got.model, options[0].value)
  assert.equal(got.variant, options[0].variant)
})

test("parseModelChoice: empty input falls back to default (recommended)", () => {
  const options = optionsFor("orchestrator")
  const got = parseModelChoice("", options, 0)
  assert.equal(got.model, options[0].value)
  assert.equal(got.variant, options[0].variant)
})

test("parseModelChoice: whitespace-only input falls back to default", () => {
  const options = optionsFor("orchestrator")
  const got = parseModelChoice("   ", options, 0)
  assert.equal(got.model, options[0].value)
  assert.equal(got.variant, options[0].variant)
})

test("parseModelChoice: non-numeric string is returned as a custom model id", () => {
  const options = optionsFor("orchestrator")
  const custom = "openrouter/anthropic/claude-sonnet-4.6"
  const got = parseModelChoice(custom, options, 0)
  assert.equal(got.model, custom)
  assert.equal(got.variant, null)
})

test("parseModelChoice: numeric-looking but non-integer input is a custom id", () => {
  const options = optionsFor("orchestrator")
  const custom = "openrouter/foo-1"
  const got = parseModelChoice(custom, options, 0)
  assert.equal(got.model, custom)
  assert.equal(got.variant, null)
})

// Regression: pickModel end-to-end honors a typed custom model id.
function mockInput(data) {
  const stream = new PassThrough()
  setImmediate(() => {
    stream.write(data)
    stream.end()
  })
  return stream
}

function mockOutput() {
  const stream = new PassThrough()
  let buf = ""
  stream.on("data", (d) => { buf += d.toString() })
  stream.buffer = () => buf
  return stream
}

test("pickModel: numeric pick still works (regression)", async () => {
  const input = mockInput("3\n")
  const output = mockOutput()
  const got = await pickModel("orchestrator", { input, output })
  assert.equal(got.model, fallbackFor("orchestrator"))
})

test("pickModel: typed custom model id is returned as the model", async () => {
  const input = mockInput("openrouter/anthropic/claude-sonnet-4.6\n")
  const output = mockOutput()
  const got = await pickModel("orchestrator", { input, output })
  assert.equal(got.model, "openrouter/anthropic/claude-sonnet-4.6")
  assert.equal(got.variant, null)
})

test("pickModel: empty input falls back to recommended", async () => {
  const input = mockInput("\n")
  const output = mockOutput()
  const got = await pickModel("orchestrator", { input, output })
  assert.equal(got.model, modelFor("orchestrator", "balanced"))
})
