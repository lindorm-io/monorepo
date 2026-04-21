import type { IKryptos } from "@lindorm/kryptos";
import type { IAesKit } from "../interfaces/index.js";
import type { AesContent } from "../types/index.js";

const encode = (data: AesContent): string =>
  Buffer.from(JSON.stringify(data)).toString("base64url");

const decode = <T extends AesContent = string>(encoded: string): T =>
  JSON.parse(Buffer.from(encoded, "base64url").toString()) as T;

export const _createMockAesKit = (mockFn: () => any, kryptos: IKryptos): IAesKit => {
  const impl = (fn: any) => {
    const m = mockFn();
    m.mockImplementation(fn);
    return m;
  };
  const returns = (value: any) => {
    const m = mockFn();
    m.mockReturnValue(value);
    return m;
  };

  return {
    kryptos,

    encrypt: impl((data: AesContent, mode?: string) => {
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

    decrypt: impl((data: any) => {
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

    assert: mockFn(),
    verify: returns(true),
    prepareEncryption: returns({
      headerParams: {},
      publicEncryptionKey: undefined,
      encrypt: returns({
        authTag: Buffer.alloc(16),
        content: Buffer.alloc(0),
        contentType: "text/plain",
        initialisationVector: Buffer.alloc(12),
      }),
    }),
  } as unknown as IAesKit;
};
