// Stack detection: inspect a repository to propose a tech stack for the
// generated team prompts. Reads manifest files + existing instruction files.
//
// Detection is root-first but recurses up to two levels into common code
// subdirectories (backend/, frontend/, apps/, packages/, ...) so monorepos
// with split packages are detected. node_modules/ and hidden dirs are skipped.

import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "__pycache__",
  ".venv",
  "venv",
  ".docusaurus",
])

const CODE_DIR_NAMES = new Set([
  "src", "app", "lib", "backend", "frontend", "server", "api", "client", "web",
  "components", "pages", "packages", "services", "core", "shared",
])

// All directories whose manifests we should read: ".", immediate subdirs, and
// their immediate subdirs (two levels, skipping ignored/hidden dirs).
function manifestDirs(rootDir) {
  const dirs = ["."]
  try {
    const sub = readdirSync(rootDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !IGNORED_DIRS.has(e.name))
      .map((e) => e.name)
    for (const d of sub) dirs.push(d)
    for (const d of sub) {
      try {
        const inner = readdirSync(join(rootDir, d), { withFileTypes: true })
          .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !IGNORED_DIRS.has(e.name))
          .map((e) => join(d, e.name))
        for (const id of inner) dirs.push(id)
      } catch {
        /* not a directory */
      }
    }
  } catch {
    /* no root dir */
  }
  return dirs
}

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
  const exists = (p) => existsSync(join(rootDir, p))

  // Aggregate manifests across the repo (root + subdirs up to two levels).
  const packageJsons = []
  const pythonDocs = []
  const manifestText = []
  const codeDirs = []
  for (const d of manifestDirs(rootDir)) {
    const base = d === "." ? "" : `${d}/`

    const pkg = read(`${base}package.json`)
    if (pkg) {
      codeDirs.push(d)
      manifestText.push(pkg)
      try {
        const json = JSON.parse(pkg)
        packageJsons.push({ ...json.dependencies, ...json.devDependencies } || {})
      } catch {
        /* invalid json, ignore */
      }
    }

    const pyproject = read(`${base}pyproject.toml`)
    const requirements = read(`${base}requirements.txt`)
    if (pyproject || requirements) {
      codeDirs.push(d)
      const blob = `${pyproject ?? ""}\n${requirements ?? ""}`
      pythonDocs.push(blob)
      manifestText.push(blob)
    }
  }

  // JS/TS ecosystem across all package.json files.
  if (packageJsons.length) {
    const all = new Set(packageJsons.flatMap((deps) => Object.keys(deps)))
    if (all.has("next") || all.has("remix") || all.has("gatsby"))
      stack.frontend = "nextjs"
    else if (all.has("react")) stack.frontend = "react"
    else if (all.has("vue")) stack.frontend = "vue"
    if (all.has("fastify")) stack.backend = "node-fastify"
    else if (all.has("express") || all.has("hapi")) stack.backend = "node-express"
    if (all.has("@nestjs/core") || all.has("nest")) stack.backend = "node-nestjs"
    stack.languages.push("typescript")
    stack.srcDirs.push(...["src", "app", "lib"].filter((d) => exists(d)))
  }

  // Python ecosystem across all pyproject/requirements files.
  if (pythonDocs.length) {
    stack.languages.push("python")
    const text = pythonDocs.join("\n").toLowerCase()
    if (text.includes("fastapi")) stack.backend = "python-fastapi"
    else if (text.includes("django")) stack.backend = "python-django"
    else if (text.includes("flask")) stack.backend = "python-flask"
    if (text.includes("sqlalchemy")) stack.database = "sqlalchemy"
    for (const d of ["backend", "src", "app"]) {
      if (exists(d)) stack.srcDirs.push(d)
    }
  }

  // Code directories that held a manifest (monorepo backend/, frontend/, ...).
  for (const d of codeDirs) {
    if (d === ".") continue
    if (CODE_DIR_NAMES.has(d)) stack.srcDirs.push(d)
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
  const allText = manifestText.join("\n").toLowerCase()
  for (const [name, pats] of testHints) {
    if (pats.some((p) => allText.includes(p))) {
      stack.testing = name
      break
    }
  }

  // existing instruction files to inherit preferences from
  for (const f of ["AGENTS.md", "CLAUDE.md", "DEVELOPER.md", "README.md"]) {
    if (exists(f)) stack.instructions.push(f)
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
  if (stack.languages?.length) parts.push(`lang: ${stack.languages.join(",")}`)
  if (!parts.length) parts.push("none detected")
  return parts.join(" | ")
}
