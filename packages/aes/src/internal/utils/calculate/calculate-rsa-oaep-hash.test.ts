import { KryptosAlgorithm } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import { calculateRsaOaepHash } from "./calculate-rsa-oaep-hash";

describe("calculateRsaOaepHash", () => {
  test.each<[KryptosAlgorithm, string]>([
    ["RSA-OAEP", "SHA1"],
    ["RSA-OAEP-256", "SHA256"],
    ["RSA-OAEP-384", "SHA384"],
    ["RSA-OAEP-512", "SHA512"],
  ])("should return %s for %s", (algorithm, expected) => {
    expect(calculateRsaOaepHash(algorithm)).toEqual(expected);
  });

  test("should throw AesError for unsupported algorithm", () => {
    expect(() => calculateRsaOaepHash("UNSUPPORTED" as KryptosAlgorithm)).toThrow(
      AesError,
    );
    expect(() => calculateRsaOaepHash("UNSUPPORTED" as KryptosAlgorithm)).toThrow(
      "Unexpected encryption key algorithm",
    );
  });

  test("should throw AesError for non-RSA-OAEP algorithm", () => {
    expect(() => calculateRsaOaepHash("A128KW")).toThrow(AesError);
  });
});
