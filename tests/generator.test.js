import { test } from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { ROLES, CATALOG, modelFor, fallbackFor, BUDGETS } from "../src/model-catalog.js"
import { deepMerge, buildTeam, renderAgentFile, renderOpenCodeJson, renderAgentsMd, renderRequirementsMd, renderManifestYaml, renderArmadaCommand, renderArmadaScoutCommand, renderArmadaResumeCommand, renderArmadaVoyageCommand, renderArmadaSupervisionPlugin, renderArmadaFleetPlugin, renderArmadaWatchdogPlugin } from "../src/generator.js"
import { displayFor } from "../src/role-display.js"
import { parseManifestYaml } from "../src/manifest.js"
import { resolvePermission } from "./helpers.js"

const __dirname = fileURLToPath(new URL(".", import.meta.url))
const ORCH_PROMPT_PATH = join(__dirname, "..", "agents", "orchestrator", "prompt.template.md")

const baseManifest = {
  project: {
    name: "test-project",
    budget: "balanced",
    browserTesting: true,
    devcontainer: true,
    useAgentBrowser: true,
    stack: { frontend: "react", backend: "node-express", database: "postgres", testing: "playwright", srcDirs: ["src"], languages: ["typescript"] },
  },
  team: ROLES.map((role) => ({ role, model: modelFor(role, "balanced"), variant: null, enabled: true })),
  playbook: {},
}

test("catalog has expected model IDs per role", () => {
  assert.deepStrictEqual(ROLES, ["orchestrator", "backend-dev", "frontend-dev", "qa", "adversary", "security", "docs", "architect"])
  assert.deepStrictEqual(
    Object.fromEntries(ROLES.map((r) => [r, { primary: CATALOG[r].primary, fallback: CATALOG[r].fallback, free: CATALOG[r].free, power: CATALOG[r].power }])),
    {
      orchestrator: { primary: "opencode-go/minimax-m3", fallback: "openrouter/z-ai/glm-5.2", free: "opencode-go/hy3", power: "openrouter/anthropic/claude-sonnet-4.6" },
      "backend-dev": { primary: "opencode-go/deepseek-v4-pro", fallback: "openrouter/deepseek/deepseek-v4-pro", free: "opencode/deepseek-v4-flash-free", power: "openrouter/z-ai/glm-5.2" },
      "frontend-dev": { primary: "opencode-go/minimax-m3", fallback: "openrouter/minimax/minimax-m3", free: "opencode/mimo-v2.5-free", power: "openrouter/minimax/minimax-m3" },
      qa: { primary: "opencode/mimo-v2.5-free", fallback: "openrouter/xiaomi/mimo-v2.5", free: "opencode/mimo-v2.5-free", power: "openrouter/xiaomi/mimo-v2.5" },
      adversary: { primary: "opencode-go/deepseek-v4-pro", fallback: "openrouter/deepseek/deepseek-v4-pro", free: "opencode/deepseek-v4-flash-free", power: "openrouter/deepseek/deepseek-v4-pro" },
      security: { primary: "opencode/big-pickle", fallback: "openrouter/deepseek/deepseek-v4-pro", free: "opencode/big-pickle", power: "openrouter/deepseek/deepseek-v4-pro" },
      docs: { primary: "opencode/deepseek-v4-flash-free", fallback: "openrouter/minimax/minimax-m3", free: "opencode/deepseek-v4-flash-free", power: "openrouter/minimax/minimax-m3" },
      architect: { primary: "opencode/big-pickle", fallback: "openrouter/z-ai/glm-5.2", free: "opencode/big-pickle", power: "openrouter/z-ai/glm-5.2" },
    }
  )
})

test("modelFor respects budget", () => {
  assert.notStrictEqual(modelFor("orchestrator", "free"), modelFor("orchestrator", "power"))
  assert.strictEqual(modelFor("qa", "free"), "opencode/mimo-v2.5-free")
})

test("buildTeam includes all roles with permissions", () => {
  const team = buildTeam(baseManifest)
  assert.strictEqual(team.length, ROLES.length)
  const qa = team.find((a) => a.role === "qa")
  assert.strictEqual(qa.permissions.edit["*"], "deny")
  assert.strictEqual(qa.permissions.edit["armada/e2e/*"], "allow")
})

test("buildTeam honors manifest per-role model, variant, fallback", () => {
  const m = structuredClone(baseManifest)
  m.team = ROLES.map((role) => ({
    role,
    model: role === "backend-dev" ? "custom/model" : modelFor(role, "balanced"),
    variant: role === "backend-dev" ? "thinking" : null,
    fallback: role === "backend-dev" ? "custom/fallback" : fallbackFor(role),
    enabled: true,
  }))
  const team = buildTeam(m)
  const backend = team.find((a) => a.role === "backend-dev")
  assert.strictEqual(backend.model, "custom/model")
  assert.strictEqual(backend.variant, "thinking")
  assert.strictEqual(backend.fallback, "custom/fallback")
  const orchestrator = team.find((a) => a.role === "orchestrator")
  assert.strictEqual(orchestrator.model, modelFor("orchestrator", "balanced"))
})

test("buildTeam non-headless keeps orchestrator bash ask", () => {
  const team = buildTeam(baseManifest)
  const orch = team.find((a) => a.role === "orchestrator")
  assert.strictEqual(orch.permissions.bash["*"], "ask")
})

test("buildTeam disabled role is reflected in enabled flag", () => {
  const m = structuredClone(baseManifest)
  m.team = m.team.map((t) => ({ ...t, enabled: t.role !== "qa" }))
  const team = buildTeam(m)
  const qa = team.find((a) => a.role === "qa")
  assert.strictEqual(qa.enabled, false)
  const backend = team.find((a) => a.role === "backend-dev")
  assert.strictEqual(backend.enabled, true)
})

test("buildTeam browser false path leaves browser false", () => {
  const m = structuredClone(baseManifest)
  m.project.browserTesting = false
  m.project.useAgentBrowser = false
  const team = buildTeam(m)
  for (const a of team) assert.strictEqual(a.browser, false)
})

