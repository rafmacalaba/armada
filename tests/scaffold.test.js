import { test } from "node:test"
import assert from "node:assert"

import { fillPrompt, fillTemplate, scaffold, uninstall, PROMPT_SOURCE, GITIGNORE_START, GITIGNORE_END, slugify, validateTargetDir } from "../src/scaffold.js"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { agentNameFor } from "../src/role-display.js"
import { renderArmadaVoyageCommand, renderArmadaFleetPlugin, renderArmadaWatchdogPlugin, renderArmadaShipnamesPlugin, renderAgentsMd, buildTeam } from "../src/generator.js"
import { detectStack } from "../src/stack-detect.js"
import { existsSync, readFileSync, readdirSync, rmSync, mkdtempSync, writeFileSync, mkdirSync, symlinkSync, realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { makeTempRepo, parseFrontmatter } from "./helpers.js"

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
  const { written: files } = scaffold(manifest, manifest.project.stack)

  const expected = [
    "armada/armada.yaml",
    "armada/REQUIREMENTS.md",

    ...ROLES.map((r) => `.opencode/agent/${agentNameFor(r)}.md`),
  ]
  for (const f of expected) {
    assert.ok(files.includes(f), `missing in list: ${f}`)
    assert.ok(existsSync(join(dir, f)), `missing on disk: ${f}`)
  }

  // .opencode/commands/ — exactly 4 slash commands
  assert.ok(existsSync(join(dir, ".opencode/commands")), ".opencode/commands/ must exist")
  for (const cmd of ["armada", "armada-scout", "armada-voyage", "armada-resume"]) {
    assert.ok(existsSync(join(dir, `.opencode/commands/${cmd}.md`)), `${cmd}.md must exist`)
  }
  // Phase 3: removed commands must NOT exist
  assert.ok(!existsSync(join(dir, ".opencode/commands/armada-status.md")), "armada-status.md must not exist")
  assert.ok(!existsSync(join(dir, ".opencode/commands/armada-fleet.md")), "armada-fleet.md must not exist")

  // devcontainer copied when enabled
  assert.ok(existsSync(join(dir, ".devcontainer/devcontainer.json")))
  assert.ok(existsSync(join(dir, ".devcontainer/setup.sh")))

  // agent file is native markdown with YAML frontmatter
  const orch = readFileSync(join(dir, ".opencode/agent/commodore.md"), "utf8")
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

test("AGENTS.md merge: appends to existing, replaces stale armada section", () => {
  // append to existing user file
  const dir1 = makeTempRepo({ "AGENTS.md": "# My rules\n" })
  const m1 = makeManifest(dir1)
  scaffold(m1, {})
  let content = readFileSync(join(dir1, "AGENTS.md"), "utf8")
  assert.match(content, /# My rules/)
  assert.match(content, /<!-- armada:start -->/)

  // replace existing armada section
  const dir2 = makeTempRepo({ "AGENTS.md": "# My rules\n\n<!-- armada:start -->\nSTALE_SECTION\n<!-- armada:end -->\n" })
  const m2 = makeManifest(dir2)
  scaffold(m2, {})
  content = readFileSync(join(dir2, "AGENTS.md"), "utf8")
  assert.match(content, /# My rules/)
  assert.doesNotMatch(content, /STALE_SECTION/)
  assert.match(content, /<!-- armada:start -->/)
})

test("scaffold dryRun writes nothing but lists files", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-dry-"))
  const manifest = makeManifest(dir)
  const { written: files } = scaffold(manifest, manifest.project.stack, { dryRun: true })
  assert.ok(files.includes("armada/armada.yaml"))
  assert.ok(files.includes(".opencode/agent/commodore.md"))
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

  assert.ok(!existsSync(join(dir, ".opencode/agent/galleon.md")), "armada agent file removed")
  assert.ok(!existsSync(join(dir, ".opencode/oh-my-opencode-slim")), "stale omo dir pruned")
  assert.ok(existsSync(custom), "user file kept")
  assert.ok(existsSync(join(dir, ".opencode")), ".opencode dir kept")
  assert.ok(!removed.includes(".opencode"))
  assert.ok(warns.some((w) => /non-armada/.test(w)), "warning emitted")

  rmSync(dir, { recursive: true, force: true })
})

test("scaffold creates .opencode/commands with exactly 4 command files", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-uni4-"))
  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)
  assert.ok(existsSync(join(dir, ".opencode/commands")), "commands dir must exist")
  const expected = ["armada.md", "armada-scout.md", "armada-voyage.md", "armada-resume.md"]
  for (const f of expected) {
    assert.ok(existsSync(join(dir, `.opencode/commands/${f}`)), `${f} must exist`)
  }
  assert.ok(!existsSync(join(dir, ".opencode/commands/armada-status.md")), "armada-status.md must not exist")
  assert.ok(!existsSync(join(dir, ".opencode/commands/armada-fleet.md")), "armada-fleet.md must not exist")
  rmSync(dir, { recursive: true, force: true })
})

