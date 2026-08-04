import { test } from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

function readPrompt(role) {
  return readFileSync(join(__dirname, "..", "agents", role, "prompt.template.md"), "utf8")
}

// Wave 2 baseline: commodore prompt references armada-contract and armada-gate
test("commodore prompt references armada-contract and armada-gate", () => {
  const prompt = readPrompt("orchestrator")
  assert.ok(prompt.includes("armada-contract"), "commodore prompt must reference armada-contract")
  assert.ok(prompt.includes("armada-gate"), "commodore prompt must reference armada-gate")
})

// Wave 2 baseline: workers have load-on-match skill line
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

// Phase 2 skills expansion: per-role spec for explicit Load lines
const SPECS = [
  {
    role: "orchestrator",
    ship: "commodore",
    lines: [
      "armada-contract",
      "armada-dispatch",
      "armada-pr",
      "armada-resume",
    ],
  },
  {
    role: "backend-dev",
    ship: "galleon",
    lines: [
      "armada-tdd",
      "armada-sdd",
      "armada-context-budget",
      "armada-ledger",
    ],
  },
  {
    role: "frontend-dev",
    ship: "clipper",
    lines: [
      "armada-tdd",
      "armada-sdd",
      "armada-context-budget",
      "armada-ledger",
    ],
  },
  {
    role: "qa",
    ship: "corvette",
    // armada-gate is from Wave 2 (presumed baseline), not re-asserted here.
    lines: [
      "armada-ledger",
      "armada-context-budget",
    ],
  },
  {
    role: "adversary",
    ship: "xebec",
    lines: [
      "armada-ledger",
      "armada-context-budget",
    ],
  },
  {
    role: "security",
    ship: "frigate",
    lines: [
      "armada-ledger",
      "armada-context-budget",
    ],
  },
  {
    role: "docs",
    ship: "caravel",
    lines: [
      "armada-contract",
      "armada-context-budget",
    ],
  },
  {
    role: "architect",
    ship: "bark",
    lines: [
      "armada-context-budget",
    ],
  },
]

for (const { role, ship, lines } of SPECS) {
  test(`${ship} (${role}) prompt references each declared load line`, () => {
    const prompt = readPrompt(role)
    for (const skill of lines) {
      // Each load line uses backticked skill name plus a "Load" verb nearby.
      const re = new RegExp(`load[^\\n]*\`${skill}\``, "i")
      assert.match(prompt, re,
        `${ship} (${role}) prompt must contain a "Load \`${skill}\` ..." line`)
    }
  })
}
