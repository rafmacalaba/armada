// Phase 5 regression suite — workflow-triage invariants.
//
// Each named test guards one invariant established by this voyage. These are
// automated assertions, not prose. Deterministic, no network. Scans the
// committed tree (cwd = lane root) plus minimal temp-dir scaffolds for the
// no-clobber / custom-ledger guards.

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname, normalize } from "node:path"
import YAML from "yaml"

import { parseManifestYaml, DEFAULT_PLAYBOOK } from "../src/manifest.js"
import {
  buildTeam,
  mergeOpenCodeJson,
  renderOpenCodeJson,
  renderAgentFile,
  renderAgentsMd,
  renderArmadaCommand,
  renderArmadaScoutCommand,
  renderArmadaResumeCommand,
  renderArmadaVoyageCommand,
  renderManifestYaml,
} from "../src/generator.js"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { agentNameFor, roleForAgentName } from "../src/role-display.js"
import { scaffold } from "../src/scaffold.js"

const ROOT = process.cwd()

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8")
}

// Parse YAML frontmatter (between the first two `---` fences) of an agent file.
function parseAgentFrontmatter(content) {
  const start = content.indexOf("---\n") + 4
  const end = content.indexOf("\n---\n", start)
  return YAML.parse(content.slice(start, end))
}

// Frontmatter rendered by the generator for a given built agent (body is
// irrelevant to the frontmatter, which is what we compare).
function renderedFrontmatter(agent) {
  return parseAgentFrontmatter(renderAgentFile(agent, "BODY"))
}

// Recursively walk a directory, yielding relative-to-ROOT paths.
// Skips missing directories (survives CI with gitignored dirs absent).
function* walk(relDir) {
  let entries
  try {
    entries = readdirSync(join(ROOT, relDir))
  } catch {
    return
  }
  for (const entry of entries) {
    const rel = join(relDir, entry)
    const st = statSync(join(ROOT, rel))
    if (st.isDirectory()) yield* walk(rel)
    else yield rel
  }
}

// ---------------------------------------------------------------------------
// 1. Triage canon: every triage-decision statement in the fleet surfaces
//    either links docs/process/triage.md or IS that file. No restated policy
//    without citing the canon.
// ---------------------------------------------------------------------------

// Rendered command files — source of truth, no disk dependency.
const RENDERED_COMMAND_FILES = {
  ".opencode/commands/armada.md": renderArmadaCommand(),
  ".opencode/commands/armada-scout.md": renderArmadaScoutCommand(),
  ".opencode/commands/armada-resume.md": renderArmadaResumeCommand(),
  ".opencode/commands/armada-voyage.md": renderArmadaVoyageCommand(),
}

const TRIAGE_SURFACES = [
  "agents/orchestrator/prompt.template.md",
  "AGENTS.md",
  ...Object.keys(RENDERED_COMMAND_FILES),
]
for (const f of walk("agents")) TRIAGE_SURFACES.push(f)
for (const f of walk("docs")) TRIAGE_SURFACES.push(f)

const TRIAGE_KEYWORDS = [
  "in-window",
  "voyage by exception",
  "split a broad",
  "separate voyages when",
  "voyage vs",
  "in-window first",
]

test("triage canon: every triage-decision statement cites docs/process/triage.md", () => {
  const violators = []
  for (const rel of TRIAGE_SURFACES) {
    if (rel === "docs/process/triage.md") continue
    let txt
    try {
      txt = read(rel)
    } catch {
      // Fall back to rendered content for command files (survives CI)
      txt = RENDERED_COMMAND_FILES[rel]
      if (txt === undefined) continue
    }
    if (!TRIAGE_KEYWORDS.some((k) => txt.includes(k))) continue
    // Cite the canon: a markdown link (any relative depth) or a plain
    // authority path reference. Every form includes the canon path fragment
    // `process/triage.md` (e.g. `docs/process/triage.md`, `./process/triage.md`,
    // `../../docs/process/triage.md`).
    if (!txt.includes("process/triage.md")) violators.push(rel)
  }
  assert.deepEqual(violators, [], `triage policy restated without citing canon: ${violators.join(", ")}`)
})

// ---------------------------------------------------------------------------
// 2. Split-broad-task rule present in the orchestrator prompt AND the voyage
//    command (renderer output == committed command doc).
// ---------------------------------------------------------------------------

