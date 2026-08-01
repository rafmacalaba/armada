import { test } from "node:test"
import assert from "node:assert"

import { fillPrompt, scaffold, uninstall, PROMPT_SOURCE } from "../src/scaffold.js"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { detectStack } from "../src/stack-detect.js"
import { existsSync, readFileSync, readdirSync, rmSync, mkdtempSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

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

test("scaffold writes all expected files", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-scaffold-"))
  const manifest = makeManifest(dir)
  const files = scaffold(manifest, manifest.project.stack)

  const expected = [
    ".opencode/oh-my-opencode-slim.jsonc",
    "armada.yaml",
    ".opencode/commands/armada.md",
    ...ROLES.map((r) => `.opencode/oh-my-opencode-slim/${r}.md`),
  ]
  for (const f of expected) {
    assert.ok(files.includes(f), `missing in list: ${f}`)
    assert.ok(existsSync(join(dir, f)), `missing on disk: ${f}`)
  }

  // devcontainer copied when enabled
  assert.ok(existsSync(join(dir, ".devcontainer/devcontainer.json")))
  assert.ok(existsSync(join(dir, ".devcontainer/setup.sh")))

  // jsonc parses as JSON after stripping full-line comments (the orchestrator
  // strings contain literal newlines, so only strip `//` when it starts a line)
  const jsonc = readFileSync(join(dir, ".opencode/oh-my-opencode-slim.jsonc"), "utf8")
  const stripped = jsonc.replace(/^\s*\/\/.*$/gm, "").trim()
  assert.doesNotThrow(() => JSON.parse(stripped))

  rmSync(dir, { recursive: true, force: true })
})

test("scaffold does not clobber existing opencode.json / AGENTS.md", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-scaffold-"))
  writeFileSync(join(dir, "opencode.json"), JSON.stringify({ custom: true }))
  writeFileSync(join(dir, "AGENTS.md"), "# custom rules")

  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)

  assert.strictEqual(JSON.parse(readFileSync(join(dir, "opencode.json"), "utf8")).custom, true)
  assert.strictEqual(readFileSync(join(dir, "AGENTS.md"), "utf8"), "# custom rules")

  rmSync(dir, { recursive: true, force: true })
})

test("scaffold dryRun writes nothing but lists files", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-dry-"))
  const manifest = makeManifest(dir)
  const files = scaffold(manifest, manifest.project.stack, { dryRun: true })
  assert.ok(files.includes("armada.yaml"))
  assert.ok(files.includes(".opencode/oh-my-opencode-slim.jsonc"))
  assert.ok(!existsSync(join(dir, "armada.yaml")))
  assert.ok(!existsSync(join(dir, ".opencode")))
  rmSync(dir, { recursive: true, force: true })
})

test("uninstall removes armada files, keeps user files", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-uni-"))
  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)
  writeFileSync(join(dir, "AGENTS.md"), "# custom")
  const removed = uninstall(manifest)
  assert.ok(!existsSync(join(dir, "armada.yaml")))
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

  assert.ok(!existsSync(join(dir, ".opencode/oh-my-opencode-slim.jsonc")))
  assert.ok(!existsSync(join(dir, ".opencode/oh-my-opencode-slim")))
  assert.ok(!existsSync(join(dir, ".opencode/commands")))
  assert.ok(existsSync(custom), "user file kept")
  assert.ok(existsSync(join(dir, ".opencode")), ".opencode dir kept")
  assert.ok(!removed.includes(".opencode"))
  assert.ok(warns.some((w) => /non-armada/.test(w)), "warning emitted")

  rmSync(dir, { recursive: true, force: true })
})
