import { test } from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

test("version sync: package.json and cli.js VERSION both equal 0.7.0", async () => {
  const pkgRaw = readFileSync(resolve("package.json"), "utf8")
  const pkg = JSON.parse(pkgRaw)
  assert.ok(pkg.version, "package.json missing version field")
  assert.strictEqual(pkg.version, "0.7.0", "package.json version !== 0.7.0")

  const cli = await import("../src/cli.js")
  assert.ok(cli.VERSION, "cli.js missing VERSION export")
  assert.strictEqual(cli.VERSION, "0.7.0", "cli.js VERSION !== 0.7.0")
  assert.strictEqual(cli.VERSION, pkg.version, "VERSION mismatch between package.json and cli.js")
})
