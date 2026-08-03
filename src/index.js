// Library entry — expose the public API for programmatic use.
export { ROLES, CATALOG, BUDGETS, modelFor, fallbackFor, renderCatalog, validateCachePath } from "./model-catalog.js"
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
  renderArmadaStatusCommand,
  renderArmadaScoutCommand,
  renderArmadaResumeCommand,
  renderArmadaSupervisionPlugin,
} from "./generator.js"
export { scaffold, uninstall, fillPrompt, fillTemplate } from "./scaffold.js"
export { runDoctor } from "./doctor.js"
