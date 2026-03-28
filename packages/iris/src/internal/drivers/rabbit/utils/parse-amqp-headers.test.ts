import type { ConsumeMessage } from "amqplib";
import { parseAmqpHeaders } from "./parse-amqp-headers";

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
    expect(result).toMatchSnapshot();
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
    expect(result.envelope).toMatchSnapshot();
  });

  it("should handle Buffer header values", () => {
    const msg = createConsumeMessage({
      headers: {
        "x-trace-id": Buffer.from("trace-buf"),
        "x-iris-attempt": Buffer.from("3"),
        "x-iris-broadcast": Buffer.from("true"),
      },
    });
    const result = parseAmqpHeaders(msg);
    expect(result.headers).toMatchSnapshot();
    expect(result.envelope.attempt).toBe(3);
    expect(result.envelope.broadcast).toBe(true);
  });

  it("should parse all iris headers", () => {
    const msg = createConsumeMessage({
      headers: {
        "x-iris-attempt": "1",
        "x-iris-correlation-id": "corr-1",
        "x-iris-reply-to": "reply-q",
        "x-iris-expiry": "30000",
        "x-iris-broadcast": "true",
      },
      priority: 7,
    });
    const result = parseAmqpHeaders(msg);
    expect(result.envelope).toMatchSnapshot();
  });

  it("should use routing key as topic", () => {
    const msg = createConsumeMessage({ routingKey: "my-service.events" });
    const result = parseAmqpHeaders(msg);
    expect(result.envelope.topic).toBe("my-service.events");
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
    expect(result.headers).toMatchSnapshot();
    expect(result.envelope.attempt).toBe(0);
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
    expect(result.envelope.priority).toBe(0);
  });

  it("should default expiry to null when header is missing", () => {
    const msg = createConsumeMessage();
    const result = parseAmqpHeaders(msg);
    expect(result.envelope.expiry).toBeNull();
  });
});
