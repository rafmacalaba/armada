// opencode-armada CLI — entry point.
//
// Commands:
//   armada init                 interactive questionnaire -> writes team config
//   armada init --stack ...     declarative flags
//   armada init --from-armada armada.yaml   re-scaffold from manifest
//   armada models [budget]      print curated model catalog
//   armada models --refresh     merge live provider models (requires auth)
//   armada doctor               check omo-slim + providers + background subagents
//   armada uninstall [--all]    remove armada-generated artifacts (--all also user-facing)
//   armada ping                 confirm the CLI works
//   armada help                 this help

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { runQuestionnaire, guessName } from "./questionnaire.js"
import { detectStack } from "./stack-detect.js"
import { scaffold, uninstall } from "./scaffold.js"
import { renderCatalog, BUDGETS, ROLES, modelFor, refreshModels, loadModelsCache } from "./model-catalog.js"
import { parseManifestYaml } from "./manifest.js"
import { runDoctor } from "./doctor.js"

export const VERSION = "0.1.0"

const HELP = `opencode-armada v${VERSION}
Reproducible AI-engineer multi-agent teams for opencode, on oh-my-opencode-slim.

Usage:
  armada init                                interactive setup
  armada init --stack <s> --budget <b>       declarative setup
  armada init --from-armada armada.yaml      regenerate from manifest
  armada models [budget]                     show curated model catalog
  armada models --refresh                    merge live provider models
  armada doctor                              environment health check
  armada uninstall [--all] [--dry-run]       remove armada-generated artifacts
  armada ping                                sanity check
  armada help                                this help
`

// Token -> stack field mappings for `--stack <hint>`. Only applied when the
// detected stack leaves that field null/empty.
const STACK_HINT_TOKENS = {
  frontend: {
    nextjs: "nextjs", react: "react", vue: "vue", remix: "remix",
    gatsby: "gatsby", svelte: "svelte",
  },
  backend: {
    fastapi: "python-fastapi", django: "python-django", flask: "python-flask",
    express: "node-express", fastify: "node-fastify", nest: "node-nestjs",
    nestjs: "node-nestjs", node: "node",
  },
  database: {
    postgres: "postgres", postgresql: "postgres", mysql: "mysql",
    sqlite: "sqlite", mongodb: "mongodb", mongo: "mongodb",
  },
  testing: {
    playwright: "playwright", pytest: "pytest", jest: "jest",
    vitest: "vitest", cypress: "cypress",
  },
}

// Extract the --stack <hint> value, or undefined when missing/misused.
function stackHint(args) {
  const i = args.indexOf("--stack")
  if (i === -1) return undefined
  const v = args[i + 1]
  return v && !v.startsWith("--") ? v : undefined
}

// Overlay the CLI stack hint onto a detected stack. Token order wins; a field
// already set by detection is left alone. Mutates and returns the stack.
export function applyStackHint(stack, hint) {
  if (!hint) return stack
  const tokens = hint.split(/[-,+_ ]/).filter(Boolean)
  for (const field of Object.keys(STACK_HINT_TOKENS)) {
    for (const token of tokens) {
      const mapped = STACK_HINT_TOKENS[field][token]
      if (mapped && !stack[field]) {
        stack[field] = mapped
        break
      }
    }
  }
  return stack
}

export async function main(argv = process.argv.slice(2)) {
  const [cmd, ...rest] = argv

  switch (cmd) {
    case "init":
      return init(rest)
    case "models":
      return models(rest)
    case "doctor":
      return doctor()
    case "uninstall":
      return uninstallCmd(rest)
    case "ping":
      console.log("armada ok")
      return
    case "help":
    case "-h":
    case "--help":
    case undefined:
      console.log(HELP)
      return
    default:
      console.error(`Unknown command: ${cmd}\n`)
      console.error(HELP)
      process.exitCode = 1
  }
}

// Entry when run as a script (node/bun src/cli.js). Guarded so the module can
// also be imported for testing.
const isMain =
  typeof process !== "undefined" &&
  (import.meta.url === `file://${process.argv[1]}` || import.meta.url === `file://${process.argv[1]}.js`)

if (isMain) {
  main().catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
}