test("buildTeam headless scopes orchestrator bash to git and read", () => {
  const m = structuredClone(baseManifest)
  m.project.headless = true
  const team = buildTeam(m)
  const orch = team.find((a) => a.role === "orchestrator")
  assert.strictEqual(orch.permissions.bash["*"], "deny")
  assert.strictEqual(orch.permissions.bash["git status*"], "allow")
  assert.strictEqual(orch.permissions.bash["cat*"], "allow")
  const qa = team.find((a) => a.role === "qa")
  assert.strictEqual(qa.permissions.edit["*"], "deny", "other role boundaries unchanged")
})

test("renderManifestYaml emits headless flag", () => {
  const m = structuredClone(baseManifest)
  m.project.headless = true
  const yaml = renderManifestYaml(m, buildTeam(m))
  assert.match(yaml, /headless: true/)
})

test("renderAgentFile emits native frontmatter + body", () => {
  const team = buildTeam(baseManifest)
  const qa = team.find((a) => a.role === "qa")
  const out = renderAgentFile(qa, "You are the qa agent for {project_name}.")
  assert.match(out, /^---\n/)
  assert.match(out, /\nmode: subagent\n/)
  assert.match(out, /model: opencode\/mimo-v2\.5-free\n/)
  assert.match(out, /description: Corvette \u2014 Quality assurance/)
  assert.match(out, /permission:/)
  assert.match(out, /\n---\n\nYou are the qa agent/)
})

test("renderAgentFile orchestrator is primary with color, no displayName", () => {
  const team = buildTeam(baseManifest)
  const orch = team.find((a) => a.role === "orchestrator")
  const out = renderAgentFile(orch, "You are the orchestrator.")
  assert.match(out, /mode: primary\n/)
  assert.match(out, /color: "#00bcd4"/)
  assert.match(out, /description:.*Commodore.*Delivery lead \/ scheduler/)
  assert.doesNotMatch(out, /displayName/)
})

test("renderAgentFile every role description starts with displayFor(role)", () => {
  const team = buildTeam(baseManifest)
  for (const agent of team) {
    const out = renderAgentFile(agent, `Prompt for ${agent.role}.`)
    const displayName = displayFor(agent.role)
    const label = CATALOG[agent.role].label
    const expected = `description: ${displayName} \u2014 ${label}`
    assert.ok(out.includes(expected),
      `${agent.role}: expected description "${expected}" not found in:\n${out.split("\n").slice(0, 5).join("\n")}`)
  }
})

test("renderOpenCodeJson has no agent block, sets default_agent, denies external_directory", () => {
  const team = buildTeam(baseManifest)
  const cfg = renderOpenCodeJson(baseManifest, team)
  assert.strictEqual(cfg.model, modelFor("orchestrator", "balanced"))
  assert.strictEqual(cfg.permission.external_directory, "deny")
  assert.strictEqual(cfg.default_agent, "commodore")
  assert.strictEqual(cfg.agent, undefined, "agent block removed")
  assert.strictEqual(cfg.permission.edit, undefined)
  assert.strictEqual(cfg.permission.bash, undefined)
})

test("renderOpenCodeJson model follows budget tier", () => {
  const m = structuredClone(baseManifest)
  m.project.budget = "free"
  const cfg = renderOpenCodeJson(m, buildTeam(m))
  assert.strictEqual(cfg.model, modelFor("orchestrator", "free"))
  assert.strictEqual(cfg.default_agent, "commodore")
})

test("renderOpenCodeJson registers openrouter models with failover", () => {
  const team = buildTeam(baseManifest)
  const cfg = renderOpenCodeJson(baseManifest, team)
  const or = cfg.provider?.openrouter?.models
  assert.ok(or, "provider.openrouter.models must be emitted")
  assert.ok(Object.keys(or).length > 0, "at least one openrouter model registered")
  for (const [slug, opts] of Object.entries(or)) {
    assert.match(slug, /^[a-z0-9][a-z0-9._\/~-]*$/, `openrouter model slug: ${slug}`)
    assert.ok(opts.options?.provider?.allow_fallbacks === true, `${slug} must set allow_fallbacks: true`)
  }
})

test("renderOpenCodeJson openrouter block covers power budget models", () => {
  const m = structuredClone(baseManifest)
  m.project.budget = "power"
  const cfg = renderOpenCodeJson(m, buildTeam(m))
  const slugs = Object.keys(cfg.provider?.openrouter?.models ?? {})
  const powerModels = Object.values(CATALOG)
    .map((e) => e.power)
    .filter((id) => id.startsWith("openrouter/"))
  for (const id of powerModels) {
    const slug = id.slice("openrouter/".length)
    assert.ok(slugs.includes(slug), `power model ${slug} must be registered`)
  }
})

test("renderOpenCodeJson has no plugin block by default", () => {
  const team = buildTeam(baseManifest)
  const cfg = renderOpenCodeJson(baseManifest, team)
  assert.strictEqual(cfg.plugin, undefined, "default init must not emit a plugin block")
})

test("AGENTS.md playbook mentions ledger and roles", () => {
  const team = buildTeam(baseManifest)
  const md = renderAgentsMd(baseManifest, team)
  assert.match(md, /DEFECTS\.md/)
  assert.match(md, /ADVERSARIAL_REVIEW\.md/)
  assert.match(md, /only qa closes it|qa closes it/)
  assert.match(md, /backend-dev/)
})

test("renderAgentsMd references custom requirements file", () => {
  const m = structuredClone(baseManifest)
  m.project.requirementsFile = "REQUIREMENTS-admin.md"
  const md = renderAgentsMd(m, buildTeam(m))
  assert.match(md, /REQUIREMENTS-admin\.md/)
})

test("renderAgentsMd header uses project name, not feature name", () => {
  const m = structuredClone(baseManifest)
  m.project.name = "stable-agents-md"
  const team = buildTeam(m)
  const mdA = renderAgentsMd(m, team, "lane-A")
  const mdB = renderAgentsMd(m, team, "lane-B")
  const linesA = mdA.split("\n")
  const linesB = mdB.split("\n")
  const headerLine = linesA.findIndex((l) => l.startsWith("# "))
  const headerA = linesA[headerLine]
  const headerB = linesB[headerLine]
  assert.strictEqual(headerA, headerB, "header line must be identical regardless of feature name")
  assert.ok(headerA.includes(m.project.name), "header line must include project name")
  assert.ok(!headerA.includes("lane-A"), "header line must not include feature name lane-A")
  assert.ok(!headerB.includes("lane-B"), "header line must not include feature name lane-B")
})

