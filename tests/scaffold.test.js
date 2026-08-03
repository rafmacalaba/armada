import { test } from "node:test"
import assert from "node:assert"

import { fillPrompt, fillTemplate, scaffold, uninstall, PROMPT_SOURCE } from "../src/scaffold.js"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { detectStack } from "../src/stack-detect.js"
import { existsSync, readFileSync, readdirSync, rmSync, mkdtempSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { makeTempRepo } from "./helpers.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

function makeManifest(dir) {
  return {
    targetDir: dir,
    project: {
      name: "scaffold-test",
      budget: "balanced",
      browserTesting: true,
      devcontainer: true,
      useAgentBrowser: true,
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

test("fillPrompt substitutes stack placeholders", () => {
  const manifest = makeManifest(".")
  const stack = manifest.project.stack
  const templatePath = join(__dirname, "..", PROMPT_SOURCE["backend-dev"])
  const filled = fillPrompt(templatePath, manifest, stack)
  assert.match(filled, /python-fastapi/)
  assert.match(filled, /postgres/)
  assert.ok(!/\{[a-z_]+\}/.test(filled), "no dangling placeholders")
})

test("fillPrompt renders browser tool when useAgentBrowser is true", () => {
  const manifest = makeManifest(".")
  manifest.project.useAgentBrowser = true
  const stack = manifest.project.stack
  const templatePath = join(__dirname, "..", PROMPT_SOURCE["qa"])
  const filled = fillPrompt(templatePath, manifest, stack)
  assert.match(filled, /Browser tool/)
})

test("fillTemplate is pure and substitutes placeholders", () => {
  const manifest = makeManifest(".")
  const stack = manifest.project.stack
  const filled = fillTemplate("Project: {project_name}, backend: {backend_stack}", manifest, stack)
  assert.match(filled, /Project: scaffold-test/)
  assert.match(filled, /backend: python-fastapi/)
})

test("scaffold writes all expected files", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-scaffold-"))
  const manifest = makeManifest(dir)
  const files = scaffold(manifest, manifest.project.stack)

  const expected = [
    "armada/armada.yaml",
    "armada/REQUIREMENTS.md",
    ".opencode/commands/armada.md",
    ...ROLES.map((r) => `.opencode/agent/${r}.md`),
  ]
  for (const f of expected) {
    assert.ok(files.includes(f), `missing in list: ${f}`)
    assert.ok(existsSync(join(dir, f)), `missing on disk: ${f}`)
  }

  // devcontainer copied when enabled
  assert.ok(existsSync(join(dir, ".devcontainer/devcontainer.json")))
  assert.ok(existsSync(join(dir, ".devcontainer/setup.sh")))

  // agent file is native markdown with YAML frontmatter
  const orch = readFileSync(join(dir, ".opencode/agent/orchestrator.md"), "utf8")
  assert.match(orch, /^---\n/m)
  assert.match(orch, /mode: primary/)

  rmSync(dir, { recursive: true, force: true })
})

test("scaffold preserves existing opencode.json and merges AGENTS.md", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-scaffold-"))
  writeFileSync(join(dir, "opencode.json"), JSON.stringify({ custom: true }))
  writeFileSync(join(dir, "AGENTS.md"), "# custom rules")

  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)

  assert.strictEqual(JSON.parse(readFileSync(join(dir, "opencode.json"), "utf8")).custom, true)
  const agents = readFileSync(join(dir, "AGENTS.md"), "utf8")
  assert.match(agents, /^# custom rules/)
  assert.match(agents, /<!-- armada:start -->/)

  rmSync(dir, { recursive: true, force: true })
})

test("AGENTS.md merge: appends to existing user file", () => {
  const dir = makeTempRepo({ "AGENTS.md": "# My rules\n" })
  const m = makeManifest(dir)
  scaffold(m, {})
  const content = readFileSync(join(dir, "AGENTS.md"), "utf8")
  assert.match(content, /# My rules/)
  assert.match(content, /<!-- armada:start -->/)
})

test("AGENTS.md merge: replaces existing armada section", () => {
  const dir = makeTempRepo({ "AGENTS.md": "# My rules\n\n<!-- armada:start -->\nSTALE_SECTION\n<!-- armada:end -->\n" })
  const m = makeManifest(dir)
  scaffold(m, {})
  const content = readFileSync(join(dir, "AGENTS.md"), "utf8")
  assert.match(content, /# My rules/)
  assert.doesNotMatch(content, /STALE_SECTION/)
  assert.match(content, /<!-- armada:start -->/)
})

test("scaffold dryRun writes nothing but lists files", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-dry-"))
  const manifest = makeManifest(dir)
  const files = scaffold(manifest, manifest.project.stack, { dryRun: true })
  assert.ok(files.includes("armada/armada.yaml"))
  assert.ok(files.includes(".opencode/agent/orchestrator.md"))
  assert.ok(!existsSync(join(dir, "armada/armada.yaml")))
  assert.ok(!existsSync(join(dir, "armada")))
  assert.ok(!existsSync(join(dir, ".opencode")))
  rmSync(dir, { recursive: true, force: true })
})

test("uninstall removes armada files, keeps user files", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-uni-"))
  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)
  writeFileSync(join(dir, "AGENTS.md"), "# custom")
  const removed = uninstall(manifest)
  assert.ok(!existsSync(join(dir, "armada/armada.yaml")))
  assert.ok(!existsSync(join(dir, "armada/REQUIREMENTS.md")))
  assert.ok(!existsSync(join(dir, "armada")))
  assert.ok(!existsSync(join(dir, ".opencode")))
  assert.ok(existsSync(join(dir, "AGENTS.md")))
  assert.ok(!removed.includes("AGENTS.md"))
  rmSync(dir, { recursive: true, force: true })
})

test("uninstall --all also removes generated user-facing files", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-uni2-"))
  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)
  const removed = uninstall(manifest, { all: true })
  assert.ok(removed.includes("AGENTS.md"))
  assert.ok(removed.includes("opencode.json"))
  assert.ok(!existsSync(join(dir, "armada")))
  rmSync(dir, { recursive: true, force: true })
})

