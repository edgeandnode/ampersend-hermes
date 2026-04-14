import {
  ApiClient,
  AmpersendManagementClient,
  ApprovalClient,
} from "@ampersend_ai/ampersend-sdk/ampersend";
import {
  createAmpersendTreasurer,
  createAmpersendHttpClient,
  type X402Treasurer,
  type AmpersendTreasurerConfig,
} from "@ampersend_ai/ampersend-sdk";
import { wrapFetchWithPayment } from "@x402/fetch";
import { config, requireAgentKey, requireAgentAccount } from "./config.js";

let _apiClient: ApiClient | null = null;
let _approvalClient: ApprovalClient | null = null;
let _paidFetch: ReturnType<typeof wrapFetchWithPayment> | null = null;

/**
 * Supported ampersend REST API surface from {@link getApiClient}.
 * The raw SDK `ApiClient` has a private `fetch` for ampersend API paths only; it is **not**
 * exposed here so callers cannot mistake it for x402 `fetch` to arbitrary URLs.
 */
export type AmpersendRestClient = Pick<
  InstanceType<typeof ApiClient>,
  | "authorizePayment"
  | "reportPaymentEvent"
  | "clearAuth"
  | "getAgentAddress"
  | "isAuthenticated"
>;

function getOrCreateAmpersendApiClient(): ApiClient {
  if (!_apiClient) {
    _apiClient = new ApiClient({
      baseUrl: config.ampersendApiUrl,
      sessionKeyPrivateKey: requireAgentKey() as `0x${string}`,
      agentAddress: requireAgentAccount() as `0x${string}`,
      timeout: 30_000,
    });
  }
  return _apiClient;
}

/**
 * Returns a thin handle for the ampersend REST API (authorize/report auth state).
 * For x402-paid HTTP to arbitrary URLs, use {@link getPaidFetch} or the `ampersend fetch` CLI.
 */
export function getApiClient(): AmpersendRestClient {
  const inner = getOrCreateAmpersendApiClient();
  return {
    authorizePayment: (req, ctx) => inner.authorizePayment(req, ctx),
    reportPaymentEvent: (eventId, payment, event) =>
      inner.reportPaymentEvent(eventId, payment, event),
    clearAuth: () => inner.clearAuth(),
    getAgentAddress: () => inner.getAgentAddress(),
    isAuthenticated: () => inner.isAuthenticated(),
  };
}

/**
 * Returns a `fetch` that can pay x402-protected URLs (same stack as `ampersend fetch`).
 */
export function getPaidFetch(): ReturnType<typeof wrapFetchWithPayment> {
  if (!_paidFetch) {
    const x402Client = createAmpersendHttpClient({
      smartAccountAddress: requireAgentAccount() as `0x${string}`,
      sessionKeyPrivateKey: requireAgentKey() as `0x${string}`,
      apiUrl: config.ampersendApiUrl,
      network: config.ampersendNetwork,
    });
    _paidFetch = wrapFetchWithPayment(fetch, x402Client);
  }
  return _paidFetch;
}

/**
 * Returns a singleton ApprovalClient for the setup/approval flow.
 * Does not require authentication — used before credentials exist.
 */
export function getApprovalClient(): ApprovalClient {
  if (!_approvalClient) {
    _approvalClient = new ApprovalClient({
      apiUrl: config.ampersendApiUrl,
    });
  }
  return _approvalClient;
}

/**
 * Creates an AmpersendTreasurer that consults the ampersend API before
 * making payments. This is the primary integration point for x402 payments.
 */
export function createTreasurer(
  overrides?: Partial<AmpersendTreasurerConfig>,
): X402Treasurer {
  return createAmpersendTreasurer({
    smartAccountAddress: requireAgentAccount() as `0x${string}`,
    sessionKeyPrivateKey: requireAgentKey() as `0x${string}`,
    apiUrl: config.ampersendApiUrl,
    chainId: config.ampersendChainId ?? (config.ampersendNetwork === "base-sepolia" ? 84532 : 8453),
    ...overrides,
  });
}

/**
 * Creates a ManagementClient for agent CRUD operations.
 * Requires an API key (separate from session key auth).
 */
export function createManagementClient(apiKey: string): AmpersendManagementClient {
  return new AmpersendManagementClient({
    apiKey,
    apiUrl: config.ampersendApiUrl,
  });
}
