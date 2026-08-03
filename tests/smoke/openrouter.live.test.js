import { test } from "node:test"
import assert from "node:assert"
import { readFileSync, existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

// Live smoke tests against OpenRouter. NOT part of the fast suite (`tests/*.test.js`
// does not match `tests/smoke/`). Run explicitly when you want to prove the OpenRouter
// path works end-to-end with real credentials:
//
//   node --test 'tests/smoke/*.test.js'
//
// Skips cleanly when no OpenRouter credential is configured, so it never hard-fails CI
// or an unauthenticated machine. Uses the cheapest model available to keep cost ~zero.

const AUTH_JSON = join(homedir(), ".local/share/opencode/auth.json")

function openrouterKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY
  if (existsSync(AUTH_JSON)) {
    try {
      const auth = JSON.parse(readFileSync(AUTH_JSON, "utf8"))
      if (typeof auth?.openrouter?.key === "string" && auth.openrouter.key.length > 0) {
        return auth.openrouter.key
      }
    } catch {
      /* malformed auth.json — fall through to skip */
    }
  }
  return null
}

const KEY = openrouterKey()
const NO_KEY_REASON = "no OpenRouter credential (set OPENROUTER_API_KEY or /connect openrouter) — skipping live smoke"

async function cheapestModel() {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${KEY}` },
  })
  assert.strictEqual(res.status, 200, `models list HTTP ${res.status}`)
  const body = await res.json()
  // Sort to the cheapest TEXT chat model. Zero-cost image/video/audio models (lyria,
  // clip, etc.) and the meta-router slug ("openrouter/free") are not chat-completions
  // targets — skip them.
  const isChat = (id) =>
    !/free$|:|\b(lyria|clip|veo|imagen|tts|speech|audio|whisper|reranker|embed|video)\b/i.test(id)
  const priced = (body.data || [])
    .filter(
      (m) =>
        isChat(m.id) &&
        typeof m?.pricing?.prompt === "string" &&
        Number(m.pricing.prompt) >= 0
    )
    .map((m) => ({ id: m.id, cost: Number(m.pricing.prompt) }))
  assert.ok(priced.length > 0, "no priced chat OpenRouter models returned")
  priced.sort((a, b) => a.cost - b.cost)
  return priced[0].id
}

test("openrouter live: cheapest model answers a one-token ping", { skip: !KEY ? NO_KEY_REASON : false }, async () => {
  const model = await cheapestModel()
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    }),
  })
  assert.strictEqual(res.status, 200, `chat completions HTTP ${res.status}`)
  const body = await res.json()
  assert.ok(body.choices?.[0]?.message?.content !== undefined, "expected a completion choice")
})

test("openrouter live: catalog openrouter slugs resolve to real models", { skip: !KEY ? NO_KEY_REASON : false }, async () => {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${KEY}` },
  })
  assert.strictEqual(res.status, 200, `models list HTTP ${res.status}`)
  const body = await res.json()
  const liveIds = new Set((body.data || []).map((m) => m.id))
  const catalogSlugs = new Set()
  const { CATALOG } = await import("../../src/model-catalog.js")
  for (const e of Object.values(CATALOG)) {
    for (const id of [e.primary, e.fallback, e.free, e.power]) {
      if (typeof id === "string" && id.startsWith("openrouter/")) {
        catalogSlugs.add(id.slice("openrouter/".length))
      }
    }
  }
  const missing = [...catalogSlugs].filter((s) => !liveIds.has(s))
  assert.deepStrictEqual(missing, [], "catalog openrouter slugs that are NOT live on OpenRouter")
})
