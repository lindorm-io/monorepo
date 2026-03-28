import type { IrisEnvelope } from "../../../types/iris-envelope";
import { serializeStreamFields } from "./serialize-stream-fields";

const createEnvelope = (overrides: Partial<IrisEnvelope> = {}): IrisEnvelope => ({
  payload: Buffer.from('{"hello":"world"}'),
  headers: { "x-trace-id": "abc-123" },
  topic: "orders.created",
  priority: 0,
  timestamp: 1700000000000,
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
  ...overrides,
});

describe("serializeStreamFields", () => {
  it("should serialize a minimal envelope", () => {
    const result = serializeStreamFields(createEnvelope());
    expect(result).toMatchSnapshot();
  });

  it("should serialize payload as base64", () => {
    const envelope = createEnvelope({ payload: Buffer.from("test-data") });
    const result = serializeStreamFields(envelope);
    const payloadIndex = result.indexOf("payload");
    expect(result[payloadIndex + 1]).toBe(Buffer.from("test-data").toString("base64"));
  });

  it("should serialize headers as JSON", () => {
    const headers = { "x-trace": "abc", "x-custom": "value" };
    const envelope = createEnvelope({ headers });
    const result = serializeStreamFields(envelope);
    const headersIndex = result.indexOf("headers");
    expect(result[headersIndex + 1]).toBe(JSON.stringify(headers));
  });

  it("should serialize null expiry as empty string", () => {
    const result = serializeStreamFields(createEnvelope({ expiry: null }));
    const expiryIndex = result.indexOf("expiry");
    expect(result[expiryIndex + 1]).toBe("");
  });

  it("should serialize non-null expiry as string number", () => {
    const result = serializeStreamFields(createEnvelope({ expiry: 30000 }));
    const expiryIndex = result.indexOf("expiry");
    expect(result[expiryIndex + 1]).toBe("30000");
  });

  it("should serialize boolean fields as strings", () => {
    const result = serializeStreamFields(
      createEnvelope({ broadcast: true, retryJitter: true }),
    );
    const broadcastIndex = result.indexOf("broadcast");
    const jitterIndex = result.indexOf("retryJitter");
    expect(result[broadcastIndex + 1]).toBe("true");
    expect(result[jitterIndex + 1]).toBe("true");
  });

  it("should serialize null replyTo and correlationId as empty strings", () => {
    const result = serializeStreamFields(createEnvelope());
    const replyToIndex = result.indexOf("replyTo");
    const correlationIdIndex = result.indexOf("correlationId");
    expect(result[replyToIndex + 1]).toBe("");
    expect(result[correlationIdIndex + 1]).toBe("");
  });

  it("should serialize non-null replyTo and correlationId", () => {
    const result = serializeStreamFields(
      createEnvelope({ replyTo: "reply-queue", correlationId: "corr-123" }),
    );
    const replyToIndex = result.indexOf("replyTo");
    const correlationIdIndex = result.indexOf("correlationId");
    expect(result[replyToIndex + 1]).toBe("reply-queue");
    expect(result[correlationIdIndex + 1]).toBe("corr-123");
  });

  it("should produce an even-length array of field-value pairs", () => {
    const result = serializeStreamFields(createEnvelope());
    expect(result.length % 2).toBe(0);
  });

  it("should produce all string values", () => {
    const result = serializeStreamFields(
      createEnvelope({
        priority: 5,
        attempt: 2,
        maxRetries: 10,
        expiry: 60000,
        broadcast: true,
        replyTo: "q",
        correlationId: "c",
      }),
    );
    for (const item of result) {
      expect(typeof item).toBe("string");
    }
  });

  it("should serialize a fully populated envelope", () => {
    const result = serializeStreamFields(
      createEnvelope({
        priority: 7,
        attempt: 3,
        maxRetries: 5,
        retryStrategy: "exponential",
        retryDelay: 500,
        retryDelayMax: 10000,
        retryMultiplier: 3,
        retryJitter: true,
        expiry: 60000,
        broadcast: true,
        replyTo: "reply-queue",
        correlationId: "corr-456",
      }),
    );
    expect(result).toMatchSnapshot();
  });
});
