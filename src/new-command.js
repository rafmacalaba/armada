import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, cpSync, rmSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { homedir } from "node:os"
import { execSync, spawnSync } from "node:child_process"
import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { tmpdir } from "node:os"

import { scaffold } from "./scaffold.js"
import { detectStack } from "./stack-detect.js"
import { ROLES, modelFor } from "./model-catalog.js"
import { pickCategory } from "./questionnaire.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = resolve(__dirname, "..")
const CATALOG_PATH = resolve(PACKAGE_ROOT, "starter", "_catalog.json")

const VARIABLE_RE = /\{\{\s*cookiecutter\.(\w+)\s*\}\}/g

export function detectExperience() {
  return experienceDetectForDir(homedir())
}

export function experienceDetectForDir(dir) {
  let score = 0
  let local = 0
  try { if (existsSync(join(dir, ".gitconfig"))) { score++; local++ } } catch {}
  try { if (existsSync(join(dir, ".ssh", "id_rsa")) || existsSync(join(dir, ".ssh", "id_ed25519"))) { score++; local++ } } catch {}
  try { execSync("node --version", { stdio: "ignore" }); score++ } catch {}
  try { execSync("python3 --version", { stdio: "ignore" }); score++ } catch {}
  try { execSync("git --version", { stdio: "ignore" }); score++ } catch {}
  return score >= 2 && local > 0 ? "experienced" : "beginner"
}

/**
 * Discover all unique {{ cookiecutter.NAME }} variables in a template tree.
 * @param {string} templateDir
 * @returns {string[]}
 */
export function discoverVariables(templateDir) {
  const names = new Set()
  _scanDir(templateDir)
  return [...names].sort()

  function _scanDir(dir) {
    for (const entry of readdirSync(dir)) {
      if (entry === ".git") continue
      const p = join(dir, entry)
      try {
        const st = statSync(p)
        if (st.isDirectory()) {
          _scanDir(p)
        } else if (st.isFile()) {
          // Try to read as text; skip if binary
          let content
          try {
            content = readFileSync(p, "utf8")
          } catch {
            continue
          }
          for (const m of content.matchAll(VARIABLE_RE)) {
            names.add(m[1])
          }
        }
      } catch {
        // Skip files we can't access
      }
    }
  }
}

/**
 * Copy template from a local path, substituting {{ cookiecutter.NAME }} variables.
 * @param {string} srcDir
 * @param {string} destDir
 * @param {Record<string, string>} vars
 */
export function renderCookiecutterTemplate(srcDir, destDir, vars) {
  mkdirSync(destDir, { recursive: true })
  for (const entry of readdirSync(srcDir)) {
    if (entry === ".git") continue
    const srcPath = join(srcDir, entry)
    const destPath = join(destDir, entry)
    let st
    try {
      st = statSync(srcPath)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      renderCookiecutterTemplate(srcPath, destPath, vars)
    } else {
      let content
      try {
        content = readFileSync(srcPath, "utf8")
      } catch {
        // Binary file — copy as-is
        cpSync(srcPath, destPath)
        continue
      }
      content = content.replace(VARIABLE_RE, (m, key) => vars[key] !== undefined ? vars[key] : m)
      writeFileSync(destPath, content, "utf8")
    }
  }
}

/**
 * Fetch a template from a URL (git clone) into a temp directory.
 * @param {string} url
 * @returns {string} path to the cloned template
 */
function cloneTemplate(url) {
  const tmp = join(tmpdir(), "armada-cc-" + Date.now())
  const result = spawnSync("git", ["clone", "--depth", "1", url, tmp], {
    stdio: "pipe",
    encoding: "utf8",
  })
  if (result.status !== 0) {
    throw new Error(`failed to clone template '${url}': ${result.stderr?.trim() || "unknown error"}`)
  }
  // Remove .git dir so it doesn't get copied to output
  rmSync(join(tmp, ".git"), { recursive: true, force: true })
  return tmp
}

/**
 * Resolve variables for a template.
 * Precedence: --config JSON > COOKIECUTTER_ env vars > prompt (TTY) > empty string (non-TTY)
 * @param {string[]} discovered names of variables found in template
 * @param {{ config?: string, yes?: boolean }} opts
 * @returns {Promise<[Record<string, string>, Record<string, string>]>} [resolved, applied]
 */
async function resolveVariables(discovered, opts) {
  const vars = {}
  const applied = {}

  // 1. --config file
  if (opts.config) {
    const configPath = resolve(opts.config)
    if (!existsSync(configPath)) {
      console.error(`config file not found: ${opts.config}`)
      process.exitCode = 1
      return null
    }
    let raw
    try {
      raw = JSON.parse(readFileSync(configPath, "utf8"))
    } catch (e) {
      console.error(`invalid config JSON: ${e.message}`)
      process.exitCode = 1
      return null
    }
    for (const [k, v] of Object.entries(raw)) {
      vars[k] = String(v)
      applied[k] = "config"
    }
  }

  // 2. env vars (only for vars not already resolved by config)
  for (const name of discovered) {
    if (name in vars) continue
    const envKey = "COOKIECUTTER_" + name.toUpperCase()
    if (envKey in process.env) {
      vars[name] = process.env[envKey]
      applied[name] = "env"
    }
  }

  const unresolved = discovered.filter((n) => !(n in vars))

  // 3. prompt (TTY) or blank (--yes / non-TTY)
  if (unresolved.length > 0) {
    if (opts.yes || !process.stdin.isTTY) {
      for (const name of unresolved) {
        vars[name] = ""
        applied[name] = "default"
      }
    } else {
      const rl = createInterface({ input: stdin, output: stdout })
      for (const name of unresolved) {
        const val = await rl.question(`${name}: `)
        vars[name] = val || ""
        applied[name] = "prompt"
      }
      rl.close()
    }
  }

  return [vars, applied]
}

