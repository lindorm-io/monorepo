import { IKryptos, KryptosAlgorithm } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import { calculateKeyWrapEncryption } from "./calculate-key-wrap-encryption";

describe("calculateKeyWrapEncryption", () => {
  describe("ECB algorithms", () => {
    test.each<KryptosAlgorithm>(["A128KW", "ECDH-ES+A128KW", "PBES2-HS256+A128KW"])(
      "should return aes-128-ecb for %s",
      (algorithm) => {
        expect(calculateKeyWrapEncryption({ algorithm } as IKryptos)).toEqual(
          "aes-128-ecb",
        );
      },
    );

    test.each<KryptosAlgorithm>(["A192KW", "ECDH-ES+A192KW", "PBES2-HS384+A192KW"])(
      "should return aes-192-ecb for %s",
      (algorithm) => {
        expect(calculateKeyWrapEncryption({ algorithm } as IKryptos)).toEqual(
          "aes-192-ecb",
        );
      },
    );

    test.each<KryptosAlgorithm>(["A256KW", "ECDH-ES+A256KW", "PBES2-HS512+A256KW"])(
      "should return aes-256-ecb for %s",
      (algorithm) => {
        expect(calculateKeyWrapEncryption({ algorithm } as IKryptos)).toEqual(
          "aes-256-ecb",
        );
      },
    );
  });

  describe("GCM algorithms", () => {
    test.each<KryptosAlgorithm>(["A128GCMKW", "ECDH-ES+A128GCMKW"])(
      "should return aes-128-gcm for %s",
      (algorithm) => {
        expect(calculateKeyWrapEncryption({ algorithm } as IKryptos)).toEqual(
          "aes-128-gcm",
        );
      },
    );

    test.each<KryptosAlgorithm>(["A192GCMKW", "ECDH-ES+A192GCMKW"])(
      "should return aes-192-gcm for %s",
      (algorithm) => {
        expect(calculateKeyWrapEncryption({ algorithm } as IKryptos)).toEqual(
          "aes-192-gcm",
        );
      },
    );

    test.each<KryptosAlgorithm>(["A256GCMKW", "ECDH-ES+A256GCMKW"])(
      "should return aes-256-gcm for %s",
      (algorithm) => {
        expect(calculateKeyWrapEncryption({ algorithm } as IKryptos)).toEqual(
          "aes-256-gcm",
        );
      },
    );
  });

  test("should throw AesError for unsupported algorithm", () => {
    expect(() =>
      calculateKeyWrapEncryption({ algorithm: "UNSUPPORTED" } as unknown as IKryptos),
    ).toThrow(AesError);
    expect(() =>
      calculateKeyWrapEncryption({ algorithm: "UNSUPPORTED" } as unknown as IKryptos),
    ).toThrow("Unsupported keywrap encryption");
  });
});
