import { describe, expect, test } from "vitest";
import type { KryptosAlgorithm, KryptosJwk, KryptosType } from "../types/index.js";
import { KryptosKit } from "./KryptosKit.js";

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
