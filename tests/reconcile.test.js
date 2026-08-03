import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { reconcile } from "../src/reconcile.js"

// ---- helpers ---------------------------------------------------------------

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), "reconcile-test-"))
}

function writeJson(dir, rel, obj) {
  const full = join(dir, rel)
  mkdirSync(join(dir, rel, ".."), { recursive: true })
  writeFileSync(full, JSON.stringify(obj, null, 2) + "\n", "utf8")
}

function writeFile(dir, rel, content) {
  const full = join(dir, rel)
  mkdirSync(join(dir, rel, ".."), { recursive: true })
  writeFileSync(full, content, "utf8")
}

function phaseGraph(phases) {
  return { phases }
}

function phase(id, deps, criteria) {
  return { id, title: id, dependsOn: deps || [], status: "pending", criteria: criteria || [] }
}

function criterion(id, text, evidence) {
  return { id, text: text || id, evidence: evidence || null }
}

function featureIndexEntry(name, status, contract) {
  return { name, status: status || "open", contract: contract || `armada/contracts/${name}.md`, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", shippedAt: null, phases: [] }
}

function active(feature, contract, phases, evidence) {
  return {
    feature,
    contract: contract || `armada/contracts/${feature}.md`,
    phaseGraph: phaseGraph(phases || []),
    evidence: evidence || [],
    nextAction: "",
    updatedAt: "2026-01-01T00:00:00Z",
  }
}

function contractMarkdown(name, phases, finalCriteria) {
  let out = `# ${name}\n\n## Goal\n\n<describe>\n\n## Final criteria\n\n`
  for (const c of (finalCriteria || [])) {
    const tick = c.ticked ? "x" : " "
    out += `- [${tick}] ${c.text}\n`
    if (c.evidence !== undefined) out += `  Evidence: ${c.evidence || ""}\n`
  }
  out += `\n`
  for (const p of (phases || [])) {
    out += `## ${p.id} — ${p.title || p.id}\n\n`
    out += `- **Depends on:** ${(p.dependsOn || []).join(", ") || "none"}\n`
    out += `- **Goal:** <describe>\n`
    out += `- **Success criteria:**\n`
    for (const c of (p.criteria || [])) {
      const tick = c.ticked ? "x" : " "
      out += `  - [${tick}] ${c.text}\n`
    }
    out += `\n`
  }
  return out
}

// Snapshot mtime+content for all files under a dir recursively
function snapshotDir(dir) {
  const entries = []
  try {
    const walk = (d) => {
      const items = readdirSync(d, { withFileTypes: true })
      for (const item of items) {
        const full = join(d, item.name)
        if (item.isDirectory()) {
          walk(full)
        } else {
          const stat = statSync(full)
          const content = readFileSync(full, "utf8")
          entries.push({ path: full, mtimeMs: stat.mtimeMs, content })
        }
      }
    }
    walk(dir)
  } catch {
    // dir doesn't exist — empty snapshot
  }
  // sort for determinism
  entries.sort((a, b) => a.path.localeCompare(b.path))
  return JSON.stringify(entries)
}

// ---- tests -----------------------------------------------------------------

test("no active feature -> returns plan with no activeFeature", () => {
  const dir = makeTmpDir()
  const stateDir = join(dir, "armada", "state")
  mkdirSync(stateDir, { recursive: true })

  const plan = reconcile(stateDir, dir)

  assert.strictEqual(plan.activeFeature, null)
  assert.strictEqual(plan.currentPhase, null)
  assert.deepStrictEqual(plan.drifts, [])
  assert.match(plan.resumeLine, /no active feature/)
  assert.strictEqual(plan.generatedAt, plan.generatedAt || null)
})

test("missing active.json (no state dir) -> no active feature", () => {
  const dir = makeTmpDir()

  const plan = reconcile(join(dir, "armada", "state"), dir)

  assert.strictEqual(plan.activeFeature, null)
  assert.deepStrictEqual(plan.drifts, [])
})

test("passed state — all criteria ticked, all evidence present", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  const phases = [
    phase("phase-1", [], [
      criterion("c1", "All tests pass", { kind: "test", ref: "tests/smoke.test.js" }),
    ]),
    phase("phase-2", ["phase-1"], [
      criterion("c2", "E2E pass", { kind: "test", ref: "tests/e2e.test.js" }),
    ]),
  ]
  phases[0].status = "passed"
  phases[1].status = "passed"

  writeJson(stateDir, "active.json", active("my-feature", "armada/contracts/my-feature.md", phases, [
    { phase: "phase-1", criterion: "c1", kind: "test", ref: "tests/smoke.test.js" },
    { phase: "phase-2", criterion: "c2", kind: "test", ref: "tests/e2e.test.js" },
  ]))

  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("my-feature", "in_progress", "armada/contracts/my-feature.md"),
  ])

  writeFile(repoRoot, "armada/contracts/my-feature.md", contractMarkdown("my-feature", [
    { id: "phase-1", dependsOn: [], criteria: [{ id: "c1", text: "All tests pass", ticked: true }] },
    { id: "phase-2", dependsOn: ["phase-1"], criteria: [{ id: "c2", text: "E2E pass", ticked: true }] },
  ]))

  // Evidence files exist
  writeFile(repoRoot, "tests/smoke.test.js", "// passes")
  writeFile(repoRoot, "tests/e2e.test.js", "// passes")

  const beforeSnap = snapshotDir(stateDir)

  const plan = reconcile(stateDir, repoRoot)

  const afterSnap = snapshotDir(stateDir)
  assert.strictEqual(afterSnap, beforeSnap, "stateDir must be byte-identical before and after reconcile")

  assert.strictEqual(plan.activeFeature, "my-feature")
  assert.strictEqual(plan.currentPhase, "phase-2")
  assert.deepStrictEqual(plan.drifts, [])
  assert.match(plan.resumeLine, /my-feature/)
  assert.match(plan.resumeLine, /phase-2/)
})

