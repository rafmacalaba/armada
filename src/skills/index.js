// Skills registry: all bundled armada skills. Each entry is {name, description, body}.
// The body is the full SKILL.md file content (frontmatter + markdown).
// Names match ^[a-z0-9]+(-[a-z0-9]+)*$ .
// Descriptions are <= 200 characters.
// No dangling {placeholders}, no emojis.

import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

function readSkill(name) {
  const body = readFileSync(join(__dirname, name, "SKILL.md"), "utf8")
  // Extract description from frontmatter
  const descMatch = body.match(/^---[\s\S]*?description:\s*(.+?)\s*\n[\s\S]*?---/)
  const description = descMatch ? descMatch[1].trim() : ""
  return { name, description, body }
}

export const armadaContract = readSkill("armada-contract")
export const armadaGate = readSkill("armada-gate")
export const armadaDispatch = readSkill("armada-dispatch")
export const armadaTaskSpec = readSkill("armada-task-spec")
export const armadaVerification = readSkill("armada-verification")
export const armadaPonytail = readSkill("armada-ponytail")
export const armadaCaveman = readSkill("armada-caveman")
export const armadaPr = readSkill("armada-pr")
export const armadaResume = readSkill("armada-resume")
export const armadaLedger = readSkill("armada-ledger")
export const armadaContextBudget = readSkill("armada-context-budget")
export const armadaTdd = readSkill("armada-tdd")
export const armadaSdd = readSkill("armada-sdd")
export const armadaVoyageFinish = readSkill("armada-voyage-finish")

export const skillRegistry = [
  armadaContract,
  armadaGate,
  armadaDispatch,
  armadaTaskSpec,
  armadaVerification,
  armadaPonytail,
  armadaCaveman,
  armadaPr,
  armadaResume,
  armadaLedger,
  armadaContextBudget,
  armadaTdd,
  armadaSdd,
  armadaVoyageFinish,
]