test("supervision plugin written only when enabled, removed on uninstall", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-sup-"))
  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)
  assert.ok(!existsSync(join(dir, ".opencode/plugins/armada-supervision.js")), "no plugin by default")

  manifest.project.supervision = { plugin: true }
  scaffold(manifest, manifest.project.stack)
  const plugin = join(dir, ".opencode/plugins/armada-supervision.js")
  assert.ok(existsSync(plugin), "plugin written when enabled")
  const src = readFileSync(plugin, "utf8")
  assert.match(src, /export const ArmadaSupervision/)
  assert.match(src, /tool\.execute\.before/)

  const removed = uninstall(manifest)
  assert.ok(!existsSync(plugin), "plugin removed on uninstall")
  assert.ok(removed.includes(".opencode/plugins/armada-supervision.js"))
})

test("scaffold writes armada-voyage.md matching generator output", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-voyage-"))
  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)

  const path = join(dir, ".opencode/commands/armada-voyage.md")
  assert.ok(existsSync(path), "armada-voyage.md exists")

  const content = readFileSync(path, "utf8")
  assert.strictEqual(content, renderArmadaVoyageCommand(), "content matches generator output")
  assert.match(content, /armada feature new/)
  assert.match(content, /armada voyage sandbox\//)

  const removed = uninstall(manifest)
  assert.ok(!existsSync(path), "armada-voyage.md removed on uninstall")
  assert.ok(removed.includes(".opencode/commands/armada-voyage.md"))

  rmSync(dir, { recursive: true, force: true })
})

test("scaffold prunes stale omo-slim artifacts on re-scaffold", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-prune-"))
  mkdirSync(join(dir, ".opencode"), { recursive: true })
  writeFileSync(join(dir, ".opencode/oh-my-opencode-slim.jsonc"), "{}")
  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)
  assert.ok(!existsSync(join(dir, ".opencode/oh-my-opencode-slim.jsonc")))
  assert.ok(existsSync(join(dir, ".opencode/agent/commodore.md")))
  rmSync(dir, { recursive: true, force: true })
})

test("generated artifacts contain zero omo-slim references", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-native-"))
  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)
  const files = [
    "opencode.json", "AGENTS.md", "armada/armada.yaml", "armada/REQUIREMENTS.md",
    ...ROLES.map((r) => `.opencode/agent/${agentNameFor(r)}.md`),
  ]
  for (const f of files) {
    const content = readFileSync(join(dir, f), "utf8")
    assert.doesNotMatch(content, /oh-my-opencode-slim|omo-slim/i, `${f} must not reference omo-slim`)
  }
  rmSync(dir, { recursive: true, force: true })
})

test("scaffold writes custom requirements file, no-clobber", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-req-"))
  const manifest = makeManifest(dir)
  manifest.project.requirementsFile = "REQUIREMENTS-admin.md"
  const { written: files } = scaffold(manifest, manifest.project.stack)
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

test("orchestrator prompt validates core rules, state, parallelism, and adaptive staffing", () => {
  const manifest = makeManifest(".")
  const filled = fillPrompt(join(__dirname, "..", PROMPT_SOURCE["orchestrator"]), manifest, manifest.project.stack)
  // no blind-stop / turn ending
  assert.match(filled, /never end your turn|never end the turn/i)
  assert.match(filled, /still running|outstanding/i)
  assert.match(filled, /wait|hold/i)
  // routes writes through subagents
  assert.match(filled, /dispatch/i)
  assert.match(filled, /write|edit/i)
  assert.match(filled, /never write or edit code/)
  // reads active state on session start
  assert.match(filled, /armada\/state\/active\.json/)
  assert.match(filled, /session start|session begins|on start/i)
  assert.match(filled, /write state on every transition/i)
  // prefers disjoint files
  assert.match(filled, /disjoint|separate file|own file|per phase/i)
  assert.match(filled, /parallel|concurrently|collision|clobber/i)
  // adaptive staffing with QA always active
  assert.match(filled, /QA.*always|always.*QA/i)
  assert.match(filled, /standby/i)
  assert.match(filled, /low.*smoke|smoke.*low/i)
  assert.match(filled, /risk override.*optional/i)
  assert.match(filled, /Do not rely on the user for routine/i)
  // batches findings, preserves parallel voyages
  assert.match(filled, /group.*finding|finding.*group/i)
  assert.match(filled, /BLOCKING.*FIX_NOW.*DEFERRED/i)
  assert.match(filled, /parallel voyages|voyages.*parallel/i)
  assert.match(filled, /structured receipt|compact receipt/i)
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

// -- Phase 2: instructions appended to rendered agent file --

test("scaffold appends instructions to the rendered prompt body", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-instr-"))
  const manifest = makeManifest(dir)
  manifest.team = [
    { role: "backend-dev", model: modelFor("backend-dev", "balanced"), variant: null, fallback: null, enabled: true,
      instructions: "Extra instruction line 1\nExtra instruction line 2" },
  ]
  scaffold(manifest, manifest.project.stack)
  const agentFile = readFileSync(join(dir, ".opencode/agent/galleon.md"), "utf8")
  // The instructions text must appear after frontmatter and prompt body, separated by a blank line
  assert.match(agentFile, /\n\nExtra instruction line 1\nExtra instruction line 2$/)
  rmSync(dir, { recursive: true, force: true })
})

// -- Phase 2: custom prompt template path --

test("scaffold resolves custom prompt template when prompt is set", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-customprompt-"))
  const manifest = makeManifest(dir)
  // Write a custom template file
  mkdirSync(join(dir, "templates"), { recursive: true })
  writeFileSync(join(dir, "templates/custom-be.md"), "Custom prompt for {backend_stack} with {database}.")
  manifest.team = [
    { role: "backend-dev", model: modelFor("backend-dev", "balanced"), variant: null, fallback: null, enabled: true,
      prompt: "templates/custom-be.md" },
  ]
  scaffold(manifest, manifest.project.stack)
  const agentFile = readFileSync(join(dir, ".opencode/agent/galleon.md"), "utf8")
  assert.match(agentFile, /Custom prompt for python-fastapi with postgres\./)
  rmSync(dir, { recursive: true, force: true })
})

test("scaffold throws when custom prompt template is a directory", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-dirprompt-"))
  const manifest = makeManifest(dir)
  mkdirSync(join(dir, "templates"), { recursive: true })
  manifest.team = [
    { role: "backend-dev", model: modelFor("backend-dev", "balanced"), variant: null, fallback: null, enabled: true,
      prompt: "templates" },
  ]
  assert.throws(
    () => scaffold(manifest, manifest.project.stack),
    /custom prompt template is a directory, not a file: templates \(for role backend-dev\)/
  )
  rmSync(dir, { recursive: true, force: true })
})

