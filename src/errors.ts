export class ConfigError extends Error {
  readonly code = "CONFIG_ERROR";
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export class PaymentError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
  }
}

export class AgentError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AgentError";
    this.code = code;
  }
}

export type SpendLimitViolationCode =
  | "DAILY_LIMIT_EXCEEDED"
  | "MONTHLY_LIMIT_EXCEEDED"
  | "PER_TX_LIMIT_EXCEEDED"
  | "NETWORK_NOT_ALLOWED";

export class SpendLimitViolationError extends Error {
  readonly code: SpendLimitViolationCode;
  constructor(code: SpendLimitViolationCode, message: string) {
    super(message);
    this.name = "SpendLimitViolationError";
    this.code = code;
  }
}
