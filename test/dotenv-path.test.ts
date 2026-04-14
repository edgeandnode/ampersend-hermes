import { describe, it, expect } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import { expandTilde } from "../src/dotenv-path.js";

describe("expandTilde", () => {
  it("expands ~/path to home dir", () => {
    const result = expandTilde("~/foo/bar");
    expect(result).toBe(path.join(os.homedir(), "foo/bar"));
  });

  it("expands bare ~ to home dir", () => {
    const result = expandTilde("~");
    expect(result).toBe(os.homedir());
  });

  it("returns absolute paths unchanged", () => {
    expect(expandTilde("/usr/local")).toBe("/usr/local");
  });

  it("returns relative paths unchanged", () => {
    expect(expandTilde("foo/bar")).toBe("foo/bar");
  });
});
