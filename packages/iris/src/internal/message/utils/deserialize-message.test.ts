import { JsonKit } from "@lindorm/json-kit";
import type { MessageMetadata } from "../types/metadata";
import { deserializeMessage } from "./deserialize-message";
import { serializeMessage } from "./serialize-message";

const baseMetadata: MessageMetadata = {
  target: class TestMsg {} as any,
  broadcast: false,
  compressed: null,
  deadLetter: false,
  encrypted: null,
  fields: [],
  generated: [],
  headers: [],
  hooks: [],
  message: { decorator: "Message", name: "TestMsg" },
  namespace: "test",
  version: 1,
  persistent: false,
  priority: null,
  retry: null,
  topic: null,
  expiry: null,
  delay: null,
};

describe("deserializeMessage", () => {
  it("should parse body JSON and return data", () => {
    const body = JsonKit.stringify({ name: "hello", count: 42 });
    const result = deserializeMessage(body, {}, baseMetadata);

    expect(result).toMatchSnapshot();
  });

  it("should reattach @Header fields from headers into data", () => {
    const metadata: MessageMetadata = {
      ...baseMetadata,
      headers: [{ key: "traceId", headerName: "x-trace-id" }],
    };

    const body = JsonKit.stringify({ data: "payload" });
    const headers = { "x-trace-id": "abc-123" };

    const result = deserializeMessage(body, headers, metadata);

    expect(result).toMatchSnapshot();
    expect(result.traceId).toBe("abc-123");
  });

  it("should not inject header fields that are absent from headers dict", () => {
    const metadata: MessageMetadata = {
      ...baseMetadata,
      headers: [{ key: "traceId", headerName: "x-trace-id" }],
    };

    const body = JsonKit.stringify({ data: "payload" });
    const result = deserializeMessage(body, {}, metadata);

    expect(result).not.toHaveProperty("traceId");
  });

  it("should round-trip with serializeMessage", () => {
    const metadata: MessageMetadata = {
      ...baseMetadata,
      fields: [
        {
          key: "name",
          decorator: "Field",
          default: null,
          enum: null,
          max: null,
          min: null,
          nullable: false,
          optional: false,
          schema: null,
          transform: null,
          type: "string",
        },
        {
          key: "traceId",
          decorator: "Field",
          default: null,
          enum: null,
          max: null,
          min: null,
          nullable: false,
          optional: false,
          schema: null,
          transform: null,
          type: "string",
        },
      ],
      headers: [{ key: "traceId", headerName: "x-trace-id" }],
    };

    const original = { name: "test-event", traceId: "trace-001" };
    const serialized = serializeMessage(original, metadata);
    const deserialized = deserializeMessage(
      serialized.body,
      serialized.headers,
      metadata,
    );

    expect(deserialized.name).toBe("test-event");
    expect(deserialized.traceId).toBe("trace-001");
  });

  it("should not apply @Transform.from (handled by MessageManager.hydrate)", () => {
    const metadata: MessageMetadata = {
      ...baseMetadata,
      fields: [
        {
          key: "score",
          decorator: "Field",
          default: null,
          enum: null,
          max: null,
          min: null,
          nullable: false,
          optional: false,
          schema: null,
          transform: {
            to: (v: unknown) => (v as number) * 100,
            from: (v: unknown) => (v as number) / 100,
          },
          type: "integer",
        },
      ],
    };

    const body = JsonKit.stringify({ score: 75 });
    const result = deserializeMessage(body, {}, metadata);

    // Raw value should be returned, NOT transformed
    expect(result.score).toBe(75);
  });
});
