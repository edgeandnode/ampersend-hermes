#!/usr/bin/env node
import { parseArgs } from "node:util";
import { execSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrapStart, bootstrapFinish, parseDotEnv } from "./bootstrap.js";
import { patchHermesConfig } from "./mcp/hermes-config.js";
import { resolveDotEnvPath } from "./dotenv-path.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");

function usage(): never {
  process.stderr.write(`
Usage: pnpm setup [options]

All-in-one: bootstrap agent → build → verify MCP tool → patch Hermes config.
After this, switch to Hermes and run /reload-mcp.

Options:
  --name            Agent name (required for first-time setup)
  --network         Network: base (default) or base-sepolia
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
  2. Builds the package (pnpm build)
  3. Verifies the paid_fetch MCP tool starts correctly
  4. Patches ~/.hermes/config.yaml → mcp_servers.ampersend (stdio MCP tool)

Switch back to Hermes and run /reload-mcp. Done.
`);
  process.exit(0);
}

function smokeTestMcpShim(envVars: Record<string, string>): Promise<void> {
  const shimPath = path.resolve(packageRoot, "dist/mcp/fetch-server.js");
  if (!fs.existsSync(shimPath)) {
    return Promise.reject(
      new Error(`MCP shim not found at ${shimPath}. Build may have failed.`),
    );
  }

  const initMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke-test", version: "0.0.1" },
    },
  });
  const notifyMsg = JSON.stringify({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });
  const listMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });

  const input = `${initMsg}\n${notifyMsg}\n${listMsg}\n`;

  const child = spawn(process.execPath, [shimPath], {
    env: { ...process.env, ...envVars },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
  child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

  child.stdin.write(input);
  child.stdin.end();

  const killTimer = setTimeout(() => {
    child.kill("SIGTERM");
  }, 10_000);

  return new Promise<void>((resolve, reject) => {
    child.on("close", (code) => {
      clearTimeout(killTimer);
      if (stdout.includes('"paid_fetch"')) {
        resolve();
      } else {
        reject(
          new Error(
            `MCP shim smoke test failed (exit ${code}).\n` +
              `Expected "paid_fetch" in tools/list response.\n` +
              `stdout: ${stdout.slice(0, 500)}\n` +
              `stderr: ${stderr.slice(0, 500)}`,
          ),
        );
      }
    });
    child.on("error", (err) => {
      clearTimeout(killTimer);
      reject(new Error(`Failed to spawn MCP shim: ${err.message}`));
    });
  });
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      name: { type: "string" },
      network: { type: "string" },
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
  const envPath = values["env-path"] ?? resolveDotEnvPath({});
  const apiUrl = values["api-url"];

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

    process.stderr.write(
      `\n[ampersend-hermes] Approval URL: ${startResult.userApproveUrl}\n`,
    );
    process.stderr.write(
      "[ampersend-hermes] Waiting for user approval...\n\n",
    );

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

  if (parsed.AMPERSEND_AGENT_KEY)
    process.env.AMPERSEND_AGENT_KEY = parsed.AMPERSEND_AGENT_KEY;
  if (parsed.AMPERSEND_AGENT_ACCOUNT)
    process.env.AMPERSEND_AGENT_ACCOUNT = parsed.AMPERSEND_AGENT_ACCOUNT;
  if (parsed.AMPERSEND_API_URL)
    process.env.AMPERSEND_API_URL = parsed.AMPERSEND_API_URL;
  if (values.network) process.env.AMPERSEND_NETWORK = values.network;

  // Step 2: Build to ensure dist/mcp/fetch-server.js exists
  process.stderr.write("[ampersend-hermes] Building package...\n");
  try {
    execSync("pnpm build", { cwd: packageRoot, stdio: "pipe" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`[ampersend-hermes] Build failed: ${msg}\n`);
    process.exit(1);
  }
  process.stderr.write("[ampersend-hermes] Build complete.\n");

  // Step 3: Smoke-test the MCP shim
  process.stderr.write("[ampersend-hermes] Verifying paid_fetch MCP tool...\n");
  const shimEnv: Record<string, string> = {
    AMPERSEND_AGENT_KEY: parsed.AMPERSEND_AGENT_KEY ?? "",
    AMPERSEND_AGENT_ACCOUNT: parsed.AMPERSEND_AGENT_ACCOUNT ?? "",
    AMPERSEND_API_URL: parsed.AMPERSEND_API_URL ?? "https://api.ampersend.ai",
    AMPERSEND_NETWORK: values.network ?? parsed.AMPERSEND_NETWORK ?? "base",
  };
  await smokeTestMcpShim(shimEnv);
  process.stderr.write("[ampersend-hermes] paid_fetch tool verified.\n");

  // Step 4: Patch Hermes config
  process.stderr.write("[ampersend-hermes] Patching Hermes MCP config...\n");
  await patchHermesConfig(hermesDir);
  process.stderr.write(
    "[ampersend-hermes] Hermes config patched → mcp_servers.ampersend\n",
  );
  process.stderr.write(
    "\n[ampersend-hermes] Done. Switch to Hermes and run /reload-mcp.\n",
  );
}

main().catch((err: unknown) => {
  if (err instanceof Error) {
    process.stderr.write(`Error: ${err.message}\n`);
  } else {
    process.stderr.write(`Error: ${String(err)}\n`);
  }
  process.exit(1);
});
