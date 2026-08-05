import { test } from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const pkgPath = resolve(process.cwd(), "package.json")
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))

test("package.json has engines.node >=20", () => {
  assert.ok(pkg.engines, "engines field must exist")
  assert.ok(pkg.engines.node, "engines.node must exist")
  assert.strictEqual(pkg.engines.node, ">=20")
})

test("package.json has license MIT", () => {
  assert.strictEqual(pkg.license, "MIT")
})

test("package.json has repository", () => {
  assert.ok(pkg.repository, "repository field must exist")
  assert.strictEqual(typeof pkg.repository, "object")
  assert.strictEqual(pkg.repository.type, "git")
  assert.ok(pkg.repository.url.includes("github.com"))
})

test("package.json has bugs.url", () => {
  assert.ok(pkg.bugs, "bugs field must exist")
  assert.ok(typeof pkg.bugs === "object" || typeof pkg.bugs === "string")
  const url = typeof pkg.bugs === "string" ? pkg.bugs : pkg.bugs.url
  assert.ok(url, "bugs.url must exist")
  assert.ok(url.includes("github.com"), "bugs must point to github")
})

test("package.json has homepage", () => {
  assert.ok(pkg.homepage, "homepage field must exist")
  assert.ok(pkg.homepage.includes("github.com"), "homepage must point to github")
})

test("package.json has peerDependencies.opencode", () => {
  assert.ok(pkg.peerDependencies, "peerDependencies field must exist")
  assert.ok(pkg.peerDependencies.opencode, "opencode peer dependency must exist")
  assert.strictEqual(pkg.peerDependencies.opencode, "^1.18.0")
})

test("package.json marks opencode peer dep as optional (npm ci compatibility)", () => {
  assert.ok(pkg.peerDependenciesMeta, "peerDependenciesMeta field must exist")
  assert.ok(pkg.peerDependenciesMeta.opencode, "peerDependenciesMeta.opencode must exist")
  assert.strictEqual(pkg.peerDependenciesMeta.opencode.optional, true, "opencode must be marked optional so npm ci does not 404 on it")
})