test("renderManifestYaml emits requirementsFile", () => {
  const m = structuredClone(baseManifest)
  m.project.requirementsFile = "REQUIREMENTS-admin.md"
  const yaml = renderManifestYaml(m, buildTeam(m))
  assert.match(yaml, /requirementsFile: "REQUIREMENTS-admin\.md"/)
})

test("renderManifestYaml quotes scalars to survive round-trip", () => {
  const m = structuredClone(baseManifest)
  m.project.name = "weird\"name\n"
  m.project.requirementsFile = "REQUIREMENTS-admin.md"
  const yaml = renderManifestYaml(m, buildTeam(m))
  assert.doesNotThrow(() => parseManifestYaml(yaml))
  const reparsed = parseManifestYaml(yaml)
  assert.strictEqual(reparsed.project.name, "weird\"name\n")
  assert.strictEqual(reparsed.project.requirementsFile, "REQUIREMENTS-admin.md")
})

test("supervision.plugin round-trips through manifest", () => {
  const m = structuredClone(baseManifest)
  m.project.supervision = { plugin: true }
  const yaml = renderManifestYaml(m, buildTeam(m))
  assert.match(yaml, /supervision:\n\s+#.*\n\s+plugin: true/)
  const reparsed = parseManifestYaml(yaml)
  assert.strictEqual(reparsed.project.supervision.plugin, true)
  // default is false when absent
  const dflt = parseManifestYaml(renderManifestYaml(baseManifest, buildTeam(baseManifest)))
  assert.strictEqual(dflt.project.supervision.plugin, false)
})

test("yolo round-trips through manifest, default false", () => {
  const m = structuredClone(baseManifest)
  m.project.yolo = true
  const yaml = renderManifestYaml(m, buildTeam(m))
  assert.match(yaml, /yolo: true/)
  const reparsed = parseManifestYaml(yaml)
  assert.strictEqual(reparsed.project.yolo, true)
  const dflt = parseManifestYaml(renderManifestYaml(baseManifest, buildTeam(baseManifest)))
  assert.strictEqual(dflt.project.yolo, false)
})

test("buildTeam yolo flips ask bash to allow, keeps edit boundaries", () => {
  const m = structuredClone(baseManifest)
  m.project.yolo = true
  const team = buildTeam(m)
  const orch = team.find((a) => a.role === "orchestrator")
  assert.strictEqual(orch.permissions.bash["*"], "allow", "orchestrator bash allow in yolo")
  assert.strictEqual(orch.permissions.edit["*"], "deny", "orchestrator edit stays deny (delegates)")
  const qa = team.find((a) => a.role === "qa")
  assert.strictEqual(qa.permissions.bash["*"], "allow", "qa bash allow in yolo")
  assert.strictEqual(qa.permissions.edit["*"], "deny", "qa edit stays deny (writes only e2e/*)")
  const sec = team.find((a) => a.role === "security")
  assert.strictEqual(sec.permissions.edit["*"], "deny", "security stays read-only")
  // non-yolo keeps ask
  const base = buildTeam(baseManifest)
  assert.strictEqual(base.find((a) => a.role === "orchestrator").permissions.bash["*"], "ask")
})

test("renderOpenCodeJson yolo permits autonomous run", () => {
  const m = structuredClone(baseManifest)
  m.project.yolo = true
  const cfg = renderOpenCodeJson(m, buildTeam(m))
  assert.strictEqual(cfg.permission["*"], "allow", "config-level allow in yolo")
  assert.strictEqual(cfg.permission.external_directory, "deny", "external dir still denied")
  // non-yolo has no catch-all allow
  const base = renderOpenCodeJson(baseManifest, buildTeam(baseManifest))
  assert.strictEqual(base.permission["*"], undefined)
})

test("renderRequirementsMd invites co-writing the contract", () => {
  const md = renderRequirementsMd(baseManifest)
  assert.match(md, /Co-write this with the orchestrator/)
  assert.match(md, /--requirements <file>/)
})

test("renderRequirementsMd includes PR-first final criterion", () => {
  const md = renderRequirementsMd(baseManifest)
  // The PR-first final criterion must be in the Final criteria section.
  assert.match(md, /## final criteria[\s\S]*gh pr create --base master/i,
    "Final criteria section must require 'gh pr create --base master'")
  assert.match(md, /never[^.\n]*git merge/i,
    "Final criteria must forbid 'git merge' locally")
  assert.match(md, /never[^.\n]*push master directly/i,
    "Final criteria must forbid direct push to master")
})

test("renderRequirementsMd phases declare dependencies for parallel run", () => {
  const md = renderRequirementsMd(baseManifest)
  assert.match(md, /\*\*Depends on:\*\* none/)
  assert.match(md, /run in parallel as background subagents/)
})

test("renderRequirementsMd describes adaptive evidence and universal QA", () => {
  const md = renderRequirementsMd(baseManifest)
  assert.match(md, /QA is always active/i)
  assert.match(md, /low risk.*smoke|smoke.*low risk/i)
  assert.match(md, /risk override.*optional/i)
  assert.match(md, /group.*finding|finding.*group/i)
  assert.match(md, /parallel voyages|voyages.*parallel/i)
})

test("renderRequirementsMd keeps adaptive policy compact", () => {
  const md = renderRequirementsMd(baseManifest)
  const section = md.slice(md.indexOf("## Adaptive workflow"), md.indexOf("## Success criteria"))
  assert.ok(section.split("\n").length <= 7, "requirements policy must stay compact")
})

test("renderAgentsMd phase gates are dependency-driven", () => {
  const md = renderAgentsMd(baseManifest, buildTeam(baseManifest))
  assert.match(md, /starts as soon as the phases it depends on have passed/i)
  assert.ok(!/Only then does the next phase start/i.test(md), "no rigid sequential gate wording")
})

test("renderAgentsMd includes adaptive staffing and evidence rules", () => {
  const md = renderAgentsMd(baseManifest, buildTeam(baseManifest))
  assert.match(md, /QA.*always|always.*QA/i)
  assert.match(md, /standby/i)
  assert.match(md, /BLOCKING/i)
  assert.match(md, /structured receipt|compact receipt/i)
})

test("renderAgentsMd keeps adaptive policy compact", () => {
  const md = renderAgentsMd(baseManifest, buildTeam(baseManifest))
  const section = md.slice(md.indexOf("## Adaptive delivery"), md.indexOf("## armada/"))
  assert.ok(section.split("\n").length <= 8, "AGENTS policy must stay compact")
  assert.doesNotMatch(section, /full relevant suite|negative-path/i, "detailed evidence belongs in gate skill")
})

test("renderArmadaCommand lives in generator.js and is pure", () => {
  const md = renderArmadaCommand()
  assert.match(md, /armada init --from-armada/)
  assert.match(md, /---/)
})

test("renderArmadaScoutCommand is read-only, dispatches investigation", () => {
  const md = renderArmadaScoutCommand()
  assert.match(md, /^---\n/)
  assert.match(md, /description:/)
  assert.match(md, /read-only|no writes|never write/i)
  assert.match(md, /adversary|architect/i)
  assert.ok(!/\{[a-z_]+\}/.test(md), "no dangling placeholders")
})

test("renderArmadaResumeCommand prefers armada reconcile with no in-tree fallback", () => {
  const md = renderArmadaResumeCommand()
  assert.match(md, /^---\n/)
  assert.match(md, /description:/)
  assert.match(md, /armada reconcile/)
  assert.doesNotMatch(md, /node src\/cli\.js/)
  assert.match(md, /resume line/)
  assert.match(md, /drift list/)
  assert.ok(!/\{[a-z_]+\}/.test(md), "no dangling placeholders")
})

test("renderArmadaResumeCommand is byte-identical after manifest round-trip", () => {
  // armada init --from-armada twice must produce identical command file.
  const cmd1 = renderArmadaResumeCommand()
  // Round-trip through manifest: parse -> re-render -> re-parse, then rebuild team.
  const team = buildTeam(baseManifest)
  const yaml = renderManifestYaml(baseManifest, team)
  const reparsed = parseManifestYaml(yaml)
  const team2 = buildTeam(reparsed)
  const yaml2 = renderManifestYaml(reparsed, team2)
  const cmd2 = renderArmadaResumeCommand()
  assert.strictEqual(cmd1, cmd2, "command output must be byte-identical after round-trip")
})

test("renderArmadaVoyageCommand returns frontmatter with commodore agent and voyage launch body", () => {
  const md = renderArmadaVoyageCommand()
  assert.match(md, /^---\n/)
  assert.match(md, /agent: commodore/)
  assert.match(md, /armada feature new/)
  assert.match(md, /armada init --yes --yolo/)
  assert.match(md, /armada voyage sandbox\//)
  assert.match(md, /node src\/cli\.js/)
})

test("renderArmadaVoyageCommand is byte-identical after manifest round-trip", () => {
  const cmd1 = renderArmadaVoyageCommand()
  const team = buildTeam(baseManifest)
  const yaml = renderManifestYaml(baseManifest, team)
  const reparsed = parseManifestYaml(yaml)
  const team2 = buildTeam(reparsed)
  const yaml2 = renderManifestYaml(reparsed, team2)
  const cmd2 = renderArmadaVoyageCommand()
  assert.strictEqual(cmd1, cmd2, "command output must be byte-identical after round-trip")
})

test("renderArmadaVoyageCommand has no dangling placeholders", () => {
  const md = renderArmadaVoyageCommand()
  assert.ok(!/\{[a-z_]+\}/.test(md), "no dangling placeholders")
})

test("renderArmadaSupervisionPlugin is valid JS with three handlers", async () => {
  const team = buildTeam(baseManifest)
  const src = renderArmadaSupervisionPlugin(team)
  assert.match(src, /export const ArmadaSupervision/)
  assert.match(src, /session\.created/)
  assert.match(src, /session\.idle/)
  assert.match(src, /tool\.execute\.before/)
  assert.match(src, /fleet-status\.md/)
  assert.match(src, /promptAsync/)
  assert.ok(!/\{[a-z_]+\}/.test(src), "no dangling placeholders")
  // parses + loads as an ES module with a valid plugin export
  const { writeFileSync, mkdtempSync } = await import("node:fs")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const dir = mkdtempSync(join(tmpdir(), "armada-plugin-"))
  const file = join(dir, "armada-supervision.mjs")
  writeFileSync(file, src)
  const mod = await import(file)
  assert.strictEqual(typeof mod.ArmadaSupervision, "function", "exports plugin factory")
})

test("renderArmadaSupervisionPlugin event handlers reference fleet-status + dedup state", async () => {
  const team = buildTeam(baseManifest)
  const src = renderArmadaSupervisionPlugin(team)
  const { writeFileSync, mkdtempSync } = await import("node:fs")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const dir = mkdtempSync(join(tmpdir(), "armada-plugin-events-"))
  const file = join(dir, "armada-supervision.mjs")
  writeFileSync(file, src)
  const mod = await import(file)

  const client = {
    session: { promptAsync: async () => {} },
    app: { log: async () => {} },
  }
  const hooks = await mod.ArmadaSupervision({ client, directory: dir })

  // structural: both handlers wired, fleet-status path + per-session dedup present
  assert.strictEqual(typeof hooks.event, "function")
  assert.strictEqual(typeof hooks["tool.execute.before"], "function")
  assert.match(src, /session\.created/)
  assert.match(src, /session\.idle/)
  assert.match(src, /\.opencode.*fleet-status\.md/)
  assert.match(src, /nudgedSessions|skipNextIdle/)
  // behavior: no fleet-status at the plugin's cwd -> session.created injects nothing
  await hooks.event({ event: { type: "session.created", properties: { sessionID: "s1" } } })
})

test("renderArmadaSupervisionPlugin tool.execute.before denies protected redirects", async () => {
  const team = buildTeam(baseManifest)
  const src = renderArmadaSupervisionPlugin(team)
  const { writeFileSync, mkdtempSync } = await import("node:fs")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const dir = mkdtempSync(join(tmpdir(), "armada-plugin-deny-"))
  const file = join(dir, "armada-supervision.mjs")
  writeFileSync(file, src)
  const mod = await import(file)
  const client = { session: { promptAsync: async () => {} }, app: { log: async () => {} } }
  const hooks = await mod.ArmadaSupervision({ client, directory: dir })

  // redirects to orchestrator edit-deny targets must throw
  for (const cmd of [
    "echo x > REQUIREMENTS.md",
    "echo x >> AGENTS.md",
    "tee armada/armada.yaml",
    "sed -i s/a/b/ .opencode/foo.json",
  ]) {
    await assert.rejects(
      () => hooks["tool.execute.before"]({ input: { tool: "bash" }, output: { args: { command: cmd } } }),
      /denied by armada-supervision/,
      `must deny: ${cmd}`
    )
  }

  // non-bash tools and safe bash must pass through
  await assert.doesNotReject(
    () => hooks["tool.execute.before"]({ input: { tool: "read" }, output: { args: { filePath: "REQUIREMENTS.md" } } })
  )
  await assert.doesNotReject(
    () => hooks["tool.execute.before"]({ input: { tool: "bash" }, output: { args: { command: "git status" } } })
  )
  await assert.doesNotReject(
    () => hooks["tool.execute.before"]({ input: { tool: "bash" }, output: { args: { command: "echo x > notes.md" } } })
  )
})

test("renderArmadaSupervisionPlugin denies edit-deny targets and protected paths", () => {
  const team = buildTeam(baseManifest)
  const orch = team.find((a) => a.role === "orchestrator")
  const denyGlobs = Object.entries(orch.permissions.edit).filter(([, v]) => v === "deny").map(([g]) => g)
  assert.ok(denyGlobs.length > 0, "orchestrator has edit-deny globs")
  const src = renderArmadaSupervisionPlugin(team)
  for (const g of denyGlobs) {
    if (g !== "*") assert.ok(src.includes(JSON.stringify(g)), `deny glob ${g} in plugin`)
  }
  assert.match(src, /REQUIREMENTS\.md/)
  assert.match(src, /AGENTS\.md/)
  assert.match(src, /\.opencode\/\*/)
  assert.match(src, /armada\//)
})

// -- Phase 2: deepMerge --

test("deepMerge: user leaf wins over base", () => {
  const base = { a: "deny", b: "ask" }
  const override = { a: "allow" }
  const result = deepMerge(base, override)
  assert.strictEqual(result.a, "allow")
  assert.strictEqual(result.b, "ask")
})

test("deepMerge: nested objects merged recursively", () => {
  const base = { edit: { "*.md": "deny", "*.ts": "deny" }, bash: { "*": "ask" } }
  const override = { edit: { "*.ts": "allow" } }
  const result = deepMerge(base, override)
  assert.deepStrictEqual(result, { edit: { "*.md": "deny", "*.ts": "allow" }, bash: { "*": "ask" } })
})

test("deepMerge: key ordering preserves base keys first, then override-only", () => {
  // base keys first, then override-only
  let result = deepMerge({ a: 1, c: 3 }, { b: 2 })
  assert.deepStrictEqual(Object.keys(result), ["a", "c", "b"])
  // override-only keys added after base keys
  result = deepMerge({ x: 1 }, { y: 2, z: 3 })
  assert.deepStrictEqual(Object.keys(result), ["x", "y", "z"])
})

test("deepMerge: null override returns base", () => {
  const base = { a: 1 }
  assert.deepStrictEqual(deepMerge(base, null), base)
  assert.deepStrictEqual(deepMerge(base, undefined), base)
})

test("deepMerge: leaf string overrides leaf string", () => {
  const base = { p: "deny" }
  const override = { p: "allow" }
  assert.strictEqual(deepMerge(base, override).p, "allow")
})

test("deepMerge: does not mutate inputs", () => {
  const base = { a: { x: 1 } }
  const override = { a: { y: 2 } }
  const baseBefore = JSON.stringify(base)
  const overrideBefore = JSON.stringify(override)
  deepMerge(base, override)
  assert.strictEqual(JSON.stringify(base), baseBefore)
  assert.strictEqual(JSON.stringify(override), overrideBefore)
})

// -- Phase 2: buildTeam permissions override --

test("buildTeam deep-merges user permissions over base", () => {
  const m = structuredClone(baseManifest)
  m.team = [
    { role: "backend-dev", model: modelFor("backend-dev", "balanced"), variant: null, fallback: null, enabled: true,
      permissions: { edit: { "*": "allow", "armada/e2e/*": "deny" }, bash: { "*": "ask" } } },
    { role: "qa", model: modelFor("qa", "balanced"), variant: null, fallback: null, enabled: true },
  ]
  const team = buildTeam(m)
  const backend = team.find((a) => a.role === "backend-dev")
  // user override wins
  assert.strictEqual(backend.permissions.edit["*"], "allow")
  // user override present
  assert.strictEqual(backend.permissions.edit["armada/e2e/*"], "deny")
  // base keys not overridden survive
  assert.strictEqual(backend.permissions.edit["armada/ledgers/*/DEFECTS.md"], "deny")
  assert.strictEqual(backend.permissions.edit["armada/*"], "deny")
  // QA has no overrides, uses base
  const qa = team.find((a) => a.role === "qa")
  assert.strictEqual(qa.permissions.edit["*"], "deny")
  assert.strictEqual(qa.permissions.edit["armada/e2e/*"], "allow")
})

test("buildTeam passes through instructions and prompt", () => {
  const m = structuredClone(baseManifest)
  m.team = [
    { role: "backend-dev", model: modelFor("backend-dev", "balanced"), variant: null, fallback: null, enabled: true,
      instructions: "extra backend rules", prompt: "templates/custom-be.md" },
  ]
  const team = buildTeam(m)
  const backend = team.find((a) => a.role === "backend-dev")
  assert.strictEqual(backend.instructions, "extra backend rules")
  assert.strictEqual(backend.prompt, "templates/custom-be.md")
})

test("buildTeam instructions and prompt default to null", () => {
  const team = buildTeam(baseManifest)
  for (const a of team) {
    assert.strictEqual(a.instructions, null)
    assert.strictEqual(a.prompt, null)
  }
})

// -- Phase 4: renderArmadaFleetPlugin --
test("renderArmadaFleetPlugin emits valid JS with fleet handlers", () => {
  const src = renderArmadaFleetPlugin()
  assert.match(src, /^\/\/ armada fleet plugin/)
  assert.match(src, /export const ArmadaFleet/)
  assert.match(src, /session\.created/)
  assert.match(src, /session\.idle/)
  assert.match(src, /session\.closed/)
  assert.match(src, /session\.deleted/)
  assert.match(src, /session\.completed/)
  assert.match(src, /INTERVAL_MS/)
  assert.match(src, /30_000/)
  assert.match(src, /startHeartbeat/)
  assert.match(src, /tickHeartbeat/)
  assert.match(src, /listRuns/)
  assert.match(src, /getStoreDir/)
  assert.match(src, /\.\.\/\.\.\/\.\.\/src\/heartbeat\.js/)
  assert.match(src, /\.\.\/\.\.\/\.\.\/src\/fleet-tracker\.js/)
  assert.match(src, /process\.env\.ARMADA_RUNS_DIR/)
  assert.match(src, /homedir\(\)/)
  assert.match(src, /level: "warn"/)
  assert.match(src, /service: "armada-fleet"/)
})

// -- Phase 2: per-feature ledger paths in rendered output --

test("renderAgentsMd uses per-feature ledger paths, conventions, and format", () => {
  const m = structuredClone(baseManifest)
  m.project.name = "my-app"
  const team = buildTeam(m)
  const md = renderAgentsMd(m, team, "my-app")
  // defect ledger section
  assert.match(md, /armada\/ledgers\/\{feature\}\/DEFECTS\.md/)
  assert.doesNotMatch(md, /\bDEFECTS\.md\b.*repo root/)
  // Repository conventions
  assert.match(md, /armada\/e2e\/\{feature\}\//)
  assert.match(md, /armada\/screenshots\/\{feature\}\//)
  assert.doesNotMatch(md, /live under `e2e\/`\./)
  assert.doesNotMatch(md, /live under `screenshots\/`\./)
  // Title sections
  assert.match(md, /## armada\/ledgers\/\{feature\}\/DEFECTS\.md/)
  assert.match(md, /## armada\/ledgers\/\{feature\}\/ADVERSARIAL_REVIEW\.md/)
  // Format block paths
  assert.match(md, /armada\/screenshots\/\{feature\}\/def-001\.png/)
  assert.match(md, /armada\/screenshots\/\{feature\}\/adv-001\.png/)
  // Status table path references
  assert.match(md, /All defects live in `armada\/ledgers\/\{feature\}\/DEFECTS\.md`/)
  assert.match(md, /All adversary findings live in `armada\/ledgers\/\{feature\}\/ADVERSARIAL_REVIEW\.md`/)
})

test("renderAgentsMd resolves {feature} token in playbook file paths", () => {
  const m = structuredClone(baseManifest)
  m.project.name = "my-app"
  m.project.feature = "my-app"
  // Override playbook with {feature} token
  m.playbook = {
    defectLedger: { file: "armada/ledgers/{feature}/DEFECTS.md" },
    adversarialLedger: { file: "armada/ledgers/{feature}/ADVERSARIAL_REVIEW.md" },
  }
  const team = buildTeam(m)
  const md = renderAgentsMd(m, team, "my-app")
  assert.match(md, /armada\/ledgers\/my-app\/DEFECTS\.md/)
  assert.match(md, /armada\/ledgers\/my-app\/ADVERSARIAL_REVIEW\.md/)
})

test("renderAgentsMd handles {feature} token based on project.feature", async () => {
  for (const [feature, expectPrefix, expectToken] of [
    [undefined, "\\{feature\\}", true],
    ["web-app", "web-app", false],
  ]) {
    const m = structuredClone(baseManifest)
    m.project.name = "my-app"
    if (feature) m.project.feature = feature
    const team = buildTeam(m)
    const md = renderAgentsMd(m, team, "my-app")

    const pf = expectPrefix.replace(/\\\\/g, "\\")
    assert.match(md, new RegExp(`armada\\/ledgers\\/${pf}\\/`))
    assert.match(md, new RegExp(`armada\\/e2e\\/${pf}\\/`))
    assert.match(md, new RegExp(`armada\\/screenshots\\/${pf}\\/`))
    assert.match(md, new RegExp(`armada\\/ledgers\\/${pf}\\/DEFECTS\\.md`))
    assert.match(md, new RegExp(`armada\\/ledgers\\/${pf}\\/ADVERSARIAL_REVIEW\\.md`))
    if (!expectToken) {
      assert.doesNotMatch(md, /armada\/ledgers\/\{feature\}\//)
      assert.doesNotMatch(md, /armada\/e2e\/\{feature\}\//)
      assert.doesNotMatch(md, /armada\/screenshots\/\{feature\}\//)
    }
  }
})

test("renderAgentsMd does not interpret $-patterns in project.feature", () => {
  const m = structuredClone(baseManifest)
  m.project.feature = "$&"
  const team = buildTeam(m)
  const md = renderAgentsMd(m, team, "$&")
  assert.ok(md.includes("armada/ledgers/$&/DEFECTS.md"), "must contain literal $& in DEFECTS.md path")
  assert.ok(md.includes("armada/ledgers/$&/ADVERSARIAL_REVIEW.md"), "must contain literal $& in ADVERSARIAL_REVIEW.md path")
  assert.doesNotMatch(md, /armada\/ledgers\/\{feature\}\//)
})

test("renderAgentsMd $1 in project.feature is literal not backreference", () => {
  const m = structuredClone(baseManifest)
  m.project.feature = "$1"
  const team = buildTeam(m)
  const md = renderAgentsMd(m, team, "$1")
  assert.ok(md.includes("armada/ledgers/$1/DEFECTS.md"), "must contain literal $1 in DEFECTS.md path")
  assert.ok(md.includes("armada/ledgers/$1/ADVERSARIAL_REVIEW.md"), "must contain literal $1 in ADVERSARIAL_REVIEW.md path")
  assert.doesNotMatch(md, /armada\/ledgers\/\{feature\}\//)
})

test("renderArmadaSupervisionPlugin deny list absence confirms per-feature ledger is allow", () => {
  const team = buildTeam(baseManifest)
  const orch = team.find((a) => a.role === "orchestrator")
  // Ledger files are ALLOW for orchestrator, not DENY — they won't appear in deny list
  assert.strictEqual(orch.permissions.edit["armada/ledgers/*/DEFECTS.md"], "allow")
  assert.strictEqual(orch.permissions.edit["armada/ledgers/*/ADVERSARIAL_REVIEW.md"], "allow")
  const src = renderArmadaSupervisionPlugin(team)
  // Root-level ledger files removed; only per-feature paths present
  assert.ok(!/["']DEFECTS\.md["']/.test(src) || src.includes("armada/ledgers"), "no root-level DEFECTS.md in deny list")
})

// -- watchdog plugin generator tests --

test("renderArmadaWatchdogPlugin has header, exports, hooks, and constants", () => {
  const src = renderArmadaWatchdogPlugin()
  assert.match(src, /^\/\/ armada watchdog plugin/)
  assert.match(src, /--watchdog/)
  assert.match(src, /Auto-loaded by opencode from \.opencode\/plugins/)
  assert.match(src, /export const ArmadaWatchdog/)
  assert.match(src, /session\.created/)
  assert.match(src, /session\.idle/)
  assert.match(src, /session\.completed/)
  assert.match(src, /session\.closed/)
  assert.match(src, /session\.deleted/)
  assert.match(src, /TIMEOUT_MS = 300_000/)
  assert.match(src, /STALENESS_WINDOW_MS = 120_000/)
  assert.match(src, /Gate 1/)
  assert.match(src, /Gate 2/)
})

test("renderArmadaWatchdogPlugin has recursion guard and event tracking", () => {
  const src = renderArmadaWatchdogPlugin()
  assert.match(src, /skipNextIdle/)
  assert.match(src, /nudgedSessions/)
  assert.match(src, /lastOrchestratorEventAt/)
  assert.match(src, /lastOrchestratorEventAt = Date\.now\(\)/)
})

test("renderArmadaWatchdogPlugin is deterministic and valid JS", async () => {
  const src = renderArmadaWatchdogPlugin()
  // deterministic
  assert.strictEqual(renderArmadaWatchdogPlugin(), src)
  // valid JS import
  const { writeFileSync, mkdtempSync } = await import("node:fs")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const dir = mkdtempSync(join(tmpdir(), "armada-watchdog-plugin-"))
  const file = join(dir, "armada-watchdog.mjs")
  writeFileSync(file, src)
  const mod = await import(file)
  assert.strictEqual(typeof mod.ArmadaWatchdog, "function", "exports plugin factory")
})

test("renderManifestYaml emits watchdog: field and round-trips through parseManifestYaml", () => {
  const yaml = renderManifestYaml(baseManifest, buildTeam(baseManifest))
  assert.match(yaml, /watchdog: false/)
  const parsed = parseManifestYaml(yaml)
  assert.strictEqual(parsed.project.supervision.watchdog, false)
})

test("all 4 armada command renderers emit subtask: true", () => {
  const renderers = [
    renderArmadaCommand,
    renderArmadaScoutCommand,
    renderArmadaResumeCommand,
    renderArmadaVoyageCommand,
  ]
  for (const r of renderers) {
    const md = r()
    const m = md.match(/^---\n([\s\S]*?)\n---\n/)
    assert.ok(m, `frontmatter found in ${r.name} output`)
    assert.match(m[1], /subtask:\s*true/, `${r.name} frontmatter must include "subtask: true"`)
  }
})

// -- Phase 2 (orchestrator-no-trivial): lock the new contract --

test("orchestrator prompt hard rule 2 forbids trivial framing and lists the 4 legitimate write paths", () => {
  const prompt = readFileSync(ORCH_PROMPT_PATH, "utf8")
  // the 4 legitimate write paths are named explicitly
  assert.ok(prompt.includes("armada/state/active.json"), "must list armada/state/active.json")
  assert.ok(prompt.includes("armada/state/features/*"), "must list armada/state/features/*")
  assert.ok(prompt.includes("armada/ledgers/*/DEFECTS.md"), "must list armada/ledgers/*/DEFECTS.md")
  assert.ok(prompt.includes("armada/ledgers/*/ADVERSARIAL_REVIEW.md"), "must list armada/ledgers/*/ADVERSARIAL_REVIEW.md")
  // the trivial / one-line / too-small framing is explicitly forbidden
  assert.match(prompt, /trivial[\s\S]*one-line[\s\S]*too small/i,
    "must forbid the trivial/one-line/too small framing")
  // old "never write or edit code" wording is gone (new wording is "files")
  assert.doesNotMatch(prompt, /never write or edit code/i,
    "must not contain the old 'never write or edit code' wording")
  // cost discipline block likewise uses "files", not "code"
  assert.doesNotMatch(prompt, /Never write or edit code/,
    "cost discipline must say 'files' not 'code'")
  assert.match(prompt, /Never write or edit files/, "cost discipline uses the new 'files' wording")
})

test("orchestrator.edit matrix has no *.md blanket and the 4 explicit allows", () => {
  const team = buildTeam(baseManifest)
  const orch = team.find((a) => a.role === "orchestrator")
  const edit = orch.permissions.edit
  // the *.md blanket is gone
  assert.strictEqual(edit["*.md"], undefined, "no *.md blanket allow")
  // the 4 explicit allows are present
  assert.strictEqual(edit["armada/state/active.json"], "allow")
  assert.strictEqual(edit["armada/state/features/*"], "allow")
  assert.strictEqual(edit["armada/ledgers/*/DEFECTS.md"], "allow")
  assert.strictEqual(edit["armada/ledgers/*/ADVERSARIAL_REVIEW.md"], "allow")
  // deny rules intact
  assert.strictEqual(edit["*"], "deny")
  assert.strictEqual(edit["REQUIREMENTS.md"], "deny")
  assert.strictEqual(edit["AGENTS.md"], "deny")
  assert.strictEqual(edit[".opencode/*"], "deny")
  assert.strictEqual(edit["armada/*"], "deny")
})

test("resolvePermission resolves state+ledger writes to allow and everything else to deny", () => {
  const team = buildTeam(baseManifest)
  const edit = team.find((a) => a.role === "orchestrator").permissions.edit
  // the 4 legitimate write paths resolve to allow despite *: deny
  for (const p of [
    "armada/state/active.json",
    "armada/state/features/orchestrator-no-trivial.json",
    "armada/ledgers/foo/DEFECTS.md",
    "armada/ledgers/foo/ADVERSARIAL_REVIEW.md",
  ]) {
    assert.strictEqual(resolvePermission(edit, p), "allow", `expected allow for ${p}`)
  }
  // everything else resolves to deny (most hit *: deny, some hit armada/*: deny)
  for (const p of [
    "TODO.md",
    "README.md",
    "docs/foo.md",
    "src/generator.js",
    "AGENTS.md",
    ".opencode/agent/commodore.md",
    "armada/contracts/foo.md",
    "armada/ledgers/foo/SECURITY_FINDINGS.md",
  ]) {
    assert.strictEqual(resolvePermission(edit, p), "deny", `expected deny for ${p}`)
  }
})

test("yolo mode does not widen orchestrator agent-level edit boundaries", () => {
  const baseTeam = buildTeam(baseManifest)
  const baseEdit = baseTeam.find((a) => a.role === "orchestrator").permissions.edit
  // yolo only rewrites bash, not edit
  const m = structuredClone(baseManifest)
  m.project.yolo = true
  const yoloTeam = buildTeam(m)
  const yoloOrch = yoloTeam.find((a) => a.role === "orchestrator")
  // bash is widened (autonomous), edit is byte-identical to base
  assert.strictEqual(yoloOrch.permissions.bash["*"], "allow", "yolo widens bash to allow")
  assert.deepStrictEqual(yoloOrch.permissions.edit, baseEdit,
    "yolo must not widen the orchestrator edit matrix")
  // sanity: the edit matrix still denies the catch-all
  assert.strictEqual(yoloOrch.permissions.edit["*"], "deny")
})

// -- Phase 1: safe-bash tiered allowlist --

test("SAFE_BASH: every role's bash block contains expected read globs", () => {
  const team = buildTeam(baseManifest)
  const readCommands = [
    "ls*", "cat*", "head*", "tail*", "find*", "grep*", "wc*",
    "pwd", "echo*", "which*", "env", "printenv", "true", "false",
    "test*", "git status*", "git diff*", "git log*", "git branch*",
    "git rev-parse*", "git show*", "uname*", "date*", "whoami*", "file *",
  ]
  for (const role of ROLES) {
    const agent = team.find((a) => a.role === role)
    assert.ok(agent, `role ${role} must exist`)

    // docs has bash: "deny" (string), skip command-level checks
    if (role === "docs") {
      assert.strictEqual(agent.permissions.bash, "deny", "docs bash must remain 'deny' string")
      continue
    }

    const bash = agent.permissions.bash
    assert.ok(typeof bash === "object" && bash !== null, `${role} bash must be an object`)
    for (const cmd of readCommands) {
      assert.strictEqual(bash[cmd], "allow", `${role} must allow: ${cmd}`)
    }
  }
})

test("SAFE_BASH: dev roles contain write globs; non-dev roles do NOT", () => {
  const team = buildTeam(baseManifest)
  const devRoles = ["orchestrator", "qa", "backend-dev", "frontend-dev"]
  const readOnlyRoles = ["security", "adversary", "architect", "docs"]
  const writeCommands = ["mkdir*", "touch*", "cp*", "mv*", "rm*", "rmdir*", "ln*", "tee*"]

  for (const role of devRoles) {
    const agent = team.find((a) => a.role === role)
    const bash = agent.permissions.bash
    for (const cmd of writeCommands) {
      assert.strictEqual(bash[cmd], "allow", `dev role ${role} must allow: ${cmd}`)
    }
  }

  for (const role of readOnlyRoles) {
    const agent = team.find((a) => a.role === role)
    const bash = agent.permissions.bash
    for (const cmd of writeCommands) {
      assert.ok(
        bash[cmd] === undefined || bash[cmd] === "deny",
        `read-only role ${role} must NOT allow: ${cmd} (got ${bash[cmd]})`
      )
    }
  }
})

test("SAFE_BASH: manifest override still wins over the tier allowlist", () => {
  const m = structuredClone(baseManifest)
  m.team = [
    { role: "backend-dev", model: modelFor("backend-dev", "balanced"), variant: null, fallback: null, enabled: true,
      permissions: { bash: { "ls*": "deny", "mkdir*": "deny" } } },
    ...ROLES.filter((r) => r !== "backend-dev").map((r) => ({ role: r, model: modelFor(r, "balanced"), variant: null, fallback: null, enabled: true })),
  ]
  const team = buildTeam(m)
  const backend = team.find((a) => a.role === "backend-dev")
  // manifest override wins over SAFE_BASH tier allowlist
  assert.strictEqual(backend.permissions.bash["ls*"], "deny", "manifest override must set ls* to deny")
  assert.strictEqual(backend.permissions.bash["mkdir*"], "deny", "manifest override must set mkdir* to deny")
  // non-overridden safe-bash commands still present
  assert.strictEqual(backend.permissions.bash["cat*"], "allow", "non-overridden cat* must remain allow")
  assert.strictEqual(backend.permissions.bash["pwd"], "allow", "non-overridden pwd must remain allow")
})

test("SAFE_BASH: headless orchestrator bash does NOT contain mkdir*", () => {
  const m = structuredClone(baseManifest)
  m.project.headless = true
  const team = buildTeam(m)
  const orch = team.find((a) => a.role === "orchestrator")
  // headless overwrites bash entirely, so write commands are absent
  assert.strictEqual(orch.permissions.bash["*"], "deny")
  assert.strictEqual(orch.permissions.bash["git status*"], "allow")
  assert.strictEqual(orch.permissions.bash["cat*"], "allow")
  assert.strictEqual(orch.permissions.bash["mkdir*"], undefined, "headless orchestrator must NOT have mkdir*")
  assert.strictEqual(orch.permissions.bash["rm*"], undefined, "headless orchestrator must NOT have rm*")
  assert.strictEqual(orch.permissions.bash["cp*"], undefined, "headless orchestrator must NOT have cp*")
})
