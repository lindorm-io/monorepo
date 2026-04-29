import type { IrisEnvelope } from "../../types/iris-envelope.js";
import type { DeadLetterEntry } from "../../../types/dead-letter.js";
import {
  deserializeDeadLetterEntry,
  serializeDeadLetterEntry,
} from "./serialize-helpers.js";
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

const createEntry = (overrides: Partial<DeadLetterEntry> = {}): DeadLetterEntry => ({
  id: "dlq-1",
  envelope: createEnvelope(),
  topic: "test-topic",
  error: "Something went wrong",
  errorStack: "Error: Something went wrong\n    at test.ts:1",
  attempt: 3,
  timestamp: 1700000010000,
  ...overrides,
});

describe("serialize-helpers (dead-letter)", () => {
  it("should roundtrip a DeadLetterEntry with Buffer payload", () => {
    const entry = createEntry();
    const json = serializeDeadLetterEntry(entry);
    const restored = deserializeDeadLetterEntry(json);

    expect(Buffer.isBuffer(restored.envelope.payload)).toBe(true);
    expect(restored.envelope.payload.toString()).toBe("hello world");
    expect(restored.id).toBe(entry.id);
    expect(restored.topic).toBe(entry.topic);
    expect(restored.error).toBe(entry.error);
    expect(restored.errorStack).toBe(entry.errorStack);
    expect(restored.attempt).toBe(entry.attempt);
    expect(restored.timestamp).toBe(entry.timestamp);
  });

  it("should preserve all envelope fields", () => {
    const entry = createEntry();
    const restored = deserializeDeadLetterEntry(serializeDeadLetterEntry(entry));

    expect(restored.envelope.topic).toBe("test-topic");
    expect(restored.envelope.headers).toEqual({ "x-trace": "abc123" });
    expect(restored.envelope.priority).toBe(5);
    expect(restored.envelope.timestamp).toBe(1700000000000);
  });

  it("should handle empty Buffer payload", () => {
    const entry = createEntry({
      envelope: createEnvelope({ payload: Buffer.alloc(0) }),
    });
    const restored = deserializeDeadLetterEntry(serializeDeadLetterEntry(entry));

    expect(Buffer.isBuffer(restored.envelope.payload)).toBe(true);
    expect(restored.envelope.payload.length).toBe(0);
  });

  it("should handle binary payload", () => {
    const binary = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x80]);
    const entry = createEntry({
      envelope: createEnvelope({ payload: binary }),
    });
    const restored = deserializeDeadLetterEntry(serializeDeadLetterEntry(entry));

    expect(restored.envelope.payload).toEqual(binary);
  });

  it("should handle null errorStack", () => {
    const entry = createEntry({ errorStack: null });
    const restored = deserializeDeadLetterEntry(serializeDeadLetterEntry(entry));
    expect(restored.errorStack).toBeNull();
  });

  it("should produce valid JSON", () => {
    const json = serializeDeadLetterEntry(createEntry());
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
