import { z } from "zod";
import { ConfigError } from "./errors.js";

const hexString = z.string().regex(/^0x[0-9a-fA-F]+$/);

const schema = z.object({
  ampersendApiUrl: z.string().url().default("https://api.ampersend.ai"),
  ampersendAgentKey: hexString.length(66).optional(),
  ampersendAgentAccount: hexString.length(42).optional(),
  ampersendNetwork: z
    .enum(["base", "base-sepolia"])
    .default("base"),
  ampersendChainId: z.coerce.number().int().positive().optional(),
  ampersendMcpProxyPort: z.coerce.number().int().positive().default(3000),
  hermesConfigDir: z.string().default("~/.hermes"),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(
  overrides: Partial<Record<string, string | undefined>> = {},
): Config {
  const raw = { ...process.env, ...overrides };

  const chainIdDefault = raw.AMPERSEND_NETWORK === "base-sepolia" ? 84532 : 8453;

  const result = schema.safeParse({
    ampersendApiUrl: raw.AMPERSEND_API_URL,
    ampersendAgentKey: raw.AMPERSEND_AGENT_KEY,
    ampersendAgentAccount: raw.AMPERSEND_AGENT_ACCOUNT,
    ampersendNetwork: raw.AMPERSEND_NETWORK,
    ampersendChainId: raw.AMPERSEND_CHAIN_ID ?? chainIdDefault,
    ampersendMcpProxyPort: raw.AMPERSEND_MCP_PROXY_PORT,
    hermesConfigDir: raw.HERMES_CONFIG_DIR,
  });

  if (!result.success) {
    const missing = result.error.issues.map(
      (i) => `  ${i.path.join(".")}: ${i.message}`,
    );
    throw new ConfigError(
      `Invalid configuration:\n${missing.join("\n")}`,
    );
  }

  return Object.freeze(result.data);
}

/**
 * Returns true when the minimum credentials for operation are missing.
 * Use this to decide whether to run the bootstrap flow at startup.
 */
export function needsBootstrap(cfg?: Config): boolean {
  const c = cfg ?? config;
  return !c.ampersendAgentKey || !c.ampersendAgentAccount;
}

/**
 * Runtime assertion — throws ConfigError if agent key is not configured.
 */
export function requireAgentKey(cfg?: Config): string {
  const c = cfg ?? config;
  if (!c.ampersendAgentKey) {
    throw new ConfigError(
      "AMPERSEND_AGENT_KEY is required but not set. Run `pnpm bootstrap` to configure.",
    );
  }
  return c.ampersendAgentKey;
}

/**
 * Runtime assertion — throws ConfigError if agent account is not configured.
 */
export function requireAgentAccount(cfg?: Config): string {
  const c = cfg ?? config;
  if (!c.ampersendAgentAccount) {
    throw new ConfigError(
      "AMPERSEND_AGENT_ACCOUNT is required but not set. Run `pnpm bootstrap` to configure.",
    );
  }
  return c.ampersendAgentAccount;
}

export const config: Config = loadConfig();
