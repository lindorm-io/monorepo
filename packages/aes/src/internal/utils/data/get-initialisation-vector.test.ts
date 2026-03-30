import { KryptosEncryption } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import { getInitialisationVector } from "./get-initialisation-vector";

describe("getInitialisationVector", () => {
  test.each<[KryptosEncryption, number]>([
    ["A128CBC-HS256", 16],
    ["A192CBC-HS384", 16],
    ["A256CBC-HS512", 16],
  ])("should return 16-byte IV for CBC mode %s", (encryption, expectedLength) => {
    const iv = getInitialisationVector(encryption);

    expect(iv).toBeInstanceOf(Buffer);
    expect(iv.length).toBe(expectedLength);
  });

  test.each<[KryptosEncryption, number]>([
    ["A128GCM", 12],
    ["A192GCM", 12],
    ["A256GCM", 12],
  ])("should return 12-byte IV for GCM mode %s", (encryption, expectedLength) => {
    const iv = getInitialisationVector(encryption);

    expect(iv).toBeInstanceOf(Buffer);
    expect(iv.length).toBe(expectedLength);
  });

  test("should produce different IVs on each call (randomness check)", () => {
    const encryption: KryptosEncryption = "A256GCM";

    const iv1 = getInitialisationVector(encryption);
    const iv2 = getInitialisationVector(encryption);

    // IVs should be different (extremely unlikely to be equal with proper randomness)
    expect(iv1).not.toEqual(iv2);
  });

  test("should produce different CBC IVs on each call", () => {
    const encryption: KryptosEncryption = "A256CBC-HS512";

    const iv1 = getInitialisationVector(encryption);
    const iv2 = getInitialisationVector(encryption);

    expect(iv1).not.toEqual(iv2);
  });

  test("should throw AesError for unsupported encryption", () => {
    expect(() => getInitialisationVector("UNSUPPORTED" as KryptosEncryption)).toThrow(
      AesError,
    );

    expect(() => getInitialisationVector("UNSUPPORTED" as KryptosEncryption)).toThrow(
      "Unexpected algorithm",
    );
  });

  test("should include encryption in error debug info", () => {
    const unsupported = "INVALID_ALG" as KryptosEncryption;

    try {
      getInitialisationVector(unsupported);
      fail("Expected AesError to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AesError);
      expect((error as AesError).message).toBe("Unexpected algorithm");
      expect((error as AesError).debug).toEqual({ encryption: unsupported });
    }
  });
});
