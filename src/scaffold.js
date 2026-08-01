// Scaffold: writes generated config files into a target repo. Read-only
// generation happens in generator.js; this module owns the file I/O.

import { mkdirSync, writeFileSync, existsSync, copyFileSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { buildTeam } from "./generator.js"
import {
  renderSlimJsonc,
  renderOpenCodeJson,
  renderAgentsMd,
  renderRequirementsMd,
  renderManifestYaml,
} from "./generator.js"
import { formatStack } from "./stack-detect.js"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

// Render a prompt template with the manifest's stack context.
export function fillPrompt(templatePath, manifest, stack) {
  const raw = readFileSync(templatePath, "utf8")
  const browserTool = manifest.project.useAgentBrowser
    ? "\nBrowser tool: agent-browser (snapshot/click/fill/screenshot via MCP or CLI)."
    : ""
  const subs = {
    project_name: manifest.project.name,
    stack_summary: formatStack(stack),
    frontend_stack: stack.frontend || "frontend",
    backend_stack: stack.backend || "backend",
    database: stack.database || "the storage layer",
    frontend_src: (stack.srcDirs?.[0] ?? "src"),
    backend_src: (stack.srcDirs?.find((d) => ["backend", "server", "api"].includes(d)) ?? stack.srcDirs?.[0] ?? "src"),
    browser_tool: browserTool,
  }
  return raw.replace(/\{(\w+)\}/g, (m, key) => subs[key] ?? m)
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

// Main entry. target = repo root. Returns list of written files.
export function scaffold(manifest, stack, opts = {}) {
  const target = manifest.targetDir || "."
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

  // 1. .opencode/oh-my-opencode-slim.jsonc
  write(".opencode/oh-my-opencode-slim.jsonc", renderSlimJsonc(manifest, team))

  // 2. Per-agent prompt files (stack-filled) in the prompt override dir.
  for (const a of team) {
    if (!a.enabled) continue
    const src = join(ROOT, PROMPT_SOURCE[a.role])
    const content = fillPrompt(src, manifest, stack)
    write(`.opencode/oh-my-opencode-slim/${a.role}.md`, content)
  }

  // 3. opencode.json — only write if absent (never clobber project config).
  if (!existsSync(out("opencode.json"))) {
    write("opencode.json", JSON.stringify(renderOpenCodeJson(manifest), null, 2) + "\n")
  }

  // 4. AGENTS.md — only write if absent.
  if (!existsSync(out("AGENTS.md"))) {
    write("AGENTS.md", renderAgentsMd(manifest, team))
  }

  // 5. REQUIREMENTS.md — only write if absent.
  if (!existsSync(out("REQUIREMENTS.md"))) {
    write("REQUIREMENTS.md", renderRequirementsMd(manifest))
  }

  // 6. armada.yaml — always write (manifest is the re-runnable source of truth).
  write("armada.yaml", renderManifestYaml(manifest, team))

  // 7. armada command for in-session use.
  write(".opencode/commands/armada.md", renderArmadaCommand())

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
export function uninstall(manifest, opts = {}) {
  const target = manifest?.targetDir || "."
  const removed = []
  const rm = (rel) => {
    const full = join(target, rel)
    if (existsSync(full)) {
      if (!opts.dryRun) rmSync(full, { recursive: true, force: true })
      removed.push(rel)
    }
  }
  rm("armada.yaml")
  rm(".opencode")
  rm(".devcontainer")
  if (opts.all) {
    rm("AGENTS.md")
    rm("opencode.json")
    rm("REQUIREMENTS.md")
  }
  return removed
}

function renderArmadaCommand() {
  return `---
description: opencode-armada — team status, roles, regenerate
---
You are the armada helper. Report: the configured team (from .opencode/oh-my-opencode-slim.jsonc),
the active preset, and how to regenerate (armada init --from-armada armada.yaml). Keep it terse.
`
}
