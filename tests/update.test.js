import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve as resolvePath } from "node:path"
import { detectTmuxSession, printRestartGuidance } from "../src/update.js"

function mockExec(output, err) {
  return (bin, args, cb) => {
    setImmediate(() => cb(err ?? null, output ?? ""))
  }
}

test("returns null for empty tmux output", async () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-up-"))
  const result = await detectTmuxSession(dir, mockExec(""))
  assert.strictEqual(result, null)
})

test("returns session name when path matches", async () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-up-"))
  const abs = resolvePath(dir)
  const result = await detectTmuxSession(dir, mockExec(`mysession:${abs}\nother:/some/other/path`))
  assert.strictEqual(result, "mysession")
})

test("returns null when no path matches", async () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-up-"))
  const result = await detectTmuxSession(dir, mockExec("session-a:/some/other\nsession-b:/yet/another"))
  assert.strictEqual(result, null)
})

test("returns null when tmux errors", async () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-up-"))
  const result = await detectTmuxSession(dir, mockExec("", new Error("tmux not found")))
  assert.strictEqual(result, null)
})

test("resolves relative paths", async () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-up-"))
  const subDir = join(dir, "sub")
  mkdirSync(subDir, { recursive: true })
  const abs = resolvePath(subDir)
  const result = await detectTmuxSession(subDir, mockExec(`mysession:${abs}`))
  assert.strictEqual(result, "mysession")
})

test("printRestartGuidance returns empty string for null session", () => {
  assert.strictEqual(printRestartGuidance(null), "")
})

test("printRestartGuidance returns tmux attach hint for valid session", () => {
  const guidance = printRestartGuidance("my-lane")
  assert.ok(guidance.includes("tmux attach -t my-lane"))
  assert.ok(guidance.includes("Restart the TUI"))
})
