import type { IrisEnvelope } from "../../../types/iris-envelope.js";
import { buildAmqpHeaders } from "./build-amqp-headers.js";
import { describe, expect, it } from "vitest";

const createEnvelope = (overrides: Partial<IrisEnvelope> = {}): IrisEnvelope => ({
  payload: Buffer.from("test"),
  headers: {},
  topic: "orders.created",
  priority: 0,
  timestamp: 1700000000000,
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

describe("buildAmqpHeaders", () => {
  it("should build config with minimal envelope", () => {
    const result = buildAmqpHeaders(createEnvelope(), {});
    expect(result).toMatchSnapshot();
  });

  it("should include user headers", () => {
    const result = buildAmqpHeaders(createEnvelope(), {
      "x-trace-id": "abc-123",
      "x-custom": "value",
    });
    expect(result).toMatchSnapshot();
  });

  it("should include correlation id when present", () => {
    const result = buildAmqpHeaders(createEnvelope({ correlationId: "corr-456" }), {});
    expect(result).toMatchSnapshot();
  });

  it("should include reply-to when present", () => {
    const result = buildAmqpHeaders(createEnvelope({ replyTo: "reply-queue" }), {});
    expect(result).toMatchSnapshot();
  });

  it("should include expiry when not null", () => {
    const result = buildAmqpHeaders(createEnvelope({ expiry: 30000 }), {});
    expect(result).toMatchSnapshot();
  });

  // M2: the full retry policy is now serialized on the wire so it is
  // producer-authoritative — not re-derived from the consumer's local @Retry.
  it("should serialize the full retry policy in x-iris headers (M2)", () => {
    const { properties } = buildAmqpHeaders(
      createEnvelope({
        maxRetries: 5,
        retryStrategy: "exponential",
        retryDelay: 250,
        retryDelayMax: 8000,
        retryMultiplier: 4,
        retryJitter: true,
      }),
      {},
    );
    const headers = properties.headers as Record<string, string>;
    expect(headers["x-iris-max-retries"]).toBe("5");
    expect(headers["x-iris-retry-strategy"]).toBe("exponential");
    expect(headers["x-iris-retry-delay"]).toBe("250");
    expect(headers["x-iris-retry-delay-max"]).toBe("8000");
    expect(headers["x-iris-retry-multiplier"]).toBe("4");
    expect(headers["x-iris-retry-jitter"]).toBe("true");
  });

  it("should NOT carry topic/priority/timestamp as x-iris headers (native slots)", () => {
    const { properties } = buildAmqpHeaders(
      createEnvelope({ priority: 7, timestamp: 1700000000000 }),
      {},
    );
    const headers = properties.headers as Record<string, string>;
    expect(headers["x-iris-topic"]).toBeUndefined();
    expect(headers["x-iris-priority"]).toBeUndefined();
    expect(headers["x-iris-timestamp"]).toBeUndefined();
    expect(properties.priority).toBe(7);
    expect(properties.timestamp).toBe(1700000000000);
  });

  it("should include broadcast header when true", () => {
    const result = buildAmqpHeaders(createEnvelope({ broadcast: true }), {});
    expect(result).toMatchSnapshot();
  });

  it("should set priority on properties when non-zero", () => {
    const result = buildAmqpHeaders(createEnvelope({ priority: 7 }), {});
    expect(result).toMatchSnapshot();
  });

  it("should apply options overrides", () => {
    const result = buildAmqpHeaders(
      createEnvelope(),
      {},
      {
        persistent: false,
        mandatory: true,
        messageId: "msg-789",
        type: "OrderCreated",
      },
    );
    expect(result).toMatchSnapshot();
  });

  it("should sanitize routing key from topic", () => {
    const result = buildAmqpHeaders(createEnvelope({ topic: "orders/created@v2" }), {});
    expect(result.routingKey).toMatchSnapshot();
  });

  it("should include all iris headers with fully populated envelope", () => {
    const result = buildAmqpHeaders(
      createEnvelope({
        attempt: 2,
        correlationId: "corr-1",
        replyTo: "reply-q",
        expiry: 60000,
        maxRetries: 3,
        broadcast: true,
        priority: 5,
      }),
      { "x-user": "custom" },
      { persistent: true, type: "TestMsg" },
    );
    expect(result).toMatchSnapshot();
  });
});
