import { serializeNatsMessage } from "./serialize-nats-message";
import type { IrisEnvelope } from "../../../types/iris-envelope";
import { describe, expect, it } from "vitest";

const createEnvelope = (overrides?: Partial<IrisEnvelope>): IrisEnvelope => ({
  topic: "test.topic",
  payload: Buffer.from(JSON.stringify({ body: "hello" })),
  headers: { "x-type": "TestMessage" },
  priority: 0,
  timestamp: 1700000000000,
  expiry: null,
  broadcast: false,
  attempt: 0,
  maxRetries: 3,
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

const mockHeadersInit = () => {
  const store = new Map<string, string>();
  return {
    get: (k: string) => store.get(k) ?? "",
    set: (k: string, v: string) => {
      store.set(k, v);
    },
    has: (k: string) => store.has(k),
    values: (k: string) => (store.has(k) ? [store.get(k)!] : []),
  };
};

describe("serializeNatsMessage", () => {
  it("should serialize envelope to Uint8Array data", () => {
    const result = serializeNatsMessage(createEnvelope(), mockHeadersInit);
    expect(result.data).toBeInstanceOf(Uint8Array);
    const parsed = JSON.parse(new TextDecoder().decode(result.data));
    expect(parsed.topic).toBe("test.topic");
    expect(parsed.attempt).toBe(0);
  });

  it("should encode payload as base64", () => {
    const result = serializeNatsMessage(createEnvelope(), mockHeadersInit);
    const parsed = JSON.parse(new TextDecoder().decode(result.data));
    expect(Buffer.from(parsed.payload, "base64").toString()).toMatchSnapshot();
  });

  it("should include all envelope fields", () => {
    const envelope = createEnvelope({
      broadcast: true,
      replyTo: "reply.subject",
      correlationId: "corr-123",
      identifierValue: "id-456",
    });
    const result = serializeNatsMessage(envelope, mockHeadersInit);
    const parsed = JSON.parse(new TextDecoder().decode(result.data));
    expect(parsed).toMatchSnapshot();
  });
});
