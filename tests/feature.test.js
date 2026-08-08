import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { runCli, makeTempRepo, makeTempGitRepo } from "./helpers.js"
import { contractStub, extractFinalCriteriaEvidence, createFeature, listFeatures, closeFeature, setActiveContract, readActive } from "../src/feature-commands.js"

// ---- unit: contractStub ---------------------------------------------------

test("contractStub generates markdown with name and single phase", () => {
  const out = contractStub("my-feature")
  assert.match(out, /# my-feature/)
  assert.match(out, /## Goal/)
  assert.match(out, /## Final criteria/)
  assert.match(out, /- \[ \] All tests pass/)
  assert.match(out, /Evidence: /)
  assert.match(out, /## phase-1/)
})

test("contractStub with custom phase graph", () => {
  const pg = {
    phases: [
      { id: "p1", title: "Phase One", dependsOn: [], criteria: [{ id: "a", text: "criterion A" }] },
      { id: "p2", title: "Phase Two", dependsOn: ["p1"], criteria: [{ id: "b", text: "criterion B" }] },
    ],
  }
  const out = contractStub("feat", pg)
  assert.match(out, /# feat/)
  assert.match(out, /- \[ \] criterion A/)
  assert.match(out, /- \[ \] criterion B/)
  assert.match(out, /## p1 — Phase One/)
  assert.match(out, /## p2 — Phase Two/)
  assert.match(out, /\*\*Depends on:\*\* p1/)
})

// ---- unit: extractFinalCriteriaEvidence -----------------------------------

test("extractFinalCriteriaEvidence parses criteria with evidence", () => {
  const md = `## Final criteria

- [ ] criterion 1
  Evidence: src/foo.js:42
- [ ] criterion 2
  Evidence: tests/bar.test.js

## Next section

ignored
`
  const result = extractFinalCriteriaEvidence(md)
  assert.strictEqual(result.length, 2)
  assert.deepStrictEqual(result[0], { text: "criterion 1", evidence: "src/foo.js:42" })
  assert.deepStrictEqual(result[1], { text: "criterion 2", evidence: "tests/bar.test.js" })
})

test("extractFinalCriteriaEvidence returns null for missing evidence", () => {
  const md = `## Final criteria

- [ ] criterion 1
  Evidence: 
- [ ] criterion 2

## next
`
  const result = extractFinalCriteriaEvidence(md)
  assert.strictEqual(result.length, 2)
  assert.strictEqual(result[0].evidence, null)
  assert.strictEqual(result[1].evidence, null)
})

test("extractFinalCriteriaEvidence handles empty final criteria", () => {
  const md = `## Final criteria

## Next section
`
  const result = extractFinalCriteriaEvidence(md)
  assert.strictEqual(result.length, 0)
})

test("extractFinalCriteriaEvidence stops at next heading", () => {
  const md = `## Final criteria

- [ ] c1
  Evidence: x
- [ ] c2
  Evidence: y

## Another section

- [ ] ignored
`
  const result = extractFinalCriteriaEvidence(md)
  assert.strictEqual(result.length, 2)
})

// ---- CLI e2e ---------------------------------------------------------------

test("feature new creates contract, entry, index, active", async () => {
  const dir = makeTempGitRepo({ "readme.md": "# test" })
  const r = await runCli(["feature", "new", "foo"], { cwd: dir })
  assert.strictEqual(r.code, 0, `stdout: ${r.stdout} stderr: ${r.stderr}`)
  assert.match(r.stdout, /feature "foo" created/)

  const wtDir = join(dir, "sandbox", "foo")
  assert.ok(existsSync(join(wtDir, "armada/contracts/foo.md")))
  assert.ok(existsSync(join(wtDir, "armada/state/features/foo.json")))
  assert.ok(existsSync(join(wtDir, "armada/state/features/index.json")))
  assert.ok(existsSync(join(wtDir, "armada/state/active.json")))

  // Global index in main repo
  const indexJson = JSON.parse(readFileSync(join(dir, "armada/state/features/index.json"), "utf8"))
  const fooEntry = indexJson.find((e) => e.name === "foo")
  assert.ok(fooEntry)
  assert.strictEqual(fooEntry.status, "open")

  const active = JSON.parse(readFileSync(join(wtDir, "armada/state/active.json"), "utf8"))
  assert.strictEqual(active.feature, "foo")
})

test("feature list shows features", async () => {
  const dir = makeTempGitRepo({ "readme.md": "# test" })
  await runCli(["feature", "new", "foo"], { cwd: dir })
  await runCli(["feature", "new", "bar"], { cwd: dir })

  const r = await runCli(["feature", "list", "--target", dir])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /foo/)
  assert.match(r.stdout, /bar/)
  assert.match(r.stdout, /open/)
})

test("feature list with no features", async () => {
  const dir = makeTempGitRepo({ "readme.md": "# test" })
  const r = await runCli(["feature", "list", "--target", dir])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /No features/)
})

test("feature close without evidence fails", async () => {
  const dir = makeTempGitRepo({ "readme.md": "# test" })
  await runCli(["feature", "new", "foo"], { cwd: dir })

  const r = await runCli(["feature", "close", "foo", "--target", dir])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /refusing to close/)
  assert.match(r.stderr, /criteria lack evidence/)
})

test("feature close with evidence succeeds", async () => {
  const dir = makeTempGitRepo({ "readme.md": "# test" })
  await runCli(["feature", "new", "foo"], { cwd: dir })

  // Edit the contract in the worktree to add evidence
  const contractPath = join(dir, "sandbox", "foo", "armada", "contracts", "foo.md")
  let contract = readFileSync(contractPath, "utf8")
  contract = contract.replace(/Evidence: \n/g, "Evidence: src/foo.js:42\n")
  writeFileSync(contractPath, contract, "utf8")

  const r = await runCli(["feature", "close", "foo", "--target", dir])
  assert.strictEqual(r.code, 0, `stdout: ${r.stdout} stderr: ${r.stderr}`)
  assert.match(r.stdout, /shipped/)

  // Verify global index updated in main repo
  const indexJson = JSON.parse(readFileSync(join(dir, "armada", "state", "features", "index.json"), "utf8"))
  const fooEntry = indexJson.find((e) => e.name === "foo")
  assert.strictEqual(fooEntry.status, "shipped")

  // Verify active.json updated in main repo if it exists
  const mainActivePath = join(dir, "armada", "state", "active.json")
  if (existsSync(mainActivePath)) {
    const active = JSON.parse(readFileSync(mainActivePath, "utf8"))
    assert.match(active.nextAction, /shipped/)
  }
})

test("feature close nonexistent fails", async () => {
  const dir = makeTempGitRepo({ "readme.md": "# test" })
  const r = await runCli(["feature", "close", "nonexistent", "--target", dir])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /not found/)
})

test("feature new with duplicate name overrides entry in index", async () => {
  const dir = makeTempGitRepo({ "readme.md": "# test" })
  await runCli(["feature", "new", "foo"], { cwd: dir })
  await runCli(["feature", "new", "foo"], { cwd: dir })

  const indexJson = JSON.parse(readFileSync(join(dir, "armada/state/features/index.json"), "utf8"))
  const fooEntries = indexJson.filter((e) => e.name === "foo")
  assert.strictEqual(fooEntries.length, 1)
})

test("init --requirements wires active contract", async () => {
  const dir = makeTempGitRepo({
    "reqs.md": "# MyContract\n\n## Final criteria\n\n- [ ] c1\n  Evidence: x\n",
    "armada/armada.yaml": "project:\n  name: test\n  stack: {}\nteam:\n  - role: orchestrator\n    model: opencode-go/minimax-m3\n    enabled: true\n",
  })

  const r = await runCli(["init", "--requirements", "reqs.md", "--target", dir, "--from-armada", "armada/armada.yaml"], { cwd: dir })
  assert.strictEqual(r.code, 0, `stderr: ${r.stderr}`)

  const active = JSON.parse(readFileSync(join(dir, "armada/state/active.json"), "utf8"))
  assert.strictEqual(active.feature, "reqs")
  assert.strictEqual(active.contract, "reqs.md")
})

test("feature status shows deprecation hint across scenarios, exits 1", async () => {
  for (const [label, makeRepo] of [
    ["active feature", async () => {
      const dir = makeTempGitRepo({ "readme.md": "# test" })
      await runCli(["feature", "new", "foo"], { cwd: dir })
      return { dir, r: await runCli(["feature", "status", "--target", dir]) }
    }],
    ["named active feature", async () => {
      const dir = makeTempGitRepo({ "readme.md": "# test" })
      await runCli(["feature", "new", "foo"], { cwd: dir })
      return { dir, r: await runCli(["feature", "status", "foo", "--target", dir]) }
    }],
    ["nonexistent feature", async () => {
      const dir = makeTempGitRepo({ "readme.md": "# test" })
      return { dir, r: await runCli(["feature", "status", "nope", "--target", dir]) }
    }],
    ["no active feature", async () => {
      const dir = makeTempGitRepo({ "readme.md": "# test" })
      return { dir, r: await runCli(["feature", "status", "--target", dir]) }
    }],
  ]) {
    const { dir, r } = await makeRepo()
    assert.strictEqual(r.code, 1, `${label} exits 1`)
    assert.match(r.stderr, /removed in v2\.0/, `${label} has deprecation hint`)
    rmSync(dir, { recursive: true, force: true })
  }
})

test("status JSON exposes adaptive workflow metadata", async () => {
  const dir = makeTempGitRepo({ "readme.md": "# test" })
  await runCli(["feature", "new", "workflow-status"], { cwd: dir })

  // Write workflow metadata to the main repo's active.json (status reads from there)
  const activePath = join(dir, "armada", "state", "active.json")
  mkdirSync(join(dir, "armada", "state"), { recursive: true })
  const active = { feature: "workflow-status", contract: "armada/contracts/workflow-status.md", phases: [], startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), nextAction: null, workflow: { risk: "medium", evidenceClass: "targeted", activeAgents: ["backend-dev", "qa"], standbyAgents: ["security"], escalations: [] } }
  writeFileSync(activePath, JSON.stringify(active, null, 2) + "\n")

  const result = await runCli(["status", "--json", "--target", dir])
  assert.strictEqual(result.code, 0)
  const row = JSON.parse(result.stdout)[0]
  assert.deepStrictEqual(row.workflow, {
    risk: "medium",
    evidenceClass: "targeted",
    activeAgents: ["backend-dev", "qa"],
  })
  rmSync(dir, { recursive: true, force: true })
})

test("closeFeature throws when no final criteria", () => {
  const dir = makeTempGitRepo({
    "readme.md": "# test",
    "armada/contracts/fc.md": "# FC\n\n## Goal\n\nno criteria\n",
  })
  // Make the feature entry manually
  const featuresDir = join(dir, "armada", "state", "features")
  mkdirSync(featuresDir, { recursive: true })
  writeFileSync(join(featuresDir, "fc.json"), JSON.stringify({
    name: "fc",
    status: "open",
    contract: "armada/contracts/fc.md",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    shippedAt: null,
    phases: [],
  }))
  writeFileSync(join(featuresDir, "index.json"), JSON.stringify([
    { name: "fc", status: "open", contract: "armada/contracts/fc.md" },
  ]))

  assert.throws(
    () => closeFeature(dir, "fc"),
    /no final criteria found/
  )
})

test("feature close with multiple criteria, some missing evidence", async () => {
  const dir = makeTempGitRepo({ "readme.md": "# test" })
  await runCli(["feature", "new", "multi"], { cwd: dir })

  // Read the contract in the worktree, customize to have multiple criteria
  const contractPath = join(dir, "sandbox", "multi", "armada", "contracts", "multi.md")
  let contract = readFileSync(contractPath, "utf8")
  // Replace the final criteria section to have multiple criteria
  contract = contract.replace(
    /## Final criteria\n\n- \[ \] All tests pass\n  Evidence: \n/,
    `## Final criteria

- [ ] first criterion
  Evidence: src/a.ts:10
- [ ] second criterion
  Evidence: 
`
  )
  writeFileSync(contractPath, contract, "utf8")

  const r = await runCli(["feature", "close", "multi", "--target", dir])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /1 criteria lack evidence/)
  assert.match(r.stderr, /second criterion/)
})
