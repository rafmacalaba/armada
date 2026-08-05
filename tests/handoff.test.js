import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { formatHandoffBlock } from "../src/handoff.js"

test("formatHandoffBlock: single session", () => {
  const result = formatHandoffBlock(["foo"])
  const expected = `--- HANDOFF ---
Voyages dispatched this turn:
  - foo  (tmux session: foo)  attach: armada voyage attach foo
Current window: free \u2014 hand off here.
--- END HANDOFF ---`
  assert.equal(result, expected)
})

test("formatHandoffBlock: multiple sessions", () => {
  const result = formatHandoffBlock(["foo", "bar", "baz"])
  const expected = `--- HANDOFF ---
Voyages dispatched this turn:
  - foo  (tmux session: foo)  attach: armada voyage attach foo
  - bar  (tmux session: bar)  attach: armada voyage attach bar
  - baz  (tmux session: baz)  attach: armada voyage attach baz
Current window: free \u2014 hand off here.
--- END HANDOFF ---`
  assert.equal(result, expected)
})

test("formatHandoffBlock: zero sessions returns empty string", () => {
  const result = formatHandoffBlock([])
  assert.equal(result, "")
})

test("armada voyage attach <name>: prints tmux attach command, exit 0", () => {
  const cli = join(process.cwd(), "src", "cli.js")
  const result = spawnSync(process.execPath, [cli, "voyage", "attach", "foo"], { encoding: "utf8" })
  assert.equal(result.status, 0, `exit ${result.status}: ${result.stderr}`)
  assert.equal(result.stdout.trim(), "tmux attach -t 'foo'")
})

test("armada voyage attach (no name): prints usage to stderr, exit 1", () => {
  const cli = join(process.cwd(), "src", "cli.js")
  const result = spawnSync(process.execPath, [cli, "voyage", "attach"], { encoding: "utf8" })
  assert.equal(result.status, 1, `exit ${result.status}`)
  assert.ok(result.stderr.includes("Usage:"), `expected usage on stderr, got: ${result.stderr}`)
})

test("armada help: voyage-handoff line has 2-space indent", () => {
  const cli = join(process.cwd(), "src", "cli.js")
  const result = spawnSync(process.execPath, [cli, "help"], { encoding: "utf8" })
  assert.equal(result.status, 0, `help failed: ${result.stderr}`)
  const expected = "  armada voyage-handoff <name> [<name>...]  print handoff block for dispatched voyages"
  const found = result.stdout.split("\n").find(line => line.includes("voyage-handoff"))
  assert.equal(found, expected, `expected "${expected}", got "${found}"`)
})
