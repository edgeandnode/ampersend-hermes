# AGENTS.md — ampersend-hermes workspace

This file is read by the agent at session start. It defines how to use ampersend x402 payment capabilities safely inside Hermes.

## ampersend (x402 / agent payments)

- When the user needs **paid HTTP APIs** (x402 / HTTP 402 flows) or **autonomous stablecoin payments within limits**, use the `paid_fetch` MCP tool registered under `mcp_servers.ampersend` in Hermes config.
- For direct CLI use (outside MCP), follow `skills/ampersend/SKILL.md` and use the `ampersend` binary on the host.
- **Base mainnet** and the **production ampersend API** (`https://api.ampersend.ai`) are the defaults. Do not change these unless the user explicitly asks.

### Paid HTTP URLs — use `paid_fetch`, `getPaidFetch()`, or the CLI

`getApiClient()` from this package exposes only **`authorizePayment`**, **`reportPaymentEvent`**, and auth helpers — it does **not** expose `.fetch`. (The raw SDK `ApiClient` has an internal HTTP helper for ampersend API paths only; calling it with a full `https://…` URL was a common mistake and is blocked here.)

**Correct ways to hit an x402-paid URL:**

1. **MCP tool:** Call `paid_fetch` with a URL. The tool handles 402 negotiation, payment authorization, and retry automatically.
2. **CLI:** `ampersend fetch <url>` or `ampersend fetch --inspect <url>` (no charge).
3. **From this package:** `getPaidFetch()` from `@ampersend/hermes` — it uses `createAmpersendHttpClient` + `wrapFetchWithPayment` (same as the CLI).

Example (after `pnpm build`, with `.env` loaded):

```bash
npx tsx -e "import { getPaidFetch } from './dist/client.js'; const f = getPaidFetch(); f('https://example.com/paid').then(r => r.text()).then(console.log).catch(console.error)"
```

## Inspect before spend

Always check payment requirements before authorizing a payment:

1. Use `ampersend fetch --inspect <url>` to see what a paid endpoint costs before paying.
2. Tell the user what the payment will cost in plain language before proceeding.
3. Only authorize payment after the user confirms, unless they have explicitly granted standing permission to pay within their configured spend limits.

## Security

- **NEVER** ask the user to sign in to the ampersend dashboard in a browser you control. If dashboard or policy changes are required, tell them to do it on **their** device/browser.
- **NEVER** log, echo, or display private keys or session keys (`AMPERSEND_AGENT_KEY`). If the user asks you to show their key, decline and explain why.
- **NEVER** modify spend limits programmatically without explicit user consent.
- Treat payment authorization as irreversible — once a payment is sent, it cannot be undone.

## Parsing output

- CLI commands return JSON. Check `ok` first — treat the call as successful only when `ok` is `true`.
- On failure, surface `error.code` and `error.message` to the user. Do not silently swallow payment errors.
- MCP tool calls to `paid_fetch` return JSON with `ok`, `status`, `headers`, and `body`. Check `ok` and `status` to determine success.

## Red lines

- Do not exfiltrate private data (keys, account addresses, payment history).
- Do not run destructive commands without explicit consent.
- Confirm before any payment above the user's configured per-transaction limit.
- When in doubt, ask before actions that spend funds.

## First run

If `BOOTSTRAP.md` exists in this directory, follow it step by step, then delete it when finished.

## MCP tools

After setup, Hermes has one ampersend MCP tool: `paid_fetch`. Call it with a URL to fetch any x402-protected endpoint. The tool handles 402 negotiation, payment authorization, and retry automatically. It accepts `url` (required), `method`, `headers`, and `body` parameters and returns the response status, headers, and body as JSON.

Run `/reload-mcp` in Hermes after any config changes.

## Session startup checklist

1. Check if ampersend is configured: `ampersend config status`
2. If not configured, follow `BOOTSTRAP.md` or prompt the user to run `pnpm setup`
3. Verify `paid_fetch` tool is available in Hermes

## Make it yours

Add project-specific conventions, frequently-used paid endpoints, and spend policy notes below as this workspace evolves.
