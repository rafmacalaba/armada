// Scaffold security ledger template tests — Phase 3

import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync, rmSync, mkdtempSync, writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { scaffold, fillTemplate } from "../src/scaffold.js"
import { renderSecurityFindingsTemplate } from "../src/generator.js"
import { ROLES, modelFor } from "../src/model-catalog.js"

function makeManifest(dir) {
  return {
    targetDir: dir,
    project: {
      name: "scaffold-test",
      budget: "balanced",
      browserTesting: false,
      devcontainer: false,
      useAgentBrowser: false,
      stack: {
        frontend: "nextjs",
        backend: "python-fastapi",
        database: "postgres",
        testing: "playwright",
        srcDirs: ["src", "backend"],
        languages: ["typescript", "python"],
      },
    },
    team: ROLES.map((role) => ({ role, model: modelFor(role, "balanced"), variant: null, enabled: true })),
    playbook: {},
  }
}

test("scaffold creates armada/ledgers/_template/SECURITY_FINDINGS.md", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-sec-tpl-"))
  const manifest = makeManifest(dir)
  const { written } = scaffold(manifest, manifest.project.stack)
  const tplPath = join(dir, "armada", "ledgers", "_template", "SECURITY_FINDINGS.md")
  assert.ok(existsSync(tplPath), "template file must exist on disk")
  assert.ok(written.includes("armada/ledgers/_template/SECURITY_FINDINGS.md"), "template file must be listed in written")
  const content = readFileSync(tplPath, "utf8")
  assert.match(content, /SECURITY_FINDINGS\.md/, "template must reference itself")
  assert.match(content, /SEC-###/, "template must contain placeholder finding ID")
  rmSync(dir, { recursive: true, force: true })
})

test("scaffold does not clobber existing SECURITY_FINDINGS.md template", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-sec-noclob-"))
  const manifest = makeManifest(dir)
  const tplDir = join(dir, "armada", "ledgers", "_template")
  mkdirSync(tplDir, { recursive: true })
  writeFileSync(join(tplDir, "SECURITY_FINDINGS.md"), "# custom security template\n")
  scaffold(manifest, manifest.project.stack)
  const content = readFileSync(join(tplDir, "SECURITY_FINDINGS.md"), "utf8")
  assert.strictEqual(content, "# custom security template\n", "must not overwrite existing template")
  rmSync(dir, { recursive: true, force: true })
})

test("scaffold with no-clobber: first scaffold writes, second does not overwrite", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-sec-dual-"))
  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)
  const tplPath = join(dir, "armada", "ledgers", "_template", "SECURITY_FINDINGS.md")
  const firstContent = readFileSync(tplPath, "utf8")
  // Append something to the file to simulate user edit
  writeFileSync(tplPath, firstContent + "\n# custom addition\n")
  scaffold(manifest, manifest.project.stack)
  const secondContent = readFileSync(tplPath, "utf8")
  assert.strictEqual(secondContent, firstContent + "\n# custom addition\n", "second scaffold must not overwrite user content")
  rmSync(dir, { recursive: true, force: true })
})

test("fillTemplate resolves security_ledgers_dir placeholder", () => {
  const manifest = {
    project: {
      name: "my-security-app",
      stack: {},
    },
  }
  const result = fillTemplate("{security_ledgers_dir}SECURITY_FINDINGS.md", manifest, manifest.project.stack)
  assert.strictEqual(result, "armada/ledgers/my-security-app/SECURITY_FINDINGS.md")
})

test("renderSecurityFindingsTemplate returns valid template with format docs", () => {
  const content = renderSecurityFindingsTemplate()
  assert.match(content, /SECURITY_FINDINGS\.md/, "must reference file name")
  assert.match(content, /SEC-###/, "must contain finding ID placeholder")
  assert.match(content, /Status: OPEN/, "must contain OPEN status")
  assert.match(content, /OPEN.*security/, "OPEN must be settable by security")
  assert.match(content, /ACCEPTED.*orchestrator/, "ACCEPTED must be settable by orchestrator")
  assert.match(content, /REJECTED.*orchestrator/, "REJECTED must be settable by orchestrator")
  assert.match(content, /MITIGATED.*orchestrator/, "MITIGATED must be settable by orchestrator")
})
