import { describe, expect, test } from "vitest";
import type { KryptosAlgClass, KryptosType } from "../types/index.js";
import { KryptosKit } from "./KryptosKit.js";

// `algClass` is DERIVED from `type` — `oct` is the only symmetric type. The table
// below covers EVERY member of `KryptosType`, so a sixth type cannot be added
// without a decision being made here as well.
const KEYS: Array<
  [KryptosType, KryptosAlgClass, () => ReturnType<typeof KryptosKit.generate.auto>]
> = [
  ["AKP", "asymmetric", () => KryptosKit.generate.auto({ algorithm: "ML-DSA-44" })],
  ["EC", "asymmetric", () => KryptosKit.generate.auto({ algorithm: "ES256" })],
  ["OKP", "asymmetric", () => KryptosKit.generate.auto({ algorithm: "EdDSA" })],
  ["RSA", "asymmetric", () => KryptosKit.generate.auto({ algorithm: "RS256" })],
  ["oct", "symmetric", () => KryptosKit.generate.auto({ algorithm: "HS256" })],
];

describe("Kryptos algClass", () => {
  test.each(KEYS)("should classify a %s key as %s", (type, expected, generate) => {
    const kryptos = generate();

    expect(kryptos.type).toBe(type);
    expect(kryptos.algClass).toBe(expected);
  });

  describe("derived, so it never reaches storage or the wire", () => {
    test("should include algClass in toJSON", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "ES256" });

      expect(kryptos.toJSON()).toEqual(
        expect.objectContaining({ algClass: "asymmetric" }),
      );
    });

    test("should omit algClass from toDB", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "ES256" });

      expect("algClass" in kryptos.toDB()).toBe(false);
    });

    test.each(["public", "private"] as const)(
      "should omit algClass from toJWK (%s)",
      (mode) => {
        const kryptos = KryptosKit.generate.auto({ algorithm: "ES256" });

        expect("algClass" in kryptos.toJWK(mode)).toBe(false);
      },
    );

    test("should omit algClass from toJWK for an oct key in both modes", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "HS256" });

      expect("algClass" in kryptos.toJWK("public")).toBe(false);
      expect("algClass" in kryptos.toJWK("private")).toBe(false);
    });
  });
});
