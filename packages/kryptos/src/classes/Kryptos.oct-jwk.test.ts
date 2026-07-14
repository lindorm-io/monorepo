import { describe, expect, test } from "vitest";
import { KryptosError } from "../errors/index.js";
import type { KryptosAlgorithm, KryptosJwk, KryptosType } from "../types/index.js";
import { KryptosKit } from "./KryptosKit.js";

describe("Kryptos.toJWK — a symmetric key has no public JWK", () => {
  const oct = () => KryptosKit.generate.auto({ algorithm: "HS256" });

  // It used to emit `{ kty: "oct" }` with NO `k` — malformed per RFC 7517 §6.4.1,
  // and jose rejects it outright. The only alternative would be to emit `k`, which
  // publishes the secret. Neither is an answer, so the question is refused.
  test("throws rather than emitting a keyless — or secret-bearing — JWK", () => {
    expect(() => oct().toJWK("public")).toThrow(KryptosError);
    expect(() => oct().toJWK("public")).toThrow(/no public JWK/i);
  });

  test("throws on the default mode too, which is public", () => {
    expect(() => oct().toJWK()).toThrow(KryptosError);
  });

  test("the private JWK is unaffected — `k` belongs there", () => {
    expect(oct().toJWK("private").k).toBeTypeOf("string");
  });

  test('export("jwk") is unaffected — it always exports the private JWK', () => {
    expect(oct().export("jwk").k).toBeTypeOf("string");
  });

  test("an asymmetric key still exports a public JWK, without its private half", () => {
    const ec = KryptosKit.generate.auto({ algorithm: "ES256" });

    expect(ec.toJWK("public").x).toBeTypeOf("string");
    expect(ec.toJWK("public").d).toBeUndefined();
  });
});

// THE OTHER HALF OF THE GUARD: that it is not OVER-BROAD. The refusal is scoped to
// `kty: "oct"` and nothing else — an asymmetric key must still export the public
// JWK we publish, with its public parameters intact and its private half stripped.
// A guard that quietly took the asymmetric keys with it would empty the JWKS and
// leave every RP unable to verify a token, which is the LOUDER failure of the two
// and exactly the kind this suite exists to catch.
//
// The table covers EVERY asymmetric member of `KryptosType`, so a sixth type cannot
// be added without a decision being made here.
const ASYMMETRIC: Array<{
  type: KryptosType;
  algorithm: KryptosAlgorithm;
  public: Array<keyof KryptosJwk>;
  private: Array<keyof KryptosJwk>;
}> = [
  { type: "AKP", algorithm: "ML-DSA-44", public: ["pub"], private: ["priv"] },
  { type: "EC", algorithm: "ES256", public: ["x", "y"], private: ["d"] },
  { type: "OKP", algorithm: "EdDSA", public: ["x"], private: ["d"] },
  {
    type: "RSA",
    algorithm: "RS256",
    public: ["n", "e"],
    private: ["d", "p", "q", "dp", "dq", "qi"],
  },
];

describe("Kryptos.toJWK — the guard is not over-broad", () => {
  test.each(ASYMMETRIC)(
    "$type still exports a public JWK carrying its public parameters",
    ({ type, algorithm, public: publicMembers }) => {
      const jwk = KryptosKit.generate.auto({ algorithm }).toJWK("public");

      expect(jwk.kty).toBe(type);

      for (const member of publicMembers) {
        expect(jwk[member]).toBeTypeOf("string");
      }
    },
  );

  test.each(ASYMMETRIC)(
    "$type strips every private parameter from its public JWK",
    ({ algorithm, private: privateMembers }) => {
      const key = KryptosKit.generate.auto({ algorithm });

      const jwk = key.toJWK("public");

      for (const member of privateMembers) {
        expect(jwk[member]).toBeUndefined();
      }

      // ...and the members really do exist on the private side, so the assertions
      // above are testing a stripping that HAPPENED, not member names that never
      // existed. Without this, a typo in the table would pass silently.
      const priv = key.toJWK("private");

      for (const member of privateMembers) {
        expect(priv[member]).toBeTypeOf("string");
      }
    },
  );

  test.each(ASYMMETRIC)(
    "$type never emits `k` — that is oct's member",
    ({ algorithm }) => {
      const key = KryptosKit.generate.auto({ algorithm });

      expect(key.toJWK("public").k).toBeUndefined();
      expect(key.toJWK("private").k).toBeUndefined();
    },
  );
});