test("evidence-missing — evidence ref file does not exist on disk", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  const phases = [
    phase("phase-1", [], [
      criterion("c1", "All tests pass", { kind: "test", ref: "tests/deleted.test.js" }),
    ]),
  ]
  phases[0].status = "in_progress"

  writeJson(stateDir, "active.json", active("my-feature", "armada/contracts/my-feature.md", phases, [
    { phase: "phase-1", criterion: "c1", kind: "test", ref: "tests/deleted.test.js" },
  ]))

  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("my-feature", "in_progress", "armada/contracts/my-feature.md"),
  ])

  writeFile(repoRoot, "armada/contracts/my-feature.md", contractMarkdown("my-feature", [
    { id: "phase-1", dependsOn: [], criteria: [{ id: "c1", text: "All tests pass", ticked: true }] },
  ]))

  // Evidence file does NOT exist

  const beforeSnap = snapshotDir(stateDir)

  const plan = reconcile(stateDir, repoRoot)

  const afterSnap = snapshotDir(stateDir)
  assert.strictEqual(afterSnap, beforeSnap)

  assert.strictEqual(plan.activeFeature, "my-feature")
  assert.strictEqual(plan.currentPhase, "phase-1")
  assert.strictEqual(plan.drifts.length, 1)
  assert.strictEqual(plan.drifts[0].kind, "evidence-missing")
  assert.strictEqual(plan.drifts[0].phase, "phase-1")
  assert.strictEqual(plan.drifts[0].criterion, "c1")
  assert.strictEqual(plan.drifts[0].ref, "tests/deleted.test.js")
})

test("evidence-failed — test evidence file exists but contains failure", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  const phases = [
    phase("phase-1", [], [
      criterion("c1", "Integration test", { kind: "test", ref: "tests/failing.test.js" }),
    ]),
  ]
  phases[0].status = "in_progress"

  writeJson(stateDir, "active.json", active("my-feature", "armada/contracts/my-feature.md", phases, [
    { phase: "phase-1", criterion: "c1", kind: "test", ref: "tests/failing.test.js" },
  ]))

  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("my-feature", "in_progress", "armada/contracts/my-feature.md"),
  ])

  writeFile(repoRoot, "armada/contracts/my-feature.md", contractMarkdown("my-feature", [
    { id: "phase-1", dependsOn: [], criteria: [{ id: "c1", text: "Integration test", ticked: true }] },
  ]))

  // Evidence file exists with failure markers
  writeFile(repoRoot, "tests/failing.test.js", "FAIL: Test failed\nnot ok 1 - integration")

  const beforeSnap = snapshotDir(stateDir)

  const plan = reconcile(stateDir, repoRoot)

  const afterSnap = snapshotDir(stateDir)
  assert.strictEqual(afterSnap, beforeSnap)

  assert.strictEqual(plan.activeFeature, "my-feature")
  assert.strictEqual(plan.drifts.length, 1)
  assert.strictEqual(plan.drifts[0].kind, "evidence-failed")
  assert.strictEqual(plan.drifts[0].phase, "phase-1")
})

