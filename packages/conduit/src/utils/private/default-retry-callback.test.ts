import { ServerError } from "@lindorm/errors";
import { RetryConfig } from "@lindorm/retry";
import { ConduitError } from "../../errors";
import { defaultRetryCallback } from "./default-retry-callback";

describe("defaultRetryCallback", () => {
  const options: RetryConfig = {
    maxAttempts: 3,
    strategy: "linear",
    timeout: 25,
    timeoutMax: 3000,
  };

  test("should return false when maxAttempts is not set", () => {
    const err = new ConduitError("error", {
      status: ServerError.Status.ServiceUnavailable,
    });
    const noMaxAttemptsConfig: RetryConfig = {
      maxAttempts: 0,
      strategy: "linear",
      timeout: 25,
      timeoutMax: 3000,
    };
    expect(defaultRetryCallback(err, 1, noMaxAttemptsConfig)).toBe(false);
  });

  test("should return false when attempt exceeds maxAttempts", () => {
    const err = new ConduitError("error", {
      status: ServerError.Status.ServiceUnavailable,
    });
    expect(defaultRetryCallback(err, 4, options)).toBe(false);
  });

  test("should return true for BadGateway (502)", () => {
    const err = new ConduitError("error", { status: ServerError.Status.BadGateway });
    expect(defaultRetryCallback(err, 1, options)).toBe(true);
  });

  test("should return true for ServiceUnavailable (503)", () => {
    const err = new ConduitError("error", {
      status: ServerError.Status.ServiceUnavailable,
    });
    expect(defaultRetryCallback(err, 1, options)).toBe(true);
  });

  test("should return true for GatewayTimeout (504)", () => {
    const err = new ConduitError("error", { status: ServerError.Status.GatewayTimeout });
    expect(defaultRetryCallback(err, 1, options)).toBe(true);
  });

  test("should return false for other error statuses", () => {
    const err = new ConduitError("error", { status: 500 });
    expect(defaultRetryCallback(err, 1, options)).toBe(false);
  });

  test("should check err.status directly, not err.response.status", () => {
    // Circuit breaker errors have err.status but no err.response
    const err = new ConduitError("Circuit breaker is open", { status: 503 });

    // This is the critical test: verify the callback works with err.status
    expect(err.status).toBe(503);
    expect((err as any).response).toBeUndefined();
    expect(defaultRetryCallback(err, 1, options)).toBe(true);
  });

  test("should return true for network errors (status <= 0, no response)", () => {
    const err = new ConduitError("Network error", {
      status: -1,
      response: undefined,
    });

    expect(err.isNetworkError).toBe(true);
    expect(defaultRetryCallback(err, 1, options)).toBe(true);
  });

  test("should return true for network errors (status 0, no response)", () => {
    const err = new ConduitError("Connection failed", {
      status: 0,
      response: undefined,
    });

    expect(err.isNetworkError).toBe(true);
    expect(defaultRetryCallback(err, 1, options)).toBe(true);
  });

  test("should retry network errors even when attempt count is high", () => {
    const err = new ConduitError("Network error", {
      status: -1,
      response: undefined,
    });

    expect(defaultRetryCallback(err, 2, options)).toBe(true);
  });
});
