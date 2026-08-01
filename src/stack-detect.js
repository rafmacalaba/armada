// Stack detection: inspect a repository to propose a tech stack for the
// generated team prompts. Reads manifest files + existing instruction files.

import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

export function detectStack(rootDir = ".") {
  const stack = {
    frontend: null,
    backend: null,
    database: null,
    testing: null,
    srcDirs: [],
    languages: [],
    instructions: [],
  }

  const read = (p) => {
    const full = join(rootDir, p)
    if (!existsSync(full)) return null
    try {
      return readFileSync(full, "utf8")
    } catch {
      return null
    }
  }

  // package.json -> JS/TS ecosystem
  const pkg = read("package.json")
  if (pkg) {
    try {
      const json = JSON.parse(pkg)
      const deps = { ...json.dependencies, ...json.devDependencies } || {}
      const all = Object.keys(deps)
      if (all.some((d) => ["next", "next.config.js", "remix", "gatsby"].includes(d)))
        stack.frontend = "nextjs"
      else if (all.includes("react")) stack.frontend = "react"
      else if (all.includes("vue")) stack.frontend = "vue"
      if (all.some((d) => ["express", "fastify", "hapi"].includes(d)))
        stack.backend = "node-express"
      if (all.includes("fastify")) stack.backend = "node-fastify"
      if (all.some((d) => ["@nestjs/core", "nest"].includes(d)))
        stack.backend = "node-nestjs"
      stack.languages.push("typescript")
      stack.srcDirs.push(...["src", "app", "lib"].filter((d) => existsSync(join(rootDir, d))))
    } catch {
      /* invalid json, ignore */
    }
  }

  // pyproject.toml / requirements.txt -> Python
  const pyproject = read("pyproject.toml")
  const requirements = read("requirements.txt")
  if (pyproject || requirements) {
    stack.languages.push("python")
    const text = `${pyproject ?? ""}\n${requirements ?? ""}`.toLowerCase()
    if (text.includes("fastapi")) stack.backend = "python-fastapi"
    else if (text.includes("django")) stack.backend = "python-django"
    else if (text.includes("flask")) stack.backend = "python-flask"
    if (text.includes("sqlalchemy")) stack.database = "sqlalchemy"
    for (const d of ["backend", "src", "app"]) {
      if (existsSync(join(rootDir, d))) stack.srcDirs.push(d)
    }
  }

  // Dockerfile hints
  if (read("Dockerfile") || read("docker-compose.yml")) {
    // database inference
    for (const [db, patterns] of [
      ["postgres", ["postgres", "postgresql"]],
      ["mysql", ["mysql"]],
      ["sqlite", ["sqlite"]],
      ["mongo", ["mongo", "mongodb"]],
    ]) {
      const hay = `${read("docker-compose.yml") ?? ""}${read(".env") ?? ""}`.toLowerCase()
      if (patterns.some((p) => hay.includes(p))) stack.database = db
    }
  }

  // test framework hints
  const testHints = [
    ["playwright", ["playwright"]],
    ["vitest", ["vitest"]],
    ["jest", ["jest"]],
    ["pytest", ["pytest"]],
    ["cypress", ["cypress"]],
  ]
  const manifestText = `${pkg ?? ""}\n${pyproject ?? ""}\n${requirements ?? ""}`.toLowerCase()
  for (const [name, pats] of testHints) {
    if (pats.some((p) => manifestText.includes(p))) {
      stack.testing = name
      break
    }
  }

  // existing instruction files to inherit preferences from
  for (const f of ["AGENTS.md", "CLAUDE.md", "DEVELOPER.md", "README.md"]) {
    if (existsSync(join(rootDir, f))) stack.instructions.push(f)
  }

  stack.srcDirs = [...new Set(stack.srcDirs)]
  stack.languages = [...new Set(stack.languages)]
  return stack
}

export function formatStack(stack) {
  const parts = []
  if (stack.frontend) parts.push(`frontend: ${stack.frontend}`)
  if (stack.backend) parts.push(`backend: ${stack.backend}`)
  if (stack.database) parts.push(`db: ${stack.database}`)
  if (stack.testing) parts.push(`testing: ${stack.testing}`)
  if (stack.languages.length) parts.push(`lang: ${stack.languages.join(",")}`)
  if (!parts.length) parts.push("none detected")
  return parts.join(" | ")
}
