import { test } from "node:test"
import assert from "node:assert/strict"
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
