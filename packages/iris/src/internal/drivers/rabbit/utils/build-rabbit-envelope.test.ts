import type { ParsedAmqpMessage } from "./parse-amqp-headers.js";
import { buildRabbitEnvelope } from "./build-rabbit-envelope.js";
import { describe, expect, it } from "vitest";

const createParsed = (overrides: Partial<ParsedAmqpMessage> = {}): ParsedAmqpMessage => ({
  payload: Buffer.from("test-payload"),
  headers: {},
  irisHeaders: {},
  priority: 0,
  timestamp: 1700000000000,
  routingKey: "orders.created",
  ...overrides,
});

describe("buildRabbitEnvelope", () => {
  it("should build envelope from a minimal parsed message", () => {
    const result = buildRabbitEnvelope(createParsed());
    expect(result).toMatchSnapshot({ payload: expect.any(Buffer) });
  });

  it("should take topic/priority/timestamp from AMQP-native slots", () => {
    const result = buildRabbitEnvelope(
      createParsed({ routingKey: "custom.topic", priority: 7, timestamp: 1700000001000 }),
    );
    expect(result.topic).toBe("custom.topic");
    expect(result.priority).toBe(7);
    expect(result.timestamp).toBe(1700000001000);
  });

  // Queue-targeted retry: a redelivered retry arrives with its routing key
  // rewritten to the failing consumer's queue name (dead-lettered via the default
  // exchange). The explicit x-iris-topic header must win over that routing key so
  // the recovered topic is the real topic, not the queue name.
  it("should prefer x-iris-topic over the routing key when present (retry redelivery)", () => {
    const result = buildRabbitEnvelope(
      createParsed({
        routingKey: "iris.delay.amq.gen-abc123",
        irisHeaders: { "x-iris-topic": "orders.created" },
      }),
    );
    expect(result.topic).toBe("orders.created");
  });

  it("should fall back to the routing key when x-iris-topic is absent", () => {
    const result = buildRabbitEnvelope(createParsed({ routingKey: "orders.created" }));
    expect(result.topic).toBe("orders.created");
  });

  it("should decode all scalar fields from x-iris headers", () => {
    const result = buildRabbitEnvelope(
      createParsed({
        irisHeaders: {
          "x-iris-attempt": "3",
          "x-iris-max-retries": "5",
          "x-iris-retry-strategy": "exponential",
          "x-iris-retry-delay": "500",
          "x-iris-retry-delay-max": "10000",
          "x-iris-retry-multiplier": "3",
          "x-iris-retry-jitter": "true",
          "x-iris-expiry": "60000",
          "x-iris-broadcast": "true",
          "x-iris-reply-to": "reply-q",
          "x-iris-correlation-id": "corr-456",
        },
      }),
    );
    expect(result).toMatchSnapshot({ payload: expect.any(Buffer) });
  });

  // M2: retry policy is producer-authoritative — read from the wire (x-iris
  // headers), never re-derived from the consumer's local @Retry metadata.
  it("should read retry policy from the wire (producer-authoritative, M2)", () => {
    const result = buildRabbitEnvelope(
      createParsed({
        irisHeaders: {
          "x-iris-max-retries": "5",
          "x-iris-retry-strategy": "exponential",
          "x-iris-retry-delay": "250",
          "x-iris-retry-delay-max": "8000",
          "x-iris-retry-multiplier": "4",
          "x-iris-retry-jitter": "true",
        },
      }),
    );
    expect(result.maxRetries).toBe(5);
    expect(result.retryStrategy).toBe("exponential");
    expect(result.retryDelay).toBe(250);
    expect(result.retryDelayMax).toBe(8000);
    expect(result.retryMultiplier).toBe(4);
    expect(result.retryJitter).toBe(true);
  });

  it("should apply codec defaults when retry headers are absent", () => {
    const result = buildRabbitEnvelope(createParsed());
    expect(result.maxRetries).toBe(0);
    expect(result.retryStrategy).toBe("constant");
    expect(result.retryDelay).toBe(1000);
    expect(result.retryDelayMax).toBe(30000);
    expect(result.retryMultiplier).toBe(2);
    expect(result.retryJitter).toBe(false);
  });

  it("should decode empty nullable headers as null", () => {
    const result = buildRabbitEnvelope(
      createParsed({
        irisHeaders: {
          "x-iris-expiry": "",
          "x-iris-reply-to": "",
          "x-iris-correlation-id": "",
        },
      }),
    );
    expect(result.expiry).toBeNull();
    expect(result.replyTo).toBeNull();
    expect(result.correlationId).toBeNull();
  });

  it("should never carry identifierValue (Kafka-only ordering)", () => {
    const result = buildRabbitEnvelope(
      createParsed({ irisHeaders: { "x-iris-identifier-value": "id-1" } }),
    );
    expect(result.identifierValue).toBeNull();
  });

  it("should preserve user headers from the parsed message", () => {
    const result = buildRabbitEnvelope(
      createParsed({ headers: { "x-trace": "abc", "x-custom": "val" } }),
    );
    expect(result.headers).toEqual({ "x-trace": "abc", "x-custom": "val" });
  });

  it("should preserve the payload buffer from the parsed message", () => {
    const payload = Buffer.from("binary-data");
    const result = buildRabbitEnvelope(createParsed({ payload }));
    expect(result.payload).toBe(payload);
  });
});
