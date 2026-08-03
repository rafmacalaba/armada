// Scaffold: writes generated config files into a target repo. Read-only
// generation happens in generator.js; this module owns the file I/O.

import { mkdirSync, writeFileSync, existsSync, copyFileSync, readFileSync, rmSync, rmdirSync, readdirSync, lstatSync } from "node:fs"
import { createHash } from "node:crypto"
import { join, resolve } from "node:path"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { buildTeam, renderAgentFile } from "./generator.js"
import {
  renderOpenCodeJson,
  renderAgentsMd,
  renderRequirementsMd,
  renderManifestYaml,
  renderArmadaCommand,
  renderArmadaStatusCommand,
  renderArmadaScoutCommand,
  renderArmadaResumeCommand,
  renderArmadaSupervisionPlugin,
} from "./generator.js"
import { ROLES } from "./model-catalog.js"
import { formatStack } from "./stack-detect.js"
import { validateRequirementsFile } from "./manifest.js"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

export const GITIGNORE_START = "# armada:start"
export const GITIGNORE_END = "# armada:end"

function buildGitignoreBlock() {
  return [
    GITIGNORE_START,
    "/armada/",
    "/.opencode/",
    "/opencode.json",
    GITIGNORE_END,
  ].join("\n")
}

// Append the managed block to .gitignore if not already present.
// Returns true if the block was added (or would have been added).
function appendGitignoreBlock(target, dryRun) {
  const gitignorePath = join(target, ".gitignore")
  let existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : ""

  if (existing.includes(GITIGNORE_START)) return false

  const block = buildGitignoreBlock()
  const newContent = existing ? existing + "\n" + block + "\n" : block + "\n"

  if (!dryRun) {
    writeFileSync(gitignorePath, newContent, "utf8")
  }
  return true
}

// Remove the managed block from .gitignore, restoring user content.
// If the block was the only content, the file is removed.
// Returns true if the block was found and removed (or would have been).
function removeGitignoreBlock(target, dryRun) {
  const gitignorePath = join(target, ".gitignore")
  if (!existsSync(gitignorePath)) return false

  const content = readFileSync(gitignorePath, "utf8")
  const startIdx = content.indexOf(GITIGNORE_START)
  if (startIdx === -1) return false

  const endIdx = content.indexOf(GITIGNORE_END, startIdx)
  if (endIdx === -1) return false

  const endMarkerEnd = endIdx + GITIGNORE_END.length

  // Extract before and after the block, trimming whitespace around the join
  let before = content.substring(0, startIdx)
  let after = content.substring(endMarkerEnd)

  // Clean up trailing newlines from before-marker and leading newlines from after-end
  const beforeTrimmed = before.replace(/\n+$/, "")
  const afterTrimmed = after.replace(/^\n+/, "")

  let restored
  if (beforeTrimmed && afterTrimmed) {
    restored = beforeTrimmed + "\n" + afterTrimmed
    if (!restored.endsWith("\n")) restored += "\n"
  } else if (beforeTrimmed) {
    restored = beforeTrimmed
    if (!restored.endsWith("\n")) restored += "\n"
  } else if (afterTrimmed) {
    restored = afterTrimmed
    if (!restored.endsWith("\n")) restored += "\n"
  } else {
    restored = ""
  }

  if (!dryRun) {
    if (restored.trim().length === 0) {
      rmSync(gitignorePath, { force: true })
    } else {
      writeFileSync(gitignorePath, restored, "utf8")
    }
  }
  return true
}

// Pure substitution. The I/O wrapper is fillPrompt.
export function fillTemplate(text, manifest, stack) {
  const featureName = resolveFeatureName(manifest)
  const ledgersDir = `armada/ledgers/${featureName}/`
  const e2eDir = `armada/e2e/${featureName}/`
  const screenshotsDir = `armada/screenshots/${featureName}/`
  const browserTool = manifest.project.useAgentBrowser
    ? "\nBrowser tool: agent-browser (snapshot/click/fill/screenshot via MCP or CLI)."
    : ""
  const subs = {
    project_name: manifest.project.name,
    requirements_file: manifest.project.requirementsFile ?? "armada/REQUIREMENTS.md",
    stack_summary: formatStack(stack),
    frontend_stack: stack.frontend || "frontend",
    backend_stack: stack.backend || "backend",
    database: stack.database || "the storage layer",
    frontend_src: (stack.srcDirs?.[0] ?? "src"),
    backend_src: (stack.srcDirs?.find((d) => ["backend", "server", "api"].includes(d)) ?? stack.srcDirs?.[0] ?? "src"),
    browser_tool: browserTool,
    instructions: stack.instructions?.length
      ? "Also read these existing instruction files before planning: " + stack.instructions.join(", ") + "."
      : "",
    feature: featureName,
    ledgers_dir: ledgersDir,
    e2e_dir: e2eDir,
    screenshots_dir: screenshotsDir,
  }
  return text.replace(/\{(\w+)\}/g, (m, key) => subs[key] ?? m)
}

