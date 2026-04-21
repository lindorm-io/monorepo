import { JsonKit } from "@lindorm/json-kit";
import type { MessageMetadata } from "../types/metadata.js";
import { prepareInbound } from "./prepare-inbound.js";
import { prepareOutbound } from "./prepare-outbound.js";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const mockEncrypt = vi.fn();
const mockDecrypt = vi.fn();
const mockParseAes = vi.fn((_data: unknown) => ({ keyId: "key-1" }));

vi.mock("@lindorm/aes", async () => ({
  AesKit: vi.fn(function () {
    return {
      encrypt: mockEncrypt,
      decrypt: mockDecrypt,
    };
  }),
  parseAes: (data: unknown) => mockParseAes(data),
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

describe("prepareInbound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should deserialize plain payload", async () => {
    const body = JsonKit.stringify({ name: "hello", count: 42 });
    const result = await prepareInbound(Buffer.from(body), {}, baseMetadata);

    expect(result).toMatchSnapshot();
  });

  it("should deserialize plain string payload", async () => {
    const body = JsonKit.stringify({ name: "world", count: 7 });
    const result = await prepareInbound(body, {}, baseMetadata);

    expect(result).toMatchSnapshot();
  });

  it("should decompress then deserialize", async () => {
    const metadata: MessageMetadata = {
      ...baseMetadata,
      compressed: { algorithm: "gzip" },
    };

    const outbound = await prepareOutbound({ name: "compressed", count: 99 }, metadata);

    const result = await prepareInbound(outbound.payload, outbound.headers, metadata);

    expect(result.name).toBe("compressed");
    expect(result.count).toBe(99);
  });

  it("should decrypt then deserialize", async () => {
    const metadata: MessageMetadata = {
      ...baseMetadata,
      encrypted: { predicate: { algorithm: "aes-256-gcm" } as any },
    };

    const originalBody = JsonKit.stringify({ name: "secret", count: 1 });
    mockDecrypt.mockReturnValue(Buffer.from(originalBody).toString("base64"));

    const result = await prepareInbound(
      Buffer.from("encrypted-token"),
      { "x-iris-encrypted": "true" },
      metadata,
      {
        find: vi.fn().mockResolvedValue({ id: "key-1" }),
        findById: vi.fn().mockResolvedValue({ id: "key-1" }),
      } as any,
    );

    expect(result.name).toBe("secret");
    expect(result.count).toBe(1);
  });

  it("should decrypt then decompress then deserialize", async () => {
    const metadata: MessageMetadata = {
      ...baseMetadata,
      compressed: { algorithm: "gzip" },
      encrypted: { predicate: { algorithm: "aes-256-gcm" } as any },
    };

    // Use prepareOutbound to create a realistic payload, capturing what encrypt receives
    let capturedPayload: string | undefined;
    mockEncrypt.mockImplementation((data: string) => {
      capturedPayload = data;
      return "encrypted-token";
    });

    const mockAmphora = {
      find: vi.fn().mockResolvedValue({ id: "key-1" }),
      findById: vi.fn().mockResolvedValue({ id: "key-1" }),
    } as any;
    const outbound = await prepareOutbound(
      { name: "both", count: 3 },
      metadata,
      mockAmphora,
    );

    expect(capturedPayload).toBeDefined();

    // Mock decrypt to return what encrypt captured (the compressed payload string)
    mockDecrypt.mockReturnValue(capturedPayload);

    const result = await prepareInbound(
      outbound.payload,
      outbound.headers,
      metadata,
      mockAmphora,
    );

    expect(result.name).toBe("both");
    expect(result.count).toBe(3);
  });

  it("should round-trip with prepareOutbound for plain messages", async () => {
    const message = { name: "round-trip", count: 55 };
    const outbound = await prepareOutbound(message, baseMetadata);
    const result = await prepareInbound(outbound.payload, outbound.headers, baseMetadata);

    expect(result.name).toBe("round-trip");
    expect(result.count).toBe(55);
  });

  it("should round-trip with prepareOutbound for compressed messages", async () => {
    const metadata: MessageMetadata = {
      ...baseMetadata,
      compressed: { algorithm: "deflate" },
    };

    const message = { name: "compressed-trip", count: 77 };
    const outbound = await prepareOutbound(message, metadata);
    const result = await prepareInbound(outbound.payload, outbound.headers, metadata);

    expect(result.name).toBe("compressed-trip");
    expect(result.count).toBe(77);
  });

  it("should throw when header says encrypted but metadata.encrypted is null", async () => {
    const body = JsonKit.stringify({ name: "plain", count: 10 });

    await expect(
      prepareInbound(
        Buffer.from(body),
        { "x-iris-encrypted": "true" },
        baseMetadata, // baseMetadata has encrypted: null
      ),
    ).rejects.toThrow(
      "Received encrypted message but @Encrypted is not configured on this message class",
    );

    expect(mockDecrypt).not.toHaveBeenCalled();
  });

  it("should reject unencrypted payload when @Encrypted is configured", async () => {
    const metadata: MessageMetadata = {
      ...baseMetadata,
      encrypted: { predicate: { algorithm: "aes-256-gcm" } as any },
    };

    const body = JsonKit.stringify({ name: "plain", count: 10 });
    await expect(prepareInbound(Buffer.from(body), {}, metadata)).rejects.toThrow(
      "Message requires encryption but received unencrypted payload",
    );

    expect(mockDecrypt).not.toHaveBeenCalled();
  });

  it("should skip decryption when neither header nor metadata indicate encryption", async () => {
    const body = JsonKit.stringify({ name: "plain", count: 10 });
    const result = await prepareInbound(Buffer.from(body), {}, baseMetadata);

    expect(result.name).toBe("plain");
    expect(mockDecrypt).not.toHaveBeenCalled();
  });
});
