import { describe, expect, test } from "vitest";
import {
  HASH_ALGORITHM,
  hashAlgorithmOf,
  parseCoseCertHash,
} from "./cose-hash-algorithms.js";

/**
 * THE SHARED TABLE AND THE SHARED PARSE — the contract `cose-cert-hash.ts`'s codec
 * and `cose-wide-cert-binding.ts`'s comparison both depend on, pinned here rather
 * than only through each of them.
 */
describe("HASH_ALGORITHM", () => {
  /**
   * ⚠ Against LITERALS: reading the labels back out of the table the production
   * code reads would agree with any table ever written. RFC 9054 §3.1, RFC 9054 §3.2.
   */
  test("carries exactly the four algorithms aegis can compute", () => {
    expect(
      HASH_ALGORITHM.map(({ label, name, jose, sha }) => ({ label, name, jose, sha })),
    ).toStrictEqual([
      { label: -16, name: "SHA-256", jose: "x5t#S256", sha: "SHA256" },
      { label: -14, name: "SHA-1", jose: "x5t", sha: "SHA1" },
      { label: -43, name: "SHA-384", jose: undefined, sha: "SHA384" },
      { label: -44, name: "SHA-512", jose: undefined, sha: "SHA512" },
    ]);
  });

  /**
   * ⚠ Exactly the two algorithms JOSE registers a parameter for (RFC 7515 §4.1.7,
   * RFC 7515 §4.1.8) carry a `jose` cell. A third would let a digest ride the domain
   * header under a parameter naming a different algorithm.
   */
  test("gives a jose parameter to exactly the two JOSE registers", () => {
    expect(
      HASH_ALGORITHM.filter((alg) => alg.jose !== undefined).map((alg) => alg.jose),
    ).toStrictEqual(["x5t#S256", "x5t"]);
  });
});

describe("hashAlgorithmOf", () => {
  // RFC 9360 §2 — both spellings name the same row.
  test.each([
    [-16, "SHA-256"],
    ["SHA-256", "SHA-256"],
    [-44, "SHA-512"],
    ["SHA-512", "SHA-512"],
  ])("resolves %s", (hashAlg, name) => {
    expect(hashAlgorithmOf(hashAlg)?.name).toBe(name);
  });

  test.each([
    ["SHA-512/256, which has no ShaKit method", -17],
    ["an unregistered label", -999],
    ["a name aegis does not carry", "SHA3-256"],
    ["a non-label value", { label: -16 }],
  ])("declines %s", (_what, hashAlg) => {
    expect(hashAlgorithmOf(hashAlg)).toBeUndefined();
  });
});

describe("parseCoseCertHash", () => {
  const DIGEST = Buffer.alloc(32, 7);

  test("parses a conformant COSE_CertHash to its row and its bytes", () => {
    expect(parseCoseCertHash([-16, DIGEST])).toStrictEqual({
      algorithm: HASH_ALGORITHM[0],
      digest: DIGEST,
    });
  });

  /**
   * ⚠ ONE parse, TWO consumers: a second copy means tightening one — a stricter
   * digest length, a rejected tagged value — leaves the other accepting on the
   * same bytes what the first refuses.
   */
  test.each([
    ["a non-array", "MIIBsample"],
    ["a one-element array", [-16]],
    ["a three-element array", [-16, Buffer.alloc(32), Buffer.alloc(32)]],
    ["a non-bstr hash value", [-16, "not-bytes"]],
    ["an algorithm the table does not carry", [-17, Buffer.alloc(32)]],
  ])("declines %s", (_what, value) => {
    expect(parseCoseCertHash(value)).toBeUndefined();
  });
});
