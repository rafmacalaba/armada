import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { formatHandoffBlock } from "../src/handoff.js"

test("formatHandoffBlock: single session", () => {
  const result = formatHandoffBlock(["foo"])
  const expected = `--- HANDOFF ---
Voyages dispatched this turn:
  - foo  (tmux session: foo)  attach: armada voyage --print-attach foo
Current window: free \u2014 hand off here.
--- END HANDOFF ---`
  assert.equal(result, expected)
})

test("formatHandoffBlock: multiple sessions", () => {
  const result = formatHandoffBlock(["foo", "bar", "baz"])
  const expected = `--- HANDOFF ---
Voyages dispatched this turn:
  - foo  (tmux session: foo)  attach: armada voyage --print-attach foo
  - bar  (tmux session: bar)  attach: armada voyage --print-attach bar
  - baz  (tmux session: baz)  attach: armada voyage --print-attach baz
Current window: free \u2014 hand off here.
--- END HANDOFF ---`
  assert.equal(result, expected)
})

test("formatHandoffBlock: zero sessions returns empty string", () => {
  const result = formatHandoffBlock([])
  assert.equal(result, "")
})

test("armada help: voyage-handoff line has 2-space indent", () => {
  const cli = join(process.cwd(), "src", "cli.js")
  const result = spawnSync(process.execPath, [cli, "help"], { encoding: "utf8" })
  assert.equal(result.status, 0, `help failed: ${result.stderr}`)
  const expected = "  armada voyage-handoff <name> [<name>...]  print handoff block for dispatched voyages"
  const found = result.stdout.split("\n").find(line => line.includes("voyage-handoff"))
  assert.equal(found, expected, `expected "${expected}", got "${found}"`)
})
