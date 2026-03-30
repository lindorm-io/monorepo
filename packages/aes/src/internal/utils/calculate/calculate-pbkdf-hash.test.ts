import { IKryptos, KryptosAlgorithm } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import { calculatePbkdfAlgorithm } from "./calculate-pbkdf-hash";

describe("calculatePbkdfAlgorithm", () => {
  test.each<[KryptosAlgorithm, string]>([
    ["PBES2-HS256+A128KW", "SHA256"],
    ["PBES2-HS384+A192KW", "SHA384"],
    ["PBES2-HS512+A256KW", "SHA512"],
  ])("should return %s for %s", (algorithm, expected) => {
    expect(calculatePbkdfAlgorithm({ algorithm } as IKryptos)).toEqual(expected);
  });

  test("should throw AesError for unsupported algorithm", () => {
    expect(() =>
      calculatePbkdfAlgorithm({ algorithm: "UNSUPPORTED" } as unknown as IKryptos),
    ).toThrow(AesError);
    expect(() =>
      calculatePbkdfAlgorithm({ algorithm: "UNSUPPORTED" } as unknown as IKryptos),
    ).toThrow("Unsupported PBKDF2 algorithm");
  });

  test("should throw AesError for non-PBKDF2 algorithm", () => {
    expect(() => calculatePbkdfAlgorithm({ algorithm: "A128KW" } as IKryptos)).toThrow(
      AesError,
    );
  });
});
