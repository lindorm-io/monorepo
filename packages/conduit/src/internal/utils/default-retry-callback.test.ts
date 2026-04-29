import { LindormError, NetworkError, ServerError } from "@lindorm/errors";
import type { RetryConfig } from "@lindorm/retry";
import { defaultRetryCallback } from "./default-retry-callback.js";
import { describe, expect, test } from "vitest";

describe("defaultRetryCallback", () => {
  const options: RetryConfig = {
    maxAttempts: 3,
    strategy: "linear",
    timeout: 25,
    timeoutMax: 3000,
  };

  test("should return false when maxAttempts is not set", () => {
    const err = new ServerError("error", {
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
    const err = new ServerError("error", {
      status: ServerError.Status.ServiceUnavailable,
    });
    expect(defaultRetryCallback(err, 4, options)).toBe(false);
  });

  test("should return true for BadGateway (502)", () => {
    const err = new ServerError("error", { status: ServerError.Status.BadGateway });
    expect(defaultRetryCallback(err, 1, options)).toBe(true);
  });

  test("should return true for ServiceUnavailable (503)", () => {
    const err = new ServerError("error", {
      status: ServerError.Status.ServiceUnavailable,
    });
    expect(defaultRetryCallback(err, 1, options)).toBe(true);
  });

  test("should return true for GatewayTimeout (504)", () => {
    const err = new ServerError("error", { status: ServerError.Status.GatewayTimeout });
    expect(defaultRetryCallback(err, 1, options)).toBe(true);
  });

  test("should return false for other error statuses", () => {
    const err = new ServerError("error", { status: 500 });
    expect(defaultRetryCallback(err, 1, options)).toBe(false);
  });

  test("should check err.status directly, not err.debug.transport.response.status", () => {
    // Circuit breaker errors have err.status but no transport metadata
    const err = new LindormError("Circuit breaker is open", { status: 503 });

    expect(err.status).toBe(503);
    expect(err.debug).toEqual({});
    expect(defaultRetryCallback(err, 1, options)).toBe(true);
  });

  test("should return true for NetworkError", () => {
    const err = new NetworkError("Network error");

    expect(err).toBeInstanceOf(NetworkError);
    expect(defaultRetryCallback(err, 1, options)).toBe(true);
  });

  test("should return true for NetworkError with custom message", () => {
    const err = new NetworkError("Connection failed");

    expect(err).toBeInstanceOf(NetworkError);
    expect(defaultRetryCallback(err, 1, options)).toBe(true);
  });

  test("should retry NetworkError even when attempt count is high", () => {
    const err = new NetworkError("Network error");

    expect(defaultRetryCallback(err, 2, options)).toBe(true);
  });
});
