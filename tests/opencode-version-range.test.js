import { test } from "node:test"
import assert from "node:assert"
import { parseOpenCodeVersion, checkOpenCodeVersion } from "../src/doctor.js"

// Minimum Opencode version required for armada compatibility.
const MIN_OPENCODE = "1.18.0"

test("parseOpenCodeVersion extracts version from standard output", () => {
  assert.strictEqual(parseOpenCodeVersion("1.18.11"), "1.18.11")
  assert.strictEqual(parseOpenCodeVersion("opencode v1.18.11"), "1.18.11")
  assert.strictEqual(parseOpenCodeVersion("v1.18.11"), "1.18.11")
  assert.strictEqual(parseOpenCodeVersion("1.20.0"), "1.20.0")
  assert.strictEqual(parseOpenCodeVersion("opencode version 1.19.5 (abc123)"), "1.19.5")
  assert.strictEqual(parseOpenCodeVersion("  1.18.0  "), "1.18.0")
})

test("parseOpenCodeVersion returns null for unparseable output", () => {
  assert.strictEqual(parseOpenCodeVersion(""), null)
  assert.strictEqual(parseOpenCodeVersion("error: command not found"), null)
  assert.strictEqual(parseOpenCodeVersion("something"), null)
  assert.strictEqual(parseOpenCodeVersion("v1.18"), null) // incomplete semver
  assert.strictEqual(parseOpenCodeVersion("1.18"), null) // incomplete semver
})

test("checkOpenCodeVersion passes for supported version", () => {
  const result = checkOpenCodeVersion("1.18.0", MIN_OPENCODE)
  assert.strictEqual(result.status, "pass")
  assert.match(result.detail, /1\.18\.0/)
  assert.match(result.detail, /within supported range/)
})

test("checkOpenCodeVersion passes for newer version", () => {
  const result = checkOpenCodeVersion("1.20.5", MIN_OPENCODE)
  assert.strictEqual(result.status, "pass")
  assert.match(result.detail, /1\.20\.5/)
})

test("checkOpenCodeVersion passes for version higher than minimum", () => {
  const result = checkOpenCodeVersion("2.0.0", MIN_OPENCODE)
  assert.strictEqual(result.status, "pass")
  assert.match(result.detail, /2\.0\.0/)
})

test("checkOpenCodeVersion fails for older version", () => {
  const result = checkOpenCodeVersion("1.17.0", MIN_OPENCODE)
  assert.strictEqual(result.status, "fail")
  assert.match(result.detail, /1\.17\.0/)
  assert.match(result.detail, /unsupported/)
})

test("checkOpenCodeVersion fails for much older version", () => {
  const result = checkOpenCodeVersion("0.8.0", MIN_OPENCODE)
  assert.strictEqual(result.status, "fail")
  assert.match(result.detail, /unsupported/)
})

test("checkOpenCodeVersion fails for unparseable output", () => {
  const result = checkOpenCodeVersion("garbage", MIN_OPENCODE)
  assert.strictEqual(result.status, "fail")
  assert.match(result.detail, /unrecognized version format/)
})

test("checkOpenCodeVersion fails for null/empty output", () => {
  const result = checkOpenCodeVersion("", MIN_OPENCODE)
  assert.strictEqual(result.status, "fail")
  assert.match(result.detail, /unrecognized version format/)
})

test("checkOpenCodeVersion fails when version missing from output", () => {
  const result = checkOpenCodeVersion("error: opcode not found", MIN_OPENCODE)
  assert.strictEqual(result.status, "fail")
  assert.match(result.detail, /unrecognized version format/)
})

test("checkOpenCodeVersion handles custom minimum", () => {
  const result = checkOpenCodeVersion("2.0.0", "2.0.0")
  assert.strictEqual(result.status, "pass")

  const fail = checkOpenCodeVersion("1.99.0", "2.0.0")
  assert.strictEqual(fail.status, "fail")
})
