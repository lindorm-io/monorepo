import { Kryptos } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { LATEST_AES_VERSION } from "../../constants";
import { decryptAesData, encryptAesData } from "./aes-data";

describe("aes-data", () => {
  let data: string;

  beforeEach(async () => {
    data = randomBytes(32).toString("hex");
  });

  test("should encrypt and decrypt", () => {
    const kryptos = Kryptos.generate({
      algorithm: "dir",
      encryption: "A256GCM",
      type: "oct",
      use: "enc",
    });

    const res = encryptAesData({ data, kryptos });

    expect(res).toEqual({
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

    expect(decryptAesData({ ...res, kryptos })).toEqual(data);
  });

  describe("cbc", () => {
    test("should encrypt and decrypt with A128CBC-HS256", () => {
      const kryptos = Kryptos.generate({
        algorithm: "dir",
        encryption: "A128CBC-HS256",
        type: "oct",
        use: "enc",
      });

      const encryption = encryptAesData({
        encryption: "A128CBC-HS256",
        data,
        kryptos,
      });

      expect(encryption.encryption).toEqual("A128CBC-HS256");
      expect(decryptAesData({ ...encryption, kryptos })).toEqual(data);
    });

    test("should encrypt and decrypt with A192CBC-HS384", () => {
      const kryptos = Kryptos.generate({
        algorithm: "dir",
        encryption: "A192CBC-HS384",
        type: "oct",
        use: "enc",
      });

      const encryption = encryptAesData({
        encryption: "A192CBC-HS384",
        data,
        kryptos,
      });

      expect(encryption.encryption).toEqual("A192CBC-HS384");
      expect(decryptAesData({ ...encryption, kryptos })).toEqual(data);
    });

    test("should encrypt and decrypt with A256CBC-HS512", () => {
      const kryptos = Kryptos.generate({
        algorithm: "dir",
        encryption: "A256CBC-HS512",
        type: "oct",
        use: "enc",
      });

      const encryption = encryptAesData({
        encryption: "A256CBC-HS512",
        data,
        kryptos,
      });

      expect(encryption.encryption).toEqual("A256CBC-HS512");
      expect(decryptAesData({ ...encryption, kryptos })).toEqual(data);
    });
  });

  describe("gcm", () => {
    test("should encrypt and decrypt with A128GCM", () => {
      const kryptos = Kryptos.generate({
        algorithm: "dir",
        encryption: "A128GCM",
        type: "oct",
        use: "enc",
      });

      const encryption = encryptAesData({
        encryption: "A128GCM",
        data,
        kryptos,
      });

      expect(encryption.encryption).toEqual("A128GCM");
      expect(decryptAesData({ ...encryption, kryptos })).toEqual(data);
    });

    test("should encrypt and decrypt with A192GCM", () => {
      const kryptos = Kryptos.generate({
        algorithm: "dir",
        encryption: "A192GCM",
        type: "oct",
        use: "enc",
      });

      const encryption = encryptAesData({
        encryption: "A192GCM",
        data,
        kryptos,
      });

      expect(encryption.encryption).toEqual("A192GCM");
      expect(decryptAesData({ ...encryption, kryptos })).toEqual(data);
    });

    test("should encrypt and decrypt with A256GCM", () => {
      const kryptos = Kryptos.generate({
        algorithm: "dir",
        encryption: "A256GCM",
        type: "oct",
        use: "enc",
      });

      const encryption = encryptAesData({
        encryption: "A256GCM",
        data,
        kryptos,
      });

      expect(encryption.encryption).toEqual("A256GCM");
      expect(decryptAesData({ ...encryption, kryptos })).toEqual(data);
    });
  });
});
