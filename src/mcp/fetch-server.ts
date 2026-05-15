#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getPaidFetch } from "../client.js";

const MAX_BODY_BYTES = 256 * 1024;

const server = new McpServer({
  name: "ampersend-paid-fetch",
  version: "0.1.0",
});

server.tool(
  "paid_fetch",
  "Fetch an HTTPS URL, automatically paying x402 (HTTP 402) challenges " +
    "via the ampersend agent wallet. Returns status, headers, and body " +
    "(truncated to 256 KB).",
  {
    url: z.string().url(),
    method: z
      .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
      .optional()
      .default("GET"),
    headers: z.record(z.string()).optional(),
    body: z.string().optional(),
  },
  async ({ url, method, headers, body }) => {
    const fetchPaid = getPaidFetch();
    const init: RequestInit = { method };
    if (headers) init.headers = headers;
    if (body !== undefined) init.body = body;

    const res = await fetchPaid(url, init);
    const buf = await res.arrayBuffer();
    const truncated = buf.byteLength > MAX_BODY_BYTES;
    const text = new TextDecoder("utf-8", { fatal: false }).decode(
      truncated ? buf.slice(0, MAX_BODY_BYTES) : buf,
    );

    const respHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      respHeaders[k] = v;
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              ok: res.ok,
              status: res.status,
              statusText: res.statusText,
              headers: respHeaders,
              bodyBytes: buf.byteLength,
              truncated,
              body: text,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

async function main() {
  await server.connect(new StdioServerTransport());
}

main().catch((e) => {
  process.stderr.write(
    `[ampersend-paid-fetch] fatal: ${e instanceof Error ? e.message : String(e)}\n`,
  );
  process.exit(1);
});
