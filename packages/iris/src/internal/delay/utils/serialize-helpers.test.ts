import type { IrisEnvelope } from "../../types/iris-envelope.js";
import type { DelayedEntry } from "../../../types/delay.js";
import { deserializeDelayedEntry, serializeDelayedEntry } from "./serialize-helpers.js";
import { describe, expect, it } from "vitest";

const createEnvelope = (overrides: Partial<IrisEnvelope> = {}): IrisEnvelope => ({
  topic: "test-topic",
  payload: Buffer.from("hello world"),
  headers: { "x-trace": "abc123" },
  priority: 5,
  timestamp: 1700000000000,
  expiry: null,
  broadcast: false,
  attempt: 1,
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

const createEntry = (overrides: Partial<DelayedEntry> = {}): DelayedEntry => ({
  id: "delay-1",
  envelope: createEnvelope(),
  topic: "test-topic",
  deliverAt: 1700000005000,
  ...overrides,
});

describe("serialize-helpers (delay)", () => {
  it("should roundtrip a DelayedEntry with Buffer payload", () => {
    const entry = createEntry();
    const json = serializeDelayedEntry(entry);
    const restored = deserializeDelayedEntry(json);

    expect(Buffer.isBuffer(restored.envelope.payload)).toBe(true);
    expect(restored.envelope.payload.toString()).toBe("hello world");
    expect(restored.id).toBe(entry.id);
    expect(restored.topic).toBe(entry.topic);
    expect(restored.deliverAt).toBe(entry.deliverAt);
  });

  it("should preserve all envelope fields", () => {
    const entry = createEntry();
    const restored = deserializeDelayedEntry(serializeDelayedEntry(entry));

    expect(restored.envelope.topic).toBe("test-topic");
    expect(restored.envelope.headers).toEqual({ "x-trace": "abc123" });
    expect(restored.envelope.priority).toBe(5);
    expect(restored.envelope.timestamp).toBe(1700000000000);
    expect(restored.envelope.attempt).toBe(1);
    expect(restored.envelope.maxRetries).toBe(3);
    expect(restored.envelope.retryStrategy).toBe("constant");
  });

  it("should handle empty Buffer payload", () => {
    const entry = createEntry({
      envelope: createEnvelope({ payload: Buffer.alloc(0) }),
    });
    const restored = deserializeDelayedEntry(serializeDelayedEntry(entry));

    expect(Buffer.isBuffer(restored.envelope.payload)).toBe(true);
    expect(restored.envelope.payload.length).toBe(0);
  });

  it("should handle binary payload", () => {
    const binary = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x80]);
    const entry = createEntry({
      envelope: createEnvelope({ payload: binary }),
    });
    const restored = deserializeDelayedEntry(serializeDelayedEntry(entry));

    expect(restored.envelope.payload).toEqual(binary);
  });

  it("should produce valid JSON", () => {
    const json = serializeDelayedEntry(createEntry());
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