test("split-broad-task rule present in orchestrator prompt", () => {
  const prompt = read("agents/orchestrator/prompt.template.md")
  assert.match(prompt, /separate voyages when[\s\S]*independent/i, "orchestrator prompt must carry the split-broad-task rule")
  assert.match(prompt, /one voyage\s+when\s+workstreams share writers/i, "orchestrator prompt must state the single-voyage case")
})

test("split-broad-task rule present in the voyage command doc, matching the renderer", () => {
  let committed
  try {
    committed = read(".opencode/commands/armada-voyage.md")
  } catch {
    // Survives CI with gitignored .opencode/ absent — rendered output is source of truth
    committed = renderArmadaVoyageCommand()
  }
  assert.strictEqual(committed, renderArmadaVoyageCommand(), "armada-voyage.md must equal renderArmadaVoyageCommand()")
  assert.match(committed, /separate voyages when[\s\S]*independent/i, "voyage command must carry the split-broad-task rule")
})

// ---------------------------------------------------------------------------
// 3. Doc-link integrity: every relative .md link in README/docs/ARCHITECTURE/TODO
//    resolves to an existing file.
// ---------------------------------------------------------------------------

const LINK_RE = /!?\[([^\]]*)\]\(([^)]+)\)/g

function* docLinkFiles() {
  yield "README.md"
  yield "ARCHITECTURE.md"
  yield "TODO.md"
  for (const f of walk("docs")) yield f
}

function extractMdLinks(relFile) {
  const txt = read(relFile)
  const out = []
  let m
  LINK_RE.lastIndex = 0
  while ((m = LINK_RE.exec(txt))) {
    let target = m[2].trim().split(/\s+/)[0]
    if (target.startsWith("http:") || target.startsWith("https:") || target.startsWith("mailto:") || target.startsWith("ftp:")) continue
    if (target.startsWith("#")) continue
    target = target.split("#")[0]
    if (!target) continue
    if (!target.endsWith(".md")) continue
    out.push({ target, raw: m[2] })
  }
  return out
}

test("doc-link integrity: every relative .md link in README/docs/ARCHITECTURE/TODO resolves", () => {
  const dead = []
  for (const rel of docLinkFiles()) {
    for (const { target, raw } of extractMdLinks(rel)) {
      const resolved = normalize(join(dirname(rel), target))
      if (!existsSync(join(ROOT, resolved))) dead.push(`${rel} -> ${raw}`)
    }
  }
  assert.deepEqual(dead, [], `dead .md links: ${dead.join(", ")}`)
})

// ---------------------------------------------------------------------------
// 4. Artifact consistency: armada.yaml <-> rendered opencode.json <->
//    agent frontmatter <-> BASE_PERMISSIONS <-> DEFAULT_PLAYBOOK ledger paths
//    agree. Includes custom ledger derivation.
// ---------------------------------------------------------------------------

// Fallback manifest used when armada/armada.yaml is gitignored (CI checkout).
// Exercises the same invariants as the committed manifest: all 8 roles,
// balanced budget, yolo, react/node-express stack. Fallbacks and variant are
// explicit catalog values so renderManifestYaml round-trip passes.
function defaultManifest() {
  const CATALOG_FALLBACKS = {
    orchestrator: { fallback: "openrouter/z-ai/glm-5.2", variant: "thinking" },
    "backend-dev": { fallback: "openrouter/deepseek/deepseek-v4-pro", variant: null },
    "frontend-dev": { fallback: "openrouter/minimax/minimax-m3", variant: null },
    qa: { fallback: "openrouter/xiaomi/mimo-v2.5", variant: null },
    adversary: { fallback: "openrouter/deepseek/deepseek-v4-pro", variant: null },
    security: { fallback: "openrouter/deepseek/deepseek-v4-pro", variant: null },
    docs: { fallback: "openrouter/minimax/minimax-m3", variant: null },
    architect: { fallback: "openrouter/z-ai/glm-5.2", variant: null },
  }
  return {
    project: {
      name: "ci-default",
      budget: "balanced",
      browserTesting: false,
      devcontainer: false,
      useAgentBrowser: false,
      headless: false,
      yolo: true,
      requirementsFile: "armada/REQUIREMENTS.md",
      feature: null,
      skills: undefined,
      supervision: {
        plugin: false,
        fleet: true,
        watchdog: false,
        shipnames: true,
      },
      stack: {
        frontend: "react",
        backend: "node-express",
        database: null,
        testing: "pytest",
        srcDirs: ["src"],
        languages: ["typescript", "python"],
        instructions: [],
      },
    },
    team: ROLES.map((r) => ({
      role: r,
      model: "opencode-go/minimax-m3",
      fallback: CATALOG_FALLBACKS[r].fallback,
      variant: CATALOG_FALLBACKS[r].variant,
      enabled: true,
      permissions: null,
      instructions: null,
      prompt: null,
    })),
    playbook: {},
  }
}

