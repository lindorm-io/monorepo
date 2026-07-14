import { importJWK } from "jose";
import { describe, expect, test } from "vitest";
import {
  EC_CURVES,
  ECDH_ES_ALGORITHMS,
  KRYPTOS_ENC_ALGORITHMS,
  KRYPTOS_SIG_ALGORITHMS,
  type EcCurve,
  type EcEncAlgorithm,
  type KryptosAlgorithm,
} from "../types/index.js";
import { KryptosKit } from "./KryptosKit.js";

// THE FOREIGN-LIBRARY GUARD for the surface we actually PUBLISH — `toJWK("public")`.
//
// This export has produced two production blockers, both invisible to our own
// snapshots and both found only by pointing real `jose` at it:
//
//   1. `toJWK()` emitted `key_ops` in both modes, so every published JWK claimed
//      ["sign","verify"]. jose is built on WebCrypto, which passes `key_ops`
//      straight into `importKey()` as `keyUsages` and HARD-REJECTS a public key
//      claiming `sign` — no mainstream RP could verify a single token we issued.
//   2. `toJWK("private")` was rejected by jose for EVERY asymmetric algorithm,
//      for the same reason.
//
// Both survived because every other jose interop test (in aegis) feeds
// `kryptos.export("jwk")` — a surface that never attached `key_ops` — instead of
// `toJWK()`, the surface we publish. A snapshot of our own output cannot assert
// interop; it only re-encodes our own opinion. (That is exactly how pylon's
// `well-known jwks` test came to assert bug #1 as expected behaviour.) So this
// suite consumes the real artifact through a real foreign library, and uses
// explicit assertions rather than a snapshot.

/**
 * jose rejects these three on the `alg` VALUE ITSELF — not on `key_ops`; they
 * fail even with `key_ops` absent — because they are NOT REGISTERED JWE
 * ALGORITHMS. RFC 7518 §4.6 defines `ECDH-ES`, `+A128KW`, `+A192KW`, `+A256KW`
 * and nothing else; `A*GCMKW` exists standalone in §4.7, but the COMBINATION is
 * ours, not the standard's.
 *
 * The user has ruled: KEEP these algorithms and KEEP publishing them — they are
 * fine on-platform, and jose's own `createRemoteJWKSet` selects by `kid`/`alg`
 * and will not pick one. The residual risk (an RP that naively imports every key
 * in the set throws on this one) is ACCEPTED, deliberate, and asserted here
 * rather than skipped — so the day someone adds a fourth unregistered alg, or
 * the day jose registers GCMKW, this suite says so instead of shipping silently.
 */
const UNREGISTERED_BY_DESIGN: Array<KryptosAlgorithm> = [
  "ECDH-ES+A128GCMKW",
  "ECDH-ES+A192GCMKW",
  "ECDH-ES+A256GCMKW",
];

const JOSE_UNSUPPORTED_ALG =
  'Invalid or unsupported JWK "alg" (Algorithm) Parameter value';

// The enc list carries the seven ECDH-ES algorithms TWICE (EC and OKP both claim
// them), so the matrix must dedupe or it would test them twice over.
const ALL_ALGORITHMS: Array<KryptosAlgorithm> = Array.from(
  new Set<KryptosAlgorithm>([...KRYPTOS_SIG_ALGORITHMS, ...KRYPTOS_ENC_ALGORITHMS]),
);

// An oct key has NO PUBLIC HALF, so it is never published: amphora's JWKS filter
// requires `hasPublicKey`. `toJWK("public")` on one is therefore not a JOSE
// concern and is excluded from the matrix — see the final describe block, which
// asserts the property that justifies the exclusion instead of hand-waving it.
const isOct = (algorithm: KryptosAlgorithm) =>
  KryptosKit.getTypeForAlgorithm(algorithm) === "oct";

const OCT_ALGORITHMS = ALL_ALGORITHMS.filter(isOct);

// Every algorithm that HAS a public JWK — i.e. everything but oct. `toJWK("public")`
// throws on an oct key, so this is the domain of every public-mode assertion below,
// including the key_ops guard. Its asymmetric coverage is therefore undiminished.
const ASYMMETRIC_ALGORITHMS = ALL_ALGORITHMS.filter((algorithm) => !isOct(algorithm));

const PUBLISHED_ALGORITHMS = ASYMMETRIC_ALGORITHMS.filter(
  (algorithm) => !UNREGISTERED_BY_DESIGN.includes(algorithm),
);

// What WebCrypto grants the PUBLIC half. This is the platform's truth table, not
// our `operations` getter (which describes the key material, and would say
// [sign, verify] for a full keypair).
const expectedUsages = (algorithm: KryptosAlgorithm): Array<string> => {
  if (algorithm.startsWith("ECDH-ES")) return []; // a public ECDH key gets NO usages
  if (algorithm.startsWith("RSA-OAEP")) return ["encrypt", "wrapKey"];
  return ["verify"]; // every signature algorithm
};

