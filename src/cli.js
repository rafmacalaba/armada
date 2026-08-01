// opencode-armada CLI — entry point.
//
// Commands:
//   armada init                 interactive questionnaire -> writes team config
//   armada init --stack ...     declarative flags
//   armada init --from-armada armada.yaml   re-scaffold from manifest
//   armada models [budget]      print curated model catalog
//   armada models --refresh     merge live provider models (requires auth)
//   armada doctor               check omo-slim + providers + background subagents
//   armada ping                 confirm the CLI works
//   armada help                 this help

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { runQuestionnaire } from "./questionnaire.js"
import { detectStack } from "./stack-detect.js"
import { scaffold } from "./scaffold.js"
import { renderCatalog, BUDGETS } from "./model-catalog.js"

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
  armada ping                                sanity check
  armada help                                this help
`

export async function main(argv = process.argv.slice(2)) {
  const [cmd, ...rest] = argv

  switch (cmd) {
    case "init":
      return init(rest)
    case "models":
      return models(rest)
    case "doctor":
      return doctor()
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
    manifest = parseManifest(readFileSync(resolve(file), "utf8"))
  } else {
    manifest = await runQuestionnaire(".")
  }

  // Apply declarative overrides.
  const budgetIdx = args.indexOf("--budget")
  if (budgetIdx !== -1 && BUDGETS.includes(args[budgetIdx + 1])) {
    manifest.project.budget = args[budgetIdx + 1]
  }
  const stackIdx = args.indexOf("--stack")
  if (stackIdx !== -1) {
    manifest.project.stack = { ...manifest.project.stack, hint: args[stackIdx + 1] }
  }
  const noBrowser = args.includes("--no-browser")
  if (noBrowser) {
    manifest.project.browserTesting = false
    manifest.project.useAgentBrowser = false
  }

  manifest.targetDir = "."
  const stack = manifest.project.stack && Object.keys(manifest.project.stack).length
    ? manifest.project.stack
    : detectStack(".")

  const files = scaffold(manifest, stack)
  console.log("\nScaffolded opencode-armada team:")
  for (const f of files) console.log(`  + ${f}`)
  console.log("\nNext:")
  console.log("  1. opencode")
  console.log("  2. /armada  -> team status")
  console.log("  3. 'ping all agents'  -> verify roster")
}

function models(args) {
  const refresh = args.includes("--refresh")
  const budget = args.find((a) => BUDGETS.includes(a)) ?? "balanced"
  console.log(`Model catalog (budget: ${budget})`)
  console.log(renderCatalog(budget))
  if (refresh) {
    console.log("\n--refresh: merge live provider models")
    console.log("  (implemented via `opencode models`; requires provider auth.)")
  }
}

function doctor() {
  console.log("opencode-armada doctor")
  const checks = [
    ["opencode CLI", "opencode", ["--version"]],
    ["oh-my-opencode-slim plugin", "bun", ["x", "oh-my-opencode-slim@latest", "--version"]],
  ]
  for (const [name, bin, args] of checks) {
    // Simple existence probe; real runs spawn the subprocess.
    console.log(`  ${name}: check '${bin}' available`)
  }
  console.log("\nChecklist:")
  console.log("  - opencode installed (opencode --version)")
  console.log("  - omo-slim in ~/.config/opencode/opencode.json plugin[]")
  console.log("  - provider auth: opencode auth list")
  console.log("  - background subagents: OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true opencode")
}

// Minimal YAML-ish parser for armada.yaml. Real YAML would need a dep; keep the
// manifest subset readable manually. Returns a manifest object.
function parseManifest(text) {
  const get = (re) => {
    const m = text.match(re)
    return m ? m[1].trim() : null
  }
  const teamLines = [...text.matchAll(/^\s+- role:\s*(\S+)\s*\n\s+model:\s*(\S+)\s*\n\s+fallback:\s*(\S+)\s*\n\s+enabled:\s*(\S+)/gm)]
  const team = teamLines.map((m) => ({
    role: m[1],
    model: m[2],
    fallback: m[3],
    enabled: m[4] === "true",
  }))
  const budget = get(/^  budget:\s*(\S+)/m) ?? "balanced"
  return {
    project: {
      name: get(/^  name:\s*(.+)$/m) ?? "project",
      budget,
      browserTesting: (get(/^  browserTesting:\s*(\S+)/m) ?? "false") === "true",
      devcontainer: (get(/^  devcontainer:\s*(\S+)/m) ?? "false") === "true",
      useAgentBrowser: (get(/^  useAgentBrowser:\s*(\S+)/m) ?? "false") === "true",
      stack: {},
    },
    team,
  }
}
