import { test } from "node:test"
import assert from "node:assert"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

test("package.json version is 0.7.0", () => {
  const pkgRaw = readFileSync(resolve("package.json"), "utf8")
  const pkg = JSON.parse(pkgRaw)
  assert.ok(pkg.version, "package.json missing version field")
  assert.strictEqual(pkg.version, "0.7.0", "package.json version !== 0.7.0")
})

test("tarball opencode-armada-0.7.0.tgz exists after smoke", { skip: !existsSync(resolve("opencode-armada-0.7.0.tgz")) }, () => {
  const tarballPath = resolve("opencode-armada-0.7.0.tgz")
  const stat = readFileSync(tarballPath)
  assert.ok(stat.length > 0, "tarball is empty")
})
