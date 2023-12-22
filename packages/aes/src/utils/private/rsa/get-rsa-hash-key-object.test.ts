import { AesEncryptionKeyAlgorithm } from "../../../enums";
import { PRIVATE_RSA_PEM, PUBLIC_RSA_PEM } from "../../../fixtures/rsa-keys.fixture";
import { getRsaHashKeyObject } from "./get-rsa-hash-key-object";

describe("getRsaHashKeyObject", () => {
  test("should resolve key object with oaep hash for private key", () => {
    expect(getRsaHashKeyObject(PRIVATE_RSA_PEM, AesEncryptionKeyAlgorithm.RSA_OAEP)).toStrictEqual({
      key: PRIVATE_RSA_PEM.privateKey,
      padding: 4,
      oaepHash: "sha1",
    });
  });

  test("should resolve key object with oaep hash for public key", () => {
    expect(
      getRsaHashKeyObject(PUBLIC_RSA_PEM, AesEncryptionKeyAlgorithm.RSA_OAEP_256),
    ).toStrictEqual({
      key: PUBLIC_RSA_PEM.publicKey,
      padding: 4,
      oaepHash: "sha256",
    });
  });

  test("should resolve key object with passphrase", () => {
    expect(
      getRsaHashKeyObject(
        { ...PRIVATE_RSA_PEM, passphrase: "passphrase" },
        AesEncryptionKeyAlgorithm.RSA_OAEP_512,
      ),
    ).toStrictEqual({
      key: PRIVATE_RSA_PEM.privateKey,
      padding: 4,
      passphrase: "passphrase",
      oaepHash: "sha512",
    });
  });
});
