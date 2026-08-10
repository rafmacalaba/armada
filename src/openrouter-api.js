// OpenRouter API helper for querying provider endpoints, pricing, and discounts.

export async function fetchModelEndpoints(modelSlug) {
  try {
    const slugWithoutPrefix = modelSlug.replace(/^openrouter\//, "").replace(/^opencode-go\//, "")
    const modelsRes = await fetch("https://openrouter.ai/api/v1/models")
    if (!modelsRes.ok) return null
    const modelsData = await modelsRes.json()
    const model = modelsData.data?.find(
      (m) => m.id === slugWithoutPrefix || m.canonical_slug === slugWithoutPrefix
    )
    if (!model) return null

    const detailsUrl = model.links?.details
      ? `https://openrouter.ai${model.links.details}`
      : `https://openrouter.ai/api/v1/models/${encodeURIComponent(model.canonical_slug || model.id)}/endpoints`

    const endpointsRes = await fetch(detailsUrl)
    if (!endpointsRes.ok) return null
    const endpointsData = await endpointsRes.json()
    const endpoints = endpointsData.data?.endpoints ?? []
    if (!endpoints.length) return null

    const parsed = endpoints.map((e) => {
      const promptCost = parseFloat(e.pricing?.prompt ?? "0") * 1_000_000
      const completionCost = parseFloat(e.pricing?.completion ?? "0") * 1_000_000
      return {
        providerName: e.provider_name,
        promptCostPerM: promptCost,
        completionCostPerM: completionCost,
        totalCostPerM: promptCost + completionCost,
        discount: e.pricing?.discount ?? 0,
        uptime: e.uptime_last_30m ?? 100,
      }
    })

    // Deduplicate by providerName, keeping lowest cost
    const map = new Map()
    for (const p of parsed) {
      if (!map.has(p.providerName) || p.totalCostPerM < map.get(p.providerName).totalCostPerM) {
        map.set(p.providerName, p)
      }
    }

    const sorted = Array.from(map.values()).sort((a, b) => a.totalCostPerM - b.totalCostPerM)
    return sorted
  } catch (_err) {
    return null
  }
}
