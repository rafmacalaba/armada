import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname

function read(rel) {
  const p = join(ROOT, rel)
  assert.ok(existsSync(p), `missing file: ${rel}`)
  return readFileSync(p, "utf8")
}

test("orchestrator prompt: reads active state on session start (rule 3)", () => {
  const prompt = read(".opencode/agent/orchestrator.md").toLowerCase()

  // active.json in the context of "read on session start"
  assert.match(prompt, /read the active state on session start/,
    "rule #3 must read the active state on session start")
  assert.ok(prompt.includes("armada/state/active.json"),
    "rule #3 must mention armada/state/active.json")

  // pending phases near next action
  assert.match(prompt, /(summarize )?pending phases/,
    "prompt must summarize pending phases")
  assert.match(prompt, /pending phases[\s\S]{0,400}next action/,
    "pending phases must appear near next action")

  // resume flow: ask the user, fall back to contract-first when no state
  assert.match(prompt, /ask the user for the next action before resuming/,
    "rule #3 must ask the user for the next action before resuming")
  assert.match(prompt, /contract-first/,
    "rule #3 must fall back to the contract-first flow when state is absent")
})

test("orchestrator prompt: writes state on every transition (rule 4)", () => {
  const prompt = read(".opencode/agent/orchestrator.md").toLowerCase()

  assert.match(prompt, /write state/,
    "rule #4 must mandate writing state")
  assert.match(prompt, /phase (status changes|transitions)[\s\S]{0,120}evidence/,
    "rule #4 must tie phase transitions to evidence")
  assert.ok(prompt.includes("unsaved state"),
    "rule #4 must forbid ending a turn with unsaved state")
  assert.match(prompt, /armada\/state\/active\.json/,
    "rule #4 must write armada/state/active.json")
})

test("armada-status / armada-resume commands read the state index", () => {
  const cmdDir = join(ROOT, ".opencode", "commands")
  assert.ok(existsSync(cmdDir), `missing command dir: ${cmdDir}`)
  const files = readdirSync(cmdDir)
  const targets = files.filter((f) => /^armada-(status|resume)\.md$/.test(f))
  assert.ok(targets.length > 0,
    `no command file matching armada-status* or armada-resume* found in ${cmdDir}`)

  for (const f of targets) {
    const body = readFileSync(join(cmdDir, f), "utf8")
    assert.ok(
      body.includes("armada/state/active.json") || body.includes("armada/state/features/index.json"),
      `${f} must reference armada/state/active.json or armada/state/features/index.json`
    )
    assert.ok(
      !/read \.opencode\/fleet-status\.md/i.test(body),
      `${f} must not read .opencode/fleet-status.md as the primary state`
    )
  }
})