test("criterion-unticked — passed phase has unchecked criterion in contract", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  const phases = [
    phase("phase-1", [], [
      criterion("c1", "All tests pass", { kind: "test", ref: "tests/smoke.test.js" }),
    ]),
  ]
  phases[0].status = "passed"

  writeJson(stateDir, "active.json", active("my-feature", "armada/contracts/my-feature.md", phases, [
    { phase: "phase-1", criterion: "c1", kind: "test", ref: "tests/smoke.test.js" },
  ]))

  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("my-feature", "in_progress", "armada/contracts/my-feature.md"),
  ])

  // Contract has criterion UNTICKED
  writeFile(repoRoot, "armada/contracts/my-feature.md", contractMarkdown("my-feature", [
    { id: "phase-1", dependsOn: [], criteria: [{ id: "c1", text: "All tests pass", ticked: false }] },
  ]))

  writeFile(repoRoot, "tests/smoke.test.js", "// passes")

  const beforeSnap = snapshotDir(stateDir)

  const plan = reconcile(stateDir, repoRoot)

  const afterSnap = snapshotDir(stateDir)
  assert.strictEqual(afterSnap, beforeSnap)

  assert.strictEqual(plan.activeFeature, "my-feature")
  assert.strictEqual(plan.drifts.length, 1)
  assert.strictEqual(plan.drifts[0].kind, "criterion-unticked")
  assert.strictEqual(plan.drifts[0].phase, "phase-1")
})

test("multiple drifts detected for single phase", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  const phases = [
    phase("phase-1", [], [
      criterion("c1", "Test A", { kind: "test", ref: "tests/missing.js" }),
      criterion("c2", "Test B", { kind: "test", ref: "tests/exists.js" }),
    ]),
  ]
  phases[0].status = "passed"

  writeJson(stateDir, "active.json", active("feat", "armada/contracts/feat.md", phases, [
    { phase: "phase-1", criterion: "c1", kind: "test", ref: "tests/missing.js" },
    { phase: "phase-1", criterion: "c2", kind: "test", ref: "tests/exists.js" },
  ]))

  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("feat", "in_progress", "armada/contracts/feat.md"),
  ])

  writeFile(repoRoot, "armada/contracts/feat.md", contractMarkdown("feat", [
    { id: "phase-1", dependsOn: [], criteria: [
      { id: "c1", text: "Test A", ticked: false },
      { id: "c2", text: "Test B", ticked: true },
    ] },
  ]))

  // Only one evidence file exists
  writeFile(repoRoot, "tests/exists.js", "// ok")

  const beforeSnap = snapshotDir(stateDir)

  const plan = reconcile(stateDir, repoRoot)

  const afterSnap = snapshotDir(stateDir)
  assert.strictEqual(afterSnap, beforeSnap)

  assert.strictEqual(plan.activeFeature, "feat")
  assert.strictEqual(plan.drifts.length, 2)
  const kinds = plan.drifts.map((d) => d.kind).sort()
  assert.deepStrictEqual(kinds, ["criterion-unticked", "evidence-missing"])
})

test("multi-feature — one in-progress (active), one open, reports active only", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  const phases = [
    phase("phase-1", [], [
      criterion("c1", "Tests", { kind: "test", ref: "tests/ok.js" }),
    ]),
  ]
  phases[0].status = "in_progress"

  writeJson(stateDir, "active.json", active("active-feat", "armada/contracts/active-feat.md", phases, [
    { phase: "phase-1", criterion: "c1", kind: "test", ref: "tests/ok.js" },
  ]))

  // Two features in index: one in_progress (active), one open
  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("active-feat", "in_progress", "armada/contracts/active-feat.md"),
    featureIndexEntry("other-feat", "open", "armada/contracts/other-feat.md"),
  ])

  writeFile(repoRoot, "armada/contracts/active-feat.md", contractMarkdown("active-feat", [
    { id: "phase-1", dependsOn: [], criteria: [{ id: "c1", text: "Tests", ticked: true }] },
  ]))

  writeFile(repoRoot, "tests/ok.js", "// ok")

  const beforeSnap = snapshotDir(stateDir)

  const plan = reconcile(stateDir, repoRoot)

  const afterSnap = snapshotDir(stateDir)
  assert.strictEqual(afterSnap, beforeSnap)

  assert.strictEqual(plan.activeFeature, "active-feat")
  assert.deepStrictEqual(plan.drifts, [])
})

