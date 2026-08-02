import { test } from "node:test"
import assert from "node:assert"
import { Readable, Writable } from "node:stream"
import { EventEmitter } from "node:events"

import { select, multiSelect, confirm } from "../src/ui.js"
import { runQuestionnaire } from "../src/questionnaire.js"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { makeTempRepo } from "./helpers.js"

// Matches ANSI SGR color codes only (ESC[<params>m), not cursor-movement codes.
const SGR = /\u001b\[\d+(?:;\d+)*m/

function makeStreams(input) {
  const inputStream = Readable.from([input])
  const output = []
  const outputStream = new Writable({
    write(chunk, _enc, cb) {
      output.push(chunk.toString())
      cb()
    },
  })
  return { input: inputStream, output: outputStream, outputData: output }
}

// Fake TTY: isTTY=true so primitives take the raw-mode path, but streams are
// plain EventEmitter/Writable so no real terminal is needed. Data chunks are
// emitted manually and decoded by readline's keypress machinery.
function makeRawStreams({ ttyOutput = false } = {}) {
  const input = new EventEmitter()
  input.isTTY = true
  input.setRawMode = () => true
  input.pause = () => {}
  input.resume = () => {}
  const output = []
  const outputStream = new Writable({
    write(chunk, _enc, cb) {
      output.push(chunk.toString())
      cb()
    },
  })
  if (ttyOutput) outputStream.isTTY = true
  return { input, output: outputStream, outputData: output }
}

const tick = () => new Promise((r) => setImmediate(r))

// Emit keypress bytes one at a time with a macrotask gap so each primitive's
// listener is attached (and previous promise resolved) before the next byte.
async function driveKeys(input, keys) {
  for (const k of keys) {
    await tick()
    input.emit("data", k)
  }
  await tick()
}

const OPTIONS = [
  { label: "alpha", value: "a" },
  { label: "beta", value: "b" },
  { label: "gamma", value: "c" },
]

test("select: down-arrow then Enter returns the second option", async () => {
  const { input, output } = makeRawStreams()
  const p = select("Pick", OPTIONS, { defaultIndex: 0, input, output })
  await driveKeys(input, ["\u001b[B", "\r"])
  assert.strictEqual(await p, "b")
})

test("select renders the ▸ marker on the highlighted option", async () => {
  const { input, output, outputData } = makeRawStreams()
  const p = select("Pick", OPTIONS, { defaultIndex: 0, input, output })
  await driveKeys(input, ["\u001b[B", "\r"])
  await p
  const text = outputData.join("")
  assert.match(text, /▸ alpha/, `expected marker on default option in: ${JSON.stringify(text)}`)
  assert.match(text, /▸ beta/, `expected marker to move after arrow in: ${JSON.stringify(text)}`)
  assert.ok(!/▸ gamma/.test(text), `non-selected option should not carry marker in: ${JSON.stringify(text)}`)
})

test("confirm renders the ▸ marker on the highlighted option", async () => {
  const { input, output, outputData } = makeRawStreams()
  const p = confirm("Proceed?", true, { input, output })
  await driveKeys(input, ["\u001b[B", "\r"])
  await p
  const text = outputData.join("")
  assert.match(text, /▸ Yes/, `expected marker on default in: ${JSON.stringify(text)}`)
  assert.match(text, /▸ No/, `expected marker to move after arrow in: ${JSON.stringify(text)}`)
})

test("select: Enter immediately returns the default option", async () => {
  const { input, output } = makeRawStreams()
  const p = select("Pick", OPTIONS, { defaultIndex: 1, input, output })
  await driveKeys(input, ["\r"])
  assert.strictEqual(await p, "b")
})

test("select: up-arrow wraps to first option", async () => {
  const { input, output } = makeRawStreams()
  const p = select("Pick", OPTIONS, { defaultIndex: 2, input, output })
  await driveKeys(input, ["\u001b[A", "\r"])
  assert.strictEqual(await p, "b")
})

test("select falls back to line input when stdin is not a TTY", async () => {
  const { input, output, outputData } = makeStreams("free\n")
  const value = await select(
    "Budget tier",
    [
      { label: "free", value: "free" },
      { label: "balanced", value: "balanced" },
    ],
    { defaultIndex: 1, input, output },
  )
  assert.strictEqual(value, "free")
  assert.ok(outputData.some((s) => s.includes("Budget tier")))
})

test("select line fallback: blank line returns the default", async () => {
  const { input, output } = makeStreams("\n")
  const value = await select(
    "Budget tier",
    [
      { label: "free", value: "free" },
      { label: "balanced", value: "balanced" },
    ],
    { defaultIndex: 1, input, output },
  )
  assert.strictEqual(value, "balanced")
})

test("multiSelect: space toggles an option off, Enter returns the rest", async () => {
  const { input, output } = makeRawStreams()
  const p = multiSelect("Pick", OPTIONS, { defaults: ["a", "b", "c"], input, output })
  // Move to "beta", toggle it off, finish.
  await driveKeys(input, ["\u001b[B", " ", "\r"])
  assert.deepStrictEqual(await p, ["a", "c"])
})

test("multiSelect: 'a' selects all options", async () => {
  const { input, output } = makeRawStreams()
  const p = multiSelect("Pick", OPTIONS, { defaults: [], input, output })
  await driveKeys(input, ["a", "\r"])
  assert.deepStrictEqual(await p, ["a", "b", "c"])
})

test("multiSelect: 'n' selects none", async () => {
  const { input, output } = makeRawStreams()
  const p = multiSelect("Pick", OPTIONS, { defaults: ["a", "b", "c"], input, output })
  await driveKeys(input, ["n", "\r"])
  assert.deepStrictEqual(await p, [])
})

test("multiSelect falls back to line input when stdin is not a TTY", async () => {
  const { input, output } = makeStreams("a, c\n")
  const values = await multiSelect("Pick", OPTIONS, { defaults: ["a", "b", "c"], input, output })
  assert.deepStrictEqual(values, ["a", "c"])
})

test("confirm: arrow keys pick No when the default is Yes", async () => {
  const { input, output } = makeRawStreams()
  const p = confirm("Proceed?", true, { input, output })
  await driveKeys(input, ["\u001b[B", "\r"])
  assert.strictEqual(await p, false)
})

test("confirm falls back to Y/n line input when stdin is not a TTY", async () => {
  const { input, output, outputData } = makeStreams("n\n")
  const answer = await confirm("Proceed?", true, { input, output })
  assert.strictEqual(answer, false)
  assert.ok(outputData.some((s) => s.includes("Proceed?")))
})

test("confirm line fallback: 'y' returns true even when default is No", async () => {
  const { input, output } = makeStreams("y\n")
  const answer = await confirm("Proceed?", false, { input, output })
  assert.strictEqual(answer, true)
})

test("no ANSI escapes at all when input is not a TTY (line fallback)", async () => {
  const { input, output, outputData } = makeStreams("free\n")
  await select(
    "Budget tier",
    [
      { label: "free", value: "free" },
      { label: "balanced", value: "balanced" },
    ],
    { defaultIndex: 1, input, output },
  )
  const text = outputData.join("")
  assert.ok(!text.includes("\u001b["), `unexpected escapes: ${JSON.stringify(text)}`)
})

test("no color codes when output is not a TTY (raw mode still redraws)", async () => {
  const { input, output, outputData } = makeRawStreams()
  const p = select("Pick", OPTIONS, { defaultIndex: 0, input, output })
  await driveKeys(input, ["\u001b[B", "\r"])
  await p
  const text = outputData.join("")
  assert.ok(!SGR.test(text), `unexpected color codes: ${JSON.stringify(text)}`)
})

test("color codes appear when output is a TTY and NO_COLOR is unset", async () => {
  const had = process.env.NO_COLOR
  delete process.env.NO_COLOR
  try {
    const { input, output, outputData } = makeRawStreams({ ttyOutput: true })
    const p = select("Pick", OPTIONS, { defaultIndex: 0, input, output })
    await driveKeys(input, ["\u001b[B", "\r"])
    await p
    const text = outputData.join("")
    assert.ok(SGR.test(text), `expected color codes in: ${JSON.stringify(text)}`)
  } finally {
    if (had) process.env.NO_COLOR = had
  }
})

test("NO_COLOR suppresses color codes even on a TTY", async () => {
  process.env.NO_COLOR = "1"
  try {
    const { input, output, outputData } = makeRawStreams({ ttyOutput: true })
    const p = select("Pick", OPTIONS, { defaultIndex: 0, input, output })
    await driveKeys(input, ["\u001b[B", "\r"])
    await p
    const text = outputData.join("")
    assert.ok(!SGR.test(text), `unexpected color codes: ${JSON.stringify(text)}`)
  } finally {
    delete process.env.NO_COLOR
  }
})

test("multiSelect renders a hint line with the shortcuts", async () => {
  const { input, output, outputData } = makeRawStreams()
  const p = multiSelect("Team", OPTIONS, { defaults: ["a", "b", "c"], input, output })
  await driveKeys(input, ["\r"])
  await p
  const text = outputData.join("")
  assert.match(text, /space=select/)
  assert.match(text, /a=all/)
  assert.match(text, /n=none/)
})

test("runQuestionnaire: budget picker + team multiSelect drive the manifest", async () => {
  const dir = makeTempRepo()
  const { input, output } = makeRawStreams()
  const p = runQuestionnaire(dir, { input, output })
  const feed = [
    "my-app\n", // project name (line mode on the fake stream)
    "\r", // budget tier: balanced (default)
    "\u001b[B", "\u001b[B", "\u001b[B", "\u001b[B", // move down to "adversary"
    " ", // toggle adversary off
    "\r", // finish team selection
    "\r", "\r", "\r", "\r", // "Customize model for X?" -> No (orchestrator, backend-dev, frontend-dev, qa)
    "\r", // browser/e2e: Yes (default)
    "\r", // "Write this configuration?" -> Yes (default)
  ]
  await driveKeys(input, feed)
  const m = await p

  assert.strictEqual(m.project.name, "my-app")
  assert.strictEqual(m.project.budget, "balanced")
  assert.strictEqual(m.project.browserTesting, true)
  assert.strictEqual(m.project.useAgentBrowser, true)
  const roles = m.team.map((t) => t.role)
  assert.deepStrictEqual(roles, ROLES.filter((r) => r !== "adversary"))
  for (const t of m.team) {
    assert.strictEqual(t.model, modelFor(t.role, "balanced"))
    assert.strictEqual(t.enabled, true)
  }
})

test("runQuestionnaire: budget picker picks 'power' via arrow keys", async () => {
  const dir = makeTempRepo()
  const { input, output } = makeRawStreams()
  const p = runQuestionnaire(dir, { input, output })
  const feed = [
    "my-app\n",
    "\u001b[B", "\u001b[B", "\r", // budget: balanced -> power
    "\r", // team: all defaults, finish immediately
    "\r", "\r", "\r", "\r", "\r", // 5 customize prompts -> No
    "\r", // browser/e2e: Yes
    "\r", // write configuration: Yes
  ]
  await driveKeys(input, feed)
  const m = await p
  assert.strictEqual(m.project.budget, "power")
  assert.deepStrictEqual(m.team.map((t) => t.role), ROLES)
  for (const t of m.team) {
    assert.strictEqual(t.model, modelFor(t.role, "power"))
  }
})
