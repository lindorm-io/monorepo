import type { KryptosEncryption } from "@lindorm/kryptos";
import { AesError } from "../../../errors/index.js";
import { getInitialisationVector } from "./get-initialisation-vector.js";
import { describe, expect, test } from "vitest";

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
      "Unsupported encryption algorithm",
    );
  });

  test("should include encryption in error data", () => {
    const unsupported = "INVALID_ALG" as KryptosEncryption;

    expect(() => getInitialisationVector(unsupported)).toThrow(AesError);
    expect(() => getInitialisationVector(unsupported)).toThrow(
      expect.objectContaining({
        message: "Unsupported encryption algorithm",
        data: { encryption: unsupported },
      }),
    );
  });
});
