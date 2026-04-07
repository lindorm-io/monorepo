import { createMockKryptos } from "@lindorm/kryptos";
import { IAesKit } from "../interfaces";
import { AesContent } from "../types";

const encode = (data: AesContent): string =>
  Buffer.from(JSON.stringify(data)).toString("base64url");

const decode = <T extends AesContent = string>(encoded: string): T =>
  JSON.parse(Buffer.from(encoded, "base64url").toString()) as T;

export const createMockAesKit = (): IAesKit => ({
  kryptos: createMockKryptos(),

  encrypt: jest.fn().mockImplementation((data: AesContent, mode?: string) => {
    const encoded = encode(data);

    switch (mode) {
      case "tokenised":
        return `aes:${encoded}`;

      case "serialised":
        return {
          cek: undefined,
          ciphertext: encoded,
          header: encode({ alg: "dir", enc: "A256GCM", cty: "text/plain" }),
          iv: "mock_iv",
          tag: "mock_tag",
          v: "1",
        };

      case "record":
        return {
          algorithm: "dir",
          authTag: Buffer.from("mock_tag"),
          content: Buffer.from(encoded),
          contentType: "text/plain" as const,
          encryption: "A256GCM" as const,
          initialisationVector: Buffer.from("mock_iv"),
          keyId: "mock_key_id",
          pbkdfIterations: undefined,
          pbkdfSalt: undefined,
          publicEncryptionIv: undefined,
          publicEncryptionJwk: undefined,
          publicEncryptionKey: undefined,
          publicEncryptionTag: undefined,
          version: "1",
        };

      case "encoded":
      default:
        return encoded;
    }
  }),

  decrypt: jest.fn().mockImplementation((data: any) => {
    if (typeof data === "string") {
      if (data.startsWith("aes:")) {
        return decode(data.slice(4));
      }
      return decode(data);
    }
    if (data.ciphertext) {
      return decode(data.ciphertext);
    }
    if (Buffer.isBuffer(data.content)) {
      return decode(data.content.toString());
    }
    return data;
  }),

  assert: jest.fn(),
  verify: jest.fn().mockReturnValue(true),
  prepareEncryption: jest.fn().mockReturnValue({
    headerParams: {},
    publicEncryptionKey: undefined,
    encrypt: jest.fn().mockReturnValue({
      authTag: Buffer.alloc(16),
      content: Buffer.alloc(0),
      contentType: "text/plain",
      initialisationVector: Buffer.alloc(12),
    }),
  }),
});
