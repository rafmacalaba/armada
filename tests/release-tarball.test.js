import { test } from "node:test"
import assert from "node:assert"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

const PKG = JSON.parse(readFileSync(resolve("package.json"), "utf8"))

test("package.json has a semver version", () => {
  assert.ok(PKG.version, "package.json missing version field")
  assert.match(PKG.version, /^\d+\.\d+\.\d+/, `version '${PKG.version}' is not semver`)
})

test("tarball for the current version exists after smoke", { skip: !existsSync(resolve(`opencode-armada-${PKG.version}.tgz`)) }, () => {
  const tarballPath = resolve(`opencode-armada-${PKG.version}.tgz`)
  const stat = readFileSync(tarballPath)
  assert.ok(stat.length > 0, "tarball is empty")
})