function loadCommittedManifest() {
  try {
    return parseManifestYaml(read("armada/armada.yaml"))
  } catch {
    return defaultManifest()
  }
}

test("artifact consistency: mergeOpenCodeJson over committed opencode.json is idempotent", () => {
  const manifest = loadCommittedManifest()
  const team = buildTeam(manifest)
  let existing
  try {
    existing = JSON.parse(read("opencode.json"))
  } catch {
    // CI: opencode.json is gitignored; use rendered baseline — merge on a pure
    // armada output is trivially idempotent but still catches renderer regressions.
    existing = JSON.parse(JSON.stringify(renderOpenCodeJson(manifest, team)))
  }
  const merged = mergeOpenCodeJson(existing, manifest, team)
  assert.deepStrictEqual(existing, merged, "opencode.json must equal mergeOpenCodeJson(existing, manifest, buildTeam(manifest))")
})

test("artifact consistency: committed AGENTS.md armada block equals renderAgentsMd(manifest)", () => {
  // When armada.yaml is missing (CI checkout), the AGENTS.md block on disk
  // corresponds to a different manifest than the fallback default — skip the
  // committed-vs-rendered comparison since the manifest it was generated from
  // isn't available.
  if (!existsSync(join(ROOT, "armada/armada.yaml"))) {
    assert.ok(true, "armada/armada.yaml absent — skip committed-vs-rendered comparison")
    return
  }
  const manifest = loadCommittedManifest()
  const team = buildTeam(manifest)
  const rendered = renderAgentsMd(manifest, team)
  let committed
  try {
    committed = read("AGENTS.md")
  } catch {
    assert.ok(true, "AGENTS.md absent — skip committed-vs-rendered comparison")
    return
  }
  const start = "<!-- armada:start -->"
  const end = "<!-- armada:end -->"
  const rb = rendered.substring(rendered.indexOf(start), rendered.indexOf(end) + end.length)
  const cb = committed.substring(committed.indexOf(start), committed.indexOf(end) + end.length)
  assert.ok(rb && cb, "both rendered and committed AGENTS.md must carry the armada block")
  assert.strictEqual(cb, rb, "committed AGENTS.md armada block must equal renderAgentsMd output")
})

test("artifact consistency: every committed agent frontmatter equals renderAgentFile output (re-render equality)", () => {
  const manifest = loadCommittedManifest()
  const team = buildTeam(manifest)
  const mismatches = []
  for (const agent of team) {
    const rel = `.opencode/agent/${agentNameFor(agent.role)}.md`
    let committed
    try {
      committed = parseAgentFrontmatter(read(rel))
    } catch {
      // Survives CI with gitignored .opencode/ absent — skip
      continue
    }
    const rendered = renderedFrontmatter(agent)
    if (JSON.stringify(committed) !== JSON.stringify(rendered)) {
      mismatches.push({
        role: agent.role,
        file: rel,
        missing: Object.keys(rendered.permission?.edit ?? {}).filter((g) => !(g in (committed.permission?.edit ?? {}))),
        extra: Object.keys(committed.permission?.edit ?? {}).filter((g) => !(g in (rendered.permission?.edit ?? {}))),
      })
    }
  }
  assert.deepEqual(mismatches, [], `agent frontmatter drift vs generator: ${JSON.stringify(mismatches)}`)
})

