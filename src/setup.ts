#!/usr/bin/env node
import { parseArgs } from "node:util";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import { bootstrapStart, bootstrapFinish, parseDotEnv } from "./bootstrap.js";
import { resolveDotEnvPath } from "./dotenv-path.js";

function usage(): never {
  process.stderr.write(`
Usage: pnpm setup [options]

Bootstrap an ampersend agent wallet and verify the CLI is ready.
After this, Hermes/OpenClaw agents use the \`ampersend\` CLI directly.

Options:
  --name            Agent name (required for first-time setup)
  --network         Network: base (default) or base-sepolia
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
  2. Verifies the ampersend CLI is installed (>= 0.0.22)
  3. Prints next steps for Hermes/OpenClaw usage
`);
  process.exit(0);
}

function checkCliInstalled(): { installed: boolean; version?: string } {
  try {
    const out = execSync("ampersend --version", { stdio: "pipe" }).toString().trim();
    return { installed: true, version: out };
  } catch {
    return { installed: false };
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      name: { type: "string" },
      network: { type: "string" },
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
  } else {
    process.stderr.write("[ampersend-hermes] Credentials found in .env.\n");
  }

  // Step 2: Check CLI
  process.stderr.write("[ampersend-hermes] Checking ampersend CLI...\n");
  const cli = checkCliInstalled();
  if (cli.installed) {
    process.stderr.write(
      `[ampersend-hermes] ampersend CLI found: ${cli.version}\n`,
    );
  } else {
    process.stderr.write(
      "[ampersend-hermes] ampersend CLI not found. Install it:\n" +
        "  npm install -g @ampersend_ai/ampersend-sdk@latest --force\n\n",
    );
  }

  // Step 3: Verify config
  if (cli.installed) {
    try {
      const status = execSync("ampersend config status", {
        stdio: "pipe",
      }).toString();
      if (status.includes('"status"') && status.includes('"ready"')) {
        process.stderr.write("[ampersend-hermes] Agent status: ready\n");
      } else {
        process.stderr.write(
          `[ampersend-hermes] Agent config status:\n${status}\n`,
        );
      }
    } catch {
      process.stderr.write(
        "[ampersend-hermes] Could not check agent status (CLI may need configuration).\n",
      );
    }
  }

  // Print next steps
  process.stderr.write(`
[ampersend-hermes] Setup complete. Next steps:

  For Hermes / OpenClaw agents:
    Use the ampersend CLI directly from the agent's terminal:
      ampersend fetch --inspect <url>    # check cost (no charge)
      ampersend fetch <url>              # fetch and pay x402

  For programmatic Node.js usage:
    import { getPaidFetch } from "@ampersend/hermes";
    const res = await getPaidFetch()("https://example.com/x402-endpoint");

  Canonical skill reference: https://www.ampersend.ai/skill.md
`);
}

main().catch((err: unknown) => {
  if (err instanceof Error) {
    process.stderr.write(`Error: ${err.message}\n`);
  } else {
    process.stderr.write(`Error: ${String(err)}\n`);
  }
  process.exit(1);
});
