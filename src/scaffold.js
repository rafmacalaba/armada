// Scaffold: writes generated config files into a target repo. Read-only
// generation happens in generator.js; this module owns the file I/O.

import { mkdirSync, writeFileSync, existsSync, copyFileSync, readFileSync, rmSync, rmdirSync, readdirSync, lstatSync } from "node:fs"
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

// Pure substitution. The I/O wrapper is fillPrompt.
export function fillTemplate(text, manifest, stack) {
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
  }
  return text.replace(/\{(\w+)\}/g, (m, key) => subs[key] ?? m)
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
  const agentsContent = renderAgentsMd(manifest, team)
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
  for (const w of warnings) console.warn(w)
  return removed
}
