import { AesAlgorithm } from "../../../enums";
import { SYMMETRIC_OCT_JWK, SYMMETRIC_OCT_PEM } from "../../../fixtures/oct-keys.fixture";
import { getOctDecryptionKey, getOctEncryptionKeys } from "./get-oct-keys";

describe("get-oct-keys", () => {
  test("should return oct encryption keys from PEM", () => {
    expect(
      getOctEncryptionKeys({
        algorithm: AesAlgorithm.AES_256_GCM,
        key: SYMMETRIC_OCT_PEM,
      }),
    ).toStrictEqual({
      encryptionKey: Buffer.from("a14c111d8c0e5022a318cbc1538af1e2"),
    });
  });

  test("should return oct encryption keys from JWK", () => {
    expect(
      getOctEncryptionKeys({
        algorithm: AesAlgorithm.AES_256_GCM,
        key: SYMMETRIC_OCT_JWK,
      }),
    ).toStrictEqual({
      encryptionKey: Buffer.from("a14c111d8c0e5022a318cbc1538af1e2"),
    });
  });

  test("should return oct decryption key from PEM", () => {
    expect(
      getOctDecryptionKey({
        algorithm: AesAlgorithm.AES_256_GCM,
        key: SYMMETRIC_OCT_PEM,
      }),
    ).toStrictEqual(Buffer.from("a14c111d8c0e5022a318cbc1538af1e2"));
  });

  test("should return oct decryption key from JWK", () => {
    expect(
      getOctDecryptionKey({
        algorithm: AesAlgorithm.AES_256_GCM,
        key: SYMMETRIC_OCT_JWK,
      }),
    ).toStrictEqual(Buffer.from("a14c111d8c0e5022a318cbc1538af1e2"));
  });
});
