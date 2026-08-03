import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { renderInitSummary } from "../src/init-summary.js"

const balancedManifest = {
  project: {
    name: "test-project",
    budget: "balanced",
  },
  team: [
    { role: "orchestrator", model: "opencode-go/minimax-m3", fallback: null, enabled: true },
    { role: "backend-dev", model: "opencode-go/deepseek-v4-pro", fallback: null, enabled: true },
    { role: "frontend-dev", model: "opencode-go/minimax-m3", fallback: null, enabled: true },
    { role: "qa", model: "opencode/mimo-v2.5-free", fallback: null, enabled: true },
    { role: "adversary", model: "opencode-go/deepseek-v4-pro", fallback: null, enabled: true },
    { role: "security", model: "opencode/big-pickle", fallback: null, enabled: false },
    { role: "docs", model: "opencode/deepseek-v4-flash-free", fallback: null, enabled: true },
    { role: "architect", model: "opencode/big-pickle", fallback: null, enabled: false },
  ],
}

describe("renderInitSummary", () => {
  it("shows project name in header", () => {
    const out = renderInitSummary(balancedManifest)
    assert.ok(out.includes("Project: test-project"), "header missing project name")
  })

  it("counts only enabled agents", () => {
    const out = renderInitSummary(balancedManifest)
    assert.ok(out.includes("Team: 6 agents"), "team count should be 6 enabled agents")
  })

  it("shows balanced budget with correct cost hint", () => {
    const out = renderInitSummary(balancedManifest)
    assert.ok(out.includes("Budget: balanced"), "missing budget line")
    assert.ok(out.includes("Cost:   free workers, paid reviewers/judges"), "missing balanced cost hint")
  })

  it("shows free budget with correct cost hint", () => {
    const freeManifest = {
      ...balancedManifest,
      project: { ...balancedManifest.project, budget: "free" },
    }
    const out = renderInitSummary(freeManifest)
    assert.ok(out.includes("Budget: free"), "missing budget line")
    assert.ok(out.includes("Cost:   zero usage cost"), "missing free cost hint")
  })

  it("shows power budget with correct cost hint", () => {
    const powerManifest = {
      ...balancedManifest,
      project: { ...balancedManifest.project, budget: "power" },
    }
    const out = renderInitSummary(powerManifest)
    assert.ok(out.includes("Budget: power"), "missing budget line")
    assert.ok(out.includes("Cost:   strongest models on every role (paid)"), "missing power cost hint")
  })

  it("includes enabled roles in roster with model string", () => {
    const out = renderInitSummary(balancedManifest)
    assert.ok(out.includes("  Commodore: opencode-go/minimax-m3"), "missing Commodore")
    assert.ok(out.includes("  Galleon: opencode-go/deepseek-v4-pro"), "missing Galleon")
    assert.ok(out.includes("  Clipper: opencode-go/minimax-m3"), "missing Clipper")
    assert.ok(out.includes("  Corvette: opencode/mimo-v2.5-free"), "missing Corvette")
    assert.ok(out.includes("  Xebec: opencode-go/deepseek-v4-pro"), "missing Xebec")
    assert.ok(out.includes("  Caravel: opencode/deepseek-v4-flash-free"), "missing Caravel")
  })

  it("omits disabled roles from roster", () => {
    const out = renderInitSummary(balancedManifest)
    assert.ok(!out.includes("  Frigate:"), "should omit disabled Frigate role")
    assert.ok(!out.includes("  Bark:"), "should omit disabled Bark role")
  })

  it("includes Next steps section with three bullets", () => {
    const out = renderInitSummary(balancedManifest)
    assert.ok(out.includes("Next steps:"), "missing next steps header")
    assert.ok(out.includes("1. opencode"), "missing step 1")
    assert.ok(out.includes("2. /armada  -> team status"), "missing step 2")
    assert.ok(out.includes("3. 'ping all agents'  -> verify roster"), "missing step 3")
  })

  it("does not throw with empty team array and shows 0 agents", () => {
    const empty = { ...balancedManifest, team: [] }
    const out = renderInitSummary(empty)
    assert.ok(out.includes("Team: 0 agents"), "should show 0 agents")
  })

  it("renders complete output for balanced budget", () => {
    const out = renderInitSummary(balancedManifest)
    const expected = [
      "Project: test-project",
      "Team: 6 agents",
      "Budget: balanced",
      "Cost:   free workers, paid reviewers/judges",
      "Roster:",
      "  Commodore: opencode-go/minimax-m3",
      "  Galleon: opencode-go/deepseek-v4-pro",
      "  Clipper: opencode-go/minimax-m3",
      "  Corvette: opencode/mimo-v2.5-free",
      "  Xebec: opencode-go/deepseek-v4-pro",
      "  Caravel: opencode/deepseek-v4-flash-free",
      "Next steps:",
      "  1. opencode",
      "  2. /armada  -> team status",
      "  3. 'ping all agents'  -> verify roster",
    ]
    for (const line of expected) {
      assert.ok(out.includes(line), `missing line: "${line}"`)
    }
  })
})