test("artifact consistency: ledger paths agree across DEFAULT_PLAYBOOK, frontmatter, AGENTS.md (no project.feature -> literal {feature})", () => {
  const manifest = loadCommittedManifest()
  const team = buildTeam(manifest)
  const pb = { ...DEFAULT_PLAYBOOK, ...(manifest.playbook || {}) }
  const defectGlob = pb.defectLedger.file.replace(/\{feature\}/g, "*")
  const advGlob = pb.adversarialLedger.file.replace(/\{feature\}/g, "*")
  const secGlob = pb.securityLedger.file.replace(/\{feature\}/g, "*")
  // dir glob: prefix up to {feature}, with {feature} -> *
  const dirGlob = (() => {
    const file = pb.defectLedger.file
    const idx = file.indexOf("{feature}")
    if (idx === -1) return file.replace(/\/[^/]*$/, "/*") || "/*"
    return file.slice(0, idx).replace(/\/$/, "") + "/*"
  })()

  const byRole = Object.fromEntries(team.map((a) => [a.role, a.permissions?.edit ?? {}]))

  // owners allow their ledger kind
  assert.strictEqual(byRole.orchestrator[defectGlob], "allow", "orchestrator must allow defect ledger glob")
  assert.strictEqual(byRole.orchestrator[advGlob], "allow", "orchestrator must allow adversarial ledger glob")
  assert.strictEqual(byRole.orchestrator[secGlob], "allow", "orchestrator must allow security ledger glob")
  assert.strictEqual(byRole.adversary[advGlob], "allow", "adversary must allow adversarial ledger glob")
  assert.strictEqual(byRole.security[secGlob], "allow", "security must allow security ledger glob")
  // QA owns DEFECTS.md only — never the ledgers-dir glob (which would also
  // grant ADVERSARIAL_REVIEW.md / SECURITY_FINDINGS.md writes).
  assert.strictEqual(byRole.qa[defectGlob], "allow", "qa must allow defect ledger glob")
  assert.strictEqual(byRole.qa[dirGlob], undefined, "qa must NOT own the ledgers dir glob")

  // dev roles deny every ledger kind + the dir
  for (const role of ["backend-dev", "frontend-dev"]) {
    assert.strictEqual(byRole[role][defectGlob], "deny", `${role} must deny defect ledger glob`)
    assert.strictEqual(byRole[role][advGlob], "deny", `${role} must deny adversarial ledger glob`)
    assert.strictEqual(byRole[role][secGlob], "deny", `${role} must deny security ledger glob`)
    assert.strictEqual(byRole[role][dirGlob], "deny", `${role} must deny ledgers dir glob`)
  }

  // AGENTS.md references the resolved ledger paths with the literal {feature}
  // token (no project.feature set on this manifest).
  let agents
  try {
    agents = read("AGENTS.md")
  } catch {
    // CI: AGENTS.md is gitignored; use rendered output as baseline.
    agents = renderAgentsMd(manifest, team)
  }
  assert.match(agents, /armada\/ledgers\/\{feature\}\/DEFECTS\.md/, "AGENTS.md must reference the {feature} defect ledger path")
  assert.match(agents, /armada\/ledgers\/\{feature\}\/ADVERSARIAL_REVIEW\.md/, "AGENTS.md must reference the {feature} adversarial ledger path")
  assert.match(agents, /armada\/ledgers\/\{feature\}\/SECURITY_FINDINGS\.md/, "AGENTS.md must reference the {feature} security ledger path")
})