test("uninstall keeps user files under .opencode/ and warns", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-uni3-"))
  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)
  const custom = join(dir, ".opencode/agent/custom.md")
  mkdirSync(join(dir, ".opencode/agent"), { recursive: true })
  writeFileSync(custom, "# custom agent\n")

  const warns = []
  const origWarn = console.warn
  console.warn = (m) => warns.push(m)
  let removed
  try {
    removed = uninstall(manifest)
  } finally {
    console.warn = origWarn
  }

  assert.ok(!existsSync(join(dir, ".opencode/agent/backend-dev.md")), "armada role file removed")
  assert.ok(!existsSync(join(dir, ".opencode/oh-my-opencode-slim")), "stale omo dir pruned")
  assert.ok(existsSync(custom), "user file kept")
  assert.ok(existsSync(join(dir, ".opencode")), ".opencode dir kept")
  assert.ok(!removed.includes(".opencode"))
  assert.ok(warns.some((w) => /non-armada/.test(w)), "warning emitted")

  rmSync(dir, { recursive: true, force: true })
})

test("scaffold prunes stale omo-slim artifacts on re-scaffold", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-prune-"))
  mkdirSync(join(dir, ".opencode"), { recursive: true })
  writeFileSync(join(dir, ".opencode/oh-my-opencode-slim.jsonc"), "{}")
  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)
  assert.ok(!existsSync(join(dir, ".opencode/oh-my-opencode-slim.jsonc")))
  assert.ok(existsSync(join(dir, ".opencode/agent/orchestrator.md")))
  rmSync(dir, { recursive: true, force: true })
})

test("scaffold writes custom requirements file, no-clobber", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-req-"))
  const manifest = makeManifest(dir)
  manifest.project.requirementsFile = "REQUIREMENTS-admin.md"
  const files = scaffold(manifest, manifest.project.stack)
  assert.ok(files.includes("REQUIREMENTS-admin.md"))
  assert.ok(existsSync(join(dir, "REQUIREMENTS-admin.md")))
  writeFileSync(join(dir, "REQUIREMENTS-admin.md"), "# mine")
  scaffold(manifest, manifest.project.stack)
  assert.strictEqual(readFileSync(join(dir, "REQUIREMENTS-admin.md"), "utf8"), "# mine")
  rmSync(dir, { recursive: true, force: true })
})

test("orchestrator full prompt is self-contained and dependency-driven", () => {
  const manifest = makeManifest(".")
  manifest.project.requirementsFile = "REQUIREMENTS-admin.md"
  const filled = fillPrompt(join(__dirname, "..", PROMPT_SOURCE["orchestrator"]), manifest, manifest.project.stack)
  assert.match(filled, /REQUIREMENTS-admin\.md is the contract/)
  assert.match(filled, /co-write|Co-write/)
  assert.match(filled, /Start every ready phase/)
  assert.ok(!/append to your existing|you keep everything/i.test(filled), "must not reference a base prompt")
  assert.ok(!/\{[a-z_]+\}/.test(filled), "no dangling placeholders")
})

test("orchestrator full prompt renders existing instruction files", () => {
  const manifest = makeManifest(".")
  manifest.project.stack.instructions = ["AGENTS.md", "CLAUDE.md"]
  const filled = fillPrompt(join(__dirname, "..", PROMPT_SOURCE["orchestrator"]), manifest, manifest.project.stack)
  assert.match(filled, /AGENTS\.md/)
  assert.match(filled, /CLAUDE\.md/)
  assert.ok(!/\{instructions\}/.test(filled), "no dangling instructions placeholder")
})

test("scaffold rejects path traversal requirementsFile", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-traverse-"))
  const manifest = makeManifest(dir)
  manifest.project.requirementsFile = "../../pwn.md"
  assert.throws(() => scaffold(manifest, manifest.project.stack), /requirementsFile.*must not contain '\.\.'/)
  rmSync(dir, { recursive: true, force: true })
})

test("uninstall removes custom requirementsFile", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-req-"))
  const manifest = makeManifest(dir)
  manifest.project.requirementsFile = "REQUIREMENTS-admin.md"
  scaffold(manifest, manifest.project.stack)
  assert.ok(existsSync(join(dir, "REQUIREMENTS-admin.md")))
  const removed = uninstall(manifest)
  assert.ok(removed.includes("REQUIREMENTS-admin.md"))
  assert.ok(!existsSync(join(dir, "REQUIREMENTS-admin.md")))
  rmSync(dir, { recursive: true, force: true })
})

test("uninstall keeps user-owned .devcontainer when manifest devcontainer is false", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-devc-"))
  const manifest = makeManifest(dir)
  manifest.project.devcontainer = false
  scaffold(manifest, manifest.project.stack)
  mkdirSync(join(dir, ".devcontainer"))
  writeFileSync(join(dir, ".devcontainer/devcontainer.json"), "{}")
  const removed = uninstall(manifest)
  assert.ok(!removed.includes(".devcontainer"))
  assert.ok(existsSync(join(dir, ".devcontainer/devcontainer.json")))
  rmSync(dir, { recursive: true, force: true })
})
