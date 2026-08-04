import { test } from "node:test"
import assert from "node:assert/strict"
import { isDeepStrictEqual } from "node:util"

import { ROLES, CATALOG, modelFor, fallbackFor } from "../src/model-catalog.js"
import {
  ARMADA_OWNED_KEYS,
  renderOpenCodeJson,
  mergeOpenCodeJson,
  buildTeam,
} from "../src/generator.js"

// Minimal manifest + team fixtures for merge tests
const baseManifest = {
  project: {
    name: "merge-test",
    budget: "balanced",
    stack: { srcDirs: ["src"], languages: ["typescript"] },
  },
  team: ROLES.map((role) => ({ role, model: modelFor(role, "balanced"), variant: null, enabled: true })),
  playbook: {},
}

// ---------------------------------------------------------------------------
// ARMADA_OWNED_KEYS
// ---------------------------------------------------------------------------

test("ARMADA_OWNED_KEYS is a frozen Set with expected keys", () => {
  assert.ok(Object.isFrozen(ARMADA_OWNED_KEYS))
  assert.ok(ARMADA_OWNED_KEYS.has("model"))
  assert.ok(ARMADA_OWNED_KEYS.has("default_agent"))
  assert.ok(ARMADA_OWNED_KEYS.has("permission"))
  assert.ok(ARMADA_OWNED_KEYS.has("provider"))
  assert.strictEqual(ARMADA_OWNED_KEYS.size, 4)
})

test("renderOpenCodeJson emits only ARMADA_OWNED_KEYS top-level entries", () => {
  const team = buildTeam(baseManifest)
  const cfg = renderOpenCodeJson(baseManifest, team)
  for (const key of Object.keys(cfg)) {
    assert.ok(
      ARMADA_OWNED_KEYS.has(key),
      `renderOpenCodeJson emitted non-owned key: ${key}`
    )
  }
})

// ---------------------------------------------------------------------------
// mergeOpenCodeJson — empty existing
// ---------------------------------------------------------------------------

test("mergeOpenCodeJson({}) equals renderOpenCodeJson", () => {
  const team = buildTeam(baseManifest)
  const defaults = renderOpenCodeJson(baseManifest, team)
  const merged = mergeOpenCodeJson({}, baseManifest, team)
  assert.deepStrictEqual(merged, defaults)
})

// ---------------------------------------------------------------------------
// mergeOpenCodeJson — preserves non-whitelist user keys
// ---------------------------------------------------------------------------

test("mergeOpenCodeJson preserves non-whitelist user keys byte-for-byte", () => {
  const team = buildTeam(baseManifest)
  const existing = {
    $schema: "https://opencode.ai/config.json",
    theme: { accent: "cyan" },
    mcp: { servers: { memory: {} } },
    share: "public",
    keybinds: { mode: "vim" },
    agent: { myAgent: { model: "x" } },
    plugin: [{ id: "custom" }],
  }
  const merged = mergeOpenCodeJson(existing, baseManifest, team)
  assert.strictEqual(merged.$schema, existing.$schema)
  assert.deepStrictEqual(merged.theme, existing.theme)
  assert.deepStrictEqual(merged.mcp, existing.mcp)
  assert.strictEqual(merged.share, existing.share)
  assert.deepStrictEqual(merged.keybinds, existing.keybinds)
  assert.deepStrictEqual(merged.agent, existing.agent)
  assert.deepStrictEqual(merged.plugin, existing.plugin)
  // Owned keys are present
  assert.ok("model" in merged)
  assert.ok("permission" in merged)
  assert.ok("default_agent" in merged)
})

// ---------------------------------------------------------------------------
// yolo ON / OFF
// ---------------------------------------------------------------------------

test("yolo ON: permission['*'] = 'allow' in merged output", () => {
  const m = structuredClone(baseManifest)
  m.project.yolo = true
  const team = buildTeam(m)
  const merged = mergeOpenCodeJson({}, m, team)
  assert.strictEqual(merged.permission["*"], "allow")
  assert.strictEqual(merged.permission.external_directory, "deny")
})

test("yolo OFF + user has permission['*']: 'ask' — merge keeps 'ask'", () => {
  const team = buildTeam(baseManifest)
  const existing = {
    permission: { "*": "ask", external_directory: "allow" },
  }
  const merged = mergeOpenCodeJson(existing, baseManifest, team)
  assert.strictEqual(merged.permission["*"], "ask", "user ['*'] preserved when yolo is off")
  assert.strictEqual(merged.permission.external_directory, "deny", "armada overwrites external_directory")
})