// Transliteration table for Latin characters not handled by NFD normalization.
const LATIN_MAP = {
  "ß": "ss", "æ": "ae", "Æ": "ae",
  "ø": "o", "Ø": "o",
  "ł": "l", "Ł": "l",
  "đ": "d", "Đ": "d",
  "þ": "th", "Þ": "th",
  "ð": "d", "Ð": "d",
}
const LATIN_RE = /[ßæÆøØłŁđĐþÞðÐ]/g

// Slugify a project name into a feature directory name.
// Max 100 chars for the slug portion. Non-ASCII chars trigger
// transliteration + hash suffix to avoid collisions.
export function slugify(name) {
  const MAX_SLUG = 100
  if (!name || typeof name !== "string") return "default"

  const lower = name.toLowerCase()
  const originalHasNonAscii = /[^\x00-\x7F]/.test(lower)

  // NFD decompose + strip combining diacritics (à→a, é→e, ñ→n, ü→u, ç→c, etc.)
  const deaccented = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

  // Transliterate Latin characters not decomposed by NFD
  const transliterated = deaccented.replace(LATIN_RE, (c) => LATIN_MAP[c] || c)

  const stillHasNonAscii = /[^\x00-\x7F]/.test(transliterated)

  let base
  if (stillHasNonAscii) {
    // Remove remaining non-ASCII, append hash for uniqueness
    const asciiOnly = transliterated.replace(/[^\x00-\x7F]+/g, "-")
    const hash = createHash("sha256").update(name).digest("hex").substring(0, 4)
    base = asciiOnly.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    base = base ? base + "-x" + hash : "unicode-x" + hash
  } else if (originalHasNonAscii) {
    // Fully transliterated; still append hash to avoid collision (e.g. Cafe vs Cafe)
    const hash = createHash("sha256").update(name).digest("hex").substring(0, 4)
    base = transliterated.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    base = base ? base + "-x" + hash : "default"
  } else {
    base = transliterated.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  }

  // Truncate to MAX_SLUG at word boundary if possible
  if (base.length > MAX_SLUG) {
    base = base.substring(0, MAX_SLUG)
    const lastDash = base.lastIndexOf("-")
    if (lastDash > MAX_SLUG - 20) {
      base = base.substring(0, lastDash)
    }
  }

  return base || "default"
}

// Resolve feature name for per-feature directory paths.
// Precedence: manifest.project.feature > slugified project.name > "default"
export function resolveFeatureName(manifest) {
  if (manifest.project.feature && typeof manifest.project.feature === "string" && manifest.project.feature.trim()) {
    return manifest.project.feature.trim()
  }
  return slugify(manifest.project.name)
}

// Render a prompt template with the manifest's stack context.
export function fillPrompt(templatePath, manifest, stack) {
  return fillTemplate(readFileSync(templatePath, "utf8"), manifest, stack)
}

export const PROMPT_SOURCE = {
  orchestrator: "agents/orchestrator/prompt.template.md",
  "backend-dev": "agents/backend-dev/prompt.template.md",
  "frontend-dev": "agents/frontend-dev/prompt.template.md",
  qa: "agents/qa/prompt.template.md",
  adversary: "agents/adversary/prompt.template.md",
  security: "agents/security/prompt.template.md",
  docs: "agents/docs/prompt.template.md",
  architect: "agents/architect/prompt.template.md",
}

export function validateTargetDir(target) {
  const full = resolve(target)
  function symlink(p) {
    try {
      return lstatSync(p).isSymbolicLink()
    } catch (e) {
      if (e.code === "ENOENT") return false
      throw e
    }
  }
  if (symlink(full)) throw new Error(`target directory is a symlink: ${target}`)
  if (symlink(join(full, ".opencode"))) throw new Error(`.opencode/ is a symlink under target: ${target}`)
}

