import { test } from "node:test"
import assert from "node:assert"
import { PassThrough } from "node:stream"
import { parseModelChoice, pickModel, CUSTOM_MODEL_PATTERN } from "../src/questionnaire.js"
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

test("parseModelChoice: numeric out of range is invalid (returns null)", () => {
  const options = optionsFor("orchestrator")
  for (const raw of ["9", "0", "-1"]) {
    const got = parseModelChoice(raw, options, 0)
    assert.equal(got, null, `expected null for "${raw}"`)
  }
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

test("parseModelChoice: openrouter/foo-1 is invalid (returns null)", () => {
  const options = optionsFor("orchestrator")
  const got = parseModelChoice("openrouter/foo-1", options, 0)
  assert.equal(got, null)
})

test("parseModelChoice: valid opencode-go/zen/<model> is a custom id", () => {
  const options = optionsFor("orchestrator")
  const got = parseModelChoice("opencode-go/zen/foo", options, 0)
  assert.deepEqual(got, { model: "opencode-go/zen/foo", variant: null })
})

test("parseModelChoice: valid openrouter/<owner>/<model> with hyphen and dot is a custom id", () => {
  const options = optionsFor("orchestrator")
  const got = parseModelChoice("openrouter/z-ai/glm5.2", options, 0)
  assert.deepEqual(got, { model: "openrouter/z-ai/glm5.2", variant: null })
})

test("parseModelChoice: opencode-go without zen segment is invalid", () => {
  const options = optionsFor("orchestrator")
  const got = parseModelChoice("opencode-go/foo", options, 0)
  assert.equal(got, null)
})

test("parseModelChoice: bare opencode/ is invalid", () => {
  const options = optionsFor("orchestrator")
  const got = parseModelChoice("opencode/foo", options, 0)
  assert.equal(got, null)
})

test("parseModelChoice: openrouter with one segment is invalid", () => {
  const options = optionsFor("orchestrator")
  const got = parseModelChoice("openrouter/foo", options, 0)
  assert.equal(got, null)
})

test("parseModelChoice: openrouter with three segments is invalid", () => {
  const options = optionsFor("orchestrator")
  const got = parseModelChoice("openrouter/foo/bar/baz", options, 0)
  assert.equal(got, null)
})

test("parseModelChoice: uppercase is rejected", () => {
  const options = optionsFor("orchestrator")
  assert.equal(parseModelChoice("opencode-go/zen/Foo", options, 0), null)
  assert.equal(parseModelChoice("openrouter/Z-AI/glm5.2", options, 0), null)
})

test("parseModelChoice: empty model segment is invalid", () => {
  const options = optionsFor("orchestrator")
  assert.equal(parseModelChoice("opencode-go/zen/", options, 0), null)
  assert.equal(parseModelChoice("openrouter/foo/", options, 0), null)
})

test("parseModelChoice: non-numeric non-format strings are invalid", () => {
  const options = optionsFor("orchestrator")
  for (const raw of ["abc", "v1-model", "123-abc", "1.5", "foo bar"]) {
    const got = parseModelChoice(raw, options, 0)
    assert.equal(got, null, `expected null for "${raw}"`)
  }
})

test("CUSTOM_MODEL_PATTERN is exported and matches valid ids", () => {
  assert.ok(CUSTOM_MODEL_PATTERN instanceof RegExp)
  assert.ok(CUSTOM_MODEL_PATTERN.test("opencode-go/zen/foo"))
  assert.ok(CUSTOM_MODEL_PATTERN.test("openrouter/z-ai/glm5.2"))
  assert.ok(!CUSTOM_MODEL_PATTERN.test("opencode/foo"))
  assert.ok(!CUSTOM_MODEL_PATTERN.test("openrouter/foo"))
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

test("pickModel: invalid custom model id re-prompts and accepts next valid input", async () => {
  // readline/promises consumes all buffered lines from a single write at once,
  // so the second question would miss its line. Feed line2 only after the
  // re-prompt message is written, which is deterministic and timing-free.
  const input = new PassThrough()
  const output = new PassThrough()
  let buf = ""
  output.on("data", (d) => {
    buf += d.toString()
    if (buf.includes("Invalid choice")) {
      setImmediate(() => input.write("opencode-go/zen/foo\n"))
    }
  })
  setImmediate(() => input.write("not-a-valid-format\n"))
  const got = await pickModel("orchestrator", { input, output })
  assert.equal(got.model, "opencode-go/zen/foo")
  assert.equal(got.variant, null)
})
