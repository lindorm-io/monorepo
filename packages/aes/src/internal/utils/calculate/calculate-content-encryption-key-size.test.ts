import { KryptosEncryption } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import { calculateContentEncryptionKeySize } from "./calculate-content-encryption-key-size";

describe("calculateContentEncryptionKeySize", () => {
  test.each<[KryptosEncryption, number]>([
    ["A128GCM", 16],
    ["A192GCM", 24],
    ["A256GCM", 32],
    ["A128CBC-HS256", 32],
    ["A192CBC-HS384", 48],
    ["A256CBC-HS512", 64],
  ])("should return %i for %s", (encryption, expected) => {
    expect(calculateContentEncryptionKeySize(encryption)).toEqual(expected);
  });

  test("should throw AesError when encryption is falsy", () => {
    expect(() => calculateContentEncryptionKeySize("" as KryptosEncryption)).toThrow(
      AesError,
    );
    expect(() => calculateContentEncryptionKeySize("" as KryptosEncryption)).toThrow(
      "Encryption algorithm is required",
    );
  });

  test("should throw AesError for unsupported encryption algorithm", () => {
    expect(() =>
      calculateContentEncryptionKeySize("UNSUPPORTED" as KryptosEncryption),
    ).toThrow(AesError);
    expect(() =>
      calculateContentEncryptionKeySize("UNSUPPORTED" as KryptosEncryption),
    ).toThrow("Unsupported encryption");
  });
});
