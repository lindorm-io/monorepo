import {
  TEST_AKP_KEY_ML_DSA_44_B64,
  TEST_AKP_KEY_ML_DSA_44_JWK,
  TEST_AKP_KEY_ML_DSA_65_B64,
  TEST_AKP_KEY_ML_DSA_65_JWK,
  TEST_AKP_KEY_ML_DSA_87_B64,
  TEST_AKP_KEY_ML_DSA_87_JWK,
} from "../../../__fixtures__/akp-keys.js";
import { KryptosKit } from "../../../classes/KryptosKit.js";
import type { AkpJwk } from "../../../types/index.js";
import { ML_DSA_PUBLIC_KEY_SIZES, ML_DSA_SEED_SIZE } from "./sizes.js";
import { describe, expect, test } from "vitest";

const VARIANTS = [
  { jwk: TEST_AKP_KEY_ML_DSA_44_JWK, b64: TEST_AKP_KEY_ML_DSA_44_B64 },
  { jwk: TEST_AKP_KEY_ML_DSA_65_JWK, b64: TEST_AKP_KEY_ML_DSA_65_B64 },
  { jwk: TEST_AKP_KEY_ML_DSA_87_JWK, b64: TEST_AKP_KEY_ML_DSA_87_B64 },
] as const;

describe("AKP seed-vs-expanded boundary (RFC 9964)", () => {
  describe.each(VARIANTS)("$jwk.alg", ({ jwk, b64 }) => {
    test("JWK 'priv' decodes to the 32-byte ML-DSA seed", () => {
      const priv = Buffer.from(jwk.priv ?? "", "base64url");

      expect(priv.length).toBe(ML_DSA_SEED_SIZE);
      expect(priv.length).toBe(32);
    });

    test("JWK 'pub' decodes to the per-algorithm public-key size", () => {
      const pub = Buffer.from(jwk.pub, "base64url");

      expect(pub.length).toBe(ML_DSA_PUBLIC_KEY_SIZES[jwk.alg]);
    });

    test("export to JWK preserves the seed/public-key sizes", () => {
      const exported = KryptosKit.from.jwk(jwk).export("jwk") as AkpJwk;

      expect(Buffer.from(exported.priv ?? "", "base64url").length).toBe(ML_DSA_SEED_SIZE);
      expect(Buffer.from(exported.pub, "base64url").length).toBe(
        ML_DSA_PUBLIC_KEY_SIZES[jwk.alg],
      );
    });

    test("b64/DER path round-trips: re-import preserves PKCS#8 DER key material", () => {
      const original = KryptosKit.from.b64(b64);
      const roundTripped = KryptosKit.from.b64(original.export("b64"));

      expect(roundTripped.export("der")).toEqual(original.export("der"));
      expect(roundTripped.export("b64")).toEqual(original.export("b64"));
    });
  });
});

describe("AKP JWK import validation (RFC 9964 §4 / §7.3)", () => {
  test("rejects a 31-byte 'priv'", () => {
    const priv = Buffer.alloc(31).toString("base64url");

    expect(() => KryptosKit.from.jwk({ ...TEST_AKP_KEY_ML_DSA_44_JWK, priv })).toThrow(
      expect.objectContaining({ code: "invalid_akp_seed_length" }),
    );
  });

  test("rejects a 33-byte 'priv'", () => {
    const priv = Buffer.alloc(33).toString("base64url");

    expect(() => KryptosKit.from.jwk({ ...TEST_AKP_KEY_ML_DSA_44_JWK, priv })).toThrow(
      expect.objectContaining({ code: "invalid_akp_seed_length" }),
    );
  });

  test("rejects a wrong-size 'pub'", () => {
    const pub = Buffer.alloc(ML_DSA_PUBLIC_KEY_SIZES["ML-DSA-44"] - 1).toString(
      "base64url",
    );

    expect(() => KryptosKit.from.jwk({ ...TEST_AKP_KEY_ML_DSA_44_JWK, pub })).toThrow(
      expect.objectContaining({ code: "invalid_akp_public_key_length" }),
    );
  });

  test("rejects 'pub' sized for a different ML-DSA variant", () => {
    expect(() =>
      KryptosKit.from.jwk({
        ...TEST_AKP_KEY_ML_DSA_44_JWK,
        pub: TEST_AKP_KEY_ML_DSA_65_JWK.pub,
      }),
    ).toThrow(expect.objectContaining({ code: "invalid_akp_public_key_length" }));
  });

  test("rejects an AKP JWK missing 'alg'", () => {
    const { alg: _alg, ...rest } = TEST_AKP_KEY_ML_DSA_44_JWK;

    expect(() => KryptosKit.from.jwk(rest as AkpJwk)).toThrow(
      expect.objectContaining({ code: "invalid_akp_algorithm" }),
    );
  });

  test("accepts all conformant fixtures", () => {
    for (const { jwk } of VARIANTS) {
      expect(() => KryptosKit.from.jwk(jwk)).not.toThrow();
    }
  });
});
