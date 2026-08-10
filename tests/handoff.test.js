import { test } from "node:test"
import assert from "node:assert/strict"
import { formatHandoffBlock } from "../src/handoff.js"
import { runCli } from "./helpers.js"

// --- formatHandoffBlock unit tests ---

test("formatHandoffBlock with string inputs prefixes session with voyage-", () => {
  const out = formatHandoffBlock(["doc-chat", "billing"])
  assert.match(out, /\(tmux session: voyage-doc-chat\)/)
  assert.match(out, /\(tmux session: voyage-billing\)/)
  assert.match(out, /armada voyage attach voyage-doc-chat/)
  assert.match(out, /armada voyage attach voyage-billing/)
  // voyage name itself stays as-is in the label
  assert.match(out, /- doc-chat/)
  assert.match(out, /- billing/)
})

test("formatHandoffBlock with object inputs uses session verbatim", () => {
  const out = formatHandoffBlock([
    { voyage: "doc-chat", session: "custom-session" },
    { voyage: "billing", session: "voyage-billing" },
  ])
  assert.match(out, /\(tmux session: custom-session\)/)
  assert.match(out, /\(tmux session: voyage-billing\)/)
  assert.match(out, /armada voyage attach custom-session/)
  assert.match(out, /armada voyage attach voyage-billing/)
})

test("formatHandoffBlock with mixed string and object inputs", () => {
  const out = formatHandoffBlock([
    "doc-chat",
    { voyage: "billing", session: "billing-custom" },
  ])
  assert.match(out, /\(tmux session: voyage-doc-chat\)/)
  assert.match(out, /\(tmux session: billing-custom\)/)
})

test("formatHandoffBlock with empty array returns empty string", () => {
  assert.strictEqual(formatHandoffBlock([]), "")
})

test("formatHandoffBlock with null returns empty string", () => {
  assert.strictEqual(formatHandoffBlock(null), "")
})

test("formatHandoffBlock with undefined returns empty string", () => {
  assert.strictEqual(formatHandoffBlock(undefined), "")
})

// --- voyageHandoffCmd integration tests ---

test("voyage-handoff doc-chat uses prefixed session name", async () => {
  const { stdout, code } = await runCli(["voyage-handoff", "doc-chat"])
  assert.strictEqual(code, 0)
  assert.match(stdout, /voyage-doc-chat/)
  assert.match(stdout, /armada voyage attach voyage-doc-chat/)
})

test("voyage-handoff doc-chat --session custom-session uses custom session", async () => {
  const { stdout, code } = await runCli(["voyage-handoff", "doc-chat", "--session", "custom-session"])
  assert.strictEqual(code, 0)
  assert.match(stdout, /\(tmux session: custom-session\)/)
  assert.match(stdout, /armada voyage attach custom-session/)
  assert.doesNotMatch(stdout, /voyage-doc-chat/) // not used as session for that line
})

test("voyage-handoff doc-chat --session=custom-session uses equals form", async () => {
  const { stdout, code } = await runCli(["voyage-handoff", "doc-chat", "--session=custom-session"])
  assert.strictEqual(code, 0)
  assert.match(stdout, /\(tmux session: custom-session\)/)
  assert.match(stdout, /armada voyage attach custom-session/)
})

test("voyage-handoff multiple names each get correct sessions", async () => {
  const { stdout, code } = await runCli(["voyage-handoff", "doc-chat", "--session", "s1", "billing", "--session=s2", "pricing"])
  assert.strictEqual(code, 0)
  // doc-chat gets session s1
  assert.match(stdout, /doc-chat.*\(tmux session: s1\)/)
  assert.match(stdout, /armada voyage attach s1/)
  // billing gets session voyage-billing (reset after s1 consumed)
  assert.match(stdout, /billing.*\(tmux session: voyage-billing\)/)
  // pricing gets session s2
  assert.match(stdout, /pricing.*\(tmux session: s2\)/)
})

test("voyage-handoff with no names exits 1", async () => {
  const { stdout, stderr, code } = await runCli(["voyage-handoff"])
  assert.strictEqual(code, 1)
  assert.match(stderr, /Usage:/)
  assert.strictEqual(stdout, "")
})
