import { test } from "node:test"
import assert from "node:assert"
import { parseManifestYaml } from "../src/manifest.js"
import { renderOpenCodeJson, renderManifestYaml, mergeOpenCodeJson } from "../src/generator.js"
import { fetchModelEndpoints } from "../src/openrouter-api.js"

test("parseManifestYaml parses openrouter_providers string and array", () => {
  const yamlArr = `
project:
  name: test
  budget: balanced
  openrouter_providers:
    - Novita
    - DeepInfra
team:
  - role: qa
    model: opencode-go/minimax-m3
    enabled: true
`
  const parsedArr = parseManifestYaml(yamlArr)
  assert.deepStrictEqual(parsedArr.project.openrouterProviders, ["Novita", "DeepInfra"])

  const yamlStr = `
project:
  name: test
  budget: balanced
  openrouter_providers: Novita
team:
  - role: qa
    model: opencode-go/minimax-m3
    enabled: true
`
  const parsedStr = parseManifestYaml(yamlStr)
  assert.deepStrictEqual(parsedStr.project.openrouterProviders, ["Novita"])
})

test("renderOpenCodeJson includes order in options.provider when openrouterProviders is set", () => {
  const manifest = {
    project: {
      name: "test",
      budget: "balanced",
      openrouterProviders: ["Novita"],
    },
  }
  const team = [
    { role: "orchestrator", model: "openrouter/z-ai/glm-5.2", fallback: null, enabled: true },
  ]
  const opencodeJson = renderOpenCodeJson(manifest, team)
  assert.deepStrictEqual(opencodeJson.provider.openrouter.models["z-ai/glm-5.2"].options.provider, {
    allow_fallbacks: true,
    order: ["Novita"],
  })
})

test("renderManifestYaml outputs openrouter_providers block", () => {
  const manifest = {
    project: {
      name: "test",
      budget: "balanced",
      openrouterProviders: ["Novita"],
    },
  }
  const team = [
    { role: "qa", model: "opencode-go/minimax-m3", fallback: null, enabled: true },
  ]
  const yaml = renderManifestYaml(manifest, team)
  assert.match(yaml, /openrouter_providers: \["Novita"\]/)
})

test("fetchModelEndpoints retrieves provider endpoint discounts from OpenRouter API", async () => {
  const endpoints = await fetchModelEndpoints("z-ai/glm-5.2")
  assert.ok(Array.isArray(endpoints), "endpoints is an array")
  assert.ok(endpoints.length > 0, "endpoints has entries")
  const novita = endpoints.find((e) => e.providerName === "Novita")
  assert.ok(novita, "Novita provider entry found")
  assert.ok(novita.promptCostPerM > 0, "Novita prompt cost per M parsed")
})
