import { describe, it, expect } from "vitest";
import { validatePayment, buildSpendPolicy } from "../src/payment/guardrails.js";
import { SpendLimitViolationError } from "../src/errors.js";

describe("validatePayment", () => {
  const basePolicy = buildSpendPolicy({
    perTxLimit: "1000000",
    networks: ["base", "base-sepolia"],
  });

  it("passes when within limits and allowed network", () => {
    expect(() =>
      validatePayment(
        { amount: "500000", network: "base", resource: "/api/test" },
        basePolicy,
      ),
    ).not.toThrow();
  });

  it("throws NETWORK_NOT_ALLOWED for disallowed network", () => {
    try {
      validatePayment(
        { amount: "500000", network: "ethereum", resource: "/api/test" },
        basePolicy,
      );
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(SpendLimitViolationError);
      expect((err as SpendLimitViolationError).code).toBe("NETWORK_NOT_ALLOWED");
    }
  });

  it("throws PER_TX_LIMIT_EXCEEDED when amount too high", () => {
    try {
      validatePayment(
        { amount: "2000000", network: "base", resource: "/api/test" },
        basePolicy,
      );
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(SpendLimitViolationError);
      expect((err as SpendLimitViolationError).code).toBe("PER_TX_LIMIT_EXCEEDED");
    }
  });

  it("allows any network when allowedNetworks is empty", () => {
    const openPolicy = buildSpendPolicy({});
    expect(() =>
      validatePayment(
        { amount: "100", network: "anything", resource: "/api/test" },
        openPolicy,
      ),
    ).not.toThrow();
  });
});
