import type { KafkaEachMessagePayload } from "../types/kafka-types.js";
import { parseKafkaMessage } from "./parse-kafka-message.js";
import { describe, expect, it, vi } from "vitest";

const createHeaders = (
  overrides: Record<string, string> = {},
): Record<string, Buffer | undefined> => {
  const defaults: Record<string, string> = {
    "x-iris-topic": "orders.created",
    "x-iris-headers": JSON.stringify({ "x-trace-id": "abc" }),
    "x-iris-attempt": "0",
    "x-iris-max-retries": "3",
    "x-iris-retry-strategy": "constant",
    "x-iris-retry-delay": "1000",
    "x-iris-retry-delay-max": "30000",
    "x-iris-retry-multiplier": "2",
    "x-iris-retry-jitter": "false",
    "x-iris-priority": "0",
    "x-iris-timestamp": "1700000000000",
    "x-iris-expiry": "",
    "x-iris-broadcast": "false",
    "x-iris-reply-to": "",
    "x-iris-correlation-id": "",
  };

  const merged = { ...defaults, ...overrides };
  const result: Record<string, Buffer | undefined> = {};
  for (const [key, value] of Object.entries(merged)) {
    result[key] = Buffer.from(value);
  }
  return result;
};

const createPayload = (overrides?: {
  topic?: string;
  partition?: number;
  headers?: Record<string, Buffer | undefined>;
  value?: Buffer | null;
  offset?: string;
  timestamp?: string;
}): KafkaEachMessagePayload => ({
  topic: overrides?.topic ?? "orders.created",
  partition: overrides?.partition ?? 0,
  message: {
    key: null,
    value:
      overrides?.value !== undefined ? overrides.value : Buffer.from('{"data":"test"}'),
    headers: overrides?.headers ?? createHeaders(),
    offset: overrides?.offset ?? "0",
    timestamp: overrides?.timestamp ?? "1700000000000",
  },
  heartbeat: vi.fn().mockResolvedValue(undefined),
});