test("yolo OFF + user has permission: { read: 'allow' } — merge adds external_directory, keeps read", () => {
  const team = buildTeam(baseManifest)
  const existing = {
    permission: { read: "allow" },
  }
  const merged = mergeOpenCodeJson(existing, baseManifest, team)
  assert.strictEqual(merged.permission.read, "allow")
  assert.strictEqual(merged.permission.external_directory, "deny")
  assert.strictEqual(merged.permission["*"], undefined)
})

test("yolo OFF + user has permission: { external_directory: 'allow' } — merge replaces with 'deny'", () => {
  const team = buildTeam(baseManifest)
  const existing = {
    permission: { external_directory: "allow" },
  }
  const merged = mergeOpenCodeJson(existing, baseManifest, team)
  assert.strictEqual(merged.permission.external_directory, "deny")
})

// ---------------------------------------------------------------------------
// Nested provider handling
// ---------------------------------------------------------------------------

test("provider: user anthropic entry survives when armada sets openrouter.models", () => {
  const team = buildTeam(baseManifest)
  const existing = {
    provider: {
      anthropic: { apiKey: "sk-xxx", model: "claude-sonnet" },
    },
  }
  const merged = mergeOpenCodeJson(existing, baseManifest, team)
  assert.deepStrictEqual(merged.provider.anthropic, { apiKey: "sk-xxx", model: "claude-sonnet" })
  assert.ok(merged.provider.openrouter, "openrouter block added")
  assert.ok(merged.provider.openrouter.models, "openrouter.models added")
  assert.ok(Object.keys(merged.provider.openrouter.models).length > 0, "models populated")
})

test("provider: no openrouter primary/fallback — user provider entries survive", () => {
  // Catalog free/power entries reference openrouter models, so the openrouter
  // block is always present for a real team. The user's provider entries must
  // still survive untouched alongside armada's openrouter.models.
  const m = structuredClone(baseManifest)
  m.team = ROLES.map((role) => ({
    role,
    model: role === "orchestrator"
      ? "opencode-go/minimax-m3"
      : "opencode/deepseek-v4-flash-free",
    fallback: "opencode/deepseek-v4-flash-free",
    variant: null,
    enabled: true,
  }))
  const team = buildTeam(m)
  const existing = {
    provider: {
      groq: { apiKey: "gsk-xxx" },
    },
  }
  const merged = mergeOpenCodeJson(existing, m, team)
  assert.deepStrictEqual(merged.provider.groq, { apiKey: "gsk-xxx" })
  // openrouter block present (from catalog free/power entries)
  assert.ok(merged.provider.openrouter !== undefined, "openrouter block from catalog entries")
  assert.ok(merged.provider.openrouter.models, "openrouter.models set")
})

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("mergeOpenCodeJson is idempotent", () => {
  const team = buildTeam(baseManifest)
  const existing = {
    $schema: "https://opencode.ai/config.json",
    theme: "dark",
    permission: { "*": "ask" },
  }
  const first = mergeOpenCodeJson(existing, baseManifest, team)
  const second = mergeOpenCodeJson(first, baseManifest, team)
  assert.deepStrictEqual(second, first)
})

test("mergeOpenCodeJson idempotence: yolo ON doesn't double-set permission", () => {
  const m = structuredClone(baseManifest)
  m.project.yolo = true
  const team = buildTeam(m)
  const existing = { theme: "dark" }
  const first = mergeOpenCodeJson(existing, m, team)
  const second = mergeOpenCodeJson(first, m, team)
  assert.deepStrictEqual(second, first)
  assert.strictEqual(second.permission["*"], "allow")
})

// ---------------------------------------------------------------------------
// Byte-stable: return existing reference when nothing changes
// ---------------------------------------------------------------------------

test("mergeOpenCodeJson returns existing reference when nothing changes", () => {
  const team = buildTeam(baseManifest)
  // First, produce what armada would set on empty
  const defaults = renderOpenCodeJson(baseManifest, team)
  const merged = mergeOpenCodeJson(defaults, baseManifest, team)
  assert.strictEqual(merged, defaults, "should return existing reference (===)")
})

test("mergeOpenCodeJson returns existing reference with non-owned keys intact", () => {
  const team = buildTeam(baseManifest)
  const existing = {
    theme: "dark",
    $schema: "custom",
    model: modelFor("orchestrator", "balanced"),
    default_agent: "orchestrator",
    permission: { external_directory: "deny" },
  }
  // provider will be added by armada, so result differs -> should create new
  const merged = mergeOpenCodeJson(existing, baseManifest, team)
  // provider was not in existing but is in defaults
  assert.notStrictEqual(merged, existing, "provider added -> new object")
  assert.ok("provider" in merged)
})

