import { KryptosAlgorithm } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import { calculateKeyWrapSize } from "./calculate-key-wrap-size";

describe("calculateKeyWrapSize", () => {
  test.each<KryptosAlgorithm>([
    "A128KW",
    "A128GCMKW",
    "ECDH-ES+A128KW",
    "ECDH-ES+A128GCMKW",
    "PBES2-HS256+A128KW",
  ])("should return 16 for %s", (algorithm) => {
    expect(calculateKeyWrapSize(algorithm)).toEqual(16);
  });

  test.each<KryptosAlgorithm>([
    "A192KW",
    "A192GCMKW",
    "ECDH-ES+A192KW",
    "ECDH-ES+A192GCMKW",
    "PBES2-HS384+A192KW",
  ])("should return 24 for %s", (algorithm) => {
    expect(calculateKeyWrapSize(algorithm)).toEqual(24);
  });

  test.each<KryptosAlgorithm>([
    "A256KW",
    "A256GCMKW",
    "ECDH-ES+A256KW",
    "ECDH-ES+A256GCMKW",
    "PBES2-HS512+A256KW",
  ])("should return 32 for %s", (algorithm) => {
    expect(calculateKeyWrapSize(algorithm)).toEqual(32);
  });

  test("should throw AesError for unsupported algorithm", () => {
    expect(() => calculateKeyWrapSize("UNSUPPORTED" as KryptosAlgorithm)).toThrow(
      AesError,
    );
    expect(() => calculateKeyWrapSize("UNSUPPORTED" as KryptosAlgorithm)).toThrow(
      "Unsupported algorithm",
    );
  });
});
