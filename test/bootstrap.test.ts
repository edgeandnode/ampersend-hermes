import { describe, it, expect } from "vitest";
import { parseDotEnv } from "../src/bootstrap.js";

describe("parseDotEnv", () => {
  it("parses simple key=value pairs", () => {
    const result = parseDotEnv("FOO=bar\nBAZ=qux");
    expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("ignores comments and blank lines", () => {
    const result = parseDotEnv("# comment\nFOO=bar\n\n# another\nBAZ=qux");
    expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("handles quoted values", () => {
    const result = parseDotEnv('FOO="hello world"\nBAR=\'single quoted\'');
    expect(result).toEqual({ FOO: "hello world", BAR: "single quoted" });
  });

  it("handles empty values", () => {
    const result = parseDotEnv("FOO=\nBAR=value");
    expect(result).toEqual({ FOO: "", BAR: "value" });
  });

  it("handles 0x-prefixed keys", () => {
    const key = "0x" + "a".repeat(64);
    const result = parseDotEnv(`AMPERSEND_AGENT_KEY=${key}`);
    expect(result.AMPERSEND_AGENT_KEY).toBe(key);
  });
});
