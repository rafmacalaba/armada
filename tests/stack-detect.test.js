import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { detectStack, formatStack } from "../src/stack-detect.js"

function makeRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), "armada-stack-"))
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel)
    mkdirSync(join(dir, rel.split("/").slice(0, -1).join("/")), { recursive: true })
    writeFileSync(p, content, "utf8")
  }
  return dir
}

test("detects nextjs + jest + typescript", () => {
  const dir = makeRepo({
    "package.json": JSON.stringify({
      dependencies: { next: "15", react: "19" },
      devDependencies: { jest: "29", "@types/node": "22" },
    }),
  })
  const s = detectStack(dir)
  assert.strictEqual(s.frontend, "nextjs")
  assert.strictEqual(s.testing, "jest")
  assert.ok(s.languages.includes("typescript"))
})

test("detects python fastapi + pytest + sqlalchemy", () => {
  const dir = makeRepo({ "requirements.txt": "fastapi\nsqlalchemy\npytest\nuvicorn" })
  const s = detectStack(dir)
  assert.strictEqual(s.backend, "python-fastapi")
  assert.strictEqual(s.testing, "pytest")
  assert.strictEqual(s.database, "sqlalchemy")
})

test("detects docker-compose postgres", () => {
  const dir = makeRepo({
    "docker-compose.yml": "services:\n  db:\n    image: postgres:16\n",
  })
  const s = detectStack(dir)
  assert.strictEqual(s.database, "postgres")
})

test("finds instruction files", () => {
  const dir = makeRepo({ "CLAUDE.md": "hi", "DEVELOPER.md": "hi" })
  const s = detectStack(dir)
  assert.ok(s.instructions.includes("CLAUDE.md"))
  assert.ok(s.instructions.includes("DEVELOPER.md"))
})

test("empty repo -> minimal stack", () => {
  const s = detectStack(makeRepo({}))
  assert.strictEqual(formatStack(s), "none detected")
})
