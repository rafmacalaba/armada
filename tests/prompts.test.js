import { test } from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

function readPrompt(role) {
  return readFileSync(join(__dirname, "..", "agents", role, "prompt.template.md"), "utf8")
}

test("commodore prompt references armada-contract and armada-gate", () => {
  const prompt = readPrompt("orchestrator")
  assert.ok(prompt.includes("armada-contract"), "commodore prompt must reference armada-contract")
  assert.ok(prompt.includes("armada-gate"), "commodore prompt must reference armada-gate")
})

test("galleon prompt has load-on-match skill line", () => {
  const prompt = readPrompt("backend-dev")
  assert.match(prompt, /read.*SKILL\.md.*when the task matches/i,
    "galleon prompt must say read SKILL.md when task matches")
})

test("clipper prompt has load-on-match skill line", () => {
  const prompt = readPrompt("frontend-dev")
  assert.match(prompt, /read.*SKILL\.md.*when the task matches/i,
    "clipper prompt must say read SKILL.md when task matches")
})

test("corvette prompt has load-on-match skill line", () => {
  const prompt = readPrompt("qa")
  assert.match(prompt, /read.*SKILL\.md.*when the task matches/i,
    "corvette prompt must say read SKILL.md when task matches")
})
