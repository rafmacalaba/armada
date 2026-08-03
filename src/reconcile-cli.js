/**
 * reconcile-cli — CLI wrapper for the reconcile engine.
 *
 * @module reconcile-cli
 */

import { resolve } from "node:path"
import { reconcile } from "./reconcile.js"

/**
 * Run the reconcile CLI command.
 *
 * @param {string[]} argv - remaining args after "reconcile"
 * @param {{ cwd?: string }} [opts]
 * @returns {Promise<number>} exit code (0 = no drifts/no active, 2 = drifts present)
 */
export async function main(argv = [], opts = {}) {
  const json = argv.includes("--json")

  const stateDirIdx = argv.indexOf("--state-dir")
  const stateDir =
    stateDirIdx !== -1 && argv[stateDirIdx + 1] && !argv[stateDirIdx + 1].startsWith("--")
      ? argv[stateDirIdx + 1]
      : resolve(opts.cwd || ".", "armada", "state")

  const repoIdx = argv.indexOf("--repo")
  const repoRoot =
    repoIdx !== -1 && argv[repoIdx + 1] && !argv[repoIdx + 1].startsWith("--")
      ? argv[repoIdx + 1]
      : opts.cwd || "."

  const plan = reconcile(stateDir, repoRoot)

  if (json) {
    console.log(JSON.stringify(plan, null, 2))
  } else {
    console.log(plan.resumeLine)
    if (plan.drifts.length > 0) {
      console.log(`drifts (${plan.drifts.length}):`)
      for (const d of plan.drifts) {
        console.log(`  - [${d.kind}] phase ${d.phase}, criterion ${d.criterion}: ${d.ref}`)
      }
    }
  }

  if (plan.drifts.length > 0) return 2
  return 0
}