// Main entry. target = repo root. Returns list of written files.
export function scaffold(manifest, stack, opts = {}) {
  const target = manifest.targetDir || "."
  if (!opts.dryRun) validateTargetDir(target)
  const team = buildTeam(manifest)
  const files = []

  const out = (rel) => join(target, rel)
  const ensure = (rel) => mkdirSync(out(rel), { recursive: true })
  const write = (rel, content) => {
    if (!opts.dryRun) {
      ensure(dirname(rel))
      writeFileSync(out(rel), content, "utf8")
    }
    files.push(rel)
  }

  // 1. Native agent files: one .opencode/agent/<role>.md per enabled role.
  //    Frontmatter carries mode/model/permission; body is the filled prompt.
  for (const a of team) {
    if (!a.enabled) continue
    let promptText
    if (a.prompt) {
      const customPath = join(target, a.prompt)
      if (!existsSync(customPath)) {
        throw new Error(`custom prompt template not found: ${a.prompt} (for role ${a.role})`)
      }
      if (lstatSync(customPath).isDirectory()) {
        throw new Error(`custom prompt template is a directory, not a file: ${a.prompt} (for role ${a.role})`)
      }
      promptText = fillPrompt(customPath, manifest, stack)
    } else {
      const src = join(ROOT, PROMPT_SOURCE[a.role])
      promptText = fillPrompt(src, manifest, stack)
    }
    if (a.instructions) {
      promptText = promptText + "\n\n" + a.instructions
    }
    const content = renderAgentFile(a, promptText)
    write(`.opencode/agent/${a.role}.md`, content)
  }

  // 1b. Prune stale omo-slim artifacts from the old layout (armada-owned).
  const staleJsonc = out(".opencode/oh-my-opencode-slim.jsonc")
  if (!opts.dryRun && existsSync(staleJsonc)) rmSync(staleJsonc, { force: true })
  const staleDir = join(target, ".opencode/oh-my-opencode-slim")
  if (!opts.dryRun && existsSync(staleDir)) rmSync(staleDir, { recursive: true, force: true })

  // 3. opencode.json — only write if absent (never clobber project config).
  if (!existsSync(out("opencode.json"))) {
    write("opencode.json", JSON.stringify(renderOpenCodeJson(manifest, team), null, 2) + "\n")
  }

  // 4. AGENTS.md — marker-based merge. An existing armada section (between
  // `<!-- armada:start -->` and `<!-- armada:end -->`) is replaced; otherwise
  // the armada section is appended; if absent the file is created fresh.
  const agentsPath = out("AGENTS.md")
  const featureName = resolveFeatureName(manifest)
  const agentsContent = renderAgentsMd(manifest, team, featureName)
  const ARMADA_START = "<!-- armada:start -->"
  const ARMADA_END = "<!-- armada:end -->"

  if (existsSync(agentsPath)) {
    const existing = readFileSync(agentsPath, "utf8")
    if (existing.includes(ARMADA_START)) {
      // Replace existing armada section
      const before = existing.substring(0, existing.indexOf(ARMADA_START))
      const afterIdx = existing.indexOf(ARMADA_END)
      const after = afterIdx !== -1 ? existing.substring(afterIdx + ARMADA_END.length) : ""
      const merged = before + agentsContent + after
      if (!opts.dryRun) writeFileSync(agentsPath, merged, "utf8")
    } else {
      // Append armada section at the end
      const merged = existing + "\n" + agentsContent
      if (!opts.dryRun) writeFileSync(agentsPath, merged, "utf8")
    }
  } else {
    write("AGENTS.md", agentsContent)
  }

  // 5. Requirements file (default armada/REQUIREMENTS.md) — only write if absent.
  const requirementsFile = manifest.project.requirementsFile ?? "armada/REQUIREMENTS.md"
  validateRequirementsFile(requirementsFile, target)
  if (!existsSync(out(requirementsFile))) {
    write(requirementsFile, renderRequirementsMd(manifest))
  }

  // 6. armada.yaml — always write (manifest is the re-runnable source of truth).
  write("armada/armada.yaml", renderManifestYaml(manifest, team))

  // 7. armada commands for in-session use.
  write(".opencode/commands/armada.md", renderArmadaCommand())
  write(".opencode/commands/armada-status.md", renderArmadaStatusCommand())
  write(".opencode/commands/armada-scout.md", renderArmadaScoutCommand())
  write(".opencode/commands/armada-resume.md", renderArmadaResumeCommand())

  // 7b. Opt-in thin supervision plugin.
  if (manifest.project.supervision?.plugin) {
    write(".opencode/plugins/armada-supervision.js", renderArmadaSupervisionPlugin(team))
  }

  // 8. Optional devcontainer.
  if (manifest.project.devcontainer) {
    if (!opts.dryRun) ensure(".devcontainer")
    if (!opts.dryRun) {
      copyFileSync(join(ROOT, "template/.devcontainer/devcontainer.json"), out(".devcontainer/devcontainer.json"))
      copyFileSync(join(ROOT, "template/.devcontainer/setup.sh"), out(".devcontainer/setup.sh"))
    }
    files.push(".devcontainer/devcontainer.json", ".devcontainer/setup.sh")
  }

  // 9. Managed .gitignore block (append-only, idempotent, marker-based).
  if (opts.gitignore !== false) {
    appendGitignoreBlock(target, opts.dryRun)
    if (!files.includes(".gitignore")) files.push(".gitignore")
  }

  return files
}

