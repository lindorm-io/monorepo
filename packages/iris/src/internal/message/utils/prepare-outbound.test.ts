import { JsonKit } from "@lindorm/json-kit";
import type { MessageMetadata } from "../types/metadata";
import { prepareOutbound } from "./prepare-outbound";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEncrypt = vi.fn();

vi.mock("@lindorm/aes", async () => ({
  AesKit: vi.fn(function () {
    return {
      encrypt: mockEncrypt,
    };
  }),
}));

const baseMetadata: MessageMetadata = {
  target: class TestMsg {} as any,
  broadcast: false,
  compressed: null,
  deadLetter: false,
  encrypted: null,
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
  generated: [],
  headers: [{ key: "traceId", headerName: "x-trace-id" }],
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

describe("prepareOutbound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should serialize plain message into Buffer payload with header fields", async () => {
    const result = await prepareOutbound({ name: "hello", traceId: "t-1" }, baseMetadata);

    expect(result.payload).toBeInstanceOf(Buffer);
    expect(result.headers["x-trace-id"]).toBe("t-1");
    expect(result.headers).not.toHaveProperty("x-iris-compression");
    expect(result.headers).not.toHaveProperty("x-iris-encrypted");

    const body = JsonKit.parse<Record<string, unknown>>(result.payload.toString("utf-8"));
    expect(body.name).toBe("hello");
    expect(body).not.toHaveProperty("traceId");
  });

  it("should compress payload and set compression header", async () => {
    const metadata: MessageMetadata = {
      ...baseMetadata,
      compressed: { algorithm: "gzip" },
    };

    const result = await prepareOutbound({ name: "hello", traceId: "t-1" }, metadata);

    expect(result.headers["x-iris-compression"]).toBe("gzip");
    expect(result.payload).toBeInstanceOf(Buffer);
    // Compressed payload should differ from raw JSON
    const rawJson = JSON.stringify({ name: "hello" });
    expect(result.payload.toString("utf-8")).not.toBe(rawJson);
  });

  it("should encrypt payload and set encrypted header", async () => {
    const mockAmphora = { find: vi.fn().mockResolvedValue({ id: "key-1" }) } as any;
    mockEncrypt.mockReturnValue("encrypted-token");

    const metadata: MessageMetadata = {
      ...baseMetadata,
      encrypted: { predicate: { algorithm: "aes-256-gcm" } as any },
    };

    const result = await prepareOutbound(
      { name: "hello", traceId: "t-1" },
      metadata,
      mockAmphora,
    );

    expect(result.headers["x-iris-encrypted"]).toBe("true");
    expect(result.payload).toBeInstanceOf(Buffer);
    expect(result.payload.toString("utf-8")).toBe("encrypted-token");
  });

  it("should compress then encrypt when both are configured", async () => {
    const mockAmphora = { find: vi.fn().mockResolvedValue({ id: "key-1" }) } as any;
    mockEncrypt.mockReturnValue("compressed-then-encrypted");

    const metadata: MessageMetadata = {
      ...baseMetadata,
      compressed: { algorithm: "deflate" },
      encrypted: { predicate: { algorithm: "aes-256-gcm" } as any },
    };

    const result = await prepareOutbound(
      { name: "hello", traceId: "t-1" },
      metadata,
      mockAmphora,
    );

    expect(result.headers["x-iris-compression"]).toBe("deflate");
    expect(result.headers["x-iris-encrypted"]).toBe("true");
    expect(result.payload.toString("utf-8")).toBe("compressed-then-encrypted");
  });
});
