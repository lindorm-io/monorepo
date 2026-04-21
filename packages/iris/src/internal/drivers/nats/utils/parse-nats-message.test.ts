import { parseNatsMessage } from "./parse-nats-message";
import { serializeNatsMessage } from "./serialize-nats-message";
import type { IrisEnvelope } from "../../../types/iris-envelope";
import { describe, expect, it } from "vitest";

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

describe("parseNatsMessage", () => {
  it("should round-trip an envelope through serialize/parse", () => {
    const original = createEnvelope();
    const { data } = serializeNatsMessage(original, mockHeadersInit);
    const parsed = parseNatsMessage(data);

    expect(parsed.topic).toBe(original.topic);
    expect(parsed.payload.toString()).toBe(original.payload.toString());
    expect(parsed.headers).toEqual(original.headers);
    expect(parsed.attempt).toBe(original.attempt);
  });

  it("should handle all fields", () => {
    const original = createEnvelope({
      broadcast: true,
      replyTo: "reply.subject",
      correlationId: "corr-123",
      identifierValue: "id-456",
      expiry: 1700099999000,
    });
    const { data } = serializeNatsMessage(original, mockHeadersInit);
    const parsed = parseNatsMessage(data);

    expect(parsed).toMatchSnapshot();
  });

  it("should handle missing/empty fields gracefully", () => {
    const data = new TextEncoder().encode(JSON.stringify({ topic: "test" }));
    const result = parseNatsMessage(data);
    expect(result.topic).toBe("test");
    expect(result.payload).toBeInstanceOf(Buffer);
    expect(result.attempt).toBe(0);
    expect(result.replyTo).toBeNull();
  });
});
