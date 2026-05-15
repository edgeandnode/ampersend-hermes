---
name: ampersend
description: ampersend CLI and MCP tool for agent payments via x402
metadata: { "openclaw": { "requires": { "bins": ["ampersend"] } } }
---

# ampersend — CLI + MCP skill for Hermes

ampersend enables autonomous agent payments. Agents can make payments within user-defined spending limits without requiring human approval for each transaction. Payments use stablecoins (USDC) on Base mainnet via the x402 protocol.

This skill requires `ampersend` v0.0.16. Run `ampersend --version` to check your installed version.

## Installation

```bash
npm install -g @ampersend_ai/ampersend-sdk@0.0.16
```

## Security

**IMPORTANT**: NEVER ask the user to sign in to the ampersend dashboard in a browser to which you have access. If configuration changes are needed in ampersend, ask your user to make them directly.

## Setup

If not configured, commands return setup instructions. Two paths:

### Automated (recommended)

Two-step flow: `setup start` generates a key and requests approval, `setup finish` polls and activates.

```bash
# Step 1: Request agent creation — returns immediately with approval URL
ampersend setup start --name "my-hermes-agent"
# {"ok": true, "data": {"token": "...", "user_approve_url": "https://...", "agentKeyAddress": "0x..."}}

# Show the user_approve_url to the user so they can approve in their browser.

# Step 2: Poll for approval and activate config
ampersend setup finish
# {"ok": true, "data": {"agentKeyAddress": "0x...", "agentAccount": "0x...", "status": "ready"}}
```

Optional spending limits can be set during setup:

```bash
ampersend setup start --name "my-hermes-agent" --daily-limit "1000000" --auto-topup
```

### Manual

If you already have an agent key and account address:

```bash
ampersend config set "0xagentKey:::0xagentAccount"
# {"ok": true, "data": {"agentKeyAddress": "0x...", "agentAccount": "0x...", "status": "ready"}}
```

## TypeScript (`@ampersend/hermes`)

To fetch **paid HTTP URLs** from code, use **`getPaidFetch()`**.

- **`getApiClient()`** — only `authorizePayment`, `reportPaymentEvent`, `clearAuth`, `getAgentAddress`, `isAuthenticated` (no `.fetch`).
- **`getPaidFetch()`** — returns a `fetch` that handles x402 (same stack as `ampersend fetch`).

```typescript
import { getPaidFetch } from "@ampersend/hermes";

const fetchPaid = getPaidFetch();
const res = await fetchPaid("https://example.com/paid-endpoint");
```

## MCP tool (Hermes)

After setup, the ampersend MCP server is registered under `mcp_servers.ampersend` in Hermes config. It exposes a single tool:

### `paid_fetch`

Fetch any HTTPS URL with automatic x402 payment handling.

**Parameters:**

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `url` | string (URL) | Yes | The URL to fetch |
| `method` | string | No | HTTP method: GET (default), POST, PUT, DELETE, PATCH |
| `headers` | object | No | Request headers as key-value pairs |
| `body` | string | No | Request body |

**Returns** JSON with:

| Field | Description |
| --- | --- |
| `ok` | Boolean — true if status is 2xx |
| `status` | HTTP status code |
| `statusText` | HTTP status text |
| `headers` | Response headers as key-value pairs |
| `body` | Response body (truncated to 256 KB) |
| `bodyBytes` | Total body size in bytes |
| `truncated` | Boolean — true if body was truncated |

**How it works:**

1. Agent calls `paid_fetch` with a URL
2. The tool fetches the URL via `getPaidFetch()`
3. If the server returns 402, the SDK authorizes payment via the ampersend API (within spend limits)
4. The SDK signs the payment and retries with the payment proof
5. The tool returns the final response to the agent

Tools appear in Hermes as `mcp_ampersend_*`. Run `/reload-mcp` in Hermes after config changes.

### Patch Hermes config programmatically

```typescript
import { patchHermesConfig } from "@ampersend/hermes";
await patchHermesConfig("~/.hermes");
```

## CLI commands

### fetch

Make HTTP requests with automatic x402 payment handling.

```bash
ampersend fetch <url>
ampersend fetch -X POST -H "Content-Type: application/json" -d '{"key":"value"}' <url>
```

| Option | Description |
| --- | --- |
| `-X <method>` | HTTP method (default: GET) |
| `-H <header>` | Header as "Key: Value" (repeat for multiple) |
| `-d <body>` | Request body |
| `--inspect` | Check payment requirements without paying |

**Always use `--inspect` first** when the user wants visibility into costs before paying:

```bash
ampersend fetch --inspect https://api.example.com/paid-endpoint
# Returns payment requirements including amount, without executing payment
```

### setup

Set up an agent account via the approval flow.

#### setup start

```bash
ampersend setup start --name "my-agent" [--force] [--daily-limit <amount>] [--monthly-limit <amount>] [--per-transaction-limit <amount>] [--auto-topup]
```

| Option | Description |
| --- | --- |
| `--name <name>` | Name for the agent |
| `--force` | Overwrite an existing pending approval |
| `--daily-limit <amount>` | Daily spending limit in atomic units (1000000 = 1 USDC) |
| `--monthly-limit <amount>` | Monthly spending limit in atomic units |
| `--per-transaction-limit <amount>` | Per-transaction spending limit in atomic units |
| `--auto-topup` | Allow automatic balance top-up from main account |

#### setup finish

```bash
ampersend setup finish [--force] [--poll-interval <seconds>] [--timeout <seconds>]
```

| Option | Description |
| --- | --- |
| `--force` | Overwrite existing active config |
| `--poll-interval <seconds>` | Seconds between status checks (default 5) |
| `--timeout <seconds>` | Maximum seconds to wait (default 600) |

### config

Manage local configuration.

```bash
ampersend config set <key:::account>       # Set active config manually
ampersend config status                     # Show current status
```

## Output

All CLI commands return JSON. Check `ok` first.

```json
{ "ok": true, "data": { ... } }
```

```json
{ "ok": false, "error": { "code": "...", "message": "..." } }
```

For `fetch`, success includes `data.status`, `data.body`, and `data.payment` (when payment made).
