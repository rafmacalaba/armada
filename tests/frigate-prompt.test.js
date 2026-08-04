import { test } from "node:test"
import assert from "node:assert"
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { tmpdir } from "node:os"

import { CATALOG } from "../src/model-catalog.js"
import { fillTemplate } from "../src/scaffold.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

// -- Prompt template references security ledger --

test("frigate prompt references security ledger path", () => {
  const promptPath = join(__dirname, "..", "agents", "security", "prompt.template.md")
  const prompt = readFileSync(promptPath, "utf8")
  assert.match(prompt, /SECURITY_FINDINGS\.md/, "prompt must reference SECURITY_FINDINGS.md")
})

test("frigate prompt references {security_ledgers_dir} placeholder", () => {
  const promptPath = join(__dirname, "..", "agents", "security", "prompt.template.md")
  const prompt = readFileSync(promptPath, "utf8")
  assert.match(prompt, /\{security_ledgers_dir\}/, "prompt must contain {security_ledgers_dir} placeholder")
})

test("frigate prompt mentions status lifecycle OPEN -> ACCEPTED -> REJECTED -> MITIGATED", () => {
  const promptPath = join(__dirname, "..", "agents", "security", "prompt.template.md")
  const prompt = readFileSync(promptPath, "utf8")
  assert.match(prompt, /OPEN/, "prompt must mention OPEN status")
  assert.match(prompt, /ACCEPTED/, "prompt must mention ACCEPTED status")
  assert.match(prompt, /REJECTED/, "prompt must mention REJECTED status")
  assert.match(prompt, /MITIGATED/, "prompt must mention MITIGATED status")
})

// -- {security_ledgers_dir} placeholder flows through fillTemplate --

test("fillTemplate resolves {security_ledgers_dir} with slugified project name", () => {
  const manifest = {
    project: {
      name: "My Security App",
      stack: {},
    },
  }
  const result = fillTemplate("{security_ledgers_dir}SECURITY_FINDINGS.md", manifest, manifest.project.stack)
  assert.strictEqual(result, "armada/ledgers/my-security-app/SECURITY_FINDINGS.md")
})

test("fillTemplate resolves {security_ledgers_dir} using manifest.project.feature when present", () => {
  const manifest = {
    project: {
      name: "Other Name",
      feature: "auth-service",
      stack: {},
    },
  }
  const result = fillTemplate("{security_ledgers_dir}SECURITY_FINDINGS.md", manifest, manifest.project.stack)
  assert.strictEqual(result, "armada/ledgers/auth-service/SECURITY_FINDINGS.md")
})

// -- Catalog reasoning string references security ledger --

test("security catalog reasoning mentions security ledger", () => {
  const reasoning = CATALOG.security.reasoning
  assert.match(reasoning, /SECURITY_FINDINGS|security.ledger|security ledger|armada\/ledgers\/.*SECURITY/i,
    "security reasoning must reference security findings ledger, got: " + reasoning)
})
