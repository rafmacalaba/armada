import { test } from "node:test"
import assert from "node:assert"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { detectStack } from "../src/stack-detect.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures")

test("detectStack over fixture corpus", () => {
  const cases = [
    ["nextjs-monorepo", { frontend: "nextjs", testing: "jest", database: "postgres" }],
    ["fastapi", { backend: "python-fastapi", testing: "pytest" }],
    ["empty", {}],
  ]
  for (const [name, expect] of cases) {
    const s = detectStack(join(FIXTURES, name))
    for (const [k, v] of Object.entries(expect)) assert.strictEqual(s[k], v, `${name}.${k}`)
  }
})
