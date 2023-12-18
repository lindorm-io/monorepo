import { AesEncryptionKeyAlgorithm } from "../../enums";
import { getKeyObject } from "./get-key-object";

describe("getKeyObject", () => {
  test("should resolve key object", () => {
    expect(getKeyObject("key", AesEncryptionKeyAlgorithm.RSA_OAEP)).toStrictEqual({
      key: "key",
      padding: 4,
      oaepHash: "sha1",
    });
  });

  test("should resolve key object with oaep", () => {
    expect(getKeyObject("key", AesEncryptionKeyAlgorithm.RSA_OAEP_256)).toStrictEqual({
      key: "key",
      padding: 4,
      oaepHash: "sha256",
    });
  });

  test("should resolve key object with passphrase", () => {
    expect(
      getKeyObject(
        { key: "key", passphrase: "passphrase" },
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
