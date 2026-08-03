import { test } from "node:test"
import assert from "node:assert"
import {
  validateState,
  validateFeatureIndexEntry,
  validateFeatureIndex,
  emptyActive,
  emptyFeatureIndexEntry,
  applyEvidence,
  setPhaseStatus,
  setNextAction,
  markShipped,
} from "../src/state.js"

// ---- fixtures ------------------------------------------------------------

function makePhaseGraph() {
  return {
    phases: [
      { id: "p1", title: "Phase 1", dependsOn: [], status: "pending", criteria: [] },
      { id: "p2", title: "Phase 2", dependsOn: ["p1"], status: "pending", criteria: [{ id: "c1", text: "do thing", evidence: null }] },
      { id: "p3", title: "Phase 3", dependsOn: ["p2"], status: "pending", criteria: [] },
    ],
  }
}

function makeActive() {
  return emptyActive("my-feature", "armada/contracts/my-feature.md", makePhaseGraph())
}

// ---- round-trip ----------------------------------------------------------

test("round-trip active state", () => {
  const state = makeActive()
  validateState(state)
  const cloned = JSON.parse(JSON.stringify(state))
  assert.deepStrictEqual(cloned, state)
})

test("active state validates prUrl as null or non-empty string", () => {
  const s1 = makeActive()
  s1.prUrl = null
  validateState(s1) // must not throw

  const s2 = makeActive()
  s2.prUrl = "https://github.com/owner/repo/pull/42"
  validateState(s2) // must not throw

  const s3 = makeActive()
  s3.prUrl = ""
  assert.throws(() => validateState(s3), /prUrl/, "empty string prUrl must throw")

  const s4 = makeActive()
  s4.prUrl = 42
  assert.throws(() => validateState(s4), /prUrl/, "non-string prUrl must throw")
})

test("emptyActive seeds prUrl as null", () => {
  const s = makeActive()
  assert.strictEqual(s.prUrl, null, "emptyActive must default prUrl to null")
})

test("round-trip feature index entry", () => {
  const entry = emptyFeatureIndexEntry("f1", "armada/contracts/f1.md", makePhaseGraph())
  validateFeatureIndexEntry(entry)
  const cloned = JSON.parse(JSON.stringify(entry))
  assert.deepStrictEqual(cloned, entry)
})

test("round-trip feature index array", () => {
  const idx = [{ name: "f1", status: "open", contract: "c" }]
  validateFeatureIndex(idx)
  assert.deepStrictEqual(JSON.parse(JSON.stringify(idx)), idx)
})

// ---- applyEvidence -------------------------------------------------------

test("applyEvidence updates criterion and appends to evidence array", () => {
  const state = makeActive()
  const next = applyEvidence(state, { phaseId: "p2", criterionId: "c1", kind: "test", ref: "tests/smoke.test.js" })
  const c = next.phaseGraph.phases[1].criteria[0]
  assert.deepStrictEqual(c.evidence, { kind: "test", ref: "tests/smoke.test.js" })
  assert.deepStrictEqual(next.evidence, [{ phase: "p2", criterion: "c1", kind: "test", ref: "tests/smoke.test.js" }])
  assert.strictEqual(typeof next.updatedAt, "string")
})

test("applyEvidence does not mutate original state", () => {
  const state = makeActive()
  const frozenEvidence = JSON.stringify(state.phaseGraph.phases[1].criteria[0].evidence)
  applyEvidence(state, { phaseId: "p2", criterionId: "c1", kind: "test", ref: "x" })
  assert.strictEqual(JSON.stringify(state.phaseGraph.phases[1].criteria[0].evidence), frozenEvidence)
  assert.deepStrictEqual(state.evidence, [])
})

test("applyEvidence throws on unknown phase", () => {
  assert.throws(() => applyEvidence(makeActive(), { phaseId: "nope", criterionId: "c1", kind: "test", ref: "x" }), /phase "nope" not found/)
})

test("applyEvidence throws on unknown criterion", () => {
  assert.throws(() => applyEvidence(makeActive(), { phaseId: "p2", criterionId: "nope", kind: "test", ref: "x" }), /criterion "nope" not found/)
})

// ---- setPhaseStatus ------------------------------------------------------

test("setPhaseStatus transitions a phase", () => {
  const state = makeActive()
  const next = setPhaseStatus(state, "p1", "in_progress")
  assert.strictEqual(next.phaseGraph.phases[0].status, "in_progress")
  assert.strictEqual(state.phaseGraph.phases[0].status, "pending")
})

test("setPhaseStatus rejects invalid status", () => {
  assert.throws(() => setPhaseStatus(makeActive(), "p1", "done"), /invalid status/)
})

test("setPhaseStatus rejects unknown phase", () => {
  assert.throws(() => setPhaseStatus(makeActive(), "nope", "passed"), /phase "nope" not found/)
})

test("setPhaseStatus accepts all valid statuses", () => {
  for (const s of ["pending", "in_progress", "passed"]) {
    const next = setPhaseStatus(makeActive(), "p1", s)
    assert.strictEqual(next.phaseGraph.phases[0].status, s)
  }
})

// ---- setNextAction -------------------------------------------------------

