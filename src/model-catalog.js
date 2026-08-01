// opencode-armada model catalog
//
// Curated, static model recommendations per role. Each role has:
//   - primary:    opencode / opencode-go / opencode-zen model (preferred provider)
//   - fallback:   openrouter model with equivalent capability (used when the
//                 opencode provider is unavailable, or as a /preset power bump)
//
// Budget tiers:
//   free      - only opencode *-free models and cheapest openrouter equivalents
//   balanced  - free workers, paid reviewers/judges where it matters (default)
//   power     - strongest models on every role
//
// Model names are opencode-style `provider/model` IDs. Keep this file in sync
// with docs/SPEC.md#model-catalog and presets/*.yaml.

export const ROLES = [
  "orchestrator",
  "backend-dev",
  "frontend-dev",
  "qa",
  "adversary",
  "security",
  "docs",
  "architect",
]

export const CATALOG = {
  orchestrator: {
    label: "Delivery lead / scheduler",
    primary: "opencode-go/minimax-m3",
    variant: "thinking",
    fallback: "openrouter/z-ai/glm-5.2",
    free: "opencode/hy3-free",
    power: "openrouter/anthropic/claude-sonnet-4.6",
    reasoning: "strong judgment, delegation, reconciliation",
  },
  "backend-dev": {
    label: "Backend implementation",
    primary: "opencode-go/kimi-k2.7-code",
    fallback: "openrouter/z-ai/glm-5.2",
    free: "opencode/deepseek-v4-flash-free",
    power: "openrouter/z-ai/glm-5.2",
    reasoning: "server, API, storage, seed data, backend unit tests",
  },
  "frontend-dev": {
    label: "Frontend implementation",
    primary: "opencode-go/minimax-m3",
    fallback: "openrouter/minimax/minimax-m3",
    free: "opencode/mimo-v2.5-free",
    power: "openrouter/minimax/minimax-m3",
    reasoning: "UI/UX implementation, visual polish, frontend unit tests",
  },
  qa: {
    label: "Quality assurance",
    primary: "opencode/mimo-v2.5-free",
    fallback: "openrouter/xiaomi/mimo-v2.5",
    free: "opencode/mimo-v2.5-free",
    power: "openrouter/xiaomi/mimo-v2.5",
    reasoning: "e2e tests, screenshots, DEFECTS.md ownership, retesting",
  },
  adversary: {
    label: "Adversarial reviewer",
    primary: "opencode/deepseek-v4-pro",
    fallback: "openrouter/deepseek/deepseek-v4-pro",
    free: "opencode/deepseek-v4-flash-free",
    power: "openrouter/deepseek/deepseek-v4-pro",
    reasoning: "hostile user simulation, break the running app, ADVERSARIAL_REVIEW.md",
  },
  security: {
    label: "Security auditor",
    primary: "opencode/big-pickle",
    fallback: "openrouter/deepseek/deepseek-v4-pro",
    free: "opencode/big-pickle",
    power: "openrouter/deepseek/deepseek-v4-pro",
    reasoning: "vulnerability review, auth/authz, data exposure, dependency risk",
  },
  docs: {
    label: "Technical writer",
    primary: "opencode/deepseek-v4-flash-free",
    fallback: "openrouter/minimax/minimax-m3",
    free: "opencode/deepseek-v4-flash-free",
    power: "openrouter/minimax/minimax-m3",
    reasoning: "README, API docs, changelog, maintainable documentation",
  },
  architect: {
    label: "Architecture / code review",
    primary: "opencode/big-pickle",
    fallback: "openrouter/z-ai/glm-5.2",
    free: "opencode/big-pickle",
    power: "openrouter/z-ai/glm-5.2",
    reasoning: "architecture, refactor risk, cross-cutting design, review",
  },
}

export const BUDGETS = ["free", "balanced", "power"]

export function modelFor(role, budget = "balanced") {
  const entry = CATALOG[role]
  if (!entry) throw new Error(`Unknown role: ${role}`)
  if (budget === "power") return entry.power ?? entry.fallback
  if (budget === "free") return entry.free ?? entry.primary
  return entry.primary
}

export function fallbackFor(role) {
  return CATALOG[role].fallback
}

// Render a two-column "role -> primary / fallback" table for `armada models`.
export function renderCatalog(budget = "balanced") {
  const rows = ROLES.map((role) => {
    const e = CATALOG[role]
    return [
      role.padEnd(14),
      (modelFor(role, budget) || "").padEnd(38),
      e.fallback || "",
    ]
  })
  const header = ["role".padEnd(14), "model".padEnd(38), "fallback"]
  return [header.join("  "), rows.map((r) => r.join("  ")).join("\n")].join("\n")
}