function defaultManifestFor(name) {
  return {
    project: {
      name,
      budget: "balanced",
      browserTesting: false,
      devcontainer: false,
      useAgentBrowser: false,
      headless: false,
      requirementsFile: "armada/REQUIREMENTS.md",
      stack: {},
    },
    team: ROLES.map((role) => ({
      role,
      model: modelFor(role, "balanced"),
      fallback: null,
      enabled: true,
    })),
    targetDir: ".",
  }
}

export async function runNew(opts = {}) {
  const cwd = opts.cwd || process.cwd()
  const name = opts.name

  // Reset exit code for programmatic use
  process.exitCode = 0

  if (!name) {
    console.error("Usage: armada new <project-name> [--blank] [--template <url|path>] [--config <file.json>] [--yes]")
    process.exitCode = 1
    return 1
  }

  // Validate name for path safety
  if (name.includes("\0")) {
    console.error(`invalid project name "${name}": must not contain null bytes`)
    process.exitCode = 1
    return 1
  }
  if (name.includes("/") || name.includes("\\")) {
    console.error(`invalid project name "${name}": must not contain path separators`)
    process.exitCode = 1
    return 1
  }
  if (name.includes("..")) {
    console.error(`invalid project name "${name}": must not contain ".."`)
    process.exitCode = 1
    return 1
  }
  if (name.startsWith("/")) {
    console.error(`invalid project name "${name}": must not be an absolute path`)
    process.exitCode = 1
    return 1
  }
  if (name.startsWith("-")) {
    console.error(`invalid project name "${name}": project names cannot start with '-'`)
    process.exitCode = 1
    return 1
  }

  const targetDir = join(cwd, name)
  if (existsSync(targetDir)) {
    console.error(`Directory already exists: ${targetDir}`)
    process.exitCode = 1
    return 1
  }

  // Determine template source
  let templateDir
  let tempCloned = false

  if (opts.template) {
    // External template: path or URL
    try {
      if (opts.template.startsWith("http://") || opts.template.startsWith("https://") || opts.template.startsWith("git@") || opts.template.startsWith("ssh://")) {
        templateDir = cloneTemplate(opts.template)
        tempCloned = true
      } else {
        templateDir = resolve(opts.template)
      }
    } catch (err) {
      console.error(String(err?.message ?? err))
      process.exitCode = 1
      return 1
    }

    if (!existsSync(templateDir)) {
      console.error(`template not found: ${opts.template}`)
      process.exitCode = 1
      return 1
    }
  } else {
    // Internal template: pick category, resolve from catalog
    let category

    if (opts.blank) {
      category = "blank"
    } else {
      const nonInteractive = opts.yes || !process.stdin.isTTY
      if (nonInteractive) {
        category = "blank"
      } else {
        // Load catalog and show interactive picker
        let catalog
        try {
          catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"))
        } catch {
          console.error("cannot load starter catalog")
          process.exitCode = 1
          return 1
        }
        category = await pickCategory(catalog.categories, opts)
        if (category === null) {
          console.error("no category selected")
          process.exitCode = 1
          return 1
        }
      }
    }

    // Resolve template path from catalog entry
    let catalogData
    try {
      catalogData = JSON.parse(readFileSync(CATALOG_PATH, "utf8"))
    } catch {
      console.error("cannot load starter catalog")
      process.exitCode = 1
      return 1
    }
    const entry = catalogData.categories.find((c) => c.id === category)
    if (!entry) {
      console.error(`unknown category: ${category}`)
      process.exitCode = 1
      return 1
    }
    templateDir = resolve(PACKAGE_ROOT, entry.dir)

    if (!existsSync(templateDir)) {
      console.error(`template not found for category "${category}": ${entry.dir}`)
      process.exitCode = 1
      return 1
    }
  }

  // Discover variables in the template
  const discovered = discoverVariables(templateDir)

  // Resolve variables
  const resolved = await resolveVariables(discovered, opts)
  if (!resolved) return 1

  const [vars] = resolved

  // Render template to target
  renderCookiecutterTemplate(templateDir, targetDir, vars)

  // Clean up temp clone
  if (tempCloned) {
    try { rmSync(templateDir, { recursive: true, force: true }) } catch {}
  }

  // Scaffold armada team into the new project
  const manifest = defaultManifestFor(name)
  const stack = detectStack(targetDir)
  manifest.targetDir = targetDir
  const { written: files } = scaffold(manifest, stack)

  console.log(`\nCreated ${name}/`)
  if (discovered.length > 0) {
    console.log(`Template variables (${discovered.length}): ${discovered.join(", ")}`)
  }
  for (const f of files.slice(0, 12)) console.log(`  + ${f}`)
  if (files.length > 12) console.log(`  ... and ${files.length - 12} more armada files`)
  console.log("\nNext:")
  console.log(`  cd ${name}`)
  console.log("  opencode")
  console.log("  armada status")

  return 0
}
