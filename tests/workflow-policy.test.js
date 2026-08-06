import { test } from "node:test"
import assert from "node:assert/strict"
import {
  classifyRisk,
  selectAgents,
  evidencePolicy,
  readyPhaseIds,
  groupFindings,
  dispositionFinding,
} from "../src/workflow-policy.js"

test("classifyRisk treats isolated documentation as low risk", () => {
  const result = classifyRisk({ files: ["README.md"], behaviors: ["copy guidance"] })

  assert.equal(result.risk, "low")
  assert.ok(result.reasons.length > 0)
  assert.deepEqual(result.triggers, [])
})

test("classifyRisk treats public filesystem behavior as medium risk", () => {
  const result = classifyRisk({
    files: ["src/new-command.js"],
    behaviors: ["change public CLI behavior"],
    inputs: ["user-controlled template path"],
  })

  assert.equal(result.risk, "medium")
  assert.ok(result.triggers.includes("public-contract"))
  assert.ok(result.triggers.includes("filesystem-boundary"))
})

test("classifyRisk treats command execution and secrets as high risk", () => {
  const result = classifyRisk({
    files: ["src/auth.js"],
    behaviors: ["execute shell command"],
    inputs: ["credential"],
  })

  assert.equal(result.risk, "high")
  assert.ok(result.triggers.includes("trust-boundary"))
  assert.ok(result.triggers.includes("code-execution"))
})

test("classifyRisk escalates broad or irreversible change surface", () => {
  assert.equal(classifyRisk({ blastRadius: "wide" }).risk, "medium")
  assert.equal(classifyRisk({ reversibility: "irreversible" }).risk, "high")
})

test("selectAgents always activates QA and keeps unrelated roles standby", () => {
  const result = selectAgents({
    risk: "low",
    surface: { files: ["README.md"], behaviors: ["copy guidance"] },
  })

  assert.ok(result.activeAgents.includes("qa"))
  assert.ok(result.activeAgents.includes("docs"))
  assert.ok(!result.activeAgents.includes("security"))
  assert.ok(result.standbyAgents.includes("security"))
})

test("selectAgents activates security and adversary for high-risk boundaries", () => {
  const result = selectAgents({
    risk: "high",
    surface: { files: ["src/auth.js"], behaviors: ["execute shell command"] },
  })

  assert.deepEqual(result.activeAgents.slice(0, 3), ["backend-dev", "qa", "security"])
  assert.ok(result.activeAgents.includes("adversary"))
  assert.ok(result.escalations.includes("independent-security-review"))
})

test("explicit lower risk cannot downgrade inferred high risk", () => {
  const surface = { files: ["src/auth.js"], behaviors: ["execute shell command"] }
  const agents = selectAgents({ risk: "low", surface })
  const evidence = evidencePolicy({ risk: "low", surface })

  assert.ok(agents.activeAgents.includes("security"))
  assert.ok(agents.activeAgents.includes("adversary"))
  assert.equal(evidence.class, "full")
})

test("evidencePolicy keeps low risk QA lax without removing it", () => {
  const result = evidencePolicy({ risk: "low" })

  assert.equal(result.class, "smoke")
  assert.equal(result.strictness, "lax")
  assert.deepEqual(result.required, ["focused-smoke", "acceptance-check"])
  assert.deepEqual(result.reviewers, ["qa"])
  assert.equal(result.runFullRelevantSuite, false)
})

test("evidencePolicy escalates high risk to full relevant evidence", () => {
  const result = evidencePolicy({
    risk: "high",
    surface: { inputs: ["untrusted input"] },
  })

  assert.equal(result.class, "full")
  assert.equal(result.strictness, "full")
  assert.ok(result.required.includes("negative-path-tests"))
  assert.deepEqual(result.reviewers, ["qa", "security", "adversary"])
  assert.equal(result.runFullRelevantSuite, true)
})

test("readyPhaseIds returns all dependency-ready phases together", () => {
  const phases = [
    { id: "foundation", status: "passed", dependsOn: [] },
    { id: "api", status: "pending", dependsOn: ["foundation"] },
    { id: "docs", status: "pending", dependsOn: [] },
    { id: "release", status: "pending", dependsOn: ["api", "docs"] },
  ]

  assert.deepEqual(readyPhaseIds(phases), ["api", "docs"])
})

test("groupFindings batches shared root causes and files", () => {
  const groups = groupFindings([
    { id: "SEC-1", rootCause: "untrusted-template", files: ["src/render.js"], threatClass: "injection", severity: "MEDIUM" },
    { id: "SEC-2", rootCause: "untrusted-template", files: ["src/render.js"], threatClass: "traversal", severity: "LOW" },
    { id: "ADV-1", rootCause: "permission-copy", files: ["README.md"], threatClass: "ux", severity: "LOW" },
  ])

  assert.equal(groups.length, 2)
  assert.deepEqual(groups[0].findingIds, ["SEC-1", "SEC-2"])
  assert.deepEqual(groups[1].findingIds, ["ADV-1"])
  assert.equal(groups[0].severity, "MEDIUM")
})

test("dispositionFinding blocks introduced contract failures", () => {
  assert.equal(
    dispositionFinding({ severity: "HIGH" }, { introduced: true, contractRequires: true }),
    "BLOCKING"
  )
  assert.equal(
    dispositionFinding({ severity: "MEDIUM" }, { introduced: true }),
    "FIX_NOW"
  )
})

test("dispositionFinding defers unrelated pre-existing findings", () => {
  assert.equal(
    dispositionFinding({ severity: "HIGH" }, { introduced: false, worsened: false }),
    "DEFERRED"
  )
  assert.equal(
    dispositionFinding({ severity: "LOW" }, { falsePositive: true }),
    "FALSE_POSITIVE"
  )
})
