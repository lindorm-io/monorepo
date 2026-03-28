import { parseStreamEntry } from "./parse-stream-entry";

const createFields = (overrides: Record<string, string> = {}): Array<string> => {
  const defaults: Record<string, string> = {
    payload: Buffer.from('{"data":"test"}').toString("base64"),
    headers: JSON.stringify({ "x-trace-id": "abc" }),
    topic: "orders.created",
    attempt: "0",
    maxRetries: "3",
    retryStrategy: "constant",
    retryDelay: "1000",
    retryDelayMax: "30000",
    retryMultiplier: "2",
    retryJitter: "false",
    priority: "0",
    timestamp: "1700000000000",
    expiry: "",
    broadcast: "false",
    replyTo: "",
    correlationId: "",
  };

  const merged = { ...defaults, ...overrides };
  const result: Array<string> = [];
  for (const [key, value] of Object.entries(merged)) {
    result.push(key, value);
  }
  return result;
};

describe("parseStreamEntry", () => {
  it("should parse a minimal entry", () => {
    const result = parseStreamEntry("1700000000000-0", createFields());
    expect(result).toMatchSnapshot({
      payload: expect.any(Buffer),
    });
  });

  it("should decode base64 payload to Buffer", () => {
    const payload = Buffer.from('{"data":"test"}');
    const fields = createFields({ payload: payload.toString("base64") });
    const result = parseStreamEntry("1-0", fields);
    expect(result.payload).toEqual(payload);
  });

  it("should parse headers from JSON", () => {
    const headers = { "x-trace": "abc", "x-custom": "value" };
    const fields = createFields({ headers: JSON.stringify(headers) });
    const result = parseStreamEntry("1-0", fields);
    expect(result.headers).toMatchSnapshot();
  });

  it("should parse numeric fields as numbers", () => {
    const fields = createFields({
      attempt: "2",
      maxRetries: "5",
      retryDelay: "500",
      retryDelayMax: "10000",
      retryMultiplier: "3",
      priority: "7",
      timestamp: "1700000000000",
    });
    const result = parseStreamEntry("1-0", fields);
    expect(result.attempt).toBe(2);
    expect(result.maxRetries).toBe(5);
    expect(result.retryDelay).toBe(500);
    expect(result.retryDelayMax).toBe(10000);
    expect(result.retryMultiplier).toBe(3);
    expect(result.priority).toBe(7);
    expect(result.timestamp).toBe(1700000000000);
  });

  it("should parse boolean fields", () => {
    const fields = createFields({ retryJitter: "true", broadcast: "true" });
    const result = parseStreamEntry("1-0", fields);
    expect(result.retryJitter).toBe(true);
    expect(result.broadcast).toBe(true);
  });

  it("should parse false boolean fields", () => {
    const fields = createFields({ retryJitter: "false", broadcast: "false" });
    const result = parseStreamEntry("1-0", fields);
    expect(result.retryJitter).toBe(false);
    expect(result.broadcast).toBe(false);
  });

  it("should parse empty expiry as null", () => {
    const fields = createFields({ expiry: "" });
    const result = parseStreamEntry("1-0", fields);
    expect(result.expiry).toBeNull();
  });

  it("should parse non-empty expiry as number", () => {
    const fields = createFields({ expiry: "30000" });
    const result = parseStreamEntry("1-0", fields);
    expect(result.expiry).toBe(30000);
  });

  it("should parse empty replyTo as null", () => {
    const fields = createFields({ replyTo: "" });
    const result = parseStreamEntry("1-0", fields);
    expect(result.replyTo).toBeNull();
  });

  it("should parse non-empty replyTo", () => {
    const fields = createFields({ replyTo: "reply-queue" });
    const result = parseStreamEntry("1-0", fields);
    expect(result.replyTo).toBe("reply-queue");
  });

  it("should parse empty correlationId as null", () => {
    const fields = createFields({ correlationId: "" });
    const result = parseStreamEntry("1-0", fields);
    expect(result.correlationId).toBeNull();
  });

  it("should parse non-empty correlationId", () => {
    const fields = createFields({ correlationId: "corr-123" });
    const result = parseStreamEntry("1-0", fields);
    expect(result.correlationId).toBe("corr-123");
  });

  it("should preserve the stream entry id", () => {
    const result = parseStreamEntry("1700000000000-42", createFields());
    expect(result.id).toBe("1700000000000-42");
  });

  it("should parse retry strategy", () => {
    const fields = createFields({ retryStrategy: "exponential" });
    const result = parseStreamEntry("1-0", fields);
    expect(result.retryStrategy).toBe("exponential");
  });

  it("should parse a fully populated entry", () => {
    const result = parseStreamEntry(
      "1700000000000-5",
      createFields({
        attempt: "3",
        maxRetries: "5",
        retryStrategy: "exponential",
        retryDelay: "500",
        retryDelayMax: "10000",
        retryMultiplier: "3",
        retryJitter: "true",
        priority: "7",
        expiry: "60000",
        broadcast: "true",
        replyTo: "reply-q",
        correlationId: "corr-456",
      }),
    );
    expect(result).toMatchSnapshot({
      payload: expect.any(Buffer),
    });
  });

  it("should handle missing fields with defaults", () => {
    const result = parseStreamEntry("1-0", []);
    expect(result.payload).toEqual(Buffer.from("", "base64"));
    expect(result.headers).toEqual({});
    expect(result.topic).toBe("");
    expect(result.attempt).toBe(0);
    expect(result.maxRetries).toBe(0);
    expect(result.retryStrategy).toBe("constant");
    expect(result.retryDelay).toBe(1000);
    expect(result.retryDelayMax).toBe(30000);
    expect(result.retryMultiplier).toBe(2);
    expect(result.retryJitter).toBe(false);
    expect(result.priority).toBe(0);
    expect(result.timestamp).toBe(0);
    expect(result.expiry).toBeNull();
    expect(result.broadcast).toBe(false);
    expect(result.replyTo).toBeNull();
    expect(result.correlationId).toBeNull();
  });
});
