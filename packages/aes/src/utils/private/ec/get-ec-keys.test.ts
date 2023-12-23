import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "../../../enums";
import { PRIVATE_EC_JWK, PUBLIC_EC_JWK } from "../../../fixtures/ec-keys.fixture";
import { getEcDecryptionKey, getEcEncryptionKeys } from "./get-ec-keys";

describe("get-ec-keys", () => {
  test("should return encryption keys", () => {
    expect(
      getEcEncryptionKeys({
        algorithm: AesAlgorithm.AES_256_GCM,
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.ECDH_ES,
        key: PUBLIC_EC_JWK,
      }),
    ).toStrictEqual({
      encryptionKey: expect.any(Buffer),
      publicEncryptionJwk: {
        crv: "P-521",
        x: expect.any(String),
        y: expect.any(String),
      },
    });
  });

  test("should return decryption key", () => {
    expect(
      getEcDecryptionKey({
        algorithm: AesAlgorithm.AES_256_GCM,
        key: PRIVATE_EC_JWK,
        publicEncryptionJwk: {
          crv: "P-521",
          x: "Af3ZdH3XBQFqC4qISUyAPW9WrCDe36KuTFcLz0dIhoh8LeCk4PGt2HEs9pQyxlEVS9fm1tecb9Wk+83nUNBLDet7",
          y: "ATdzYQHx4ZS1DJYb27bRy+NouEm53Jmpdk0Z00B1PIZcRwBEoYVPUQAmYsEt18MX1nLDdwKXV2dONaytvbkdRIMH",
        },
      }),
    ).toStrictEqual(
      Buffer.from("729e00110e7e8912072ce1fcd3677656b8461a47122058308812db5e413124a4", "hex"),
    );
  });
});
