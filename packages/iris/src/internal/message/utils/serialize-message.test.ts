import type { MessageMetadata } from "../types/metadata.js";
import { serializeMessage } from "./serialize-message.js";
import { describe, expect, it } from "vitest";

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

describe("serializeMessage", () => {
  it("should serialize basic fields into body JSON", () => {
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
          key: "count",
          decorator: "Field",
          default: null,
          enum: null,
          max: null,
          min: null,
          nullable: false,
          optional: false,
          schema: null,
          transform: null,
          type: "integer",
        },
      ],
    };

    const result = serializeMessage({ name: "hello", count: 42 }, metadata);

    expect(result).toMatchSnapshot();
  });

  it("should apply @Transform.to during serialization", () => {
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

    const result = serializeMessage({ score: 0.75 }, metadata);

    expect(result).toMatchSnapshot();
  });

  it("should extract @Header fields into headers dict and remove from body", () => {
    const metadata: MessageMetadata = {
      ...baseMetadata,
      fields: [
        {
          key: "data",
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

    const result = serializeMessage({ data: "payload", traceId: "abc-123" }, metadata);

    expect(result).toMatchSnapshot();
    expect(result.headers["x-trace-id"]).toBe("abc-123");
    expect(JSON.parse(result.body)).not.toHaveProperty("traceId");
  });

  it("should handle null and undefined field values", () => {
    const metadata: MessageMetadata = {
      ...baseMetadata,
      fields: [
        {
          key: "label",
          decorator: "Field",
          default: null,
          enum: null,
          max: null,
          min: null,
          nullable: true,
          optional: false,
          schema: null,
          transform: null,
          type: "string",
        },
        {
          key: "missing",
          decorator: "Field",
          default: null,
          enum: null,
          max: null,
          min: null,
          nullable: false,
          optional: true,
          schema: null,
          transform: null,
          type: "string",
        },
      ],
    };

    const result = serializeMessage({ label: null }, metadata);

    expect(result).toMatchSnapshot();
  });

  it("should not include null/undefined header values in headers dict", () => {
    const metadata: MessageMetadata = {
      ...baseMetadata,
      fields: [
        {
          key: "correlationId",
          decorator: "Field",
          default: null,
          enum: null,
          max: null,
          min: null,
          nullable: true,
          optional: false,
          schema: null,
          transform: null,
          type: "string",
        },
      ],
      headers: [{ key: "correlationId", headerName: "x-correlation-id" }],
    };

    const result = serializeMessage({ correlationId: null }, metadata);

    expect(result.headers).not.toHaveProperty("x-correlation-id");
  });

  it("should apply @Transform.to before extracting @Header value", () => {
    const metadata: MessageMetadata = {
      ...baseMetadata,
      fields: [
        {
          key: "data",
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
          key: "priority",
          decorator: "Field",
          default: null,
          enum: null,
          max: null,
          min: null,
          nullable: false,
          optional: false,
          schema: null,
          transform: {
            to: (v: unknown) => (v as number) * 10,
            from: (v: unknown) => (v as number) / 10,
          },
          type: "integer",
        },
      ],
      headers: [{ key: "priority", headerName: "x-priority" }],
    };

    const result = serializeMessage({ data: "payload", priority: 5 }, metadata);

    expect(result).toMatchSnapshot();
    expect(result.headers["x-priority"]).toBe("50");
    expect(JSON.parse(result.body)).not.toHaveProperty("priority");
  });

  it("should handle Date and complex types via JsonKit", () => {
    const metadata: MessageMetadata = {
      ...baseMetadata,
      fields: [
        {
          key: "createdAt",
          decorator: "Field",
          default: null,
          enum: null,
          max: null,
          min: null,
          nullable: false,
          optional: false,
          schema: null,
          transform: null,
          type: "date",
        },
        {
          key: "tags",
          decorator: "Field",
          default: null,
          enum: null,
          max: null,
          min: null,
          nullable: false,
          optional: false,
          schema: null,
          transform: null,
          type: "array",
        },
      ],
    };

    const date = new Date("2025-01-15T12:00:00.000Z");
    const result = serializeMessage({ createdAt: date, tags: ["a", "b"] }, metadata);

    expect(result).toMatchSnapshot();
  });
});
