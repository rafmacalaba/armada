// Library entry — expose the public API for programmatic use.
export { ROLES, CATALOG, BUDGETS, modelFor, fallbackFor, renderCatalog, validateCachePath, listOpenRouterModels, renderOpenRouterModels } from "./model-catalog.js"
export { detectStack, formatStack } from "./stack-detect.js"
export { runQuestionnaire } from "./questionnaire.js"
export {
  buildTeam,
  renderAgentFile,
  renderOpenCodeJson,
  renderAgentsMd,
  renderRequirementsMd,
  renderManifestYaml,
  renderArmadaCommand,
  renderArmadaScoutCommand,
  renderArmadaResumeCommand,
  renderArmadaVoyageCommand,
  renderArmadaSupervisionPlugin,
} from "./generator.js"
export { scaffold, uninstall, fillPrompt, fillTemplate } from "./scaffold.js"
export { runDoctor } from "./doctor.js"
export { renderInitSummary } from "./init-summary.js"
export { startHeartbeat, tickHeartbeat } from "./heartbeat.js"
export { classifyRisk, selectAgents, evidencePolicy, readyPhaseIds, groupFindings, dispositionFinding } from "./workflow-policy.js"