test("artifact consistency: custom ledger derivation — playbook.defectLedger.file drives frontmatter globs", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-reg-custom-"))
  try {
    const manifest = {
      targetDir: dir,
      project: {
        name: "custom-ledger",
        budget: "balanced",
        browserTesting: false,
        devcontainer: false,
        useAgentBrowser: false,
        stack: {},
      },
      team: ROLES.map((r) => ({ role: r, model: modelFor(r, "balanced"), fallback: null, enabled: true })),
      playbook: {
        defectLedger: { file: "armada/ledgers2/{feature}/DEFECTS.md", owner: "qa", shared: "armada/ledgers2/shared/DEFECTS.md" },
      },
    }
    const team = buildTeam(manifest)
    const byRole = Object.fromEntries(team.map((a) => [a.role, a.permissions?.edit ?? {}]))
    // custom defect file -> glob, custom dir -> glob
  assert.strictEqual(byRole.orchestrator["armada/ledgers2/*/DEFECTS.md"], "allow", "orchestrator must allow custom defect glob")
  assert.strictEqual(byRole.qa["armada/ledgers2/*/DEFECTS.md"], "allow", "qa must allow custom defect glob")
  assert.strictEqual(byRole.qa["armada/ledgers2/*"], undefined, "qa must NOT own the custom ledgers dir glob")
    assert.strictEqual(byRole["backend-dev"]["armada/ledgers2/*/DEFECTS.md"], "deny", "backend-dev must deny custom defect glob")
    assert.strictEqual(byRole["backend-dev"]["armada/ledgers2/*"], "deny", "backend-dev must deny custom ledgers dir glob")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// 5. Safeguard invariants: PR-first in orchestrator prompt; no-clobber;
//    round-trip; default_agent == orchestrator (semantic equality).
// ---------------------------------------------------------------------------

test("safeguard: PR-first hard rule present in orchestrator prompt", () => {
  const prompt = read("agents/orchestrator/prompt.template.md")
  assert.match(prompt, /gh pr create --base master/, "orchestrator prompt must mandate gh pr create --base master")
  assert.match(prompt, /PR-first/i, "orchestrator prompt must name the PR-first finish rule")
})

test("safeguard: default_agent semantic equality — shipname maps back to orchestrator", () => {
  let committed
  try {
    committed = JSON.parse(read("opencode.json"))
  } catch {
    // CI: opencode.json is gitignored; use rendered output as baseline.
    const manifest = loadCommittedManifest()
    committed = renderOpenCodeJson(manifest, buildTeam(manifest))
  }
  assert.strictEqual(committed.default_agent, agentNameFor("orchestrator"), "default_agent must be the orchestrator shipname")
  assert.strictEqual(roleForAgentName(committed.default_agent), "orchestrator", "default_agent must resolve back to the orchestrator role")
})

test("safeguard: manifest round-trips through renderManifestYaml (semantic equality)", () => {
  const m1 = loadCommittedManifest()
  const m2 = parseManifestYaml(renderManifestYaml(m1, buildTeam(m1)))
  // project shape
  assert.strictEqual(m2.project.name, m1.project.name)
  assert.strictEqual(m2.project.budget, m1.project.budget)
  assert.strictEqual(m2.project.yolo, m1.project.yolo)
  assert.deepStrictEqual(m2.project.supervision, m1.project.supervision)
  assert.deepStrictEqual(m2.project.stack, m1.project.stack)
  // team shape
  assert.strictEqual(m2.team.length, m1.team.length)
  const sig = (t) => `${t.role}:${t.model}:${t.fallback}:${t.variant}:${t.enabled}`
  assert.deepStrictEqual(m2.team.map(sig), m1.team.map(sig), "team role/model/fallback/variant/enabled must round-trip")
})

test("safeguard: no-clobber — scaffold preserves user opencode.json, AGENTS.md, REQUIREMENTS.md", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-reg-noclobber-"))
  try {
    writeFileSync(join(dir, "opencode.json"), JSON.stringify({ custom: true, permission: { theme: "dark" } }))
    writeFileSync(join(dir, "AGENTS.md"), "# My rules\n")
    mkdirSync(join(dir, "armada"), { recursive: true })
    writeFileSync(join(dir, "armada/REQUIREMENTS.md"), "# my contract\n")

    const manifest = {
      targetDir: dir,
      project: {
        name: "noclobber-test",
        budget: "balanced",
        browserTesting: false,
        devcontainer: false,
        useAgentBrowser: false,
        stack: {},
        requirementsFile: "armada/REQUIREMENTS.md",
      },
      team: ROLES.map((r) => ({ role: r, model: modelFor(r, "balanced"), fallback: null, enabled: true })),
      playbook: {},
    }
    scaffold(manifest, manifest.project.stack)

    // user opencode.json content preserved (armada merges but keeps user keys)
    const oc = JSON.parse(readFileSync(join(dir, "opencode.json"), "utf8"))
    assert.strictEqual(oc.custom, true, "user opencode.json `custom` key must survive scaffold")
    // user AGENTS.md content preserved + armada block appended
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8")
    assert.match(agents, /^# My rules/, "user AGENTS.md header must survive scaffold")
    assert.match(agents, /<!-- armada:start -->/, "armada block must be appended to AGENTS.md")
    // user REQUIREMENTS.md not clobbered
    const req = readFileSync(join(dir, "armada/REQUIREMENTS.md"), "utf8")
    assert.strictEqual(req, "# my contract\n", "existing REQUIREMENTS.md must not be clobbered")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// 6. Grep suite: no stale Lane A/B or bare `armada drive` as a current command
//    in user-facing strings/docs; no phantom slash-command refs.
// ---------------------------------------------------------------------------

// Files allowed to mention the retired Lane A/B terms (retirement notes,
// audit record, historical-explanation docs, HTML comments).
const LANE_ALLOWLIST = new Set([
  "TODO.md",
  "ARCHITECTURE.md",
  "docs/armada-improves-armada.md",
  "docs/using-armada.md",
  "docs/process/consistency-audit.md",
])

// Live/user-facing surfaces scanned for stale terms. docs/ is scanned
// recursively but allowlisted retirement records are exempt.
function* staleTermSurfaces() {
  yield "README.md"
  yield "AGENTS.md"
  for (const f of walk("src")) yield f
  for (const f of walk("agents")) yield f
  for (const f of walk(".opencode")) yield f
  for (const f of walk("docs")) yield f
}

test("grep suite: no stale Lane A / Lane B in live surfaces (retirement records allowlisted)", () => {
  const hits = []
  for (const rel of staleTermSurfaces()) {
    if (LANE_ALLOWLIST.has(rel)) continue
    let txt
    try {
      txt = read(rel)
    } catch {
      continue
    }
    if (/\bLane A\b/.test(txt) || /\bLane B\b/.test(txt)) hits.push(rel)
  }
  assert.deepEqual(hits, [], `stale Lane A/B terms in live surfaces: ${hits.join(", ")}`)
})

test("grep suite: no bare `armada drive` as a current command (every mention is deprecated/alias)", () => {
  const bare = []
  for (const rel of staleTermSurfaces()) {
    let txt
    try {
      txt = read(rel)
    } catch {
      continue
    }
    if (!txt.includes("armada drive")) continue
    // A current-command presentation has no deprecation context nearby.
    if (!/\b(deprecated|alias)\b/i.test(txt)) bare.push(rel)
  }
  assert.deepEqual(bare, [], `bare 'armada drive' as current command: ${bare.join(", ")}`)
})

// Phantom slash-command refs: every `/armada[-<name>]` in live surfaces must
// resolve to a generated `.opencode/commands/<name>.md`. The Phase 3 audit
// record (consistency-audit.md) legitimately enumerates historical phantoms
// and is exempt.
const PHANTOM_EXEMPT = new Set(["docs/process/consistency-audit.md"])
// A slash-command ref is `/armada` or `/armada-<name>` at a prose boundary
// (preceded by start, whitespace, backtick, `(`, `[`, or `>` — the characters
// that introduce a command in prose). Anything preceded by a word, `/`, or `.`
// is a file path (e.g. `docs/armada-improves-armada.md`, `./armada-...`),
// never a command. The trailing negative lookahead rejects path/file
// continuation.
const SLASH_CMD_RE = /(^|[\s`(\[\]>])\/armada(?:-([a-z]+))?(?![\/.\w])/g

function generatedCommands() {
  return new Set(
    Object.keys(RENDERED_COMMAND_FILES).map((p) => p.replace(/^\.opencode\/commands\//, "").replace(/\.md$/, ""))
  )
}

function* phantomSurfaces() {
  yield "README.md"
  yield "AGENTS.md"
  for (const f of walk("agents")) yield f
  for (const f of walk(".opencode")) yield f
  for (const f of walk("docs")) yield f
}

test("grep suite: no phantom slash-command refs — every /armada-* resolves to a command file", () => {
  const valid = generatedCommands()
  const phantoms = []
  for (const rel of phantomSurfaces()) {
    if (PHANTOM_EXEMPT.has(rel)) continue
    let txt
    try {
      txt = read(rel)
    } catch {
      continue
    }
    SLASH_CMD_RE.lastIndex = 0
    let m
    while ((m = SLASH_CMD_RE.exec(txt))) {
      const name = m[2] || "" // `/armada` -> name "" -> armada.md
      const key = name ? `armada-${name}` : "armada"
      if (!valid.has(key)) phantoms.push(`${rel}: /armada${name ? "-" + name : ""}`)
    }
  }
  assert.deepEqual(phantoms, [], `phantom slash-command refs: ${phantoms.join(", ")}`)
})
