import type { MessageMetadata } from "../../../message/types/metadata";
import type { ParsedAmqpMessage } from "./parse-amqp-headers";
import { buildRabbitEnvelope } from "./build-rabbit-envelope";
import { describe, expect, it } from "vitest";

const createParsed = (overrides: Partial<ParsedAmqpMessage> = {}): ParsedAmqpMessage => ({
  payload: Buffer.from("test-payload"),
  headers: {},
  envelope: {
    topic: "orders.created",
    timestamp: 1700000000000,
    attempt: 0,
    correlationId: null,
    replyTo: null,
    expiry: null,
    broadcast: false,
    priority: 0,
  },
  ...overrides,
});

const createMetadata = (overrides: Partial<MessageMetadata> = {}): MessageMetadata =>
  ({
    broadcast: false,
    expiry: null,
    retry: null,
    ...overrides,
  }) as unknown as MessageMetadata;

describe("buildRabbitEnvelope", () => {
  it("should build envelope from parsed message with minimal metadata", () => {
    const result = buildRabbitEnvelope(createParsed(), createMetadata());
    expect(result).toMatchSnapshot();
  });

  it("should use parsed envelope values over metadata defaults", () => {
    const parsed = createParsed({
      envelope: {
        topic: "custom.topic",
        timestamp: 1700000001000,
        attempt: 3,
        correlationId: "corr-1",
        replyTo: "reply-q",
        expiry: 5000,
        broadcast: true,
        priority: 7,
      },
    });
    const result = buildRabbitEnvelope(parsed, createMetadata());
    expect(result).toMatchSnapshot();
  });

  it("should fall back to metadata for retry config", () => {
    const metadata = createMetadata({
      retry: {
        maxRetries: 3,
        strategy: "exponential",
        delay: 500,
        delayMax: 10000,
        multiplier: 3,
        jitter: true,
      },
    });
    const result = buildRabbitEnvelope(createParsed(), metadata);
    expect(result).toMatchSnapshot();
  });

  it("should fall back to metadata expiry when parsed has none", () => {
    const metadata = createMetadata({ expiry: 60000 });
    const result = buildRabbitEnvelope(createParsed(), metadata);
    expect(result.expiry).toBe(60000);
  });

  it("should prefer parsed expiry over metadata expiry", () => {
    const parsed = createParsed({
      envelope: {
        topic: "test",
        expiry: 5000,
      },
    });
    const metadata = createMetadata({ expiry: 60000 });
    const result = buildRabbitEnvelope(parsed, metadata);
    expect(result.expiry).toBe(5000);
  });

  it("should fall back to metadata broadcast when parsed has none", () => {
    const parsed = createParsed({
      envelope: { topic: "test" },
    });
    const metadata = createMetadata({ broadcast: true });
    const result = buildRabbitEnvelope(parsed, metadata);
    expect(result.broadcast).toBe(true);
  });

  it("should preserve user headers from parsed message", () => {
    const parsed = createParsed({
      headers: { "x-trace": "abc", "x-custom": "val" },
    });
    const result = buildRabbitEnvelope(parsed, createMetadata());
    expect(result.headers).toMatchSnapshot();
  });

  it("should preserve payload buffer from parsed message", () => {
    const payload = Buffer.from("binary-data");
    const parsed = createParsed({ payload });
    const result = buildRabbitEnvelope(parsed, createMetadata());
    expect(result.payload).toBe(payload);
  });

  it("should default to empty topic when parsed has no topic", () => {
    const parsed = createParsed({ envelope: {} });
    const result = buildRabbitEnvelope(parsed, createMetadata());
    expect(result.topic).toBe("");
  });

  it("should use metadata retry maxRetries only (not parsed headers)", () => {
    const parsed = createParsed({
      envelope: { topic: "test" },
    });
    const metadata = createMetadata({
      retry: {
        maxRetries: 3,
        strategy: "constant",
        delay: 100,
        delayMax: 5000,
        multiplier: 2,
        jitter: false,
      },
    });
    const result = buildRabbitEnvelope(parsed, metadata);
    expect(result.maxRetries).toBe(3);
  });
});
