// Config
export {
  loadConfig,
  needsBootstrap,
  requireAgentKey,
  requireAgentAccount,
  type Config,
} from "./config.js";

// Clients
export {
  getApiClient,
  getApprovalClient,
  createTreasurer,
  createManagementClient,
} from "./client.js";

// Errors
export {
  ConfigError,
  PaymentError,
  AgentError,
  SpendLimitViolationError,
} from "./errors.js";
export type { SpendLimitViolationCode } from "./errors.js";

// Dotenv
export { resolveDotEnvPath, packageRootEnvPath } from "./dotenv-path.js";

// Bootstrap
export {
  bootstrapStart,
  bootstrapFinish,
  isBootstrapComplete,
  parseDotEnv,
  type BootstrapStartOptions,
  type BootstrapFinishOptions,
  type BootstrapCompleteResult,
  type BootstrapPendingResult,
  type BootstrapResult,
} from "./bootstrap.js";

// MCP
export {
  buildMcpEntry,
  patchHermesConfig,
  patchHermesModel,
  unpatchHermesModel,
  buildHermesMcpServerEntry,
  buildHermesStdioMcpEntry,
  HERMES_AMPERSEND_SERVER_KEY,
  type HermesMcpEntry,
  type PatchHermesOptions,
  type PatchHermesModelOptions,
  type HermesMcpTransport,
} from "./mcp/index.js";

// Payment
export {
  authorizePayment,
  reportPaymentEvent,
  getTreasurer,
  validatePayment,
  recentPayments,
  type PaymentAuthorizationRequest,
  type PaymentAuthorizationResult,
  type PaymentRequirement,
  type PaymentEventType,
  type SpendPolicy,
  type PaymentRecord,
} from "./payment/index.js";

// Payment guardrails
export { buildSpendPolicy } from "./payment/guardrails.js";

// Agents
export {
  requestAgentApproval,
  checkApprovalStatus,
  waitForApproval,
  getAgentStatus,
  type AgentSetupRequest,
  type AgentApprovalPending,
  type AgentApprovalResolved,
  type AgentApprovalRejected,
  type AgentApprovalStatus,
} from "./agents/index.js";
