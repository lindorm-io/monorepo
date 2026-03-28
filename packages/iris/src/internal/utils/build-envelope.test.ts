import type { MessageMetadata } from "../message/types/metadata";
import type { OutboundPayload } from "../message/utils/prepare-outbound";
import { buildEnvelope } from "./build-envelope";

describe("buildEnvelope", () => {
  const outbound: OutboundPayload = {
    payload: Buffer.from('{"hello":"world"}'),
    headers: { "x-iris-type": "TestMessage" },
  };

  it("should build envelope with default values when no retry or priority", () => {
    const metadata = {
      priority: null,
      expiry: null,
      broadcast: false,
      retry: null,
    } as unknown as MessageMetadata;

    const result = buildEnvelope(outbound, "test.topic", metadata);

    expect(result).toMatchSnapshot({
      payload: expect.any(Buffer),
      timestamp: expect.any(Number),
    });
    expect(result.payload).toEqual(outbound.payload);
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

  it("should build envelope with metadata overrides", () => {
    const metadata = {
      priority: 5,
      expiry: 30000,
      broadcast: true,
      retry: {
        maxRetries: 3,
        strategy: "exponential" as const,
        delay: 500,
        delayMax: 10000,
        multiplier: 3,
        jitter: true,
      },
    } as unknown as MessageMetadata;

    const result = buildEnvelope(outbound, "high.priority", metadata);

    expect(result).toMatchSnapshot({
      payload: expect.any(Buffer),
      timestamp: expect.any(Number),
    });
    expect(result.priority).toBe(5);
    expect(result.expiry).toBe(30000);
    expect(result.broadcast).toBe(true);
    expect(result.maxRetries).toBe(3);
    expect(result.retryStrategy).toBe("exponential");
    expect(result.retryDelay).toBe(500);
    expect(result.retryDelayMax).toBe(10000);
    expect(result.retryMultiplier).toBe(3);
    expect(result.retryJitter).toBe(true);
  });

  it("should use override priority over metadata priority", () => {
    const metadata = {
      priority: 5,
      expiry: 30000,
      broadcast: false,
      retry: null,
    } as unknown as MessageMetadata;

    const result = buildEnvelope(outbound, "test.topic", metadata, { priority: 10 });

    expect(result).toMatchSnapshot({
      payload: expect.any(Buffer),
      timestamp: expect.any(Number),
    });
    expect(result.priority).toBe(10);
    expect(result.expiry).toBe(30000);
  });

  it("should use override expiry over metadata expiry", () => {
    const metadata = {
      priority: 5,
      expiry: 30000,
      broadcast: false,
      retry: null,
    } as unknown as MessageMetadata;

    const result = buildEnvelope(outbound, "test.topic", metadata, { expiry: 60000 });

    expect(result).toMatchSnapshot({
      payload: expect.any(Buffer),
      timestamp: expect.any(Number),
    });
    expect(result.priority).toBe(5);
    expect(result.expiry).toBe(60000);
  });

  it("should fall back to metadata values when overrides are omitted", () => {
    const metadata = {
      priority: 3,
      expiry: 15000,
      broadcast: false,
      retry: null,
    } as unknown as MessageMetadata;

    const result = buildEnvelope(outbound, "test.topic", metadata);

    expect(result).toMatchSnapshot({
      payload: expect.any(Buffer),
      timestamp: expect.any(Number),
    });
    expect(result.priority).toBe(3);
    expect(result.expiry).toBe(15000);
  });

  it("should fall back to metadata values when overrides object is empty", () => {
    const metadata = {
      priority: 7,
      expiry: 20000,
      broadcast: true,
      retry: null,
    } as unknown as MessageMetadata;

    const result = buildEnvelope(outbound, "test.topic", metadata, {});

    expect(result).toMatchSnapshot({
      payload: expect.any(Buffer),
      timestamp: expect.any(Number),
    });
    expect(result.priority).toBe(7);
    expect(result.expiry).toBe(20000);
  });
});
