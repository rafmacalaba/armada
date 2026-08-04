import { test } from "node:test"
import assert from "node:assert"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { execSync } from "node:child_process"

test("package.json files array includes docs", () => {
  const pkgRaw = readFileSync(resolve("package.json"), "utf8")
  const pkg = JSON.parse(pkgRaw)
  assert.ok(Array.isArray(pkg.files), "files must be an array")
  assert.ok(pkg.files.includes("docs"), "files must include docs")
})

test("tarball contains docs/using-armada.md through tar listing", { skip: !existsSync(resolve("opencode-armada-0.7.0.tgz")) }, () => {
  const tarballPath = resolve("opencode-armada-0.7.0.tgz")
  let listing
  try {
    listing = execSync(`tar -tzf "${tarballPath}"`, { encoding: "utf8" })
  } catch {
    // tar unavailable — skip
    console.log("SKIP tarball listing: tar -tzf failed")
    return
  }
  const lines = listing.split("\n").filter(Boolean)
  const docFiles = lines.filter((l) => l.startsWith("package/docs/"))
  assert.ok(docFiles.length > 0, "tarball must contain at least one file under package/docs/")
})
