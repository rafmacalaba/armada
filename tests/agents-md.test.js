// AGENTS.md security ledger tests — Phase 3

import { test } from "node:test"
import assert from "node:assert"
import { readFileSync, rmSync } from "node:fs"

import { renderAgentsMd, buildTeam } from "../src/generator.js"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { scaffold } from "../src/scaffold.js"
import { makeTempRepo } from "./helpers.js"

const baseManifest = {
  project: {
    name: "test-project",
    budget: "balanced",
    browserTesting: false,
    devcontainer: false,
    useAgentBrowser: false,
    stack: { frontend: "react", backend: "node-express", database: "postgres", testing: "playwright", srcDirs: ["src"], languages: ["typescript"] },
  },
  team: ROLES.map((role) => ({ role, model: modelFor(role, "balanced"), variant: null, enabled: true })),
  playbook: {},
}

test("renderAgentsMd contains security ledger section", () => {
  const team = buildTeam(baseManifest)
  const md = renderAgentsMd(baseManifest, team)
  assert.match(md, /SECURITY_FINDINGS\.md/, "must reference SECURITY_FINDINGS.md")
  assert.match(md, /security findings/i, "must mention security findings")
  assert.match(md, /security/, "must mention security role")
})

test("renderAgentsMd security ledger section lives alongside defect and adversarial", () => {
  const team = buildTeam(baseManifest)
  const md = renderAgentsMd(baseManifest, team)
  assert.match(md, /DEFECTS\.md/)
  assert.match(md, /ADVERSARIAL_REVIEW\.md/)
  assert.match(md, /SECURITY_FINDINGS\.md/)
})

test("renderAgentsMd security ledger section references per-feature path", () => {
  const m = structuredClone(baseManifest)
  m.project.feature = "my-feature"
  const team = buildTeam(m)
  const md = renderAgentsMd(m, team, "my-feature")
  assert.match(md, /armada\/ledgers\/my-feature\/SECURITY_FINDINGS\.md/)
})

test("scaffolded AGENTS.md on disk contains security ledger section", () => {
  const repo = makeTempRepo({})
  const m = structuredClone(baseManifest)
  m.targetDir = repo
  scaffold(m, m.project.stack)
  const content = readFileSync(`${repo}/AGENTS.md`, "utf8")
  assert.match(content, /SECURITY_FINDINGS\.md/, "disk AGENTS.md must mention SECURITY_FINDINGS.md")
  assert.match(content, /security findings/i, "disk AGENTS.md must mention security findings")
  rmSync(repo, { recursive: true, force: true })
})