test("resumeLine format — no active feature", () => {
  const dir = makeTmpDir()

  const plan = reconcile(join(dir, "armada", "state"), dir)

  assert.strictEqual(plan.resumeLine, "resume: no active feature")
})

test("resumeLine format — active feature with current phase", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  const phases = [
    phase("phase-1", [], [
      criterion("c1", "Tests pass", { kind: "test", ref: "tests/ok.js" }),
    ]),
  ]
  phases[0].status = "in_progress"

  writeJson(stateDir, "active.json", active("feat", "armada/contracts/feat.md", phases, [
    { phase: "phase-1", criterion: "c1", kind: "test", ref: "tests/ok.js" },
  ]))

  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("feat", "in_progress", "armada/contracts/feat.md"),
  ])

  writeFile(repoRoot, "armada/contracts/feat.md", contractMarkdown("feat", [
    { id: "phase-1", dependsOn: [], criteria: [{ id: "c1", text: "Tests pass", ticked: true }] },
  ]))

  writeFile(repoRoot, "tests/ok.js", "// ok")

  const plan = reconcile(stateDir, repoRoot)

  assert.match(plan.resumeLine, /^resume: feature feat, phase phase-1 \(in_progress\), evidence 1 in, drift 0, next /)
})

test("resumeLine shows next action from first unchecked criterion", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  const phases = [
    phase("phase-1", [], [
      criterion("c1", "First criterion", { kind: "test", ref: "tests/ok.js" }),
      criterion("c2", "Second criterion", null),
    ]),
  ]
  phases[0].status = "in_progress"

  writeJson(stateDir, "active.json", active("feat", "armada/contracts/feat.md", phases, [
    { phase: "phase-1", criterion: "c1", kind: "test", ref: "tests/ok.js" },
  ]))

  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("feat", "in_progress", "armada/contracts/feat.md"),
  ])

  writeFile(repoRoot, "armada/contracts/feat.md", contractMarkdown("feat", [
    { id: "phase-1", dependsOn: [], criteria: [
      { id: "c1", text: "First criterion", ticked: true },
      { id: "c2", text: "Second criterion", ticked: false },
    ] },
  ]))

  writeFile(repoRoot, "tests/ok.js", "// ok")

  const plan = reconcile(stateDir, repoRoot)

  assert.match(plan.resumeLine, /next "Second criterion"$/)
})

test("resumeLine — feature ready to close when all phases passed", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  const phases = [
    phase("phase-1", [], [
      criterion("c1", "Done", { kind: "test", ref: "tests/ok.js" }),
    ]),
  ]
  phases[0].status = "passed"

  writeJson(stateDir, "active.json", active("feat", "armada/contracts/feat.md", phases, [
    { phase: "phase-1", criterion: "c1", kind: "test", ref: "tests/ok.js" },
  ]))

  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("feat", "in_progress", "armada/contracts/feat.md"),
  ])

  writeFile(repoRoot, "armada/contracts/feat.md", contractMarkdown("feat", [
    { id: "phase-1", dependsOn: [], criteria: [{ id: "c1", text: "Done", ticked: true }] },
  ]))

  writeFile(repoRoot, "tests/ok.js", "// ok")

  const plan = reconcile(stateDir, repoRoot)

  assert.match(plan.resumeLine, /feature ready to close$/)
})

test("zero writes — reconcile does not mutate stateDir", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  const phases = [
    phase("phase-1", [], [
      criterion("c1", "Tests", { kind: "test", ref: "tests/ok.js" }),
    ]),
  ]
  phases[0].status = "in_progress"

  writeJson(stateDir, "active.json", active("feat", "armada/contracts/feat.md", phases, [
    { phase: "phase-1", criterion: "c1", kind: "test", ref: "tests/ok.js" },
  ]))

  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("feat", "in_progress", "armada/contracts/feat.md"),
  ])

  writeFile(repoRoot, "armada/contracts/feat.md", contractMarkdown("feat", [
    { id: "phase-1", dependsOn: [], criteria: [{ id: "c1", text: "Tests", ticked: true }] },
  ]))

  writeFile(repoRoot, "tests/ok.js", "// ok")

  const beforeSnap = snapshotDir(stateDir)

  // Run 3 times
  reconcile(stateDir, repoRoot)
  reconcile(stateDir, repoRoot)
  reconcile(stateDir, repoRoot)

  const afterSnap = snapshotDir(stateDir)
  assert.strictEqual(afterSnap, beforeSnap, "stateDir must be unchanged after reconcile")
})

