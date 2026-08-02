import { test } from "node:test"
import assert from "node:assert"
import { Readable, Writable } from "node:stream"
import { ask, confirm } from "../src/questionnaire.js"

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

test("ask accepts { input, output } options", async () => {
  const { input, output, outputData } = makeStreams("hello\n")
  const answer = await ask("Name?", { input, output })
  assert.strictEqual(answer, "hello")
  assert.ok(outputData.some((s) => s.includes("Name?")))
})

test("confirm accepts { input, output } options", async () => {
  const { input, output, outputData } = makeStreams("y\n")
  const answer = await confirm("Proceed?", false, { input, output })
  assert.strictEqual(answer, true)
  assert.ok(outputData.some((s) => s.includes("Proceed?")))
})
