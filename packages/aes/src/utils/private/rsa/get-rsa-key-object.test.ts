import { AesEncryptionKeyAlgorithm } from "../../../enums";
import { getRsaKeyObject } from "./get-rsa-key-object";

describe("getRsaKeyObject", () => {
  test("should resolve key object", () => {
    expect(
      getRsaKeyObject({ key: "key", type: "RSA" }, AesEncryptionKeyAlgorithm.RSA_OAEP),
    ).toStrictEqual({
      key: "key",
      padding: 4,
      oaepHash: "sha1",
    });
  });

  test("should resolve key object with oaep", () => {
    expect(
      getRsaKeyObject({ key: "key", type: "RSA" }, AesEncryptionKeyAlgorithm.RSA_OAEP_256),
    ).toStrictEqual({
      key: "key",
      padding: 4,
      oaepHash: "sha256",
    });
  });

  test("should resolve key object with passphrase", () => {
    expect(
      getRsaKeyObject(
        { key: "key", type: "RSA", passphrase: "passphrase" },
        AesEncryptionKeyAlgorithm.RSA_OAEP_512,
      ),
    ).toStrictEqual({
      key: "key",
      padding: 4,
      passphrase: "passphrase",
      oaepHash: "sha512",
    });
  });
});