test("screenshot evidence missing -> evidence-missing drift", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  const phases = [
    phase("phase-1", [], [
      criterion("c1", "UI works", { kind: "screenshot", ref: "screenshots/ui.png" }),
    ]),
  ]
  phases[0].status = "in_progress"

  writeJson(stateDir, "active.json", active("feat", "armada/contracts/feat.md", phases, [
    { phase: "phase-1", criterion: "c1", kind: "screenshot", ref: "screenshots/ui.png" },
  ]))

  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("feat", "in_progress", "armada/contracts/feat.md"),
  ])

  writeFile(repoRoot, "armada/contracts/feat.md", contractMarkdown("feat", [
    { id: "phase-1", dependsOn: [], criteria: [{ id: "c1", text: "UI works", ticked: true }] },
  ]))

  // No screenshot file

  const plan = reconcile(stateDir, repoRoot)

  assert.strictEqual(plan.drifts.length, 1)
  assert.strictEqual(plan.drifts[0].kind, "evidence-missing")
  assert.strictEqual(plan.drifts[0].ref, "screenshots/ui.png")
})

test("file:line evidence exists -> no drift", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  const phases = [
    phase("phase-1", [], [
      criterion("c1", "Code at line", { kind: "file:line", ref: "src/main.js" }),
    ]),
  ]
  phases[0].status = "in_progress"

  writeJson(stateDir, "active.json", active("feat", "armada/contracts/feat.md", phases, [
    { phase: "phase-1", criterion: "c1", kind: "file:line", ref: "src/main.js" },
  ]))

  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("feat", "in_progress", "armada/contracts/feat.md"),
  ])

  writeFile(repoRoot, "armada/contracts/feat.md", contractMarkdown("feat", [
    { id: "phase-1", dependsOn: [], criteria: [{ id: "c1", text: "Code at line", ticked: true }] },
  ]))

  writeFile(repoRoot, "src/main.js", "// code")

  const plan = reconcile(stateDir, repoRoot)

  assert.deepStrictEqual(plan.drifts, [])
})

test("failing evidence file with TAP format -> evidence-failed", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  const phases = [
    phase("phase-1", [], [
      criterion("c1", "Tap test", { kind: "test", ref: "tests/tap.test.js" }),
    ]),
  ]
  phases[0].status = "in_progress"

  writeJson(stateDir, "active.json", active("tap-feat", "armada/contracts/tap-feat.md", phases, [
    { phase: "phase-1", criterion: "c1", kind: "test", ref: "tests/tap.test.js" },
  ]))

  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("tap-feat", "in_progress", "armada/contracts/tap-feat.md"),
  ])

  writeFile(repoRoot, "armada/contracts/tap-feat.md", contractMarkdown("tap-feat", [
    { id: "phase-1", dependsOn: [], criteria: [{ id: "c1", text: "Tap test", ticked: true }] },
  ]))

  writeFile(repoRoot, "tests/tap.test.js", "not ok 1 - test failed\nnot ok 2 - another fail\n1..2\n# fail 2")

  const plan = reconcile(stateDir, repoRoot)

  assert.strictEqual(plan.drifts.length, 1)
  assert.strictEqual(plan.drifts[0].kind, "evidence-failed")
})

// Bug A: "0 failing" in evidence should not trigger evidence-failed
test("Bug A — 0 failing in evidence file does not trigger evidence-failed", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  const phases = [
    phase("phase-1", [], [
      criterion("c1", "Tests", { kind: "test", ref: "tests/passing.test.js" }),
    ]),
  ]
  phases[0].status = "in_progress"

  writeJson(stateDir, "active.json", active("feat", "armada/contracts/feat.md", phases, [
    { phase: "phase-1", criterion: "c1", kind: "test", ref: "tests/passing.test.js" },
  ]))

  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("feat", "in_progress", "armada/contracts/feat.md"),
  ])

  writeFile(repoRoot, "armada/contracts/feat.md", contractMarkdown("feat", [
    { id: "phase-1", dependsOn: [], criteria: [{ id: "c1", text: "Tests", ticked: true }] },
  ]))

  // Evidence has "0 failing" — should NOT be treated as failure
  writeFile(repoRoot, "tests/passing.test.js", "tests 5 pass, 0 failing\nall good")

  const plan = reconcile(stateDir, repoRoot)

  assert.strictEqual(plan.drifts.length, 0, "0 failing should not trigger evidence-failed")
})

