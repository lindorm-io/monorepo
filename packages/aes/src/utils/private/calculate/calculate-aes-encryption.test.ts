import { KryptosEncryption } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import { calculateAesEncryption } from "./calculate-aes-encryption";

describe("calculateAesEncryption", () => {
  test.each<[KryptosEncryption, string]>([
    ["A128CBC-HS256", "aes-128-cbc"],
    ["A192CBC-HS384", "aes-192-cbc"],
    ["A256CBC-HS512", "aes-256-cbc"],
    ["A128GCM", "aes-128-gcm"],
    ["A192GCM", "aes-192-gcm"],
    ["A256GCM", "aes-256-gcm"],
  ])("should map %s to %s", (encryption, expected) => {
    expect(calculateAesEncryption(encryption)).toEqual(expected);
  });

  test("should throw AesError when encryption is falsy", () => {
    expect(() => calculateAesEncryption("" as KryptosEncryption)).toThrow(AesError);
    expect(() => calculateAesEncryption("" as KryptosEncryption)).toThrow(
      "Encryption algorithm is required",
    );
  });

  test("should throw AesError for unsupported encryption algorithm", () => {
    expect(() => calculateAesEncryption("UNSUPPORTED" as KryptosEncryption)).toThrow(
      AesError,
    );
    expect(() => calculateAesEncryption("UNSUPPORTED" as KryptosEncryption)).toThrow(
      "Unsupported encryption algorithm",
    );
  });
});