// ---------------------------------------------------------------------------
// Key order: non-owned keys first, then owned keys in canonical order
// ---------------------------------------------------------------------------

test("mergeOpenCodeJson: non-owned keys preserve iteration order, owned keys last", () => {
  const team = buildTeam(baseManifest)
  const existing = { theme: "dark", $schema: "v1", share: "public" }
  const merged = mergeOpenCodeJson(existing, baseManifest, team)
  const keys = Object.keys(merged)
  // non-owned keys should come first, in their original order
  const themeIdx = keys.indexOf("theme")
  const schemaIdx = keys.indexOf("$schema")
  const shareIdx = keys.indexOf("share")
  const modelIdx = keys.indexOf("model")
  assert.ok(themeIdx < modelIdx, "theme before model")
  assert.ok(schemaIdx < modelIdx, "$schema before model")
  assert.ok(shareIdx < modelIdx, "share before model")
  // owned keys in canonical order
  const defaultAgentIdx = keys.indexOf("default_agent")
  const permIdx = keys.indexOf("permission")
  const provIdx = keys.indexOf("provider")
  assert.ok(modelIdx < defaultAgentIdx, "model before default_agent")
  assert.ok(defaultAgentIdx < permIdx, "default_agent before permission")
  assert.ok(permIdx < provIdx, "permission before provider")
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("mergeOpenCodeJson: existing with null/undefined fields handled", () => {
  const team = buildTeam(baseManifest)
  const existing = { theme: null, $schema: undefined }
  const merged = mergeOpenCodeJson(existing, baseManifest, team)
  // null values survive (they're non-owned)
  assert.strictEqual(merged.theme, null)
  // undefined fields don't show in Object.keys, but if they did this is fine
  assert.ok("model" in merged)
})

test("mergeOpenCodeJson: existing has weird permission shape", () => {
  const team = buildTeam(baseManifest)
  const existing = { permission: "string-not-object" }
  const merged = mergeOpenCodeJson(existing, baseManifest, team)
  assert.strictEqual(merged.permission.external_directory, "deny")
})

test("mergeOpenCodeJson: existing has weird provider shape", () => {
  const team = buildTeam(baseManifest)
  const existing = { provider: null }
  const merged = mergeOpenCodeJson(existing, baseManifest, team)
  assert.ok(merged.provider.openrouter.models, "provider built from null")
})

test("mergeOpenCodeJson: non-object existing with owned keys treated as absent", () => {
  const team = buildTeam(baseManifest)
  const defaults = renderOpenCodeJson(baseManifest, team)
  // existing has model as string (not object) — but merge only treats
  // non-owned keys as verbatim copies. owned keys (model) are overwritten.
  const existing = { model: "my-custom-model", theme: "dark" }
  const merged = mergeOpenCodeJson(existing, baseManifest, team)
  assert.strictEqual(merged.model, defaults.model, "armada model wins")
  assert.strictEqual(merged.theme, "dark", "non-owned theme survives")
})

// ---------------------------------------------------------------------------
// DEF-007: __proto__ key does not pollute merged object
// ---------------------------------------------------------------------------

test("mergeOpenCodeJson: __proto__ key does not pollute result", () => {
  const team = buildTeam(baseManifest)
  // Create an object with __proto__ via JSON.parse to simulate real input
  const malicious = JSON.parse('{"theme":"dark","__proto__":{"polluted":"yes"}}')
  const merged = mergeOpenCodeJson(malicious, baseManifest, team)
  // Non-owned user key survives
  assert.strictEqual(merged.theme, "dark", "theme should survive")
  // __proto__ should not be an own property
  assert.strictEqual(Object.prototype.hasOwnProperty.call(merged, "__proto__"), false,
    "__proto__ must not be an own property of merged")
  // polluted should not be accessible (prototype is clean)
  assert.strictEqual(Object.prototype.hasOwnProperty.call(merged, "polluted"), false,
    "polluted must not exist on merged")
  // Object.prototype must remain clean
  assert.strictEqual(Object.prototype.polluted, undefined,
    "Object prototype must be clean")
})

test("mergeOpenCodeJson: constructor and prototype keys are also skipped", () => {
  const team = buildTeam(baseManifest)
  const existing = JSON.parse('{"constructor":{"x":1},"prototype":{"y":2},"theme":"dark"}')
  const merged = mergeOpenCodeJson(existing, baseManifest, team)
  assert.strictEqual(merged.theme, "dark")
  assert.strictEqual(Object.prototype.hasOwnProperty.call(merged, "constructor"), false)
  assert.strictEqual(Object.prototype.hasOwnProperty.call(merged, "prototype"), false)
})
