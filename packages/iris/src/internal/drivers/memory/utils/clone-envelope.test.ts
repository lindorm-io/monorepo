import { describe, expect, test } from "vitest";
import type { MemoryEnvelope } from "../types/memory-store.js";
import { cloneEnvelopeForDelivery } from "./clone-envelope.js";

const baseEnvelope = (): MemoryEnvelope =>
  ({
    payload: Buffer.from("payload"),
    headers: { "x-one": "1" },
    topic: "topic",
    priority: 0,
    timestamp: 0,
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
  }) as MemoryEnvelope;

describe("cloneEnvelopeForDelivery", () => {
  test("returns a value-equal copy", () => {
    const env = baseEnvelope();
    expect(cloneEnvelopeForDelivery(env)).toEqual(env);
  });

  test("isolates the headers object so mutations do not leak", () => {
    const env = baseEnvelope();
    const clone = cloneEnvelopeForDelivery(env);

    clone.headers["x-two"] = "2";

    expect(env.headers).toEqual({ "x-one": "1" });
    expect(clone.headers).toEqual({ "x-one": "1", "x-two": "2" });
  });

  test("shares the read-only payload buffer by reference", () => {
    const env = baseEnvelope();
    expect(cloneEnvelopeForDelivery(env).payload).toBe(env.payload);
  });
});