// Remove generated armada files. Never removes user files without opts.all.
// Only armada-owned .opencode/ entries are removed; user files under .opencode/
// (opencode.json, agent/*.md, skills/, plugins/) are kept. If .opencode/ still
// holds non-armada files after cleanup the dir is left in place and a warning
// is logged via console.warn. Returns the list of removed relative paths.
export function uninstall(manifest, opts = {}) {
  const target = manifest?.targetDir || "."
  const removed = []
  const warnings = []

  const removeFile = (rel) => {
    const full = join(target, rel)
    if (!existsSync(full)) return
    if (!opts.dryRun) rmSync(full, { force: true })
    removed.push(rel)
  }
  // Remove an empty dir; no-op (and not listed) if it still has contents.
  const removeEmptyDir = (rel) => {
    const full = join(target, rel)
    if (!existsSync(full)) return
    if (!opts.dryRun) {
      try {
        rmdirSync(full)
      } catch {
        return
      }
    }
    removed.push(rel)
  }

  removeFile("armada/armada.yaml")
  const requirementsFile = manifest?.project?.requirementsFile ?? "armada/REQUIREMENTS.md"
  removeFile(requirementsFile)
  removeEmptyDir("armada")
  for (const cmd of ["armada", "armada-status", "armada-scout", "armada-resume"]) {
    removeFile(`.opencode/commands/${cmd}.md`)
  }
  // Opt-in supervision plugin (armada-owned, only removed when present).
  removeFile(".opencode/plugins/armada-supervision.js")
  removeEmptyDir(".opencode/plugins")
  // Remove armada's native agent files by exact role name; keep any user agent files.
  const agentDir = join(target, ".opencode/agent")
  if (existsSync(agentDir)) {
    for (const role of ROLES) {
      removeFile(`.opencode/agent/${role}.md`)
    }
  }
  removeEmptyDir(".opencode/agent")
  // Prune stale omo-slim artifacts (old layout) if present.
  removeFile(".opencode/oh-my-opencode-slim.jsonc")
  const stalePromptDir = join(target, ".opencode/oh-my-opencode-slim")
  if (existsSync(stalePromptDir)) {
    for (const f of readdirSync(stalePromptDir)) {
      if (f.endsWith(".md")) removeFile(`.opencode/oh-my-opencode-slim/${f}`)
    }
    removeEmptyDir(".opencode/oh-my-opencode-slim")
  }
  removeEmptyDir(".opencode/commands")
  const opencodeDir = join(target, ".opencode")
  if (existsSync(opencodeDir)) {
    if (opts.dryRun) {
      removed.push(".opencode")
    } else {
      try {
        rmdirSync(opencodeDir)
        removed.push(".opencode")
      } catch {
        warnings.push(
          "kept .opencode/ — still contains non-armada files (uninstall only removes armada-owned files)")
      }
    }
  }
  if (manifest?.project?.devcontainer && existsSync(join(target, ".devcontainer"))) {
    if (!opts.dryRun) rmSync(join(target, ".devcontainer"), { recursive: true, force: true })
    removed.push(".devcontainer")
  }
  if (opts.all) {
    removeFile("AGENTS.md")
    removeFile("opencode.json")
    removeFile("REQUIREMENTS.md")
  }
  // Remove managed .gitignore block, restoring user content
  if (removeGitignoreBlock(target, opts.dryRun)) {
    removed.push(".gitignore")
  }
  for (const w of warnings) console.warn(w)
  return removed
}
