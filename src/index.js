// Library entry — expose the public API for programmatic use.
export { ROLES, CATALOG, BUDGETS, modelFor, fallbackFor, renderCatalog } from "./model-catalog.js"
export { detectStack, formatStack } from "./stack-detect.js"
export { runQuestionnaire } from "./questionnaire.js"
export { buildTeam, renderAgentFile, renderOpenCodeJson, renderAgentsMd, renderRequirementsMd, renderManifestYaml } from "./generator.js"
export { scaffold, fillPrompt, fillTemplate } from "./scaffold.js"