// Bug B: uppercase X checkbox "- [X]" should be treated as ticked
test("Bug B — uppercase [X] checkbox parsed as ticked, no false unticked drift", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  const phases = [
    phase("phase-1", [], [
      criterion("c1", "Test A", { kind: "test", ref: "tests/ok.js" }),
      criterion("c2", "Test B", { kind: "test", ref: "tests/ok.js" }),
    ]),
  ]
  phases[0].status = "passed"

  writeJson(stateDir, "active.json", active("feat", "armada/contracts/feat.md", phases, [
    { phase: "phase-1", criterion: "c1", kind: "test", ref: "tests/ok.js" },
    { phase: "phase-1", criterion: "c2", kind: "test", ref: "tests/ok.js" },
  ]))

  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("feat", "in_progress", "armada/contracts/feat.md"),
  ])

  // Contract: c1 ticked via [X], c2 unticked via [ ]
  writeFile(repoRoot, "armada/contracts/feat.md", `# feat

## Goal

<describe>

## Final criteria

## phase-1 — Phase 1

- **Depends on:** none
- **Goal:** <describe>
- **Success criteria:**
  - [X] Test A
  - [ ] Test B

`)

  writeFile(repoRoot, "tests/ok.js", "// ok")

  const plan = reconcile(stateDir, repoRoot)

  // [X] should be parsed as ticked -> no drift for c1
  // [ ] is unticked -> drift for c2 only
  assert.strictEqual(plan.drifts.length, 1)
  assert.strictEqual(plan.drifts[0].kind, "criterion-unticked")
  assert.strictEqual(plan.drifts[0].criterion, "c2")
})

// Bug C: activeFeature set but empty phaseGraph -> meaningful resume line
test("Bug C — active feature with empty phases gives meaningful resume line", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  writeJson(stateDir, "active.json", {
    feature: "x",
    contract: "armada/contracts/x.md",
    phaseGraph: { phases: [] },
    evidence: [],
    nextAction: "",
    updatedAt: "2026-01-01T00:00:00Z",
  })

  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("x", "in_progress", "armada/contracts/x.md"),
  ])

  // No contract file needed for this test

  const plan = reconcile(stateDir, repoRoot)

  assert.notStrictEqual(plan.activeFeature, null, "activeFeature should be set")
  assert.ok(!plan.resumeLine.includes("no active feature"), "should NOT say 'no active feature'")
  assert.match(plan.resumeLine, /feature x/)
  assert.match(plan.resumeLine, /evidence 0 in/)
})

// ADV-023: Array.isArray guard on phase.criteria — non-array (null, string) must not throw
test("ADV-023 — non-array phase.criteria handled without throw", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  // Phase with criteria set to null
  const phaseNull = phase("phase-1", [], null)
  phaseNull.criteria = null

  const phases = [phaseNull]
  phases[0].status = "in_progress"

  writeJson(stateDir, "active.json", active("feat", "armada/contracts/feat.md", phases, []))
  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("feat", "in_progress", "armada/contracts/feat.md"),
  ])
  writeFile(repoRoot, "armada/contracts/feat.md", contractMarkdown("feat", []))
  writeFile(repoRoot, "tests/ok.js", "// ok")

  assert.doesNotThrow(() => reconcile(stateDir, repoRoot))
  const plan = reconcile(stateDir, repoRoot)
  assert.notStrictEqual(plan.activeFeature, null)
  assert.deepStrictEqual(plan.drifts, [])
})

test("ADV-023 — string phase.criteria does not throw", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  const phaseStr = phase("phase-1", [], [])
  phaseStr.criteria = "not-an-array"

  const phases = [phaseStr]
  phases[0].status = "in_progress"

  writeJson(stateDir, "active.json", active("feat", "armada/contracts/feat.md", phases, []))
  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("feat", "in_progress", "armada/contracts/feat.md"),
  ])
  writeFile(repoRoot, "armada/contracts/feat.md", contractMarkdown("feat", []))
  writeFile(repoRoot, "tests/ok.js", "// ok")

  assert.doesNotThrow(() => reconcile(stateDir, repoRoot))
  const plan = reconcile(stateDir, repoRoot)
  assert.notStrictEqual(plan.activeFeature, null)
  assert.deepStrictEqual(plan.drifts, [])
})

