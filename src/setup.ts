#!/usr/bin/env node
import { parseArgs } from "node:util";
import { bootstrapStart, bootstrapFinish } from "./bootstrap.js";
import { patchHermesConfig } from "./mcp/hermes-config.js";
import { loadConfig } from "./config.js";
import { resolveDotEnvPath } from "./dotenv-path.js";
import { parseDotEnv } from "./bootstrap.js";
import * as fs from "node:fs";

function usage(): never {
  process.stderr.write(`
Usage: pnpm setup [options]

All-in-one: bootstrap agent → patch Hermes MCP config → start proxy.
After this, switch to Hermes and run /reload-mcp.

Options:
  --name            Agent name (required for first-time setup)
  --network         Network: base (default) or base-sepolia
  --proxy-port      MCP proxy port (default: 3000)
  --no-proxy        Patch configs only, don't start the proxy
  --hermes-dir      Hermes config directory (default: ~/.hermes)
  --env-path        Path to .env file
  --api-url         API URL override
  --daily-limit     Daily spending limit in atomic units
  --monthly-limit   Monthly spending limit
  --per-tx-limit    Per-transaction spending limit
  --auto-topup      Allow automatic balance top-up
  -h, --help        Show this help

Flow:
  1. Reads AMPERSEND_AGENT_KEY + AMPERSEND_AGENT_ACCOUNT from .env
     (runs bootstrap start/finish if missing)
  2. Patches ~/.hermes/config.yaml → mcp_servers.ampersend (stdio MCP proxy)
  3. Starts the MCP proxy → waits for ready → prints "ready"
  4. Keeps running (Ctrl+C to stop)

Switch back to Hermes and run /reload-mcp. Done.
`);
  process.exit(0);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      name: { type: "string" },
      network: { type: "string" },
      "proxy-port": { type: "string" },
      "no-proxy": { type: "boolean" },
      "hermes-dir": { type: "string" },
      "env-path": { type: "string" },
      "api-url": { type: "string" },
      "daily-limit": { type: "string" },
      "monthly-limit": { type: "string" },
      "per-tx-limit": { type: "string" },
      "auto-topup": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });

  if (values.help) usage();

  const hermesDir = values["hermes-dir"] ?? "~/.hermes";
  const proxyPort = values["proxy-port"] ? parseInt(values["proxy-port"], 10) : 3000;
  const envPath = values["env-path"] ?? resolveDotEnvPath({});
  const apiUrl = values["api-url"];
  const startProxy = !values["no-proxy"];

  // Step 1: Check if bootstrap is needed
  let hasCredentials = false;
  if (fs.existsSync(envPath)) {
    const raw = await fs.promises.readFile(envPath, "utf-8");
    const parsed = parseDotEnv(raw);
    hasCredentials = !!(
      parsed.AMPERSEND_AGENT_KEY?.startsWith("0x") &&
      parsed.AMPERSEND_AGENT_ACCOUNT?.startsWith("0x")
    );
  }

  if (!hasCredentials) {
    const agentName = values.name;
    if (!agentName) {
      process.stderr.write(
        "Error: --name is required for first-time setup. Run:\n" +
        "  pnpm setup --name my-hermes-agent\n",
      );
      process.exit(1);
    }

    process.stderr.write("[ampersend-hermes] Starting bootstrap...\n");

    const startResult = await bootstrapStart({
      agentName,
      apiUrl,
      envPath,
      network: values.network,
      dailyLimit: values["daily-limit"],
      monthlyLimit: values["monthly-limit"],
      perTransactionLimit: values["per-tx-limit"],
      autoTopup: values["auto-topup"],
    });

    process.stderr.write(`\n[ampersend-hermes] Approval URL: ${startResult.userApproveUrl}\n`);
    process.stderr.write("[ampersend-hermes] Waiting for user approval...\n\n");

    await bootstrapFinish({
      envPath,
      apiUrl,
      force: true,
    });

    process.stderr.write("[ampersend-hermes] Bootstrap complete.\n\n");
  }

  // Reload config from .env after bootstrap
  const raw = await fs.promises.readFile(envPath, "utf-8");
  const parsed = parseDotEnv(raw);

  // Set env vars so config picks them up
  if (parsed.AMPERSEND_AGENT_KEY) process.env.AMPERSEND_AGENT_KEY = parsed.AMPERSEND_AGENT_KEY;
  if (parsed.AMPERSEND_AGENT_ACCOUNT) process.env.AMPERSEND_AGENT_ACCOUNT = parsed.AMPERSEND_AGENT_ACCOUNT;
  if (parsed.AMPERSEND_API_URL) process.env.AMPERSEND_API_URL = parsed.AMPERSEND_API_URL;
  if (values.network) process.env.AMPERSEND_NETWORK = values.network;

  // Step 2: Patch Hermes config
  process.stderr.write("[ampersend-hermes] Patching Hermes MCP config...\n");
  await patchHermesConfig(hermesDir, {
    transport: startProxy ? "http" : "stdio",
    proxyPort,
  });
  process.stderr.write(`[ampersend-hermes] Hermes config patched → mcp_servers.ampersend\n`);

  if (!startProxy) {
    process.stderr.write(
      "\n[ampersend-hermes] Config patched (stdio). Switch to Hermes and run /reload-mcp.\n",
    );
    return;
  }

  // Step 3: Start MCP proxy
  process.stderr.write(`[ampersend-hermes] Starting MCP proxy on port ${proxyPort}...\n`);

  const cfg = loadConfig();

  const { createAmpersendProxy } = await import("@ampersend_ai/ampersend-sdk");

  const chainId = cfg.ampersendChainId ??
    (cfg.ampersendNetwork === "base-sepolia" ? 84532 : 8453);

  const { server } = await createAmpersendProxy({
    port: proxyPort,
    smartAccountAddress: cfg.ampersendAgentAccount as `0x${string}`,
    sessionKeyPrivateKey: cfg.ampersendAgentKey as `0x${string}`,
    apiUrl: cfg.ampersendApiUrl,
    chainId,
  });

  process.stderr.write(`\n[ampersend-hermes] MCP proxy ready at http://127.0.0.1:${proxyPort}/mcp\n`);
  process.stderr.write("[ampersend-hermes] Switch to Hermes and run /reload-mcp\n\n");

  const shutdown = () => {
    process.stderr.write("\n[ampersend-hermes] Shutting down...\n");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err: unknown) => {
  if (err instanceof Error) {
    process.stderr.write(`Error: ${err.message}\n`);
  } else {
    process.stderr.write(`Error: ${String(err)}\n`);
  }
  process.exit(1);
});
