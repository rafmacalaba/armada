import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"

const CLI = join(process.cwd(), "src", "cli.js")

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), "armada-scout-t-"))
}

function runCli(args) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    cwd: process.cwd(),
  })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}

// ---- 4-section structure --------------------------------------------------

test("scout: prints 4-section brief for a file path area", () => {
  const result = runCli(["scout", "src/auth/middleware.js"])

  assert.strictEqual(result.code, 0)
  const out = result.stdout

  assert.match(out, /## Area/)
  assert.match(out, /## Suggested role/)
  assert.match(out, /## What to look for/)
  assert.match(out, /## Deliverable/)
})

test("scout: prints 4-section brief for a general area name", () => {
  const result = runCli(["scout", "perf hot path"])

  assert.strictEqual(result.code, 0)
  const out = result.stdout

  assert.match(out, /## Area/)
  assert.match(out, /## Suggested role/)
  assert.match(out, /## What to look for/)
  assert.match(out, /## Deliverable/)
})

// ---- area name in output --------------------------------------------------

test("scout: area name appears in Area section", () => {
  const result = runCli(["scout", "src/auth/middleware.js"])

  assert.strictEqual(result.code, 0)
  const out = result.stdout
  assert.match(out, /src\/auth\/middleware\.js/)
})

test("scout: multi-word area preserved in output", () => {
  const result = runCli(["scout", "perf", "hot", "path"])

  assert.strictEqual(result.code, 0)
  const out = result.stdout
  assert.match(out, /perf hot path/)
})

// ---- role heuristics ------------------------------------------------------

test("scout: *hostile* keyword -> xebec role", () => {
  const result = runCli(["scout", "hostile review"])

  assert.strictEqual(result.code, 0)
  assert.match(result.stdout, /xebec/)
})

test("scout: *architecture* keyword -> bark role", () => {
  const result = runCli(["scout", "architecture review"])

  assert.strictEqual(result.code, 0)
  assert.match(result.stdout, /bark/)
})

test("scout: *architect* keyword -> bark role", () => {
  const result = runCli(["scout", "architectural risks"])

  assert.strictEqual(result.code, 0)
  assert.match(result.stdout, /bark/)
})

test("scout: default area -> xebec role", () => {
  const result = runCli(["scout", "random utils"])

  assert.strictEqual(result.code, 0)
  assert.match(result.stdout, /xebec/)
})

// ---- what-to-look-for heuristics ------------------------------------------

test("scout: *test* keyword -> coverage bullets", () => {
  const result = runCli(["scout", "test coverage"])

  assert.strictEqual(result.code, 0)
  assert.match(result.stdout, /coverage/)
})

test("scout: *auth* keyword -> auth middleware bullets", () => {
  const result = runCli(["scout", "auth module"])

  assert.strictEqual(result.code, 0)
  assert.match(result.stdout, /middleware/)
})

test("scout: *perf* keyword -> hot path bullets", () => {
  const result = runCli(["scout", "perf optimization"])

  assert.strictEqual(result.code, 0)
  assert.match(result.stdout, /hot path/i)
})

test("scout: default area -> public surface bullets", () => {
  const result = runCli(["scout", "misc helpers"])

  assert.strictEqual(result.code, 0)
  assert.match(result.stdout, /public/i)
})

// ---- missing area argument ------------------------------------------------

test("scout: --help prints help text, exits 0, not area brief", () => {
  const result = runCli(["scout", "--help"])

  assert.strictEqual(result.code, 0)
  const out = result.stdout
  // Must be help text, not a scout investigation brief
  assert.doesNotMatch(out, /## Area/)
  assert.doesNotMatch(out, /## Suggested role/)
  assert.doesNotMatch(out, /## What to look for/)
  assert.doesNotMatch(out, /## Deliverable/)
  assert.match(out, /armada scout/)
})

test("scout: -h prints help text, exits 0, not area brief", () => {
  const result = runCli(["scout", "-h"])

  assert.strictEqual(result.code, 0)
  const out = result.stdout
  assert.doesNotMatch(out, /## Area/)
  assert.doesNotMatch(out, /## Suggested role/)
  assert.doesNotMatch(out, /## What to look for/)
  assert.doesNotMatch(out, /## Deliverable/)
  assert.match(out, /armada scout/)
})

test("scout: missing area arg — exit 1 with message", () => {
  const result = runCli(["scout"])

  assert.strictEqual(result.code, 1)
  const out = result.stdout || result.stderr
  assert.ok(out.length > 0, "must print a message")
})

// ---- deliverable section ---------------------------------------------------

test("scout: deliverable section mentions findings report, no writes, no PR", () => {
  const result = runCli(["scout", "some area"])

  assert.strictEqual(result.code, 0)
  const out = result.stdout
  assert.match(out, /findings/i)
  assert.match(out, /no writes/i)
  // no emoji in output
  assert.doesNotMatch(out, /\x1b\[/)
})

// ---- 3-5 bullets in What to look for --------------------------------------

test("scout: What to look for has 3-5 bullet points", () => {
  const result = runCli(["scout", "auth"])

  assert.strictEqual(result.code, 0)
  const out = result.stdout

  // Find section after "## What to look for" heading
  const sectionIdx = out.indexOf("## What to look for")
  assert.ok(sectionIdx !== -1, "section heading must exist")

  const afterSection = out.slice(sectionIdx)
  const nextHeadingIdx = afterSection.indexOf("##", 5)
  const sectionBody = nextHeadingIdx !== -1 ? afterSection.slice(0, nextHeadingIdx) : afterSection

  const bulletCount = (sectionBody.match(/^  - /gm) || []).length
  assert.ok(bulletCount >= 3, `expected >= 3 bullets, got ${bulletCount}`)
  assert.ok(bulletCount <= 5, `expected <= 5 bullets, got ${bulletCount}`)
})