test("setNextAction updates nextAction and timestamp", () => {
  const state = makeActive()
  const next = setNextAction(state, "dispatch phase 2")
  assert.strictEqual(next.nextAction, "dispatch phase 2")
  assert.strictEqual(state.nextAction, "")
  assert.strictEqual(typeof next.updatedAt, "string")
})

// ---- markShipped ---------------------------------------------------------

test("markShipped sets status to shipped with shippedAt", () => {
  const entry = emptyFeatureIndexEntry("f1", "c", makePhaseGraph())
  const shipped = markShipped(entry)
  assert.strictEqual(shipped.status, "shipped")
  assert.ok(shipped.shippedAt !== null)
  assert.ok(typeof shipped.shippedAt === "string")
  assert.strictEqual(entry.status, "open")
  assert.strictEqual(entry.shippedAt, null)
})

// ---- validateState reject cases ------------------------------------------

test("validateState rejects missing feature", () => {
  const s = makeActive()
  delete s.feature
  assert.throws(() => validateState(s), /state.feature/)
})

test("validateState rejects empty feature string", () => {
  const s = makeActive()
  s.feature = ""
  assert.throws(() => validateState(s), /state.feature/)
})

test("validateState rejects non-object phaseGraph", () => {
  const s = makeActive()
  s.phaseGraph = "wrong"
  assert.throws(() => validateState(s), /phaseGraph/)
})

test("validateState rejects unknown phase status", () => {
  const s = makeActive()
  s.phaseGraph.phases[0].status = "done"
  assert.throws(() => validateState(s), /status/)
})

test("validateState rejects cyclic dependsOn", () => {
  const s = makeActive()
  s.phaseGraph.phases[0].dependsOn = ["p3"]
  // p1 -> p3 -> p2 -> p1
  assert.throws(() => validateState(s), /cycle/)
})

test("validateState rejects unknown dependsOn ref", () => {
  const s = makeActive()
  s.phaseGraph.phases[0].dependsOn = ["p999"]
  assert.throws(() => validateState(s), /depends on unknown phase/)
})

test("validateState rejects bad evidence kind", () => {
  const s = makeActive()
  s.evidence.push({ phase: "p1", criterion: "c1", kind: "invalid", ref: "x" })
  assert.throws(() => validateState(s), /kind/)
})

test("validateState rejects missing evidence ref", () => {
  const s = makeActive()
  s.evidence.push({ phase: "p1", criterion: "c1", kind: "test", ref: "" })
  assert.throws(() => validateState(s), /evidence\[0\]\.ref/)
})

test("validateState rejects missing updatedAt", () => {
  const s = makeActive()
  delete s.updatedAt
  assert.throws(() => validateState(s), /state.updatedAt/)
})

test("validateState rejects empty updatedAt", () => {
  const s = makeActive()
  s.updatedAt = ""
  assert.throws(() => validateState(s), /state.updatedAt/)
})

test("validateState rejects non-array phaseGraph.phases", () => {
  const s = makeActive()
  s.phaseGraph.phases = "x"
  assert.throws(() => validateState(s), /phases/)
})

test("validateState rejects duplicate phase ids", () => {
  const s = makeActive()
  s.phaseGraph.phases.push({ id: "p1", title: "dup", dependsOn: [], status: "pending", criteria: [] })
  assert.throws(() => validateState(s), /duplicate phase/)
})

// ---- validateFeatureIndexEntry reject cases ------------------------------

test("validateFeatureIndexEntry rejects missing name", () => {
  const e = emptyFeatureIndexEntry("f1", "c", makePhaseGraph())
  delete e.name
  assert.throws(() => validateFeatureIndexEntry(e), /indexEntry.name/)
})

test("validateFeatureIndexEntry rejects bad status", () => {
  const e = emptyFeatureIndexEntry("f1", "c", makePhaseGraph())
  e.status = "done"
  assert.throws(() => validateFeatureIndexEntry(e), /status/)
})

test("validateFeatureIndexEntry rejects non-array phases", () => {
  const e = emptyFeatureIndexEntry("f1", "c", makePhaseGraph())
  e.phases = "x"
  assert.throws(() => validateFeatureIndexEntry(e), /phases/)
})

test("validateFeatureIndexEntry rejects phase missing id", () => {
  const e = emptyFeatureIndexEntry("f1", "c", makePhaseGraph())
  delete e.phases[0].id
  assert.throws(() => validateFeatureIndexEntry(e), /\.id/)
})

test("validateFeatureIndexEntry accepts all valid statuses", () => {
  for (const s of ["open", "in_progress", "shipped"]) {
    const e = emptyFeatureIndexEntry("f1", "c", makePhaseGraph())
    e.status = s
    validateFeatureIndexEntry(e)
  }
})

// ---- validateFeatureIndex reject cases -----------------------------------

test("validateFeatureIndex rejects non-array", () => {
  assert.throws(() => validateFeatureIndex("x"), /must be an array/)
})

test("validateFeatureIndex rejects item missing name", () => {
  assert.throws(() => validateFeatureIndex([{ status: "open", contract: "c" }]), /name/)
})

test("validateFeatureIndex rejects item non-object", () => {
  assert.throws(() => validateFeatureIndex(["x"]), /must be a plain object/)
})
