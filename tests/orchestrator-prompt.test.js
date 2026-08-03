import { test } from "node:test"
import assert from "node:assert"
import { join } from "node:path"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { fillPrompt, PROMPT_SOURCE } from "../src/scaffold.js"
import { renderArmadaStatusCommand, renderArmadaResumeCommand } from "../src/generator.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

function orchestratorPrompt() {
  const manifest = {
    project: {
      name: "test-project",
      budget: "balanced",
      browserTesting: false,
      devcontainer: false,
      useAgentBrowser: false,
      requirementsFile: "armada/REQUIREMENTS.md",
      stack: { frontend: null, backend: null, database: null, testing: null, srcDirs: [], languages: [] },
    },
  }
  return fillPrompt(join(__dirname, "..", PROMPT_SOURCE["orchestrator"]), manifest, manifest.project.stack)
}

test("orchestrator prompt: reads active state on session start (rule 3)", () => {
  const prompt = orchestratorPrompt().toLowerCase()

  assert.match(prompt, /read the active state on session start/,
    "rule #3 must read the active state on session start")
  assert.ok(prompt.includes("armada/state/active.json"),
    "rule #3 must mention armada/state/active.json")

  assert.match(prompt, /(summarize )?pending phases/,
    "prompt must summarize pending phases")
  assert.match(prompt, /pending phases[\s\S]{0,400}next action/,
    "pending phases must appear near next action")

  assert.match(prompt, /ask the user for the[\s\S]{0,30}next action before\s+resuming/,
    "rule #3 must ask the user for the next action before resuming")
  assert.match(prompt, /contract-first/,
    "rule #3 must fall back to the contract-first flow when state is absent")
})

test("orchestrator prompt: writes state on every transition (rule 4)", () => {
  const prompt = orchestratorPrompt().toLowerCase()

  assert.match(prompt, /write state/,
    "rule #4 must mandate writing state")
  assert.ok(prompt.includes("unsaved state"),
    "rule #4 must forbid ending a turn with unsaved state")
  assert.match(prompt, /armada\/state\/active\.json/,
    "rule #4 must write armada/state/active.json")
})

test("orchestrator prompt: feature work runs through lanes, never the live tree (rule 5)", () => {
  const prompt = orchestratorPrompt().toLowerCase()

  assert.match(prompt, /feature worktree|worktree add/,
    "rule #5 must require a feature worktree before building")
  assert.match(prompt, /scaffold/,
    "rule #5 must mention scaffolding the lane")
  assert.match(prompt, /live tree/,
    "rule #5 must forbid implementing features in the live tree")
  assert.match(prompt, /propose the lane/,
    "rule #5 must propose the lane when the user asks to build without setup")
})

test("armada-status / armada-resume command renderers reference correct sources", () => {
  // armada-status reads the state index directly.
  const status = renderArmadaStatusCommand()
  assert.ok(
    status.includes("armada/state/active.json") || status.includes("armada/state/features/index.json"),
    "armada-status must reference armada/state/active.json or the features index"
  )
  assert.ok(
    !/read \.opencode\/fleet-status\.md/i.test(status),
    "armada-status must not read .opencode/fleet-status.md as the primary state"
  )
  // armada-resume calls the engine (no direct state reads).
  const resume = renderArmadaResumeCommand()
  assert.ok(
    resume.includes("node src/cli.js reconcile"),
    "armada-resume must call node src/cli.js reconcile"
  )
  assert.ok(resume.includes("resume line"), "armada-resume must mention resume line")
  assert.ok(resume.includes("drift list"), "armada-resume must mention drift list")
})
