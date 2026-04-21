import type { IrisEnvelope } from "../../../types/iris-envelope";
import { serializeKafkaMessage } from "./serialize-kafka-message";
import { describe, expect, it } from "vitest";

const createEnvelope = (overrides: Partial<IrisEnvelope> = {}): IrisEnvelope => ({
  payload: Buffer.from('{"hello":"world"}'),
  headers: { "x-trace-id": "abc-123" },
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

describe("serializeKafkaMessage", () => {
  it("should serialize a minimal envelope", () => {
    const result = serializeKafkaMessage(createEnvelope());
    expect(result).toMatchSnapshot({
      value: expect.any(Buffer),
    });
  });

  it("should set value to envelope payload buffer directly", () => {
    const payload = Buffer.from("test-data");
    const result = serializeKafkaMessage(createEnvelope({ payload }));
    expect(result.value).toBe(payload);
  });

  it("should serialize headers as JSON string", () => {
    const headers = { "x-trace": "abc", "x-custom": "value" };
    const result = serializeKafkaMessage(createEnvelope({ headers }));
    expect(result.headers!["x-iris-headers"]).toBe(JSON.stringify(headers));
  });

  it("should serialize null expiry as empty string", () => {
    const result = serializeKafkaMessage(createEnvelope({ expiry: null }));
    expect(result.headers!["x-iris-expiry"]).toBe("");
  });

  it("should serialize non-null expiry as string number", () => {
    const result = serializeKafkaMessage(createEnvelope({ expiry: 30000 }));
    expect(result.headers!["x-iris-expiry"]).toBe("30000");
  });

  it("should serialize boolean fields as strings", () => {
    const result = serializeKafkaMessage(
      createEnvelope({ broadcast: true, retryJitter: true }),
    );
    expect(result.headers!["x-iris-broadcast"]).toBe("true");
    expect(result.headers!["x-iris-retry-jitter"]).toBe("true");
  });

  it("should serialize null replyTo and correlationId as empty strings", () => {
    const result = serializeKafkaMessage(createEnvelope());
    expect(result.headers!["x-iris-reply-to"]).toBe("");
    expect(result.headers!["x-iris-correlation-id"]).toBe("");
  });

  it("should serialize non-null replyTo and correlationId", () => {
    const result = serializeKafkaMessage(
      createEnvelope({ replyTo: "reply-queue", correlationId: "corr-123" }),
    );
    expect(result.headers!["x-iris-reply-to"]).toBe("reply-queue");
    expect(result.headers!["x-iris-correlation-id"]).toBe("corr-123");
  });

  it("should set key to identifierValue when present", () => {
    const result = serializeKafkaMessage(
      createEnvelope({ identifierValue: "order-abc-123" }),
    );
    expect(result.key).toBe("order-abc-123");
  });

  it("should set key to null when identifierValue is null", () => {
    const result = serializeKafkaMessage(createEnvelope({ identifierValue: null }));
    expect(result.key).toBeNull();
  });

  it("should produce all string header values", () => {
    const result = serializeKafkaMessage(
      createEnvelope({
        priority: 5,
        attempt: 2,
        maxRetries: 10,
        expiry: 60000,
        broadcast: true,
        replyTo: "q",
        correlationId: "c",
      }),
    );
    for (const [, value] of Object.entries(result.headers!)) {
      expect(typeof value).toBe("string");
    }
  });

  it("should serialize a fully populated envelope", () => {
    const result = serializeKafkaMessage(
      createEnvelope({
        priority: 7,
        attempt: 3,
        maxRetries: 5,
        retryStrategy: "exponential",
        retryDelay: 500,
        retryDelayMax: 10000,
        retryMultiplier: 3,
        retryJitter: true,
        expiry: 60000,
        broadcast: true,
        replyTo: "reply-queue",
        correlationId: "corr-456",
      }),
    );
    expect(result).toMatchSnapshot({
      value: expect.any(Buffer),
    });
  });
});
