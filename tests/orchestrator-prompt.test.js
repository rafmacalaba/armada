import { test } from "node:test"
import assert from "node:assert"
import { join } from "node:path"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { fillPrompt, PROMPT_SOURCE, scaffold } from "../src/scaffold.js"
import { agentNameFor } from "../src/role-display.js"
import { ROLES } from "../src/model-catalog.js"
import { renderArmadaStatusCommand, renderArmadaResumeCommand } from "../src/generator.js"
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"

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

test("orchestrator prompt: feature work runs through docks, never the live tree (rule 5)", () => {
  const prompt = orchestratorPrompt().toLowerCase()

  assert.match(prompt, /feature worktree|worktree add/,
    "rule #5 must require a feature worktree before building")
  assert.match(prompt, /scaffold/,
    "rule #5 must mention scaffolding the dock")
  assert.match(prompt, /live tree/,
    "rule #5 must forbid implementing features in the live tree")
  assert.match(prompt, /propose the dock/,
    "rule #5 must propose the dock when the user asks to build without setup")
})

test("orchestrator prompt: PR-first hard rule (rule 6)", () => {
  const prompt = orchestratorPrompt().toLowerCase()

  assert.match(prompt, /no done without a pr url/i,
    "rule #6 must say 'No done without a PR URL'")
  assert.match(prompt, /pr blocked/i,
    "rule #6 must allow 'PR blocked: <reason>' escape hatch")
  assert.match(prompt, /gh pr create/,
    "rule #6 must include 'gh pr create'")
  assert.match(prompt, /git merge/,
    "rule #6 must mention 'git merge' in the PR-first context")
  assert.doesNotMatch(prompt, /merge locally/,
    "rule #6 must not say 'merge locally' in a positive sense")
  assert.match(prompt, /rules?[\s\S]{0,3000}pr[- ]first/i,
    "PR-first rule must live under the Hard rules section")
  assert.match(prompt, /gh pr create[\s\S]{0,200}base master/i,
    "PR must target master base")
})

test("orchestrator prompt: voyage launch rule with /armada-voyage", () => {
  const prompt = orchestratorPrompt().toLowerCase()

  assert.match(prompt, /\/armada-voyage/,
    "prompt must reference the /armada-voyage command")
  assert.match(prompt, /launch a voyage|start a feature/,
    "prompt must trigger on 'launch a voyage' or 'start a feature'")
  assert.match(prompt, /create the lane[\s\S]{0,80}arm it[\s\S]{0,80}boot the ship/,
    "prompt must describe lane creation, arming, and boot")
  assert.match(prompt, /(several|multiple).*voyages/,
    "prompt must allow several voyages")
  assert.match(prompt, /(sequential|one at a time|one-after-another)/i,
    "prompt must require sequential, one-at-a-time lane creation")
  assert.match(prompt, /git rev-parse --show-toplevel|sandbox\/.+ancestor/,
    "prompt must include worktree-detection in the CLI fallback branch")
  assert.match(prompt, /do not start building\s+in the main repo|do not build in the main repo|not start building.*main repo/,
    "prompt must forbid building in the main repo")
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
    resume.includes("armada reconcile"),
    "armada-resume must prefer the global armada binary"
  )
  assert.ok(resume.includes("resume line"), "armada-resume must mention resume line")
  assert.ok(resume.includes("drift list"), "armada-resume must mention drift list")
})

test("orchestrator prompt: delegation targets ship names", () => {
  const prompt = orchestratorPrompt()

  assert.match(prompt, /dispatch\s+galleon/i, "prompt must say dispatch galleon")
  assert.match(prompt, /dispatch[\s\S]{0,20}clipper/i, "prompt must say ...clipper in dispatch context")

  const shipMap = {
    orchestrator: "commodore",
    "backend-dev": "galleon",
    "frontend-dev": "clipper",
    qa: "corvette",
    adversary: "xebec",
    security: "frigate",
    docs: "caravel",
    architect: "bark",
  }
  for (const [role, ship] of Object.entries(shipMap)) {
    const re = new RegExp(`\\b${role}\\b`)
    assert.doesNotMatch(prompt, re,
      `prompt must not contain bare role key "${role}" as a standalone word`)
  }

  assert.doesNotMatch(prompt, /\{[a-z_]+\}/,
    "prompt must contain no dangling {placeholder} tokens")
})

test("generated agents have no dangling {placeholder} or bare role names (scaffold e2e)", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-sni-phase3-"))

  const manifest = {
    project: {
      name: "ship-name-e2e",
      budget: "balanced",
      browserTesting: false,
      devcontainer: false,
      useAgentBrowser: false,
      requirementsFile: "armada/REQUIREMENTS.md",
      stack: { frontend: null, backend: null, database: null, testing: null, srcDirs: [], languages: [] },
    },
    targetDir: dir,
    team: ROLES.map((r) => ({ role: r, enabled: true })),
  }

  scaffold(manifest, manifest.project.stack)

  const agentDir = join(dir, ".opencode/agent")
  const agentFiles = readdirSync(agentDir)

  for (const f of agentFiles) {
    const content = readFileSync(join(agentDir, f), "utf8")
    assert.doesNotMatch(content, /\{[a-z_]+\}/,
      `agent file ${f} must have no dangling placeholders`)
  }

  // Only the orchestrator prompt must avoid bare role keys (delegation context).
  // Other agents may legitimately self-reference (e.g. "You are the architect").
  const commodore = readFileSync(join(agentDir, "commodore.md"), "utf8")
  for (const role of ["orchestrator", "backend-dev", "frontend-dev", "qa", "adversary", "architect", "docs"]) {
    const re = new RegExp(`\\b${role}\\b`)
    assert.doesNotMatch(commodore, re,
      `orchestrator prompt must not contain bare role key "${role}"`)
  }

  rmSync(dir, { recursive: true, force: true })
})
