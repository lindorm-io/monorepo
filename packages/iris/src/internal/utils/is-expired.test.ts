import type { IrisEnvelope } from "../types/iris-envelope";
import { isExpired } from "./is-expired";
import { describe, expect, it } from "vitest";

const makeEnvelope = (overrides: Partial<IrisEnvelope> = {}): IrisEnvelope => ({
  payload: Buffer.from("test"),
  headers: {},
  topic: "test",
  priority: 0,
  timestamp: Date.now(),
  expiry: null,
  broadcast: false,
  attempt: 0,
  maxRetries: 0,
  retryStrategy: "constant",
  retryDelay: 1000,
  retryDelayMax: 30000,
  retryMultiplier: 2,
  retryJitter: false,
  replyTo: null,
  correlationId: null,
  identifierValue: null,
  ...overrides,
});

describe("isExpired", () => {
  it("should return false when expiry is null", () => {
    const envelope = makeEnvelope({ expiry: null });
    expect(isExpired(envelope)).toBe(false);
  });

  it("should return false when envelope is within expiry", () => {
    const envelope = makeEnvelope({
      timestamp: Date.now() - 1000,
      expiry: 5000,
    });
    expect(isExpired(envelope)).toBe(false);
  });

  it("should return true when envelope has exceeded expiry", () => {
    const envelope = makeEnvelope({
      timestamp: Date.now() - 10000,
      expiry: 5000,
    });
    expect(isExpired(envelope)).toBe(true);
  });
});
