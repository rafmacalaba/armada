import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import YAML from "yaml"

const __dirname = dirname(fileURLToPath(import.meta.url))

function parseSkillFile(name) {
  const raw = readFileSync(join(__dirname, name, "SKILL.md"), "utf8")
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) throw new Error(`invalid skill frontmatter in ${name}`)
  const frontmatter = YAML.parse(match[1])
  return {
    name: frontmatter.name,
    description: frontmatter.description,
    body: raw,
  }
}

export const armadaContract = parseSkillFile("armada-contract")
export const armadaGate = parseSkillFile("armada-gate")

export const skillRegistry = [armadaContract, armadaGate]
