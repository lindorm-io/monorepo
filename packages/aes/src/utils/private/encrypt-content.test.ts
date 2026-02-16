import { KryptosEncryption, KryptosKit } from "@lindorm/kryptos";
import { decryptAes } from "./encryption";
import { encryptAesContent } from "./encrypt-content";
import { getEncryptionKey } from "./get-key";

describe("encryptAesContent", () => {
  describe("encryptions", () => {
    const encryptions: Array<KryptosEncryption> = [
      "A128GCM",
      "A256GCM",
      "A128CBC-HS256",
      "A256CBC-HS512",
    ];

    test.each(encryptions)(
      "should encrypt content with provided CEK for %s",
      (encryption) => {
        const kryptos = KryptosKit.generate.enc.oct({ algorithm: "dir", encryption });
        const { contentEncryptionKey } = getEncryptionKey({ encryption, kryptos });

        const result = encryptAesContent({
          contentEncryptionKey,
          data: "test data",
          encryption,
        });

        expect(result).toEqual({
          authTag: expect.any(Buffer),
          content: expect.any(Buffer),
          contentType: "text/plain",
          initialisationVector: expect.any(Buffer),
        });
      },
    );
  });

  describe("AAD support", () => {
    const gcmEncryptions: Array<KryptosEncryption> = ["A128GCM", "A256GCM"];
    const cbcEncryptions: Array<KryptosEncryption> = ["A128CBC-HS256", "A256CBC-HS512"];

    test.each(gcmEncryptions)(
      "should produce different auth tag with AAD for GCM %s",
      (encryption) => {
        const kryptos = KryptosKit.generate.enc.oct({ algorithm: "dir", encryption });
        const { contentEncryptionKey } = getEncryptionKey({ encryption, kryptos });
        const aad = Buffer.from("additional-authenticated-data");

        const withoutAad = encryptAesContent({
          contentEncryptionKey,
          data: "test data",
          encryption,
        });

        const withAad = encryptAesContent({
          aad,
          contentEncryptionKey,
          data: "test data",
          encryption,
        });

        expect(withAad.authTag).not.toEqual(withoutAad.authTag);
      },
    );

    test.each(cbcEncryptions)(
      "should produce different auth tag with AAD for CBC-HMAC %s",
      (encryption) => {
        const kryptos = KryptosKit.generate.enc.oct({ algorithm: "dir", encryption });
        const { contentEncryptionKey } = getEncryptionKey({ encryption, kryptos });
        const aad = Buffer.from("additional-authenticated-data");

        const withoutAad = encryptAesContent({
          contentEncryptionKey,
          data: "test data",
          encryption,
        });

        const withAad = encryptAesContent({
          aad,
          contentEncryptionKey,
          data: "test data",
          encryption,
        });

        expect(withAad.authTag).not.toEqual(withoutAad.authTag);
      },
    );
  });

  describe("round-trip with decryptAes", () => {
    const encryptions: Array<KryptosEncryption> = [
      "A128GCM",
      "A256GCM",
      "A128CBC-HS256",
      "A256CBC-HS512",
    ];

    test.each(encryptions)(
      "should round-trip encrypt/decrypt for %s without AAD",
      (encryption) => {
        const kryptos = KryptosKit.generate.enc.oct({ algorithm: "dir", encryption });
        const { contentEncryptionKey } = getEncryptionKey({ encryption, kryptos });

        const result = encryptAesContent({
          contentEncryptionKey,
          data: "test data",
          encryption,
        });

        const decrypted = decryptAes({
          ...result,
          kryptos,
          encryption,
        });

        expect(decrypted).toEqual("test data");
      },
    );

    test.each(encryptions)(
      "should round-trip encrypt/decrypt for %s with AAD",
      (encryption) => {
        const kryptos = KryptosKit.generate.enc.oct({ algorithm: "dir", encryption });
        const { contentEncryptionKey } = getEncryptionKey({ encryption, kryptos });
        const aad = Buffer.from("additional-authenticated-data");

        const result = encryptAesContent({
          aad,
          contentEncryptionKey,
          data: "test data",
          encryption,
        });

        const decrypted = decryptAes({
          ...result,
          aad,
          kryptos,
          encryption,
        });

        expect(decrypted).toEqual("test data");
      },
    );
  });

  describe("content types", () => {
    test("should handle string data", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "dir",
        encryption: "A256GCM",
      });
      const { contentEncryptionKey } = getEncryptionKey({
        encryption: "A256GCM",
        kryptos,
      });

      const result = encryptAesContent({
        contentEncryptionKey,
        data: "plain text",
        encryption: "A256GCM",
      });

      expect(result.contentType).toEqual("text/plain");

      const decrypted = decryptAes({
        ...result,
        kryptos,
        encryption: "A256GCM",
      });

      expect(decrypted).toEqual("plain text");
    });

    test("should handle object data", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "dir",
        encryption: "A256GCM",
      });
      const { contentEncryptionKey } = getEncryptionKey({
        encryption: "A256GCM",
        kryptos,
      });
      const data = { key: "value", nested: { deep: true } };

      const result = encryptAesContent({
        contentEncryptionKey,
        data,
        encryption: "A256GCM",
      });

      expect(result.contentType).toEqual("application/json");

      const decrypted = decryptAes({
        ...result,
        kryptos,
        encryption: "A256GCM",
      });

      expect(decrypted).toEqual(data);
    });

    test("should handle array data", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "dir",
        encryption: "A256GCM",
      });
      const { contentEncryptionKey } = getEncryptionKey({
        encryption: "A256GCM",
        kryptos,
      });
      const data = [1, "two", { three: 3 }];

      const result = encryptAesContent({
        contentEncryptionKey,
        data,
        encryption: "A256GCM",
      });

      expect(result.contentType).toEqual("application/json");

      const decrypted = decryptAes({
        ...result,
        kryptos,
        encryption: "A256GCM",
      });

      expect(decrypted).toEqual(data);
    });

    test("should handle Buffer data", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "dir",
        encryption: "A256GCM",
      });
      const { contentEncryptionKey } = getEncryptionKey({
        encryption: "A256GCM",
        kryptos,
      });
      const data = Buffer.from("binary data");

      const result = encryptAesContent({
        contentEncryptionKey,
        data,
        encryption: "A256GCM",
      });

      expect(result.contentType).toEqual("application/octet-stream");

      const decrypted = decryptAes({
        ...result,
        kryptos,
        encryption: "A256GCM",
      });

      expect(decrypted).toEqual(data);
    });
  });
});
