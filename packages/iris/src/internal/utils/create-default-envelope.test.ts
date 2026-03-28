import type { OutboundPayload } from "../message/utils/prepare-outbound";
import { createDefaultEnvelope } from "./create-default-envelope";

describe("createDefaultEnvelope", () => {
  const outbound: OutboundPayload = {
    payload: Buffer.from('{"hello":"world"}'),
    headers: { "x-iris-type": "TestMessage" },
  };

  it("should create envelope with default values", () => {
    const result = createDefaultEnvelope(outbound, "test.topic");

    expect(result).toMatchSnapshot({
      payload: expect.any(Buffer),
      timestamp: expect.any(Number),
    });
    expect(result.payload).toEqual(outbound.payload);
    expect(result.headers).toEqual(outbound.headers);
    expect(result.topic).toBe("test.topic");
    expect(result.priority).toBe(0);
    expect(result.expiry).toBeNull();
    expect(result.broadcast).toBe(false);
    expect(result.attempt).toBe(0);
    expect(result.maxRetries).toBe(0);
    expect(result.retryStrategy).toBe("constant");
    expect(result.retryDelay).toBe(1000);
    expect(result.retryDelayMax).toBe(30000);
    expect(result.retryMultiplier).toBe(2);
    expect(result.retryJitter).toBe(false);
    expect(result.replyTo).toBeNull();
    expect(result.correlationId).toBeNull();
  });

  it("should apply overrides", () => {
    const result = createDefaultEnvelope(outbound, "test.topic", {
      priority: 5,
      replyTo: "reply-stream",
      correlationId: "abc-123",
    });

    expect(result).toMatchSnapshot({
      payload: expect.any(Buffer),
      timestamp: expect.any(Number),
    });
    expect(result.priority).toBe(5);
    expect(result.replyTo).toBe("reply-stream");
    expect(result.correlationId).toBe("abc-123");
  });

  it("should allow overriding timestamp", () => {
    const result = createDefaultEnvelope(outbound, "test.topic", {
      timestamp: 1234567890,
    });

    expect(result.timestamp).toBe(1234567890);
  });

  it("should allow overriding all retry fields", () => {
    const result = createDefaultEnvelope(outbound, "test.topic", {
      maxRetries: 5,
      retryStrategy: "exponential",
      retryDelay: 500,
      retryDelayMax: 60000,
      retryMultiplier: 3,
      retryJitter: true,
    });

    expect(result).toMatchSnapshot({
      payload: expect.any(Buffer),
      timestamp: expect.any(Number),
    });
  });
});