describe("Kryptos.toJWK jose interop matrix", () => {
  // Guards the matrix itself: every algorithm we ship lands in exactly one
  // bucket. A new algorithm cannot quietly fall out of the table.
  test("should account for every kryptos algorithm exactly once", () => {
    expect(
      [...PUBLISHED_ALGORITHMS, ...UNREGISTERED_BY_DESIGN, ...OCT_ALGORITHMS].sort(),
    ).toEqual([...ALL_ALGORITHMS].sort());
  });

  describe("published keys import into real jose", () => {
    test.each(PUBLISHED_ALGORITHMS)(
      "should import the public JWK we publish for %s",
      async (algorithm) => {
        const kryptos = KryptosKit.generate.auto({ algorithm });

        const imported = await importJWK(kryptos.toJWK("public"), algorithm);

        // A real WebCrypto CryptoKey, of the PUBLIC half, carrying exactly the
        // usages the platform grants it. Anything less would let a key that
        // merely failed to throw pass as importable.
        expect(imported).toBeInstanceOf(CryptoKey);
        expect((imported as CryptoKey).type).toBe("public");
        expect([...(imported as CryptoKey).usages].sort()).toEqual(
          expectedUsages(algorithm).sort(),
        );
      },
    );
  });

  describe("unregistered algorithms are rejected — intentionally", () => {
    test.each(UNREGISTERED_BY_DESIGN)(
      "should be rejected by jose on the alg value, not on key_ops (%s)",
      async (algorithm) => {
        const kryptos = KryptosKit.generate.auto({ algorithm });
        const jwk = kryptos.toJWK("public");

        // Pin the CAUSE. `key_ops` is absent, so the rejection cannot be blamed
        // on it — this fails on the `alg` value, because the alg is unregistered.
        // If this ever starts passing, jose has registered GCMKW and the accepted
        // risk is gone; if the message changes, the cause must be re-examined.
        expect("key_ops" in jwk).toBe(false);

        await expect(importJWK(jwk, algorithm)).rejects.toThrow(JOSE_UNSUPPORTED_ALG);
      },
    );
  });

  describe("key_ops is never emitted", () => {
    // No jose needed — a cheap unit assertion over the FULL matrix, so a future
    // re-add of the field is caught for every algorithm, not just the sampled few.
    //
    // The public sweep runs over every algorithm that HAS a public JWK — all 26
    // asymmetric ones, undiminished. It is the guard against the bug that once
    // meant no RP could verify any token we issued (see the header), so it is
    // scoped to the keys that reach an RP, never softened for the ones that don't.
    // The oct algorithms are absent because they have no public JWK at all — the
    // final describe block asserts that, so they are excluded, not skipped.
    test.each(ASYMMETRIC_ALGORITHMS)(
      "should omit key_ops from the public JWK (%s)",
      (algorithm) => {
        const jwk = KryptosKit.generate.auto({ algorithm }).toJWK("public");

        expect("key_ops" in jwk).toBe(false);
      },
    );

    // The private sweep keeps the FULL matrix — oct included. A private JWK is the
    // one JWK an oct key has, so the field must stay absent from it too.
    test.each(ALL_ALGORITHMS)(
      "should omit key_ops from the private JWK (%s)",
      (algorithm) => {
        const jwk = KryptosKit.generate.auto({ algorithm }).toJWK("private");

        expect("key_ops" in jwk).toBe(false);
      },
    );
  });

  describe("oct keys are excluded from the matrix", () => {
    // The justification for the exclusion, asserted rather than asserted-away: an
    // oct key has no public half (the secret lives in the private half), so it is
    // filtered out of the published JWKS by amphora and never reaches an RP.
    test.each(OCT_ALGORITHMS)(
      "should have no public half to publish (%s)",
      (algorithm) => {
        const kryptos = KryptosKit.generate.auto({ algorithm });

        expect(kryptos.hasPublicKey).toBe(false);
        expect(kryptos.hasPrivateKey).toBe(true);
      },
    );

    // ...and the export refuses to invent one. This is what makes the exclusion
    // above structural rather than a matter of taste: there is no public JWK to
    // feed jose, because asking for one is an error.
    test.each(OCT_ALGORITHMS)(
      "should refuse to produce a public JWK at all (%s)",
      (algorithm) => {
        const kryptos = KryptosKit.generate.auto({ algorithm });

        expect(() => kryptos.toJWK("public")).toThrow(
          expect.objectContaining({
            name: "KryptosError",
            code: "no_public_jwk",
          }),
        );
      },
    );
  });
});

