import { describe, it, expect, vi, beforeEach } from "vitest";

describe("config", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("loadConfig returns defaults when no env is set", async () => {
    const { loadConfig } = await import("../src/config.js");
    const cfg = loadConfig({});
    expect(cfg.ampersendApiUrl).toBe("https://api.ampersend.ai");
    expect(cfg.ampersendNetwork).toBe("base");
    expect(cfg.ampersendMcpProxyPort).toBe(3000);
    expect(cfg.hermesConfigDir).toBe("~/.hermes");
    expect(cfg.ampersendAgentKey).toBeUndefined();
    expect(cfg.ampersendAgentAccount).toBeUndefined();
  });

  it("loadConfig accepts valid overrides", async () => {
    const { loadConfig } = await import("../src/config.js");
    const cfg = loadConfig({
      AMPERSEND_AGENT_KEY: "0x" + "a".repeat(64),
      AMPERSEND_AGENT_ACCOUNT: "0x" + "b".repeat(40),
      AMPERSEND_NETWORK: "base-sepolia",
      AMPERSEND_MCP_PROXY_PORT: "4000",
    });
    expect(cfg.ampersendAgentKey).toBe("0x" + "a".repeat(64));
    expect(cfg.ampersendAgentAccount).toBe("0x" + "b".repeat(40));
    expect(cfg.ampersendNetwork).toBe("base-sepolia");
    expect(cfg.ampersendMcpProxyPort).toBe(4000);
  });

  it("needsBootstrap returns true when credentials are missing", async () => {
    const { loadConfig, needsBootstrap } = await import("../src/config.js");
    const cfg = loadConfig({});
    expect(needsBootstrap(cfg)).toBe(true);
  });

  it("needsBootstrap returns false when credentials are present", async () => {
    const { loadConfig, needsBootstrap } = await import("../src/config.js");
    const cfg = loadConfig({
      AMPERSEND_AGENT_KEY: "0x" + "a".repeat(64),
      AMPERSEND_AGENT_ACCOUNT: "0x" + "b".repeat(40),
    });
    expect(needsBootstrap(cfg)).toBe(false);
  });

  it("requireAgentKey throws when key is missing", async () => {
    const { loadConfig, requireAgentKey } = await import("../src/config.js");
    const cfg = loadConfig({});
    expect(() => requireAgentKey(cfg)).toThrow("AMPERSEND_AGENT_KEY is required");
  });

  it("requireAgentAccount throws when account is missing", async () => {
    const { loadConfig, requireAgentAccount } = await import("../src/config.js");
    const cfg = loadConfig({});
    expect(() => requireAgentAccount(cfg)).toThrow("AMPERSEND_AGENT_ACCOUNT is required");
  });
});