test("scaffold throws when custom prompt template is missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-missprompt-"))
  const manifest = makeManifest(dir)
  manifest.team = [
    { role: "backend-dev", model: modelFor("backend-dev", "balanced"), variant: null, fallback: null, enabled: true,
      prompt: "templates/nonexistent.md" },
  ]
  assert.throws(
    () => scaffold(manifest, manifest.project.stack),
    /custom prompt template not found: templates\/nonexistent\.md \(for role backend-dev\)/
  )
  rmSync(dir, { recursive: true, force: true })
})

// -- Phase 4: fleet tracker plugin scaffold --
test("fleet plugin written by default and when supervision.fleet is true", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-flt-"))
  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)
  assert.ok(existsSync(join(dir, ".opencode/plugins/armada-fleet.js")), "fleet plugin written by default")
  rmSync(dir, { recursive: true, force: true })

  const dir2 = mkdtempSync(join(tmpdir(), "armada-flt2-"))
  const manifest2 = makeManifest(dir2)
  manifest2.project.supervision = { fleet: true }
  scaffold(manifest2, manifest2.project.stack)
  const plugin = join(dir2, ".opencode/plugins/armada-fleet.js")
  assert.ok(existsSync(plugin), "fleet plugin written when enabled")
  const src = readFileSync(plugin, "utf8")
  assert.match(src, /export const ArmadaFleet/)
  assert.match(src, /session\.created/)
  assert.match(src, /session\.idle/)
  assert.match(src, /session\.closed/)
  assert.strictEqual(src, renderArmadaFleetPlugin(), "content matches generator output")
  rmSync(dir2, { recursive: true, force: true })
})

test("fleet plugin removed on uninstall", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-flt3-"))
  const manifest = makeManifest(dir)
  manifest.project.supervision = { fleet: true }
  scaffold(manifest, manifest.project.stack)
  const plugin = join(dir, ".opencode/plugins/armada-fleet.js")
  assert.ok(existsSync(plugin), "fleet plugin present before uninstall")
  const removed = uninstall(manifest)
  assert.ok(!existsSync(plugin), "fleet plugin removed on uninstall")
  assert.ok(removed.includes(".opencode/plugins/armada-fleet.js"))
  rmSync(dir, { recursive: true, force: true })
})
// -- Phase 1: watchdog plugin scaffold --
test("watchdog plugin not written by default", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-wd-"))
  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)
  assert.ok(!existsSync(join(dir, ".opencode/plugins/armada-watchdog.js")), "no watchdog plugin by default")
  rmSync(dir, { recursive: true, force: true })
})

test("watchdog plugin written when supervision.watchdog is true", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-wd2-"))
  const manifest = makeManifest(dir)
  manifest.project.supervision = { watchdog: true }
  scaffold(manifest, manifest.project.stack)
  const plugin = join(dir, ".opencode/plugins/armada-watchdog.js")
  assert.ok(existsSync(plugin), "watchdog plugin written when enabled")
  const src = readFileSync(plugin, "utf8")
  assert.match(src, /export const ArmadaWatchdog/)
  assert.match(src, /TIMEOUT_MS/)
  assert.strictEqual(src, renderArmadaWatchdogPlugin(), "content matches generator output")
  rmSync(dir, { recursive: true, force: true })
})

