import type { ConsumeMessage } from "amqplib";
import { parseAmqpHeaders } from "./parse-amqp-headers.js";
import { describe, expect, it } from "vitest";

const createConsumeMessage = (overrides?: {
  content?: Buffer;
  headers?: Record<string, unknown>;
  routingKey?: string;
  timestamp?: number;
  priority?: number;
}): ConsumeMessage =>
  ({
    content: overrides?.content ?? Buffer.from('{"data":"test"}'),
    fields: {
      deliveryTag: 1,
      redelivered: false,
      exchange: "iris",
      routingKey: overrides?.routingKey ?? "orders.created",
      consumerTag: "ctag-1",
    },
    properties: {
      headers: overrides?.headers ?? {},
      timestamp: overrides?.timestamp ?? 1700000000000,
      priority: overrides?.priority ?? 0,
      contentType: undefined,
      contentEncoding: undefined,
      correlationId: undefined,
      replyTo: undefined,
      expiration: undefined,
      messageId: undefined,
      type: undefined,
      userId: undefined,
      appId: undefined,
      clusterId: undefined,
      deliveryMode: undefined,
    },
  }) as unknown as ConsumeMessage;

describe("parseAmqpHeaders", () => {
  it("should parse a minimal message", () => {
    const msg = createConsumeMessage();
    const result = parseAmqpHeaders(msg);
    expect(result).toMatchSnapshot({ payload: expect.any(Buffer) });
  });

  it("should separate user headers from iris headers", () => {
    const msg = createConsumeMessage({
      headers: {
        "x-trace-id": "trace-123",
        "x-iris-attempt": "2",
        "x-iris-correlation-id": "corr-456",
        "x-custom": "value",
      },
    });
    const result = parseAmqpHeaders(msg);
    expect(result.headers).toMatchSnapshot();
    expect(result.irisHeaders).toMatchSnapshot();
  });

  it("should pass through encryption/compression iris headers to user headers", () => {
    const msg = createConsumeMessage({
      headers: {
        "x-iris-encrypted": "true",
        "x-iris-compression": "gzip",
        "x-iris-attempt": "1",
      },
    });
    const result = parseAmqpHeaders(msg);
    expect(result.headers).toEqual({
      "x-iris-encrypted": "true",
      "x-iris-compression": "gzip",
    });
    expect(result.irisHeaders["x-iris-attempt"]).toBe("1");
  });

  it("should stringify Buffer header values", () => {
    const msg = createConsumeMessage({
      headers: {
        "x-trace-id": Buffer.from("trace-buf"),
        "x-iris-attempt": Buffer.from("3"),
        "x-iris-broadcast": Buffer.from("true"),
      },
    });
    const result = parseAmqpHeaders(msg);
    expect(result.headers["x-trace-id"]).toBe("trace-buf");
    expect(result.irisHeaders["x-iris-attempt"]).toBe("3");
    expect(result.irisHeaders["x-iris-broadcast"]).toBe("true");
  });

  it("should expose native priority, timestamp and routing key", () => {
    const msg = createConsumeMessage({
      routingKey: "my-service.events",
      priority: 7,
      timestamp: 1700000009000,
    });
    const result = parseAmqpHeaders(msg);
    expect(result.routingKey).toBe("my-service.events");
    expect(result.priority).toBe(7);
    expect(result.timestamp).toBe(1700000009000);
  });

  it("should handle null/undefined header values", () => {
    const msg = createConsumeMessage({
      headers: {
        "x-null": null,
        "x-undefined": undefined,
      },
    });
    const result = parseAmqpHeaders(msg);
    expect(result.headers).toMatchSnapshot();
  });

  it("should handle missing headers object", () => {
    const msg = createConsumeMessage();
    (msg.properties as any).headers = undefined;
    const result = parseAmqpHeaders(msg);
    expect(result.headers).toEqual({});
    expect(result.irisHeaders).toEqual({});
  });

  it("should return content as payload buffer", () => {
    const content = Buffer.from('{"key":"value"}');
    const msg = createConsumeMessage({ content });
    const result = parseAmqpHeaders(msg);
    expect(result.payload).toBe(content);
  });

  it("should default priority to 0 when not set", () => {
    const msg = createConsumeMessage();
    (msg.properties as any).priority = undefined;
    const result = parseAmqpHeaders(msg);
    expect(result.priority).toBe(0);
  });
});