// THE EC-CURVE HALF OF ECDH — the blind spot in the matrix above.
//
// `autoGenerateConfig` maps EVERY `ECDH-ES*` algorithm to OKP (X25519 for
// `ECDH-ES`/`+A128KW`/`+A128GCMKW`, X448 for the 192/256 variants), so
// `generate.auto` CANNOT produce an EC ECDH key. The matrix above therefore
// proves that OKP ECDH public JWKs import — and says nothing whatsoever about
// the EC ones, even though `KryptosKit.generate.enc.ec` produces them and a
// deployment can publish one into its JWKS. Same export surface, same two
// production blockers waiting; only the key type differs.
//
// So this block pins `type: "EC"` explicitly and re-runs the identical
// assertions over the full ECDH × EC-curve product.

const EC_ECDH_CASES: Array<[EcEncAlgorithm, EcCurve]> = ECDH_ES_ALGORITHMS.flatMap(
  (algorithm) => EC_CURVES.map((curve): [EcEncAlgorithm, EcCurve] => [algorithm, curve]),
);

const EC_ECDH_PUBLISHED = EC_ECDH_CASES.filter(
  ([algorithm]) => !UNREGISTERED_BY_DESIGN.includes(algorithm),
);

const EC_ECDH_UNREGISTERED = EC_ECDH_CASES.filter(([algorithm]) =>
  UNREGISTERED_BY_DESIGN.includes(algorithm),
);

describe("Kryptos.toJWK jose interop matrix — EC-curve ECDH", () => {
  // Guards the premise of this whole block: `auto` really does resolve every
  // ECDH-ES algorithm to OKP, which is WHY the matrix above cannot reach EC and
  // why these cases must name the type themselves. The day `auto` starts
  // resolving one of them to EC, this fails and the gap analysis is re-opened.
  test.each(ECDH_ES_ALGORITHMS)("should resolve %s to OKP under auto", (algorithm) => {
    expect(KryptosKit.getTypeForAlgorithm(algorithm)).toBe("OKP");
  });

  // The partition, same discipline as the matrix above: every ECDH algorithm on
  // every EC curve lands in exactly one bucket, and the buckets sum to the full
  // product. A new ECDH algorithm or a new EC curve cannot fall out of the table.
  test("should account for every ECDH algorithm on every EC curve exactly once", () => {
    expect([...EC_ECDH_PUBLISHED, ...EC_ECDH_UNREGISTERED].sort()).toEqual(
      [...EC_ECDH_CASES].sort(),
    );
    expect(EC_ECDH_CASES).toHaveLength(
      ECDH_ES_ALGORITHMS.length * EC_CURVES.length, // 7 × 3
    );
  });

  describe("published keys import into real jose", () => {
    test.each(EC_ECDH_PUBLISHED)(
      "should import the public JWK we publish for %s on %s",
      async (algorithm, curve) => {
        const kryptos = KryptosKit.generate.enc.ec({ algorithm, curve });

        // The point of the block: this must be an EC key on the requested curve,
        // not the OKP key `auto` would have handed us.
        expect(kryptos.type).toBe("EC");
        expect(kryptos.curve).toBe(curve);

        const jwk = kryptos.toJWK("public");

        expect("key_ops" in jwk).toBe(false);

        const imported = await importJWK(jwk, algorithm);

        // A real WebCrypto CryptoKey, of the PUBLIC half, carrying exactly the
        // usages the platform grants it — for a public ECDH key that is NONE.
        expect(imported).toBeInstanceOf(CryptoKey);
        expect((imported as CryptoKey).type).toBe("public");
        expect([...(imported as CryptoKey).usages].sort()).toEqual(
          expectedUsages(algorithm).sort(),
        );
      },
    );
  });

  describe("unregistered algorithms are rejected — intentionally", () => {
    test.each(EC_ECDH_UNREGISTERED)(
      "should be rejected by jose on the alg value, not on key_ops (%s on %s)",
      async (algorithm, curve) => {
        const kryptos = KryptosKit.generate.enc.ec({ algorithm, curve });
        const jwk = kryptos.toJWK("public");

        expect(kryptos.type).toBe("EC");
        expect(kryptos.curve).toBe(curve);

        // Same cause as the OKP variants, and pinned the same way: `key_ops` is
        // absent, so the rejection cannot be blamed on it. These fail on the
        // `alg` VALUE, because `ECDH-ES+A*GCMKW` is not a registered JWE
        // algorithm — RFC 7518 §4.6 defines `ECDH-ES` and the three `+A*KW`
        // forms and nothing else. Keeping them is the user's ruling; asserting
        // the rejection is how we keep that ruling honest instead of silent.
        expect("key_ops" in jwk).toBe(false);

        await expect(importJWK(jwk, algorithm)).rejects.toThrow(JOSE_UNSUPPORTED_ALG);
      },
    );
  });

  describe("key_ops is never emitted", () => {
    // The private half too — the field must be absent from BOTH modes, for the
    // EC curves exactly as for the OKP ones.
    test.each(EC_ECDH_CASES)(
      "should omit key_ops from the private JWK (%s on %s)",
      (algorithm, curve) => {
        const jwk = KryptosKit.generate.enc.ec({ algorithm, curve }).toJWK("private");

        expect("key_ops" in jwk).toBe(false);
      },
    );
  });
});