async function init(args) {
  const fromArmadaIdx = args.indexOf("--from-armada")
  let manifest = null

  if (fromArmadaIdx !== -1) {
    const file = args[fromArmadaIdx + 1]
    if (!file || !existsSync(resolve(file))) {
      console.error(`Manifest not found: ${file ?? "(missing)"}`)
      process.exitCode = 1
      return
    }
    try {
      manifest = parseManifestYaml(readFileSync(resolve(file), "utf8"))
    } catch (err) {
      console.error(String(err?.message ?? err))
      process.exitCode = 1
      return
    }
  } else {
    const nonInteractive = args.includes("--yes") || !process.stdin.isTTY
    manifest = nonInteractive ? defaultManifest() : await runQuestionnaire(".")
  }

  // Apply declarative overrides.
  const budgetIdx = args.indexOf("--budget")
  if (budgetIdx !== -1 && BUDGETS.includes(args[budgetIdx + 1])) {
    manifest.project.budget = args[budgetIdx + 1]
  }
  const noBrowser = args.includes("--no-browser")
  if (noBrowser) {
    manifest.project.browserTesting = false
    manifest.project.useAgentBrowser = false
  }

  manifest.targetDir = "."

  // Always detect the stack from the repo, then overlay any --stack hint onto
  // the detected fields. Stored back into the manifest so armada.yaml reflects it.
  const stack = applyStackHint(
    Object.keys(manifest.project.stack).length ? { ...manifest.project.stack } : detectStack("."),
    stackHint(args))

  manifest.project.stack = stack

  const dryRun = args.includes("--dry-run")
  const files = scaffold(manifest, stack, { dryRun })
  console.log(`\n${dryRun ? "(dry-run) " : ""}Scaffolded opencode-armada team:`)
  for (const f of files) console.log(`  ${dryRun ? "(dry-run) + " : "+ "}${f}`)
  console.log("\nNext:")
  console.log("  1. opencode")
  console.log("  2. /armada  -> team status")
  console.log("  3. 'ping all agents'  -> verify roster")
}

// Default (non-interactive) manifest: guessed project name, balanced budget,
// every role enabled at its balanced model, no browser/devcontainer extras.
function defaultManifest() {
  return {
    project: {
      name: guessName(process.cwd()),
      budget: "balanced",
      browserTesting: false,
      devcontainer: false,
      useAgentBrowser: false,
      stack: {},
    },
    team: ROLES.map((role) => ({
      role,
      model: modelFor(role, "balanced"),
      fallback: null,
      enabled: true,
    })),
  }
}

async function models(args) {
  const refresh = args.includes("--refresh")
  const budget = args.find((a) => BUDGETS.includes(a)) ?? "balanced"
  const cacheIdx = args.indexOf("--cache")
  const cachePath =
    cacheIdx !== -1 && args[cacheIdx + 1] && !args[cacheIdx + 1].startsWith("--")
      ? args[cacheIdx + 1]
      : undefined
  let availability
  if (refresh) {
    try {
      availability = await refreshModels({ cachePath })
    } catch (err) {
      console.error(`models --refresh failed: ${err.message}`)
      process.exitCode = 1
      return
    }
  } else {
    availability = loadModelsCache(cachePath)
  }
  console.log(`Model catalog (budget: ${budget})`)
  if (availability) {
    console.log("✓ available on providers   ✗ unavailable (falls back)")
  }
  console.log(renderCatalog(budget, availability))
}

async function doctor() {
  console.log("opencode-armada doctor")
  const checks = await runDoctor()
  let anyFail = false
  for (const { name, status, detail } of checks) {
    console.log(`${name}: ${status} — ${detail}`)
    if (status === "fail") anyFail = true
  }
  if (anyFail) process.exitCode = 1
}

async function uninstallCmd(args) {
  const fileIdx = args.indexOf("--from-armada")
  const file = fileIdx !== -1 ? args[fileIdx + 1] : "armada.yaml"
  if (!file || file.startsWith("--") || !existsSync(resolve(file))) {
    console.error(`Manifest not found: ${!file || file.startsWith("--") ? "(missing)" : file}`)
    process.exitCode = 1
    return
  }
  let manifest
  try {
    manifest = parseManifestYaml(readFileSync(resolve(file), "utf8"))
  } catch (err) {
    console.error(String(err?.message ?? err))
    process.exitCode = 1
    return
  }
  manifest.targetDir = "."
  const dryRun = args.includes("--dry-run")
  const all = args.includes("--all")
  const removed = uninstall(manifest, { all, dryRun })
  console.log(`\n${dryRun ? "(dry-run) " : ""}Removed armada artifacts:`)
  for (const f of removed) console.log(`  ${dryRun ? "(dry-run) - " : "- "}${f}`)
}
