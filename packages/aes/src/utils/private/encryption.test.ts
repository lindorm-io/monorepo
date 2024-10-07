import { Kryptos, KryptosEncryption } from "@lindorm/kryptos";
import { LATEST_AES_VERSION } from "../../constants/private";
import { decryptAes, encryptAes } from "./encryption";

describe("aes-data", () => {
  test("should encrypt and decrypt", () => {
    const kryptos = Kryptos.generate({
      algorithm: "dir",
      encryption: "A256GCM",
      type: "oct",
      use: "enc",
    });

    const data = encryptAes({ data: "test", kryptos });

    expect(data).toEqual({
      algorithm: "dir",
      authTag: expect.any(Buffer),
      content: expect.any(Buffer),
      encryption: "A256GCM",
      hkdfSalt: undefined,
      initialisationVector: expect.any(Buffer),
      keyId: expect.any(String),
      publicEncryptionIv: undefined,
      publicEncryptionJwk: undefined,
      publicEncryptionKey: undefined,
      publicEncryptionTag: undefined,
      version: LATEST_AES_VERSION,
    });

    expect(decryptAes({ ...data, kryptos })).toEqual("test");
  });

  describe("encryptions", () => {
    const encryptions: Array<KryptosEncryption> = [
      // CBC
      "A128CBC-HS256",
      "A192CBC-HS384",
      "A256CBC-HS512",
      // GCM
      "A128GCM",
      "A192GCM",
      "A256GCM",
    ];

    test.each(encryptions)("should encrypt and decrypt with %s", (encryption) => {
      const kryptos = Kryptos.generate({
        algorithm: "dir",
        encryption,
        type: "oct",
        use: "enc",
      });

      const data = encryptAes({ data: "test", encryption, kryptos });

      expect(data.encryption).toEqual(encryption);
      expect(decryptAes({ ...data, kryptos })).toEqual("test");
    });
  });
});