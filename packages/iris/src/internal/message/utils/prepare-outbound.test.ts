import { AesKit, parseAes } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { JsonKit } from "@lindorm/json-kit";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_KEY_ENC_MESSAGE } from "../../__fixtures__/keys.js";
import type { MessageEncryptionContext } from "../types/encryption-context.js";
import type { MessageMetadata } from "../types/metadata.js";
import { decompress } from "./compress.js";
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
      key: "traceId",
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
  let encryption: MessageEncryptionContext;

  /** Unwrap a real aes token back to the bytes that went into it. */
  const unwrap = (token: string, amphora: IAmphora): Promise<Buffer> =>
    amphora
      .findById(parseAes(token).keyId)
      .then((kryptos) =>
        Buffer.from(new AesKit({ kryptos }).decrypt<string>(token), "base64"),
      );

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
    const metadata: MessageMetadata = { ...baseMetadata, encrypted };

    const result = await prepareOutbound(
      { name: "hello", traceId: "t-1" },
      metadata,
      encryption,
    );

    expect(result.headers["x-iris-encrypted"]).toBe("true");
    expect(result.payload).toBeInstanceOf(Buffer);
    expect(result.payload.toString("utf-8")).not.toContain("hello");

    const token = result.payload.toString("utf-8");
    expect(parseAes(token).keyId).toBe(TEST_KEY_ENC_MESSAGE.id);

    const body = await unwrap(token, encryption.amphora!);
    expect(JsonKit.parse<Record<string, unknown>>(body.toString("utf-8")).name).toBe(
      "hello",
    );
  });

  it("should compress then encrypt when both are configured", async () => {
    const metadata: MessageMetadata = {
      ...baseMetadata,
      compressed: { algorithm: "deflate" },
      encrypted,
    };

    const result = await prepareOutbound(
      { name: "hello", traceId: "t-1" },
      metadata,
      encryption,
    );

    expect(result.headers["x-iris-compression"]).toBe("deflate");
    expect(result.headers["x-iris-encrypted"]).toBe("true");

    // Order matters: what the cipher wrapped must be the COMPRESSED bytes.
    const wrapped = await unwrap(result.payload.toString("utf-8"), encryption.amphora!);
    const body = await decompress(wrapped, "deflate");

    expect(JsonKit.parse<Record<string, unknown>>(body.toString("utf-8")).name).toBe(
      "hello",
    );
  });
});