describe("parseKafkaMessage", () => {
  it("should parse a minimal payload", () => {
    const result = parseKafkaMessage(createPayload());
    expect(result).toMatchSnapshot({
      payload: expect.any(Buffer),
    });
  });

  it("should use message.value as payload buffer", () => {
    const value = Buffer.from('{"data":"test"}');
    const result = parseKafkaMessage(createPayload({ value }));
    expect(result.payload).toEqual(value);
  });

  it("should parse headers from JSON", () => {
    const headers = { "x-trace": "abc", "x-custom": "value" };
    const result = parseKafkaMessage(
      createPayload({
        headers: createHeaders({ "x-iris-headers": JSON.stringify(headers) }),
      }),
    );
    expect(result.headers).toMatchSnapshot();
  });

  it("should parse numeric fields as numbers", () => {
    const result = parseKafkaMessage(
      createPayload({
        headers: createHeaders({
          "x-iris-attempt": "2",
          "x-iris-max-retries": "5",
          "x-iris-retry-delay": "500",
          "x-iris-retry-delay-max": "10000",
          "x-iris-retry-multiplier": "3",
          "x-iris-priority": "7",
          "x-iris-timestamp": "1700000000000",
        }),
      }),
    );
    expect(result.attempt).toBe(2);
    expect(result.maxRetries).toBe(5);
    expect(result.retryDelay).toBe(500);
    expect(result.retryDelayMax).toBe(10000);
    expect(result.retryMultiplier).toBe(3);
    expect(result.priority).toBe(7);
    expect(result.timestamp).toBe(1700000000000);
  });

  it("should parse boolean fields", () => {
    const result = parseKafkaMessage(
      createPayload({
        headers: createHeaders({
          "x-iris-retry-jitter": "true",
          "x-iris-broadcast": "true",
        }),
      }),
    );
    expect(result.retryJitter).toBe(true);
    expect(result.broadcast).toBe(true);
  });

  it("should parse false boolean fields", () => {
    const result = parseKafkaMessage(
      createPayload({
        headers: createHeaders({
          "x-iris-retry-jitter": "false",
          "x-iris-broadcast": "false",
        }),
      }),
    );
    expect(result.retryJitter).toBe(false);
    expect(result.broadcast).toBe(false);
  });

  it("should parse empty expiry as null", () => {
    const result = parseKafkaMessage(
      createPayload({
        headers: createHeaders({ "x-iris-expiry": "" }),
      }),
    );
    expect(result.expiry).toBeNull();
  });

  it("should parse non-empty expiry as number", () => {
    const result = parseKafkaMessage(
      createPayload({
        headers: createHeaders({ "x-iris-expiry": "30000" }),
      }),
    );
    expect(result.expiry).toBe(30000);
  });

  it("should parse empty replyTo as null", () => {
    const result = parseKafkaMessage(
      createPayload({
        headers: createHeaders({ "x-iris-reply-to": "" }),
      }),
    );
    expect(result.replyTo).toBeNull();
  });

  it("should parse non-empty replyTo", () => {
    const result = parseKafkaMessage(
      createPayload({
        headers: createHeaders({ "x-iris-reply-to": "reply-queue" }),
      }),
    );
    expect(result.replyTo).toBe("reply-queue");
  });

  it("should parse empty correlationId as null", () => {
    const result = parseKafkaMessage(
      createPayload({
        headers: createHeaders({ "x-iris-correlation-id": "" }),
      }),
    );
    expect(result.correlationId).toBeNull();
  });

  it("should parse non-empty correlationId", () => {
    const result = parseKafkaMessage(
      createPayload({
        headers: createHeaders({ "x-iris-correlation-id": "corr-123" }),
      }),
    );
    expect(result.correlationId).toBe("corr-123");
  });

  it("should parse retry strategy", () => {
    const result = parseKafkaMessage(
      createPayload({
        headers: createHeaders({ "x-iris-retry-strategy": "exponential" }),
      }),
    );
    expect(result.retryStrategy).toBe("exponential");
  });

  it("should fall back to payload topic when x-iris-topic is missing", () => {
    const headers = createHeaders();
    delete headers["x-iris-topic"];
    const payload = createPayload({ headers });
    payload.topic = "fallback-topic";
    const result = parseKafkaMessage(payload);
    expect(result.topic).toBe("fallback-topic");
  });

  it("should handle null message value", () => {
    const result = parseKafkaMessage(createPayload({ value: null }));
    expect(result.payload).toEqual(Buffer.alloc(0));
  });

  it("should handle missing headers with defaults", () => {
    const payload: KafkaEachMessagePayload = {
      topic: "test-topic",
      partition: 0,
      message: {
        key: null,
        value: Buffer.from("data"),
        headers: undefined,
        offset: "0",
        timestamp: "0",
      },
      heartbeat: vi.fn().mockResolvedValue(undefined),
    };
    const result = parseKafkaMessage(payload);
    expect(result.topic).toBe("test-topic");
    expect(result.headers).toEqual({});
    expect(result.attempt).toBe(0);
    expect(result.maxRetries).toBe(0);
    expect(result.retryStrategy).toBe("constant");
    expect(result.retryDelay).toBe(1000);
    expect(result.retryDelayMax).toBe(30000);
    expect(result.retryMultiplier).toBe(2);
    expect(result.retryJitter).toBe(false);
    expect(result.priority).toBe(0);
    expect(result.timestamp).toBe(0);
    expect(result.expiry).toBeNull();
    expect(result.broadcast).toBe(false);
    expect(result.replyTo).toBeNull();
    expect(result.correlationId).toBeNull();
  });

  it("should parse message key as identifierValue", () => {
    const payload = createPayload();
    payload.message.key = Buffer.from("order-abc-123");
    const result = parseKafkaMessage(payload);
    expect(result.identifierValue).toBe("order-abc-123");
  });

  it("should set identifierValue to null when message key is null", () => {
    const payload = createPayload();
    payload.message.key = null;
    const result = parseKafkaMessage(payload);
    expect(result.identifierValue).toBeNull();
  });

  it("should parse a fully populated payload", () => {
    const result = parseKafkaMessage(
      createPayload({
        headers: createHeaders({
          "x-iris-attempt": "3",
          "x-iris-max-retries": "5",
          "x-iris-retry-strategy": "exponential",
          "x-iris-retry-delay": "500",
          "x-iris-retry-delay-max": "10000",
          "x-iris-retry-multiplier": "3",
          "x-iris-retry-jitter": "true",
          "x-iris-priority": "7",
          "x-iris-expiry": "60000",
          "x-iris-broadcast": "true",
          "x-iris-reply-to": "reply-q",
          "x-iris-correlation-id": "corr-456",
        }),
      }),
    );
    expect(result).toMatchSnapshot({
      payload: expect.any(Buffer),
    });
  });
});
