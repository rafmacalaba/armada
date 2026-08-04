import { test } from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

test("version sync: package.json and cli.js VERSION match", async () => {
  const pkgRaw = readFileSync(resolve("package.json"), "utf8")
  const pkg = JSON.parse(pkgRaw)
  assert.ok(pkg.version, "package.json missing version field")

  const cli = await import("../src/cli.js")
  assert.ok(cli.VERSION, "cli.js missing VERSION export")
  assert.strictEqual(cli.VERSION, pkg.version, "VERSION mismatch between package.json and cli.js")
})