test("watchdog plugin removed on uninstall", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-wd3-"))
  const manifest = makeManifest(dir)
  manifest.project.supervision = { watchdog: true }
  scaffold(manifest, manifest.project.stack)
  const plugin = join(dir, ".opencode/plugins/armada-watchdog.js")
  assert.ok(existsSync(plugin), "watchdog plugin present before uninstall")
  const removed = uninstall(manifest)
  assert.ok(!existsSync(plugin), "watchdog plugin removed on uninstall")
  assert.ok(removed.includes(".opencode/plugins/armada-watchdog.js"))
  rmSync(dir, { recursive: true, force: true })
})
// -- Phase 2: shipnames plugin scaffold --
test("shipnames plugin written by default", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-sn-"))
  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)
  assert.ok(existsSync(join(dir, ".opencode/plugins/armada-shipnames.js")), "shipnames plugin written by default")
  rmSync(dir, { recursive: true, force: true })
})

test("shipnames plugin written when supervision.shipnames is true", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-sn2-"))
  const manifest = makeManifest(dir)
  manifest.project.supervision = { shipnames: true, fleet: false }
  scaffold(manifest, manifest.project.stack)
  const plugin = join(dir, ".opencode/plugins/armada-shipnames.js")
  assert.ok(existsSync(plugin), "shipnames plugin written when enabled")
  const src = readFileSync(plugin, "utf8")
  assert.match(src, /export const ArmadaShipnames/)
  assert.match(src, /tool\.execute\.before/)
  assert.strictEqual(src, renderArmadaShipnamesPlugin(), "content matches generator output")
  rmSync(dir, { recursive: true, force: true })
})

test("shipnames plugin skipped when supervision.shipnames is false", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-sn3-"))
  const manifest = makeManifest(dir)
  manifest.project.supervision = { shipnames: false }
  scaffold(manifest, manifest.project.stack)
  assert.ok(!existsSync(join(dir, ".opencode/plugins/armada-shipnames.js")), "shipnames plugin not written when disabled")
  rmSync(dir, { recursive: true, force: true })
})

test("shipnames plugin removed on uninstall", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-sn4-"))
  const manifest = makeManifest(dir)
  manifest.project.supervision = { shipnames: true }
  scaffold(manifest, manifest.project.stack)
  const plugin = join(dir, ".opencode/plugins/armada-shipnames.js")
  assert.ok(existsSync(plugin), "shipnames plugin present before uninstall")
  const removed = uninstall(manifest)
  assert.ok(!existsSync(plugin), "shipnames plugin removed on uninstall")
  assert.ok(removed.includes(".opencode/plugins/armada-shipnames.js"))
  rmSync(dir, { recursive: true, force: true })
})
// -- Phase 1: managed .gitignore block --

function gitignoreBlock() {
  return [GITIGNORE_START, "/armada/", "/.opencode/", "/opencode.json", GITIGNORE_END].join("\n")
}

