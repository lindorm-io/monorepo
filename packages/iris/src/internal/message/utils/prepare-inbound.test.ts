import { Amphora } from "@lindorm/amphora";
import { JsonKit } from "@lindorm/json-kit";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { TEST_KEY_ENC_MESSAGE } from "../../__fixtures__/keys.js";
import type { MessageEncryptionContext } from "../types/encryption-context.js";
import type { MessageMetadata } from "../types/metadata.js";
import { prepareInbound } from "./prepare-inbound.js";
import { prepareOutbound } from "./prepare-outbound.js";

const encrypted = { condition: { purpose: "message" } };

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
      sensitive: null,
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
      sensitive: null,
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
  let encryption: MessageEncryptionContext;

  beforeEach(async () => {
    vi.clearAllMocks();

    const amphora = new Amphora({
      domain: "https://test.lindorm.io/",
      logger: createMockLogger(),
    });
    await amphora.setup();
    amphora.add(TEST_KEY_ENC_MESSAGE);

    encryption = { amphora };
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
    const metadata: MessageMetadata = { ...baseMetadata, encrypted };

    const outbound = await prepareOutbound({ name: "secret", count: 1 }, metadata, encryption); // prettier-ignore

    expect(outbound.payload.toString("utf-8")).not.toContain("secret");

    const result = await prepareInbound(
      outbound.payload,
      outbound.headers,
      metadata,
      encryption,
    );

    expect(result.name).toBe("secret");
    expect(result.count).toBe(1);
  });

  it("should decrypt then decompress then deserialize", async () => {
    const metadata: MessageMetadata = {
      ...baseMetadata,
      compressed: { algorithm: "gzip" },
      encrypted,
    };

    const outbound = await prepareOutbound({ name: "both", count: 3 }, metadata, encryption); // prettier-ignore

    const result = await prepareInbound(
      outbound.payload,
      outbound.headers,
      metadata,
      encryption,
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
  });

  it("should reject unencrypted payload when @Encrypted is configured", async () => {
    const metadata: MessageMetadata = { ...baseMetadata, encrypted };

    const body = JsonKit.stringify({ name: "plain", count: 10 });
    await expect(
      prepareInbound(Buffer.from(body), {}, metadata, encryption),
    ).rejects.toThrow("Message requires encryption but received unencrypted payload");
  });

  it("should skip decryption when neither header nor metadata indicate encryption", async () => {
    const body = JsonKit.stringify({ name: "plain", count: 10 });
    const result = await prepareInbound(Buffer.from(body), {}, baseMetadata, encryption);

    expect(result.name).toBe("plain");
  });
});