// ADV-025: null phase entries in phases array must not crash
test("ADV-025 — null phase entry in phases array does not throw", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  const goodPhase = phase("phase-1", [], [
    criterion("c1", "Test", { kind: "test", ref: "tests/ok.js" }),
  ])
  goodPhase.status = "in_progress"

  writeJson(stateDir, "active.json", active("feat", "armada/contracts/feat.md", [goodPhase, null], [
    { phase: "phase-1", criterion: "c1", kind: "test", ref: "tests/ok.js" },
  ]))
  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("feat", "in_progress", "armada/contracts/feat.md"),
  ])
  writeFile(repoRoot, "armada/contracts/feat.md", contractMarkdown("feat", [
    { id: "phase-1", dependsOn: [], criteria: [{ id: "c1", text: "Test", ticked: true }] },
  ]))
  writeFile(repoRoot, "tests/ok.js", "// ok")

  assert.doesNotThrow(() => reconcile(stateDir, repoRoot))
  const plan = reconcile(stateDir, repoRoot)
  assert.notStrictEqual(plan.activeFeature, null)
  assert.deepStrictEqual(plan.drifts, [])
})

// ADV-026: checkEvidence must not crash on undefined evidence.ref
test("ADV-026 — missing evidence.ref returns evidence-missing drift instead of crash", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  const phases = [
    {
      id: "phase-1",
      title: "Phase 1",
      dependsOn: [],
      status: "in_progress",
      criteria: [
        { id: "c1", text: "Test", evidence: { kind: "test" } }, // no ref!
      ],
    },
  ]

  writeJson(stateDir, "active.json", active("feat", "armada/contracts/feat.md", phases, [
    { phase: "phase-1", criterion: "c1", kind: "test", ref: undefined },
  ]))
  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("feat", "in_progress", "armada/contracts/feat.md"),
  ])
  writeFile(repoRoot, "armada/contracts/feat.md", contractMarkdown("feat", [
    { id: "phase-1", dependsOn: [], criteria: [{ id: "c1", text: "Test", ticked: true }] },
  ]))

  assert.doesNotThrow(() => reconcile(stateDir, repoRoot))
  const plan = reconcile(stateDir, repoRoot)
  assert.strictEqual(plan.activeFeature, "feat")
  const drift = plan.drifts.find((d) => d.criterion === "c1")
  assert.ok(drift, "should have drift for c1")
  assert.strictEqual(drift.kind, "evidence-missing")
  assert.strictEqual(drift.detail, "criterion has no evidence.ref")
})

// Bug D: evidence path is a directory -> not treated as evidence-missing (silently)
test("Bug D — directory as evidence path reports useful drift", () => {
  const dir = makeTmpDir()
  const repoRoot = dir
  const stateDir = join(repoRoot, "armada", "state")

  const phases = [
    phase("phase-1", [], [
      criterion("c1", "Tests pass", { kind: "test", ref: "tests/not-a-file" }),
    ]),
  ]
  phases[0].status = "in_progress"

  writeJson(stateDir, "active.json", active("feat", "armada/contracts/feat.md", phases, [
    { phase: "phase-1", criterion: "c1", kind: "test", ref: "tests/not-a-file" },
  ]))

  writeJson(stateDir, "features/index.json", [
    featureIndexEntry("feat", "in_progress", "armada/contracts/feat.md"),
  ])

  writeFile(repoRoot, "armada/contracts/feat.md", contractMarkdown("feat", [
    { id: "phase-1", dependsOn: [], criteria: [{ id: "c1", text: "Tests pass", ticked: true }] },
  ]))

  // Create a directory at the evidence path
  mkdirSync(join(repoRoot, "tests", "not-a-file"), { recursive: true })

  const plan = reconcile(stateDir, repoRoot)

  assert.strictEqual(plan.drifts.length, 1)
  assert.ok(
    plan.drifts[0].detail.toLowerCase().includes("directory") ||
    plan.drifts[0].detail.toLowerCase().includes("eisdir") ||
    plan.drifts[0].detail.toLowerCase().includes("is a dir"),
    `detail should mention directory, got: ${plan.drifts[0].detail}`
  )
})