test("scaffold writes gitignore block, idempotent, preserves existing lines", () => {
  // fresh repo
  const dir1 = mkdtempSync(join(tmpdir(), "armada-gi1-"))
  const m1 = makeManifest(dir1)
  scaffold(m1, m1.project.stack)
  let content = readFileSync(join(dir1, ".gitignore"), "utf8")
  assert.match(content, /# armada:start/)
  assert.match(content, /\/armada\//)
  assert.match(content, /\/\.opencode\//)
  assert.match(content, /\/opencode\.json/)
  assert.match(content, /# armada:end/)
  // idempotent
  scaffold(m1, m1.project.stack)
  content = readFileSync(join(dir1, ".gitignore"), "utf8")
  assert.strictEqual((content.match(/# armada:start/g) || []).length, 1, "block must appear exactly once")
  rmSync(dir1, { recursive: true, force: true })
  // preserves existing lines
  const dir2 = mkdtempSync(join(tmpdir(), "armada-gi3-"))
  writeFileSync(join(dir2, ".gitignore"), "node_modules/\n.env\n")
  const m2 = makeManifest(dir2)
  scaffold(m2, m2.project.stack)
  content = readFileSync(join(dir2, ".gitignore"), "utf8")
  assert.match(content, /^node_modules\//)
  assert.match(content, /\.env/)
  assert.match(content, /# armada:start/)
  rmSync(dir2, { recursive: true, force: true })
})

test("scaffold gitignore dryRun and skip opts", () => {
  // dryRun reports but does not write
  const dir1 = mkdtempSync(join(tmpdir(), "armada-gi4-"))
  const m1 = makeManifest(dir1)
  let files = scaffold(m1, m1.project.stack, { dryRun: true }).written
  assert.ok(files.includes(".gitignore"), ".gitignore must be in dryRun files list")
  assert.ok(!existsSync(join(dir1, ".gitignore")), ".gitignore must not be written in dryRun")
  rmSync(dir1, { recursive: true, force: true })
  // skips when opts.gitignore is false
  const dir2 = mkdtempSync(join(tmpdir(), "armada-gi5-"))
  const m2 = makeManifest(dir2)
  files = scaffold(m2, m2.project.stack, { gitignore: false }).written
  assert.ok(!files.includes(".gitignore"), ".gitignore must not be in files list when skipped")
  assert.ok(!existsSync(join(dir2, ".gitignore")), ".gitignore must not be written when skipped")
  rmSync(dir2, { recursive: true, force: true })
})

test("uninstall removes gitignore block, restores or deletes", () => {
  // restore user content
  const dir1 = mkdtempSync(join(tmpdir(), "armada-gi6-"))
  writeFileSync(join(dir1, ".gitignore"), "node_modules/\n.env\n")
  const m1 = makeManifest(dir1)
  scaffold(m1, m1.project.stack)
  let content = readFileSync(join(dir1, ".gitignore"), "utf8")
  assert.match(content, /# armada:start/)
  assert.match(content, /node_modules/)
  const removed = uninstall(m1)
  assert.ok(removed.includes(".gitignore"), "uninstall must report .gitignore")
  content = readFileSync(join(dir1, ".gitignore"), "utf8")
  assert.doesNotMatch(content, /# armada:start/)
  assert.match(content, /node_modules/)
  assert.match(content, /\.env/)
  rmSync(dir1, { recursive: true, force: true })
  // delete entirely if only content
  const dir2 = mkdtempSync(join(tmpdir(), "armada-gi7-"))
  const m2 = makeManifest(dir2)
  scaffold(m2, m2.project.stack)
  assert.ok(existsSync(join(dir2, ".gitignore")), ".gitignore must exist after scaffold")
  uninstall(m2)
  assert.ok(!existsSync(join(dir2, ".gitignore")), ".gitignore must be removed when block was only content")
  rmSync(dir2, { recursive: true, force: true })
})

test("uninstall gitignore dryRun and no-op when block absent", () => {
  // dryRun does not touch
  const dir1 = mkdtempSync(join(tmpdir(), "armada-gi8-"))
  const m1 = makeManifest(dir1)
  scaffold(m1, m1.project.stack)
  const before = readFileSync(join(dir1, ".gitignore"), "utf8")
  const removed = uninstall(m1, { dryRun: true })
  assert.ok(removed.includes(".gitignore"), "dryRun uninstall must report .gitignore")
  assert.strictEqual(readFileSync(join(dir1, ".gitignore"), "utf8"), before, ".gitignore must be unchanged in dryRun")
  rmSync(dir1, { recursive: true, force: true })
  // no-op when block absent
  const dir2 = mkdtempSync(join(tmpdir(), "armada-gi9-"))
  writeFileSync(join(dir2, ".gitignore"), "node_modules/\n")
  const m2 = makeManifest(dir2)
  scaffold(m2, m2.project.stack)
  writeFileSync(join(dir2, ".gitignore"), "node_modules/\n")
  const removed2 = uninstall(m2)
  assert.ok(!removed2.includes(".gitignore"), "uninstall must not report .gitignore when block absent")
  assert.strictEqual(readFileSync(join(dir2, ".gitignore"), "utf8"), "node_modules/\n")
  rmSync(dir2, { recursive: true, force: true })
})

// -- Phase 2: per-feature ledger paths + {ledgers_dir} placeholder --

test("fillTemplate resolves {ledgers_dir} with slugified project name", () => {
  const manifest = makeManifest(".")
  manifest.project.name = "My Test Project"
  const result = fillTemplate("{ledgers_dir}DEFECTS.md", manifest, manifest.project.stack)
  assert.strictEqual(result, "armada/ledgers/my-test-project/DEFECTS.md")
})

test("fillTemplate resolves {ledgers_dir} using manifest.project.feature when present", () => {
  const manifest = makeManifest(".")
  manifest.project.feature = "admin-dashboard"
  manifest.project.name = "Some Other Name"
  const result = fillTemplate("{ledgers_dir}ADVERSARIAL_REVIEW.md", manifest, manifest.project.stack)
  assert.strictEqual(result, "armada/ledgers/admin-dashboard/ADVERSARIAL_REVIEW.md")
})

test("fillTemplate resolves {ledgers_dir} to default when name empty", () => {
  const manifest = makeManifest(".")
  manifest.project.name = ""
  const result = fillTemplate("{ledgers_dir}DEFECTS.md", manifest, manifest.project.stack)
  assert.strictEqual(result, "armada/ledgers/default/DEFECTS.md")
})

test("fillTemplate resolves {feature} token", () => {
  const manifest = makeManifest(".")
  manifest.project.feature = "my-feature"
  const result = fillTemplate("Feature is {feature}", manifest, manifest.project.stack)
  assert.strictEqual(result, "Feature is my-feature")
})

test("fillTemplate resolves {e2e_dir} and {screenshots_dir}", () => {
  const manifest = makeManifest(".")
  manifest.project.name = "TestApp"
  const result = fillTemplate("{e2e_dir}tests and {screenshots_dir}screenshots", manifest, manifest.project.stack)
  assert.strictEqual(result, "armada/e2e/testapp/tests and armada/screenshots/testapp/screenshots")
})

test("fillPrompt substitutes {ledgers_dir} in agent template", () => {
  const manifest = makeManifest(".")
  manifest.project.name = "demo-app"
  const stack = manifest.project.stack
  // Write a temp template with the placeholder
  const dir = mkdtempSync(join(tmpdir(), "armada-tmpl-"))
  const templatePath = join(dir, "test-agent.md")
  writeFileSync(templatePath, "Never edit {ledgers_dir}DEFECTS.md")
  try {
    const filled = fillPrompt(templatePath, manifest, stack)
    assert.strictEqual(filled, "Never edit armada/ledgers/demo-app/DEFECTS.md")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("fillPrompt has no dangling {ledgers_dir} in filled output", () => {
  const manifest = makeManifest(".")
  manifest.project.name = "demo-app"
  const stack = manifest.project.stack
  const dir = mkdtempSync(join(tmpdir(), "armada-tmpl-"))
  const templatePath = join(dir, "test-agent.md")
  writeFileSync(templatePath, "Path: {ledgers_dir}DEFECTS.md, nothing else")
  try {
    const filled = fillPrompt(templatePath, manifest, stack)
    assert.ok(!/\{[a-z_]+\}/.test(filled), "no dangling placeholders")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// -- Phase 3: permission tests --

function frontmatterPerms(agentContent) {
  const fm = agentContent.slice(agentContent.indexOf("---") + 3, agentContent.indexOf("---\n", 3))
  const cfg = parseFrontmatter(fm)
  return cfg.permission?.edit ?? {}
}

test("rendered qa agent permissions: owns ledgers, e2e, screenshots; denies rest", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-perm-qa-"))
  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)
  const content = readFileSync(join(dir, ".opencode/agent/corvette.md"), "utf8")
  const edit = frontmatterPerms(content)

  assert.strictEqual(edit["*"], "deny", "qa must deny *")
  assert.strictEqual(edit["armada/ledgers/*"], "allow", "qa must allow armada/ledgers/*")
  assert.strictEqual(edit["armada/e2e/*"], "allow", "qa must allow armada/e2e/*")
  assert.strictEqual(edit["armada/screenshots/*"], "allow", "qa must allow armada/screenshots/*")
  // Defense: root ledgers not explicitly allowed -> denied by *
  assert.ok(!("DEFECTS.md" in edit) || edit["DEFECTS.md"] === "deny", "qa must deny root DEFECTS.md")
  assert.ok(!("ADVERSARIAL_REVIEW.md" in edit) || edit["ADVERSARIAL_REVIEW.md"] === "deny", "qa must deny root ADVERSARIAL_REVIEW.md")
  rmSync(dir, { recursive: true, force: true })
})

test("rendered backend-dev agent permissions: denies ledger, e2e, screenshots, state, root ledgers", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-perm-be-"))
  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)
  const content = readFileSync(join(dir, ".opencode/agent/galleon.md"), "utf8")
  const edit = frontmatterPerms(content)

  assert.strictEqual(edit["armada/ledgers/*"], "deny", "backend-dev must deny armada/ledgers/*")
  assert.strictEqual(edit["armada/e2e/*"], "deny", "backend-dev must deny armada/e2e/*")
  assert.strictEqual(edit["armada/screenshots/*"], "deny", "backend-dev must deny armada/screenshots/*")
  assert.strictEqual(edit["armada/state/*"], "deny", "backend-dev must deny armada/state/*")
  assert.strictEqual(edit["DEFECTS.md"], "deny", "backend-dev must deny root DEFECTS.md")
  assert.strictEqual(edit["ADVERSARIAL_REVIEW.md"], "deny", "backend-dev must deny root ADVERSARIAL_REVIEW.md")
  assert.strictEqual(edit["opencode.json"], "deny", "backend-dev must deny opencode.json")
  assert.strictEqual(edit["armada/*"], "deny", "backend-dev must deny armada/*")
  rmSync(dir, { recursive: true, force: true })
})

test("rendered orchestrator agent permissions: allows specific ledger files, denies agends/req/armada", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-perm-orch-"))
  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)
  const content = readFileSync(join(dir, ".opencode/agent/commodore.md"), "utf8")
  const edit = frontmatterPerms(content)

  assert.strictEqual(edit["armada/ledgers/*/DEFECTS.md"], "allow", "orchestrator must allow DEFECTS.md in ledgers")
  assert.strictEqual(edit["armada/ledgers/*/ADVERSARIAL_REVIEW.md"], "allow", "orchestrator must allow ADVERSARIAL_REVIEW.md in ledgers")
  assert.strictEqual(edit["armada/*"], "deny", "orchestrator must deny armada/*")
  assert.strictEqual(edit["AGENTS.md"], "deny", "orchestrator must deny AGENTS.md")
  assert.strictEqual(edit["REQUIREMENTS.md"], "deny", "orchestrator must deny REQUIREMENTS.md")
  assert.strictEqual(edit[".opencode/*"], "deny", "orchestrator must deny .opencode/*")
  rmSync(dir, { recursive: true, force: true })
})

test("multi-feature: two features produce separate ledger namespaces, no DEF collision", () => {
  const dirA = mkdtempSync(join(tmpdir(), "armada-mf-a-"))
  const dirB = mkdtempSync(join(tmpdir(), "armada-mf-b-"))

  const makeMf = (feature) => {
    const m = makeManifest(feature === "feature-a" ? dirA : dirB)
    m.project.feature = feature
    m.project.name = "multi-feature"
    return m
  }

  try {
    scaffold(makeMf("feature-a"), {})
    const agentsA = readFileSync(join(dirA, "AGENTS.md"), "utf8")
    assert.match(agentsA, /armada\/ledgers\/feature-a\/DEFECTS\.md/, "feature-a AGENTS.md references feature-a DEFECTS")
    assert.match(agentsA, /armada\/ledgers\/feature-a\/ADVERSARIAL_REVIEW\.md/, "feature-a AGENTS.md references feature-a ADVERSARIAL")
    assert.match(agentsA, /armada\/e2e\/feature-a\//, "feature-a AGENTS.md references feature-a e2e")
    assert.match(agentsA, /armada\/screenshots\/feature-a\//, "feature-a AGENTS.md references feature-a screenshots")

    scaffold(makeMf("feature-b"), {})
    const agentsB = readFileSync(join(dirB, "AGENTS.md"), "utf8")
    assert.match(agentsB, /armada\/ledgers\/feature-b\/DEFECTS\.md/, "feature-b AGENTS.md references feature-b DEFECTS")
    assert.match(agentsB, /armada\/ledgers\/feature-b\/ADVERSARIAL_REVIEW\.md/, "feature-b AGENTS.md references feature-b ADVERSARIAL")

    // Both ledgers start at DEF-001 (per-file numbering, no collision across features)
    assert.match(agentsA, /DEF-001/, "feature-a ledger references DEF-001")
    assert.match(agentsB, /DEF-001/, "feature-b ledger references DEF-001")
  } finally {
    rmSync(dirA, { recursive: true, force: true })
    rmSync(dirB, { recursive: true, force: true })
  }
})

// --- slugify ---

test("slugify: basic ASCII", () => {
  assert.strictEqual(slugify("Hello World"), "hello-world")
  assert.strictEqual(slugify("My-Project"), "my-project")
  assert.strictEqual(slugify("   trim   "), "trim")
  assert.strictEqual(slugify(""), "default")
  assert.strictEqual(slugify(null), "default")
  assert.strictEqual(slugify(undefined), "default")
})

test("slugify: non-ASCII transliteration and uniqueness (DEF-032)", () => {
  const cafe = slugify("Café")
  const cafePlain = slugify("cafe")
  assert.notStrictEqual(cafe, cafePlain, "slugify('Café') must differ from slugify('cafe')")

  const jp = slugify("日本語")
  assert.ok(jp.length > 0, "slugify('日本語') must produce non-empty result")
  assert.notStrictEqual(jp, "default", "slugify('日本語') must not fall back to default")

  // All three must be pairwise distinct
  const slugs = new Set([cafe, cafePlain, jp])
  assert.strictEqual(slugs.size, 3, "all three slugs must be pairwise distinct")
})

test("slugify: length cap (DEF-033)", () => {
  const long = slugify("a".repeat(500))
  assert.ok(long.length <= 100, `slug length ${long.length} must be <= 100`)
})

test("slugify: special chars handled", () => {
  // Chars beyond ASCII get warn+hash behavior
  const r1 = slugify("test-unicode-日本語")
  assert.ok(r1.length > 0, "slug must be non-empty")
  // Latin diacritics transliterated
  const r2 = slugify("Müllerstße")
  assert.match(r2, /mu/, "transliterated umlaut")
  assert.match(r2, /ss/, "transliterated eszett")
})

test("renderAgentsMd: parallel lanes produce identical armada blocks", () => {
  // Regression: two scaffolds with different feature names must produce
  // identical AGENTS.md armada blocks, so parallel lanes cannot conflict.
  const dirA = mkdtempSync(join(tmpdir(), "armada-scaffold-"))
  const dirB = mkdtempSync(join(tmpdir(), "armada-scaffold-"))
  try {
    const manifest = {
      targetDir: ".",
      project: {
        name: "armada",
        budget: "balanced",
        browserTesting: false,
        devcontainer: false,
        stack: {
          frontend: "nextjs",
          backend: "python-fastapi",
          database: "postgres",
          testing: "playwright",
          srcDirs: ["src"],
          languages: ["typescript", "python"],
        },
      },
      team: ROLES.map((role) => ({ role, model: modelFor(role, "balanced"), variant: null, enabled: true })),
      playbook: {},
    }

    const team = buildTeam(manifest)
    const contentA = renderAgentsMd(manifest, team, "lane-A")
    const contentB = renderAgentsMd(manifest, team, "lane-B")

    const extractBlock = (raw) => {
      const start = "<!-- armada:start -->"
      const end = "<!-- armada:end -->"
      const s = raw.indexOf(start)
      const e = raw.indexOf(end)
      assert.ok(s !== -1, "armada:start marker missing")
      assert.ok(e !== -1, "armada:end marker missing")
      return raw.substring(s, e + end.length)
    }

    const blockA = extractBlock(contentA)
    const blockB = extractBlock(contentB)

    assert.strictEqual(blockA, blockB, "armada blocks must be byte-identical")

    // Must contain literal {feature} token, not a concrete feature name
    assert.ok(blockA.includes("{feature}"), "block must contain {feature} token")
    assert.ok(!blockA.includes("lane-A"), "block must not contain lane-A")
    assert.ok(!blockA.includes("lane-B"), "block must not contain lane-B")
  } finally {
    rmSync(dirA, { recursive: true, force: true })
    rmSync(dirB, { recursive: true, force: true })
  }
})

// -- Phase 5: DEF-005 symlink safety (validateTargetDir + orphan lstat guard) --

test("validateTargetDir rejects .opencode subdirectory symlinks under target", () => {
  for (const sub of ["agent", "commands", "plugins"]) {
    const target = mkdtempSync(join(tmpdir(), `armada-vtd-${sub}-`))
    const realDir = mkdtempSync(join(tmpdir(), `armada-real-${sub}-`))
    mkdirSync(join(target, ".opencode"), { recursive: true })
    symlinkSync(realDir, join(target, ".opencode", sub), "dir")
    try {
      assert.throws(() => validateTargetDir(target), new RegExp(`\\.opencode\\/${sub} is a symlink`))
    } finally {
      rmSync(target, { recursive: true, force: true })
      rmSync(realDir, { recursive: true, force: true })
    }
  }
})

test("orphan cleanup: lstat guard skips symlinked legacy agent file, preserves external file", () => {
  // Create external dir with a victim file
  const externalDir = mkdtempSync(join(tmpdir(), "armada-ext-victim-"))
  const victimPath = join(externalDir, "orchestrator.md")
  writeFileSync(victimPath, "external content", "utf8")

  // Create target repo with .opencode/agent as a real directory
  const target = mkdtempSync(join(tmpdir(), "armada-lstat-"))
  mkdirSync(join(target, ".opencode", "agent"), { recursive: true })

  // Symlink the legacy orchestrator.md to external victim
  symlinkSync(victimPath, join(target, ".opencode", "agent", "orchestrator.md"))

  try {
    const manifest = makeManifest(target)
    const { removed } = scaffold(manifest, manifest.project.stack)

    // Legacy symlink must NOT be removed, but listed as skipped
    const skippedEntry = removed.find(e => e.includes("orchestrator.md") && e.includes("skipped: symlink"))
    assert.ok(skippedEntry, `removed should include 'skipped: symlink' entry for orchestrator.md, got: ${JSON.stringify(removed)}`)

    // External victim file must still exist with original content
    assert.strictEqual(existsSync(victimPath), true, "external victim file must still exist")
    const victimContent = readFileSync(victimPath, "utf8")
    assert.strictEqual(victimContent, "external content", "external victim file must have original content")

    // Symlink itself still exists (we skipped deletion)
    assert.strictEqual(existsSync(join(target, ".opencode", "agent", "orchestrator.md")), true, "symlink must not be deleted")
  } finally {
    rmSync(target, { recursive: true, force: true })
    rmSync(externalDir, { recursive: true, force: true })
  }
})

test("orphan cleanup: normal (non-symlink) legacy file still removed", () => {
  const target = mkdtempSync(join(tmpdir(), "armada-normal-legacy-"))
  mkdirSync(join(target, ".opencode", "agent"), { recursive: true })
  // Create a regular legacy file
  writeFileSync(join(target, ".opencode", "agent", "orchestrator.md"), "legacy content", "utf8")

  try {
    const manifest = makeManifest(target)
    const { removed } = scaffold(manifest, manifest.project.stack)

    // Must have a non-skip entry for the legacy file
    const normalEntry = removed.find(e => e === ".opencode/agent/orchestrator.md")
    assert.ok(normalEntry, `removed should include normal entry for orchestrator.md, got: ${JSON.stringify(removed)}`)

    // Legacy file must be gone
    assert.strictEqual(existsSync(join(target, ".opencode", "agent", "orchestrator.md")), false, "legacy file must be removed")
    // Ship-named file must exist
    assert.strictEqual(existsSync(join(target, ".opencode", "agent", "commodore.md")), true, "commodore.md must exist")
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})
