import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { execSync } from "node:child_process"
import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"

import { CATEGORIES } from "./recommendations.js"
import { scaffold } from "./scaffold.js"
import { detectStack } from "./stack-detect.js"
import { confirm } from "./questionnaire.js"
import { ROLES, modelFor } from "./model-catalog.js"

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

export function renderTemplate(srcDir, destDir, subs) {
  mkdirSync(destDir, { recursive: true })
  for (const entry of readdirSync(srcDir)) {
    const srcPath = join(srcDir, entry)
    const destPath = join(destDir, entry)
    if (entry === "starter.yaml") continue
    if (statSync(srcPath).isDirectory()) {
      renderTemplate(srcPath, destPath, subs)
    } else {
      let content = readFileSync(srcPath, "utf8")
      content = content.replace(/\{(\w+)\}/g, (m, key) => subs[key] !== undefined ? subs[key] : m)
      writeFileSync(destPath, content, "utf8")
    }
  }
}

async function pickCategory() {
  const keys = Object.keys(CATEGORIES)
  console.log("\nProject category:")
  keys.forEach((k, i) => console.log(`  ${i + 1}. ${CATEGORIES[k].label}`))
  const rl = createInterface({ input: stdin, output: stdout })
  const raw = await rl.question(`Pick 1-${keys.length} [1] `)
  rl.close()
  const idx = parseInt(raw, 10)
  return keys[(Number.isInteger(idx) && idx >= 1 && idx <= keys.length ? idx : 1) - 1]
}

async function pickStack(category) {
  const stacks = CATEGORIES[category].stacks
  console.log(`\nPick a stack for ${CATEGORIES[category].label}:`)
  stacks.forEach((s, i) => {
    const tag = s.recommended ? " (Recommended)" : ""
    console.log(`  ${i + 1}. ${s.label}${tag}`)
  })
  const rl = createInterface({ input: stdin, output: stdout })
  const def = stacks.findIndex((s) => s.recommended) + 1
  const raw = await rl.question(`Pick 1-${stacks.length} [${def}] `)
  rl.close()
  const idx = parseInt(raw, 10)
  return stacks[(Number.isInteger(idx) && idx >= 1 && idx <= stacks.length ? idx : def) - 1]
}

async function drillDown(category) {
  const layers = CATEGORIES[category].layers || {}
  const picks = {}
  console.log("\nDrill-down configuration:")
  for (const [layer, options] of Object.entries(layers)) {
    console.log(`\n${layer}:`)
    options.forEach((o, i) => {
      const tag = i === 0 ? " (Recommended)" : ""
      console.log(`  ${i + 1}. ${o.label}${tag}`)
    })
    const rl = createInterface({ input: stdin, output: stdout })
    const raw = await rl.question(`Pick 1-${options.length} [1] `)
    rl.close()
    const idx = parseInt(raw, 10)
    picks[layer] = options[(Number.isInteger(idx) && idx >= 1 && idx <= options.length ? idx : 1) - 1]
  }
  return picks
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function resolveTemplateDir(category, stackName) {
  const root = join(import.meta.dirname || join(import.meta.url, ".."), "..", "starter")
  const named = join(root, category, stackName)
  if (existsSync(named)) return named
  const rec = CATEGORIES[category]?.stacks?.[0]
  if (rec) return join(root, category, rec.name)
  return null
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

  if (!name) {
    console.error("Usage: armada new <project-name> [--type <category>] [--beginner|--experienced] [--yes]")
    process.exitCode = 1
    return
  }

  let category = opts.type
  if (!category) {
    if (opts.yes || !process.stdin.isTTY) {
      category = Object.keys(CATEGORIES)[0]
    } else {
      category = await pickCategory()
    }
  }
  if (!CATEGORIES[category]) {
    console.error(`Unknown category: ${category}. Available: ${Object.keys(CATEGORIES).join(", ")}`)
    process.exitCode = 1
    return
  }

  let level
  if (opts.beginner) level = "beginner"
  else if (opts.experienced) level = "experienced"
  else level = detectExperience()

  if (!opts.yes && !opts.beginner && !opts.experienced && process.stdin.isTTY) {
    const ok = await confirm(`Detected experience: ${level}. Use this?`, true)
    if (ok === null) return
  }

  let stackName
  if (opts.beginner || level === "beginner") {
    if (opts.yes || !process.stdin.isTTY) {
      stackName = CATEGORIES[category].stacks[0].name
    } else {
      const chosen = await pickStack(category)
      stackName = chosen.name
    }
  } else {
    if (opts.yes || !process.stdin.isTTY) {
      stackName = CATEGORIES[category].stacks[0].name
    } else {
      await drillDown(category)
      stackName = CATEGORIES[category].stacks[0].name
    }
  }

  const targetDir = join(cwd, name)
  if (existsSync(targetDir)) {
    console.error(`Directory already exists: ${targetDir}`)
    process.exitCode = 1
    return
  }

  const templateDir = resolveTemplateDir(category, stackName)
  if (!templateDir || !existsSync(templateDir)) {
    console.error(`Template not found for ${category}/${stackName}`)
    process.exitCode = 1
    return
  }

  const projectNameSlug = slugify(name)
  const description = `A ${CATEGORIES[category].label.toLowerCase()} project.`
  renderTemplate(templateDir, targetDir, {
    project_name: name,
    project_name_slug: projectNameSlug,
    project_description: description,
  })

  let postInstall = null
  try {
    const starterYaml = readFileSync(join(templateDir, "starter.yaml"), "utf8")
    const lines = starterYaml.split("\n")
    for (const line of lines) {
      if (line.startsWith("postInstall:")) {
        const val = line.split(":")[1]?.trim()
        if (val && val !== "null") postInstall = val
      }
    }
  } catch { /* optional */ }

  const manifest = defaultManifestFor(name)
  const stack = detectStack(targetDir)
  manifest.targetDir = targetDir
  const files = scaffold(manifest, stack)

  console.log(`\nCreated ${name}/`)
  console.log(`Template: ${CATEGORIES[category].label} / ${stackName}`)
  for (const f of files) console.log(`  + ${f}`)
  console.log("\nNext:")
  console.log(`  cd ${name}`)
  if (postInstall) console.log(`  ${postInstall}`)
  console.log("  opencode")
  console.log("  /armada")
}
